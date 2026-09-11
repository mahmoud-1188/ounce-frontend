import { b32Decode, cleanToken, ounceHash } from "./helpers.js";

function verifyToken(tokenRaw, expectedKind) {
  try {
    const token = cleanToken(tokenRaw);
    if (!token || token.length < 12) return { ok: false, reason: "الرمز غير مكتمل" };
    const prefix = token.slice(0, 2);
    if ((expectedKind === "LIC" && prefix !== "KL") || (expectedKind === "BRN" && prefix !== "KB"))
      return { ok: false, reason: expectedKind === "LIC" ? "هذا ليس مفتاح ترخيص" : "هذا ليس كود تفعيل فرع" };
    const rest = token.slice(2);
    const sig = rest.slice(-7);
    const body = rest.slice(0, -7);
    if (ounceHash(body) !== sig) return { ok: false, reason: "الرمز غير صالح أو تم تعديله" };
    const payload = b32Decode(body);
    if (payload.k !== expectedKind) return { ok: false, reason: "نوع الرمز غير متطابق" };
    if (payload.k === "LIC") {
      const daysLeft = Math.ceil((new Date(payload.e) - new Date()) / 86400000);
      if (daysLeft < 0) return { ok: false, reason: `انتهى الاشتراك بتاريخ ${payload.e}`, payload, expired: true };
      return { ok: true, payload, daysLeft };
    }
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, reason: "تعذّرت قراءة الرمز" };
  }
}

export { verifyToken };
