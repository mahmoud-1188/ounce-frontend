const COMMISSION_BASES = [
  { id: "profit", label: "نسبة من الأرباح" },
  { id: "sales", label: "نسبة من المبيعات" },
];

const DEFAULT_COMMISSION = { basis: "profit", rate: 0, target: 0, perInvoice: 0 };

/// يفكّك ربح الفاتورة إلى رأسمالي وتشغيلي.
///
///   قيمة المعدن وقت الشراء = وزن × نقاء × سعر الشراء
///   قيمة المعدن وقت البيع  = وزن × نقاء × سعر البيع
///   ربح رأسمالي            = الفرق بينهما   ← من السوق لا من عملك
///   ربح تشغيلي             = ما حصّلته فوق قيمة المعدن − المصنعية المدفوعة
///
/// الفصل يجيب سؤالًا لا يجيبه الربح الإجمالي: هل ربحت لأنك تاجر ماهر أم
/// لأن الذهب ارتفع؟ الأول يتكرر والثاني لا يُعتمد عليه.

const PERIODS = [
  { id: "today", label: "اليوم" },
  { id: "month", label: "الشهر" },
  { id: "all", label: "الكل" },
];

const AUDIT_EVENTS = {
  // الدخول والخروج
  login: { label: "دخول", risk: "low" },
  logout: { label: "خروج", risk: "low" },
  login_failed: { label: "محاولة دخول فاشلة", risk: "high" },
  // البيانات
  create: { label: "إنشاء", risk: "normal" },
  update: { label: "تعديل", risk: "high" },
  delete: { label: "حذف", risk: "high" },
  // المال
  post: { label: "ترحيل قيد", risk: "normal" },
  reverse: { label: "قيد عكسي", risk: "high" },
  refund: { label: "ردّ مبلغ", risk: "high" },
  // الإعدادات والصلاحيات
  settings: { label: "تغيير إعداد", risk: "high" },
  permission: { label: "تغيير صلاحية", risk: "high" },
  // الأيام والإقفال
  day_open: { label: "فتح يوم", risk: "normal" },
  day_close: { label: "إقفال يوم", risk: "normal" },
  period_close: { label: "إقفال فترة", risk: "high" },
  // الاعتماد
  approve: { label: "اعتماد", risk: "high" },
  reject: { label: "رفض", risk: "high" },
  // النسخ
  backup: { label: "نسخة احتياطية", risk: "normal" },
  restore: { label: "استعادة نسخة", risk: "high" },
  reset: { label: "تصفير", risk: "high" },
};

/// بصمة مختصرة — لا تحتاج تشفيرًا قويًا، تحتاج كشف العبث.
///
/// ⚠ لا نستخدم `crypto.subtle`: غير متاح في كل السياقات وغير متزامن،
/// والسلسلة تُبنى مع كل كتابة فلا تحتمل الانتظار.

const ASSET_CLASSES = [
  { id: "furniture", label: "أثاث وتجهيزات", account: "1410", years: 10, salvagePct: 5 },
  { id: "display", label: "فاترينات وخزائن عرض", account: "1420", years: 8, salvagePct: 5 },
  { id: "safe", label: "خزنة حديدية", account: "1430", years: 15, salvagePct: 10 },
  { id: "devices", label: "أجهزة وموازين", account: "1440", years: 5, salvagePct: 0 },
  { id: "vehicle", label: "سيارات", account: "1450", years: 6, salvagePct: 15 },
  { id: "leasehold", label: "تحسينات على مأجور", account: "1460", years: 5, salvagePct: 0 },
];

const DEPRECIATION_METHODS = [
  { id: "straight", label: "القسط الثابت", hint: "مبلغ متساوٍ كل شهر — الأشيع" },
  { id: "declining", label: "القسط المتناقص", hint: "أكبر أولًا — للأجهزة سريعة التقادم" },
];

/// القسط الشهري.
///
/// ⚠ القيمة القابلة للإهلاك = التكلفة ناقص الخردة، لا التكلفة كاملة.
/// إهلاك الكل يعني أصلًا بقيمة صفر وهو ما زال يُباع بشيء.

const GOSI_RATES = {
  saudi: {
    label: "سعودي",
    employee: 0.0975,   // معاش 9% + ساند 0.75%
    employer: 0.1175,   // معاش 9% + ساند 0.75% + أخطار 2%
    hint: "معاش وساند وأخطار مهنية",
  },
  expat: {
    label: "غير سعودي",
    employee: 0,
    employer: 0.02,     // أخطار مهنية فقط
    hint: "أخطار مهنية على المنشأة وحدها",
  },
};

/// الحدّ الأقصى الخاضع للتأمينات — ما فوقه لا يُحتسب.

const GOSI_CEILING = 45000;

const LEAVE_TYPES = [
  { id: "annual", label: "سنوية", paid: true, days: 21 },
  { id: "sick", label: "مرضية", paid: true, days: 30 },
  { id: "unpaid", label: "بلا راتب", paid: false, days: 0 },
  { id: "emergency", label: "اضطرارية", paid: true, days: 5 },
];

/// أجزاء الراتب.
///
/// ⚠ التأمينات على الأساسي والسكن فقط لا على الكل: احتسابها على
/// الإجمالي يُحمّل المنشأة أكثر مما تدين به.

const APPROVAL_RULES = [
  { id: "expense", label: "مصروف", threshold: 2000, approver: "manager",
    hint: "ما فوق الحدّ يحتاج اعتماد المدير" },
  { id: "asset_purchase", label: "شراء أصل ثابت", threshold: 0, approver: "manager",
    hint: "كل شراء أصل يُعتمد مهما صغر" },
  { id: "asset_disposal", label: "استبعاد أصل", threshold: 0, approver: "manager",
    hint: "الاستبعاد يُعتمد دائمًا" },
  { id: "payroll_run", label: "مسيّر رواتب", threshold: 0, approver: "manager",
    hint: "المسيّر يُعتمد قبل الترحيل" },
  { id: "price_change", label: "تغيير هامش السعر", threshold: 0, approver: "manager",
    hint: "الهوامش تمسّ كل بيعة" },
  { id: "journal_reverse", label: "قيد عكسي", threshold: 0, approver: "manager",
    hint: "إلغاء قيد مُرحَّل يُعتمد" },
  { id: "period_close", label: "إقفال فترة", threshold: 0, approver: "manager",
    hint: "الإقفال يمنع التعديل — لا رجعة بلا فتح" },
  { id: "supplier_settle", label: "سداد مورد", threshold: 10000, approver: "manager",
    hint: "السداد الكبير يُعتمد" },
  { id: "refund", label: "ردّ مبلغ", threshold: 1000, approver: "manager",
    hint: "الردّ الكبير يُعتمد" },
];

const APPROVAL_STATUS = {
  pending: { label: "بانتظار الاعتماد", color: "var(--accent)" },
  approved: { label: "معتمد", color: "var(--good)" },
  rejected: { label: "مرفوض", color: "var(--bad)" },
  executed: { label: "نُفِّذ", color: "var(--text2)" },
  cancelled: { label: "ملغى", color: "var(--text3)" },
};

/// هل تحتاج العملية اعتمادًا؟

const WEBHOOK_EVENTS = [
  { id: "sale.created", label: "فاتورة جديدة" },
  { id: "sale.returned", label: "مرتجع" },
  { id: "purchase.created", label: "شراء" },
  { id: "day.closed", label: "إقفال يوم" },
  { id: "period.closed", label: "إقفال شهر" },
  { id: "approval.pending", label: "طلب اعتماد" },
  { id: "stock.low", label: "مخزون منخفض" },
];

/// حزمة القراءة — ما تُخرجه الواجهة.

const REPORT_PERIODS = [
  // «يوم العمل» يسبق «اليوم» عمدًا: هو الأصحّ لمحل يُقفل بعد منتصف الليل.
  { id: "businessDay", label: "يوم العمل" },
  { id: "today", label: "اليوم" },
  { id: "yesterday", label: "أمس" },
  { id: "week", label: "هذا الأسبوع" },
  { id: "month", label: "هذا الشهر" },
  { id: "custom", label: "مخصص" },
];

export { APPROVAL_RULES, APPROVAL_STATUS, ASSET_CLASSES, AUDIT_EVENTS, COMMISSION_BASES, DEFAULT_COMMISSION, DEPRECIATION_METHODS, GOSI_CEILING, GOSI_RATES, LEAVE_TYPES, PERIODS, REPORT_PERIODS, WEBHOOK_EVENTS };
