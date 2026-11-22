// Reusable E.164 phone normalization, formatting, validation and country dial-code picker.
// Used across login, registration, dashboard settings, business receipt issuance and PDF rendering.

export const PHONE_COUNTRIES = [
    { code: 'EE', dial: '+372', ru: 'Эстония', en: 'Estonia', placeholder: '5555 1234', stripTrunkZero: false },
    { code: 'LV', dial: '+371', ru: 'Латвия', en: 'Latvia', placeholder: '2123 4567', stripTrunkZero: false },
    { code: 'LT', dial: '+370', ru: 'Литва', en: 'Lithuania', placeholder: '612 34567', stripTrunkZero: true },
    { code: 'FI', dial: '+358', ru: 'Финляндия', en: 'Finland', placeholder: '40 123 4567', stripTrunkZero: true },
    { code: 'RU', dial: '+7', ru: 'Россия', en: 'Russia', placeholder: '999 123 45 67', stripTrunkZero: false, trunkEight: true },
    { code: 'UA', dial: '+380', ru: 'Украина', en: 'Ukraine', placeholder: '50 123 45 67', stripTrunkZero: true },
    { code: 'BY', dial: '+375', ru: 'Беларусь', en: 'Belarus', placeholder: '29 123 45 67', stripTrunkZero: true },
    { code: 'KZ', dial: '+7', ru: 'Казахстан', en: 'Kazakhstan', placeholder: '701 123 45 67', stripTrunkZero: false, trunkEight: true },
    { code: 'DE', dial: '+49', ru: 'Германия', en: 'Germany', placeholder: '170 1234567', stripTrunkZero: true },
    { code: 'PL', dial: '+48', ru: 'Польша', en: 'Poland', placeholder: '512 345 678', stripTrunkZero: false },
    { code: 'GB', dial: '+44', ru: 'Великобритания', en: 'United Kingdom', placeholder: '7700 900123', stripTrunkZero: true },
    { code: 'US', dial: '+1', ru: 'США', en: 'United States', placeholder: '415 555 2671', stripTrunkZero: false },
    { code: 'CA', dial: '+1', ru: 'Канада', en: 'Canada', placeholder: '416 555 0199', stripTrunkZero: false },
    { code: 'FR', dial: '+33', ru: 'Франция', en: 'France', placeholder: '6 12 34 56 78', stripTrunkZero: true },
    { code: 'ES', dial: '+34', ru: 'Испания', en: 'Spain', placeholder: '612 34 56 78', stripTrunkZero: false },
    { code: 'IT', dial: '+39', ru: 'Италия', en: 'Italy', placeholder: '312 345 6789', stripTrunkZero: false },
    { code: 'NL', dial: '+31', ru: 'Нидерланды', en: 'Netherlands', placeholder: '6 12345678', stripTrunkZero: true },
    { code: 'SE', dial: '+46', ru: 'Швеция', en: 'Sweden', placeholder: '70 123 45 67', stripTrunkZero: true },
    { code: 'NO', dial: '+47', ru: 'Норвегия', en: 'Norway', placeholder: '412 34 567', stripTrunkZero: false },
    { code: 'DK', dial: '+45', ru: 'Дания', en: 'Denmark', placeholder: '20 12 34 56', stripTrunkZero: false },
    { code: 'CZ', dial: '+420', ru: 'Чехия', en: 'Czechia', placeholder: '601 123 456', stripTrunkZero: false },
    { code: 'SK', dial: '+421', ru: 'Словакия', en: 'Slovakia', placeholder: '905 123 456', stripTrunkZero: true },
    { code: 'AT', dial: '+43', ru: 'Австрия', en: 'Austria', placeholder: '664 123456', stripTrunkZero: true },
    { code: 'CH', dial: '+41', ru: 'Швейцария', en: 'Switzerland', placeholder: '79 123 45 67', stripTrunkZero: true },
    { code: 'BE', dial: '+32', ru: 'Бельгия', en: 'Belgium', placeholder: '470 12 34 56', stripTrunkZero: true },
    { code: 'IE', dial: '+353', ru: 'Ирландия', en: 'Ireland', placeholder: '85 123 4567', stripTrunkZero: true },
    { code: 'PT', dial: '+351', ru: 'Португалия', en: 'Portugal', placeholder: '912 345 678', stripTrunkZero: false },
    { code: 'GR', dial: '+30', ru: 'Греция', en: 'Greece', placeholder: '691 234 5678', stripTrunkZero: false },
    { code: 'CY', dial: '+357', ru: 'Кипр', en: 'Cyprus', placeholder: '96 123456', stripTrunkZero: false },
    { code: 'BG', dial: '+359', ru: 'Болгария', en: 'Bulgaria', placeholder: '88 123 4567', stripTrunkZero: true },
    { code: 'RO', dial: '+40', ru: 'Румыния', en: 'Romania', placeholder: '712 345 678', stripTrunkZero: true },
    { code: 'HU', dial: '+36', ru: 'Венгрия', en: 'Hungary', placeholder: '20 123 4567', stripTrunkZero: true },
    { code: 'HR', dial: '+385', ru: 'Хорватия', en: 'Croatia', placeholder: '91 234 5678', stripTrunkZero: true },
    { code: 'SI', dial: '+386', ru: 'Словения', en: 'Slovenia', placeholder: '31 234 567', stripTrunkZero: true },
    { code: 'RS', dial: '+381', ru: 'Сербия', en: 'Serbia', placeholder: '60 1234567', stripTrunkZero: true },
    { code: 'ME', dial: '+382', ru: 'Черногория', en: 'Montenegro', placeholder: '67 123 456', stripTrunkZero: true },
    { code: 'MD', dial: '+373', ru: 'Молдова', en: 'Moldova', placeholder: '68 123 456', stripTrunkZero: true },
    { code: 'GE', dial: '+995', ru: 'Грузия', en: 'Georgia', placeholder: '555 12 34 56', stripTrunkZero: false },
    { code: 'AM', dial: '+374', ru: 'Армения', en: 'Armenia', placeholder: '91 123456', stripTrunkZero: true },
    { code: 'AZ', dial: '+994', ru: 'Азербайджан', en: 'Azerbaijan', placeholder: '50 123 45 67', stripTrunkZero: true },
    { code: 'UZ', dial: '+998', ru: 'Узбекистан', en: 'Uzbekistan', placeholder: '90 123 45 67', stripTrunkZero: false },
    { code: 'KG', dial: '+996', ru: 'Киргизия', en: 'Kyrgyzstan', placeholder: '700 123 456', stripTrunkZero: true },
    { code: 'TJ', dial: '+992', ru: 'Таджикистан', en: 'Tajikistan', placeholder: '90 123 4567', stripTrunkZero: false },
    { code: 'TR', dial: '+90', ru: 'Турция', en: 'Turkey', placeholder: '532 123 45 67', stripTrunkZero: true },
    { code: 'IL', dial: '+972', ru: 'Израиль', en: 'Israel', placeholder: '50 123 4567', stripTrunkZero: true },
    { code: 'AE', dial: '+971', ru: 'ОАЭ', en: 'United Arab Emirates', placeholder: '50 123 4567', stripTrunkZero: true },
    { code: 'SA', dial: '+966', ru: 'Саудовская Аравия', en: 'Saudi Arabia', placeholder: '50 123 4567', stripTrunkZero: true },
    { code: 'IN', dial: '+91', ru: 'Индия', en: 'India', placeholder: '98765 43210', stripTrunkZero: true },
    { code: 'CN', dial: '+86', ru: 'Китай', en: 'China', placeholder: '138 0013 8000', stripTrunkZero: false },
    { code: 'JP', dial: '+81', ru: 'Япония', en: 'Japan', placeholder: '90 1234 5678', stripTrunkZero: true },
    { code: 'KR', dial: '+82', ru: 'Южная Корея', en: 'South Korea', placeholder: '10 1234 5678', stripTrunkZero: true },
    { code: 'SG', dial: '+65', ru: 'Сингапур', en: 'Singapore', placeholder: '8123 4567', stripTrunkZero: false },
    { code: 'TH', dial: '+66', ru: 'Таиланд', en: 'Thailand', placeholder: '81 234 5678', stripTrunkZero: true },
    { code: 'AU', dial: '+61', ru: 'Австралия', en: 'Australia', placeholder: '412 345 678', stripTrunkZero: true },
    { code: 'NZ', dial: '+64', ru: 'Новая Зеландия', en: 'New Zealand', placeholder: '21 123 4567', stripTrunkZero: true },
    { code: 'BR', dial: '+55', ru: 'Бразилия', en: 'Brazil', placeholder: '11 91234 5678', stripTrunkZero: true },
    { code: 'MX', dial: '+52', ru: 'Мексика', en: 'Mexico', placeholder: '55 1234 5678', stripTrunkZero: false },
    { code: 'AR', dial: '+54', ru: 'Аргентина', en: 'Argentina', placeholder: '9 11 2345 6789', stripTrunkZero: true },
    { code: 'ZA', dial: '+27', ru: 'ЮАР', en: 'South Africa', placeholder: '71 123 4567', stripTrunkZero: true },
    { code: 'IS', dial: '+354', ru: 'Исландия', en: 'Iceland', placeholder: '611 1234', stripTrunkZero: false },
    { code: 'LU', dial: '+352', ru: 'Люксембург', en: 'Luxembourg', placeholder: '628 123 456', stripTrunkZero: false },
    { code: 'MT', dial: '+356', ru: 'Мальта', en: 'Malta', placeholder: '9912 3456', stripTrunkZero: false },
];

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

// Sort a copy by descending dial-code length so longest prefix always wins (e.g. +372 before +3)
const DIAL_PREFIX_SORTED = PHONE_COUNTRIES
    .slice()
    .sort((a, b) => b.dial.length - a.dial.length);

export function findPhoneCountry(code) {
    if (!code) return null;
    const upper = String(code).trim().toUpperCase();
    return PHONE_COUNTRIES.find((c) => c.code === upper) || null;
}

export function getDefaultPhoneCountry(preferredIso, lang) {
    if (preferredIso) {
        const match = findPhoneCountry(preferredIso);
        if (match) return match.code;
    }
    return lang === 'en' ? 'EE' : 'EE';
}

export function isValidE164(phone) {
    return typeof phone === 'string' && E164_REGEX.test(phone.trim());
}

export function phoneDigitsKey(str) {
    if (!str) return '';
    return String(str).replace(/\D+/g, '');
}

/**
 * Normalizes a country code (or dial string) + local user input into strict E.164 (e.g. "+37255551234").
 * Returns null if the input is empty or invalid.
 */
export function normalizePhone(countryOrDial, localRaw) {
    const raw = String(localRaw || '').trim();
    if (!raw) return null;

    // Full international format pasted directly: "+372 5555-1234"
    if (raw.startsWith('+')) {
        const digits = raw.replace(/\D+/g, '');
        const candidate = `+${digits}`;
        return E164_REGEX.test(candidate) ? candidate : null;
    }

    // European international prefix "00..."
    if (raw.startsWith('00')) {
        const digits = raw.slice(2).replace(/\D+/g, '');
        const candidate = `+${digits}`;
        return E164_REGEX.test(candidate) ? candidate : null;
    }

    let country = null;
    let dialDigits = '';
    const selector = String(countryOrDial || '').trim();
    if (selector.startsWith('+')) {
        dialDigits = selector.replace(/\D+/g, '');
        country = PHONE_COUNTRIES.find((c) => c.dial === `+${dialDigits}`) || null;
    } else if (selector) {
        country = findPhoneCountry(selector);
        dialDigits = country ? country.dial.replace(/\D+/g, '') : '';
    }

    let localDigits = raw.replace(/\D+/g, '');
    if (!localDigits) return null;

    // Handle RU/KZ national 8-prefix (e.g. 8 999 123-45-67 -> +7 999 123 45 67)
    if (country?.trunkEight && localDigits.length === 11 && localDigits.startsWith('8')) {
        localDigits = localDigits.slice(1);
    } else if (country?.trunkEight && localDigits.length === 11 && localDigits.startsWith('7')) {
        localDigits = localDigits.slice(1);
    } else if (country?.stripTrunkZero && localDigits.startsWith('0') && localDigits.length >= 8) {
        localDigits = localDigits.slice(1);
    }

    if (!dialDigits) {
        const candidate = `+${localDigits}`;
        return E164_REGEX.test(candidate) ? candidate : null;
    }

    const candidate = `+${dialDigits}${localDigits}`;
    return E164_REGEX.test(candidate) ? candidate : null;
}

/**
 * Splits an E.164 phone number into { code, dial, local }.
 */
export function splitPhone(e164, fallbackCode = 'EE') {
    const clean = String(e164 || '').trim();
    if (!clean) {
        const fb = findPhoneCountry(fallbackCode) || PHONE_COUNTRIES[0];
        return { code: fb.code, dial: fb.dial, local: '' };
    }

    const normalized = clean.startsWith('+') ? `+${clean.replace(/\D+/g, '')}` : `+${clean.replace(/\D+/g, '')}`;

    // Special disambiguation for +7 (Kazakhstan starts with +76 or +77)
    if (normalized.startsWith('+7') && normalized.length >= 4) {
        const nextDigit = normalized[2];
        if (nextDigit === '6' || nextDigit === '7') {
            return { code: 'KZ', dial: '+7', local: normalized.slice(2) };
        }
        return { code: 'RU', dial: '+7', local: normalized.slice(2) };
    }

    for (const c of DIAL_PREFIX_SORTED) {
        if (normalized.startsWith(c.dial)) {
            return {
                code: c.code,
                dial: c.dial,
                local: normalized.slice(c.dial.length)
            };
        }
    }

    const fb = findPhoneCountry(fallbackCode) || PHONE_COUNTRIES[0];
    return { code: fb.code, dial: fb.dial, local: normalized.replace(/^\+/, '') };
}

/**
 * Formats an E.164 phone number into a human-friendly spaced string (e.g. "+372 5555 1234").
 */
export function formatPhoneDisplay(e164) {
    if (!e164) return '';
    const clean = String(e164).trim();
    if (!clean.startsWith('+')) return clean;

    const { dial, local } = splitPhone(clean);
    if (!local) return clean;

    if (dial === '+7' && local.length === 10) {
        return `+7 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`;
    }
    if (dial === '+1' && local.length === 10) {
        return `+1 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
    }
    if ((dial === '+372' || dial === '+371') && (local.length === 7 || local.length === 8)) {
        return local.length === 8
            ? `${dial} ${local.slice(0, 4)} ${local.slice(4)}`
            : `${dial} ${local.slice(0, 3)} ${local.slice(3)}`;
    }
    if (dial === '+380' && local.length === 9) {
        return `+380 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
    }

    // Clean generic grouping in chunks of 3 (with trailing 4 if remainder is 1)
    const groups = [];
    let i = 0;
    while (i < local.length) {
        const rem = local.length - i;
        if (rem === 4) {
            groups.push(local.slice(i, i + 2), local.slice(i + 2, i + 4));
            break;
        }
        groups.push(local.slice(i, i + 3));
        i += 3;
    }
    return `${dial} ${groups.join(' ')}`;
}

/**
 * Builds flag emoji safely (omits on Windows where regional indicators render as letters).
 */
function safeFlag(code) {
    if (typeof window !== 'undefined' && typeof window.countryFlag === 'function') {
        return window.countryFlag(code);
    }
    try {
        if (typeof navigator === 'undefined') return '';
        const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
        if (/win/i.test(p)) return '';
        if (!code || !/^[A-Z]{2}$/.test(code)) return '';
        return code.split('').map((ch) => String.fromCodePoint(127397 + ch.charCodeAt(0))).join('');
    } catch (_) {
        return '';
    }
}

/**
 * Populates a <select> element with country dial codes for phone input.
 * Compatible with both native <select> and Valuon's CustomSelect (data-searchable).
 */
export function populateDialCodeSelect(selectEl, lang = 'ru', selectedCode = 'EE') {
    if (!selectEl) return;
    const prevVal = selectEl.value || selectedCode || 'EE';
    const targetCode = findPhoneCountry(prevVal) ? prevVal : (findPhoneCountry(selectedCode) ? selectedCode : 'EE');

    selectEl.innerHTML = '';
    const isRu = lang === 'ru';

    PHONE_COUNTRIES.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.code;
        const name = isRu ? c.ru : c.en;
        const flag = safeFlag(c.code);
        opt.textContent = `${c.code} ${c.dial} · ${name}`;
        opt.setAttribute('data-short-label', flag ? c.dial : `${c.code} ${c.dial}`);
        opt.setAttribute('data-dial', c.dial);
        opt.setAttribute('data-aliases', `${c.ru};${c.en};${c.code};${c.dial};${c.dial.slice(1)}`);
        if (flag) opt.setAttribute('data-icon', flag);
        if (c.code === targetCode) opt.selected = true;
        selectEl.appendChild(opt);
    });

    selectEl.value = targetCode;
    if (selectEl._cs) {
        selectEl._cs.refresh();
    }
}

/**
 * Wires a country <select> + local <input type="tel"> pair:
 * - Updates placeholder based on selected country
 * - Strips invalid characters while typing (allows digits, spaces, +, -, (, ))
 * - If user pastes a full "+..." number, automatically switches country dropdown and fills local part
 */
export function wirePhoneInputPair(selectEl, inputEl, opts = {}) {
    if (!selectEl || !inputEl) return null;

    const updatePlaceholder = () => {
        const c = findPhoneCountry(selectEl.value);
        if (c && c.placeholder) {
            inputEl.placeholder = c.placeholder;
        }
    };

    const syncCustomSelect = () => {
        if (selectEl._cs) {
            selectEl._cs.sync();
        } else if (typeof CustomSelect !== 'undefined' && selectEl.classList.contains('custom-select')) {
            CustomSelect.init(selectEl.parentElement);
        }
    };

    updatePlaceholder();
    syncCustomSelect();

    selectEl.addEventListener('change', () => {
        updatePlaceholder();
        syncCustomSelect();
        if (typeof opts.onChange === 'function') opts.onChange();
    });

    inputEl.addEventListener('input', () => {
        const raw = inputEl.value;
        // Allow user to type/paste international "+..." and auto-detect country code
        if (raw.trim().startsWith('+')) {
            const digits = raw.replace(/\D+/g, '');
            if (digits.length >= 6) {
                const parsed = splitPhone(`+${digits}`, selectEl.value);
                if (parsed.code && findPhoneCountry(parsed.code)) {
                    selectEl.value = parsed.code;
                    inputEl.value = parsed.local;
                    updatePlaceholder();
                    syncCustomSelect();
                }
            }
        } else {
            const cleaned = raw.replace(/[^\d\s\-()+]/g, '');
            if (cleaned !== raw) inputEl.value = cleaned;
        }
        if (typeof opts.onInput === 'function') opts.onInput();
    });

    return {
        getNormalized: () => normalizePhone(selectEl.value, inputEl.value),
        hasInput: () => Boolean(inputEl.value.trim()),
        setFromE164: (e164, fallbackCode) => {
            const parsed = splitPhone(e164, fallbackCode || selectEl.value || 'EE');
            selectEl.value = parsed.code;
            inputEl.value = parsed.local;
            updatePlaceholder();
            syncCustomSelect();
        },
        syncTrigger: syncCustomSelect,
        updatePlaceholder,
    };
}

/**
 * Returns customer contact lines for PDF & detailed cards:
 * - Email is ALWAYS primary when available.
 * - Phone is added as secondary when both exist, or primary when email is absent.
 */
export function getCustomerContactLines(receipt) {
    const email = (receipt?.customer_email || '').trim();
    const phone = receipt?.customer_phone ? formatPhoneDisplay(receipt.customer_phone) : '';
    const lines = [];
    if (email) lines.push(email);
    if (phone) lines.push(phone);
    return lines;
}

/**
 * Returns a single concise display string for ledger rows / headers / subtitles.
 */
export function getCustomerContactSummary(receipt) {
    const lines = getCustomerContactLines(receipt);
    if (lines.length === 0) return '—';
    return lines.join(' · ');
}

/**
 * Escapes a string value for safe double-quoted literal use in PostgREST .or() filters.
 */
function quotePostgrestLiteral(val) {
    const escaped = String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

/**
 * Builds a PostgREST .or() filter matching receipts that belong to this buyer
 * (by permanent customer_user_id, email, or phone) while excluding other customers'
 * receipts when the same user is also a shop owner.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildBuyerReceiptOrFilter({ userId, email, phone }) {
    const clauses = [];
    const cleanUid = String(userId || '').trim();
    if (cleanUid && UUID_REGEX.test(cleanUid)) {
        clauses.push(`customer_user_id.eq.${cleanUid}`);
    }
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail) clauses.push(`customer_email.ilike.${quotePostgrestLiteral(cleanEmail)}`);
    const cleanPhone = (phone || '').trim();
    if (cleanPhone && isValidE164(cleanPhone)) {
        clauses.push(`customer_phone.eq.${quotePostgrestLiteral(cleanPhone)}`);
    }
    return clauses.join(',');
}

/**
 * Safely fetches the authenticated user's E.164 phone from profiles (returns null if not set or column not migrated yet).
 */
export async function fetchCurrentUserPhone(client, userId) {
    if (!client || !userId) return null;
    try {
        const { data, error } = await client
            .from('profiles')
            .select('phone')
            .eq('id', userId)
            .single();
        if (error) return null;
        return data?.phone || null;
    } catch (_) {
        return null;
    }
}

