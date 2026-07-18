const verifyTranslations = {
    ru: {
        page_title: 'Valuon — Верификация чека',
        meta_description: 'Valuon — Проверьте подлинность чека по QR-коду. Криптографическая верификация Ed25519.',
        title: 'Верификация чека',
        subtitle: 'Проверьте подлинность чека по QR-коду или загрузите фото/PDF',
        tab_scan: 'Сканировать',
        tab_upload: 'Фото / PDF',
        scan_hint: 'Наведите камеру на QR-код',
        scan_btn_open: 'Открыть камеру',
        scan_btn_stop: 'Остановить',
        upload_title: 'Загрузите фото или PDF чека',
        upload_hint: 'JPG, PNG, PDF до 10 МБ',
        upload_btn: 'Проверить',
        retry_btn: 'Проверить другой чек',
        footer_text: 'Все данные проверяются по защищённому реестру.',
        footer_brand: 'Valuon — гарантия подлинности',
        verify_privacy_link: 'Политика конфиденциальности',
        verify_terms_link: 'Условия пользования',
        detail_receipt_number: 'Номер чека',
        detail_items: 'Состав чека',
        items_warranty_suffix: 'мес. гарантии',
        detail_date: 'Дата покупки',
        detail_amount: 'Сумма',
        detail_store: 'Продавец',
        detail_status: 'Статус продавца',
        scanning: 'QR найден, проверяем...',
        decoding: 'Декодируем QR...',
        qr_not_found_text: 'QR-код не найден',
        verifying: 'Проверяем...',
        file_too_big: 'Файл слишком большой. Максимум 10 МБ.',
        result_success_title: 'Чек верифицирован',
        result_success_desc: 'Подпись чека действительна. Данные не были изменены.',
        result_success_badge: 'Подлинный',
        result_not_found_title: 'Чек не найден',
        result_not_found_desc: 'Чек с указанными данными не обнаружен в реестре. Возможно, он был выдан в другой системе.',
        result_not_found_badge: 'Не найден',
        result_invalid_title: 'Подпись недействительна',
        result_invalid_desc: 'Криптографическая подпись чека не прошла проверку. Данные были изменены после подписания.',
        result_invalid_badge: 'Недействителен',
        result_no_qr_title: 'QR-код не найден',
        result_error_title: 'Ошибка проверки',
        result_error_badge: 'Ошибка',
        result_no_qr_desc: 'На изображении не удалось обнаружить QR-код. Попробуйте другое фото.',
        result_error_desc: 'Произошла ошибка при проверке чека.',
        seller_verified: 'Email подтверждён',
        seller_pending: 'Ожидает подтверждения',
        rpc_error: 'Ошибка доступа к реестру',
        crypto_error: 'Ваш браузер не поддерживает криптографию Ed25519.',
        internal_error: 'Внутренняя ошибка при проверке',
        shop_not_found: 'Магазин не найден',
        rate_limited: 'Слишком много попыток проверки. Подождите минуту и попробуйте снова.',
        file_type_not_supported: 'Неподдерживаемый тип файла. Загрузите изображение или PDF.',
        scan_error: 'Ошибка при обработке изображения',
        file_error: 'Ошибка при обработке файла',
        copy_btn: 'Копировать результат',
        copied: 'Скопировано',
        drop_hint: 'Отпустите файл для загрузки',
        back: 'Назад',
    },
    en: {
        page_title: 'Valuon — Receipt Verification',
        meta_description: 'Valuon — Verify receipt authenticity by QR code. Cryptographic Ed25519 verification.',
        title: 'Receipt Verification',
        subtitle: 'Verify a receipt by scanning its QR code or uploading a photo/PDF',
        tab_scan: 'Scan',
        tab_upload: 'Photo / PDF',
        scan_hint: 'Point camera at the QR code',
        scan_btn_open: 'Open Camera',
        scan_btn_stop: 'Stop',
        upload_title: 'Upload a receipt photo or PDF',
        upload_hint: 'JPG, PNG, PDF up to 10 MB',
        upload_btn: 'Verify',
        retry_btn: 'Check another receipt',
        footer_text: 'All data is verified against a secure registry.',
        footer_brand: 'Valuon — guaranteed authenticity',
        verify_privacy_link: 'Privacy Policy',
        verify_terms_link: 'Terms of Use',
        detail_receipt_number: 'Receipt #',
        detail_items: 'Items',
        items_warranty_suffix: 'mo. warranty',
        detail_date: 'Purchase Date',
        detail_amount: 'Amount',
        detail_store: 'Seller',
        detail_status: 'Seller Status',
        scanning: 'QR found, verifying...',
        decoding: 'Decoding QR...',
        qr_not_found_text: 'QR code not found',
        verifying: 'Verifying...',
        file_too_big: 'File too large. Maximum 10 MB.',
        result_success_title: 'Receipt Verified',
        result_success_desc: 'Receipt signature is valid. Data has not been altered.',
        result_success_badge: 'Authentic',
        result_not_found_title: 'Receipt Not Found',
        result_not_found_desc: 'No receipt with the given data was found in the registry. It may have been issued in a different system.',
        result_not_found_badge: 'Not Found',
        result_invalid_title: 'Invalid Signature',
        result_invalid_desc: 'Cryptographic signature verification failed. Data has been altered since signing.',
        result_invalid_badge: 'Invalid',
        result_no_qr_title: 'QR Code Not Found',
        result_error_title: 'Verification Error',
        result_error_badge: 'Error',
        result_no_qr_desc: 'No QR code found in the image. Try another photo.',
        result_error_desc: 'An error occurred during receipt verification.',
        seller_verified: 'Email Verified',
        seller_pending: 'Awaiting Verification',
        rpc_error: 'Registry access error',
        crypto_error: 'Your browser does not support Ed25519 cryptography.',
        internal_error: 'Internal verification error',
        shop_not_found: 'Shop not found',
        rate_limited: 'Too many verification attempts. Please wait a minute and try again.',
        file_type_not_supported: 'Unsupported file type. Please upload an image or PDF.',
        scan_error: 'Error processing image',
        file_error: 'Error processing file',
        copy_btn: 'Copy result',
        copied: 'Copied',
        drop_hint: 'Drop file to upload',
        back: 'Back',
    }
};

let verifyLang = localStorage.getItem('valuon-lang') || 'ru';

export function t(key) {
    return verifyTranslations[verifyLang]?.[key] ?? verifyTranslations.ru[key] ?? key;
}

export function getVerifyLocale() {
    return verifyLang === 'ru' ? 'ru-RU' : 'en-US';
}

function applyStaticTranslations() {
    document.title = t('page_title');
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = t('meta_description');
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (verifyTranslations.ru[key]) {
            el.textContent = t(key);
        }
    });
}

function updateLangToggle() {
    const toggle = document.getElementById('lang-toggle');
    if (toggle) {
        toggle.textContent = verifyLang === 'ru' ? 'RU' : 'EN';
    }
}

export function applyVerifyTranslations() {
    applyStaticTranslations();
    updateLangToggle();
}

export function initVerifyLang() {
    applyVerifyTranslations();
    const toggle = document.getElementById('lang-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            const newLang = verifyLang === 'ru' ? 'en' : 'ru';
            verifyLang = newLang;
            localStorage.setItem('valuon-lang', newLang);
            applyVerifyTranslations();
            window.dispatchEvent(new CustomEvent('verify-lang-changed'));
        });
    }
}