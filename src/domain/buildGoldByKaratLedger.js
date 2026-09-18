import { roundW } from "../core/money.js";
import { key } from "./key.js";

function buildGoldByKaratLedger({ goldLedger = [], from, to, accountCodes = null }) {
  const t0 = from ? new Date(from).getTime() : -Infinity;
  // ⚠ «إلى» نهاية اليوم لا بدايته: `new Date("2026-09-15")` منتصف الليل،
  // فكل حركات اليوم المختار تُستبعد ويظنّ المستخدم الدفتر فارغًا.
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;
  const inScope = (e) => !accountCodes || accountCodes.includes(String(e.accountCode));
  const list = goldLedger.filter(inScope)
    .slice().sort((a, b) => String(a.at || a.date).localeCompare(String(b.at || b.date)));

  const opening = {};   // عيار → جم
  const rows = [];
  const run = {};
  for (const e of list) {
    const t = new Date(e.at || e.date).getTime();
    const k = Number(e.karat) || 24;
    const d = (e.type === "in" ? 1 : -1) * (Number(e.weight) || 0);
    if (t < t0) { opening[k] = (opening[k] || 0) + d; continue; }
    if (t > t1) continue;
    run[k] = (run[k] ?? (opening[k] || 0)) + d;
    rows.push({
      at: e.at || e.date, ref: e.refDoc || e.ref || "", id: e.id, opType: e.opType,
      account: e.accountCode, karat: k, in: e.type === "in" ? Math.abs(d) : 0,
      out: e.type === "out" ? Math.abs(d) : 0, balance: roundW(run[k]),
      fine: roundW(d * k / 24), note: e.note || "", by: e.createdBy || "",
    });
  }
  const karats = [...new Set([...Object.keys(opening), ...Object.keys(run)].map(Number))].sort((a, b) => b - a);
  const byKarat = karats.map((k) => ({
    karat: k,
    opening: roundW(opening[k] || 0),
    in: roundW(rows.filter((r) => r.karat === k).reduce((a, r) => a + r.in, 0)),
    out: roundW(rows.filter((r) => r.karat === k).reduce((a, r) => a + r.out, 0)),
    closing: roundW(run[k] ?? (opening[k] || 0)),
  }));
  const fine = (arr, key) => roundW(arr.reduce((a, r) => a + r[key] * r.karat / 24, 0));
  return { rows, byKarat,
    totals: { openingFine: fine(byKarat, "opening"), inFine: fine(byKarat, "in"),
              outFine: fine(byKarat, "out"), closingFine: fine(byKarat, "closing") } };
}

/// دفتر النقدية: كل حسابات النقد (1110–1150) في كشفٍ واحد بمصدره.

export { buildGoldByKaratLedger };
