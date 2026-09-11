import { hashPin } from "./hashPin.js";

function verifyPin(input, stored, salt) {
  if (stored == null || stored === "") return false;
  // ⚠ ترقية شفافة: النسخ القديمة تحمل الرقم نصًّا. رفضها يُقفل التطبيق
  // على أصحابه، فنقبله مرة ونستبدله بالتجزئة.
  if (/^\d{4,8}$/.test(String(stored))) {
    return String(input) === String(stored) ? "legacy" : false;
  }
  return hashPin(input, salt) === stored;
}

export { verifyPin };
