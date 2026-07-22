# Valuon — Полное описание проекта (текущая стадия)

## Концепция

**Valuon** — цифровой профиль покупки. Криптографически заверенный чек (Ed25519), который не выцветает, не теряется и всегда под рукой. Автоматический расчёт гарантийных сроков, напоминания об окончании гарантии, история всех покупок в одном месте.

Две роли продукта:
- **Покупатель** — добавляет чеки (бумажные фото или цифровые от продавца), отслеживает гарантии
- **Продавец (Business)** — регистрирует магазин, выписывает цифровые чеки с Ed25519-подписью, чеки автоматически попадают покупателю

---

## Текущий стек

- **Фронтенд:** Чистый HTML/CSS/JS (без фреймворков)
- **Бэкенд:** Supabase (Auth + Postgres + Storage)
- **Криптография:** Ed25519 через WebCrypto API (браузерная генерация ключей, подпись и верификация)
- **Генерация PDF:** jsPDF (на клиенте)
- **Карта магазинов:** Leaflet + OpenStreetMap (в отдельном инструменте `estonia-stores/`)
- **i18n:** Самописная (RU/EN, словари в `*-lang.js` файлах)

---

## Структура проекта

```
valuon/
├── index.html              # Лендинг (презентация продукта)
├── register.html           # Регистрация
├── login.html              # Вход
├── reset-password.html     # Сброс пароля
├── dashboard.html          # Личный кабинет покупателя
├── receipts.html           # Чеки и документы
├── business.html           # Панель продавца (регистрация магазина + выписка чеков)
├── verify.html             # Страница верификации чека по QR
├── privacy.html            # Политика конфиденциальности
├── terms.html              # Условия использования
├── roadmap.html            # Дорожная карта
│
├── css/
│   ├── style.css           # Глобальные стили, переменные, базовые компоненты
│   ├── auth.css            # Стили страниц регистрации/входа
│   ├── dashboard.css       # Стили дашборда покупателя
│   ├── business.css        # Стили панели продавца
│   ├── verify.css          # Стили страницы верификации
│   ├── toast.css           # Компонент toast-уведомлений
│   ├── roadmap.css         # Стили дорожной карты
│   └── privacy.css         # Стили privacy/terms
│
├── js/
│   ├── supabase-client.js  # Единый Supabase-клиент (один import во всех файлах)
│   ├── auth.js             # Аутентификация (login + register flow)
│   ├── register.js         # Логика регистрации
│   ├── dashboard-auth.js   # Авторизация дашборда (requireAuth)
│   ├── dashboard-lang.js   # Переводы дашборда (RU/EN) + applyDashboardLang
│   ├── dashboard-items.js  # Мои вещи (рендер карточек, stats, модалки add/edit/delete)
│   ├── dashboard-receipts.js # Чеки и документы (загрузка, отображение)
│   ├── dashboard-notifications.js # Уведомления (рендер списка)
│   ├── dashboard-settings.js # Настройки профиля
│   ├── business-panel.js   # Панель продавца (регистрация магазина, логотип, форма чека)
│   ├── business-lang.js    # Переводы панели продавца (RU/EN)
│   ├── receipt-generator.js # Генерация PDF-чека (jsPDF) + скачивание
│   ├── receipts.js         # Работа с чеками в receipts.html
│   ├── verify.js           # Верификация чека (парсинг QR, проверка подписи)
│   ├── crypto-signature.js # Ed25519 через WebCrypto (keypair, sign, verify)
│   ├── script.js           # Общие скрипты (i18n для index/login/register)
│   ├── security.js         # XSS-защита (escapeHtml)
│   └── cookie-consent.js   # Cookie-баннер (GDPR)
│
├── assets/                 # Статические ресурсы (favicon, og-image, logo)
│
├── estonia-stores/         # ОТДЕЛЬНЫЙ ИНСТРУМЕНТ (не часть проекта)
│   ├── parse.py            # Парсинг магазинов Эстонии из OpenStreetMap (Overpass API)
│   ├── verify.py           # Проверка доступности сайтов магазинов
│   ├── stores.json         # Данные магазинов
│   ├── stores.csv          # Данные магазинов (CSV)
│   └── index.html          # Карта + таблица магазинов (Leaflet)
│
└── docs/
    ├── PROJECT_BRIEF.md    # Этот файл
    ├── Valuon_Estonia_Backlog.md  # Бэклог задач (Estonia launch)
    ├── VALUON_PRESENTATION.md     # Презентация продукта
    └── AUDIT_*.md          # Результаты аудитов кода
```

---

## Ключевые архитектурные решения

### 1. Supabase как единый бэкенд
- Auth (GoTrue) — регистрация, вход, сброс пароля, magic link
- Postgres — все данные (users, shops, items, business_receipts, receipt_items)
- Storage (S3) — загрузка фото чеков, логотипов магазинов
- RLS (Row Level Security) — разграничение доступа (пользователь видит только свои данные)
- Анонимный ключ на клиенте, все ограничения — через RLS

### 2. Ed25519 через WebCrypto
- Ключи генерируются в браузере продавца
- Приватный ключ хранится в localStorage (не отправляется на сервер)
- Публичный ключ сохраняется в БД (таблица `shop_keys`)
- Подпись чека и верификация — на клиенте
- QR-код чека содержит: `{id}|{signature}|{publicKey}|{data}`

### 3. RLS-политики
- `items`: SELECT/INSERT/UPDATE/DELETE WHERE user_id = auth.uid()
- `business_receipts`: SELECT WHERE customer_email = auth.email() (покупатель), INSERT/UPDATE WHERE shop owner (продавец)
- `shops`: SELECT/INSERT/UPDATE WHERE owner_id = auth.uid()
- `shop_keys`: SELECT WHERE shop owner, INSERT при регистрации магазина

### 4. i18n
- Самописная система: словари в JS-объектах, `data-i18n` атрибуты в HTML
- `applyDashboardLang()` — рекурсивно обходит DOM и заменяет текст
- Язык в `localStorage['valuon-lang']` (ru / en)
- Три набора переводов: `script.js` (общие), `dashboard-lang.js` (дашборд), `business-lang.js` (бизнес)

---

## Текущий статус реализации

### ✅ Что работает
- Регистрация / вход / сброс пароля
- Личный кабинет покупателя:
  - Добавление вещей (название, тип, бренд, цена, дата, гарантия, серийный номер, место хранения)
  - Редактирование и удаление вещей
  - Автоматический расчёт гарантийных сроков (progress bar)
  - Статусы: активно / заканчивается / истекла / нет гарантии
  - Статистика (активные, истекающие, истекшие)
  - Уведомления (рендер в UI — без реальной email-отправки)
  - Загрузка фото чека (Supabase Storage)
  - Список чеков от партнёров (подтверждённые товары)
  - Настройки профиля (имя, email, тема, язык)
- Панель продавца:
  - Регистрация магазина (название, адрес, VAT)
  - Загрузка логотипа (drag-and-drop, PNG/JPG до 2MB)
  - Выписка цифрового чека с Ed25519-подписью
  - Скачивание PDF-чека (с логотипом рядом с названием магазина)
  - Dashboard магазина (инфо-карта с логотипом, badge)
- Верификация чека по QR (verify.html) — парсинг, проверка подписи, отображение
- Лендинг с презентацией
- Privacy Policy + Terms of Service
- Cookie-consent баннер
- Тёмная тема (auto + toggle)
- i18n RU/EN (основные страницы)
- Ed25519 подпись через WebCrypto (генерация, подписание, верификация)

### 🚧 В процессе / Известные проблемы
- **Email-напоминания о гарантии** (C-1) — не реализованы (нужна Supabase Edge Function + cron)
- **Эстонский язык** (D-1) — не добавлен
- ~~**RLS-политики** (B-2) — есть дыры (например, UPDATE на `shops` без политики)~~ ✅ Проверено 22 июля 2026 — всё норм
- **Дублирование Supabase-клиента** (B-3) — уже исправлено (вынесен в `supabase-client.js`)
- **XSS-векторы** (B-4, B-5) — частично закрыты через `escapeHtml`
- **SRI/integrity для CDN** (B-6) — не добавлены
- **QR-формат** (B-7) — `|` и `:` в значениях могут сломать парсинг
- **Недостающие i18n-ключи** (B-8)
- **Retention трекинг** — пока нет продуктивной аналитики

### 🎯 Последние изменения (21 июля 2026)
- Логотип: перенесён с дашборда на регистрацию магазина (одноразовая загрузка)
- PDF-к: логотип рядом с названием продавца, а не в хедере
- Гарантия: `min="0"`, `required` убран, `0 = нет гарантии`
- Статус «Нет гарантии» вместо «Гарантия истекла» для товаров с warranty=0
- Пунктирный трек вместо прогресс-бара для товаров без гарантии
- Товары без гарантии исключены из статистики и уведомлений

---

## Схема БД (Supabase)

### `items`
| Поле | Тип | Назначение |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users | Владелец |
| name | text | Название товара |
| brand | text | Бренд |
| type | text | Тип (laptop/phone/…) |
| serial_number | text | Серийный номер |
| purchase_date | date | Дата покупки |
| warranty_months | int | Срок гарантии (0 = нет) |
| price | numeric | Цена |
| store_name | text | Магазин |
| location | text | Место хранения |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `business_receipts`
| Поле | Тип | Назначение |
|---|---|---|
| id | uuid PK | |
| shop_id | uuid FK → shops | Магазин |
| customer_email | text | Email покупателя |
| purchase_date | date | Дата покупки |
| shop_name | text | Название магазина (денормализовано) |
| signature | text | Ed25519-подпись |
| public_key | text | Публичный ключ продавца |
| receipt_items | jsonb | Массив товаров (item_name, qty, gross_total, warranty_months) |
| logo_path | text | Путь к логотипу магазина |
| created_at | timestamptz | |

### `shops`
| Поле | Тип | Назначение |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK → auth.users | Владелец |
| shop_name | text | Название |
| shop_address | text | Адрес |
| vat_number | text | VAT / registrikood |
| logo_path | text | Путь к логотипу (Supabase Storage) |
| created_at | timestamptz | |

### `shop_keys`
| Поле | Тип | Назначение |
|---|---|---|
| id | uuid PK | |
| shop_id | uuid FK → shops | Магазин |
| public_key | text | Ed25519 публичный ключ |
| created_at | timestamptz | |

---

## Технические детали

### Аутентификация
- Supabase Auth (email/password)
- `requireAuth()` — проверяет сессию, редиректит на login если нет
- `setupLogout()` — обработчик кнопки выхода

### Ed25519 подпись (crypto-signature.js)
```js
// Генерация ключей
const { publicKey, privateKey } = await generateKeypair();

// Подпись данных
const signature = await sign(privateKey, data);

// Верификация
const isValid = await verify(publicKey, data, signature);
```
- Ключи хранятся в `localStorage['shop_keypair']` (JSON)
- Публичный ключ дублируется в БД (`shop_keys`) для верификации без сессии

### Verifi-страница (verify.html)
- GET-параметры из QR: `?data=...&sig=...&pk=...&id=...`
- Парсинг, проверка подписи через WebCrypto
- Если подпись валидна — показ содержимого чека
- Логотип магазина подгружается из Supabase Storage по `shop.logoPath`

### Генерация PDF (receipt-generator.js)
- jsPDF + jspdf-autotable
- Логотип (если есть) — fetch из Storage, вставка как ImageData
- Таблица товаров, сумма, гарантия, QR-код с подписью

---

## Как запустить

```bash
# 1. Клонировать
git clone git@github.com:anomalyco/valuon.git
cd valuon

# 2. Настроить Supabase
# Создать проект в Supabase (регион EU — Frankfurt)
# Выполнить SQL из schema.sql (если есть) или создать таблицы вручную
# В .env.local прописать SUPABASE_URL и SUPABASE_ANON_KEY

# 3. Открыть в браузере
open index.html
# Все страницы работают статически (HTML + JS, без сборки)
```

### Песочница (Supabase)
- URL: https://znqkvhmhszcgqbshatsm.supabase.co
- Anon key: (в .env)

---

## Парсинг магазинов Эстонии (отдельный инструмент)

В папке `estonia-stores/` лежит независимый инструмент для поиска магазинов в Эстонии:

```bash
cd estonia-stores
python3 parse.py         # Парсинг OSM → stores.json + stores.csv
python3 verify.py        # Проверка доступности сайтов
open index.html          # Карта + таблица
```

**Текущие данные:** 587 магазинов, 180 с email. Фильтр: без еды, аптек, авто, стройматериалов, банков, услуг.

---

## Известные issues / Что делать дальше

### Критичные (блокеры прода)
1. **Email-напоминания** — Supabase Edge Function на cron (Resend/Postmark)
2. ~~**RLS-политики** — ревизия и фикс дыр (UPDATE shops)~~ ✅ Проверено 22 июля 2026
3. **Эстонский язык** — перевод интерфейса

### Важные
4. **Добавление товара из чека** — автозаполнение полей при загрузке фото
5. **Bulk-загрузка чеков (CSV)** — для пилотных продавцов с существующей кассой
6. **Экспорт .ics в календарь** — чтобы добавить напоминание
7. **SRI integrity для CDN-скриптов**
8. **QR-формат** — экранирование `|` и `:`

### Продуктовые
9. **Retention D30 ≥ 25%** — трекинг и анализ
10. **Платежи** — Stripe + Montonio для платных тарифов
11. **Онбординг-гайд для продавцов** — PDF/страница
12. **Data Processing Agreement (DPA)** — юридический шаблон для продавцов
