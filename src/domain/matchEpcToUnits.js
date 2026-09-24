import { codeToEpcHex, epcHexToCode, readPlateEpc } from "./helpers.js";
// ═══════════════════════════════════════════════════════════════════════
//  مطابقة بطاقات RFID المقروءة بوحدات الأصناف (item_units) الحقيقية.
//
//  ⚠ فرقٌ عن نسخة المرجع: هناك epc/code كانا حقلين محليين بلا مصدر
//  حقيقي. هنا كلاهما من normalizeItems (core/normalize.js) — epc من
//  عمود item_units.epc الحقيقي (migration 014)، وsold/issued من
//  الأعمدة الفعلية أيضًا. فالمطابقة هنا تعكس حالة المخزون الحقيقية في
//  قاعدة البيانات لا حالة محلية قد تكون قديمة.
// ═══════════════════════════════════════════════════════════════════════

function matchEpcToUnits(epcs, items, { suppliers = [], lots = [], storeId = 0 } = {}) {
  const byEpc = new Map();
  const byCode = new Map();
  for (const it of items) {
    for (const u of it.units || []) {
      if (u.epc) byEpc.set(String(u.epc).toUpperCase(), { item: it, unit: u });
      // بعض المحلات تطبع رمز الوحدة على البطاقة نفسها
      byEpc.set(String(u.code).toUpperCase(), { item: it, unit: u });
      // ⚠ والرمز كما كُتب في الرقاقة: `R7K2M9PQ` يُكتب
      // `52374B324D39505100000000` — والقارئ يُعيده هكذا. بلا هذا السطر
      // لا تُطابَق قطعةٌ واحدة، ويبدو الجرد كأن المخزون كلّه مفقود.
      if (u.code) {
        byEpc.set(codeToEpcHex(u.code).toUpperCase(), { item: it, unit: u });
        byCode.set(String(u.code).toUpperCase(), { item: it, unit: u });
      }
    }
  }
  const seen = new Set();
  const found = [];
  const unknown = [];
  const otherStore = [];
  for (const e of epcs) {
    const key = String(e).toUpperCase();
    // ⚠ الرقاقة لوحةُ تعريف: تحمل الرمز ورقم المحل وتاريخ الكتابة.
    // ورقاقةٌ لا تُطابق قطعةً عندنا تُعرف على الأقلّ **أهي من محلٍّ آخر
    // أم رمزٌ لنا لم يُزامَن** — والفرق بين الرسالتين هو الفرق بين
    // «هذه ليست لنا» و«ابحث عنها».
    const tag = readPlateEpc(key);
    // ⚠ نجرّب المطابقة المباشرة ثم الرمز من اللوحة ثم المفكوك: قارئٌ يُرجع
    // هكسًا، وآخر يُرجع نصًّا — والقطعة واحدة.
    const hit = byEpc.get(key) || (tag.ok ? byCode.get(tag.code) : null) || byEpc.get(epcHexToCode(key).toUpperCase());
    if (hit) {
      if (seen.has(hit.unit.code)) continue;
      seen.add(hit.unit.code);
      const lot = lots.find((l) => l.id === hit.item?.lotId);
      const sup = suppliers.find((x) => x.id === lot?.supplierId);
      found.push({ epc: key, ...hit, tag, supplierName: sup?.name || "—", lotRef: lot?.ref || "—" });
    } else if (tag.ok && tag.storeId && storeId && tag.storeId !== storeId) {
      otherStore.push({ epc: key, code: tag.code, storeId: tag.storeId });
    } else unknown.push(key);
  }
  const expected = items.flatMap((it) => (it.units || [])
    .filter((u) => !u.sold && !u.issued)
    .map((u) => ({ item: it, unit: u })));
  const missing = expected.filter((x) => !seen.has(x.unit.code));
  return { found, unknown: [...new Set(unknown)], otherStore, missing, scanned: seen.size };
}

export { matchEpcToUnits };
