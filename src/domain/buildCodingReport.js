import { PURITY, roundW } from "../core/money.js";

/**
 * تقرير التكويد — نظير buildCodingReport.js في المرجع بالمعنى لا
 * بالتنفيذ الحرفي: المرجع يقرأ it.category/it.codedAt/it.codedBy/
 * it.voided (أسماء حقول محلية قديمة لا وجود لها في منتجنا)، وهذا يقرأ
 * أشكال الباك إند الحقيقية القادمة من normalizeItems/normalizeLots في
 * core/normalize.js:
 *   • categoryId لا category (تُحلّ لاسم عبر categories المُمرَّرة).
 *   • dateAdded لا codedAt — لا فرق بين "أُضيف" و"كُوِّد" في نموذجنا؛
 *     كل صنفٍ يُنشأ عبر AddGoodsPage.jsx (التكويد) في نفس اللحظة.
 *   • createdBy معرّف مستخدم (uuid) لا اسمًا جاهزًا — يُحلّ عبر users.
 *   • lot.workmanshipTotal/lot.workmanshipAllocated حقيقيان الآن
 *     (migration 028_lot_item_coding.sql) — لا حاجة لإعادة حساب التكلفة
 *     من workmanshipPerUnit مفترض؛ it.workmanship المخزَّن هو الإجمالي
 *     الصحيح فعليًا لكل وحدة (يدوي + نصيب من أجرة الدفعة) كما كتبه
 *     items.routes.js وقت الإدراج.
 *   • لا it.voided في منتجنا (لا مفهوم حذف منطقي لصنف) — items تُحذف
 *     فعليًا (delete) لا تُعلَّم، فكل صنفٍ في القائمة الممرَّرة حيٌّ فعلًا.
 *
 * التجميع بالمعادل الخالص (عيار 24) لا بعدد القطع — نفس فلسفة المرجع:
 * مئة خاتمٍ خفيف غير مئة سوارٍ ثقيل، والوزن الخالص هو المقياس الحقيقي.
 */
function buildCodingReport({ items = [], lots = [], categories = [], suppliers = [], users = [], from, to, groupBy = "day" }) {
  const t0 = from ? new Date(from).getTime() : -Infinity;
  const t1 = to ? new Date(`${String(to).slice(0, 10)}T23:59:59.999`).getTime() : Infinity;
  const lotOf = (id) => lots.find((l) => l.id === id) || null;
  const categoryLabelOf = (id) => categories.find((c) => c.id === id)?.label || "غير مصنَّف";
  const supplierNameOf = (id) => suppliers.find((s) => s.id === id)?.name || "—";
  const userNameOf = (id) => users.find((u) => u.id === id)?.name || "—";

  const rows = [];
  for (const it of items) {
    const when = it.dateAdded;
    const t = new Date(when).getTime();
    if (!(t >= t0 && t <= t1)) continue;
    const units = (it.units || []).length || 1;
    const w = (Number(it.weight) || 0) * units;
    const karat = Number(it.karat) || 21;
    const lot = lotOf(it.lotId);
    rows.push({
      id: it.id,
      ref: it.ref,
      at: when,
      day: String(when).slice(0, 10),
      by: userNameOf(it.createdBy),
      byId: it.createdBy || null,
      supplierId: lot?.supplierId || null,
      supplier: lot ? supplierNameOf(lot.supplierId) : "—",
      lotRef: lot?.ref || "—",
      categoryId: it.categoryId,
      category: categoryLabelOf(it.categoryId),
      karat,
      pieces: units,
      weight: roundW(w),
      fine: roundW(w * (PURITY[karat] || karat / 24)),
      // ⚠ it.workmanship مُخزَّن كإجمالي لكل وحدة فعلًا (راجع items.routes.js:
      // totalWorkmanship = workmanshipPerUnit اليدوي + نصيب أجرة الدفعة) —
      // ضربه بعدد الوحدات هنا هو التكلفة الإجمالية للصنف كله، لا لكل قطعة.
      cost: (Number(it.costPerGram) || 0) * w + (Number(it.workmanship) || 0) * units,
      printed: (it.units || []).filter((u) => u.printed).length,
    });
  }

  const keyOf = (r) => (groupBy === "employee" ? r.by
    : groupBy === "supplier" ? r.supplier
    : groupBy === "lot" ? r.lotRef
    : groupBy === "karat" ? `عيار ${r.karat}`
    : groupBy === "category" ? r.category
    : r.day);

  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    const g = map.get(k) || { key: k, pieces: 0, weight: 0, fine: 0, cost: 0, printed: 0, rows: [] };
    g.pieces += r.pieces;
    g.weight += r.weight;
    g.fine += r.fine;
    g.cost += r.cost;
    g.printed += r.printed;
    g.rows.push(r);
    map.set(k, g);
  }
  const groups = [...map.values()]
    .map((g) => ({ ...g, weight: roundW(g.weight), fine: roundW(g.fine), unprinted: g.pieces - g.printed }))
    .sort((a, b) => (groupBy === "day" ? String(b.key).localeCompare(a.key) : b.fine - a.fine));

  const totals = {
    pieces: rows.reduce((a, r) => a + r.pieces, 0),
    weight: roundW(rows.reduce((a, r) => a + r.weight, 0)),
    fine: roundW(rows.reduce((a, r) => a + r.fine, 0)),
    cost: rows.reduce((a, r) => a + r.cost, 0),
    printed: rows.reduce((a, r) => a + r.printed, 0),
  };
  totals.unprinted = totals.pieces - totals.printed;

  return { rows, groups, totals, groupBy, count: rows.length };
}

export { buildCodingReport };
