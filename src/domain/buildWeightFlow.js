import { POSTING_RULES } from "../core/chart.js";
import { roundW } from "../core/money.js";

function buildWeightFlow({ goldLedger = [], from, to }) {
  const t0 = from ? new Date(from).getTime() : -Infinity;
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;
  let openFine = 0;
  const inBy = {}, outBy = {};
  for (const e of goldLedger) {
    const t = new Date(e.at || e.date).getTime();
    const f = (Number(e.weight) || 0) * (Number(e.karat) || 24) / 24 * (e.type === "in" ? 1 : -1);
    if (!String(e.accountCode || "").startsWith("1")) continue;   // الأصول الوزنية فقط
    if (t < t0) { openFine += f; continue; }
    if (t > t1) continue;
    const k = e.opType || "أخرى";
    if (f > 0) inBy[k] = roundW((inBy[k] || 0) + f);
    else outBy[k] = roundW((outBy[k] || 0) + (-f));
  }
  const rows = (o) => Object.entries(o).map(([op, w]) => ({ op, label: POSTING_RULES[op]?.label || op, fine24: w }))
    .sort((a, b) => b.fine24 - a.fine24);
  const ins = rows(inBy), outs = rows(outBy);
  const inT = roundW(ins.reduce((a, x) => a + x.fine24, 0));
  const outT = roundW(outs.reduce((a, x) => a + x.fine24, 0));
  return {
    opening: roundW(openFine), ins, outs,
    inTotal: inT, outTotal: outT,
    netChange: roundW(inT - outT),
    closing: roundW(openFine + inT - outT),
  };
}

/// تسوياتٌ جردية مقترحة — لا تُرحَّل تلقائيًّا.
///
/// ⚠ تُقترح لا تُرحَّل: التسوية قرارٌ محاسبي يوقّعه إنسان. برنامجٌ يُرحّل
/// تسويةً بنفسه يُجمّل الأرقام بلا أن يعلم أحد.

export { buildWeightFlow };
