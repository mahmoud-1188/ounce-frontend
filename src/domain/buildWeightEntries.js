import { POSTING_RULES } from "../core/chart.js";
import { fine24 } from "../core/money.js";

function buildWeightEntries(opType, { karat, weight, refId, note, createdBy, day, toOverride }) {
  const rule = POSTING_RULES[opType];
  // ⚠ لا نعود مبكرًا حين `weight: null`: قواعد انتقال الالتزام لا تحرّك
  // وزنًا لكنها تُقيّد في الدفتر الوزني.
  if (!rule || (!rule.weight && !rule.liabilityMove && !rule.liability)) return [];
  const w = Math.abs(Number(weight) || 0);
  if (w <= 0) return [];
  // ⚠ العيار المجهول يُرمى لا يُفترض 21: افتراضٌ صامت أخفى عطلًا أخرج
  // من الدفتر 87.5 جم عن كل 100 جم عيار 24 مُباعة.
  const k = Number(karat);
  if (!k || ![18, 21, 22, 24].includes(k)) {
    throw new Error(`عيار غير معروف في القيد الوزني: ${karat} (${opType})`);
  }
  const fine = fine24(w, k);
  const base = {
    date: new Date().toISOString(),
    opType, karat: k, weight: w, fineWeight: fine,
    refId: refId || null, note: note || rule.label,
    createdBy: createdBy || "", ...(day || {}),
  };
  const out = [];
  if (rule.weight?.from) {
    out.push({ ...base, id: `${Date.now()}wo${out.length}`, accountCode: rule.weight.from, type: "out",
      counterAccount: rule.weight.to || null });
  }
  const toAcc = toOverride || rule.weight?.to;
  if (toAcc) {
    out.push({ ...base, id: `${Date.now()}wi${out.length}`, accountCode: toAcc, type: "in",
      counterAccount: rule.weight?.from || null });
  }
  // ⚠ التزام الذهب للمورّد يُقيَّد في الدفتر الوزني.
  //
  // كانت القاعدة تُعلن `liability: { gold: "2110" }` ولا يقرؤها أحد —
  // فالشراء الآجل يُدخل المخزون ولا يُقيّد ما عليك للمورّد. تشتري 200 جم
  // آجلًا فيرى الدفتر الوزني 200 جم ملكًا لك بلا التزام، **كأنها هبة**.
  //
  // الالتزام يُقيَّد «خروجًا» من 2110: حسابٌ التزامي رصيده سالبٌ بطبيعته
  // (عليك لا لك)، ويُسوّى «دخولًا» حين تُسدّد.
  // انتقال الالتزام بين دائنَين (مورّد ← مكتب): خروجٌ من الأول ودخولٌ
  // للثاني — الوزن لا يتحرّك، الدائن هو من تغيّر.
  if (rule.liabilityMove?.from && rule.liabilityMove?.to) {
    out.push({ ...base, id: `${Date.now()}wm0`, accountCode: rule.liabilityMove.from,
      type: "in", counterAccount: rule.liabilityMove.to, liability: true });
    out.push({ ...base, id: `${Date.now()}wm1`, accountCode: rule.liabilityMove.to,
      type: "out", counterAccount: rule.liabilityMove.from, liability: true });
  }
  if (rule.liability?.gold && !rule.weight?.from) {
    out.push({ ...base, id: `${Date.now()}wl${out.length}`, accountCode: rule.liability.gold,
      type: "out", counterAccount: rule.weight.to || null, liability: true });
  }
  return out;
}

/// تدقيق الجدول نفسه: كل كود مذكور موجود في الشجرة، وكل حساب وزني
/// من القائمة المسموحة. خطأ هنا يعني قيدًا يذهب لحساب لا وجود له.

export { buildWeightEntries };
