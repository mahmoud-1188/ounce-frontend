import { fromHalalas, halalas } from "../core/money.js";
import { accountByCode } from "./accountByCode.js";
import { inPeriod } from "./helpers.js";

function budgetVsActual(budgets, journal, period) {
  const inPeriod = (e) => String(e.date || "").slice(0, 7) === period;
  const actualByAcc = {};
  (journal || []).filter(inPeriod).forEach((e) => {
    (e.lines || []).forEach((l) => {
      const net = halalas(l.debit) - halalas(l.credit);
      actualByAcc[l.account] = (actualByAcc[l.account] || 0) + net;
    });
  });

  const rows = (budgets || [])
    .filter((b) => b.period === period)
    .map((b) => {
      const actual = fromHalalas(actualByAcc[b.account] || 0);
      const planned = fromHalalas(halalas(b.amount));
      const variance = fromHalalas(halalas(actual) - halalas(planned));
      return {
        account: b.account,
        name: accountByCode(b.account)?.name || b.account,
        costCenterId: b.costCenterId || null,
        planned, actual, variance,
        pct: planned > 0 ? Math.round((actual / planned) * 100) : null,
        // ⚠ التجاوز في المصروف سيّئ وفي الإيراد جيّد — الإشارة وحدها
        // لا تكفي، نحتاج طبيعة الحساب.
        over: accountByCode(b.account)?.nature === "debit"
          ? halalas(actual) > halalas(planned)
          : halalas(actual) < halalas(planned),
      };
    });

  return {
    rows,
    period,
    totalPlanned: rows.reduce((a, r) => a + halalas(r.planned), 0) / 100,
    totalActual: rows.reduce((a, r) => a + halalas(r.actual), 0) / 100,
    overCount: rows.filter((r) => r.over).length,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  الإقفال الشهري
//
//  ⚠ الإقفال يمنع التعديل على ما مضى. بلا منعٍ يعود أحدهم بعد شهرين
//  فيُصلح قيدًا، وتقرير الشهر المُصدَّر يختلف عمّا في النظام — ولا
//  أحد يعرف أيّهما الصحيح.
// ═══════════════════════════════════════════════════════════════════════

/// هل الفترة مقفلة؟

export { budgetVsActual };
