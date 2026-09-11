import { APPROVAL_STATUS } from "../core/erp.js";

function decideApproval(req, { decision, approver, approverId, note }) {
  if (!req) return { error: "الطلب غير موجود" };
  // ⚠ القرار نهائي: تغييره بعد التنفيذ يجعل السجل كاذبًا.
  if (req.status !== "pending") {
    return { error: `الطلب ${APPROVAL_STATUS[req.status]?.label || req.status} — لا يُقرَّر ثانية` };
  }
  if (decision !== "approved" && decision !== "rejected") {
    return { error: "قرار غير معروف" };
  }
  return {
    request: {
      ...req,
      status: decision,
      decision,
      approver: approver || "",
      approverId: approverId || null,
      decidedAt: new Date().toISOString(),
      decisionNote: note || "",
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  الموازنة التقديرية
//
//  ⚠ الموازنة على الحساب لا على الإجمالي: «مصروفات 20,000» رقمٌ لا
//  يُدار. تجاوز الإيجار يختلف عن تجاوز المواصلات، وأحدهما ثابت والآخر
//  يُضبط.
// ═══════════════════════════════════════════════════════════════════════

/// مقارنة المخطَّط بالفعلي لفترة.

export { decideApproval };
