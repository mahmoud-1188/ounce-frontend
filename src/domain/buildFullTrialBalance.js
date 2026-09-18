import { fromHalalas, halalas } from "../core/money.js";
import { balancesAt } from "./helpers.js";

function buildFullTrialBalance({ journal = [], accounts = [], from, to }) {
  const open = balancesAt(journal, from ? new Date(new Date(from).getTime() - 1).toISOString() : null);
  const t0 = from ? new Date(from).getTime() : -Infinity;
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;
  const mv = {};
  for (const e of journal) {
    const t = new Date(e.at || e.date).getTime();
    if (t < t0 || t > t1) continue;
    for (const l of e.lines || []) {
      const m = (mv[l.account] ??= { d: 0, c: 0 });
      m.d += halalas(l.debit); m.c += halalas(l.credit);
    }
  }
  const codes = new Set([...Object.keys(open), ...Object.keys(mv)]);
  const rows = accounts.filter((a) => !a.group && codes.has(a.code)).map((a) => {
    const o = open[a.code] || 0;
    const m = mv[a.code] || { d: 0, c: 0 };
    const close = o + m.d - m.c;
    return {
      code: a.code, name: a.name, nature: a.nature || "debit", statement: a.statement,
      openDebit: fromHalalas(o > 0 ? o : 0),
      openCredit: fromHalalas(o < 0 ? -o : 0),
      moveDebit: fromHalalas(m.d),
      moveCredit: fromHalalas(m.c),
      // ⚠ المجاميع = الافتتاحي + الحركة قبل الطرح: المراجع يطابق بها
      totalDebit: fromHalalas((o > 0 ? o : 0) + m.d),
      totalCredit: fromHalalas((o < 0 ? -o : 0) + m.c),
      closeDebit: fromHalalas(close > 0 ? close : 0),
      closeCredit: fromHalalas(close < 0 ? -close : 0),
    };
  }).filter((r) => r.totalDebit || r.totalCredit);
  const sum = (k) => fromHalalas(rows.reduce((a, r) => a + halalas(r[k]), 0));
  const t = {
    openDebit: sum("openDebit"), openCredit: sum("openCredit"),
    moveDebit: sum("moveDebit"), moveCredit: sum("moveCredit"),
    totalDebit: sum("totalDebit"), totalCredit: sum("totalCredit"),
    closeDebit: sum("closeDebit"), closeCredit: sum("closeCredit"),
  };
  return {
    rows, totals: t,
    // ⚠ ثلاثة توازنات لا واحد: يختلّ أحدها فيُعرف موضع الكسر
    balanced: {
      opening: Math.abs(halalas(t.openDebit) - halalas(t.openCredit)) < 1,
      movement: Math.abs(halalas(t.moveDebit) - halalas(t.moveCredit)) < 1,
      closing: Math.abs(halalas(t.closeDebit) - halalas(t.closeCredit)) < 1,
    },
  };
}

/// قائمة المركز المالي.

export { buildFullTrialBalance };
