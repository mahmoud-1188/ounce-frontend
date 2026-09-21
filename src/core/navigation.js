import { ArrowLeftRight, Barcode, BarChart3, BookmarkCheck, Building2, CalendarCheck, ClipboardCheck, ClipboardList, Coins, Database, FileMinus, FileText, Flame, Grid, Handshake, Landmark, LayoutGrid, Lock, PiggyBank, Plus, Printer, Receipt, RefreshCw, RotateCcw, Scale, Search, Send, Settings, ShieldCheck, ShoppingCart, Sparkles, Sun, Truck, UserRound, Users, Wallet, Warehouse, Wrench } from "lucide-react";
import { ROLES } from "./constants.js";

const TAB_KIND_IDS = ["inventory", "sales", "cash", "expenses", "stocktake"];

// Master registry of every navigable page in the app, used to build both the
// main bottom bar and the hamburger menu grid. Access is still governed by
// ROLES (allowedTabs/allowedMore) — this registry only supplies label/icon.
// الصفحات التي يمكن أن تظهر في الشريط السفلي الأساسي.

const MAIN_TAB_IDS = ["inventory", "sales", "cash", "expenses", "stocktake"];

const NAV_REGISTRY = [
  { id: "inventory", label: "المخزون", icon: Warehouse },
  { id: "sales", label: "المبيعات", icon: Receipt },
  { id: "cash", label: "النقد", icon: Wallet },
  { id: "expenses", label: "المصروفات", icon: FileMinus },
  { id: "stocktake", label: "الجرد", icon: ClipboardCheck },
  { id: "addGoods", label: "التكويد", icon: Plus },
  { id: "printing", label: "إعادة الطباعة", icon: Printer },
  { id: "printerSetup", label: "إعدادات الطابعة", icon: Printer },
  { id: "rfidReader", label: "قارئ RFID", icon: Barcode },
  { id: "rfidSettings", label: "إعدادات القارئ", icon: Barcode },
  { id: "salesHistory", label: "سجل المبيعات", icon: Receipt },
  { id: "sellerReports", label: "تقارير البائعين", icon: Users },
  { id: "price", label: "السعر اليومي", icon: Coins },
  { id: "reports", label: "التقارير", icon: BarChart3 },
  { id: "scrap", label: "سجل الكسر", icon: Flame },
  { id: "journal", label: "اليومية", icon: ClipboardCheck },
  { id: "trialBalance", label: "ميزان المراجعة", icon: Scale },
  { id: "bankRecon", label: "مطابقة البنك", icon: Landmark },
  { id: "supplierLedger", label: "تقارير المشتريات", icon: Truck },
  { id: "officeLedger", label: "مكاتب التسكير", icon: Building2 },
  { id: "salesReturn", label: "استرجاع مبيعات", icon: RotateCcw },
  { id: "search", label: "البحث الشامل", icon: Search },
  { id: "workday", label: "يوم العمل", icon: Sun },
  { id: "scrapIntake", label: "استلام الكسر", icon: Coins },
  { id: "scrapCustody", label: "عهدة الكسر", icon: Send },
  { id: "itemEdit", label: "تعديل القطع", icon: Wrench },
  { id: "categories", label: "التصنيفات", icon: Grid },
  { id: "conversions", label: "التحويلات", icon: ArrowLeftRight },
  { id: "integration", label: "الربط مع الأنظمة", icon: ArrowLeftRight },
  { id: "storeLink", label: "المتجر الإلكتروني", icon: ShoppingCart },
  { id: "backup", label: "النسخ الاحتياطي", icon: Database },
  { id: "purchases", label: "المشتريات", icon: ShoppingCart },
  { id: "trustAccounts", label: "الحسابات الجارية", icon: Landmark },
  { id: "customers", label: "العملاء", icon: UserRound },
  { id: "reservations", label: "الحجوزات", icon: BookmarkCheck },
  { id: "safeAudit", label: "جرد الخزنة", icon: ShieldCheck },
  { id: "suppliers", label: "الموردين", icon: Truck },
  { id: "taskirat", label: "تسكيرات", icon: Handshake },
  { id: "partners", label: "حسابات الشركاء", icon: Users },
  { id: "access", label: "صلاحيات الوصول", icon: Lock },
  { id: "taxReport", label: "تقرير الضرائب", icon: FileText },
  { id: "settings", label: "الإعدادات", icon: ShieldCheck },
  { id: "openingCompare", label: "مقارنة بالافتتاحي", icon: BarChart3 },
  { id: "financials", label: "القوائم المالية والزكاة", icon: BarChart3 },
  { id: "repairs", label: "إصلاحات", icon: Wrench },
  { id: "aiAssistant", label: "أوقية", icon: Sparkles },
  { id: "navCustomize", label: "تخصيص القائمة", icon: LayoutGrid },
  { id: "openingBalance", label: "الرصيد الافتتاحي", icon: PiggyBank },
  { id: "fixedAssets", label: "الأصول الثابتة", icon: Landmark },
  { id: "payroll", label: "الرواتب", icon: Users },
  { id: "attendanceHr", label: "الحضور والإجازات", icon: CalendarCheck },
  { id: "hqReports", label: "تقرير الفروع", icon: Building2 },
  { id: "hqDocs", label: "معاملات الإدارة", icon: ClipboardList },
  { id: "priceFix", label: "التثبيت ذهب ↔ نقد", icon: ArrowLeftRight },
  { id: "generalLedger", label: "الأستاذ العام", icon: FileText },
  { id: "masterReport", label: "التقارير الموحّدة", icon: LayoutGrid },
  { id: "anyStatement", label: "كشف حساب — أي شيء", icon: Search },
  { id: "fullStatements", label: "القوائم المالية الكاملة", icon: FileText },
  { id: "exchange", label: "التبادل مع الأنظمة", icon: RefreshCw },
  { id: "customerReport", label: "تقرير العملاء", icon: Users },
  { id: "docCycle", label: "الدورة المستندية", icon: ClipboardCheck },
];

// Default arrangement: which of a role's permitted pages start out in the
// main bottom bar. Anything permitted but not listed here starts in the menu.
// The manager can rearrange all of this from "تخصيص القائمة".
// ═══════════════════════════════════════════════════════════════
//  ترتيب التنقّل — صفّان
//
//  الصف الأول ظاهر دائمًا، والثاني يُسحب لأعلى. خمسة أزرار لا تكفي
//  محلًا يستخدم عشرًا يوميًا، وعشرة في صف واحد تصير أصغر من أن تُلمس.
//
//  الشكل القديم كان مصفوفة واحدة — نقبله ونحوّله فلا يضيع ترتيبك.
// ═══════════════════════════════════════════════════════════════

const DEFAULT_NAV_LAYOUT = {
  employee: { row1: ["sales", "grp_money"], row2: ["grp_clients"] },
  assistant: { row1: ["sales", "grp_money", "stocktake"], row2: ["grp_reports", "grp_clients"] },
  manager: {
    row1: ["inventory", "sales", "grp_money", "stocktake", "addGoods"],
    row2: ["grp_reports", "grp_clients", "grp_purchase", "grp_scrap_all"],
  },
};

const NAV_ROWS = ["row1", "row2"];

/// ينظّف ترتيبًا محفوظًا: يُسقط المعرّفات الميتة ويرحّل الشكل القديم.
/// استُخرجت من دالة التحميل لتُستدعى من سجل المخازن.

const NAV_BUNDLES = [
  {
    // ⚠ ثلاث أيقونات لشيء واحد تُشتّت: الموظف لا يعرف أيّها يفتح،
    // فيفتحها كلها حتى يجد ما يريد. والمجمّع يجعلها مرحلةً بعد مرحلة.
    id: "grp_scrap_all",
    label: "الكسر",
    icon: Flame,
    hint: "الاستلام والعهدة والسجل",
    items: ["scrapIntake", "scrapCustody", "scrap"],
  },
  {
    id: "grp_money",
    label: "النقد",
    icon: Wallet,
    hint: "الصندوق اليومي والخزنة والمصروفات",
    items: ["cash", "expenses"],
  },
  {
    id: "grp_reports",
    label: "التقارير",
    icon: BarChart3,
    hint: "كل التقارير واليومية",
    items: ["reports", "journal", "generalLedger", "salesReturn", "trialBalance", "fullStatements", "anyStatement", "masterReport", "supplierLedger", "officeLedger", "salesReturn", "bankRecon", "search",
            "inventory", "salesHistory", "sellerReports", "taxReport", "financials", "openingCompare"],
  },
  {
    id: "grp_clients",
    label: "خدمة العملاء",
    icon: UserRound,
    hint: "العملاء والأمانات والإصلاحات",
    items: ["customers", "trustAccounts", "repairs", "reservations"],
  },
  {
    id: "grp_purchase",
    label: "أوامر الشراء",
    icon: Truck,
    hint: "الموردين والكسر والتسكيرات",
    // ⚠ صفحات الكسر كانت في القائمة الجانبية وحدها — ثلاث خطوات
    // للوصول لعهدة الكسر وهي عمل يومي. ضمّها هنا يجعلها ضغطتين.
    items: ["purchases", "suppliers", "taskirat", "supplierLedger"],
  },
];

// ⚠ لا عنصر مكرر داخل مجمّع: التكرار يعرض السطر مرتين فيظن المستخدم
// أن أحدهما مختلف. نُصفّي عند القراءة فلا يظهر مهما أخطأ الجدول.
NAV_BUNDLES.forEach((b) => {
  b.items = [...new Set(b.items)];
});

const AI_PAGES = ["aiAssistant"];

/// هل يُسمح لهذا الدور بالمساعد أصلًا؟
/// من يُسمح له بأدوات الذكاء.
///
/// ⚠ المدير حصرًا — ومن يُفتح له صراحةً من شاشة الصلاحيات.
///
/// المساعد يقرأ ويُلخّص ويُجيب بلغةٍ حرّة، وحدُّ ما يراه هو `aiScope`.
/// وسؤالٌ واحد قد يجمع ما تفرّق في عشر شاشات، فيصير أداةً تُعطي
/// صورةً كاملة لمن أُعطي أجزاءها.
///
/// فالأصل المنع، والفتح قرارٌ يتّخذه المدير لموظفٍ بعينه ويُسجَّل.

const KIND_TO_PAGE = {
  sale: "sales", purchase: "purchases", item: "inventory", scrap: "scrap",
  scrapReq: "scrapCustody", cash: "cash", gold: "trialBalance", supplier: "suppliers",
  customer: "customers", expense: "expenses", receipt: "customers", repair: "repairs",
  trust: "trustAccounts", adjust: "inventory", day: "workday", audit: "stocktake",
  taskir: "taskirat", partner: "partners", user: "access",
};

/// يُصفّي الفهرس على ما تسمح به الصلاحية.
// ── فهم طلب الاختصار ──
//
// «سوّ لي زر للتقارير» أو «أبغى أوصل عهدة الكسر بسرعة».
//
// المطابقة محلية لا عبر الشبكة: الشبكة قد تنقطع، والمطابقة على أسماء
// الصفحات دقيقة وفورية. ولا تُقترح صفحة خارج صلاحيتك.

const SHORTCUT_HINTS = {
  reports: ["تقرير", "تقارير", "ارباح", "أرباح", "ربح"],
  journal: ["يومية", "اليومية", "دفتر"],
  trialBalance: ["ميزان", "مراجعة", "مراجعه"],
  search: ["بحث", "ابحث", "تتبع", "تتبّع"],
  inventory: ["مخزون", "بضاعة", "بضاعه", "اصناف", "أصناف"],
  sales: ["بيع", "مبيعات", "فاتورة", "فاتوره"],
  cash: ["صندوق", "خزنة", "خزنه", "نقد", "نقدي"],
  expenses: ["مصروف", "مصاريف", "مصروفات"],
  stocktake: ["جرد"],
  addGoods: ["تكويد", "ادخال", "إدخال"],
  categories: ["تصنيف", "تصنيفات", "انواع", "أنواع"],
  suppliers: ["مورد", "موردين", "الموردين"],
  purchases: ["شراء", "مشتريات", "دفعة", "دفعه"],
  taskirat: ["تسكير", "تسكيرات", "مكتب", "مكاتب"],
  scrapIntake: ["استلام كسر", "شراء كسر", "استلام"],
  scrapCustody: ["عهدة الكسر", "عهده", "فحص", "تقييم"],
  scrap: ["كسر", "الكسر"],
  customers: ["عميل", "عملاء", "زبون", "زبائن"],
  trustAccounts: ["امانة", "أمانة", "امانات", "حساب جاري", "حسابات جارية", "أمانات"],
  repairs: ["اصلاح", "إصلاح", "اصلاحات", "تصليح"],
  reservations: ["حجز", "حجوزات", "عربون"],
  partners: ["شريك", "شركاء"],
  safeAudit: ["جرد الخزنة", "جرد خزنة"],
  openingBalance: ["افتتاحي", "رصيد افتتاحي", "بداية"],
  price: ["سعر", "اسعار", "أسعار"],
  settings: ["اعدادات", "إعدادات", "ضبط"],
  access: ["صلاحيات", "صلاحية", "مستخدمين"],
  workday: ["يوم عمل", "فتح اليوم", "اقفال"],
  backup: ["نسخة", "نسخه", "احتياطي", "باك"],
  printing: ["طباعة", "طباعه", "رقاقة"],
  printerSetup: ["طابعة", "طابعه", "بلوتوث"],
  rfidReader: ["قارئ", "قارئ RFID", "بطاقة", "بطاقات", "NHR", "جرد بلوتوث"],
  rfidSettings: ["اعدادات القارئ", "إعدادات القارئ", "طاقة القارئ"],
  navCustomize: ["تخصيص", "ترتيب الازرار", "ترتيب الأزرار"],
  conversions: ["تحويل", "تحويلات", "صهر", "تصنيع"],
  sellerReports: ["بائع", "بائعين", "اداء", "أداء"],
  salesHistory: ["سجل المبيعات", "سجل البيع"],
  taxReport: ["ضريبة", "ضرايب", "ضرائب"],
  financials: ["قوائم", "قائمة الدخل", "ميزانية"],
  storeLink: ["متجر", "اونلاين", "أونلاين"],
  integration: ["ربط", "تكامل", "نظام محاسبي"],
  itemEdit: ["تعديل قطعة", "تعديل القطع"],
  fixedAssets: ["اصول", "أصول", "اصول ثابتة", "أصول ثابتة", "اثاث", "أثاث", "اهلاك", "إهلاك"],
  payroll: ["رواتب", "راتب", "تأمينات", "عمولة", "عمولات", "نهاية خدمة", "مسير رواتب"],
  attendanceHr: ["حضور", "غياب", "اجازة", "إجازة", "اجازات", "إجازات", "بصمة"],
  hqReports: ["فروع", "الفروع", "ادارة", "إدارة", "تقرير الفروع", "hq"],
  priceFix: ["تثبيت", "تسبيك", "ذهب نقد", "تحويل ذهب"],
  generalLedger: ["استاذ", "أستاذ", "الاستاذ العام", "الأستاذ العام"],
  masterReport: ["تقرير موحد", "تقارير موحدة", "تقرير شامل"],
  anyStatement: ["كشف حساب", "كشف", "اي شخص", "أي شخص"],
  fullStatements: ["قوائم مالية كاملة", "قوائم كاملة", "الميزانية العمومية"],
  exchange: ["تبادل", "استيراد", "تصدير", "ربط أنظمة"],
  customerReport: ["تقرير عملاء", "تقرير العملاء", "كشف عملاء"],
  docCycle: ["دورة مستندية", "الدورة المستندية", "مبادئ محاسبية"],
};

/// يُعيد أفضل صفحة تطابق الطلب، أو null. لا يقترح ما هو خارج الصلاحية.

const NAV_MAX_PER_ROW = 5;

const MENU_GROUPS = [
  {
    id: "reports",
    label: "التقارير",
    hint: "كل التقارير والقوائم",
    icon: BarChart3,
    items: ["reports", "journal", "generalLedger", "trialBalance", "fullStatements", "anyStatement", "masterReport", "customerReport", "docCycle", "search", "bankRecon", "supplierLedger", "officeLedger", "salesReturn", "sellerReports", "salesHistory", "taxReport", "financials"],
  },
  {
    id: "inventory",
    label: "المخزون والتكويد",
    hint: "التكويد · الطباعة · التحويلات",
    icon: Warehouse,
    items: ["addGoods", "categories", "printing", "printerSetup", "rfidReader", "rfidSettings", "itemEdit", "conversions"],
  },
  {
    id: "purchasing",
    label: "الشراء والموردين",
    hint: "المشتريات · الموردين · الكسر",
    icon: Truck,
    items: ["purchases", "suppliers", "taskirat", "scrapIntake", "scrapCustody", "scrap"],
  },
  {
    id: "customers",
    label: "العملاء",
    hint: "الحجوزات · الأمانة · الإصلاحات",
    icon: UserRound,
    items: ["customers", "reservations", "trustGold", "repairs"],
  },
  {
    id: "money",
    label: "المال والشركاء",
    hint: "الخزنة · الشركاء · السعر",
    icon: Wallet,
    items: ["safeAudit", "partners", "openingBalance", "price", "fixedAssets", "payroll", "attendanceHr", "hqReports", "priceFix"],
  },
  {
    id: "links",
    label: "الربط",
    hint: "الأنظمة المحاسبية والمتجر",
    icon: ArrowLeftRight,
    items: ["integration", "storeLink", "exchange"],
  },
  {
    id: "system",
    label: "النظام",
    hint: "الإعدادات · الصلاحيات · النسخ",
    icon: Settings,
    items: ["workday", "settings", "access", "navCustomize", "backup"],
  },
];

export { AI_PAGES, DEFAULT_NAV_LAYOUT, KIND_TO_PAGE, MAIN_TAB_IDS, MENU_GROUPS, NAV_BUNDLES, NAV_MAX_PER_ROW, NAV_REGISTRY, NAV_ROWS, SHORTCUT_HINTS, TAB_KIND_IDS };
