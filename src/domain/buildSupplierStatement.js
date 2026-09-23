import { fine24, roundW, sumMoney } from "../core/money.js";

/// كشف المورد برصيدٍ جارٍ ببُعدين: ذهبٌ بعيار 24 (2110) وأجورٌ بالعملة (2120).
///
/// المصادر (بأسمائها في الخادم):
///   • الدفعات (lots) من مشترياته — الآجل يرفع الذهب والأجور، والمسدَّد نقدٌ فقط.
///   • التسكيرات (taskir_entries) — سداد ذهب من الكسر أو عبر مكتب.
///   • حركات ذهب الخزنة المسلَّمة له (safe_gold_tx · destination = supplier).
///   • دفع الأجور نقدًا (cash_tx · category = gold_workmanship) المرتبط
///     بمشترياته أو بتسكيراته.
///
/// taskirFeesSettled: {taskirId: مبلغ} من الخادم — الجزء من أجور التسكير
/// الذي سدّد التزام الأجور فعلًا (الباقي أجورٌ جديدة لا تُنقص الرصيد).
function buildSupplierStatement(sup, { lots = [], taskirEntries = [], cashTx = [], safeTx = [], safeGoldTx = [], taskirFeesSettled = null, from = "", to = "" } = {}) {
  const wm = (l) => Number(l.workmanshipTotal ?? l.workmanship) || 0;
  const day = (d) => String(d || "").slice(0, 10);
  const mine = lots.filter((l) => l.supplierId === sup.id && l.source !== "opening");
  const purchaseIds = new Set(mine.map((l) => l.purchaseId).filter(Boolean));
  const settles = taskirEntries.filter((t) => t.supplierId === sup.id);
  const taskirIds = new Set(settles.map((t) => t.id));
  const safeSettles = safeGoldTx.filter((g) => g.type === "out" && g.destination === "supplier" && g.supplierId === sup.id);
  const seen = new Set();
  const feePays = [...cashTx, ...safeTx].filter((t) => {
    if (seen.has(t.id)) return false;
    const ok = t.type === "out" && /workmanship|supplier_fee/.test(t.category || "") &&
      ((t.source === "purchases" && purchaseIds.has(t.refId)) || (t.source === "taskir_entries" && taskirIds.has(t.refId)));
    if (ok) seen.add(t.id);
    return ok;
  });
  const paidLabel = { safe_cash: "شراء مسدَّد نقدًا", safe_network: "شراء مسدَّد شبكة", scrap: "شراء مسدَّد بالكسر", office: "شراء عبر مكتب تسكير" };

  const rows = [
    ...mine.map((l) => {
      const def = l.paymentMethod === "deferred";
      const cashPaid = l.paymentMethod === "safe_cash" || l.paymentMethod === "safe_network";
      return {
        id: l.id, ref: l.ref, date: l.date,
        kind: def ? "شراء آجل" : (paidLabel[l.paymentMethod] || "شراء مسدَّد"),
        karat: l.karat, weight: Number(l.weight) || 0,
        gold: def ? fine24(l.weight, l.karat) : 0,
        fees: def ? wm(l) : 0,
        cash: cashPaid ? sumMoney([Number(l.goldCost) || 0, wm(l)]) : 0,
        note: def ? (l.feesPaidNow ? "الذهب آجل — الأجور دُفعت" : "الذهب والأجور آجل") : "لا التزام",
      };
    }),
    ...settles.map((t) => ({
      id: t.id, ref: t.ref, date: t.date,
      kind: `سداد ذهب — ${t.goldSource === "scrap" ? "كسر" : "مكتب"}`,
      karat: t.karat, weight: Number(t.weight) || 0,
      gold: -fine24(t.weight, t.karat), fees: 0, cash: 0, note: t.notes || "",
    })),
    ...safeSettles.map((g) => ({
      id: g.id, ref: String(g.id).slice(0, 8), date: g.date, kind: "سداد ذهب — خزنة",
      karat: g.karat, weight: Number(g.weight) || 0,
      gold: -fine24(g.weight, g.karat), fees: 0, cash: 0, note: g.note || "",
    })),
    ...feePays.map((t) => {
      const amt = Number(t.amount) || 0;
      const settled = t.source === "taskir_entries" && taskirFeesSettled
        ? Math.min(amt, Number(taskirFeesSettled[t.refId]) || 0) : amt;
      return {
        id: t.id, ref: String(t.id).slice(0, 8), date: t.date, kind: "دفع أجور", karat: null, weight: 0,
        gold: 0, fees: -settled, cash: amt,
        note: [t.note || "", settled < amt ? `منها ${Math.round((amt - settled) * 100) / 100} أجورٌ جديدة` : ""].filter(Boolean).join(" — "),
      };
    }),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // الرصيد السابق: كل ما قبل المدى؛ ثم الحركة داخله برصيدٍ جارٍ
  const opening = { gold: 0, fees: 0 };
  const period = [];
  rows.forEach((r) => {
    const d = day(r.date);
    if (from && d < from) { opening.gold += r.gold; opening.fees += r.fees; return; }
    if (to && d > to) return;
    period.push(r);
  });
  let gold = opening.gold;
  let fees = opening.fees;
  const lines = period.map((r) => {
    gold = roundW(gold + r.gold); fees = sumMoney([fees, r.fees]);
    return { ...r, goldBal: gold, feesBal: fees };
  });
  const move = {
    goldUp: roundW(period.filter((r) => r.gold > 0).reduce((a, r) => a + r.gold, 0)),
    goldDown: roundW(-period.filter((r) => r.gold < 0).reduce((a, r) => a + r.gold, 0)),
    feesUp: sumMoney(period.filter((r) => r.fees > 0).map((r) => r.fees)),
    feesDown: sumMoney(period.filter((r) => r.fees < 0).map((r) => -r.fees)),
    cashPaid: sumMoney(period.map((r) => r.cash)),
    lots: period.filter((r) => r.kind.startsWith("شراء")).length,
    fineIn: roundW(period.filter((r) => r.kind.startsWith("شراء")).reduce((a, r) => a + fine24(r.weight, r.karat), 0)),
  };
  const byKarat = {};
  period.filter((r) => r.kind.startsWith("شراء")).forEach((r) => {
    const k = Number(r.karat) || 21;
    byKarat[k] = byKarat[k] || { karat: k, weight: 0, fine: 0, lots: 0, deferred: 0 };
    byKarat[k].weight += r.weight; byKarat[k].fine += fine24(r.weight, r.karat); byKarat[k].lots += 1;
    if (r.kind === "شراء آجل") byKarat[k].deferred += fine24(r.weight, r.karat);
  });
  return {
    sup,
    past: { gold: roundW(opening.gold), fees: sumMoney([opening.fees]) },
    move,
    now: { gold: roundW(gold), fees: sumMoney([fees]) },
    karats: Object.values(byKarat).sort((a, b) => b.karat - a.karat),
    lines,
  };
}

export { buildSupplierStatement };
