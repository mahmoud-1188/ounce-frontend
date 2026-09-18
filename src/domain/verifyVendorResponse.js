import { RECOVERY_WINDOW_MIN } from "../core/constants.js";
import { normalizeRecovery, vendorChallenge, vendorResponse } from "./helpers.js";

function verifyVendorResponse(answer, branchCode, atMs = Date.now()) {
  const given = normalizeRecovery(answer);
  const win = RECOVERY_WINDOW_MIN * 60 * 1000;
  for (const t of [atMs, atMs - win]) {
    if (vendorResponse(vendorChallenge(branchCode, t), branchCode) === given) return true;
  }
  return false;
}

/// أسئلة الاسترجاع — تُشتقّ من بيانات المحل لا يحفظها المستخدم.

export { verifyVendorResponse };
