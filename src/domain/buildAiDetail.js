import { fromHalalas, halalas, roundW } from "../core/money.js";

function buildAiDetail(ctx) {
  const { sales = [], customers = [], items = [], expenses = [], users = [] } = ctx || {};
  const now = new Date();
  const monthKey = (d) => String(d || "").slice(0, 7);
  const thisM = now.toISOString().slice(0, 7);
  const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
  const money = (h) => fromHalalas(Math.round(h));

  const bySeller = {};
  const byCustomer = {};
  const byItem = {};
  const byDay = {};
  for (const s of sales) {
    const m = monthKey(s.date);
    if (m !== thisM && m !== lastM) continue;
    const t = halalas(s.total);
    const seller = s.sellerName || s.createdBy || "—";
    bySeller[seller] ??= { [thisM]: 0, [lastM]: 0, count: 0 };
    bySeller[seller][m] += t;
    bySeller[seller].count += 1;
    if (s.customerName) {
      byCustomer[s.customerName] ??= { total: 0, count: 0 };
      byCustomer[s.customerName].total += t;
      byCustomer[s.customerName].count += 1;
    }
    for (const l of s.lines || []) {
      const k = l.description || l.category || l.itemRef || "—";
      byItem[k] ??= { count: 0, weight: 0 };
      byItem[k].count += Number(l.quantity) || 1;
      byItem[k].weight += Number(l.weight) || 0;
    }
    if (m === thisM) {
      const d = String(s.date).slice(0, 10);
      byDay[d] = (byDay[d] || 0) + t;
    }
  }

  const expByCat = {};
  for (const e of expenses) {
    if (monthKey(e.date) !== thisM) continue;
    expByCat[e.category || "misc"] = (expByCat[e.category || "misc"] || 0) + halalas(e.amount);
  }

  const top = (obj, key, n = 8) =>
    Object.entries(obj).sort((a, b) => b[1][key] - a[1][key]).slice(0, n);

  return {
    "البائعون": Object.entries(bySeller).map(([name, v]) => ({
      البائع: name, "هذا الشهر": money(v[thisM]), "الشهر الماضي": money(v[lastM]),
      فواتير: v.count,
    })),
    "أكثر العملاء شراءً (شهران)": top(byCustomer, "total").map(([name, v]) =>
      ({ العميل: name, المبلغ: money(v.total), فواتير: v.count })),
    "أكثر الأصناف مبيعًا (شهران)": top(byItem, "count").map(([k, v]) =>
      ({ الصنف: k, قطع: v.count, وزن: roundW(v.weight) })),
    "مبيعات الأيام — هذا الشهر": Object.entries(byDay).sort().map(([d, v]) =>
      ({ اليوم: d, المبلغ: money(v) })),
    "مصروفات الشهر بالتصنيف": Object.entries(expByCat).map(([c, v]) =>
      ({ التصنيف: c, المبلغ: money(v) })),
    "الأصناف الراكدة (بلا بيع 90 يومًا)": items
      .filter((it) => (it.units || []).some((u) => !u.sold))
      .filter((it) => {
        const last = sales.filter((s) => (s.lines || []).some((l) => l.itemId === it.id))
          .map((s) => Date.parse(s.date)).sort((a, b) => b - a)[0];
        const ninety = Date.now() - 90 * 864e5;
        return !last || last < ninety;
      })
      .slice(0, 10)
      .map((it) => ({ الصنف: it.description || it.ref, عيار: it.karat, وزن: it.weight })),
  };
}

export { buildAiDetail };
