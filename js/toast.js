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

    const titles = {
        error: localStorage.getItem('valuon-lang') === 'ru' ? 'Ошибка' : 'Error',
        success: localStorage.getItem('valuon-lang') === 'ru' ? 'Успешно' : 'Success',
        warning: localStorage.getItem('valuon-lang') === 'ru' ? 'Внимание' : 'Warning',
        info: localStorage.getItem('valuon-lang') === 'ru' ? 'Информация' : 'Info'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon"><i class="${icons[type]}"></i></div>
        <div class="toast-body">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${escapeToastHtml(message)}</div>
        </div>
        <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
        <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));

    container.appendChild(toast);

    const startTime = Date.now();
    let remaining = duration;
    let timer = setTimeout(() => removeToast(toast), duration);

    toast.addEventListener('mouseenter', () => {
        clearTimeout(timer);
        remaining = Math.max(0, duration - (Date.now() - startTime));
        toast.querySelector('.toast-progress').style.animationPlayState = 'paused';
    });

    toast.addEventListener('mouseleave', () => {
        toast.querySelector('.toast-progress').style.animationPlayState = 'running';
        timer = setTimeout(() => removeToast(toast), remaining);
    });
}

function removeToast(toast) {
    if (!toast || toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
}