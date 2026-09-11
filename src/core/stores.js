import { DEFAULT_CATEGORIES, DEFAULT_INTEGRATION, DEFAULT_OPENING_BALANCE, DEFAULT_PRINTER, DEFAULT_SETTINGS, DEFAULT_STORE, DEFAULT_USERS } from "./constants.js";
import { APPROVALS_KEY, ATTENDANCE_KEY, AUDIT_KEY, AUDIT_LOG_KEY, BANK_TX_KEY, BRANCH_IDENTITY_KEY, BUDGET_KEY, BUSINESS_DAYS_KEY, CASH_KEY, CATEGORIES_KEY, COMMISSIONS_KEY, COST_CENTERS_KEY, CUSTOMERS_KEY, CUSTOM_GROUPS_KEY, DAILY_CUSTODY_KEY, DEPRECIATION_KEY, ENTRY_SESSIONS_KEY, EXPENSES_KEY, EXPENSE_NAMES_KEY, EXT_INVOICES_KEY, FISCAL_CLOSURES_KEY, FIXED_ASSETS_KEY, GOLD_LEDGER_KEY, HQ_PERMISSIONS_KEY, INTEGRATION_KEY, ITEMS_KEY, JOURNAL_KEY, LEAVE_KEY, LOTS_KEY, MENU_ORDER_KEY, NAV_LAYOUT_KEY, OPENING_BALANCE_KEY, PARTNERS_KEY, PARTNER_TX_KEY, PAYROLL_KEY, PERIOD_CLOSE_KEY, PRICE_KEY, PRINTER_KEY, RECEIPTS_KEY, REPAIRS_KEY, RESERVATIONS_KEY, RETURNS_KEY, SAFE_AUDITS_KEY, SAFE_GOLD_KEY, SAFE_KEY, SALES_KEY, SCRAP_CUSTODY_KEY, SCRAP_KEY, SCRAP_REQUESTS_KEY, SCRAP_SURPLUS_KEY, SETTINGS_KEY, SHORTCUTS_KEY, STOCKTAKE_LOCK_KEY, STORE_KEY, STORE_ORDERS_KEY, SUPPLIERS_KEY, TASKIR_KEY, TASKIR_OFFICES_KEY, TASKIR_OFFICE_TX_KEY, TRUST_ACCOUNTS_KEY, TRUST_GOLD_KEY, TRUST_LEDGER_KEY, USERS_KEY, WEBHOOKS_KEY, WEIGHT_ADJ_KEY } from "./keys.js";
import { PURITY, halalas, millis } from "./money.js";
import { DEFAULT_NAV_LAYOUT, NAV_BUNDLES, NAV_MAX_PER_ROW, NAV_REGISTRY } from "./navigation.js";
import { accountByCode } from "../domain/accountByCode.js";
import { r2, r3 } from "../domain/helpers.js";
import { key } from "../domain/key.js";

function normalizeOpeningBalance(ob) {
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const caps = {};
  Object.entries(ob?.partnersCapitalByPartner || {}).forEach(([pid, g]) => {
    caps[pid] = num(g);
  });
  return {
    ...DEFAULT_OPENING_BALANCE,
    ...ob,
    dailyCash: num(ob?.dailyCash),
    dailyNetwork: num(ob?.dailyNetwork),
    safeCash: num(ob?.safeCash),
    safeNetwork: num(ob?.safeNetwork),
    safeGoldRaw: num(ob?.safeGoldRaw),
    safeGoldRawKarat: num(ob?.safeGoldRawKarat, 21),
    safeGoldCrafted: num(ob?.safeGoldCrafted),
    safeGoldCraftedKarat: num(ob?.safeGoldCraftedKarat, 21),
    custodyCash: num(ob?.custodyCash),
    custodyNetwork: num(ob?.custodyNetwork),
    scrapWeight: num(ob?.scrapWeight),
    scrapKarat: num(ob?.scrapKarat, 21),
    inventoryValue: num(ob?.inventoryValue),
    inventoryWeight: num(ob?.inventoryWeight),
    inventoryKarat: num(ob?.inventoryKarat, 21),
    inventoryLines: Array.isArray(ob?.inventoryLines)
      ? ob.inventoryLines.map((l) => ({
          karat: num(l?.karat, 21),
          weight: num(l?.weight),
          workmanship: num(l?.workmanship),
        }))
      : [],
    partnersCapitalByPartner: caps,
  };
}

// ═══════════════════════════════════════════════════════════════
//  التسعير: السعر العالمي منفصل عن هامش المحل
//
//  سعر البيع = (وزن × نقاء × السعر العالمي) + (مصنعية للجرام × وزن) + (هامش ثابت)
//
//  الفصل جوهري: الجزء الأول ليس ربحًا — هو قيمة معدن تملكه أصلًا وتتغيّر
//  بالسوق. الربح الحقيقي هو الجزء الثاني وحده. خلطهما يجعل ارتفاع سعر
//  الذهب يبدو ربحًا تجاريًا وهو ليس كذلك.
//
//  ولكل عيار هامشه: عيار 18 يُصنَّع بأجر أعلى للجرام من 24، والسوق
//  يسعّرهما بهوامش مختلفة.
// ═══════════════════════════════════════════════════════════════

const normalizeSavedNavLayout = (saved) => {
  if (!saved || typeof saved !== "object") return DEFAULT_NAV_LAYOUT;
  const known = new Set([...NAV_REGISTRY.map((n) => n.id), ...NAV_BUNDLES.map((b) => b.id)]);
  const clean = {};
  Object.entries(saved).forEach(([roleKey, v]) => {
    if (roleKey.startsWith("_")) return;
    const n = normalizeRoleLayout(v);
    clean[roleKey] = {
      row1: n.row1.filter((id) => known.has(id)),
      row2: n.row2.filter((id) => known.has(id)),
    };
  });
  const migrated = saved._navVersion === 2;
  if (!migrated) {
    Object.keys(DEFAULT_NAV_LAYOUT).forEach((roleKey) => {
      const cur = clean[roleKey] || normalizeRoleLayout(DEFAULT_NAV_LAYOUT[roleKey]);
      if (cur.row2.length === 0) {
        const inRow1 = new Set(cur.row1);
        cur.row2 = (DEFAULT_NAV_LAYOUT[roleKey].row2 || [])
          .filter((id) => known.has(id) && !inRow1.has(id))
          .slice(0, NAV_MAX_PER_ROW);
      }
      clean[roleKey] = cur;
    });
  }
  return { ...DEFAULT_NAV_LAYOUT, ...clean, _navVersion: 2 };
};

// ═══════════════════════════════════════════════════════════════
//  الأزرار المجمّعة
//
//  زر واحد يفتح ورقة بخياراته. الصندوق والمصروفات وجهان لحركة المال،
//  والتقارير كلها سؤال واحد بصيغ مختلفة — فصلها في أزرار يبدّد الشريط
//  ويجعل الوصول أطول لا أقصر.
//
//  المجمّع يُثبَّت ويُرتَّب كأي زر، ويحمل معرّفه الخاص `grp_`.
// ═══════════════════════════════════════════════════════════════

const normalizeRoleLayout = (v, perRowArg) => {
  let flat = [];
  let r1 = [], r2 = [];

  if (Array.isArray(v)) {
    flat = v;
  } else if (v && typeof v === "object") {
    r1 = Array.isArray(v.row1) ? v.row1 : [];
    r2 = Array.isArray(v.row2) ? v.row2 : [];
    // ترتيب محفوظ من نسخة بثلاثة صفوف: الثالث يُدمج في الثاني لا يُهمل
    const r3 = Array.isArray(v.row3) ? v.row3 : [];
    flat = [...r1, ...r2, ...r3];
    r2 = [...r2, ...r3];
  }

  // إزالة التكرار مع حفظ الترتيب — العنصر في صفّين يظهر مرتين
  const seen = new Set();
  flat = flat.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));

  // توزيعك يُحترم ما دام ضمن الحد
  // ⚠ الحدّ يأتي من المقاس لا من ثابت: شاشة ويندوز تحتمل عشرًا،
  // والجوال خمسًا. وتوزيعٌ واحد لهما يترك أحدهما مزدحمًا أو خاويًا.
  const perRow = Number(perRowArg) > 0 ? Number(perRowArg) : NAV_MAX_PER_ROW;
  const fits = r1.length <= perRow && r2.length <= perRow;
  if (!Array.isArray(v) && fits && flat.length === r1.length + r2.length) {
    return { row1: r1, row2: r2 };
  }

  // ⚠ الفيض التلقائي: ترتيب يضع سبعة أزرار في صف واحد يُعاد توزيعه.
  // بدونه تُسحق الأزرار ولا يظهر صف ثانٍ أبدًا.
  return {
    row1: flat.slice(0, perRow),
    row2: flat.slice(perRow, perRow * 2),
  };
};

/// كل ما هو مثبَّت في الشريط بصفّيه — يُستخدم لاستبعاده من القائمة.

const layoutIds = (v) => {
  const n = normalizeRoleLayout(v);
  return [...n.row1, ...n.row2];
};

const FIELD = {
  id: (v) => typeof v === "string" && v.length > 0,
  ref: (v) => v == null || (typeof v === "string" && v.length <= 40),
  text: (v) => v == null || typeof v === "string",
  // ⚠ التاريخ الصالح ليس أيّ تاريخ.
  //
  // `2099-01-01` يمرّ فحص الصياغة ويفسد كل تقرير: الحركة تظهر في
  // مستقبلٍ لا يُقفَل، ولا تدخل ميزان أيّ شهر، ويبحث المحاسب عن فرقٍ
  // لا يجده.
  //
  // ونسمح بيومٍ للأمام: فرق ساعة الجهاز عن الخادم وارد، ورفضُ حركةٍ
  // سُجّلت قبل دقيقة لأن ساعة الجوال متقدّمة يوقف المحل.
  date: (v) => {
    if (v == null) return true;
    if (typeof v !== "string") return false;
    const t = Date.parse(v);
    if (Number.isNaN(t)) return false;
    const now = Date.now();
    // من 2015 حتى غدًا
    return t >= Date.parse("2015-01-01") && t <= now + 864e5;
  },
  money: (v) => v == null || (Number.isFinite(Number(v)) && Math.abs(Number(v)) < 1e12),
  posMoney: (v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 1e12,
  weight: (v) => v == null || (Number.isFinite(Number(v)) && Math.abs(Number(v)) < 1e7),
  posWeight: (v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 1e7,
  karat: (v) => v == null || Object.keys(PURITY).includes(String(Number(v))),
  bool: (v) => v == null || typeof v === "boolean",
  list: (v) => v == null || Array.isArray(v),
  inOut: (v) => v === "in" || v === "out",
};

/// مخطّط كل مخزن: الحقول الإلزامية وقيودها، ثم ثوابت إضافية.
///
/// ما لا مخطّط له يمرّ — إضافة مخزن جديد لا تُعطّل الحفظ، لكنها لا
/// تُحرَس أيضًا. القائمة تُوسَّع مع كل مخزن يحمل مالًا أو وزنًا.

const STORE_SCHEMA = {
  [SALES_KEY]: {
    label: "المبيعات",
    fields: { id: "id", ref: "ref", date: "date", total: "posMoney", lines: "list" },
    rules: [
      {
        why: "فاتورة بلا أسطر",
        ok: (r) => Array.isArray(r.lines) && r.lines.length > 0,
      },
      {
        why: "إجمالي لا يطابق الأسطر",
        // ⚠ إصلاح محلي (غير موجود في ounce-source الأصلي): هذا الشرط كان
        // يقبل اتفاقًا واحدًا فقط — total = صافي الأسطر + الضريبة — بينما
        // NewSaleModal/handleCreateSale (المسار الفعلي لكل بيع كامل في
        // المتجر) يستخدمان اتفاقًا آخر تمامًا: السعر الذي يدخله البائع
        // ويراه العميل على الشاشة شامل للضريبة دائمًا (كلوحة سعر في محل)،
        // فـtotal = مجموع الأسطر كما أُدخلت، والضريبة تُستخرَج منها للعرض
        // والتقارير فقط لا تُضاف فوقها. الشرط القديم كان يرفض صمتًا كل
        // فاتورة بضريبة يُنشئها NewSaleModal (ينجح الحفظ فقط حين
        // taxAmount = 0)، بينما الواجهة تعرض نجاحًا وهميًا. الإصلاح هنا:
        // قبول كِلا الاتفاقين المستخدَمين فعليًا في هذا الكود، دون تغيير
        // ما يراه العميل أو يدفعه.
        ok: (r) => {
          const sum = (r.lines || []).reduce(
            (a, l) => a + halalas((Number(l.unitPrice) || 0) * (Number(l.quantity) || 1)), 0
          );
          const tax = halalas(r.taxAmount || 0);
          // نتسامح بهللة للتقريب المصرفي
          const totalH = halalas(r.total);
          const netPlusTax = Math.abs(totalH - (sum + tax)) <= 2;   // صافٍ + ضريبة = إجمالي
          const inclusiveOfTax = Math.abs(totalH - sum) <= 2;        // الإجمالي شامل الضريبة أصلًا
          return netPlusTax || inclusiveOfTax;
        },
      },
    ],
  },
  [SCRAP_KEY]: {
    label: "الكسر",
    fields: { id: "id", date: "date", karat: "karat", weight: "weight", total: "money" },
    rules: [
      {
        why: "الصافي أكبر من القائم",
        ok: (r) =>
          r.grossWeight == null ||
          millis(r.weight) <= millis(r.grossWeight) + 1,
      },
      {
        why: "له فصوص ودخل الخزنة بلا تكسير",
        ok: (r) =>
          !(Number(r.stonesMarginEstimate) > 0.0005 && r.stage === "in_safe" && !r.refined),
      },
    ],
  },
  [LOTS_KEY]: {
    label: "الدفعات",
    fields: { id: "id", ref: "ref", karat: "karat", weight: "posWeight", goldCost: "money" },
    rules: [
      {
        why: "المُكوَّد يتجاوز وزن الدفعة",
        ok: (r) => millis(r.enteredWeight || 0) <= millis(r.weight) + 1,
      },
    ],
  },
  [CASH_KEY]: {
    label: "الصندوق اليومي",
    fields: { id: "id", date: "date", type: "inOut", amount: "posMoney" },
    rules: [{ why: "مبلغ صفر أو سالب", ok: (r) => Number(r.amount) > 0 }],
  },
  [SAFE_KEY]: {
    label: "الخزنة",
    fields: { id: "id", date: "date", type: "inOut", amount: "posMoney" },
    rules: [{ why: "مبلغ صفر أو سالب", ok: (r) => Number(r.amount) > 0 }],
  },
  [SCRAP_CUSTODY_KEY]: {
    label: "عهدة الكسر",
    fields: { id: "id", date: "date", amount: "posMoney" },
  },
  [EXPENSES_KEY]: {
    label: "المصروفات",
    fields: { id: "id", ref: "ref", date: "date", amount: "posMoney" },
    rules: [{ why: "مصروف بلا مبلغ", ok: (r) => Number(r.amount) > 0 }],
  },
  [JOURNAL_KEY]: {
    label: "دفتر القيود",
    fields: { id: "id", date: "date", lines: "list" },
    rules: [
      { why: "قيد بأقلّ من طرفين", ok: (r) => (r.lines || []).length >= 2 },
      {
        why: "قيد غير متوازن",
        ok: (r) => {
          const dr = (r.lines || []).reduce((a, l) => a + halalas(l.debit || 0), 0);
          const cr = (r.lines || []).reduce((a, l) => a + halalas(l.credit || 0), 0);
          return dr === cr;
        },
      },
      {
        why: "سطر مدين ودائن معًا",
        ok: (r) => (r.lines || []).every(
          (l) => !(Number(l.debit) > 0 && Number(l.credit) > 0)
        ),
      },
      {
        why: "حساب غير معرّف في الشجرة",
        ok: (r) => (r.lines || []).every((l) => !!accountByCode(l.account)),
      },
    ],
  },
  [ITEMS_KEY]: {
    label: "الأصناف",
    fields: { id: "id", karat: "karat", weight: "posWeight" },
  },
  [USERS_KEY]: {
    label: "المستخدمون",
    fields: { id: "id", name: "text" },
    rules: [{ why: "مستخدم بلا اسم", ok: (r) => String(r.name || "").trim().length > 0 }],
  },
  [SUPPLIERS_KEY]: {
    label: "الموردون",
    fields: { id: "id", name: "text" },
    rules: [{ why: "مورد بلا اسم", ok: (r) => String(r.name || "").trim().length > 0 }],
  },
  [TRUST_ACCOUNTS_KEY]: {
    label: "أصحاب الحسابات",
    fields: { id: "id", name: "text" },
    rules: [{ why: "صاحب حساب بلا اسم", ok: (r) => String(r.name || "").trim().length > 0 }],
  },
  [TRUST_LEDGER_KEY]: {
    label: "سجل الحسابات الجارية",
    fields: { id: "id", date: "date" },
    rules: [
      { why: "حركة بلا صاحب", ok: (r) => !!r.holderId },
      { why: "حركة بلا نوع", ok: (r) => !!r.move },
      // ⚠ لا حركة بصفر: تُشوّش الكشف ولا تُغيّر رصيدًا
      { why: "مبلغ ووزن صفر معًا",
        ok: (r) => (Number(r.amount) || 0) > 0 || (Number(r.weight) || 0) > 0 },
    ],
  },
  [CUSTOMERS_KEY]: {
    label: "العملاء",
    fields: { id: "id", name: "text" },
    rules: [{ why: "عميل بلا اسم", ok: (r) => String(r.name || "").trim().length > 0 }],
  },
  [RETURNS_KEY]: {
    label: "المرتجعات",
    fields: { id: "id", date: "date", refund: "posMoney", lineIndexes: "list" },
    rules: [
      { why: "مرتجع بلا أسطر", ok: (r) => (r.lineIndexes || []).length > 0 },
    ],
  },
  [WEIGHT_ADJ_KEY]: {
    label: "تعديلات الوزن",
    fields: { id: "id", date: "date", karat: "karat", weight: "posWeight" },
  },
  [GOLD_LEDGER_KEY]: {
    label: "دفتر الوزن",
    fields: { id: "id", karat: "karat", weight: "weight" },
    rules: [
      {
        // ⚖ الدفتر الوزني لا يحمل مالًا
        why: "قيد وزني يحمل مبلغًا",
        ok: (r) => r.amount == null && r.total == null && r.price == null,
      },
    ],
  },
};

/// ⚠ يُثبّت التحقق على طبقة التخزين نفسها.
///
/// وضعُه في `persist` وحدها كان خطأً معماريًا: `window.storage.set`
/// طبقةٌ **تحتها**، فمن يفتح وحدة التحكم يكتب ما شاء ولا يمرّ بشيء.
/// قِستُه فعلًا: فاتورةٌ بإجمالي −999,999 وقيدٌ بطرف واحد مرّا كلاهما.
///
/// الآن الغلاف يفحص قبل الكتابة مهما كان النداء ومن أين جاء.

function installStorageGuard() {
  if (typeof window === "undefined" || !window.storage) return false;
  if (window.storage.__guarded) return true;
  const raw = window.storage.set.bind(window.storage);
  window.storage.set = function guardedSet(key, value, shared) {
    let parsed;
    try {
      parsed = typeof value === "string" ? JSON.parse(value) : value;
    } catch (e) {
      // نصّ ليس JSON — نمرّره كما هو، فبعض المفاتيح نصّية
      return raw(key, value, shared);
    }
    const check = validateStore(key, parsed);
    if (!check.ok) {
      const first = check.issues[0];
      const err = new Error(
        `رُفض حفظ ${check.label}: ${first.why[0]} (${first.ref})`
      );
      err.code = "VALIDATION";
      err.issues = check.issues;
      console.error("[أونصة] حارس التخزين رفض:", key, check.issues.slice(0, 3));
      throw err;
    }
    return raw(key, sanitizeStore(parsed), shared);
  };
  window.storage.__guarded = true;
  return true;
}

/// تطهير قبل الكتابة — يقصّ الطول ويُزيل محارف التحكّم واتجاه النصّ.
///
/// ⚠ محرف «قلب الاتجاه» U+202E خطر حقيقي لا نظري: اسمٌ يحمله يعرض
/// «فاتورة 100» كأنها «001 ةروتاف» في التقرير المطبوع — والمراجع يقرأ
/// رقمًا غير الذي في الدفتر.

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;

const MAX_TEXT = 300;

function sanitizeStore(value) {
  const clean = (v, depth = 0) => {
    if (depth > 8) return null;
    if (typeof v === "string") {
      return v.replace(CONTROL_CHARS, "").slice(0, MAX_TEXT);
    }
    if (Array.isArray(v)) return v.map((x) => clean(x, depth + 1));
    if (v && typeof v === "object") {
      const out = {};
      Object.keys(v).forEach((k) => {
        // ⚠ نمنع تلويث النموذج الأولي: مفتاحٌ اسمه `__proto__` يُغيّر
        // كل كائن في الصفحة لا هذا السجل وحده.
        if (k === "__proto__" || k === "constructor" || k === "prototype") return;
        out[k] = clean(v[k], depth + 1);
      });
      return out;
    }
    return v;
  };
  return JSON.stringify(clean(value));
}

/// يتحقق من سجل واحد. يُعيد مصفوفة أسباب الرفض — فارغةً إن سلم.

function validateRecord(key, rec) {
  const schema = STORE_SCHEMA[key];
  if (!schema || !rec || typeof rec !== "object") return [];
  const bad = [];
  Object.entries(schema.fields || {}).forEach(([f, type]) => {
    const fn = FIELD[type];
    if (fn && !fn(rec[f])) bad.push(`${f}: ${type}`);
  });
  (schema.rules || []).forEach((r) => {
    try {
      if (!r.ok(rec)) bad.push(r.why);
    } catch (e) {
      bad.push(`${r.why} (تعذّر الفحص)`);
    }
  });
  return bad;
}

/// يتحقق من مصفوفة كاملة قبل الحفظ.
///
/// ⚠ لا يُصلح ولا يحذف: يُبلّغ فقط. الإصلاح الصامت يُخفي الخلل ويُنتج
/// بياناتٍ لم يقصدها أحد.

function validateStore(key, value) {
  const schema = STORE_SCHEMA[key];
  if (!schema) return { ok: true, issues: [], label: null };
  const arr = Array.isArray(value) ? value : [value];
  const issues = [];
  const seen = new Set();
  arr.forEach((rec, i) => {
    const bad = validateRecord(key, rec);
    if (bad.length) issues.push({ i, ref: rec?.ref || rec?.id || `#${i}`, why: bad });
    const id = rec?.id;
    if (id != null) {
      if (seen.has(id)) issues.push({ i, ref: id, why: ["معرّف مكرر"] });
      seen.add(id);
    }
  });
  return { ok: issues.length === 0, issues, label: schema.label };
}

/// تطهير نصّي عام: يُزيل الفراغ الزائد ومحارف التحكّم.
///
/// ⚠ لا يُزيل الوسوم: التطبيق لا يعرض HTML خامًا، وحذف «<» من اسم
/// عميل يُفسد اسمه بلا سبب.

const STORE_REGISTRY = [
  { key: ITEMS_KEY, name: "items", def: [] },
  { key: SALES_KEY, name: "sales", def: [] },
  { key: LOTS_KEY, name: "lots", def: [] },
  { key: SUPPLIERS_KEY, name: "suppliers", def: [] },
  { key: CUSTOMERS_KEY, name: "customers", def: [] },
  // ⚠ الافتراضي DEFAULT_USERS لا مصفوفة فارغة: بدونه لا مستخدم على
  // شاشة الدخول في أول تشغيل — التطبيق يفتح ولا يُدخَل إليه.
  { key: USERS_KEY, name: "users", def: DEFAULT_USERS,
    clean: (v) => (Array.isArray(v) && v.length ? v : DEFAULT_USERS) },
  { key: CASH_KEY, name: "cashTx", def: [] },
  { key: SAFE_KEY, name: "safeTx", def: [] },
  { key: SCRAP_CUSTODY_KEY, name: "scrapCustodyTx", def: [] },
  { key: SCRAP_KEY, name: "scrapEntries", def: [] },
  { key: SCRAP_REQUESTS_KEY, name: "scrapRequests", def: [] },
  { key: GOLD_LEDGER_KEY, name: "goldLedger", def: [] },
  { key: SAFE_GOLD_KEY, name: "safeGoldTx", def: [] },
  { key: WEIGHT_ADJ_KEY, name: "weightAdjustments", def: [] },
  { key: ENTRY_SESSIONS_KEY, name: "entrySessions", def: [] },
  { key: EXPENSES_KEY, name: "expenses", def: [] },
  { key: EXPENSE_NAMES_KEY, name: "expenseNames", def: [] },
  { key: TASKIR_KEY, name: "taskirEntries", def: [] },
  { key: TASKIR_OFFICES_KEY, name: "taskirOffices", def: [] },
  { key: TASKIR_OFFICE_TX_KEY, name: "taskirOfficeTx", def: [] },
  { key: PARTNERS_KEY, name: "partners", def: [] },
  { key: PARTNER_TX_KEY, name: "partnerTx", def: [] },
  { key: COMMISSIONS_KEY, name: "commissions", def: {} },
  { key: REPAIRS_KEY, name: "repairs", def: [] },
  { key: TRUST_GOLD_KEY, name: "trustGold", def: [] },
  { key: RETURNS_KEY, name: "returns", def: [] },
  { key: RECEIPTS_KEY, name: "receipts", def: [] },
  { key: RESERVATIONS_KEY, name: "reservations", def: [] },
  { key: AUDIT_KEY, name: "audits", def: [] },
  { key: SAFE_AUDITS_KEY, name: "safeAudits", def: [] },
  { key: DAILY_CUSTODY_KEY, name: "dailyCustody", def: [] },
  { key: BUSINESS_DAYS_KEY, name: "businessDays", def: [] },
  { key: FISCAL_CLOSURES_KEY, name: "fiscalClosures", def: [] },
  // ⚠ الرصيد الافتتاحي له شكل مركّب — null يُسقط قارئي خصائصه
  {
    key: OPENING_BALANCE_KEY, name: "openingBalance", def: DEFAULT_OPENING_BALANCE,
    clean: (v) => normalizeOpeningBalance(v || DEFAULT_OPENING_BALANCE),
  },
  { key: SCRAP_SURPLUS_KEY, name: "scrapSurplus", def: [] },
  { key: BANK_TX_KEY, name: "bankTx", def: [] },
  { key: JOURNAL_KEY, name: "journal", def: [] },
  { key: AUDIT_LOG_KEY, name: "auditLog", def: [] },
  { key: FIXED_ASSETS_KEY, name: "fixedAssets", def: [] },
  { key: DEPRECIATION_KEY, name: "depreciations", def: [] },
  { key: COST_CENTERS_KEY, name: "costCenters", def: [] },
  { key: BUDGET_KEY, name: "budgets", def: [] },
  { key: PERIOD_CLOSE_KEY, name: "periodCloses", def: [] },
  { key: PAYROLL_KEY, name: "payrollRuns", def: [] },
  { key: ATTENDANCE_KEY, name: "attendance", def: [] },
  { key: LEAVE_KEY, name: "leaves", def: [] },
  { key: APPROVALS_KEY, name: "approvals", def: [] },
  { key: WEBHOOKS_KEY, name: "webhooks", def: [] },
  { key: EXT_INVOICES_KEY, name: "extInvoices", def: [] },
  { key: STORE_ORDERS_KEY, name: "storeOrders", def: [] },
  { key: SHORTCUTS_KEY, name: "shortcuts", def: [] },
  { key: CUSTOM_GROUPS_KEY, name: "customGroups", def: [] },
  { key: STOCKTAKE_LOCK_KEY, name: "stocktakeLock", def: null },
  // ⚠ الافتراضي كائن لا null: الكود يقرأ branchIdentity.code مباشرة،
  // وnull يُسقط التطبيق بشاشة بيضاء عند أول تحميل.
  {
    key: BRANCH_IDENTITY_KEY, name: "branchIdentity", def: { code: "", name: "" },
    clean: (v) => ({ code: "", name: "", ...(v || {}) }),
  },
  { key: HQ_PERMISSIONS_KEY, name: "hqPermissions", def: null },
  // ── مخازن بقيم افتراضية مركّبة ──
  { key: TRUST_ACCOUNTS_KEY, name: "trustAccounts", def: [] },
  { key: TRUST_LEDGER_KEY, name: "trustLedger", def: [] },
  {
    key: SETTINGS_KEY, name: "appSettings", def: DEFAULT_SETTINGS,
    clean: (v) => ({ ...DEFAULT_SETTINGS, ...(v || {}) }),
  },
  {
    key: PRINTER_KEY, name: "printerCfg", def: DEFAULT_PRINTER,
    clean: (v) => ({ ...DEFAULT_PRINTER, ...(v || {}) }),
  },
  {
    key: INTEGRATION_KEY, name: "integration", def: DEFAULT_INTEGRATION,
    clean: (v) => ({ ...DEFAULT_INTEGRATION, ...(v || {}) }),
  },
  {
    key: STORE_KEY, name: "storeLink", def: DEFAULT_STORE,
    clean: (v) => ({ ...DEFAULT_STORE, ...(v || {}) }),
  },
  {
    key: CATEGORIES_KEY, name: "categories", def: DEFAULT_CATEGORIES,
    clean: (v) => (Array.isArray(v) && v.length ? v : DEFAULT_CATEGORIES),
  },
  { key: MENU_ORDER_KEY, name: "menuOrder", def: null },
  {
    key: NAV_LAYOUT_KEY, name: "navLayout", def: DEFAULT_NAV_LAYOUT,
    clean: (v) => normalizeSavedNavLayout(v),
  },
  {
    key: PRICE_KEY, name: "priceData", def: null, // يُعالَج خاصةً
    skipAuto: true,
  },
];

/// تدقيق السجل نفسه: لا مفتاح مكرر ولا اسم مكرر ولا مفتاح غير معرّف.
/// خطأ هنا يعني مخزنًا يكتب فوق آخر.

async function loadAllStores() {
  const rows = STORE_REGISTRY.filter((r) => !r.skipAuto);
  const results = await Promise.allSettled(
    rows.map((r) => window.storage.get(r.key, false))
  );
  const out = {};
  const failed = [];
  results.forEach((res, i) => {
    const row = rows[i];
    if (res.status === "fulfilled" && res.value) {
      try {
        const parsed = JSON.parse(res.value.value);
        out[row.name] = row.clean ? row.clean(parsed) : parsed;
        return;
      } catch (e) {
        // ⚠ قيمة تالفة لا تُسقط التحميل كله — نسجّلها ونمضي بالافتراضي
        failed.push({ key: row.key, why: "JSON تالف" });
      }
    }
    out[row.name] = row.clean ? row.clean(row.def) : row.def;
  });
  return { data: out, failed };
}

/// خدمات الطباعة الشائعة في طابعات البلوتوث الحرارية.

export { CONTROL_CHARS, FIELD, MAX_TEXT, STORE_REGISTRY, STORE_SCHEMA, installStorageGuard, layoutIds, loadAllStores, normalizeOpeningBalance, normalizeRoleLayout, normalizeSavedNavLayout, sanitizeStore, validateRecord, validateStore };
