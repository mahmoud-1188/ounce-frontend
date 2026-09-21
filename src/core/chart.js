import { ISSUE_REASONS } from "./constants.js";

const ACC_UNIT = {
  currency: "عملة",
  gram: "جرام صافٍ",
  both: "عملة + جرام",
};

/// طبيعة الرصيد: مدين أو دائن.

const ACC_NATURE = { debit: "مدين", credit: "دائن" };

/// القائمة التي ينتمي إليها الحساب.

const ACC_STATEMENT = {
  balance: "الميزانية",
  income: "قائمة الدخل",
  offBalance: "خارج الميزانية",
};

const CHART_OF_ACCOUNTS = [
  // ═══ ١ الأصول ═══
  { code: "1000", name: "الأصول", parent: null, unit: "both", nature: "debit", statement: "balance", group: true },

  { code: "1100", name: "النقدية وما في حكمها", parent: "1000", unit: "currency", nature: "debit", statement: "balance", group: true },
  { code: "1110", name: "الخزنة — نقدي", parent: "1100", unit: "currency", nature: "debit", statement: "balance", pool: "safe", method: "cash" },
  { code: "1120", name: "الخزنة — شبكة", parent: "1100", unit: "currency", nature: "debit", statement: "balance", pool: "safe", method: "network" },
  { code: "1130", name: "الصندوق اليومي — نقدي", parent: "1100", unit: "currency", nature: "debit", statement: "balance", pool: "daily", method: "cash" },
  { code: "1140", name: "الصندوق اليومي — شبكة", parent: "1100", unit: "currency", nature: "debit", statement: "balance", pool: "daily", method: "network" },
  { code: "1150", name: "عهدة شراء الكسر", parent: "1100", unit: "currency", nature: "debit", statement: "balance", pool: "custody", method: "cash" },

  // مخزون الذهب — يُمسك بالوحدتين: الوزن حقيقة والقيمة تقدير
  { code: "1200", name: "مخزون الذهب", parent: "1000", unit: "both", nature: "debit", statement: "balance", group: true },
  { code: "1210", name: "ذهب مشغول — جاهز للبيع", parent: "1200", unit: "both", nature: "debit", statement: "balance" },
  { code: "1220", name: "ذهب كسر بالخزنة", parent: "1200", unit: "both", nature: "debit", statement: "balance" },
  // ⚠ خزنة الكسر غير خزنة المشغول.
  //
  // خلطهما يجعل جرد الخزنة يعدّ ذهبًا لم يُصفَّ مع بضاعةٍ جاهزة —
  // ويُسدَّد مورد من رصيدٍ نصفه لم يُوزن.
  { code: "1225", name: "خزنة الكسر — ذهب مُصفّى", parent: "1200", unit: "gram",
    nature: "debit", statement: "balance" },
  { code: "1230", name: "كسر — بانتظار التصفية", parent: "1200", unit: "both", nature: "debit", statement: "balance" },
  { code: "1240", name: "ذهب لدى مكاتب التسكير", parent: "1200", unit: "both", nature: "debit", statement: "balance" },

  { code: "1300", name: "المدينون", parent: "1000", unit: "currency", nature: "debit", statement: "balance", group: true },
  { code: "1310", name: "عملاء — مبيعات آجلة", parent: "1300", unit: "currency", nature: "debit", statement: "balance" },
  { code: "1320", name: "موردون — رصيد مدين", parent: "1300", unit: "both", nature: "debit", statement: "balance" },
  { code: "1330", name: "سلف وعُهد الموظفين", parent: "1300", unit: "currency", nature: "debit", statement: "balance" },
  // ⚠ التحويل بين الفروع نقلٌ لا خروج: الذهب يبقى في ملكك.
  // قيده خسارةً يُنقص ربحك عمّا هو، ويُظهر الفرع الآخر رابحًا بلا سبب.
  { code: "1350", name: "ذهب لدى فروع أخرى", parent: "1300", unit: "both",
    nature: "debit", statement: "balance" },
  { code: "1340", name: "مكاتب تسكير — رصيد مدين", parent: "1300", unit: "both", nature: "debit", statement: "balance" },

  // ═══ ٢ الالتزامات ═══
  { code: "2000", name: "الالتزامات", parent: null, unit: "both", nature: "credit", statement: "balance", group: true },

  { code: "2100", name: "الدائنون", parent: "2000", unit: "both", nature: "credit", statement: "balance", group: true },
  // ⚠ التزام المورد ببُعدين منفصلين: الذهب يُسدَّد ذهبًا والأجور نقدًا
  { code: "2110", name: "موردون — ذهب مستحق", parent: "2100", unit: "gram", nature: "credit", statement: "balance" },
  { code: "2120", name: "موردون — أجور مستحقة", parent: "2100", unit: "currency", nature: "credit", statement: "balance" },
  { code: "2130", name: "مكاتب تسكير — التزام", parent: "2100", unit: "both", nature: "credit", statement: "balance" },

  { code: "2200", name: "التزامات أخرى", parent: "2000", unit: "currency", nature: "credit", statement: "balance", group: true },
  { code: "2210", name: "عرابين وحجوزات عملاء", parent: "2200", unit: "currency", nature: "credit", statement: "balance" },
  { code: "2220", name: "عمولة مدير مستحقة — تحصيل", parent: "2200", unit: "currency", nature: "credit", statement: "balance" },
  // ⚠ حساب مستقل للعمولة: خلطها بالعمولات العامة (2340) يجعل كشف
  // المدير وكشف البائعين رقمًا واحدًا لا يُفصل.
  { code: "2240", name: "عمولة مدير مستحقة — إقفال", parent: "2200", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "2230", name: "رواتب مستحقة", parent: "2200", unit: "currency", nature: "credit", statement: "balance" },

  // ═══ ٣ حقوق الملكية ═══
  { code: "3000", name: "حقوق الملكية", parent: null, unit: "both", nature: "credit", statement: "balance", group: true },
  { code: "3100", name: "رأس المال", parent: "3000", unit: "both", nature: "credit", statement: "balance" },
  { code: "3200", name: "حسابات الشركاء", parent: "3000", unit: "both", nature: "credit", statement: "balance" },
  { code: "3300", name: "أرباح محتجزة", parent: "3000", unit: "currency", nature: "credit", statement: "balance" },
  { code: "3400", name: "سحوبات الملاك", parent: "3000", unit: "both", nature: "debit", statement: "balance" },

  // ═══ ٤ الإيرادات ═══
  { code: "4000", name: "الإيرادات", parent: null, unit: "currency", nature: "credit", statement: "income", group: true },

  // ⚠ الفصل الجوهري: البيع لا يُقيَّد إيرادًا كاملًا
  { code: "4100", name: "إيراد المبيعات", parent: "4000", unit: "currency", nature: "credit", statement: "income", group: true },
  { code: "4110", name: "قيمة المعدن المباع", parent: "4100", unit: "both", nature: "credit", statement: "income", note: "ليست ربحًا — معدن كنت تملكه" },
  { code: "4120", name: "ربح المصنعية والهامش", parent: "4100", unit: "currency", nature: "credit", statement: "income", note: "الربح التشغيلي الحقيقي" },
  // ⚠ فرعٌ عامّ للبيع: القيد كان يذهب للأب 4100 مباشرة.
  //
  // الرصيد في الأب لا يظهر تحت أيّ فرع، فمجموع الفروع لا يساوي أباها
  // ومن يقرأ التفصيل يرى أقلّ مما في الإجمالي بلا سبب ظاهر.
  { code: "4140", name: "إيراد بيع مشغولات", parent: "4100", unit: "currency",
    nature: "credit", statement: "income" },
  { code: "4130", name: "إيراد الإصلاحات", parent: "4100", unit: "currency", nature: "credit", statement: "income" },
  // ── مردودات المبيعات ──
  //
  // ⚠ حسابٌ مقابلٌ للإيراد لا مصروف: طبيعته مدينة وهو في مجموعة 4000.
  //
  // قيده مصروفًا يجعل الإيراد يظهر كاملًا في القائمة ثم تُخصم المردودات
  // من الربح — فيبدو المحل أكثر بيعًا مما باع، ونسبة المردودات تختفي
  // عن نظر من يراجع.
  { code: "4190", name: "مردودات المبيعات", parent: "4100", unit: "currency",
    nature: "debit", statement: "income" },

  { code: "4200", name: "أرباح رأسمالية", parent: "4000", unit: "currency", nature: "credit", statement: "income", group: true },
  { code: "4210", name: "ربح رأسمالي محقق من السعر", parent: "4200", unit: "currency", nature: "credit", statement: "income", note: "من السوق لا من التجارة" },
  { code: "4220", name: "خسارة رأسمالية محققة", parent: "4200", unit: "currency", nature: "debit", statement: "income" },
  { code: "4230", name: "فرق إعادة تقييم غير محقق", parent: "4200", unit: "currency", nature: "credit", statement: "income", note: "يُعرض ولا يُوزَّع" },

  { code: "4300", name: "إيرادات أخرى", parent: "4000", unit: "currency", nature: "credit", statement: "income", group: true },
  { code: "4310", name: "فائض تصفية الكسر", parent: "4300", unit: "both", nature: "credit", statement: "income" },
  { code: "4320", name: "فائض وزن", parent: "4300", unit: "both", nature: "credit", statement: "income" },
  { code: "4330", name: "زيادة بالجرد", parent: "4300", unit: "currency", nature: "credit", statement: "income" },
  // ⚠ فروق التثبيت حسابٌ مستقلّ لا «متنوّعة».
  //
  // من ثبّت ذهبًا بسعر 400 وكان تكلفته 380 ربح عشرين للجرام — وهذا
  // ربحُ سوقٍ لا ربحُ مصنعية. ودفنُه في «متنوّعة» يُخفي أهمّ رقمٍ في
  // تجارة الذهب: كم ربحتَ من تحرّك السعر وكم من الصنعة.
  { code: "4180", name: "أرباح تثبيت السعر", parent: "4100", unit: "currency",
    nature: "credit", statement: "income" },
  { code: "5180", name: "خسائر تثبيت السعر", parent: "5100", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "4390", name: "إيرادات متنوّعة", parent: "4300", unit: "currency",
    nature: "credit", statement: "income" },
  { code: "4340", name: "ذهب مُستخرَج بالإصلاح", parent: "4300", unit: "both", nature: "credit", statement: "income" },

  // ═══ ٥ تكلفة المبيعات ═══
  { code: "5000", name: "تكلفة المبيعات", parent: null, unit: "both", nature: "debit", statement: "income", group: true },

  { code: "5100", name: "تكلفة الذهب المباع", parent: "5000", unit: "both", nature: "debit", statement: "income", group: true },
  // ⚠ ورقةٌ لا أبٌ: القيد على 5100 الرئيسي يجلس فوق فروعه فلا يظهر
  // تحت أيٍّ منها، ومجموع الفروع لا يساوي أباها.
  { code: "5105", name: "تكلفة المبيعات — قطع مباعة", parent: "5100", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "5110", name: "مشتريات من الموردين", parent: "5100", unit: "both", nature: "debit", statement: "income" },
  { code: "5120", name: "شراء كسر", parent: "5100", unit: "both", nature: "debit", statement: "income" },
  { code: "5130", name: "شراء سبائك وكسر", parent: "5100", unit: "both", nature: "debit", statement: "income" },

  { code: "5200", name: "المصنعية", parent: "5000", unit: "currency", nature: "debit", statement: "income", group: true },
  { code: "5210", name: "أجور الموردين", parent: "5200", unit: "currency", nature: "debit", statement: "income" },
  { code: "5220", name: "مصنعية تصنيع من كسر", parent: "5200", unit: "currency", nature: "debit", statement: "income" },
  { code: "5240", name: "عمولة مدير", parent: "5200", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "5230", name: "إعدام مصنعية عند الصهر", parent: "5200", unit: "currency", nature: "debit", statement: "income" },

  { code: "5300", name: "الفاقد والهالك", parent: "5000", unit: "both", nature: "debit", statement: "income", group: true },
  { code: "5310", name: "هالك تصنيع", parent: "5300", unit: "both", nature: "debit", statement: "income" },
  { code: "5320", name: "ذهب مُضاف بالإصلاح", parent: "5300", unit: "both", nature: "debit", statement: "income" },
  { code: "5330", name: "عجز بالجرد", parent: "5300", unit: "both", nature: "debit", statement: "income" },

  // ═══ ٦ المصروفات التشغيلية ═══
  { code: "6000", name: "المصروفات التشغيلية", parent: null, unit: "currency", nature: "debit", statement: "income", group: true },
  { code: "6100", name: "الإيجارات", parent: "6000", unit: "currency", nature: "debit", statement: "income" },
  { code: "6200", name: "الرواتب والأجور", parent: "6000", unit: "currency", nature: "debit", statement: "income" },
  { code: "6300", name: "الفواتير والخدمات", parent: "6000", unit: "currency", nature: "debit", statement: "income" },
  { code: "6400", name: "مشتريات غير ذهبية", parent: "6000", unit: "currency", nature: "debit", statement: "income" },
  { code: "6500", name: "عمولات الشبكة والبنوك", parent: "6000", unit: "currency", nature: "debit", statement: "income" },
  { code: "6600", name: "رسوم حكومية", parent: "6000", unit: "currency", nature: "debit", statement: "income" },
  { code: "6900", name: "مصروفات أخرى", parent: "6000", unit: "currency", nature: "debit", statement: "income" },

  // ═══ ٧ حسابات نظامية ═══
  // ═══════════════════════════════════════════════════════════════
  //  الأصول الثابتة ومجمّع الإهلاك
  //
  //  ⚠ المجمّع حسابٌ مقابلٌ للأصل لا التزام: طبيعته دائنة وهو في
  //  مجموعة 1000. وضعه في الالتزامات يجعل الميزانية تنتفخ من الطرفين
  //  ويخفي صافي قيمة الأصل.
  // ═══════════════════════════════════════════════════════════════
  { code: "1400", name: "الأصول الثابتة", parent: "1000", unit: "currency",
    nature: "debit", statement: "balance" },
  { code: "1410", name: "أثاث وتجهيزات المحل", parent: "1400", unit: "currency",
    nature: "debit", statement: "balance" },
  { code: "1420", name: "فاترينات وخزائن عرض", parent: "1400", unit: "currency",
    nature: "debit", statement: "balance" },
  { code: "1430", name: "خزنة حديدية", parent: "1400", unit: "currency",
    nature: "debit", statement: "balance" },
  { code: "1440", name: "أجهزة وحاسبات وموازين", parent: "1400", unit: "currency",
    nature: "debit", statement: "balance" },
  { code: "1450", name: "سيارات", parent: "1400", unit: "currency",
    nature: "debit", statement: "balance" },
  { code: "1460", name: "تحسينات على مأجور", parent: "1400", unit: "currency",
    nature: "debit", statement: "balance" },
  { code: "1490", name: "مجمّع إهلاك الأصول الثابتة", parent: "1400", unit: "currency",
    nature: "credit", statement: "balance" },

  // ── التزامات الموظفين ──
  { code: "2300", name: "مستحقات الموظفين", parent: "2000", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "2310", name: "رواتب مستحقة", parent: "2300", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "2320", name: "التأمينات الاجتماعية المستحقة", parent: "2300", unit: "currency",
    nature: "credit", statement: "balance" },
  // ⚠ مخصّص نهاية الخدمة التزامٌ يتراكم شهريًا لا يُدفع مرة.
  // تأجيله لموعد الدفع يجعل الربح أعلى من حقيقته طوال سنوات الخدمة،
  // ثم يهبط فجأةً في شهر المغادرة.
  { code: "2330", name: "مخصّص نهاية الخدمة", parent: "2300", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "2340", name: "عمولات مستحقة", parent: "2300", unit: "currency",
    nature: "credit", statement: "balance" },
  // ══════════════════════════════════════════════════════════════
  //  حسابات العملاء الجارية — الأمانة
  //
  //  ⚠ التزامٌ لا إيراد. ما أودعه العميل ليس مالي ولا ذهبي — أحفظه
  //  له ويسحبه متى شاء.
  //
  //  وقيده إيرادًا خطأٌ فادح: يُظهر ربحًا لم يقع، ويُدفع عليه زكاةً
  //  ليست عليك، وحين يسحبه العميل يظهر خسارةً لم تخسرها.
  //
  //  والمحل هنا كالبنك: يحفظ ويُقيّد ويُسلّم عند الطلب.
  // ══════════════════════════════════════════════════════════════
  // موردو الأصول غير موردي الذهب: ديونٌ تُسدَّد نقدًا لا وزنًا، ولا تدخل
  // كشف الموردين ولا التزام الذهب.
  { code: "2140", name: "دائنون — موردو أصول", parent: "2100", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "2400", name: "حسابات العملاء — أمانة", parent: "2000", unit: "both",
    nature: "credit", statement: "balance" },
  { code: "2410", name: "أمانة نقدية — أرصدة العملاء", parent: "2400",
    unit: "currency", nature: "credit", statement: "balance" },
  { code: "2420", name: "أمانة ذهب — أرصدة العملاء", parent: "2400",
    unit: "gram", nature: "credit", statement: "balance" },
  { code: "2350", name: "سلف موظفين", parent: "2300", unit: "currency",
    nature: "debit", statement: "balance" },

  // ── مصروفات الموظفين ──
  { code: "6700", name: "مصروفات الموظفين", parent: "6000", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "6710", name: "الرواتب الأساسية", parent: "6700", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "6720", name: "بدل سكن", parent: "6700", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "6730", name: "بدل مواصلات", parent: "6700", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "6740", name: "حصة المنشأة في التأمينات", parent: "6700", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "6750", name: "مصروف نهاية الخدمة", parent: "6700", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "6760", name: "عمولات البائعين", parent: "6700", unit: "currency",
    nature: "debit", statement: "income" },

  // ── الإهلاك ──
  { code: "6800", name: "مصروف الإهلاك", parent: "6000", unit: "currency",
    nature: "debit", statement: "income" },
  // ⚠ خسارة الاستبعاد ليست إهلاكًا: الإهلاك تخصيصٌ مخطَّط، والخسارة
  // فرقٌ بين الدفتري والمتحصّل. خلطهما يُخفي جودة قرار الشراء.
  { code: "6810", name: "خسائر استبعاد أصول", parent: "6000", unit: "currency",
    nature: "debit", statement: "income" },

  { code: "7000", name: "حسابات نظامية", parent: null, unit: "both", nature: "debit", statement: "offBalance", group: true },
  { code: "7100", name: "ذهب أمانة لدى المحل", parent: "7000", unit: "gram", nature: "debit", statement: "offBalance", note: "ملك العميل — لا يدخل الميزانية" },
  { code: "7200", name: "بضاعة محجوزة", parent: "7000", unit: "both", nature: "debit", statement: "offBalance" },
  { code: "7300", name: "تحويلات داخلية", parent: "7000", unit: "both", nature: "debit", statement: "offBalance", note: "طرفاها يُلغيان بعضهما" },

  // ══════════════════════════════════════════════════════════════════
  //  الحسابات الانتقالية
  //
  //  ⚠ بضاعةٌ بين حالتين ليست في أيٍّ منهما. وبلا حسابٍ لها تختفي من
  //  الدفترين بين الخروج والوصول — أو تُحسب مرتين.
  // ══════════════════════════════════════════════════════════════════
  { code: "1245", name: "ذهب مباع لم يُسلَّم", parent: "1200", unit: "both",
    nature: "debit", statement: "balance" },
  { code: "1246", name: "ذهب وارد بالطريق", parent: "1200", unit: "both",
    nature: "debit", statement: "balance" },
  { code: "1290", name: "تحويلات بين الفروع — وسيط", parent: "1200", unit: "both",
    nature: "debit", statement: "balance" },

  // ══════════════════════════════════════════════════════════════════
  //  المخصصات
  //
  //  ⚠ بلاها أرباحك مبالَغٌ فيها: تحسب ديونًا لن تُحصَّل وبضاعةً لن
  //  تُباع بسعرها. والمخصص لا يُخرج نقدًا — يُصحّح رقمًا.
  //
  //  وطبيعتها دائنة رغم أنها في الأصول: حساباتٌ مقابلة تُنقص ما فوقها.
  // ══════════════════════════════════════════════════════════════════
  { code: "1195", name: "مخصص ديون مشكوك في تحصيلها", parent: "1100", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "1295", name: "مخصص هبوط قيمة المخزون", parent: "1200", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "1180", name: "مصروفات مدفوعة مقدمًا", parent: "1100", unit: "currency",
    nature: "debit", statement: "balance" },
  { code: "2250", name: "مصروفات مستحقة غير مدفوعة", parent: "2200", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "6910", name: "مصروف مخصص الديون المشكوك فيها", parent: "6901", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "6920", name: "مصروف هبوط قيمة المخزون", parent: "6901", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "6901", name: "المخصصات", parent: "6000", unit: "currency",
    nature: "debit", statement: "income", group: true },

  // ══════════════════════════════════════════════════════════════════
  //  الضمانات
  //
  //  ⚠ خارج الميزانية عمدًا: كفالةٌ أعطيتَها ليست مصروفًا ولا التزامًا
  //  حتى تُطالَب بها — لكنها تُذكَر، فمن يقرأ الميزانية يحتاج أن يعرف.
  // ══════════════════════════════════════════════════════════════════
  { code: "7400", name: "ضمانات وكفالات صادرة", parent: "7000", unit: "currency",
    nature: "debit", statement: "memo" },
  { code: "7500", name: "ضمانات وكفالات واردة", parent: "7000", unit: "currency",
    nature: "credit", statement: "memo" },

  // ═══ ما يطلبه المراجع الخارجي والزكاة والدخل ═══
  //
  // ⚠ كشفُ حسابٍ لجهةٍ رسمية يحتاج حساباتٍ بأسمائها المعروفة عندها.
  // «مصروفات أخرى» لا تُقبل جوابًا عن «كم دفعتم ضريبةً هذا العام؟».

  // الضريبة والزكاة — طرفان لا طرف
  { code: "1360", name: "ضريبة القيمة المضافة — مدخلات", parent: "1300", unit: "currency",
    nature: "debit", statement: "balance" },
  { code: "2225", name: "ضريبة القيمة المضافة — مخرجات", parent: "2200", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "2227", name: "الزكاة المستحقة", parent: "2200", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "6550", name: "مصروف الزكاة والضرائب", parent: "6000", unit: "currency",
    nature: "debit", statement: "income" },

  // الأوراق التجارية — الشيك التزامٌ قبل أن يُصرف
  { code: "1315", name: "شيكات برسم التحصيل", parent: "1300", unit: "currency",
    nature: "debit", statement: "balance" },
  { code: "2255", name: "شيكات صادرة — لم تُصرف", parent: "2200", unit: "currency",
    nature: "credit", statement: "balance" },

  // التمويل
  { code: "2270", name: "قروض قصيرة الأجل", parent: "2200", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "2500", name: "التزامات طويلة الأجل", parent: "2000", unit: "currency",
    nature: "credit", statement: "balance", group: true },
  { code: "2510", name: "قروض طويلة الأجل", parent: "2500", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "6560", name: "فوائد وأعباء تمويلية", parent: "6000", unit: "currency",
    nature: "debit", statement: "income" },

  // حقوق الملكية — ما يطلبه النظام السعودي
  { code: "3150", name: "جاري الشركاء", parent: "3000", unit: "currency",
    nature: "credit", statement: "balance" },
  { code: "3250", name: "الاحتياطي النظامي", parent: "3000", unit: "currency",
    nature: "credit", statement: "balance" },

  // الخصومات — طرفٌ مستقل لا خصمٌ من الإيراد
  //
  // ⚠ الخصم الممنوح يُقيَّد مدينًا مستقلًّا لا يُنقص الإيراد مباشرةً:
  // مراجعٌ يسأل «كم خصمتم؟» لا يجد جوابًا إن ذاب في رقم المبيعات.
  { code: "4155", name: "خصومات ممنوحة للعملاء", parent: "4100", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "5185", name: "خصم مكتسب من الموردين", parent: "5100", unit: "currency",
    nature: "credit", statement: "income" },
  { code: "5175", name: "مشتريات مردودة للموردين", parent: "5100", unit: "currency",
    nature: "credit", statement: "income" },

  // الجرد الدوري — طرفا قائمة الدخل
  //
  // ⚠ النظام دوري: تكلفة المبيعات = مخزون أول + مشتريات − مخزون آخر.
  // بلا هذين الحسابين لا تُبنى قائمة دخلٍ يقبلها مراجع.
  { code: "5150", name: "مخزون أول المدة", parent: "5100", unit: "currency",
    nature: "debit", statement: "income" },
  { code: "5160", name: "مخزون آخر المدة", parent: "5100", unit: "currency",
    nature: "credit", statement: "income" },

];

/// خريطة التصنيفات القديمة إلى أكواد الشجرة.
/// الاحتفاظ بها يجعل السجلات التاريخية تُقرأ بالهيكل الجديد بلا ترحيل.

const CATEGORY_TO_ACCOUNT = {
  sales_revenue: "4140",
  gold_metal_value: "4110",
  workmanship_profit: "4120",
  repair_income: "4130",
  metal_capital_gain: "4210",
  metal_capital_loss: "4220",
  revaluation_gain: "4230",
  scrap_surplus_income: "4310",
  gold_weight_surplus: "4320",
  cash_surplus: "4330",
  repair_gold_removed: "4340",
  customer_deposit: "2210",
  other_income: "4390",
  sales_return: "4190",

  gold_purchase_supplier: "5110",
  inventory_purchase: "5110",
  supplier_settlement: "5110",
  gold_purchase_scrap: "5120",
  scrap_purchase: "5120",
  gold_purchase_bullion: "5130",
  gold_workmanship: "5210",
  scrap_to_product_wm: "5220",
  workmanship_writeoff: "5230",
  gold_wastage: "5310",
  repair_gold_added: "5320",
  cash_shortage: "5330",

  operating_expense: "6900",
  non_gold_purchase: "6400",
  network_fees: "6500",
  customer_deposit_refund: "2210",
  other_expense: "6900",

  capital_injection: "3100",
  owner_withdrawal: "3400",

  transfer_from_daily: "7300",
  transfer_from_safe: "7300",
  transfer_from_custody: "7300",
  transfer_to_safe: "7300",
  transfer_to_daily: "7300",
  transfer_to_custody: "7300",
  // ══════════════════════════════════════════════════════════════
  //  فئات المصروفات ← حساباتها
  //
  //  ⚠ كانت السبع كلها بلا حساب: المصروف يُسجَّل ويظهر في التقرير
  //  ولا يصل حسابًا في الشجرة. فالميزان لا يراه، والقائمة لا تُظهره،
  //  ومن يقرأ الربح يقرأه أعلى مما هو.
  //
  //  ولم يُكتشف لأن كل طرف سليم وحده: المصروف محفوظ، والشجرة صحيحة،
  //  والوصل بينهما غائب.
  // ══════════════════════════════════════════════════════════════
  rent: "6100",              // إيجار المحل
  bills: "6300",             // كهرباء وماء واتصالات
  government: "6400",        // رسوم حكومية
  salaries: "6710",          // الرواتب الأساسية
  // ⚠ السلفة أصلٌ لا مصروف: تُسترد من الراتب. قيدها مصروفًا يُحمّل
  // الشهر ضِعف تكلفته ثم يُنقصه حين تُخصم.
  advance: "2350",           // سلف موظفين — أصل داخل الالتزامات
  // ⚠ «مشتريات» هنا غير الذهب: مستلزمات المحل لا بضاعة للبيع.
  purchases: "6900",         // مصروفات أخرى
  other: "6900",

  // ⚠ سداد مكتب التسكير يُنقص التزامه لا يُنشئ مصروفًا
  taskir_settlement: "2130",
  // ⚠ التثبيت: نقدٌ يدخل الخزنة مقابل ذهبٍ خرج — أو العكس
  price_fix_in: "4180",
  price_fix_out: "5180",
  gosi: "2320",
  eos: "2330",
  asset_purchase: "1410",   // للتصنيف النقدي فقط؛ القيد يأخذ حساب الفئة الفعلي
  asset_sale: "4210",
};

const POSTING_RULES = {
  // ── المبيعات ──
  // ══ التثبيت — الجسر الوحيد بين الدفترين ══
  //
  // ⚠ قيدٌ في الدفترين معًا: الوزن يخرج من الخزنة والنقد يدخلها.
  // أحدهما بلا الآخر يجعل ذهبًا يختفي أو نقدًا يظهر من لا شيء.
  price_fix_sell: {
    label: "تثبيت ذهب → نقد",
    cash: { debit: "1110", credit: "4180" },      // الخزنة ← أرباح التثبيت
    weight: { from: "1220", to: null },           // يخرج من ذهب الخزنة
    note: "الوزن بمعادل 24 · المبلغ = الوزن × سعر التثبيت · الفرق عن التكلفة يُفصل لاحقًا",
  },
  price_fix_buy: {
    label: "تثبيت نقد → ذهب",
    cash: { debit: "5180", credit: "1110" },      // خسائر/تكلفة ← الخزنة
    weight: { from: null, to: "1220" },           // يدخل ذهب الخزنة
    note: "النقد يخرج بسعر التثبيت والوزن يدخل بمعادل 24",
  },
  sale_cash: {
    label: "بيع نقدي",
    cash: { debit: "1130", credit: "4140" },     // الصندوق اليومي ← إيراد المبيعات
    weight: { from: "1210", to: null },          // يخرج من المخزون
    note: "الإيراد يُفكَّك لاحقًا: قيمة معدن 4110 وربح 4120",
  },
  sale_card: {
    label: "بيع بالشبكة",
    cash: { debit: "1140", credit: "4140" },
    weight: { from: "1210", to: null },
  },
  sale_credit: {
    label: "بيع آجل",
    cash: { debit: "1310", credit: "4140" },     // ذمم العملاء
    weight: { from: "1210", to: null },
  },
  sale_partial: {
    label: "بيع بالوزن",
    cash: { debit: "1130", credit: "4140" },
    weight: { from: "1210", to: null },
    note: "القطعة تبقى وينقص وزنها",
  },
  sale_return: {
    label: "مرتجع بيع",
    cash: { debit: "4140", credit: "1130" },
    weight: { from: null, to: "1210" },
  },
  // ── الحسابات الانتقالية ──
  //
  // ⚠ بيعٌ لم يُسلَّم: خرج من «جاهز للبيع» ولم يخرج من المحل. ولو تُرك
  // في المخزون لبِيع مرتين، ولو أُخرج لاختفى.
  sold_undelivered: {
    label: "بيع لم يُسلَّم",
    cash: null,
    weight: { from: "1210", to: "1245" },
    note: "يخرج من الجاهز ويبقى في عهدة المحل حتى التسليم",
  },
  delivered_out: {
    label: "تسليم بيعٍ مؤجّل",
    cash: null,
    weight: { from: "1245", to: null },
    note: "الخروج النهائي عند التسليم",
  },
  goods_in_transit: {
    label: "ذهب وارد بالطريق",
    cash: { debit: "1246", credit: "1110" },
    weight: { from: null, to: "1246" },
    note: "دُفع ولم يصل — ليس مخزونًا بعد",
  },
  transit_received: {
    label: "استلام الوارد",
    cash: { debit: "1210", credit: "1246" },
    weight: { from: "1246", to: "1210" },
    note: "وصل فصار مخزونًا",
  },
  branch_out: {
    label: "تحويل لفرع آخر",
    cash: null,
    weight: { from: "1210", to: "1290" },
    note: "⚠ يبقى في الوسيط حتى يؤكّد الفرع الآخر — بلاه يختفي بين الاثنين",
  },
  branch_in: {
    label: "استلام من فرع",
    cash: null,
    weight: { from: "1290", to: "1210" },
    note: "يُغلق الوسيط عند التأكيد",
  },

  // ── المخصصات ──
  //
  // ⚠ لا نقد يتحرّك: المخصص يُصحّح رقمًا لا يدفع مالًا. ومن يظنّه صرفًا
  // يبحث عن المبلغ في الصندوق ولا يجده.
  provision_doubtful: {
    label: "مخصص ديون مشكوك فيها",
    cash: { debit: "6910", credit: "1195" },
    weight: null,
    note: "يُقلّل الذمم بلا مسّ النقد",
  },
  provision_inventory: {
    label: "مخصص هبوط قيمة المخزون",
    cash: { debit: "6920", credit: "1295" },
    weight: null,
    note: "بضاعةٌ راكدة قيمتها الدفترية فوق قيمتها السوقية",
  },
  accrue_expense: {
    label: "مصروف مستحق",
    cash: { debit: "6100", credit: "2250" },
    weight: null,
    note: "استُهلك ولم يُدفع — يُحمَّل على شهره لا على شهر الدفع",
  },
  prepaid_expense: {
    label: "مصروف مدفوع مقدمًا",
    cash: { debit: "1180", credit: "1110" },
    weight: null,
    note: "دُفع ولم يُستهلك — أصلٌ حتى يُستهلك",
  },

  workmanship_accrued: {
    label: "أجور مورّد مستحقة",
    cash: { debit: "5210", credit: "2120" },
    weight: null,
    note: "تُقيَّد عند الشراء الآجل — تُسوّى عند السداد",
  },

  // ── إخراج ذهب وكسر بدل ──
  //
  // ⚠ كانتا تُستدعيان ولا توجدان: `buildWeightEntries` يُرجع [] بصمت،
  // فالذهب الخارج (تلف، إعادة لمورّد، تحويل لفرع) لا ينقص من الدفتر
  // الوزني أبدًا. مخزونٌ دفتري يزيد عن الواقع بكل ما خرج — والجرد
  // يُظهر عجزًا لا سبب له.
  gold_out: {
    label: "إخراج ذهب",
    cash: null,
    // الوجهة تُبدَّل من الاستدعاء بحسب السبب: مورّد 1320، كسر 1230،
    // فرع 1290، تلف/فقد 5310، هدية 6900
    weight: { from: "1210", to: "5310" },
    note: "الوجهة من ISSUE_REASONS — لا تختفي القطعة أبدًا",
  },
  purchase_scrap: {
    label: "كسر بدلٌ في فاتورة",
    cash: null,
    weight: { from: null, to: "1230" },
    note: "كسر الزبون يدخل صندوق الكسر — قيمته تُقاصّ بالفاتورة",
  },

  // ── تحويل عهدة ──
  float_out: {
    label: "تسليم عهدة",
    cash: { debit: "1130", credit: "1110" },
    weight: null,
    note: "الحسابان يُبدَّلان من الاستدعاء حسب الصندوق المستلِم",
  },
  float_in: {
    label: "ردّ عهدة",
    cash: { debit: "1110", credit: "1130" },
    weight: null,
  },

  mgr_fee: {
    label: "عمولة مدير",
    cash: { debit: "5240", credit: "2240" },
    weight: null,
    note: "تُستحقّ عند اعتماد الإقفال وتُصرف من كشف المدير",
  },

  network_fee: {
    label: "عمولة الشبكة",
    cash: { debit: "6500", credit: "1140" },
    weight: null,
    note: "مصروف تشغيلي لا يُنقص الإيراد",
  },
  vat_collected: {
    label: "عمولة مستحقة",
    cash: { debit: "1130", credit: "2220" },
    weight: null,
  },

  // ── المشتريات ──
  purchase_cash: {
    label: "شراء من مورد نقدًا",
    cash: { debit: "5110", credit: "1110" },
    weight: { from: null, to: "1210" },
  },
  purchase_network: {
    label: "شراء بالشبكة",
    cash: { debit: "5110", credit: "1120" },
    weight: { from: null, to: "1210" },
  },
  purchase_deferred: {
    label: "شراء آجل",
    cash: null,                                   // لا نقد يتحرك
    weight: { from: null, to: "1210" },
    liability: { gold: "2110", fees: "2120" },   // ⚠ التزام ببُعدين
    note: "الذهب يُستحق بالجرام والأجور بالعملة — لا يُخلطان",
  },
  purchase_office: {
    label: "شراء بتسكير مكتب",
    cash: null,
    weight: { from: null, to: "1210" },
    liability: { office: "2130" },
  },
  purchase_scrap_pay: {
    label: "شراء مسدَّد بالكسر",
    cash: null,
    weight: { from: "1230", to: "1210" },        // كسر ← مخزون
    note: "الأجور تُدفع نقدًا دائمًا",
  },
  workmanship_paid: {
    label: "أجور المورد",
    cash: { debit: "5210", credit: "1110" },
    weight: null,
  },

  // ── الكسر ──
  scrap_buy: {
    label: "شراء كسر",
    cash: { debit: "5120", credit: "1150" },     // من عهدة الكسر
    weight: { from: null, to: "1230" },
    stage: "in_box",
    note: "يدخل صندوق الكسر لا الخزنة — لم يُفحص بعد",
  },
  scrap_send: {
    label: "إرسال الكسر للفحص",
    cash: null,
    weight: null,                                 // نقل مرحلة لا وزن
    stageChange: { from: "in_box", to: "sent" },
  },
  scrap_assay_gain: {
    label: "فائض تقييم",
    cash: null,
    weight: { from: null, to: "1230" },
    revenue: "4320",
  },
  scrap_assay_loss: {
    label: "هالك تقييم",
    cash: null,
    weight: { from: "1230", to: null },
    cost: "5310",
    note: "الفصوص لم تكن ذهبًا",
  },
  scrap_receive: {
    label: "إدخال الكسر للخزنة",
    cash: null,
    weight: null,
    stageChange: { from: "approved", to: "in_safe" },
  },

  // ── التحويلات بين حالات الذهب ──
  scrap_to_product: {
    label: "تصنيع من كسر",
    cash: { debit: "5220", credit: "1110" },     // مصنعية التصنيع
    weight: { from: "1230", to: "1210" },
  },
  product_to_scrap: {
    label: "صهر قطعة",
    cash: null,
    weight: { from: "1210", to: "1230" },
    cost: "5230",
    note: "المصنعية تُعدم — الذهب يبقى",
  },
  repair_add: {
    label: "إضافة وزن بالإصلاح",
    cash: null,
    weight: { from: "1230", to: "1210" },
    cost: "5320",
  },
  repair_reduce: {
    label: "خصم وزن بالإصلاح",
    cash: null,
    weight: { from: "1210", to: "1230" },
    revenue: "4340",
  },

  // ── سداد الموردين ──
  settle_scrap: {
    label: "سداد مورد بالكسر",
    cash: null,
    weight: { from: "1230", to: null },
    liabilityDown: "2110",
    guard: "in_safe_only",
    note: "⚠ من الخزنة فقط — الكسر غير المفحوص وزن غير مؤكّد",
  },
  settle_safe_gold: {
    label: "سداد مورد من ذهب الخزنة",
    cash: null,
    weight: { from: "1220", to: null },
    liabilityDown: "2110",
  },
  depreciation: {
    label: "إهلاك الشهر",
    cash: null,
    weight: null,
    composite: true,
  },
  asset_purchase: {
    label: "شراء أصل ثابت",
    cash: { debit: "1410", credit: "1110" },
    weight: null,
    note: "⚠ أصل لا مصروف — يُستهلك سنوات لا شهرًا",
  },
  asset_disposal: {
    label: "استبعاد أصل",
    cash: null,
    weight: null,
    composite: true,
  },
  payroll_run: {
    label: "مسيّر رواتب",
    cash: { debit: "6710", credit: "2310" },
    weight: null,
    note: "⚠ حصة المنشأة مصروف عليها لا خصم من الموظف",
  },
  payroll_pay: {
    label: "صرف الرواتب",
    cash: { debit: "2310", credit: "1110" },
    weight: null,
    note: "سداد المستحق — لا مصروف جديد",
  },
  gosi_pay: {
    label: "سداد التأمينات",
    cash: { debit: "2320", credit: "1110" },
    weight: null,
  },
  eos_pay: {
    label: "صرف نهاية الخدمة",
    cash: { debit: "2330", credit: "1110" },
    weight: null,
    note: "من المخصّص المتراكم لا من مصروف الشهر",
  },
  settle_office_gold: {
    label: "سداد مكتب بالذهب",
    cash: null,
    // ⚠ الذهب يذهب إلى 2130 لا إلى null: يُغلق التزام المكتب الذي فُتح
    // عند `settle_office`. كان يخرج ويختفي، فيبقى المكتب دائنًا للأبد
    // ولو سُدّد كاملًا — والمراجع يرى دَينًا لا وجود له.
    weight: { from: "1220", to: "2130" },
    note: "⚖ ذهب يخرج من الخزنة ويُبرئ المكتب بمعادله عيار 24",
  },
  cogs_trueup: {
    label: "تسوية تكلفة المبيعات — إقفال",
    cash: { debit: "5105", credit: "1210" },
    weight: null,
    note: "الفرق بين ربح الدفتر وربح لقطات التكلفة يُقيَّد عند إقفال السنة",
  },
  settle_office_cash_gold: {
    label: "إغلاق التزام مكتب بالنقد",
    cash: null,
    weight: { from: null, to: "2130" },
    note: "الوزن المعادل للمبلغ يدخل 2130 فيُنقص الالتزام",
  },
  settle_office_cash: {
    label: "سداد مكتب نقدًا",
    cash: { debit: "2130", credit: "1130" },
    weight: null,
    note: "⚖ نقدٌ يُبرئ دَينًا ذهبيًا بسعر اليوم — لا بسعر يوم النشوء",
  },
  settle_office: {
    label: "سداد بتسكير مكتب",
    cash: null,
    weight: null,
    liabilityMove: { from: "2110", to: "2130" },
    note: "الالتزام ينتقل للمكتب — لا ذهب يخرج",
  },
  settle_fees: {
    label: "سداد أجور المورد",
    cash: { debit: "2120", credit: "1110" },
    weight: null,
  },

  // ── الخزنة وذهب الكسر ──
  safe_gold_in: {
    label: "إدخال ذهب للخزنة",
    cash: null,
    weight: { from: null, to: "1220" },
  },
  safe_gold_out: {
    label: "سحب ذهب من الخزنة",
    cash: null,
    weight: { from: "1220", to: null },
    requires: "destination",
    note: "الوجهة إجبارية — سحب بلا وجهة يضيع أثره",
  },
  // ⚠ الاتجاه: أنت تشتري من المكتب ولا تبيع له.
  //
  // كانت القاعدة تُقيَّد بيعًا (نقدٌ يدخل وذهبٌ يخرج) — وهو عكس ما يحدث:
  // المكتب مصدرُ سبائك عيار 24، فالنقد يخرج والوزن يدخل.
  taskir_buy: {
    label: "شراء ذهب من مكتب التسكير",
    cash: { debit: "5130", credit: "1110" },
    weight: { from: null, to: "1220" },
    note: "سبائك عيار 24 — تدخل خزنة الكسر ثم تُسوّى بها ديون الموردين",
  },

  // تسوية دَين المورد بذهبٍ من مخزون الكسر: وزنٌ يخرج والتزامٌ يسقط
  taskir_settle_scrap: {
    label: "تسوية مورد من الكسر",
    // ⚠ لا قيد نقدي: 2110 حسابُ جرامٍ لا يقبل ريالًا، وتكلفة الكسر
    // صُرفت يوم شرائه (5120). التسوية وزنٌ خالص.
    cash: null,
    // ⚠ الذهب يذهب إلى 2110 لا إلى null: يُغلق الالتزام الذي فُتح عند
    // الشراء. كان يختفي، فيبقى 2110 سالبًا للأبد ولو سُدّد كاملًا.
    weight: { from: "1230", to: "2110" },
    note: "⚖ الكسر يخرج بتكلفته ويُبرئ التزام الذهب على المورد",
  },

  // ── الفروقات ──
  wastage: {
    label: "هالك تصنيع",
    cash: null,
    weight: { from: "1210", to: null },
    cost: "5310",
  },
  gold_wastage: {
    label: "هالك وزن",
    // الوزن الناقص عند إقفال الدفعة: خسارةٌ بتكلفته تُخصم من المخزون
    //
    // ⚠ `5310` هالك التصنيع لا `5315` فروق الجرد. الأول خسارةٌ معروفة
    // السبب عند الصياغة، والثاني فرقٌ غير مفسَّر يُراجَع. وخلطهما يُخفي
    // السرقة داخل الهالك الطبيعي.
    cash: { debit: "5310", credit: "1210" },
    weight: { from: "1210", to: null },
  },

  weight_surplus: {
    label: "فائض وزن",
    // الوزن الزائد يزيد المخزون بقيمته ويُقابله إيراد غير تشغيلي
    cash: { debit: "1210", credit: "4320" },
    weight: { from: null, to: "1210" },
  },
  audit_missing: {
    label: "عجز جرد",
    // ⚠ الوزن يذهب لحسابٍ مقابل لا لـ`null`.
    //
    // كان يخرج من المخزون ويختفي — فلا أستاذ له، ومن يسأل «كم ضاع
    // هذا العام؟» لا يجد حسابًا يفتحه. الآن يتراكم في 5330 ويُقرأ.
    cash: { debit: "5330", credit: "1210" },
    weight: { from: "1210", to: "5330" },
  },

  // ── نقد صرف ──
  expense: { label: "مصروف تشغيلي", cash: { debit: "6900", credit: "1110" }, weight: null },
  salary: { label: "راتب", cash: { debit: "6200", credit: "1110" }, weight: null },
  rent: { label: "إيجار", cash: { debit: "6100", credit: "1110" }, weight: null },
  capital_in: { label: "مساهمة رأس مال", cash: { debit: "1110", credit: "3100" }, weight: null },
  owner_draw: { label: "سحب مالك", cash: { debit: "3400", credit: "1110" }, weight: null },
  customer_deposit: { label: "عربون", cash: { debit: "1130", credit: "2210" }, weight: null },
  repair_income: { label: "إيراد إصلاح", cash: { debit: "1130", credit: "4130" }, weight: null },
  receipt: { label: "تحصيل آجل", cash: { debit: "1130", credit: "1310" }, weight: null },
  cash_surplus: {
    label: "زيادة جرد",
    cash: { debit: "1130", credit: "4390" },
    weight: null,
    note: "عدُّ الصندوق فوق الدفتر — يُقيَّد إيرادًا عرضيًّا ويُراجَع",
  },
  cash_shortage: { label: "عجز جرد", cash: { debit: "5330", credit: "1130" }, weight: null },
  // ── خارج الميزانية ──
  // ⚠ الاستلام من الإدارة: الوزن يدخل مخزون الفرع مقابل حساب التحويلات
  // 1290 — لا مقابل رأس المال، فالبضاعة انتقلت داخل الشركة ولم تُشترَ.
  branch_receive: {
    label: "استلام شحنة من الإدارة",
    cash: null,
    // ⚠ من حساب التحويلات بين الفروع لا من رأس المال: البضاعة انتقلت
    // داخل الشركة ولم تُشترَ، فقيمتها لا تتغيّر — يتغيّر موضعها فقط.
    weight: { from: "1290", to: "1210" },
    note: "بضاعة مُكوَّدة من الإدارة تدخل مخزون الفرع برموزها",
  },
  trust_in: {
    label: "استلام ذهب أمانة",
    cash: null,
    weight: { from: null, to: "7100" },
    note: "ملك العميل — لا يدخل الميزانية",
  },
  trust_out: { label: "تسليم ذهب أمانة", cash: null, weight: { from: "7100", to: null } },
};

/// تصنيف اليوميات — نظير JOURNALS في المرجع بالمعنى لا بحجم القائمة:
/// المرجع صمَّم قائمته الأصغر لعملياته الأقل، ومنتجنا الحقيقي عنده 76
/// نوع عملية فعلي (POSTING_RULES أعلاه) — كل نوعٍ هنا مصنَّف بطبيعته
/// المحاسبية الحقيقية (لا بتخمين من اسمه)، مرة واحدة فقط، بلا نوعٍ
/// متروك خارج التصنيف الست (يذهب غير المصنَّف صراحةً لـ"العامة" فقط،
/// لا بصمت من afterEach).
///
/// ⚠ قرارات تصنيف تستحق التوثيق:
///   • customer_deposit/repair_income/receipt → مبيعات: كلها تدفّق نقدي
///     من/إلى العميل مباشرة، لا تشغيل داخلي.
///   • purchase_scrap (كسرٌ بدلٌ في فاتورة شراء) → مشتريات: جزء من
///     تسوية فاتورة شراء، لا حركة كسر عامة كـscrap_buy.
///   • taskir_buy/taskir_settle_scrap → مشتريات: كلاهما يخصّ تسوية دَين
///     مورّد عبر مكتب تسكير، لا يومية مستقلة له في المرجع أصلًا.
///   • price_fix_sell/price_fix_buy → نقدية: جسرٌ بين الدفترين لا بيع
///     عميل ولا شراء مورّد؛ أقرب لحركة خزنة/تسعير من الاثنين.
///   • gosi_pay/payroll_pay/eos_pay → نقدية لا رواتب: هذه *سداد* نقدي
///     لمستحقّ سابق (2310/2320/2330) لا تحميل مصروف رواتب جديد — التحميل
///     نفسه (payroll_run) وحده في يومية الرواتب.
///   • accrue_expense/prepaid_expense → نقدية: تسويات مصروف دورية، لا
///     تخصّ مخزونًا ولا رواتب ولا بيعًا/شراءً مباشرًا.
///   • provision_doubtful/provision_inventory/depreciation/asset_purchase/
///     asset_disposal/cogs_trueup → عامة: تسويات فترة/أصول ثابتة لا
///     تتكرّر يوميًّا كباقي اليوميات.
///   • trust_in/trust_out/branch_receive → مخزون: حركة وزنٍ بحتة (أمانة/
///     تحويل فروع) بلا أي أثر مالي مباشر.
const JOURNALS = [
  { id: "sales", label: "يومية المبيعات", prefix: "SAL",
    ops: ["sale_cash", "sale_card", "sale_credit", "sale_partial", "sale_return",
      "sold_undelivered", "delivered_out", "customer_deposit", "repair_income", "receipt"] },
  { id: "purchase", label: "يومية المشتريات", prefix: "PUR",
    ops: ["purchase_cash", "purchase_network", "purchase_deferred", "purchase_office",
      "purchase_scrap_pay", "purchase_scrap", "workmanship_paid", "workmanship_accrued",
      "settle_scrap", "settle_safe_gold", "settle_office_gold", "settle_office_cash_gold",
      "settle_office_cash", "settle_office", "settle_fees", "taskir_buy", "taskir_settle_scrap"] },
  { id: "cash", label: "يومية النقدية", prefix: "CSH",
    ops: ["expense", "salary", "rent", "capital_in", "owner_draw", "float_out", "float_in",
      "mgr_fee", "network_fee", "vat_collected", "cash_surplus", "cash_shortage",
      "price_fix_sell", "price_fix_buy", "gosi_pay", "payroll_pay", "eos_pay",
      "accrue_expense", "prepaid_expense"] },
  { id: "inventory", label: "يومية المخزون", prefix: "INV",
    ops: ["scrap_buy", "scrap_send", "scrap_assay_gain", "scrap_assay_loss", "scrap_receive",
      "scrap_to_product", "product_to_scrap", "repair_add", "repair_reduce", "gold_out",
      "goods_in_transit", "transit_received", "branch_out", "branch_in", "branch_receive",
      "safe_gold_in", "safe_gold_out", "wastage", "gold_wastage", "weight_surplus",
      "audit_missing", "trust_in", "trust_out"] },
  { id: "payroll", label: "يومية الرواتب", prefix: "PAY",
    ops: ["payroll_run"] },
  { id: "general", label: "اليومية العامة", prefix: "JRN",
    ops: ["provision_doubtful", "provision_inventory", "depreciation", "asset_purchase",
      "asset_disposal", "cogs_trueup"] },
];

/// الحسابات الوزنية المسموح بها — أي حساب خارجها في قيد وزني خطأ.

const WEIGHT_ACCOUNTS = ["1210", "1220", "1230", "1240", "2110", "7100", "7200"];

/// يبني قيد الوزن من قاعدة عملية. يُعيد سطرين: خروج ودخول.

export { ACC_NATURE, ACC_STATEMENT, ACC_UNIT, CATEGORY_TO_ACCOUNT, CHART_OF_ACCOUNTS, JOURNALS, POSTING_RULES, WEIGHT_ACCOUNTS };
