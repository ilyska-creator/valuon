import { logError } from './security.js';

class Ed25519Signer {
    constructor() {
        this.keyPair = null;
        this.publicKey = null;
        this.privateKey = null;
    }


    async generateKeyPair() {
        try {
            const keyPair = await window.crypto.subtle.generateKey(
                {
                    name: 'Ed25519',
                    namedCurve: 'Ed25519'
                },
                true,
                ['sign', 'verify']
            );

            this.keyPair = keyPair;
            this.publicKey = keyPair.publicKey;
            this.privateKey = keyPair.privateKey;

            return keyPair;
        } catch (error) {
            logError('crypto:keyGen', error);
            throw new Error('Ed25519 is not supported in this browser. Please use Chrome 137+, Firefox 129+, or Safari 17+');
        }
    }


    async exportPublicKey(publicKey = this.publicKey) {
        if (!publicKey) throw new Error('No public key available');

        const exported = await window.crypto.subtle.exportKey('spki', publicKey);
        const exportedAsBase64 = this.arrayBufferToBase64(exported);
        return exportedAsBase64;
    }


    async importPublicKey(base64Key) {
        const binaryString = this.base64ToArrayBuffer(base64Key);
        return await window.crypto.subtle.importKey(
            'spki',
            binaryString,
            {
                name: 'Ed25519',
                namedCurve: 'Ed25519'
            },
            true,
            ['verify']
        );
    }


    async exportPrivateKey(privateKey = this.privateKey) {
        if (!privateKey) throw new Error('No private key available');

        const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
        const exportedAsBase64 = this.arrayBufferToBase64(exported);
        return exportedAsBase64;
    }


    async importPrivateKey(base64Key) {
        const binaryString = this.base64ToArrayBuffer(base64Key);
        return await window.crypto.subtle.importKey(
            'pkcs8',
            binaryString,
            {
                name: 'Ed25519',
                namedCurve: 'Ed25519'
            },
            true,
            ['sign']
        );
    }


    async sign(data, privateKey = this.privateKey) {
        if (!privateKey) throw new Error('No private key available for signing');

        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);

        const signature = await window.crypto.subtle.sign(
            'Ed25519',
            privateKey,
            dataBuffer
        );

        return this.arrayBufferToBase64(signature);
    }


    async verify(data, signatureBase64, publicKey = this.publicKey) {
        if (!publicKey) throw new Error('No public key available for verification');

        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const signatureBuffer = this.base64ToArrayBuffer(signatureBase64);

        const isValid = await window.crypto.subtle.verify(
            'Ed25519',
            publicKey,
            signatureBuffer,
            dataBuffer
        );

        return isValid;
    }


    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }


    base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }


    static isSupported() {
        return 'crypto' in window &&
            'subtle' in window.crypto &&
            typeof window.crypto.subtle.generateKey === 'function';
    }
}

export default Ed25519Signer;

// ⚠️ ИСПРАВЛЕНИЕ (аудит C3): раньше строка для подписи собиралась из
// «сырых» значений формы (например, purchase_date вида "2026-07-07T14:30"
// и net/vat — необработанные float с плавающей точкой вроде
// "19.900000000000002"), а строка для проверки — из значений,
// возвращённых Supabase из БД, которые сериализуются иначе
// ("2026-07-07T14:30:00+00:00", "19.9" и т.п.). Строки не совпадали —
// verify() возвращал false для абсолютно любого, даже подлинного чека.
//
// Обе стороны (подпись в business-panel.js, проверка в
// crypto-verification.js) теперь обязаны использовать эту функцию, чтобы
// собирать данные для подписи в одном и том же каноническом виде,
// независимо от того, откуда пришли значения — из формы или из БД.
const canonicalAmount = (value) => {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(num) ? num.toFixed(2) : '0.00';
};

// Берём только дату (YYYY-MM-DD), без времени и часового пояса —
// это единственная часть значения, которая гарантированно совпадает
// и на входе из формы (datetime-local), и на выходе из Postgres
// (date/timestamp/timestamptz), какой бы формат сериализации ни
// использовался.
const canonicalDate = (value) => {
    if (!value) return '';
    const str = String(value);
    const isoLike = str.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoLike) return isoLike[0];
    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? str : parsed.toISOString().slice(0, 10);
};

// Товар — свободный текст (продавец может вписать что угодно, включая
// "|", ";" и "~", которые мы используем как разделители в канонической
// строке). Если не экранировать, два разных набора позиций могут дать
// одинаковую строку для подписи (например, товар "A|1|10" в одной позиции
// против "A" и "1|10" в двух) — это ослабляет подпись ровно так же, как
// неэкранированный qrEscape в receipt-generator.js (см. аудит M8).
//
// encodeURIComponent убирает "|" (→ %7C) и ";" (→ %3B), НО НЕ убирает "~":
// тильда — безопасный символ URI и остаётся литералом. Поэтому после
// кодирования дополнительно заменяем все оставшиеся "~" на "%7E".
// Это безопасно: encodeURIComponent сам никогда не выдаёт "%7E", а
// введённая продавцом строка "%7E" превратится в "%257E" (символ "%"
// кодируется) — то есть "%7E" в результате может появиться только из
// нашей замены, и декодирование round-trip работает однозначно.
const canonicalItemName = (value) => encodeURIComponent(String(value ?? '').trim()).replace(/~/g, '%7E');

// Одна позиция чека -> одна каноническая подстрока. Срок гарантии входит
// в подпись: это коммерческое обязательство продавца, и если его не
// защитить подписью, кто угодно с доступом к БД (или сам продавец задним
// числом) мог бы "продлить" или обнулить гарантию без следа.
const canonicalItemLine = (item) => [
    canonicalItemName(item.itemName),
    String(item.qty ?? ''),
    canonicalAmount(item.unitPrice),
    canonicalAmount(item.vatRate ?? 0),
    String(item.warrantyMonths ?? 0),
    canonicalAmount(item.netTotal),
    canonicalAmount(item.vatAmount),
].join('~');

export function buildSignaturePayload({ taxId, purchaseDate, items, netTotal, vatAmount, grossTotal }) {
    const itemsPart = (items || []).map(canonicalItemLine).join(';');

    return [
        String(taxId ?? ''),
        itemsPart,
        canonicalAmount(netTotal),
        canonicalAmount(vatAmount),
        canonicalAmount(grossTotal),
        canonicalDate(purchaseDate),
    ].join('|');
}