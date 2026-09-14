// ═══════════════════════════════════════════════════════════════════════
//  مطابقة بطاقات RFID المقروءة بوحدات الأصناف (item_units) الحقيقية.
//
//  ⚠ فرقٌ عن نسخة المرجع: هناك epc/code كانا حقلين محليين بلا مصدر
//  حقيقي. هنا كلاهما من normalizeItems (core/normalize.js) — epc من
//  عمود item_units.epc الحقيقي (migration 014)، وsold/issued من
//  الأعمدة الفعلية أيضًا. فالمطابقة هنا تعكس حالة المخزون الحقيقية في
//  قاعدة البيانات لا حالة محلية قد تكون قديمة.
// ═══════════════════════════════════════════════════════════════════════

function matchEpcToUnits(epcs, items) {
  const byEpc = new Map();
  for (const it of items) {
    for (const u of it.units || []) {
      if (u.epc) byEpc.set(String(u.epc).toUpperCase(), { item: it, unit: u });
      // بعض المحلات تطبع رمز الوحدة على البطاقة نفسها
      byEpc.set(String(u.code).toUpperCase(), { item: it, unit: u });
    }
  }
  const seen = new Set();
  const found = [];
  const unknown = [];
  for (const e of epcs) {
    const key = String(e).toUpperCase();
    const hit = byEpc.get(key);
    if (hit) {
      if (seen.has(hit.unit.code)) continue;
      seen.add(hit.unit.code);
      found.push({ epc: key, ...hit });
    } else unknown.push(key);
  }
  const expected = items.flatMap((it) => (it.units || [])
    .filter((u) => !u.sold && !u.issued)
    .map((u) => ({ item: it, unit: u })));
  const missing = expected.filter((x) => !seen.has(x.unit.code));
  return { found, unknown: [...new Set(unknown)], missing, scanned: seen.size };
}

export { matchEpcToUnits };
