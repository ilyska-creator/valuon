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
    return (window.getValuonLang ? window.getValuonLang() : 'en');
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

function buildVEventLines(item, lang) {
    const endDate = parseDateOnly(item?.warranty_end_date);
    if (!endDate) return null;

    const name = String(item.name || item.item_name || '').trim() || (lang === 'ru' ? 'Товар' : 'Item');
    const store = String(item.store_name || item.shop_name || '').trim();
    const serial = String(item.serial_number || '').trim();

    const summary = (SUMMARY_TEMPLATES[lang] || SUMMARY_TEMPLATES.en).replace('{name}', name);

    const descParts = [];
    if (store) descParts.push(`${STORE_LABELS[lang] || STORE_LABELS.en}: ${store}`);
    if (serial) descParts.push(`${SERIAL_LABELS[lang] || SERIAL_LABELS.en}: ${serial}`);
    const description = descParts.map(icsEscape).join('\\n');

    const endPlusOne = new Date(endDate.getTime());
    endPlusOne.setDate(endPlusOne.getDate() + 1);

    const safeUidBase = item.id
        ? String(item.id).replace(/[^A-Za-z0-9._-]/g, '')
        : `${formatDateValue(endDate)}-${slugify(item.name || item.item_name || 'item') || 'warranty'}`;

    const today = new Date();
    const daysUntilEnd = Math.round(
        (Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) -
         Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000
    );
    const alarmTrigger = daysUntilEnd >= 7 ? '-P7D' : 'PT9H';

    const lines = [
        'BEGIN:VEVENT',
        `UID:${safeUidBase}@valuon.app`,
        `DTSTAMP:${formatDateTimeStamp(new Date())}`,
        `DTSTART;VALUE=DATE:${formatDateValue(endDate)}`,
        `DTEND;VALUE=DATE:${formatDateValue(endPlusOne)}`,
        `SUMMARY:${icsEscape(summary)}`
    ];
    if (description) lines.push(`DESCRIPTION:${description}`);
    lines.push(
        'BEGIN:VALARM',
        `TRIGGER:${alarmTrigger}`,
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsEscape(REMINDER_LABELS[lang] || REMINDER_LABELS.en)}`,
        'END:VALARM',
        'END:VEVENT'
    );
    return lines;
}

export function buildICS(item) {
    const lang = currentLang();
    const eventLines = buildVEventLines(item, lang);
    if (!eventLines) return null;

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:-//Valuon//Valuon Warranty Reminder//${lang.toUpperCase()}`,
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        ...eventLines,
        'END:VCALENDAR'
    ];

    return lines.map(foldICSLine).join('\r\n') + '\r\n';
}

export function buildBatchICS(items) {
    const lang = currentLang();
    const allEventLines = [];
    let count = 0;

    for (const item of (items || [])) {
        const ev = buildVEventLines(item, lang);
        if (ev) {
            allEventLines.push(...ev);
            count++;
        }
    }
    if (count === 0) return null;

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:-//Valuon//Valuon Warranty Reminders//${lang.toUpperCase()}`,
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        ...allEventLines,
        'END:VCALENDAR'
    ];

    return { content: lines.map(foldICSLine).join('\r\n') + '\r\n', count };
}

export function downloadAllICS(items) {
    const lang = currentLang();
    const t = currentT();
    const notify = (msg, type) => {
        if (typeof showToast === 'function') showToast(msg, type);
    };

    try {
        const result = buildBatchICS(items);
        if (!result || result.count === 0) {
            notify(t.calendar_all_empty || (lang === 'ru' ? 'Нет активных гарантий для экспорта' : 'No active warranties to export'), 'warning');
            return 0;
        }

        const blob = new Blob([result.content], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `valuon-warranties-${formatDateValue(new Date())}.ics`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        const tpl = t.calendar_all_toast || (lang === 'ru'
            ? 'Экспортировано гарантий в календарь: {n}'
            : 'Exported {n} warranties to calendar');
        notify(tpl.replace('{n}', String(result.count)), 'success');
        return result.count;
    } catch (err) {
        logError('calendar:exportAll', err);
        notify(t.msg_calendar_error || (lang === 'ru'
            ? 'Не удалось создать файл календаря'
            : 'Could not create calendar file'), 'error');
        return 0;
    }
}

export function downloadICS(item) {
    const t = currentT();
    const notify = (msg, type) => {
        if (typeof showToast === 'function') showToast(msg, type);
    };
    const noWarrantyMsg = t.msg_calendar_no_warranty || (currentLang() === 'ru'
        ? 'У этого товара нет гарантии'
        : 'This item has no warranty');

    try {
        const endDate = parseDateOnly(item?.warranty_end_date);
        if (!endDate) {
            notify(noWarrantyMsg, 'warning');
            return;
        }

        const ics = buildICS(item);
        if (!ics) {
            notify(noWarrantyMsg, 'warning');
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

        notify(t.calendar_added_toast || (currentLang() === 'ru'
            ? 'Событие добавлено в календарь'
            : 'Event added to your calendar'), 'success');
    } catch (err) {
        logError('calendar:export', err);
        notify(t.msg_calendar_error || (currentLang() === 'ru'
            ? 'Не удалось создать событие календаря'
            : 'Could not create calendar event'), 'error');
    }
}