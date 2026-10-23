import { BRANCH_HUBS, hubSheetItems } from "./hubs.js";

/// ═══ التصميم البسيط (المرجع 2026-09-27): صفحةٌ واحدة — أهمّ الأزرار وداخل كلٍّ ملحقاته ═══
///   ① أسعار العيارات بسعر البيع اليوم ② مختصر المخزون ③ ما يجب أن يحدث الآن ④ الأبواب الكبيرة (البيع · الكسر · الجرد)
///   ⑤ الأبواب الصغيرة (المخزون · النقد والمصروفات · العملاء · التقارير). الدفاتر والموظفون والإعدادات في ☰.
///   الأبواب وأوراقها من جدول الأبواب (core/hubs.js) بترتيب المرجع: التبويب الأوّل ثم الإجراءات ثم البقية.
/// العنصر: [معرّف, تسمية] (المعرّف قد يحمل قسمه: cash:safe)، أو { act, label, need } لفعلٍ مباشر (بيع · بيع بالوزن).
const itemOf = (it) => (it.act ? { act: it.act, label: it.label, need: it.need } : [it.views[0], it.label]);
const groupOf = (h) => ({ key: h.key, title: h.title, hint: h.hint || "", icon: h.icon, tone: h.tone, items: hubSheetItems(h).map(itemOf) });
const SIMPLE_BRANCH = {
  big: BRANCH_HUBS.filter((h) => h.place === "big").map(groupOf),
  small: BRANCH_HUBS.filter((h) => h.place === "small").map(groupOf),
};

// ممرّات الفرع في المُضيء بترتيب يوم المحل: البيع ← المخزون ← الكسر والشراء ← المال ← التقارير
const BRANCH_LANES = [
  { tone: "sales", title: "البيع والعملاء", ids: ["salesHistory", "salesReturn", "customers", "reservations"] },
  { tone: "inventory", title: "المخزون", ids: ["inventory", "addGoods", "pieceInquiry", "printing"] },
  { tone: "purchasing", title: "الكسر والشراء", ids: ["scrapIntake", "scrapCustody", "purchases", "suppliers"] },
  { tone: "money", title: "المال", ids: ["cash", "expenses", "price", "safeAudit"] },
  { tone: "reports", title: "التقارير", ids: ["reportsHub", "dashboard", "combinedBook", "journal"] },
];

export { BRANCH_LANES, SIMPLE_BRANCH };
