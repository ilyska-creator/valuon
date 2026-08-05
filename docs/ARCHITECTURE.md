# Архитектура Valuon

Дата: 31 июля 2026 · Статус: актуально (ревизия последних изменений: custom-select, custom-datepicker)

---

## 1. Обзор

Valuon — статический фронтенд-проект без сборщика. Вся бизнес-логика выполняется в браузере, бэкенд — Supabase (Auth + Postgres + Storage + Edge Functions). Криптографическая подпись чеков — Ed25519 через WebCrypto API на клиенте.

```
┌─────────────────────────────────────────────────────────────┐
│                         Браузер                              │
│                                                              │
│   HTML (12 страниц)                                          │
│   ├── CSS (10 файлов)  →  дизайн-система + страничные слои   │
│   └── JS (30 файлов)   →  3 типа:                            │
│       ├── classic-скрипты (глобалы: showToast, RotatingTextLoader)│
│       ├── ES-модули     (import/export, работа с Supabase)   │
│       └── инлайн-скрипты (тема до FOUC, лоадеры, шалости)    │
│                                                              │
└──────────────┬───────────────────────────────────────────────┘
               │ HTTPS (REST)
┌──────────────▼───────────────────────────────────────────────┐
│  Supabase                                                    │
│  ├── Auth (GoTrue) — email/password, Turnstile captcha       │
│  ├── Postgres — profiles, items, receipts, shops, shop_keys, │
│  │             business_receipts, receipt_items + RLS        │
│  ├── Storage — bucket `receipts` (фото чеков),               │
│  │             bucket `shop-logos` (публичный)               │
│  └── Edge Function `verify-receipt` — серверная проверка     │
│      Ed25519-подписи по fiscal_hash (не в этом репозитории)  │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. Слои приложения

### 2.1. Публичные страницы (без авторизации)

| Страница | Модули | Supabase |
|---|---|---|
| `index.html` | `script.js` | проверка сессии (подмена CTA) |
| `login.html` | `auth.js`, `login-lang.js` | вход, сброс пароля |
| `register.html` | `register.js`, `login-lang.js` | регистрация, профиль, ленивая привязка чеков |
| `reset-password.html` | инлайн-модуль, `password-strength.js` | смена пароля по recovery-ссылке |
| `verify.html` | `verify.js`, `verify-lang.js` | Edge Function `verify-receipt` |
| `about.html`, `privacy.html`, `terms.html`, `roadmap.html` | `*-lang.js` | — |

### 2.2. Защищённые страницы (SPA-ядро)

| Страница | Вьюхи | Модули |
|---|---|---|
| `dashboard.html` | `#view-items`, `#view-notifications`, `#view-settings` | `dashboard-items.js`, `dashboard-notifications.js`, `dashboard-settings.js`, `dashboard-nav.js` |
| `receipts.html` | отдельная страница (не вьюха) | `receipts.js` |
| `business.html` | `#create-shop-view` ⇄ `#shop-dashboard-view` | `business-panel.js` |

Все три страницы защищены `requireAuth()` из `dashboard-auth.js` — при отсутствии сессии редирект на `login.html`.

### 2.3. Слои JS-зависимостей

```
Уровень 0 (глобалы, classic-скрипты):
  theme.js, toast.js, cookie-banner.js, animations.js, rotating-loader.js,
  custom-select.js, custom-datepicker.js, dashboard-lang.js, business-lang.js

Уровень 1 (конфиг, ES-модуль):
  supabase-client.js  ← корень графа зависимостей
        │
        ├─► security.js     (escapeHtml, logError, rate-limit)
        ├─► dashboard-auth.js  (requireAuth, getAuthSession, setupLogout)
        ├─► crypto-signature.js (Ed25519Signer, buildSignaturePayload)
        └─► password-strength.js (чистый модуль, без зависимостей)

Уровень 2 (страничные ES-модули):
  auth.js, register.js, script.js, verify.js
  dashboard-items.js, dashboard-notifications.js, dashboard-settings.js,
  receipts.js, business-panel.js

Уровень 3 (динамические импорты):
  receipt-generator.js  ← await import() из receipts.js (ленивая загрузка
                          jsPDF только при скачивании PDF)
```

---

## 3. Модули: карта ответственности

### 3.1. Ядро

| Модуль | Ответственность | Экспорт |
|---|---|---|
| `supabase-client.js` | URL + anon key Supabase (Vite env → fallback) | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `security.js` | XSS-экранирование, rate-limit (10/15мин вход, 3/час регистрация), состояния кнопок, `logError`, `isValidEmail` | named exports |
| `dashboard-auth.js` | Сессия из localStorage ИЛИ sessionStorage, `requireAuth()` с редиректом, `setupLogout()` | `requireAuth`, `getAuthSession`, `setupLogout` |
| `toast.js` | Глобальные уведомления (4 типа, прогресс-бар, локализация) | `window.showToast` |
| `theme.js` | Тёмная/светлая тема, событие `themeChange`, синхронизация вкладок | — |
| `custom-select.js` | Кастомный селект поверх скрытого `<select>` | `window.CustomSelect` (init/refreshAll) |
| `custom-datepicker.js` | Кастомный календарь поверх скрытого `<input type="date">` | `window.CustomDatePicker` (init/refreshAll) |
| `devices.js` | Маппинг типов устройств → FontAwesome-иконки | `window.DEVICE_ICONS`, `deviceIconMarkup(type)` |

### 3.2. Домены

| Домен | Модуль | Таблицы |
|---|---|---|
| **Товары** | `dashboard-items.js` | `items` CRUD + `business_receipts` (verified) |
| **Чеки** | `receipts.js` | `receipts` CRUD + Storage `receipts`, `business_receipts` |
| **Уведомления** | `dashboard-notifications.js` | `items`, `profiles` (expiry_alerts) |
| **Настройки** | `dashboard-settings.js` | `profiles`, `auth.updateUser` |
| **Магазин** | `business-panel.js` | `shops`, `business_receipts`, `receipt_items`, Storage `shop-logos`, RPC `check_profile_exists` |
| **Верификация** | `verify.js` | Edge Function `verify-receipt` |

### 3.3. i18n (RU/EN)

| Файл | Страницы | Механизм |
|---|---|---|
| `script.js` (translations) | index | `data-i18n`, `data-i18n-placeholder`, innerHTML для hero |
| `login-lang.js` | login, register, reset-password | + кастомная HTML5-валидация `.field-error` |
| `dashboard-lang.js` | dashboard, receipts | + `applyDashboardLang()`, `animateCount`, событие `lang-changed`, склонение «дней» |
| `business-lang.js` | business | + `applyBusinessTranslations()`, `applyDataI18n()` для template-фрагментов |
| `verify-lang.js` | verify | событие `verify-lang-changed` |
| `about-lang.js`, `privacy-lang.js`, `terms-lang.js`, `roadmap-lang.js` | статические | + тема |

**Контракты глобалов:** `window.dashboardTranslations`, `window.applyDashboardLang`, `window.animateCount` (dashboard-lang), `window.businessTranslations`, `window.businessCurrentLang`, `window.applyBusinessTranslations` (business-lang), `showToast`, `RotatingTextLoader`, `CustomSelect`, `CustomDatePicker`.

---

## 4. Данные

### 4.1. Таблицы Supabase

```
profiles
  id uuid PK → auth.users
  email, first_name, last_name, display_name, birthdate
  expiry_alerts bool (default true), weekly_digest bool (default false)
  updated_at timestamptz

items
  id uuid PK, user_id FK → auth.users
  name, brand, type (laptop/phone/…/other), serial_number
  purchase_date date, warranty_months int (0 = нет гарантии)
  price numeric, store_name text, location text
  created_at, updated_at timestamptz

receipts                       (личные загрузки покупателя)
  id uuid PK, user_id FK
  receipt_name, item_id FK → items (nullable)
  amount numeric, purchase_date date, store_name text
  file_path text, file_url text (signed URL, TTL 1 час)
  file_type text, status ('pending' | 'verified')
  created_at

shops
  id uuid PK, owner_id FK → auth.users
  shop_name, tax_id, address
  country text (ISO 3166-1 alpha-2, напр. 'RU')
  logo_path text (Storage shop-logos)
  public_key text, private_key text (PKCS8 base64)
  created_at

shop_keys
  id uuid PK, shop_id FK → shops, public_key text, created_at

business_receipts              (чеки, выданные продавцом)
  id uuid PK, shop_id FK → shops
  receipt_number, customer_email
  purchase_date date, payment_method
  net_total, vat_amount, gross_total numeric
  fiscal_hash text (Ed25519 подпись)
  shop_name, tax_id, address, country, logo_path (денормализовано)
  status ('verified' | 'pending'), created_at

receipt_items
  id uuid PK, receipt_id FK → business_receipts
  item_name, qty int, unit_price, vat_rate numeric
  warranty_months int, net_total, vat_amount, gross_total numeric
  sort_order int
```

### 4.2. Storage

| Bucket | Доступ | Путь | Использование |
|---|---|---|---|
| `receipts` | приватный | `{userId}/{timestamp}_{sanitized-name}` | фото/PDF личных чеков; read через `createSignedUrl(3600)` |
| `shop-logos` | публичный | `{shopId}/logo.{ext}` | логотипы магазинов (PNG/JPG ≤ 2МБ), читаются по публичному URL |

### 4.3. Локальные хранилища

**localStorage (постоянно):**
| Ключ | Назначение |
|---|---|
| `valuon-theme` | light/dark |
| `valuon-lang` | ru/en |
| `valuon-remember-email` | предзаполнение email на login |
| `cookie-consent` | согласие на cookies |
| `sb-<ref>-auth-token` | сессия Supabase (при «запомнить меня») |

**sessionStorage (на вкладку):**
| Ключ | Назначение |
|---|---|
| `sb-<ref>-auth-token` | сессия Supabase (без «запомнить меня») |
| `dashboard-view` | активная вьюха дашборда |
| `valuon-items-tab` | вкладка «verified/mine» на дашборде |
| `valuon-receipts-tab` | вкладка чеков |
| `verify-active-tab` | вкладка verify (scan/upload) |
| `current_shop` | кэш магазина (офлайн-fallback бизнес-панели) |

### 4.4. Формат QR-кода чека

```
RECEIPT:<serial>|DATE:<ISO>|TAX:<vat>|TOTAL:<gross>|SELLER:<taxId>|SHOP_ID:<id>|SIG:<fiscal_hash>
```
Все значения — `encodeURIComponent`. `SIG` — Ed25519-подпись канонической строки (см. 6.2).

---

## 5. Ключевые пользовательские сценарии

### 5.1. Регистрация → ленивая привязка чеков
1. `register.js`: валидация (возраст 16–120, сила пароля ≥3/5, terms) → Turnstile → `auth.signUp` с метаданными
2. `profiles.upsert` профиля
3. `business_receipts.update({status:'verified'}).eq('customer_email', email).eq('status','pending')` — чеки, выпущенные продавцами на этот email ДО регистрации, привязываются

### 5.2. Выписка чека продавцом (business)
1. Регистрация магазина: `Ed25519Signer.generateKeyPair()` → public SPKI + **private PKCS8 сохраняются в `shops`** → логотип в Storage → кэш в sessionStorage
2. Форма чека: динамические строки из `<template>` → живой пересчёт сумм → выбор даты/времени (custom-datepicker)
3. Подпись: приватный ключ повторно тянется из БД → `buildSignaturePayload(...)` → `sign()` → `fiscal_hash`
4. Проверка покупателя: RPC `check_profile_exists` (ретраи, до 3 попыток) → статус `verified`/`pending`
5. Вставка: шапка `business_receipts` + позиции `receipt_items` с **откатом** шапки при ошибке позиций
6. Покупатель видит чек в `receipts.html` и «подтверждённые товары» в `dashboard-items.js`

### 5.3. Верификация чека (verify)
1. Источники: камера (jsQR, цикл 250 мс) / фото / PDF (pdf.js рендер первой страницы)
2. `parseQRData` → извлекается только `SIG` (fiscal_hash)
3. POST → Edge Function `verify-receipt` — серверно проверяет Ed25519-подпись и чек по реестру
4. Ответ формирует UI: номер, дата, сумма, товары, логотип магазина, статус продавца

### 5.4. Загрузка личного чека (receipts)
1. Drag&drop / клик → валидация (jpg/png/gif/webp/pdf, ≤10 МБ)
2. `storage.upload` в bucket `receipts` → `createSignedUrl(3600)` → insert в `receipts` (при ошибке — откат: файл удаляется)
3. Привязка к товару: select товара → `fillFromItem` + **lock-механизм** (поля `readOnly`, иконки замков, датапикер `_cdp.setLocked`)
4. Signed URL обновляется при показе, если `created_at + 1h` истёк

### 5.5. Гарантии
- `calculateDaysLeft(purchaseDate, months)` — дни до конца гарантии (в `dashboard-items.js` и `dashboard-notifications.js`, дубль логики)
- Статусы: active / warning (≤30 дней) / expired / none (warranty=0, исключён из статистики и уведомлений)
- Прогресс-бар: ширина анимируется через двойной `requestAnimationFrame`
- Verified-товары: флэттенинг `receipt_items` из `business_receipts`, read-only карточки с лентой

---

## 6. Безопасность

### 6.1. Защита данных
- **RLS (Row Level Security)** — все запросы клиента фильтруются `eq('user_id', auth.uid())`; бизнес-чеки — по `customer_email = auth.email()`
- **Anon-ключ на клиенте** — осознанный выбор; вся авторизация — через RLS
- **Turnstile captcha** на login/register/reset — токен передаётся в Supabase (`options.captchaToken`)
- **Rate-limit на клиенте**: вход 10 попыток/15 мин, регистрация 3/час (дополнительно к серверному)
- **escapeHtml** во всех динамических вставках (security.js)

### 6.2. Криптографическая подпись (Ed25519)
- Каноническая строка `buildSignaturePayload`: `taxId | items | net | vat | gross | date`
- Позиции: `name~qty~unitPrice~vatRate~warrantyMonths~net~vat`; суммы `toFixed(2)`, дата `YYYY-MM-DD`, имя — `encodeURIComponent` (защита от подмены разделителей)
- **Гарантия входит в подпись** — её нельзя «продлить» задним числом
- Верификация — **только серверная** (Edge Function); приватный ключ в `shops.private_key` — компромисс ради офлайн-выписки, отмечен в аудитах

### 6.3. Прочие меры
- `escapeHtml` везде (без innerHTML с пользовательскими данными)
- Upload: санитизация имён файлов (NFKD → ASCII, только `[a-zA-Z0-9._-]`)
- Signed URL с TTL 1 час, продление при показе
- `logError(context, error)` — консистентное логирование по контекстам (`biz:*`, `init:*`, `settings:*`)
- XSS-вектор в переводах `data-i18n` закрыт (точечный innerHTML только для hero_title/reg_terms)

---

## 7. Тема и адаптивность

### 7.1. Тема
- Токены в `:root` (style.css) + оверрайды `[data-theme="dark"]`
- Инлайн-скрипт в `<head>` каждой страницы — защита от FOUC (до парсинга CSS)
- `theme.js`: переключение, событие `themeChange`, синхронизация между вкладками
- Компоненты перерисовываются: графики (150 мс задержка), датапикер (refreshAll)

### 7.2. Брейкпоинты (9 неконсистентных значений)
`968px` (лендинг) · `900px` (сайдбар → bottom-nav) · `768px` (мобильный навбар) · `700px` (auth) · `600px` (verify) · `560px` (auth-формы) · `480px` (везде) · `450px` (статы) · `420px` (ps-list)

`prefers-reduced-motion: reduce` отключает декоративные анимации (style, custom-select, custom-datepicker).

---

## 8. Деплой и окружение

- **Vercel** — `vercel.json` с `cleanUrls: true`
- **Supabase** — `.env.example` → `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (Vite-сборка) или захардкоженный fallback в `supabase-client.js`
- Проект не требует сборки: `open index.html`

---

## 9. Известные технические долги (из аудитов)

### CSS
1. **Дублирование `.item-card`** (~200 строк) между `style.css:1406` и `dashboard.css:436` — риск рассинхронизации
2. **Дублирование `.bottom-nav`**, `.receipt-card-items`, маркера `*`, `@keyframes` между dashboard/business
3. **3 версии `.modal-overlay`** (style / dashboard / business) с разной механикой показа
4. `--z-sidebar`, `--nav-bg` определены, но не используются; `--z-modal-content: 1001` < `--z-modal-overlay: 10000` (работает только из-за вложенности)
5. Хардкод hex-цветов в dark-оверрайдах вместо токенов
6. `business.css` ссылается на несуществующие `--border-color`/`--accent` (с фолбэками)
7. Брейкпоинты не централизованы (9 разных значений)

### JS
8. `calculateDaysLeft` дублируется в `dashboard-items.js` и `dashboard-notifications.js`
9. `loginAttempts`/`signupAttempts` — in-memory rate-limit (сбрасывается перезагрузкой)
10. Приватный ключ магазина в открытом виде в БД (`shops.private_key`)
11. QR-формат: `|` и `:` в значениях могут сломать парсинг (частично решено encodeURIComponent)
12. SRI/integrity для CDN-скриптов не добавлены
13. Email-напоминания о гарантиях не реализованы (нужна Edge Function + cron)

### БД
14. Денормализация `shop_name/tax_id/address/logo_path` в `business_receipts` — осознанный компромисс для верификации без JOIN

---

## 10. Инфраструктурные внешние сервисы

| Сервис | Использование |
|---|---|
| Google Fonts (Manrope, Big Shoulders Display) | типографика |
| Font Awesome 6.4.0 | иконки |
| cdn.jsdelivr.net — supabase-js@2.111.0, jsQR@1.4.0, jspdf@2.5.1, qrcode-generator@1.4.4, pdf.js@3.11.174 | библиотеки (ESM/CDN) |
| cdnjs.cloudflare.com — pdf.js | резервный CDN |
| Chart.js 4.4.1 | графики бизнес-панели |
| Cloudflare Turnstile | капча (sitekey `0x4AAAAAADxC9yNLOh3uKLe-`) |
| jsdelivr +esm / importmap | ESM-импорты supabase-js |
| OpenStreetMap / Overpass (отдельный инструмент `estonia-stores/`) | парсинг магазинов Эстонии |
