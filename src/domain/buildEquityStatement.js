import { fromHalalas, halalas } from "../core/money.js";
import { balancesAt } from "./helpers.js";

function buildEquityStatement({ journal = [], accounts = [], from, to, netProfit = 0 }) {
  const open = balancesAt(journal, from ? new Date(new Date(from).getTime() - 1).toISOString() : null);
  const t0 = from ? new Date(from).getTime() : -Infinity;
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;
  const eqCodes = accounts.filter((a) => !a.group && a.code.startsWith("3")).map((a) => a.code);
  const rows = eqCodes.map((code) => {
    const a = accounts.find((x) => x.code === code);
    let add = 0, less = 0;
    for (const e of journal) {
      const t = new Date(e.at || e.date).getTime();
      if (t < t0 || t > t1) continue;
      for (const l of e.lines || []) {
        if (l.account !== code) continue;
        add += halalas(l.credit); less += halalas(l.debit);
      }
    }
    const o = -(open[code] || 0);
    return {
      code, name: a?.name || code,
      opening: fromHalalas(o),
      additions: fromHalalas(add),
      deductions: fromHalalas(less),
      closing: fromHalalas(o + add - less),
    };
  }).filter((r) => r.opening || r.additions || r.deductions);
  const S = (k) => fromHalalas(rows.reduce((a, r) => a + halalas(r[k]), 0));
  return {
    rows,
    openingTotal: S("opening"), additionsTotal: S("additions"),
    deductionsTotal: S("deductions"),
    // ⚠ ربح الفترة سطرٌ مستقل: هو أهمّ حركةٍ في حقوق الملكية ولا يظهر
    // في أي حسابٍ حتى يُقفل.
    netProfit,
    closingTotal: fromHalalas(halalas(S("closing")) + halalas(netProfit)),
  };
}

/// قائمة التدفقات النقدية — الطريقة غير المباشرة.

export { buildEquityStatement };
