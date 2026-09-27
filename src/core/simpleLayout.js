import { BarChart3, ClipboardCheck, Flame, Receipt, Users, Wallet, Warehouse } from "lucide-react";

/// ═══ التصميم البسيط (المرجع 2026-09-27): صفحةٌ واحدة — أهمّ الأزرار وداخل كلٍّ ملحقاته ═══
///   ① أسعار العيارات بسعر البيع اليوم ② مختصر المخزون ③ ما يجب أن يحدث الآن ④ ثلاثة أزرارٍ كبيرة بأولويّة يوم المحل
///   (البيع ← الكسر ← الجرد) ⑤ أربعةٌ أصغر (المخزون · النقد والمصروفات · العملاء · التقارير).
///   كل زرٍّ يفتح ورقةً بملحقاته — أوّلها الفعل الأهمّ. التكويد داخل «المخزون»، والإعدادات في ☰ أعلى الشاشة.
/// العنصر: معرّف شاشة، أو [معرّف, تسمية]، أو { act, label, need } لفعلٍ مباشر (بيع · كسر).
const SIMPLE_BRANCH = {
  big: [
    { key: "sale", title: "البيع", hint: "فاتورة · بالوزن · مرتجع · حجوزات", icon: Receipt, tone: "sales",
      items: [{ act: "sell", label: "فاتورة بيع جديدة", need: "sales" }, ["sales", "البيع بالوزن والمرتجع"], "salesHistory", "salesReturn", "reservations", "customOrders", "giftCards"] },
    { key: "scrap", title: "الكسر", hint: "استلام · عهدة · شراء · موردون", icon: Flame, tone: "purchasing",
      items: [{ act: "scrap", label: "كل خيارات الكسر", need: ["scrapIntake", "scrapCustody", "scrap"] }, "scrapIntake", "scrapCustody", "scrap", "purchases", "purchaseOrders", "suppliers", "taskirat"] },
    { key: "count", title: "الجرد", hint: "عدّ الرفّ · جرد الخزنة", icon: ClipboardCheck, tone: "inventory",
      items: [["stocktake", "جرد المخزون"], "safeAudit"] },
  ],
  small: [
    { key: "stock", title: "المخزون", icon: Warehouse, tone: "inventory",
      items: ["inventory", "pieceInquiry", "addGoods", "printing", "categories", "branchTransfers", "reorder", "conversions"] },
    { key: "money", title: "النقد والمصروفات", icon: Wallet, tone: "money",
      items: ["cash", "expenses", "workday", "price", "priceFix", "bankFees", "partners", "openingBalance"] },
    { key: "people", title: "العملاء", icon: Users, tone: "people",
      items: ["customers", "trustAccounts", "repairs", "customerReport", "amlRegister"] },
    { key: "reports", title: "التقارير", icon: BarChart3, tone: "reports",
      items: ["reportsHub", "dashboard", "combinedBook", "financials", "journal", "trialBalance", "taxReport", "vatReturn", "budgets"] },
  ],
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
