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
  { code: "1220", name: "ذهب خام بالخزنة", parent: "1200", unit: "both", nature: "debit", statement: "balance" },
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
  { code: "2220", name: "ضريبة القيمة المضافة المستحقة", parent: "2200", unit: "currency", nature: "credit", statement: "balance" },
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
  { code: "4390", name: "إيرادات متنوّعة", parent: "4300", unit: "currency",
    nature: "credit", statement: "income" },
  { code: "4340", name: "ذهب مُستخرَج بالإصلاح", parent: "4300", unit: "both", nature: "credit", statement: "income" },

  // ═══ ٥ تكلفة المبيعات ═══
  { code: "5000", name: "تكلفة المبيعات", parent: null, unit: "both", nature: "debit", statement: "income", group: true },

  { code: "5100", name: "تكلفة الذهب المباع", parent: "5000", unit: "both", nature: "debit", statement: "income", group: true },
  { code: "5110", name: "مشتريات من الموردين", parent: "5100", unit: "both", nature: "debit", statement: "income" },
  { code: "5120", name: "شراء كسر", parent: "5100", unit: "both", nature: "debit", statement: "income" },
  { code: "5130", name: "شراء سبائك وخام", parent: "5100", unit: "both", nature: "debit", statement: "income" },

  { code: "5200", name: "المصنعية", parent: "5000", unit: "currency", nature: "debit", statement: "income", group: true },
  { code: "5210", name: "أجور الموردين", parent: "5200", unit: "currency", nature: "debit", statement: "income" },
  { code: "5220", name: "مصنعية تصنيع من كسر", parent: "5200", unit: "currency", nature: "debit", statement: "income" },
  { code: "5230", name: "إعدام مصنعية عند الصهر", parent: "5200", unit: "currency", nature: "debit", statement: "income" },

  { code: "5300", name: "الفاقد والهالك", parent: "5000", unit: "both", nature: "debit", statement: "income", group: true },
  { code: "5310", name: "هالك تصنيع", parent: "5300", unit: "both", nature: "debit", statement: "income" },
  { code: "5320", name: "ذهب مُضاف بالإصلاح", parent: "5300", unit: "both", nature: "debit", statement: "income" },
  { code: "5330", name: "عجز بالجرد", parent: "5300", unit: "currency", nature: "debit", statement: "income" },

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

};

const POSTING_RULES = {
  // ── المبيعات ──
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
  network_fee: {
    label: "عمولة الشبكة",
    cash: { debit: "6500", credit: "1140" },
    weight: null,
    note: "مصروف تشغيلي لا يُنقص الإيراد",
  },
  vat_collected: {
    label: "ضريبة محصّلة",
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
    label: "إهلاك شهري",
    cash: { debit: "6800", credit: "1490" },
    weight: null,
    note: "⚠ مصروف لا يخرج نقدًا — يُنقص الربح ولا يُنقص الصندوق",
  },
  asset_purchase: {
    label: "شراء أصل ثابت",
    cash: { debit: "1410", credit: "1110" },
    weight: null,
    note: "⚠ أصل لا مصروف — يُستهلك سنوات لا شهرًا",
  },
  asset_disposal: {
    label: "استبعاد أصل",
    cash: { debit: "1490", credit: "1410" },
    weight: null,
    note: "عكس المجمّع وإخراج الأصل — والفرق ربح أو خسارة",
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
    weight: { from: "1220", to: null },
    liabilityMove: { from: "2130", to: null },
    note: "⚖ ذهب يخرج من الخزنة ويُبرئ المكتب بمعادله عيار 24",
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

  // ── الخزنة والذهب الخام ──
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
  taskir_sell: {
    label: "تسكير — بيع خام لمكتب",
    cash: { debit: "1110", credit: "5130" },
    weight: { from: "1220", to: null },
  },

  // ── الفروقات ──
  wastage: {
    label: "هالك تصنيع",
    cash: null,
    weight: { from: "1210", to: null },
    cost: "5310",
  },
  weight_surplus: {
    label: "فائض وزن",
    cash: null,
    weight: { from: null, to: "1210" },
    revenue: "4320",
  },
  audit_missing: {
    label: "عجز جرد",
    cash: null,
    weight: { from: "1210", to: null },
    cost: "5330",
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
  cash_surplus: { label: "زيادة جرد", cash: { debit: "1130", credit: "4330" }, weight: null },
  cash_shortage: { label: "عجز جرد", cash: { debit: "5330", credit: "1130" }, weight: null },
  transfer: {
    label: "تحويل داخلي",
    cash: { debit: "7300", credit: "7300" },
    weight: null,
    note: "طرفاه يُلغيان بعضهما — خارج القوائم",
  },

  // ── خارج الميزانية ──
  trust_in: {
    label: "استلام ذهب أمانة",
    cash: null,
    weight: { from: null, to: "7100" },
    note: "ملك العميل — لا يدخل الميزانية",
  },
  trust_out: { label: "تسليم ذهب أمانة", cash: null, weight: { from: "7100", to: null } },
};

/// الحسابات الوزنية المسموح بها — أي حساب خارجها في قيد وزني خطأ.

const WEIGHT_ACCOUNTS = ["1210", "1220", "1230", "1240", "2110", "7100", "7200"];

/// يبني قيد الوزن من قاعدة عملية. يُعيد سطرين: خروج ودخول.

export { ACC_NATURE, ACC_STATEMENT, ACC_UNIT, CATEGORY_TO_ACCOUNT, CHART_OF_ACCOUNTS, POSTING_RULES, WEIGHT_ACCOUNTS };
