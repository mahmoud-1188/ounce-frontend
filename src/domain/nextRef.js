import { REF_PREFIX } from "../core/money-rules.js";

function nextRef(kind, existing) {
  const prefix = REF_PREFIX[kind] || "REF";
  let max = 0;
  (existing || []).forEach((x) => {
    const m = String(x?.ref || "").match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/// مقارنة أسماء متسامحة: تتجاهل المسافات الزائدة وتشكيل الألف والتاء
/// المربوطة، فلا يمر «محمد أحمد» و«محمد احمد» كاسمين مختلفين.
/// يُوحّد الاسم للمقارنة.
///
/// ⚠ «أحمد» و«احمد» و«أحـمد» و«أَحمد» شخصٌ واحد.
///
/// ومن يُدخلها ثلاثًا يُنشئ ثلاثة موظفين براتبٍ واحد — يُصرف ثلاث
/// مرات ولا يُلاحظ أحد، لأن القائمة تعرضها مختلفة.
///
/// وكذلك أصحاب الحسابات: مودعٌ يودع باسمٍ ويسحب بآخر يجد رصيده صفرًا،
/// أو يسحب مرتين مما أودعه مرة.

export { nextRef };
