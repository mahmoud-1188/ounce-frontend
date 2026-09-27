import { CHART_OF_ACCOUNTS } from "../core/chart.js";
import { fromHalalas, halalas } from "../core/money.js";

/// ═══ الدفتر الثالث (المرجع 5.2.0): الذهب والنقد معًا بما يساوي الذهب بسعر اليوم ═══
/// للعرض وحده — لا يُكتب منه قيد، ولا يغيّر الدفترين.
///   · الذهب المملوك (الدفتر الوزني): مشغول + غير مشغول − ما علينا ذهبًا — معادل 24.
///   · صافي النقد (الدفتر المالي): كل حسابٍ ماليٍّ في الميزانية (نقد · بنك · ذمم مدينة − ذمم دائنة
///     وأجورٌ مستحقة وضريبة…) — بلا حسابات الذهب ولا حقوق الملكية.
function moneyPositionCodes(accounts = CHART_OF_ACCOUNTS) {
  return new Set((accounts || [])
    .filter((a) => !a.group && a.statement === "balance" && /^[12]/.test(String(a.code))
      && (a.unit === "currency" || String(a.code) === "1320") && String(a.code) !== "1295")
    .map((a) => String(a.code)));
}

const tsOf = (e) => new Date(e.at || e.date).getTime();

function moneyPositionAt(journal = [], at = null, { strictlyBefore = false } = {}) {
  const codes = moneyPositionCodes();
  const t = at ? new Date(at).getTime() : Infinity;
  let h = 0;
  for (const e of journal || []) {
    const ts = tsOf(e);
    if (strictlyBefore ? ts >= t : ts > t) continue;
    for (const l of e.lines || []) if (codes.has(String(l.account))) h += halalas(l.debit) - halalas(l.credit);
  }
  return fromHalalas(h);
}

/// أثر قيود الملكية (3xxx: رأس مال · سحوبات · افتتاحي) على صافي النقد في مدّة — تُستبعد من «التغيّر»
function moneyFlowsBetween(journal = [], from = null, to = null) {
  const codes = moneyPositionCodes();
  const t0 = from ? new Date(from).getTime() : -Infinity, t1 = to ? new Date(to).getTime() : Infinity;
  let h = 0;
  for (const e of journal || []) {
    const ts = tsOf(e);
    if (ts < t0 || ts > t1) continue;
    const lines = e.lines || [];
    if (!lines.some((l) => String(l.account).startsWith("3"))) continue;
    for (const l of lines) if (codes.has(String(l.account))) h += halalas(l.debit) - halalas(l.credit);
  }
  return fromHalalas(h);
}

function moneyBalances(journal = []) {
  const codes = moneyPositionCodes();
  const b = {};
  for (const e of journal || []) for (const l of e.lines || []) {
    const c = String(l.account);
    if (codes.has(c)) b[c] = (b[c] || 0) + halalas(l.debit) - halalas(l.credit);
  }
  return Object.entries(b).map(([code, h]) => ({ code, v: fromHalalas(h) })).filter((r) => Math.abs(r.v) >= 0.01).sort((a, b) => a.code.localeCompare(b.code));
}

/// goldPosition: من computeGoldPosition (المخزون الوزني الحالي)
function buildCombinedBook({ goldPosition, journal = [], price24 = 0, from = null, to = null }) {
  const p = Number(price24) || 0;
  const r3 = (x) => Math.round((Number(x) || 0) * 1000) / 1000;
  const toG = (v) => (p > 0 ? (Number(v) || 0) / p : 0);
  const ph = goldPosition?.physical || {};
  const worked = r3((ph.inventory || 0) + (ph.inTransit || 0));
  const unworked = r3((ph.scrap || 0) + (ph.atOffices || 0));
  const owed = r3(goldPosition?.goldOwed?.total || 0);
  const owned = r3(worked + unworked - owed);
  const moneyEnd = moneyPositionAt(journal, to);
  const out = {
    price24: p, priceMissing: p <= 0,
    gold: { worked, unworked, owed, owned },
    money: { net: moneyEnd, grams: r3(toG(moneyEnd)), rows: moneyBalances(journal) },
    total: { grams: r3(owned + toG(moneyEnd)), value: fromHalalas(Math.round(halalas((owned + toG(moneyEnd)) * p))) },
    period: null,
  };
  if (from) {
    const moneyStart = moneyPositionAt(journal, from, { strictlyBefore: true });
    const flows = moneyFlowsBetween(journal, from, to);
    const moneyGain = fromHalalas(halalas(moneyEnd) - halalas(moneyStart) - halalas(flows));
    out.period = { moneyStart, moneyEnd, moneyFlows: flows, moneyGain, moneyGainGrams: r3(toG(moneyGain)) };
  }
  return out;
}

export { buildCombinedBook, moneyPositionCodes, moneyPositionAt, moneyFlowsBetween };
