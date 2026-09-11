import { APPROVAL_RULES } from "../core/erp.js";
import { fromHalalas, halalas } from "../core/money.js";
import { needsApproval } from "./needsApproval.js";

function buildApprovalRequest({ kind, amount, payload, requester, requesterId,
                                requesterRole, note, settings }) {
  const check = needsApproval(kind, amount, requesterRole, settings);
  const rule = APPROVAL_RULES.find((r) => r.id === kind);
  return {
    id: `${Date.now()}ap`,
    ref: null,
    kind,
    kindLabel: rule?.label || kind,
    amount: fromHalalas(halalas(amount)),
    payload: payload || null,
    status: "pending",
    requester: requester || "",
    requesterId: requesterId || null,
    requesterRole: requesterRole || null,
    requestedAt: new Date().toISOString(),
    approver: null, approverId: null, decidedAt: null,
    decision: null, decisionNote: "",
    selfApproved: !!check.selfApprove,
    note: note || "",
  };
}

/// قرار على الطلب — لا يُعدَّل بعده.

export { buildApprovalRequest };
