const REQUIREMENTS = [
    { key: 'length', test: p => p.length >= 8 },
    { key: 'uppercase', test: p => /[A-Z]/.test(p) },
    { key: 'lowercase', test: p => /[a-z]/.test(p) },
    { key: 'number', test: p => /[0-9]/.test(p) },
    { key: 'special', test: p => /[^A-Za-z0-9]/.test(p) },
];

const LABELS = {
    ru: {
        length: 'Не менее 8 символов',
        uppercase: 'Заглавная буква (A-Z)',
        lowercase: 'Строчная буква (a-z)',
        number: 'Цифра (0-9)',
        special: 'Спецсимвол (!@# и т.д.)',
    },
    en: {
        length: 'At least 8 characters',
        uppercase: 'Uppercase letter (A-Z)',
        lowercase: 'Lowercase letter (a-z)',
        number: 'Number (0-9)',
        special: 'Special character (!@# etc.)',
    },
};

const STRENGTH_TEXTS = {
    ru: { 0: 'Очень слабый', 1: 'Слабый', 2: 'Средний', 3: 'Хороший', 4: 'Надёжный', 5: 'Надёжный' },
    en: { 0: 'Very weak', 1: 'Weak', 2: 'Fair', 3: 'Good', 4: 'Strong', 5: 'Strong' },
};

const STRENGTH_CONFIG = [
    { pct: 0, color: '#ef4444' },
    { pct: 25, color: '#ef4444' },
    { pct: 50, color: '#f59e0b' },
    { pct: 75, color: '#22c55e' },
    { pct: 100, color: '#16a34a' },
];

export function checkPasswordStrength(password) {
    const checks = REQUIREMENTS.map(r => ({ key: r.key, passed: r.test(password) }));
    const score = checks.filter(c => c.passed).length;
    const pct = (score / checks.length) * 100;
    const cfg = STRENGTH_CONFIG[score] || STRENGTH_CONFIG[STRENGTH_CONFIG.length - 1];
    return { score, pct, color: cfg.color, checks };
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
    const fill = document.createElement('div');
    fill.className = 'ps-meter-fill';
    bar.appendChild(fill);

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
    const { score, pct, color, checks } = checkPasswordStrength(password);

    if (password.length === 0) {
        container.classList.remove('ps-visible');
        return;
    }
    container.classList.add('ps-visible');

    const fill = container.querySelector('.ps-meter-fill');
    const text = container.querySelector('.ps-meter-label');
    fill.style.width = `${Math.max(pct, 4)}%`;
    fill.style.background = color;

    const strengthText = getStrengthText(score, lang);
    text.textContent = strengthText ? `${strengthText}` : '';

    const items = container.querySelectorAll('.ps-req');
    items.forEach((li, i) => {
        const passed = checks[i].passed;
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
    const getLang = options.getLang || (() => localStorage.getItem('valuon-lang') || 'ru');

    const handler = () => updateStrengthUI(container, input.value, getLang());
    input.addEventListener('input', handler);
    input.addEventListener('focus', handler);

    if (input.value) handler();

    document.addEventListener('lang-changed', () => {
        if (container.classList.contains('ps-visible')) {
            updateStrengthUI(container, input.value, getLang());
        }
    });

    return container;
}
