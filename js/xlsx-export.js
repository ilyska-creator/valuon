/**
 * Minimal, dependency-free OOXML (.xlsx) workbook generator.
 * Produces valid ECMA-376 SpreadsheetML archives (ZIP Store + CRC32) with:
 *  - multiple worksheets
 *  - bold styled header row with soft tint fill & bottom border
 *  - frozen top header row
 *  - auto-fitted column widths
 *  - native numeric cells (0.00 currency / integer) so Excel SUM() works out of the box
 *  - CSV/Excel formula-injection protection for text cells
 */

const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        // Strip control chars illegal in XML 1.0
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
}

function sanitizeTextCell(value) {
    let str = value == null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(str) && !/^-\d+(\.\d+)?$/.test(str)) {
        str = `'${str}`;
    }
    return str;
}

function colIndexToLetter(index) {
    let n = index + 1;
    let out = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        out = String.fromCharCode(65 + rem) + out;
        n = Math.floor((n - 1) / 26);
    }
    return out;
}

function sanitizeSheetName(name, fallback) {
    const cleaned = String(name || fallback || 'Sheet')
        .replace(/[\\/*?:[\]]/g, ' ')
        .trim()
        .slice(0, 31);
    return cleaned || fallback || 'Sheet';
}

function buildWorksheetXml(sheet) {
    const columns = Array.isArray(sheet.columns) ? sheet.columns : [];
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];

    // Compute auto widths from headers + data
    const widths = columns.map((col, idx) => {
        const headerLen = String(col.header || '').length;
        let maxLen = Math.max(headerLen + 3, col.minWidth || 10);
        for (let r = 0; r < rows.length; r++) {
            const raw = rows[r]?.[idx];
            const valLen = raw == null ? 0 : String(raw).length;
            if (valLen + 3 > maxLen) maxLen = valLen + 3;
        }
        return Math.min(col.maxWidth || 44, maxLen);
    });

    const colsXml = widths.length
        ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w.toFixed(1)}" customWidth="1"/>`).join('')}</cols>`
        : '';

    const rowXmlParts = [];

    // Header row (style s="1": bold + subtle blue-slate fill + bottom border)
    const headerCells = columns.map((col, cIdx) => {
        const ref = `${colIndexToLetter(cIdx)}1`;
        const text = escapeXml(sanitizeTextCell(col.header || ''));
        return `<c r="${ref}" t="inlineStr" s="1"><is><t>${text}</t></is></c>`;
    }).join('');
    rowXmlParts.push(`<row r="1" ht="24" customHeight="1">${headerCells}</row>`);

    // Data rows
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const excelRow = rIdx + 2;
        const row = rows[rIdx] || [];
        const cells = columns.map((col, cIdx) => {
            const ref = `${colIndexToLetter(cIdx)}${excelRow}`;
            const raw = row[cIdx];
            if (raw === null || raw === undefined || raw === '') {
                return `<c r="${ref}" s="0"/>`;
            }
            if (col.type === 'money' || col.type === 'number' || col.type === 'int') {
                const num = typeof raw === 'number' ? raw : parseFloat(raw);
                if (Number.isFinite(num)) {
                    const styleIdx = col.type === 'money' ? 2 : col.type === 'int' ? 3 : 0;
                    return `<c r="${ref}" s="${styleIdx}"><v>${num}</v></c>`;
                }
            }
            const text = escapeXml(sanitizeTextCell(raw));
            return `<c r="${ref}" t="inlineStr" s="0"><is><t xml:space="preserve">${text}</t></is></c>`;
        }).join('');
        rowXmlParts.push(`<row r="${excelRow}">${cells}</row>`);
    }

    const lastCol = colIndexToLetter(Math.max(0, columns.length - 1));
    const lastRow = Math.max(1, rows.length + 1);

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCol}${lastRow}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="19"/>
  ${colsXml}
  <sheetData>${rowXmlParts.join('')}</sheetData>
  <autoFilter ref="A1:${lastCol}${lastRow}"/>
</worksheet>`;
}

function buildStylesXml() {
    // Style indices:
    // 0: default text (vertical center)
    // 1: header (bold, subtle slate-blue fill, bottom border)
    // 2: money (0.00)
    // 3: integer (0)
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
    <numFmt numFmtId="165" formatCode="0"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

function buildZipStore(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    const now = new Date();
    const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((now.getSeconds() >> 1) & 0x1f);
    const dosDate = (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);

    for (const file of files) {
        const nameBytes = encoder.encode(file.name);
        const dataBytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
        const crc = crc32(dataBytes);
        const size = dataBytes.length;

        // Local file header (30 bytes + filename)
        const localHeader = new Uint8Array(30 + nameBytes.length);
        const lv = new DataView(localHeader.buffer);
        lv.setUint32(0, 0x04034b50, true); // signature
        lv.setUint16(4, 20, true);         // version needed (2.0)
        lv.setUint16(6, 0x0800, true);     // UTF-8 filename flag
        lv.setUint16(8, 0, true);          // compression method: store
        lv.setUint16(10, dosTime, true);
        lv.setUint16(12, dosDate, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, size, true);
        lv.setUint32(22, size, true);
        lv.setUint16(26, nameBytes.length, true);
        lv.setUint16(28, 0, true);
        localHeader.set(nameBytes, 30);

        localParts.push(localHeader, dataBytes);

        // Central directory header (46 bytes + filename)
        const centralHeader = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(centralHeader.buffer);
        cv.setUint32(0, 0x02014b50, true); // signature
        cv.setUint16(4, 20, true);         // version made by
        cv.setUint16(6, 20, true);         // version needed
        cv.setUint16(8, 0x0800, true);     // UTF-8 flag
        cv.setUint16(10, 0, true);         // compression: store
        cv.setUint16(12, dosTime, true);
        cv.setUint16(14, dosDate, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, size, true);
        cv.setUint32(24, size, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0, true);
        cv.setUint32(42, offset, true);    // relative offset of local header
        centralHeader.set(nameBytes, 46);

        centralParts.push(centralHeader);
        offset += localHeader.length + dataBytes.length;
    }

    let centralSize = 0;
    for (const part of centralParts) centralSize += part.length;

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, eocd], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
}

/**
 * Build a multi-sheet .xlsx Blob from an array of sheet definitions:
 * [{ name: 'Receipts', columns: [{ header, type?, minWidth?, maxWidth? }], rows: [[...], ...] }]
 */
export function buildXlsxBlob(sheets) {
    const safeSheets = (sheets || []).map((s, idx) => ({
        ...s,
        safeName: sanitizeSheetName(s.name, `Sheet${idx + 1}`),
    }));

    const contentTypesOverrides = safeSheets
        .map((_, idx) => `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('');

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${contentTypesOverrides}
</Types>`;

    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const workbookSheetsXml = safeSheets
        .map((s, idx) => `<sheet name="${escapeXml(s.safeName)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`)
        .join('');

    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheetsXml}</sheets>
</workbook>`;

    const workbookRelsEntries = safeSheets
        .map((_, idx) => `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`)
        .join('');

    const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRelsEntries}
  <Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const files = [
        { name: '[Content_Types].xml', content: contentTypesXml },
        { name: '_rels/.rels', content: rootRelsXml },
        { name: 'xl/workbook.xml', content: workbookXml },
        { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
        { name: 'xl/styles.xml', content: buildStylesXml() },
    ];

    safeSheets.forEach((sheet, idx) => {
        files.push({
            name: `xl/worksheets/sheet${idx + 1}.xml`,
            content: buildWorksheetXml(sheet),
        });
    });

    return buildZipStore(files);
}
