document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');

    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            const icon = toggleBtn.querySelector('i');
            icon.className = type === 'password' ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;

            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Вход...';

            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Успешно!';
                btn.style.background = '#10b981';

                setTimeout(() => {
                    alert('Добро пожаловать в Warrantix! (Это демо-вход)');
                    window.location.href = 'index.html';
                }, 1000);
            }, 1500);
        });
    }
});