import { requireAuth } from './dashboard-auth.js';
import { downloadReceiptPDF, generateQRDataURL, buildQrPayload } from './receipt-generator.js?v=20261126l';
import { escapeHtml, logError, pluralRu } from './security.js';
import { attachModalA11y } from './modal-a11y.js';
import {
    normalizePhone,
    splitPhone,
    formatPhoneDisplay,
    phoneDigitsKey,
    getDefaultPhoneCountry,
    populateDialCodeSelect,
    wirePhoneInputPair,
    getCustomerContactLines,
    getCustomerContactSummary,
    escapeIlikePattern,
    quotePostgrestLiteral,
    fetchCurrentUserPhone
} from './phone-utils.js';
import { createSegmentedIndicator } from './segmented-indicator.js';
import { parseLocalDate } from './warranty-utils.js';
import { haptic, morphCopyButton } from './ui-effects.js';

function toSafeIsoDate(raw) {
    if (!raw) return '';
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    }
    const dt = parseLocalDate(raw);
    if (!dt || Number.isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

let currentClient = null;
let currentShop = null;

async function initBusinessPanel() {
    if (typeof window.showToast !== 'function') {
        window.showToast = (msg, type = 'error') => {
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.className = 'toast-container';
                document.body.appendChild(container);
            }
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = escapeHtml(msg);
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        };
    }

    let currentReceiptsList = [];
    const RECEIPTS_PAGE_SIZE = 25;
    const RECEIPTS_SELECT_FULL = 'id, receipt_number, status, lifecycle_status, status_changed_at, status_reason, refunded_amount, purchase_date, customer_email, customer_phone, customer_user_id, gross_total, net_total, vat_amount, currency, fiscal_hash, shop_id, created_at, shop_name, payment_method, pos_terminal_id, pos_serial, receipt_items(id, item_name, qty, unit_price, vat_rate, warranty_months, discount_rate, category, net_total, vat_amount, gross_total, sort_order, refunded_qty)';
    const RECEIPTS_SELECT_NOPHONE = 'id, receipt_number, status, lifecycle_status, status_changed_at, status_reason, refunded_amount, purchase_date, customer_email, gross_total, net_total, vat_amount, currency, fiscal_hash, shop_id, created_at, shop_name, payment_method, pos_terminal_id, pos_serial, receipt_items(id, item_name, qty, unit_price, vat_rate, warranty_months, net_total, vat_amount, gross_total, sort_order, refunded_qty)';
    const RECEIPTS_SELECT_LEGACY = 'id, receipt_number, status, purchase_date, customer_email, gross_total, net_total, vat_amount, currency, fiscal_hash, shop_id, created_at, shop_name, payment_method, receipt_items(id, item_name, qty, unit_price, vat_rate, warranty_months, net_total, vat_amount, gross_total, sort_order)';
    let receiptsTotalMatched = 0;
    let receiptsAllCount = 0;
    let isLoadingMoreReceipts = false;
    let isExportingReceipts = false;
    let receiptsQuerySeq = 0;
    let serverAnalyticsByPeriod = {};
    let receiptsChartInstance = null;
    let revenueChartInstance = null;
    let chartPeriod = 'week';

    const crosshairPlugin = {
        id: 'crosshair',
        afterDraw: function (chart) {
            const active = chart.tooltip?._active?.[0];
            if (!active) return;
            const ctx = chart.ctx;
            const chartArea = chart.chartArea;
            const x = active.element.x;
            if (x < chartArea.left || x > chartArea.right) return;
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
            ctx.lineWidth = 1;
            ctx.moveTo(x, chartArea.top);
            ctx.lineTo(x, chartArea.bottom);
            ctx.stroke();
            ctx.restore();
        }
    };

    let receiptFilter = 'all';
    let receiptSearchQuery = '';
    const expandedReceiptIds = new Set();

    function getLifecycleStatus(r) {
        return r?.lifecycle_status || 'active';
    }

    function isReceiptClosed(r) {
        const lc = getLifecycleStatus(r);
        return lc === 'voided' || lc === 'refunded';
    }

    function getNetReceiptRevenue(r) {
        if (isReceiptClosed(r)) return 0;
        const gross = parseFloat(r?.gross_total) || 0;
        if (getLifecycleStatus(r) === 'partially_refunded') {
            const ref = parseFloat(r?.refunded_amount) || 0;
            return Math.max(0, Math.round((gross - ref) * 100) / 100);
        }
        return gross;
    }

    function getVoidRemainingHours(r) {
        if (getLifecycleStatus(r) !== 'active' || !r?.created_at) return 0;
        const elapsedMs = Date.now() - new Date(r.created_at).getTime();
        const limitMs = 24 * 60 * 60 * 1000;
        if (elapsedMs > limitMs) return 0;
        return Math.max(1, Math.ceil((limitMs - elapsedMs) / (60 * 60 * 1000)));
    }

    function calcLineRefundAmount(item, deltaQty) {
        const qty = Math.max(1, parseInt(item.qty, 10) || 1);
        const already = Math.max(0, parseInt(item.refunded_qty, 10) || 0);
        const gross = parseFloat(item.gross_total) || 0;
        const safeDelta = Math.max(0, Math.min(qty - already, parseInt(deltaQty, 10) || 0));
        if (safeDelta <= 0) return 0;
        const prevCum = Math.round((gross * already / qty) * 100) / 100;
        const nextCum = (already + safeDelta >= qty)
            ? Math.round(gross * 100) / 100
            : Math.round((gross * (already + safeDelta) / qty) * 100) / 100;
        return Math.max(0, Math.round((nextCum - prevCum) * 100) / 100);
    }

    function matchesReceiptSearch(r, query, payMethodMap) {
        const q = (query || '').trim().toLowerCase();
        if (!q) return true;
        const receiptNum = r.receipt_number ? `#rcp-${r.receipt_number} rcp-${r.receipt_number} ${r.receipt_number}` : String(r.id || '');
        const payRaw = (r.payment_method || '').toLowerCase();
        const payLocalized = payMethodMap?.[payRaw] || '';
        const itemNames = Array.isArray(r.receipt_items)
            ? r.receipt_items.map(it => it.item_name || '').join(' ')
            : '';
        const phoneFormatted = r.customer_phone ? formatPhoneDisplay(r.customer_phone) : '';
        const haystack = [
            receiptNum,
            r.customer_email || '',
            r.customer_phone || '',
            phoneFormatted,
            r.pos_serial || '',
            payRaw,
            payLocalized,
            r.status_reason || '',
            itemNames
        ].join(' ').toLowerCase();
        if (haystack.includes(q)) return true;
        const qDigits = phoneDigitsKey(q);
        if (qDigits.length >= 3 && r.customer_phone) {
            return phoneDigitsKey(r.customer_phone).includes(qDigits);
        }
        return false;
    }

    function filterReceiptsList(receiptsList, payMethodMap) {
        let result = receiptsList || [];
        if (receiptFilter === 'active') {
            result = result.filter(r => getLifecycleStatus(r) === 'active');
        } else if (receiptFilter === 'closed') {
            result = result.filter(r => getLifecycleStatus(r) !== 'active');
        }
        if (receiptSearchQuery.trim()) {
            result = result.filter(r => matchesReceiptSearch(r, receiptSearchQuery, payMethodMap));
        }
        return result;
    }

    let lockedReceiptsMinHeight = 0;

    function lockReceiptsContainerHeight() {
        const container = document.querySelector('.receipts-list-container');
        if (!container) return;
        const currentH = container.getBoundingClientRect().height;
        if (currentH > lockedReceiptsMinHeight) {
            lockedReceiptsMinHeight = Math.round(currentH);
        }
        if (lockedReceiptsMinHeight > 0) {
            container.style.minHeight = `${lockedReceiptsMinHeight}px`;
        }
    }

    function releaseReceiptsContainerHeight() {
        const container = document.querySelector('.receipts-list-container');
        lockedReceiptsMinHeight = 0;
        if (container) {
            container.style.minHeight = '';
        }
    }

    function highlightMatch(rawText, query) {
        const text = rawText == null ? '' : String(rawText);
        const q = (query || '').trim();
        if (!q) return escapeHtml(text);
        const escapedPattern = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!escapedPattern) return escapeHtml(text);
        try {
            const regex = new RegExp(`(${escapedPattern})`, 'ig');
            const parts = text.split(regex);
            if (parts.length <= 1) return escapeHtml(text);
            return parts.map((part, idx) =>
                idx % 2 === 1 ? `<mark class="search-hit">${escapeHtml(part)}</mark>` : escapeHtml(part)
            ).join('');
        } catch (_) {
            return escapeHtml(text);
        }
    }

    function highlightPhoneMatch(rawPhone, query) {
        const text = rawPhone == null ? '' : String(rawPhone);
        const q = (query || '').trim();
        if (!q) return escapeHtml(text);
        if (text.toLowerCase().includes(q.toLowerCase())) {
            return highlightMatch(text, q);
        }
        const qDigits = q.replace(/\D/g, '');
        if (qDigits.length < 2) return escapeHtml(text);
        const digitIndices = [];
        let digitsOnly = '';
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch >= '0' && ch <= '9') {
                digitIndices.push(i);
                digitsOnly += ch;
            }
        }
        const matchPos = digitsOnly.indexOf(qDigits);
        if (matchPos === -1) return escapeHtml(text);
        let startIdx = digitIndices[matchPos];
        const endIdx = digitIndices[matchPos + qDigits.length - 1] + 1;
        if (q.startsWith('+') && startIdx > 0 && text[startIdx - 1] === '+') {
            startIdx -= 1;
        }
        return (
            escapeHtml(text.slice(0, startIdx)) +
            `<mark class="search-hit">${escapeHtml(text.slice(startIdx, endIdx))}</mark>` +
            escapeHtml(text.slice(endIdx))
        );
    }

    function updateExportMenuState(filteredCount, totalCount, t) {
        const currentLang = (window.getValuonLang ? window.getValuonLang() : (window.businessCurrentLang || 'en'));
        const bt = window.businessTranslations || {};
        const dict = t || bt[currentLang] || bt.ru || {};
        const matched = typeof filteredCount === 'number' ? filteredCount : receiptsTotalMatched;
        const all = typeof totalCount === 'number' ? totalCount : Math.max(receiptsAllCount, matched);
        const exportBtn = document.getElementById('export-receipts-btn');
        const xlsxBtn = document.getElementById('export-receipts-xlsx-btn');
        const csvBtn = document.getElementById('export-receipts-csv-btn');
        const scopeEl = document.getElementById('export-menu-scope');
        const hasReceipts = matched > 0;
        if (exportBtn) exportBtn.disabled = !hasReceipts || isExportingReceipts;
        if (xlsxBtn) xlsxBtn.disabled = !hasReceipts || isExportingReceipts;
        if (csvBtn) csvBtn.disabled = !hasReceipts || isExportingReceipts;
        if (scopeEl) {
            const isFiltered = receiptFilter !== 'all' || receiptSearchQuery.trim().length > 0;
            const tpl = isFiltered
                ? (dict.export_scope_filtered || 'По фильтру: {n} из {total}')
                : (dict.export_scope_all || 'Все чеки: {n}');
            scopeEl.textContent = tpl
                .replace('{n}', String(matched))
                .replace('{total}', String(all));
        }
    }

    function renderReceiptCards(gridEl, receiptsList, options = {}) {
        const currentLang = (window.getValuonLang ? window.getValuonLang() : (window.businessCurrentLang || 'en'));
        const bt = window.businessTranslations || {};
        const t = bt[currentLang] || bt.ru || {};
        const warrantySuffix = t.warranty_suffix || 'мес.';
        const payMethodMap = {
            card: t.payment_card || 'Card',
            cash: t.payment_cash || 'Cash',
        };

        const filtered = receiptsList || [];
        const matchedTotal = Math.max(receiptsTotalMatched, filtered.length);
        const shopTotal = Math.max(receiptsAllCount, matchedTotal);
        const searchQueryTrimmed = receiptSearchQuery.trim();
        const hasSearch = searchQueryTrimmed.length > 0;

        updateExportMenuState(matchedTotal, shopTotal, t);

        const searchMetaEl = document.getElementById('receipt-search-meta');
        const searchCounterEl = document.getElementById('receipt-search-counter');
        if (searchMetaEl && searchCounterEl) {
            if (hasSearch && shopTotal > 0) {
                const countTpl = t.search_results_count || (currentLang === 'en' ? 'Found: {found} of {total}' : 'Найдено: {found} из {total}');
                searchCounterEl.textContent = countTpl
                    .replace('{found}', String(matchedTotal))
                    .replace('{total}', String(shopTotal));
                searchMetaEl.style.display = 'flex';
            } else {
                searchMetaEl.style.display = 'none';
            }
        }

        const filteredEmptyMsg = document.getElementById('no-filtered-receipts-msg');
        if (filteredEmptyMsg) {
            const showEmpty = !!(shopTotal > 0 && filtered.length === 0);
            filteredEmptyMsg.style.display = showEmpty ? 'block' : 'none';
            if (showEmpty) {
                const iconEl = document.getElementById('no-filtered-receipts-icon');
                const titleEl = document.getElementById('no-filtered-receipts-title');
                const descEl = document.getElementById('no-filtered-receipts-desc');
                const resetBtn = document.getElementById('reset-receipt-filters-btn');
                if (iconEl) {
                    iconEl.innerHTML = hasSearch
                        ? '<i class="fa-solid fa-magnifying-glass"></i>'
                        : '<i class="fa-solid fa-filter"></i>';
                }
                if (titleEl) {
                    titleEl.setAttribute('data-i18n', hasSearch ? 'no_search_receipts_title' : 'no_filtered_receipts_title');
                    titleEl.textContent = hasSearch
                        ? (t.no_search_receipts_title || 'Ничего не найдено')
                        : (t.no_filtered_receipts_title || 'Нет чеков в этой категории');
                }
                if (descEl) {
                    descEl.setAttribute('data-i18n', hasSearch ? 'no_search_receipts_desc' : 'no_filtered_receipts_desc');
                    descEl.textContent = hasSearch
                        ? (t.no_search_receipts_desc || 'Попробуйте изменить поисковый запрос или выбрать другой фильтр.')
                        : (t.no_filtered_receipts_desc || 'Попробуйте выбрать другой фильтр.');
                }
                if (resetBtn) {
                    resetBtn.style.display = (hasSearch || receiptFilter !== 'all') ? 'inline-flex' : 'none';
                }
            }
        }

        if (filtered.length === 0) {
            gridEl.grid.innerHTML = '';
            gridEl.grid.style.display = 'none';
            return;
        }

        gridEl.grid.style.display = '';
        const locale = currentLang === 'ru' ? 'ru-RU' : 'en-US';
        const lcKeyMap = {
            voided: 'lifecycle_voided',
            refunded: 'lifecycle_refunded',
            partially_refunded: 'lifecycle_partially_refunded',
        };

        const headHtml = `
            <div class="receipt-ledger-head" aria-hidden="true">
                <div class="ledger-head-cell" data-i18n="ledger_col_receipt">${escapeHtml(t.ledger_col_receipt || 'Чек и клиент')}</div>
                <div class="ledger-head-cell" data-i18n="ledger_col_meta">${escapeHtml(t.ledger_col_meta || 'Дата и касса')}</div>
                <div class="ledger-head-cell" data-i18n="ledger_col_status">${escapeHtml(t.ledger_col_status || 'Статус')}</div>
                <div class="ledger-head-cell is-right" data-i18n="ledger_col_amount">${escapeHtml(t.ledger_col_amount || 'Сумма')}</div>
                <div class="ledger-head-cell is-right" data-i18n="ledger_col_actions">${escapeHtml(t.ledger_col_actions || 'Действия')}</div>
            </div>`;

        const animateRows = Boolean(options.animateRows);

        const rowsHtml = filtered.map((r, rowIdx) => {
            const lc = getLifecycleStatus(r);
            const closed = lc === 'voided' || lc === 'refunded';
            const isPartial = lc === 'partially_refunded';
            const isVerified = r.status === 'verified';
            const isExpanded = expandedReceiptIds.has(String(r.id));
            const purchaseDateObj = r.purchase_date ? parseLocalDate(r.purchase_date) : null;
            const dateStr = purchaseDateObj ? purchaseDateObj.toLocaleDateString(locale) : '—';
            const dateTimeSource = r.created_at ? new Date(r.created_at) : purchaseDateObj;
            const dateTimeStr = dateTimeSource
                ? dateTimeSource.toLocaleString(locale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                : dateStr;

            const lineItems = Array.isArray(r.receipt_items) ? r.receipt_items : [];
            const receiptNum = r.receipt_number ? `#RCP-${r.receipt_number}` : `#${String(r.id).slice(0, 8).toUpperCase()}`;
            const itemsCount = lineItems.length;
            const payMethodVal = r.payment_method ? r.payment_method.toLowerCase() : '';
            const payMethod = payMethodMap[payMethodVal] || r.payment_method || '—';
            const currency = r.currency || currentShop?.currency || 'EUR';
            const grossVal = parseFloat(r.gross_total) || 0;
            const vatVal = parseFloat(r.vat_amount) || 0;
            const netSubtotalVal = r.net_total != null && Number.isFinite(parseFloat(r.net_total))
                ? parseFloat(r.net_total)
                : Math.max(0, Math.round((grossVal - vatVal) * 100) / 100);
            const refundedVal = parseFloat(r.refunded_amount) || 0;
            const netRevenueVal = getNetReceiptRevenue(r);

            // Compact status cell
            const bindingShortKey = isVerified ? 'status_verified_short' : 'status_pending_short';
            const bindingShortText = t[bindingShortKey] || (isVerified ? 'Привязан' : 'Ожидает');
            const bindingFullKey = isVerified ? 'status_verified' : 'status_pending';
            const bindingFullText = t[bindingFullKey] || bindingShortText;

            let statusHtml = '';
            if (lc === 'active') {
                const statusMod = isVerified ? 'is-linked' : 'is-pending';
                statusHtml = `<span class="ledger-status-badge ${statusMod}">${escapeHtml(bindingShortText)}</span>`;
            } else if (isPartial) {
                statusHtml = `
                    <span class="ledger-status-badge is-partial">${escapeHtml(t.lifecycle_partially_refunded_short || t.lifecycle_partially_refunded || 'Част. возврат')}</span>
                    <span class="ledger-status-sub">${escapeHtml(bindingShortText)}</span>`;
            } else if (lc === 'refunded') {
                statusHtml = `<span class="ledger-status-badge is-refunded">${escapeHtml(t.lifecycle_refunded || 'Возврат')}</span>`;
            } else {
                statusHtml = `<span class="ledger-status-badge is-voided">${escapeHtml(t.lifecycle_voided || 'Аннулирован')}</span>`;
            }

            // Meta cell (date + payment · register)
            const subMetaParts = [escapeHtml(payMethod)];
            if (r.pos_serial) subMetaParts.push(highlightMatch(r.pos_serial, searchQueryTrimmed));
            const subMetaHtml = subMetaParts.join(' <span class="ledger-dot" aria-hidden="true">·</span> ');

            // Amount cell
            const amountHtml = closed
                ? `<span class="ledger-amount-main is-struck">${escapeHtml(window.formatCurrency(grossVal, currency, currentLang))}</span>`
                : isPartial
                    ? `<span class="ledger-amount-main">${escapeHtml(window.formatCurrency(netRevenueVal, currency, currentLang))}</span>
                       <span class="ledger-amount-delta">−${escapeHtml(window.formatCurrency(refundedVal, currency, currentLang))}</span>`
                    : `<span class="ledger-amount-main">${escapeHtml(window.formatCurrency(grossVal, currency, currentLang))}</span>`;

            // Actions cell
            const manageBtnHtml = !closed ? `
                <button type="button" class="ledger-btn ledger-btn-refund btn-manage-lifecycle" data-id="${escapeHtml(r.id)}" data-i18n-title="lifecycle_manage_tooltip" title="${escapeHtml(t.lifecycle_manage_tooltip || 'Возврат / Аннулирование')}">
                    <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
                    <span data-i18n="lifecycle_manage_btn">${escapeHtml(t.lifecycle_manage_btn || 'Возврат')}</span>
                </button>` : '';

            const shareBtnHtml = r.fiscal_hash ? `
                <button type="button" class="ledger-btn ledger-btn-share btn-share-receipt" data-id="${escapeHtml(r.id)}" data-i18n-title="share_receipt_title" title="${escapeHtml(t.share_receipt_title || 'Поделиться ссылкой на чек')}" aria-label="${escapeHtml(t.share_receipt_title || 'Поделиться ссылкой на чек')}">
                    <i class="fa-solid fa-share-nodes" aria-hidden="true"></i>
                </button>` : '';

            const downloadBtnHtml = `
                <button type="button" class="ledger-btn ledger-btn-download btn-download-receipt" data-id="${escapeHtml(r.id)}" data-i18n-title="download_receipt_title" title="${escapeHtml(t.download_receipt_title || 'Скачать чек')}">
                    <i class="fa-solid fa-download" aria-hidden="true"></i>
                    <span data-i18n="download_btn">${escapeHtml(t.download_btn || 'Скачать')}</span>
                </button>`;

            // Expanded drawer — structured metadata grid
            const metaFields = [
                {
                    icon: isVerified ? 'fa-user-check' : 'fa-clock',
                    label: t.ledger_details_binding || 'Привязка',
                    value: bindingFullText,
                },
                {
                    icon: payMethodVal === 'cash' ? 'fa-money-bill-wave' : 'fa-credit-card',
                    label: t.ledger_details_payment || 'Оплата',
                    value: payMethod,
                },
                {
                    icon: 'fa-calendar-day',
                    label: t.ledger_details_date || 'Дата и время',
                    value: dateTimeStr,
                    tabular: true,
                },
            ];
            if (r.pos_serial) {
                metaFields.push({
                    icon: 'fa-cash-register',
                    label: t.ledger_details_register || 'Касса',
                    value: r.pos_serial,
                    tabular: true,
                });
            }

            const drawerMetaGridHtml = `
                <div class="ledger-meta-grid">
                    ${metaFields.map(f => `
                        <div class="ledger-meta-cell">
                            <span class="ledger-meta-label"><i class="fa-solid ${f.icon}" aria-hidden="true"></i> ${escapeHtml(f.label)}</span>
                            <span class="ledger-meta-value${f.tabular ? ' is-tabular' : ''}">${escapeHtml(f.value)}</span>
                        </div>`).join('')}
                </div>`;

            // Expanded drawer — quick actions (Copy receipt #, Verify QR)
            const verifyHref = r.fiscal_hash
                ? `verify.html?from=business.html#sig=${encodeURIComponent(r.fiscal_hash)}`
                : 'verify.html?from=business.html';

            const drawerQuickActionsHtml = `
                <div class="ledger-quick-actions">
                    <button type="button" class="ledger-quick-btn btn-copy-receipt-num" data-receipt-num="${escapeHtml(receiptNum)}">
                        <i class="fa-regular fa-copy" aria-hidden="true"></i>
                        <span>${escapeHtml(t.ledger_action_copy || 'Копировать №')}</span>
                    </button>
                    <a href="${verifyHref}" class="ledger-quick-btn btn-verify-receipt">
                        <i class="fa-solid fa-qrcode" aria-hidden="true"></i>
                        <span>${escapeHtml(t.ledger_action_verify || 'Проверить QR')}</span>
                    </a>
                </div>`;

            // Expanded drawer — structured tabular items list
            const eachWord = t.ledger_unit_price_each || 'за шт.';
            const noWarrantyLabel = t.ledger_no_warranty || 'Без гарантии';

            const drawerItemsHtml = itemsCount > 0 ? `
                <div class="ledger-drawer-section">
                    <div class="ledger-items-table${closed ? ' is-struck' : ''}">
                        <div class="ledger-items-head" aria-hidden="true">
                            <span>${escapeHtml(t.ledger_col_item_name || 'Позиция')}</span>
                            <span class="is-right">${escapeHtml(t.ledger_col_item_qty || 'Кол-во')}</span>
                            <span class="is-right">${escapeHtml(t.ledger_col_item_warranty || 'Гарантия')}</span>
                            <span class="is-right">${escapeHtml(t.ledger_col_item_total || 'Сумма')}</span>
                        </div>
                        <ul class="ledger-items-list${closed ? ' is-struck' : ''}">
                            ${lineItems.map(it => {
                const qty = Math.max(1, parseInt(it.qty, 10) || 1);
                const refQty = Math.max(0, parseInt(it.refunded_qty, 10) || 0);
                const fullRef = !closed && refQty >= qty;
                const partRef = !closed && refQty > 0 && refQty < qty;
                const refPill = fullRef
                    ? `<span class="item-refund-pill">${escapeHtml(t.lifecycle_item_returned_badge || 'Возвращено')}</span>`
                    : partRef
                        ? `<span class="item-refund-pill partial">${escapeHtml((t.lifecycle_item_returned_short || '−{n} возвр.').replace('{n}', String(refQty)))}</span>`
                        : '';
                const hasWarranty = it.warranty_months && Number(it.warranty_months) > 0 && !fullRef && !closed;
                const warrantyHtml = hasWarranty
                    ? `<span class="ledger-item-warranty">${escapeHtml(String(it.warranty_months))} ${escapeHtml(warrantySuffix)}</span>`
                    : `<span class="ledger-item-warranty is-none">${escapeHtml(noWarrantyLabel)}</span>`;
                const lineGross = it.gross_total != null ? parseFloat(it.gross_total) : NaN;
                const unitPriceVal = it.unit_price != null && Number.isFinite(parseFloat(it.unit_price))
                    ? parseFloat(it.unit_price)
                    : (Number.isFinite(lineGross) ? lineGross / qty : NaN);
                const unitSubParts = [];
                if (qty > 1 && Number.isFinite(unitPriceVal)) {
                    unitSubParts.push(`${escapeHtml(window.formatCurrency(unitPriceVal, currency, currentLang))} ${escapeHtml(eachWord)}`);
                }
                const discVal = it.discount_rate != null ? parseFloat(it.discount_rate) : 0;
                if (Number.isFinite(discVal) && discVal > 0) {
                    unitSubParts.push(`−${escapeHtml(String(discVal))}%`);
                }
                const vatVal = it.vat_rate != null ? parseFloat(it.vat_rate) : NaN;
                if (Number.isFinite(vatVal) && vatVal > 0) {
                    const vatPrefix = currentLang === 'en' ? 'VAT' : 'НДС';
                    unitSubParts.push(`${vatPrefix} ${escapeHtml(String(vatVal))}%`);
                }
                const unitSubHtml = unitSubParts.length
                    ? `<span class="ledger-item-unit">${unitSubParts.join(' · ')}</span>`
                    : '';
                const linePriceHtml = Number.isFinite(lineGross)
                    ? `<span class="ledger-item-price">${escapeHtml(window.formatCurrency(lineGross, currency, currentLang))}</span>`
                    : `<span class="ledger-item-price">—</span>`;
                return `
                                <li class="ledger-item-row${fullRef ? ' item-row-refunded' : ''}">
                                    <div class="ledger-item-col-name">
                                        <div class="ledger-item-title-line">
                                            <span class="item-name">${highlightMatch(it.item_name, searchQueryTrimmed)}</span>
                                            ${refPill}
                                        </div>
                                        ${unitSubHtml}
                                    </div>
                                    <div class="ledger-item-col-qty">×${qty}</div>
                                    <div class="ledger-item-col-warranty">${warrantyHtml}</div>
                                    <div class="ledger-item-col-price">${linePriceHtml}</div>
                                </li>`;
            }).join('')}
                        </ul>
                    </div>
                </div>` : '';

            // Expanded drawer — lifecycle callout banner
            let lifecycleMetaHtml = '';
            if (lc !== 'active' && (r.status_reason || r.status_changed_at || refundedVal > 0)) {
                const changedStr = r.status_changed_at ? new Date(r.status_changed_at).toLocaleDateString(locale) : '';
                const reasonText = r.status_reason ? escapeHtml(r.status_reason) : '';
                const refSumText = (lc === 'partially_refunded' || lc === 'refunded') && refundedVal > 0
                    ? ` · −${escapeHtml(window.formatCurrency(refundedVal, currency, currentLang))}`
                    : '';
                lifecycleMetaHtml = `
                    <div class="receipt-lifecycle-meta is-${escapeHtml(lc)}">
                        <span><strong>${escapeHtml(t[lcKeyMap[lc]] || '')}</strong>${changedStr ? ` · ${escapeHtml(changedStr)}` : ''}${refSumText}</span>
                        ${reasonText ? `<span>${escapeHtml(t.lifecycle_reason_prefix || 'Причина:')} ${reasonText}</span>` : ''}
                    </div>`;
            }

            // Expanded drawer — financial summary (Net / VAT / Refunded / Total)
            const uniqueVatRates = [...new Set(
                lineItems
                    .map(it => (it.vat_rate != null && it.vat_rate !== '' ? Number(it.vat_rate) : null))
                    .filter(v => Number.isFinite(v))
            )];
            const vatRateSuffix = uniqueVatRates.length === 1 && uniqueVatRates[0] > 0 ? ` (${uniqueVatRates[0]}%)` : '';
            const summaryRefundRowHtml = refundedVal > 0
                ? `<div class="ledger-summary-row is-refund">
                       <span>${escapeHtml(t.ledger_summary_refunded || 'Возвращено')}</span>
                       <span>−${escapeHtml(window.formatCurrency(refundedVal, currency, currentLang))}</span>
                   </div>`
                : '';

            const drawerSummaryHtml = `
                <div class="ledger-summary-box">
                    <div class="ledger-summary-row">
                        <span>${escapeHtml(t.ledger_summary_net || 'Нетто')}</span>
                        <span>${escapeHtml(window.formatCurrency(netSubtotalVal, currency, currentLang))}</span>
                    </div>
                    <div class="ledger-summary-row">
                        <span>${escapeHtml(t.ledger_summary_vat || 'НДС')}${escapeHtml(vatRateSuffix)}</span>
                        <span>${escapeHtml(window.formatCurrency(vatVal, currency, currentLang))}</span>
                    </div>
                    ${summaryRefundRowHtml}
                    <div class="ledger-summary-row is-total">
                        <span>${escapeHtml(t.ledger_summary_total || 'Итого к учёту')}</span>
                        <span class="${closed ? 'is-struck' : ''}">${escapeHtml(window.formatCurrency(closed ? grossVal : netRevenueVal, currency, currentLang))}</span>
                    </div>
                </div>`;

            const animDelayStyle = animateRows && rowIdx < 12 ? ` style="--row-delay:${rowIdx * 18}ms"` : '';

            const customerEmail = (r.customer_email || '').trim();
            const customerPhoneDisplay = r.customer_phone ? formatPhoneDisplay(r.customer_phone) : '';
            const customerContactHtml = customerEmail
                ? `<span class="ledger-customer-email" title="${escapeHtml(customerEmail)}">${highlightMatch(customerEmail, searchQueryTrimmed)}</span>` +
                (customerPhoneDisplay ? `<span class="ledger-customer-phone" title="${escapeHtml(customerPhoneDisplay)}">${highlightPhoneMatch(customerPhoneDisplay, searchQueryTrimmed)}</span>` : '')
                : (customerPhoneDisplay
                    ? `<span class="ledger-customer-email" title="${escapeHtml(customerPhoneDisplay)}"><i class="fa-solid fa-phone" aria-hidden="true" style="font-size:0.75em;margin-right:4px;opacity:0.7;"></i>${highlightPhoneMatch(customerPhoneDisplay, searchQueryTrimmed)}</span>`
                    : `<span class="ledger-customer-email">—</span>`);

            return `
            <div class="receipt-ledger-item status-${escapeHtml(r.status)} lifecycle-${escapeHtml(lc)}${isExpanded ? ' is-expanded' : ''}${animateRows ? ' is-row-enter' : ''}"${animDelayStyle}
                 data-receipt-id="${escapeHtml(r.id)}"
                 data-receipt-status="${escapeHtml(r.status)}"
                 data-lifecycle-status="${escapeHtml(lc)}"
                 data-receipt-date="${escapeHtml(r.purchase_date)}">
                <div class="receipt-ledger-summary" role="button" tabindex="0" aria-expanded="${isExpanded ? 'true' : 'false'}" aria-label="${escapeHtml(receiptNum)} — ${escapeHtml(t.ledger_expand_label || 'Показать детали чека')}">
                    <div class="ledger-col-receipt">
                        <span class="ledger-chevron" aria-hidden="true"><i class="fa-solid fa-chevron-right"></i></span>
                        <div class="ledger-receipt-text">
                            <span class="ledger-receipt-num" title="${escapeHtml(receiptNum)}">${highlightMatch(receiptNum, searchQueryTrimmed)}</span>
                            ${customerContactHtml}
                        </div>
                    </div>
                    <div class="ledger-col-meta">
                        <span class="ledger-date receipt-date">${escapeHtml(dateStr)}</span>
                        <span class="ledger-submeta">${subMetaHtml}</span>
                    </div>
                    <div class="ledger-col-status">${statusHtml}</div>
                    <div class="ledger-col-amount">${amountHtml}</div>
                    <div class="ledger-col-actions">
                        ${manageBtnHtml}
                        ${shareBtnHtml}
                        ${downloadBtnHtml}
                    </div>
                </div>
                <div class="ledger-drawer" aria-hidden="${isExpanded ? 'false' : 'true'}">
                    <div class="ledger-drawer-inner">
                        <div class="ledger-drawer-content">
                            <div class="ledger-drawer-top">
                                ${drawerMetaGridHtml}
                                ${drawerQuickActionsHtml}
                            </div>
                            ${drawerItemsHtml}
                            <div class="ledger-drawer-footer">
                                ${lifecycleMetaHtml ? `<div class="ledger-drawer-footer-left">${lifecycleMetaHtml}</div>` : ''}
                                ${drawerSummaryHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        gridEl.grid.innerHTML = `${headHtml}<div class="receipt-ledger-body">${rowsHtml}</div>`;
    }

    const auth = await requireAuth();
    if (!auth) return;

    const { user, client } = auth;
    currentClient = client;

    const cachedShop = sessionStorage.getItem('current_shop');
    if (cachedShop) {
        try {
            const parsedShop = JSON.parse(cachedShop);
            if (parsedShop && parsedShop.owner_id === user.id) {
                currentShop = parsedShop;
            } else {
                sessionStorage.removeItem('current_shop');
                currentShop = null;
            }
        } catch (e) {
            logError('biz:parseCachedShop', e);
            currentShop = null;
        }
    }

    const views = {
        shop: document.getElementById('create-shop-view'),
        dashboard: document.getElementById('shop-dashboard-view')
    };
    const loader = document.getElementById('app-loader');
    const forms = {
        shop: document.getElementById('create-shop-form'),
        receipt: document.getElementById('issue-receipt-form')
    };
    const modal = {
        el: document.getElementById('create-receipt-modal'),
        openBtn: document.getElementById('open-create-receipt-btn'),
        closeBtn: document.getElementById('close-receipt-modal'),
        cancelBtn: document.getElementById('cancel-receipt-modal')
    };
    const itemsList = document.getElementById('receipt-items-list');
    const itemTemplate = document.getElementById('receipt-item-template');
    const addItemBtn = document.getElementById('add-item-row-btn');
    const totalPreviewEl = document.getElementById('receipt-total-preview-value');
    const totalDetailEl = document.getElementById('receipt-total-detail');
    const totalVatEl = document.getElementById('receipt-total-vat');
    const guardEl = document.getElementById('receipt-draft-guard');
    const emailInput = document.getElementById('customer-email');
    const emailGroup = document.getElementById('customer-email-group');
    const emailErrorEl = document.getElementById('customer-email-error');
    const autocompleteEl = document.getElementById('customer-autocomplete');
    const contactLabelEl = document.getElementById('customer-contact-label');
    const emailWrap = document.getElementById('customer-email-wrap');
    const phoneWrap = document.getElementById('customer-phone-wrap');
    const phoneCountrySelect = document.getElementById('customer-phone-country');
    const phoneInput = document.getElementById('customer-phone');
    const phoneAutocompleteEl = document.getElementById('customer-phone-autocomplete');
    const contactModeSwitchEl = document.querySelector('.contact-mode-switch');
    const contactModeIndicatorEl = document.getElementById('contact-mode-indicator');
    const contactModeBtns = [...document.querySelectorAll('.contact-mode-switch [data-contact-mode]')];
    const continueDraftBtn = document.getElementById('continue-draft-btn');
    const modalBody = document.getElementById('receipt-modal-body');
    const successScreen = document.getElementById('receipt-success-screen');
    const submitBtn = document.getElementById('issue-receipt-submit-btn');
    const submitLabelEl = document.getElementById('issue-receipt-submit-label');

    const clientChipEl = document.getElementById('receipt-client-chip');
    const clientChipText = document.getElementById('client-chip-text');
    const clientChipEditBtn = document.getElementById('client-chip-edit-btn');
    const clientExpandedEl = document.getElementById('receipt-client-expanded');

    function collapseClientSectionIfFilled() {
        if (window.innerWidth > 640 || !clientChipEl || !clientExpandedEl) return;
        const contactVal = contactMode === 'phone' ? phoneInput?.value.trim() : emailInput?.value.trim();
        const isContactReady = contactMode === 'phone'
            ? Boolean(contactVal && normalizePhone(phoneCountrySelect?.value, contactVal))
            : Boolean(contactVal && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactVal));
        if (isContactReady) {
            const payMethodSelect = forms.receipt?.querySelector('[name="payment_method"]');
            const t = bizT();
            const payText = payMethodSelect?.value === 'cash'
                ? (t.payment_cash || (bizLang() === 'en' ? 'Cash' : 'Наличные'))
                : (t.payment_card || (bizLang() === 'en' ? 'Card' : 'Карта'));
            if (clientChipText) clientChipText.textContent = `${contactVal} · ${payText}`;
            clientChipEl.classList.remove('is-hidden');
            clientExpandedEl.classList.add('is-collapsed');
        }
    }

    function expandClientSection() {
        if (!clientChipEl || !clientExpandedEl) return;
        clientChipEl.classList.add('is-hidden');
        clientExpandedEl.classList.remove('is-collapsed');
    }

    clientChipEditBtn?.addEventListener('click', () => {
        expandClientSection();
        if (contactMode === 'phone') {
            phoneInput?.focus();
        } else {
            emailInput?.focus();
        }
    });

    const contactModeIndicator = createSegmentedIndicator(contactModeSwitchEl, contactModeIndicatorEl, {
        itemSelector: '[data-contact-mode]',
        activeClass: 'active'
    });

    const DRAFT_KEY = `biz-receipt-draft:${user.id}`;
    const CONTACT_MODE_STORAGE_PREFIX = 'valuon-biz-contact-mode:';
    let issuingClose = false;
    let guardVisible = false;
    let baselineDate = '';
    let lastIssuedReceipt = null;
    let customerHistory = null;
    let customerHistoryPromise = null;
    let currentTerminals = [];
    let contactMode = 'email';
    let bizPhonePair = null;

    function getSavedShopContactMode() {
        if (!currentShop?.id) return 'email';
        try {
            const saved = localStorage.getItem(`${CONTACT_MODE_STORAGE_PREFIX}${currentShop.id}`);
            return saved === 'phone' ? 'phone' : 'email';
        } catch (_) {
            return 'email';
        }
    }

    function saveShopContactMode(mode) {
        if (!currentShop?.id) return;
        try {
            localStorage.setItem(`${CONTACT_MODE_STORAGE_PREFIX}${currentShop.id}`, mode === 'phone' ? 'phone' : 'email');
        } catch (_) { /* ignore storage restrictions */ }
    }

    function getDefaultBizCountry() {
        return getDefaultPhoneCountry(currentShop?.country, bizLang());
    }

    function ensureBizPhoneSelect(selectedCode) {
        if (!phoneCountrySelect) return;
        const lang = bizLang();
        const code = selectedCode || phoneCountrySelect.value || getDefaultBizCountry();
        populateDialCodeSelect(phoneCountrySelect, lang, code);
        if (selectedCode && Array.from(phoneCountrySelect.options).some((o) => o.value === selectedCode)) {
            phoneCountrySelect.value = selectedCode;
        }
        if (!bizPhonePair && phoneInput) {
            bizPhonePair = wirePhoneInputPair(phoneCountrySelect, phoneInput, {
                defaultCode: code,
                lang,
                onInput: () => {
                    if (emailGroup?.classList.contains('is-invalid')) validateCustomerContactField(true);
                    renderPhoneAutocomplete();
                }
            });
        } else {
            if (typeof CustomSelect !== 'undefined' && phoneCountrySelect._cs) {
                phoneCountrySelect._cs.refresh();
            }
            bizPhonePair?.updatePlaceholder();
        }
    }

    function setContactMode(mode, { focus = false, instant = false } = {}) {
        contactMode = mode === 'phone' ? 'phone' : 'email';
        const isPhone = contactMode === 'phone';
        const t = bizT();

        contactModeBtns.forEach((btn) => {
            const active = btn.dataset.contactMode === contactMode;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', String(active));
        });
        contactModeIndicator.update(instant);

        if (emailWrap) {
            emailWrap.classList.toggle('is-active', !isPhone);
            emailWrap.setAttribute('aria-hidden', String(isPhone));
            emailWrap.inert = isPhone;
        }
        if (phoneWrap) {
            phoneWrap.classList.toggle('is-active', isPhone);
            phoneWrap.setAttribute('aria-hidden', String(!isPhone));
            phoneWrap.inert = !isPhone;
        }

        if (emailInput) emailInput.required = !isPhone;
        if (phoneInput) phoneInput.required = isPhone;

        if (contactLabelEl) {
            contactLabelEl.setAttribute('for', isPhone ? 'customer-phone' : 'customer-email');
            contactLabelEl.setAttribute('data-i18n', isPhone ? 'customer_phone_label' : 'customer_email_label');
            contactLabelEl.textContent = isPhone
                ? (t.customer_phone_label || (bizLang() === 'en' ? 'Customer Phone' : 'Телефон покупателя'))
                : (t.customer_email_label || (bizLang() === 'en' ? 'Customer Email' : 'Email покупателя'));
        }

        if (isPhone) ensureBizPhoneSelect();
        hideAutocomplete();
        setFieldError(emailGroup, emailErrorEl, '');

        if (focus) {
            if (isPhone) phoneInput?.focus();
            else {
                emailInput?.focus();
            }
        }
    }

    contactModeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.dataset.contactMode === contactMode) return;
            setContactMode(btn.dataset.contactMode, { focus: false });
            saveShopContactMode(contactMode);
        });
    });

    ensureBizPhoneSelect();

    function fmtMoney(v) {
        const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
        return window.formatCurrency(v, currentShop?.currency || 'EUR', lang);
    }

    function defaultDateString() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d}T${h}:${min}`;
    }

    function collectFormData() {
        const fd = forms.receipt;
        if (!fd) return null;
        const items = readItemRows()
            .filter((it) => it.itemName || it.unitPrice > 0)
            .map((it) => ({
                item_name: it.itemName,
                qty: it.qty || 1,
                price: it.unitPrice,
                vat_rate: it.vatRate,
                warranty_months: it.warrantyMonths,
                discount: it.discount,
                category: it.category
            }));
        return {
            contact_mode: contactMode,
            email: contactMode === 'email' ? (fd.querySelector('[name="customer_email"]')?.value.trim() || '') : '',
            phone_country: phoneCountrySelect?.value || '',
            phone_local: contactMode === 'phone' ? (phoneInput?.value.trim() || '') : '',
            payment: fd.querySelector('[name="payment_method"]').value || 'card',
            purchase_date: fd.querySelector('[name="purchase_date"]').value || '',
            pos_terminal_id: fd.querySelector('[name="pos_terminal_id"]')?.value || '',
            items
        };
    }

    function draftEquals(a, b) {
        if ((a.contact_mode || 'email') !== (b.contact_mode || 'email')) return false;
        if ((a.email || '') !== (b.email || '')) return false;
        if ((a.phone_local || '') !== (b.phone_local || '')) return false;
        if ((a.phone_local || b.phone_local) && (a.phone_country || '') !== (b.phone_country || '')) return false;
        if ((a.payment || 'card') !== (b.payment || 'card')) return false;
        if ((a.pos_terminal_id || '') !== (b.pos_terminal_id || '')) return false;
        if ((a.purchase_date || '') && (a.purchase_date || '') !== (b.purchase_date || '')) return false;
        const ai = a.items || [];
        const bi = b.items || [];
        if (ai.length !== bi.length) return false;
        for (let i = 0; i < ai.length; i++) {
            const x = ai[i];
            const y = bi[i];
            if ((x.item_name || '') !== (y.item_name || '')) return false;
            if ((Number(x.qty) || 0) !== (Number(y.qty) || 0)) return false;
            if ((Number(x.price) || 0) !== (Number(y.price) || 0)) return false;
            if ((Number(x.vat_rate) || 0) !== (Number(y.vat_rate) || 0)) return false;
            if ((Number(x.warranty_months) || 0) !== (Number(y.warranty_months) || 0)) return false;
        }
        return true;
    }

    function isFormDirty() {
        const d = collectFormData();
        if (!d) return false;
        return draftHasContent(d);
    }

    function readDraft() {
        try {
            const raw = sessionStorage.getItem(DRAFT_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function syncDraftButton() {
        if (!continueDraftBtn) return;
        const hasDraft = draftHasContent(readDraft());
        continueDraftBtn.classList.toggle('is-hidden', !hasDraft);
    }

    function clearDraft() {
        try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { }
        syncDraftButton();
        expandClientSection();
    }

    function saveDraft() {
        try {
            const d = collectFormData();
            if (!draftHasContent(d)) {
                sessionStorage.removeItem(DRAFT_KEY);
                syncDraftButton();
                return 'empty';
            }
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
            syncDraftButton();
            return 'saved';
        } catch (e) {
            return 'error';
        }
    }

    function draftHasContent(d) {
        if (!d) return false;
        if (d.email) return true;
        if (d.phone_local) return true;
        if (d.payment && d.payment !== 'card') return true;
        const refDate = baselineDate || defaultDateString();
        if (d.purchase_date && d.purchase_date !== refDate) return true;
        if (Array.isArray(d.items)) {
            return d.items.some((it) => (
                (it.item_name && String(it.item_name).trim()) ||
                Number(it.price) > 0
            ));
        }
        return false;
    }

    function applyDraft(d) {
        if (!forms.receipt || !d) return;
        const mode = d.contact_mode === 'phone' ? 'phone' : 'email';
        if (d.phone_country) ensureBizPhoneSelect(d.phone_country);
        else ensureBizPhoneSelect(getDefaultBizCountry());
        setContactMode(mode, { instant: true });
        if (d.email && emailInput) {
            emailInput.value = d.email;
        }
        if (d.phone_local && phoneInput) {
            phoneInput.value = d.phone_local;
            bizPhonePair?.formatCurrent();
        }
        if (d.payment) {
            forms.receipt.querySelector('[name="payment_method"]').value = d.payment;
        }
        const posEl = forms.receipt.querySelector('[name="pos_terminal_id"]');
        if (posEl && d.pos_terminal_id !== undefined) {
            posEl.value = d.pos_terminal_id || '';
        }
        if (d.items && Array.isArray(d.items) && d.items.length) {
            itemsList.innerHTML = '';
            d.items.forEach((it) => {
                addItemRow();
                const row = itemsList.lastElementChild;
                if (!row) return;
                row.querySelector('[data-field="item_name"]').value = it.item_name || '';
                row.querySelector('[data-field="qty"]').value = it.qty || 1;
                row.querySelector('[data-field="price"]').value = it.price ?? '';
                row.querySelector('[data-field="vat_rate"]').value = it.vat_rate ?? '';
                const wMonths = it.warranty_months ?? '';
                row.querySelector('[data-field="warranty_months"]').value = wMonths;
                if (wMonths !== '') {
                    row.querySelector('.item-warranty')?.querySelectorAll('.warranty-chip').forEach(c => {
                        c.classList.toggle('is-selected', c.dataset.months === String(wMonths));
                    });
                }
                row.querySelector('[data-field="discount"]').value = it.discount ?? '';
                row.querySelector('[data-field="category"]').value = it.category || '';
            });
            updateRemoveButtonsState();
            renumberRows();
        } else {
            resetItemRows();
        }
    }

    // --- Динамические позиции чека ---------------------------------

    function categoryBlankLabel() {
        const t = bizT();
        return t.category_none || (bizLang() === 'en' ? 'No category' : 'Без категории');
    }

    function renderItemCategoryOptions(select) {
        if (!select || typeof window.renderDeviceTypeOptions !== 'function') return;
        window.renderDeviceTypeOptions(select, bizLang(), { withIcons: true, blankLabel: categoryBlankLabel() });
    }

    function refreshItemCategorySelects() {
        if (!itemsList) return;
        itemsList.querySelectorAll('[data-field="category"]').forEach((select) => {
            renderItemCategoryOptions(select);
            if (select._cs) select._cs.refresh();
        });
    }

    function addItemRow(focusName, { scroll = false } = {}) {
        if (!itemsList || !itemTemplate) return;
        const node = itemTemplate.content.firstElementChild.cloneNode(true);
        const priceSuffix = node.querySelector('.item-price .suffix-hint');
        if (priceSuffix) priceSuffix.textContent = window.currencySymbol(currentShop?.currency || 'EUR');
        const categorySelect = node.querySelector('[data-field="category"]');
        renderItemCategoryOptions(categorySelect);
        node.classList.add('is-row-new');
        itemsList.appendChild(node);
        setTimeout(() => node.classList.remove('is-row-new'), 300);
        if (categorySelect && typeof CustomSelect !== 'undefined') CustomSelect.init(node);
        updateRemoveButtonsState();
        renumberRows();
        updateTotalPreview();

        // Smoothly scroll the newly added item into view only when explicitly requested
        if (scroll) {
            requestAnimationFrame(() => {
                node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                node.classList.add('item-row-flash');
                setTimeout(() => node.classList.remove('item-row-flash'), 650);
            });
        }

        // Focus first field only on desktop
        if (focusName && window.innerWidth > 768) {
            const nameInput = node.querySelector('[data-field="item_name"]');
            if (nameInput) nameInput.focus();
        }
    }

    function renumberRows() {
        if (!itemsList) return;
        const rows = itemsList.querySelectorAll('[data-item-row]');
        rows.forEach((row, i) => {
            const idx = row.querySelector('[data-item-index]');
            if (idx) idx.textContent = String(i + 1);
        });
        const pill = document.getElementById('receipt-items-count');
        if (pill) {
            const count = String(rows.length);
            if (pill.textContent !== count) {
                pill.textContent = count;
                pill.classList.remove('bump');
                void pill.offsetWidth;
                pill.classList.add('bump');
            }
        }
    }

    function updateRemoveButtonsState() {
        if (!itemsList) return;
        const rows = itemsList.querySelectorAll('[data-item-row]');
        rows.forEach(row => {
            const btn = row.querySelector('.btn-remove-item');
            if (btn) btn.disabled = rows.length <= 1;
        });
    }

    function resetItemRows() {
        if (!itemsList) return;
        resetReceiptRowDeleteConfirm();
        itemsList.innerHTML = '';
        addItemRow();
        renumberRows();
    }

    function readItemRows() {
        if (!itemsList) return [];
        const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
        return [...itemsList.querySelectorAll('[data-item-row]')].map((row, index) => {
            const itemName = row.querySelector('[data-field="item_name"]').value.trim();
            const rawQty = Number(row.querySelector('[data-field="qty"]').value);
            const qty = Number.isFinite(rawQty) && rawQty > 0 ? Math.floor(rawQty) : 0;
            const rawPrice = parseFloat(row.querySelector('[data-field="price"]').value);
            const unitPrice = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
            let vatRate = parseFloat(row.querySelector('[data-field="vat_rate"]').value);
            if (isNaN(vatRate) || vatRate < 0) vatRate = 0;
            if (vatRate > 100) vatRate = 100;
            let warrantyMonths = parseInt(row.querySelector('[data-field="warranty_months"]').value, 10);
            if (isNaN(warrantyMonths) || warrantyMonths < 1) warrantyMonths = 0;
            if (warrantyMonths > 600) warrantyMonths = 600;
            let discount = parseFloat(row.querySelector('[data-field="discount"]').value);
            if (isNaN(discount) || discount < 0) discount = 0;
            if (discount > 100) discount = 100;
            const category = (row.querySelector('[data-field="category"]').value || '').trim();

            const baseTotal = round2(qty * unitPrice);
            const discountAmount = round2(baseTotal * (discount / 100));
            const netTotal = round2(baseTotal - discountAmount);
            const vatAmount = round2(netTotal * (vatRate / 100));
            const grossTotal = round2(netTotal + vatAmount);

            return { itemName, qty, unitPrice, vatRate, warrantyMonths, discount, category, discountAmount, netTotal, vatAmount, grossTotal, sortOrder: index };
        });
    }

    function updateTotalPreview() {
        if (!totalPreviewEl) return;
        const items = readItemRows();
        const gross = items.reduce((sum, it) => sum + it.grossTotal, 0);
        const totalStr = fmtMoney(gross);
        if (totalPreviewEl.textContent !== totalStr) {
            totalPreviewEl.textContent = totalStr;
            totalPreviewEl.classList.remove('pop');
            void totalPreviewEl.offsetWidth;
            totalPreviewEl.classList.add('pop');
        }

        const gj = (window.getValuonLang ? window.getValuonLang() : 'en');
        const t = window.businessTranslations?.[gj] || {};
        const vatWord = t.vat_word || (gj === 'en' ? 'VAT:' : 'НДС:');

        if (itemsList) {
            // "Сумма" по позиции — это то, что реально заплатит покупатель за эту
            // строку, то есть С учётом налога (gross), а не только qty*price со
            // скидкой без налога. Раньше здесь пересчитывали заново без НДС —
            // из-за этого показанная сумма по строке не совпадала с тем, что в
            // итоге попадает в чек (netTotal+vatAmount). Берём готовые значения
            // из readItemRows(), чтобы расчёт был ровно один и тот же везде.
            const rows = itemsList.querySelectorAll('[data-item-row]');
            rows.forEach((row, i) => {
                const sub = row.querySelector('[data-row-subtotal]');
                const vatEl = row.querySelector('[data-row-vat]');
                const it = items[i];
                if (!it) return;

                if (sub) {
                    const str = fmtMoney(it.grossTotal);
                    if (sub.textContent !== str) {
                        sub.textContent = str;
                        sub.classList.remove('pop');
                        void sub.offsetWidth;
                        sub.classList.add('pop');
                    }
                }

                if (vatEl) {
                    const vatStr = it.vatAmount > 0 ? `${vatWord} ${fmtMoney(it.vatAmount)}` : '';
                    if (vatEl.textContent !== vatStr) vatEl.textContent = vatStr;
                }
            });
        }

        if (totalDetailEl) {
            const filled = items.filter((it) => it.itemName || it.unitPrice > 0);
            const positions = filled.length;
            const totalQty = items.reduce((s, it) => s + it.qty, 0);
            const vat = items.reduce((s, it) => s + it.vatAmount, 0);
            const discTotal = items.reduce((s, it) => s + it.discountAmount, 0);
            const word = gj === 'en'
                ? (positions === 1 ? (t.units?.one || 'item') : (t.units?.many || 'items'))
                : (t.units
                    ? pluralRu(positions, t.units.one, t.units.few, t.units.many)
                    : pluralRu(positions, 'позиция', 'позиции', 'позиций'));
            const qWord = t.qty_word || (gj === 'en' ? 'pcs' : 'шт.');
            const discWord = t.discount_word || (gj === 'en' ? 'discount' : 'скидка');
            totalDetailEl.textContent = positions
                ? `${positions} ${word} · ${totalQty} ${qWord}${discTotal > 0 ? ` · ${discWord} −${fmtMoney(discTotal)}` : ''}`
                : '';
            if (totalVatEl) {
                const vatStr = vat > 0 ? `${vatWord} ${fmtMoney(vat)}` : '';
                if (totalVatEl.textContent !== vatStr) {
                    totalVatEl.textContent = vatStr;
                    totalVatEl.classList.toggle('has-vat', vat > 0);
                }
            }
        }

        updateSubmitLabel();
    }

    itemsList?.addEventListener('input', updateTotalPreview);
    itemsList?.addEventListener('focusin', () => {
        collapseClientSectionIfFilled();
    });
    addItemBtn?.addEventListener('click', () => {
        addItemRow(true, { scroll: true });
        collapseClientSectionIfFilled();
    });
    let receiptRowDeleteConfirmBtn = null;
    let receiptRowDeleteConfirmTimer = null;

    function resetReceiptRowDeleteConfirm() {
        if (receiptRowDeleteConfirmTimer) {
            clearTimeout(receiptRowDeleteConfirmTimer);
            receiptRowDeleteConfirmTimer = null;
        }
        if (receiptRowDeleteConfirmBtn) {
            receiptRowDeleteConfirmBtn.classList.remove('is-confirming');
            receiptRowDeleteConfirmBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            receiptRowDeleteConfirmBtn = null;
        }
    }

    itemsList?.addEventListener('click', (e) => {
        const chip = e.target.closest('.warranty-chip');
        if (chip) {
            e.preventDefault();
            const group = chip.closest('.item-warranty') || chip.closest('.input-group');
            const input = group?.querySelector('[data-field="warranty_months"]');
            if (input) {
                input.value = chip.dataset.months || '0';
                group.querySelectorAll('.warranty-chip').forEach(c => c.classList.toggle('is-selected', c === chip));
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return;
        }

        const btn = e.target.closest('.btn-remove-item');
        if (!btn) return;
        const row = btn.closest('[data-item-row]');
        if (!row || row.classList.contains('is-removing')) return;
        if (itemsList.querySelectorAll('[data-item-row]').length <= 1) return;

        const hasRowContent = Boolean(
            String(row.querySelector('[data-field="item_name"]')?.value || '').trim()
            || String(row.querySelector('[data-field="price"]')?.value || '').trim()
        );
        if (hasRowContent && receiptRowDeleteConfirmBtn !== btn) {
            resetReceiptRowDeleteConfirm();
            receiptRowDeleteConfirmBtn = btn;
            const lang = bizLang();
            btn.classList.add('is-confirming');
            btn.innerHTML = `<i class="fa-solid fa-trash"></i><span>${escapeHtml(lang === 'en' ? 'Delete?' : 'Удалить?')}</span>`;
            receiptRowDeleteConfirmTimer = setTimeout(resetReceiptRowDeleteConfirm, 3000);
            return;
        }
        resetReceiptRowDeleteConfirm();

        // Замеряем реальную высоту строки, чтобы плавно схлопнуть именно её,
        // а не дёргать layout скачком — остальные позиции при этом сами
        // плавно "подтягиваются" вверх благодаря transition на max-height.
        const measuredHeight = row.getBoundingClientRect().height;
        row.style.maxHeight = measuredHeight + 'px';
        row.style.overflow = 'hidden';
        // Форсируем reflow, чтобы браузер зафиксировал стартовую высоту
        // перед тем как мы анимируем её в 0.
        // eslint-disable-next-line no-unused-expressions
        row.offsetHeight;

        row.classList.add('is-removing');

        let settled = false;
        const finishRemoval = () => {
            if (settled) return;
            settled = true;
            row.removeEventListener('transitionend', onTransitionEnd);
            row.remove();
            updateRemoveButtonsState();
            renumberRows();
            updateTotalPreview();
        };
        const onTransitionEnd = (ev) => {
            if (ev.target !== row || ev.propertyName !== 'max-height') return;
            finishRemoval();
        };
        row.addEventListener('transitionend', onTransitionEnd);
        // Фолбэк на случай если transitionend не сработает (например вкладка
        // была в фоне и анимации были заморожены браузером).
        setTimeout(finishRemoval, 360);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                row.style.maxHeight = '0px';
                row.classList.add('collapsed');
            });
        });
    });

    // --- Валидация в реальном времени -----------------------------

    function bizLang() {
        return (window.getValuonLang ? window.getValuonLang() : 'en');
    }
    function bizT() {
        return window.businessTranslations?.[bizLang()] || {};
    }

    function setFieldError(groupEl, errorEl, message) {
        if (!groupEl || !errorEl) return;
        if (message) {
            groupEl.classList.add('is-invalid');
            errorEl.textContent = message;
        } else {
            groupEl.classList.remove('is-invalid');
            errorEl.textContent = '';
        }
    }

    function validateCustomerContactField(showError) {
        const t = bizT();
        if (contactMode === 'phone') {
            const raw = phoneInput?.value.trim() || '';
            if (!raw) {
                if (showError) setFieldError(emailGroup, emailErrorEl, t.error_phone_required || (bizLang() === 'en' ? 'Enter customer phone number' : 'Введите номер телефона покупателя'));
                return false;
            }
            const normalized = normalizePhone(phoneCountrySelect?.value, raw);
            if (!normalized) {
                if (showError) setFieldError(emailGroup, emailErrorEl, t.error_phone_invalid || (bizLang() === 'en' ? 'Invalid phone number format' : 'Некорректный формат номера телефона'));
                return false;
            }
            setFieldError(emailGroup, emailErrorEl, '');
            return true;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const value = emailInput?.value.trim() || '';
        if (!value) {
            if (showError) setFieldError(emailGroup, emailErrorEl, t.error_email_required || (bizLang() === 'en' ? 'Enter customer email' : 'Введите email покупателя'));
            return false;
        }
        if (!emailRegex.test(value)) {
            if (showError) setFieldError(emailGroup, emailErrorEl, t.error_email_invalid || (bizLang() === 'en' ? 'Invalid email format' : 'Некорректный формат email'));
            return false;
        }
        setFieldError(emailGroup, emailErrorEl, '');
        return true;
    }

    function validateEmailField(showError) {
        return validateCustomerContactField(showError);
    }

    function validateItemRow(row, showError) {
        if (!row) return true;
        const errorEl = row.querySelector('[data-item-error]');
        const nameInput = row.querySelector('[data-field="item_name"]');
        const qtyInput = row.querySelector('[data-field="qty"]');
        const priceInput = row.querySelector('[data-field="price"]');
        const vatInput = row.querySelector('[data-field="vat_rate"]');
        const discountInput = row.querySelector('[data-field="discount"]');
        const warrantyInput = row.querySelector('[data-field="warranty_months"]');
        const t = bizT();
        const isEn = bizLang() === 'en';

        const name = nameInput?.value.trim() || '';
        const qtyRaw = qtyInput?.value.trim() || '';
        const qty = Number(qtyRaw);
        const priceRaw = priceInput?.value.trim() || '';
        const price = Number(priceRaw);
        const vatRaw = vatInput?.value.trim() || '';
        const vat = vatRaw === '' ? 0 : Number(vatRaw);
        const discountRaw = discountInput?.value.trim() || '';
        const discount = discountRaw === '' ? 0 : Number(discountRaw);
        const warrantyRaw = warrantyInput?.value.trim() || '';
        const warranty = warrantyRaw === '' ? 0 : Number(warrantyRaw);

        let message = '';
        if (!name) {
            message = t.error_item_name || (isEn ? 'Enter a product name' : 'Укажите название товара');
        } else if (qtyRaw === '' || !Number.isInteger(qty) || qty < 1) {
            message = t.error_item_qty || (isEn ? 'Quantity must be a whole number of at least 1' : 'Количество должно быть целым числом не меньше 1');
        } else if (priceRaw === '' || !Number.isFinite(price) || price < 0) {
            message = t.error_item_price || (isEn ? 'Enter a valid price (0 or more)' : 'Укажите корректную цену (не меньше 0)');
        } else if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
            message = t.error_item_vat || (isEn ? 'Tax rate must be between 0 and 100%' : 'Ставка налога должна быть от 0 до 100%');
        } else if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
            message = t.error_item_discount || (isEn ? 'Discount must be between 0 and 100%' : 'Скидка должна быть от 0 до 100%');
        } else if (!Number.isInteger(warranty) || warranty < 0 || warranty > 600) {
            message = t.error_item_warranty || (isEn ? 'Warranty must be between 0 and 600 months' : 'Гарантия должна быть целым числом от 0 до 600 мес.');
        }

        if (message) {
            if (showError) {
                row.classList.add('is-invalid');
                if (errorEl) errorEl.textContent = message;
            }
            return false;
        }
        row.classList.remove('is-invalid');
        if (errorEl) errorEl.textContent = '';
        return true;
    }

    function validateAllItemRows(showError) {
        if (!itemsList) return true;
        const rows = [...itemsList.querySelectorAll('[data-item-row]')];
        let allValid = true;
        rows.forEach((row) => {
            if (!validateItemRow(row, showError)) allValid = false;
        });
        return allValid;
    }

    function clearAllValidationState() {
        setFieldError(emailGroup, emailErrorEl, '');
        itemsList?.querySelectorAll('[data-item-row]').forEach((row) => {
            row.classList.remove('is-invalid');
            const err = row.querySelector('[data-item-error]');
            if (err) err.textContent = '';
        });
    }

    emailInput?.addEventListener('blur', () => {
        if (contactMode === 'email') validateCustomerContactField(true);
        setTimeout(hideAutocomplete, 120);
    });
    emailInput?.addEventListener('input', () => {
        if (emailGroup?.classList.contains('is-invalid')) validateCustomerContactField(true);
        renderAutocomplete();
    });
    emailInput?.addEventListener('focus', () => {
        renderAutocomplete();
    });

    phoneInput?.addEventListener('blur', () => {
        if (contactMode === 'phone') validateCustomerContactField(true);
        setTimeout(hideAutocomplete, 120);
    });
    phoneInput?.addEventListener('focus', () => {
        renderPhoneAutocomplete();
    });

    itemsList?.addEventListener('focusout', (e) => {
        const row = e.target.closest?.('[data-item-row]');
        if (row) validateItemRow(row, true);
    });
    itemsList?.addEventListener('input', (e) => {
        if (e.target.matches('[data-field="warranty_months"]')) {
            const group = e.target.closest('.item-warranty') || e.target.closest('.input-group');
            const val = e.target.value.trim();
            group?.querySelectorAll('.warranty-chip').forEach(c => {
                c.classList.toggle('is-selected', c.dataset.months === val);
            });
        }
        const row = e.target.closest?.('[data-item-row]');
        if (row && row.classList.contains('is-invalid')) validateItemRow(row, true);
        updateSubmitLabel();
    });

    // --- Автокомплит клиента ---------------------------------------

    async function loadCustomerHistory() {
        if (!currentShop) return { emails: [], phones: [] };
        if (customerHistory) return customerHistory;
        if (customerHistoryPromise) return customerHistoryPromise;
        customerHistoryPromise = (async () => {
            let res = await client
                .from('business_receipts')
                .select('customer_email, customer_phone, status')
                .eq('shop_id', currentShop.id)
                .order('created_at', { ascending: false })
                .limit(200);
            if (res.error && res.error.code === '42703') {
                res = await client
                    .from('business_receipts')
                    .select('customer_email, status')
                    .eq('shop_id', currentShop.id)
                    .order('created_at', { ascending: false })
                    .limit(200);
            }
            if (res.error || !res.data) {
                customerHistory = { emails: [], phones: [] };
                return customerHistory;
            }
            const seenEmails = new Map();
            const seenPhones = new Map();
            res.data.forEach((r) => {
                if (r.customer_email && !seenEmails.has(r.customer_email)) {
                    seenEmails.set(r.customer_email, r.status);
                }
                if (r.customer_phone && !seenPhones.has(r.customer_phone)) {
                    seenPhones.set(r.customer_phone, { status: r.status, email: r.customer_email || '' });
                }
            });
            customerHistory = {
                emails: [...seenEmails.entries()].map(([email, status]) => ({ email, status })),
                phones: [...seenPhones.entries()].map(([phone, meta]) => ({ phone, status: meta.status, email: meta.email }))
            };
            return customerHistory;
        })().catch(() => {
            customerHistory = { emails: [], phones: [] };
            return customerHistory;
        });
        return customerHistoryPromise;
    }

    function hideAutocomplete() {
        if (autocompleteEl) {
            autocompleteEl.classList.add('is-hidden');
            autocompleteEl.innerHTML = '';
        }
        if (phoneAutocompleteEl) {
            phoneAutocompleteEl.classList.add('is-hidden');
            phoneAutocompleteEl.innerHTML = '';
        }
    }

    async function renderAutocomplete() {
        if (!autocompleteEl || !emailInput || contactMode !== 'email') return;
        const query = emailInput.value.trim().toLowerCase();
        if (!query) { hideAutocomplete(); return; }
        const history = await loadCustomerHistory();
        if (emailInput.value.trim().toLowerCase() !== query) return;
        const matches = (history?.emails || [])
            .filter((c) => c.email.toLowerCase().includes(query) && c.email.toLowerCase() !== query)
            .slice(0, 5);
        if (matches.length === 0) { hideAutocomplete(); return; }
        autocompleteEl.innerHTML = matches.map((c) => (
            `<li role="option" data-email="${escapeHtml(c.email)}">
                <i class="fa-regular fa-user" aria-hidden="true"></i>
                <span>${escapeHtml(c.email)}</span>
                ${c.status === 'verified' ? '<i class="fa-solid fa-circle-check autocomplete-verified" aria-hidden="true"></i>' : ''}
            </li>`
        )).join('');
        autocompleteEl.classList.remove('is-hidden');
    }

    async function renderPhoneAutocomplete() {
        if (!phoneAutocompleteEl || !phoneInput || contactMode !== 'phone') return;
        const raw = phoneInput.value.trim();
        const digits = phoneDigitsKey(raw);
        if (digits.length < 2) { hideAutocomplete(); return; }
        const history = await loadCustomerHistory();
        if (phoneInput.value.trim() !== raw) return;
        const currentNorm = normalizePhone(phoneCountrySelect?.value, raw);
        const matches = (history?.phones || [])
            .filter((c) => {
                if (currentNorm && c.phone === currentNorm) return false;
                return phoneDigitsKey(c.phone).includes(digits);
            })
            .slice(0, 5);
        if (matches.length === 0) { hideAutocomplete(); return; }
        phoneAutocompleteEl.innerHTML = matches.map((c) => {
            const label = formatPhoneDisplay(c.phone);
            const subEmail = c.email ? `<span class="autocomplete-sub">${escapeHtml(c.email)}</span>` : '';
            return `<li role="option" data-phone="${escapeHtml(c.phone)}">
                <i class="fa-solid fa-phone" aria-hidden="true"></i>
                <span class="autocomplete-main">
                    <span class="autocomplete-primary">${escapeHtml(label)}</span>
                    ${subEmail}
                </span>
                ${c.status === 'verified' ? '<i class="fa-solid fa-circle-check autocomplete-verified" aria-hidden="true"></i>' : ''}
            </li>`;
        }).join('');
        phoneAutocompleteEl.classList.remove('is-hidden');
    }

    function selectEmailAutocompleteItem(item) {
        if (!item || !emailInput) return;
        emailInput.value = item.dataset.email;
        hideAutocomplete();
        validateCustomerContactField(false);
        emailInput.focus();
    }

    function selectPhoneAutocompleteItem(item) {
        if (!item || !phoneInput) return;
        if (bizPhonePair) {
            bizPhonePair.setFromE164(item.dataset.phone, getDefaultBizCountry());
        } else {
            const parts = splitPhone(item.dataset.phone, getDefaultBizCountry());
            if (phoneCountrySelect && parts.code) {
                phoneCountrySelect.value = parts.code;
                if (typeof CustomSelect !== 'undefined' && phoneCountrySelect._cs) {
                    phoneCountrySelect._cs.refresh();
                }
            }
            phoneInput.value = parts.local;
        }
        hideAutocomplete();
        validateCustomerContactField(false);
        phoneInput.focus();
    }

    function attachAutocompleteKeyboard(inputEl, listEl, onSelect) {
        if (!inputEl || !listEl) return;
        inputEl.addEventListener('keydown', (e) => {
            if (listEl.classList.contains('is-hidden')) return;
            const items = Array.from(listEl.querySelectorAll('li[role="option"]'));
            if (items.length === 0) return;

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const currentIdx = items.findIndex((li) => li.classList.contains('is-active'));
                const delta = e.key === 'ArrowDown' ? 1 : -1;
                const nextIdx = currentIdx === -1
                    ? (delta > 0 ? 0 : items.length - 1)
                    : (currentIdx + delta + items.length) % items.length;
                items.forEach((li, idx) => li.classList.toggle('is-active', idx === nextIdx));
                items[nextIdx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                const activeItem = listEl.querySelector('li[role="option"].is-active');
                if (activeItem) {
                    e.preventDefault();
                    onSelect(activeItem);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                hideAutocomplete();
            }
        });
    }

    autocompleteEl?.addEventListener('mousedown', (e) => {
        const item = e.target.closest('[data-email]');
        if (!item) return;
        e.preventDefault();
        selectEmailAutocompleteItem(item);
    });

    phoneAutocompleteEl?.addEventListener('mousedown', (e) => {
        const item = e.target.closest('[data-phone]');
        if (!item) return;
        e.preventDefault();
        selectPhoneAutocompleteItem(item);
    });

    attachAutocompleteKeyboard(emailInput, autocompleteEl, selectEmailAutocompleteItem);
    attachAutocompleteKeyboard(phoneInput, phoneAutocompleteEl, selectPhoneAutocompleteItem);

    document.addEventListener('click', (e) => {
        const emailOpen = autocompleteEl && !autocompleteEl.classList.contains('is-hidden');
        const phoneOpen = phoneAutocompleteEl && !phoneAutocompleteEl.classList.contains('is-hidden');
        if (!emailOpen && !phoneOpen) return;
        if (
            e.target === emailInput ||
            e.target === phoneInput ||
            autocompleteEl?.contains(e.target) ||
            phoneAutocompleteEl?.contains(e.target)
        ) return;
        hideAutocomplete();
    });

    // --- Динамическая сумма на кнопке отправки ----------------------

    function updateSubmitLabel() {
        if (!submitLabelEl) return;
        const t = bizT();
        const base = t.issue_receipt_submit || (bizLang() === 'en' ? 'Issue Receipt' : 'Выписать чек');
        const gross = readItemRows().reduce((sum, it) => sum + it.grossTotal, 0);
        submitLabelEl.textContent = gross > 0 ? `${base} · ${fmtMoney(gross)}` : base;
    }

    // --- Экран успеха -------------------------------------------------

    function buildReceiptSharePayload(receiptData) {
        if (!receiptData) return null;
        let verifyUrl = null;
        try {
            const { data: qrData } = buildQrPayload({
                ...receiptData,
                tax_id: currentShop?.tax_id,
                shop_id: receiptData.shop_id || currentShop?.id
            });
            if (qrData && qrData.startsWith('http')) verifyUrl = qrData;
        } catch (_) { /* fallback below */ }

        if (!verifyUrl && receiptData.fiscal_hash) {
            const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : 'https://valuon.app';
            const isLocal = window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1';
            const verifyPath = isLocal ? '/verify.html' : '/verify';
            verifyUrl = `${origin}${verifyPath}#sig=${encodeURIComponent(receiptData.fiscal_hash)}`;
        }
        if (!verifyUrl) return null;

        const lang = bizLang();
        const shopName = receiptData.shop_name || currentShop?.shop_name || 'Valuon';
        const num = receiptData.receipt_number ? `#RCP-${receiptData.receipt_number}` : `#${String(receiptData.id || '').slice(0, 8).toUpperCase()}`;
        const currency = receiptData.currency || currentShop?.currency || 'EUR';
        const amountStr = typeof window.formatCurrency === 'function'
            ? window.formatCurrency(parseFloat(receiptData.gross_total) || 0, currency, lang)
            : `${(parseFloat(receiptData.gross_total) || 0).toFixed(2)} ${currency}`;

        const title = lang === 'en' ? `Receipt ${num} — ${shopName}` : `Чек ${num} — ${shopName}`;
        const text = lang === 'en'
            ? `Your digital receipt ${num} from ${shopName} (${amountStr}):`
            : `Ваш цифровой чек ${num} от ${shopName} (${amountStr}):`;

        const phoneDigits = String(receiptData.customer_phone || '').replace(/\D/g, '');
        const waBase = phoneDigits.length >= 7 ? `https://wa.me/${phoneDigits}` : 'https://wa.me/';
        const waUrl = `${waBase}?text=${encodeURIComponent(`${text} ${verifyUrl}`)}`;
        const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(verifyUrl)}&text=${encodeURIComponent(text)}`;

        return { verifyUrl, title, text, waUrl, tgUrl };
    }

    async function shareReceiptViaSystemOrCopy(receiptData) {
        const payload = buildReceiptSharePayload(receiptData);
        if (!payload) return;
        const lang = bizLang();
        const t = bizT();
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            try {
                await navigator.share({ title: payload.title, text: payload.text, url: payload.verifyUrl });
                return;
            } catch (err) {
                if (err?.name === 'AbortError') return;
            }
        }
        try {
            await navigator.clipboard.writeText(payload.verifyUrl);
            window.showToast(t.share_link_copied || (lang === 'en' ? 'Receipt link copied' : 'Ссылка на чек скопирована'), 'success');
        } catch (_) {
            window.open(payload.waUrl, '_blank', 'noopener,noreferrer');
        }
    }

    function showSuccessScreen(receiptData) {
        haptic([12, 40, 18]);
        lastIssuedReceipt = receiptData;
        const t = bizT();
        const numEl = document.getElementById('receipt-success-number');
        const emailEl = document.getElementById('receipt-success-email');
        const paymentEl = document.getElementById('receipt-success-payment');
        const itemsCountEl = document.getElementById('receipt-success-items-count');
        const statusEl = document.getElementById('receipt-success-status');
        const totalEl = document.getElementById('receipt-success-total');
        const qrImg = document.getElementById('receipt-success-qr-img');
        const copyBtn = document.getElementById('success-copy-url-btn');
        const openBtn = document.getElementById('success-open-url-btn');

        if (numEl) numEl.textContent = receiptData.receipt_number ? `#RCP-${receiptData.receipt_number}` : `#${String(receiptData.id).slice(0, 8).toUpperCase()}`;
        if (emailEl) {
            const contactLines = getCustomerContactLines(receiptData);
            emailEl.textContent = '';
            if (contactLines.length === 0) {
                emailEl.textContent = bizLang() === 'en' ? 'Not specified' : 'Не указан';
            } else {
                contactLines.forEach((line, idx) => {
                    const part = document.createElement('span');
                    if (idx > 0) part.className = 'success-contact-sub';
                    part.textContent = line;
                    emailEl.appendChild(part);
                });
            }
        }
        if (paymentEl) {
            const payMethod = receiptData.payment_method === 'cash'
                ? (t.payment_cash || (bizLang() === 'en' ? 'Cash' : 'Наличные'))
                : (t.payment_card || (bizLang() === 'en' ? 'Card' : 'Карта'));
            paymentEl.textContent = payMethod;
        }
        if (itemsCountEl) {
            const items = receiptData.receipt_items || [];
            const count = Array.isArray(items) ? items.length : 1;
            itemsCountEl.textContent = bizLang() === 'en' ? `${count} items` : `${count} шт.`;
        }
        if (statusEl) {
            statusEl.textContent = receiptData.status === 'verified'
                ? (t.status_verified || (bizLang() === 'en' ? 'Linked to Customer' : 'Привязан к клиенту'))
                : (t.status_pending || (bizLang() === 'en' ? 'Awaiting Registration' : 'Ожидает регистрации'));
            statusEl.className = 'receipt-success-status-value ' + (receiptData.status === 'verified' ? 'status-ok' : 'status-wait');
        }
        if (totalEl) totalEl.textContent = fmtMoney(receiptData.gross_total || 0);

        try {
            const { data: qrData } = buildQrPayload({
                ...receiptData,
                tax_id: currentShop?.tax_id,
                shop_id: receiptData.shop_id || currentShop?.id
            });

            if (qrImg && qrData) {
                const qrDataUrl = generateQRDataURL(qrData, 220);
                if (qrDataUrl) {
                    qrImg.src = qrDataUrl;
                }
            }

            let verifyUrl = qrData && qrData.startsWith('http') ? qrData : null;
            if (!verifyUrl && receiptData.fiscal_hash) {
                const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : 'https://valuon.app';
                verifyUrl = `${origin}/verify.html#sig=${encodeURIComponent(receiptData.fiscal_hash)}`;
            }

            if (openBtn) {
                if (verifyUrl) {
                    let openUrl = verifyUrl;
                    if (typeof window !== 'undefined' && window.location?.origin && receiptData.fiscal_hash) {
                        openUrl = `${window.location.origin}/verify.html#sig=${encodeURIComponent(receiptData.fiscal_hash)}`;
                    }
                    openBtn.href = openUrl;
                    openBtn.classList.remove('is-hidden');
                } else {
                    openBtn.classList.add('is-hidden');
                }
            }

            if (copyBtn) {
                if (verifyUrl) {
                    copyBtn.classList.remove('is-hidden');
                    copyBtn.dataset.url = verifyUrl;
                } else {
                    copyBtn.classList.add('is-hidden');
                }
            }

            const sharePayload = buildReceiptSharePayload(receiptData);
            const shareBtn = document.getElementById('success-share-btn');
            const waBtn = document.getElementById('success-wa-btn');
            const tgBtn = document.getElementById('success-tg-btn');
            if (shareBtn) {
                if (sharePayload && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                    shareBtn.classList.remove('is-hidden');
                } else {
                    shareBtn.classList.add('is-hidden');
                }
            }
            if (waBtn) {
                if (sharePayload) {
                    waBtn.href = sharePayload.waUrl;
                    waBtn.classList.remove('is-hidden');
                } else {
                    waBtn.classList.add('is-hidden');
                }
            }
            if (tgBtn) {
                if (sharePayload) {
                    tgBtn.href = sharePayload.tgUrl;
                    tgBtn.classList.remove('is-hidden');
                } else {
                    tgBtn.classList.add('is-hidden');
                }
            }
        } catch (qrErr) {
            logError('biz:showSuccessScreen:qr', qrErr);
        }

        const prefersReduced = typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const modalContent = modal.el?.querySelector('.modal-content');

        const morphHeight = (swapFn) => {
            if (!modalContent || prefersReduced) {
                swapFn();
                return;
            }
            const startH = modalContent.getBoundingClientRect().height;
            modalContent.classList.remove('is-morphing-height');
            modalContent.style.height = '';
            swapFn();
            const endH = modalContent.getBoundingClientRect().height;
            if (Math.abs(endH - startH) < 2) return;

            modalContent.style.height = `${startH}px`;
            void modalContent.offsetHeight;
            modalContent.classList.add('is-morphing-height');
            modalContent.style.height = `${endH}px`;

            let cleaned = false;
            const cleanup = () => {
                if (cleaned) return;
                cleaned = true;
                modalContent.classList.remove('is-morphing-height');
                modalContent.style.height = '';
            };
            modalContent.addEventListener('transitionend', (ev) => {
                if (ev.target === modalContent && ev.propertyName === 'height') cleanup();
            }, { once: true });
            setTimeout(cleanup, 360);
        };

        const revealSuccess = () => {
            morphHeight(() => {
                if (modalBody) {
                    modalBody.classList.remove('is-exiting', 'is-entering');
                    modalBody.classList.add('is-hidden');
                }
                document.getElementById('header-save-draft-btn')?.classList.add('is-hidden');
                if (successScreen) {
                    successScreen.classList.remove('is-hidden', 'is-exiting', 'is-visible');
                    void successScreen.offsetWidth;
                    successScreen.classList.add('is-visible');
                    if (modalContent) modalContent.scrollTop = 0;
                    successScreen.scrollTop = 0;
                }
            });
            successScreen?.querySelector('#success-download-btn')?.focus({ preventScroll: true });
        };

        if (modalBody && !modalBody.classList.contains('is-hidden') && !prefersReduced) {
            modalBody.classList.remove('is-entering');
            modalBody.classList.add('is-exiting');
            setTimeout(revealSuccess, 165);
        } else {
            revealSuccess();
        }
    }

    function hideSuccessScreen({ instant = true, onSwap = null } = {}) {
        const prefersReduced = typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const modalContent = modal.el?.querySelector('.modal-content');

        const doReset = () => {
            successScreen?.classList.add('is-hidden');
            successScreen?.classList.remove('is-visible', 'is-exiting');
            if (modalBody) {
                modalBody.classList.remove('is-hidden', 'is-exiting');
                if (!instant && !prefersReduced) {
                    modalBody.classList.remove('is-entering');
                    void modalBody.offsetWidth;
                    modalBody.classList.add('is-entering');
                    setTimeout(() => modalBody.classList.remove('is-entering'), 320);
                }
            }
            document.getElementById('header-save-draft-btn')?.classList.remove('is-hidden');
            expandClientSection();

            const qrImg = document.getElementById('receipt-success-qr-img');
            if (qrImg) qrImg.removeAttribute('src');

            const copyBtn = document.getElementById('success-copy-url-btn');
            if (copyBtn) {
                delete copyBtn.dataset.url;
                copyBtn.classList.remove('copied');
                const labelEl = document.getElementById('success-copy-url-label');
                const iconEl = copyBtn.querySelector('i');
                const t = bizT();
                if (labelEl) labelEl.textContent = t.success_copy_link || (bizLang() === 'en' ? 'Copy' : 'Копировать');
                if (iconEl) iconEl.className = 'fa-solid fa-copy';
            }

            const openBtn = document.getElementById('success-open-url-btn');
            if (openBtn) openBtn.href = '#';
            const waBtn = document.getElementById('success-wa-btn');
            if (waBtn) { waBtn.href = '#'; waBtn.classList.add('is-hidden'); }
            const tgBtn = document.getElementById('success-tg-btn');
            if (tgBtn) { tgBtn.href = '#'; tgBtn.classList.add('is-hidden'); }
            document.getElementById('success-share-btn')?.classList.add('is-hidden');

            if (typeof onSwap === 'function') onSwap();
        };

        if (instant || prefersReduced || !successScreen || successScreen.classList.contains('is-hidden')) {
            doReset();
            return;
        }

        successScreen.classList.add('is-exiting');
        setTimeout(() => {
            if (!modalContent) {
                doReset();
                return;
            }
            const startH = modalContent.getBoundingClientRect().height;
            modalContent.classList.remove('is-morphing-height');
            modalContent.style.height = '';
            doReset();
            const endH = modalContent.getBoundingClientRect().height;
            if (Math.abs(endH - startH) < 2) return;

            modalContent.style.height = `${startH}px`;
            void modalContent.offsetHeight;
            modalContent.classList.add('is-morphing-height');
            modalContent.style.height = `${endH}px`;

            let cleaned = false;
            const cleanup = () => {
                if (cleaned) return;
                cleaned = true;
                modalContent.classList.remove('is-morphing-height');
                modalContent.style.height = '';
            };
            modalContent.addEventListener('transitionend', (ev) => {
                if (ev.target === modalContent && ev.propertyName === 'height') cleanup();
            }, { once: true });
            setTimeout(cleanup, 360);
        }, 165);
    }

    document.getElementById('success-share-btn')?.addEventListener('click', () => {
        if (lastIssuedReceipt) shareReceiptViaSystemOrCopy(lastIssuedReceipt);
    });

    document.getElementById('success-copy-url-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const url = btn.dataset.url;
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            morphCopyButton(btn, 1800);
            const labelEl = document.getElementById('success-copy-url-label');
            const originalText = labelEl ? labelEl.textContent : '';
            const t = bizT();
            const copiedText = t.success_link_copied || (bizLang() === 'en' ? 'Copied!' : 'Скопировано!');
            if (labelEl) labelEl.textContent = copiedText;
            btn.classList.add('copied');

            if (typeof window.showToast === 'function') {
                window.showToast(bizLang() === 'en' ? 'Receipt link copied!' : 'Ссылка на чек скопирована!', 'success');
            }

            setTimeout(() => {
                if (labelEl) labelEl.textContent = originalText;
                if (iconEl) iconEl.className = 'fa-solid fa-copy';
                btn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            logError('biz:copyVerifyUrl', err);
        }
    });

    document.getElementById('receipt-success-qr-box')?.addEventListener('click', () => {
        const openBtn = document.getElementById('success-open-url-btn');
        if (openBtn && openBtn.href && openBtn.href !== '#' && !openBtn.classList.contains('is-hidden')) {
            window.open(openBtn.href, '_blank', 'noopener,noreferrer');
        }
    });

    async function handleDownloadBizPdf(btn, receipt, shop) {
        if (!receipt || !shop) return;
        if (btn?.disabled) return;
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }
        try {
            await downloadReceiptPDF(receipt, shop);
        } catch (err) {
            logError('biz:downloadPdf', err);
            const errLang = (window.getValuonLang ? window.getValuonLang() : 'en');
            window.showToast(
                errLang === 'en' ? 'Failed to generate receipt PDF' : 'Не удалось сформировать PDF чека',
                'error'
            );
        } finally {
            if (btn) {
                btn.innerHTML = origHtml;
                btn.disabled = false;
            }
        }
    }

    document.getElementById('success-download-btn')?.addEventListener('click', async (e) => {
        await handleDownloadBizPdf(e.currentTarget, lastIssuedReceipt, currentShop);
    });
    document.getElementById('success-new-btn')?.addEventListener('click', () => {
        // Сбрасываем подпись кнопки самым первым действием — до того, как
        // что-либо ниже потенциально может выбросить исключение и оборвать
        // остальной сброс формы, оставив старую сумму на экране.
        const resetSubmitLabel = () => {
            if (!submitLabelEl) return;
            const t = bizT();
            submitLabelEl.textContent = t.issue_receipt_submit || (bizLang() === 'en' ? 'Issue Receipt' : 'Выписать чек');
        };
        resetSubmitLabel();

        hideSuccessScreen({
            instant: false,
            onSwap: () => {
                try {
                    clearDraft();
                    clearAllValidationState();
                    forms.receipt?.reset();
                    renderPosSelect();
                    resetItemRows();
                    if (phoneInput) phoneInput.value = '';
                    ensureBizPhoneSelect(getDefaultBizCountry());
                    setContactMode(getSavedShopContactMode(), { instant: true });
                    const dateInput = forms.receipt?.querySelector('[name="purchase_date"]');
                    if (dateInput) {
                        dateInput.value = defaultDateString();
                        if (dateInput._cdp) dateInput._cdp.syncDisplay();
                        baselineDate = dateInput.value;
                    }
                    updateTotalPreview();
                } catch (err) {
                    console.error('Не удалось полностью сбросить форму для нового чека:', err);
                }

                resetSubmitLabel();
                requestAnimationFrame(resetSubmitLabel);
                if (window.innerWidth > 768) {
                    if (contactMode === 'phone') {
                        phoneInput?.focus();
                    } else {
                        emailInput?.focus();
                    }
                }
            },
        });
    });
    document.getElementById('success-done-btn')?.addEventListener('click', () => {
        // Раньше здесь сразу вызывался hideSuccessScreen() — экран успеха
        // мгновенно (без анимации) сменялся пустой формой чека, и уже ПОСЛЕ
        // этого стартовала анимация закрытия самой модалки — визуально
        // получалось, будто закрывается что-то одно, а потом ещё и вся
        // модалка поверх. forceClose() сам скрывает экран успеха внутри
        // своего таймаута — уже ПОСЛЕ того, как модалка спрячется — так что
        // пользователь видит один плавный уход модалки с текстом
        // "Чек выписан!", а не подмену контента перед закрытием.
        forceClose();
    });

    document.addEventListener('valuon:lang-applied', () => {
        updateSubmitLabel();
        renderTerminalsWidget();
        renderPosSelect();
        ensureBizPhoneSelect(phoneCountrySelect?.value || getDefaultBizCountry());
        setContactMode(contactMode, { instant: true });
    });

    const stats = {
        total: document.getElementById('total-receipts'),
        pending: document.getElementById('pending-receipts'),
        revenue: document.getElementById('total-revenue'),
        avgReceipt: document.getElementById('avg-receipt')
    };
    const list = {
        grid: document.getElementById('business-receipts-grid'),
        empty: document.getElementById('no-receipts-msg')
    };

    function updateShopInfo(shop) {
        const nameEl = document.getElementById('display-shop-name');
        const vatEl = document.getElementById('display-tax-id');
        const addrEl = document.getElementById('display-address');
        const countryEl = document.getElementById('display-country');
        const uiLang = (window.getValuonLang ? window.getValuonLang() : 'en');

        if (nameEl) nameEl.textContent = shop.shop_name || 'Без названия';
        if (vatEl) vatEl.textContent = shop.tax_id || '—';
        if (addrEl) addrEl.textContent = shop.address || '—';
        if (countryEl) {
            const flag = typeof window.countryFlag === 'function' ? window.countryFlag(shop.country) : '';
            const cName = typeof window.countryName === 'function' ? window.countryName(shop.country, uiLang) : (shop.country || '—');
            countryEl.textContent = shop.country
                ? (flag ? flag + ' ' + cName : cName)
                : '—';
        }
        const currencyEl = document.getElementById('display-currency');
        if (currencyEl) {
            currencyEl.textContent = shop.currency
                ? `${window.currencySymbol(shop.currency)} ${shop.currency}`
                : '—';
        }
        const phoneWrap = document.getElementById('display-contact-phone-wrap');
        const phoneEl = document.getElementById('display-contact-phone');
        if (phoneWrap && phoneEl) {
            const rawPhone = String(shop.contact_phone || '').trim();
            if (rawPhone) {
                phoneEl.textContent = formatPhoneDisplay(rawPhone) || rawPhone;
                phoneWrap.classList.remove('is-hidden');
            } else {
                phoneEl.textContent = '';
                phoneWrap.classList.add('is-hidden');
            }
        }
        const emailWrap = document.getElementById('display-contact-email-wrap');
        const emailEl = document.getElementById('display-contact-email');
        if (emailWrap && emailEl) {
            const rawEmail = String(shop.contact_email || '').trim();
            if (rawEmail) {
                emailEl.textContent = rawEmail;
                emailWrap.classList.remove('is-hidden');
            } else {
                emailEl.textContent = '';
                emailWrap.classList.add('is-hidden');
            }
        }

        updateShopLogo(shop.logo_path);
    }

    function updateShopLogo(path) {
        const img = document.getElementById('shop-logo');
        const placeholder = document.getElementById('shop-logo-placeholder');
        if (!img || !placeholder) return;
        if (path) {
            const { data: { publicUrl } } = client.storage.from('shop-logos').getPublicUrl(path);
            img.onerror = () => {
                console.warn('[logo] failed to load:', publicUrl);
                img.style.display = 'none';
                placeholder.style.display = 'flex';
            };
            img.src = publicUrl;
            img.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            img.style.display = 'none';
            placeholder.style.display = 'flex';
        }
    }

    // --- Кассовые аппараты (POS-терминалы) -------------------------

    const terminalsModal = document.getElementById('terminals-modal');
    const terminalsListEl = document.getElementById('terminals-list');
    const noTerminalsMsg = document.getElementById('no-terminals-msg');
    const terminalsCountLabel = document.getElementById('terminals-count-label');
    const terminalFormModal = document.getElementById('terminal-form-modal');
    const terminalForm = document.getElementById('terminal-form');
    const posSelect = document.getElementById('receipt-pos-select');
    const posSelectHint = document.getElementById('pos-select-hint');
    const deleteTerminalModal = document.getElementById('delete-terminal-modal');
    let terminalsDeleteCleanup = null;

    function terminalCountText(n) {
        const t = bizT();
        const isEn = bizLang() === 'en';
        if (n === 0) return t.terminals_count_zero || (isEn ? 'No cash registers added' : 'Кассовые аппараты не добавлены');
        if (isEn) {
            const tpl = n === 1
                ? (t.terminals_count_one || '{n} cash register')
                : (t.terminals_count_many || '{n} cash registers');
            return tpl.replace('{n}', String(n));
        }
        const form = pluralRu(n, 'one', 'few', 'many');
        return (t['terminals_count_' + form] || '{n} кассовых аппаратов').replace('{n}', String(n));
    }

    async function loadTerminals(shopId) {
        if (!shopId) return;
        try {
            const { data, error } = await client
                .from('pos_terminals')
                .select('id, name, serial_number, model, location, is_active, created_at')
                .eq('shop_id', shopId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            currentTerminals = data || [];
        } catch (e) {
            logError('biz:loadTerminals', e);
            currentTerminals = [];
        }
        renderTerminalsWidget();
        renderPosSelect();
    }

    function renderTerminalsWidget() {
        if (!terminalsCountLabel) return;
        const activeCount = currentTerminals.filter((t) => t.is_active !== false).length;
        terminalsCountLabel.textContent = terminalCountText(activeCount);
    }

    function renderTerminalsList() {
        if (!terminalsListEl) return;
        const t = bizT();
        if (currentTerminals.length === 0) {
            terminalsListEl.innerHTML = '';
            if (noTerminalsMsg) noTerminalsMsg.style.display = 'block';
            return;
        }
        if (noTerminalsMsg) noTerminalsMsg.style.display = 'none';

        terminalsListEl.innerHTML = currentTerminals.map((term) => {
            const metaParts = [];
            if (term.model) metaParts.push(term.model);
            if (term.location) metaParts.push(term.location);
            const statusText = term.is_active
                ? (t.terminal_active || 'Активна')
                : (t.terminal_inactive || 'Деактивирована');
            return `
                <div class="terminal-card${term.is_active ? '' : ' is-inactive'}">
                    <div class="terminal-card-icon"><i class="fa-solid fa-cash-register"></i></div>
                    <div class="terminal-card-info">
                        <div class="terminal-card-top">
                            <strong class="terminal-card-name">${escapeHtml(term.name)}</strong>
                            <span class="terminal-badge ${term.is_active ? 'is-active' : 'is-inactive'}">${escapeHtml(statusText)}</span>
                        </div>
                        <span class="terminal-card-serial">S/N: ${escapeHtml(term.serial_number)}</span>
                        ${metaParts.length ? `<span class="terminal-card-meta">${escapeHtml(metaParts.join(' · '))}</span>` : ''}
                    </div>
                    ${term.is_active !== false ? `<button type="button" class="btn-action delete btn-delete-terminal" data-id="${escapeHtml(term.id)}"
                        data-i18n-title="delete_terminal_title" title="${escapeHtml(t.delete_terminal_title || 'Удалить аппарат')}">
                        <i class="fa-solid fa-trash"></i>
                    </button>` : ''}
                </div>`;
        }).join('');

        terminalsListEl.querySelectorAll('.btn-delete-terminal').forEach((btn) => {
            btn.addEventListener('click', () => openDeleteTerminalModal(btn.dataset.id));
        });
    }

    const POS_STORAGE_PREFIX = 'valuon-biz-pos:';

    function getSavedPosTerminalId() {
        if (!currentShop?.id) return '';
        try {
            return localStorage.getItem(`${POS_STORAGE_PREFIX}${currentShop.id}`) || '';
        } catch (_) {
            return '';
        }
    }

    function savePosTerminalId(id) {
        if (!currentShop?.id) return;
        try {
            if (id) localStorage.setItem(`${POS_STORAGE_PREFIX}${currentShop.id}`, String(id));
            else localStorage.removeItem(`${POS_STORAGE_PREFIX}${currentShop.id}`);
        } catch (_) { /* ignore storage restrictions */ }
    }

    if (posSelect) {
        posSelect.addEventListener('change', () => {
            savePosTerminalId(posSelect.value);
        });
    }

    function renderPosSelect(preferredId) {
        if (!posSelect) return;
        const t = bizT();
        const active = currentTerminals.filter((term) => term.is_active);
        const savedId = getSavedPosTerminalId();
        let targetValue;
        if (preferredId !== undefined) {
            targetValue = String(preferredId || '');
        } else {
            const currentVal = posSelect.value;
            targetValue = (currentVal && active.some((term) => String(term.id) === currentVal))
                ? currentVal
                : savedId;
        }
        posSelect.innerHTML = '';

        if (active.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = t.pos_no_terminal || 'Без кассы';
            posSelect.appendChild(opt);
            posSelect.value = '';
            if (posSelectHint) posSelectHint.style.display = 'block';
        } else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = t.pos_no_terminal || 'Без кассы';
            posSelect.appendChild(opt);
            active.forEach((term) => {
                const o = document.createElement('option');
                o.value = term.id;
                o.textContent = term.name + (term.serial_number ? ` (${term.serial_number})` : '');
                posSelect.appendChild(o);
            });
            if (posSelectHint) posSelectHint.style.display = 'none';
            posSelect.value = active.some((term) => String(term.id) === targetValue) ? targetValue : '';
        }

        if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
    }

    function openTerminalsModal() {
        if (!terminalsModal || !currentShop) return;
        renderTerminalsList();
        terminalsModal.classList.remove('is-hidden');
        terminalsModal.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('modal-open');
    }

    function closeTerminalsModal() {
        if (!terminalsModal || terminalsModal.classList.contains('closing')) return;
        terminalsModal?.querySelector('.modal-content')?.classList.remove('is-stacked-behind');
        terminalsModal.classList.add('closing');
        setTimeout(() => {
            terminalsModal.classList.remove('closing');
            terminalsModal.classList.add('is-hidden');
            terminalsModal.setAttribute('aria-hidden', 'true');
            if (document.querySelectorAll('.modal-overlay:not(.is-hidden)').length === 0) {
                document.documentElement.classList.remove('modal-open');
            }
        }, 250);
    }

    function openTerminalForm() {
        if (!terminalFormModal) return;
        terminalForm?.reset();
        terminalFormModal.querySelectorAll('.input-group').forEach((grp) => grp.classList.remove('is-invalid'));
        terminalFormModal.querySelectorAll('[data-terminal-error]').forEach((el) => { el.textContent = ''; });
        terminalsModal?.querySelector('.modal-content')?.classList.add('is-stacked-behind');
        terminalFormModal.classList.remove('is-hidden');
        terminalFormModal.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('modal-open');
        const nameField = terminalForm?.querySelector('#terminal-name');
        if (window.innerWidth > 768) {
            requestAnimationFrame(() => requestAnimationFrame(() => nameField?.focus()));
        }
    }

    function closeTerminalForm() {
        if (!terminalFormModal || terminalFormModal.classList.contains('closing')) return;
        terminalsModal?.querySelector('.modal-content')?.classList.remove('is-stacked-behind');
        terminalFormModal.classList.add('closing');
        setTimeout(() => {
            terminalFormModal.classList.remove('closing');
            terminalFormModal.classList.add('is-hidden');
            terminalFormModal.setAttribute('aria-hidden', 'true');
            if (document.querySelectorAll('.modal-overlay:not(.is-hidden)').length === 0) {
                document.documentElement.classList.remove('modal-open');
            }
        }, 180);
    }

    function closeDeleteTerminalModal() {
        terminalsModal?.querySelector('.modal-content')?.classList.remove('is-stacked-behind');
        if (deleteTerminalModal?.classList.contains('is-hidden')) return;
        document.getElementById('cancel-delete-terminal-btn')?.click();
    }

    function validateTerminalForm() {
        const t = bizT();
        const nameEl = terminalForm?.querySelector('[name="name"]');
        const serialEl = terminalForm?.querySelector('[name="serial_number"]');
        const errName = terminalForm?.querySelector('[data-terminal-error="name"]');
        const errSerial = terminalForm?.querySelector('[data-terminal-error="serial"]');
        let ok = true;

        if (!nameEl?.value.trim()) {
            setFieldError(nameEl?.closest('.input-group'), errName,
                t.terminal_required_name || (bizLang() === 'en' ? 'Enter a register name' : 'Укажите название аппарата'));
            ok = false;
        } else {
            setFieldError(nameEl?.closest('.input-group'), errName, '');
        }

        if (!serialEl?.value.trim()) {
            setFieldError(serialEl?.closest('.input-group'), errSerial,
                t.terminal_required_serial || (bizLang() === 'en' ? 'Enter a serial number' : 'Укажите серийный номер'));
            ok = false;
        } else {
            setFieldError(serialEl?.closest('.input-group'), errSerial, '');
        }

        return ok;
    }

    terminalForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentShop) return;
        if (!validateTerminalForm()) return;
        const btn = terminalForm.querySelector('button[type="submit"]');
        if (btn.disabled) return;
        const t = bizT();
        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ' + (t.terminal_saving || (bizLang() === 'en' ? 'Saving...' : 'Сохранение...'));

        try {
            const fd = new FormData(terminalForm);
            const { data, error } = await client
                .from('pos_terminals')
                .insert([{
                    shop_id: currentShop.id,
                    name: String(fd.get('name') || '').trim(),
                    serial_number: String(fd.get('serial_number') || '').trim(),
                    model: String(fd.get('model') || '').trim() || null,
                    location: String(fd.get('location') || '').trim() || null
                }])
                .select('id, name, serial_number, model, location, is_active, created_at')
                .single();

            if (error) {
                if (error.code === '23505') {
                    const serialEl = terminalForm.querySelector('[name="serial_number"]');
                    const grp = serialEl?.closest('.input-group');
                    const errEl = terminalForm.querySelector('[data-terminal-error="serial"]');
                    setFieldError(grp, errEl,
                        t.terminal_duplicate_serial || 'Аппарат с таким серийным номером уже существует');
                } else {
                    logError('biz:createTerminal', error);
                    window.showToast(
                        t.terminal_save_error || (bizLang() === 'en' ? 'Failed to add cash register' : 'Ошибка добавления кассового аппарата'),
                        'error'
                    );
                }
                return;
            }

            currentTerminals.push(data);
            renderTerminalsWidget();
            renderTerminalsList();
            renderPosSelect();
            closeTerminalForm();
            window.showToast(t.terminal_saved || 'Кассовый аппарат добавлен', 'success');
        } catch (err) {
            logError('biz:createTerminalCatch', err);
            window.showToast(
                t.terminal_save_error || (bizLang() === 'en' ? 'Failed to add cash register' : 'Ошибка добавления кассового аппарата'),
                'error'
            );
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    });

    function openDeleteTerminalModal(terminalId) {
        if (!deleteTerminalModal || !currentShop) return;
        if (terminalsDeleteCleanup) terminalsDeleteCleanup();
        const t = bizT();
        const confirmBtn = document.getElementById('confirm-delete-terminal-btn');
        const cancelBtn = document.getElementById('cancel-delete-terminal-btn');
        terminalsModal?.querySelector('.modal-content')?.classList.add('is-stacked-behind');
        deleteTerminalModal.classList.remove('is-hidden');
        document.documentElement.classList.add('modal-open');

        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<i class="fa-solid fa-trash"></i> ${t.delete_btn || 'Удалить'}`;

        const handleConfirm = async () => {
            if (confirmBtn.disabled) return;
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            try {
                const { error } = await client
                    .from('pos_terminals')
                    .delete()
                    .eq('id', terminalId)
                    .eq('shop_id', currentShop.id);

                if (error) {
                    if (error.code === '23503') {
                        const { error: deactErr } = await client
                            .from('pos_terminals')
                            .update({ is_active: false })
                            .eq('id', terminalId)
                            .eq('shop_id', currentShop.id);
                        if (deactErr) throw deactErr;
                        const term = currentTerminals.find((x) => x.id === terminalId);
                        if (term) term.is_active = false;
                        window.showToast(
                            t.terminal_in_use_deactivated || 'Касса используется в чеках — она деактивирована',
                            'warning'
                        );
                    } else {
                        throw error;
                    }
                } else {
                    currentTerminals = currentTerminals.filter((x) => x.id !== terminalId);
                    window.showToast(t.terminal_deleted || 'Кассовый аппарат удалён', 'success');
                }

                renderTerminalsWidget();
                renderTerminalsList();
                renderPosSelect();
                handleCancel();
            } catch (e) {
                logError('biz:deleteTerminal', e);
                window.showToast(
                    t.terminal_delete_error || (bizLang() === 'en' ? 'Error deleting register' : 'Ошибка при удалении аппарата'),
                    'error'
                );
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = `<i class="fa-solid fa-trash"></i> ${t.delete_btn || 'Удалить'}`;
            }
        };

        const handleCancel = () => {
            terminalsModal?.querySelector('.modal-content')?.classList.remove('is-stacked-behind');
            if (deleteTerminalModal.classList.contains('closing')) return;
            deleteTerminalModal.classList.add('closing');
            setTimeout(() => {
                deleteTerminalModal.classList.add('is-hidden');
                deleteTerminalModal.classList.remove('closing');
                if (document.querySelectorAll('.modal-overlay:not(.is-hidden)').length === 0) {
                    document.documentElement.classList.remove('modal-open');
                }
                cleanup();
            }, 200);
        };

        const handleOutside = (e) => {
            if (e.target === deleteTerminalModal || e.target.classList.contains('modal-backdrop')) handleCancel();
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            deleteTerminalModal.removeEventListener('click', handleOutside);
            terminalsDeleteCleanup = null;
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        deleteTerminalModal.addEventListener('click', handleOutside);
        terminalsDeleteCleanup = cleanup;
    }

    document.getElementById('open-terminals-btn')?.addEventListener('click', openTerminalsModal);
    document.getElementById('close-terminals-modal')?.addEventListener('click', closeTerminalsModal);
    document.getElementById('add-terminal-btn')?.addEventListener('click', openTerminalForm);
    document.getElementById('close-terminal-form')?.addEventListener('click', closeTerminalForm);
    document.getElementById('cancel-terminal-form')?.addEventListener('click', closeTerminalForm);
    terminalsModal?.addEventListener('click', (e) => {
        if (e.target === terminalsModal || e.target.classList.contains('modal-backdrop')) closeTerminalsModal();
    });
    terminalFormModal?.addEventListener('click', (e) => {
        if (e.target === terminalFormModal || e.target.classList.contains('modal-backdrop')) closeTerminalForm();
    });

    attachModalA11y(terminalsModal, {
        mode: 'hidden',
        onClose: () => {
            if (terminalFormModal?.classList.contains('is-hidden') && deleteTerminalModal?.classList.contains('is-hidden')) {
                closeTerminalsModal();
            }
        }
    });
    attachModalA11y(terminalFormModal, { mode: 'hidden', onClose: () => closeTerminalForm() });
    attachModalA11y(deleteTerminalModal, { mode: 'hidden', onClose: () => closeDeleteTerminalModal() });

    // === Product Catalog (Assortment) + Receipt Autocomplete + Multi-select Picker ===
    const catalogModal = document.getElementById('catalog-modal');
    const catalogListEl = document.getElementById('catalog-list');
    const catalogEmptyEl = document.getElementById('no-catalog-msg');
    const catalogSearchInput = document.getElementById('catalog-search-input');
    const catalogSearchClear = document.getElementById('catalog-search-clear');
    const catalogCategoryChipsEl = document.getElementById('catalog-category-chips');
    const importCatalogBtn = document.getElementById('import-catalog-from-receipts-btn');

    const productFormModal = document.getElementById('product-form-modal');
    const productForm = document.getElementById('product-form');
    const productFormTitle = document.getElementById('product-form-title');
    const productNameInput = document.getElementById('product-name-input');
    const productPriceInput = document.getElementById('product-price-input');
    const productPriceCurrency = document.getElementById('product-price-currency');
    const productVatInput = document.getElementById('product-vat-input');
    const productWarrantyInput = document.getElementById('product-warranty-input');
    const productWarrantyPresets = document.getElementById('product-warranty-presets');
    const productCategorySelect = document.getElementById('product-category-select');
    const productSkuInput = document.getElementById('product-sku-input');

    const catalogPickerModal = document.getElementById('catalog-picker-modal');
    const pickerListEl = document.getElementById('catalog-picker-list');
    const pickerEmptyEl = document.getElementById('picker-empty-msg');
    const pickerSearchInput = document.getElementById('picker-search-input');
    const pickerSearchClear = document.getElementById('picker-search-clear');
    const pickerCategoryChipsEl = document.getElementById('picker-category-chips');
    const pickerApplyBtn = document.getElementById('apply-catalog-picker');
    const pickerApplyLabel = document.getElementById('apply-catalog-picker-label');

    let currentShopProducts = [];
    let editingProductId = null;
    let catalogSearchQuery = '';
    let catalogCategoryFilter = 'all';
    let pickerSearchQuery = '';
    let pickerCategoryFilter = 'all';
    let pickerQuantities = new Map();
    let productSubmitting = false;

    function getCategoryLabel(code) {
        if (!code) return '';
        if (typeof window.getDeviceTypeLabel === 'function') {
            return window.getDeviceTypeLabel(code, bizLang()) || code;
        }
        return code;
    }

    function getCategoryIconClass(code) {
        if (code && window.DEVICE_ICONS && Object.prototype.hasOwnProperty.call(window.DEVICE_ICONS, code)) {
            return window.DEVICE_ICONS[code];
        }
        return 'fa-box';
    }

    function refreshProductCategorySelect() {
        if (!productCategorySelect) return;
        renderItemCategoryOptions(productCategorySelect);
        if (productCategorySelect._cs) productCategorySelect._cs.refresh();
        else if (typeof CustomSelect !== 'undefined' && productFormModal) CustomSelect.init(productFormModal);
    }

    function formatCatalogCount(n) {
        const t = bizT();
        const lang = bizLang();
        if (n === 0) return t.catalog_count_zero || (lang === 'en' ? 'No products' : 'Нет товаров');
        if (lang === 'en') {
            return (n === 1 ? (t.catalog_count_one || '{n} product') : (t.catalog_count_many || '{n} products')).replace('{n}', String(n));
        }
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return (t.catalog_count_one || '{n} товар').replace('{n}', String(n));
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return (t.catalog_count_few || '{n} товара').replace('{n}', String(n));
        return (t.catalog_count_many || '{n} товаров').replace('{n}', String(n));
    }

    function renderCatalogWidget() {
        const label = document.getElementById('catalog-count-label');
        if (label) label.textContent = formatCatalogCount(currentShopProducts.length);
    }

    async function loadShopProducts(shopId) {
        if (!shopId || !currentClient) {
            currentShopProducts = [];
            renderCatalogWidget();
            return;
        }
        try {
            const { data, error } = await currentClient
                .from('shop_products')
                .select('id, shop_id, name, sku, price, vat_rate, warranty_months, category, is_active')
                .eq('shop_id', shopId)
                .eq('is_active', true)
                .order('name', { ascending: true })
                .limit(500);
            if (error) throw error;
            currentShopProducts = Array.isArray(data) ? data : [];
        } catch (err) {
            logError('biz:loadShopProducts', err);
            currentShopProducts = [];
        }
        renderCatalogWidget();
    }

    function getPastReceiptProducts() {
        const catalogNames = new Set(currentShopProducts.map(p => String(p.name || '').trim().toLowerCase()));
        const seen = new Map();
        for (const r of (currentReceiptsList || [])) {
            const items = Array.isArray(r.receipt_items) ? r.receipt_items : [];
            for (const it of items) {
                const name = String(it.item_name || '').trim();
                if (!name) continue;
                const key = name.toLowerCase();
                if (catalogNames.has(key) || seen.has(key)) continue;
                const qty = Math.max(1, parseInt(it.qty, 10) || 1);
                const price = it.unit_price != null && Number.isFinite(parseFloat(it.unit_price))
                    ? parseFloat(it.unit_price)
                    : Math.round(((parseFloat(it.gross_total) || 0) / qty) * 100) / 100;
                seen.set(key, {
                    id: `hist_${key}`,
                    name,
                    sku: '',
                    price: Math.max(0, Math.round(price * 100) / 100),
                    vat_rate: Number.isFinite(parseFloat(it.vat_rate)) ? parseFloat(it.vat_rate) : 0,
                    warranty_months: Math.max(0, parseInt(it.warranty_months, 10) || 0),
                    category: String(it.category || '').trim(),
                    _source: 'history',
                });
                if (seen.size >= 100) break;
            }
            if (seen.size >= 100) break;
        }
        return Array.from(seen.values());
    }

    function renderCategoryChips(containerEl, activeCat, onSelect) {
        if (!containerEl) return;
        const cats = [...new Set(currentShopProducts.map(p => (p.category || '').trim()).filter(Boolean))];
        if (cats.length < 2) {
            containerEl.classList.add('is-hidden');
            containerEl.innerHTML = '';
            return;
        }
        const t = bizT();
        const allLabel = t.catalog_filter_all || (bizLang() === 'en' ? 'All' : 'Все');
        containerEl.innerHTML = [
            `<button type="button" class="catalog-cat-chip${activeCat === 'all' ? ' active' : ''}" data-cat="all">${escapeHtml(allLabel)}</button>`,
            ...cats.map(cat => `<button type="button" class="catalog-cat-chip${activeCat === cat ? ' active' : ''}" data-cat="${escapeHtml(cat)}"><i class="fa-solid ${getCategoryIconClass(cat)}" aria-hidden="true"></i> ${escapeHtml(getCategoryLabel(cat))}</button>`)
        ].join('');
        containerEl.classList.remove('is-hidden');
        containerEl.onclick = (e) => {
            const btn = e.target.closest('.catalog-cat-chip');
            if (!btn) return;
            onSelect(btn.dataset.cat || 'all');
        };
    }

    function filterProducts(products, query, catFilter) {
        const q = String(query || '').trim().toLowerCase();
        return (products || []).filter(p => {
            if (catFilter !== 'all' && (p.category || '').trim() !== catFilter) return false;
            if (!q) return true;
            return String(p.name || '').toLowerCase().includes(q)
                || String(p.sku || '').toLowerCase().includes(q);
        });
    }

    function buildProductMetaText(p) {
        const t = bizT();
        const lang = bizLang();
        const parts = [];
        if (p.sku) parts.push(`SKU: ${p.sku}`);
        if (Number(p.vat_rate) > 0) parts.push(`${t.vat_word || (lang === 'en' ? 'VAT:' : 'НДС:')} ${p.vat_rate}%`);
        if (Number(p.warranty_months) > 0) parts.push(`${p.warranty_months} ${t.warranty_suffix || (lang === 'en' ? 'mo.' : 'мес.')}`);
        if (p.category) parts.push(getCategoryLabel(p.category));
        return parts.join(' · ');
    }

    function renderCatalogList({ animate = false } = {}) {
        if (!catalogListEl) return;
        renderCategoryChips(catalogCategoryChipsEl, catalogCategoryFilter, (nextCat) => {
            if (nextCat === catalogCategoryFilter) return;
            catalogCategoryFilter = nextCat;
            renderCatalogList({ animate: true });
        });

        const hasPastItems = getPastReceiptProducts().length > 0;
        if (importCatalogBtn) {
            importCatalogBtn.classList.toggle('is-hidden', currentShopProducts.length > 0 || !hasPastItems);
        }
        const openImportFooterBtn = document.getElementById('open-import-catalog-btn');
        if (openImportFooterBtn) {
            openImportFooterBtn.classList.toggle('is-hidden', currentShopProducts.length === 0 || !hasPastItems);
        }

        const filtered = filterProducts(currentShopProducts, catalogSearchQuery, catalogCategoryFilter);
        if (currentShopProducts.length === 0) {
            catalogListEl.innerHTML = '';
            catalogListEl.style.display = 'none';
            if (catalogEmptyEl) catalogEmptyEl.style.display = 'block';
            return;
        }

        if (catalogEmptyEl) catalogEmptyEl.style.display = 'none';
        catalogListEl.style.display = '';
        if (filtered.length === 0) {
            const lang = bizLang();
            catalogListEl.innerHTML = `<div class="empty-state" style="padding:1.5rem 0;"><p>${escapeHtml(lang === 'en' ? 'No matching products' : 'Товары не найдены')}</p></div>`;
            return;
        }

        const t = bizT();
        catalogListEl.innerHTML = filtered.map((p, idx) => {
            const meta = buildProductMetaText(p);
            const iconCls = getCategoryIconClass(p.category);
            const animAttr = animate ? ` style="animation-delay:${Math.min(idx, 10) * 24}ms"` : '';
            return `
                <div class="catalog-item-card${animate ? ' is-entering' : ''}"${animAttr} data-product-id="${escapeHtml(p.id)}">
                    <div class="catalog-item-left">
                        <span class="catalog-item-icon"><i class="fa-solid ${iconCls}" aria-hidden="true"></i></span>
                        <div class="catalog-item-info">
                            <span class="catalog-item-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
                            ${meta ? `<span class="catalog-item-meta">${escapeHtml(meta)}</span>` : ''}
                        </div>
                    </div>
                    <div class="catalog-item-right">
                        <span class="catalog-item-price">${escapeHtml(fmtMoney(p.price || 0))}</span>
                        <div class="catalog-item-actions">
                            <button type="button" class="catalog-icon-btn" data-catalog-edit="${escapeHtml(p.id)}" title="${escapeHtml(t.edit_btn || 'Edit')}"><i class="fa-solid fa-pen"></i></button>
                            <button type="button" class="catalog-icon-btn is-delete" data-catalog-delete="${escapeHtml(p.id)}" title="${escapeHtml(t.delete_btn || 'Delete')}"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
        }).join('');
        if (animate) {
            setTimeout(() => {
                catalogListEl.querySelectorAll('.catalog-item-card.is-entering').forEach(el => {
                    el.classList.remove('is-entering');
                    el.style.animationDelay = '';
                });
            }, 420);
        }
    }

    function openCatalogModal() {
        if (!catalogModal || !currentShop) return;
        catalogSearchQuery = '';
        catalogCategoryFilter = 'all';
        if (catalogSearchInput) catalogSearchInput.value = '';
        if (catalogSearchClear) catalogSearchClear.style.display = 'none';
        renderCatalogList({ animate: true });
        catalogModal.classList.remove('is-hidden');
        catalogModal.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('modal-open');
    }

    function closeCatalogModal() {
        if (!catalogModal || catalogModal.classList.contains('is-hidden') || catalogModal.classList.contains('closing')) return;
        resetCatalogDeleteConfirm();
        catalogModal.classList.add('closing');
        setTimeout(() => {
            catalogModal.classList.add('is-hidden');
            catalogModal.classList.remove('closing');
            catalogModal.setAttribute('aria-hidden', 'true');
            if (document.querySelectorAll('.modal-overlay:not(.is-hidden)').length === 0) {
                document.documentElement.classList.remove('modal-open');
            }
        }, 220);
    }

    function setProductFormError(field, msg) {
        const el = productForm?.querySelector(`[data-product-error="${field}"]`);
        if (el) el.textContent = msg || '';
    }

    function syncProductWarrantyChips() {
        if (!productWarrantyPresets || !productWarrantyInput) return;
        const val = String(productWarrantyInput.value || '').trim();
        productWarrantyPresets.querySelectorAll('.warranty-chip').forEach(ch => {
            ch.classList.toggle('is-selected', val !== '' && ch.dataset.months === val);
        });
    }

    function openProductFormModal(product = null) {
        if (!productFormModal || !productForm) return;
        const t = bizT();
        const lang = bizLang();
        editingProductId = product ? product.id : null;
        if (productFormTitle) {
            productFormTitle.textContent = editingProductId
                ? (t.product_form_title_edit || (lang === 'en' ? 'Edit Product' : 'Редактировать товар'))
                : (t.product_form_title_new || (lang === 'en' ? 'New Product' : 'Новый товар'));
        }
        if (productPriceCurrency) {
            productPriceCurrency.textContent = window.currencySymbol(currentShop?.currency || 'EUR');
        }
        refreshProductCategorySelect();
        setProductFormError('name', '');
        setProductFormError('price', '');

        if (productNameInput) productNameInput.value = product?.name || '';
        if (productPriceInput) productPriceInput.value = product ? String(product.price ?? '') : '';
        if (productVatInput) productVatInput.value = product ? String(product.vat_rate ?? 0) : '';
        if (productWarrantyInput) productWarrantyInput.value = product ? String(product.warranty_months ?? 0) : '';
        if (productSkuInput) productSkuInput.value = product?.sku || '';
        if (productCategorySelect) {
            productCategorySelect.value = product?.category || '';
            if (productCategorySelect._cs) productCategorySelect._cs.refresh();
        }
        syncProductWarrantyChips();

        catalogModal?.querySelector('.modal-content')?.classList.add('is-stacked-behind');
        productFormModal.classList.remove('is-hidden');
        productFormModal.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('modal-open');
        if (window.innerWidth > 768) {
            setTimeout(() => productNameInput?.focus(), 60);
        }
    }

    function closeProductFormModal() {
        if (!productFormModal || productFormModal.classList.contains('is-hidden') || productFormModal.classList.contains('closing')) return;
        catalogModal?.querySelector('.modal-content')?.classList.remove('is-stacked-behind');
        productFormModal.classList.add('closing');
        setTimeout(() => {
            productFormModal.classList.add('is-hidden');
            productFormModal.classList.remove('closing');
            productFormModal.setAttribute('aria-hidden', 'true');
            editingProductId = null;
            if (document.querySelectorAll('.modal-overlay:not(.is-hidden)').length === 0) {
                document.documentElement.classList.remove('modal-open');
            }
        }, 200);
    }

    productWarrantyPresets?.addEventListener('click', (e) => {
        const chip = e.target.closest('.warranty-chip');
        if (!chip || !productWarrantyInput) return;
        productWarrantyInput.value = chip.dataset.months || '0';
        syncProductWarrantyChips();
    });
    productWarrantyInput?.addEventListener('input', syncProductWarrantyChips);

    productForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (productSubmitting || !currentShop || !currentClient) return;
        const t = bizT();
        const lang = bizLang();
        const name = String(productNameInput?.value || '').trim();
        const rawPrice = parseFloat(productPriceInput?.value);
        let vatRate = parseFloat(productVatInput?.value);
        if (isNaN(vatRate) || vatRate < 0) vatRate = 0;
        if (vatRate > 100) vatRate = 100;
        let warrantyMonths = parseInt(productWarrantyInput?.value, 10);
        if (isNaN(warrantyMonths) || warrantyMonths < 0) warrantyMonths = 0;
        if (warrantyMonths > 600) warrantyMonths = 600;
        const category = String(productCategorySelect?.value || '').trim();
        const sku = String(productSkuInput?.value || '').trim();

        let valid = true;
        if (!name) {
            setProductFormError('name', t.product_err_name || (lang === 'en' ? 'Enter product name' : 'Укажите название товара'));
            valid = false;
        } else {
            setProductFormError('name', '');
        }
        if (!Number.isFinite(rawPrice) || rawPrice < 0) {
            setProductFormError('price', t.product_err_price || (lang === 'en' ? 'Enter a valid price' : 'Укажите корректную цену'));
            valid = false;
        } else {
            setProductFormError('price', '');
        }
        if (!valid) return;

        const saveBtn = document.getElementById('save-product-btn');
        productSubmitting = true;
        if (saveBtn) saveBtn.disabled = true;

        try {
            const payload = {
                shop_id: currentShop.id,
                name,
                sku,
                price: Math.round(rawPrice * 100) / 100,
                vat_rate: Math.round(vatRate * 100) / 100,
                warranty_months: warrantyMonths,
                category,
                updated_at: new Date().toISOString(),
            };

            if (editingProductId) {
                const { data, error } = await currentClient
                    .from('shop_products')
                    .update(payload)
                    .eq('id', editingProductId)
                    .eq('shop_id', currentShop.id)
                    .select()
                    .single();
                if (error) throw error;
                currentShopProducts = currentShopProducts
                    .map(p => (p.id === editingProductId ? data : p))
                    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
                window.showToast(t.product_updated_toast || (lang === 'en' ? 'Product updated' : 'Товар обновлён'), 'success');
            } else {
                const { data, error } = await currentClient
                    .from('shop_products')
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                currentShopProducts = [...currentShopProducts, data]
                    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
                window.showToast(t.product_saved_toast || (lang === 'en' ? 'Product added to catalog' : 'Товар сохранён в ассортимент'), 'success');
            }
            renderCatalogWidget();
            renderCatalogList();
            closeProductFormModal();
        } catch (err) {
            logError('biz:saveProduct', err);
            window.showToast(lang === 'en' ? 'Failed to save product' : 'Не удалось сохранить товар', 'error');
        } finally {
            productSubmitting = false;
            if (saveBtn) saveBtn.disabled = false;
        }
    });

    let catalogDeleteConfirmId = null;
    let catalogDeleteConfirmTimer = null;

    function resetCatalogDeleteConfirm() {
        if (catalogDeleteConfirmTimer) {
            clearTimeout(catalogDeleteConfirmTimer);
            catalogDeleteConfirmTimer = null;
        }
        if (!catalogDeleteConfirmId) return;
        const prevBtn = catalogListEl?.querySelector(`[data-catalog-delete="${CSS.escape(catalogDeleteConfirmId)}"]`);
        if (prevBtn) {
            prevBtn.classList.remove('is-confirming');
            prevBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        }
        catalogDeleteConfirmId = null;
    }

    catalogListEl?.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('[data-catalog-edit]');
        if (editBtn) {
            resetCatalogDeleteConfirm();
            const prod = currentShopProducts.find(p => p.id === editBtn.dataset.catalogEdit);
            if (prod) openProductFormModal(prod);
            return;
        }
        const delBtn = e.target.closest('[data-catalog-delete]');
        if (delBtn && currentShop && currentClient) {
            const id = delBtn.dataset.catalogDelete;
            const prod = currentShopProducts.find(p => p.id === id);
            if (!prod) return;
            const t = bizT();
            const lang = bizLang();

            if (catalogDeleteConfirmId !== id) {
                resetCatalogDeleteConfirm();
                catalogDeleteConfirmId = id;
                delBtn.classList.add('is-confirming');
                delBtn.innerHTML = `<i class="fa-solid fa-trash"></i><span>${escapeHtml(lang === 'en' ? 'Delete?' : 'Удалить?')}</span>`;
                catalogDeleteConfirmTimer = setTimeout(resetCatalogDeleteConfirm, 3000);
                return;
            }

            resetCatalogDeleteConfirm();
            delBtn.disabled = true;
            const cardEl = delBtn.closest('.catalog-item-card');
            try {
                const { error } = await currentClient
                    .from('shop_products')
                    .delete()
                    .eq('id', id)
                    .eq('shop_id', currentShop.id);
                if (error) throw error;
                currentShopProducts = currentShopProducts.filter(p => String(p.id) !== String(id));
                pickerQuantities.delete(String(id));
                renderCatalogWidget();
                if (catalogPickerModal && !catalogPickerModal.classList.contains('is-hidden')) {
                    renderCatalogPickerList({ animate: false });
                }
                if (cardEl) {
                    cardEl.classList.add('is-removing');
                    setTimeout(() => renderCatalogList({ animate: false }), 210);
                } else {
                    renderCatalogList({ animate: false });
                }
                window.showToast(t.product_deleted_toast || (lang === 'en' ? 'Product removed from catalog' : 'Товар удалён из каталога'), 'success');
            } catch (err) {
                logError('biz:deleteProduct', err);
                delBtn.disabled = false;
                window.showToast(lang === 'en' ? 'Failed to delete product' : 'Не удалось удалить товар', 'error');
            }
        }
    });

    // --- Selective Import from Past Receipts Modal ---
    const catalogImportModal = document.getElementById('catalog-import-modal');
    const catalogImportListEl = document.getElementById('catalog-import-list');
    const catalogImportCounterEl = document.getElementById('catalog-import-counter');
    const catalogImportToggleAllBtn = document.getElementById('catalog-import-toggle-all');
    const confirmCatalogImportBtn = document.getElementById('confirm-catalog-import');
    const confirmCatalogImportLabel = document.getElementById('confirm-catalog-import-label');
    let importCandidates = [];
    let importSelectedIds = new Set();

    function updateCatalogImportUI() {
        const t = bizT();
        const lang = bizLang();
        const total = importCandidates.length;
        const sel = importSelectedIds.size;
        if (catalogImportCounterEl) {
            const tpl = t.import_selected_meta || (lang === 'en' ? 'Selected {sel} of {total}' : 'Выбрано {sel} из {total}');
            catalogImportCounterEl.textContent = tpl.replace('{sel}', String(sel)).replace('{total}', String(total));
        }
        if (catalogImportToggleAllBtn) {
            const allSel = total > 0 && sel === total;
            catalogImportToggleAllBtn.textContent = allSel
                ? (t.lifecycle_deselect_all || (lang === 'en' ? 'Deselect all' : 'Снять выбор'))
                : (t.lifecycle_select_all || (lang === 'en' ? 'Select all' : 'Выбрать все'));
        }
        if (confirmCatalogImportBtn) {
            confirmCatalogImportBtn.disabled = sel === 0;
        }
        if (confirmCatalogImportLabel) {
            if (sel > 0) {
                const tpl = t.import_confirm_count || (lang === 'en' ? 'Import ({n})' : 'Импортировать ({n})');
                confirmCatalogImportLabel.textContent = tpl.replace('{n}', String(sel));
            } else {
                confirmCatalogImportLabel.textContent = t.import_confirm_btn || (lang === 'en' ? 'Import selected' : 'Импортировать');
            }
        }
    }

    function renderCatalogImportList({ animate = false } = {}) {
        if (!catalogImportListEl) return;
        catalogImportListEl.innerHTML = importCandidates.map((p, idx) => {
            const checked = importSelectedIds.has(p.id);
            const meta = buildProductMetaText(p);
            const iconCls = getCategoryIconClass(p.category);
            const animAttr = animate ? ` style="animation-delay:${Math.min(idx, 10) * 22}ms"` : '';
            return `
                <div class="catalog-item-card${checked ? ' is-picked' : ''}${animate ? ' is-entering' : ''}"${animAttr} data-import-id="${escapeHtml(p.id)}">
                    <div class="catalog-item-left">
                        <input type="checkbox" class="lifecycle-item-check" ${checked ? 'checked' : ''} aria-label="${escapeHtml(p.name)}">
                        <span class="catalog-item-icon"><i class="fa-solid ${iconCls}" aria-hidden="true"></i></span>
                        <div class="catalog-item-info">
                            <span class="catalog-item-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
                            ${meta ? `<span class="catalog-item-meta">${escapeHtml(meta)}</span>` : ''}
                        </div>
                    </div>
                    <div class="catalog-item-right">
                        <span class="catalog-item-price">${escapeHtml(fmtMoney(p.price || 0))}</span>
                    </div>
                </div>`;
        }).join('');
        updateCatalogImportUI();
    }

    function openCatalogImportModal() {
        const past = getPastReceiptProducts();
        const t = bizT();
        const lang = bizLang();
        if (past.length === 0) {
            window.showToast(t.import_catalog_empty || (lang === 'en' ? 'No new items found in past receipts' : 'Нет новых товаров в прошлых чеках'), 'info');
            return;
        }
        importCandidates = past.slice(0, 100);
        importSelectedIds = new Set();
        renderCatalogImportList({ animate: true });
        catalogModal?.querySelector('.modal-content')?.classList.add('is-stacked-behind');
        catalogImportModal?.classList.remove('is-hidden');
        catalogImportModal?.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('modal-open');
    }

    function closeCatalogImportModal() {
        if (!catalogImportModal || catalogImportModal.classList.contains('is-hidden') || catalogImportModal.classList.contains('closing')) return;
        catalogModal?.querySelector('.modal-content')?.classList.remove('is-stacked-behind');
        catalogImportModal.classList.add('closing');
        setTimeout(() => {
            catalogImportModal.classList.add('is-hidden');
            catalogImportModal.classList.remove('closing');
            catalogImportModal.setAttribute('aria-hidden', 'true');
            if (document.querySelectorAll('.modal-overlay:not(.is-hidden)').length === 0) {
                document.documentElement.classList.remove('modal-open');
            }
        }, 200);
    }

    catalogImportListEl?.addEventListener('click', (e) => {
        const row = e.target.closest('[data-import-id]');
        if (!row) return;
        const id = row.dataset.importId;
        const willSelect = !importSelectedIds.has(id);
        if (willSelect) importSelectedIds.add(id);
        else importSelectedIds.delete(id);
        row.classList.toggle('is-picked', willSelect);
        const cb = row.querySelector('.lifecycle-item-check');
        if (cb) cb.checked = willSelect;
        updateCatalogImportUI();
    });

    catalogImportToggleAllBtn?.addEventListener('click', () => {
        const selectAll = importSelectedIds.size !== importCandidates.length;
        if (selectAll) {
            importSelectedIds = new Set(importCandidates.map(p => p.id));
        } else {
            importSelectedIds.clear();
        }
        catalogImportListEl?.querySelectorAll('[data-import-id]').forEach(row => {
            row.classList.toggle('is-picked', selectAll);
            const cb = row.querySelector('.lifecycle-item-check');
            if (cb) cb.checked = selectAll;
        });
        updateCatalogImportUI();
    });

    confirmCatalogImportBtn?.addEventListener('click', async () => {
        if (!currentShop || !currentClient || importSelectedIds.size === 0) return;
        const t = bizT();
        const lang = bizLang();
        const chosen = importCandidates.filter(p => importSelectedIds.has(p.id));
        confirmCatalogImportBtn.disabled = true;
        try {
            const rows = chosen.map(p => ({
                shop_id: currentShop.id,
                name: p.name.slice(0, 160),
                sku: '',
                price: p.price,
                vat_rate: p.vat_rate,
                warranty_months: p.warranty_months,
                category: p.category.slice(0, 64),
            }));
            const { data, error } = await currentClient
                .from('shop_products')
                .insert(rows)
                .select();
            if (error) throw error;
            currentShopProducts = [...currentShopProducts, ...(data || [])]
                .sort((a, b) => String(a.name).localeCompare(String(b.name)));
            renderCatalogWidget();
            renderCatalogList({ animate: true });
            closeCatalogImportModal();
            const tpl = t.import_catalog_done || (lang === 'en' ? 'Imported {n} products' : 'Импортировано товаров: {n}');
            window.showToast(tpl.replace('{n}', String((data || []).length)), 'success');
        } catch (err) {
            logError('biz:importCatalog', err);
            window.showToast(lang === 'en' ? 'Import failed' : 'Ошибка импорта', 'error');
            updateCatalogImportUI();
        }
    });

    importCatalogBtn?.addEventListener('click', openCatalogImportModal);
    document.getElementById('open-import-catalog-btn')?.addEventListener('click', openCatalogImportModal);
    document.getElementById('open-file-import-catalog-btn')?.addEventListener('click', async () => {
        if (!currentShop || !currentClient) return;
        try {
            const { openCatalogFileImportModal } = await import('./catalog-import.js');
            openCatalogFileImportModal({
                getShop: () => currentShop,
                getClient: () => currentClient,
                getProducts: () => currentShopProducts,
                getLang: bizLang,
                getT: bizT,
                fmtMoney,
                onImported: ({ insertedRows = [], updatedMap = new Map() }) => {
                    const updated = currentShopProducts.map((p) => updatedMap.get(p.id) || p);
                    currentShopProducts = [...updated, ...insertedRows]
                        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
                    renderCatalogWidget();
                    renderCatalogList();
                },
            });
        } catch (err) {
            logError('biz:loadCatalogFileImport', err);
            window.showToast(bizLang() === 'en' ? 'Failed to open file importer' : 'Не удалось открыть импорт из файла', 'error');
        }
    });
    document.getElementById('close-catalog-import')?.addEventListener('click', closeCatalogImportModal);
    document.getElementById('cancel-catalog-import')?.addEventListener('click', closeCatalogImportModal);
    catalogImportModal?.addEventListener('click', (e) => {
        if (e.target === catalogImportModal || e.target.classList.contains('modal-backdrop')) closeCatalogImportModal();
    });
    attachModalA11y(catalogImportModal, { mode: 'hidden', onClose: () => closeCatalogImportModal() });

    catalogSearchInput?.addEventListener('input', () => {
        catalogSearchQuery = catalogSearchInput.value || '';
        if (catalogSearchClear) catalogSearchClear.style.display = catalogSearchQuery ? 'inline-flex' : 'none';
        renderCatalogList();
    });
    catalogSearchClear?.addEventListener('click', () => {
        if (catalogSearchInput) catalogSearchInput.value = '';
        catalogSearchQuery = '';
        catalogSearchClear.style.display = 'none';
        renderCatalogList();
        catalogSearchInput?.focus();
    });

    document.getElementById('open-catalog-btn')?.addEventListener('click', openCatalogModal);
    document.getElementById('close-catalog-modal')?.addEventListener('click', closeCatalogModal);
    document.getElementById('add-product-btn')?.addEventListener('click', () => openProductFormModal(null));
    document.getElementById('close-product-form')?.addEventListener('click', closeProductFormModal);
    document.getElementById('cancel-product-form')?.addEventListener('click', closeProductFormModal);
    catalogModal?.addEventListener('click', (e) => {
        if (e.target === catalogModal || e.target.classList.contains('modal-backdrop')) closeCatalogModal();
    });
    productFormModal?.addEventListener('click', (e) => {
        if (e.target === productFormModal || e.target.classList.contains('modal-backdrop')) closeProductFormModal();
    });
    attachModalA11y(catalogModal, {
        mode: 'hidden',
        onClose: () => {
            if (productFormModal?.classList.contains('is-hidden') && catalogImportModal?.classList.contains('is-hidden')) {
                closeCatalogModal();
            }
        }
    });
    attachModalA11y(productFormModal, { mode: 'hidden', onClose: () => closeProductFormModal() });

    // --- Helper: apply a catalog/history product to a receipt row ---
    function fillReceiptItemRow(row, prod, qty = null) {
        if (!row || !prod) return;
        const nameEl = row.querySelector('[data-field="item_name"]');
        const qtyEl = row.querySelector('[data-field="qty"]');
        const priceEl = row.querySelector('[data-field="price"]');
        const vatEl = row.querySelector('[data-field="vat_rate"]');
        const warEl = row.querySelector('[data-field="warranty_months"]');
        const catEl = row.querySelector('[data-field="category"]');

        if (nameEl) nameEl.value = prod.name || '';
        if (qty !== null && qtyEl) qtyEl.value = String(Math.max(1, qty));
        if (priceEl) priceEl.value = prod.price != null ? String(prod.price) : '';
        if (vatEl) vatEl.value = prod.vat_rate != null ? String(prod.vat_rate) : '';
        if (warEl) {
            warEl.value = prod.warranty_months != null ? String(prod.warranty_months) : '';
            row.querySelectorAll('.warranty-chip').forEach(ch => {
                ch.classList.toggle('is-selected', ch.dataset.months === String(prod.warranty_months ?? ''));
            });
        }
        if (catEl) {
            catEl.value = prod.category || '';
            if (catEl._cs) catEl._cs.refresh();
        }
        row.classList.remove('is-invalid');
        const errEl = row.querySelector('[data-item-error]');
        if (errEl) errEl.textContent = '';
        row.classList.remove('item-row-flash');
        void row.offsetWidth;
        row.classList.add('item-row-flash');
        setTimeout(() => row.classList.remove('item-row-flash'), 650);
        updateTotalPreview();
    }

    // --- Receipt Row Item-Name Autocomplete (Catalog + Past Receipts) ---
    function getItemAutocompleteCandidates(query) {
        const q = String(query || '').trim().toLowerCase();
        const catalogPool = currentShopProducts.map(p => ({ ...p, _source: 'catalog' }));
        const historyPool = getPastReceiptProducts();
        const combined = [...catalogPool, ...historyPool];
        if (!q) return combined.slice(0, 6);
        const starts = [];
        const contains = [];
        for (const p of combined) {
            const n = String(p.name || '').toLowerCase();
            const s = String(p.sku || '').toLowerCase();
            if (n.startsWith(q) || (s && s.startsWith(q))) starts.push(p);
            else if (n.includes(q) || (s && s.includes(q))) contains.push(p);
        }
        return [...starts, ...contains].slice(0, 6);
    }

    function closeAllItemAutocompletes() {
        itemsList?.querySelectorAll('[data-item-autocomplete]').forEach(el => {
            el.classList.add('is-hidden');
        });
    }

    function renderRowAutocomplete(row, query) {
        const listEl = row?.querySelector('[data-item-autocomplete]');
        if (!listEl) return;
        const candidates = getItemAutocompleteCandidates(query);
        if (candidates.length === 0) {
            listEl.classList.add('is-hidden');
            return;
        }
        const t = bizT();
        const lang = bizLang();
        listEl._candidates = candidates;
        listEl._activeIndex = -1;
        listEl.innerHTML = candidates.map((p, idx) => {
            const isHist = p._source === 'history';
            const badgeText = isHist
                ? (t.ac_source_history || (lang === 'en' ? 'Past receipts' : 'Из чеков'))
                : (t.ac_source_catalog || (lang === 'en' ? 'Catalog' : 'Каталог'));
            const meta = buildProductMetaText(p);
            return `
                <button type="button" class="item-ac-option" data-ac-idx="${idx}" role="option">
                    <span class="item-ac-main">
                        <span class="item-ac-name">${escapeHtml(p.name)}</span>
                        <span class="item-ac-meta">
                            <span class="item-ac-badge${isHist ? ' is-history' : ''}">${escapeHtml(badgeText)}</span>
                            ${meta ? `<span>${escapeHtml(meta)}</span>` : ''}
                        </span>
                    </span>
                    <span class="item-ac-price">${escapeHtml(fmtMoney(p.price || 0))}</span>
                </button>`;
        }).join('');
        listEl.classList.remove('is-hidden');
    }

    let isPointerInItemAc = false;

    itemsList?.addEventListener('pointerdown', (e) => {
        isPointerInItemAc = Boolean(e.target.closest('[data-item-autocomplete]'));
    });

    itemsList?.addEventListener('focusin', (e) => {
        const input = e.target.closest('[data-field="item_name"]');
        if (!input) return;
        const row = input.closest('[data-item-row]');
        closeAllItemAutocompletes();
        renderRowAutocomplete(row, input.value);
    });

    itemsList?.addEventListener('input', (e) => {
        const input = e.target.closest('[data-field="item_name"]');
        if (!input) return;
        const row = input.closest('[data-item-row]');
        renderRowAutocomplete(row, input.value);
    });

    itemsList?.addEventListener('keydown', (e) => {
        const input = e.target.closest('[data-field="item_name"]');
        if (!input) return;
        const row = input.closest('[data-item-row]');
        const listEl = row?.querySelector('[data-item-autocomplete]');
        if (!listEl || listEl.classList.contains('is-hidden')) return;
        const opts = [...listEl.querySelectorAll('.item-ac-option')];
        if (!opts.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            listEl._activeIndex = (listEl._activeIndex + 1) % opts.length;
            opts.forEach((o, i) => o.classList.toggle('is-active', i === listEl._activeIndex));
            opts[listEl._activeIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            listEl._activeIndex = (listEl._activeIndex - 1 + opts.length) % opts.length;
            opts.forEach((o, i) => o.classList.toggle('is-active', i === listEl._activeIndex));
            opts[listEl._activeIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && listEl._activeIndex >= 0) {
            e.preventDefault();
            const prod = listEl._candidates?.[listEl._activeIndex];
            if (prod) {
                fillReceiptItemRow(row, prod);
                closeAllItemAutocompletes();
            }
        } else if (e.key === 'Escape') {
            closeAllItemAutocompletes();
        }
    });

    itemsList?.addEventListener('click', (e) => {
        const opt = e.target.closest('.item-ac-option');
        if (!opt) return;
        e.preventDefault();
        const listEl = opt.closest('[data-item-autocomplete]');
        const row = opt.closest('[data-item-row]');
        const idx = parseInt(opt.dataset.acIdx, 10);
        const prod = listEl?._candidates?.[idx];
        if (prod && row) {
            fillReceiptItemRow(row, prod);
            closeAllItemAutocompletes();
        }
    });

    itemsList?.addEventListener('focusout', (e) => {
        const input = e.target.closest('[data-field="item_name"]');
        if (!input) return;
        setTimeout(() => {
            if (isPointerInItemAc) {
                isPointerInItemAc = false;
                return;
            }
            if (!document.activeElement?.closest('[data-item-autocomplete]')) {
                closeAllItemAutocompletes();
            }
        }, 160);
    });

    document.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('.item-name-autocomplete-wrap')) {
            closeAllItemAutocompletes();
        }
    });

    // --- Multi-Select Catalog Picker Modal inside Create Receipt ---
    function updatePickerApplyButton() {
        if (!pickerApplyBtn || !pickerApplyLabel) return;
        let totalQty = 0;
        pickerQuantities.forEach(q => { totalQty += q; });
        pickerApplyBtn.disabled = totalQty === 0;
        const t = bizT();
        const lang = bizLang();
        if (totalQty > 0) {
            const tpl = t.catalog_picker_apply_count || (lang === 'en' ? 'Add to receipt ({n})' : 'Добавить в чек ({n})');
            pickerApplyLabel.textContent = tpl.replace('{n}', String(totalQty));
        } else {
            pickerApplyLabel.textContent = t.catalog_picker_apply || (lang === 'en' ? 'Add to receipt' : 'Добавить в чек');
        }
    }

    function renderCatalogPickerList({ animate = false } = {}) {
        if (!pickerListEl) return;
        renderCategoryChips(pickerCategoryChipsEl, pickerCategoryFilter, (nextCat) => {
            if (nextCat === pickerCategoryFilter) return;
            pickerCategoryFilter = nextCat;
            renderCatalogPickerList({ animate: true });
        });

        const pool = currentShopProducts;
        if (pool.length === 0) {
            pickerListEl.innerHTML = '';
            pickerListEl.style.display = 'none';
            if (pickerEmptyEl) pickerEmptyEl.style.display = 'block';
            updatePickerApplyButton();
            return;
        }
        if (pickerEmptyEl) pickerEmptyEl.style.display = 'none';
        pickerListEl.style.display = '';

        const filtered = filterProducts(pool, pickerSearchQuery, pickerCategoryFilter);
        if (filtered.length === 0) {
            const lang = bizLang();
            pickerListEl.innerHTML = `<div class="empty-state" style="padding:1.5rem 0;"><p>${escapeHtml(lang === 'en' ? 'No matching products' : 'Товары не найдены')}</p></div>`;
            updatePickerApplyButton();
            return;
        }

        pickerListEl.innerHTML = filtered.map((p, idx) => {
            const qty = pickerQuantities.get(p.id) || 0;
            const meta = buildProductMetaText(p);
            const iconCls = getCategoryIconClass(p.category);
            const animAttr = animate ? ` style="animation-delay:${Math.min(idx, 8) * 20}ms"` : '';
            const controlsHtml = buildPickerControlsHtml(p.id, qty);
            return `
                <div class="catalog-item-card${qty > 0 ? ' is-picked' : ''}${animate ? ' is-entering' : ''}"${animAttr} data-picker-row="${escapeHtml(p.id)}">
                    <div class="catalog-item-left">
                        <span class="catalog-item-icon"><i class="fa-solid ${iconCls}" aria-hidden="true"></i></span>
                        <div class="catalog-item-info">
                            <span class="catalog-item-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
                            ${meta ? `<span class="catalog-item-meta">${escapeHtml(meta)}</span>` : ''}
                        </div>
                    </div>
                    <div class="catalog-item-right">
                        <span class="catalog-item-price">${escapeHtml(fmtMoney(p.price || 0))}</span>
                        <span class="picker-controls-slot">${controlsHtml}</span>
                    </div>
                </div>`;
        }).join('');
        if (animate) {
            setTimeout(() => {
                pickerListEl.querySelectorAll('.catalog-item-card.is-entering').forEach(el => {
                    el.classList.remove('is-entering');
                    el.style.animationDelay = '';
                });
            }, 420);
        }
        updatePickerApplyButton();
    }

    function buildPickerControlsHtml(id, qty) {
        if (qty > 0) {
            return `<div class="lifecycle-qty-stepper" data-picker-id="${escapeHtml(id)}">
                <button type="button" class="lifecycle-qty-btn" data-picker-delta="-1" aria-label="−">−</button>
                <span class="lifecycle-qty-val">${qty}</span>
                <button type="button" class="lifecycle-qty-btn" data-picker-delta="1" aria-label="+">+</button>
            </div>`;
        }
        return `<button type="button" class="picker-add-btn" data-picker-add="${escapeHtml(id)}" aria-label="+"><i class="fa-solid fa-plus"></i></button>`;
    }

    function updatePickerRowInPlace(rowEl, id, qty) {
        if (!rowEl) return;
        rowEl.classList.toggle('is-picked', qty > 0);
        const slot = rowEl.querySelector('.picker-controls-slot');
        if (slot) {
            const existingVal = slot.querySelector('.lifecycle-qty-val');
            if (qty > 0 && existingVal) {
                existingVal.textContent = String(qty);
                existingVal.classList.remove('is-popping');
                void existingVal.offsetWidth;
                existingVal.classList.add('is-popping');
            } else {
                slot.innerHTML = buildPickerControlsHtml(id, qty);
                const newVal = slot.querySelector('.lifecycle-qty-val');
                if (newVal) newVal.classList.add('is-popping');
            }
        }
        updatePickerApplyButton();
    }

    function openCatalogPickerModal() {
        if (!catalogPickerModal) return;
        pickerSearchQuery = '';
        pickerCategoryFilter = 'all';
        pickerQuantities.clear();
        if (pickerSearchInput) pickerSearchInput.value = '';
        if (pickerSearchClear) pickerSearchClear.style.display = 'none';
        renderCatalogPickerList({ animate: true });
        modal.el?.querySelector('.modal-content')?.classList.add('is-stacked-behind');
        catalogPickerModal.classList.remove('is-hidden');
        catalogPickerModal.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('modal-open');
        if (currentShop?.id) {
            const prevIds = currentShopProducts.map(p => p.id).join(',');
            loadShopProducts(currentShop.id).then(() => {
                const nextIds = currentShopProducts.map(p => p.id).join(',');
                if (nextIds !== prevIds && !catalogPickerModal.classList.contains('is-hidden')) {
                    renderCatalogPickerList({ animate: false });
                }
            });
        }
    }

    function closeCatalogPickerModal() {
        if (!catalogPickerModal || catalogPickerModal.classList.contains('is-hidden') || catalogPickerModal.classList.contains('closing')) return;
        modal.el?.querySelector('.modal-content')?.classList.remove('is-stacked-behind');
        catalogPickerModal.classList.add('closing');
        setTimeout(() => {
            catalogPickerModal.classList.add('is-hidden');
            catalogPickerModal.classList.remove('closing');
            catalogPickerModal.setAttribute('aria-hidden', 'true');
            pickerQuantities.clear();
            if (document.querySelectorAll('.modal-overlay:not(.is-hidden)').length === 0) {
                document.documentElement.classList.remove('modal-open');
            }
        }, 200);
    }

    pickerListEl?.addEventListener('click', (e) => {
        const deltaBtn = e.target.closest('[data-picker-delta]');
        if (deltaBtn) {
            e.stopPropagation();
            const rowEl = deltaBtn.closest('[data-picker-row]');
            const id = deltaBtn.closest('[data-picker-id]')?.dataset.pickerId;
            if (!id) return;
            const delta = parseInt(deltaBtn.dataset.pickerDelta, 10) || 0;
            const next = Math.max(0, (pickerQuantities.get(id) || 0) + delta);
            if (next === 0) pickerQuantities.delete(id);
            else pickerQuantities.set(id, next);
            updatePickerRowInPlace(rowEl, id, next);
            return;
        }
        const rowEl = e.target.closest('[data-picker-row]');
        if (rowEl) {
            const id = rowEl.dataset.pickerRow;
            const next = (pickerQuantities.get(id) || 0) + 1;
            pickerQuantities.set(id, next);
            updatePickerRowInPlace(rowEl, id, next);
        }
    });

    pickerApplyBtn?.addEventListener('click', () => {
        if (!itemsList || pickerQuantities.size === 0) return;
        const byId = new Map(currentShopProducts.map(p => [p.id, p]));

        pickerQuantities.forEach((addQty, id) => {
            const prod = byId.get(id);
            if (!prod || addQty <= 0) return;

            const existingRows = [...itemsList.querySelectorAll('[data-item-row]')];
            const matchRow = existingRows.find(r => {
                const n = String(r.querySelector('[data-field="item_name"]')?.value || '').trim().toLowerCase();
                const pr = parseFloat(r.querySelector('[data-field="price"]')?.value);
                return n === String(prod.name || '').trim().toLowerCase()
                    && Number.isFinite(pr) && Math.abs(pr - (Number(prod.price) || 0)) < 0.005;
            });

            if (matchRow) {
                const qEl = matchRow.querySelector('[data-field="qty"]');
                const curQty = Math.max(1, parseInt(qEl?.value, 10) || 1);
                if (qEl) qEl.value = String(curQty + addQty);
                return;
            }

            const emptyFirst = existingRows.length === 1
                && !String(existingRows[0].querySelector('[data-field="item_name"]')?.value || '').trim()
                && !String(existingRows[0].querySelector('[data-field="price"]')?.value || '').trim();

            if (emptyFirst) {
                fillReceiptItemRow(existingRows[0], prod, addQty);
            } else {
                addItemRow(false, { scroll: false });
                const newRow = itemsList.lastElementChild;
                fillReceiptItemRow(newRow, prod, addQty);
            }
        });

        updateRemoveButtonsState();
        renumberRows();
        updateTotalPreview();
        closeCatalogPickerModal();
    });

    pickerSearchInput?.addEventListener('input', () => {
        pickerSearchQuery = pickerSearchInput.value || '';
        if (pickerSearchClear) pickerSearchClear.style.display = pickerSearchQuery ? 'inline-flex' : 'none';
        renderCatalogPickerList();
    });
    pickerSearchClear?.addEventListener('click', () => {
        if (pickerSearchInput) pickerSearchInput.value = '';
        pickerSearchQuery = '';
        pickerSearchClear.style.display = 'none';
        renderCatalogPickerList();
        pickerSearchInput?.focus();
    });

    document.getElementById('pick-catalog-items-btn')?.addEventListener('click', openCatalogPickerModal);
    document.getElementById('close-catalog-picker')?.addEventListener('click', closeCatalogPickerModal);
    document.getElementById('cancel-catalog-picker')?.addEventListener('click', closeCatalogPickerModal);
    document.getElementById('picker-open-catalog-btn')?.addEventListener('click', () => {
        closeCatalogPickerModal();
        setTimeout(openCatalogModal, 220);
    });
    catalogPickerModal?.addEventListener('click', (e) => {
        if (e.target === catalogPickerModal || e.target.classList.contains('modal-backdrop')) closeCatalogPickerModal();
    });
    attachModalA11y(catalogPickerModal, { mode: 'hidden', onClose: () => closeCatalogPickerModal() });

    // Registration form logo preview
    const regLogoInput = document.getElementById('reg-logo-input');
    const logoDropZone = document.getElementById('logo-drop-zone');
    const logoDropContent = document.getElementById('logo-drop-content');
    const logoDropPreview = document.getElementById('logo-drop-preview');
    const logoDropRemove = document.getElementById('logo-drop-remove');
    const logoPreviewImg = logoDropPreview?.querySelector('img');

    function getLogoLang() {
        const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
        return window.businessTranslations?.[lang] || {};
    }

    function validateLogoFile(file) {
        const t = getLogoLang();
        if (!file) return 'no file';
        if (!['image/png', 'image/jpeg'].includes(file.type)) {
            window.showToast(t.logo_bad_format || 'Только PNG и JPG.', 'error');
            return false;
        }
        if (file.size > 2 * 1024 * 1024) {
            window.showToast(t.logo_too_large || 'Файл слишком большой. Максимум 2 МБ.', 'error');
            return false;
        }
        return true;
    }

    function showLogoPreview(file) {
        const valid = validateLogoFile(file);
        if (valid !== true) return;
        logoDropContent.style.display = 'none';
        logoDropPreview.style.display = 'flex';
        logoDropZone.classList.add('has-image');
        const reader = new FileReader();
        reader.onload = (e) => {
            logoPreviewImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function resetLogoDrop() {
        regLogoInput.value = '';
        logoDropContent.style.display = 'flex';
        logoDropPreview.style.display = 'none';
        logoDropZone.classList.remove('has-image');
    }

    logoDropZone?.addEventListener('click', () => regLogoInput?.click());

    logoDropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        logoDropZone.style.borderColor = 'var(--primary)';
        logoDropZone.style.background = 'rgba(59, 130, 246, 0.05)';
    });

    logoDropZone?.addEventListener('dragleave', () => {
        logoDropZone.style.borderColor = '';
        logoDropZone.style.background = '';
    });

    logoDropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        logoDropZone.style.borderColor = '';
        logoDropZone.style.background = '';
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        const valid = validateLogoFile(file);
        if (valid !== true) return;
        const dt = new DataTransfer();
        dt.items.add(file);
        regLogoInput.files = dt.files;
        showLogoPreview(file);
    });

    regLogoInput?.addEventListener('change', () => {
        const file = regLogoInput.files?.[0];
        if (file) {
            showLogoPreview(file);
        } else {
            resetLogoDrop();
        }
    });

    logoDropRemove?.addEventListener('click', (e) => {
        e.stopPropagation();
        resetLogoDrop();
    });

    const filterBar = document.getElementById('receipt-filter-bar');
    const filterIndicator = document.getElementById('receipt-filter-indicator');
    const receiptFilterIndicator = createSegmentedIndicator(filterBar, filterIndicator, {
        itemSelector: '.receipt-filter-btn',
    });

    // --- Shop Registration & Edit Contacts Phone/Email Wiring ---
    function wireClearButton(inputEl, clearBtnEl, onClear) {
        if (!inputEl || !clearBtnEl) return { sync: () => {} };
        const sync = () => {
            clearBtnEl.classList.toggle('is-hidden', !inputEl.value.trim());
        };
        inputEl.addEventListener('input', sync);
        inputEl.addEventListener('change', sync);
        clearBtnEl.addEventListener('click', () => {
            inputEl.value = '';
            sync();
            if (typeof onClear === 'function') onClear();
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        });
        sync();
        return { sync };
    }

    const regContactEmailInput = document.getElementById('shop-contact-email');
    const regPhoneCountrySelect = document.getElementById('shop-phone-country');
    const regContactPhoneInput = document.getElementById('shop-contact-phone');
    const regEmailClear = wireClearButton(regContactEmailInput, document.getElementById('clear-shop-contact-email'));
    const regPhoneClear = wireClearButton(regContactPhoneInput, document.getElementById('clear-shop-contact-phone'));
    let regPhonePair = null;

    if (regPhoneCountrySelect && regContactPhoneInput) {
        const initCountry = getDefaultPhoneCountry(null, bizLang());
        populateDialCodeSelect(regPhoneCountrySelect, bizLang(), initCountry);
        regPhonePair = wirePhoneInputPair(regPhoneCountrySelect, regContactPhoneInput);
    }

    (async function prefillShopRegistrationDefaults() {
        if (regContactEmailInput && !regContactEmailInput.value && user?.email) {
            regContactEmailInput.value = user.email;
            regEmailClear.sync();
        }
        if (!user?.id) return;
        let userCurrency = '';
        let userPhone = '';
        let profErr = null;
        try {
            const { data: prof, error } = await client
                .from('profiles')
                .select('currency, phone')
                .eq('id', user.id)
                .maybeSingle();
            profErr = error || null;
            if (prof?.currency) userCurrency = String(prof.currency).trim().toUpperCase();
            if (prof?.phone) userPhone = String(prof.phone).trim();
        } catch (e) {
            profErr = e;
        }

        if (!userPhone && profErr) {
            userPhone = (await fetchCurrentUserPhone(client, user.id)) || '';
        }
        if (!userPhone) {
            const metaPhone = user?.user_metadata?.phone || user?.phone || '';
            if (metaPhone) {
                userPhone = String(metaPhone).trim();
            } else {
                try {
                    const { data: { user: freshUser } } = await client.auth.getUser();
                    const freshPhone = freshUser?.user_metadata?.phone || freshUser?.phone || '';
                    if (freshPhone) userPhone = String(freshPhone).trim();
                } catch (_) { /* ignore */ }
            }
        }
        if (!userCurrency && profErr) {
            try {
                const { data: curProf } = await client
                    .from('profiles')
                    .select('currency')
                    .eq('id', user.id)
                    .maybeSingle();
                if (curProf?.currency) userCurrency = String(curProf.currency).trim().toUpperCase();
            } catch (_) { /* ignore */ }
        }
        if (!userCurrency && user?.user_metadata?.currency) {
            userCurrency = String(user.user_metadata.currency).trim().toUpperCase();
        }

        const shopCurrencySelect = document.getElementById('shop-currency');
        if (shopCurrencySelect && userCurrency) {
            const hasOpt = Array.from(shopCurrencySelect.options).some(o => o.value === userCurrency);
            if (hasOpt) {
                shopCurrencySelect.value = userCurrency;
                if (shopCurrencySelect._cs) shopCurrencySelect._cs.refresh();
            }
        }

        if (regPhoneCountrySelect && regContactPhoneInput && !regContactPhoneInput.value && userPhone) {
            const fallbackCountry = getDefaultPhoneCountry(null, bizLang());
            if (regPhonePair) {
                regPhonePair.setFromE164(userPhone, fallbackCountry);
                if (regPhoneCountrySelect._cs) regPhoneCountrySelect._cs.refresh();
            } else {
                const parsed = splitPhone(userPhone, fallbackCountry);
                if (parsed?.code) {
                    populateDialCodeSelect(regPhoneCountrySelect, bizLang(), parsed.code);
                    regPhoneCountrySelect.value = parsed.code;
                    if (regPhoneCountrySelect._cs) regPhoneCountrySelect._cs.refresh();
                }
                if (parsed?.local) {
                    regContactPhoneInput.value = parsed.local;
                }
            }
            regPhoneClear.sync();
        }
    })();

    const shopContactsModal = document.getElementById('shop-contacts-modal');
    const shopContactsForm = document.getElementById('shop-contacts-form');
    const editShopEmailInput = document.getElementById('edit-shop-contact-email');
    const editShopPhoneCountry = document.getElementById('edit-shop-phone-country');
    const editShopPhoneInput = document.getElementById('edit-shop-contact-phone');
    const editShopEmailErr = document.getElementById('shop-contacts-email-error');
    const editShopPhoneErr = document.getElementById('shop-contacts-phone-error');
    const editEmailClear = wireClearButton(editShopEmailInput, document.getElementById('clear-edit-shop-contact-email'), () => {
        if (editShopEmailErr) editShopEmailErr.textContent = '';
    });
    const editPhoneClear = wireClearButton(editShopPhoneInput, document.getElementById('clear-edit-shop-contact-phone'), () => {
        if (editShopPhoneErr) editShopPhoneErr.textContent = '';
    });
    let editShopPhonePair = null;
    let shopContactsSaving = false;

    if (editShopPhoneCountry && editShopPhoneInput) {
        populateDialCodeSelect(editShopPhoneCountry, bizLang(), getDefaultPhoneCountry(null, bizLang()));
        editShopPhonePair = wirePhoneInputPair(editShopPhoneCountry, editShopPhoneInput);
    }

    function openShopContactsModal() {
        if (!shopContactsModal || !currentShop) return;
        if (editShopEmailErr) editShopEmailErr.textContent = '';
        if (editShopPhoneErr) editShopPhoneErr.textContent = '';
        if (editShopEmailInput) editShopEmailInput.value = currentShop.contact_email || '';

        const fallbackCountry = getDefaultPhoneCountry(currentShop.country, bizLang());
        if (editShopPhoneCountry && editShopPhoneInput) {
            if (currentShop.contact_phone) {
                const parsed = splitPhone(currentShop.contact_phone, fallbackCountry);
                const code = parsed?.code || fallbackCountry;
                populateDialCodeSelect(editShopPhoneCountry, bizLang(), code);
                editShopPhoneCountry.value = code;
                editShopPhoneInput.value = parsed?.local || '';
                editShopPhonePair?.formatCurrent();
            } else {
                populateDialCodeSelect(editShopPhoneCountry, bizLang(), fallbackCountry);
                editShopPhoneCountry.value = fallbackCountry;
                editShopPhoneInput.value = '';
            }
            if (editShopPhoneCountry._cs) editShopPhoneCountry._cs.refresh();
            else if (typeof CustomSelect !== 'undefined') CustomSelect.init(shopContactsModal);
        }

        editEmailClear.sync();
        editPhoneClear.sync();
        shopContactsModal.classList.remove('is-hidden');
        shopContactsModal.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('modal-open');
    }

    function closeShopContactsModal() {
        if (!shopContactsModal || shopContactsModal.classList.contains('is-hidden') || shopContactsModal.classList.contains('closing')) return;
        shopContactsModal.classList.add('closing');
        setTimeout(() => {
            shopContactsModal.classList.add('is-hidden');
            shopContactsModal.classList.remove('closing');
            shopContactsModal.setAttribute('aria-hidden', 'true');
            if (document.querySelectorAll('.modal-overlay:not(.is-hidden)').length === 0) {
                document.documentElement.classList.remove('modal-open');
            }
        }, 200);
    }

    document.getElementById('edit-shop-contacts-btn')?.addEventListener('click', openShopContactsModal);
    document.getElementById('close-shop-contacts-modal')?.addEventListener('click', closeShopContactsModal);
    document.getElementById('cancel-shop-contacts-btn')?.addEventListener('click', closeShopContactsModal);
    shopContactsModal?.addEventListener('click', (e) => {
        if (e.target === shopContactsModal || e.target.classList.contains('modal-backdrop')) closeShopContactsModal();
    });
    attachModalA11y(shopContactsModal, { mode: 'hidden', onClose: closeShopContactsModal });

    shopContactsForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (shopContactsSaving || !currentShop) return;
        const t = bizT();
        const lang = bizLang();
        const rawEmail = String(editShopEmailInput?.value || '').trim().toLowerCase();
        const rawLocalPhone = String(editShopPhoneInput?.value || '').trim();

        let valid = true;
        if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawEmail)) {
            if (editShopEmailErr) editShopEmailErr.textContent = t.shop_contacts_err_email || (lang === 'en' ? 'Enter a valid email address' : 'Введите корректный email');
            valid = false;
        } else if (editShopEmailErr) {
            editShopEmailErr.textContent = '';
        }

        let normalizedPhone = '';
        if (rawLocalPhone) {
            const e164 = normalizePhone(editShopPhoneCountry?.value, rawLocalPhone);
            if (!e164) {
                if (editShopPhoneErr) editShopPhoneErr.textContent = t.shop_contacts_err_phone || (lang === 'en' ? 'Enter a valid phone number' : 'Введите корректный номер телефона');
                valid = false;
            } else {
                normalizedPhone = e164;
                if (editShopPhoneErr) editShopPhoneErr.textContent = '';
            }
        } else if (editShopPhoneErr) {
            editShopPhoneErr.textContent = '';
        }

        if (!valid) return;

        const saveBtn = document.getElementById('save-shop-contacts-btn');
        shopContactsSaving = true;
        if (saveBtn) saveBtn.disabled = true;

        try {
            const { error } = await client
                .from('shops')
                .update({ contact_email: rawEmail, contact_phone: normalizedPhone })
                .eq('id', currentShop.id);
            if (error) throw error;

            currentShop = { ...currentShop, contact_email: rawEmail, contact_phone: normalizedPhone };
            sessionStorage.setItem('current_shop', JSON.stringify(currentShop));
            updateShopInfo(currentShop);
            closeShopContactsModal();
            window.showToast(t.shop_contacts_saved || (lang === 'en' ? 'Shop contacts saved' : 'Контакты магазина сохранены'), 'success');
        } catch (err) {
            logError('biz:saveShopContacts', err);
            window.showToast(lang === 'en' ? 'Failed to save contacts' : 'Не удалось сохранить контакты', 'error');
        } finally {
            shopContactsSaving = false;
            if (saveBtn) saveBtn.disabled = false;
        }
    });

    try {
        const { data: shop, error } = await client
            .from('shops')
            .select('id, shop_name, tax_id, address, country, currency, logo_path, public_key, owner_id, contact_email, contact_phone')
            .eq('owner_id', user.id)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            const loadLang = (window.getValuonLang ? window.getValuonLang() : 'en');
            window.showToast(loadLang === 'en' ? 'Failed to load shop data. Check your connection.' : 'Не удалось загрузить данные магазина. Проверьте подключение.', 'error');

            if (currentShop) {
                updateShopInfo(currentShop);
                renderView(views.dashboard);
                await refreshDashboard(client, currentShop.id, stats, list);
            } else if (views.shop) {
                renderView(views.shop);
            }
        } else {
            currentShop = shop;

            if (shop) {
                sessionStorage.setItem('current_shop', JSON.stringify(shop));
            } else {
                sessionStorage.removeItem('current_shop');
            }

            if (!shop && views.shop) {
                renderView(views.shop);
            } else if (shop) {
                updateShopInfo(shop);
                renderView(views.dashboard);
                await Promise.all([
                    loadTerminals(shop.id),
                    loadShopProducts(shop.id),
                    refreshDashboard(client, shop.id, stats, list)
                ]);
            } else {
                renderView(views.dashboard);
            }
        }
    } catch (e) {
        logError('biz:loadShop', e);
        if (currentShop) {
            updateShopInfo(currentShop);
            await Promise.all([loadTerminals(currentShop.id), loadShopProducts(currentShop.id)]);
            renderView(views.dashboard);
            await refreshDashboard(client, currentShop.id, stats, list);
        } else if (views.shop) {
            renderView(views.shop);
        }
    }

    function renderView(targetView) {
        loader?.classList.add('is-hidden');
        Object.values(views).forEach(v => v?.classList.remove('is-active'));
        targetView?.classList.add('is-active');
    }

    if (forms.shop) {
        forms.shop.querySelectorAll('input[required], select[required], textarea[required]').forEach((field) => {
            field.addEventListener('invalid', () => {
                const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
                const msg = window.businessTranslations?.[lang]?.field_required
                    || (lang === 'en' ? 'Please fill out this field' : 'Заполните это поле');
                field.setCustomValidity(msg);
            });
            field.addEventListener('input', () => field.setCustomValidity(''));
            field.addEventListener('change', () => field.setCustomValidity(''));
        });

        forms.shop.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');

            if (btn.disabled) return;
            btn.disabled = true;
            const originalHTML = btn.innerHTML;
            const createLang = (window.getValuonLang ? window.getValuonLang() : 'en');
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ' + (window.businessTranslations?.[createLang]?.registering_shop || (createLang === 'en' ? 'Creating...' : 'Создание...'));

            try {
                const createLang = (window.getValuonLang ? window.getValuonLang() : 'en');
                const fd = new FormData(e.target);

                const rawTaxId = String(fd.get('tax_id') || '').trim().replace(/\s+/g, '').toUpperCase();
                const taxDigitsCount = (rawTaxId.match(/\d/g) || []).length;
                if (!/^[A-Z0-9][A-Z0-9-]{3,18}[A-Z0-9]$/.test(rawTaxId) || taxDigitsCount < 4) {
                    window.showToast(
                        createLang === 'en'
                            ? 'Invalid tax ID. Use 5–20 characters (Latin letters, digits, hyphen; at least 4 digits).'
                            : 'Некорректный налоговый номер. Используйте 5–20 символов (латинские буквы, цифры, дефис; минимум 4 цифры).',
                        'warning'
                    );
                    document.getElementById('tax_id')?.focus();
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                    return;
                }

                // Validate logo up front (uploaded after the shop exists, since
                // the storage path is keyed by shop id)
                const LOGO_MIME_TO_EXT = {
                    'image/png': 'png',
                    'image/jpeg': 'jpg',
                };
                const logoFile = fd.get('logo');
                if (logoFile && logoFile.size && logoFile.size > 0) {
                    if (logoFile.size > 2 * 1024 * 1024) {
                        window.showToast(createLang === 'en' ? 'File too large. Maximum 2 MB.' : 'Файл слишком большой. Максимум 2 МБ.', 'error');
                        btn.disabled = false;
                        btn.innerHTML = originalHTML;
                        return;
                    }
                    if (!Object.prototype.hasOwnProperty.call(LOGO_MIME_TO_EXT, logoFile.type)) {
                        window.showToast(createLang === 'en' ? 'Only PNG and JPG are allowed.' : 'Только PNG и JPG.', 'error');
                        btn.disabled = false;
                        btn.innerHTML = originalHTML;
                        return;
                    }
                }

                const rawContactEmail = String(fd.get('contact_email') || '').trim().toLowerCase();
                const rawContactPhoneLocal = String(fd.get('contact_phone') || '').trim();
                let normalizedShopPhone = '';
                if (rawContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawContactEmail)) {
                    window.showToast(createLang === 'en' ? 'Enter a valid shop contact email' : 'Введите корректный email магазина', 'error');
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                    return;
                }
                if (rawContactPhoneLocal) {
                    normalizedShopPhone = normalizePhone(regPhoneCountrySelect?.value, rawContactPhoneLocal) || '';
                    if (!normalizedShopPhone) {
                        window.showToast(createLang === 'en' ? 'Enter a valid shop contact phone' : 'Введите корректный телефон магазина', 'error');
                        btn.disabled = false;
                        btn.innerHTML = originalHTML;
                        return;
                    }
                }

                // Key generation + insert happen server-side (Edge Function
                // create-shop): the private signing key is never generated in,
                // or sent to, the browser — not even once.
                const { data: created, error: createError } = await client.functions.invoke('create-shop', {
                    body: {
                        shop_name: String(fd.get('shop_name') || '').trim(),
                        tax_id: rawTaxId,
                        address: String(fd.get('address') || '').trim(),
                        country: fd.get('country') || null,
                        currency: fd.get('currency') || 'EUR',
                    },
                });

                if (createError || !created?.shop) {
                    let code = null;
                    try { code = (await createError.context.json())?.error; } catch (_) { /* no body */ }
                    const createMsg = code === 'validation_failed'
                        ? (createLang === 'en' ? 'Fill in all required fields' : 'Заполните все обязательные поля')
                        : (createLang === 'en' ? 'Creation error' : 'Ошибка создания');
                    window.showToast(createMsg, 'error');
                    logError('biz:createShop', createError || code);
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                    return;
                }

                let newShop = created.shop;

                if (rawContactEmail || normalizedShopPhone) {
                    try {
                        const { error: contactErr } = await client
                            .from('shops')
                            .update({
                                contact_email: rawContactEmail || null,
                                contact_phone: normalizedShopPhone || null,
                            })
                            .eq('id', newShop.id);
                        if (!contactErr) {
                            newShop = {
                                ...newShop,
                                contact_email: rawContactEmail || null,
                                contact_phone: normalizedShopPhone || null,
                            };
                        } else {
                            logError('biz:shopContactsUpdateErr', contactErr);
                        }
                    } catch (contactEx) {
                        logError('biz:shopContactsUpdate', contactEx);
                    }
                }

                // Upload logo now that the shop exists
                if (logoFile && logoFile.size && logoFile.size > 0) {
                    try {
                        const ext = LOGO_MIME_TO_EXT[logoFile.type];
                        if (ext) {
                            const filePath = `${newShop.id}/logo.${ext}`;
                            const { error: upErr } = await client.storage
                                .from('shop-logos')
                                .upload(filePath, logoFile, { upsert: false, contentType: logoFile.type });
                            if (!upErr) {
                                const { error: logoDbErr } = await client.from('shops').update({ logo_path: filePath }).eq('id', newShop.id);
                                if (!logoDbErr) {
                                    newShop = { ...newShop, logo_path: filePath };
                                } else {
                                    logError('biz:logoDbUpdate', logoDbErr);
                                }
                            }
                        }
                    } catch (_) { /* logo is optional */ }
                }

                const createdLang = (window.getValuonLang ? window.getValuonLang() : 'en');
                window.showToast(createdLang === 'en' ? 'Store created with cryptographic signature!' : 'Магазин создан с криптографической подписью!', 'success');

                currentShop = newShop;
                sessionStorage.setItem('current_shop', JSON.stringify(newShop));
                updateShopInfo(newShop);
                await Promise.all([loadTerminals(newShop.id), loadShopProducts(newShop.id)]);
                renderView(views.dashboard);
                await refreshDashboard(client, newShop.id, stats, list);
            } catch (err) {
                logError('biz:createShop', err);
                const catchLang = (window.getValuonLang ? window.getValuonLang() : 'en');
                window.showToast(
                    catchLang === 'en' ? 'Failed to create store. Please try again.' : 'Не удалось создать магазин. Попробуйте ещё раз.',
                    'error'
                );
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }
        });
    }

    function showGuard() {
        if (!guardEl) return;
        guardEl.classList.remove('closing');
        guardVisible = true;
        guardEl.classList.remove('is-hidden');
        const firstBtn = guardEl.querySelector('#draft-save-btn');
        if (firstBtn) firstBtn.focus();
    }

    function hideGuard() {
        if (!guardEl || guardEl.classList.contains('is-hidden')) return;
        guardVisible = false;
        if (guardEl.classList.contains('closing')) return;
        guardEl.classList.add('closing');
        setTimeout(() => {
            guardEl.classList.remove('closing');
            guardEl.classList.add('is-hidden');
        }, 180);
    }

    function forceClose() {
        const el = modal.el;
        if (!el || el.classList.contains('closing')) return;
        hideGuard();
        el.classList.add('closing');
        setTimeout(() => {
            el.classList.remove('closing');
            el.classList.add('is-hidden');
            el.setAttribute('aria-hidden', 'true');
            document.documentElement.classList.remove('modal-open');
            baselineDate = '';
            forms.receipt?.reset();
            resetItemRows();
            if (phoneInput) phoneInput.value = '';
            setContactMode(getSavedShopContactMode(), { instant: true });
            syncDraftButton();
            clearAllValidationState();
            hideAutocomplete();
            hideSuccessScreen();
            lastIssuedReceipt = null;
            if (submitLabelEl) {
                const t = bizT();
                submitLabelEl.textContent = t.issue_receipt_submit || (bizLang() === 'en' ? 'Issue Receipt' : 'Выписать чек');
            }
            if (typeof CustomSelect !== 'undefined') {
                const pay = modal.el?.querySelector('[name="payment_method"]');
                if (pay && pay._cs) pay._cs.refresh();
                if (phoneCountrySelect && phoneCountrySelect._cs) phoneCountrySelect._cs.refresh();
            }
        }, 250);
    }

    function requestClose() {
        if (issuingClose) return;
        if (catalogPickerModal && !catalogPickerModal.classList.contains('is-hidden')) {
            closeCatalogPickerModal();
            return;
        }
        if (successScreen && !successScreen.classList.contains('is-hidden')) {
            forceClose();
            return;
        }
        if (guardVisible) {
            hideGuard();
            return;
        }
        if (isFormDirty()) {
            showGuard();
            return;
        }
        forceClose();
    }

    function toggleModal(show, { resumeDraft = false } = {}) {
        if (!modal.el) return;

        if (show) {
            if (!currentShop) {
                const toastLang = (window.getValuonLang ? window.getValuonLang() : 'en');
                window.showToast(toastLang === 'en' ? 'Create a shop first' : 'Сначала создайте магазин', 'warning');
                return;
            }

            hideGuard();
            hideSuccessScreen();
            clearAllValidationState();
            hideAutocomplete();
            loadCustomerHistory();
            const draft = resumeDraft ? readDraft() : null;
            if (draft) {
                applyDraft(draft);
            } else {
                forms.receipt?.reset();
                resetItemRows();
                if (phoneInput) phoneInput.value = '';
                ensureBizPhoneSelect(getDefaultBizCountry());
                setContactMode(getSavedShopContactMode(), { instant: true });
                    expandClientSection();
            }

            const dateInput = forms.receipt?.querySelector('[name="purchase_date"]');
            if (!draft?.purchase_date && dateInput) {
                const now = defaultDateString();
                dateInput.value = now;
                if (dateInput._cdp) dateInput._cdp.syncDisplay();
            } else if (draft?.purchase_date && dateInput) {
                dateInput.value = draft.purchase_date;
                if (dateInput._cdp) dateInput._cdp.syncDisplay();
            }
            if (dateInput) baselineDate = dateInput.value;

            renderPosSelect(draft ? (draft.pos_terminal_id ?? '') : undefined);

            if (typeof CustomSelect !== 'undefined') {
                const pay = modal.el.querySelector('[name="payment_method"]');
                if (pay && pay._cs) pay._cs.refresh();
                if (posSelect && posSelect._cs) posSelect._cs.refresh();
                itemsList?.querySelectorAll('[data-field="category"]').forEach((sel) => {
                    if (sel._cs) sel._cs.refresh();
                });
            }

            modal.el.classList.remove('is-hidden');
            modal.el.setAttribute('aria-hidden', 'false');
            document.documentElement.classList.add('modal-open');
            updateTotalPreview();
            requestAnimationFrame(() => contactModeIndicator.update(true));

            // Ensure modal scroll starts strictly at the top so customer contact is immediately visible
            if (modalBody) modalBody.scrollTop = 0;
            const mContent = modal.el.querySelector('.modal-content');
            if (mContent) mContent.scrollTop = 0;
            requestAnimationFrame(() => {
                if (modalBody) modalBody.scrollTop = 0;
                if (mContent) mContent.scrollTop = 0;
            });

            const headIcon = modal.el.querySelector('.modal-heading-icon');
            if (headIcon) {
                headIcon.classList.remove('wave');
                void headIcon.offsetWidth;
                headIcon.classList.add('wave');
            }
        } else {
            requestClose();
        }
    }

    function handleExplicitSaveDraft() {
        const d = collectFormData();
        const dl = (window.getValuonLang ? window.getValuonLang() : 'en');
        const t = window.businessTranslations?.[dl] || {};
        if (!draftHasContent(d)) {
            window.showToast(t.draft_empty_hint || (dl === 'en' ? 'Fill in at least one field to save a draft' : 'Заполните хотя бы одно поле для сохранения черновика'), 'warning');
            return;
        }
        const res = saveDraft();
        if (res === 'error') {
            window.showToast(dl === 'en' ? 'Could not save the draft' : 'Не удалось сохранить черновик', 'error');
            return;
        }
        window.showToast(t.draft_saved || 'Черновик сохранён', 'success');
        hideGuard();
        forceClose();
    }

    attachModalA11y(modal.el, {
        mode: 'hidden',
        beforeClose: () => {
            if (catalogPickerModal && !catalogPickerModal.classList.contains('is-hidden')) {
                return false;
            }
            if (isFormDirty() && !guardVisible && (!successScreen || successScreen.classList.contains('is-hidden'))) {
                showGuard();
                return false;
            }
            return true;
        },
        onClose: () => requestClose()
    });

    modal.openBtn?.addEventListener('click', () => toggleModal(true, { resumeDraft: false }));
    continueDraftBtn?.addEventListener('click', () => toggleModal(true, { resumeDraft: true }));
    document.getElementById('header-save-draft-btn')?.addEventListener('click', handleExplicitSaveDraft);
    syncDraftButton();
    modal.closeBtn?.addEventListener('click', () => requestClose());
    modal.cancelBtn?.addEventListener('click', () => requestClose());
    modal.el?.addEventListener('click', (e) => {
        if (e.target === modal.el || e.target.classList.contains('modal-backdrop')) requestClose();
    });

    document.getElementById('draft-save-btn')?.addEventListener('click', () => {
        const res = saveDraft();
        if (res === 'error') {
            const dl = (window.getValuonLang ? window.getValuonLang() : 'en');
            window.showToast(dl === 'en' ? 'Could not save the draft' : 'Не удалось сохранить черновик', 'error');
            return;
        }
        if (res === 'saved') {
            const dl = (window.getValuonLang ? window.getValuonLang() : 'en');
            const t = window.businessTranslations?.[dl] || {};
            window.showToast(t.draft_saved || 'Черновик сохранён', 'success');
        }
        hideGuard();
        forceClose();
    });
    document.getElementById('draft-discard-btn')?.addEventListener('click', () => {
        clearDraft();
        hideGuard();
        forceClose();
    });
    document.getElementById('draft-cancel-btn')?.addEventListener('click', () => {
        hideGuard();
    });

    if (forms.receipt) {
        forms.receipt.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');

            if (btn.disabled) return;

            const contactValid = validateCustomerContactField(true);
            const itemsValid = validateAllItemRows(true);
            if (!contactValid || !itemsValid) {
                if (!contactValid) {
                    expandClientSection();
                    emailGroup?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    if (contactMode === 'phone') phoneInput?.focus();
                    else emailInput?.focus();
                } else {
                    const firstInvalidRow = itemsList?.querySelector('[data-item-row].is-invalid');
                    firstInvalidRow?.querySelector('[data-field="item_name"]')?.focus();
                    firstInvalidRow?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
                return;
            }

            btn.disabled = true;
            issuingClose = true;
            btn.classList.add('is-loading');

            try {
                if (!currentShop) return;

                const fd = new FormData(e.target);
                const valLang = (window.getValuonLang ? window.getValuonLang() : 'en');
                let email = null;
                let normalizedPhone = null;

                if (contactMode === 'phone') {
                    normalizedPhone = normalizePhone(phoneCountrySelect?.value, phoneInput?.value || '');
                    if (!normalizedPhone) {
                        window.showToast(valLang === 'en' ? 'Enter a valid customer phone number' : 'Введите корректный номер телефона покупателя', 'warning');
                        return;
                    }
                } else {
                    email = String(fd.get('customer_email') || '').toLowerCase().trim();
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email)) {
                        window.showToast(valLang === 'en' ? 'Enter a valid customer email' : 'Введите корректный email покупателя', 'warning');
                        return;
                    }
                }

                const items = readItemRows();
                if (items.length === 0 || items.some(it => !it.itemName || it.qty <= 0 || it.warrantyMonths < 0 || Number.isNaN(it.warrantyMonths))) {
                    window.showToast(
                        valLang === 'en'
                            ? 'Fill in every line item (product, quantity)'
                            : 'Заполните все позиции чека (товар, количество)',
                        'warning'
                    );
                    return;
                }

                const fdPosId = fd.get('pos_terminal_id');
                const posTerm = currentTerminals.find((x) => x.id === fdPosId && x.is_active) || null;

                const invokeBody = {
                    shop_id: currentShop.id,
                    purchase_date: fd.get('purchase_date'),
                    payment_method: fd.get('payment_method'),
                    pos_terminal_id: posTerm ? posTerm.id : null,
                    items: items.map((it) => ({
                        item_name: it.itemName,
                        qty: it.qty,
                        unit_price: it.unitPrice,
                        vat_rate: it.vatRate,
                        warranty_months: it.warrantyMonths,
                        discount: it.discount,
                        category: it.category,
                    })),
                };
                if (email) invokeBody.customer_email = email;
                if (normalizedPhone) invokeBody.customer_phone = normalizedPhone;

                // Signing, totals, customer lookup and the receipt/items write all
                // happen server-side (Edge Function issue-receipt): the shop's
                // private key is read only inside that function, by a service_role
                // client, and never touches the browser.
                let { data: issued, error: issueError } = await client.functions.invoke('issue-receipt', {
                    body: invokeBody,
                });

                // On 401 (stale/expired access token), refresh session once and retry
                if (issueError && issueError.context?.status === 401) {
                    try {
                        const { data: refreshed } = await client.auth.refreshSession();
                        if (refreshed?.session) {
                            ({ data: issued, error: issueError } = await client.functions.invoke('issue-receipt', {
                                body: invokeBody,
                            }));
                        }
                    } catch (_) { /* refresh failed — fall through to error handler */ }
                }

                if (issueError || !issued?.id) {
                    const isUnauth = issueError?.context?.status === 401;
                    let code = null;
                    try { code = (await issueError.context.json())?.error; } catch (_) { /* no body */ }
                    const errLang = (window.getValuonLang ? window.getValuonLang() : 'en');
                    if (isUnauth || code === 'unauthorized') {
                        window.showToast(
                            errLang === 'en'
                                ? 'Session expired — please sign in again'
                                : 'Сессия истекла — войдите заново',
                            'error'
                        );
                    } else {
                        window.showToast(errLang === 'en' ? 'Receipt issue error' : 'Ошибка выписки чека', 'error');
                    }
                    logError('biz:issueReceipt', issueError || code);
                    return;
                }

                const succLang = (window.getValuonLang ? window.getValuonLang() : 'en');
                const receiptLabel = issued.receipt_number ? ` #RCP-${issued.receipt_number}` : '';
                window.showToast(succLang === 'en' ? `Receipt${receiptLabel} issued!` : `Чек${receiptLabel} выписан!`, 'success');
                saveShopContactMode(contactMode);
                clearDraft();

                const resolvedEmail = issued.customer_email || email || null;
                const resolvedPhone = issued.customer_phone || normalizedPhone || null;

                if (customerHistory) {
                    if (resolvedEmail) {
                        customerHistory.emails = customerHistory.emails.filter((c) => c.email !== resolvedEmail);
                        customerHistory.emails.unshift({ email: resolvedEmail, status: issued.status });
                    }
                    if (resolvedPhone) {
                        customerHistory.phones = customerHistory.phones.filter((c) => c.phone !== resolvedPhone);
                        customerHistory.phones.unshift({ phone: resolvedPhone, status: issued.status, email: resolvedEmail || '' });
                    }
                }

                showSuccessScreen({
                    id: issued.id,
                    receipt_number: issued.receipt_number,
                    customer_email: resolvedEmail,
                    customer_phone: resolvedPhone,
                    payment_method: fd.get('payment_method'),
                    purchase_date: fd.get('purchase_date'),
                    status: issued.status,
                    net_total: issued.net_total,
                    vat_amount: issued.vat_amount,
                    gross_total: issued.gross_total,
                    fiscal_hash: issued.fiscal_hash,
                    pos_serial: issued.pos_serial,
                    shop_id: currentShop.id,
                    shop_name: currentShop.shop_name,
                    receipt_items: items.map((it) => ({
                        item_name: it.itemName,
                        qty: it.qty,
                        unit_price: it.unitPrice,
                        vat_rate: it.vatRate,
                        warranty_months: it.warrantyMonths,
                        discount_rate: it.discount,
                        net_total: it.netTotal,
                        vat_amount: it.vatAmount,
                        gross_total: it.grossTotal,
                    })),
                });

                await refreshDashboard(client, currentShop.id, stats, list);
            } catch (err) {
                logError('biz:issueReceiptCatch', err);
                const errLang = (window.getValuonLang ? window.getValuonLang() : 'en');
                window.showToast(errLang === 'en' ? 'Error issuing receipt' : 'Ошибка выписки чека', 'error');
            } finally {
                issuingClose = false;
                btn.disabled = false;
                btn.classList.remove('is-loading');
            }
        });
    }

    // === Receipt Lifecycle Modal (Refund / Void) ===
    const lcModal = document.getElementById('receipt-lifecycle-modal');
    const lcForm = document.getElementById('receipt-lifecycle-form');
    const lcSubtitle = document.getElementById('lifecycle-modal-subtitle');
    const lcCloseBtn = document.getElementById('close-lifecycle-modal');
    const lcCancelBtn = document.getElementById('cancel-lifecycle-btn');
    const lcConfirmBtn = document.getElementById('confirm-lifecycle-btn');
    const lcConfirmLabel = document.getElementById('confirm-lifecycle-label');
    const lcTabsEl = document.getElementById('lifecycle-action-tabs');
    const lcTabIndicatorEl = document.getElementById('lifecycle-tab-indicator');
    const lcTabBtns = Array.from(document.querySelectorAll('#receipt-lifecycle-modal .lifecycle-tab-btn'));
    const lcVoidNoticeWrap = document.getElementById('lifecycle-void-notice-wrap');
    const lcVoidNotice = document.getElementById('lifecycle-void-notice');
    const lcRefundSection = document.getElementById('lifecycle-refund-section');
    const lifecycleTabIndicator = createSegmentedIndicator(lcTabsEl, lcTabIndicatorEl, {
        itemSelector: '.lifecycle-tab-btn',
        activeClass: 'active',
    });
    const lcItemsList = document.getElementById('lifecycle-items-list');
    const lcSelectAllBtn = document.getElementById('lifecycle-select-all-btn');
    const lcRefundTotal = document.getElementById('lifecycle-refund-total');
    const lcRefundKindBadge = document.getElementById('lifecycle-refund-kind-badge');
    const lcReasonPresets = document.getElementById('lifecycle-reason-presets');
    const lcReasonInput = document.getElementById('lifecycle-reason-input');
    const lcErrorEl = document.getElementById('lifecycle-error');

    let lcReceipt = null;
    let lcAction = 'refund';
    let lcSelections = new Map(); // itemId -> qty to refund (0 = unchecked)
    let lcSubmitting = false;

    function getBizT() {
        const lang = (window.getValuonLang ? window.getValuonLang() : (window.businessCurrentLang || 'en'));
        return { lang, t: window.businessTranslations?.[lang] || window.businessTranslations?.ru || {} };
    }

    function closeLifecycleModal() {
        if (!lcModal || lcModal.classList.contains('is-hidden') || lcModal.classList.contains('closing') || lcSubmitting) return;
        lcModal.classList.add('closing');
        setTimeout(() => {
            lcModal.classList.add('is-hidden');
            lcModal.classList.remove('closing');
            lcModal.setAttribute('aria-hidden', 'true');
            document.documentElement.classList.remove('modal-open');
            lcReceipt = null;
            lcSelections.clear();
        }, 250);
    }

    if (lcModal) {
        attachModalA11y(lcModal, { mode: 'hidden', onClose: closeLifecycleModal });
        lcCloseBtn?.addEventListener('click', closeLifecycleModal);
        lcCancelBtn?.addEventListener('click', closeLifecycleModal);
        lcModal.addEventListener('click', (e) => {
            if (e.target === lcModal || e.target.classList.contains('modal-backdrop')) {
                closeLifecycleModal();
            }
        });
    }

    function setLifecycleError(msg) {
        if (!lcErrorEl) return;
        lcErrorEl.textContent = msg || '';
    }

    function renderLifecyclePresets(animate = false) {
        if (!lcReasonPresets) return;
        const { t } = getBizT();
        const presets = lcAction === 'void'
            ? (t.lifecycle_presets_void || [])
            : (t.lifecycle_presets_refund || []);
        const currentVal = (lcReasonInput?.value || '').trim();
        lcReasonPresets.classList.remove('is-switching');
        lcReasonPresets.innerHTML = presets.map(p =>
            `<button type="button" class="lifecycle-preset-chip${currentVal === p ? ' active' : ''}" data-preset="${escapeHtml(p)}">${escapeHtml(p)}</button>`
        ).join('');
        if (animate) {
            void lcReasonPresets.offsetWidth;
            lcReasonPresets.classList.add('is-switching');
        }
    }

    function updateLifecycleRefundSummary() {
        if (!lcReceipt || !lcRefundTotal) return;
        const { lang, t } = getBizT();
        const currency = lcReceipt.currency || currentShop?.currency || 'EUR';
        const lineItems = Array.isArray(lcReceipt.receipt_items) ? lcReceipt.receipt_items : [];

        let totalDelta = 0;
        let allRemainingSelected = true;
        let anySelected = false;
        let selectableCount = 0;

        lineItems.forEach(it => {
            const qty = Math.max(1, parseInt(it.qty, 10) || 1);
            const already = Math.max(0, parseInt(it.refunded_qty, 10) || 0);
            const remaining = Math.max(0, qty - already);
            if (remaining > 0) {
                selectableCount++;
                const selQty = lcSelections.get(String(it.id)) || 0;
                if (selQty > 0) {
                    anySelected = true;
                    totalDelta += calcLineRefundAmount(it, selQty);
                }
                if (selQty < remaining) allRemainingSelected = false;
            }
        });

        totalDelta = Math.round(totalDelta * 100) / 100;
        const gross = parseFloat(lcReceipt.gross_total) || 0;
        const prevRef = parseFloat(lcReceipt.refunded_amount) || 0;
        if (allRemainingSelected && anySelected) {
            totalDelta = Math.max(0, Math.round((gross - prevRef) * 100) / 100);
        }

        lcRefundTotal.textContent = window.formatCurrency(totalDelta, currency, lang);

        if (lcRefundKindBadge) {
            if (!anySelected) {
                lcRefundKindBadge.textContent = '';
                lcRefundKindBadge.classList.remove('is-full');
            } else if (allRemainingSelected) {
                lcRefundKindBadge.textContent = t.lifecycle_kind_full || 'Полный возврат';
                lcRefundKindBadge.classList.add('is-full');
            } else {
                lcRefundKindBadge.textContent = t.lifecycle_kind_partial || 'Частичный возврат';
                lcRefundKindBadge.classList.remove('is-full');
            }
        }

        if (lcSelectAllBtn) {
            const key = (allRemainingSelected && selectableCount > 0) ? 'lifecycle_deselect_all' : 'lifecycle_select_all';
            lcSelectAllBtn.textContent = t[key] || (key === 'lifecycle_deselect_all' ? 'Снять выбор' : 'Выбрать все');
        }
    }

    function renderLifecycleItems() {
        if (!lcReceipt || !lcItemsList) return;
        const { lang, t } = getBizT();
        const currency = lcReceipt.currency || currentShop?.currency || 'EUR';
        const lineItems = Array.isArray(lcReceipt.receipt_items) ? lcReceipt.receipt_items : [];

        lcItemsList.innerHTML = lineItems.map(it => {
            const id = String(it.id || '');
            const qty = Math.max(1, parseInt(it.qty, 10) || 1);
            const already = Math.max(0, parseInt(it.refunded_qty, 10) || 0);
            const remaining = Math.max(0, qty - already);
            const exhausted = remaining <= 0;
            const selQty = exhausted ? 0 : (lcSelections.get(id) || 0);
            const checked = selQty > 0;
            const previewAmt = checked ? calcLineRefundAmount(it, selQty) : calcLineRefundAmount(it, remaining);
            const subText = exhausted
                ? (t.lifecycle_item_returned_badge || 'Возвращено')
                : already > 0
                    ? (t.lifecycle_item_remaining || 'Доступно: {rem} из {qty}').replace('{rem}', String(remaining)).replace('{qty}', String(qty))
                    : `×${qty}`;

            const stepperHtml = (!exhausted && remaining > 1 && checked) ? `
                <div class="lifecycle-qty-stepper" data-item-id="${escapeHtml(id)}">
                    <button type="button" class="lifecycle-qty-btn" data-qty-delta="-1" ${selQty <= 1 ? 'disabled' : ''} aria-label="−">−</button>
                    <span class="lifecycle-qty-val">${selQty}</span>
                    <button type="button" class="lifecycle-qty-btn" data-qty-delta="1" ${selQty >= remaining ? 'disabled' : ''} aria-label="+">+</button>
                </div>` : '';

            return `
                <div class="lifecycle-item-row${checked ? ' is-selected' : ''}${exhausted ? ' is-exhausted' : ''}" data-item-id="${escapeHtml(id)}">
                    <input type="checkbox" class="lifecycle-item-check" data-item-id="${escapeHtml(id)}" ${checked ? 'checked' : ''} ${exhausted ? 'disabled' : ''}>
                    <div class="lifecycle-item-info">
                        <span class="lifecycle-item-name" title="${escapeHtml(it.item_name)}">${escapeHtml(it.item_name)}</span>
                        <span class="lifecycle-item-sub">${escapeHtml(subText)}</span>
                    </div>
                    ${stepperHtml}
                    <span class="lifecycle-item-amount">${exhausted ? '—' : escapeHtml(window.formatCurrency(previewAmt, currency, lang))}</span>
                </div>`;
        }).join('');

        updateLifecycleRefundSummary();
    }

    function updateLifecycleTabUI({ instant = false, animatePresets = false } = {}) {
        if (!lcReceipt) return;
        const { t } = getBizT();
        const lc = getLifecycleStatus(lcReceipt);
        const voidHours = getVoidRemainingHours(lcReceipt);
        const voidAllowed = lc === 'active' && voidHours > 0;

        lcTabBtns.forEach(btn => {
            const act = btn.dataset.lifecycleAction;
            const isActive = act === lcAction;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', String(isActive));
            if (act === 'void') {
                btn.disabled = !voidAllowed;
            }
        });
        lifecycleTabIndicator.update(instant);

        const hideRefund = lcAction !== 'refund';
        if (lcRefundSection) {
            lcRefundSection.classList.toggle('is-hidden', hideRefund);
            lcRefundSection.setAttribute('aria-hidden', String(hideRefund));
            lcRefundSection.inert = hideRefund;
        }

        if (lcVoidNotice) {
            const noticeTarget = lcVoidNoticeWrap || lcVoidNotice;
            if (lcAction === 'void') {
                noticeTarget.classList.remove('is-hidden');
                noticeTarget.setAttribute('aria-hidden', 'false');
                lcVoidNotice.classList.remove('is-warning');
                lcVoidNotice.innerHTML = `<i class="fa-solid fa-clock" aria-hidden="true"></i><span>${escapeHtml((t.lifecycle_void_available || '').replace('{hours}', String(voidHours)))}</span>`;
            } else if (!voidAllowed) {
                noticeTarget.classList.remove('is-hidden');
                noticeTarget.setAttribute('aria-hidden', 'false');
                lcVoidNotice.classList.add('is-warning');
                const msg = lc === 'partially_refunded'
                    ? (t.lifecycle_void_has_refunds || 'По этому чеку уже был частичный возврат — аннулирование недоступно.')
                    : (t.lifecycle_void_expired || 'Прошло более 24 часов — аннулирование недоступно. Оформите возврат.');
                lcVoidNotice.innerHTML = `<i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>${escapeHtml(msg)}</span>`;
            } else {
                noticeTarget.classList.add('is-hidden');
                noticeTarget.setAttribute('aria-hidden', 'true');
            }
        }

        if (lcConfirmLabel && lcConfirmBtn) {
            const icon = lcConfirmBtn.querySelector('i');
            if (lcAction === 'void') {
                lcConfirmLabel.textContent = t.lifecycle_confirm_void || 'Аннулировать чек';
                if (icon) icon.className = 'fa-solid fa-ban';
            } else {
                lcConfirmLabel.textContent = t.lifecycle_confirm_refund || 'Оформить возврат';
                if (icon) icon.className = 'fa-solid fa-rotate-left';
            }
        }

        setLifecycleError('');
        renderLifecyclePresets(animatePresets);
    }

    function openLifecycleModal(receipt) {
        if (!lcModal || !receipt || isReceiptClosed(receipt)) return;
        lcReceipt = receipt;
        lcAction = 'refund';
        lcSelections.clear();
        setLifecycleError('');

        const lineItems = Array.isArray(receipt.receipt_items) ? receipt.receipt_items : [];
        lineItems.forEach(it => {
            const qty = Math.max(1, parseInt(it.qty, 10) || 1);
            const already = Math.max(0, parseInt(it.refunded_qty, 10) || 0);
            const remaining = Math.max(0, qty - already);
            if (remaining > 0 && it.id) {
                lcSelections.set(String(it.id), remaining);
            }
        });

        const receiptNum = receipt.receipt_number ? `#RCP-${receipt.receipt_number}` : `#${String(receipt.id).slice(0, 8).toUpperCase()}`;
        if (lcSubtitle) {
            const contactStr = getCustomerContactSummary(receipt);
            lcSubtitle.textContent = contactStr ? `${receiptNum} · ${contactStr}` : receiptNum;
        }
        if (lcReasonInput) {
            lcReasonInput.value = '';
        }

        renderLifecycleItems();
        updateLifecycleTabUI({ instant: true, animatePresets: false });

        lcModal.classList.remove('is-hidden');
        lcModal.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('modal-open');
        requestAnimationFrame(() => lifecycleTabIndicator.update(true));
    }

    lcTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const nextAction = btn.dataset.lifecycleAction;
            if (nextAction === lcAction) return;
            lcAction = nextAction;
            updateLifecycleTabUI({ instant: false, animatePresets: true });
        });
    });

    lcSelectAllBtn?.addEventListener('click', () => {
        if (!lcReceipt) return;
        const lineItems = Array.isArray(lcReceipt.receipt_items) ? lcReceipt.receipt_items : [];
        let allSelected = true;
        lineItems.forEach(it => {
            const rem = Math.max(0, (parseInt(it.qty, 10) || 1) - (parseInt(it.refunded_qty, 10) || 0));
            if (rem > 0 && (lcSelections.get(String(it.id)) || 0) < rem) allSelected = false;
        });

        lineItems.forEach(it => {
            const rem = Math.max(0, (parseInt(it.qty, 10) || 1) - (parseInt(it.refunded_qty, 10) || 0));
            if (rem <= 0 || !it.id) return;
            if (allSelected) lcSelections.delete(String(it.id));
            else lcSelections.set(String(it.id), rem);
        });
        setLifecycleError('');
        renderLifecycleItems();
    });

    lcItemsList?.addEventListener('change', (e) => {
        const cb = e.target.closest('.lifecycle-item-check');
        if (!cb || !lcReceipt) return;
        const id = cb.dataset.itemId;
        const item = (lcReceipt.receipt_items || []).find(x => String(x.id) === id);
        if (!item) return;
        const rem = Math.max(0, (parseInt(item.qty, 10) || 1) - (parseInt(item.refunded_qty, 10) || 0));
        if (cb.checked && rem > 0) {
            lcSelections.set(id, rem);
        } else {
            lcSelections.delete(id);
        }
        setLifecycleError('');
        renderLifecycleItems();
    });

    lcItemsList?.addEventListener('click', (e) => {
        if (!lcReceipt) return;
        const btn = e.target.closest('.lifecycle-qty-btn');
        if (btn) {
            const stepper = btn.closest('.lifecycle-qty-stepper');
            const id = stepper?.dataset.itemId;
            const delta = parseInt(btn.dataset.qtyDelta, 10) || 0;
            const item = (lcReceipt.receipt_items || []).find(x => String(x.id) === id);
            if (!item) return;
            const rem = Math.max(0, (parseInt(item.qty, 10) || 1) - (parseInt(item.refunded_qty, 10) || 0));
            const cur = lcSelections.get(id) || 1;
            const next = Math.max(1, Math.min(rem, cur + delta));
            lcSelections.set(id, next);
            renderLifecycleItems();
            return;
        }
        if (e.target.closest('.lifecycle-qty-stepper') || e.target.closest('.lifecycle-item-check')) return;
        const row = e.target.closest('.lifecycle-item-row:not(.is-exhausted)');
        const cb = row?.querySelector('.lifecycle-item-check:not(:disabled)');
        if (!cb) return;
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
    });

    lcReasonPresets?.addEventListener('click', (e) => {
        const chip = e.target.closest('.lifecycle-preset-chip');
        if (!chip || !lcReasonInput) return;
        lcReasonInput.value = chip.dataset.preset || '';
        setLifecycleError('');
        renderLifecyclePresets();
    });

    lcReasonInput?.addEventListener('input', () => {
        setLifecycleError('');
        renderLifecyclePresets();
    });

    lcForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!lcReceipt || lcSubmitting || !currentShop) return;

        const { t } = getBizT();
        const reason = (lcReasonInput?.value || '').trim();
        if (!reason) {
            setLifecycleError(t.lifecycle_err_reason_required || 'Укажите причину операции');
            lcReasonInput?.focus();
            return;
        }

        let pItems = null;
        if (lcAction === 'refund') {
            pItems = [];
            (lcReceipt.receipt_items || []).forEach(it => {
                const selQty = lcSelections.get(String(it.id)) || 0;
                if (selQty > 0 && it.id) {
                    pItems.push({ item_id: it.id, qty: selQty });
                }
            });
            if (pItems.length === 0) {
                setLifecycleError(t.lifecycle_err_items_required || 'Выберите хотя бы одну позицию для возврата');
                return;
            }
        }

        lcSubmitting = true;
        if (lcConfirmBtn) {
            lcConfirmBtn.disabled = true;
            const icon = lcConfirmBtn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-circle-notch fa-spin';
        }

        try {
            const { data, error } = await client.rpc('change_receipt_lifecycle', {
                p_receipt_id: lcReceipt.id,
                p_action: lcAction,
                p_reason: reason,
                p_items: pItems,
            });

            if (error) throw error;

            const newStatus = data?.lifecycle_status || (lcAction === 'void' ? 'voided' : 'refunded');
            const toastMsg = newStatus === 'voided'
                ? (t.lifecycle_success_void || 'Чек аннулирован')
                : newStatus === 'partially_refunded'
                    ? (t.lifecycle_success_partial || 'Частичный возврат оформлен')
                    : (t.lifecycle_success_refund || 'Полный возврат оформлен');

            window.showToast(toastMsg, 'success');
            lcSubmitting = false;
            closeLifecycleModal();
            await refreshDashboard(client, currentShop.id, stats, list);
        } catch (err) {
            logError('biz:changeLifecycle', err);
            const rawMsg = String(err?.message || '');
            let userMsg = t.lifecycle_err_generic || 'Не удалось обновить статус чека';
            if (err?.code === 'PGRST202' || err?.code === '42883' || rawMsg.includes('change_receipt_lifecycle')) {
                userMsg = t.lifecycle_err_migration || 'Примените SQL-миграцию в Supabase для включения возвратов и аннулирования.';
            } else if (rawMsg.includes('VOID_WINDOW_EXPIRED')) {
                userMsg = t.lifecycle_err_void_window || 'Срок аннулирования (24 часа) истёк. Оформите возврат.';
            } else if (rawMsg.includes('RECEIPT_ALREADY_CLOSED')) {
                userMsg = t.lifecycle_err_already_closed || 'Чек уже закрыт.';
            }
            setLifecycleError(userMsg);
            window.showToast(userMsg, 'error');
        } finally {
            lcSubmitting = false;
            if (lcConfirmBtn) {
                lcConfirmBtn.disabled = false;
                const { t: t2 } = getBizT();
                const icon = lcConfirmBtn.querySelector('i');
                if (icon) {
                    icon.className = lcAction === 'void' ? 'fa-solid fa-ban' : 'fa-solid fa-rotate-left';
                }
                if (lcConfirmLabel) {
                    lcConfirmLabel.textContent = lcAction === 'void'
                        ? (t2.lifecycle_confirm_void || 'Аннулировать чек')
                        : (t2.lifecycle_confirm_refund || 'Оформить возврат');
                }
            }
        }
    });

    // Filter bar & card action delegation (bound once, survives language switches)
    let filterFadeTimer = null;

    function updateReceiptFilterCounts(receipts) {
        const all = receipts || [];
        const activeCnt = all.filter(r => getLifecycleStatus(r) === 'active').length;
        const closedCnt = all.filter(r => getLifecycleStatus(r) !== 'active').length;
        const setCnt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(val);
        };
        setCnt('filter-count-all', all.length);
        setCnt('filter-count-active', activeCnt);
        setCnt('filter-count-closed', closedCnt);
        receiptFilterIndicator.update(true);
    }

    if (filterBar) {
        filterBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.receipt-filter-btn');
            if (!btn) return;
            const nextFilter = btn.dataset.receiptFilter || 'all';
            if (nextFilter === receiptFilter) return;
            receiptFilter = nextFilter;
            filterBar.querySelectorAll('.receipt-filter-btn').forEach(b => {
                const active = b === btn;
                b.classList.toggle('active', active);
                b.setAttribute('aria-selected', String(active));
            });
            receiptFilterIndicator.update();

            if (filterFadeTimer) clearTimeout(filterFadeTimer);
            releaseReceiptsContainerHeight();
            if (list.grid) {
                list.grid.classList.add('filter-fade-out');
                filterFadeTimer = setTimeout(async () => {
                    await loadReceiptsPage({ append: false, animateRows: true });
                    releaseReceiptsContainerHeight();
                    list.grid?.classList.remove('filter-fade-out');
                    list.grid?.classList.add('filter-fade-in');
                    setTimeout(() => list.grid?.classList.remove('filter-fade-in'), 200);
                }, 90);
            } else {
                loadReceiptsPage({ append: false, animateRows: true });
            }
        });
    }

    // Search input wiring with debounce, height stabilization (no scroll jump), and smooth row enter
    const searchInput = document.getElementById('receipt-search-input');
    const searchClearBtn = document.getElementById('receipt-search-clear');
    const searchResetInlineBtn = document.getElementById('receipt-search-reset-inline');
    const resetFiltersEmptyBtn = document.getElementById('reset-receipt-filters-btn');
    let searchDebounceTimer = null;

    function resetSearchAndFilters(focusSearch = false) {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        if (searchInput) searchInput.value = '';
        receiptSearchQuery = '';
        if (searchClearBtn) searchClearBtn.style.display = 'none';
        if (receiptFilter !== 'all' && filterBar) {
            receiptFilter = 'all';
            filterBar.querySelectorAll('.receipt-filter-btn').forEach(b => {
                const active = b.dataset.receiptFilter === 'all';
                b.classList.toggle('active', active);
                b.setAttribute('aria-selected', String(active));
            });
            receiptFilterIndicator.update();
        }
        releaseReceiptsContainerHeight();
        loadReceiptsPage({ append: false, animateRows: true });
        if (focusSearch && searchInput) searchInput.focus();
    }

    if (searchInput) {
        const executeSearch = (immediate = false) => {
            const nextQuery = searchInput.value || '';
            if (searchClearBtn) {
                searchClearBtn.style.display = nextQuery.length > 0 ? 'inline-flex' : 'none';
            }
            const run = async () => {
                receiptSearchQuery = nextQuery;
                await loadReceiptsPage({ append: false, animateRows: true });
                releaseReceiptsContainerHeight();
            };
            if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
            if (immediate) {
                run();
            } else {
                searchDebounceTimer = setTimeout(run, 280);
            }
        };

        searchInput.addEventListener('input', () => executeSearch(false));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchInput.value) {
                e.preventDefault();
                searchInput.value = '';
                executeSearch(true);
            }
        });

        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', () => {
                searchInput.value = '';
                executeSearch(true);
                searchInput.focus();
            });
        }
    }

    searchResetInlineBtn?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        receiptSearchQuery = '';
        if (searchClearBtn) searchClearBtn.style.display = 'none';
        if (receiptFilter === 'all') releaseReceiptsContainerHeight();
        loadReceiptsPage({ append: false, animateRows: true });
        searchInput?.focus();
    });

    resetFiltersEmptyBtn?.addEventListener('click', () => resetSearchAndFilters(false));

    // Release locked height gracefully if the user scrolls back above the receipts section
    window.addEventListener('scroll', () => {
        if (lockedReceiptsMinHeight <= 0) return;
        if (receiptSearchQuery.trim() || receiptFilter !== 'all') return;
        const container = document.querySelector('.receipts-list-container');
        if (!container) return;
        if (container.getBoundingClientRect().top > 120) {
            releaseReceiptsContainerHeight();
        }
    }, { passive: true });

    // Export dropdown menu wiring
    const exportWrap = document.getElementById('shop-export-wrap');
    const exportTriggerBtn = document.getElementById('export-receipts-btn');
    const exportMenu = document.getElementById('export-receipts-menu');

    function setExportMenuOpen(open) {
        if (!exportMenu || !exportTriggerBtn) return;
        exportMenu.classList.toggle('is-open', open);
        exportTriggerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        exportMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    if (exportTriggerBtn && exportMenu) {
        exportTriggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (exportTriggerBtn.disabled) return;
            const isOpen = exportMenu.classList.contains('is-open');
            setExportMenuOpen(!isOpen);
        });

        document.addEventListener('click', (e) => {
            if (!exportMenu.classList.contains('is-open')) return;
            if (exportWrap && !exportWrap.contains(e.target)) {
                setExportMenuOpen(false);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && exportMenu.classList.contains('is-open')) {
                setExportMenuOpen(false);
                exportTriggerBtn.focus();
            }
        });
    }

    function sanitizeCsvCell(value) {
        let str = value == null ? '' : String(value);
        const isSafeNumber = /^\s*-\d+(\.\d+)?\s*$/.test(str);
        const isSafePhone = /^\s*\+\d[\d\s]+\s*$/.test(str);
        if (/^[\s\u0000-\u0020]*[=+\-@|]/.test(str) && !isSafeNumber && !isSafePhone) {
            str = `'${str}`;
        }
        if (/[",\r\n;]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    function triggerBlobDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 250);
    }

    function getExportContext(rowsOverride) {
        const currentLang = (window.getValuonLang ? window.getValuonLang() : (window.businessCurrentLang || 'en'));
        const bt = window.businessTranslations || {};
        const t = bt[currentLang] || bt.ru || {};
        const payMethodMap = {
            card: t.payment_card || 'Card',
            cash: t.payment_cash || 'Cash',
        };
        const filtered = Array.isArray(rowsOverride) ? rowsOverride : (currentReceiptsList || []);
        const lcLabelMap = {
            active: t.lifecycle_active || (currentLang === 'en' ? 'Active' : 'Активен'),
            partially_refunded: t.lifecycle_partially_refunded || (currentLang === 'en' ? 'Partial Refund' : 'Частичный возврат'),
            refunded: t.lifecycle_refunded || (currentLang === 'en' ? 'Refunded' : 'Возврат'),
            voided: t.lifecycle_voided || (currentLang === 'en' ? 'Voided' : 'Аннулирован'),
        };
        return { currentLang, t, payMethodMap, filtered, lcLabelMap };
    }

    async function loadExportRows() {
        const currentLang = (window.getValuonLang ? window.getValuonLang() : (window.businessCurrentLang || 'en'));
        const bt = window.businessTranslations || {};
        const t = bt[currentLang] || bt.ru || {};
        if (receiptsTotalMatched > currentReceiptsList.length) {
            const tpl = t.exporting_progress || (currentLang === 'en' ? 'Preparing export… ({n})' : 'Подготовка экспорта… ({n})');
            window.showToast(
                tpl.replace('{n}', String(receiptsTotalMatched)),
                'info'
            );
        }
        return await fetchAllReceiptsForExport();
    }

    async function exportFilteredReceiptsXlsx() {
        setExportMenuOpen(false);
        if (isExportingReceipts) return;
        isExportingReceipts = true;
        updateExportMenuState();
        try {
            const allRows = await loadExportRows();
            const { currentLang, t, payMethodMap, filtered, lcLabelMap } = getExportContext(allRows);
            if (filtered.length === 0) {
                window.showToast(t.export_csv_empty || (currentLang === 'en' ? 'No receipts to export' : 'Нет чеков для экспорта'), 'warning');
                return;
            }

            const receiptRows = [];
            const itemRows = [];

            for (const r of filtered) {
                const lc = getLifecycleStatus(r);
                const receiptNum = r.receipt_number ? `#RCP-${r.receipt_number}` : `#${String(r.id).slice(0, 8).toUpperCase()}`;
                const dateIso = toSafeIsoDate(r.purchase_date);
                const binding = r.status === 'verified'
                    ? (t.status_verified_short || 'Linked')
                    : (t.status_pending_short || 'Pending');
                const payRaw = (r.payment_method || '').toLowerCase();
                const payLabel = payMethodMap[payRaw] || r.payment_method || '';
                const lineItems = Array.isArray(r.receipt_items) ? r.receipt_items : [];
                const currency = r.currency || currentShop?.currency || 'EUR';
                const grossVal = Math.round((parseFloat(r.gross_total) || 0) * 100) / 100;
                const vatVal = Math.round((parseFloat(r.vat_amount) || 0) * 100) / 100;
                const netVal = r.net_total != null && Number.isFinite(parseFloat(r.net_total))
                    ? Math.round(parseFloat(r.net_total) * 100) / 100
                    : Math.max(0, Math.round((grossVal - vatVal) * 100) / 100);
                const refundedVal = Math.round((parseFloat(r.refunded_amount) || 0) * 100) / 100;
                const netRevenueVal = Math.round(getNetReceiptRevenue(r) * 100) / 100;
                const totalUnits = lineItems.reduce((sum, it) => sum + Math.max(1, parseInt(it.qty, 10) || 1), 0);

                const phoneExport = r.customer_phone ? formatPhoneDisplay(r.customer_phone) : '';
                receiptRows.push([
                    receiptNum,
                    dateIso,
                    r.customer_email || '',
                    phoneExport,
                    binding,
                    lcLabelMap[lc] || lc,
                    payLabel,
                    r.pos_serial || '',
                    totalUnits,
                    netVal,
                    vatVal,
                    grossVal,
                    refundedVal,
                    netRevenueVal,
                    currency,
                    r.status_reason || '',
                ]);

                for (const it of lineItems) {
                    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
                    const refQty = Math.max(0, parseInt(it.refunded_qty, 10) || 0);
                    const lineGross = Math.round((parseFloat(it.gross_total) || 0) * 100) / 100;
                    const lineVat = Math.round((parseFloat(it.vat_amount) || 0) * 100) / 100;
                    const lineNet = it.net_total != null && Number.isFinite(parseFloat(it.net_total))
                        ? Math.round(parseFloat(it.net_total) * 100) / 100
                        : Math.max(0, Math.round((lineGross - lineVat) * 100) / 100);
                    const unitPrice = it.unit_price != null && Number.isFinite(parseFloat(it.unit_price))
                        ? Math.round(parseFloat(it.unit_price) * 100) / 100
                        : Math.round((lineGross / qty) * 100) / 100;
                    const vatRate = it.vat_rate != null && Number.isFinite(parseFloat(it.vat_rate))
                        ? parseFloat(it.vat_rate)
                        : 0;
                    const discountRate = it.discount_rate != null && Number.isFinite(parseFloat(it.discount_rate))
                        ? parseFloat(it.discount_rate)
                        : 0;
                    const categoryVal = it.category || '';
                    const warrantyMonths = Math.max(0, parseInt(it.warranty_months, 10) || 0);

                    itemRows.push([
                        receiptNum,
                        dateIso,
                        r.customer_email || '',
                        phoneExport,
                        it.item_name || '',
                        categoryVal,
                        qty,
                        refQty,
                        unitPrice,
                        discountRate,
                        vatRate,
                        lineNet,
                        lineVat,
                        lineGross,
                        warrantyMonths,
                        currency,
                        lcLabelMap[lc] || lc,
                    ]);
                }
            }

            const { buildXlsxBlob } = await import('./xlsx-export.js');
            const blob = buildXlsxBlob([
                {
                    name: t.export_sheet_receipts || (currentLang === 'en' ? 'Receipts' : 'Чеки'),
                    columns: [
                        { header: t.csv_col_number || 'Receipt #', minWidth: 16 },
                        { header: t.csv_col_date || 'Date', minWidth: 13 },
                        { header: t.csv_col_email || 'Customer Email', minWidth: 24 },
                        { header: t.csv_col_phone || 'Customer Phone', minWidth: 18 },
                        { header: t.csv_col_binding || 'Binding', minWidth: 14 },
                        { header: t.csv_col_lifecycle || 'Receipt Status', minWidth: 18 },
                        { header: t.csv_col_payment || 'Payment', minWidth: 12 },
                        { header: t.csv_col_register || 'Register', minWidth: 14 },
                        { header: t.csv_col_items_count || 'Items Qty', type: 'int', minWidth: 13 },
                        { header: t.csv_col_net || 'Net', type: 'money', minWidth: 13 },
                        { header: t.csv_col_vat || 'VAT', type: 'money', minWidth: 12 },
                        { header: t.csv_col_gross || 'Gross Total', type: 'money', minWidth: 14 },
                        { header: t.csv_col_refunded || 'Refunded', type: 'money', minWidth: 13 },
                        { header: t.csv_col_net_revenue || 'Net Revenue', type: 'money', minWidth: 14 },
                        { header: t.csv_col_currency || 'Currency', minWidth: 10 },
                        { header: t.csv_col_reason || 'Reason', minWidth: 22 },
                    ],
                    rows: receiptRows,
                },
                {
                    name: t.export_sheet_items || (currentLang === 'en' ? 'Line Items' : 'Позиции'),
                    columns: [
                        { header: t.csv_col_number || 'Receipt #', minWidth: 16 },
                        { header: t.csv_col_date || 'Date', minWidth: 13 },
                        { header: t.csv_col_email || 'Customer Email', minWidth: 24 },
                        { header: t.csv_col_phone || 'Customer Phone', minWidth: 18 },
                        { header: t.xlsx_item_col_name || 'Product', minWidth: 26 },
                        { header: t.xlsx_item_col_category || (currentLang === 'en' ? 'Category' : 'Категория'), minWidth: 16 },
                        { header: t.xlsx_item_col_qty || 'Qty', type: 'int', minWidth: 10 },
                        { header: t.xlsx_item_col_refunded_qty || 'Refunded Qty', type: 'int', minWidth: 14 },
                        { header: t.xlsx_item_col_unit_price || 'Unit Price', type: 'money', minWidth: 13 },
                        { header: t.xlsx_item_col_discount_rate || (currentLang === 'en' ? 'Discount %' : 'Скидка %'), type: 'number', minWidth: 12 },
                        { header: t.xlsx_item_col_vat_rate || 'VAT %', type: 'number', minWidth: 10 },
                        { header: t.csv_col_net || 'Net', type: 'money', minWidth: 13 },
                        { header: t.csv_col_vat || 'VAT', type: 'money', minWidth: 12 },
                        { header: t.csv_col_gross || 'Gross Total', type: 'money', minWidth: 14 },
                        { header: t.xlsx_item_col_warranty || 'Warranty (mo.)', type: 'int', minWidth: 15 },
                        { header: t.csv_col_currency || 'Currency', minWidth: 10 },
                        { header: t.csv_col_lifecycle || 'Receipt Status', minWidth: 18 },
                    ],
                    rows: itemRows,
                },
            ]);

            const todayStr = new Date().toISOString().slice(0, 10);
            triggerBlobDownload(blob, `valuon-receipts-${todayStr}.xlsx`);
            const doneTpl = t.export_xlsx_done || (currentLang === 'en' ? 'Excel downloaded ({n} receipts)' : 'Excel-файл скачан (чеков: {n})');
            window.showToast(doneTpl.replace('{n}', String(filtered.length)), 'success');
        } catch (err) {
            logError('biz:exportXlsx', err);
            const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
            window.showToast(lang === 'en' ? 'Export failed' : 'Ошибка экспорта', 'error');
        } finally {
            isExportingReceipts = false;
            updateExportMenuState();
        }
    }

    async function exportFilteredReceiptsCsv() {
        setExportMenuOpen(false);
        if (isExportingReceipts) return;
        isExportingReceipts = true;
        updateExportMenuState();
        try {
            const allRows = await loadExportRows();
            const { currentLang, t, payMethodMap, filtered, lcLabelMap } = getExportContext(allRows);
            if (filtered.length === 0) {
                window.showToast(t.export_csv_empty || (currentLang === 'en' ? 'No receipts to export' : 'Нет чеков для экспорта'), 'warning');
                return;
            }

            const headers = [
                t.csv_col_number || 'Receipt #',
                t.csv_col_date || 'Date',
                t.csv_col_email || 'Customer Email',
                t.csv_col_phone || 'Customer Phone',
                t.csv_col_binding || 'Binding',
                t.csv_col_lifecycle || 'Receipt Status',
                t.csv_col_payment || 'Payment',
                t.csv_col_register || 'Register',
                t.csv_col_items || 'Items',
                t.csv_col_currency || 'Currency',
                t.csv_col_net || 'Net',
                t.csv_col_vat || 'VAT',
                t.csv_col_gross || 'Gross Total',
                t.csv_col_refunded || 'Refunded',
                t.csv_col_net_revenue || 'Net Revenue',
                t.csv_col_reason || 'Reason',
            ];

            // Use semicolon (;) delimiter for European/Russian Excel compatibility,
            // and join line items with " | " so no internal delimiter splits columns.
            const DELIM = ';';
            const rows = filtered.map(r => {
                const lc = getLifecycleStatus(r);
                const receiptNum = r.receipt_number ? `#RCP-${r.receipt_number}` : `#${String(r.id).slice(0, 8).toUpperCase()}`;
                const dateIso = toSafeIsoDate(r.purchase_date);
                const binding = r.status === 'verified'
                    ? (t.status_verified_short || 'Linked')
                    : (t.status_pending_short || 'Pending');
                const payRaw = (r.payment_method || '').toLowerCase();
                const payLabel = payMethodMap[payRaw] || r.payment_method || '';
                const itemsSummary = Array.isArray(r.receipt_items)
                    ? r.receipt_items
                        .map(it => {
                            const base = `${String(it.item_name || '').replace(/[;|\r\n]+/g, ' ').trim()} x${Math.max(1, parseInt(it.qty, 10) || 1)}`;
                            const disc = parseFloat(it.discount_rate) || 0;
                            const cat = it.category ? ` [${String(it.category).replace(/[;|\r\n]+/g, ' ').trim()}]` : '';
                            return `${base}${disc > 0 ? ` (-${disc}%)` : ''}${cat}`;
                        })
                        .join(' | ')
                    : '';
                const grossNum = parseFloat(r.gross_total) || 0;
                const vatNum = parseFloat(r.vat_amount) || 0;
                const netNum = r.net_total != null && Number.isFinite(parseFloat(r.net_total))
                    ? parseFloat(r.net_total)
                    : Math.max(0, grossNum - vatNum);
                const refundedNum = parseFloat(r.refunded_amount) || 0;
                const netRevenueNum = getNetReceiptRevenue(r);
                const phoneExport = r.customer_phone ? formatPhoneDisplay(r.customer_phone) : '';

                return [
                    receiptNum,
                    dateIso,
                    r.customer_email || '',
                    phoneExport,
                    binding,
                    lcLabelMap[lc] || lc,
                    payLabel,
                    r.pos_serial || '',
                    itemsSummary,
                    r.currency || currentShop?.currency || 'EUR',
                    netNum.toFixed(2),
                    vatNum.toFixed(2),
                    grossNum.toFixed(2),
                    refundedNum.toFixed(2),
                    netRevenueNum.toFixed(2),
                    r.status_reason || '',
                ].map(sanitizeCsvCell).join(DELIM);
            });

            const csvContent = '\uFEFF' + [headers.map(sanitizeCsvCell).join(DELIM), ...rows].join('\r\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const todayStr = new Date().toISOString().slice(0, 10);
            triggerBlobDownload(blob, `valuon-receipts-${todayStr}.csv`);

            const doneTpl = t.export_csv_done || (currentLang === 'en' ? 'Exported {n} receipts' : 'Экспортировано чеков: {n}');
            window.showToast(doneTpl.replace('{n}', String(filtered.length)), 'success');
        } catch (err) {
            logError('biz:exportCsv', err);
            const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
            window.showToast(lang === 'en' ? 'Export failed' : 'Ошибка экспорта', 'error');
        } finally {
            isExportingReceipts = false;
            updateExportMenuState();
        }
    }

    document.getElementById('export-receipts-xlsx-btn')?.addEventListener('click', exportFilteredReceiptsXlsx);
    document.getElementById('export-receipts-csv-btn')?.addEventListener('click', exportFilteredReceiptsCsv);

    function toggleLedgerRow(summaryEl) {
        const itemEl = summaryEl?.closest('.receipt-ledger-item');
        if (!itemEl) return;
        const receiptId = itemEl.dataset.receiptId;
        const willExpand = !itemEl.classList.contains('is-expanded');
        itemEl.classList.toggle('is-expanded', willExpand);
        summaryEl.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
        const drawerEl = itemEl.querySelector('.ledger-drawer');
        if (drawerEl) drawerEl.setAttribute('aria-hidden', willExpand ? 'false' : 'true');
        if (receiptId) {
            if (willExpand) expandedReceiptIds.add(String(receiptId));
            else expandedReceiptIds.delete(String(receiptId));
        }
    }

    if (list.grid) {
        list.grid.addEventListener('click', async (e) => {
            const copyBtn = e.target.closest('.btn-copy-receipt-num');
            if (copyBtn) {
                e.stopPropagation();
                const num = copyBtn.dataset.receiptNum || '';
                if (!num) return;
                const currentLang = (window.getValuonLang ? window.getValuonLang() : (window.businessCurrentLang || 'en'));
                const t = window.businessTranslations?.[currentLang] || window.businessTranslations?.ru || {};
                try {
                    await navigator.clipboard.writeText(num);
                    morphCopyButton(copyBtn, 1800);
                    const textEl = copyBtn.querySelector('span');
                    const prevText = textEl?.textContent || '';
                    if (textEl) textEl.textContent = t.ledger_action_copied || (currentLang === 'en' ? 'Copied' : 'Скопировано');
                    const toastTpl = t.ledger_copied_toast || (currentLang === 'en' ? 'Receipt {num} copied' : 'Номер чека {num} скопирован');
                    window.showToast(toastTpl.replace('{num}', num), 'success');
                    setTimeout(() => {
                        if (textEl) textEl.textContent = prevText || t.ledger_action_copy || 'Копировать №';
                    }, 1800);
                } catch (err) {
                    logError('biz:copyReceiptNum', err);
                }
                return;
            }

            const manageBtn = e.target.closest('.btn-manage-lifecycle');
            if (manageBtn) {
                const receiptId = manageBtn.dataset.id;
                const receipt = currentReceiptsList.find(r => String(r.id) === String(receiptId));
                if (receipt) openLifecycleModal(receipt);
                return;
            }

            const shareBtn = e.target.closest('.btn-share-receipt');
            if (shareBtn) {
                e.stopPropagation();
                const receiptId = shareBtn.dataset.id;
                const receipt = currentReceiptsList.find(r => String(r.id) === String(receiptId));
                if (receipt) await shareReceiptViaSystemOrCopy(receipt);
                return;
            }

            const dlBtn = e.target.closest('.btn-download-receipt');
            if (dlBtn) {
                e.stopPropagation();
                const receiptId = dlBtn.dataset.id;
                const receipt = currentReceiptsList.find(r => String(r.id) === String(receiptId));
                if (receipt && currentShop) {
                    await handleDownloadBizPdf(dlBtn, receipt, currentShop);
                } else {
                    const errLang = (window.getValuonLang ? window.getValuonLang() : 'en');
                    window.showToast(errLang === 'en' ? 'Receipt data not found' : 'Не удалось найти данные чека', 'error');
                }
                return;
            }

            const summaryEl = e.target.closest('.receipt-ledger-summary');
            if (summaryEl) {
                toggleLedgerRow(summaryEl);
            }
        });

        list.grid.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            if (e.target.closest('button, a, input')) return;
            const summaryEl = e.target.closest('.receipt-ledger-summary');
            if (summaryEl) {
                e.preventDefault();
                toggleLedgerRow(summaryEl);
            }
        });
    }

    function getBrowserTimeZone() {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch (_) {
            return 'UTC';
        }
    }

    async function fetchShopAnalytics(sbClient, shopId, period) {
        if (!sbClient || !shopId) return null;
        try {
            const { data, error } = await sbClient.rpc('get_shop_analytics', {
                p_shop_id: shopId,
                p_period: period || 'week',
                p_tz: getBrowserTimeZone(),
            });
            if (error || !data) return null;
            serverAnalyticsByPeriod[period || 'week'] = data;
            return data;
        } catch (err) {
            logError('biz:getShopAnalytics', err);
            return null;
        }
    }

    function applyServerReceiptFilters(query, { filter = 'all', search = '', hasPhoneCol = true, hasLifecycleCol = true } = {}) {
        let q = query;
        if (hasLifecycleCol) {
            if (filter === 'active') {
                q = q.or('lifecycle_status.eq.active,lifecycle_status.is.null');
            } else if (filter === 'closed') {
                q = q.in('lifecycle_status', ['partially_refunded', 'refunded', 'voided']);
            }
        }
        const trimmed = String(search || '').trim();
        if (trimmed) {
            const escaped = escapeIlikePattern(trimmed);
            const quotedPattern = quotePostgrestLiteral(`*${escaped}*`);
            const clauses = [
                `customer_email.ilike.${quotedPattern}`,
                `pos_serial.ilike.${quotedPattern}`,
            ];
            if (hasPhoneCol) {
                clauses.push(`customer_phone.ilike.${quotedPattern}`);
                const phoneDigits = trimmed.replace(/\D/g, '');
                if (phoneDigits.length >= 3 && phoneDigits !== trimmed) {
                    clauses.push(`customer_phone.ilike.${quotePostgrestLiteral(`*${phoneDigits}*`)}`);
                }
            }
            const rcpDigits = trimmed.replace(/^#?(?:rcp-?)?/i, '').trim();
            if (/^\d+$/.test(rcpDigits)) {
                clauses.push(`receipt_number.eq.${rcpDigits}`);
            }
            q = q.or(clauses.join(','));
        }
        return q;
    }

    async function fetchReceiptsPage(sbClient, shopId, { offset = 0, limit = RECEIPTS_PAGE_SIZE, filter = receiptFilter, search = receiptSearchQuery } = {}) {
        const runQuery = (selectCols, hasPhoneCol, hasLifecycleCol) => {
            let q = sbClient.from('business_receipts')
                .select(selectCols, { count: 'exact' })
                .eq('shop_id', shopId)
                .order('created_at', { ascending: false })
                .order('sort_order', { referencedTable: 'receipt_items', ascending: true })
                .range(offset, offset + limit - 1);
            q = applyServerReceiptFilters(q, { filter, search, hasPhoneCol, hasLifecycleCol });
            return q;
        };

        let res = await runQuery(RECEIPTS_SELECT_FULL, true, true);
        if (res.error && res.error.code === '42703') {
            res = await runQuery(RECEIPTS_SELECT_NOPHONE, false, true);
        }
        if (res.error && res.error.code === '42703') {
            res = await runQuery(RECEIPTS_SELECT_LEGACY, false, false);
        }
        if (res.error) throw res.error;
        return {
            rows: res.data || [],
            total: typeof res.count === 'number' ? res.count : (res.data || []).length,
        };
    }

    function updateLoadMoreUI() {
        const wrap = document.getElementById('receipts-load-more-wrap');
        const meta = document.getElementById('receipts-load-more-meta');
        const btn = document.getElementById('receipts-load-more-btn');
        if (!wrap) return;

        const shown = currentReceiptsList.length;
        const total = Math.max(shown, receiptsTotalMatched);
        const hasMore = shown > 0 && shown < total;

        if (!hasMore) {
            wrap.classList.add('is-hidden');
            return;
        }

        const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
        const t = window.businessTranslations?.[lang] || window.businessTranslations?.en || {};
        const tpl = t.load_more_meta || (lang === 'en' ? 'Showing {shown} of {total}' : 'Показано {shown} из {total}');
        if (meta) {
            meta.textContent = tpl.replace('{shown}', String(shown)).replace('{total}', String(total));
        }
        if (btn) {
            btn.disabled = isLoadingMoreReceipts;
            const span = btn.querySelector('span');
            if (span) {
                span.textContent = isLoadingMoreReceipts
                    ? (lang === 'en' ? 'Loading…' : 'Загрузка…')
                    : (t.load_more_receipts || (lang === 'en' ? 'Load more' : 'Загрузить ещё'));
            }
        }
        wrap.classList.remove('is-hidden');
    }

    async function loadReceiptsPage({ append = false, animateRows = true } = {}) {
        if (!currentClient || !currentShop?.id) return;
        const seq = ++receiptsQuerySeq;
        const offset = append ? currentReceiptsList.length : 0;

        if (append) {
            isLoadingMoreReceipts = true;
            updateLoadMoreUI();
        }

        try {
            const { rows, total } = await fetchReceiptsPage(currentClient, currentShop.id, {
                offset,
                limit: RECEIPTS_PAGE_SIZE,
                filter: receiptFilter,
                search: receiptSearchQuery,
            });
            if (seq !== receiptsQuerySeq) return;

            receiptsTotalMatched = total;
            if (append) {
                const existingIds = new Set(currentReceiptsList.map(r => String(r.id)));
                const fresh = rows.filter(r => !existingIds.has(String(r.id)));
                currentReceiptsList = currentReceiptsList.concat(fresh);
            } else {
                currentReceiptsList = rows;
            }

            const emptyMsg = document.getElementById('no-receipts-msg');
            if (receiptsAllCount === 0 && currentReceiptsList.length === 0 && receiptFilter === 'all' && !receiptSearchQuery.trim()) {
                list.grid.innerHTML = '';
                list.grid.style.display = 'none';
                if (emptyMsg) emptyMsg.style.display = 'block';
                updateLoadMoreUI();
                updateExportMenuState();
                return;
            }
            if (emptyMsg) emptyMsg.style.display = 'none';

            renderReceiptCards(list, currentReceiptsList, { animateRows: !append && animateRows });
            window.applyBusinessTranslations?.();
            updateLoadMoreUI();
            updateExportMenuState();
        } catch (err) {
            if (seq !== receiptsQuerySeq) return;
            logError('biz:loadReceiptsPage', err);
            const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
            window.showToast(lang === 'en' ? 'Failed to load receipts' : 'Не удалось загрузить чеки', 'error');
        } finally {
            if (append) {
                isLoadingMoreReceipts = false;
                updateLoadMoreUI();
            }
        }
    }

    async function fetchAllReceiptsForExport() {
        if (!currentClient || !currentShop?.id) return [];
        if (currentReceiptsList.length >= receiptsTotalMatched) {
            return currentReceiptsList.slice();
        }
        const BATCH = 1000;
        const MAX_ROWS = 50000;
        const all = [];
        let offset = 0;
        while (offset < MAX_ROWS) {
            const { rows } = await fetchReceiptsPage(currentClient, currentShop.id, {
                offset,
                limit: BATCH,
                filter: receiptFilter,
                search: receiptSearchQuery,
            });
            if (!rows.length) break;
            all.push(...rows);
            if (rows.length < BATCH) break;
            offset += BATCH;
        }
        return all;
    }

    document.getElementById('receipts-load-more-btn')?.addEventListener('click', () => {
        if (!isLoadingMoreReceipts) loadReceiptsPage({ append: true, animateRows: false });
    });

    async function refreshDashboard(client, shopId, statsEl, listEl) {
        if (!shopId) return;

        listEl.grid.style.display = '';
        listEl.grid.innerHTML = '<div class="loading-spinner" style="text-align:center;padding:2rem;"><i class="fa-solid fa-circle-notch fa-spin fa-2x"></i></div>';

        const emptyMsg = document.getElementById('no-receipts-msg');
        if (emptyMsg) emptyMsg.style.display = 'none';
        const filteredEmptyMsg = document.getElementById('no-filtered-receipts-msg');
        if (filteredEmptyMsg) filteredEmptyMsg.style.display = 'none';
        document.getElementById('receipts-load-more-wrap')?.classList.add('is-hidden');

        serverAnalyticsByPeriod = {};
        const seq = ++receiptsQuerySeq;

        try {
            const [analytics, pageResult] = await Promise.all([
                fetchShopAnalytics(client, shopId, chartPeriod),
                fetchReceiptsPage(client, shopId, {
                    offset: 0,
                    limit: RECEIPTS_PAGE_SIZE,
                    filter: receiptFilter,
                    search: receiptSearchQuery,
                }),
            ]);
            if (seq !== receiptsQuerySeq) return;

            const receipts = pageResult.rows || [];
            receiptsTotalMatched = pageResult.total;
            currentReceiptsList = receipts;

            const statsLang = (window.getValuonLang ? window.getValuonLang() : 'en');
            const statsCurrency = currentShop?.currency || 'EUR';

            if (analytics) {
                const totalCount = Number(analytics.total_count) || 0;
                const pendingCount = Number(analytics.pending_count) || 0;
                const totalRevenue = Number(analytics.total_revenue) || 0;
                const avgReceipt = Number(analytics.avg_receipt) || 0;
                receiptsAllCount = totalCount;

                if (statsEl.total) { statsEl.total.textContent = '0'; window.animateCount(statsEl.total, totalCount); }
                if (statsEl.pending) { statsEl.pending.textContent = '0'; window.animateCount(statsEl.pending, pendingCount); }
                if (statsEl.revenue) {
                    statsEl.revenue.textContent = window.formatCurrency(0, statsCurrency, statsLang);
                    window.animateAmount(statsEl.revenue, totalRevenue, null, statsCurrency);
                }
                if (statsEl.avgReceipt) {
                    statsEl.avgReceipt.textContent = window.formatCurrency(0, statsCurrency, statsLang);
                    window.animateAmount(statsEl.avgReceipt, avgReceipt, null, statsCurrency);
                }

                const setCnt = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(n); };
                setCnt('filter-count-all', totalCount);
                setCnt('filter-count-active', Number(analytics.active_filter_count) || 0);
                setCnt('filter-count-closed', Number(analytics.closed_filter_count) || 0);
                receiptFilterIndicator.update(true);
            } else {
                const activeReceipts = receipts.filter(r => !isReceiptClosed(r));
                const pendingCount = activeReceipts.filter(r => r.status === 'pending').length;
                receiptsAllCount = pageResult.total;
                const netRevenues = activeReceipts.map(r => getNetReceiptRevenue(r)).filter(v => Number.isFinite(v));
                const totalRevenue = Math.round(netRevenues.reduce((s, v) => s + v, 0) * 100) / 100;
                const avgReceipt = netRevenues.length > 0 ? totalRevenue / netRevenues.length : 0;

                if (statsEl.total) { statsEl.total.textContent = '0'; window.animateCount(statsEl.total, receiptsAllCount); }
                if (statsEl.pending) { statsEl.pending.textContent = '0'; window.animateCount(statsEl.pending, pendingCount); }
                if (statsEl.revenue) {
                    statsEl.revenue.textContent = window.formatCurrency(0, statsCurrency, statsLang);
                    window.animateAmount(statsEl.revenue, totalRevenue, null, statsCurrency);
                }
                if (statsEl.avgReceipt) {
                    statsEl.avgReceipt.textContent = window.formatCurrency(0, statsCurrency, statsLang);
                    window.animateAmount(statsEl.avgReceipt, avgReceipt, null, statsCurrency);
                }
                updateReceiptFilterCounts(receipts);
            }

            if (receiptsAllCount === 0 && receipts.length === 0) {
                listEl.grid.innerHTML = '';
                listEl.grid.style.display = 'none';
                if (emptyMsg) emptyMsg.style.display = 'block';
                updateLoadMoreUI();
                updateExportMenuState();
                updateChart();
                return;
            }

            if (emptyMsg) emptyMsg.style.display = 'none';

            renderReceiptCards(listEl, receipts);
            window.applyBusinessTranslations?.();
            receiptFilterIndicator.update(true);
            updateLoadMoreUI();
            updateExportMenuState();
            updateChart();
        } catch (e) {
            logError('biz:refreshDashboard', e);
            const refreshLang = (window.getValuonLang ? window.getValuonLang() : 'en');
            window.showToast(refreshLang === 'en' ? 'Failed to update data. Try again later.' : 'Не удалось обновить данные. Попробуйте позже.', 'error');
            if (statsEl.total) statsEl.total.textContent = '—';
            if (statsEl.pending) statsEl.pending.textContent = '—';
            if (statsEl.revenue) statsEl.revenue.textContent = '—';
            if (statsEl.avgReceipt) statsEl.avgReceipt.textContent = '—';
            listEl.grid.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:2rem;">${refreshLang === 'en' ? 'Data load error' : 'Ошибка загрузки данных'}</p>`;
        }
    }


    const themeBtn = document.getElementById('theme-toggle-btn');
    let themeTimer = null;
    const scheduleChartRedraw = () => {
        if (themeTimer) clearTimeout(themeTimer);
        themeTimer = setTimeout(updateChart, 150);
    };
    const syncBizThemeIcon = () => {
        const icon = themeBtn?.querySelector('i');
        if (!icon) return;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    };
    if (themeBtn) {
        themeBtn.addEventListener('click', scheduleChartRedraw);
    }
    window.addEventListener('themeChange', () => {
        syncBizThemeIcon();
        scheduleChartRedraw();
    });
    window.addEventListener('storage', (e) => {
        if (e.key === 'valuon-theme') {
            if (e.newValue === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
            else document.documentElement.removeAttribute('data-theme');
            syncBizThemeIcon();
            scheduleChartRedraw();
        }
    });

    const firstReceiptBtn = document.getElementById('create-first-receipt-btn');
    if (firstReceiptBtn) {
        firstReceiptBtn.addEventListener('click', () => {
            const openBtn = document.getElementById('open-create-receipt-btn');
            if (openBtn) openBtn.click();
        });
    }

    function getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function getCalendarPeriod(period, now) {
        const d = new Date(now);
        if (period === 'week') {
            const mon = getMonday(d);
            const sun = new Date(mon);
            sun.setDate(sun.getDate() + 6);
            const prevMon = new Date(mon);
            prevMon.setDate(prevMon.getDate() - 7);
            const prevSun = new Date(prevMon);
            prevSun.setDate(prevSun.getDate() + 6);
            return { currentStart: mon, currentEnd: sun, previousStart: prevMon, previousEnd: prevSun };
        }
        if (period === 'month') {
            const year = d.getFullYear();
            const month = d.getMonth();
            const curStart = new Date(year, month, 1);
            const curEnd = new Date(year, month + 1, 0);
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            const prevStart = new Date(prevYear, prevMonth, 1);
            const prevEnd = new Date(prevYear, prevMonth + 1, 0);
            return { currentStart: curStart, currentEnd: curEnd, previousStart: prevStart, previousEnd: prevEnd };
        }
        const year = d.getFullYear();
        return {
            currentStart: new Date(year, 0, 1),
            currentEnd: new Date(year, 11, 31),
            previousStart: new Date(year - 1, 0, 1),
            previousEnd: new Date(year - 1, 11, 31),
        };
    }

    function buildDayMap(startDate, endDate, lang) {
        const groups = {};
        const daysMap = {};
        const cur = new Date(startDate);
        while (cur <= endDate) {
            const y = cur.getFullYear();
            const m = String(cur.getMonth() + 1).padStart(2, '0');
            const dd = String(cur.getDate()).padStart(2, '0');
            const key = `${y}-${m}-${dd}`;
            const label = cur.toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', {
                day: 'numeric', month: 'short'
            });
            groups[key] = { label, count: 0, total: 0 };
            daysMap[key] = true;
            cur.setDate(cur.getDate() + 1);
        }
        return { groups, daysMap };
    }

    function toLocalDateParts(rawDate) {
        if (!rawDate) return null;
        const str = String(rawDate).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            const [y, m, d] = str.split('-').map(Number);
            return { y, m, d };
        }
        const dt = new Date(str);
        if (Number.isNaN(dt.getTime())) return null;
        return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
    }

    function toLocalBucketKey(rawDate, mode) {
        const p = toLocalDateParts(rawDate);
        if (!p) return null;
        const mm = String(p.m).padStart(2, '0');
        if (mode === 'month') return `${p.y}-${mm}`;
        const dd = String(p.d).padStart(2, '0');
        return `${p.y}-${mm}-${dd}`;
    }

    function buildMonthMap(year, lang) {
        const groups = {};
        const keysMap = {};
        const locale = lang === 'en' ? 'en-US' : 'ru-RU';
        for (let m = 0; m < 12; m++) {
            const d = new Date(year, m, 1);
            const key = `${year}-${String(m + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString(locale, { month: 'short' });
            groups[key] = { label, count: 0, total: 0 };
            keysMap[key] = true;
        }
        return { groups, daysMap: keysMap };
    }

    function fillReceiptCounts(receipts, groups, daysMap, mode = 'day') {
        receipts.forEach(r => {
            if (!r.purchase_date || isReceiptClosed(r)) return;
            const key = toLocalBucketKey(r.purchase_date, mode);
            if (key && daysMap[key]) {
                groups[key].count++;
            }
        });
    }

    function fillRevenueTotals(receipts, groups, daysMap, mode = 'day') {
        receipts.forEach(r => {
            if (!r.purchase_date || isReceiptClosed(r)) return;
            const key = toLocalBucketKey(r.purchase_date, mode);
            if (key && daysMap[key]) {
                const net = getNetReceiptRevenue(r);
                if (Number.isFinite(net)) {
                    groups[key].total += net;
                }
            }
        });
    }

    function extractSeries(groups, field) {
        const labels = [];
        const data = [];
        const sortedKeys = Object.keys(groups).sort();
        sortedKeys.forEach(k => {
            labels.push(groups[k].label);
            const g = groups[k];
            data.push(field === 'revenue' ? parseFloat(g.total.toFixed(2)) : g.count);
        });
        return { labels, data };
    }

    function formatCompactCurrency(value) {
        const amount = Number.isFinite(value) ? value : 0;
        const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
        const code = currentShop?.currency || 'EUR';
        try {
            return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ru-RU', {
                style: 'currency', currency: code, notation: 'compact', maximumFractionDigits: 1
            }).format(amount);
        } catch (e) {
            return window.formatCurrency(amount, code, lang);
        }
    }

    function computeChange(currentData, previousData) {
        const curSum = currentData.reduce((s, v) => s + (v || 0), 0);
        const prevSum = previousData.reduce((s, v) => s + (v || 0), 0);
        const abs = curSum - prevSum;
        const pct = prevSum > 0 ? ((curSum - prevSum) / prevSum) * 100 : (curSum > 0 ? 100 : 0);
        return { absolute: parseFloat(abs.toFixed(2)), percent: parseFloat(pct.toFixed(1)) };
    }

    function updateChangeBadge(badgeId, change) {
        const badge = document.getElementById(badgeId);
        if (!badge) return;
        const abs = change.absolute;
        const pct = change.percent;
        if (abs === 0 && pct === 0) {
            badge.textContent = '—';
            badge.className = 'chart-change-badge';
            return;
        }
        const arrow = abs >= 0 ? '▲' : '▼';
        const cls = abs >= 0 ? 'up' : 'down';
        badge.textContent = `${arrow} ${pct >= 0 ? '+' : ''}${pct}%`;
        badge.className = `chart-change-badge ${cls}`;
    }

    function updatePeriodLabel(elementId, period) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
        const cal = getCalendarPeriod(period, new Date());
        const fmt = { day: 'numeric', month: 'short' };
        const loc = lang === 'en' ? 'en-US' : 'ru-RU';
        const start = cal.currentStart.toLocaleDateString(loc, fmt);
        const end = cal.currentEnd.toLocaleDateString(loc, fmt);
        const year = cal.currentEnd.getFullYear();
        el.textContent = `${start} — ${end} ${year}`;
    }

    function getChartColors(isDark) {
        return {
            gridColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            textColor: isDark ? '#888' : '#64748b',
            tooltipBg: isDark ? '#1a1a1a' : '#fff',
            tooltipTitle: isDark ? '#fff' : '#0f172a',
            tooltipBody: isDark ? '#ccc' : '#64748b',
            tooltipBorder: isDark ? '#333' : '#e2e8f0',
        };
    }

    function getChartContext(canvasId, wrapperSelector) {
        let wrapper = document.querySelector(wrapperSelector);
        if (!wrapper) return null;
        let canvas = document.getElementById(canvasId);
        if (!canvas || !wrapper.contains(canvas)) {
            wrapper.innerHTML = `<canvas id="${canvasId}"></canvas>`;
        }
        canvas = document.getElementById(canvasId);
        wrapper = canvas.parentElement;
        return { canvas, wrapper, ctx: canvas.getContext('2d') };
    }

    function showChartEmpty(canvasId, wrapperSelector, chartInstanceRef, emptyText) {
        const ref = chartInstanceRef();
        if (ref) { ref.destroy(); }
        const wrapper = document.querySelector(wrapperSelector);
        if (!wrapper) return;
        const canvas = document.getElementById(canvasId);
        if (!canvas || !wrapper.contains(canvas)) {
            wrapper.innerHTML = `<div class="chart-empty">${emptyText}</div>`;
        } else {
            const parent = canvas.parentElement;
            if (parent && parent.classList.contains('chart-wrapper')) {
                parent.innerHTML = `<div class="chart-empty">${emptyText}</div>`;
            }
        }
    }

    function aggregateDualPeriod(field, receipts, period) {
        const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
        const now = new Date();
        const cal = getCalendarPeriod(period, now);
        const isYear = period === 'year';

        const serverAnalytics = serverAnalyticsByPeriod?.[period];
        if (serverAnalytics && typeof serverAnalytics === 'object') {
            const cur = isYear
                ? buildMonthMap(now.getFullYear(), lang)
                : buildDayMap(cal.currentStart, cal.currentEnd, lang);

            const buckets = serverAnalytics.buckets || {};
            Object.keys(buckets).forEach(key => {
                if (cur.groups[key]) {
                    const b = buckets[key] || {};
                    cur.groups[key].count = Number(b.count) || 0;
                    cur.groups[key].total = Number(b.total) || 0;
                }
            });

            const curSeries = extractSeries(cur.groups, field);
            const curSum = curSeries.data.reduce((s, v) => s + (v || 0), 0);
            const prevSum = field === 'revenue'
                ? (Number(serverAnalytics.prev_total) || 0)
                : (Number(serverAnalytics.prev_count) || 0);
            const abs = curSum - prevSum;
            const pct = prevSum > 0 ? ((curSum - prevSum) / prevSum) * 100 : (curSum > 0 ? 100 : 0);
            const change = {
                absolute: parseFloat(abs.toFixed(2)),
                percent: parseFloat(pct.toFixed(1)),
            };
            return { labels: curSeries.labels, data: curSeries.data, change };
        }

        if (!receipts || receipts.length === 0) {
            return { labels: [], data: [], change: { absolute: 0, percent: 0 } };
        }

        const cur = isYear
            ? buildMonthMap(now.getFullYear(), lang)
            : buildDayMap(cal.currentStart, cal.currentEnd, lang);
        const prev = isYear
            ? buildMonthMap(now.getFullYear() - 1, lang)
            : buildDayMap(cal.previousStart, cal.previousEnd, lang);

        const bucketMode = isYear ? 'month' : 'day';
        const fillFn = field === 'revenue' ? fillRevenueTotals : fillReceiptCounts;
        fillFn(receipts, cur.groups, cur.daysMap, bucketMode);
        fillFn(receipts, prev.groups, prev.daysMap, bucketMode);

        const curSeries = extractSeries(cur.groups, field);
        const prevSeries = extractSeries(prev.groups, field);

        let limit;
        if (isYear) {
            limit = Math.min(now.getMonth() + 1, curSeries.data.length);
        } else {
            const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
            const startUtc = Date.UTC(cal.currentStart.getFullYear(), cal.currentStart.getMonth(), cal.currentStart.getDate());
            const daysElapsed = Math.max(0, Math.round((todayUtc - startUtc) / 86400000) + 1);
            limit = Math.min(daysElapsed, curSeries.data.length);
        }
        const curData = limit > 0 ? curSeries.data.slice(0, limit) : [];
        const prevData = limit > 0 ? prevSeries.data.slice(0, limit) : [];
        const change = computeChange(curData, prevData);

        return { labels: curSeries.labels, data: curSeries.data, change };
    }

    function buildReceiptChartDef(aggregated, t, lang, colors, period) {
        const opts = buildCommonChartOptions(period, colors, t, lang);
        opts.plugins.tooltip.callbacks = {
            label: function (context) {
                const val = context.parsed.y;
                const label = t.chart_label_receipts || (lang === 'en' ? 'Sales' : 'Продажи');
                return label + ': ' + (Number.isFinite(val) ? val : '0');
            }
        };
        return {
            type: 'bar',
            data: {
                labels: aggregated.labels,
                datasets: [{
                    label: t.chart_label_receipts || (lang === 'en' ? 'Sales count' : 'Количество продаж'),
                    data: aggregated.data,
                    backgroundColor: 'rgba(59, 130, 246, 0.65)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 6,
                    barPercentage: 0.5,
                    categoryPercentage: 0.7,
                }]
            },
            options: opts,
            plugins: [crosshairPlugin]
        };
    }

    function buildRevenueChartDef(aggregated, t, lang, colors, period, isDark) {
        const opts = buildCommonChartOptions(period, colors, t, lang);
        opts.scales.y.ticks.callback = function (v) { return formatCompactCurrency(v); };
        opts.plugins.tooltip.callbacks = {
            label: function (context) {
                const val = context.parsed.y;
                return window.formatCurrency(Number.isFinite(val) ? val : 0, currentShop?.currency || 'EUR', lang);
            }
        };

        const datasets = [{
            label: t.revenue_chart_label || (lang === 'en' ? 'Revenue' : 'Выручка'),
            data: aggregated.data,
            borderColor: '#10b981',
            backgroundColor: function (context) {
                const chart = context.chart;
                const { ctx, chartArea } = chart;
                if (!chartArea) return 'rgba(16, 185, 129, 0.15)';
                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                gradient.addColorStop(0, 'rgba(16, 185, 129, 0.28)');
                gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
                return gradient;
            },
            borderWidth: 2.5,
            pointRadius: 2.5,
            pointHoverRadius: 5,
            pointBackgroundColor: '#10b981',
            pointBorderColor: isDark ? '#1a1a1a' : '#fff',
            pointBorderWidth: 2,
            tension: 0.3,
            fill: true,
        }];

        return {
            type: 'line',
            data: { labels: aggregated.labels, datasets },
            options: opts,
            plugins: [{
                id: 'revenueFill',
                beforeDraw: function (chart) {
                    const ctx = chart.ctx;
                    const chartArea = chart.chartArea;
                    if (!chartArea) return;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
                    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
                    chart.data.datasets[0].backgroundColor = gradient;
                }
            }, crosshairPlugin]
        };
    }

    function buildCommonChartOptions(period, colors, t, lang) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeOutQuart' },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: colors.tooltipBg,
                    titleColor: colors.tooltipTitle,
                    bodyColor: colors.tooltipBody,
                    borderColor: colors.tooltipBorder,
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    titleFont: { weight: '600', size: 13 },
                    bodyFont: { size: 12 },
                    displayColors: true,
                    boxPadding: 4,
                },
            },
            scales: {
                x: {
                    grid: { color: colors.gridColor, drawBorder: false },
                    ticks: {
                        color: colors.textColor,
                        font: { size: 11 },
                        maxRotation: period === 'year' ? 45 : 0,
                        maxTicksLimit: period === 'year' ? 18 : undefined,
                    },
                },
                y: {
                    beginAtZero: true,
                    grid: { color: colors.gridColor, drawBorder: false },
                    ticks: { color: colors.textColor, font: { size: 11 } },
                },
            },
        };
    }

    function renderReceiptChart(period) {
        if (!window.Chart) return;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        const context = getChartContext('receipts-chart', '.chart-box:first-child .chart-wrapper');
        if (!context) return;

        const lang = (window.getValuonLang ? window.getValuonLang() : (window.businessCurrentLang || 'en'));
        const bt = window.businessTranslations || {};
        const t = bt[lang] || bt.ru || {};
        const colors = getChartColors(isDark);

        const aggregated = aggregateDualPeriod('count', currentReceiptsList || [], period);
        const hasData = aggregated.data.some(v => v > 0);

        if (!hasData) {
            showChartEmpty('receipts-chart', '.chart-box:first-child .chart-wrapper',
                () => receiptsChartInstance, t['chart_empty_' + period] || t.chart_empty || 'Нет данных для графика');
            receiptsChartInstance = null;
            updateChangeBadge('change-receipts', aggregated.change);
            return;
        }

        if (receiptsChartInstance) { receiptsChartInstance.destroy(); receiptsChartInstance = null; }

        const chartDef = buildReceiptChartDef(aggregated, t, lang, colors, period);
        chartDef.options.scales.y.ticks.stepSize = 1;
        chartDef.options.scales.y.ticks.precision = 0;

        try {
            receiptsChartInstance = new Chart(context.ctx, chartDef);
        } catch (e) {
            logError('biz:receiptsChart', e);
        }
        updateChangeBadge('change-receipts', aggregated.change);
    }

    function renderRevenueChart(period) {
        if (!window.Chart) return;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        const context = getChartContext('revenue-chart', '.chart-box:last-child .chart-wrapper');
        if (!context) return;

        const lang = (window.getValuonLang ? window.getValuonLang() : (window.businessCurrentLang || 'en'));
        const bt = window.businessTranslations || {};
        const t = bt[lang] || bt.ru || {};
        const colors = getChartColors(isDark);

        const aggregated = aggregateDualPeriod('revenue', currentReceiptsList || [], period);
        const hasData = aggregated.data.some(v => v > 0);

        if (!hasData) {
            showChartEmpty('revenue-chart', '.chart-box:last-child .chart-wrapper',
                () => revenueChartInstance, t['chart_empty_' + period] || t.chart_empty || 'Нет данных для графика');
            revenueChartInstance = null;
            updateChangeBadge('change-revenue', aggregated.change);
            return;
        }

        if (revenueChartInstance) { revenueChartInstance.destroy(); revenueChartInstance = null; }

        const chartDef = buildRevenueChartDef(aggregated, t, lang, colors, period, isDark);
        try {
            revenueChartInstance = new Chart(context.ctx, chartDef);
        } catch (e) {
            logError('biz:revenueChart', e);
        }
        updateChangeBadge('change-revenue', aggregated.change);
    }

    function updateChart() {
        updatePeriodLabel('analytics-period', chartPeriod);
        renderReceiptChart(chartPeriod);
        renderRevenueChart(chartPeriod);
    }


    const chartControlsEl = document.querySelector('.chart-controls');
    const chartPeriodIndicatorEl = document.getElementById('chart-period-indicator');
    const chartPeriodIndicator = createSegmentedIndicator(chartControlsEl, chartPeriodIndicatorEl, {
        itemSelector: '.chart-period-btn',
        activeClass: 'active'
    });

    const periodBtns = document.querySelectorAll('.chart-period-btn');
    periodBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (btn.dataset.period === chartPeriod && btn.classList.contains('active')) return;
            periodBtns.forEach(b => {
                const isActive = b === btn;
                b.classList.toggle('active', isActive);
                b.setAttribute('aria-selected', String(isActive));
            });
            chartPeriodIndicator.update(false);
            const nextPeriod = btn.dataset.period;
            chartPeriod = nextPeriod;
            if (currentClient && currentShop?.id && !serverAnalyticsByPeriod[nextPeriod]) {
                await fetchShopAnalytics(currentClient, currentShop.id, nextPeriod);
                if (chartPeriod !== nextPeriod) return;
            }
            updateChart();
        });
    });

    window.addEventListener('business-lang-changed', () => {
        refreshItemCategorySelects();
        if (!currentShop) return;
        updateShopInfo(currentShop);
        renderTerminalsWidget();
        renderCatalogWidget();
        refreshProductCategorySelect();
        if (terminalsModal && !terminalsModal.classList.contains('is-hidden')) {
            renderTerminalsList();
        }
        if (catalogModal && !catalogModal.classList.contains('is-hidden')) {
            renderCatalogList();
        }
        if (catalogPickerModal && !catalogPickerModal.classList.contains('is-hidden')) {
            renderCatalogPickerList();
        }
        const curLang = (window.getValuonLang ? window.getValuonLang() : 'en');
        const curCurrency = currentShop?.currency || 'EUR';
        if (stats.revenue && stats.revenue.dataset.amountValue != null) {
            stats.revenue.textContent = window.formatCurrency(Number(stats.revenue.dataset.amountValue) || 0, curCurrency, curLang);
        }
        if (stats.avgReceipt && stats.avgReceipt.dataset.amountValue != null) {
            stats.avgReceipt.textContent = window.formatCurrency(Number(stats.avgReceipt.dataset.amountValue) || 0, curCurrency, curLang);
        }
        if (currentReceiptsList && currentReceiptsList.length > 0) {
            renderReceiptCards(list, currentReceiptsList, { animateRows: false });
        } else {
            updateExportMenuState();
        }
        updateLoadMoreUI();
        syncDraftButton();
        requestAnimationFrame(() => {
            receiptFilterIndicator.update(true);
            chartPeriodIndicator.update(true);
            contactModeIndicator.update(true);
        });
        if (lcReceipt && lcModal && !lcModal.classList.contains('is-hidden')) {
            renderLifecycleItems();
            updateLifecycleTabUI({ instant: true, animatePresets: false });
        }
        setTimeout(updateChart, 50);
    });
}

function renderShopCountrySelect() {
    const select = document.getElementById('shop-country');
    if (!select) return;
    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    renderCountryOptions(select, lang);
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
}

function renderShopCurrencySelect() {
    const select = document.getElementById('shop-currency');
    if (!select) return;
    const lang = (window.getValuonLang ? window.getValuonLang() : 'en');
    window.renderCurrencyOptions(select, lang);
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
}

renderShopCountrySelect();
renderShopCurrencySelect();
window.addEventListener('business-lang-changed', renderShopCountrySelect);
window.addEventListener('business-lang-changed', renderShopCurrencySelect);
document.addEventListener('DOMContentLoaded', () => {
    renderShopCountrySelect();
    renderShopCurrencySelect();
    if (typeof window.applyBusinessTranslations === 'function') window.applyBusinessTranslations();
    document.querySelector('.bottom-nav-item.active')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.scrollY > 10) window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

initBusinessPanel().catch(e => logError('init:bizPanel', e));