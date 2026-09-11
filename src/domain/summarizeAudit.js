import { key } from "./key.js";

function summarizeAudit(log, { from, to } = {}) {
  const inRange = (e) => {
    const d = String(e.at || "").slice(0, 10);
    return (!from || d >= from) && (!to || d <= to);
  };
  const arr = (log || []).filter(inRange);
  const by = (key) =>
    arr.reduce((m, e) => {
      const k = e[key] || "—";
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {});
  return {
    total: arr.length,
    byEvent: by("event"),
    byActor: by("actor"),
    highRisk: arr.filter((e) => e.risk === "high").length,
    failedLogins: arr.filter((e) => e.event === "login_failed").length,
    entries: arr,
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  الأصول الثابتة والإهلاك
//
//  ⚠ الأصل يُشترى مرة ويُستهلك سنوات. تحميل ثمنه كاملًا على شهر الشراء
//  يجعل ذلك الشهر خاسرًا وما بعده رابحًا زورًا — والمقارنة بين الشهور
//  تصير بلا معنى.
//
//  والإهلاك مصروفٌ لا يخرج نقدًا: يُنقص الربح ولا يُنقص الصندوق. من
//  يقرأ الربح ويتوقع نقدًا مساويًا يُخطئ في الاتجاهين.
// ═══════════════════════════════════════════════════════════════════════

export { summarizeAudit };
