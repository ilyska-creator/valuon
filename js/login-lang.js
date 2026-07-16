const translations = {
    ru: {
        page_title: "Valuon — Вход",
        page_title_reg: "Valuon — Регистрация",
        page_title_reset: "Valuon — Сброс пароля",
        back_home: "← На главную",
        back_to_login: "← Ко входу",

        auth_title: "С возвращением!",
        auth_subtitle: "Введите данные для входа в аккаунт",
        label_email: "Email",
        label_password: "Пароль",
        btn_login: "Войти",
        login_remember: "Запомнить меня",
        login_forgot: "Забыли пароль?",
        footer_text: "Нет аккаунта?",
        footer_link: "Зарегистрироваться",

        reg_title: "Создать аккаунт",
        reg_subtitle: "Начните управлять гарантиями бесплатно",
        label_confirm_password: "Повторите пароль",
        btn_register: "Зарегистрироваться",
        footer_have_account: "Уже есть аккаунт?",
        footer_link_login: "Войти",
        reg_terms: "Я согласен с <a href='#' style='color:var(--primary)'>условиями</a>",

        forgot_title: "Восстановление пароля",
        forgot_desc: "Введите email, привязанный к аккаунту. Мы отправим ссылку для сброса пароля.",
        btn_send_link: "Отправить ссылку",
        forgot_success_title: "Письмо отправлено!",
        forgot_success_desc: "Проверьте почту и перейдите по ссылке в письме для сброса пароля. Ссылка действительна 1 час.",
        btn_back_to_login: "Вернуться ко входу",

        reset_title: "Новый пароль",
        reset_subtitle: "Придумайте надёжный пароль для вашего аккаунта",
        label_new_password: "Новый пароль",
        btn_reset_password: "Сменить пароль",
        reset_success_title: "Пароль изменён!",
        reset_success_desc: "Теперь вы можете войти с новым паролем.",
        btn_go_login: "Перейти ко входу",
        reset_error_title: "Ссылка недействительна",
        reset_error_desc: "Срок действия ссылки истёк или она уже была использована. Запросите новую ссылку.",
        btn_request_new: "Запросить новую",
        ph_new_password: "Минимум 6 символов",
        ph_confirm_password: "Повторите пароль",

        msg_pass_mismatch: "Пароли не совпадают",
        msg_weak_pass: "Пароль должен быть не менее 6 символов",
        birthdate_warning: "Нельзя изменить после регистрации",
        label_birthdate: "Дата рождения",
        label_first_name: "Имя",
        label_last_name: "Фамилия",
        ph_first_name: "Иван",
        ph_last_name: "Иванов",


    },
    en: {
        page_title: "Valuon — Sign In",
        page_title_reg: "Valuon — Sign Up",
        page_title_reset: "Valuon — Reset Password",
        back_home: "← Back to Home",
        back_to_login: "← Back to Login",

        auth_title: "Welcome back!",
        auth_subtitle: "Enter your credentials to access your account",
        label_email: "Email",
        label_password: "Password",
        btn_login: "Sign In",
        login_remember: "Remember me",
        login_forgot: "Forgot password?",
        footer_text: "Don't have an account?",
        footer_link: "Sign Up",

        reg_title: "Create Account",
        reg_subtitle: "Start managing warranties for free",
        label_confirm_password: "Confirm Password",
        btn_register: "Sign Up",
        footer_have_account: "Already have an account?",
        footer_link_login: "Sign In",
        reg_terms: "I agree to the <a href='#' style='color:var(--primary)'>Terms</a>",

        forgot_title: "Reset Password",
        forgot_desc: "Enter the email linked to your account. We'll send a password reset link.",
        btn_send_link: "Send Link",
        forgot_success_title: "Email Sent!",
        forgot_success_desc: "Check your inbox and click the link to reset your password. The link is valid for 1 hour.",
        btn_back_to_login: "Back to Login",

        reset_title: "New Password",
        reset_subtitle: "Create a strong password for your account",
        label_new_password: "New Password",
        btn_reset_password: "Change Password",
        reset_success_title: "Password Changed!",
        reset_success_desc: "You can now sign in with your new password.",
        btn_go_login: "Go to Login",
        reset_error_title: "Invalid Link",
        reset_error_desc: "This link has expired or was already used. Request a new one.",
        btn_request_new: "Request New",
        ph_new_password: "At least 6 characters",
        ph_confirm_password: "Repeat password",

        msg_pass_mismatch: "Passwords do not match",
        msg_weak_pass: "Password must be at least 6 characters",
        birthdate_warning: "Cannot be changed after registration",
        label_birthdate: "Date of Birth",
        label_first_name: "First Name",
        label_last_name: "Last Name",
        ph_first_name: "James",
        ph_last_name: "Smith",
    }
};

function sanitizeHTML(str) {
    return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"');
}

document.addEventListener('DOMContentLoaded', () => {
    const currentLang = localStorage.getItem('valuon-lang') || 'ru';
    const path = window.location.pathname;

    let titleKey = 'page_title';
    if (path.includes('register')) titleKey = 'page_title_reg';
    if (path.includes('reset-password')) titleKey = 'page_title_reset';

    document.title = translations[currentLang][titleKey];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            el.innerHTML = sanitizeHTML(translations[currentLang][key]);
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[currentLang][key]) {
            el.placeholder = translations[currentLang][key];
        }
    });
});