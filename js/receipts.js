import { requireAuth, setupLogout } from './dashboard-auth.js';
import { escapeHtml, logError } from './security.js';
import { attachModalA11y } from './modal-a11y.js';

let pendingDeleteId = null;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SIGNED_URL_TTL = 60 * 60;


let currentUserId = null;
let currentUserEmail = null;
let userDefaultCurrency = 'EUR';


let uploadModal = null;

window.addEventListener('lang-changed', (e) => {
    const select = document.getElementById('upload-receipt-currency');
    if (!select || typeof window.renderCurrencyOptions !== 'function') return;
    window.renderCurrencyOptions(select, e.detail?.lang || getLang());
    if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
});

function getLang() {
    return localStorage.getItem('valuon-lang') || 'ru';
}

// Вкладки и заголовок секции теперь статичны в HTML (как на странице
// "Мои вещи"), поэтому просто восстанавливаем сохранённую вкладку —
// без пересборки разметки и, соответственно, без мигания текста.
function applySavedReceiptsTab() {
    const saved = sessionStorage.getItem('valuon-receipts-tab') || 'personal';
    if (saved === 'personal') return;

    document.querySelector('#receipts-tabs .items-tab[data-receipts-tab="personal"]')?.classList.remove('active');
    document.querySelector('#receipts-tabs .items-tab[data-receipts-tab="personal"]')?.setAttribute('aria-selected', 'false');
    document.querySelector('#receipts-tabs .items-tab[data-receipts-tab="business"]')?.classList.add('active');
    document.querySelector('#receipts-tabs .items-tab[data-receipts-tab="business"]')?.setAttribute('aria-selected', 'true');

    document.getElementById('receipts-grid-personal')?.classList.add('hidden');
    document.getElementById('receipts-grid-business')?.classList.remove('hidden');
}

function validateFileSize(file) {
    if (file.size > MAX_FILE_SIZE) {
        const lang = getLang();
        showToast(
            lang === 'ru'
                ? `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум 10 МБ.`
                : `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`,
            'warning'
        );
        return false;
    }
    return true;
}

async function initReceipts() {
    const auth = await requireAuth();
    if (!auth) return;

    const { user, client } = auth;
    setupLogout(client);

    currentUserId = user.id;
    currentUserEmail = user.email;

    const { data: profile } = await client
        .from('profiles')
        .select('currency')
        .eq('id', user.id)
        .single();
    userDefaultCurrency = profile?.currency || 'EUR';

    const uploadCurrencySelect = document.getElementById('upload-receipt-currency');
    if (uploadCurrencySelect && typeof window.renderCurrencyOptions === 'function') {
        window.renderCurrencyOptions(uploadCurrencySelect, getLang());
    }

    uploadModal = createUploadModal(client, currentUserId);
    setupUploadListeners(uploadModal);
    setupDeleteModal(client, currentUserId);

    applySavedReceiptsTab();
    setupReceiptsTabs();

    await loadAllReceipts(currentUserEmail, currentUserId, client);
    await populateItemSelect(currentUserId, client);

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(getLang());
    }
}

async function attachFreshSignedUrls(receipts, client) {
    return Promise.all(receipts.map(async (r) => {
        if (!r.file_path) return r;

        const msPerSecond = 1000;
        const expiresAt = new Date(r.created_at).getTime() + SIGNED_URL_TTL * msPerSecond;
        if (r.file_url && r.created_at && Date.now() < expiresAt) {
            return { ...r, file_url: r.file_url };
        }

        const { data, error } = await client.storage
            .from('receipts')
            .createSignedUrl(r.file_path, SIGNED_URL_TTL);

        if (error || !data) {
            console.warn('Не удалось перевыпустить signed URL для', r.file_path, error);
            return r;
        }
        return { ...r, file_url: data.signedUrl };
    }));
}

async function loadAllReceipts(userEmail, userId, client) {
    // Шапка и вкладки статичны (как на "Мои вещи") и никогда не пересобираются,
    // а значит вкладки кликабельны и во время загрузки. Поэтому лоадер ставим
    // в обе сетки сразу — иначе клик по неактивной вкладке во время загрузки
    // на миг показал бы пустую сетку вместо индикатора загрузки.
    const personalGrid = document.getElementById('receipts-grid-personal');
    const businessGrid = document.getElementById('receipts-grid-business');
    if (!personalGrid || !businessGrid) return;

    const lang = getLang();
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
    const phrases = [
        t.loading_receipts || 'Загружаем чеки…',
        t.loading_signatures || 'Проверяем подписи…',
        t.loading_items_update || 'Обновляем статусы…'
    ];

    [personalGrid, businessGrid].forEach(grid => {
        grid.innerHTML = '<div class="rotating-loader"></div>';
        const loaderEl = grid.querySelector('.rotating-loader');
        if (loaderEl && typeof RotatingTextLoader !== 'undefined') {
            new RotatingTextLoader(loaderEl, phrases, { interval: 800 });
        }
    });

    try {
        const { data: businessData, error: bizError } = await client
            .from('business_receipts')
            .select('*, receipt_items(*)')
            .eq('customer_email', userEmail)
            .order('purchase_date', { ascending: false })
            .order('sort_order', { referencedTable: 'receipt_items', ascending: true });

        if (bizError) logError('receipts:loadBiz', bizError);

        const { data: personalData, error: personalError } = await client
            .from('receipts')
            .select('*, items(name, price, purchase_date, store_name, currency)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (personalError) throw personalError;

        const personalWithFreshUrls = await attachFreshSignedUrls(personalData || [], client);

        renderSplitReceipts(businessData || [], personalWithFreshUrls, client, userId);
    } catch (e) {
        logError('receipts:load', e);
        const errorHtml = '<p class="empty-state error">Ошибка загрузки данных.</p>';
        personalGrid.innerHTML = errorHtml;
        businessGrid.innerHTML = errorHtml;
    }
}

function renderSplitReceipts(businessReceipts, personalReceipts, client, userId) {
    // Шапка, заголовок секции и вкладки статичны в HTML и сюда больше не
    // попадают — обновляем только содержимое сеток и счётчики на вкладках.
    const lang = getLang();
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    const personalGrid = document.getElementById('receipts-grid-personal');
    const businessGrid = document.getElementById('receipts-grid-business');
    if (!personalGrid || !businessGrid) return;

    personalGrid.innerHTML = buildPersonalGridHTML(personalReceipts, t, lang);
    businessGrid.innerHTML = buildBusinessGridHTML(businessReceipts, t, lang);

    requestAnimationFrame(() => {
        window.animateCount(document.getElementById('receipts-count-personal'), personalReceipts.length);
        window.animateCount(document.getElementById('receipts-count-business'), businessReceipts.length);
    });
    restoreListeners(client, userId);

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(lang);
    }
}

function buildPersonalGridHTML(receipts, t, lang) {
    if (receipts.length === 0) {
        return `
            <div class="empty-state" data-animate="zoom">
                <div class="empty-icon"><i class="fa-solid fa-receipt"></i></div>
                <h3 data-i18n="no_personal_receipts">${t.no_personal_receipts || (lang === 'ru' ? 'Пока нет загруженных чеков' : 'No personal receipts yet')}</h3>
                <p data-i18n="personal_empty_desc">${t.personal_empty_desc || (lang === 'ru' ? 'Сфотографируйте или загрузите первый чек — он останется здесь навсегда.' : 'Photograph or upload your first receipt — it will stay here for good.')}</p>
                <button type="button" class="btn btn-outline empty-state-cta" id="empty-upload-receipt-btn">
                    <i class="fa-solid fa-upload"></i> <span data-i18n="personal_empty_cta">${t.personal_empty_cta || (lang === 'ru' ? 'Загрузить чек' : 'Upload receipt')}</span>
                </button>
            </div>`;
    }

    const flatData = receipts.map(r => ({
        ...r,
        item_name: r.items?.name || null,
        display_name: r.items?.name || r.receipt_name || r.store_name || 'Untitled Receipt',
        display_amount: r.items?.price ?? r.amount,
        display_currency: r.items?.currency ?? r.currency,
        display_date: r.items?.purchase_date || r.purchase_date,
        display_store: r.items?.store_name || r.store_name,
        is_linked: !!r.items
    }));

    return flatData.map(r => renderPersonalCard(r, t)).join('');
}

function buildBusinessGridHTML(receipts, t, lang) {
    if (receipts.length === 0) {
        return `
            <div class="empty-state" data-animate="zoom">
                <div class="empty-icon"><i class="fa-solid fa-store"></i></div>
                <h3 data-i18n="no_business_receipts">${t.no_business_receipts || (lang === 'ru' ? 'Пока нет чеков от партнёров' : 'No business receipts yet')}</h3>
                <p data-i18n="business_empty_desc">${t.business_empty_desc || (lang === 'ru' ? 'Как только магазин-партнёр Valuon выпишет чек на ваш email, он появится здесь автоматически.' : 'Once a Valuon partner store issues a receipt to your email, it will appear here automatically.')}</p>
            </div>`;
    }

    return receipts.map(r => renderBusinessCard(r, t)).join('');
}

let _switchingReceiptsTab = false;

function switchReceiptsGridTab(oldGrid, newGrid) {
    if (_switchingReceiptsTab || !newGrid) return;
    _switchingReceiptsTab = true;
    if (oldGrid) {
        oldGrid.classList.add('fade-out');
        setTimeout(() => {
            oldGrid.classList.add('hidden');
            oldGrid.classList.remove('fade-out');
            showNewGrid();
        }, 180);
    } else {
        showNewGrid();
    }
    function showNewGrid() {
        newGrid.classList.remove('hidden');
        requestAnimationFrame(() => {
            newGrid.classList.add('fade-in');
            setTimeout(() => {
                newGrid.classList.remove('fade-in');
                _switchingReceiptsTab = false;
            }, 300);
        });
    }
}

function setupReceiptsTabs() {
    const tabs = document.querySelectorAll('#receipts-tabs .items-tab');
    const indicator = document.getElementById('receipts-tab-indicator');

    function moveIndicator() {
        const active = document.querySelector('#receipts-tabs .items-tab.active');
        if (!indicator || !active) return;
        indicator.style.width = `${active.offsetWidth}px`;
        indicator.style.transform = `translateX(${active.offsetLeft - 4}px)`;
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.classList.contains('active')) return;

            tabs.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            moveIndicator();

            const target = tab.dataset.receiptsTab;
            sessionStorage.setItem('valuon-receipts-tab', target);
            const personalGrid = document.getElementById('receipts-grid-personal');
            const businessGrid = document.getElementById('receipts-grid-business');
            const oldGrid = target === 'personal' ? businessGrid : personalGrid;
            const newGrid = target === 'personal' ? personalGrid : businessGrid;
            switchReceiptsGridTab(oldGrid, newGrid);
        });
    });

    requestAnimationFrame(moveIndicator);
    window.addEventListener('resize', moveIndicator);
    window.addEventListener('lang-changed', () => requestAnimationFrame(moveIndicator));
}

function renderBusinessCard(r, t) {
    const dateStr = new Date(r.purchase_date).toLocaleDateString(getLang() === 'ru' ? 'ru-RU' : 'en-US');
    const receiptNum = escapeHtml(r.receipt_number ? `#RCP-${r.receipt_number}` : `#${String(r.id).slice(0, 8).toUpperCase()}`);

    const lineItems = Array.isArray(r.receipt_items) ? r.receipt_items : [];
    const itemsCount = lineItems.length;

    const itemsListHtml = itemsCount > 0 ? `
        <div class="receipt-card-items">
            ${itemsCount === 1
            ? `<div class="receipt-card-item single">
                       <span class="item-name">${escapeHtml(lineItems[0].item_name)}</span>
                       <span class="item-qty">×${lineItems[0].qty}</span>
                       ${lineItems[0].warranty_months ? ` <span class="item-warranty">${lineItems[0].warranty_months} ${t.months_short || 'mo'}.</span>` : ''}
                   </div>`
            : `<ul class="receipt-card-items-list">${lineItems.map(it =>
                `<li><span class="item-name">${escapeHtml(it.item_name)}</span> <span class="item-qty">×${it.qty}</span>${it.warranty_months ? ` <span class="item-warranty">${it.warranty_months} ${t.months_short || 'mo'}.</span>` : ''}</li>`
            ).join('')}</ul>`
        }
        </div>` : '';

    const stats = [
        { icon: 'fa-tag', labelKey: 'stat_price', fallback: 'Price', value: escapeHtml(window.formatCurrency(parseFloat(r.gross_total) || 0, r.currency || 'EUR', getLang())) },
        { icon: 'fa-regular fa-calendar', labelKey: 'stat_date', fallback: 'Date', value: escapeHtml(dateStr) }
    ];
    const statsHtml = stats.map(s => `
                        <div class="mine-stat">
                            <span class="mine-stat-icon"><i class="fa-solid ${s.icon}"></i></span>
                            <div class="mine-stat-text">
                                <div class="mine-stat-label" data-i18n="${s.labelKey}">${escapeHtml(t[s.labelKey] || s.fallback)}</div>
                                <div class="mine-stat-value" title="${s.value}">${s.value}</div>
                            </div>
                        </div>`).join('');

    const verifiedLabel = escapeHtml(t.status_business_verified || 'Verified');
    const btnDownloadText = escapeHtml(t.btn_download || 'Скачать');
    const shopName = escapeHtml(r.shop_name || '');
    const email = escapeHtml(r.customer_email || '');

    return `
        <div class="mine-item-card business" data-id="${escapeHtml(r.id)}">
            <div class="mine-item-header">
                <div class="mine-item-icon">
                    <i class="fa-solid fa-file-invoice-dollar"></i>
                    <span class="verified-check" title="${verifiedLabel}" aria-label="${verifiedLabel}"><i class="fa-solid fa-check"></i></span>
                </div>
                <div class="mine-item-heading">
                    <h3 class="mine-item-title" title="${receiptNum}">${receiptNum}</h3>
                    <div class="mine-item-brand">${email}</div>
                </div>
            </div>

            <div class="mine-item-body">
                <div class="shop-pill"><i class="fa-solid fa-store"></i> ${shopName}</div>

                <div class="mine-stats-grid">${statsHtml}</div>

                ${itemsListHtml}

                <div class="mine-item-actions download-only">
                    <button class="btn-action btn-download-biz" data-receipt-id="${escapeHtml(r.id)}" title="${btnDownloadText}">
                        <i class="fa-solid fa-download"></i> <span data-i18n="btn_download">${btnDownloadText}</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderPersonalCard(r, t) {
    const isPdf = r.file_type === 'application/pdf';
    const isImage = r.file_type && r.file_type.startsWith('image/');
    const iconClass = isPdf ? 'fa-file-pdf' : isImage ? 'fa-file-image' : 'fa-file-invoice';

    const stats = [];
    if (r.display_amount) {
        stats.push({ icon: 'fa-tag', labelKey: 'stat_price', fallback: 'Price', value: escapeHtml(window.formatCurrency(parseFloat(r.display_amount), r.display_currency || 'EUR', getLang())) });
    }
    if (r.display_date) {
        const date = new Date(r.display_date).toLocaleDateString(getLang() === 'ru' ? 'ru-RU' : 'en-US');
        stats.push({ icon: 'fa-regular fa-calendar', labelKey: 'stat_date', fallback: 'Date', value: escapeHtml(date) });
    }
    if (r.display_store) {
        stats.push({ icon: 'fa-store', labelKey: 'stat_store', fallback: 'Store', value: escapeHtml(r.display_store) });
    }
    if (r.is_linked) {
        stats.push({ icon: 'fa-link', labelKey: 'stat_linked_item', fallback: 'Linked item', value: escapeHtml(r.item_name) });
    }

    const statsHtml = stats.map(s => `
                        <div class="mine-stat">
                            <span class="mine-stat-icon"><i class="fa-solid ${s.icon}"></i></span>
                            <div class="mine-stat-text">
                                <div class="mine-stat-label" data-i18n="${s.labelKey}">${escapeHtml(t[s.labelKey] || s.fallback)}</div>
                                <div class="mine-stat-value" title="${s.value}">${s.value}</div>
                            </div>
                        </div>`).join('');

    const displayName = escapeHtml(r.display_name);
    const btnViewText = escapeHtml(t.btn_view || 'Просмотр');
    const btnDownloadText = escapeHtml(t.btn_download || 'Скачать');
    const btnDeleteText = escapeHtml(t.btn_delete || 'Удалить');

    return `
        <div class="mine-item-card" data-id="${escapeHtml(r.id)}">
            <div class="mine-item-header">
                <div class="mine-item-icon"><i class="fa-solid ${iconClass}"></i></div>
                <div class="mine-item-heading">
                    <h3 class="mine-item-title" title="${displayName}">${displayName}</h3>
                </div>
            </div>

            <div class="mine-item-body">
                ${stats.length ? `<div class="mine-stats-grid">${statsHtml}</div>` : ''}

                <div class="mine-item-actions receipt-actions">
                    <button class="btn-action btn-view-receipt"
                            data-url="${escapeHtml(r.file_url)}"
                            title="${btnViewText}">
                        <i class="fa-solid fa-eye"></i> <span data-i18n="btn_view">${btnViewText}</span>
                    </button>
                    <button class="btn-action btn-download-receipt" data-url="${escapeHtml(r.file_url)}" data-name="${displayName}" title="${btnDownloadText}">
                        <i class="fa-solid fa-download"></i> <span data-i18n="btn_download">${btnDownloadText}</span>
                    </button>
                    <button class="btn-action btn-delete-receipt" data-id="${escapeHtml(r.id)}" title="${btnDeleteText}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function setupUploadListeners(modal) {
    if (!modal) return;
    document.getElementById('upload-receipt-btn')?.addEventListener('click', modal.open);
    document.getElementById('empty-upload-receipt-btn')?.addEventListener('click', modal.open);

    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;

    dropZone.addEventListener('click', modal.open);
    ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--primary)';
            dropZone.style.background = 'rgba(59, 130, 246, 0.05)';
        });
    });
    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '';
            dropZone.style.background = '';
        });
    });
    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            if (!validateFileSize(files[0])) return;
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
            if (!allowedTypes.includes(files[0].type)) {
                const lang = getLang();
                showToast(lang === 'ru' ? 'Неподдерживаемый тип файла. Загрузите изображение или PDF.' : 'Unsupported file type. Please upload an image or PDF.', 'error');
                return;
            }
            modal.open();
            modal.setFile(files[0]);
        }
    });
}

function restoreListeners(client, userId) {
    const lang = getLang();

    // Кнопка в пустом состоянии сетки — сам элемент каждый раз создаётся
    // заново при обновлении содержимого, поэтому биндим её здесь, а не
    // один раз при инициализации (в отличие от статичных upload-zone/шапки).
    document.getElementById('empty-upload-receipt-btn')?.addEventListener('click', () => uploadModal?.open());

    document.querySelectorAll('.btn-view-receipt').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.url) window.open(btn.dataset.url, '_blank');
        });
    });

    document.querySelectorAll('.btn-download-receipt').forEach(btn => {
        btn.addEventListener('click', async () => {
            const url = btn.dataset.url;
            const name = btn.dataset.name || 'receipt';
            if (!url) return;

            const originalHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Network response was not ok');
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                }, 200);
            } catch (err) {
                logError('receipts:download', err);
                showToast(lang === 'ru' ? 'Не удалось скачать файл' : 'Failed to download file', 'error');
            } finally {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }
        });
    });

    document.querySelectorAll('.btn-download-biz').forEach(btn => {
        btn.addEventListener('click', async () => {
            const originalHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                if (typeof window.jspdf === 'undefined') {
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                        s.onload = resolve; s.onerror = reject;
                        document.head.appendChild(s);
                    });
                }
                if (typeof qrcode === 'undefined') {
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
                        s.onload = resolve; s.onerror = reject;
                        document.head.appendChild(s);
                    });
                }
                const { downloadReceiptPDF } = await import('./receipt-generator.js');
                let { data: receipt, error } = await client
                    .from('business_receipts')
                    .select('*, receipt_items(*)')
                    .eq('id', btn.dataset.receiptId)
                    .eq('customer_email', currentUserEmail)
                    .order('sort_order', { referencedTable: 'receipt_items', ascending: true })
                    .single();

                if (error || !receipt) throw error || new Error('Receipt not found');

                if (!Array.isArray(receipt.receipt_items) || receipt.receipt_items.length === 0) {
                    const { data: items } = await client
                        .from('receipt_items')
                        .select('*')
                        .eq('receipt_id', receipt.id)
                        .order('sort_order');
                    if (items?.length) receipt.receipt_items = items;
                }

                const mockShop = {
                    shop_name: receipt.shop_name || 'Partner Store',
                    address: receipt.address || '',
                    country: receipt.country || null,
                    currency: receipt.currency || 'EUR',
                    tax_id: receipt.tax_id || '',
                    logo_path: receipt.logo_path || null
                };
                await downloadReceiptPDF(receipt, mockShop);
            } catch (e) {
                logError('receipts:pdfGen', e);
                showToast(
                    lang === 'ru'
                        ? 'Генератор PDF пока недоступен'
                        : 'PDF generator is not available yet',
                    'error'
                );
            } finally {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }
        });
    });

    document.querySelectorAll('.btn-delete-receipt').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingDeleteId = btn.dataset.id;
            document.getElementById('delete-receipt-modal')?.classList.add('active');
            document.documentElement.classList.add('modal-open');
        });
    });
}

async function populateItemSelect(userId, client) {
    const select = document.getElementById('linked-item-select');
    if (!select) return;

    const { data } = await client
        .from('items')
        .select('id, name, price, purchase_date, store_name, type, currency')
        .eq('user_id', userId)
        .order('name');

    if (data) {
        data.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = item.name;
            opt.dataset.price = item.price ?? '';
            opt.dataset.date = item.purchase_date || '';
            opt.dataset.store = item.store_name || '';
            opt.dataset.name = item.name || '';
            opt.dataset.currency = item.currency || 'EUR';
            const icon = deviceIconMarkup(item.type);
            if (icon) {
                opt.setAttribute('data-icon', icon);
            }
            select.appendChild(opt);
        });
    }

    if (typeof CustomSelect !== 'undefined') {
        CustomSelect.refreshAll();
    }
}

function setupDeleteModal(client, userId) {
    const modal = document.getElementById('delete-receipt-modal');
    const confirmBtn = document.getElementById('confirm-delete-receipt');
    const cancelBtn = document.getElementById('cancel-delete-receipt');

    function closeDeleteModal() {
        if (modal?.classList.contains('closing')) return;
        modal?.classList.add('closing');
        setTimeout(() => {
            modal?.classList.remove('active', 'closing');
            document.documentElement.classList.remove('modal-open');
            pendingDeleteId = null;
        }, 250);
    }

    attachModalA11y(modal, { mode: 'active', onClose: closeDeleteModal });

    cancelBtn?.addEventListener('click', closeDeleteModal);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeDeleteModal(); });

    confirmBtn?.addEventListener('click', async () => {
        if (!pendingDeleteId) return;

        const lang = getLang();
        const originalHTML = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const { data: delReceipt } = await client
                .from('receipts')
                .select('file_path')
                .eq('id', pendingDeleteId)
                .eq('user_id', userId)
                .single();

            if (delReceipt?.file_path) {
                const { error: storageError } = await client.storage
                    .from('receipts')
                    .remove([delReceipt.file_path]);

                if (storageError) {
                    console.warn('Storage delete warning:', storageError.message);
                }
            }

            const { error: dbError } = await client.from('receipts').delete()
                .eq('id', pendingDeleteId)
                .eq('user_id', userId);

            if (dbError) throw dbError;

            showToast(lang === 'ru' ? 'Чек удалён' : 'Receipt deleted', 'success');
            closeDeleteModal();

            await loadAllReceipts(currentUserEmail, userId, client);

        } catch (err) {
            logError('receipts:delete', err);
            showToast(
                lang === 'ru'
                    ? `Ошибка удаления записи: ${err.message}`
                    : `Failed to delete record: ${err.message}`,
                'error'
            );
        } finally {
            confirmBtn.innerHTML = originalHTML;
            confirmBtn.disabled = false;
        }
    });
}


function createUploadModal(client, userId) {
    const modal = document.getElementById('upload-modal');
    const closeBtn = document.getElementById('close-upload-modal');
    const cancelBtn = document.getElementById('cancel-upload-modal');
    const form = document.getElementById('upload-receipt-form');
    const fileInput = document.getElementById('modal-file-input');
    const fileNameDisplay = document.getElementById('file-name-display');
    const miniDropZone = document.getElementById('modal-drop-zone');
    const linkedItemSelect = document.getElementById('linked-item-select');

    if (!modal || !form) {
        return { open: () => { }, setFile: () => { } };
    }

    const receiptNameInput = form.querySelector('[name="receipt_name"]');
    const amountInput = form.querySelector('[name="amount"]');
    const dateInput = form.querySelector('[name="purchase_date"]');
    const storeInput = form.querySelector('[name="store_name"]');
    const currencySelect = form.querySelector('[name="currency"]');
    const lockIcons = form.querySelectorAll('.lock-icon');
    const linkHint = document.getElementById('link-hint');
    const lockedFields = [receiptNameInput, amountInput, dateInput, storeInput];

    function updateAmountSuffix() {
        const suffix = form.querySelector('.input-with-lock .suffix-hint');
        if (suffix && typeof window.currencySymbol === 'function') {
            suffix.textContent = window.currencySymbol(currencySelect?.value || userDefaultCurrency);
        }
    }
    currencySelect?.addEventListener('change', updateAmountSuffix);

    function updateHintText(locked) {
        if (!linkHint) return;
        const lang = getLang();
        if (locked) {
            linkHint.textContent = lang === 'ru'
                ? '🔒 Данные из товара. Изменить можно в управлении товаром.'
                : '🔒 Data from item. Edit in item management.';
            linkHint.classList.add('locked');
        } else {
            linkHint.textContent = lang === 'ru' ? 'Ручной ввод данных' : 'Manual data entry';
            linkHint.classList.remove('locked');
        }
    }

    function setFieldsLocked(locked) {
        lockedFields.forEach(input => {
            if (!input) return;
            input.readOnly = locked;
            if (input._cdp) input._cdp.setLocked(locked);
        });
        if (currencySelect) currencySelect.disabled = locked;
        lockIcons.forEach(icon => icon.classList.toggle('hidden', !locked));
        updateHintText(locked);
    }

    function fillFromItem(selected) {
        if (selected.dataset.name) receiptNameInput.value = selected.dataset.name;
        if (selected.dataset.price) amountInput.value = selected.dataset.price;
        if (selected.dataset.date) {
            dateInput.value = selected.dataset.date;
            if (dateInput._cdp) dateInput._cdp.syncDisplay();
        }
        if (selected.dataset.store) storeInput.value = selected.dataset.store;
        if (selected.dataset.currency && currencySelect) {
            currencySelect.value = selected.dataset.currency;
            if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
            updateAmountSuffix();
        }
    }

    function clearLockedFields() {
        lockedFields.forEach(input => { if (input && input.readOnly) input.value = ''; });
        if (currencySelect && currencySelect.disabled) {
            currencySelect.value = userDefaultCurrency;
            if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
            updateAmountSuffix();
        }
    }

    function open() {
        modal.classList.add('active');
        document.documentElement.classList.add('modal-open');
        if (dateInput) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            dateInput.value = `${y}-${m}-${d}`;
            if (dateInput._cdp) dateInput._cdp.syncDisplay();
        }
        if (currencySelect) {
            currencySelect.value = userDefaultCurrency;
            if (typeof CustomSelect !== 'undefined') CustomSelect.refreshAll();
        }
        updateAmountSuffix();
    }

    function close() {
        if (modal.classList.contains('closing')) return;
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.remove('active', 'closing');
            document.documentElement.classList.remove('modal-open');
            form.reset();
            miniDropZone?.classList.remove('has-file');
            setFieldsLocked(false);
            clearLockedFields();
            if (fileNameDisplay) {
                const lang = getLang();
                const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
                fileNameDisplay.textContent = t.upload_select_hint || 'Нажмите для выбора файла (Макс. 10 МБ)';
            }
        }, 250);
    }

    attachModalA11y(modal, { mode: 'active', onClose: close });

    function setFile(file) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileNameDisplay.textContent = file.name;
        miniDropZone?.classList.add('has-file');
    }

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    miniDropZone?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            if (!validateFileSize(fileInput.files[0])) {
                fileInput.value = '';
                return;
            }
            fileNameDisplay.textContent = fileInput.files[0].name;
            miniDropZone?.classList.add('has-file');
        }
    });

    if (linkedItemSelect) {
        linkedItemSelect.addEventListener('change', () => {
            const selected = linkedItemSelect.options[linkedItemSelect.selectedIndex];
            if (!selected || !selected.value) {
                clearLockedFields();
                setFieldsLocked(false);
                return;
            }
            fillFromItem(selected);
            setFieldsLocked(true);
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const originalHTML = btn.innerHTML;
        const lang = getLang();

        if (!fileInput.files.length) {
            showToast(lang === 'ru' ? 'Прикрепите файл чека' : 'Please attach a receipt file', 'warning');
            return;
        }
        if (!validateFileSize(fileInput.files[0])) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const file = fileInput.files[0];
            const safeName = file.name
                .normalize('NFKD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9._-]/g, '_')
                .toLowerCase();
            const filePath = `${userId}/${Date.now()}_${safeName}`;

            const { error: uploadError } = await client.storage
                .from('receipts')
                .upload(filePath, file, { upsert: false });

            if (uploadError) throw uploadError;

            const { data: signedData, error: signError } = await client.storage
                .from('receipts')
                .createSignedUrl(filePath, SIGNED_URL_TTL);

            if (signError) throw signError;

            const receiptName = form.querySelector('[name="receipt_name"]').value.trim();
            const amount = form.querySelector('[name="amount"]').value;
            const purchaseDate = form.querySelector('[name="purchase_date"]').value;
            const storeName = form.querySelector('[name="store_name"]').value.trim();
            const rawItemId = form.querySelector('[name="item_id"]').value;
            const itemId = rawItemId || null;
            const rawAmount = parseFloat(amount);
            const parsedAmount = isNaN(rawAmount) ? null : Math.max(0, rawAmount);

            const { error: dbError } = await client.from('receipts').insert({
                user_id: userId,
                item_id: itemId,
                receipt_name: receiptName,
                file_url: signedData.signedUrl,
                file_path: filePath,
                file_type: file.type,
                amount: parsedAmount,
                purchase_date: purchaseDate,
                store_name: storeName,
                currency: currencySelect?.value || userDefaultCurrency
            });

            if (dbError) {
                await client.storage.from('receipts').remove([filePath]).catch(() => {});
                throw dbError;
            }

            showToast(lang === 'ru' ? 'Чек успешно загружен!' : 'Receipt uploaded successfully!', 'success');
            close();
            await loadAllReceipts(currentUserEmail, userId, client);

        } catch (err) {
            logError('receipts:upload', err);
            showToast(lang === 'ru' ? `Ошибка: ${err.message}` : `Error: ${err.message}`, 'error');
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    });

    return { open, setFile };
}

initReceipts().catch(e => {
    logError('init:receipts', e);
    const lang = getLang();
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
    const msg = t.load_error || (lang === 'ru' ? 'Ошибка загрузки. Обновите страницу.' : 'Load error. Please refresh.');
    const el = document.querySelector('.main-content');
    if (el) el.innerHTML = `<p class="empty-state error">${msg}</p>`;
});