// Builds the printable receipt card as a real DOM element (mirrors the
// visual design signed off in docs/test.html) so it can be rasterized by
// html2canvas into a pixel-accurate PDF. All user-controlled strings go
// through textContent — never innerHTML — since business owners and buyers
// are in different trust domains (a shop's item/store name ends up
// rendered in a *buyer's* browser when they download their receipt).

const FONTS_LINK_ID = 'valuon-receipt-fonts';
const CARD_WIDTH = 800; // css px — the layout units below assume this width

const COLORS = {
    cardBg: '#FAFAF9',
    text: '#15171A',
    muted: '#9A9C9F',
    secondary: '#63666C',
    divider: '#E2E1DC',
    accent: '#0E6B4C',
    accentBg: '#E8F2ED',
    discountText: '#B4552F',
    discountBg: '#FBEEE8',
    rowBg: '#F2F1ED',
};

const FONT_SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
const FONT_SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";

function el(tag, style = {}, { text, attrs, cls } = {}) {
    const node = document.createElement(tag);
    Object.assign(node.style, style);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (cls) node.className = cls;
    return node;
}

// Marks an element as a unit that must never be split across PDF pages —
// see findSafePageBreaks() in receipt-generator.js.
function atomic(node) {
    node.dataset.pageAtomic = '1';
    return node;
}

export function ensureReceiptFontsLoaded() {
    if (!document.getElementById(FONTS_LINK_ID)) {
        const preconnect = document.createElement('link');
        preconnect.rel = 'preconnect';
        preconnect.href = 'https://fonts.googleapis.com';
        document.head.appendChild(preconnect);

        const link = document.createElement('link');
        link.id = FONTS_LINK_ID;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';
        document.head.appendChild(link);
    }

    const specimens = [
        '600 33px Fraunces', '500 19px Fraunces', '600 29px Fraunces',
        '400 14px Inter', '500 14px Inter', '600 15px Inter',
        '400 11px "IBM Plex Mono"', '500 11px "IBM Plex Mono"',
    ];

    const loadAll = Promise.all(specimens.map((s) => document.fonts.load(s).catch(() => null)))
        .then(() => document.fonts.ready);

    // Fonts should load in well under a second off a warm CDN cache; if
    // something stalls (offline, blocked request) we still render rather
    // than hang the download forever — the fallback stacks above keep the
    // result legible even without the webfonts.
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
    return Promise.race([loadAll, timeout]);
}

function deriveDiscountPct(item) {
    if (item.discount_rate !== undefined && item.discount_rate !== null) {
        const stored = Number(item.discount_rate);
        if (Number.isFinite(stored)) return stored;
    }
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const netTotal = Number(item.net_total);
    const base = qty * unitPrice;
    if (!base || !Number.isFinite(netTotal)) return 0;
    const pct = (1 - netTotal / base) * 100;
    return pct > 0.05 ? pct : 0;
}

// fiscal_hash is a base64-encoded Ed25519 signature, so it's case-sensitive
// — unlike the placeholder hex string in the original mockup, it must not
// be uppercased (that would silently fold distinct signatures together).
function formatFiscalHashChip(hash) {
    if (!hash) return 'PENDING';
    const clean = String(hash).replace(/\s+/g, '').slice(0, 16);
    if (!clean) return 'PENDING';
    return clean.match(/.{1,4}/g).join(' ');
}

function initialsFor(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '—';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

function formatDate(isoString) {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '—';
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${datePart} · ${timePart}`;
}

const PAYMENT_LABELS = { card: 'Card', cash: 'Cash' };
function formatPayment(method) {
    if (!method) return '—';
    return PAYMENT_LABELS[method] || (method.charAt(0).toUpperCase() + method.slice(1));
}

function moneyFormatter(currency) {
    return (v) => window.formatCurrency(Number(v) || 0, currency || 'EUR', 'en');
}

function crosshair(vSide, hSide) {
    const wrap = el('div', {
        position: 'absolute', [vSide]: '24px', [hSide]: '24px', width: '14px', height: '14px',
    });
    wrap.appendChild(el('div', { position: 'absolute', width: '100%', height: '1px', top: '50%', left: '0', background: COLORS.muted, opacity: '0.55' }));
    wrap.appendChild(el('div', { position: 'absolute', width: '1px', height: '100%', left: '50%', top: '0', background: COLORS.muted, opacity: '0.55' }));
    return wrap;
}

function buildHeader(receipt, shop, opts) {
    const wrap = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', marginBottom: '34px' });

    const left = el('div', { display: 'flex', alignItems: 'flex-start', gap: '18px', minWidth: '0', flex: '1 1 auto' });

    let avatar;
    if (opts.logoDataUrl) {
        avatar = el('img', {
            width: '58px', height: '58px', borderRadius: '10px', border: `1px solid ${COLORS.text}`,
            objectFit: 'cover', flex: 'none', marginTop: '2px',
        }, { attrs: { src: opts.logoDataUrl } });
    } else {
        avatar = el('div', {
            width: '58px', height: '58px', borderRadius: '10px', border: `1px solid ${COLORS.text}`,
            background: COLORS.accentBg, color: COLORS.accent, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontFamily: FONT_SERIF, fontWeight: '500', fontSize: '19px',
            flex: 'none', marginTop: '2px',
        }, { text: initialsFor(shop.shop_name) });
    }
    left.appendChild(avatar);

    const info = el('div', { minWidth: '0', flex: '1 1 auto' });
    info.appendChild(el('h1', {
        fontFamily: FONT_SERIF, fontWeight: '600', fontSize: '33px', letterSpacing: '-0.01em',
        margin: '0 0 10px', lineHeight: '1.15', overflowWrap: 'break-word',
    }, { text: shop.shop_name || 'Unnamed Store' }));

    if (shop.address) {
        info.appendChild(el('p', {
            margin: '0 0 4px', fontSize: '13.5px', color: COLORS.secondary, lineHeight: '1.5', overflowWrap: 'break-word',
        }, { text: shop.address }));
    }

    const idLine = [];
    if (shop.tax_id) idLine.push(`TAX ID ${shop.tax_id}`);
    if (receipt.pos_serial) idLine.push(`REG S/N ${receipt.pos_serial}`);
    if (idLine.length) {
        info.appendChild(el('p', {
            margin: '10px 0 0', fontFamily: FONT_MONO, fontSize: '11px', color: COLORS.muted,
            letterSpacing: '0.02em', overflowWrap: 'break-word', lineHeight: '1.6',
        }, { text: idLine.join('   ·   ') }));
    }
    left.appendChild(info);
    wrap.appendChild(left);

    const right = el('div', { textAlign: 'right', flex: 'none', minWidth: '0' });
    right.appendChild(el('div', {
        fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '0.14em', color: COLORS.muted, textTransform: 'uppercase',
    }, { text: 'Receipt' }));
    const serial = receipt.receipt_number ? `RCP-${receipt.receipt_number}` : `RCP-${String(receipt.id || '').slice(0, 8).toUpperCase()}`;
    right.appendChild(el('div', {
        fontFamily: FONT_MONO, fontSize: '22px', fontWeight: '500', marginTop: '8px', color: COLORS.text,
        overflowWrap: 'break-word', maxWidth: '220px',
    }, { text: serial }));
    wrap.appendChild(right);

    return wrap;
}

function metaCol(label, value, opts = {}) {
    const col = el('div', { padding: opts.padding || '0 20px', minWidth: '0', ...(opts.border ? { borderLeft: `1px solid ${COLORS.divider}` } : {}) });
    col.appendChild(el('div', {
        fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
        color: COLORS.muted, marginBottom: '7px',
    }, { text: label }));
    col.appendChild(el('div', {
        fontSize: '14.5px', fontWeight: '500', overflowWrap: 'break-word', minWidth: '0',
    }, { text: value }));
    return col;
}

function buildTopBlock(receipt, shop, opts) {
    const block = atomic(el('div', {}));

    const eyebrow = el('div', {
        display: 'flex', alignItems: 'center', gap: '10px', fontFamily: FONT_MONO, fontSize: '11px',
        letterSpacing: '0.14em', color: COLORS.muted, textTransform: 'uppercase', marginBottom: '40px',
    });
    eyebrow.appendChild(el('span', { width: '6px', height: '6px', borderRadius: '50%', background: COLORS.accent, flex: 'none' }));
    eyebrow.appendChild(el('span', {}, { text: 'VALUON · DIGITAL RECEIPT' }));
    eyebrow.appendChild(el('span', { flex: '1', height: '1px', background: COLORS.divider }));
    block.appendChild(eyebrow);

    block.appendChild(buildHeader(receipt, shop, opts));
    block.appendChild(el('div', { height: '1px', background: COLORS.divider }));

    const grid = el('div', { display: 'flex', padding: '26px 0' });
    grid.appendChild(metaCol('Date', formatDate(receipt.purchase_date), { padding: '0 20px 0 0' }));
    grid.appendChild(metaCol('Customer', receipt.customer_email || '—', { border: true }));
    grid.appendChild(metaCol('Payment', formatPayment(receipt.payment_method), { border: true, padding: '0 0 0 20px' }));
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '0.85fr 1.3fr 0.85fr';
    block.appendChild(grid);

    return block;
}

function tableHeaderRow() {
    const cols = [
        ['Item', 'left'], ['Qty', 'right'], ['Price', 'right'], ['Discount', 'right'], ['Tax', 'right'], ['Total', 'right'],
    ];
    const tr = el('tr', {});
    cols.forEach(([label, align]) => {
        tr.appendChild(el('th', {
            width: label === 'Item' ? '36%' : undefined, textAlign: align, fontFamily: FONT_MONO, fontSize: '10px',
            letterSpacing: '0.12em', textTransform: 'uppercase', color: COLORS.muted, fontWeight: '500',
            padding: '0 0 14px', borderBottom: `1px solid ${COLORS.text}`,
        }, { text: label }));
    });
    return tr;
}

function itemRow(item, isLast, moneyFn) {
    const borderColor = isLast ? COLORS.text : COLORS.divider;
    const tr = atomic(el('tr', {}));

    const nameCell = el('td', { padding: '22px 0', borderBottom: `1px solid ${borderColor}`, verticalAlign: 'top', maxWidth: '0', width: '36%' });
    nameCell.appendChild(el('div', {
        fontWeight: '600', fontSize: '15.5px', marginBottom: '5px', overflowWrap: 'break-word', minWidth: '0',
    }, { text: item.item_name || '—' }));
    if (item.warranty_months) {
        const warrantyDiv = el('div', { fontSize: '12px', color: COLORS.secondary, overflowWrap: 'break-word' });
        warrantyDiv.appendChild(el('span', { color: COLORS.muted }, { text: 'Warranty · ' }));
        warrantyDiv.appendChild(document.createTextNode(`${item.warranty_months} months`));
        nameCell.appendChild(warrantyDiv);
    }
    tr.appendChild(nameCell);

    const numCell = (text, opts = {}) => el('td', {
        padding: '22px 0', borderBottom: `1px solid ${borderColor}`, verticalAlign: 'top', textAlign: 'right',
        whiteSpace: 'nowrap', fontFamily: FONT_MONO, fontSize: '14px', ...opts,
    }, { text });

    tr.appendChild(numCell(String(item.qty ?? '—')));
    tr.appendChild(numCell(moneyFn(item.unit_price)));

    const discountPct = deriveDiscountPct(item);
    const discountCell = el('td', { padding: '22px 0', borderBottom: `1px solid ${borderColor}`, verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' });
    if (discountPct > 0) {
        discountCell.appendChild(el('span', {
            display: 'inline-block', fontFamily: FONT_MONO, fontSize: '11px', fontWeight: '500',
            color: COLORS.discountText, background: COLORS.discountBg, borderRadius: '4px', padding: '3px 8px',
            whiteSpace: 'nowrap',
        }, { text: `−${Math.round(discountPct)}%` }));
    } else {
        discountCell.textContent = '—';
        discountCell.style.color = COLORS.muted;
        discountCell.style.fontFamily = FONT_MONO;
        discountCell.style.fontSize = '14px';
    }
    tr.appendChild(discountCell);

    const vatRate = item.vat_rate;
    tr.appendChild(numCell(vatRate !== undefined && vatRate !== null ? `${Number(vatRate)}%` : '—'));
    tr.appendChild(numCell(moneyFn(item.gross_total), { fontSize: '14.5px', fontWeight: '600' }));

    return tr;
}

function buildItemsTable(items, moneyFn) {
    const table = el('table', { width: '100%', borderCollapse: 'collapse', marginTop: '6px' });
    // Marked atomic so a page break can never land inside the header row
    // itself — receipt-generator.js separately crops this band out to
    // repeat it atop continuation pages, and relies on it staying intact.
    const thead = atomic(el('thead', {}));
    thead.appendChild(tableHeaderRow());
    table.appendChild(thead);

    const tbody = el('tbody', {});
    items.forEach((item, i) => tbody.appendChild(itemRow(item, i === items.length - 1, moneyFn)));
    table.appendChild(tbody);

    return table;
}

function buildTotalsBlock(receipt, items, moneyFn) {
    const block = atomic(el('div', { display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }));
    const box = el('div', { width: '300px', background: COLORS.rowBg, padding: '18px 22px', display: 'flex', flexDirection: 'column' });

    const row = (label, value, style = {}) => {
        const r = el('div', { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', color: COLORS.secondary, ...style });
        r.appendChild(el('span', {}, { text: label }));
        r.appendChild(el('span', {}, { text: value }));
        return r;
    };

    const netTotal = Number(receipt.net_total) || 0;
    const vatAmount = Number(receipt.vat_amount) || 0;
    const grossTotal = Number(receipt.gross_total) || 0;

    const grossBeforeDiscount = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
    const totalDiscount = Math.max(0, grossBeforeDiscount - netTotal);

    box.appendChild(row('Net amount', moneyFn(netTotal)));
    if (totalDiscount > 0.005) {
        box.appendChild(row('Discount', `−${moneyFn(totalDiscount)}`, { color: COLORS.discountText, fontWeight: '500' }));
    }

    const rates = [...new Set(items.map((it) => (it.vat_rate !== undefined && it.vat_rate !== null ? Number(it.vat_rate) : null)).filter((v) => v !== null))].sort((a, b) => a - b);
    const vatLabel = rates.length <= 1 ? `Tax${rates.length ? ` (${rates[0]}%)` : ''}` : `Tax (${rates.join('/')}%)`;
    const vatRow = row(vatLabel, moneyFn(vatAmount));
    vatRow.style.flexWrap = 'wrap';
    box.appendChild(vatRow);

    const grossRow = el('div', {
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '12px',
        paddingTop: '16px', borderTop: `1px solid ${COLORS.text}`,
    });
    grossRow.appendChild(el('span', {
        fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: COLORS.text,
    }, { text: 'Gross total' }));
    grossRow.appendChild(el('span', {
        fontFamily: FONT_SERIF, fontWeight: '600', fontSize: '29px', color: COLORS.text, overflowWrap: 'break-word', textAlign: 'right',
    }, { text: moneyFn(grossTotal) }));
    box.appendChild(grossRow);

    block.appendChild(box);

    const wrapper = el('div', {});
    wrapper.appendChild(block);
    if (totalDiscount > 0.005) {
        wrapper.appendChild(el('div', {
            marginTop: '10px', textAlign: 'right', fontSize: '11.5px', color: COLORS.accent,
        }, { text: `You saved ${moneyFn(totalDiscount)} on this order` }));
    }
    return wrapper;
}

function buildVerifyBlock(receipt, qrDataUrl) {
    const block = atomic(el('div', {
        marginTop: '48px', padding: '24px', background: COLORS.rowBg, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap',
    }));

    const left = el('div', { display: 'flex', alignItems: 'center', gap: '18px', minWidth: '0' });
    if (qrDataUrl) {
        left.appendChild(el('img', {
            width: '112px', height: '112px', border: `1px solid ${COLORS.divider}`, borderRadius: '4px',
            padding: '4px', flex: 'none', boxSizing: 'border-box',
        }, { attrs: { src: qrDataUrl } }));
    }
    const textCol = el('div', { minWidth: '0' });
    textCol.appendChild(el('h4', { margin: '0 0 5px', fontSize: '13.5px', fontWeight: '600' }, { text: 'Scan to verify' }));
    textCol.appendChild(el('p', {
        margin: '0', fontSize: '11.5px', color: COLORS.secondary, lineHeight: '1.5', maxWidth: '230px', overflowWrap: 'break-word',
    }, { text: 'Cryptographic proof of the total, tax, seller identity and timestamp on this receipt.' }));
    textCol.appendChild(el('div', {
        marginTop: '8px', fontFamily: FONT_MONO, fontSize: '10.5px', color: COLORS.muted, letterSpacing: '0.06em', overflowWrap: 'break-word',
    }, { text: formatFiscalHashChip(receipt.fiscal_hash) }));
    left.appendChild(textCol);
    block.appendChild(left);

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    Object.assign(svg.style, { width: '100px', height: '100px', display: 'block', flex: 'none' });

    const defs = document.createElementNS(ns, 'defs');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('id', 'ringPath');
    path.setAttribute('d', 'M 60,60 m -46,0 a 46,46 0 1,1 92,0 a 46,46 0 1,1 -92,0');
    defs.appendChild(path);
    svg.appendChild(defs);

    const mk = (tag, attrs) => {
        const n = document.createElementNS(ns, tag);
        for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
        return n;
    };
    svg.appendChild(mk('circle', { cx: '60', cy: '60', r: '34', fill: COLORS.accentBg }));
    svg.appendChild(mk('circle', { cx: '60', cy: '60', r: '46', fill: 'none', stroke: COLORS.accent, 'stroke-width': '1', opacity: '0.35' }));
    svg.appendChild(mk('circle', { cx: '60', cy: '60', r: '40', fill: 'none', stroke: COLORS.accent, 'stroke-width': '1', opacity: '0.35' }));

    const text = document.createElementNS(ns, 'text');
    Object.assign(text.style, { fontFamily: FONT_MONO, fontSize: '6.6px', letterSpacing: '0.15em', fill: COLORS.accent, textTransform: 'uppercase' });
    const textPath = document.createElementNS(ns, 'textPath');
    textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#ringPath');
    textPath.setAttribute('href', '#ringPath');
    textPath.setAttribute('startOffset', '0%');
    textPath.textContent = 'ED25519 SIGNED · VERIFIED · ED25519 SIGNED · VERIFIED · ';
    text.appendChild(textPath);
    svg.appendChild(text);

    svg.appendChild(mk('path', { d: 'M46 61 L56 71 L76 49', stroke: COLORS.accent, fill: 'none', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

    const svgWrap = el('div', { position: 'relative', width: '100px', height: '100px', flex: 'none' });
    svgWrap.appendChild(svg);
    block.appendChild(svgWrap);

    return block;
}

function buildFooter() {
    const block = atomic(el('div', {
        marginTop: '36px', paddingTop: '20px', borderTop: `1px solid ${COLORS.divider}`, textAlign: 'center',
        fontSize: '10.5px', color: COLORS.muted, lineHeight: '1.6',
    }));
    const strong = el('strong', {
        color: COLORS.secondary, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '0.1em',
    }, { text: 'VALUON DIGITAL RECEIPT SYSTEM' });
    block.appendChild(strong);
    block.appendChild(document.createElement('br'));
    block.appendChild(document.createTextNode('This document complies with international fiscal standards, signed by the Valuon digital infrastructure.'));
    block.appendChild(document.createElement('br'));
    block.appendChild(document.createTextNode('Verification questions — valuonguard@proton.me'));
    return block;
}

/**
 * @param {object} receipt - business_receipts row (+ receipt_items[])
 * @param {object} shop - shop_name/address/tax_id/country/currency/logo_path
 * @param {object} opts - { logoDataUrl, qrDataUrl }
 * @returns {HTMLElement} the card, already appended off-screen to <body>
 */
export function buildReceiptCard(receipt, shop, opts = {}) {
    const items = Array.isArray(receipt.receipt_items) && receipt.receipt_items.length > 0
        ? receipt.receipt_items
        : [{ item_name: shop.shop_name || 'Digital Receipt', qty: 1, unit_price: Number(receipt.gross_total) || 0, vat_rate: 0, net_total: Number(receipt.net_total) || 0, gross_total: Number(receipt.gross_total) || 0 }];

    const moneyFn = moneyFormatter(shop.currency);

    const card = el('div', {
        position: 'fixed', top: '0', left: '-10000px', width: `${CARD_WIDTH}px`, boxSizing: 'border-box',
        background: COLORS.cardBg, padding: '64px 68px 52px', overflow: 'hidden', color: COLORS.text,
        fontFamily: FONT_SANS, zIndex: '-1',
    }, { attrs: { id: 'valuon-receipt-card' } });

    card.appendChild(crosshair('top', 'left'));
    card.appendChild(crosshair('top', 'right'));
    card.appendChild(crosshair('bottom', 'left'));
    card.appendChild(crosshair('bottom', 'right'));

    const watermark = el('div', {
        position: 'absolute', inset: '0', zIndex: '0', display: 'flex', alignItems: 'center',
        justifyContent: 'center', pointerEvents: 'none', overflow: 'hidden',
    });
    watermark.appendChild(el('span', {
        fontFamily: FONT_MONO, fontSize: '13px', letterSpacing: '0.5em', color: COLORS.text, opacity: '0.025',
        whiteSpace: 'nowrap', transform: 'rotate(-32deg)',
    }, { text: 'VALUON · SIGNED & VERIFIED   VALUON · SIGNED & VERIFIED   VALUON · SIGNED & VERIFIED' }));
    card.appendChild(watermark);

    const content = el('div', { position: 'relative', zIndex: '1', display: 'flex', flexDirection: 'column' });
    content.appendChild(buildTopBlock(receipt, shop, opts));
    content.appendChild(buildItemsTable(items, moneyFn));
    content.appendChild(buildTotalsBlock(receipt, items, moneyFn));
    content.appendChild(buildVerifyBlock(receipt, opts.qrDataUrl));
    content.appendChild(buildFooter());
    card.appendChild(content);

    document.body.appendChild(card);
    return card;
}
