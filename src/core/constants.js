import { DEFAULT_CARD_FEES, DEFAULT_MARGINS } from "./money-rules.js";
import { DEFAULT_THEME } from "./theme.js";
import { hashPin } from "../domain/hashPin.js";
import { key } from "../domain/key.js";

const DEFAULT_CATEGORIES = [
  { id: "ring", label: "خاتم", saleMode: "whole" },
  { id: "chain", label: "سلسلة", saleMode: "whole" },
  { id: "bracelet", label: "سوار", saleMode: "whole" },
  { id: "earrings", label: "أقراط", saleMode: "whole" },
  { id: "set", label: "طقم", saleMode: "set", isSet: true },
  // السبائك والعملات تُباع بالوزن عادةً — سبيكة كيلو يُشترى منها جرامات
  { id: "bar", label: "سبيكة", saleMode: "partial", minSaleWeight: 0.5 },
  { id: "coin", label: "عملة", saleMode: "whole" },
  { id: "other", label: "أخرى", saleMode: "whole" },
];

// يُستبدل وقت التشغيل بتصنيفات المستخدم — الثابت للتوافق فقط
// ⚠ حالة متغيّرة على مستوى الوحدة.
//
// أخفاها الملف الواحد وكشفها التفكيك: وحدات ES تمنع إسناد قيمة
// لمستورد، لأن المستورد ارتباطٌ لا نسخة.
//
// وهي عيبٌ لا قيد: متغيّرٌ عامٌّ يُكتب من مكان ويُقرأ من عشرة، فلا
// يُعرف من غيّره ولا متى. الحاوية تُبقيه مركزيًا وتجعل التغيير صريحًا.

const CATEGORY_STATE = { list: DEFAULT_CATEGORIES };

const EXPENSE_CATEGORIES = [
  { id: "rent", label: "الإيجار" },
  // الرواتب والسلف تُربط بموظف بعينه، فيمكن معرفة ما استلمه وما سحبه.
  { id: "salaries", label: "راتب بائع/موظف" },
  { id: "advance", label: "سحبية بائع/موظف" },
  { id: "bills", label: "الفواتير" },
  { id: "government", label: "مصروفات حكومية" },
  { id: "purchases", label: "مشتريات" },
  { id: "other", label: "أخرى" },
];
// Funding sources used by expenses, purchases, supplier settlements and
// partner movements. Both the safe and the daily till carry a cash and a
// network balance, so each is selectable independently.

const ACCOUNT_GROUPS = {
  operating_profit: { label: "أرباح تشغيلية", tone: "in" },
  capital_gain: { label: "أرباح رأسمالية", tone: "in" },
  gold_revenue: { label: "إيرادات الذهب", side: "in" },
  other_revenue: { label: "إيرادات أخرى", side: "in" },
  capital: { label: "رأس المال", side: "in" },
  gold_cogs: { label: "مشتريات وتكلفة الذهب", side: "out" },
  operating: { label: "مصروفات تشغيلية", side: "out" },
  owner: { label: "سحوبات", side: "out" },
  variance: { label: "فروقات الجرد", side: "out" },
  transfer: { label: "تحويلات داخلية", side: "both" },
};

const ACCOUNT_TREE = {
  in: [
    { id: "sales_revenue", label: "إيراد مبيعات", group: "gold_revenue", auto: true },
    { id: "repair_income", label: "إيراد إصلاحات", group: "gold_revenue", auto: true },
    // ── الفصل الجوهري بين نوعَي الربح ──
    // إيراد البيع يُفكَّك: قيمة المعدن (ليست ربحًا — معدن تملكه أصلًا)،
    // والمصنعية والهامش (ربح تشغيلي من عملك)، وفرق سعر المعدن بين
    // الشراء والبيع (ربح رأسمالي من السوق لا من التجارة).
    { id: "gold_metal_value", label: "قيمة المعدن المباع", group: "gold_revenue", auto: true },
    { id: "workmanship_profit", label: "ربح المصنعية والهامش", group: "operating_profit", auto: true },
    { id: "metal_capital_gain", label: "ربح رأسمالي من السعر", group: "capital_gain", auto: true },
    { id: "revaluation_gain", label: "فرق إعادة تقييم المخزون", group: "capital_gain", auto: true },
    { id: "scrap_surplus_income", label: "فائض تصفية كسر", group: "other_revenue", auto: true },
    { id: "gold_weight_surplus", label: "فائض وزن", group: "other_revenue", auto: true },
    { id: "repair_gold_removed", label: "ذهب مُستخرَج بالإصلاح", group: "other_revenue", auto: true },
    { id: "cash_surplus", label: "زيادة بجرد العهدة", group: "variance", auto: true },
    // العربون التزام لا إيراد — يُحوَّل لإيراد عند إتمام البيع فقط.
    { id: "customer_deposit", label: "عربون حجز", group: "other_revenue", auto: true },
    { id: "other_income", label: "إيرادات أخرى", group: "other_revenue" },
    { id: "capital_injection", label: "رأس مال / مساهمة شريك", group: "capital" },
    // التحويلات دائمًا ذات طرفين، فهي من تطبيق النظام لا من اختيار المستخدم.
    { id: "transfer_from_daily", label: "تحويل من صندوق اليومي", group: "transfer", auto: true },
    { id: "transfer_from_safe", label: "تحويل من الخزنة", group: "transfer", auto: true },
    { id: "transfer_from_custody", label: "تحويل من عهدة الكسر", group: "transfer", auto: true },
  ],
  out: [
    // ── مشتريات الذهب: تدخل في تكلفة البضاعة ──────────────────────────
    { id: "gold_purchase_supplier", label: "شراء ذهب من مورد", group: "gold_cogs", auto: true },
    { id: "gold_purchase_scrap", label: "شراء كسر", group: "gold_cogs", auto: true },
    { id: "gold_purchase_bullion", label: "شراء ذهب خام (تسكير)", group: "gold_cogs", auto: true },
    { id: "gold_workmanship", label: "أجور ومصنعية", group: "gold_cogs", auto: true },
    // الهالك تكلفة ذهب فُقد فعليًا في التصنيع أو التداول — يبقى ضمن تكلفة
    // البضاعة لأنه جزء من كلفة الحصول على القطع المباعة.
    { id: "gold_wastage", label: "هالك وزن", group: "gold_cogs", auto: true },
    { id: "repair_gold_added", label: "ذهب مُضاف بالإصلاح", group: "gold_cogs", auto: true },
    // إعدام المصنعية: عند صهر قطعة جاهزة تعود لكسر، يبقى الذهب وتضيع
    // الأجور التي دُفعت لصنعها. خسارة حقيقية تُقيَّد ضمن تكلفة الذهب لا
    // تُهمل — إهمالها يُظهر ربح البيع اللاحق أعلى مما هو.
    { id: "workmanship_writeoff", label: "إعدام مصنعية (تحويل لكسر)", group: "gold_cogs", auto: true },
    { id: "scrap_to_product_wm", label: "مصنعية تصنيع من كسر", group: "gold_cogs", auto: true },
    // المرتجع خصم من الإيراد لا مصروف — وضعه في المصروفات يبقي مبيعات
    // وهمية في الدفاتر ويشوّه الهامش.
    { id: "sales_return", label: "مرتجع مبيعات", group: "gold_revenue", auto: true },
    // ── مصروفات تشغيلية: خارج تكلفة الذهب ─────────────────────────────
    { id: "operating_expense", label: "مصروف تشغيلي", group: "operating", auto: true },
    { id: "non_gold_purchase", label: "مشتريات غير ذهبية", group: "operating", auto: true },
    // عمولة البطاقة مصروف تشغيلي لا خصم من الإيراد: الإيراد كامل والبنك
    // يقتطع رسمه. خصمها من الإيراد يُخفي حجم المبيعات الحقيقي.
    { id: "network_fees", label: "عمولة الشبكة", group: "operating", auto: true },
    { id: "other_expense", label: "مصروف آخر", group: "operating" },
    // ── سحوبات وفروقات ────────────────────────────────────────────────
    { id: "owner_withdrawal", label: "سحب شخصي / سحب شريك", group: "owner" },
    { id: "cash_shortage", label: "عجز بجرد العهدة", group: "variance", auto: true },
    { id: "metal_capital_loss", label: "خسارة رأسمالية من السعر", group: "capital_gain", auto: true },
    { id: "customer_deposit_refund", label: "إرجاع عربون", group: "operating", auto: true },
    // ── تحويلات ───────────────────────────────────────────────────────
    { id: "transfer_to_safe", label: "تحويل إلى الخزنة", group: "transfer", auto: true },
    { id: "transfer_to_daily", label: "تحويل إلى صندوق اليومي", group: "transfer", auto: true },
    { id: "transfer_to_custody", label: "تحويل إلى عهدة الكسر", group: "transfer", auto: true },
  ],
};

// عقد قديمة من إصدارات سابقة. تبقى معرّفة حتى تظل السجلات التاريخية
// مقروءة ومصنّفة بدل أن تظهر بلا تصنيف بعد إعادة ترتيب الشجرة.

const LEGACY_ACCOUNT_NODES = [
  { id: "inventory_purchase", label: "شراء ذهب من مورد", group: "gold_cogs", legacy: true },
  { id: "supplier_settlement", label: "تسوية مورد (تسكير)", group: "gold_cogs", legacy: true },
  { id: "scrap_purchase", label: "شراء كسر", group: "gold_cogs", legacy: true },
];

const ALL_ACCOUNT_NODES = [...ACCOUNT_TREE.in, ...ACCOUNT_TREE.out, ...LEGACY_ACCOUNT_NODES];

// Manual-entry pickers only offer non-auto nodes; the `auto: true` nodes are
// applied by the system itself when it books sales, purchases, settlements etc.

const MANUAL_ACCOUNT_TREE = {
  in: ACCOUNT_TREE.in.filter((a) => !a.auto),
  out: ACCOUNT_TREE.out.filter((a) => !a.auto),
};

const OUNCE_SECRET = "OUNCE-2026-vendor-signing-key-v1";

// Deterministic 32-bit FNV-1a hash, folded with the secret. Not cryptographic —
// it is a tamper-evidence checksum, which is what the client can meaningfully do.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const PUBLISH_CAP = 400;

const DEFAULT_OPENING_BALANCE = {
  date: null,
  dailyCash: 0,
  dailyNetwork: 0,
  safeCash: 0,
  safeNetwork: 0,
  safeGoldRaw: 0,
  safeGoldRawKarat: 21,
  safeGoldCrafted: 0,
  safeGoldCraftedKarat: 21,
  custodyCash: 0,
  custodyNetwork: 0,
  scrapWeight: 0,
  scrapKarat: 21,
  // المخزون الافتتاحي: أسطر متعددة، كل سطر عيار ووزن. الأجور التقريبية
  // اختيارية لأنها تقدير لا رقم موثّق، وإلزامها يدفع لإدخال رقم عشوائي.
  inventoryLines: [], // [{ karat, weight, workmanship }]
  inventoryValue: 0,
  inventoryWeight: 0,
  inventoryKarat: 21,
  partnersCapitalByPartner: {}, // { [partnerId]: grams } — set per-partner, always in 24k grams
  notes: "",
};
// Opening-balance figures must be numbers before they reach any arithmetic:
// a stray string would make "1000" + 500 concatenate to "1000500" instead of
// adding. Applied on load so legacy/partial records are healed too.

// ⚠ إصلاح محلي (ounce-frontend فقط، لا يُنقل لـ ounce-source): كانت
// معرَّفة بعد DEFAULT_SETTINGS رغم استخدامها هنا — "Cannot access
// 'DEFAULT_APP_MODE' before initialization". نُقلت سطرًا واحدًا قبل
// أول استخدام لها، بلا أي تغيير في القيمة أو المنطق.
const DEFAULT_APP_MODE = "full";

const DEFAULT_SETTINGS = {
  taxEnabled: true,
  taxRate: 0.15,
  cardFees: DEFAULT_CARD_FEES,
  marginByKarat: DEFAULT_MARGINS,
  freezeMinutes: 30,
  // ⚠ مطفأ افتراضيًا: الدخول باختيار الاسم فقط. من يفتح الجهاز يفتح
  // التطبيق — يُفعَّل من الإعدادات حين يشارك المحل أكثر من شخص.
  requirePin: false,
  // ⚠ من يفحص الكسر ويعتمد وزنه؟
  //
  // "hq" — الفرع يرسل والإدارة تفحص وتعتمد. الفصل بين من يشتري ومن
  //        يقيّم يمنع تمرير وزن غير مؤكّد.
  // "branch" — الفرع يفعل كل شيء. أسرع، ومناسب للمحل الواحد بلا إدارة.
  scrapAssayMode: "hq",
  // ⚠ مطفأة افتراضيًا: المحل الذي لا يبيع بالشبكة لا يحتاجها، وشاشة
  // إضافية بلا استخدام تزحم القائمة.
  bankReconEnabled: false,
  theme: DEFAULT_THEME,
  appMode: DEFAULT_APP_MODE,
  // ── هوامش السعر العالمي ──
  //
  // السعر العالمي مرجع لا سعر تعامل. المحل يبيع فوقه احتياطًا لارتفاعه
  // بين الشراء والبيع، ويشتري الكسر دونه لتغطية التصفية والفاقد.
  //
  // تثبيتهما هنا يجعل كل شاشة تحسب من الأساس الصحيح تلقائيًا، بدل أن
  // يتذكّر البائع خصم نسبة في رأسه كل مرة.
  priceAdjust: {
    sellMode: "amount",   // amount | percent
    sellValue: 0,         // يُضاف على سعر البيع
    scrapMode: "percent", // amount | percent
    scrapValue: 0,        // يُخصم عند شراء الكسر
  },
};

/// السعر المرجعي للبيع: العالمي + هامش الاحتياط.

const DEFAULT_USERS = [
  { id: "u-emp-1", name: "بائع 1", role: "employee", pin: hashPin("1111", null) },
  { id: "u-ast-1", name: "نائب المدير", role: "assistant", pin: hashPin("2222", null) },
  { id: "u-mgr-1", name: "المدير", role: "manager", pin: hashPin("9999", null) },
];

const ROLES = {
  // ══════════════════════════════════════════════════════════════
  //  مشتري الكسر
  //
  //  ⚠ يشتري ولا يفعل غير ذلك.
  //
  //  من يستلم الكسر ويُقيّمه ويُدخله المخزون هو نفسه لا يُراجعه أحد:
  //  يستلم بوزنٍ ويُدخل بآخر، والفرق يذهب حيث لا يُسأل عنه. فالشراء
  //  وحده له، والتكسير والفحص والإدخال لغيره.
  //
  //  ولا مخزون ولا مبيعات ولا نقد: يده على عهدة الكسر فقط، وكل قطعة
  //  تحمل اسمه.
  // ══════════════════════════════════════════════════════════════
  scrap_buyer: {
    label: "مشتري كسر",
    hint: "يستلم الكسر ويشتريه فقط — لا يُكسّر ولا يُدخل مخزونًا",
    canManageDay: false,
    canBreak: false,
    allowedTabs: [],
    allowedMore: ["scrapIntake"],
    // ⚠ ما لا يُسمح به صراحةً يُمنع، والقائمة أدناه تُقرأ في المعالجات
    // لا في الشاشات وحدها — الشاشة تُخفي الزرّ، وهذه تمنع العملية.
    denyActions: [
      "breakStones", "convertScrap", "sendScrap", "assessScrap",
      "approveScrap", "closeDay", "openDay", "addItem", "sale",
      "expense", "cashMove", "settleSupplier",
    ],
  },
  // ⚠ فتح اليوم وإقفاله صلاحية مُعلَنة لا مُستنتَجة من الدور.
  //
  // اشتراط `role === "manager"` في كل موضع يعني أن منح الصلاحية
  // لموظفٍ بعينه يحتاج تعديل شيفرة. والعَلم هنا يجعلها تُمنح من
  // شاشة الصلاحيات لأي أحد.
  // ══════════════════════════════════════════════════════════════
  //  مسؤول الكسر
  //
  //  ⚠ برقمه السري، وهو **المسؤول عن التكسير وتثبيت الوزن**.
  //
  //  من اشترى لا يُكسّر: المشتري قدّر هامش الفصوص بعينه، فإن كسّر
  //  بنفسه صحّح تقديره ليُوافق ما دفع — والفرق يذهب حيث لا يُسأل عنه.
  //
  //  والمدير لا يُكسّر: مسؤول الكسر يُسلّمه الوزن مُثبَّتًا، والمدير
  //  يودعه الخزنة. ثلاثة أيدٍ لا يدٌ واحدة.
  // ══════════════════════════════════════════════════════════════
  scrap_officer: {
    label: "مسؤول الكسر",
    hint: "يستلم من المشتري ويُكسّر ويُثبّت الوزن — لا يبيع ولا يودع",
    allowedTabs: [],
    allowedMore: ["scrapCustody", "scrap"],
    canManageDay: false,
    canBreak: true,
    denyActions: [
      "sale", "expense", "cashMove", "settleSupplier", "openDay", "closeDay",
      "convertScrap", "addItem", "refund", "issueOut",
    ],
  },
  employee: {
    // ⚠ لا «aiAssistant» في القائمة: الذكاء يُفتح لكل مستخدم على حدة
    // من شاشة الصلاحيات، لا لكل من حمل الدور.
    label: "موظف", allowedTabs: ["sales"], allowedMore: [],
    canManageDay: false,
    denyActions: ["openDay", "closeDay"],
  },
  assistant: {
    canBreak: true,
    label: "نائب المدير", allowedTabs: ["sales", "stocktake"],
    allowedMore: [],
    canManageDay: true,
  },
  manager: {
    label: "المدير",
    canManageDay: true,
    canBreak: true,
    allowedTabs: ["inventory", "sales", "cash", "expenses", "stocktake", "more"],
    allowedMore: ["addGoods", "printing", "printerSetup", "salesHistory", "sellerReports", "price", "reports", "journal", "trialBalance", "search", "bankRecon", "supplierLedger", "officeLedger", "salesReturn", "scrap", "scrapIntake", "scrapCustody", "conversions", "itemEdit", "goldOut", "categories", "workday", "customers", "trustAccounts", "reservations", "safeAudit", "integration", "storeLink", "backup", "purchases", "suppliers", "taskirat", "partners", "access", "taxReport", "settings", "financials", "openingCompare", "repairs", "aiAssistant", "navCustomize", "openingBalance"],
  },
};

// Pages rendered via top-level `tab` state (no "more" wrapper needed) vs pages
// rendered via `morePage` state. This distinction is purely about which piece
// of App state drives the route — every page can still be freely placed in
// either the main bottom bar or the hamburger menu, via navLayout below.

const APP_MODES = {
  full: {
    label: "كامل",
    hint: "بيع وشراء وكسر وصندوق وتقارير مالية",
    icon: "Store",
  },
  inventory: {
    label: "مخزون وجرد فقط",
    hint: "المخزون والتكويد والجرد وإخراج القطع — بلا بيع ولا صندوق",
    icon: "Package",
    // ⚠ القائمة بالسماح لا بالمنع: شاشةٌ تُضاف لاحقًا تُمنع افتراضيًا
    // حتى تُذكر هنا صراحةً. والعكس يُدخلها بلا مراجعة.
    allowTabs: ["inventory", "stocktake", "addGoods"],
    allowPages: [
      "inventory", "stocktake", "addGoods", "itemEdit", "categories",
      "goldOut", "transfers", "search", "backup", "settings", "access",
      "navCustom", "printer", "reprint", "about",
    ],
    // ما يُمنع من الأفعال مهما كان الدور
    denyActions: [
      "sale", "expense", "cashMove", "settleSupplier", "settleOffice",
      "scrapIntake", "breakStones", "openDay", "closeDay", "refund",
    ],
  },
};

/// هل الصفحة مسموحة في الوضع الحالي؟

const MIGRATION_FLAG = "ounce_migrated_v1";

const ATTACH_PREFIX = "ounce_attach_";

const MAX_ATTACH_BYTES = 3.5 * 1024 * 1024; // leave headroom under the per-key cap

const BREAKPOINTS = { sm: 0, md: 600, lg: 1024, xl: 1440 };

/// يقرأ المقاس ويُصنّفه — ويتابع الدوران وتغيير النافذة.

const PARTNER_REQUIRED = new Set([
  "capital_injection",
  "owner_withdrawal",
  "profit_distribution",
]);

const TRUST_MOVES = [
  { id: "deposit_cash", label: "إيداع نقدي", dir: "in", unit: "currency",
    hint: "يزيد رصيده النقدي — التزامٌ عليك" },
  { id: "deposit_gold", label: "إيداع ذهب", dir: "in", unit: "gram",
    hint: "يزيد رصيده الذهبي — ذهبٌ ليس لك" },
  { id: "withdraw_cash", label: "سحب نقدي", dir: "out", unit: "currency",
    hint: "يُنقص رصيده — يخرج من خزنتك" },
  { id: "withdraw_gold", label: "سحب ذهب", dir: "out", unit: "gram",
    hint: "يُنقص رصيده الذهبي — يخرج من خزنتك" },
  // ⚠ التحويل بين رصيدَيه لا بيعٌ ولا شراء بالمعنى المحاسبي:
  // لا نقد يدخل ولا يخرج — رصيدٌ ينتقل من عمودٍ لعمود.
  { id: "buy_gold", label: "يشتري ذهبًا برصيده", dir: "swap", unit: "both",
    hint: "نقده ينقص وذهبه يزيد — بسعر اليوم" },
  { id: "sell_gold", label: "يبيع ذهبه لرصيده", dir: "swap", unit: "both",
    hint: "ذهبه ينقص ونقده يزيد — بسعر اليوم" },
];

const DEFAULT_STORE = {
  enabled: false,
  storeName: "",
  apiKey: "",
  webhookUrl: "",
  // الحجز عند الطلب قبل الدفع: يمنع البيع المزدوج في الفجوة بين
  // الطلب والدفع، وهي الفجوة التي يقع فيها التصادم عادةً.
  holdOnOrder: true,
  holdMinutes: 30,
  autoPublishStock: true,
  lowStockAlert: 1,
};

/// حالة القطعة تجاه المتجر.

const STORE_SAMPLE = {
  store: "المتجر الإلكتروني",
  orderId: "WEB-2026-0417",
  status: "paid",
  placedAt: new Date().toISOString(),
  customerName: "سارة المطيري",
  customerPhone: "0505556666",
  paymentMethod: "card",
  cardNetwork: "mada",
  total: 5000,
  lines: [{ unitCodes: ["A1002"], quantity: 1, unitPrice: 5000 }],
};

// ═══════════════════════════════════════════════════════════════════════
//  الربط مع الأنظمة الخارجية
//
//  برنامج نقاط بيع أو محاسبة آخر يصدر فاتورة، فيرسلها للتطبيق ليخصمها من
//  المخزون ويسجّلها مبيعات وينسبها لبائع.
//
//  ثلاث قواعد تحكم الاستقبال:
//    ١. عدم التكرار: كل فاتورة خارجية بمعرّف فريد. إعادة الإرسال — وهي
//       شائعة عند انقطاع الشبكة — لا تُنشئ فاتورة ثانية.
//    ٢. التحقق قبل الكتابة: القطع موجودة ومتاحة والبائع معروف. الفشل
//       يرفض الفاتورة كاملة ولا يكتب نصفها.
//    ٣. أثر كامل: تُوسم الفاتورة بمصدرها ومعرّفها الخارجي، فيمكن مطابقتها
//       بالنظام الآخر عند أي خلاف.
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_INTEGRATION = {
  enabled: false,
  systemName: "",
  apiKey: "",
  endpoint: "",
  // مطابقة القطع: بالرقاقة أو بكود الصنف الخارجي
  matchBy: "unitCode", // unitCode | sku
  // البائع الافتراضي حين لا يرسله النظام الخارجي
  defaultSellerId: null,
  autoDeductStock: true,
  requireKnownItems: true,
};

/// نتيجة استقبال فاتورة خارجية — تُعاد للنظام المرسِل وتُحفظ في السجل.

const EXT_SAMPLE = {
  system: "نظام نقاط البيع",
  externalId: "POS-2026-00184",
  issuedAt: new Date().toISOString(),
  sellerRef: "EMP-001",
  customerPhone: "0501112222",
  paymentMethod: "cash",
  taxApplicable: false,
  taxAmount: 0,
  total: 5000,
  lines: [{ unitCodes: ["A1001"], quantity: 1, unitPrice: 5000 }],
};

// ============================================================
//  النسخة التجريبية — بيانات محل كاملة بحسابات متوازنة
//
//  الغرض: أساس ثابت للاختبار يمكن الرجوع إليه في أي وقت. كل قيد له
//  طرفاه، وكل وزن له مصدره ووجهته، والأرصدة الناتجة تطابق مجموع القيود
//  بالضبط — تحقق منها اختبار مستقل قبل كتابتها هنا.
// ============================================================

const DEMO_VERSION = 1;

const DEFAULT_PRINTER = {
  mode: "system",            // system | bluetooth
  deviceId: null,
  deviceName: null,
  labelWidthMm: 50,
  labelHeightMm: 30,
  copies: 1,
  density: 8,               // 0-15 على طابعات الملصقات
  showLogo: true,
  showPrice: false,         // ⚠ السعر على الرقاقة يُلزمك به أمام العميل
  showKarat: true,
  showWeight: true,
  autoCut: true,
};

// ⚠ موضع السجل مقصود: يجب أن يلي **كل** تعريفات المفاتيح والافتراضيات.
// وضعه قبلها يُسقط التطبيق بـ«Cannot access before initialization» — لأن
// `const` في منطقة موت زمني قبل سطر تعريفه، ولا ينفع أن يكون التنفيذ
// لاحقًا: الجدول يُبنى لحظة تحميل الوحدة.
// ═══════════════════════════════════════════════════════════════════════
//  سجل المخازن — مصدر واحد لكل ما يُحفظ
//
//  كان التحميل مصفوفةً من 49 نداءً تُفكَّك إلى 49 متغيّرًا **بالترتيب
//  الموضعي**. إضافة مفتاح في موضع وإغفال متغيّره يزيح كل ما بعده، فتُقرأ
//  المبيعات في مكان المصروفات — وهي أعطال لا تظهر إلا بعد الاستخدام.
//
//  هنا يصير كل مخزن سطرًا واحدًا يحمل: مفتاحه، وقيمته الافتراضية، ودالة
//  تنظيفه إن لزمت. والتحميل والحفظ يمرّان بالسجل فلا موضع يُزاح.
//
//  الفائدة العملية: إضافة مخزن جديد سطر واحد هنا، بدل أربعة مواضع
//  متفرّقة يسهل نسيان أحدها.
// ═══════════════════════════════════════════════════════════════════════

/// كل مخزن: المفتاح · الافتراضي · منظّف اختياري.
///
/// `clean` تُستدعى على القيمة المقروءة قبل وضعها في الحالة — نستخدمها
/// للترحيل والتصفية بدل نثرها في دالة التحميل.

const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // ESC/POS الشائعة
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

const ISSUE_REASONS = [
  { id: "returned_supplier", label: "إعادة للمورد", account: "1320",
    hint: "تعود لحساب المورد — يُخصم من دَينك" },
  { id: "damaged", label: "تلف", account: "5310",
    hint: "خسارة تُحمَّل على الشهر" },
  { id: "lost", label: "فقد", account: "5310",
    hint: "خسارة — والفرق يظهر في الجرد" },
  { id: "gift", label: "هدية أو عيّنة", account: "6900",
    hint: "مصروف تسويقي" },
  { id: "melted", label: "تحويل لكسر", account: "1230",
    hint: "تعود خامًا لحساب الكسر" },
  { id: "branch", label: "تحويل لفرع آخر", account: "1350",
    hint: "تنتقل لا تخرج — تبقى في ملكك" },
  { id: "correction", label: "تصحيح إدخال خاطئ", account: "5310",
    hint: "القطعة لم تكن موجودة أصلًا" },
];

export { ACCOUNT_GROUPS, ACCOUNT_TREE, ALL_ACCOUNT_NODES, APP_MODES, ATTACH_PREFIX, B32, BREAKPOINTS, CATEGORY_STATE, DEFAULT_APP_MODE, DEFAULT_CATEGORIES, DEFAULT_INTEGRATION, DEFAULT_OPENING_BALANCE, DEFAULT_PRINTER, DEFAULT_SETTINGS, DEFAULT_STORE, DEFAULT_USERS, DEMO_VERSION, EXPENSE_CATEGORIES, EXT_SAMPLE, ISSUE_REASONS, LEGACY_ACCOUNT_NODES, MANUAL_ACCOUNT_TREE, MAX_ATTACH_BYTES, MIGRATION_FLAG, OUNCE_SECRET, PARTNER_REQUIRED, PRINTER_SERVICES, PUBLISH_CAP, ROLES, STORE_SAMPLE, TRUST_MOVES };
