import { logError } from './security.js';

const SUMMARY_TEMPLATES = {
    ru: 'Гарантия истекает: {name}',
    en: 'Warranty expires: {name}'
};

const REMINDER_LABELS = {
    ru: 'Напоминание о гарантии',
    en: 'Warranty reminder'
};

const STORE_LABELS = {
    ru: 'Магазин',
    en: 'Store'
};

const SERIAL_LABELS = {
    ru: 'Серийный номер',
    en: 'Serial number'
};

function currentLang() {
    return localStorage.getItem('valuon-lang') === 'en' ? 'en' : 'ru';
}

function currentT() {
    const lang = currentLang();
    return window.dashboardTranslations?.[lang] || window.dashboardTranslations?.ru || {};
}

function parseDateOnly(dateStr) {
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return null;
    const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

function icsEscape(text) {
    return String(text == null ? '' : text)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function formatDateValue(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}${mm}${dd}`;
}

function formatDateTimeStamp(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function foldICSLine(line) {
    const encoder = new TextEncoder();
    const segments = [];
    let buffer = '';
    let octets = 0;

    for (const ch of line) {
        const size = encoder.encode(ch).length;
        if (buffer && octets + size > 75) {
            segments.push(buffer);
            buffer = ' ';
            octets = 1;
        }
        buffer += ch;
        octets += size;
    }

    if (buffer) segments.push(buffer);
    return segments.join('\r\n');
}

function slugify(text) {
    return String(text || '')
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 40)
        .replace(/^-+|-+$/g, '');
}

export function buildICS(item) {
    const lang = currentLang();
    const endDate = parseDateOnly(item?.warranty_end_date);
    if (!endDate) return null;

    const name = String(item.name || item.item_name || '').trim() || (lang === 'ru' ? 'Товар' : 'Item');
    const store = String(item.store_name || item.shop_name || '').trim();
    const serial = String(item.serial_number || '').trim();

    const summary = SUMMARY_TEMPLATES[lang].replace('{name}', name);

    const descParts = [];
    if (store) descParts.push(`${STORE_LABELS[lang]}: ${store}`);
    if (serial) descParts.push(`${SERIAL_LABELS[lang]}: ${serial}`);
    const description = descParts.map(icsEscape).join('\\n');

    const endPlusOne = new Date(endDate.getTime());
    endPlusOne.setDate(endPlusOne.getDate() + 1);

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:-//Valuon//Valuon Warranty Reminder//${lang.toUpperCase()}`,
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${item.id}@valuon.app`,
        `DTSTAMP:${formatDateTimeStamp(new Date())}`,
        `DTSTART;VALUE=DATE:${formatDateValue(endDate)}`,
        `DTEND;VALUE=DATE:${formatDateValue(endPlusOne)}`,
        `SUMMARY:${icsEscape(summary)}`
    ];
    if (description) lines.push(`DESCRIPTION:${description}`);
    lines.push(
        'BEGIN:VALARM',
        'TRIGGER:-P7D',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsEscape(REMINDER_LABELS[lang])}`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    );

    return lines.map(foldICSLine).join('\r\n') + '\r\n';
}

export function downloadICS(item) {
    const t = currentT();
    const noWarrantyMsg = t.msg_calendar_no_warranty || (currentLang() === 'ru'
        ? 'У этого товара нет гарантии'
        : 'This item has no warranty');

    try {
        const endDate = parseDateOnly(item?.warranty_end_date);
        if (!endDate) {
            showToast(noWarrantyMsg, 'warning');
            return;
        }

        const ics = buildICS(item);
        if (!ics) {
            showToast(noWarrantyMsg, 'warning');
            return;
        }

        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = ['valuon-warranty', formatDateValue(endDate), slugify(item.name || item.item_name || '')].filter(Boolean).join('-') + '.ics';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        showToast(t.calendar_added_toast || 'Событие добавлено в календарь', 'success');
    } catch (err) {
        logError('calendar:export', err);
        showToast(t.msg_calendar_error || (currentLang() === 'ru'
            ? 'Не удалось создать событие календаря'
            : 'Could not create calendar event'), 'error');
    }
}