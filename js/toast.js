function escapeToastHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showToast(message, type = 'error', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        error: 'fa-solid fa-circle-exclamation',
        success: 'fa-solid fa-circle-check',
        warning: 'fa-solid fa-triangle-exclamation',
        info: 'fa-solid fa-circle-info'
    };

    const isRu = (localStorage.getItem('valuon-lang') || 'ru') === 'ru';
    const titles = {
        error: isRu ? 'Ошибка' : 'Error',
        success: isRu ? 'Успешно' : 'Success',
        warning: isRu ? 'Внимание' : 'Warning',
        info: isRu ? 'Информация' : 'Info'
    };

    const safeType = Object.prototype.hasOwnProperty.call(icons, type) ? type : 'info';
    const toast = document.createElement('div');
    toast.className = `toast ${safeType}`;
    toast.setAttribute('role', safeType === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', safeType === 'error' ? 'assertive' : 'polite');
    toast.innerHTML = `
        <div class="toast-icon" aria-hidden="true"><i class="${icons[safeType]}"></i></div>
        <div class="toast-body">
            <div class="toast-title">${titles[safeType]}</div>
            <div class="toast-message">${escapeToastHtml(message)}</div>
        </div>
        <button type="button" class="toast-close" aria-label="${isRu ? 'Закрыть' : 'Close'}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));

    const MAX_TOASTS = 4;
    const activeToasts = Array.from(container.querySelectorAll('.toast:not(.removing)'));
    while (activeToasts.length >= MAX_TOASTS) {
        const oldest = activeToasts.shift();
        removeToast(oldest);
    }

    container.appendChild(toast);

    let lastResumeTime = Date.now();
    let remaining = duration;
    let isPaused = false;
    let timer = setTimeout(() => removeToast(toast), duration);

    toast.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse' || isPaused) return;
        isPaused = true;
        clearTimeout(timer);
        timer = null;
        remaining = Math.max(0, remaining - (Date.now() - lastResumeTime));
        const bar = toast.querySelector('.toast-progress');
        if (bar) bar.style.animationPlayState = 'paused';
    });

    toast.addEventListener('pointerleave', (e) => {
        if (e.pointerType !== 'mouse' || !isPaused) return;
        isPaused = false;
        if (toast.classList.contains('removing')) return;
        lastResumeTime = Date.now();
        const bar = toast.querySelector('.toast-progress');
        if (bar) bar.style.animationPlayState = 'running';
        timer = setTimeout(() => removeToast(toast), remaining);
    });
}

function removeToast(toast) {
    if (!toast || toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
}