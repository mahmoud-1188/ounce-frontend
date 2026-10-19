/// باقة المحل (migration 070 في الخادم): «بدون محاسبة» تُخفي هذه الشاشات — القائمة نفسها في الخادم (domain/storePackage.js)
const ACCOUNTING_PAGES = [
  "journal", "generalLedger", "trialBalance", "fullStatements", "financials", "ifrs", "combinedBook",
  "anyStatement", "queryBuilder", "docCycle", "accountantReview", "aiAccountant",
  "supplierLedger", "officeLedger", "bankRecon", "fixedAssets", "budgets",
];

/// المحاسبة البسيطة (من الإعدادات): ما يحتاجه صاحب المحل وحده — المبيعات والمخزون والموردون والمصروفات والكسر والضريبة والزكاة —
/// وتُخفى الدفاتر التفصيلية. الشاشات تُخفى فقط والدفاتر تبقى تُقيَّد كما هي، فالعودة إلى «مفصّلة» تُظهر كل شيء.
const ACCOUNTING_MODES = {
  detailed: { label: "مفصّلة", hint: "الدفاتر كاملة: اليومية والأستاذ وميزان المراجعة والقوائم المالية والمعايير الدولية ومراجعة المحاسب" },
  simple: { label: "بسيطة", hint: "ما يحتاجه صاحب المحل: المبيعات والمخزون والموردون والمصروفات والكسر والضريبة والزكاة" },
};
const SIMPLE_ACCOUNTING_HIDDEN = [
  "journal", "generalLedger", "trialBalance", "bankRecon", "bankFees", "fullStatements", "combinedBook", "ifrs",
  "accountantReview", "aiAccountant", "budgets", "docCycle", "openingCompare", "queryBuilder", "partners", "fixedAssets", "masterReport",
];

export { ACCOUNTING_MODES, ACCOUNTING_PAGES, SIMPLE_ACCOUNTING_HIDDEN };
