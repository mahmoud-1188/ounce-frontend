import { r2, r3 } from "./helpers.js";

// كشف الخزنة لمدّة من الحركات والرصيد الحالي: الختامي = الرصيد الآن ناقص ما بعد المدّة،
// والافتتاحي = الختامي ناقص صافي المدّة. التواريخ بتوقيت الرياض (+03:00) كيوم العمل.
function buildSafeStatement({ safeTx = [], safeGoldTx = [], safeBalance = {}, safeGoldBalance = {}, from = "", to = "" } = {}) {
  const a = from ? Date.parse(`${from}T00:00:00+03:00`) : -Infinity;
  const z = to ? Date.parse(`${to}T23:59:59.999+03:00`) : Infinity;
  const at = (x) => Date.parse(x?.date || x?.createdAt || "") || 0;
  const span = (list, pick) => {
    let after = 0, inR = 0, outR = 0;
    for (const x of list || []) {
      const v = pick(x);
      if (v == null) continue;
      const t = at(x);
      if (t > z) after += x.type === "in" ? v : -v;
      else if (t >= a) { if (x.type === "in") inR += v; else outR += v; }
    }
    return { after, inR, outR };
  };
  const cash = {};
  for (const m of ["cash", "network"]) {
    const { after, inR, outR } = span(safeTx, (x) => ((x.method || "cash") === m ? Number(x.amount) || 0 : null));
    const closing = r2((Number(safeBalance?.[m]) || 0) - after);
    cash[m] = { opening: r2(closing - inR + outR), in: r2(inR), out: r2(outR), closing };
  }
  const gold = [];
  const byK = safeGoldBalance?.byKarat || {};
  const keys = new Set([...Object.keys(byK), ...(safeGoldTx || []).map((x) => String(x.karat || 21))]);
  for (const k of [...keys].sort((x, y) => Number(y) - Number(x))) {
    for (const kind of ["crafted", "raw"]) {
      const { after, inR, outR } = span(safeGoldTx, (x) => (String(x.karat || 21) === k && (x.kind === "crafted" ? "crafted" : "raw") === kind ? Number(x.weight) || 0 : null));
      const closing = r3((Number(byK[k]?.[kind]) || 0) - after);
      const opening = r3(closing - inR + outR);
      if (Math.abs(opening) < 0.0005 && !inR && !outR && Math.abs(closing) < 0.0005) continue;
      gold.push({ kind, karat: Number(k), opening, in: r3(inR), out: r3(outR), closing });
    }
  }
  const inRange = (x) => at(x) >= a && at(x) <= z;
  const rows = [
    ...(safeTx || []).filter(inRange).map((x) => ({ date: x.date, unit: "currency", sign: x.type === "in" ? "+" : "−", value: Number(x.amount) || 0,
      label: `${x.type === "in" ? "إيداع" : "سحب"} ${(x.method || "cash") === "network" ? "شبكة" : "نقدي"}`, note: x.note || "" })),
    ...(safeGoldTx || []).filter(inRange).map((x) => ({ date: x.date, unit: "gram", sign: x.type === "in" ? "+" : "−", value: Number(x.weight) || 0,
      label: `${x.type === "in" ? "إيداع" : "سحب"} ${x.kind === "crafted" ? "مشغول" : "كسر"} عيار ${x.karat || 21}`, note: [x.destinationLabel, x.supplierName, x.note].filter(Boolean).join(" · ") })),
  ].sort((p, q) => at(p) - at(q));
  return { from, to, cash, gold, rows };
}

export { buildSafeStatement };
