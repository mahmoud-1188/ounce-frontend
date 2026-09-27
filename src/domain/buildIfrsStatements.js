import { CHART_OF_ACCOUNTS } from "../core/chart.js";
import { fromHalalas, halalas } from "../core/money.js";
import { buildIncomeStatement } from "./buildIncomeStatement.js";
import { accountRoot, balancesAt } from "./helpers.js";

/// تصنيف IAS 1 (المرجع 5.2.0): الأصول الثابتة ومخصّص نهاية الخدمة والقروض الطويلة غير متداولة
function isUnder(code, parent, accounts) {
  const find = (c) => accounts.find((x) => x.code === c);
  let a = find(code); const seen = new Set();
  while (a && a.parent && !seen.has(a.code)) { if (a.parent === parent) return true; seen.add(a.code); a = find(a.parent); }
  return false;
}
function ifrsCurrentOf(code, accounts = CHART_OF_ACCOUNTS) {
  const c = String(code);
  if (c === "1400" || isUnder(c, "1400", accounts)) return "nonCurrentAssets";
  const root = accountRoot(c, accounts);
  if (root === "1000") return "currentAssets";
  if (c === "2330" || c === "2510" || isUnder(c, "2500", accounts)) return "nonCurrentLiabilities";
  if (root === "2000") return "currentLiabilities";
  if (root === "3000") return "equity";
  return null;
}

/// القوائم وفق IAS 1: المركز المالي متداولًا وغير متداول، والدخل بالوظيفة (الإيراد · تكلفته · الأخرى · التشغيل · التمويل · الزكاة)
function buildIfrsStatements({ journal = [], accounts = CHART_OF_ACCOUNTS, from = null, to = null } = {}) {
  const inc = buildIncomeStatement({ journal, accounts, from, to });
  const b = balancesAt(journal, to);
  const t0 = from ? new Date(from).getTime() : -Infinity;
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;
  const mv = {};
  for (const e of journal || []) {
    const t = new Date(e.at || e.date).getTime();
    if (t < t0 || t > t1 || e.opType === "year_close") continue;
    for (const l of e.lines || []) mv[l.account] = (mv[l.account] || 0) + halalas(l.debit) - halalas(l.credit);
  }
  const of = (c) => fromHalalas(mv[c] || 0);
  const remeasure = -of("4240");
  const financeCosts = of("6560");
  const zakat = of("6550");
  const opexOnly = fromHalalas(halalas(inc.opexTotal) - halalas(financeCosts) - halalas(zakat));
  const otherIncome = fromHalalas(halalas(inc.otherIncome) - halalas(remeasure));
  const operatingProfit = fromHalalas(halalas(inc.grossProfit) + halalas(otherIncome) + halalas(remeasure) - halalas(opexOnly));
  const beforeZakat = fromHalalas(halalas(operatingProfit) - halalas(financeCosts));
  const netProfit = fromHalalas(halalas(beforeZakat) - halalas(zakat));

  // ربح الفترة غير المُقفل يُضاف لحقوق الملكية بما في الدفتر كلّه — الميزانية تراكمية
  const ledgerOpenPl = fromHalalas(-accounts.filter((a) => !a.group && a.statement === "income").reduce((a, x) => a + (b[x.code] || 0), 0));
  const groups = { currentAssets: [], nonCurrentAssets: [], currentLiabilities: [], nonCurrentLiabilities: [], equity: [] };
  for (const a of accounts) {
    if (a.group || a.statement !== "balance") continue;
    const h = b[a.code] || 0;
    if (!h) continue;
    const g = ifrsCurrentOf(a.code, accounts);
    if (!g) continue;
    const credit = g !== "currentAssets" && g !== "nonCurrentAssets";
    groups[g].push({ code: a.code, name: a.name, amount: fromHalalas(credit ? -h : h) });
  }
  const S = (arr) => fromHalalas(arr.reduce((a, x) => a + halalas(x.amount), 0));
  const totals = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, S(v)]));
  const assets = fromHalalas(halalas(totals.currentAssets) + halalas(totals.nonCurrentAssets));
  const liabilities = fromHalalas(halalas(totals.currentLiabilities) + halalas(totals.nonCurrentLiabilities));
  const equity = fromHalalas(halalas(totals.equity) + halalas(ledgerOpenPl));
  return {
    period: { from, to },
    pl: {
      revenue: inc.netRevenue, costOfSales: inc.cogs, grossProfit: inc.grossProfit,
      otherIncome, goldRemeasurement: remeasure, operatingExpenses: opexOnly,
      operatingProfit, financeCosts, profitBeforeZakat: beforeZakat, zakat, netProfit,
    },
    sofp: { ...groups, totals, assetsTotal: assets, liabilitiesTotal: liabilities, equityTotal: equity, unclosedProfit: ledgerOpenPl,
      balanced: Math.abs(halalas(assets) - halalas(liabilities) - halalas(equity)) < 100 },
  };
}

/// فحوص الامتثال المتاحة من الدفتر نفسه — كل بندٍ بحالته وسببه
function ifrsChecks({ journal = [], statements, fixedAssets = [], now = new Date() }) {
  const out = [];
  const trial = (journal || []).reduce((a, e) => a + (e.lines || []).reduce((x, l) => x + halalas(l.debit) - halalas(l.credit), 0), 0);
  out.push({ id: "tb", std: "IAS 1", label: "ميزان المراجعة متوازن", status: trial === 0 ? "ok" : "fail", why: trial === 0 ? "مجموع المدين = مجموع الدائن" : `فرق ${fromHalalas(trial)}` });
  out.push({ id: "sofp", std: "IAS 1", label: "المركز المالي: الأصول = الالتزامات + حقوق الملكية", status: statements.sofp.balanced ? "ok" : "fail",
    why: `${statements.sofp.assetsTotal} مقابل ${fromHalalas(halalas(statements.sofp.liabilitiesTotal) + halalas(statements.sofp.equityTotal))}` });
  out.push({ id: "class", std: "IAS 1.60", label: "تصنيف متداول وغير متداول", status: "ok", why: "الأصول الثابتة ونهاية الخدمة غير متداولة، والباقي متداول" });
  const assetsNoDep = (fixedAssets || []).filter((a) => !a.disposedAt && !(Number(a.accumulated || a.accumDepreciation) > 0));
  out.push({ id: "ias16", std: "IAS 16", label: "الأصول الثابتة تُهلَك", status: !fixedAssets.length ? "na" : assetsNoDep.length ? "todo" : "ok",
    why: !fixedAssets.length ? "لا أصول ثابتة" : assetsNoDep.length ? `${assetsNoDep.length} أصلٌ بلا إهلاكٍ مسجّل — شغّل إهلاك الشهر` : "كل الأصول لها إهلاك" });
  const hasEos = (journal || []).some((e) => (e.lines || []).some((l) => l.account === "2330"));
  out.push({ id: "ias19", std: "IAS 19", label: "مخصّص نهاية الخدمة", status: hasEos ? "ok" : "todo", why: hasEos ? "يُكوَّن مع الرواتب (2330)" : "لم يُكوَّن بعد — يُحتسب مع مسيّر الرواتب" });
  const hasVat = (journal || []).some((e) => (e.lines || []).some((l) => l.account === "2220"));
  out.push({ id: "ifrs15", std: "IFRS 15", label: "الإيراد صافٍ من الضريبة، والعربون التزامٌ حتى التسليم", status: "ok", why: `${hasVat ? "ضريبة المخرجات على 2220، و" : ""}العرابين على 2210 حتى البيع` });
  const lastMeasure = (journal || []).filter((e) => e.opType === "ifrs_measure").map((e) => e.date || e.at).sort().pop();
  out.push({ id: "ias2", std: "IAS 2", label: "قياس المخزون بالأقل من التكلفة وصافي القيمة القابلة للتحقق", status: "todo",
    why: lastMeasure ? `آخر قياس ${String(lastMeasure).slice(0, 10)}` : "قياس نهاية الفترة لا يُرحَّل آليًّا بعد — يُراجَع مع المحاسب" });
  return out;
}

export { buildIfrsStatements, ifrsCurrentOf, ifrsChecks };
