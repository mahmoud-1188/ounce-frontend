import { POSTING_RULES, WEIGHT_ACCOUNTS } from "../core/chart.js";
import { accountByCode } from "./accountByCode.js";

function auditPostingRules() {
  const issues = [];
  Object.entries(POSTING_RULES).forEach(([op, r]) => {
    const codes = [];
    if (r.cash) codes.push(r.cash.debit, r.cash.credit);
    if (r.weight) codes.push(r.weight.from, r.weight.to);
    ["liabilityDown", "cost", "revenue"].forEach((k) => r[k] && codes.push(r[k]));
    if (r.liability) Object.values(r.liability).forEach((c) => codes.push(c));
    if (r.liabilityMove) codes.push(r.liabilityMove.from, r.liabilityMove.to);
    codes.filter(Boolean).forEach((c) => {
      if (!accountByCode(c)) issues.push({ op, code: c, why: "حساب غير موجود بالشجرة" });
    });
    if (r.weight) {
      [r.weight.from, r.weight.to].filter(Boolean).forEach((c) => {
        if (!WEIGHT_ACCOUNTS.includes(c)) issues.push({ op, code: c, why: "ليس حسابًا وزنيًا" });
      });
    }
    if (!r.cash && !r.weight && !r.stageChange && !r.liabilityMove) {
      issues.push({ op, code: "—", why: "عملية بلا أثر على أي دفتر" });
    }
  });
  return issues;
}


// ═══════════════════════════════════════════════════════════════════════
//  الفهرس الشامل وسلسلة الإسناد
//
//  المساعد بلا أثر يُخمّن. يقول «ربحك انخفض» ولا يستطيع أن يقول من أي
//  فاتورة، فتبقى معه في جدال بلا مستند.
//
//  هذه الطبقة تحوّل كل سجل في التطبيق إلى صيغة موحّدة قابلة للبحث
//  والتتبّع، فيصير كل رقم يقوله المساعد مسنودًا بمرجع تفتحه بنفسك.
//
//  ثلاث قدرات:
//    ① فهرسة   — كل سجل بمرجعه ووزنه ومبلغه ونصّه القابل للبحث
//    ② بحث     — بأي حرف: مرجع · اسم · مبلغ · تاريخ · عيار
//    ③ إسناد   — من أين جاء هذا السجل، وماذا تفرّع عنه
// ═══════════════════════════════════════════════════════════════════════

/// أنواع السجلات ووصفها — يُستخدم في العرض والتصفية.

export { auditPostingRules };
