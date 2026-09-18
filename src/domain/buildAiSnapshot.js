import { ROLES } from "../core/constants.js";
import { fine24, fmtW, fromHalalas, halalas, roundW } from "../core/money.js";
import { isLiveScrap, lotReconcile, mgrFeeEnabled, mgrFeeRate } from "./helpers.js";
import { stageOf } from "./stageOf.js";

function buildAiSnapshot(ctx) {
  const {
    priceData = {}, items = [], lots = [], sales = [], returns = [],
    expenses = [], scrapEntries = [], safeGoldTx = [], cashTx = [], safeTx = [],
    scrapCustodyTx = [], customers = [], suppliers = [], users = [],
    trustAccounts = [], trustLedger = [], businessDays = [], openDay = null,
    journal = [], openingBalance = {}, appSettings = {}, role = "",
    // ⚠ الوحدات الجديدة تدخل اللقطة: ذكاءٌ لا يرى الرواتب ولا الأصول
    // يُجيب عن «كم مصروفي» بنصف الحقيقة — وهو أسوأ من لا يُجيب.
    hqDocs = [], payrollRuns = [], fixedAssets = [], depreciations = [],
    repairs = [], reservations = [], partners = [], approvals = [],
  } = ctx || {};

  const C = priceData.currency || "ر.س";
  const p24 = Number(priceData.current) || 0;
  const money = (h) => fromHalalas(Math.round(h));

  // ── الذهب بعياراته ومعادله ──
  //
  // ⚠ العيارات لا تُجمع خامًا. نُمرّر الاثنين: التفصيل ليُفهم،
  // والمعادل ليُقارَن.
  const byKarat = {};
  const addK = (k, w, bucket) => {
    const kk = Number(k) || 21;
    if (!byKarat[kk]) byKarat[kk] = { crafted: 0, scrap: 0, vault: 0 };
    byKarat[kk][bucket] = roundW(byKarat[kk][bucket] + (Number(w) || 0));
  };
  let craftedFine = 0;
  for (const it of items) {
    const avail = (it.units || []).filter((u) => !u.sold && !u.issued).length;
    if (!avail) continue;
    const w = (Number(it.weight) || 0) * avail;
    addK(it.karat, w, "crafted");
    craftedFine += fine24(w, it.karat);
  }
  let scrapFine = 0;
  for (const e of scrapEntries) {
    if (!isLiveScrap(e)) continue;
    addK(e.karat, e.weight, "scrap");
    scrapFine += fine24(e.weight, e.karat);
  }
  let vaultFine = 0;
  for (const t of safeGoldTx) {
    const sign = t.type === "out" ? -1 : 1;
    addK(t.karat, sign * (Number(t.weight) || 0), "vault");
    vaultFine += sign * fine24(t.weight, t.karat);
  }

  // ── النقد ──
  const netCash = (arr) => arr.reduce(
    (a, t) => a + (t.type === "out" ? -halalas(t.amount) : halalas(t.amount)), 0);
  const cashDaily = netCash(cashTx);
  const cashSafe = netCash(safeTx);
  const cashCustody = netCash(scrapCustodyTx);

  // ── مبيعات اليوم والشهر ──
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const sum = (arr, pick, pred) => arr.reduce(
    (a, x) => a + (pred(x) ? halalas(pick(x)) : 0), 0);
  const salesToday = sum(sales, (s) => s.total, (s) => String(s.date).slice(0, 10) === today);
  const salesMonth = sum(sales, (s) => s.total, (s) => String(s.date).slice(0, 7) === month);
  const expMonth = sum(expenses, (e) => e.amount, (e) => String(e.date).slice(0, 7) === month);
  const cogsMonth = sum(sales, (s) => s.costTotal || 0, (s) => String(s.date).slice(0, 7) === month);
  const retMonth = sum(returns, (r) => r.total || r.amount || 0,
    (r) => String(r.date).slice(0, 7) === month);

  // ── الالتزامات ──
  const owedGold = lots.filter((l) => l.paymentMethod === "deferred")
    .reduce((a, l) => a + fine24(l.weight, l.karat), 0);
  const dueFromCustomers = sum(sales, (s) => s.total, (s) => s.paymentMethod === "credit");

  // ── الأمانات ──
  let trustCash = 0, trustFine = 0;
  for (const t of trustLedger) {
    if (t.cashDir === "in") trustCash += halalas(t.amount);
    if (t.cashDir === "out") trustCash -= halalas(t.amount);
    if (t.goldDir === "in") trustFine += fine24(t.weight, t.karat);
    if (t.goldDir === "out") trustFine -= fine24(t.weight, t.karat);
  }

  // ── الكسر المعلّق ──
  const suspended = scrapEntries.filter((e) => {
    const st = stageOf(e);
    return st === "pending_break" || st === "in_box" || st === "received";
  });

  // ── الدفعات غير المكتملة ──
  const openLots = lots.filter((l) => l.status === "open").map((l) => {
    const r = lotReconcile(l, items);
    return {
      ref: l.ref, karat: l.karat,
      اشتُري: `${fmtW(r.boughtW)} جم · ${r.boughtN || "؟"} قطعة`,
      كُوِّد: `${fmtW(r.codedW)} جم · ${r.codedN} قطعة`,
      المتبقي: `${fmtW(r.remainW)} جم · ${r.boughtN ? r.remainN : "؟"} قطعة`,
      الحالة: r.weightState === "surplus" ? "فائض"
        : r.weightState === "shortage" ? "ناقص" : "مطابق",
    };
  });

  // ── ميزان الشجرة ──
  //
  // ⚠ نُمرّر الأرصدة الطرفية لا الشجرة كلها: النموذج لا يحتاج أسماء
  // مئة حساب ليجيب عن ربح الشهر، والسياق المزدحم يُضعف الإجابة.
  let dr = 0, cr = 0;
  for (const e of journal) {
    for (const l of e.lines || []) {
      dr += halalas(l.debit || 0);
      cr += halalas(l.credit || 0);
    }
  }

  return {
    العملة: C,
    "سعر المحل جم24": p24,
    التاريخ: today,
    الدور: ROLES[role]?.label || role,

    "يوم العمل": openDay
      ? { المرجع: openDay.ref, "فُتح": openDay.openedAt, "بواسطة": openDay.openedBy }
      : "لا يوجد يوم مفتوح",

    الذهب: {
      "بعياراته": Object.entries(byKarat)
        .filter(([, v]) => Math.abs(v.crafted + v.scrap + v.vault) > 0.0005)
        .map(([k, v]) => ({
          العيار: Number(k),
          مشغول: roundW(v.crafted),
          كسر: roundW(v.scrap),
          خزنة: roundW(v.vault),
          "بمعادل 24": roundW(fine24(v.crafted + v.scrap + Math.max(0, v.vault), k)),
        })),
      "المجموع بمعادل 24": roundW(craftedFine + scrapFine + Math.max(0, vaultFine)),
      "قيمته بسعر اليوم": money(Math.round(
        (craftedFine + scrapFine + Math.max(0, vaultFine)) * p24 * 100)),
      "⚠": "العيارات لا تُجمع خامًا — المجموع بمعادل 24 فقط",
    },

    النقد: {
      "الصندوق اليومي": money(cashDaily),
      الخزنة: money(cashSafe),
      "عهدة الكسر": money(cashCustody),
      المجموع: money(cashDaily + cashSafe + cashCustody),
    },

    الحركة: {
      "مبيعات اليوم": money(salesToday),
      "مبيعات الشهر": money(salesMonth),
      "مرتجعات الشهر": money(retMonth),
      "تكلفة المبيعات": money(cogsMonth),
      "مصروفات الشهر": money(expMonth),
      "مجمل ربح الشهر": money(salesMonth - retMonth - cogsMonth),
      "صافي ربح الشهر": money(salesMonth - retMonth - cogsMonth - expMonth),
    },

    الالتزامات: {
      "ذهب للموردين جم24": roundW(owedGold),
      "مستحق من العملاء": money(dueFromCustomers),
      "أمانة نقدية للعملاء": money(trustCash),
      "أمانة ذهب للعملاء جم24": roundW(trustFine),
      "⚠": "الأمانة التزامٌ لا إيراد — ليست ملك المحل",
    },

    الكسر: {
      "معلّق لم يُسوَّ": suspended.length,
      "وزنه": roundW(suspended.reduce((a, e) => a + (Number(e.weight) || 0), 0)),
      "المدفوع فيه": money(suspended.reduce((a, e) => a + halalas(e.total || 0), 0)),
      "⚠": "وزنه خارج الخزنة حتى يُكسَّر ويُثبَّت",
    },

    "دفعات مفتوحة": openLots.slice(0, 12),

    الكيانات: {
      عملاء: customers.length,
      موردون: suppliers.length,
      موظفون: users.length,
      "أصحاب حسابات جارية": trustAccounts.length,
      أصناف: items.length,
    },

    "ميزان الدفتر": {
      قيود: journal.length,
      مدين: money(dr),
      دائن: money(cr),
      متوازن: Math.abs(dr - cr) < 1,
    },

    // ── الوحدات الإدارية ──
    "معاملات الإدارة": hqDocs.length ? {
      المجموع: hqDocs.length,
      "بانتظار الإدارة": hqDocs.filter((d) => d.status === "sent").length,
      "معتمدة لم تُنفَّذ": hqDocs.filter((d) => d.status === "approved").length,
      مرفوضة: hqDocs.filter((d) => d.status === "rejected").length,
      "ذهب معلّق جم24": roundW(hqDocs
        .filter((d) => d.status === "sent" || d.status === "approved")
        .reduce((a, d) => a + (Number(d.fine) || 0), 0)),
    } : "لا معاملات",

    الرواتب: payrollRuns.length ? {
      مسيّرات: payrollRuns.length,
      "آخر مسيّر": payrollRuns[0]?.month || payrollRuns[0]?.ref || "",
      "إجمالي آخر مسيّر": money(halalas(payrollRuns[0]?.totalNet || 0)),
      "غير مصروف": payrollRuns.filter((r) => r.status !== "paid").length,
    } : "لا مسيّرات",

    "الأصول الثابتة": fixedAssets.length ? {
      عدد: fixedAssets.filter((a) => a.status !== "disposed").length,
      "تكلفة قائمة": money(fixedAssets
        .filter((a) => a.status !== "disposed")
        .reduce((a, x) => a + halalas(x.cost || 0), 0)),
      "مجمّع إهلاك": money(depreciations.reduce((a, d) => a + halalas(d.amount || 0), 0)),
      مستبعدة: fixedAssets.filter((a) => a.status === "disposed").length,
    } : "لا أصول",

    الإصلاحات: repairs.length ? {
      "قيد العمل": repairs.filter((r) => r.status === "in_progress" || r.status === "received").length,
      جاهزة: repairs.filter((r) => r.status === "ready").length,
      "سُلّمت": repairs.filter((r) => r.status === "delivered").length,
    } : "لا إصلاحات",

    الحجوزات: reservations.length ? {
      قائمة: reservations.filter((r) => r.status === "active").length,
      "عربون محصّل": money(reservations
        .filter((r) => r.status === "active")
        .reduce((a, r) => a + halalas(r.deposit || 0), 0)),
    } : "لا حجوزات",

    الشركاء: partners.length ? {
      عدد: partners.length,
      "رأس المال جم24": roundW(partners.reduce((a, x) => a + (Number(x.capitalFine) || 0), 0)),
    } : "لا شركاء",

    "طلبات الاعتماد": approvals.length
      ? { معلّقة: approvals.filter((a) => a.status === "pending").length,
          معتمدة: approvals.filter((a) => a.status === "approved").length,
          مرفوضة: approvals.filter((a) => a.status === "rejected").length }
      : "لا طلبات",

    "عمولة المدير": mgrFeeEnabled(appSettings)
      ? { مفعّلة: true, "النسبة ٪": mgrFeeRate(appSettings),
          ملاحظة: "تُعتمد يوم الإقفال — بخصمها أو بدونه" }
      : "مطفأة",

    "الرصيد الافتتاحي": openingBalance?.date
      ? { التاريخ: String(openingBalance.date).slice(0, 10),
          نقد: money(halalas(openingBalance.safeCash || 0)
            + halalas(openingBalance.dailyCash || 0)),
          "ذهب جم24": roundW(Object.entries(openingBalance.goldByKarat || {})
            .reduce((a, [k, w]) => a + fine24(w, k), 0)) }
      : "لم يُسجَّل",
  };
}

export { buildAiSnapshot };
