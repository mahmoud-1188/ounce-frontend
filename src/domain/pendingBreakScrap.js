import { stageOf } from "./stageOf.js";

const pendingBreakScrap = (entries) =>
  (entries || []).filter((e) => stageOf(e) === "pending_break");

/// رصيد صاحب حسابٍ جارٍ — نقدًا وذهبًا.
///
/// ⚠ الذهب بمعادل 24 لا بالخام.
///
/// من أودع عشرة بعيار 18 وسحب عشرة بعيار 24 سحب أكثر مما أودع —
/// والخام يقول إنهما تعادلا. فنحفظ المعادل ونعرض الخام تفصيلًا.

export { pendingBreakScrap };
