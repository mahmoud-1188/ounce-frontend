function findSoldUnit(query, { sales = [], items = [] }) {
  const q = String(query || "").trim();
  if (!q) return { found: false, why: "أدخل رمز القطعة أو رقم الفاتورة" };
  const norm = (x) => String(x || "").trim().toUpperCase();

  // ① بالرمز داخل الفواتير
  for (const sale of sales) {
    const lines = sale.lines || [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const codes = [l.unitCode, l.code, l.barcode, l.sku, l.tagId].filter(Boolean);
      if (codes.some((c) => norm(c) === norm(q))) {
        return { found: true, sale, lineIndex: i, line: l, by: "code" };
      }
    }
  }
  // ② برقم الفاتورة
  const byRef = sales.find((s) => norm(s.ref) === norm(q) || norm(s.id) === norm(q));
  if (byRef) return { found: true, sale: byRef, lineIndex: null, by: "invoice" };

  return { found: false, why: `لا توجد قطعة مباعة بالرمز ${q}` };
}

/// ── ③ التحقق من الشروط ──
///
/// يُعيد `{ ok, errors[] }`. الأخطاء بالعربية جاهزةً للعرض.

export { findSoldUnit };
