import { POSTING_RULES } from "../core/chart.js";
import { fine24 } from "../core/money.js";

function buildWeightEntries(opType, { karat, weight, refId, note, createdBy, day }) {
  const rule = POSTING_RULES[opType];
  if (!rule || !rule.weight) return [];
  const w = Math.abs(Number(weight) || 0);
  if (w <= 0) return [];
  const k = Number(karat) || 21;
  const fine = fine24(w, k);
  const base = {
    date: new Date().toISOString(),
    opType, karat: k, weight: w, fineWeight: fine,
    refId: refId || null, note: note || rule.label,
    createdBy: createdBy || "", ...(day || {}),
  };
  const out = [];
  if (rule.weight.from) {
    out.push({ ...base, id: `${Date.now()}wo${out.length}`, accountCode: rule.weight.from, type: "out",
      counterAccount: rule.weight.to || null });
  }
  if (rule.weight.to) {
    out.push({ ...base, id: `${Date.now()}wi${out.length}`, accountCode: rule.weight.to, type: "in",
      counterAccount: rule.weight.from || null });
  }
  return out;
}

/// تدقيق الجدول نفسه: كل كود مذكور موجود في الشجرة، وكل حساب وزني
/// من القائمة المسموحة. خطأ هنا يعني قيدًا يذهب لحساب لا وجود له.

export { buildWeightEntries };
