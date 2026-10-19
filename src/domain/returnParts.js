/// المرتجع قطعةً قطعة: ما أُرجع من كل سطر بالعدد والرموز، وما بقي منه.
/// المرتجع المحفوظ يحمل lines بترتيب lineIndexes — كلٌّ بعدده المرتجع ورموز قطعه (unit_codes).

const up = (c) => String(c || "").trim().toUpperCase();
const qtyOf = (l) => Math.max(1, Math.round(Number(l?.quantity) || 1));

// الكمّية المرتجعة سلفًا من السطر i — السجلّ القديم بلا عددٍ محفوظ ردّ السطر كلّه
function lineReturnedQty(returns, sale, i) {
  const full = qtyOf((sale?.lines || [])[i]);
  let n = 0;
  for (const r of returns || []) {
    if (!r || r.voided || r.saleId !== sale?.id) continue;
    (r.lineIndexes || []).forEach((x, k) => {
      if (x !== i) return;
      const saved = (r.lines || [])[k];
      n += saved && saved.quantity != null ? qtyOf(saved) : full;
    });
  }
  return n;
}

// ما بقي من السطر قابلًا للإرجاع (قطعًا)
function lineReturnLeft(sale, returns, i) {
  const l = (sale?.lines || [])[i];
  if (!l) return 0;
  return Math.max(0, qtyOf(l) - lineReturnedQty(returns, sale, i));
}

// رموز السطر المرتجعة سلفًا
function lineReturnedCodes(returns, sale, i) {
  const out = new Set();
  for (const r of returns || []) {
    if (!r || r.voided || r.saleId !== sale?.id) continue;
    (r.lineIndexes || []).forEach((x, k) => {
      if (x !== i) return;
      for (const c of (r.lines || [])[k]?.unit_codes || []) out.add(up(c));
    });
  }
  return out;
}

// رموز قطع السطر التي ما زالت عند العميل
function lineCodesLeft(sale, returns, i) {
  const l = (sale?.lines || [])[i];
  const gone = lineReturnedCodes(returns, sale, i);
  return (l?.unitCodes || []).filter((c) => !gone.has(up(c)));
}

// جزءٌ لقطعةٍ واحدة من سطرٍ فيه أكثر من قطعة (بمسح رمزها)؛ سطر القطعة الواحدة بلا جزء
function piecePartOf(sale, returns, i, code = null) {
  const l = (sale?.lines || [])[i];
  if (!l || qtyOf(l) <= 1) return {};
  const left = lineCodesLeft(sale, returns, i);
  const want = code ? left.find((c) => up(c) === up(code)) : null;
  return { [i]: { qty: 1, unitCodes: want ? [want] : left.slice(0, 1) } };
}

// الأسطر كما تُرجع: الجزء بعدده، وإلا ما بقي من السطر — لحساب المبلغ على الشاشة كما يحسبه الخادم
function returnLinesOf(sale, returns, lineIndexes, lineParts = {}) {
  return (lineIndexes || []).map((i) => {
    const l = (sale?.lines || [])[i];
    if (!l) return null;
    const part = lineParts[i];
    const q = part ? Math.max(1, Number(part.qty) || 1) : lineReturnLeft(sale, returns, i);
    return q === qtyOf(l) ? l : { ...l, quantity: q };
  }).filter(Boolean);
}

export { lineCodesLeft, lineReturnLeft, lineReturnedCodes, lineReturnedQty, piecePartOf, returnLinesOf };
