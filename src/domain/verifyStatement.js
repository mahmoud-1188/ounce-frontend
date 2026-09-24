import { signStatement } from "./helpers.js";

function verifyStatement(signed) {
  if (!signed || signed.kind !== "internalSignature") return { ok: false, why: "ليس توقيعًا" };
  const { sig, kind, ...body } = signed;
  if (!sig) return { ok: false, why: "بلا بصمة" };
  // ⚠ إعادة الحساب بنفس الوقت المحفوظ — لا الحالي
  const again = signStatement(body);
  return again.sig === sig
    ? { ok: true, by: body.by, at: body.at, role: body.role }
    : { ok: false, why: "البصمة لا تطابق المحتوى — عُدّل المستند بعد التوقيع", expected: again.sig, found: sig };
}


// ═══════════════════════════════════════════════════════════════════════
//  ما يطلبه المراجع — مقارنةٌ وتنبيهٌ وسجلٌّ وتوقيع
// ═══════════════════════════════════════════════════════════════════════

// ⚠ `priorPeriodOf` موجودةٌ سلفًا أعلاه، وحسابُها أدقّ: تشمل الطرفين
// فتُقارَن ثلاثون يومًا بثلاثين لا بتسعٍ وعشرين. لا تُكرَّر.

/// يبني جدول مقارنةٍ من قائمتَي بنود.
// ⚠ `amountOf` لا `valueOf`: الأخير اسمٌ على `Object.prototype`، فإن
// لم يُمرَّر صراحةً التقط المستدعي الدالّةَ المدمجة بدل الافتراضية —
// و`Number(Object.prototype.valueOf(x))` يرمي. كشفته سنةُ العمل.

export { verifyStatement };
