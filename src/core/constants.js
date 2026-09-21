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

// حسابات الصناديق حسب مصدر التمويل — يستعملها ترحيل القيود بأثر رجعي
// (buildBackfillPlan) لتحديد طرف القيد النقدي دون تخمين.
const CASH_ACCOUNT_OF = {
  safe_cash: "1110", safe_network: "1120",
  daily_cash: "1130", daily_network: "1140",
  custody_cash: "1150",
};
// ⚠ مصدرٌ غير معروف يُرمى لا يُفترض «الخزنة»: افتراضٌ صامت يُقيّد على
// حسابٍ لم يُمسّ.

// حساب المصروف حسب فئته — الفئات غير المعروفة (أو غير المستعملة في هذا
// التطبيق حاليًا كـ gosi/eos) تذهب لـ6900 «مصروفات أخرى».
const EXPENSE_ACCOUNT_OF = {
  rent: "6100",
  salaries: "6200",
  advance: "2350",
  bills: "6300",
  government: "6600",
  purchases: "6400",
  gosi: "6700",
  eos: "6700",
  other: "6900",
};

// ═══════════════════════════════════════════════════════════════════════
//  المساعد — الفهم والتنبّؤ
// ═══════════════════════════════════════════════════════════════════════

// دليل الشاشات يُمرَّر للنموذج ليجيب عن «كيف أفعل كذا» ويفتح الشاشة.
// كل سطر: المعرّف · الاسم · كيف تصل · ماذا تفعل هناك. الأسماء البديلة
// هي ما يقوله الناس فعلًا لا ما كتبناه في القائمة.

const AI_APP_MANUAL = [
  ["sales", "المبيعات", "الشريط السفلي", "فاتورة بيع جديدة، اختيار قطع من المخزون، الدفع نقدًا أو شبكة أو آجل", "بيع، فاتورة، فتورة، بيع قطعة، أبيع"],
  ["inventory", "المخزون", "الشريط السفلي", "كل القطع المتاحة بعياراتها ومعادل 24، البحث بالكود أو الوصف", "المخزون، البضاعة، القطع، وش عندي، الموجود"],
  ["addGoods", "التكويد", "الشريط السفلي", "إدخال قطع جديدة من دفعة شراء وطباعة ملصقاتها", "تكويد، إضافة قطعة، إدخال بضاعة، أكوّد، الباركود"],
  ["stocktake", "الجرد", "الشريط السفلي", "جرد المخزون بالمسح أو يدويًا، يكشف الناقص والزائد", "جرد، أجرد، جردة، عدّ القطع"],
  ["cash", "النقد", "النقد ← الصندوق", "الصندوق اليومي والخزنة وعهدة الكسر، إيداع وسحب وتوريد", "الصندوق، الكاش، الخزنة، الفلوس، النقدية، أودع، أسحب"],
  ["expenses", "المصروفات", "النقد ← المصروفات", "تسجيل مصروف، الرواتب والعمولات، فلترة بالفترة", "مصروف، مصاريف، صرفت، راتب، رواتب، إيجار، كهرباء"],
  ["priceFix", "التثبيت", "النقد ← التثبيت", "تحويل وزن من الخزنة إلى نقد أو العكس بسعر محدّد", "تثبيت، أثبّت، أبيع ذهب الخزنة، أشتري ذهب للخزنة"],
  ["purchases", "المشتريات", "أوامر الشراء ← المشتريات", "تسجيل دفعة شراء من مورّد بالوزن والعدد والتكلفة", "شراء، مشتريات، دفعة، اشتريت من المورد، بضاعة جديدة"],
  ["suppliers", "الموردون", "أوامر الشراء ← الموردون", "إضافة مورّد ومتابعة ما عليك له من ذهب أو نقد", "مورد، موردين، المصنع، ورشة، وش علي للمورد"],
  ["taskirat", "التسكيرات", "أوامر الشراء ← تسكيرات", "بيع كسر لمكتب تسكير وسداده نقدًا", "تسكير، تسكيرة، مكتب، أسكّر"],
  ["supplierLedger", "تقارير المشتريات", "أوامر الشراء ← تقارير المشتريات", "كشف حساب كل مورّد وزنًا ونقدًا", "كشف المورد، حساب المورد، تقرير المشتريات"],
  ["scrapIntake", "استلام الكسر", "الكسر ← الاستلام", "شراء كسر من زبون بالوزن والعيار", "كسر، أشتري كسر، زبون يبيع ذهب، استلام كسر"],
  ["scrapCustody", "عهدة الكسر", "الكسر ← العهدة", "الكسر المعلّق قبل التكسير والإيداع في الخزنة", "عهدة، الكسر المعلق، تكسير، فصوص"],
  ["scrap", "سجل الكسر", "الكسر ← السجل", "كل حركات الكسر بمراحلها", "سجل الكسر، تاريخ الكسر"],
  ["customers", "العملاء", "خدمة العملاء ← العملاء", "إضافة عميل، بياناته، مشترياته", "عميل، عملاء، زبون، زبائن، أضيف عميل"],
  ["trustAccounts", "الحسابات الجارية", "خدمة العملاء ← الحسابات الجارية", "أمانات العملاء نقدًا وذهبًا، إيداع وسحب وسند PDF", "أمانة، أمانات، وديعة، حساب جاري، الزبون ترك عندي ذهب"],
  ["repairs", "الإصلاحات", "خدمة العملاء ← الإصلاحات", "استلام قطعة للإصلاح وتسليمها", "إصلاح، تصليح، لحام، تلميع، قطعة للورشة"],
  ["reservations", "الحجوزات", "خدمة العملاء ← الحجوزات", "حجز قطعة لعميل بعربون", "حجز، عربون، حجزت قطعة"],
  ["customerReport", "تقرير العملاء", "التقارير ← تقرير العملاء", "كل ما جرى مع عميل: بيع ومرتجع وأمانة وإصلاح في خطّ واحد", "سجل العميل، وش صار مع العميل، تاريخ الزبون"],
  ["masterReport", "التقارير الموحّدة", "التقارير ← الموحّدة", "المؤشّرات نقدًا ووزنًا، مقارنة فترات، تفصيل، تصدير", "تقرير، تقارير، أرباح، الربح، كم ربحت، المبيعات الشهر"],
  ["reports", "التقارير", "التقارير", "التقارير التفصيلية القديمة", "تقارير"],
  ["journal", "اليومية", "التقارير ← اليومية", "قيود اليومية العامة مدين ودائن", "يومية، قيود، القيد"],
  ["trialBalance", "ميزان المراجعة", "التقارير ← ميزان المراجعة", "أرصدة كل الحسابات وتوازنها", "ميزان، ميزان المراجعة، الأرصدة"],
  ["financials", "القوائم المالية", "التقارير ← القوائم المالية", "قائمة الدخل والميزانية والزكاة", "قائمة الدخل، الميزانية، الزكاة، القوائم"],
  ["salesHistory", "سجل المبيعات", "التقارير ← سجل المبيعات", "كل الفواتير السابقة والبحث فيها", "الفواتير القديمة، سجل البيع، فاتورة أمس"],
  ["salesReturn", "استرجاع مبيعات", "التقارير ← الاسترجاع", "إرجاع قطعة مباعة ورد المبلغ", "مرتجع، استرجاع، الزبون رجّع"],
  ["sellerReports", "تقارير البائعين", "التقارير ← البائعون", "مبيعات كل بائع وعمولته", "البائع، البائعين، عمولة، مين باع أكثر"],
  ["workday", "يوم العمل", "الشريط العلوي", "فتح اليوم وإقفاله وتوريد الصندوق", "فتح اليوم، إقفال، أقفل، أفتح اليوم، الإقفال"],
  ["price", "السعر اليومي", "الإعدادات", "تثبيت سعر الجرام للفوترة", "السعر، سعر الجرام، أغيّر السعر"],
  ["safeAudit", "جرد الخزنة", "التقارير", "مطابقة ذهب الخزنة ونقدها بالفعلي", "جرد الخزنة، أجرد الخزنة"],
  ["openingBalance", "الرصيد الافتتاحي", "الإعدادات", "رصيد البداية نقدًا وذهبًا", "الافتتاحي، رصيد البداية"],
  ["settings", "الإعدادات", "القائمة", "اسم المحل، الطابعة، البثّ، الوضع", "إعدادات، الضبط، أغيّر"],
  ["access", "الصلاحيات", "القائمة", "المستخدمون وأدوارهم وأرقامهم السرّية", "موظف، مستخدم، صلاحية، رقم سري، أضيف موظف"],
  ["backup", "النسخ الاحتياطي", "القائمة", "تصدير كل البيانات واستيرادها", "نسخة، باكب، احفظ البيانات، استرجع"],
  ["printerSetup", "الطابعة", "الإعدادات", "توصيل طابعة الملصقات والفواتير", "طابعة، طباعة، ملصق"],
  ["generalLedger", "الأستاذ العام", "القائمة ← التقارير", "تقرير الشجرة المحاسبية بكل حساب ورصيده، وكشف حساب لأي حساب بحركاته ومراجعه ورصيد متتابع — بتحديد فترة وتصدير Excel وPDF", "أستاذ، شجرة، شجرة الحسابات، كشف حساب، دليل حسابات، رصيد حساب، حركة حساب"],
  ["docCycle", "الدورة المستندية", "القائمة ← التقارير", "أحد عشر فصلًا: المبادئ · القيد الافتتاحي · يوم العمل · المشتريات · المبيعات · الكسر · المقبوضات والمدفوعات · العهد · المخزون · المعالجات الدورية · التسويات · الإقفال — كلٌّ بمتى ومن والشاشة والقيود والتنبيهات، وجدول المستندات، وتصديرٌ PDF", "الدورة المستندية، دليل، كيف أعمل، القيود، المستندات، المراجع"],
  ["anyStatement", "كشف حساب — أي شيء", "القائمة ← التقارير", "كشفٌ لأي كيان: مورّد · عميل · بائع · مكتب تسكير · شريك · قطعة · دفعة · حساب محاسبي · يوم عمل · بند مصروف — برصيدٍ افتتاحيّ وترقيمٍ متسلسل ونقدٍ ووزن، وExcel وPDF", "كشف حساب، مورد، عميل، بائع، شريك، قطعة، دفعة، يوم، بند مصروف، رصيد"],
  ["fullStatements", "القوائم المالية الكاملة", "القائمة ← التقارير", "تسع قوائم: دليل الحسابات · ميزان مراجعة بعشرة أعمدة · الدخل والدخل الشامل · المركز المالي · التغيّر في حقوق الملكية · التدفق النقدي · التدفق الوزني بالجرام · التسويات الجردية المقترحة · الإيضاحات", "قوائم مالية، ميزان مراجعة، مركز مالي، تدفق نقدي، حقوق ملكية، إيضاحات، تسويات جردية، دليل الحسابات"],
  ["exchange", "التبادل مع الأنظمة", "القائمة ← الربط", "سحبٌ وإرسال لتسعة أنواع: المبيعات · الإيرادات · المصروفات · المقبوضات · المدفوعات · قيود اليومية · المخزون · العملاء · الموردون — بصيغة CSV أو JSON، والاستيراد يُفحص كلّه قبل أن يُرحَّل شيء", "تبادل، استيراد، تصدير، CSV، ربط مع برنامج آخر، سحب البيانات، نقل المبيعات"],
  ["payroll", "الرواتب", "القائمة ← المال والشركاء", "مسيّر رواتب شهري، تأمينات، نهاية خدمة، صرف", "راتب، رواتب، مسيّر، تأمينات، نهاية خدمة، أجور الموظفين"],
  ["attendanceHr", "الحضور والإجازات", "القائمة ← المال والشركاء", "تسجيل حضور وغياب وإجازات الموظفين", "حضور، غياب، اجازة، إجازة، اجازات، إجازات، بصمة"],
  ["fixedAssets", "الأصول الثابتة", "القائمة ← المال والشركاء", "شراء أصل، إهلاك شهري، استبعاد", "أصول، أثاث، سيارة، جهاز، إهلاك، استهلاك"],
  ["rfidReader", "قارئ RFID", "القائمة ← المخزون والتكويد", "جرد بالقارئ اللاسلكي، مسح مباشر أو دفعة، البحث عن قطعة", "قارئ، ار اف اي دي، RFID، مسح، جهاز الجرد"],
  ["rfidSettings", "إعدادات القارئ", "القائمة ← المخزون والتكويد", "قوة الإرسال ووضع المسح لكل قسم — الجرد والمخزون والبيع وغيرها", "إعدادات القارئ، قوة القارئ، ضبط RFID"],
  ["taxReport", "تقرير عمولة المدير", "القائمة ← التقارير", "حصيلة عمولة المدير يومًا بيوم ووعاءها", "عمولة، عمولة المدير، نسبة المدير"],
  ["partners", "الشركاء", "القائمة ← المال والشركاء", "رأس مال كل شريك ونسبته وتوزيع الأرباح", "شريك، شركاء، حصة، نسبة الشراكة، توزيع أرباح"],
  ["bankRecon", "مطابقة البنك", "القائمة ← التقارير", "مطابقة حركة الشبكة والتحويلات بكشف البنك", "بنك، مطابقة، كشف حساب بنكي، شبكة"],
  ["officeLedger", "كشف مكتب التسكير", "القائمة ← التقارير", "ما لك وما عليك عند مكتب التسكير", "مكتب، تسكير، كشف المكتب"],
  ["categories", "التصنيفات", "القائمة ← المخزون والتكويد", "خواتم أساور أطقم… تُبنى عليها التقارير", "تصنيف، أقسام، أنواع، خواتم، أساور"],
  ["conversions", "التحويلات", "القائمة ← المخزون والتكويد", "تحويل قطعة بين عيار أو صنف", "تحويل، أحوّل، نقل بين الأصناف"],
  ["itemEdit", "تعديل صنف", "القائمة ← المخزون والتكويد", "تعديل بيانات قطعة مكوّدة", "تعديل قطعة، أصلح الوصف، غيّر الوزن"],
  ["printing", "الطباعة", "القائمة ← المخزون والتكويد", "طباعة ملصقات القطع بالباركود", "طباعة، ملصق، باركود، ليبل"],
  ["search", "البحث الشامل", "القائمة ← التقارير", "بحث في كل شيء: فواتير، قطع، عملاء، موردين", "بحث، دوّر، ألقى، وين"],
  ["integration", "الربط", "القائمة ← الربط", "ربط الأنظمة المحاسبية والمتجر", "ربط، تكامل، API، نظام محاسبي"],
  ["storeLink", "ربط المتجر", "القائمة ← الربط", "ربط متجر إلكتروني بالمخزون", "متجر، أونلاين، سلة، زد"],
  ["hqReports", "تقرير الفروع", "القائمة ← المال والشركاء", "تقرير موحّد لأداء الفروع", "فروع، الفروع، ادارة، إدارة، تقرير الفروع، hq"],
  ["openingCompare", "مقارنة الافتتاحي", "القائمة ← المال والشركاء", "مقارنة الرصيد الافتتاحي بالواقع الحالي", "افتتاحي، بداية، مقارنة الرصيد"],
  ["aiAssistant", "مساعد أوقية", "القائمة ← النظام", "يسأل عن الحسابات ويصنع تقارير ويشرح الفروق", "مساعد، ذكاء، اسأل، تقرير مخصص"],
  ["navCustomize", "ترتيب الشاشات", "القائمة ← النظام", "ترتيب الشريط السفلي والقائمة", "ترتيب، تخصيص، شكل القائمة"],
];

/// أسئلة جاهزة — لأن الشاشة الفارغة لا تُلهم.

const AI_PROMPTS = [
  "كم ربحي هذا الشهر ولماذا؟",
  "ما الذهب الذي عندي بعياراته؟",
  "ماذا عليّ للموردين وما لي عند العملاء؟",
  "هل يوجد كسر معلّق لم يُسوَّ؟",
  "أي دفعة لم تُكوَّد كاملة؟",
  "راجع ميزان الحسابات وقل لي إن كان متوازنًا",
  "ما الأمانات التي عندي ولمن؟",
  "هل سعر محلّي بعيد عن السوق؟",
];

const AI_SYSTEM_RULES = `أنت مساعد داخل تطبيق «أوقية» لمحلّ ذهب سعودي. تجيب بالعربية بلهجة مهنية مباشرة.

فهم السؤال:
- افهم أي صيغة: عامية أو فصحى، مختصرة أو مطوّلة، بأخطاء إملائية. «فتوره» = فاتورة، «الكاش» = النقد، «وش» = ماذا.
- إن كان السؤال غامضًا فاختر التفسير الأرجح لمحلّ ذهب وأجب عليه، ثم اذكر في سطر واحد التفسير الآخر إن وُجد.
- لا تطلب توضيحًا إلا إن كان الغموض يغيّر الجواب جذريًّا.
- تنبّأ بما يريده فعلًا: من يسأل «كم ربحي» يريد رقمًا وسببه، لا تعريف الربح.

نوعان من الأسئلة:
① عن البيانات: أجب من «معطيات النظام» بالأرقام كما هي. لا تحسب ولا تُقدّر ولا تخترع.
② عن التطبيق: «كيف أضيف مورّد» — أجب من «دليل الشاشات»: أين يذهب وماذا يفعل، بخطوات قصيرة.

قواعد محاسبية ملزمة:
- الوزن بالجرام والنقد بالريال ولا يُجمعان.
- العيارات لا تُجمع خامًا — استعمل «بمعادل 24».
- الأمانة التزامٌ لا إيراد.
- لا تقترح تنفيذ عملية بنفسك — دلّ على الشاشة.

فهم القصد لا الصيغة:
- المستخدم يتكلّم بلهجته وبأي صيغة: «وش صار امس»، «كم طلع معي»، «ودّني الجرد»،
  «ابي اشوف الكسر». افهم ما يريد لا ما قال. لا تطلب إعادة الصياغة أبدًا.
- إن كان القصد واضحًا بما يكفي، أجب مباشرةً ولا تسأل.
- إن احتمل القصد أكثر من معنى، **لا تُخمّن ولا تُجب بالاثنين** — أعطه خيارات
  في "clarify": من 2 إلى 4، كل خيار جملةٌ قصيرة يفهمها ويضغطها. مثال: «وش عندي»
  → [«ذهبي بالجرام»، «نقدي بالريال»، «مبيعات اليوم»، «الأصناف المتاحة»].
- إن كان قصده تنفيذ عملية («بِع»، «افتح اليوم») لا تنفّذ — دلّه على الشاشة في
  "screens" واشرح الخطوة الأولى.
- إن كان قصده **مجرّد الذهاب** لشاشة («ودّني الجرد»، «افتح المخزون»، «ابي اشوف
  الكسر») ضع معرّفها في "navigate" وأجب بجملةٍ واحدة: «فتحتُ لك الجرد». لا شرح.

الشرح الكامل حين يسأل «كيف» أو «وش فايدة»:
- **ما هي**: جملة واحدة.
- **كيف تُستعمل**: خطوة خطوة بأسماء الأزرار كما هي.
- **ماذا يحدث بعدها**: أي رقمٍ يتغيّر، وأي قيدٍ يُكتب.
- **أين ترى النتيجة**: اسم الشاشة والتبويب بالضبط — هذا ما ينساه الجميع.
- **الخطأ الشائع**: ما يقع فيه الناس هنا وكيف يتجنّبه.

الردّ بصيغة JSON فقط بلا أي نصّ خارجه:
{
  "answer": "الجواب بالعربية — للشرح فقراتٌ قصيرة، للأرقام جملة",
  "screens": ["معرّف شاشة", ...],   ← شاشات تفيد السائل، من الدليل، 0 إلى 3
  "followups": ["سؤال قصير", ...],  ← ما قد يسأله بعد ذلك، 0 إلى 3
  "clarify": ["خيار", ...],         ← فقط إن التبس القصد، 2 إلى 4، وإلا []
  "navigate": "معرّف شاشة أو null"  ← فقط إن طلب الذهاب لشاشة بعينها
}`;

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
  // ⚠ مفعَّل افتراضيًا: الباك إند (auth.routes.js) يتطلب رقمًا سريًا
  // دائمًا — لا يوجد مسار دخول بلا PIN فعليًا (راجع handleDirectLogin في
  // GoldInventoryApp.jsx). القيمة الافتراضية السابقة (false) كانت تطابق
  // فقط سلوك النسخة المرجعية القديمة بلا باك إند حقيقي، وتؤدي لرسالة
  // "الدخول بلا رقم سري غير مدعوم" دومًا. يمكن مستقبلًا بناء نقطة دخول
  // آمنة بلا PIN كقرار منفصل، وحينها تُعاد هذه القيمة لـfalse.
  requirePin: true,
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
  // ⚠ حقلٌ مستقلٌّ عن taxEnabled/taxRate عمدًا: ذانك لضريبة القيمة
  // المضافة (15٪) المربوطة بالباك إند الحقيقي، وهذا لعمولة المدير —
  // خلطهما يجعل تعطيل الضريبة يعطّل العمولة، وتغيير نسبة أحدهما يغيّر
  // الآخر. راجع mgrFeeEnabled/mgrFeeRate في domain/helpers.js.
  mgrFeeEnabled: false,
  mgrFeeRate: 2, // MGR_FEE_DEFAULT — تكرار للقيمة الافتراضية هنا لتفادي مشكلة الترتيب مع const
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
    // ⚠ إصلاح حقيقي: fixedAssets/payroll/attendanceHr (migration 015/016)
    // كانتا مضافتين فقط إلى roles.allowed_more في قاعدة البيانات (يقرأه
    // requirePage في الباك إند فعليًا)، لا إلى ROLES هذا الثابت المحلي —
    // وroleFor أعلاه في GoldInventoryApp.jsx يقرأ حصرًا من ROLES المحلي
    // حين allowedPages المستخدم = null (الحالة الافتراضية لأي مستخدم لم
    // يُخصَّص له شيء بعد)، بلا أي دمج مع ما يرجعه الباك إند. النتيجة:
    // كانت الصفحتان مبنيتين ومُفعَّلتين خادميًّا لكن غير قابلتين للوصول
    // فعليًا من القائمة لأي مدير افتراضي — هذا الإصلاح يضيفهما هنا، ومعهما
    // hqReports (migration 017) مباشرة بلا نفس الفجوة من أول يوم.
    allowedMore: ["addGoods", "printing", "printerSetup", "salesHistory", "sellerReports", "price", "reports", "journal", "trialBalance", "search", "bankRecon", "supplierLedger", "officeLedger", "salesReturn", "scrap", "scrapIntake", "scrapCustody", "conversions", "itemEdit", "goldOut", "categories", "workday", "customers", "trustAccounts", "reservations", "safeAudit", "integration", "storeLink", "backup", "purchases", "suppliers", "taskirat", "partners", "access", "taxReport", "settings", "financials", "openingCompare", "repairs", "aiAssistant", "navCustomize", "openingBalance", "fixedAssets", "payroll", "attendanceHr", "hqReports", "priceFix", "fullStatements", "anyStatement", "generalLedger", "masterReport", "exchange", "customerReport", "docCycle"],
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
  dpi: 203,
  copies: 1,
  density: 8,               // 0-15 على طابعات الملصقات
  // ⚠ من نسخة العميل: منقولة بلا تغيير قيمها الافتراضية الأصلية
  // (mode/labelWidthMm/labelHeightMm أُبقيت على قيم هذا التطبيق القائمة
  // فلا يتغيّر سلوك من له إعداد محفوظ سلفًا).
  lang: "auto",            // auto | escpos | tspl
  transport: "system",
  usbSerial: null,
  gapMm: 2,
  speed: 3,
  direction: 1,
  rfid: false,
  rfidCommand: 'RFID WRITE,EPC,"{HEX}"',
  codeStyle: "barcode",     // barcode | qr
  symbology: "barcode",      // barcode | qr
  layout: {
    logo:    { show: false, x: 44, y: 1.5,  w: 9,  h: 9 },
    desc:    { show: true,  x: 2,  y: 1.5,  w: 40, h: 4 },
    karat:   { show: true,  x: 2,  y: 6,    w: 11, h: 3.5 },
    weight:  { show: true,  x: 14, y: 6,    w: 16, h: 3.5 },
    price:   { show: false, x: 31, y: 6,    w: 18, h: 3.5 },
    barcode: { show: true,  x: 2,  y: 10.5, w: 58, h: 8 },
    qr:      { show: false, x: 2,  y: 5,    w: 14, h: 14 },
    code:    { show: true,  x: 2,  y: 19.5, w: 58, h: 3.5 },
  },
  customLogo: null,
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

// ═══════════════════════════════════════════════════════════════════════
//  قارئ RFID — قرارك الصريح: NHR-10 (بلوتوث) + قارئ HID (لوحة مفاتيح) +
//  الكاميرا/الإدخال اليدوي كبدائل، بنفس ثوابت المرجع حرفيًا (بروتوكول
//  المصنّع الموثّق في core/constants.js هناك).
// ═══════════════════════════════════════════════════════════════════════

const NHR = {
  DEVICE_NAME: "NHR-10",
  SERVICE: 0x00ff,
  CMD: 0xff01,          // كتابة الأوامر · إشعارات الردود والإطارات الحيّة
  FILE_CTRL: 0xff02,    // كتابة `send_file` نصًّا صريحًا
  FILE_DATA: 0xff03,    // بثّ ملف الدفعة
  MTU: 185,
  // ⚠ الدليل: 300 مللي على الأقل بين أوامر بدء/إيقاف المسح
  SCAN_GAP_MS: 300,
  MAGIC_LIVE: [0x4e, 0x48],        // "NH"
  MAGIC_FILE: "NHRB",
  PKT_START: 0xffff,
  PKT_EOF: 0xfffe,
  PKT_ERR: 0x0000,
  REC_LEN: 17,
  HEADER_LEN: 32,
  MAX_EPC_BYTES: 16,
};

/// حدّ الطاقة بحسب المنطقة — البرنامج الثابت يقبل 0–30 dBm، والدليل
/// يُلزم التطبيق بفرض الحدّ النظامي (السعودية ضمن نطاق 865–868).
const NHR_POWER_MAX_DBM = 27;

/// كل قسمٍ يحتاج مدًى مختلفًا من القارئ: الجرد يريد مدى واسعًا يلتقط
/// الرفّ كلّه، والبيع يريد مدى ضيّقًا كي لا يلتقط قطعة الزبون المجاور،
/// والاسترجاع/التكويد يريدان قطعة واحدة بالضبط.
const RFID_SECTIONS = [
  { id: "stocktake", label: "الجرد", hint: "مسحٌ جماعي للرفّ — مدًى واسع",
    def: { enabled: true, power: 26, mode: "bulk", autoStart: true, beep: false } },
  { id: "inventory", label: "المخزون", hint: "بحثٌ عن قطعة بين القطع",
    def: { enabled: true, power: 20, mode: "single", autoStart: false, beep: true } },
  { id: "sales", label: "البيع", hint: "قطعة الزبون وحدها — مدًى ضيّق",
    def: { enabled: true, power: 12, mode: "single", autoStart: false, beep: true } },
  { id: "salesReturn", label: "الاسترجاع", hint: "قطعة واحدة بالضبط",
    def: { enabled: true, power: 12, mode: "single", autoStart: false, beep: true } },
  { id: "addGoods", label: "التكويد", hint: "ربط البطاقة بالقطعة عند الإدخال",
    def: { enabled: true, power: 10, mode: "single", autoStart: false, beep: true } },
  { id: "safeAudit", label: "جرد الخزنة", hint: "مسحٌ جماعي داخل الخزنة",
    def: { enabled: true, power: 24, mode: "bulk", autoStart: true, beep: false } },
];

const RFID_MODES = [
  { id: "single", label: "قطعة واحدة", hint: "أول قراءة تكفي ثم يتوقّف" },
  { id: "bulk", label: "مسح جماعي", hint: "يجمع كل ما يُقرأ حتى توقفه" },
];

/// إعدادات القارئ الافتراضية — محلية بحتة (بلا مزامنة سيرفر، تمامًا
/// كإعدادات الطابعة DEFAULT_PRINTER): كل جهاز/متصفح يقترن بقارئه
/// الفعلي بنفسه، فلا معنى لمزامنة "جهاز مقترن" عبر الأجهزة.
///
/// ⚠ `perSection` فارغة تعني «الكل يتبع العام» — لا «كل الأقسام مُعطَّلة».
/// القيمة الغائبة تُقرأ من الافتراضي لا تُعامَل صفرًا.
const RFID_DEFAULTS = {
  enabled: false,
  globalPower: 20,
  profile: 53, q: 6, session: 1, target: 0,
  applyToAll: true,           // إعدادٌ واحد لكل الأقسام
  perSection: {},
};

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

// ═══════════════════════════════════════════════════════════════════════
//  القوائم المالية والتقارير الموحّدة — منقول من نسخة العميل
// ═══════════════════════════════════════════════════════════════════════

/// أنواع الجهات القابلة لكشف حساب عام (شاشة AnyStatementPage).
const STATEMENT_ENTITIES = [
  { id: "supplier", label: "مورّد", store: "suppliers", money: true, weight: true,
    hint: "الدفعات · الأجور · السداد · الالتزام الوزني" },
  { id: "customer", label: "عميل", store: "customers", money: true, weight: true,
    hint: "المبيعات · المرتجعات · التحصيل · الأمانات" },
  { id: "seller", label: "بائع", store: "users", money: true, weight: false,
    hint: "مبيعاته · مرتجعاته · عمولته" },
  { id: "office", label: "مكتب تسكير", store: "taskirOffices", money: true, weight: true,
    hint: "التسكير · السداد نقدًا وذهبًا" },
  { id: "partner", label: "شريك", store: "partners", money: true, weight: false,
    hint: "رأس المال · السحوبات · حصّته من الأرباح" },
  { id: "item", label: "قطعة", store: "items", money: true, weight: true,
    hint: "دخولها · طباعتها · بيعها · مرتجعها" },
  { id: "lot", label: "دفعة", store: "lots", money: true, weight: true,
    hint: "الشراء · التكويد · ما بِيع منها" },
  { id: "account", label: "حساب محاسبي", store: "accounts", money: true, weight: false,
    hint: "كل حركةٍ على الحساب وفروعه" },
  { id: "day", label: "يوم عمل", store: "businessDays", money: true, weight: true,
    hint: "كل ما وقع فيه من فتحٍ لإقفال" },
];

/// أكواد حسابات النقد (الخزنة/الصندوق) — تُستخدم في قائمة التدفق النقدي.
const CASH_LEDGER_CODES = ["1110", "1120", "1130", "1140", "1150"];

/// أكواد حسابات الأجور — دفتر أجورٍ منفصل.
const WAGES_LEDGER_CODES = ["5210", "5220", "5230", "2120", "6200", "6710", "6720", "6730", "2350"];

/// مدى التقرير الموحّد (MasterReportPage).
const REPORT_RANGES = [
  { id: "today", label: "اليوم" },
  { id: "yesterday", label: "أمس" },
  { id: "this_week", label: "هذا الأسبوع" },
  { id: "last_week", label: "الأسبوع الماضي" },
  { id: "this_month", label: "هذا الشهر" },
  { id: "last_month", label: "الشهر الماضي" },
  { id: "custom", label: "مدى مخصّص" },
];

/// طرق مقارنة الفترة الحالية بفترةٍ أخرى.
const COMPARE_MODES = [
  { id: "prev", label: "الفترة السابقة", hint: "المدة نفسها قبلها مباشرة" },
  { id: "last_month", label: "الشهر الماضي", hint: "الأيام نفسها من الشهر الماضي" },
  { id: "last_year", label: "العام الماضي", hint: "الأيام نفسها من العام الماضي" },
  { id: "custom", label: "مدى مخصّص", hint: "تختاره بنفسك" },
];

/// تعريف كل مؤشّر أداء (KPI) في التقرير الموحّد.
const KPI_DEFS = [
  { key: "salesNet", label: "صافي المبيعات", unit: "money", goodUp: true },
  { key: "netProfit", label: "صافي الربح", unit: "money", goodUp: true },
  { key: "grossProfit", label: "مجمل الربح", unit: "money", goodUp: true },
  { key: "salesCount", label: "عدد الفواتير", unit: "count", goodUp: true },
  { key: "avgTicket", label: "متوسط الفاتورة", unit: "money", goodUp: true },
  { key: "salesWeight", label: "الوزن المُباع", unit: "weight", goodUp: true },
  { key: "cogs", label: "تكلفة المبيعات", unit: "money", goodUp: false },
  { key: "expenses", label: "المصروفات", unit: "money", goodUp: false },
  { key: "returns", label: "المرتجعات", unit: "money", goodUp: false },
  { key: "commissions", label: "العمولات", unit: "money", goodUp: false },
  { key: "boughtFine", label: "مُشترى جم24", unit: "weight", goodUp: true },
  { key: "soldFine", label: "مُباع جم24", unit: "weight", goodUp: true },
  { key: "scrapFine", label: "كسر مُستلَم جم24", unit: "weight", goodUp: true },
  { key: "netFine", label: "صافي حركة الوزن", unit: "weight", goodUp: true },
];

const FIX_KINDS = {
  gold_to_cash: {
    label: "تثبيت ذهب → نقد",
    hint: "تبيع وزنًا من رصيدك بسعر اليوم — يخرج الوزن ويدخل النقد",
    goldDir: "out", cashDir: "in",
    // ⚠ حسابان طرفيان لا رئيسيان — `ledger-audit` يرفض غيرهما
    rule: "price_fix_sell",
  },
  cash_to_gold: {
    label: "تثبيت نقد → ذهب",
    hint: "تشتري وزنًا برصيدك النقدي بسعر اليوم — يخرج النقد ويدخل الوزن",
    goldDir: "in", cashDir: "out",
    rule: "price_fix_buy",
  },
};

const LOGO_SWAP_MS = 6000;

const LOGO_FADE_MS = 1400;

const MGR_FEE_DEFAULT = 2;          // بالمئة

const DOC_CYCLE = [
  {
    id: "principles", n: "⓪", title: "المبادئ الحاكمة",
    intro: "كل حركةٍ تُنتج ثلاثة أشياء: مستندًا بمرجعٍ فريد، وقيدًا نقديًّا، وقيدًا وزنيًّا حين يتحرّك ذهب. من نقص أحدها فالحركة ناقصة.",
    rules: [
      "دفتران لا دفتر: النقد بالريال والذهب بالجرام، ولا يُجمعان. الميزان النقدي يتوازن بالضرورة، والوزني لا يُشترط توازنه — الخلل فيه هو الأصل الوزني السالب.",
      "الشراء الآجل ذهبٌ مستعار: وزنٌ في مخزونك والتزامٌ وزنيّ على المورّد، بلا قيمةٍ نقدية حتى يُباع.",
      "النظام دوري: لا تكلفة مبيعاتٍ عند كل بيعة. التكلفة تُحسب عند الإقفال = مخزون أول + مشتريات − مخزون آخر.",
      "التكلفة المحدّدة لا المتوسّط: كل قطعةٍ بتكلفتها هي، مرتبطةً بدفعتها.",
      "لا شيء يُحذف: المستندات تُعكس بقيدٍ مضادّ، والقطع تُبطَل لا تُمحى.",
    ],
  },
  {
    id: "opening", n: "①", title: "القيد الافتتاحي",
    when: "مرةً واحدة عند التشغيل", who: "المدير",
    screen: "القائمة ← النظام ← الرصيد الافتتاحي",
    steps: ["نقد الخزنة والشبكة", "ذهب الخزنة خامًا ومشغولًا", "المخزون سطرًا سطرًا: وزن · عيار · تكلفة", "ما على المحل للموردين", "رأس المال"],
    entries: [{ t: "الافتتاحي", d: ["1110 الخزنة", "1210 المخزون"], c: ["2110 الموردون", "3100 رأس المال"] }],
    warn: "المركز الذهبي يُجمَّد هنا — هو خطّ البداية الذي يُقاس منه ربح السنة بالجرام. بلاه لا يعرف الإقفال من أين يبدأ.",
    report: "التقارير ← مقارنة بالافتتاحي",
  },
  {
    id: "day", n: "②", title: "يوم العمل",
    when: "كل صباح ومساء", who: "المدير أو النائب",
    screen: "اضغط شريط اليوم أعلى الشاشة",
    steps: ["افتح اليوم — تُصرف العهد", "تقع الحركات كلّها داخله", "عُدّ العهدة", "سلّم الصندوق للخزنة", "احتسب عمولة المدير إن فُعّلت", "أقفل — تُحفظ لقطة اليوم"],
    entries: [
      { t: "عهدة الصندوق", d: ["1130 الصندوق"], c: ["1110 الخزنة"] },
      { t: "عهدة الكسر", d: ["1150 عهدة الكسر"], c: ["1110 الخزنة"] },
      { t: "التسليم مساءً", d: ["1110 الخزنة"], c: ["1130 الصندوق"] },
      { t: "زيادة عدّ", d: ["1130 الصندوق"], c: ["4390 إيرادات متنوّعة"] },
      { t: "عجز عدّ", d: ["5330 عجز بالجرد"], c: ["1130 الصندوق"] },
    ],
    warn: "لا حركةَ خارج يومٍ مفتوح — حركةٌ بلا يوم لا تُنسب لجردٍ ولا لإقفال. وفرق العدّ يُقيَّد ولا يُسوّى بصمت: فرقٌ صغير متكرّر أخطر من فرقٍ كبير مرة.",
    report: "التقارير ← اليومية · كشف أي شيء ← يوم عمل",
  },
  {
    id: "purchase", n: "③", title: "دورة المشتريات",
    when: "عند وصول بضاعة", who: "مدير العمليات أو مدير الفرع",
    screen: "أوامر الشراء ← مورد / دفعة جديدة",
    steps: [
      "طلب شراء — إن كان الفرع يحتاج موافقة",
      "الإدارة تعتمد الطلب",
      "دفعة المورّد LOT-001 بأسطرها",
      "تكويد القطع — رمز 8 خانات لكل قطعة",
      "طباعة الملصق وكتابة رقاقة RFID",
      "سداد الأجور",
    ],
    entries: [
      { t: "شراء نقدي", d: ["1210 المخزون (وزنًا)", "5210 المصنعية"], c: ["1110 الخزنة"] },
      { t: "شراء آجل — وزنًا", d: ["1210 المخزون"], c: ["2110 موردون — ذهب مستحق"] },
      { t: "شراء آجل — نقدًا", d: ["5210 المصنعية"], c: ["2120 موردون — أجور مستحقة"] },
      { t: "سداد الأجور", d: ["2120 أجور مستحقة"], c: ["1110 الخزنة"] },
    ],
    warn: "الموافقة قبل الشراء لا بعده: من يشتري ثم يطلب الاعتماد يضع الإدارة أمام أمرٍ واقع. وتُطابَق بالوزن والمبلغ والعيار (هامش 5٪) وتُستهلك فلا يُشترى بها مرتين. ولا قيمة نقدية للذهب الآجل — هو ذهبٌ مستعار.",
    report: "كشف أي شيء ← مورّد · دفعة · قطعة",
  },
  {
    id: "sales", n: "④", title: "دورة المبيعات",
    when: "مع كل زبون", who: "البائع",
    screen: "المبيعات ← امسح الرمز أو اختر القطعة",
    steps: ["امسح رمز القطعة", "اختر طريقة الدفع", "احفظ — تُطبع الفاتورة", "إن كان آجلًا: سند قبض عند التحصيل"],
    entries: [
      { t: "بيع نقدي", d: ["1130 الصندوق"], c: ["4140 المبيعات"] },
      { t: "بيع شبكة", d: ["1140 شبكة الصندوق"], c: ["4140 المبيعات"] },
      { t: "بيع آجل", d: ["1310 العملاء"], c: ["4140 المبيعات"] },
      { t: "الضريبة", d: ["4140 المبيعات"], c: ["2225 ضريبة مخرجات"] },
      { t: "خروج الذهب", d: ["— وزنًا"], c: ["1210 المخزون"] },
      { t: "المرتجع", d: ["4190 مردودات"], c: ["1130 الصندوق"] },
      { t: "التحصيل", d: ["1130 الصندوق"], c: ["1310 العملاء"] },
    ],
    warn: "البيع المقسّم يُقيَّد قسمين لا نقدًا كلّه. ولا تكلفة مبيعاتٍ هنا — النظام دوري والتكلفة عند الإقفال.",
    report: "كشف أي شيء ← عميل · بائع · التقارير ← سجل المبيعات",
  },
  {
    id: "scrap", n: "⑤", title: "دورة الكسر",
    when: "عند شراء كسرٍ من زبون", who: "مسؤول الكسر",
    screen: "الكسر ← شراء كسر",
    steps: ["عهدة شراء الكسر تُصرف صباحًا", "شراء الكسر بوزنه وعياره", "إرسال للفحص", "اعتماد النتيجة", "إدخال الخزنة", "صهر أو تصنيع أو بيع للمصنع"],
    entries: [
      { t: "الشراء", d: ["5120 شراء كسر", "1220 كسر بالصندوق (وزنًا)"], c: ["1150 عهدة الكسر"] },
      { t: "للخزنة", d: ["1230 كسر بالخزنة (وزنًا)"], c: ["1220 كسر بالصندوق"] },
      { t: "تصنيع مشغول", d: ["1210 المخزون (وزنًا)", "5220 مصنعية التصنيع"], c: ["1230 كسر بالخزنة", "1110 الخزنة"] },
    ],
    warn: "عهدة الكسر منفصلة عن الصندوق — من يشتري كسرًا من نقد المبيعات يخلط الرصيدين فلا يُعرف كم صُرف على الكسر.",
    report: "الكسر ← السجل · كشف أي شيء ← يوم عمل",
  },
  {
    id: "cash", n: "⑥", title: "المقبوضات والمدفوعات",
    when: "يوميًّا", who: "البائع والمدير",
    screen: "النقد ← قبض / صرف",
    steps: ["اختر البند", "اختر مصدر التمويل أو وجهة القبض", "اكتب البيان", "احفظ — يُطبع السند"],
    entries: [
      { t: "عربون حجز", d: ["1130 الصندوق"], c: ["2210 عرابين العملاء"] },
      { t: "إيراد إصلاح", d: ["1130 الصندوق"], c: ["4130 إيراد الإصلاحات"] },
      { t: "رأس مال", d: ["1110 الخزنة"], c: ["3100 رأس المال"] },
      { t: "مصروف", d: ["حساب البند"], c: ["مصدر التمويل"] },
      { t: "سحب مالك", d: ["3400 سحوبات الملاك"], c: ["1110 الخزنة"] },
      { t: "راتب", d: ["2310 رواتب مستحقة"], c: ["1110 الخزنة"] },
    ],
    warn: "العربون التزامٌ لا إيراد. وفئة المصروف تحكم حسابه، ومصدر التمويل يحكم الدائن — ومصدرٌ مجهول يُرمى ولا يسقط على الخزنة بصمت.",
    report: "كشف أي شيء ← بند مصروف · حساب محاسبي · الأستاذ ← النقدية",
  },
  {
    id: "custody", n: "⑦", title: "دورة العهد",
    when: "فتح اليوم وإقفاله", who: "المدير",
    screen: "شريط اليوم · النقد ← تحويل",
    steps: ["تُصرف العهدة عند الفتح", "تُستعمل خلال اليوم", "تُعدّ مساءً", "يُقيَّد الفرق", "تُسلَّم للخزنة"],
    entries: [
      { t: "صرف العهدة", d: ["1130 الصندوق"], c: ["1110 الخزنة"] },
      { t: "سلفة موظف", d: ["2350 سلف موظفين"], c: ["1110 الخزنة"] },
    ],
    warn: "العهدة تُعدّ قبل التسليم — التسليم بلا عدٍّ يجعل الفرق يظهر بعد أسبوع بلا أن يُعرف يومه.",
    report: "التقارير ← اليومية · الأستاذ ← النقدية",
  },
  {
    id: "stock", n: "⑧", title: "دورة المخزون",
    when: "مع كل حركة بضاعة", who: "مدير العمليات",
    screen: "المخزون · الجرد · إخراج قطع",
    steps: ["دخول بالشراء", "خروج بالبيع", "إخراج بسببٍ مكتوب", "تحويل بين الفروع", "الجرد وتسوية الفروق"],
    entries: [
      { t: "إعادة للمورّد", d: ["2110 موردون (وزنًا)"], c: ["1210 المخزون"] },
      { t: "تحويل لكسر", d: ["1230 كسر بالخزنة"], c: ["1210 المخزون"] },
      { t: "تحويل لفرع", d: ["1290 تحويلات الفروع"], c: ["1210 المخزون"] },
      { t: "فقد", d: ["5330 عجز بالجرد"], c: ["1210 المخزون"] },
      { t: "فائض جرد", d: ["1210 المخزون"], c: ["4320 فائض وزن"] },
    ],
    warn: "القطعة لا تخرج إلا بيعًا أو بأحد خمسة أسباب بقيدٍ يُثبت الوجهة. ولا «هدية» ولا «تلف» — الذهب لا يُهدى، والمكسورة تصير كسرًا بوزنها. والفقد والتصحيح بابا السرقة، لذلك يذهبان للعجز الذي يُراجَع بذاته لا للهالك الذي يُبتلع. ويُقفل المخزون أثناء الجرد — بيعةٌ وسطه تجعل الفرق وهميًّا.",
    report: "المخزون · كشف أي شيء ← قطعة · الأستاذ ← الذهب",
  },
  {
    id: "periodic", n: "⑨", title: "المعالجات الدورية",
    when: "آخر كل شهر", who: "المدير المالي",
    screen: "الرواتب · الأصول الثابتة",
    steps: ["احتساب الرواتب", "التأمينات", "الإهلاك", "عمولات الشبكة تُقيَّد تلقائيًّا"],
    entries: [
      { t: "الرواتب", d: ["6200 الرواتب والأجور"], c: ["2310 رواتب مستحقة"] },
      { t: "التأمينات", d: ["6740 حصة المنشأة"], c: ["2320 التأمينات المستحقة"] },
      { t: "الإهلاك", d: ["6800 مصروف الإهلاك"], c: ["1490 مجمّع الإهلاك"] },
      { t: "عمولة الشبكة", d: ["6500 عمولات الشبكة"], c: ["1140 شبكة الصندوق"] },
    ],
    report: "الرواتب · الأصول الثابتة · الأستاذ ← الأجور",
  },
  {
    id: "adjust", n: "⑩", title: "التسويات الجردية",
    when: "قبل الإقفال", who: "المدير المالي",
    screen: "التقارير ← القوائم المالية الكاملة ← التسويات",
    steps: ["راجع المقترحات", "قدّر المبالغ", "رحّلها من قيدٍ يدوي", "أعد الميزان للتأكّد"],
    entries: [
      { t: "إطفاء المقدّم", d: ["6900 مصروفات أخرى"], c: ["1180 مصروفات مقدّمة"] },
      { t: "إثبات المستحق", d: ["6900 مصروفات أخرى"], c: ["2250 مصروفات مستحقة"] },
      { t: "مخصّص الديون", d: ["6910 مصروف مخصّص الديون"], c: ["1195 مخصّص ديون مشكوك فيها"] },
      { t: "هبوط المخزون", d: ["6920 مصروف الهبوط"], c: ["1295 مخصّص هبوط المخزون"] },
      { t: "مخزون آخر المدة", d: ["5160 مخزون آخر المدة"], c: ["5100 تكلفة المبيعات"] },
      { t: "الضريبة", d: ["2225 ضريبة مخرجات"], c: ["1360 ضريبة مدخلات"] },
    ],
    warn: "مقترحاتٌ لا قيود — التسوية قرارٌ يوقّعه إنسان، وبرنامجٌ يُرحّلها بنفسه يُجمّل الأرقام بلا أن يعلم أحد. وبلا مخزون آخر المدة لا تُبنى قائمة دخل.",
    report: "القوائم المالية الكاملة ← التسويات",
  },
  {
    id: "close", n: "⑪", title: "إقفال الفترة",
    when: "آخر السنة المالية", who: "المدير المالي بتوقيع المدير العام",
    screen: "التقارير ← إقفال السنة",
    steps: ["تسوية التكلفة", "إقفال الإيرادات للأرباح المحتجزة", "إقفال المصروفات", "تجميد لقطة المركز الذهبي", "احتساب ربح السنة بالجرام"],
    entries: [
      { t: "تسوية التكلفة", d: ["5105 تكلفة قطع مباعة"], c: ["1210 المخزون"] },
      { t: "إقفال الإيراد", d: ["4140 المبيعات"], c: ["3300 أرباح محتجزة"] },
      { t: "إقفال المصروف", d: ["3300 أرباح محتجزة"], c: ["6xxx المصروفات"] },
    ],
    warn: "ربح الذهب بالجرام هو الرقم: بدأتَ بكيلو وانتهيتَ بكيلو وعشرين = ربحك عشرون جرامًا، صعد السعر أم هبط. واللقطة تصير افتتاحيّ السنة التالية.",
    report: "القوائم المالية الكاملة",
  },
];

const DOC_REFS = [
  ["يوم عمل", "DAY-001", "اليومية · كشف أي شيء ← يوم"],
  ["دفعة شراء", "LOT-001", "كشف أي شيء ← دفعة"],
  ["قطعة", "R7K2M9PQ", "كشف أي شيء ← قطعة"],
  ["فاتورة بيع", "INV-001", "سجل المبيعات"],
  ["مرتجع", "RET-001", "استرجاع مبيعات"],
  ["سند قبض", "REC-001", "كشف أي شيء ← عميل"],
  ["مصروف", "EXP-001", "كشف أي شيء ← بند"],
  ["شراء كسر", "SCR-001", "الكسر ← السجل"],
  ["تسكير", "TSK-001", "كشف أي شيء ← مكتب"],
  ["جرد", "ADT-001", "الجرد"],
  ["تسوية", "ADJ-001", "الأستاذ العام"],
  ["إخراج قطعة", "OUT-001", "الأستاذ ← 5330"],
  ["قيد يدوي", "JRN-001", "الأستاذ العام"],
  ["إقفال سنة", "CLS-001", "القوائم المالية"],
];

const EXCHANGE_VERSION = 1;

const EXCHANGE_KINDS = [
  // ⚠ `codes` عمودٌ لازم: بلا رموز القطع لا يُربط البيع بمخزون، ويُنتج
  // إيرادًا بلا خروج وزن — فيبقى الذهب في الجرد وقد بِيع.
  // رموزٌ متعدّدة تُفصل بفاصلةٍ منقوطة: R7K2M9PQ;BGENNYWE
  { id: "sales", label: "المبيعات", hint: "فواتير البيع — يلزمها عمود رموز القطع",
    cols: ["ref", "date", "customer", "codes", "total", "paid", "method", "note"] },
  { id: "revenues", label: "الإيرادات", hint: "إيراداتٌ غير البيع — إصلاح · خدمات · متنوّع",
    cols: ["ref", "date", "source", "amount", "account", "note"] },
  { id: "expenses", label: "المصروفات", hint: "المصروفات بفئاتها ومصادر تمويلها",
    cols: ["ref", "date", "category", "amount", "fundedBy", "note"] },
  { id: "receipts", label: "المقبوضات", hint: "تحصيلاتٌ من عملاء",
    cols: ["ref", "date", "customer", "amount", "method", "note"] },
  { id: "payments", label: "المدفوعات", hint: "سدادٌ لموردين وغيرهم",
    cols: ["ref", "date", "payee", "amount", "method", "note"] },
  { id: "journal", label: "قيود اليومية", hint: "قيودٌ جاهزة بحسابيها — للمحاسبين",
    cols: ["ref", "date", "account", "debit", "credit", "note"] },
  { id: "inventory", label: "المخزون", hint: "أصنافٌ بأوزانها وعياراتها وتكلفتها",
    cols: ["code", "description", "category", "karat", "weight", "costPerGram", "workmanship"] },
  { id: "customers", label: "العملاء", hint: "الأسماء والهواتف والأرصدة",
    cols: ["ref", "name", "phone", "balance", "note"] },
  { id: "suppliers", label: "الموردون", hint: "الأسماء والأرصدة نقدًا ووزنًا",
    cols: ["ref", "name", "phone", "balanceCash", "balanceFine", "note"] },
];

const RECOVERY_WINDOW_MIN = 10;

const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const CUST_EVENTS = {
  open:      { label: "فتح ملف",        icon: "UserRound",  tone: "text2" },
  sale:      { label: "فاتورة بيع",     icon: "Receipt",    tone: "good" },
  sale_cred: { label: "بيع آجل",        icon: "Receipt",    tone: "accent" },
  ret:       { label: "مرتجع",          icon: "RotateCcw",  tone: "bad" },
  receipt:   { label: "سند قبض",        icon: "Banknote",   tone: "good" },
  repair:    { label: "إصلاح",          icon: "Wrench",     tone: "accent" },
  repair_out:{ label: "تسليم إصلاح",    icon: "Handshake",  tone: "good" },
  reserve:   { label: "حجز",            icon: "BookmarkCheck", tone: "accent" },
  reserve_out:{ label: "تسليم حجز",     icon: "Handshake",  tone: "good" },
  trust_in:  { label: "إيداع أمانة",    icon: "Landmark",   tone: "accent" },
  trust_out: { label: "سحب أمانة",      icon: "Landmark",   tone: "bad" },
  trust_buy: { label: "شراء برصيده",    icon: "Coins",      tone: "good" },
  trust_sell:{ label: "بيع من رصيده",   icon: "Coins",      tone: "bad" },
};

const PRICE_SOURCES = [
  {
    id: "exchangerate",
    label: "exchangerate.host",
    // XAU مقابل SAR مباشرةً — بلا مفتاح
    url: "https://api.exchangerate.host/latest?base=XAU&symbols=SAR",
    parse: (j) => {
      const perOunce = Number(j?.rates?.SAR);
      if (!Number.isFinite(perOunce) || perOunce <= 0) return null;
      // الأوقية الترويّة = 31.1034768 جم
      return perOunce / 31.1034768;
    },
  },
  {
    id: "frankfurter",
    label: "frankfurter.app",
    url: "https://api.frankfurter.app/latest?from=XAU&to=SAR",
    parse: (j) => {
      const perOunce = Number(j?.rates?.SAR);
      if (!Number.isFinite(perOunce) || perOunce <= 0) return null;
      return perOunce / 31.1034768;
    },
  },
  {
    id: "coingecko",
    label: "coingecko",
    // بديلٌ يمرّ عبر الدولار
    url: "https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=sar",
    parse: (j) => {
      const perOunce = Number(j?.["pax-gold"]?.sar);
      if (!Number.isFinite(perOunce) || perOunce <= 0) return null;
      return perOunce / 31.1034768;
    },
  },
];

const PRICE_SANE = { min: 80, max: 2000 };

const QR_ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

const QR_EXP = (() => { const e = new Uint8Array(512), l = new Uint8Array(256); let x = 1;
  for (let i = 0; i < 255; i++) { e[i] = x; l[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) e[i] = e[i - 255];
  return { e, l }; })();

const QR_VER = { 1: [21, 17, 7], 2: [25, 32, 10], 3: [29, 53, 15], 4: [33, 78, 20] };

const C128 = "212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,114131,311141,411131,211412,211214,211232,2331112".split(",");


/// مُنشئ الاستعلام — الحقول المتاحة للترشيح وأنواع العمليات المقارنة
/// عليها (نظير القائمة نفسها في المرجع، بلا تغيير — الحقول عامة على أي
/// دفترين money/weight ولا تخصّ عمليات بعينها فتحتاج توسيعًا مع JOURNALS).
const QUERY_FIELDS = [
  { id: "account", label: "الحساب", kind: "account",
    hint: "يشمل الحسابات الفرعية تحته" },
  { id: "journal", label: "اليومية", kind: "select" },
  { id: "opType", label: "نوع العملية", kind: "text" },
  { id: "amount", label: "المبلغ", kind: "number", unit: "money" },
  { id: "weight", label: "الوزن", kind: "number", unit: "weight" },
  { id: "by", label: "من رحّله", kind: "text" },
  { id: "ref", label: "المرجع", kind: "text" },
  { id: "note", label: "البيان", kind: "text" },
  { id: "noDoc", label: "بلا مستند مرفق", kind: "bool" },
  { id: "reversed", label: "مُعكَّس", kind: "bool" },
];

const QUERY_OPS = [
  { id: "eq", label: "يساوي" },
  { id: "gt", label: "أكبر من" },
  { id: "lt", label: "أصغر من" },
  { id: "between", label: "بين" },
  { id: "has", label: "يحتوي" },
  { id: "not", label: "لا يحتوي" },
];

export { ACCOUNT_GROUPS, ACCOUNT_TREE, AI_APP_MANUAL, AI_PROMPTS, AI_SYSTEM_RULES, ALL_ACCOUNT_NODES, APP_MODES, ATTACH_PREFIX, B32, BREAKPOINTS, C128, CASH_ACCOUNT_OF, CASH_LEDGER_CODES, CATEGORY_STATE, COMPARE_MODES, CUST_EVENTS, DEFAULT_APP_MODE, DEFAULT_CATEGORIES, DEFAULT_INTEGRATION, DEFAULT_OPENING_BALANCE, DEFAULT_PRINTER, DEFAULT_SETTINGS, DEFAULT_STORE, DEFAULT_USERS, DEMO_VERSION, DOC_CYCLE, DOC_REFS, EXCHANGE_KINDS, EXCHANGE_VERSION, EXPENSE_ACCOUNT_OF, EXPENSE_CATEGORIES, EXT_SAMPLE, FIX_KINDS, ISSUE_REASONS, KPI_DEFS, LEGACY_ACCOUNT_NODES, LOGO_FADE_MS, LOGO_SWAP_MS, MANUAL_ACCOUNT_TREE, MAX_ATTACH_BYTES, MGR_FEE_DEFAULT, MIGRATION_FLAG, NHR, NHR_POWER_MAX_DBM, OUNCE_SECRET, PARTNER_REQUIRED, PRICE_SANE, PRICE_SOURCES, PRINTER_SERVICES, PUBLISH_CAP, QR_ALNUM, QR_EXP, QR_VER, RECOVERY_ALPHABET, RECOVERY_WINDOW_MIN, REPORT_RANGES, RFID_DEFAULTS, RFID_MODES, RFID_SECTIONS, ROLES, QUERY_FIELDS, QUERY_OPS, STATEMENT_ENTITIES, STORE_SAMPLE, TRUST_MOVES, WAGES_LEDGER_CODES };

