# VALUON

**Цифровой профиль покупки.** Криптографически заверенный чек (Ed25519), который не выцветает, не теряется и всегда под рукой. Автоматический расчёт гарантийных сроков, напоминания об окончании гарантии, история всех покупок в одном месте.

## Роли продукта

- **Покупатель** — добавляет чеки (фото бумажных или цифровые от продавца), отслеживает гарантии, хранит документы
- **Продавец (Business)** — регистрирует магазин, выписывает цифровые чеки с Ed25519-подписью, чеки автоматически попадают покупателю по email

## Стек

| Слой | Технология |
|---|---|
| Фронтенд | Чистый HTML/CSS/JS (без фреймворков и сборщика) |
| Бэкенд | Supabase (Auth + Postgres + Storage) |
| Криптография | Ed25519 через WebCrypto API (браузерная генерация ключей, подпись, верификация) |
| PDF | jsPDF + qrcode-generator (на клиенте) |
| Графики | Chart.js |
| Сканирование QR | jsQR + pdf.js |
| Капча | Cloudflare Turnstile |
| Хостинг | Vercel (`vercel.json`, cleanUrls) |

## Структура проекта

```
valuon/
├── index.html              # Лендинг (презентация продукта)
├── register.html           # Регистрация (16+, Turnstile)
├── login.html              # Вход (Turnstile, «запомнить меня»)
├── reset-password.html     # Сброс пароля по recovery-ссылке
├── dashboard.html          # Личный кабинет покупателя (SPA-вьюхи)
├── receipts.html           # Чеки и документы (загрузка, привязка к товарам)
├── business.html           # Панель продавца (магазин, выписка чеков, аналитика)
├── verify.html             # Публичная верификация чека (QR / фото / PDF)
├── about.html              # О нас
├── privacy.html            # Политика конфиденциальности (GDPR)
├── terms.html              # Условия использования
├── roadmap.html            # Дорожная карта
│
├── css/
│   ├── style.css           # Дизайн-система: переменные, темы, базовые компоненты
│   ├── auth.css            # Стили входа/регистрации/сброса пароля
│   ├── dashboard.css       # Личный кабинет + страница чеков
│   ├── business.css        # Панель продавца
│   ├── verify.css          # Страница верификации
│   ├── roadmap.css         # Roadmap + About
│   ├── privacy.css         # Privacy + Terms
│   ├── toast.css           # Toast-уведомления
│   ├── custom-select.css   # Кастомный селект
│   └── custom-datepicker.css # Кастомный календарь
│
├── js/
│   ├── supabase-client.js  # Конфиг Supabase (URL + anon key) — корень зависимостей
│   ├── dashboard-auth.js   # requireAuth / getAuthSession / setupLogout
│   ├── auth.js             # Логика входа + модалка восстановления пароля
│   ├── register.js         # Логика регистрации
│   ├── dashboard-items.js  # «Мои вещи»: карточки, статистика, модалки CRUD
│   ├── dashboard-notifications.js # Уведомления о гарантиях
│   ├── dashboard-settings.js      # Настройки профиля
│   ├── dashboard-nav.js    # SPA-переключение вьюх дашборда
│   ├── dashboard-lang.js   # i18n дашборда (RU/EN) + applyDashboardLang
│   ├── receipts.js         # Страница чеков: загрузка в Storage, lock-привязка
│   ├── business-panel.js   # Панель продавца (1333 строки — самый большой модуль)
│   ├── business-lang.js    # i18n бизнес-панели
│   ├── crypto-signature.js # Ed25519: keypair, sign, verify, канонический payload
│   ├── receipt-generator.js # PDF-чек + QR (jsPDF)
│   ├── verify.js           # Верификация чека (jsQR, pdf.js, Edge Function)
│   ├── verify-lang.js      # i18n страницы верификации
│   ├── script.js           # Лендинг: i18n, мобильное меню, checkAuthOnHome
│   ├── login-lang.js       # i18n auth-страниц + кастомная валидация
│   ├── security.js         # escapeHtml, rate-limit, logError, валидация email
│   ├── password-strength.js # Индикатор надёжности пароля
│   ├── custom-select.js    # Кастомный селект (компонент)
│   ├── custom-datepicker.js # Кастомный календарь (компонент)
│   ├── toast.js            # Глобальный showToast
│   ├── theme.js            # Тёмная/светлая тема
│   ├── cookie-banner.js    # Cookie-баннер (GDPR)
│   ├── animations.js       # Scroll-reveal анимации
│   └── rotating-loader.js  # Спиннер с ротацией фраз
│
├── assets/                 # favicon.png, og-image.png
├── docs/                   # Архитектура, бэклог, аудиты, QA-чеклисты
└── vercel.json
```

## Быстрый старт

```bash
# 1. Настроить Supabase (регион EU — Frankfurt)
#    Создать таблицы: profiles, items, receipts, shops, shop_keys,
#    business_receipts, receipt_items + RLS-политики

# 2. Указать ключи (для Vite-сборки или захардкодить fallback
#    в js/supabase-client.js)
cp .env.example .env

# 3. Открыть в браузере
open index.html
# Проект полностью статический — без сборки и сервера
```

## Документация

- [Архитектура](docs/ARCHITECTURE.md) — слои, модули, зависимости, БД, безопасность
- [Бриф проекта](docs/PROJECT_BRIEF.md) — концепция, статус, известные проблемы
- [Бэклог Эстонии](docs/Valuon_Estonia_Backlog.md)
- [QA-чеклист](docs/VALUON_QA_CHECKLIST.md)
- [UX-ревью](docs/VALUON_UX_DESIGN_REVIEW_2026-07-30.md)
- [Аудиты](docs/FIXED_CODE_AUDIT.md)

## Ключевые архитектурные решения

1. **Supabase как единый бэкенд** — анонимный ключ на клиенте, безопасность через RLS
2. **Ed25519 через WebCrypto** — приватный ключ магазина в БД, подпись чека на клиенте, канонический payload в `buildSignaturePayload`
3. **Верификация серверная** — Edge Function `verify-receipt` проверяет подпись и чек по реестру
4. **i18n самописная** — словари в `*-lang.js`, `data-i18n` атрибуты, `localStorage['valuon-lang']`
5. **Zero-dependency форм-компоненты** — `custom-select.js` и `custom-datepicker.js` как кастомные компоненты поверх скрытых нативных элементов
6. **Статические страницы** — без сборки; ES-модули + CDN-библиотеки

## Деплой

Vercel (`vercel.json` с `cleanUrls: true`). Все страницы статические, Supabase-ключи уже в `supabase-client.js` (или через `VITE_*` переменные окружения при сборке).
