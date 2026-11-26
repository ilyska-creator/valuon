const REQUIREMENTS = [
    { key: 'length', test: p => p.length >= 8 },
    { key: 'uppercase', test: p => /[A-Z]/.test(p) },
    { key: 'lowercase', test: p => /[a-z]/.test(p) },
    { key: 'number', test: p => /[0-9]/.test(p) },
];

const LABELS = {
    ru: {
        length: 'Не менее 8 символов',
        uppercase: 'Заглавная буква (A-Z)',
        lowercase: 'Строчная буква (a-z)',
        number: 'Цифра (0-9)',
    },
    en: {
        length: 'At least 8 characters',
        uppercase: 'Uppercase letter (A-Z)',
        lowercase: 'Lowercase letter (a-z)',
        number: 'Number (0-9)',
    },
};

const STRENGTH_TEXTS = {
    ru: { 0: 'Очень слабый', 1: 'Слабый', 2: 'Средний', 3: 'Хороший', 4: 'Надёжный' },
    en: { 0: 'Very weak', 1: 'Weak', 2: 'Fair', 3: 'Good', 4: 'Strong' },
};

const SEGMENT_COLORS = [
    '#ef4444',
    '#f59e0b',
    '#22c55e',
    '#16a34a',
];

export function checkPasswordStrength(password) {
    const checks = REQUIREMENTS.map(r => ({ key: r.key, passed: r.test(password) }));
    const rawScore = checks.filter(c => c.passed).length;
    const hasMinLength = password.length >= 8;
    const score = hasMinLength ? rawScore : Math.min(rawScore, 2);
    const pct = (score / checks.length) * 100;
    const isValid = hasMinLength && password.length <= 128 && rawScore >= 3;
    return { score, pct, checks, hasMinLength, isValid };
}

function getStrengthText(score, lang = 'ru') {
    return STRENGTH_TEXTS[lang]?.[score] || '';
}

function getLabels(lang = 'ru') {
    return LABELS[lang] || LABELS.ru;
}

export function createStrengthContainer(passwordInput) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ps-wrap';

    const meterRow = document.createElement('div');
    meterRow.className = 'ps-meter-row';

    const bar = document.createElement('div');
    bar.className = 'ps-meter-bar';
    for (let i = 0; i < REQUIREMENTS.length; i++) {
        const seg = document.createElement('span');
        seg.className = 'ps-segment';
        seg.dataset.idx = i;
        bar.appendChild(seg);
    }

    const text = document.createElement('span');
    text.className = 'ps-meter-label';

    meterRow.appendChild(bar);
    meterRow.appendChild(text);
    wrapper.appendChild(meterRow);

    const list = document.createElement('div');
    list.className = 'ps-list';
    REQUIREMENTS.forEach(r => {
        const li = document.createElement('div');
        li.className = 'ps-req';
        li.dataset.key = r.key;
        const icon = document.createElement('span');
        icon.className = 'ps-req-icon';
        const check = document.createElement('span');
        check.className = 'ps-req-check';
        check.innerHTML = '<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        const circle = document.createElement('span');
        circle.className = 'ps-req-circle';
        icon.appendChild(check);
        icon.appendChild(circle);
        const label = document.createElement('span');
        label.className = 'ps-req-label';
        li.appendChild(icon);
        li.appendChild(label);
        list.appendChild(li);
    });
    wrapper.appendChild(list);

    const parent = passwordInput.closest('.password-wrapper') || passwordInput.parentNode;
    parent.parentNode.insertBefore(wrapper, parent.nextSibling);

    return wrapper;
}

export function updateStrengthUI(container, password, lang = 'ru') {
    const labels = getLabels(lang);
    const { score, checks } = checkPasswordStrength(password);

    if (password.length === 0) {
        container.classList.remove('ps-visible');
        return;
    }
    container.classList.add('ps-visible');

    const segments = container.querySelectorAll('.ps-segment');
    const activeColor = SEGMENT_COLORS[Math.max(0, score - 1)] || SEGMENT_COLORS[0];
    segments.forEach((seg, i) => {
        const filled = i < score;
        seg.classList.toggle('filled', filled);
        if (filled) {
            seg.style.setProperty('--segment-color', activeColor);
        }
    });

    const bar = container.querySelector('.ps-meter-bar');
    bar.classList.toggle('glow', score >= 3);

    const LABEL_COLORS = ['#ef4444', '#ef4444', '#f59e0b', '#22c55e', '#16a34a'];

    const text = container.querySelector('.ps-meter-label');
    const strengthText = getStrengthText(score, lang);
    text.textContent = strengthText;
    text.style.color = LABEL_COLORS[score] || '';

    const items = container.querySelectorAll('.ps-req');
    items.forEach((li, i) => {
        const passed = checks[i].passed;
        const wasPassed = li.dataset.passed === 'true';

        if (passed && !wasPassed) {
            li.classList.add('ps-req-bounce');
            setTimeout(() => li.classList.remove('ps-req-bounce'), 400);
        }

        li.dataset.passed = passed;
        li.classList.toggle('ps-req-passed', passed);
        li.classList.toggle('ps-req-fail', !passed);
        const label = li.querySelector('.ps-req-label');
        label.textContent = labels[checks[i].key] || checks[i].key;
    });
}

export function initPasswordStrength(inputId, options = {}) {
    const input = document.getElementById(inputId);
    if (!input) return null;

    const container = createStrengthContainer(input);
    const getLang = options.getLang || (() => (window.getValuonLang ? window.getValuonLang() : 'en'));

    const handler = () => updateStrengthUI(container, input.value, getLang());
    input.addEventListener('input', handler);
    input.addEventListener('focus', handler);

    if (input.value) handler();

    const onLangChanged = () => {
        if (container.classList.contains('ps-visible')) {
            updateStrengthUI(container, input.value, getLang());
        }
    };
    window.addEventListener('lang-changed', onLangChanged);
    document.addEventListener('lang-changed', onLangChanged);

    return container;
}

export function initPasswordMatch(passwordId, confirmId, options = {}) {
    const passInput = document.getElementById(passwordId);
    const confirmInput = document.getElementById(confirmId);
    if (!passInput || !confirmInput) return null;

    const getLang = options.getLang || (() => (window.getValuonLang ? window.getValuonLang() : 'en'));

    const hint = document.createElement('div');
    hint.className = 'ps-match-hint';
    hint.setAttribute('aria-live', 'polite');

    const parent = confirmInput.closest('.input-wrap') || confirmInput.closest('.password-wrapper') || confirmInput.parentNode;
    parent.parentNode.insertBefore(hint, parent.nextSibling);

    const update = () => {
        const p1 = passInput.value;
        const p2 = confirmInput.value;
        if (!p2) {
            hint.classList.remove('is-visible', 'is-match', 'is-mismatch');
            hint.textContent = '';
            return;
        }
        const isRu = getLang() === 'ru';
        const matches = p1 === p2;
        hint.classList.add('is-visible');
        hint.classList.toggle('is-match', matches);
        hint.classList.toggle('is-mismatch', !matches);
        hint.innerHTML = matches
            ? `<i class="fa-solid fa-check"></i> <span>${isRu ? 'Пароли совпадают' : 'Passwords match'}</span>`
            : `<i class="fa-solid fa-xmark"></i> <span>${isRu ? 'Пароли не совпадают' : 'Passwords do not match'}</span>`;
    };

    passInput.addEventListener('input', update);
    confirmInput.addEventListener('input', update);
    window.addEventListener('lang-changed', update);
    document.addEventListener('lang-changed', update);

    return { hint, update };
}
