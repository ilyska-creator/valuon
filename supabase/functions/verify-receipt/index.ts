// supabase/functions/verify-receipt/index.ts//
// Серверная верификация чека Valuon.
//
// Раньше: браузер сам вызывал verify_get_receipt (anon key) и сам же
// проверял подпись через WebCrypto — то есть "проверяющий" был тем же
// клиентом, которому нельзя доверять.
//
// Теперь: браузер отправляет сюда только fiscal_hash. Функция:
//   1. Рейт-лимитит запрос по IP.
//   2. Достаёт чек + shop.public_key через service_role (RPC c ограниченным
//      доступом, см. supabase/migrations/20260717_server_side_verification.sql).
//   3. Сама проверяет Ed25519-подпись (та же логика, что и при выписке).
//   4. Отдаёт клиенту только { valid, receipt } — без public_key и без
//      сырой подписи, они клиенту больше не нужны.
//
// Деплой: supabase functions deploy verify-receipt --no-verify-jwt
// (--no-verify-jwt — потому что вызывать её должны анонимные посетители
// страницы verify.html, без сессии).


import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;


const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://valuon.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


// ----------------------------------------------------------------------------
// Каноническая сборка строки для подписи — 1:1 портировано из
// js/crypto-signature.js. Если меняете один файл — обязательно синхронно
// поменяйте и второй, иначе валидные чеки начнут считаться поддельными
// (см. комментарий в crypto-signature.js про баг с рассинхроном форматов).
// ----------------------------------------------------------------------------
const canonicalAmount = (value: unknown): string => {
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
};


const canonicalDate = (value: unknown): string => {
  if (!value) return "";
  const str = String(value);
  const isoLike = str.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoLike) return isoLike[0];
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? str : parsed.toISOString().slice(0, 10);
};


const canonicalItemName = (value: unknown): string =>
  encodeURIComponent(String(value ?? "").trim());


interface CanonicalItem {
  itemName: unknown;
  qty: unknown;
  unitPrice: unknown;
  vatRate: unknown;
  warrantyMonths: unknown;
  netTotal: unknown;
  vatAmount: unknown;
}


const canonicalItemLine = (item: CanonicalItem): string =>
  [
    canonicalItemName(item.itemName),
    String(item.qty ?? ""),
    canonicalAmount(item.unitPrice),
    canonicalAmount(item.vatRate ?? 0),
    String(item.warrantyMonths ?? 0),
    canonicalAmount(item.netTotal),
    canonicalAmount(item.vatAmount),
  ].join("~");


function buildSignaturePayload(params: {
  taxId: unknown;
  purchaseDate: unknown;
  items: CanonicalItem[];
  netTotal: unknown;
  vatAmount: unknown;
  grossTotal: unknown;
}): string {
  const itemsPart = (params.items || []).map(canonicalItemLine).join(";");
  return [
    String(params.taxId ?? ""),
    itemsPart,
    canonicalAmount(params.netTotal),
    canonicalAmount(params.vatAmount),
    canonicalAmount(params.grossTotal),
    canonicalDate(params.purchaseDate),
  ].join("|");
}


// ----------------------------------------------------------------------------
// Ed25519: импорт публичного ключа (spki/base64) и verify — то же самое
// API, что и в браузере (WebCrypto), просто в Deno.
// ----------------------------------------------------------------------------
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}


async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(base64Key),
    { name: "Ed25519", namedCurve: "Ed25519" },
    true,
    ["verify"],
  );
}


async function verifySignature(
  data: string,
  signatureBase64: string,
  publicKey: CryptoKey,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const signatureBuffer = base64ToArrayBuffer(signatureBase64);
  return await crypto.subtle.verify("Ed25519", publicKey, signatureBuffer, dataBuffer);
}


// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }


  if (req.method !== "POST") {
    return json({ valid: false, error: "method_not_allowed" }, 200);
  }


  let body: { fiscal_hash?: string };
  try {
    body = await req.json();
  } catch {
    return json({ valid: false, error: "bad_request" }, 200);
  }


  const fiscalHash = (body.fiscal_hash || "").trim();
  if (!fiscalHash) {
    return json({ valid: false, error: "missing_fiscal_hash" }, 200);
  }


  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);


  // --- rate limit по IP ------------------------------------------------
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
  const ipHash = await sha256Hex(ip);


  const { data: allowed, error: rlError } = await supabase.rpc(
    "check_and_log_verify_attempt",
    { p_ip_hash: ipHash, p_fiscal_hash: fiscalHash, p_limit: 20, p_window: "1 minute" },
  );


  if (rlError) {
    console.error("[verify-receipt] rate limit rpc error:", rlError);
    // не блокируем пользователя из-за сбоя инфраструктуры, но логируем
  } else if (allowed === false) {
    return json({ valid: false, error: "rate_limited" }, 200);
  }


  // --- получаем чек + shop.public_key через ограниченную RPC ------------
  const { data, error } = await supabase
    .rpc("verify_get_receipt", { p_fiscal_hash: fiscalHash })
    .maybeSingle();


  if (error) {
    console.error("[verify-receipt] db error:", error);
    return json({ valid: false, error: "internal_error" }, 500);
  }


  if (!data?.found) {
    await safeMark(supabase, ipHash, false);
    return json({ valid: false, error: "not_found" }, 200);
  }


  const receipt = data.receipt;
  const shop = data.shop;


  if (!shop?.public_key) {
    await safeMark(supabase, ipHash, false);
    return json({ valid: false, error: "shop_key_missing" }, 200);
  }


  if (!Array.isArray(receipt.items) || receipt.items.length === 0) {
    await safeMark(supabase, ipHash, false);
    return json({ valid: false, error: "no_line_items" }, 200);
  }


  try {
    const publicKey = await importPublicKey(shop.public_key);


    const items: CanonicalItem[] = receipt.items.map((it: Record<string, unknown>) => ({
      itemName: it.item_name,
      qty: it.qty,
      unitPrice: it.unit_price,
      vatRate: it.vat_rate,
      warrantyMonths: it.warranty_months,
      netTotal: it.net_total,
      vatAmount: it.vat_amount,
    }));


    const signData = buildSignaturePayload({
      taxId: shop.tax_id,
      purchaseDate: receipt.purchase_date,
      items,
      netTotal: receipt.net_total,
      vatAmount: receipt.vat_amount,
      grossTotal: receipt.gross_total,
    });


    const isValid = await verifySignature(signData, receipt.fiscal_hash, publicKey);
    await safeMark(supabase, ipHash, isValid);


    if (!isValid) {
      return json({ valid: false, error: "signature_invalid" }, 200);
    }


    // Серийник кассы (номер КСО). RPC verify_get_receipt может не включать
    // pos_serial в свой ответ — добираем напрямую через service_role.
    let posSerial: string | null = receipt.pos_serial ?? null;
    if (posSerial === null) {
      try {
        const { data: reg } = await supabase
          .from("business_receipts")
          .select("pos_serial")
          .eq("fiscal_hash", fiscalHash)
          .maybeSingle();
        posSerial = reg?.pos_serial ?? null;
      } catch (e) {
        console.error("[verify-receipt] pos_serial fetch failed:", e);
      }
    }


    // Клиенту отдаём только то, что нужно для отображения результата —
    // без public_key, без сырой подписи, без внутренних id.
    return json({
      valid: true,
      receipt: {
        receiptNumber: receipt.receipt_number,
        purchaseDate: receipt.purchase_date,
        paymentMethod: receipt.payment_method,
        status: receipt.status,
        posSerial,
        netTotal: receipt.net_total,
        vatAmount: receipt.vat_amount,
        grossTotal: receipt.gross_total,
        items: receipt.items.map((it: Record<string, unknown>) => ({
          item_name: it.item_name,
          qty: it.qty,
          unit_price: it.unit_price,
          warranty_months: it.warranty_months,
          gross_total: it.gross_total,
        })),
      },
      shop: {
        shopName: shop.shop_name,
      },
    }, 200);
  } catch (err) {
    console.error("[verify-receipt] verification error:", err);
    await safeMark(supabase, ipHash, false);
    return json({ valid: false, error: "verification_failed" }, 200);
  }
});


async function safeMark(
  supabase: ReturnType<typeof createClient>,
  ipHash: string,
  valid: boolean,
) {
  try {
    await supabase.rpc("mark_last_verify_attempt", { p_ip_hash: ipHash, p_valid: valid });
  } catch (e) {
    console.error("[verify-receipt] mark attempt failed:", e);
  }
}


async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}


function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
