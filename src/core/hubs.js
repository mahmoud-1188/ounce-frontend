import { BarChart3, ClipboardCheck, FileText, Flame, Receipt, Settings, UserRound, Users, Wallet, Warehouse } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
//  أبواب الفرع (المرجع م1) — جدولٌ واحد للتنقّل.
//
//  كل شاشةٍ في بابٍ واحد، ولكل بابٍ تبويبات، ولكل تبويبٍ شاشاته المتقاربة
//  (`views`) رقاقاتٍ داخله. الشريط أعلى الشاشة والشريط الجانبي يُبنيان منه،
//  وما لا يُفتح لمن يجلس يسقط وحده. الشاشة التي لا باب لها تبقى في «أخرى».
// ═══════════════════════════════════════════════════════════════
const BRANCH_HUBS = [
  { key: "sale", title: "البيع", icon: Receipt,
    tabs: [
      { key: "invoice", label: "فاتورة", views: ["sales", "saleDrafts"], labels: { sales: "فاتورة", saleDrafts: "معلّقة وعروض أسعار" } },
      { key: "history", label: "الفواتير والمرتجع", views: ["salesHistory", "salesReturn"],
        labels: { salesHistory: "الفواتير", salesReturn: "مرتجع واستبدال" } },
      { key: "orders", label: "الطلبات", views: ["reservations", "customOrders", "giftCards"],
        labels: { reservations: "حجز", customOrders: "طلب خاص", giftCards: "هدايا" } },
      { key: "showcase", label: "الاستعراض", views: ["showcase"] },
    ] },
  { key: "scrap", title: "الكسر والموردون", icon: Flame,
    tabs: [
      { key: "scrap", label: "الكسر", views: ["scrapIntake", "scrapCustody", "scrap"],
        labels: { scrapIntake: "استلام", scrapCustody: "في العهدة والتكسير", scrap: "السجل" } },
      { key: "suppliers", label: "الموردون والمكاتب", views: ["suppliers", "officeLedger", "taskirat", "supplierLedger"],
        labels: { suppliers: "الموردون", officeLedger: "المكاتب", taskirat: "التسكير", supplierLedger: "دفتر الموردين" } },
      { key: "purchases", label: "المشتريات", views: ["purchases", "purchaseOrders"],
        labels: { purchases: "المشتريات", purchaseOrders: "أوامر الشراء" } },
      { key: "hqDocs", label: "طلبات الإدارة", views: ["hqDocs"] },
    ] },
  { key: "count", title: "الجرد", icon: ClipboardCheck,
    tabs: [
      { key: "stock", label: "جرد المخزون", views: ["stocktake", "rfidReader"], labels: { stocktake: "العدّ", rfidReader: "قارئ RFID" } },
      { key: "safe", label: "جرد الخزنة", views: ["safeAudit"] },
    ] },
  { key: "stock", title: "المخزون", icon: Warehouse,
    tabs: [
      { key: "items", label: "القطع", views: ["inventory", "pieceInquiry", "itemEdit"],
        labels: { inventory: "القطع", pieceInquiry: "الاستعلام", itemEdit: "تعديل القطع" } },
      { key: "coding", label: "التكويد والطباعة", views: ["addGoods", "printing", "codingReport"],
        labels: { addGoods: "التكويد", printing: "إعادة الطباعة", codingReport: "ما كُوّد" } },
      { key: "categories", label: "التصنيفات", views: ["categories", "reorder"], labels: { categories: "التصنيفات", reorder: "الحدّ الأدنى" } },
      { key: "moves", label: "التحويلات", views: ["conversions", "branchTransfers"],
        labels: { conversions: "بين الكسر والقطع", branchTransfers: "بين الفروع" } },
    ] },
  { key: "money", title: "النقد والمصروفات", icon: Wallet,
    tabs: [
      { key: "cash", label: "الصندوق والخزنة", views: ["cash", "workday", "price", "priceFix"],
        labels: { cash: "الصندوق والخزنة", workday: "يوم العمل", price: "السعر اليومي", priceFix: "تثبيت ذهب↔نقد" } },
      { key: "expenses", label: "المصروفات", views: ["expenses", "budgets"], labels: { expenses: "المصروفات", budgets: "مقابل الموازنة" } },
      { key: "bank", label: "البنك", views: ["bankFees", "bankRecon"], labels: { bankFees: "عمولات البنك", bankRecon: "مطابقة البنك" } },
      { key: "partners", label: "الشركاء والأصول", views: ["partners", "fixedAssets"], labels: { partners: "الشركاء", fixedAssets: "الأصول" } },
    ] },
  { key: "clients", title: "العملاء", icon: Users,
    tabs: [
      { key: "customers", label: "العملاء", views: ["customers", "customerReport"], labels: { customers: "العملاء", customerReport: "تقرير العملاء" } },
      { key: "trust", label: "الحسابات الجارية", views: ["trustAccounts"] },
      { key: "repairs", label: "الإصلاحات", views: ["repairs"] },
      { key: "aml", label: "مكافحة غسل الأموال", views: ["amlRegister"] },
    ] },
  { key: "reports", title: "التقارير", icon: BarChart3,
    tabs: [
      { key: "hub", label: "كل التقارير", views: ["reportsHub", "dashboard", "masterReport"],
        labels: { reportsHub: "مركز التقارير", dashboard: "لوحة التحكم", masterReport: "التقارير الموحّدة" } },
      { key: "compare", label: "تحليلات", views: ["reports", "sellerReports", "combinedBook", "openingCompare", "hqReports"],
        labels: { reports: "مقارنة فترات", sellerReports: "البائعون", combinedBook: "الذهب والنقد معًا", openingCompare: "مقارنة بالافتتاحي", hqReports: "تقرير الفروع" } },
      { key: "parties", label: "كشوف الحساب", views: ["anyStatement"] },
      { key: "tax", label: "الضريبة", views: ["taxReport"] },
    ] },
  { key: "ledgers", title: "الدفاتر والرقابة", icon: FileText,
    tabs: [
      { key: "tree", label: "الشجرة والميزان", views: ["generalLedger", "trialBalance", "openingBalance"],
        labels: { generalLedger: "الأستاذ العام", trialBalance: "ميزان المراجعة", openingBalance: "الافتتاحي" } },
      { key: "statements", label: "القوائم", views: ["fullStatements", "financials", "ifrs"],
        labels: { fullStatements: "القوائم الكاملة", financials: "الزكاة", ifrs: "IFRS" } },
      { key: "journal", label: "اليومية", views: ["journal", "documents", "queryBuilder", "docCycle"],
        labels: { journal: "اليومية", documents: "المستندات", queryBuilder: "تصفية متقدّمة", docCycle: "الدورة المستندية" } },
      { key: "review", label: "المراجعة والاعتماد", views: ["accountantReview", "approvals"],
        labels: { accountantReview: "المراجعة", approvals: "الاعتمادات" } },
      { key: "compliance", label: "الامتثال", views: ["vatReturn", "einvoice"] },
    ] },
  { key: "staff", title: "الموظفون", icon: UserRound,
    tabs: [
      { key: "payroll", label: "الرواتب", views: ["payroll"] },
      { key: "hr", label: "الحضور والإجازات", views: ["attendanceHr"] },
    ] },
  { key: "settings", title: "الإعدادات", icon: Settings,
    tabs: [
      { key: "basics", label: "الأساسيات", views: ["settings", "navCustomize"], labels: { settings: "الأساسيات", navCustomize: "تخصيص القائمة" } },
      { key: "security", label: "الصلاحيات", views: ["access"] },
      { key: "devices", label: "الأجهزة", views: ["printerSetup", "rfidSettings"], labels: { printerSetup: "الطابعة", rfidSettings: "قارئ RFID" } },
      { key: "links", label: "الربط", views: ["integration", "exchange", "storeLink"],
        labels: { integration: "الربط مع الأنظمة", exchange: "التبادل", storeLink: "المتجر الإلكتروني" } },
      { key: "modules", label: "الوحدات والنسخ", views: ["modules", "backup"], labels: { modules: "الوحدات", backup: "النسخ الاحتياطي" } },
    ] },
];

/// باب الشاشة وتبويبها — أوّل ما يحويها.
function hubOf(pageId) {
  for (const hub of BRANCH_HUBS) {
    for (const tab of hub.tabs) if (tab.views.includes(pageId)) return { hub, tab };
  }
  return null;
}

/// الباب بما يُفتح منه لمن يجلس: التبويب يسقط إن لم تبقَ فيه شاشة.
function visibleHub(hub, allowed) {
  const tabs = hub.tabs
    .map((t) => ({ ...t, views: t.views.filter(allowed) }))
    .filter((t) => t.views.length);
  return tabs.length ? { ...hub, tabs } : null;
}

const hubPages = () => new Set(BRANCH_HUBS.flatMap((h) => h.tabs.flatMap((t) => t.views)));

export { BRANCH_HUBS, hubOf, hubPages, visibleHub };
