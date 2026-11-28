// Lazy-loaded CSV / Excel product catalog importer for Business Panel

import { escapeHtml } from './security.js';
import { attachModalA11y } from './modal-a11y.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 2000;
const INSERT_BATCH_SIZE = 100;
const UPDATE_CONCURRENCY = 10;
const XLSX_CDN_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

let xlsxLoadPromise = null;

function ensureXlsxLoaded() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxLoadPromise) return xlsxLoadPromise;
    xlsxLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = XLSX_CDN_URL;
        script.async = true;
        script.onload = () => {
            if (window.XLSX) resolve(window.XLSX);
            else {
                xlsxLoadPromise = null;
                reject(new Error('XLSX library failed to initialize'));
            }
        };
        script.onerror = () => {
            xlsxLoadPromise = null;
            reject(new Error('Failed to load Excel parser'));
        };
        document.head.appendChild(script);
    });
    return xlsxLoadPromise;
}

function detectDelimiter(headerLine) {
    let commas = 0;
    let semis = 0;
    let tabs = 0;
    let inQuotes = false;
    for (let i = 0; i < headerLine.length; i++) {
        const ch = headerLine[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (!inQuotes) {
            if (ch === ',') commas++;
            else if (ch === ';') semis++;
            else if (ch === '\t') tabs++;
        }
    }
    if (semis >= commas && semis >= tabs && semis > 0) return ';';
    if (tabs > commas && tabs > semis) return '\t';
    return ',';
}

export function parseCsvText(rawText) {
    const text = String(rawText || '').replace(/^\uFEFF/, '');
    if (!text.trim()) return [];
    const firstBreak = text.search(/\r?\n/);
    const firstLine = firstBreak === -1 ? text : text.slice(0, firstBreak);
    const delimiter = detectDelimiter(firstLine);

    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else {
            if (ch === '"' && field === '') {
                inQuotes = true;
            } else if (ch === delimiter) {
                row.push(field);
                field = '';
            } else if (ch === '\r') {
                if (text[i + 1] === '\n') i++;
                row.push(field);
                field = '';
                if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
                row = [];
            } else if (ch === '\n') {
                row.push(field);
                field = '';
                if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
                row = [];
            } else {
                field += ch;
            }
        }
    }
    row.push(field);
    if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
    return rows;
}

const HEADER_ALIASES = {
    name: [
        'name', 'title', 'product', 'product_name', 'item', 'item_name', 'goods',
        'название', 'наименование', 'товар', 'позиция', 'название товара', 'наименование товара',
    ],
    sku: [
        'sku', 'code', 'article', 'barcode', 'ean', 'upc', 'part_number',
        'артикул', 'код', 'код товара', 'штрихкод', 'штрих-код', 'sku / артикул', 'sku/артикул',
    ],
    price: [
        'price', 'unit_price', 'cost', 'amount', 'retail_price',
        'цена', 'стоимость', 'цена за шт', 'цена, ед.',
    ],
    vat_rate: [
        'vat', 'vat_rate', 'vat %', 'vat%', 'tax', 'tax_rate', 'tax %',
        'ндс', 'ндс %', 'ндс%', 'ставка ндс', 'налог', 'налог %',
    ],
    warranty_months: [
        'warranty', 'warranty_months', 'warranty_m', 'warranty (months)', 'warranty months',
        'гарантия', 'гарантия мес', 'гарантия мес.', 'гарантия (мес)', 'гарантия (мес.)', 'срок гарантии',
    ],
    category: [
        'category', 'type', 'group', 'device_type',
        'категория', 'тип', 'группа',
    ],
};

function normalizeHeader(cell) {
    return String(cell || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');
}

function mapColumns(headerRow) {
    const map = {};
    let matchedCount = 0;
    headerRow.forEach((cell, idx) => {
        const norm = normalizeHeader(cell);
        if (!norm) return;
        for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
            if (map[field] !== undefined) continue;
            if (aliases.some((a) => normalizeHeader(a) === norm)) {
                map[field] = idx;
                matchedCount++;
                break;
            }
        }
    });
    return { map, matchedCount };
}

function buildCategoryLookup() {
    const lookup = new Map();
    if (typeof window.deviceTypeList === 'function') {
        ['en', 'ru'].forEach((lang) => {
            window.deviceTypeList(lang, { noEmoji: true }).forEach(({ value, label }) => {
                lookup.set(String(value).toLowerCase(), value);
                lookup.set(String(label).trim().toLowerCase(), value);
            });
        });
    }
    return lookup;
}

function parseNumberCell(raw) {
    if (raw === null || raw === undefined) return { empty: true, value: 0 };
    if (typeof raw === 'number') {
        return Number.isFinite(raw) ? { empty: false, value: raw } : { empty: false, value: NaN };
    }
    let s = String(raw).trim();
    if (!s) return { empty: true, value: 0 };
    // Strip spaces (including NBSP), currency symbols, and percent signs
    s = s.replace(/[\s\u00A0\u202F%€$£₽₴₸¥]+/g, '');
    // Handle "1,234.56" vs "1.234,56" vs "149,90"
    if (s.includes(',') && s.includes('.')) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            s = s.replace(/,/g, '');
        }
    } else if (s.includes(',')) {
        s = s.replace(',', '.');
    }
    const num = Number(s);
    return { empty: false, value: num };
}

function parseRowsToCatalogEntries(rawRows, existingProducts, lang) {
    if (!rawRows || rawRows.length === 0) {
        return { error: lang === 'en' ? 'File is empty' : 'Файл пустой' };
    }

    const { map, matchedCount } = mapColumns(rawRows[0]);
    let dataStartIndex = 1;
    let colMap = map;

    if (matchedCount === 0 || colMap.name === undefined) {
        return {
            error: lang === 'en'
                ? 'Could not detect column headers. Include at least a "Name" (or "Название") column, or download our template.'
                : 'Не удалось распознать заголовки колонок. Добавьте хотя бы колонку «Название» (или «Name»), либо скачайте шаблон.',
        };
    }

    const dataRows = rawRows.slice(dataStartIndex);
    if (dataRows.length === 0) {
        return { error: lang === 'en' ? 'No data rows found under headers' : 'После заголовков нет строк с товарами' };
    }
    if (dataRows.length > MAX_ROWS) {
        return {
            error: lang === 'en'
                ? `Too many rows (${dataRows.length}). Maximum is ${MAX_ROWS} per import.`
                : `Слишком много строк (${dataRows.length}). Максимум за один импорт — ${MAX_ROWS}.`,
        };
    }

    const categoryLookup = buildCategoryLookup();

    // Index existing products by SKU (preferred) and lowercase Name
    const existingBySku = new Map();
    const existingByName = new Map();
    (existingProducts || []).forEach((p) => {
        const skuKey = String(p.sku || '').trim().toLowerCase();
        const nameKey = String(p.name || '').trim().toLowerCase();
        if (skuKey) existingBySku.set(skuKey, p);
        if (nameKey) existingByName.set(nameKey, p);
    });

    const seenInFileSku = new Set();
    const seenInFileName = new Set();

    const newItems = [];
    const duplicateItems = [];
    const rowErrors = [];

    dataRows.forEach((cells, i) => {
        const rowNum = i + 2; // 1-based Excel row (row 1 = headers)
        const getCell = (field) => (colMap[field] !== undefined ? cells[colMap[field]] : '');

        const name = String(getCell('name') ?? '').trim().slice(0, 200);
        if (!name) {
            rowErrors.push({
                row: rowNum,
                reason: lang === 'en' ? 'Missing product name' : 'Не указано название товара',
            });
            return;
        }

        const sku = String(getCell('sku') ?? '').trim().slice(0, 80);

        const priceParsed = parseNumberCell(getCell('price'));
        const priceVal = priceParsed.empty ? 0 : priceParsed.value;
        if (!Number.isFinite(priceVal) || priceVal < 0 || priceVal > 999999999) {
            rowErrors.push({
                row: rowNum,
                reason: lang === 'en' ? `Invalid price ("${getCell('price')}")` : `Некорректная цена («${getCell('price')}»)`,
            });
            return;
        }

        const vatParsed = parseNumberCell(getCell('vat_rate'));
        const vatVal = vatParsed.empty ? 0 : vatParsed.value;
        if (!Number.isFinite(vatVal) || vatVal < 0 || vatVal > 100) {
            rowErrors.push({
                row: rowNum,
                reason: lang === 'en' ? `VAT must be 0–100% ("${getCell('vat_rate')}")` : `НДС должен быть от 0 до 100% («${getCell('vat_rate')}»)`,
            });
            return;
        }

        const warParsed = parseNumberCell(getCell('warranty_months'));
        const warVal = warParsed.empty ? 0 : Math.round(warParsed.value);
        if (!Number.isFinite(warVal) || warVal < 0 || warVal > 600) {
            rowErrors.push({
                row: rowNum,
                reason: lang === 'en' ? `Warranty must be 0–600 months ("${getCell('warranty_months')}")` : `Гарантия должна быть 0–600 мес. («${getCell('warranty_months')}»)`,
            });
            return;
        }

        const rawCat = String(getCell('category') ?? '').trim().toLowerCase();
        const category = rawCat ? (categoryLookup.get(rawCat) || '') : '';

        const skuKey = sku.toLowerCase();
        const nameKey = name.toLowerCase();

        // Intra-file deduplication
        if ((skuKey && seenInFileSku.has(skuKey)) || (!skuKey && seenInFileName.has(nameKey))) {
            rowErrors.push({
                row: rowNum,
                reason: lang === 'en' ? `Duplicate row in file ("${name}")` : `Дубликат внутри файла («${name}»)`,
            });
            return;
        }
        if (skuKey) seenInFileSku.add(skuKey);
        seenInFileName.add(nameKey);

        const item = {
            rowNum,
            name,
            sku,
            price: Math.round(priceVal * 100) / 100,
            vat_rate: Math.round(vatVal * 100) / 100,
            warranty_months: warVal,
            category,
        };

        const existingMatch = (skuKey && existingBySku.get(skuKey)) || existingByName.get(nameKey);
        if (existingMatch) {
            duplicateItems.push({ ...item, existingId: existingMatch.id });
        } else {
            newItems.push(item);
        }
    });

    return { newItems, duplicateItems, rowErrors };
}

function downloadCsvTemplate(lang) {
    const isRu = lang !== 'en';
    const sep = isRu ? ';' : ',';
    const headers = isRu
        ? ['Название', 'SKU', 'Цена', 'НДС %', 'Гарантия мес.', 'Категория']
        : ['Name', 'SKU', 'Price', 'VAT %', 'Warranty months', 'Category'];
    const samples = isRu
        ? [
            ['iPhone 16 Pro 256GB', 'APL-16P-256', '1199.00', '20', '12', 'Смартфон'],
            ['AirPods Pro 2', 'APL-APP2', '249.50', '20', '12', 'Наушники'],
            ['Защитное стекло 3D', 'ACC-GL-01', '19.90', '20', '0', 'Другое'],
        ]
        : [
            ['iPhone 16 Pro 256GB', 'APL-16P-256', '1199.00', '20', '12', 'Phone'],
            ['AirPods Pro 2', 'APL-APP2', '249.50', '20', '12', 'Headphones'],
            ['3D Screen Protector', 'ACC-GL-01', '19.90', '20', '0', 'Other'],
        ];

    const escapeCell = (v) => {
        const s = String(v ?? '');
        if (s.includes(sep) || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    const lines = [headers, ...samples].map((r) => r.map(escapeCell).join(sep)).join('\r\n');
    const blob = new Blob(['\uFEFF' + lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isRu ? 'valuon-catalog-template-ru.csv' : 'valuon-catalog-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let initialized = false;
let controller = null;

export function openCatalogFileImportModal(ctx) {
    const modal = document.getElementById('catalog-file-import-modal');
    if (!modal) return;

    if (!initialized) {
        initialized = true;
        controller = createController(modal);
    }
    controller.open(ctx);
}

function createController(modal) {
    const closeBtn = document.getElementById('close-catalog-file-import');
    const cancelBtn = document.getElementById('cancel-catalog-file-import');
    const confirmBtn = document.getElementById('confirm-catalog-file-import');
    const confirmLabel = document.getElementById('confirm-catalog-file-import-label');
    const dropzone = document.getElementById('catalog-file-dropzone');
    const fileInput = document.getElementById('catalog-file-input');
    const templateBtn = document.getElementById('catalog-download-template-btn');
    const fileChip = document.getElementById('catalog-file-selected');
    const fileNameEl = document.getElementById('catalog-file-name');
    const fileClearBtn = document.getElementById('catalog-file-clear');
    const errorBanner = document.getElementById('catalog-file-error');
    const summaryEl = document.getElementById('catalog-file-summary');
    const dupModeWrap = document.getElementById('catalog-file-dup-mode');
    const previewWrap = document.getElementById('catalog-file-preview-wrap');
    const previewBody = document.getElementById('catalog-file-preview-body');
    const errorsWrap = document.getElementById('catalog-file-errors-wrap');
    const errorsList = document.getElementById('catalog-file-errors-list');

    let currentCtx = null;
    let parsedState = null; // { newItems, duplicateItems, rowErrors }
    let duplicateMode = 'skip'; // 'skip' | 'update'
    let isImporting = false;

    const getLang = () => (currentCtx?.getLang ? currentCtx.getLang() : (window.getValuonLang ? window.getValuonLang() : 'en'));
    const getT = () => (currentCtx?.getT ? currentCtx.getT() : (window.businessTranslations?.[getLang()] || {}));

    function resetState() {
        parsedState = null;
        duplicateMode = 'skip';
        if (fileInput) fileInput.value = '';
        if (fileChip) fileChip.classList.add('is-hidden');
        if (dropzone) dropzone.classList.remove('is-hidden', 'is-dragover');
        if (errorBanner) {
            errorBanner.textContent = '';
            errorBanner.classList.add('is-hidden');
        }
        if (summaryEl) {
            summaryEl.innerHTML = '';
            summaryEl.classList.add('is-hidden');
        }
        if (dupModeWrap) dupModeWrap.classList.add('is-hidden');
        if (previewWrap) previewWrap.classList.add('is-hidden');
        if (previewBody) previewBody.innerHTML = '';
        if (errorsWrap) errorsWrap.classList.add('is-hidden');
        if (errorsList) errorsList.innerHTML = '';
        modal.querySelectorAll('input[name="catalog-dup-mode"]').forEach((r) => {
            r.checked = r.value === 'skip';
        });
        syncConfirmButton();
    }

    function showError(msg) {
        if (!errorBanner) return;
        errorBanner.textContent = msg;
        errorBanner.classList.remove('is-hidden');
    }

    function getTargetCount() {
        if (!parsedState) return 0;
        return parsedState.newItems.length + (duplicateMode === 'update' ? parsedState.duplicateItems.length : 0);
    }

    function syncConfirmButton() {
        if (!confirmBtn) return;
        const count = getTargetCount();
        const lang = getLang();
        const t = getT();
        confirmBtn.disabled = isImporting || count === 0;
        if (confirmLabel) {
            if (isImporting) {
                confirmLabel.textContent = t.file_importing || (lang === 'en' ? 'Importing...' : 'Импорт...');
            } else if (count > 0) {
                const tpl = t.file_import_confirm_n || (lang === 'en' ? 'Import ({n})' : 'Импортировать ({n})');
                confirmLabel.textContent = tpl.replace('{n}', String(count));
            } else {
                confirmLabel.textContent = t.file_import_confirm || (lang === 'en' ? 'Import' : 'Импортировать');
            }
        }
    }

    function renderParsedPreview() {
        if (!parsedState) return;
        const lang = getLang();
        const fmtMoney = currentCtx?.fmtMoney || ((v) => String(v));
        const { newItems, duplicateItems, rowErrors } = parsedState;

        if (summaryEl) {
            const pills = [];
            pills.push(`<span class="cfi-pill is-ok"><i class="fa-solid fa-plus"></i> ${escapeHtml(lang === 'en' ? `New: ${newItems.length}` : `Новых: ${newItems.length}`)}</span>`);
            if (duplicateItems.length > 0) {
                pills.push(`<span class="cfi-pill is-warn"><i class="fa-solid fa-clone"></i> ${escapeHtml(lang === 'en' ? `Duplicates: ${duplicateItems.length}` : `Дубликатов: ${duplicateItems.length}`)}</span>`);
            }
            if (rowErrors.length > 0) {
                pills.push(`<span class="cfi-pill is-err"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(lang === 'en' ? `Skipped: ${rowErrors.length}` : `С ошибками: ${rowErrors.length}`)}</span>`);
            }
            summaryEl.innerHTML = pills.join('');
            summaryEl.classList.remove('is-hidden');
        }

        if (dupModeWrap) {
            dupModeWrap.classList.toggle('is-hidden', duplicateItems.length === 0);
        }

        const previewRows = duplicateMode === 'update'
            ? [...newItems, ...duplicateItems]
            : newItems;

        if (previewWrap && previewBody) {
            if (previewRows.length > 0) {
                const slice = previewRows.slice(0, 50);
                previewBody.innerHTML = slice.map((it) => {
                    const isUpd = Boolean(it.existingId);
                    const badge = isUpd
                        ? `<span class="cfi-row-badge is-upd">${escapeHtml(lang === 'en' ? 'UPD' : 'ОБН')}</span>`
                        : '';
                    return `<tr>
                        <td class="cfi-td-name">${badge}${escapeHtml(it.name)}${it.sku ? `<span class="cfi-td-sku">${escapeHtml(it.sku)}</span>` : ''}</td>
                        <td class="cfi-td-num">${escapeHtml(fmtMoney(it.price))}</td>
                        <td class="cfi-td-num">${it.vat_rate > 0 ? `${it.vat_rate}%` : '—'}</td>
                        <td class="cfi-td-num">${it.warranty_months > 0 ? `${it.warranty_months}${lang === 'en' ? 'm' : 'м'}` : '—'}</td>
                    </tr>`;
                }).join('') + (previewRows.length > 50
                    ? `<tr><td colspan="4" class="cfi-td-more">${escapeHtml(lang === 'en' ? `...and ${previewRows.length - 50} more` : `...и ещё ${previewRows.length - 50}`)}</td></tr>`
                    : '');
                previewWrap.classList.remove('is-hidden');
            } else {
                previewWrap.classList.add('is-hidden');
            }
        }

        if (errorsWrap && errorsList) {
            if (rowErrors.length > 0) {
                const slice = rowErrors.slice(0, 30);
                errorsList.innerHTML = slice.map((e) =>
                    `<li><strong>${escapeHtml(lang === 'en' ? `Row ${e.row}` : `Строка ${e.row}`)}:</strong> ${escapeHtml(e.reason)}</li>`
                ).join('') + (rowErrors.length > 30
                    ? `<li>${escapeHtml(lang === 'en' ? `...and ${rowErrors.length - 30} more` : `...и ещё ${rowErrors.length - 30}`)}</li>`
                    : '');
                errorsWrap.classList.remove('is-hidden');
            } else {
                errorsWrap.classList.add('is-hidden');
            }
        }

        syncConfirmButton();
    }

    async function handleFile(file) {
        if (!file) return;
        const lang = getLang();
        resetState();

        if (file.size > MAX_FILE_BYTES) {
            showError(lang === 'en' ? 'File is too large (max 5 MB)' : 'Файл слишком большой (максимум 5 МБ)');
            return;
        }

        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (!['csv', 'xlsx', 'xls'].includes(ext)) {
            showError(lang === 'en' ? 'Unsupported format. Please select .csv, .xlsx or .xls' : 'Неподдерживаемый формат. Выберите .csv, .xlsx или .xls');
            return;
        }

        if (fileNameEl) fileNameEl.textContent = file.name;
        if (fileChip) fileChip.classList.remove('is-hidden');
        if (dropzone) dropzone.classList.add('is-hidden');

        try {
            let rawRows;
            if (ext === 'csv') {
                const text = await file.text();
                rawRows = parseCsvText(text);
            } else {
                const XLSX = await ensureXlsxLoaded();
                const buf = await file.arrayBuffer();
                const wb = XLSX.read(buf, { type: 'array' });
                const firstSheetName = wb.SheetNames[0];
                if (!firstSheetName) {
                    showError(lang === 'en' ? 'Excel workbook has no sheets' : 'В файле Excel нет листов');
                    return;
                }
                const sheet = wb.Sheets[firstSheetName];
                rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
                    .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
            }

            const existingProducts = currentCtx?.getProducts ? currentCtx.getProducts() : [];
            const res = parseRowsToCatalogEntries(rawRows, existingProducts, lang);
            if (res.error) {
                showError(res.error);
                return;
            }
            parsedState = res;
            renderParsedPreview();
        } catch (err) {
            console.error('[catalog-import] parse error:', err);
            showError(lang === 'en'
                ? 'Could not read the file. Make sure it is a valid CSV or Excel spreadsheet.'
                : 'Не удалось прочитать файл. Проверьте, что это корректный CSV или Excel.');
        }
    }

    function close() {
        if (modal.classList.contains('is-hidden') || modal.classList.contains('closing')) return;
        if (isImporting) return;
        const catalogModal = document.getElementById('catalog-modal');
        catalogModal?.querySelector('.modal-content')?.classList.remove('is-stacked-behind');
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.add('is-hidden');
            modal.classList.remove('closing');
            modal.setAttribute('aria-hidden', 'true');
            if (document.querySelectorAll('.modal-overlay:not(.is-hidden)').length === 0) {
                document.documentElement.classList.remove('modal-open');
            }
        }, 220);
    }

    async function runImport() {
        if (isImporting || !parsedState || !currentCtx) return;
        const shop = currentCtx.getShop?.();
        const client = currentCtx.getClient?.();
        if (!shop || !client) return;

        const lang = getLang();
        const toInsert = parsedState.newItems;
        const toUpdate = duplicateMode === 'update' ? parsedState.duplicateItems : [];
        if (toInsert.length === 0 && toUpdate.length === 0) return;

        isImporting = true;
        syncConfirmButton();

        try {
            const nowIso = new Date().toISOString();
            const insertedRows = [];
            const updatedMap = new Map();

            // 1. Insert new rows in batches of INSERT_BATCH_SIZE
            for (let i = 0; i < toInsert.length; i += INSERT_BATCH_SIZE) {
                const chunk = toInsert.slice(i, i + INSERT_BATCH_SIZE).map((it) => ({
                    shop_id: shop.id,
                    name: it.name,
                    sku: it.sku,
                    price: it.price,
                    vat_rate: it.vat_rate,
                    warranty_months: it.warranty_months,
                    category: it.category,
                    updated_at: nowIso,
                }));
                const { data, error } = await client
                    .from('shop_products')
                    .insert(chunk)
                    .select();
                if (error) throw error;
                if (Array.isArray(data)) insertedRows.push(...data);
            }

            // 2. Update matched duplicates in controlled chunks
            for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
                const chunk = toUpdate.slice(i, i + UPDATE_CONCURRENCY);
                const results = await Promise.all(
                    chunk.map((it) =>
                        client
                            .from('shop_products')
                            .update({
                                name: it.name,
                                sku: it.sku,
                                price: it.price,
                                vat_rate: it.vat_rate,
                                warranty_months: it.warranty_months,
                                category: it.category,
                                updated_at: nowIso,
                            })
                            .eq('id', it.existingId)
                            .eq('shop_id', shop.id)
                            .select()
                            .single()
                    )
                );
                for (const r of results) {
                    if (r.error) throw r.error;
                    if (r.data) updatedMap.set(r.data.id, r.data);
                }
            }

            currentCtx.onImported?.({ insertedRows, updatedMap });

            const total = insertedRows.length + updatedMap.size;
            const msg = lang === 'en'
                ? `Catalog updated: ${insertedRows.length} added${updatedMap.size ? `, ${updatedMap.size} updated` : ''}`
                : `Ассортимент обновлён: добавлено ${insertedRows.length}${updatedMap.size ? `, обновлено ${updatedMap.size}` : ''}`;
            window.showToast?.(total > 0 ? msg : (lang === 'en' ? 'Nothing imported' : 'Ничего не импортировано'), 'success');

            isImporting = false;
            close();
        } catch (err) {
            console.error('[catalog-import] save error:', err);
            window.showToast?.(
                lang === 'en' ? 'Failed to import catalog' : 'Не удалось импортировать ассортимент',
                'error'
            );
            isImporting = false;
            syncConfirmButton();
        }
    }

    // Event wiring (bound once)
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-backdrop')) close();
    });
    attachModalA11y(modal, { mode: 'hidden', onClose: close });

    templateBtn?.addEventListener('click', () => downloadCsvTemplate(getLang()));
    fileClearBtn?.addEventListener('click', resetState);
    confirmBtn?.addEventListener('click', runImport);

    dropzone?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput?.click();
        }
    });
    dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
    });
    dropzone?.addEventListener('dragleave', () => {
        dropzone.classList.remove('is-dragover');
    });
    dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
        const file = e.dataTransfer?.files?.[0];
        if (file) handleFile(file);
    });
    fileInput?.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (file) handleFile(file);
    });

    modal.querySelectorAll('input[name="catalog-dup-mode"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            duplicateMode = radio.value === 'update' ? 'update' : 'skip';
            renderParsedPreview();
        });
    });

    return {
        open(ctx) {
            currentCtx = ctx;
            resetState();
            const catalogModal = document.getElementById('catalog-modal');
            catalogModal?.querySelector('.modal-content')?.classList.add('is-stacked-behind');
            modal.classList.remove('is-hidden');
            modal.setAttribute('aria-hidden', 'false');
            document.documentElement.classList.add('modal-open');
        },
    };
}
