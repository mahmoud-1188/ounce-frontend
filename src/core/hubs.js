import { BarChart3, ClipboardCheck, FileText, Flame, Receipt, Settings, UserRound, Users, Wallet, Warehouse } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
//  أبواب الفرع كما في المرجع (core/navigation.js — BRANCH_HUBS) — جدولٌ واحد للتنقّل.
//
//  لكل بابٍ مكانه في الرئيسية البسيطة (`place`: big · small · menu) وتلميحه، وإجراءاته
//  (`actions`: فعلٌ مباشر act أو شاشة views)، وتبويباته وما تحت «المزيد» (`more`)، ولكل تبويبٍ
//  شاشاته (`views`) رقاقاتٍ داخله. الشاشة قد تحمل قسمها بعد «:» (cash:safe · reportsHub:gold ·
//  fullStatements:bs) فتُفتح الشاشة على قسمها. الشريط الجانبي و☰ والرئيسية البسيطة تُبنى منه.
//  ما زاد في هذا التطبيق على المرجع (الاعتمادات · المراجعة · مسرد المصطلحات · قارئ RFID · المتجر)
//  باقٍ في الباب الأقرب إليه كي لا تضيع شاشة.
// ═══════════════════════════════════════════════════════════════
const BRANCH_HUBS = [
  { key: "sale", title: "البيع", icon: Receipt, tone: "sales", place: "big",
    hint: "فاتورة · بالوزن · مرتجع · طلبات",
    actions: [
      { act: "sell", label: "بيع", need: "sales" },
      { act: "partialSale", label: "بيع بالوزن", need: "sales" },
    ],
    tabs: [
      { key: "invoice", label: "فاتورة", views: ["sales"] },
      { key: "history", label: "الفواتير والمرتجع", views: ["salesHistory", "salesReturn"],
        labels: { salesHistory: "الفواتير", salesReturn: "مرتجع واستبدال" } },
      { key: "orders", label: "الطلبات", views: ["reservations", "saleDrafts", "customOrders", "giftCards", "storeOrders"],
        labels: { reservations: "حجز وتقسيط", saleDrafts: "معلّقة وعروض", customOrders: "طلب خاص", giftCards: "هدايا", storeOrders: "طلبات المتجر" } },
      { key: "showcase", label: "الاستعراض", views: ["showcase"] },
    ] },
  { key: "scrap", title: "الكسر", menuLabel: "الكسر والموردون", icon: Flame, tone: "purchasing", place: "big",
    hint: "استلام · عهدة · شراء · موردون",
    actions: [{ label: "استلام كسر", views: ["scrapIntake"] }],
    tabs: [
      { key: "scrap", label: "الكسر", views: ["scrapIntake", "scrapCustody", "scrap", "workshop"],
        labels: { scrapIntake: "استلام", scrapCustody: "في العهدة والتكسير", scrap: "السجل", workshop: "الورش" } },
      { key: "suppliers", label: "الموردون والمكاتب", views: ["suppliers", "officeLedger", "taskirat", "supplierLedger"],
        labels: { suppliers: "الموردون", officeLedger: "المكاتب", taskirat: "التسكير", supplierLedger: "كشف المورد" } },
      { key: "purchases", label: "المشتريات", views: ["purchases", "purchaseOrders"],
        labels: { purchases: "المشتريات", purchaseOrders: "أوامر الشراء" } },
      { key: "hqDocs", label: "طلبات الإدارة", views: ["hqDocs", "hqRequests"], labels: { hqDocs: "مستندات الإدارة", hqRequests: "طلباتي للإدارة" } },
    ] },
  { key: "count", title: "الجرد", icon: ClipboardCheck, tone: "inventory", place: "big",
    hint: "عدّ الرفّ · جرد الخزنة",
    tabs: [
      { key: "stock", label: "جرد المخزون", views: ["stocktake", "rfidReader"], labels: { stocktake: "العدّ", rfidReader: "قارئ RFID" } },
      { key: "safe", label: "جرد الخزنة", views: ["safeAudit"] },
    ] },
  { key: "stock", title: "المخزون", icon: Warehouse, tone: "inventory", place: "small", leadTab: true,
    actions: [{ label: "استعلام عن قطعة", views: ["pieceInquiry"] }],
    tabs: [
      { key: "items", label: "المخزون", views: ["inventory", "pieceInquiry", "itemEdit"],
        labels: { inventory: "القطع", pieceInquiry: "الاستعلام", itemEdit: "تعديل القطع" } },
      { key: "coding", label: "التكويد والطباعة", views: ["addGoods", "printing", "codingReport"],
        labels: { addGoods: "التكويد", printing: "إعادة الطباعة", codingReport: "ما كُوّد" } },
      { key: "categories", label: "التصنيفات", views: ["categories", "reorder"], labels: { categories: "التصنيفات", reorder: "الحدّ الأدنى" } },
      { key: "moves", label: "التحويلات", views: ["conversions", "branchTransfers"],
        labels: { conversions: "بين الكسر والقطع", branchTransfers: "بين الفروع" } },
    ] },
  { key: "money", title: "النقد والمصروفات", barLabel: "النقد", icon: Wallet, tone: "money", place: "small", leadTab: true,
    actions: [
      { label: "سجّل مصروفًا", views: ["expenses:new"] },
      { label: "يوم العمل", views: ["workday"] },
    ],
    tabs: [
      { key: "daily", label: "النقد", views: ["cash:daily"], labels: { "cash:daily": "النقد" } },
      { key: "safe", label: "الخزنة", views: ["cash:safe", "priceFix"], labels: { "cash:safe": "الخزنة", priceFix: "تثبيت ذهب↔نقد" } },
      { key: "custody", label: "صندوق الكسر", views: ["cash:scrap"], labels: { "cash:scrap": "صندوق الكسر" } },
      { key: "expenses", label: "المصروفات", views: ["expenses", "budgets"], labels: { expenses: "المصروفات", budgets: "مقابل الموازنة" } },
    ],
    moreLabel: "متقدّم",
    more: [
      { key: "bank", label: "البنك", views: ["bankFees", "bankRecon"], labels: { bankFees: "عمولات البنك", bankRecon: "مطابقة البنك" } },
      { key: "partners", label: "الشركاء", views: ["partners"] },
      { key: "assets", label: "الأصول", views: ["fixedAssets"] },
      { key: "price", label: "السعر اليومي", views: ["price"] },
    ] },
  { key: "clients", title: "العملاء", icon: Users, tone: "people", place: "small", leadTab: true,
    actions: [{ label: "تحصيل من عميل", views: ["customers:collect"] }],
    tabs: [
      { key: "customers", label: "العملاء", views: ["customers", "customerReport"], labels: { customers: "العملاء", customerReport: "كشف العميل" } },
      { key: "trust", label: "الحسابات الجارية", views: ["trustAccounts"] },
      { key: "repairs", label: "الإصلاحات", views: ["repairs"] },
    ] },
  // التقارير بابٌ يُفتح بسؤال: أوّل كل سؤالٍ ملخّصه (reportsHub:<سؤال>) ثم تقاريره
  { key: "reports", title: "التقارير", icon: BarChart3, tone: "reports", place: "small",
    sheet: [
      { key: "all", label: "كل التقارير", views: ["reportsHub:profit"] },
      { key: "today", label: "ملخّص اليوم", views: ["dashboard"] },
      { key: "ledgers", label: "الدفاتر", views: ["trialBalance", "generalLedger"] },
      { key: "journal", label: "اليومية", views: ["journal"] },
      { key: "tax", label: "الضريبة", views: ["taxReport"] },
    ],
    tabs: [
      { key: "profit", label: "كم ربحنا؟",
        views: ["reportsHub:profit", "netWeight", "dashboard", "masterReport", "combinedBook", "sellerReports", "reports:overview", "reports:ai"],
        labels: { "reportsHub:profit": "الملخّص", netWeight: "الصافي بالوزن", dashboard: "لوحة التحكم", masterReport: "التقارير الموحّدة", combinedBook: "الذهب والنقد معًا",
          sellerReports: "بالبائع", "reports:overview": "مقارنة فترات", "reports:ai": "التحليل الذكي" } },
      { key: "flow", label: "بيعٌ وشراءٌ وصرف", views: ["reportsHub:flow", "reports:sales", "reports:purchases", "reports:expenses"],
        labels: { "reportsHub:flow": "الملخّص", "reports:sales": "المبيعات", "reports:purchases": "المشتريات والكسر", "reports:expenses": "المصروفات" } },
      { key: "gold", label: "أين الذهب؟", views: ["reportsHub:gold", "openingCompare", "reports:inventory", "wastageReport"],
        labels: { "reportsHub:gold": "الملخّص", openingCompare: "مقارنة بالافتتاحي", "reports:inventory": "الجرد", wastageReport: "الهدر" } },
      { key: "parties", label: "من يدين لمن؟", views: ["reportsHub:parties", "anyStatement"],
        labels: { "reportsHub:parties": "الملخّص", anyStatement: "كشف حساب" } },
    ],
    moreLabel: "المزيد",
    more: [
      { key: "cash", label: "النقد والبنك", views: ["reportsHub:cash"], labels: { "reportsHub:cash": "الملخّص" } },
      { key: "tax", label: "الضريبة والزكاة", views: ["reportsHub:tax", "taxReport"], labels: { "reportsHub:tax": "الملخّص", taxReport: "تقرير الضرائب" } },
      { key: "branches", label: "تقرير الفروع", views: ["hqReports"] },
    ] },
  { key: "ledgers", title: "الدفاتر والرقابة", icon: FileText, tone: "accounting", place: "menu", leadTab: true,
    actions: [{ label: "الرصيد الافتتاحي وبدء التشغيل", views: ["openingBalance"] }],
    tabs: [
      { key: "tree", label: "الدفاتر", views: ["generalLedger", "trialBalance", "fullStatements:tb"],
        labels: { generalLedger: "الأستاذ العام", trialBalance: "ميزان المراجعة", "fullStatements:tb": "الميزان بعشرة أعمدة" } },
      { key: "statements", label: "القوائم",
        views: ["fullStatements:income", "fullStatements:bs", "fullStatements:equity", "fullStatements:cf", "fullStatements:wf",
          "financials", "fullStatements:notes", "fullStatements:adj", "fullStatements:guide", "ifrs"],
        labels: { "fullStatements:income": "الدخل", "fullStatements:bs": "المركز المالي", "fullStatements:equity": "حقوق الملكية",
          "fullStatements:cf": "التدفق النقدي", "fullStatements:wf": "التدفق الوزني", financials: "الزكاة",
          "fullStatements:notes": "الإيضاحات", "fullStatements:adj": "التسويات", "fullStatements:guide": "دليل الحسابات", ifrs: "IFRS" } },
      { key: "journal", label: "اليومية", views: ["journal", "documents", "queryBuilder", "generalLedger:wages", "docCycle"],
        labels: { journal: "ورقة اليوم", documents: "المستندات", queryBuilder: "تصفية متقدّمة", "generalLedger:wages": "الأجور", docCycle: "الدورة المستندية" } },
      { key: "compliance", label: "الامتثال", views: ["vatReturn", "einvoice", "amlRegister"] },
    ],
    moreLabel: "المراجعة والاعتماد",
    more: [
      { key: "review", label: "المراجعة والاعتماد", views: ["approvals", "accountantReview"], labels: { approvals: "الاعتمادات", accountantReview: "المراجعة" } },
    ] },
  { key: "staff", title: "الموظفون", icon: UserRound, tone: "people", place: "menu",
    tabs: [
      { key: "hr", label: "الموظفون", views: ["attendanceHr"] },
      { key: "payroll", label: "الرواتب", views: ["payroll", "wps"], labels: { payroll: "مسيّر الرواتب", wps: "ملف حماية الأجور" } },
    ] },
  { key: "settings", title: "الإعدادات", icon: Settings, tone: "system", place: "menu",
    tabs: [
      { key: "basics", label: "الإعدادات", views: ["settings", "navCustomize", "glossary"],
        labels: { settings: "الأساسيات", navCustomize: "تخصيص القائمة", glossary: "مسرد المصطلحات" } },
      { key: "security", label: "الأمان والصلاحيات", views: ["access"] },
      { key: "devices", label: "الأجهزة", views: ["printerSetup", "rfidSettings"], labels: { printerSetup: "الطابعة", rfidSettings: "قارئ RFID" } },
      { key: "links", label: "الربط", views: ["integration", "exchange", "storeLink"],
        labels: { integration: "الربط مع الأنظمة", exchange: "التبادل مع الأنظمة", storeLink: "المتجر الإلكتروني" } },
    ],
    moreLabel: "المزيد",
    more: [{ key: "modules", label: "الوحدات والنسخ", views: ["modules", "backup"], labels: { modules: "الوحدات", backup: "النسخ الاحتياطي" } }] },
];

/// الشاشة بلا قسمها: «cash:safe» ← «cash».
const pageOf = (id) => String(id || "").split(":")[0];

/// تبويبات الباب كلها — الأساسية ثم «المزيد».
const hubTabs = (hub) => [...(hub.tabs || []), ...(hub.more || [])];

/// كل شاشات الباب (بلا أقسامها) — للشريط الجانبي و☰.
const hubBasePages = (hub) => [...new Set([...hubTabs(hub), ...(hub.actions || []).filter((a) => a.views)].flatMap((t) => t.views.map(pageOf)))];

/// باب الشاشة وتبويبها — المطابقة التامّة أوّلًا (cash:safe)، ثم الشاشة بلا قسمها.
function hubOf(pageId) {
  for (const hub of BRANCH_HUBS) for (const tab of hubTabs(hub)) if (tab.views.includes(pageId)) return { hub, tab };
  const base = pageOf(pageId);
  for (const hub of BRANCH_HUBS) for (const tab of hubTabs(hub)) if (tab.views.some((v) => pageOf(v) === base)) return { hub, tab };
  return null;
}

/// الباب بما يُفتح منه لمن يجلس: التبويب يسقط إن لم تبقَ فيه شاشة. `allowed` يُسأل عن الشاشة بلا قسمها.
function visibleHub(hub, allowed) {
  const tabs = hubTabs(hub)
    .map((t) => ({ ...t, views: t.views.filter((v) => allowed(pageOf(v))) }))
    .filter((t) => t.views.length);
  return tabs.length ? { ...hub, tabs } : null;
}

const hubPages = () => new Set(BRANCH_HUBS.flatMap(hubBasePages));

/// عناصر ورقة الباب في الرئيسية البسيطة بترتيب المرجع (hubSheetItems): التبويب الأوّل ثم الإجراءات ثم بقية التبويبات ثم «المزيد».
function hubSheetItems(hub) {
  if (hub.sheet) return hub.sheet;
  const tabs = hub.tabs || [];
  const more = hub.more || [];
  return hub.leadTab && tabs.length ? [tabs[0], ...(hub.actions || []), ...tabs.slice(1), ...more] : [...(hub.actions || []), ...tabs, ...more];
}

export { BRANCH_HUBS, hubBasePages, hubOf, hubPages, hubSheetItems, hubTabs, pageOf, visibleHub };
