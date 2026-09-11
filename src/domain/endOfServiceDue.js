import { fromHalalas, halalas } from "../core/money.js";

function endOfServiceDue(emp, { reason = "termination", lastGross = 0, atDate } = {}) {
  const start = emp.hireDate ? new Date(emp.hireDate).getTime() : Date.now();
  const end = atDate ? new Date(atDate).getTime() : Date.now();
  const years = Math.max(0, (end - start) / (365.25 * 24 * 3600 * 1000));
  const g = halalas(lastGross || emp.basicSalary || 0);

  const first5 = Math.min(years, 5);
  const after5 = Math.max(0, years - 5);
  let due = Math.round(g * 0.5 * first5) + Math.round(g * after5);

  if (reason === "resignation") {
    // ⚠ نظام العمل السعودي: أقلّ من سنتين لا شيء، وحتى خمس ثلث،
    // وحتى عشر ثلثان، وما فوقها كامل.
    if (years < 2) due = 0;
    else if (years < 5) due = Math.round(due / 3);
    else if (years < 10) due = Math.round((due * 2) / 3);
  }
  return {
    years: Math.round(years * 100) / 100,
    due: fromHalalas(due),
    reason,
    basis: reason === "resignation" ? "استقالة — مُقلَّص بالمدة" : "إنهاء عقد — كامل",
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  دورة الاعتماد
//
//  ⚠ من يطلب لا يعتمد. الفصل ليس بيروقراطية: هو الضابط الوحيد الذي
//  يمنع من بيده الصلاحية أن يصرف لنفسه بلا شاهد.
//
//  والحدّ يُقاس بالمبلغ لا بالنوع: صرفٌ بخمسين ريالًا يوقفه الاعتماد
//  عشر مرات يوميًا فيُلتَف عليه، وبخمسين ألفًا يمرّ بلا نظر إن لم يُوقف.
// ═══════════════════════════════════════════════════════════════════════

export { endOfServiceDue };
