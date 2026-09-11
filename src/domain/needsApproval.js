import { APPROVAL_RULES } from "../core/erp.js";
import { fmt, halalas } from "../core/money.js";

function needsApproval(kind, amount, requesterRole, settings = {}) {
  if (settings.approvalsEnabled === false) return { needed: false, why: "الاعتماد معطَّل" };
  const rule = APPROVAL_RULES.find((r) => r.id === kind);
  if (!rule) return { needed: false, why: "عملية بلا قاعدة اعتماد" };
  const th = settings.approvalThresholds?.[kind] ?? rule.threshold;
  if (halalas(amount) < halalas(th)) {
    return { needed: false, why: `دون الحدّ ${fmt(th, 0)}`, rule };
  }
  // ⚠ المدير لا يعتمد نفسه إلا إن لم يكن فوقه أحد.
  //
  // في محل بمدير واحد لا مفرّ، فنسمح ونُسجّل: السجل يبقى شاهدًا حتى
  // حين يغيب الفصل.
  const selfApprove = requesterRole === rule.approver;
  return { needed: true, rule, selfApprove, approver: rule.approver };
}

/// طلب اعتماد.

export { needsApproval };
