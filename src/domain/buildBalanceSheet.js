import { fromHalalas, halalas } from "../core/money.js";
import { balancesAt } from "./helpers.js";

function buildBalanceSheet({ journal = [], accounts = [], to, netProfit = 0 }) {
  const b = balancesAt(journal, to);
  const pick = (pred) => accounts.filter((a) => !a.group && pred(a) && Math.abs(b[a.code] || 0) > 0)
    .map((a) => ({ code: a.code, name: a.name, amount: fromHalalas((b[a.code] || 0) * (a.nature === "credit" ? -1 : 1)) }));
  const assets = pick((a) => a.code.startsWith("1") && a.statement === "balance");
  const liabilities = pick((a) => a.code.startsWith("2") && a.statement === "balance");
  const equity = pick((a) => a.code.startsWith("3") && a.statement === "balance");
  const S = (arr) => fromHalalas(arr.reduce((a, x) => a + halalas(x.amount), 0));
  const assetsT = S(assets), liabT = S(liabilities), eqT = S(equity);
  // ⚠ ربح الفترة يُضاف لحقوق الملكية ولم يُقفل بعد: بلاه لا تتوازن القائمة
  // أبدًا قبل الإقفال السنوي، ويظنّ القارئ الدفتر مكسورًا.
  const eqWithProfit = fromHalalas(halalas(eqT) + halalas(netProfit));
  const diff = fromHalalas(halalas(assetsT) - halalas(liabT) - halalas(eqWithProfit));
  return {
    assets, liabilities, equity,
    netProfit,
    assetsTotal: assetsT, liabilitiesTotal: liabT, equityTotal: eqWithProfit,
    balanced: Math.abs(halalas(diff)) < 100,
    difference: diff,
  };
}

/// قائمة التغيّر في حقوق الملكية.

export { buildBalanceSheet };
