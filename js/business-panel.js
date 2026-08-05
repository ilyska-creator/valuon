import { requireAuth } from './dashboard-auth.js';
import { downloadReceiptPDF } from './receipt-generator.js';
import Ed25519Signer, { buildSignaturePayload } from './crypto-signature.js';
import { escapeHtml, logError } from './security.js';
import { attachModalA11y } from './modal-a11y.js';

let currentClient = null;
let currentUser = null;
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

    function renderReceiptCards(gridEl, receiptsList) {
        const currentLang = localStorage.getItem('valuon-lang') || window.businessCurrentLang || 'ru';
        const bt = window.businessTranslations || {};
        const warrantySuffix = bt[currentLang]?.warranty_suffix || 'мес.';
        const payMethodMap = {
            card: bt[currentLang]?.payment_card || 'Card',
            cash: bt[currentLang]?.payment_cash || 'Cash',
        };

        gridEl.grid.innerHTML = receiptsList.map(r => {

            const isVerified = r.status === 'verified';
            const statusClass = isVerified ? 'active' : 'warning';
            const statusKey = isVerified ? 'status_verified' : 'status_pending';
            const dateStr = new Date(r.purchase_date).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US');

            const lineItems = Array.isArray(r.receipt_items) ? r.receipt_items : [];
            const receiptNum = r.receipt_number ? `#RCP-${r.receipt_number}` : `#${String(r.id).slice(0, 8).toUpperCase()}`;
            const itemsCount = lineItems.length;
            const payMethodVal = r.payment_method ? r.payment_method.toLowerCase() : '';
            const payMethod = payMethodMap[payMethodVal] || r.payment_method || '—';

            const itemsHtml = itemsCount > 0 ? `
                <div class="receipt-card-items">
                    ${itemsCount === 1
                    ? `<div class="receipt-card-item single">
                               <span class="item-name">${escapeHtml(lineItems[0].item_name)}</span>
                               <span class="item-qty">×${lineItems[0].qty}</span>
                               <span class="item-warranty">${lineItems[0].warranty_months ? `${lineItems[0].warranty_months} ${warrantySuffix}` : ''}</span>
                           </div>`
                    : `<ul class="receipt-card-items-list">${lineItems.map(it =>
                        `<li><span class="item-name">${escapeHtml(it.item_name)}</span> <span class="item-qty">×${it.qty}</span>${it.warranty_months ? ` <span class="item-warranty">${it.warranty_months} ${warrantySuffix}</span>` : ''}</li>`
                    ).join('')}</ul>`
                }
                </div>` : '';

            return `
        <div class="item-card status-${r.status}" data-receipt-id="${r.id}" data-receipt-status="${r.status}" data-receipt-date="${r.purchase_date}">
            <div class="item-header">
                <div class="item-icon"><i class="fa-solid fa-receipt"></i></div>
                <span class="item-status-badge ${statusClass}" data-i18n="${statusKey}">${bt[currentLang]?.[statusKey] || ''}</span>
            </div>
            <div class="item-body">
                <h3 class="item-title" title="${escapeHtml(receiptNum)}">${escapeHtml(receiptNum)}</h3>
                <div class="item-brand">
                    <i class="fa-regular fa-envelope"></i> ${escapeHtml(r.customer_email)}
                </div>
                <div class="item-tags">
                    <span class="tag"><i class="fa-solid fa-tag"></i> $${Number.isFinite(parseFloat(r.gross_total)) ? parseFloat(r.gross_total).toFixed(2) : '0.00'}</span>
                    <span class="tag"><i class="fa-solid fa-calendar-days"></i> <span class="receipt-date">${escapeHtml(dateStr)}</span></span>
                    <span class="tag"><i class="fa-solid fa-credit-card"></i> ${escapeHtml(payMethod)}</span>
                    ${itemsCount > 1 ? `<span class="tag"><i class="fa-solid fa-boxes-stacked"></i> ${itemsCount}</span>` : ''}
                </div>

                ${itemsHtml}

                <div class="item-actions">
                    <button class="btn-action download btn-download-receipt" data-id="${r.id}" data-i18n-title="download_receipt_title">
                        <i class="fa-solid fa-download"></i> <span data-i18n="download_btn"></span>
                    </button>
                    <button class="btn-action delete btn-delete-receipt" data-id="${r.id}" data-i18n-title="delete_btn_tooltip">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>`;
        }).join('');
    }

    const auth = await requireAuth();
    if (!auth) return;

    const { user, client } = auth;
    currentUser = user;
    currentClient = client;

    const cachedShop = sessionStorage.getItem('current_shop');
    if (cachedShop) {
        try {
            currentShop = JSON.parse(cachedShop);
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
    const emailStatusBadge = document.getElementById('customer-status-badge');
    const autocompleteEl = document.getElementById('customer-autocomplete');
    const modalBody = document.getElementById('receipt-modal-body');
    const successScreen = document.getElementById('receipt-success-screen');
    const submitBtn = document.getElementById('issue-receipt-submit-btn');
    const submitLabelEl = document.getElementById('issue-receipt-submit-label');

    const DRAFT_KEY = 'biz-receipt-draft';
    let issuingClose = false;
    let guardVisible = false;
    let baselineDate = '';
    let lastIssuedReceipt = null;
    let customerHistory = null;
    let customerHistoryPromise = null;
    const customerStatusCache = new Map();
    let emailCheckTimer = null;
    let emailCheckToken = 0;

    function fmtMoney(v) {
        return '$' + v.toFixed(2);
    }

    function pluralRu(n, one, few, many) {
        const m10 = n % 10, m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return one;
        if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
        return many;
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
            email: fd.querySelector('[name="customer_email"]').value.trim(),
            payment: fd.querySelector('[name="payment_method"]').value || 'card',
            purchase_date: fd.querySelector('[name="purchase_date"]').value || '',
            items
        };
    }

    function draftEquals(a, b) {
        if ((a.email || '') !== (b.email || '')) return false;
        if ((a.payment || 'card') !== (b.payment || 'card')) return false;
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
        const saved = readDraft();
        if (saved) return !draftEquals(saved, d);
        return !!(
            d.email ||
            d.payment !== 'card' ||
            (d.purchase_date && d.purchase_date !== baselineDate) ||
            d.items.length > 0
        );
    }

    function readDraft() {
        try {
            const raw = sessionStorage.getItem(DRAFT_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function clearDraft() {
        try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { }
    }

    function saveDraft() {
        try {
            const d = collectFormData();
            if (!draftHasContent(d)) {
                sessionStorage.removeItem(DRAFT_KEY);
                return 'empty';
            }
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
            return 'saved';
        } catch (e) {
            return 'error';
        }
    }

    function draftHasContent(d) {
        if (!d) return false;
        if (d.email) return true;
        if (d.payment && d.payment !== 'card') return true;
        if (d.purchase_date && d.purchase_date !== defaultDateString()) return true;
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
        if (d.email) {
            forms.receipt.querySelector('[name="customer_email"]').value = d.email;
        }
        if (d.payment) {
            forms.receipt.querySelector('[name="payment_method"]').value = d.payment;
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
                row.querySelector('[data-field="warranty_months"]').value = it.warranty_months ?? '';
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

    function addItemRow(focusName) {
        if (!itemsList || !itemTemplate) return;
        const node = itemTemplate.content.firstElementChild.cloneNode(true);
        itemsList.appendChild(node);
        updateRemoveButtonsState();
        renumberRows();
        updateTotalPreview();
        if (focusName) {
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
        itemsList.innerHTML = '';
        addItemRow();
        renumberRows();
    }

    function readItemRows() {
        if (!itemsList) return [];
        return [...itemsList.querySelectorAll('[data-item-row]')].map((row, index) => {
            const itemName = row.querySelector('[data-field="item_name"]').value.trim();
            const qty = parseFloat(row.querySelector('[data-field="qty"]').value) || 0;
            const unitPrice = parseFloat(row.querySelector('[data-field="price"]').value) || 0;
            let vatRate = parseFloat(row.querySelector('[data-field="vat_rate"]').value);
            if (isNaN(vatRate) || vatRate < 0) vatRate = 0;
            let warrantyMonths = parseInt(row.querySelector('[data-field="warranty_months"]').value, 10);
            if (isNaN(warrantyMonths) || warrantyMonths < 1) warrantyMonths = 0;
            let discount = parseFloat(row.querySelector('[data-field="discount"]').value);
            if (isNaN(discount) || discount < 0) discount = 0;
            if (discount > 100) discount = 100;
            const category = (row.querySelector('[data-field="category"]').value || '').trim();

            const baseTotal = qty * unitPrice;
            const discountAmount = baseTotal * (discount / 100);
            const netTotal = baseTotal - discountAmount;
            const vatAmount = netTotal * (vatRate / 100);
            const grossTotal = netTotal + vatAmount;

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

        if (itemsList) {
            itemsList.querySelectorAll('[data-item-row]').forEach((row) => {
                const sub = row.querySelector('[data-row-subtotal]');
                if (!sub) return;
                const qty = parseFloat(row.querySelector('[data-field="qty"]').value) || 0;
                const price = parseFloat(row.querySelector('[data-field="price"]').value) || 0;
                const disc = parseFloat(row.querySelector('[data-field="discount"]').value) || 0;
                const val = qty * price * (1 - (disc > 100 ? 100 : disc < 0 ? 0 : disc) / 100);
                const str = fmtMoney(val);
                if (sub.textContent !== str) {
                    sub.textContent = str;
                    sub.classList.remove('pop');
                    void sub.offsetWidth;
                    sub.classList.add('pop');
                }
            });
        }

        if (totalDetailEl) {
            const filled = items.filter((it) => it.itemName || it.unitPrice > 0);
            const positions = filled.length;
            const totalQty = items.reduce((s, it) => s + it.qty, 0);
            const vat = items.reduce((s, it) => s + it.vatAmount, 0);
            const discTotal = items.reduce((s, it) => s + it.discountAmount, 0);
            const gj = localStorage.getItem('valuon-lang') || 'ru';
            const t = window.businessTranslations?.[gj] || {};
            const word = t.units
                ? pluralRu(positions, t.units.one, t.units.few, t.units.many)
                : (gj === 'en'
                    ? (positions === 1 ? 'item' : 'items')
                    : pluralRu(positions, 'позиция', 'позиции', 'позиций'));
            const qWord = t.qty_word || (gj === 'en' ? 'pcs' : 'шт.');
            const vatWord = t.vat_word || (gj === 'en' ? 'VAT:' : 'НДС:');
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
    addItemBtn?.addEventListener('click', () => addItemRow(true));
    itemsList?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const row = e.target.closest('[data-item-row]');
        if (!row) return;
        e.preventDefault();
        addItemRow();
        const rows = itemsList.querySelectorAll('[data-item-row]');
        const next = rows[rows.length - 1];
        const nameInput = next?.querySelector('[data-field="item_name"]');
        if (nameInput) nameInput.focus();
    });
    itemsList?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-item');
        if (!btn) return;
        const row = btn.closest('[data-item-row]');
        if (!row || row.classList.contains('is-removing')) return;
        if (itemsList.querySelectorAll('[data-item-row]').length <= 1) return;

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
        return localStorage.getItem('valuon-lang') || 'ru';
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

    function validateEmailField(showError) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const value = emailInput?.value.trim() || '';
        const t = bizT();
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

    function validateItemRow(row, showError) {
        if (!row) return true;
        const errorEl = row.querySelector('[data-item-error]');
        const nameInput = row.querySelector('[data-field="item_name"]');
        const qtyInput = row.querySelector('[data-field="qty"]');
        const t = bizT();
        const name = nameInput?.value.trim() || '';
        const qty = parseFloat(qtyInput?.value) || 0;
        let message = '';
        if (!name) {
            message = t.error_item_name || (bizLang() === 'en' ? 'Enter a product name' : 'Укажите название товара');
        } else if (qty <= 0) {
            message = t.error_item_qty || (bizLang() === 'en' ? 'Quantity must be at least 1' : 'Количество должно быть не меньше 1');
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
        validateEmailField(true);
        setTimeout(hideAutocomplete, 120);
    });
    emailInput?.addEventListener('input', () => {
        if (emailGroup?.classList.contains('is-invalid')) validateEmailField(true);
        scheduleCustomerLookup();
        renderAutocomplete();
    });
    emailInput?.addEventListener('focus', () => {
        // Классический приём против автозаполнения браузера: поле стартует как
        // readonly, поэтому браузер не показывает свою подсказку по фокусу,
        // а сразу после focus мы снимаем readonly — ввод остаётся обычным.
        emailInput.removeAttribute('readonly');
        renderAutocomplete();
    });
    emailInput?.addEventListener('mousedown', () => {
        if (emailInput.hasAttribute('readonly')) emailInput.removeAttribute('readonly');
    });

    itemsList?.addEventListener('focusout', (e) => {
        const row = e.target.closest?.('[data-item-row]');
        if (row) validateItemRow(row, true);
    });
    itemsList?.addEventListener('input', (e) => {
        const row = e.target.closest?.('[data-item-row]');
        if (row && row.classList.contains('is-invalid')) validateItemRow(row, true);
        updateSubmitLabel();
    });

    // --- Автокомплит клиента ---------------------------------------

    async function loadCustomerHistory() {
        if (!currentShop) return [];
        if (customerHistory) return customerHistory;
        if (customerHistoryPromise) return customerHistoryPromise;
        customerHistoryPromise = client
            .from('business_receipts')
            .select('customer_email, status')
            .eq('shop_id', currentShop.id)
            .order('created_at', { ascending: false })
            .limit(200)
            .then(({ data, error }) => {
                if (error || !data) {
                    customerHistory = [];
                    return customerHistory;
                }
                const seen = new Map();
                data.forEach((r) => {
                    if (r.customer_email && !seen.has(r.customer_email)) {
                        seen.set(r.customer_email, r.status);
                    }
                });
                customerHistory = [...seen.entries()].map(([email, status]) => ({ email, status }));
                return customerHistory;
            })
            .catch(() => { customerHistory = []; return customerHistory; });
        return customerHistoryPromise;
    }

    function hideAutocomplete() {
        if (!autocompleteEl) return;
        autocompleteEl.classList.add('is-hidden');
        autocompleteEl.innerHTML = '';
    }

    async function renderAutocomplete() {
        if (!autocompleteEl || !emailInput) return;
        const query = emailInput.value.trim().toLowerCase();
        if (!query) { hideAutocomplete(); return; }
        const history = await loadCustomerHistory();
        if (emailInput.value.trim().toLowerCase() !== query) return;
        const matches = (history || [])
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

    autocompleteEl?.addEventListener('mousedown', (e) => {
        const item = e.target.closest('[data-email]');
        if (!item || !emailInput) return;
        e.preventDefault();
        emailInput.value = item.dataset.email;
        hideAutocomplete();
        validateEmailField(false);
        scheduleCustomerLookup(0);
        emailInput.focus();
    });

    document.addEventListener('click', (e) => {
        if (!autocompleteEl || autocompleteEl.classList.contains('is-hidden')) return;
        if (e.target === emailInput || autocompleteEl.contains(e.target)) return;
        hideAutocomplete();
    });

    function setCustomerStatusBadge(state) {
        if (!emailStatusBadge) return;
        const t = bizT();
        if (state === 'checking') {
            emailStatusBadge.className = 'customer-status-badge checking';
            emailStatusBadge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        } else if (state === 'verified') {
            emailStatusBadge.className = 'customer-status-badge verified';
            emailStatusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${escapeHtml(t.status_verified_short || (bizLang() === 'en' ? 'Registered' : 'Зарегистрирован'))}</span>`;
        } else if (state === 'new') {
            emailStatusBadge.className = 'customer-status-badge new';
            emailStatusBadge.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${escapeHtml(t.status_new_short || (bizLang() === 'en' ? 'New client' : 'Новый клиент'))}</span>`;
        } else {
            emailStatusBadge.className = 'customer-status-badge is-hidden';
            emailStatusBadge.innerHTML = '';
            return;
        }
        emailStatusBadge.classList.remove('is-hidden');
    }

    function scheduleCustomerLookup(delay = 500) {
        clearTimeout(emailCheckTimer);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const value = emailInput?.value.trim().toLowerCase() || '';
        if (!emailRegex.test(value)) {
            setCustomerStatusBadge(null);
            return;
        }
        if (customerStatusCache.has(value)) {
            setCustomerStatusBadge(customerStatusCache.get(value) ? 'verified' : 'new');
            return;
        }
        setCustomerStatusBadge('checking');
        const token = ++emailCheckToken;
        emailCheckTimer = setTimeout(async () => {
            try {
                const res = await client.rpc('check_profile_exists', { p_email: value });
                if (token !== emailCheckToken) return;
                if (res.error) { setCustomerStatusBadge(null); return; }
                customerStatusCache.set(value, !!res.data);
                setCustomerStatusBadge(res.data ? 'verified' : 'new');
            } catch (e) {
                if (token === emailCheckToken) setCustomerStatusBadge(null);
            }
        }, delay);
    }

    // --- Динамическая сумма на кнопке отправки ----------------------

    function updateSubmitLabel() {
        if (!submitLabelEl) return;
        const t = bizT();
        const base = t.issue_receipt_submit || (bizLang() === 'en' ? 'Issue Receipt' : 'Выписать чек');
        const gross = readItemRows().reduce((sum, it) => sum + it.grossTotal, 0);
        submitLabelEl.textContent = gross > 0 ? `${base} · ${fmtMoney(gross)}` : base;
    }

    // --- Экран успеха -------------------------------------------------

    function showSuccessScreen(receiptData) {
        lastIssuedReceipt = receiptData;
        const t = bizT();
        const numEl = document.getElementById('receipt-success-number');
        const emailEl = document.getElementById('receipt-success-email');
        const statusEl = document.getElementById('receipt-success-status');
        const totalEl = document.getElementById('receipt-success-total');
        if (numEl) numEl.textContent = receiptData.receipt_number ? `#RCP-${receiptData.receipt_number}` : `#${String(receiptData.id).slice(0, 8).toUpperCase()}`;
        if (emailEl) emailEl.textContent = receiptData.customer_email || '';
        if (statusEl) {
            statusEl.textContent = receiptData.status === 'verified'
                ? (t.status_verified || (bizLang() === 'en' ? 'Linked to Customer' : 'Привязан к клиенту'))
                : (t.status_pending || (bizLang() === 'en' ? 'Awaiting Registration' : 'Ожидает регистрации'));
            statusEl.className = 'receipt-success-status-value ' + (receiptData.status === 'verified' ? 'status-ok' : 'status-wait');
        }
        if (totalEl) totalEl.textContent = fmtMoney(receiptData.gross_total || 0);

        if (modalBody) modalBody.classList.add('is-hidden');
        successScreen?.classList.remove('is-hidden');
        successScreen?.classList.remove('is-visible');
        if (successScreen) {
            // Форсируем reflow, чтобы анимация появления гарантированно
            // проигрывалась заново при каждом показе экрана успеха.
            void successScreen.offsetWidth;
            successScreen.classList.add('is-visible');
        }
        successScreen?.querySelector('#success-download-btn')?.focus();
    }

    function hideSuccessScreen() {
        successScreen?.classList.add('is-hidden');
        successScreen?.classList.remove('is-visible');
        modalBody?.classList.remove('is-hidden');
    }

    document.getElementById('success-download-btn')?.addEventListener('click', async () => {
        if (!lastIssuedReceipt || !currentShop) return;
        await downloadReceiptPDF(lastIssuedReceipt, currentShop);
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

        try {
            hideSuccessScreen();
            clearDraft();
            clearAllValidationState();
            forms.receipt?.reset();
            resetItemRows();
            setCustomerStatusBadge(null);
            emailInput?.setAttribute('readonly', '');
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
        emailInput?.focus();
    });
    document.getElementById('success-done-btn')?.addEventListener('click', () => {
        hideSuccessScreen();
        forceClose();
    });

    document.addEventListener('valuon:lang-applied', () => {
        updateSubmitLabel();
        if (modal.el && !modal.el.classList.contains('is-hidden')) {
            const activeEmail = emailInput?.value.trim().toLowerCase();
            if (activeEmail && customerStatusCache.has(activeEmail)) {
                setCustomerStatusBadge(customerStatusCache.get(activeEmail) ? 'verified' : 'new');
            }
        }
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
        const uiLang = localStorage.getItem('valuon-lang') || 'ru';

        if (nameEl) nameEl.textContent = shop.shop_name || 'Без названия';
        if (vatEl) vatEl.textContent = shop.tax_id || '—';
        if (addrEl) addrEl.textContent = shop.address || '—';
        if (countryEl) {
            const flag = window.countryFlag(shop.country);
            countryEl.textContent = shop.country
                ? (flag ? flag + ' ' + countryName(shop.country, uiLang) : countryName(shop.country, uiLang))
                : '—';
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

    // Registration form logo preview
    const regLogoInput = document.getElementById('reg-logo-input');
    const logoDropZone = document.getElementById('logo-drop-zone');
    const logoDropContent = document.getElementById('logo-drop-content');
    const logoDropPreview = document.getElementById('logo-drop-preview');
    const logoDropRemove = document.getElementById('logo-drop-remove');
    const logoPreviewImg = logoDropPreview?.querySelector('img');

    function getLogoLang() {
        const lang = localStorage.getItem('valuon-lang') || 'ru';
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

    try {
        const { data: shop, error } = await client
            .from('shops')
            .select('id, shop_name, tax_id, address, country, logo_path, public_key, owner_id')
            .eq('owner_id', user.id)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            const loadLang = localStorage.getItem('valuon-lang') || 'ru';
            window.showToast(loadLang === 'en' ? 'Failed to load shop data. Check your connection.' : 'Не удалось загрузить данные магазина. Проверьте подключение.', 'error');

            if (currentShop) {
                updateShopInfo(currentShop);
                renderView(views.dashboard);
                await refreshDashboard(client, currentShop.id, stats, list);
            } else if (views.shop) {
                renderView(views.shop);
            }
            return;
        }

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
            await refreshDashboard(client, shop.id, stats, list);
        } else {
            renderView(views.dashboard);
        }
    } catch (e) {
        logError('biz:loadShop', e);
        if (currentShop) {
            updateShopInfo(currentShop);
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
        forms.shop.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');

            if (btn.disabled) return;
            btn.disabled = true;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Создание...';

            try {
                const createLang = localStorage.getItem('valuon-lang') || 'ru';

                if (!Ed25519Signer.isSupported()) {
                    window.showToast(createLang === 'en' ? 'Your browser does not support Ed25519. Please use Chrome 137+, Firefox 129+, or Safari 17+.' : 'Ваш браузер не поддерживает Ed25519. Пожалуйста, используйте Chrome 137+, Firefox 129+ или Safari 17+.', 'error');
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                    return;
                }

                const fd = new FormData(e.target);

                // Upload logo if selected (before keygen, so user waits once)
                let logoPath = null;
                const logoFile = fd.get('logo');
                if (logoFile && logoFile.size && logoFile.size > 0) {
                    if (logoFile.size > 2 * 1024 * 1024) {
                        window.showToast(createLang === 'en' ? 'File too large. Maximum 2 MB.' : 'Файл слишком большой. Максимум 2 МБ.', 'error');
                        btn.disabled = false;
                        btn.innerHTML = originalHTML;
                        return;
                    }
                    if (!['image/png', 'image/jpeg'].includes(logoFile.type)) {
                        window.showToast(createLang === 'en' ? 'Only PNG and JPG are allowed.' : 'Только PNG и JPG.', 'error');
                        btn.disabled = false;
                        btn.innerHTML = originalHTML;
                        return;
                    }
                }

                const signer = new Ed25519Signer();
                const keyPair = await signer.generateKeyPair();
                const publicKeyBase64 = await signer.exportPublicKey();
                const privateKeyBase64 = await signer.exportPrivateKey();

                const { error } = await client.from('shops').insert([{
                    owner_id: currentUser.id,
                    shop_name: fd.get('shop_name'),
                    tax_id: fd.get('tax_id'),
                    address: fd.get('address'),
                    country: fd.get('country') || null,
                    public_key: publicKeyBase64,
                    private_key: privateKeyBase64
                }]);

                if (error) {
                    const createLang = localStorage.getItem('valuon-lang') || 'ru';
                    const createMsg = error.code === '23505'
                        ? (createLang === 'en' ? 'Shop already exists' : 'Магазин уже существует')
                        : (createLang === 'en' ? 'Creation error' : 'Ошибка создания');
                    window.showToast(createMsg, 'error');
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                    return;
                }

                // Upload logo now that shop exists
                if (logoFile && logoFile.size && logoFile.size > 0) {
                    try {
                        const ext = logoFile.name.split('.').pop().toLowerCase();
                        const { data: justCreated } = await client
                            .from('shops')
                            .select('id')
                            .eq('owner_id', currentUser.id)
                            .maybeSingle();
                        if (justCreated) {
                            const filePath = `${justCreated.id}/logo.${ext}`;
                            const { error: upErr } = await client.storage
                                .from('shop-logos')
                                .upload(filePath, logoFile, { upsert: false });
                            if (!upErr) {
                                logoPath = filePath;
                                await client.from('shops')
                                    .update({ logo_path: filePath })
                                    .eq('id', justCreated.id);
                            }
                        }
                    } catch (_) { /* logo is optional */ }
                }

                const createdLang = localStorage.getItem('valuon-lang') || 'ru';
                window.showToast(createdLang === 'en' ? 'Store created with cryptographic signature!' : 'Магазин создан с криптографической подписью!', 'success');

                const { data: newShop } = await client
                    .from('shops')
                    .select('id, shop_name, tax_id, address, country, logo_path, public_key, owner_id')
                    .eq('owner_id', currentUser.id)
                    .maybeSingle();

                if (newShop) {
                    currentShop = newShop;
                    sessionStorage.setItem('current_shop', JSON.stringify(newShop));
                    updateShopInfo(newShop);
                    renderView(views.dashboard);
                    await refreshDashboard(client, newShop.id, stats, list);
                }
            } catch (err) {
                logError('biz:createShop', err);
                const catchLang = localStorage.getItem('valuon-lang') || 'ru';
                window.showToast((catchLang === 'en' ? 'Shop creation error: ' : 'Ошибка создания магазина: ') + err.message, 'error');
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
            document.body.classList.remove('modal-open');
            baselineDate = '';
            forms.receipt?.reset();
            resetItemRows();
            clearAllValidationState();
            hideAutocomplete();
            setCustomerStatusBadge(null);
            hideSuccessScreen();
            lastIssuedReceipt = null;
            emailInput?.setAttribute('readonly', '');
            if (submitLabelEl) {
                const t = bizT();
                submitLabelEl.textContent = t.issue_receipt_submit || (bizLang() === 'en' ? 'Issue Receipt' : 'Выписать чек');
            }
            if (typeof CustomSelect !== 'undefined') {
                const pay = modal.el?.querySelector('[name="payment_method"]');
                if (pay && pay._cs) pay._cs.refresh();
            }
        }, 250);
    }

    function requestClose() {
        if (issuingClose) return;
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

    function toggleModal(show) {
        if (!modal.el) return;

        if (show) {
            if (!currentShop) {
                const toastLang = localStorage.getItem('valuon-lang') || 'ru';
                window.showToast(toastLang === 'en' ? 'Create a shop first' : 'Сначала создайте магазин', 'warning');
                return;
            }

            hideGuard();
            hideSuccessScreen();
            clearAllValidationState();
            hideAutocomplete();
            setCustomerStatusBadge(null);
            loadCustomerHistory();
            const draft = readDraft();
            if (draft) applyDraft(draft);
            else resetItemRows();

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

            if (typeof CustomSelect !== 'undefined') {
                const pay = modal.el.querySelector('[name="payment_method"]');
                if (pay && pay._cs) pay._cs.refresh();
            }

            modal.el.classList.remove('is-hidden');
            document.body.classList.add('modal-open');
            updateTotalPreview();

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

    attachModalA11y(modal.el, { mode: 'hidden', onClose: () => requestClose() });

    modal.openBtn?.addEventListener('click', () => toggleModal(true));
    modal.closeBtn?.addEventListener('click', () => requestClose());
    modal.cancelBtn?.addEventListener('click', () => requestClose());
    modal.el?.addEventListener('click', (e) => {
        if (e.target === modal.el || e.target.classList.contains('modal-backdrop')) requestClose();
    });

    document.getElementById('draft-save-btn')?.addEventListener('click', () => {
        const res = saveDraft();
        if (res === 'error') {
            const dl = localStorage.getItem('valuon-lang') || 'ru';
            window.showToast(dl === 'en' ? 'Could not save the draft' : 'Не удалось сохранить черновик', 'error');
            return;
        }
        if (res === 'saved') {
            const dl = localStorage.getItem('valuon-lang') || 'ru';
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

            const emailValid = validateEmailField(true);
            const itemsValid = validateAllItemRows(true);
            if (!emailValid || !itemsValid) {
                if (!emailValid) {
                    emailInput?.focus();
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
                const email = fd.get('customer_email').toLowerCase().trim();
                const valLang = localStorage.getItem('valuon-lang') || 'ru';

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    window.showToast(valLang === 'en' ? 'Enter a valid customer email' : 'Введите корректный email покупателя', 'warning');
                    return;
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

                const net = items.reduce((sum, it) => sum + it.netTotal, 0);
                const vat = items.reduce((sum, it) => sum + it.vatAmount, 0);
                const gross = net + vat;

                const { data: keyData } = await client
                    .from('shops')
                    .select('private_key')
                    .eq('id', currentShop.id)
                    .eq('owner_id', currentUser.id)
                    .single();

                if (!keyData?.private_key) {
                    const keyLang = localStorage.getItem('valuon-lang') || 'ru';
                    window.showToast(keyLang === 'en' ? 'Crypto key not found. Recreate the shop.' : 'Криптографический ключ магазина не найден. Пересоздайте магазин.', 'error');
                    return;
                }

                const signer = new Ed25519Signer();
                const privateKey = await signer.importPrivateKey(keyData.private_key);

                const signData = buildSignaturePayload({
                    taxId: currentShop.tax_id,
                    purchaseDate: fd.get('purchase_date'),
                    items,
                    netTotal: net,
                    vatAmount: vat,
                    grossTotal: gross,
                });
                const fiscalSignature = await signer.sign(signData, privateKey);

                let emailIsRegistered = null;
                let checkError = null;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    const res = await client.rpc('check_profile_exists', { p_email: email });
                    if (!res.error) {
                        emailIsRegistered = res.data;
                        checkError = null;
                        break;
                    }
                    checkError = res.error;
                    if (attempt < 3) {
                        await new Promise(r => setTimeout(r, attempt * 800));
                    }
                }

                if (checkError) {
                    const warnLang = localStorage.getItem('valuon-lang') || 'ru';
                    const warnMsg = warnLang === 'en'
                        ? 'Could not verify customer email. Receipt will be issued as pending.'
                        : 'Не удалось проверить email покупателя. Чек будет выписан как неподтверждённый.';
                    window.showToast(warnMsg, 'warning');
                    logError('biz:emailCheckRetry', checkError);
                }

                const status = emailIsRegistered ? 'verified' : 'pending';

                const payload = {
                    shop_id: currentShop.id,
                    customer_email: email,
                    net_total: net, vat_amount: vat, gross_total: gross,
                    purchase_date: fd.get('purchase_date'),
                    payment_method: fd.get('payment_method'),
                    status: status,
                    fiscal_hash: fiscalSignature,
                    shop_name: currentShop.shop_name,
                    tax_id: currentShop.tax_id,
                    address: currentShop.address,
                    logo_path: currentShop.logo_path,
                    country: currentShop.country || null
                };

                const { data: inserted, error } = await client
                    .from('business_receipts')
                    .insert([payload])
                    .select('id, receipt_number')
                    .single();

                if (error) {
                    const errLang = localStorage.getItem('valuon-lang') || 'ru';
                    window.showToast(errLang === 'en' ? 'Receipt issue error' : 'Ошибка выписки чека', 'error');
                    logError('biz:issueReceipt', error);
                    return;
                }

                const itemRows = items.map(it => ({
                    receipt_id: inserted.id,
                    item_name: it.itemName,
                    qty: it.qty,
                    unit_price: it.unitPrice,
                    vat_rate: it.vatRate,
                    warranty_months: it.warrantyMonths,
                    discount_rate: it.discount,
                    category: it.category,
                    net_total: it.netTotal,
                    vat_amount: it.vatAmount,
                    gross_total: it.grossTotal,
                    sort_order: it.sortOrder,
                }));

                const { error: itemsError } = await client.from('receipt_items').insert(itemRows);
                if (itemsError && itemsError.code !== '42703') {
                    // Шапка уже создана и подписана по этим items — без строк в
                    // receipt_items подпись невозможно будет перепроверить.
                    // Откатываем шапку, чтобы не оставлять "чек без товаров".
                    logError('biz:saveItems', itemsError);
                    await client.from('business_receipts').delete().eq('id', inserted.id);
                    return;
                }
                if (itemsError && itemsError.code === '42703') {
                    const baseRows = items.map(it => ({
                        receipt_id: inserted.id,
                        item_name: it.itemName,
                        qty: it.qty,
                        unit_price: it.unitPrice,
                        vat_rate: it.vatRate,
                        warranty_months: it.warrantyMonths,
                        net_total: it.netTotal,
                        vat_amount: it.vatAmount,
                        gross_total: it.grossTotal,
                        sort_order: it.sortOrder,
                    }));
                    const { error: baseError } = await client.from('receipt_items').insert(baseRows);
                    if (baseError) {
                        logError('biz:saveItemsFallback', baseError);
                        await client.from('business_receipts').delete().eq('id', inserted.id);
                        const errLang = localStorage.getItem('valuon-lang') || 'ru';
                        window.showToast(errLang === 'en' ? 'Receipt issue error' : 'Ошибка выписки чека', 'error');
                        return;
                    }
                }

                const succLang = localStorage.getItem('valuon-lang') || 'ru';
                const receiptLabel = inserted?.receipt_number ? ` #RCP-${inserted.receipt_number}` : '';
                window.showToast(succLang === 'en' ? `Receipt${receiptLabel} issued!` : `Чек${receiptLabel} выписан!`, 'success');
                clearDraft();

                if (customerHistory) {
                    customerHistory = customerHistory.filter((c) => c.email !== email);
                    customerHistory.unshift({ email, status });
                }
                customerStatusCache.set(email, status === 'verified');

                showSuccessScreen({
                    id: inserted.id,
                    receipt_number: inserted.receipt_number,
                    customer_email: email,
                    payment_method: fd.get('payment_method'),
                    purchase_date: fd.get('purchase_date'),
                    status,
                    net_total: net,
                    vat_amount: vat,
                    gross_total: gross,
                    fiscal_hash: fiscalSignature,
                    shop_id: currentShop.id,
                    shop_name: currentShop.shop_name,
                    receipt_items: items.map((it) => ({
                        item_name: it.itemName,
                        qty: it.qty,
                        unit_price: it.unitPrice,
                        vat_rate: it.vatRate,
                        warranty_months: it.warrantyMonths,
                        net_total: it.netTotal,
                        vat_amount: it.vatAmount,
                        gross_total: it.grossTotal,
                    })),
                });

                await refreshDashboard(client, currentShop.id, stats, list);
            } catch (err) {
                logError('biz:issueReceiptCatch', err);
                const errLang = localStorage.getItem('valuon-lang') || 'ru';
                window.showToast(errLang === 'en' ? 'Error issuing receipt' : 'Ошибка выписки чека', 'error');
            } finally {
                issuingClose = false;
                btn.disabled = false;
                btn.classList.remove('is-loading');
            }
        });
    }

    let currentDeleteCleanup = null;

    async function refreshDashboard(client, shopId, statsEl, listEl) {
        if (!shopId) return;

        listEl.grid.innerHTML = '<div class="loading-spinner" style="text-align:center;padding:2rem;"><i class="fa-solid fa-circle-notch fa-spin fa-2x"></i></div>';

        const emptyMsg = document.getElementById('no-receipts-msg');
        if (emptyMsg) emptyMsg.style.display = 'none';

        try {
            const [totalRes, pendingRes, receiptsRes] = await Promise.all([
                client.from('business_receipts').select('*', { count: 'exact', head: true }).eq('shop_id', shopId),
                client.from('business_receipts').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('status', 'pending'),
                client.from('business_receipts').select('id, receipt_number, status, purchase_date, customer_email, gross_total, net_total, vat_amount, fiscal_hash, shop_id, created_at, shop_name, payment_method, receipt_items(item_name, qty, unit_price, vat_rate, warranty_months, net_total, vat_amount, gross_total, sort_order)').eq('shop_id', shopId).order('created_at', { ascending: false }).order('sort_order', { referencedTable: 'receipt_items', ascending: true })
            ]);

            if (statsEl.total) { statsEl.total.textContent = '0'; window.animateCount(statsEl.total, totalRes.count || 0); }
            if (statsEl.pending) { statsEl.pending.textContent = '0'; window.animateCount(statsEl.pending, pendingRes.count || 0); }

            const receipts = receiptsRes.data || [];
            const grossTotals = receipts.map(r => parseFloat(r.gross_total)).filter(v => Number.isFinite(v));
            const totalRevenue = grossTotals.reduce((s, v) => s + v, 0);
            const avgReceipt = grossTotals.length > 0 ? totalRevenue / grossTotals.length : 0;

            if (statsEl.revenue) {
                statsEl.revenue.textContent = '$0.00';
                window.animateAmount(statsEl.revenue, totalRevenue);
            }
            if (statsEl.avgReceipt) {
                statsEl.avgReceipt.textContent = '$0.00';
                window.animateAmount(statsEl.avgReceipt, avgReceipt);
            }

            currentReceiptsList = receipts;

            if (receipts.length === 0) {
                listEl.grid.innerHTML = '';
                if (emptyMsg) emptyMsg.style.display = 'block';
                updateChart();
                return;
            }

            if (emptyMsg) emptyMsg.style.display = 'none';

            renderReceiptCards(listEl, receipts);





            window.applyBusinessTranslations?.();

            listEl.grid.querySelectorAll('.btn-delete-receipt').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (currentDeleteCleanup) currentDeleteCleanup();

                    const receiptId = btn.dataset.id;
                    const deleteModal = document.getElementById('delete-confirm-modal');
                    const confirmBtn = document.getElementById('confirm-delete-btn');
                    const cancelBtn = document.getElementById('cancel-delete-btn');

                    if (!deleteModal) return;

                    attachModalA11y(deleteModal, { mode: 'hidden', onClose: () => handleCancel() });

                    deleteModal.classList.remove('is-hidden');
                    document.body.classList.add('modal-open');

                    confirmBtn.disabled = false;
                    const lang = localStorage.getItem('valuon-lang') || 'ru';
                    const deleteText = lang === 'en' ? 'Delete' : 'Удалить';
                    confirmBtn.innerHTML = `<i class="fa-solid fa-trash"></i> ${deleteText}`;

                    const handleConfirm = async () => {
                        confirmBtn.disabled = true;
                        confirmBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

                        try {
                            const { error } = await client
                                .from('business_receipts')
                                .delete()
                                .eq('id', receiptId)
                                .eq('shop_id', shopId);

                            if (error) throw error;

                            const successMsg = lang === 'en' ? 'Receipt successfully deleted' : 'Чек успешно удален';
                            window.showToast(successMsg, 'success');
                            deleteModal.classList.add('closing');
                            setTimeout(async () => {
                                deleteModal.classList.add('is-hidden');
                                deleteModal.classList.remove('closing');
                                cleanup();
                                await refreshDashboard(client, shopId, statsEl, listEl);
                                if (typeof window.applyBusinessTranslations === 'function') {
                                    window.applyBusinessTranslations();
                                }
                            }, 250);
                        } catch (e) {
                            logError('biz:deleteReceipt', e);
                            const errorMsg = lang === 'en' ? 'Error deleting receipt' : 'Ошибка при удалении чека';
                            window.showToast(errorMsg, 'error');
                            confirmBtn.disabled = false;
                            confirmBtn.innerHTML = `<i class="fa-solid fa-trash"></i> ${deleteText}`;
                        }
                    };

                    const handleCancel = () => {
                        if (deleteModal.classList.contains('closing')) return;
                        deleteModal.classList.add('closing');
                        setTimeout(() => {
                            deleteModal.classList.add('is-hidden');
                            deleteModal.classList.remove('closing');
                            document.body.classList.remove('modal-open');
                            cleanup();
                        }, 250);
                    };

                    const cleanup = () => {
                        confirmBtn.removeEventListener('click', handleConfirm);
                        cancelBtn.removeEventListener('click', handleCancel);
                        deleteModal.removeEventListener('click', handleClickOutside);
                        currentDeleteCleanup = null;
                    };

                    const handleClickOutside = (e) => {
                        if (e.target === deleteModal || e.target.classList.contains('modal-backdrop')) {
                            handleCancel();
                        }
                    };

                    confirmBtn.addEventListener('click', handleConfirm);
                    cancelBtn.addEventListener('click', handleCancel);
                    deleteModal.addEventListener('click', handleClickOutside);
                    currentDeleteCleanup = cleanup;
                });
            });

            listEl.grid.querySelectorAll('.btn-download-receipt').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const receiptId = btn.dataset.id;
                    const receipt = currentReceiptsList.find(r => r.id === receiptId);

                    if (receipt && currentShop) {
                        await downloadReceiptPDF(receipt, currentShop);
                    } else {
                        const errLang = localStorage.getItem('valuon-lang') || 'ru';
                        window.showToast(errLang === 'en' ? 'Receipt data not found' : 'Не удалось найти данные чека', 'error');
                    }
                });
            });

            updateChart();
        } catch (e) {
            logError('biz:refreshDashboard', e);
            const refreshLang = localStorage.getItem('valuon-lang') || 'ru';
            window.showToast(refreshLang === 'en' ? 'Failed to update data. Try again later.' : 'Не удалось обновить данные. Попробуйте позже.', 'error');
            if (statsEl.total) statsEl.total.textContent = '—';
            if (statsEl.pending) statsEl.pending.textContent = '—';
            if (statsEl.revenue) statsEl.revenue.textContent = '—';
            if (statsEl.avgReceipt) statsEl.avgReceipt.textContent = '—';
            listEl.grid.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:2rem;">${refreshLang === 'en' ? 'Data load error' : 'Ошибка загрузки данных'}</p>`;
        }
    }


    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        let themeTimer = null;
        themeBtn.addEventListener('click', () => {
            if (themeTimer) clearTimeout(themeTimer);
            themeTimer = setTimeout(updateChart, 150);
        });
    }

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

    function fillReceiptCounts(receipts, groups, daysMap) {
        receipts.forEach(r => {
            if (!r.purchase_date) return;
            const dateStr = r.purchase_date.slice(0, 10);
            if (daysMap[dateStr]) {
                groups[dateStr].count++;
            }
        });
    }

    function fillRevenueTotals(receipts, groups, daysMap) {
        receipts.forEach(r => {
            if (!r.purchase_date) return;
            const dateStr = r.purchase_date.slice(0, 10);
            if (daysMap[dateStr]) {
                const gross = parseFloat(r.gross_total);
                if (Number.isFinite(gross)) {
                    groups[dateStr].total += gross;
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
        if (!Number.isFinite(value)) return '$0';
        const abs = Math.abs(value);
        const sign = value < 0 ? '-' : '';
        if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(1) + 'M';
        if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(1) + 'K';
        return sign + '$' + Math.round(abs);
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
        const lang = localStorage.getItem('valuon-lang') || 'ru';
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
        if (!receipts || receipts.length === 0) {
            return { labels: [], data: [], change: { absolute: 0, percent: 0 } };
        }

        const lang = localStorage.getItem('valuon-lang') || 'ru';
        const cal = getCalendarPeriod(period, new Date());

        const cur = buildDayMap(cal.currentStart, cal.currentEnd, lang);
        const prev = buildDayMap(cal.previousStart, cal.previousEnd, lang);

        const fillFn = field === 'revenue' ? fillRevenueTotals : fillReceiptCounts;
        fillFn(receipts, cur.groups, cur.daysMap);
        fillFn(receipts, prev.groups, prev.daysMap);

        const curSeries = extractSeries(cur.groups, field);
        const prevSeries = extractSeries(prev.groups, field);

        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const daysElapsed = Math.max(0, Math.ceil((today - cal.currentStart) / 86400000));
        const limit = Math.min(daysElapsed, curSeries.data.length);
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
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 4,
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
                if (!Number.isFinite(val)) return '$0.00';
                return '$' + val.toFixed(2);
            }
        };

        const datasets = [{
            label: t.revenue_chart_label || (lang === 'en' ? 'Revenue' : 'Выручка'),
            data: aggregated.data,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
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

        const lang = localStorage.getItem('valuon-lang') || window.businessCurrentLang || 'ru';
        const bt = window.businessTranslations || {};
        const t = bt[lang] || bt.ru || {};
        const colors = getChartColors(isDark);

        const aggregated = aggregateDualPeriod('count', currentReceiptsList || [], period);
        const hasData = aggregated.data.some(v => v > 0);

        if (!hasData) {
            showChartEmpty('receipts-chart', '.chart-box:first-child .chart-wrapper',
                () => receiptsChartInstance, t['chart_empty_' + period] || t.chart_empty || 'Нет данных для графика');
            receiptsChartInstance = null;
            updateChangeBadge('change-receipts', { absolute: 0, percent: 0 });
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

        const lang = localStorage.getItem('valuon-lang') || window.businessCurrentLang || 'ru';
        const bt = window.businessTranslations || {};
        const t = bt[lang] || bt.ru || {};
        const colors = getChartColors(isDark);

        const aggregated = aggregateDualPeriod('revenue', currentReceiptsList || [], period);
        const hasData = aggregated.data.some(v => v > 0);

        if (!hasData) {
            showChartEmpty('revenue-chart', '.chart-box:last-child .chart-wrapper',
                () => revenueChartInstance, t['chart_empty_' + period] || t.chart_empty || 'Нет данных для графика');
            revenueChartInstance = null;
            updateChangeBadge('change-revenue', { absolute: 0, percent: 0 });
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


    const periodBtns = document.querySelectorAll('.chart-period-btn');
    periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            periodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            chartPeriod = btn.dataset.period;
            updateChart();
        });
    });

    window.addEventListener('business-lang-changed', () => {
        if (!currentShop) return;
        renderReceiptCards(list, currentReceiptsList);
        window.applyBusinessTranslations?.();
        setTimeout(updateChart, 50);
    });
}

function renderShopCountrySelect() {
    const select = document.getElementById('shop-country');
    if (!select) return;
    const lang = localStorage.getItem('valuon-lang') || 'ru';
    renderCountryOptions(select, lang);
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
}

renderShopCountrySelect();
window.addEventListener('business-lang-changed', renderShopCountrySelect);
document.addEventListener('DOMContentLoaded', () => {
    renderShopCountrySelect();
    if (typeof window.applyBusinessTranslations === 'function') window.applyBusinessTranslations();
});

initBusinessPanel().catch(e => logError('init:bizPanel', e));