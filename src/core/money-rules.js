import { Banknote, Clock, Coins, CreditCard } from "lucide-react";

const CARD_NETWORKS = [
  { id: "mada", label: "مدى", defaultFee: 0 },
  { id: "visa", label: "فيزا", defaultFee: 2.5 },
  { id: "mastercard", label: "ماستركارد", defaultFee: 2.5 },
  { id: "amex", label: "أمريكان إكسبرس", defaultFee: 3.5 },
];

const DEFAULT_CARD_FEES = CARD_NETWORKS.reduce((a, n) => ({ ...a, [n.id]: n.defaultFee }), {});

const PAYMENT_METHODS = [
  { id: "cash", label: "نقدًا", icon: Banknote },
  { id: "card", label: "شبكة", icon: CreditCard },
  { id: "credit", label: "آجل", icon: Clock },
  // ── البدل: كسر مقابل جديد ──
  //
  // الزبونة تشتري طقمًا وتُسلّم كسرًا. عمليتان لا واحدة: بيعٌ بكامل
  // قيمته وشراء كسرٍ بكامل قيمته، والفرق وحده يتحرّك نقدًا.
  //
  // ⚠ صافيهما في قيد واحد يُخفي الإيراد ويُخفي الشراء: الضريبة تُحسب
  // على قيمة البيع لا على الفرق، وربح المحل يختفي من التقارير.
  { id: "scrap", label: "بدل بكسر", icon: Coins },
];

/// قيمة الكسر المُستلَم في فاتورة بدل.

const METHODS = ["cash", "network"];

const METHOD_LABELS = { cash: "نقدي", network: "شبكة" };
// Older records may carry legacy ids ("safe", "daily_transfer"); normalize them
// so historical data keeps resolving to a real pool + method.

const REF_PREFIX = {
  supplier: "SUP",
  office: "OFF",
  user: "EMP",
  sale: "INV",
  purchase: "PUR",
  expense: "EXP",
  repair: "REP",
  partner: "PRT",
  taskir: "TSK",
  scrap: "SCR",
  entry: "ENT",
  custody: "CST",
  closure: "FYC",
  customer: "CUS",
  receipt: "RCP",
  safeAudit: "SFA",
  reservation: "RSV",
  businessDay: "DAY",
  scrapReq: "SRQ",
  trust: "TRS",
  ret: "RTN",
  // ── مراجع أُضيفت ──
  adj: "ADJ",            // تعديل وزن — هالك أو فائض
  lot: "LOT",            // دفعة شراء
  transfer: "TRF",       // تحويل بين الصناديق
  settlement: "STL",     // سداد مورد
  officeSettle: "OST",   // سداد عبر مكتب تسكير
  bank: "BNK",           // حركة بنكية
  audit: "AUD",          // جرد
  goldOut: "GLD",        // إخراج ذهب من الخزنة
  breakOp: "BRK",
  journalEntry: "JRN",       // قيد مزدوج        // تكسير فصوص
  // ⚠ بادئتان لا واحدة: صاحب الحساب وحركته شيئان مختلفان، ومرجعٌ
  // واحد لهما يجعل «TRS-014» غامضًا — أهو الحساب أم الحركة؟
  trustHolder: "ACC",
  trustMove: "TRM",
};

// ── مراجع حركة النقد بوسيلتها ──
//
// ⚠ الوسيلة تُقرأ من المرجع لا من حقل داخلي: المحاسب يرى «NET-014»
// فيعرف أنها شبكة قبل أن يفتح السجل، ويطابقها بكشف البنك مباشرة.
//
// وبلا تمييز يصير «CSH-014» و«NET-014» رقمًا واحدًا في عينه، فيبحث
// في الكشف عن حركة نقدية لا وجود لها فيه.

const CASH_REF_PREFIX = {
  cash: "CSH",
  network: "NET",
  card: "NET",
  transfer: "TRF",
  // ⚠ «ADJ» محجوزة لتعديل الوزن. تسوية نقدية بنفس البادئة تجعل
  // المرجعين يبدوان من نوع واحد، ويقود البحث لمستند لا صلة له.
  adjust: "CAJ",
};

/// مرجع حركة نقدية: يحمل وسيلتها في حروفه.

const REF_KIND = Object.fromEntries(
  Object.entries({ ...REF_PREFIX, ...CASH_REF_PREFIX }).map(([k, v]) => [v, k])
);

const DEFAULT_MARGINS = {
  24: { perGram: 0, fixed: 0 },
  22: { perGram: 12, fixed: 0 },
  21: { perGram: 18, fixed: 0 },
  18: { perGram: 25, fixed: 0 },
  14: { perGram: 30, fixed: 0 },
};

const RECON_WINDOW_DAYS = 5;
/// فرق مقبول بالهللات — البنوك تقرّب أحيانًا

const RECON_TOLERANCE = 0.05;

/// ── قراءة كشف الحساب ──
///
/// نقبل CSV بأي ترتيب أعمدة: نتعرّف على الأعمدة بأسمائها عربيةً
/// وإنجليزية. البنوك لا تتفق على ترتيب واحد، وإلزام المستخدم بترتيب
/// معيّن يعني تحرير كل ملف يدويًا قبل رفعه.

const BANK_COLUMN_HINTS = {
  date: ["date", "تاريخ", "التاريخ", "trans date", "value date", "تاريخ العملية"],
  amount: ["amount", "مبلغ", "المبلغ", "credit", "دائن", "قيمة", "value"],
  debit: ["debit", "مدين", "سحب", "منصرف"],
  credit: ["credit", "دائن", "إيداع", "ايداع", "وارد"],
  ref: ["ref", "reference", "مرجع", "المرجع", "رقم العملية", "auth", "authcode", "auth code", "رقم التفويض"],
  desc: ["desc", "description", "بيان", "البيان", "الوصف", "تفاصيل", "narration"],
};

const USD_TO_SAR_PEG = 3.75;

export { BANK_COLUMN_HINTS, CARD_NETWORKS, CASH_REF_PREFIX, DEFAULT_CARD_FEES, DEFAULT_MARGINS, METHODS, METHOD_LABELS, PAYMENT_METHODS, RECON_TOLERANCE, RECON_WINDOW_DAYS, REF_KIND, REF_PREFIX, USD_TO_SAR_PEG };
