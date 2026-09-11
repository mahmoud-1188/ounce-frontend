const GOLD_OUT_DESTINATIONS = {
  crafted: [
    { id: "display", label: "للعرض في المحل", hint: "يدخل المخزون للبيع", needsSupplier: false },
    { id: "repair", label: "لإصلاح قطعة", hint: "يُضاف لوزن قطعة", needsSupplier: false },
    { id: "other", label: "أخرى", hint: "", needsSupplier: false },
  ],
  raw: [
    { id: "supplier", label: "سداد مورد", hint: "يُخصم من التزام الذهب عليه", needsSupplier: true },
    { id: "taskir", label: "تسكير بمكتب", hint: "بيع خام للمكتب", needsSupplier: false },
    { id: "refine", label: "تصفية وسبك", hint: "", needsSupplier: false },
    { id: "other", label: "أخرى", hint: "", needsSupplier: false },
  ],
};
/// يحوّل وزنًا من عياره إلى عيار مرجعي (الدفتر الورقي يمسك الكسر بعيار 21).
/// الوزن الصافي بعيار 24 — الوحدة المرجعية لكل مقارنة.
/// تقريب المال لخانتين والوزن لثلاث — دقة الميزان في المحل.

const SET_PIECE_PRESETS = ["خاتم", "سلسلة", "سوار", "أقراط", "قلادة", "دبلة"];
// ═══════════════════════════════════════════════════════════════
//  التصنيفات وطرق البيع
//
//  ثلاث طرق تختلف جوهريًا في المحاسبة:
//
//  ① whole  — القطعة تُباع كاملة. خاتم أو سوار: إما بيع أو لا.
//  ② partial — تُباع بالوزن. سبيكة 1000 جم يُقتطع منها جرام فيبقى 999.
//              القطعة نفسها تبقى برقاقتها، وينقص وزنها فقط.
//  ③ set    — طقم يدخل بوزنه الكامل، وبيع قطعة منه يُفكّ الباقي.
//
//  الخلط بينها يُفسد المخزون: معاملة السبيكة كقطعة كاملة يعني بيع
//  1000 جم لمن طلب جرامًا، ومعاملة الخاتم بالوزن يعني بقاء نصف خاتم.

const SALE_MODES = [
  { id: "whole", label: "قطعة كاملة", hint: "تُباع كما هي" },
  { id: "partial", label: "بيع بالوزن", hint: "يُقتطع منها ويبقى الباقي" },
  { id: "set", label: "طقم", hint: "بيع قطعة يفكّ الباقي" },
];

const SCRAP_STAGES = {
  // ⚠ «بانتظار التكسير» تسبق كل شيء: التقدير تخمين بالنظر، وإدخال الوزن
  // التقديري للخزنة يعني رصيدًا لم يُوزن يظهر فرقه عند الجرد بلا مصدر.
  pending_break: {
    label: "بانتظار التكسير", hint: "له فصوص — يُوزن بعد نزعها",
    // ⚠ لم تعد تمنع الإقفال — تُعلَّق فقط.
    //
    // المنع كان يحبس اليوم على قطعة: البائع يُكسّر على عجل بلا ميزان
    // دقيق، أو يترك اليوم مفتوحًا فتختلط حركة يومين.
    color: "var(--bad)", canSettle: false, blocksClose: false, suspended: true,
  },
  // ⚠ مرحلة الاستلام: من المشتري إلى مسؤول الكسر.
  //
  // بلا هذه المرحلة يبقى الكسر «في الصندوق» بلا مسؤولٍ باسمه — فإن
  // نقص وزنٌ لم يُعرف بين يدَي من نقص.
  received: {
    label: "استلمه مسؤول الكسر", hint: "بعهدته حتى يُكسّر ويُثبّت الوزن",
    color: "var(--accent)", canSettle: false,
  },
  in_box: { label: "في صندوق الكسر", hint: "مستلَم من الزبون — بانتظار مسؤول الكسر", color: "var(--accentText)", canSettle: false },
  sent: { label: "لدى الإدارة", hint: "قيد الفحص والتقييم", color: "var(--accent)", canSettle: false },
  assessed: { label: "مُقيَّم", hint: "فُحص وينتظر الاعتماد", color: "var(--text2)", canSettle: false },
  approved: { label: "معتمَد", hint: "جاهز للإدخال في الخزنة", color: "var(--good)", canSettle: false },
  in_safe: { label: "في الخزنة", hint: "متاح للسداد والتصنيع", color: "var(--good)", canSettle: true },
  used: { label: "مستهلك", hint: "صُرف أو حُوّل", color: "var(--text3)", canSettle: false },
};

/// الكسر الذي ينتظر التكسير — يمنع إقفال اليوم.

const REQ_STATUS = {
  pending: { label: "بانتظار الإدارة", color: "var(--accent)" },
  assessed: { label: "مُقيَّم — ينتظر الاعتماد", color: "var(--text2)" },
  approved: { label: "معتمَد — جاهز للاستلام", color: "var(--good)" },
  received: { label: "أُدخل الخزنة", color: "var(--text3)" },
  rejected: { label: "مرفوض", color: "var(--bad)" },
};
// شبكات البطاقات. «مدى» شبكة محلية بلا عمولة عادةً، والبطاقات العالمية
// تخصم نسبة من كل عملية. النسب تُضبط من الإعدادات لأنها تختلف بين
// البنوك وتتغيّر بالعقود.

const FUNDING_SOURCES = [
  { id: "safe_cash", label: "الخزنة - نقدي" },
  { id: "safe_network", label: "الخزنة - شبكة" },
  { id: "daily_cash", label: "صندوق اليومي - نقدي" },
  { id: "daily_network", label: "صندوق اليومي - شبكة" },
];
// Payment/holding methods. Only cash and network exist — every pool splits
// exactly these two ways.

const RETURN_REASONS = [
  { id: "changed_mind", label: "عدول العميل", restock: "available",
    hint: "القطعة سليمة — تعود للعرض" },
  { id: "wrong_size", label: "مقاس غير مناسب", restock: "available",
    hint: "تعود للعرض" },
  { id: "defect", label: "عيب صناعة", restock: "damaged",
    hint: "لا تعود للعرض — تُفحص أو تُردّ للمورد" },
  { id: "damaged", label: "تلف بعد البيع", restock: "damaged",
    hint: "لا تعود للعرض" },
  { id: "wrong_item", label: "صُرفت خطأً", restock: "available",
    hint: "تعود للعرض" },
];

/// وجهة ردّ المبلغ.

const REFUND_TARGETS = [
  { id: "daily_cash", label: "الصندوق اليومي نقدًا", account: "1130" },
  { id: "safe_cash", label: "الخزنة نقدًا", account: "1110" },
  { id: "network", label: "الشبكة", account: "1120" },
  // ⚠ الآجل لا يُردّ نقدًا: العميل لم يدفع بعد، فالردّ نقدٌ يخرج مقابل
  // لا شيء. يُخصم من دَينه.
  { id: "credit", label: "خصم من دَين العميل", account: "1310" },
];

/// ── ① نموذج الطلب ──
///
/// `ReturnItemRequest`:
///   { saleId, lineIndexes[], reasonId, refundTarget, note, actor }
///
/// ── ② نموذج النتيجة ──
///
/// `ReturnTransaction`:
///   { ok, ref, journal, itemUpdates[], cashEntry, weightLines[], errors[] }

/// يبحث عن القطعة بالرقم التسلسلي أو الباركود أو رقم الفاتورة.
///
/// ⚠ البحث بالرمز أولًا: البائع يمسح الملصق ولا يعرف رقم الفاتورة.

const TRUST_PURPOSES = [
  { id: "repair", label: "إصلاح" },
  { id: "cleaning", label: "تنظيف" },
  { id: "safekeeping", label: "حفظ" },
];

// ═══════════════════════════════════════════════════════════════════════
//  الربط مع المتجر الإلكتروني
//
//  القطعة الواحدة لا تُباع مرتين. المحل والمتجر يبيعان من نفس المخزون،
//  فالتزامن بينهما ليس تحسينًا بل شرط سلامة:
//
//    • طلب من المتجر  → تُحجز القطعة فورًا (قبل الدفع) فلا يبيعها البائع.
//    • دُفع في المتجر → تُعلَّم مباعة وتُسجَّل فاتورة.
//    • أُلغي الطلب    → يُفكّ الحجز وتعود للعرض.
//    • نفدت الكمية    → يُرد للمتجر ما نفد ليُخفيه فورًا.
//
//  والبائع في المحل يُمنع من بيع قطعة محجوزة أو مباعة للمتجر، برسالة
//  تشرح السبب — لا رفضًا صامتًا.
// ═══════════════════════════════════════════════════════════════════════

const ONLINE_STATUS = {
  reserved: { label: "محجوزة لطلب متجر", color: "var(--accent)", blocks: true },
  sold: { label: "مباعة عبر المتجر", color: "var(--bad)", blocks: true },
};

/// يمنع بيع قطعة ملتزَم بها للمتجر. يُستدعى من شاشة البيع وعند المسح.

const EXT_STATUS = {
  accepted: { label: "مقبولة", color: "var(--good)" },
  duplicate: { label: "مكررة — تُجوهلت", color: "var(--text2)" },
  rejected: { label: "مرفوضة", color: "var(--bad)" },
};

/// يتحقق من فاتورة خارجية ويحوّلها لشكل فاتورة داخلية.
/// لا يكتب شيئًا — الفصل بين التحقق والكتابة يجعل الرفض بلا أثر جانبي.

export { EXT_STATUS, FUNDING_SOURCES, GOLD_OUT_DESTINATIONS, ONLINE_STATUS, REFUND_TARGETS, REQ_STATUS, RETURN_REASONS, SALE_MODES, SCRAP_STAGES, SET_PIECE_PRESETS, TRUST_PURPOSES };
