
import { fromHalalas, halalas } from "../core/money.js";

function buildIncomeStatement({ journal = [], accounts = [], from, to, openingStock = 0, closingStock = 0 }) {
  const bal = {};
  const t0 = from ? new Date(from).getTime() : -Infinity;
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;
  for (const e of journal) {
    const t = new Date(e.at || e.date).getTime();
    // تنبيه: قيد إقفال السنة يصفّر الدخل إلى 3300 — ليس دخلًا ولا مصروفًا. كان يقع على أوّل لحظةٍ من السنة الجديدة
    //   (تاريخه = بداية الفترة التالية) فتُظهر قائمتها إيراد السنة الماضية سالبًا.
    if (t < t0 || t > t1 || e.opType === "year_close") continue;
    for (const l of e.lines || []) bal[l.account] = (bal[l.account] || 0) + halalas(l.debit) - halalas(l.credit);
  }
  const of = (code) => fromHalalas(bal[code] || 0);
  const byParent = (parent) => accounts.filter((a) => a.parent === parent && !a.group)
    .map((a) => ({ code: a.code, name: a.name, amount: fromHalalas(bal[a.code] || 0) }))
    .filter((x) => Math.abs(x.amount) > 0);

  // تنبيه: الخصم يُستبعد من جمع الإيراد: هو ابنٌ لـ4100 وطبيعته مدينة، فجمعُه
  // مع الإيراد يطرحه مرةً، ثم طرحُه صراحةً يطرحه ثانيةً — والنتيجة إيرادٌ
  // أقلّ من الحقيقة بقيمة الخصم كاملةً.
  const discounts = of("4155");
  const revenue = -byParent("4100").filter((x) => x.code !== "4155")
    .reduce((a, x) => a + x.amount, 0);
  const netRevenue = fromHalalas(halalas(revenue) - halalas(discounts));
  const purchases = byParent("5100")
    .filter((x) => !["5150", "5160", "5175", "5185"].includes(x.code))
    .reduce((a, x) => a + x.amount, 0);
  const openStock = openingStock || of("5150");
  const closeStock = closingStock || -of("5160");
  const returns = -of("5175") - of("5185");
  // تنبيه: بقية تكلفة المبيعات (5200 المصنعية والعمولة · 5300 الفاقد والعجز) والإيرادات الأخرى (4200 · 4300)
  //   كانت خارج القائمة: صافيها لا يساوي صافي الدفتر، والفرق يُنسب خطأً لـ«قيد جرد ناقص».
  //   IAS 1: كل بندِ دخلٍ ومصروفٍ في الفترة يدخل الربح أو الخسارة.
  const parentOf = new Map(accounts.map((a) => [a.code, a.parent]));
  const under = (code, root) => { const seen = new Set(); for (let p = parentOf.get(code); p && !seen.has(p); p = parentOf.get(p)) { if (p === root) return true; seen.add(p); } return false; };
  const leavesUnder = (root) => accounts.filter((a) => !a.group && a.statement === "income" && under(a.code, root));
  const otherCostRows = [...leavesUnder("5200"), ...leavesUnder("5300")]
    .map((a) => ({ code: a.code, name: a.name, amount: fromHalalas(bal[a.code] || 0) }))
    .filter((x) => Math.abs(x.amount) > 0);
  const otherCost = fromHalalas(otherCostRows.reduce((a, x) => a + halalas(x.amount), 0));
  const cogs = fromHalalas(halalas(openStock) + halalas(purchases) - halalas(closeStock) - halalas(returns) + halalas(otherCost));
  const grossProfit = fromHalalas(halalas(netRevenue) - halalas(cogs));
  const otherIncomeRows = [...leavesUnder("4200"), ...leavesUnder("4300")]
    .map((a) => ({ code: a.code, name: a.name, amount: fromHalalas(-(bal[a.code] || 0)) }))
    .filter((x) => Math.abs(x.amount) > 0);
  const otherIncome = fromHalalas(otherIncomeRows.reduce((a, x) => a + halalas(x.amount), 0));
  const opex = accounts.filter((a) => a.code.startsWith("6") && !a.group)
    .map((a) => ({ code: a.code, name: a.name, amount: fromHalalas(bal[a.code] || 0) }))
    .filter((x) => Math.abs(x.amount) > 0);
  const opexTotal = opex.reduce((a, x) => a + x.amount, 0);
  const netProfit = fromHalalas(halalas(grossProfit) + halalas(otherIncome) - halalas(opexTotal));
  return {
    period: { from, to },
    revenue, discounts, netRevenue,
    openStock, purchases, closeStock, returns, otherCost, otherCostRows, cogs,
    grossProfit, otherIncome, otherIncomeRows,
    grossMarginPct: netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : null,
    opex, opexTotal,
    netProfit,
    netMarginPct: netRevenue > 0 ? Math.round((netProfit / netRevenue) * 1000) / 10 : null,
  };
}

export { buildIncomeStatement };
