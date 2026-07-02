const translations = {
    ru: {
        page_title: "Valuon — Вход",
        page_title_reg: "Valuon — Регистрация",
        back_home: "← На главную",
        auth_title: "С возвращением!",
        auth_subtitle: "Введите данные для входа в аккаунт",
        reg_title: "Создать аккаунт",
        reg_subtitle: "Начните управлять гарантиями бесплатно",
        label_email: "Email",
        label_password: "Пароль",
        label_confirm_password: "Повторите пароль",
        btn_login: "Войти",
        btn_register: "Зарегистрироваться",
        footer_text: "Нет аккаунта?",
        footer_link: "Зарегистрироваться",
        footer_have_account: "Уже есть аккаунт?",
        footer_link_login: "Войти",
        reg_terms: "Я согласен с <a href='#' style='color:var(--primary)'>условиями</a>",
        msg_pass_mismatch: "Пароли не совпадают",
        msg_weak_pass: "Пароль должен быть не менее 6 символов"
    },
    en: {
        page_title: "Valuon — Sign In",
        page_title_reg: "Valuon — Sign Up",
        back_home: "← Back to Home",
        auth_title: "Welcome back!",
        auth_subtitle: "Enter your credentials to access your account",
        reg_title: "Create Account",
        reg_subtitle: "Start managing warranties for free",
        label_email: "Email",
        label_password: "Password",
        label_confirm_password: "Confirm Password",
        btn_login: "Sign In",
        btn_register: "Sign Up",
        footer_text: "Don't have an account?",
        footer_link: "Sign Up",
        footer_have_account: "Already have an account?",
        footer_link_login: "Sign In",
        reg_terms: "I agree to the <a href='#' style='color:var(--primary)'>Terms</a>",
        msg_pass_mismatch: "Passwords do not match",
        msg_weak_pass: "Password must be at least 6 characters"
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const currentLang = localStorage.getItem('valuon-lang') || 'ru';

    const isRegister = window.location.pathname.includes('register');
    document.title = isRegister ? translations[currentLang].page_title_reg : translations[currentLang].page_title;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) el.innerHTML = translations[currentLang][key];
    });
});