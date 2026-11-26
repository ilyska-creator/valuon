// Reusable E.164 phone normalization, formatting, validation and country dial-code picker.
// Used across login, registration, dashboard settings, business receipt issuance and PDF rendering.

export const PHONE_COUNTRIES = [
    { code: 'EE', dial: '+372', ru: 'Эстония', en: 'Estonia', placeholder: '5555 1234', stripTrunkZero: false, minLen: 7, maxLen: 8 },
    { code: 'LV', dial: '+371', ru: 'Латвия', en: 'Latvia', placeholder: '2123 4567', stripTrunkZero: false, minLen: 8, maxLen: 8 },
    { code: 'LT', dial: '+370', ru: 'Литва', en: 'Lithuania', placeholder: '612 34567', stripTrunkZero: true, minLen: 8, maxLen: 8 },
    { code: 'FI', dial: '+358', ru: 'Финляндия', en: 'Finland', placeholder: '40 123 4567', stripTrunkZero: true, minLen: 7, maxLen: 10 },
    { code: 'RU', dial: '+7', ru: 'Россия', en: 'Russia', placeholder: '999 123 45 67', stripTrunkZero: false, trunkEight: true, minLen: 10, maxLen: 10 },
    { code: 'UA', dial: '+380', ru: 'Украина', en: 'Ukraine', placeholder: '50 123 45 67', stripTrunkZero: true, minLen: 9, maxLen: 9 },
    { code: 'BY', dial: '+375', ru: 'Беларусь', en: 'Belarus', placeholder: '29 123 45 67', stripTrunkZero: true, minLen: 9, maxLen: 9 },
    { code: 'KZ', dial: '+7', ru: 'Казахстан', en: 'Kazakhstan', placeholder: '701 123 45 67', stripTrunkZero: false, trunkEight: true, minLen: 10, maxLen: 10 },
    { code: 'DE', dial: '+49', ru: 'Германия', en: 'Germany', placeholder: '170 1234567', stripTrunkZero: true, minLen: 7, maxLen: 12 },
    { code: 'PL', dial: '+48', ru: 'Польша', en: 'Poland', placeholder: '512 345 678', stripTrunkZero: false, minLen: 9, maxLen: 9 },
    { code: 'GB', dial: '+44', ru: 'Великобритания', en: 'United Kingdom', placeholder: '7700 900123', stripTrunkZero: true, minLen: 9, maxLen: 10 },
    { code: 'US', dial: '+1', ru: 'США', en: 'United States', placeholder: '415 555 2671', stripTrunkZero: false, minLen: 10, maxLen: 10 },
    { code: 'CA', dial: '+1', ru: 'Канада', en: 'Canada', placeholder: '416 555 0199', stripTrunkZero: false, minLen: 10, maxLen: 10 },
    { code: 'FR', dial: '+33', ru: 'Франция', en: 'France', placeholder: '6 12 34 56 78', stripTrunkZero: true, minLen: 9, maxLen: 9 },
    { code: 'ES', dial: '+34', ru: 'Испания', en: 'Spain', placeholder: '612 34 56 78', stripTrunkZero: false, minLen: 9, maxLen: 9 },
    { code: 'IT', dial: '+39', ru: 'Италия', en: 'Italy', placeholder: '312 345 6789', stripTrunkZero: false, minLen: 8, maxLen: 11 },
    { code: 'NL', dial: '+31', ru: 'Нидерланды', en: 'Netherlands', placeholder: '6 12345678', stripTrunkZero: true, minLen: 9, maxLen: 9 },
    { code: 'SE', dial: '+46', ru: 'Швеция', en: 'Sweden', placeholder: '70 123 45 67', stripTrunkZero: true, minLen: 7, maxLen: 10 },
    { code: 'NO', dial: '+47', ru: 'Норвегия', en: 'Norway', placeholder: '412 34 567', stripTrunkZero: false, minLen: 8, maxLen: 8 },
    { code: 'DK', dial: '+45', ru: 'Дания', en: 'Denmark', placeholder: '20 12 34 56', stripTrunkZero: false, minLen: 8, maxLen: 8 },
    { code: 'CZ', dial: '+420', ru: 'Чехия', en: 'Czechia', placeholder: '601 123 456', stripTrunkZero: false, minLen: 9, maxLen: 9 },
    { code: 'SK', dial: '+421', ru: 'Словакия', en: 'Slovakia', placeholder: '905 123 456', stripTrunkZero: true, minLen: 9, maxLen: 9 },
    { code: 'AT', dial: '+43', ru: 'Австрия', en: 'Austria', placeholder: '664 123456', stripTrunkZero: true, minLen: 7, maxLen: 12 },
    { code: 'CH', dial: '+41', ru: 'Швейцария', en: 'Switzerland', placeholder: '79 123 45 67', stripTrunkZero: true, minLen: 9, maxLen: 9 },
    { code: 'BE', dial: '+32', ru: 'Бельгия', en: 'Belgium', placeholder: '470 12 34 56', stripTrunkZero: true, minLen: 8, maxLen: 9 },
    { code: 'IE', dial: '+353', ru: 'Ирландия', en: 'Ireland', placeholder: '85 123 4567', stripTrunkZero: true, minLen: 7, maxLen: 9 },
    { code: 'PT', dial: '+351', ru: 'Португалия', en: 'Portugal', placeholder: '912 345 678', stripTrunkZero: false, minLen: 9, maxLen: 9 },
    { code: 'GR', dial: '+30', ru: 'Греция', en: 'Greece', placeholder: '691 234 5678', stripTrunkZero: false, minLen: 10, maxLen: 10 },
    { code: 'CY', dial: '+357', ru: 'Кипр', en: 'Cyprus', placeholder: '96 123456', stripTrunkZero: false, minLen: 8, maxLen: 8 },
    { code: 'BG', dial: '+359', ru: 'Болгария', en: 'Bulgaria', placeholder: '88 123 4567', stripTrunkZero: true, minLen: 8, maxLen: 9 },
    { code: 'RO', dial: '+40', ru: 'Румыния', en: 'Romania', placeholder: '712 345 678', stripTrunkZero: true, minLen: 9, maxLen: 9 },
    { code: 'HU', dial: '+36', ru: 'Венгрия', en: 'Hungary', placeholder: '20 123 4567', stripTrunkZero: true, minLen: 8, maxLen: 9 },
    { code: 'HR', dial: '+385', ru: 'Хорватия', en: 'Croatia', placeholder: '91 234 5678', stripTrunkZero: true, minLen: 8, maxLen: 9 },
    { code: 'SI', dial: '+386', ru: 'Словения', en: 'Slovenia', placeholder: '31 234 567', stripTrunkZero: true, minLen: 8, maxLen: 8 },
    { code: 'RS', dial: '+381', ru: 'Сербия', en: 'Serbia', placeholder: '60 1234567', stripTrunkZero: true, minLen: 8, maxLen: 9 },
    { code: 'ME', dial: '+382', ru: 'Черногория', en: 'Montenegro', placeholder: '67 123 456', stripTrunkZero: true, minLen: 8, maxLen: 8 },
    { code: 'MD', dial: '+373', ru: 'Молдова', en: 'Moldova', placeholder: '68 123 456', stripTrunkZero: true, minLen: 8, maxLen: 8 },
    { code: 'GE', dial: '+995', ru: 'Грузия', en: 'Georgia', placeholder: '555 12 34 56', stripTrunkZero: false, minLen: 9, maxLen: 9 },
    { code: 'AM', dial: '+374', ru: 'Армения', en: 'Armenia', placeholder: '91 123456', stripTrunkZero: true, minLen: 8, maxLen: 8 },
    { code: 'AZ', dial: '+994', ru: 'Азербайджан', en: 'Azerbaijan', placeholder: '50 123 45 67', stripTrunkZero: true, minLen: 9, maxLen: 9 },
    { code: 'UZ', dial: '+998', ru: 'Узбекистан', en: 'Uzbekistan', placeholder: '90 123 45 67', stripTrunkZero: false, minLen: 9, maxLen: 9 },
    { code: 'KG', dial: '+996', ru: 'Киргизия', en: 'Kyrgyzstan', placeholder: '700 123 456', stripTrunkZero: true, minLen: 9, maxLen: 9 },
    { code: 'TJ', dial: '+992', ru: 'Таджикистан', en: 'Tajikistan', placeholder: '90 123 4567', stripTrunkZero: false, minLen: 9, maxLen: 9 },
    { code: 'TR', dial: '+90', ru: 'Турция', en: 'Turkey', placeholder: '532 123 45 67', stripTrunkZero: true, minLen: 10, maxLen: 10 },
    { code: 'IL', dial: '+972', ru: 'Израиль', en: 'Israel', placeholder: '50 123 4567', stripTrunkZero: true, minLen: 8, maxLen: 9 },
    { code: 'AE', dial: '+971', ru: 'ОАЭ', en: 'United Arab Emirates', placeholder: '50 123 4567', stripTrunkZero: true, minLen: 8, maxLen: 9 },
    { code: 'SA', dial: '+966', ru: 'Саудовская Аравия', en: 'Saudi Arabia', placeholder: '50 123 4567', stripTrunkZero: true, minLen: 9, maxLen: 9 },
    { code: 'IN', dial: '+91', ru: 'Индия', en: 'India', placeholder: '98765 43210', stripTrunkZero: true, minLen: 10, maxLen: 10 },
    { code: 'CN', dial: '+86', ru: 'Китай', en: 'China', placeholder: '138 0013 8000', stripTrunkZero: false, minLen: 10, maxLen: 11 },
    { code: 'JP', dial: '+81', ru: 'Япония', en: 'Japan', placeholder: '90 1234 5678', stripTrunkZero: true, minLen: 9, maxLen: 10 },
    { code: 'KR', dial: '+82', ru: 'Южная Корея', en: 'South Korea', placeholder: '10 1234 5678', stripTrunkZero: true, minLen: 9, maxLen: 10 },
    { code: 'SG', dial: '+65', ru: 'Сингапур', en: 'Singapore', placeholder: '8123 4567', stripTrunkZero: false, minLen: 8, maxLen: 8 },
    { code: 'TH', dial: '+66', ru: 'Таиланд', en: 'Thailand', placeholder: '81 234 5678', stripTrunkZero: true, minLen: 8, maxLen: 9 },
    { code: 'AU', dial: '+61', ru: 'Австралия', en: 'Australia', placeholder: '412 345 678', stripTrunkZero: true, minLen: 9, maxLen: 9 },
    { code: 'NZ', dial: '+64', ru: 'Новая Зеландия', en: 'New Zealand', placeholder: '21 123 4567', stripTrunkZero: true, minLen: 8, maxLen: 10 },
    { code: 'BR', dial: '+55', ru: 'Бразилия', en: 'Brazil', placeholder: '11 91234 5678', stripTrunkZero: true, minLen: 10, maxLen: 11 },
    { code: 'MX', dial: '+52', ru: 'Мексика', en: 'Mexico', placeholder: '55 1234 5678', stripTrunkZero: false, minLen: 10, maxLen: 10 },
    { code: 'AR', dial: '+54', ru: 'Аргентина', en: 'Argentina', placeholder: '9 11 2345 6789', stripTrunkZero: true, minLen: 10, maxLen: 11 },
    { code: 'ZA', dial: '+27', ru: 'ЮАР', en: 'South Africa', placeholder: '71 123 4567', stripTrunkZero: true, minLen: 9, maxLen: 9 },
    { code: 'IS', dial: '+354', ru: 'Исландия', en: 'Iceland', placeholder: '611 1234', stripTrunkZero: false, minLen: 7, maxLen: 7 },
    { code: 'LU', dial: '+352', ru: 'Люксембург', en: 'Luxembourg', placeholder: '628 123 456', stripTrunkZero: false, minLen: 6, maxLen: 11 },
    { code: 'MT', dial: '+356', ru: 'Мальта', en: 'Malta', placeholder: '9912 3456', stripTrunkZero: false, minLen: 8, maxLen: 8 },
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

export function getDefaultPhoneCountry(preferredIso) {
    if (preferredIso) {
        const match = findPhoneCountry(preferredIso);
        if (match) return match.code;
    }
    return 'EE';
}

export function isValidE164(phone) {
    return typeof phone === 'string' && E164_REGEX.test(phone.trim());
}

export function phoneDigitsKey(str) {
    if (!str) return '';
    return String(str).replace(/\D+/g, '');
}

function isValidLocalLength(country, localDigits) {
    if (!localDigits) return false;
    if (country && country.minLen && country.maxLen) {
        return localDigits.length >= country.minLen && localDigits.length <= country.maxLen;
    }
    return localDigits.length >= 6 && localDigits.length <= 14;
}

function validateInternationalCandidate(candidate) {
    if (!E164_REGEX.test(candidate)) return null;
    const parsed = splitPhone(candidate);
    if (parsed.matched) {
        const matchedCountry = findPhoneCountry(parsed.code);
        if (matchedCountry && !isValidLocalLength(matchedCountry, parsed.local)) {
            if (matchedCountry.stripTrunkZero && parsed.local.startsWith('0')) {
                const stripped = parsed.local.slice(1);
                if (isValidLocalLength(matchedCountry, stripped)) {
                    const normalized = `${parsed.dial}${stripped}`;
                    return E164_REGEX.test(normalized) ? normalized : null;
                }
            }
            return null;
        }
    }
    return candidate;
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
        return validateInternationalCandidate(`+${digits}`);
    }

    // European international prefix "00..."
    if (raw.startsWith('00')) {
        const digits = raw.slice(2).replace(/\D+/g, '');
        return validateInternationalCandidate(`+${digits}`);
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
    } else if (
        dialDigits &&
        localDigits.startsWith(dialDigits) &&
        !isValidLocalLength(country, localDigits) &&
        isValidLocalLength(country, localDigits.slice(dialDigits.length))
    ) {
        // Prevent accidental duplicate country code (e.g. "372 5555 1234" while "+372" is selected)
        localDigits = localDigits.slice(dialDigits.length);
    } else if (country?.stripTrunkZero && localDigits.startsWith('0') && localDigits.length >= (country.minLen || 8)) {
        const withoutZero = localDigits.slice(1);
        if (isValidLocalLength(country, withoutZero)) {
            localDigits = withoutZero;
        }
    }

    if (!dialDigits) {
        return validateInternationalCandidate(`+${localDigits}`);
    }

    if (!isValidLocalLength(country, localDigits)) return null;

    const candidate = `+${dialDigits}${localDigits}`;
    return E164_REGEX.test(candidate) ? candidate : null;
}

/**
 * Splits an E.164 phone number into { code, dial, local, matched }.
 */
export function splitPhone(e164, fallbackCode = 'EE') {
    const clean = String(e164 || '').trim();
    if (!clean) {
        const fb = findPhoneCountry(fallbackCode) || PHONE_COUNTRIES[0];
        return { code: fb.code, dial: fb.dial, local: '', matched: false };
    }

    const normalized = `+${clean.replace(/\D+/g, '')}`;

    // Special disambiguation for +7 (Kazakhstan starts with +76 or +77)
    if (normalized.startsWith('+7') && normalized.length >= 4) {
        const nextDigit = normalized[2];
        if (nextDigit === '6' || nextDigit === '7') {
            return { code: 'KZ', dial: '+7', local: normalized.slice(2), matched: true };
        }
        return { code: 'RU', dial: '+7', local: normalized.slice(2), matched: true };
    }

    for (const c of DIAL_PREFIX_SORTED) {
        if (normalized.startsWith(c.dial)) {
            return {
                code: c.code,
                dial: c.dial,
                local: normalized.slice(c.dial.length),
                matched: true
            };
        }
    }

    const fb = findPhoneCountry(fallbackCode) || PHONE_COUNTRIES[0];
    return { code: fb.code, dial: fb.dial, local: normalized.replace(/^\+/, ''), matched: false };
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

// Country-specific digit grouping templates for as-you-type local formatting
const PHONE_GROUP_PATTERNS = {
    EE: [4, 4],
    LV: [4, 4],
    SG: [4, 4],
    MT: [4, 4],
    LT: [3, 5],
    FI: [2, 3, 4],
    RU: [3, 3, 2, 2],
    KZ: [3, 3, 2, 2],
    TR: [3, 3, 2, 2],
    UA: [2, 3, 2, 2],
    BY: [2, 3, 2, 2],
    SE: [2, 3, 2, 2],
    CH: [2, 3, 2, 2],
    AZ: [2, 3, 2, 2],
    UZ: [2, 3, 2, 2],
    US: [3, 3, 4],
    CA: [3, 3, 4],
    GR: [3, 3, 4],
    IT: [3, 3, 4],
    DE: [3, 4, 4],
    CN: [3, 4, 4],
    PL: [3, 3, 3],
    CZ: [3, 3, 3],
    SK: [3, 3, 3],
    PT: [3, 3, 3],
    RO: [3, 3, 3],
    KG: [3, 3, 3],
    AU: [3, 3, 3],
    LU: [3, 3, 3],
    GB: [4, 3, 3],
    FR: [1, 2, 2, 2, 2],
    ES: [3, 2, 2, 2],
    BE: [3, 2, 2, 2],
    GE: [3, 2, 2, 2],
    NL: [1, 4, 4],
    NO: [3, 2, 3],
    DK: [2, 2, 2, 2],
    IE: [2, 3, 4],
    BG: [2, 3, 4],
    HU: [2, 3, 4],
    HR: [2, 3, 4],
    IL: [2, 3, 4],
    AE: [2, 3, 4],
    SA: [2, 3, 4],
    TH: [2, 3, 4],
    NZ: [2, 3, 4],
    ZA: [2, 3, 4],
    TJ: [2, 3, 4],
    SI: [2, 3, 3],
    ME: [2, 3, 3],
    MD: [2, 3, 3],
    CY: [2, 3, 3],
    AM: [2, 3, 3],
    RS: [2, 3, 4],
    AT: [3, 3, 4],
    IS: [3, 4],
    IN: [5, 5],
    JP: [2, 4, 4],
    KR: [2, 4, 4],
    MX: [2, 4, 4],
    BR: [2, 5, 4],
    AR: [1, 2, 4, 4],
};

function resolvePhoneCountry(countryOrCode) {
    if (!countryOrCode) return null;
    if (typeof countryOrCode === 'object' && countryOrCode.code) return countryOrCode;
    return findPhoneCountry(countryOrCode);
}

function getPhoneGroups(country) {
    if (country && PHONE_GROUP_PATTERNS[country.code]) {
        return PHONE_GROUP_PATTERNS[country.code];
    }
    if (country && country.placeholder) {
        const derived = country.placeholder
            .trim()
            .split(/\s+/)
            .map((part) => part.replace(/\D+/g, '').length)
            .filter((len) => len > 0);
        if (derived.length > 0) return derived;
    }
    return [3, 3, 4];
}

/**
 * Formats a local phone digit string into spaced country groups as the user types.
 * Example: formatLocalPhone('EE', '55551234') -> '5555 1234'
 * Example: formatLocalPhone('RU', '9991234567') -> '999 123 45 67'
 */
export function formatLocalPhone(countryOrCode, rawValue) {
    const digits = String(rawValue || '').replace(/\D+/g, '');
    if (!digits) return '';

    const country = resolvePhoneCountry(countryOrCode);
    const pattern = (country && (country.code === 'EE' || country.code === 'LV') && digits.length === 7)
        ? [3, 4]
        : getPhoneGroups(country);
    const chunks = [];
    let idx = 0;

    for (const size of pattern) {
        if (idx >= digits.length) break;
        chunks.push(digits.slice(idx, idx + size));
        idx += size;
    }

    // Any overflow digits beyond the country's primary template are grouped in clean 3-digit chunks
    while (idx < digits.length) {
        chunks.push(digits.slice(idx, idx + 3));
        idx += 3;
    }

    return chunks.join(' ');
}

/**
 * Formats a local phone string and maps the original caret position to the exact
 * equivalent position in the formatted output.
 */
export function formatLocalPhoneWithCaret(countryOrCode, rawValue, caretPos) {
    const str = String(rawValue || '');
    const safeCaret = typeof caretPos === 'number' && caretPos >= 0
        ? Math.min(caretPos, str.length)
        : str.length;

    let digitsBeforeCaret = 0;
    for (let i = 0; i < safeCaret; i++) {
        if (str[i] >= '0' && str[i] <= '9') digitsBeforeCaret++;
    }

    const formatted = formatLocalPhone(countryOrCode, str);
    if (digitsBeforeCaret === 0) {
        return { value: formatted, caret: 0 };
    }

    let seenDigits = 0;
    for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] >= '0' && formatted[i] <= '9') {
            seenDigits++;
            if (seenDigits === digitsBeforeCaret) {
                return { value: formatted, caret: i + 1 };
            }
        }
    }

    return { value: formatted, caret: formatted.length };
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
export function populateDialCodeSelect(selectEl, lang = 'ru', selectedCode = '') {
    if (!selectEl) return;
    const explicit = selectedCode && findPhoneCountry(selectedCode) ? selectedCode.toUpperCase() : '';
    const prevVal = selectEl.value && findPhoneCountry(selectEl.value) ? selectEl.value.toUpperCase() : '';
    const targetCode = explicit || prevVal || 'EE';

    selectEl.innerHTML = '';
    const isRu = lang === 'ru';

    PHONE_COUNTRIES.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.code;
        const name = isRu ? c.ru : c.en;
        const flag = safeFlag(c.code);
        opt.textContent = `${c.dial} · ${name}`;
        opt.setAttribute('data-short-label', c.dial);
        opt.setAttribute('data-dial', c.dial);
        opt.setAttribute('data-aliases', `${c.ru};${c.en};${c.code};${c.dial};${c.dial.slice(1)}`);
        opt.setAttribute('data-icon', flag || `<span class="cs-iso-badge">${c.code}</span>`);
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

    const setCaretSafely = (pos) => {
        try {
            if (document.activeElement === inputEl && typeof inputEl.setSelectionRange === 'function') {
                inputEl.setSelectionRange(pos, pos);
            }
        } catch (_) {
            // Some input states disallow selection range updates
        }
    };

    const formatCurrent = ({ preserveCaret = false } = {}) => {
        const raw = inputEl.value;
        const trimmed = raw.trim();
        if (!trimmed || trimmed.startsWith('+') || trimmed.startsWith('00')) return;
        const caret = preserveCaret ? inputEl.selectionStart : raw.length;
        const res = formatLocalPhoneWithCaret(selectEl.value, raw, caret);
        if (res.value !== raw) {
            inputEl.value = res.value;
            if (preserveCaret) setCaretSafely(res.caret);
        }
    };

    updatePlaceholder();
    syncCustomSelect();
    formatCurrent();

    selectEl.addEventListener('change', () => {
        updatePlaceholder();
        syncCustomSelect();
        formatCurrent();
        if (typeof opts.onChange === 'function') opts.onChange();
    });

    const tryApplyInternational = (rawText, { isPaste = false } = {}) => {
        const trimmed = String(rawText || '').trim();
        let internationalDigits = '';

        if (trimmed.startsWith('+')) {
            internationalDigits = trimmed.replace(/\D+/g, '');
        } else if (trimmed.startsWith('00')) {
            internationalDigits = trimmed.slice(2).replace(/\D+/g, '');
        } else if (isPaste) {
            // Handle pasting national number with selected country's dial code (no "+"), e.g. "372 5555 1234"
            const digits = trimmed.replace(/\D+/g, '');
            const curCountry = findPhoneCountry(selectEl.value);
            const curDial = curCountry ? curCountry.dial.replace(/\D+/g, '') : '';
            if (
                curCountry &&
                curDial &&
                digits.startsWith(curDial) &&
                !isValidLocalLength(curCountry, digits) &&
                isValidLocalLength(curCountry, digits.slice(curDial.length))
            ) {
                inputEl.value = formatLocalPhone(selectEl.value, digits.slice(curDial.length));
                return true;
            }
            if (curCountry?.trunkEight && digits.length === 11 && (digits.startsWith('8') || digits.startsWith('7'))) {
                inputEl.value = formatLocalPhone(selectEl.value, digits.slice(1));
                return true;
            }
            return false;
        } else {
            return false;
        }

        if (!internationalDigits) return false;

        const parsed = splitPhone(`+${internationalDigits}`, selectEl.value);
        if (!parsed.matched) return false;

        const matchedCountry = findPhoneCountry(parsed.code);
        if (!matchedCountry) return false;

        const minRequired = isPaste ? 4 : (matchedCountry.minLen || 7);
        if (parsed.local.length < minRequired) return false;

        selectEl.value = parsed.code;
        inputEl.value = formatLocalPhone(parsed.code, parsed.local);
        updatePlaceholder();
        syncCustomSelect();
        setCaretSafely(inputEl.value.length);
        return true;
    };

    inputEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Backspace' || e.ctrlKey || e.metaKey || e.altKey) return;
        const start = inputEl.selectionStart;
        const end = inputEl.selectionEnd;
        if (typeof start !== 'number' || start !== end || start <= 0) return;

        const val = inputEl.value;
        const trimmed = val.trim();
        if (trimmed.startsWith('+') || trimmed.startsWith('00')) return;

        // If cursor sits immediately after a formatting space, delete the digit before the space(s)
        if (val[start - 1] === ' ') {
            let deleteIdx = start - 1;
            while (deleteIdx >= 0 && val[deleteIdx] === ' ') deleteIdx--;
            if (deleteIdx >= 0) {
                e.preventDefault();
                const nextRaw = val.slice(0, deleteIdx) + val.slice(start);
                const res = formatLocalPhoneWithCaret(selectEl.value, nextRaw, deleteIdx);
                inputEl.value = res.value;
                setCaretSafely(res.caret);
                if (typeof opts.onInput === 'function') opts.onInput();
            }
        }
    });

    inputEl.addEventListener('paste', (e) => {
        const pasted = e.clipboardData?.getData('text');
        if (!pasted) return;
        const trimmed = pasted.trim();
        if (trimmed.startsWith('+') || trimmed.startsWith('00') || /^[\d(][\d\s\-()]{6,}$/.test(trimmed)) {
            if (tryApplyInternational(trimmed, { isPaste: true })) {
                e.preventDefault();
                if (typeof opts.onInput === 'function') opts.onInput();
            }
        }
    });

    inputEl.addEventListener('input', () => {
        const raw = inputEl.value;
        const trimmed = raw.trim();
        // Auto-detect full international numbers from browser autofill or pasted "+..." / "00..."
        if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
            if (!tryApplyInternational(trimmed, { isPaste: false })) {
                const cleaned = raw.replace(/[^\d\s\-()+]/g, '');
                if (cleaned !== raw) inputEl.value = cleaned;
            }
        } else {
            formatCurrent({ preserveCaret: true });
        }
        if (typeof opts.onInput === 'function') opts.onInput();
    });

    return {
        getNormalized: () => normalizePhone(selectEl.value, inputEl.value),
        hasInput: () => Boolean(inputEl.value.trim()),
        setFromE164: (e164, fallbackCode) => {
            const parsed = splitPhone(e164, fallbackCode || selectEl.value || 'EE');
            selectEl.value = parsed.code;
            inputEl.value = formatLocalPhone(parsed.code, parsed.local);
            updatePlaceholder();
            syncCustomSelect();
        },
        formatCurrent,
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
export function quotePostgrestLiteral(val) {
    const escaped = String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

/**
 * Escapes PostgreSQL LIKE/ILIKE wildcard characters (%, _, \) for exact case-insensitive matching.
 */
export function escapeIlikePattern(val) {
    return String(val).replace(/[\\%_]/g, '\\$&');
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
    if (cleanEmail) clauses.push(`customer_email.ilike.${quotePostgrestLiteral(escapeIlikePattern(cleanEmail))}`);
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

