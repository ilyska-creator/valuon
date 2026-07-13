# Valuon — Полный аудит кода (ошибки, баги, уязвимости)

Дата аудита: 09.07.2026. Охват: все JS-модули, HTML-страницы, CSS, SQL-функции, конфигурация Supabase.

---

## 🔴 КРИТИЧЕСКИЕ (Critical)

[x] C1. RLS-политики Supabase не проверяемы и, вероятно, неполны
- **Где:** `supabase/migrations/` содержит только `add_crypto_keys_to_shops.sql`. Политики RLS для таблиц `profiles`, `items`, `receipts`, `business_receipts`, `shops`, `waitlist` **отсутствуют в репозитории**.
- **Риск:** Весь клиентский код полагается на RLS как единственный контроль доступа (anon-ключ публичен). При некорректных RLS: утечка `private_key` всех магазинов (см. C2); чтение чужих `receipts`, `items`, `profiles`.
- **Действие:** Опубликовать/проверить RLS для каждой таблицы в Supabase Dashboard.

### C2. Приватные ключи Ed25519 хранятся в открытом виде
- **Где:** `js/business-panel.js:149-156` — insert `private_key` в таблицу `shops`; кэш в `sessionStorage` (`js/business-panel.js:26-33`).
- **Риск:** Приватный ключ магазина лежит в БД в plaintext. Любой XSS или утечка БД → полная компрометация подписей магазина.
- **Действие:** Не хранить `private_key` в таблице, доступной по RLS. Хранить в отдельной `security definer` функции или Vault.

### C3. `security definer` в `verify_get_receipt` без `search_path` (НОВОЕ)
- **Где:** SQL-функция `verify_get_receipt(p_fiscal_hash text)` с `security definer` **без explicit `search_path`**.
- **Риск:** Классическая вектор атаки: если злоумышленник может создать объекты в схеме, которая раньше в `search_path` (например, `public`), он может подменить таблицу `business_receipts` или `shops` своей, и функция, выполняющаяся с правами владельца, выполнит произвольный код.
- **Действие:** Добавить `set search_path = ''` (или `set search_path = 'public'`) в функцию.

---

## 🟠 ВЫСОКИЙ (High)

### H1. SQL-функция `verify_get_receipt` не проверяет владельца чека (НОВОЕ)
- **Где:** SQL-функция `verify_get_receipt(p_fiscal_hash text)`.
- **Риск:** Функция возвращает `public_key` магазина и данные чека любому, кто знает `fiscal_hash`. Это делает возможным enumeration: если fiscal_hash — это просто подпись (не hash), то короткие подписи можно брутфорсить.
- **Действие:** Убедиться что `fiscal_hash` — это действительно hash (SHA-256 от подписи), а не сама сырая подпись Ed25519 (которая сейчас используется). Сейчас `fiscal_hash` = `fiscalSignature` — это Base64-encoded Ed25519 подпись, не hash. Добавить хеширование подписи перед сохранением.

### H2. Слабая политика паролей при регистрации
- **Где:** `js/register.js:48` (только `password.length < 6`); `validatePassword` в `security.js` не вызывается.
- **Действие:** Использовать `validatePassword` в `register.js`.

### H3. Нет CAPTCHA на форме waitlist
- **Где:** `js/script.js` — форма `#waitlist-form` шлёт insert без Turnstile.
- **Действие:** Добавить Turnstile.

### H4. Rate-limit только на клиенте
- **Где:** `js/security.js` (`Map` в памяти браузера).
- **Действие:** Серверный rate-limit (Edge Function).

### H5. Загрузка файлов без серверной проверки MIME
- **Где:** `js/receipts.js:588-598` — проверка только размера и клиентский `accept`.
- **Действие:** Проверка MIME через `storage` bucket policy, запрет `text/html`/`image/svg+xml`.

### H6. Неполное удаление аккаунта
- **Где:** `js/dashboard-settings.js` — не удаляет `auth.users`, не чистит `business_receipts` с `customer_email`, `storage.list` не пагинирован (>100 файлов не удаляются).
- **Действие:** Edge Function с `auth.admin.deleteUser` + каскад.

### H7. Нет CSP-заголовков (было L8, повышаю до High)
- **Где:** Vercel — на всех страницах нет `Content-Security-Policy`.
- **Риск:** Все CDN-скрипты могут быть скомпрометированы через supply-chain атаку. XSS-уязвимость в любом из CDN-скриптов = полная компрометация всех пользователей.
- **Действие:** Добавить CSP-заголовки через `vercel.json` или `_headers`.

---

## 🟡 СРЕДНИЙ (Medium)

### M1. N+1 генерация signed URL при каждой загрузке страницы `receipts.html`
- **Где:** `js/receipts.js:59-72` — `attachFreshSignedUrls` вызывает `createSignedUrl` для **каждого** receipt-файла при каждом рендере.
- **Фикс:** Кешировать signed URLs или хранить их в БД.

### M2. Утечка слушателей на drop-zone (`receipts.js`)
- **Где:** `js/receipts.js:252-370` — `restoreListeners` при каждом рендере навешивает обработчики заново, старые не снимаются.
- **Фикс:** Использовать делегирование событий или `removeEventListener` перед повторным добавлением.

### M3. `saveToggle` глотает ошибки молча
- **Где:** `js/dashboard-settings.js:152-161` — `try/catch` с пустым `catch`.
- **Фикс:** Показывать toast при ошибке.

### M4. Мёртвый код: `window.renderNotifications` нигде не определён
- **Где:** `js/dashboard-items.js:63-65` — вызов `window.renderNotifications(safeItems)`, но функция никогда не объявлена.
- **Фикс:** Удалить вызов или реализовать функцию.

### M5. Несогласованный `vat_rate` по умолчанию
- **Где:** `js/business-panel.js:250` — `vatRate` по умолчанию `0`; `business.html` может иметь другое значение.
- **Фикс:** Синхронизировать дефолты.

### M6. `setSafeHTML` — риск XSS при allowHTML=true
- **Где:** `js/security.js:66-76` — `setSafeHTML(el, html, allowHTML=true)`. При allowHTML= true функция просто вызывает `innerHTML`, что может привести к XSS если caller передаст пользовательский ввод.
- **Фикс:** Убрать параметр `allowHTML` или документировать строгие требования.

### M7. Oтсутствие полей у старых записей (было L7)
- **Где:** При рендере бизнес-чеков предполагается наличие `qty`, `unit_price`, `vat_rate` и т.д. У старых записей этих полей может не быть.
- **Фикс:** Default-значения с `??` или `||`.

### M8. QR-код в PDF не содержит подпись в безопасном формате (НОВОЕ)
- **Где:** `js/receipt-generator.js:65` — QR data: `RECEIPT:${serial}|DATE:${date}|TAX:${vat}|TOTAL:${total}|...|SIG:${signature}`.
- **Риск:** Формат не имеет версионирования, разделители не экранированы (функция `qrEscape` тупо режет `|` и `:` из значений — ломает данные). Если в `purchaseDate` или `itemName` окажутся `|` или `:`, данные будут некорректно распарсены в `parseQRData`.
- **Фикс:** Использовать base64-urlencoded JSON или экранирование с обратной косой чертой.

### M9. `verify_get_receipt` возвращает `public_key` без проверки прав (НОВОЕ)
- **Где:** SQL-функция возвращает `public_key` магазина любому, кто знает `fiscal_hash`. `public_key` не является секретом по своей природе (это публичный ключ), но это позволяет отслеживать магазины.
- **Риск:** Низкий, но стоит отметить.

### M10. Ручное управление ключами — ключи не ротируются (НОВОЕ)
- **Где:** `js/business-panel.js` — при создании магазина генерируется одна пара ключей навсегда.
- **Риск:** При компрометации ключа нет механизма отзыва/ротации.
- **Фикс:** Добавить возможность перегенерации ключей.

---

## 🟢 НИЗКИЙ (Low)

### L1. `setInterval` без `clearInterval` на таймерах
- **Где:** `js/security.js:142` — `cleanupOldAttempts` запускает `setInterval` без сохранения ID для очистки.
- **Фикс:** Сохранять ID и чистить при `beforeunload`.

### L2. Новый Supabase-клиент на каждый вызов функции
- **Где:** `js/dashboard-auth.js:13,17` — `createClient` вызывается повторно при каждом `getAuthSession`.
- **Фикс:** Использовать единственный инстанс (singleton).

### L3. `let` после `return` (не会影响 выполнение, но странный код)
- **Где:** `js/dashboard-items.js` — объявление `let calendarCurrentMonth` и `let calendarCurrentYear` в глобальной области после функций.

### L4. `fa-undefined` при неизвестном типе тоста
- **Где:** `js/toast.js` — если тип тоста не 'success'/'error'/'warning', иконка будет `fa-undefined`.

### L5. Rate-limit считается до капчи
- **Где:** `js/auth.js:84-90` — `checkLoginRateLimit` вызывается до проверки капчи. Попытка входа без капчи всё равно увеличивает счётчик.
- **Фикс:** Проверять капчу перед rate-limit.

### L6. Anon-ключ захардкожен в клиентском коде
- **Где:** Каждый JS-файл содержит fallback `|| 'sb_publishable_...'`. Это нормально для архитектуры Supabase (anon-ключ публичен по дизайну), но стоит убедиться что RLS работает.
- **Риск:** Только при неработающих RLS (см. C1).

### L7. `check_profile_exists` RPC не в репозитории
- **Где:** `js/business-panel.js:286` — вызов `rpc('check_profile_exists', ...)`. Определение этой функции не найдено в репозитории.

### L8. `parseQRData` не валидирует входной формат (НОВОЕ)
- **Где:** `js/verify.js:102-118` — разбивает строку по `|` и ищет `:`.
- **Риск:** Если QR-код содержит мусор, функция вернёт пустые поля и `verifyReceiptFromQRData` может выдать вводящий в заблуждение результат.

---

## 📊 Сводка по приоритетам

| Приоритет | Количество |
|-----------|-----------|
| 🔴 Critical | 3 (C1, C2, C3) |
| 🟠 High | 7 (H1–H7) |
| 🟡 Medium | 10 (M1–M10) |
| 🟢 Low | 8 (L1–L8) |

---

## 🔍 Специальная заметка: твоя SQL-функция `verify_get_receipt`

```sql
create function verify_get_receipt(p_fiscal_hash text)
returns json
language plpgsql
security definer  -- ⚠️ без search_path
as $$
declare
  result json;
begin
  select json_build_object(...) into result
  from business_receipts r
  join shops s on s.id = r.shop_id
  where r.fiscal_hash = p_fiscal_hash;

  if result is null then
    return json_build_object('found', false, 'receipt', null, 'shop', null);
  end if;
  return result;
end;
$$;
```

**Что ты сделал правильно:**
- Используешь параметризованный запрос (`where r.fiscal_hash = p_fiscal_hash`) — SQL-инъекции нет.
- Возвращаешь `found: false` вместо ошибки, если чек не найден — хороший UX.
- Используешь `json_build_object` — читаемо и типобезопасно.

**Что нужно исправить:**
1. **C3 (Critical):** `security definer` без `set search_path = ''`. Если злоумышленник создаст таблицу `public.business_receipts` (или `public.shops`) с триггером/правилом, функция выполнит код от имени владельца. Фикс: добавить `set search_path = 'public'` (или `''`).
2. **H1 (High):** Возвращаешь `public_key` магазина. Это нормально (публичный ключ по определению публичен), но убедись что RLS не даёт злоумышленникам вставлять фейковые магазины.
3. **M9 (Medium):** Нет лимита на количество вызовов. При 1000 RPS база ляжет.
4. **Архитектурно:** `fiscal_hash` — это не hash, это сама подпись Ed25519 в Base64. Хэширование подписи (SHA-256) перед сохранением сделало бы поле фиксированной длины и предотвратило бы потенциальные коллизии/атаки на длину ключа.

**Также ключевой момент (ты просил «на что закрываешь глаза»):**
Вся крипто-система построена на том, что `private_key` лежит в той же таблице (`shops`), к которой у анонимного клиента (через `anon key`) может быть доступ. Если RLS хотя бы на одной из таблиц не защищает `private_key` — вся система подписи ничего не стоит. Любой, кто получит `private_key` магазина, сможет подписывать чеки от имени этого магазина, и `verifyReceipt()` скажет `valid: true`.

---

## 🎯 Итог: 3 главные вещи, которые реально надо починить

1. **C1 → проверить RLS в Supabase Dashboard.** Без этого всё остальное бессмысленно.
2. **C2 → убрать `private_key` из `shops` таблицы.** Хранить в Vault или отдельной `security definer` RPC с доступом только по `owner_id`.
3. **C3 → `set search_path = 'public'` в `verify_get_receipt`.** Это занимает 1 строку и закрывает потенциальную эскалацию привилегий.