import { requireAuth } from './dashboard-auth.js';
import { downloadReceiptPDF } from './receipt-generator.js';
import Ed25519Signer, { buildSignaturePayload } from './crypto-signature.js';
import { escapeHtml } from './security.js';

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
        afterDraw: function(chart) {
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
            console.error('Failed to parse cached shop:', e);
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

    // --- Динамические позиции чека ---------------------------------

    function addItemRow() {
        if (!itemsList || !itemTemplate) return;
        const node = itemTemplate.content.firstElementChild.cloneNode(true);
        itemsList.appendChild(node);
        updateRemoveButtonsState();
        updateTotalPreview();
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

            const netTotal = qty * unitPrice;
            const vatAmount = netTotal * (vatRate / 100);
            const grossTotal = netTotal + vatAmount;

            return { itemName, qty, unitPrice, vatRate, warrantyMonths, netTotal, vatAmount, grossTotal, sortOrder: index };
        });
    }

    function updateTotalPreview() {
        if (!totalPreviewEl) return;
        const items = readItemRows();
        const gross = items.reduce((sum, it) => sum + it.grossTotal, 0);
        totalPreviewEl.textContent = `$${gross.toFixed(2)}`;
    }

    itemsList?.addEventListener('input', updateTotalPreview);
    addItemBtn?.addEventListener('click', addItemRow);
    itemsList?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-item');
        if (!btn) return;
        const row = btn.closest('[data-item-row]');
        if (row && itemsList.querySelectorAll('[data-item-row]').length > 1) {
            row.remove();
            updateRemoveButtonsState();
            updateTotalPreview();
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

        if (nameEl) nameEl.textContent = shop.shop_name || 'Без названия';
        if (vatEl) vatEl.textContent = shop.tax_id || '—';
        if (addrEl) addrEl.textContent = shop.address || '—';

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
            .select('id, shop_name, tax_id, address, logo_path, public_key, owner_id')
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
        console.error('Shop load failed:', e);
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
                    .select('id, shop_name, tax_id, address, logo_path, public_key, owner_id')
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
                console.error('Shop creation error:', err);
                const catchLang = localStorage.getItem('valuon-lang') || 'ru';
                window.showToast((catchLang === 'en' ? 'Shop creation error: ' : 'Ошибка создания магазина: ') + err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }
        });
    }

    function toggleModal(show) {
        if (!modal.el) return;

        if (show) {
            if (!currentShop) {
                const toastLang = localStorage.getItem('valuon-lang') || 'ru';
                window.showToast(toastLang === 'en' ? 'Create a shop first' : 'Сначала создайте магазин', 'warning');
                return;
            }

            resetItemRows();
            modal.el.classList.remove('is-hidden');
            document.body.classList.add('modal-open');
            const now = new Date();
            if (forms.receipt?.purchase_date) {
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                const h = String(now.getHours()).padStart(2, '0');
                const min = String(now.getMinutes()).padStart(2, '0');
                forms.receipt.purchase_date.value = `${y}-${m}-${d}T${h}:${min}`;
            }
        } else {
            const el = modal.el;
            if (el.classList.contains('closing')) return;
            el.classList.add('closing');
            setTimeout(() => {
                el.classList.remove('closing');
                el.classList.add('is-hidden');
                document.body.classList.remove('modal-open');
                forms.receipt?.reset();
                resetItemRows();
            }, 250);
        }
    }

    modal.openBtn?.addEventListener('click', () => toggleModal(true));
    modal.closeBtn?.addEventListener('click', () => toggleModal(false));
    modal.cancelBtn?.addEventListener('click', () => toggleModal(false));
    modal.el?.addEventListener('click', (e) => {
        if (e.target === modal.el || e.target.classList.contains('modal-backdrop')) toggleModal(false);
    });

    if (forms.receipt) {
        forms.receipt.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');

            if (btn.disabled) return;
            btn.disabled = true;
            const originalHTML = btn.innerHTML;
            const issueLang = localStorage.getItem('valuon-lang') || 'ru';
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ' + (issueLang === 'en' ? 'Issuing...' : 'Выписка...');

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
                if (items.length === 0 || items.some(it => !it.itemName || it.qty <= 0 || it.warrantyMonths < 0)) {
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

                const { data: emailIsRegistered, error: checkError } = await client
                    .rpc('check_profile_exists', { p_email: email });

                if (checkError) {
                    console.error('Ошибка проверки email покупателя:', checkError);
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
                    logo_path: currentShop.logo_path
                };

                const { data: inserted, error } = await client
                    .from('business_receipts')
                    .insert([payload])
                    .select('id, receipt_number')
                    .single();

                if (error) {
                    const errLang = localStorage.getItem('valuon-lang') || 'ru';
                    window.showToast(errLang === 'en' ? 'Receipt issue error' : 'Ошибка выписки чека', 'error');
                    console.error(error);
                    return;
                }

                const itemRows = items.map(it => ({
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

                const { error: itemsError } = await client.from('receipt_items').insert(itemRows);
                if (itemsError) {
                    // Шапка уже создана и подписана по этим items — без строк в
                    // receipt_items подпись потом невозможно будет перепроверить.
                    // Откатываем шапку, чтобы не оставлять "чек без товаров".
                    console.error('Ошибка сохранения позиций чека:', itemsError);
                    await client.from('business_receipts').delete().eq('id', inserted.id);
                    const errLang = localStorage.getItem('valuon-lang') || 'ru';
                    window.showToast(errLang === 'en' ? 'Receipt issue error' : 'Ошибка выписки чека', 'error');
                    return;
                }

                const succLang = localStorage.getItem('valuon-lang') || 'ru';
                const receiptLabel = inserted?.receipt_number ? ` #RCP-${inserted.receipt_number}` : '';
                window.showToast(succLang === 'en' ? `Receipt${receiptLabel} issued!` : `Чек${receiptLabel} выписан!`, 'success');
                toggleModal(false);
                await refreshDashboard(client, currentShop.id, stats, list);
            } catch (err) {
                console.error('Receipt issue error:', err);
                const errLang = localStorage.getItem('valuon-lang') || 'ru';
                window.showToast(errLang === 'en' ? 'Error issuing receipt' : 'Ошибка выписки чека', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
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
                            console.error('Delete failed:', e);
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
            console.error('Dashboard refresh failed:', e);
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
            label: function(context) {
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
        opts.scales.y.ticks.callback = function(v) { return formatCompactCurrency(v); };
        opts.plugins.tooltip.callbacks = {
            label: function(context) {
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
                beforeDraw: function(chart) {
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
                () => receiptsChartInstance, t.chart_empty || 'Нет данных для графика');
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
            console.error('Receipts chart error:', e);
        }
        updateChangeBadge('change-receipts', aggregated.change);
        updatePeriodLabel('period-receipts', period);
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
                () => revenueChartInstance, t.chart_empty || 'Нет данных для графика');
            revenueChartInstance = null;
            updateChangeBadge('change-revenue', { absolute: 0, percent: 0 });
            return;
        }

        if (revenueChartInstance) { revenueChartInstance.destroy(); revenueChartInstance = null; }

        const chartDef = buildRevenueChartDef(aggregated, t, lang, colors, period, isDark);
        try {
            revenueChartInstance = new Chart(context.ctx, chartDef);
        } catch (e) {
            console.error('Revenue chart error:', e);
        }
        updateChangeBadge('change-revenue', aggregated.change);
        updatePeriodLabel('period-revenue', period);
    }

    function updateChart() {
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

initBusinessPanel().catch(e => console.error('Business panel init failed:', e));