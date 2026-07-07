import { requireAuth, setupLogout } from './dashboard-auth.js';

let pendingDeleteId = null;
let pendingDeletePath = null;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SIGNED_URL_TTL = 60 * 60; // 1 час

// Состояние текущего пользователя (нужно, чтобы не дёргать requireAuth() повторно)
let currentUserId = null;
let currentUserEmail = null;

// Модалка загрузки инициализируется один раз и переиспользуется
let uploadModal = null;

function getLang() {
    return localStorage.getItem('valuon-lang') || 'ru';
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function initReceipts() {
    const auth = await requireAuth();
    if (!auth) return;

    const { user, client } = auth;
    setupLogout(client);

    currentUserId = user.id;
    currentUserEmail = user.email;

    // Модалка загрузки настраивается один раз за всё время жизни страницы
    uploadModal = createUploadModal(client, currentUserId);
    setupDeleteModal(client, currentUserId);

    await loadAllReceipts(currentUserEmail, currentUserId, client);
    await populateItemSelect(currentUserId, client);

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(getLang());
    }
}

// ФИКС #4: сохранённая в БД file_url (signed URL) может быть устаревшей/истёкшей.
// Перед рендером всегда перевыпускаем свежую подписанную ссылку по file_path.
async function attachFreshSignedUrls(receipts, client) {
    return Promise.all(receipts.map(async (r) => {
        if (!r.file_path) return r;
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
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    mainContent.innerHTML = '<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';

    try {
        const { data: businessData, error: bizError } = await client
            .from('business_receipts')
            .select('*')
            .eq('customer_email', userEmail)
            .order('purchase_date', { ascending: false });

        if (bizError) console.error('business_receipts error:', bizError);

        const { data: personalData, error: personalError } = await client
            .from('receipts')
            .select('*, items(name, price, purchase_date, store_name)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (personalError) throw personalError;

        const personalWithFreshUrls = await attachFreshSignedUrls(personalData || [], client);

        renderSplitReceipts(businessData || [], personalWithFreshUrls, client, userId);
    } catch (e) {
        console.error(e);
        mainContent.innerHTML = '<p class="empty-state error">Ошибка загрузки данных.</p>';
    }
}

function renderSplitReceipts(businessReceipts, personalReceipts, client, userId) {
    const mainContent = document.querySelector('.main-content');
    const lang = getLang();
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    let html = `
        <header class="content-header">
            <h1 data-i18n="nav_receipts">Чеки и документы</h1>
            <button class="btn btn-primary" id="upload-receipt-btn">
                <i class="fa-solid fa-upload"></i> <span data-i18n="btn_upload">Загрузить чек</span>
            </button>
        </header>
        <div class="upload-zone" id="drop-zone">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <p data-i18n="upload_title">Перетащите фото чека сюда</p>
            <span data-i18n="upload_hint">или нажмите для выбора файла • JPG, PNG, PDF • Макс. 10 МБ</span>
        </div>
    `;

    html += `<section class="items-section business-section">`;
    html += `<h2><i class="fa-solid fa-store" style="color: var(--primary); margin-right: 8px;"></i> ${t.section_business_receipts || 'Чеки от партнеров'}</h2>`;

    if (businessReceipts.length === 0) {
        html += `<div class="empty-state" data-animate="zoom">
            <div class="empty-icon"><i class="fa-solid fa-store"></i></div>
            <h3>${lang === 'ru' ? 'Пока нет чеков от партнёров' : 'No business receipts yet'}</h3>
            <p>${lang === 'ru' ? 'Как только магазин-партнёр Valuon выпишет чек на ваш email, он появится здесь автоматически.' : 'Once a Valuon partner store issues a receipt to your email, it will appear here automatically.'}</p>
        </div>`;
    } else {
        html += `<div class="receipts-grid">`;
        businessReceipts.forEach(r => { html += renderBusinessCard(r, t); });
        html += `</div>`;
    }
    html += `</section>`;

    html += `<div class="section-divider"></div>`;

    html += `<section class="items-section personal-section">`;
    html += `<h2 data-i18n="section_documents">Ваши документы</h2>`;

    if (personalReceipts.length === 0) {
        html += `<div class="empty-state" data-animate="zoom">
            <div class="empty-icon"><i class="fa-solid fa-receipt"></i></div>
            <h3>${lang === 'ru' ? 'Пока нет загруженных чеков' : 'No personal receipts yet'}</h3>
            <p>${lang === 'ru' ? 'Сфотографируйте или загрузите первый чек — он останется здесь навсегда.' : 'Photograph or upload your first receipt — it will stay here for good.'}</p>
            <button type="button" class="btn btn-outline empty-state-cta" id="empty-upload-receipt-btn">
                <i class="fa-solid fa-upload"></i> ${lang === 'ru' ? 'Загрузить чек' : 'Upload receipt'}
            </button>
        </div>`;
    } else {
        html += `<div class="receipts-grid">`;
        const flatData = personalReceipts.map(r => ({
            ...r,
            item_name: r.items?.name || null,
            display_name: r.items?.name || r.receipt_name || r.store_name || 'Untitled Receipt',
            display_amount: r.items?.price || r.amount,
            display_date: r.items?.purchase_date || r.purchase_date,
            display_store: r.items?.store_name || r.store_name,
            is_linked: !!r.items
        }));

        flatData.forEach(r => { html += renderPersonalCard(r, t); });
        html += `</div>`;
    }
    html += `</section>`;

    mainContent.innerHTML = html;
    restoreListeners(client, userId);

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(lang);
    }
}

function renderBusinessCard(r, t) {
    const dateStr = new Date(r.purchase_date).toLocaleDateString(getLang() === 'ru' ? 'ru-RU' : 'en-US');
    const shopBadge = r.shop_name
        ? `<div class="shop-badge"><i class="fa-solid fa-store"></i> ${escapeHtml(r.shop_name)}</div>`
        : '';

    return `
        <div class="receipt-card business-card">
            <div class="receipt-header">
                <div class="receipt-icon"><i class="fa-solid fa-file-invoice-dollar"></i></div>
                <div class="item-status-badge active" data-i18n="status_business_verified">${t.status_business_verified || 'Verified'}</div>
            </div>
            ${shopBadge}
            <div class="receipt-info">
                <h3>${escapeHtml(r.item_name || 'Digital Receipt')}</h3>
                <p>${escapeHtml(r.customer_email)}</p>
            </div>
            <div class="receipt-meta">
                <span class="tag"><i class="fa-solid fa-tag"></i> $${parseFloat(r.gross_total || 0).toFixed(2)}</span>
                <span class="tag"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                <span class="tag"><i class="fa-solid fa-hashtag"></i> ${escapeHtml(String(r.id).slice(0, 8).toUpperCase())}</span>
            </div>
            <div class="receipt-actions">
                <button class="btn-action primary btn-download-biz" data-receipt-id="${escapeHtml(r.id)}" title="${t.btn_download || 'Скачать'}">
                    <i class="fa-solid fa-download"></i> <span>${t.btn_download || 'Скачать'}</span>
                </button>
            </div>
        </div>
    `;
}

function renderPersonalCard(r, t) {
    const isPdf = r.file_type === 'application/pdf';
    const isImage = r.file_type && r.file_type.startsWith('image/');
    const iconClass = isPdf ? 'fa-file-pdf' : isImage ? 'fa-file-image' : 'fa-file-invoice';
    const tags = [];

    if (r.display_amount) tags.push(`<span class="tag"><i class="fa-solid fa-tag"></i> $${parseFloat(r.display_amount).toFixed(2)}</span>`);
    if (r.display_date) {
        const date = new Date(r.display_date).toLocaleDateString(getLang() === 'ru' ? 'ru-RU' : 'en-US');
        tags.push(`<span class="tag"><i class="fa-regular fa-calendar"></i> ${date}</span>`);
    }
    if (r.display_store) tags.push(`<span class="tag"><i class="fa-solid fa-store"></i> ${escapeHtml(r.display_store)}</span>`);
    if (r.is_linked) tags.push(`<span class="tag"><i class="fa-solid fa-link"></i> ${escapeHtml(r.item_name)}</span>`);

    return `
        <div class="receipt-card">
            <div class="receipt-header">
                <div class="receipt-icon"><i class="fa-solid ${iconClass}"></i></div>
                <div class="item-status-badge ${r.status === 'verified' ? 'active' : 'warning'}">${r.status === 'verified' ? (t.status_verified || 'Проверен') : (t.status_pending || 'Обработка')}</div>
            </div>
            <div class="receipt-info">
                <h3>${escapeHtml(r.display_name)}</h3>
            </div>
            <div class="receipt-meta">${tags.join('')}</div>
            <div class="receipt-actions">
                <button class="btn-action primary btn-view-receipt"
                        data-url="${escapeHtml(r.file_url)}"
                        title="${t.btn_view || 'Просмотр'}">
                    <i class="fa-solid fa-eye"></i> <span>${t.btn_view || 'Просмотр'}</span>
                </button>
                <button class="btn-action secondary btn-download-receipt" data-url="${escapeHtml(r.file_url)}" data-name="${escapeHtml(r.display_name)}" title="${t.btn_download || 'Скачать'}">
                    <i class="fa-solid fa-download"></i> <span>${t.btn_download || 'Скачать'}</span>
                </button>
                <button class="btn-action danger btn-delete-receipt" data-id="${escapeHtml(r.id)}" data-path="${escapeHtml(r.file_path)}" title="${t.btn_delete || 'Удалить'}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

// Обработчики для карточек, которые пересоздаются при каждом рендере.
// Внутренности самих модалок сюда НЕ входят — они настраиваются один раз (см. createUploadModal / setupDeleteModal).
function restoreListeners(client, userId) {
    const lang = getLang();

    document.querySelectorAll('.btn-view-receipt').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.url) window.open(btn.dataset.url, '_blank');
        });
    });

    // ФИКС #6: cross-origin ссылки игнорируют атрибут download в браузере,
    // поэтому качаем файл как blob и скачиваем локальный object URL.
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
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            } catch (err) {
                console.error(err);
                showToast(lang === 'ru' ? 'Не удалось скачать файл' : 'Failed to download file', 'error');
            } finally {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }
        });
    });

    // ФИКС #1: генератор PDF подключается динамически и только по клику.
    // Если модуль ещё не создан — страница чеков всё равно работает,
    // падает только эта конкретная кнопка с понятной ошибкой.
    document.querySelectorAll('.btn-download-biz').forEach(btn => {
        btn.addEventListener('click', async () => {
            const originalHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                const { downloadReceiptPDF } = await import('./receipt-generator.js');
                const { data: receipt, error } = await client
                    .from('business_receipts')
                    .select('*')
                    .eq('id', btn.dataset.receiptId)
                    .eq('customer_email', currentUserEmail)
                    .single();

                if (error || !receipt) throw error || new Error('Receipt not found');

                const mockShop = {
                    shop_name: receipt.shop_name || 'Partner Store',
                    address: receipt.address || '',
                    tax_id: receipt.tax_id || ''
                };
                downloadReceiptPDF(receipt, mockShop);
            } catch (e) {
                console.error('PDF generation error:', e);
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
            pendingDeletePath = btn.dataset.path;
            document.getElementById('delete-receipt-modal')?.classList.add('active');
        });
    });

    // Кнопка и drop-zone открытия модалки пересоздаются при каждом рендере —
    // перепривязываем только САМ триггер открытия, не трогая внутренности модалки.
    if (uploadModal) {
        document.getElementById('upload-receipt-btn')?.addEventListener('click', uploadModal.open);
        document.getElementById('empty-upload-receipt-btn')?.addEventListener('click', uploadModal.open);

        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('click', uploadModal.open);
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
                    uploadModal.open();
                    uploadModal.setFile(files[0]);
                }
            });
        }
    }
}

async function populateItemSelect(userId, client) {
    const select = document.getElementById('linked-item-select');
    if (!select) return;

    const { data } = await client
        .from('items')
        .select('id, name, price, purchase_date, store_name')
        .eq('user_id', userId)
        .order('name');

    if (data) {
        data.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = item.name;
            opt.dataset.price = item.price || '';
            opt.dataset.date = item.purchase_date || '';
            opt.dataset.store = item.store_name || '';
            opt.dataset.name = item.name || '';
            select.appendChild(opt);
        });
    }
}

// Модалка удаления: внутренности (confirm/cancel/фон) настраиваются один раз за сессию.
function setupDeleteModal(client, userId) {
    const modal = document.getElementById('delete-receipt-modal');
    const confirmBtn = document.getElementById('confirm-delete-receipt');
    const cancelBtn = document.getElementById('cancel-delete-receipt');

    function closeDeleteModal() {
        modal?.classList.remove('active');
        pendingDeleteId = null;
        pendingDeletePath = null;
    }

    cancelBtn?.addEventListener('click', closeDeleteModal);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeDeleteModal(); });

    confirmBtn?.addEventListener('click', async () => {
        if (!pendingDeleteId) return;

        const lang = getLang();
        const originalHTML = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            if (pendingDeletePath) {
                const { error: storageError } = await client.storage
                    .from('receipts')
                    .remove([pendingDeletePath]);

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

            // ФИКС #3: раньше здесь был вызов несуществующей loadReceipts(...)
            await loadAllReceipts(currentUserEmail, userId, client);

        } catch (err) {
            console.error(err);
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

// Модалка загрузки: создаётся и настраивается РОВНО ОДИН РАЗ за жизнь страницы.
// Возвращает { open, setFile } — их переиспользует restoreListeners() при каждом рендере,
// вместо того чтобы навешивать обработчики на форму заново (ФИКС #2).
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
    const lockIcons = form.querySelectorAll('.lock-icon');
    const linkHint = document.getElementById('link-hint');
    const lockedFields = [receiptNameInput, amountInput, dateInput, storeInput];

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
        lockedFields.forEach(input => { if (input) input.readOnly = locked; });
        lockIcons.forEach(icon => icon.classList.toggle('hidden', !locked));
        updateHintText(locked);
    }

    function fillFromItem(selected) {
        if (selected.dataset.name) receiptNameInput.value = selected.dataset.name;
        if (selected.dataset.price) amountInput.value = selected.dataset.price;
        if (selected.dataset.date) dateInput.value = selected.dataset.date;
        if (selected.dataset.store) storeInput.value = selected.dataset.store;
    }

    function clearLockedFields() {
        lockedFields.forEach(input => { if (input && input.readOnly) input.value = ''; });
    }

    function open() {
        modal.classList.add('active');
    }

    function close() {
        modal.classList.remove('active');
        form.reset();
        miniDropZone?.classList.remove('has-file');
        setFieldsLocked(false);
        clearLockedFields();
        if (fileNameDisplay) {
            const lang = getLang();
            const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
            fileNameDisplay.textContent = t.upload_select_hint || 'Нажмите для выбора файла (Макс. 10 МБ)';
        }
    }

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
            // ФИКС #5: item.id может быть UUID — Number(uuid) даёт NaN. Передаём как есть.
            const itemId = rawItemId || null;

            const { error: dbError } = await client.from('receipts').insert({
                user_id: userId,
                item_id: itemId,
                receipt_name: receiptName,
                file_url: signedData.signedUrl,
                file_path: filePath,
                file_type: file.type,
                amount: parseFloat(amount) || null,
                purchase_date: purchaseDate,
                store_name: storeName,
                status: 'pending'
            });

            if (dbError) throw dbError;

            showToast(lang === 'ru' ? 'Чек успешно загружен!' : 'Receipt uploaded successfully!', 'success');
            close();
            await loadAllReceipts(currentUserEmail, userId, client);

        } catch (err) {
            console.error(err);
            showToast(lang === 'ru' ? `Ошибка: ${err.message}` : `Error: ${err.message}`, 'error');
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    });

    return { open, setFile };
}

initReceipts();