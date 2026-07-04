import { requireAuth, setupLogout } from './dashboard-auth.js';

let pendingDeleteId = null;
let pendingDeletePath = null;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

    await loadReceipts(user.id, client);
    await populateItemSelect(user.id, client);
    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(getLang());
    }
    setupUploadModal(client, user.id);
    setupDeleteModal(client, user.id);
}

async function loadReceipts(userId, client) {
    const grid = document.querySelector('.receipts-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';

    const { data, error } = await client
        .from('receipts')
        .select('*, items(name, price, purchase_date, store_name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        grid.innerHTML = '<p class="empty-state error">Ошибка загрузки чеков.</p>';
        return;
    }

    if (!data || data.length === 0) {
        const lang = getLang();
        grid.innerHTML = `<p class="empty-state">${lang === 'ru' ? 'У вас пока нет загруженных чеков.' : 'No receipts uploaded yet.'}</p>`;
        return;
    }

    const flatData = data.map(r => {
        const linked = r.items != null;
        return {
            ...r,
            item_name: r.items?.name || null,
            display_name: linked ? r.items.name : (r.receipt_name || r.store_name || 'Untitled Receipt'),
            display_amount: linked ? r.items.price : r.amount,
            display_date: linked ? r.items.purchase_date : r.purchase_date,
            display_store: linked ? r.items.store_name : r.store_name,
            is_linked: linked
        };
    });

    renderReceipts(flatData);
}

function renderReceipts(receipts) {
    const grid = document.querySelector('.receipts-grid');
    if (!grid) return;

    const lang = getLang();
    const t = window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};

    grid.innerHTML = receipts.map(r => {
        const isVerified = r.status === 'verified';
        const statusClass = isVerified ? 'active' : 'warning';
        const statusText = isVerified
            ? (t.status_verified || 'Проверен')
            : (t.status_pending || 'Обработка');
        const isPdf = r.file_type === 'application/pdf';
        const isImage = r.file_type && r.file_type.startsWith('image/');
        const iconClass = isPdf ? 'fa-file-pdf' : isImage ? 'fa-file-image' : 'fa-file-invoice';

        const safeName = escapeHtml(r.display_name || 'Untitled Receipt');
        const safeStore = escapeHtml(r.display_store);
        const safeItem = escapeHtml(r.item_name);
        const safeFileUrl = escapeHtml(r.file_url);
        const safeFilePath = escapeHtml(r.file_path);
        const safeId = escapeHtml(r.id);

        const tags = [];
        if (r.display_amount) tags.push(`<span class="tag"><i class="fa-solid fa-tag"></i> $${parseFloat(r.display_amount).toFixed(2)}</span>`);
        if (r.display_date) {
            const date = new Date(r.display_date).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US');
            tags.push(`<span class="tag"><i class="fa-regular fa-calendar"></i> ${date}</span>`);
        }
        if (safeStore) tags.push(`<span class="tag"><i class="fa-solid fa-store"></i> ${safeStore}</span>`);
        if (r.is_linked) tags.push(`<span class="tag"><i class="fa-solid fa-link"></i> ${safeItem}</span>`);

        const btnViewText = t.btn_view || 'Просмотр';
        const btnDownloadText = t.btn_download || 'Скачать';
        const btnDeleteText = t.btn_delete || 'Удалить';

        return `
            <div class="receipt-card">
                <div class="receipt-header">
                    <div class="receipt-icon"><i class="fa-solid ${iconClass}"></i></div>
                    <div class="item-status-badge ${statusClass}" data-i18n="${isVerified ? 'status_verified' : 'status_pending'}">${statusText}</div>                </div>
                <div class="receipt-info">
                    <h3>${safeName}</h3>
                </div>
                <div class="receipt-meta">
                    ${tags.join('')}
                </div>
                <div class="receipt-actions">
                    <a href="${safeFileUrl}" target="_blank" class="btn-action primary" title="${btnViewText}">
                        <i class="fa-solid fa-eye"></i>
                        <span data-i18n="btn_view">${btnViewText}</span>
                    </a>
                    <button class="btn-action secondary btn-download-receipt" data-url="${safeFileUrl}" data-name="${safeName}" title="${btnDownloadText}">
                        <i class="fa-solid fa-download"></i>
                        <span data-i18n="btn_download">${btnDownloadText}</span>
                    </button>
                    <button class="btn-action danger btn-delete-receipt" data-id="${safeId}" data-path="${safeFilePath}" title="${btnDeleteText}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (typeof window.applyDashboardLang === 'function') {
        window.applyDashboardLang(lang);
    }

    grid.querySelectorAll('.btn-download-receipt').forEach(btn => {
        btn.addEventListener('click', async () => {
            const url = btn.dataset.url;
            const name = btn.dataset.name;
            const originalHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                const response = await fetch(url);
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

    grid.querySelectorAll('.btn-delete-receipt').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingDeleteId = btn.dataset.id;
            pendingDeletePath = btn.dataset.path;
            document.getElementById('delete-receipt-modal')?.classList.add('active');
        });
    });
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

            const { error: dbError } = await client
                .from('receipts')
                .delete()
                .eq('id', pendingDeleteId);

            if (dbError) throw dbError;

            showToast(lang === 'ru' ? 'Чек удалён' : 'Receipt deleted', 'success');
            closeDeleteModal();
            await loadReceipts(userId, client);

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

function setupUploadModal(client, userId) {
    const modal = document.getElementById('upload-modal');
    const openBtns = [document.getElementById('upload-receipt-btn')];
    const dropZone = document.getElementById('drop-zone');
    const closeBtn = document.getElementById('close-upload-modal');
    const cancelBtn = document.getElementById('cancel-upload-modal');
    const form = document.getElementById('upload-receipt-form');
    const fileInput = document.getElementById('modal-file-input');
    const fileNameDisplay = document.getElementById('file-name-display');
    const miniDropZone = document.getElementById('modal-drop-zone');
    const linkedItemSelect = document.getElementById('linked-item-select');
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
            linkHint.textContent = lang === 'ru'
                ? 'Ручной ввод данных'
                : 'Manual data entry';
            linkHint.classList.remove('locked');
        }
    }

    function setFieldsLocked(locked) {
        lockedFields.forEach(input => {
            if (input) input.readOnly = locked;
        });
        lockIcons.forEach(icon => {
            if (locked) icon.classList.remove('hidden');
            else icon.classList.add('hidden');
        });
        updateHintText(locked);
    }

    function fillFromItem(selected) {
        if (selected.dataset.name) receiptNameInput.value = selected.dataset.name;
        if (selected.dataset.price) amountInput.value = selected.dataset.price;
        if (selected.dataset.date) dateInput.value = selected.dataset.date;
        if (selected.dataset.store) storeInput.value = selected.dataset.store;
    }

    function clearLockedFields() {
        lockedFields.forEach(input => {
            if (input && input.readOnly) input.value = '';
        });
    }

    function openModal() {
        modal?.classList.add('active');
    }

    function closeModal() {
        modal?.classList.remove('active');
        form?.reset();
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
        miniDropZone.classList.add('has-file');
    }

    openBtns.forEach(btn => btn?.addEventListener('click', openModal));
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    miniDropZone?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            if (!validateFileSize(fileInput.files[0])) {
                fileInput.value = '';
                return;
            }
            fileNameDisplay.textContent = fileInput.files[0].name;
            miniDropZone.classList.add('has-file');
        }
    });

    if (dropZone) {
        dropZone.addEventListener('click', openModal);

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
                openModal();
                setFile(files[0]);
            }
        });
    }

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

    form?.addEventListener('submit', async (e) => {
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

            const { data: { publicUrl } } = client.storage
                .from('receipts')
                .getPublicUrl(filePath);

            const receiptName = form.querySelector('[name="receipt_name"]').value.trim();
            const amount = form.querySelector('[name="amount"]').value;
            const purchaseDate = form.querySelector('[name="purchase_date"]').value;
            const storeName = form.querySelector('[name="store_name"]').value.trim();
            const rawItemId = form.querySelector('[name="item_id"]').value;
            const itemId = rawItemId ? Number(rawItemId) : null;

            const { error: dbError } = await client.from('receipts').insert({
                user_id: userId,
                item_id: itemId,
                receipt_name: receiptName,
                file_url: publicUrl,
                file_path: filePath,
                file_type: file.type,
                amount: parseFloat(amount) || null,
                purchase_date: purchaseDate,
                store_name: storeName,
                status: 'pending'
            });

            if (dbError) throw dbError;

            showToast(lang === 'ru' ? 'Чек успешно загружен!' : 'Receipt uploaded successfully!', 'success');
            closeModal();
            await loadReceipts(userId, client);

        } catch (err) {
            console.error(err);
            showToast(lang === 'ru' ? `Ошибка: ${err.message}` : `Error: ${err.message}`, 'error');
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    });
}

initReceipts();