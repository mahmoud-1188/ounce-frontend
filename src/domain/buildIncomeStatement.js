import { fromHalalas, halalas } from "../core/money.js";

function buildIncomeStatement({ journal = [], accounts = [], from, to, openingStock = 0, closingStock = 0 }) {
  const bal = {};
  const t0 = from ? new Date(from).getTime() : -Infinity;
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;
  for (const e of journal) {
    const t = new Date(e.at || e.date).getTime();
    if (t < t0 || t > t1) continue;
    for (const l of e.lines || []) bal[l.account] = (bal[l.account] || 0) + halalas(l.debit) - halalas(l.credit);
  }
  const of = (code) => fromHalalas(bal[code] || 0);
  const byParent = (parent) => accounts.filter((a) => a.parent === parent && !a.group)
    .map((a) => ({ code: a.code, name: a.name, amount: fromHalalas(bal[a.code] || 0) }))
    .filter((x) => Math.abs(x.amount) > 0);

  // ⚠ الخصم يُستبعد من جمع الإيراد: هو ابنٌ لـ4100 وطبيعته مدينة، فجمعُه
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
  const cogs = fromHalalas(halalas(openStock) + halalas(purchases) - halalas(closeStock) - halalas(returns));
  const grossProfit = fromHalalas(halalas(netRevenue) - halalas(cogs));
  const opex = accounts.filter((a) => a.code.startsWith("6") && !a.group)
    .map((a) => ({ code: a.code, name: a.name, amount: fromHalalas(bal[a.code] || 0) }))
    .filter((x) => Math.abs(x.amount) > 0);
  const opexTotal = opex.reduce((a, x) => a + x.amount, 0);
  const netProfit = fromHalalas(halalas(grossProfit) - halalas(opexTotal));
  return {
    period: { from, to },
    revenue, discounts, netRevenue,
    openStock, purchases, closeStock, returns, cogs,
    grossProfit,
    grossMarginPct: netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : null,
    opex, opexTotal,
    netProfit,
    netMarginPct: netRevenue > 0 ? Math.round((netProfit / netRevenue) * 1000) / 10 : null,
  };
}

export { buildIncomeStatement };
