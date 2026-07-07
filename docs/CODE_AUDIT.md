# Valuon — Полный аудит кода (ошибки, баги, уязвимости)

Дата аудита: 07.07.2026
Охват: все JS-модули, HTML-страницы, CSS, миграции Supabase.

---

## 🔴 КРИТИЧЕСКИЕ (Critical)

### C1. RLS-политики Supabase не проверяемы и, вероятно, неполны
- **Где:** `supabase/migrations/` содержит только `add_crypto_keys_to_shops.sql`. Политики RLS для таблиц `profiles`, `items`, `receipts`, `business_receipts`, `shops`, `waitlist` **отсутствуют в репозитории**.
- **Риск:** В `roadmap.html` (step0_item_3) аудит RLS явно числится как *в процессе* (`fa-spinner`). Весь клиентский код полагается на RLS как единственный контроль доступа (anon-ключ публичен). При некорректных RLS:
  - утечка `private_key` всех магазинов (см. C2);
  - чтение чужих `receipts`, `items`, `profiles`.
- **Действие:** Опубликовать/проверить RLS для каждой таблицы. Это блокирующий вопрос безопасности.

### C2. Приватные ключи Ed25519 хранятся в открытом виде
- **Где:** `js/business-panel.js:154` (insert `private_key`), `:91-92` (кэш в `sessionStorage` как JSON, включая `private_key`); `supabase/migrations/add_crypto_keys_to_shops.sql:9-10`.
- **Риск:** Приватный ключ магазина лежит в БД в plaintext и в `sessionStorage`. Любой XSS (см. H4/H9) или утечка БД (см. C1) → полная компрометация подписей магазина (злоумышленник может подделывать чеки от имени магазина).
- **Действие:** Не хранить `private_key` в таблице, доступной по RLS анониму/другим юзерам. Минимум — вынести в отдельную таблицу с жёсткой RLS `owner_id = auth.uid()` и `select` запрещён. В `sessionStorage` ключ не нужен после подписи — импортировать по требованию.

### C3. Несовпадение формата данных при проверке подписи (сигнатуры «не проходят»)
- **Где:** подпись — `js/business-panel.js:261` (`signData` собирается из **сырой** строки `fd.get('purchase_date')`, напр. `"2026-07-07T12:00"`); проверка — `js/crypto-verification.js:33` (берёт `receipt.purchase_date` **из БД**).
- **Риск:** Если колонка `purchase_date` имеет тип `timestamptz`, Supabase вернёт значение в ином формате (`"...T12:00:00+00:00"` / UTC-сдвиг). Строки не совпадут → `verify()` вернёт `false` даже для валидного чека. То же касается `net_total`/`vat_amount` (float-строки могут отличаться при округлении в БД).
- **Действие:** Нормализовать обе стороны к канонической строке (напр. `purchase_date` → `toISOString()` или `YYYY-MM-DDTHH:mm:ssZ` на обоих этапах; числа → `toFixed(2)`).

---

## 🟠 ВЫСОКИЙ (High)

### H1. Сломан переключатель языка/темы на главной (`index.html` + `js/script.js`)
- **Где:** `js/script.js:236-243` (обработчик привязан к `#theme-toggle` — это **кнопка темы**, а не языка), `:122-123` (`langToggle.textContent = currentLang.toUpperCase()` перезаписывает иконку луны текстом "RU"/"EN"); `index.html:49-50` (язык = `#lang-toggle`, тема = `#theme-toggle`).
- **Баг:** 
  - Кнопка языка `#lang-toggle` **вообще не имеет** обработчика → не работает.
  - Клик по кнопке темы `#theme-toggle` **одновременно** переключает тему (через `js/theme.js`) **и** язык (через `script.js`), и затирает иконку луны текстом "RU".
- **Действие:** В `script.js` использовать `getElementById('lang-toggle')` для языка (как в `applyTranslations`, строка 122, где уже правильно). Убрать дублирующий обработчик темы.

### H2. Слабая политика паролей при регистрации
- **Где:** `js/register.js:48` (только `password.length < 6`); при этом `js/security.js:162` `validatePassword` требует 8+ символов, заглавные/строчные/цифру/спецсимвол.
- **Риск:** Регистрируются пароли вида `password` / `123456`. `validatePassword` нигде не вызывается при регистрации.
- **Действие:** Использовать `validatePassword` в `register.js` (или минимум 8 символов + проверка сложности).

### H3. Нет CAPTCHA на форме waitlist
- **Где:** `js/script.js:184-234` (форма `#waitlist-form` шлёт `insert` без Turnstile). Login/Register защищены Turnstile (`login.html:16`, `register.html:90`), а waitlist — нет.
- **Риск:** Спам/флуд таблицы `waitlist` ботами.
- **Действие:** Добавить Turnstile и проверку `captchaToken` в `signInWithPassword`/insert, либо серверную защиту.

### H4. Rate-limit только на клиенте (не настоящая защита)
- **Где:** `js/security.js` (`loginAttempts`/`signupAttempts` — `Map` в памяти браузера).
- **Риск:** Легко обходится (очистка storage, другой браузер, прямой вызов Supabase). Не защищает от брутфорса.
- **Действие:** Полагаться на серверный rate-limit Supabase (или Edge Function). Клиентский — только UX-подсказка.

### H5. Загрузка файлов без проверки типа (stored-XSS риск)
- **Где:** `js/receipts.js:591-601` (проверка только размера; `accept="image/*,.pdf"` — клиентский, обходится), `:125` (`accept` на input).
- **Риск:** Злонамеренный `.svg`/`.html` попадает в storage; при `window.open(file_url)` (`:262`) может исполниться. Зависит от Content-Type, выдаваемого бакетом.
- **Действие:** Проверять MIME на стороне storage (allowed `image/png,jpg,application/pdf`), запретить `text/html`/`image/svg+xml`, выдавать `Content-Disposition: attachment` / `X-Content-Type-Options: nosniff`.

### H6. Неполное удаление аккаунта
- **Где:** `js/dashboard-settings.js:285-299`.
- **Баги:**
  - Удаляет `profiles`, `items`, `receipts`, файлы storage, но **не** `auth.users` (только `signOut()`) → осиротевший аккаунт в Supabase.
  - Не удаляет `business_receipts`, где `customer_email = user.email` (остаются чеки с email пользователя).
  - `storage.list(user.id)` возвращает макс. 100 записей за раз → файлы свыше 100 не удаляются.
- **Действие:** Использовать Edge Function с `auth.admin.deleteUser` + каскад, пагинировать `list`, чистить `business_receipts`.

---

## 🟡 СРЕДНИЙ (Medium)

### M1. `reset-password.html`: `setSession` без try/catch
- **Где:** `reset-password.html:115` (top-level `await supabase.auth.setSession(...)` вне try). При невалидном/просроченном токене — необработанный reject, страница в сломанном состоянии (форма видна, но сброс не работает).
- **Действие:** Обернуть в try/catch → показывать `#reset-error`.

### M2. `reset-password.html`: кнопка «Запросить новую» не запрашивает ссылку
- **Где:** `:173-188` — `request-new-link-btn` делает `signOut()` и редирект на `login.html`, но не шлёт reset-email. Вводящее в заблуждение поведение.
- **Действие:** Либо реально вызывать `resetPasswordForEmail`, либо переименовать кнопку.

### M3. Утечка/накопление слушателей на drop-zone (`receipts.js`)
- **Где:** `js/receipts.js:354-379` — `restoreListeners` каждый рендер (`loadAllReceipts`) вешает `dragenter/dragover/dragleave/drop` на тот же `#drop-zone` заново, старые не снимаются.
- **Риск:** После N загрузок/удалений — N копий обработчиков (множественные срабатывания, утечка памяти).
- **Действие:** Вешать слушатели один раз при инициализации, не в `restoreListeners`.

### M4. N+1 генерация signed URL при каждой загрузке
- **Где:** `js/receipts.js:62-75` + `:100` — для каждого персонального чека создаётся свежий signed URL отдельным запросом.
- **Риск:** Производительность/квота при многих чеках.
- **Действие:** Батчить или кэшировать; либо хранить и перевыпускать лениво при клике.

### M5. `saveToggle` глотает ошибки молча
- **Где:** `js/dashboard-settings.js:152-161` — `catch` только `console.error`. Переключатель в UI взведён, но в БД не сохранён → рассинхрон.
- **Действие:** Показывать toast при ошибке и откатывать состояние.

### M6. Мёртвый код: `window.renderNotifications` нигде не определён
- **Где:** `js/dashboard-items.js:61-63` — вызов под защитой `typeof ... === 'function'`, но функция не существует ни в одном файле.
- **Действие:** Реализовать или удалить.

### M7. Осиротевший файл `js/dashboard-ui.js`
- **Где:** ни одна HTML не подключает `dashboard-ui.js`; его логика темы дублируется в `js/theme.js`.
- **Действие:** Удалить либо подключить и унифицировать.

### M8. Невалидная HTML-структура `login.html`
- **Где:** `login.html:73` — лишний `</div>` (после закрытия `.auth-container` на строке 71).
- **Действие:** Удалить лишний тег.

### M9. Несогласованный `vat_rate` по умолчанию
- **Где:** `js/business-panel.js:244` — `parseFloat(fd.get('vat_rate')) || 19` (дефолт 19), но в `business.html:182` поле `value="0"`. Пустое поле даст 19%, а не 0%.
- **Действие:** Привести к единому значению (0 или 19) в обоих местах.

### M10. XSS-«грабли» в `security.js`
- **Где:** `setSafeHTML(el, html, allowHTML=true)` → `innerHTML` (`security.js:83-85`); `createSafeElement(tag, html)` → `innerHTML` (`:123`).
- **Риск:** Если когда-либо вызвать с пользовательскими данными и `allowHTML=true` — XSS.
- **Действие:** Не передавать пользовательский ввод с `allowHTML`. Заменить `createSafeHTML` на `textContent`/`createElement`.

---

## 🟢 НИЗКИЙ (Low)

- **L1.** `security.js:189` `cleanupOldAttempts` — `setInterval` никогда не очищается (утечка таймера, минимально).
- **L2.** Создаётся новый Supabase-клиент на каждый вызов `getSupabaseClient` (`auth.js:9`, `dashboard-auth.js:13`) — избыточно.
- **L3.** `dashboard-notifications.js:161-162` `cachedUserId/cachedClient` объявлены `let` **после** использования в `ensureNotifLoaded` (работает только по таймингу загрузки модуля, хрупко).
- **L4.** `toast.js:30` `icons[type]` — при неизвестном `type` класс `fa-undefined`.
- **L5.** `receipt-generator.js:69,134` — `vatAmount.toFixed(2)`/`receipt.payment_method` предполагают наличие полей; старые записи без `vat_amount` упадут, без `payment_method` выведут "undefined".
- **L6.** `auth.js:60` — rate-limit считается **до** проверки капчи; бот, проваливший капчу, сжигает лимит.
- **L7.** Отсутствуют заголовки безопасности (CSP, `X-Frame-Options`, `X-Content-Type-Options`) — зависит от хостинга (Vercel); рекомендуется добавить через конфиг деплоя.
- **L8.** Публичный anon-ключ захардкожен в клиенте (`auth.js:7` и др.) — для Supabase это норма, но безопасность целиком упирается в RLS (см. C1).

---

## Сводка по приоритетам

| Приоритет | Кол-во | Ключевые пункты |
|-----------|--------|-----------------|
| 🔴 Critical | 3 | C1 RLS, C2 приватные ключи в plaintext, C3 несовпадение подписи |
| 🟠 High | 6 | H1 язык/тема, H2 пароли, H3 капча waitlist, H4 rate-limit, H5 загрузка файлов, H6 удаление аккаунта |
| 🟡 Medium | 10 | M1–M10 |
| 🟢 Low | 8 | L1–L8 |

**Самое важное:** проверить/опубликовать RLS (C1) и перестать хранить `private_key` в открытом виде (C2) — это фундаментальные проблемы безопасности всего приложения. Затем исправить сломанный переключатель языка на главной (H1, виден пользователю сразу).
круть