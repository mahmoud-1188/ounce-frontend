import React, { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import { INDEX_KINDS } from "../core/assistant.js";
import { CATEGORY_TO_ACCOUNT } from "../core/chart.js";
import { fine24, fmt, fmtMoney, fmtW } from "../core/money.js";
import { CARD_NETWORKS } from "../core/money-rules.js";
import { accountByCode } from "../domain/accountByCode.js";
import { accountGroup, accountLabel, cardFeeOf, fineAt, inputStyle, isLiveScrap } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function DailyJournalPage({
  sales, expenses, cashTx, safeTx, scrapCustodyTx, scrapEntries, lots,
  businessDays, receipts = [], safeGoldTx = [], weightAdjustments = [],
  index = [], suppliers = [], customers = [], users = [], settings = {},
  entrySessions = [],
  currency, price24, branchName, onEditFees, onBack, flashToast,
}) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [dateA, setDateA] = useState(todayISO);
  const [dateB, setDateB] = useState("");
  const [compare, setCompare] = useState(false);

  const sameDay = (iso, day) => String(iso || "").slice(0, 10) === day;
  const scrapKarat = 21;

  // ── بناء اليومية من دفتر القيود ──
  //
  // مصدر واحد: كل حركة تُقيَّد بتصنيف من شجرة الحسابات. البناء من الدفتر
  // — لا من المستندات — يضمن ظهور أي عملية جديدة تلقائيًا.
  //
  // ثلاثة أشياء تميّز هذه اليومية عن دفتر نقدي عادي:
  //   ① الذهب يُعرض بكل عيار على حدة، مع معادله بعيار 24 و21.
  //      الجمع بلا تحويل يعطي رقمًا لا معنى له.
  //   ② الجرام أولًا والريال مرجعًا — الوزن حقيقة والقيمة تقدير.
  //   ③ عمولة الشبكة مفصّلة بكل بطاقة، لأن نسبها تختلف.
  const buildDay = (day) => {
    if (!day) return null;
    const K = 21; // عيار دفتر المحل الورقي
    const inDay = (x) => sameDay(x.date, day);
    const before = (x) => String(x.date || "").slice(0, 10) < day;
    // ⚠ الصفحة تستقبل السعر خاصيةً — قراءته من متغيّر عام يُسقط التطبيق
    const p24 = Number(price24) || 0;
    const g24 = (v) => (p24 > 0 ? v / p24 : 0);

    const ledger = [...cashTx, ...safeTx, ...scrapCustodyTx];
    const dayLedger = ledger.filter(inDay);
    const bd = businessDays.find((d) => sameDay(d.openedAt, day));

    // ── جانب الريال: تجميع حسب حساب الشجرة ──
    const isTransfer = (c) => String(c || "").startsWith("transfer_");
    const byAccount = {};
    dayLedger.forEach((t) => {
      const acc = t.category || "غير مصنّف";
      if (!byAccount[acc]) byAccount[acc] = { in: 0, out: 0, count: 0, transfer: isTransfer(acc) };
      if (t.type === "out") byAccount[acc].out += Number(t.amount) || 0;
      else byAccount[acc].in += Number(t.amount) || 0;
      byAccount[acc].count += 1;
    });

    // ── عمولة الشبكة مفصّلة بالبطاقة ──
    // نسبة كل شبكة تختلف، وعرضها مجمّعة يخفي أيها يكلّفك أكثر.
    const daySales = sales.filter(inDay);
    const netFees = {};
    dayLedger
      .filter((t) => t.category === "network_fees")
      .forEach((t) => {
        // البطاقة مستنتجة من الفاتورة المرتبطة، وإلا فمن نص القيد
        const sale = daySales.find((s) => s.id === t.refId);
        let card = sale?.cardNetwork;
        if (!card) {
          const hit = CARD_NETWORKS.find((n) => String(t.note || "").includes(n.label));
          card = hit?.id || "other";
        }
        if (!netFees[card]) netFees[card] = { amount: 0, base: 0, count: 0 };
        netFees[card].amount += Number(t.amount) || 0;
        netFees[card].count += 1;
        if (sale) netFees[card].base += Number(sale.networkPart || sale.total) || 0;
      });
    const netFeesTotal = Object.values(netFees).reduce((a, x) => a + x.amount, 0);

    // ── جانب الذهب: كل عيار على حدة ──
    const goldByKarat = {};
    const touch = (k) => {
      if (!goldByKarat[k]) goldByKarat[k] = { in: 0, out: 0, sources: {} };
      return goldByKarat[k];
    };
    const addGold = (k, dir, w, source) => {
      const wt = Math.abs(Number(w) || 0);
      if (wt <= 0) return;
      const row = touch(Number(k) || 21);
      row[dir] += wt;
      row.sources[source] = (row.sources[source] || 0) + (dir === "out" ? -wt : wt);
    };

    scrapEntries.filter(inDay).forEach((e) => {
      const w = Number(e.weight) || 0;
      addGold(e.karat, w > 0 ? "in" : "out", w, "الكسر");
    });
    (safeGoldTx || []).filter(inDay).forEach((t) => {
      addGold(t.karat, t.type === "in" ? "in" : "out", t.weight, "خزنة الذهب");
    });
    (weightAdjustments || []).filter(inDay).forEach((a) => {
      const lossKinds = ["wastage", "repair_add"];
      const gainKinds = ["surplus", "repair_reduce"];
      if (lossKinds.includes(a.kind)) addGold(a.karat, "out", a.weight, "هالك وتسويات");
      else if (gainKinds.includes(a.kind)) addGold(a.karat, "in", a.weight, "فائض");
    });
    // المباع يخرج من المخزون
    daySales.forEach((s) => {
      (s.lines || []).forEach((l) => {
        addGold(l.karatSnapshot, "out", (Number(l.weightSnapshot) || 0) * (Number(l.quantity) || 1), "مبيعات");
      });
    });
    // المُدخل يدخل المخزون
    (entrySessions || []).filter(inDay).forEach((e) => {
      addGold(e.karat, "in", e.totalWeight, "تكويد");
    });

    const karats = Object.keys(goldByKarat)
      .map(Number)
      .sort((a, b) => b - a);
    const goldTotals = karats.reduce(
      (a, k) => {
        const r = goldByKarat[k];
        return {
          fineIn: a.fineIn + fine24(r.in, k),
          fineOut: a.fineOut + fine24(r.out, k),
          k21In: a.k21In + fineAt(r.in, k, K),
          k21Out: a.k21Out + fineAt(r.out, k, K),
        };
      },
      { fineIn: 0, fineOut: 0, k21In: 0, k21Out: 0 }
    );

    // ── صفوف الريال ──
    const rows = [];
    const push = (label, o) => rows.push({ label, cashIn: 0, cashOut: 0, ...o });

    const tax = daySales.reduce((a, x) => a + (Number(x.taxAmount) || 0), 0);
    const salesAcc = byAccount["sales_revenue"] || { in: 0 };
    push("مبيعات الذهب المشغول", { cashIn: Math.max(0, salesAcc.in - tax), fixed: true, account: "4100" });
    push("ضريبة القيمة المضافة", { cashIn: tax, fixed: true, account: "2220" });
    const scrapAcc = byAccount["gold_purchase_scrap"] || byAccount["scrap_purchase"] || { out: 0 };
    push("شراء الذهب الكسر", { cashOut: scrapAcc.out, fixed: true, account: "5120" });

    // ── مشتريات الموردين ──
    //
    // ⚠ الشراء الآجل لا يحرّك نقدًا لكنه يُدخل ذهبًا ويُنشئ التزامًا.
    // إغفاله من الورقة يجعل الذهب يظهر بلا مصدر، والالتزام لا يُرى.
    const dayLotsAll = (lots || []).filter(inDay);
    const dayExpNow = (expenses || []).filter(inDay);
    const dayExpTotal = dayExpNow.reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const expCount = dayExpNow.length;
    const supAcc = byAccount["gold_purchase_supplier"] || { out: 0 };
    const wmAcc = byAccount["workmanship_paid"] || { out: 0 };
    const deferredLots = dayLotsAll.filter((l) => l.paymentMethod === "deferred");
    const paidLots = dayLotsAll.filter((l) => l.paymentMethod !== "deferred");
    // ⚠ الأسطر الثابتة تظهر دائمًا ولو بصفر — كورقة المحل: المحاسب
    // يبحث عن السطر لا عن وجوده، وغيابه يجعله يظن أن الشاشة ناقصة.
    {
      push("مشتريات الذهب من الموردين", {
        cashOut: supAcc.out, fixed: true, account: "5110",
        note: `${paidLots.length} مسدَّدة · ${deferredLots.length} آجلة`,
        goldIn: dayLotsAll.reduce((a, l) => a + fine24(l.weight, l.karat), 0),
      });
    }
    push("أجور المصنعية للموردين", { cashOut: wmAcc.out, fixed: true, account: "5210" });
    push("المصروفات التشغيلية", {
      cashOut: dayExpTotal, fixed: true, account: "6000",
      note: expCount ? `${expCount} بند` : "",
    });
    if (deferredLots.length) {
      push("مستحق على الموردين (آجل)", {
        cashOut: 0, fixed: true, account: "2110", memo: true,
        note: `${fmtW(deferredLots.reduce((a, l) => a + fine24(l.weight, l.karat), 0))} جم24 ذهبًا` +
          ` · ${fmt(deferredLots.reduce((a, l) => a + (Number(l.workmanship) || 0), 0), 2)} أجورًا`,
      });
    }

    // ── الهالك والفائض: نقدًا ووزنًا ──
    //
    // الهالك خسارة مزدوجة: وزنٌ خرج وقيمةٌ ذهبت معه. عرضه بالوزن وحده
    // يُخفي أثره على الربح، وبالقيمة وحدها يُخفي أثره على المخزون.
    const dayAdj = (weightAdjustments || []).filter(inDay);
    const wasteKinds = ["wastage", "repair_add", "audit_missing"];
    const gainKinds = ["surplus", "repair_reduce", "audit_extra"];
    const waste = dayAdj.filter((a) => wasteKinds.includes(a.kind));
    const gains = dayAdj.filter((a) => gainKinds.includes(a.kind));
    const sumFine = (arr) => arr.reduce((a, x) => a + fine24(x.weight, x.karat), 0);
    const sumVal = (arr) =>
      arr.reduce((a, x) => a + (Number(x.value) || fine24(x.weight, x.karat) * p24), 0);
    {
      push("الهالك والفاقد", {
        cashOut: 0, fixed: true, account: "5310", memo: true,
        goldOut: sumFine(waste),
        note: waste.length
          ? `${fmtW(sumFine(waste))} جم24 · تكلفته ${fmtMoney(sumVal(waste))}`
          : "لا هالك اليوم",
      });
    }
    if (gains.length) {
      push("فائض الوزن", {
        cashIn: 0, fixed: true, account: "4320", memo: true,
        goldIn: sumFine(gains),
        note: `${fmtW(sumFine(gains))} جم24 · قيمته ${fmt(sumVal(gains), 2)}`,
      });
    }

    const GROUP_ORDER = ["gold_revenue", "operating_profit", "capital_gain", "other_revenue",
      "capital", "gold_cogs", "operating", "owner", "variance", "transfer"];
    const shown = new Set(["sales_revenue", "gold_purchase_scrap", "scrap_purchase", "network_fees"]);
    Object.entries(byAccount)
      .filter(([acc]) => !shown.has(acc))
      .sort((a, b) => {
        const ga = GROUP_ORDER.indexOf(accountGroup(a[0]));
        const gb = GROUP_ORDER.indexOf(accountGroup(b[0]));
        return (ga === -1 ? 99 : ga) - (gb === -1 ? 99 : gb);
      })
      .forEach(([acc, v]) => {
        const label = accountLabel(acc) !== "—" ? accountLabel(acc) : acc;
        push(`${label}${v.count > 1 ? ` (${v.count})` : ""}`, {
          cashIn: v.in, cashOut: v.out, transfer: v.transfer,
          category: acc, account: CATEGORY_TO_ACCOUNT[acc] || null,
        });
      });

    // عمولات الشبكة: سطر لكل بطاقة
    Object.entries(netFees).forEach(([card, v]) => {
      const label = CARD_NETWORKS.find((n) => n.id === card)?.label || "بطاقة أخرى";
      const pct = v.base > 0 ? (v.amount / v.base) * 100 : cardFeeOf(appSettings, card);
      push(`عمولة ${label} (${fmt(pct, 2)}٪)`, {
        cashOut: v.amount, category: "network_fees", account: "6500", isFee: true,
      });
    });

    const t = rows.filter((r) => !r.transfer).reduce(
      (a, r) => ({ cashIn: a.cashIn + r.cashIn, cashOut: a.cashOut + r.cashOut }),
      { cashIn: 0, cashOut: 0 }
    );
    const transfersTotal = rows.filter((r) => r.transfer).reduce((a, r) => a + r.cashIn + r.cashOut, 0);

    // ── الأرصدة السابقة ──
    const prevCash = ledger.filter(before)
      .reduce((a, x) => a + (x.type === "out" ? -(Number(x.amount) || 0) : Number(x.amount) || 0), 0);
    const prevGoldFine =
      scrapEntries.filter(before).filter(isLiveScrap)
        .reduce((a, e) => a + fine24(e.weight, e.karat), 0) +
      (safeGoldTx || []).filter(before)
        .reduce((a, x) => a + (x.type === "in" ? 1 : -1) * fine24(x.weight, x.karat), 0);

    // ── مستندات اليوم ──
    //
    // المحاسب يريد المستند لا المجموع: أي فاتورة، من البائع، بكم، لمن.
    // الفهرس يحمل كل السجلات بصيغة موحّدة فنُصفّيه باليوم ونجمّعه بالنوع.
    const dayDocs = (index || []).filter((r) => sameDay(r.date, day));
    const docsByKind = {};
    dayDocs.forEach((r) => {
      if (!docsByKind[r.kind]) docsByKind[r.kind] = [];
      docsByKind[r.kind].push(r);
    });

    // ── نشاط كل مستخدم ──
    const byUser = {};
    dayDocs.forEach((r) => {
      const who = r.who || "—";
      if (!byUser[who]) byUser[who] = { docs: 0, amount: 0, fine: 0, kinds: new Set() };
      byUser[who].docs += 1;
      byUser[who].amount += Number(r.amount) || 0;
      byUser[who].fine += Number(r.fine) || 0;
      byUser[who].kinds.add(r.kind);
    });

    // ── الذمم: ما زاد وما نقص اليوم ──
    const creditSales = daySales.filter((x) => x.paymentMethod === "credit");
    const dayReceipts = (receipts || []).filter(inDay);
    const receivable = {
      up: creditSales.reduce((a, x) => a + (Number(x.total) || 0), 0),
      down: dayReceipts.reduce((a, x) => a + (Number(x.amount) || 0), 0),
      count: creditSales.length + dayReceipts.length,
    };
    const dayLots = (lots || []).filter(inDay);
    const payable = {
      goldUp: dayLots.filter((l) => l.paymentMethod === "deferred")
        .reduce((a, l) => a + fine24(l.weight, l.karat), 0),
      feesUp: dayLots.filter((l) => l.paymentMethod === "deferred")
        .reduce((a, l) => a + (Number(l.workmanship) || 0), 0),
      count: dayLots.length,
    };

    // ── الضريبة ──
    const vat = {
      collected: tax,
      base: daySales.reduce((a, x) => a + (Number(x.subtotal) || 0), 0),
      invoices: daySales.filter((x) => (Number(x.taxAmount) || 0) > 0).length,
    };

    // ── أرصدة الصناديق: افتتاحي وختامي ──
    const pools = ["safe", "daily", "custody"];
    const poolBalances = {};
    pools.forEach((pool) => {
      const before2 = ledger.filter((t) => (t.pool || t.source) === pool && before(t))
        .reduce((a, t) => a + (t.type === "out" ? -(Number(t.amount) || 0) : Number(t.amount) || 0), 0);
      const during = dayLedger.filter((t) => (t.pool || t.source) === pool)
        .reduce((a, t) => a + (t.type === "out" ? -(Number(t.amount) || 0) : Number(t.amount) || 0), 0);
      poolBalances[pool] = { open: before2, move: during, close: before2 + during };
    });

    // ── تفصيل المصروفات باسمها ──
    //
    // «مصروفات 3,400» رقم لا يُراجَع. المحاسب يريد: أي مصروف ولمن.
    const dayExp = (expenses || []).filter(inDay);
    const expByName = {};
    dayExp.forEach((e) => {
      const n = e.name || e.label || accountLabel(e.category) || "غير مسمّى";
      expByName[n] = expByName[n] || { name: n, total: 0, count: 0, account: CATEGORY_TO_ACCOUNT[e.category] || "6000" };
      expByName[n].total += Number(e.amount) || 0;
      expByName[n].count += 1;
    });
    const expenseDetail = Object.values(expByName).sort((a, b) => b.total - a.total);

    // ── تفصيل المشتريات بالمورد ──
    const purBySup = {};
    dayLotsAll.forEach((l) => {
      const sup = (suppliers || []).find((x) => x.id === l.supplierId);
      const n = sup?.name || "مورد";
      purBySup[n] = purBySup[n] || { name: n, cash: 0, fine: 0, count: 0, deferred: 0 };
      purBySup[n].fine += fine24(l.weight, l.karat);
      purBySup[n].count += 1;
      if (l.paymentMethod === "deferred") purBySup[n].deferred += fine24(l.weight, l.karat);
      else purBySup[n].cash += (Number(l.goldCost) || 0) + (Number(l.workmanship) || 0);
    });
    const purchaseDetail = Object.values(purBySup).sort((a, b) => b.fine - a.fine);

    // ── تفصيل الهالك ──
    const wasteDetail = waste.map((w) => ({
      ref: w.ref, karat: w.karat,
      weight: Number(w.weight) || 0,
      fine: fine24(w.weight, w.karat),
      value: Number(w.value) || fine24(w.weight, w.karat) * p24,
      note: w.note || "", by: w.createdBy || "",
    }));

    // ── تغطية شجرة الحسابات ──
    const touched = new Set(Object.keys(byAccount).map((c) => CATEGORY_TO_ACCOUNT[c]).filter(Boolean));

    return {
      day, bd, rows, totals: t, transfersTotal,
      prevCash, currCash: prevCash + t.cashIn - t.cashOut,
      prevGoldFine,
      currGoldFine: prevGoldFine + goldTotals.fineIn - goldTotals.fineOut,
      goldByKarat, karats, goldTotals,
      netFees, netFeesTotal,
      salesCount: daySales.length,
      accountsTouched: touched.size,
      accountCodes: [...touched].sort(),
      dayDocs, docsByKind, byUser, receivable, payable, vat, poolBalances,
      expenseDetail, purchaseDetail, wasteDetail,
      docCount: dayDocs.length,
      // الجرام أولًا: صافي الحركة بالوزن لا بالمبلغ
      netCashGrams: g24(t.cashIn - t.cashOut),
      price24: p24,
      K,
    };
  };

  const A = useMemo(() => buildDay(dateA), [dateA, sales, expenses, cashTx, safeTx, scrapEntries, lots, receipts]);
  const B = useMemo(() => (compare && dateB ? buildDay(dateB) : null), [compare, dateB, sales, expenses, cashTx, safeTx, scrapEntries, lots, receipts]);

  const hijriOf = (iso) => {
    try {
      return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", { day: "numeric", month: "numeric", year: "numeric" }).format(new Date(iso));
    } catch {
      return "—";
    }
  };
  const dayName = (iso) => {
    try {
      return new Intl.DateTimeFormat("ar", { weekday: "long" }).format(new Date(iso));
    } catch {
      return "";
    }
  };

  // ── تصدير PDF ──
  //
  // نبني صفحة طباعة مستقلة بدل طباعة الشاشة: الشاشة ليلية وضيّقة،
  // والمحاسب يريد ورقة بيضاء بعرض A4 يقرأها ويحفظها.
  //
  // window.print يتيح «حفظ كـPDF» في كل متصفح — لا مكتبة ولا خادم.

  // ── ورقة اليومية الورقية ──
  //
  // نسخة من دفتر المحل الورقي بحرفيّته: عمودان للريال، عمودان لكل عيار،
  // وعمود لمعادل 24 — والبيانات من شجرة الحسابات لا من تجميع حرّ.
  //
  // ⚠ الدفتران يبقيان منفصلين على الورق كما في النظام: كتلة الريال
  // لا تُجمع مع كتلة الوزن، ولا يُوضع مجموع واحد يخلطهما.
  //
  // A4 عرضًا لأن الأعمدة تكثر بكثرة العيارات.
  const exportPaperSheet = () => {
    const J = A;
    if (!J) return;
    const esc = (x) =>
      String(x == null ? "" : x).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

    // العيارات التي تحرّكت اليوم — لا نطبع أعمدة فارغة
    const ks = (J.karats || []).filter((k) => {
      const r = J.goldByKarat[k];
      return r && (Math.abs(r.in) > 0.0005 || Math.abs(r.out) > 0.0005);
    });

    // ── أسطر البيان: من الشجرة ──
    //
    // كل سطر حسابٌ بكوده، ويحمل حركته النقدية والوزنية معًا في صفّ
    // واحد كما في الورقة — لكن في خانتين لا تُجمعان.
    const lines = (J.rows || [])
      .filter((r) => !r.transfer)
      .map((r) => ({
        label: r.label,
        code: r.account || "",
        cashIn: r.cashIn || 0,
        cashOut: r.cashOut || 0,
        gold: {},
      }));

    // ── ربط حركة الذهب بأسطر البيان ──
    //
    // الذهب يُجمَّع بمصدره (الكسر · خزنة الذهب · تكويد · مبيعات · هالك)،
    // فنضعه في السطر الذي يخصّه. ما لا يقابله قيد نقدي — كنقل بين
    // خزائن أو هالك — يصير سطرًا مستقلًا فلا يضيع من الورقة.
    const SOURCE_TO_LABEL = {
      "الكسر": "شراء الذهب الكسر",
      "مبيعات": "مبيعات الذهب المشغول",
    };
    const extra = {};
    ks.forEach((k) => {
      const r = J.goldByKarat[k] || { sources: {} };
      Object.entries(r.sources || {}).forEach(([src, net]) => {
        const label = SOURCE_TO_LABEL[src] || src;
        let row = lines.find((l) => l.label === label);
        if (!row) {
          row = extra[label] || { label, code: "1200", cashIn: 0, cashOut: 0, gold: {} };
          extra[label] = row;
        }
        row.gold[k] = row.gold[k] || { in: 0, out: 0 };
        if (net >= 0) row.gold[k].in += net;
        else row.gold[k].out += -net;
      });
    });
    Object.values(extra).forEach((r) => lines.push(r));

    const MIN_ROWS = 16; // الورقة تُطبع بأسطر فارغة للكتابة اليدوية
    const blanks = Math.max(0, MIN_ROWS - lines.length);

    const cellsFor = (l) =>
      ks
        .map((k) => {
          const g = l.gold[k] || {};
          return (
            `<td class="c">${g.in ? fmtW(g.in) : ""}</td>` +
            `<td class="c">${g.out ? fmtW(g.out) : ""}</td>`
          );
        })
        .join("") +
      `<td class="c f">${(() => {
        const f = ks.reduce(
          (a, k) => a + fine24((l.gold[k]?.in || 0) - (l.gold[k]?.out || 0), k), 0
        );
        return Math.abs(f) > 0.0005 ? fmtW(f) : "";
      })()}</td>`;

    const body =
      lines
        .map(
          (l) =>
            `<tr>` +
            `<td class="c">${l.cashIn ? fmt(l.cashIn, 2) : ""}</td>` +
            `<td class="c">${l.cashOut ? fmt(l.cashOut, 2) : ""}</td>` +
            `<td class="r bayan">${esc(l.label)}` +
            (l.code ? `<span class="code">${esc(l.code)}</span>` : "") +
            `</td>` +
            cellsFor(l) +
            `<td class="sig"></td>` +
            `</tr>`
        )
        .join("") +
      Array.from({ length: blanks })
        .map(
          () =>
            `<tr class="blank"><td></td><td></td><td></td>` +
            ks.map(() => "<td></td><td></td>").join("") +
            `<td></td><td class="sig"></td></tr>`
        )
        .join("");

    // ── المجاميع ──
    const totIn = lines.reduce((a, l) => a + l.cashIn, 0);
    const totOut = lines.reduce((a, l) => a + l.cashOut, 0);
    const totals =
      `<tr class="tot">` +
      `<td class="c">${fmt(totIn, 2)}</td>` +
      `<td class="c">${fmt(totOut, 2)}</td>` +
      `<td class="r">المجاميع</td>` +
      ks
        .map((k) => {
          const r = J.goldByKarat[k];
          return `<td class="c">${r.in ? fmtW(r.in) : ""}</td><td class="c">${r.out ? fmtW(r.out) : ""}</td>`;
        })
        .join("") +
      `<td class="c f">${fmtW(J.goldTotals.fineIn - J.goldTotals.fineOut)}</td>` +
      `<td class="sig"></td></tr>`;

    // ── جدول الأرصدة: صندوق الريال وصندوق كل عيار ──
    const cashPool = J.poolBalances?.daily || { open: 0, close: 0 };
    const balRows = [
      ["رصيد اليوم السابق", fmt(J.prevCash, 2), ks.map(() => "")],
      ["إجمالي الوارد للصندوق", fmt(totIn, 2), ks.map((k) => fmtW(J.goldByKarat[k].in))],
      ["إجمالي المنصرف من الصندوق", fmt(totOut, 2), ks.map((k) => fmtW(J.goldByKarat[k].out))],
      [
        "الفرق (فائض / عجز)",
        fmt(totIn - totOut, 2),
        ks.map((k) => fmtW(J.goldByKarat[k].in - J.goldByKarat[k].out)),
      ],
      ["رصيد اليوم الحالي", fmt(J.currCash, 2), ks.map(() => "")],
    ];

    const balTable =
      `<table class="bal"><thead><tr><th>البيان</th><th>صندوق الريال</th>` +
      ks.map((k) => `<th>صندوق ${k}</th>`).join("") +
      `<th>معادل 24</th></tr></thead><tbody>` +
      balRows
        .map(([label, cash, gold], i) => {
          const fine =
            i === 3
              ? fmtW(ks.reduce((a, k) => a + fine24(J.goldByKarat[k].in - J.goldByKarat[k].out, k), 0))
              : i === 1
              ? fmtW(J.goldTotals.fineIn)
              : i === 2
              ? fmtW(J.goldTotals.fineOut)
              : i === 0
              ? fmtW(J.prevGoldFine)
              : fmtW(J.currGoldFine);
          return (
            `<tr${i === 4 ? ' class="tot"' : ""}><td class="r">${esc(label)}</td>` +
            `<td class="c">${cash}</td>` +
            gold.map((g) => `<td class="c">${g}</td>`).join("") +
            `<td class="c f">${fine}</td></tr>`
          );
        })
        .join("") +
      `</tbody></table>`;

    const hijri = (() => {
      try {
        return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
          day: "numeric", month: "numeric", year: "numeric",
        }).format(new Date(J.day));
      } catch (e) {
        return "";
      }
    })();
    const weekday = new Date(J.day).toLocaleDateString("ar", { weekday: "long" });

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>يومية ${esc(J.day)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: "Tajawal","Segoe UI",sans-serif; color:#1a6b45; margin:0; font-size:10px; }
  .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
  .head h1 { font-size:19px; margin:0; color:#1a6b45; }
  .logo { width:34px; height:34px; border:2px solid #1a6b45; border-radius:50%;
          display:grid; place-items:center; font-weight:800; font-size:15px; }
  table { width:100%; border-collapse:collapse; }
  th,td { border:1px solid #1a6b45; padding:2px 4px; font-size:9.5px; }
  th { font-weight:700; text-align:center; }
  td.c { text-align:center; }
  td.r { text-align:right; }
  td.f, th.f { background:#f2f8f4; }
  .meta td { border:1px solid #1a6b45; padding:4px 6px; font-size:10px; }
  .bayan { font-weight:600; }
  .code { color:#6aa088; font-size:8px; margin-right:5px; font-family:monospace; }
  tr.blank td { height:17px; }
  tr.tot td { font-weight:800; background:#eef6f1; }
  .sig { width:52px; }
  .bal { margin-top:6px; }
  .bal th { background:#eef6f1; }
  .notes { margin-top:6px; }
  .notes td { height:19px; }
  .foot { margin-top:8px; display:flex; justify-content:space-between; align-items:flex-end; font-size:10px; }
  .dots { border-bottom:1px dotted #1a6b45; min-width:190px; display:inline-block; }
  .rule { color:#6aa088; font-size:8px; margin-top:3px; }
</style></head><body>

<div class="head">
  <div class="logo">J</div>
  <h1>${esc(branchName || "المحل")}</h1>
  <div style="width:34px"></div>
</div>

<table class="meta"><tr>
  <td style="width:22%">ملخص الحركة اليومية (ريال / ذهب)</td>
  <td style="width:16%">يومية رقم: ${esc(J.bd?.ref || "")}</td>
  <td style="width:16%">اليوم: ${esc(weekday)}</td>
  <td style="width:20%">التاريخ: ${esc(J.day)}</td>
  <td style="width:26%">الموافق: ${esc(hijri)}</td>
</tr></table>

<table style="margin-top:4px">
  <thead>
    <tr>
      <th colspan="2">حركة الريال</th>
      <th rowspan="2" style="width:26%">البيــــان</th>
      ${ks.map((k) => `<th colspan="2">حركة الذهب بعيار ${k}</th>`).join("")}
      <th rowspan="2" class="f">معادل 24</th>
      <th rowspan="2" class="sig">التوقيع</th>
    </tr>
    <tr>
      <th>وارد / داخل</th><th>منصرف / خارج</th>
      ${ks.map(() => `<th>وارد / داخل</th><th>منصرف / خارج</th>`).join("")}
    </tr>
  </thead>
  <tbody>${body}${totals}</tbody>
</table>

${balTable}

<table class="notes"><thead><tr><th>الملاحظات</th></tr></thead>
<tbody><tr><td></td></tr><tr><td></td></tr></tbody></table>

<div class="rule">
  ⚖ الريال والذهب دفتران منفصلان: لا يُجمعان في رقم واحد.
  ومعادل 24 للمقارنة لا للجمع مع الريال.
  ${J.vat.collected > 0 ? `· ضريبة محصّلة ${fmt(J.vat.collected, 2)} (حساب 2220)` : ""}
</div>

<div class="foot">
  <span>إسم وتوقيع المستلم: <span class="dots"></span></span>
  <span>طُبعت ${esc(new Date().toLocaleString("en-GB"))} · أوقية</span>
</div>

<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      flashToast("امنع حظر النوافذ المنبثقة للطباعة");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  const exportPdf = () => {
    const J = A;
    if (!J) return;
    const esc = (x) => String(x == null ? "" : x).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const tbl = (headers, rows) =>
      `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` +
      `<tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? "r" : "c"}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

    const cashRows = J.rows.filter((r) => !r.transfer)
      .map((r) => [
        r.label + (r.note ? ` — ${r.note}` : ""),
        r.account || "—",
        r.cashIn ? fmt(r.cashIn, 2) : "",
        r.cashOut ? fmt(r.cashOut, 2) : "",
      ]);
    cashRows.push(["المجاميع", "", fmt(J.totals.cashIn, 2), fmt(J.totals.cashOut, 2)]);

    const goldRows = J.karats.map((k) => {
      const r = J.goldByKarat[k];
      const net = r.in - r.out;
      return [`عيار ${k}`, fmt(r.in), fmt(r.out), fmt(net), fmt(fine24(net, k))];
    });
    goldRows.push(["المجموع", fmt(J.goldTotals.fineIn), fmt(J.goldTotals.fineOut), "",
      fmt(J.goldTotals.fineIn - J.goldTotals.fineOut)]);

    const poolRows = [["safe", "الخزنة"], ["daily", "الصندوق اليومي"], ["custody", "عهدة الكسر"]].map(([k, l]) => {
      const b = J.poolBalances[k] || {};
      return [l, fmt(b.open, 2), fmt(b.move, 2), fmt(b.close, 2)];
    });

    const docRows = (J.dayDocs || []).map((r) => [
      (INDEX_KINDS[r.kind] || {}).label || r.kind, r.ref,
      r.date ? new Date(r.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "",
      r.summary, r.who || "",
      r.amount ? fmt(r.amount, 2) : "", r.fine ? fmt(r.fine) : "",
    ]);

    const userRows = Object.entries(J.byUser || {})
      .sort((a, b) => b[1].docs - a[1].docs)
      .map(([w, v]) => [w, v.docs, fmt(v.amount, 2), fmt(v.fine)]);

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>يومية ${esc(J.day)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Tajawal","Segoe UI",sans-serif; color:#111; margin:0; font-size:11px; }
  h1 { font-size:17px; margin:0 0 2px; }
  h2 { font-size:12px; margin:14px 0 5px; padding-bottom:3px; border-bottom:1.5px solid #333; }
  .sub { color:#555; font-size:10px; margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; margin-bottom:6px; }
  th,td { border:1px solid #bbb; padding:3px 5px; font-size:10px; }
  th { background:#eee; font-weight:700; }
  td.c { text-align:center; }
  td.r { text-align:right; }
  tbody tr:last-child td { font-weight:700; background:var(--bg); }
  .grid { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:8px; }
  .box { border:1px solid #bbb; padding:6px 9px; min-width:110px; }
  .box b { display:block; font-size:13px; }
  .box span { color:#555; font-size:9px; }
  .note { color:#666; font-size:9px; margin-top:2px; }
  .foot { margin-top:16px; padding-top:6px; border-top:1px solid #999; color:#555; font-size:9px;
          display:flex; justify-content:space-between; }
  .sign { margin-top:22px; display:flex; gap:28px; }
  .sign div { flex:1; border-top:1px solid #333; padding-top:3px; text-align:center; font-size:10px; }
  @media print { .noprint { display:none; } }
</style></head><body>
<h1>يومية ${esc(branchName || "المحل")}</h1>
<div class="sub">التاريخ ${esc(J.day)}${J.bd ? " · " + esc(J.bd.ref) : ""} ·
  سعر جرام عيار 24: ${esc(currency)}${fmt(J.price24, 2)} ·
  طُبعت ${esc(new Date().toLocaleString("en-GB"))}</div>

<div class="grid">
  <div class="box"><span>صافي الذهب</span><b>${fmtW(J.goldTotals.fineIn - J.goldTotals.fineOut)} جم24</b></div>
  <div class="box"><span>وارد نقدي</span><b>${esc(currency)}${fmt(J.totals.cashIn, 2)}</b></div>
  <div class="box"><span>منصرف نقدي</span><b>${esc(currency)}${fmt(J.totals.cashOut, 2)}</b></div>
  <div class="box"><span>الفرق</span><b>${esc(currency)}${fmt(J.totals.cashIn - J.totals.cashOut, 2)}</b></div>
  <div class="box"><span>عدد المستندات</span><b>${J.docCount}</b></div>
  <div class="box"><span>حسابات متحرّكة</span><b>${J.accountsTouched}</b></div>
</div>

<h2>الحركة النقدية</h2>
${tbl(["البيان", "الحساب", "وارد", "منصرف"], cashRows)}
<div class="note">التحويلات الداخلية مستثناة من المجاميع — طرفاها يُلغيان بعضهما.</div>

<h2>حركة الذهب حسب العيار</h2>
${tbl(["العيار", "وارد (جم)", "منصرف (جم)", "الصافي", "بعيار 24"], goldRows)}
<div class="note">المجموع بعيار 24 — جمع العيارات بلا تحويل يعطي رقمًا لا معنى له.</div>

<h2>أرصدة الصناديق</h2>
${tbl(["الصندوق", "افتتاحي", "حركة اليوم", "ختامي"], poolRows)}

<h2>الذمم والضريبة</h2>
${tbl(["البند", "القيمة"], [
  ["ذمم العملاء — زيادة (بيع آجل)", fmt(J.receivable.up, 2)],
  ["ذمم العملاء — تحصيل", fmt(J.receivable.down, 2)],
  ["مستحق الموردين — ذهب", fmt(J.payable.goldUp) + " جم24"],
  ["مستحق الموردين — أجور", fmt(J.payable.feesUp, 2)],
  ["ضريبة محصّلة (2220)", fmt(J.vat.collected, 2)],
  ["وعاء الضريبة", fmt(J.vat.base, 2)],
])}
<div class="note">⚖ التزام المورد ببُعدين: الذهب بالجرام والأجور بالعملة — لا يُخلطان.</div>

${Object.keys(J.netFees || {}).length ? `<h2>عمولات الشبكة</h2>` +
  tbl(["البطاقة", "الأساس", "النسبة٪", "العمولة"],
    Object.entries(J.netFees).map(([c, v]) => [
      (CARD_NETWORKS.find((n) => n.id === c) || {}).label || c,
      fmt(v.base, 2), v.base > 0 ? fmt((v.amount / v.base) * 100, 2) : "", fmt(v.amount, 2),
    ])) +
  `<div class="note">تُقيَّد مصروفًا تشغيليًا (6500) ولا تُنقص من الإيراد.</div>` : ""}

${userRows.length ? `<h2>نشاط اليوم بالمستخدم</h2>` +
  tbl(["المستخدم", "المستندات", "المبلغ", "الوزن (جم24)"], userRows) : ""}

${docRows.length ? `<h2>مستندات اليوم (${docRows.length})</h2>` +
  tbl(["النوع", "المرجع", "الوقت", "البيان", "بواسطة", "المبلغ", "الوزن"], docRows) : ""}

<h2>الأرصدة</h2>
${tbl(["البيان", "الذهب (جم24)", `النقد (${currency})`], [
  ["رصيد اليوم السابق", fmt(J.prevGoldFine), fmt(J.prevCash, 2)],
  ["إجمالي الوارد", fmt(J.goldTotals.fineIn), fmt(J.totals.cashIn, 2)],
  ["إجمالي المنصرف", fmt(J.goldTotals.fineOut), fmt(J.totals.cashOut, 2)],
  ["رصيد اليوم الحالي", fmt(J.currGoldFine), fmt(J.currCash, 2)],
])}
<div class="note">⚖ دفتران مستقلان — الوزن بالجرام والنقد بالعملة، لا يُجمعان.</div>

<div class="sign"><div>أعدّها</div><div>راجعها</div><div>اعتمدها</div></div>
<div class="foot"><span>${esc(branchName || "")} — يومية ${esc(J.day)}</span><span>أوقية</span></div>
<script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      flashToast("امنع حظر النوافذ المنبثقة لتصدير PDF");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const mk = (J, title) => {
      const rows = [
        [`ملخص الحركة اليومية — ${branchName || "أوقية"}`],
        [`التاريخ: ${J.day}`, `اليوم: ${dayName(J.day)}`, `هجري: ${hijriOf(J.day)}`, J.bd?.ref ? `يومية رقم: ${J.bd.ref}` : ""],
        [],
        [`وارد (${currency})`, `منصرف (${currency})`, "البيان", "الحساب"],
      ];
      J.rows.forEach((r) => rows.push([r.cashIn || "", r.cashOut || "", r.label, r.account || ""]));
      rows.push([fmt(J.totals.cashIn, 2), fmt(J.totals.cashOut, 2), "المجاميع", ""]);
      rows.push([]);
      rows.push(["حركة الذهب حسب العيار"]);
      rows.push(["العيار", "وارد (جم)", "منصرف (جم)", "الصافي", "بعيار 24", `بعيار ${J.K}`]);
      J.karats.forEach((k) => {
        const r = J.goldByKarat[k];
        const net = r.in - r.out;
        rows.push([k, fmt(r.in), fmt(r.out), fmt(net), fmt(fine24(net, k)), fmt(fineAt(net, k, J.K))]);
      });
      rows.push(["المجموع", fmt(J.goldTotals.fineIn), fmt(J.goldTotals.fineOut),
        fmt(J.goldTotals.fineIn - J.goldTotals.fineOut), "", fmt(J.goldTotals.k21In - J.goldTotals.k21Out)]);
      if (Object.keys(J.netFees).length) {
        rows.push([]);
        rows.push(["عمولات الشبكة"]);
        rows.push(["البطاقة", "الأساس", "العمولة", "النسبة٪"]);
        Object.entries(J.netFees).forEach(([card, v]) => {
          const label = CARD_NETWORKS.find((n) => n.id === card)?.label || card;
          rows.push([label, fmt(v.base, 2), fmt(v.amount, 2), v.base > 0 ? fmt((v.amount / v.base) * 100, 2) : ""]);
        });
      }
      rows.push([]);
      rows.push(["البيان", "الذهب (جم24)", `الريال (${currency})`]);
      rows.push(["رصيد اليوم السابق", fmt(J.prevGoldFine), fmt(J.prevCash, 2)]);
      rows.push(["إجمالي الوارد", fmt(J.goldTotals.fineIn), fmt(J.totals.cashIn, 2)]);
      rows.push(["إجمالي المنصرف", fmt(J.goldTotals.fineOut), fmt(J.totals.cashOut, 2)]);
      rows.push(["الفرق (فائض/عجز)", fmt(J.goldTotals.fineIn - J.goldTotals.fineOut), fmt(J.totals.cashIn - J.totals.cashOut, 2)]);
      rows.push(["رصيد اليوم الحالي", fmt(J.currGoldFine), fmt(J.currCash, 2)]);
      rows.push([]);
      rows.push(["أرصدة الصناديق"]);
      rows.push(["الصندوق", "افتتاحي", "حركة", "ختامي"]);
      [["safe", "الخزنة"], ["daily", "الصندوق اليومي"], ["custody", "عهدة الكسر"]].forEach(([k, l]) => {
        const b = J.poolBalances[k] || {};
        rows.push([l, fmt(b.open, 2), fmt(b.move, 2), fmt(b.close, 2)]);
      });
      rows.push([]);
      rows.push(["الذمم والضريبة"]);
      rows.push(["ذمم عملاء — زيادة", fmt(J.receivable.up, 2)]);
      rows.push(["ذمم عملاء — تحصيل", fmt(J.receivable.down, 2)]);
      rows.push(["مستحق موردين — ذهب (جم24)", fmt(J.payable.goldUp)]);
      rows.push(["مستحق موردين — أجور", fmt(J.payable.feesUp, 2)]);
      rows.push(["ضريبة محصّلة", fmt(J.vat.collected, 2)]);
      rows.push(["وعاء الضريبة", fmt(J.vat.base, 2)]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), title);
    };
    if (A) mk(A, `يومية ${A.day}`);
    if (B) mk(B, `يومية ${B.day}`);
    XLSX.writeFile(wb, `اليومية_${dateA}${B ? "_مقارنة_" + dateB : ""}.xlsx`);
  };

  // ⚠ الأنماط على مستوى المكوّن لا داخل Sheet: أقسام المحاسب خارجها
  // وكانت تستخدمها فتنهار الصفحة.
  const cell = { border: "1px solid var(--line)", padding: "5px 6px", fontSize: 11, whiteSpace: "nowrap" };
  const head = { ...cell, background: "var(--panel)", color: "var(--accent)", fontWeight: 700, textAlign: "center" };

  const Sheet = ({ J, muted }) => {
    if (!J) return null;
    return (
      <Card style={{ padding: 12, marginBottom: 12, opacity: muted ? 0.92 : 1 }}>
        {/* الترويسة */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
          <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold">
            ملخص الحركة اليومية {J.bd?.ref ? `· ${J.bd.ref}` : ""}
          </span>
          <span style={{ color: "var(--text2)" }} className="text-[11px]">
            {dayName(J.day)} · {J.day} · {hijriOf(J.day)}
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ ...head, width: 80 }}>وارد</th>
                <th style={{ ...head, width: 80 }}>منصرف</th>
                <th style={head}>البيان</th>
                <th style={{ ...head, width: 70 }}>كسر وارد</th>
                <th style={{ ...head, width: 70 }}>كسر منصرف</th>
              </tr>
            </thead>
            <tbody>
              {J.rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...cell, color: r.cashIn ? "var(--goodSolid)" : "var(--accentLine)", textAlign: "center" }}>
                    {r.cashIn ? fmt(r.cashIn, 0) : "—"}
                  </td>
                  <td style={{ ...cell, color: r.cashOut ? "var(--bad)" : "var(--accentLine)", textAlign: "center" }}>
                    {r.cashOut ? fmt(r.cashOut, 0) : "—"}
                  </td>
                  <td style={{ ...cell, color: r.fixed ? "var(--text)" : r.transfer ? "var(--text3)" : "var(--text2)", whiteSpace: "normal" }}>
                    {r.label}
                    {r.transfer && <span style={{ color: "var(--text3)" }} className="text-[10px]"> · تحويل داخلي</span>}
                    {r.memo && <span style={{ color: "var(--text3)" }} className="text-[10px]"> · بيان لا نقد</span>}
                    {r.account && (
                      <span style={{ color: "var(--text3)", fontFamily: "monospace" }} className="text-[9px]"> {r.account}</span>
                    )}
                    {r.note && (
                      <span style={{ color: "var(--text3)" }} className="block text-[10px]">{r.note}</span>
                    )}
                  </td>
                  <td style={{ ...cell, color: r.goldIn ? "var(--goodSolid)" : "var(--accentLine)", textAlign: "center" }}>
                    {r.goldIn ? fmt(r.goldIn) : "—"}
                  </td>
                  <td style={{ ...cell, color: r.goldOut ? "var(--bad)" : "var(--accentLine)", textAlign: "center" }}>
                    {r.goldOut ? fmt(r.goldOut) : "—"}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ ...head, textAlign: "center" }}>{fmt(J.totals.cashIn, 0)}</td>
                <td style={{ ...head, textAlign: "center" }}>{fmt(J.totals.cashOut, 0)}</td>
                <td style={head}>المجاميع</td>
                <td style={{ ...head, textAlign: "center" }}>{fmt(J.totals.goldIn)}</td>
                <td style={{ ...head, textAlign: "center" }}>{fmt(J.totals.goldOut)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── جدول الذهب بكل عيار ── */}
        {J.karats.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
              حركة الذهب حسب العيار
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={{ ...head, width: 52 }}>العيار</th>
                  <th style={head}>وارد</th>
                  <th style={head}>منصرف</th>
                  <th style={head}>الصافي</th>
                  <th style={{ ...head, width: 78 }}>بعيار 24</th>
                  <th style={{ ...head, width: 78 }}>بعيار {J.K}</th>
                </tr>
              </thead>
              <tbody>
                {J.karats.map((k) => {
                  const r = J.goldByKarat[k];
                  const net = r.in - r.out;
                  return (
                    <tr key={k}>
                      <td style={{ ...cell, color: "var(--accent)", fontWeight: 700, textAlign: "center" }}>{k}</td>
                      <td style={{ ...cell, color: r.in ? "var(--goodSolid)" : "var(--accentLine)", textAlign: "center" }}>
                        {r.in ? fmt(r.in) : "—"}
                      </td>
                      <td style={{ ...cell, color: r.out ? "var(--bad)" : "var(--accentLine)", textAlign: "center" }}>
                        {r.out ? fmt(r.out) : "—"}
                      </td>
                      <td style={{ ...cell, color: net >= 0 ? "var(--goodSolid)" : "var(--bad)", textAlign: "center", fontWeight: 700 }}>
                        {net >= 0 ? "+" : "−"}{fmt(Math.abs(net))}
                      </td>
                      <td style={{ ...cell, color: "var(--text2)", textAlign: "center" }}>
                        {fmt(fine24(net, k))}
                      </td>
                      <td style={{ ...cell, color: "var(--text2)", textAlign: "center" }}>
                        {fmt(fineAt(net, k, J.K))}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td style={head}>المجموع</td>
                  <td style={{ ...head, textAlign: "center" }}>{fmt(J.goldTotals.fineIn)}</td>
                  <td style={{ ...head, textAlign: "center" }}>{fmt(J.goldTotals.fineOut)}</td>
                  <td style={{ ...head, textAlign: "center" }}>
                    {fmt(J.goldTotals.fineIn - J.goldTotals.fineOut)}
                  </td>
                  <td style={{ ...head, textAlign: "center" }}>
                    {fmt(J.goldTotals.fineIn - J.goldTotals.fineOut)}
                  </td>
                  <td style={{ ...head, textAlign: "center" }}>
                    {fmt(J.goldTotals.k21In - J.goldTotals.k21Out)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
              ⚖ المجموع بعيار 24 — جمع العيارات بلا تحويل يعطي رقمًا لا معنى له.
            </p>
          </div>
        )}

        {/* مصادر حركة الذهب */}
        {J.karats.length > 0 && (
          <Card style={{ padding: 10, marginTop: 10 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px] font-bold mb-1">من أين جاء الذهب وإلى أين ذهب</p>
            {(() => {
              const bySource = {};
              J.karats.forEach((k) => {
                Object.entries(J.goldByKarat[k].sources).forEach(([src, w]) => {
                  bySource[src] = (bySource[src] || 0) + fine24(w, k);
                });
              });
              const entries = Object.entries(bySource).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
              return entries.length === 0 ? (
                <p style={{ color: "var(--text3)" }} className="text-[11px]">لا حركة</p>
              ) : (
                entries.map(([src, w], i) => (
                  <div key={src} className="flex items-center justify-between py-1"
                    style={{ borderBottom: i < entries.length - 1 ? "1px solid var(--line)" : "none" }}>
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">{src}</span>
                    <span style={{ color: w >= 0 ? "var(--goodSolid)" : "var(--bad)" }} className="text-xs font-bold">
                      {w >= 0 ? "+" : "−"}{fmtW(Math.abs(w))} جم24
                    </span>
                  </div>
                ))
              );
            })()}
          </Card>
        )}

        {/* صندوق الأرصدة */}
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
            <thead>
              <tr>
                <th style={head}>البيان</th>
                <th style={{ ...head, width: 110 }}>الذهب (جم24)</th>
                <th style={{ ...head, width: 110 }}>الريال</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["رصيد اليوم السابق", J.prevCash, J.prevGoldFine, "var(--text2)"],
                ["إجمالي الوارد", J.totals.cashIn, J.goldTotals.fineIn, "var(--goodSolid)"],
                ["إجمالي المنصرف", J.totals.cashOut, J.goldTotals.fineOut, "var(--bad)"],
                ["الفرق (فائض/عجز)", J.totals.cashIn - J.totals.cashOut, J.goldTotals.fineIn - J.goldTotals.fineOut, null],
                ["رصيد اليوم الحالي", J.currCash, J.currGoldFine, "var(--accent)"],
              ].map(([label, c, g, color], i) => (
                <tr key={i}>
                  <td style={{ ...cell, color: i === 4 ? "var(--text)" : "var(--text2)", fontWeight: i === 4 ? 700 : 400 }}>{label}</td>
                  <td style={{ ...cell, textAlign: "center", color: color || (g >= 0 ? "var(--goodSolid)" : "var(--bad)"), fontWeight: 700 }}>
                    {fmt(g)}
                  </td>
                  <td style={{ ...cell, textAlign: "center", color: "var(--text2)" }}>
                    {currency}{fmt(c, 0)}
                    <span style={{ color: "var(--text3)" }} className="block text-[9px]">
                      {J.price24 > 0 ? `${fmtW(c / J.price24)} جم` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {J.transfersTotal > 0 && (
          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2">
            التحويلات الداخلية {currency}{fmt(J.transfersTotal, 0)} — معروضة ومستثناة من المجاميع، لأن نقل المال بين صناديقك ليس دخلًا ولا خرجًا.
          </p>
        )}
        <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2">
          {J.salesCount} فاتورة · {J.rows.length} حركة · {J.accountsTouched} حساب
          {J.bd?.openedBy ? ` · فتح اليوم ${J.bd.openedBy}` : ""}
          {J.bd?.closedBy ? ` · أقفله ${J.bd.closedBy}` : ""}
        </p>
      </Card>
    );
  };

  return (
    <div>
      <SubPageHeader title="اليومية" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field label="تاريخ اليومية">
            <input style={inputStyle} type="date" value={dateA} onChange={(e) => setDateA(e.target.value)} />
          </Field>
          <Field label="مقارنة مع">
            <input
              style={inputStyle}
              type="date"
              value={dateB}
              onChange={(e) => {
                setDateB(e.target.value);
                setCompare(!!e.target.value);
              }}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => {
              const d = new Date(dateA);
              d.setDate(d.getDate() - 1);
              setDateB(d.toISOString().slice(0, 10));
              setCompare(true);
            }}
            className="py-2 rounded-xl text-[11px] font-bold"
            style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
          >
            قارن بأمس
          </button>
          <button
            onClick={exportXlsx}
            className="py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5"
            style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}
          >
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button
            onClick={exportPdf}
            className="py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5"
            style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
          >
            <FileText size={13} /> PDF
          </button>
          <button
            onClick={exportPaperSheet}
            className="py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5"
            style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}
          >
            <Printer size={13} /> ورقة اليومية
          </button>
        </div>

        {B && (
          <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
              الفرق بين اليومين
            </p>
            {[
              ["الوارد", A.totals.cashIn, B.totals.cashIn, currency],
              ["المنصرف", A.totals.cashOut, B.totals.cashOut, currency],
              ["رصيد الصندوق", A.currCash, B.currCash, currency],
              ["ذهب وارد (جم24)", A.goldTotals.fineIn, B.goldTotals.fineIn, ""],
              ["ذهب منصرف (جم24)", A.goldTotals.fineOut, B.goldTotals.fineOut, ""],
              ["رصيد الذهب (جم24)", A.currGoldFine, B.currGoldFine, ""],
              ["عمولات الشبكة", A.netFeesTotal, B.netFeesTotal, currency],
            ].map(([label, a, b, unit], i) => {
              const d = a - b;
              return (
                <div key={i} className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--text2)" }} className="text-[11px]">{label}</span>
                  <span className="text-[11px]">
                    <span style={{ color: "var(--text)" }}>{unit}{fmt(a, unit ? 0 : 2)}</span>
                    <span style={{ color: "var(--text3)" }}> مقابل {unit}{fmt(b, unit ? 0 : 2)} · </span>
                    <span style={{ color: Math.abs(d) < 0.005 ? "var(--text2)" : d > 0 ? "var(--goodSolid)" : "var(--bad)", fontWeight: 700 }}>
                      {Math.abs(d) < 0.005 ? "متساوٍ" : `${d > 0 ? "▲" : "▼"} ${unit}${fmt(Math.abs(d), unit ? 0 : 2)}`}
                    </span>
                  </span>
                </div>
              );
            })}
          </Card>
        )}

        <Sheet J={A} />
        {B && <Sheet J={B} muted />}

        {/* عمولات الشبكة */}
        {Object.keys(A.netFees).length > 0 && (
          <Card style={{ padding: 12, marginBottom: 10 }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: "var(--accent)" }} className="text-[11px] font-bold">
                عمولات الشبكة — {currency}{fmt(A.netFeesTotal, 2)}
              </span>
              <button
                onClick={onEditFees}
                className="text-[10px] px-2.5 py-1 rounded-full"
                style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
              >
                تعديل النسب
              </button>
            </div>
            {Object.entries(A.netFees).map(([card, v], i, arr) => {
              const label = CARD_NETWORKS.find((n) => n.id === card)?.label || "أخرى";
              const pct = v.base > 0 ? (v.amount / v.base) * 100 : 0;
              return (
                <div key={card} className="flex items-center justify-between py-1"
                  style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <span style={{ color: "var(--text2)" }} className="text-[11px]">
                    {label}
                    <span style={{ color: "var(--text3)" }} className="text-[10px]"> · {v.count} عملية</span>
                  </span>
                  <span className="text-[11px] whitespace-nowrap">
                    <span style={{ color: "var(--text3)" }}>{fmt(v.base, 0)} × {fmt(pct, 2)}٪ = </span>
                    <span style={{ color: "var(--bad)", fontWeight: 700 }}>{fmt(v.amount, 2)}</span>
                  </span>
                </div>
              );
            })}
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1.5">
              تُخصم آليًا عند البيع بالبطاقة، وتُقيَّد مصروفًا تشغيليًا (6500) لا تُنقص من الإيراد.
            </p>
          </Card>
        )}

        {/* ── تفصيل المشتريات ── */}
        {A.purchaseDetail?.length > 0 && (
          <>
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1 mt-3">
              مشتريات اليوم بالمورد
            </p>
            <Card style={{ padding: 11, marginBottom: 10 }}>
              {A.purchaseDetail.map((p2, i, arr) => (
                <div key={i} className="py-1"
                  style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--text)" }} className="text-xs flex-1">{p2.name}</span>
                    <span style={{ color: "var(--accent)" }} className="text-[11px]">{fmtW(p2.fine)} جم24</span>
                    {p2.cash > 0 && (
                      <span style={{ color: "var(--text2)" }} className="text-[11px]">
                        {currency}{fmt(p2.cash, 0)}
                      </span>
                    )}
                  </div>
                  {p2.deferred > 0 && (
                    <p style={{ color: "var(--accentText)" }} className="text-[10px]">
                      منها {fmtW(p2.deferred)} جم24 آجلة — التزام لا نقد
                    </p>
                  )}
                </div>
              ))}
            </Card>
          </>
        )}

        {/* ── تفصيل المصروفات ── */}
        {A.expenseDetail?.length > 0 && (
          <>
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
              مصروفات اليوم
            </p>
            <Card style={{ padding: 11, marginBottom: 10 }}>
              {A.expenseDetail.map((e, i, arr) => (
                <div key={i} className="flex items-center gap-2 py-1"
                  style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <span style={{ color: "var(--text)" }} className="text-xs flex-1">
                    {e.name}
                    {e.count > 1 && <span style={{ color: "var(--text3)" }} className="text-[10px]"> ×{e.count}</span>}
                  </span>
                  <span style={{ color: "var(--text3)", fontFamily: "monospace" }} className="text-[9px]">{e.account}</span>
                  <span style={{ color: "var(--bad)" }} className="text-[11px]">
                    {currency}{fmt(e.total, 2)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1.5 mt-1"
                style={{ borderTop: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text2)" }} className="text-[11px]">المجموع</span>
                <span style={{ color: "var(--bad)" }} className="text-xs font-bold">
                  {currency}{fmt(A.expenseDetail.reduce((a, e) => a + e.total, 0), 2)}
                </span>
              </div>
            </Card>
          </>
        )}

        {/* ── الهالك: وزنًا وقيمةً ── */}
        {A.wasteDetail?.length > 0 && (
          <>
            <p style={{ color: "var(--bad)" }} className="text-[11px] font-bold mb-1">
              الهالك والفاقد ({A.wasteDetail.length})
            </p>
            <Card style={{ padding: 11, marginBottom: 10, border: "1px solid var(--badLine)" }}>
              {A.wasteDetail.map((w, i, arr) => (
                <div key={i} className="py-1"
                  style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[10px]">
                      {w.ref}
                    </span>
                    <span style={{ color: "var(--text)" }} className="text-xs flex-1">
                      عيار {w.karat} · {fmtW(w.weight)} جم
                    </span>
                    <span style={{ color: "var(--bad)" }} className="text-[11px]">
                      {fmtW(w.fine)} جم24
                    </span>
                  </div>
                  <p style={{ color: "var(--text2)" }} className="text-[10px]">
                    تكلفته {currency}{fmt(w.value, 2)}
                    {w.note ? ` · ${w.note}` : ""}
                    {w.by ? ` · ${w.by}` : ""}
                  </p>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1.5 mt-1"
                style={{ borderTop: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text2)" }} className="text-[11px]">مجموع الهالك</span>
                <span className="text-xs font-bold">
                  <span style={{ color: "var(--bad)" }}>
                    {fmtW(A.wasteDetail.reduce((a, w) => a + w.fine, 0))} جم24
                  </span>
                  <span style={{ color: "var(--text2)" }}>
                    {" · "}{currency}{fmt(A.wasteDetail.reduce((a, w) => a + w.value, 0), 2)}
                  </span>
                </span>
              </div>
              <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                ⚖ خسارة مزدوجة: وزنٌ خرج وقيمةٌ ذهبت معه — يُقيَّد في 5310.
              </p>
            </Card>
          </>
        )}

        {/* ── أرصدة الصناديق ── */}
        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1 mt-3">
          أرصدة الصناديق
        </p>
        <div style={{ overflowX: "auto", marginBottom: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 340 }}>
            <thead>
              <tr>
                <th style={head}>الصندوق</th>
                <th style={head}>افتتاحي</th>
                <th style={head}>حركة اليوم</th>
                <th style={head}>ختامي</th>
              </tr>
            </thead>
            <tbody>
              {[["safe", "الخزنة"], ["daily", "الصندوق اليومي"], ["custody", "عهدة الكسر"]].map(([k, label]) => {
                const b = A.poolBalances[k] || { open: 0, move: 0, close: 0 };
                return (
                  <tr key={k}>
                    <td style={{ ...cell, color: "var(--text)" }}>{label}</td>
                    <td style={{ ...cell, color: "var(--text2)", textAlign: "center" }}>{fmt(b.open, 0)}</td>
                    <td style={{ ...cell, color: b.move >= 0 ? "var(--goodSolid)" : "var(--bad)", textAlign: "center" }}>
                      {b.move >= 0 ? "+" : "−"}{fmt(Math.abs(b.move), 0)}
                    </td>
                    <td style={{ ...cell, color: "var(--accent)", textAlign: "center", fontWeight: 700 }}>
                      {fmt(b.close, 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── الذمم والضريبة ── */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Card style={{ padding: 11 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-1">ذمم العملاء</p>
            <p style={{ color: "var(--bad)" }} className="text-xs font-bold">
              + {currency}{fmt(A.receivable.up, 0)}
            </p>
            <p style={{ color: "var(--good)" }} className="text-xs font-bold">
              − {currency}{fmt(A.receivable.down, 0)}
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
              صافي {fmt(A.receivable.up - A.receivable.down, 0)}
            </p>
          </Card>
          <Card style={{ padding: 11 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-1">مستحق الموردين</p>
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold">
              {fmtW(A.payable.goldUp)} جم24
            </p>
            <p style={{ color: "var(--text2)" }} className="text-xs">
              + أجور {currency}{fmt(A.payable.feesUp, 0)}
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
              ⚖ الذهب بالجرام والأجور بالعملة
            </p>
          </Card>
        </div>

        {A.vat.collected > 0 && (
          <Card style={{ padding: 11, marginBottom: 10 }}>
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--text2)" }} className="text-[11px]">
                ضريبة محصّلة ({A.vat.invoices} فاتورة)
              </span>
              <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                {currency}{fmt(A.vat.collected, 2)}
              </span>
            </div>
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
              على وعاء {currency}{fmt(A.vat.base, 0)} · حساب 2220
            </p>
          </Card>
        )}

        {/* ── نشاط المستخدمين ── */}
        {Object.keys(A.byUser).length > 0 && (
          <>
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
              نشاط اليوم بالمستخدم
            </p>
            <Card style={{ padding: 11, marginBottom: 10 }}>
              {Object.entries(A.byUser)
                .sort((a, b) => b[1].docs - a[1].docs)
                .map(([who, v], i, arr) => (
                  <div key={who} className="flex items-center justify-between py-1"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                    <span style={{ color: "var(--text)" }} className="text-[11px]">
                      {who}
                      <span style={{ color: "var(--text3)" }} className="text-[10px]"> · {v.docs} مستند</span>
                    </span>
                    <span className="text-[11px] whitespace-nowrap">
                      {v.fine > 0 && <span style={{ color: "var(--accent)" }}>{fmtW(v.fine)} جم · </span>}
                      <span style={{ color: "var(--text2)" }}>{currency}{fmt(v.amount, 0)}</span>
                    </span>
                  </div>
                ))}
            </Card>
          </>
        )}

        {/* ── مستندات اليوم ── */}
        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
          مستندات اليوم ({A.docCount})
        </p>
        {A.docCount === 0 ? (
          <Card style={{ padding: 11, marginBottom: 10 }}>
            <p style={{ color: "var(--text3)" }} className="text-[11px]">لا مستندات في هذا اليوم</p>
          </Card>
        ) : (
          <div className="mb-3">
            {Object.entries(A.docsByKind)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([kind, list]) => {
                const k = INDEX_KINDS[kind] || { label: kind, color: "var(--text2)" };
                const sumAmt = list.reduce((a, r) => a + (Number(r.amount) || 0), 0);
                const sumFine = list.reduce((a, r) => a + (Number(r.fine) || 0), 0);
                return (
                  <Card key={kind} style={{ padding: 10, marginBottom: 6 }}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ color: k.color }} className="text-[11px] font-bold">
                        {k.label} ({list.length})
                      </span>
                      <span className="text-[10px] whitespace-nowrap">
                        {sumFine > 0 && <span style={{ color: "var(--accent)" }}>{fmtW(sumFine)} جم · </span>}
                        {sumAmt > 0 && <span style={{ color: "var(--text2)" }}>{currency}{fmt(sumAmt, 0)}</span>}
                      </span>
                    </div>
                    {list.slice(0, 8).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 py-0.5">
                        <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[10px]">
                          {r.ref}
                        </span>
                        <span style={{ color: "var(--text2)" }} className="text-[10px] flex-1">
                          {r.summary}
                        </span>
                        <span style={{ color: "var(--text3)" }} className="text-[10px] whitespace-nowrap">
                          {r.date ? new Date(r.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                    ))}
                    {list.length > 8 && (
                      <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                        و{list.length - 8} مستندًا آخر — في التصدير كاملة
                      </p>
                    )}
                  </Card>
                );
              })}
          </div>
        )}

        {/* تدقيق شجرة الحسابات */}
        <Card style={{ padding: 12, marginBottom: 10 }}>
          <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
            الحسابات المتحرّكة اليوم ({A.accountsTouched})
          </p>
          {A.accountCodes.length === 0 ? (
            <p style={{ color: "var(--text3)" }} className="text-[11px]">لا حركة</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {A.accountCodes.map((code) => {
                const acc = accountByCode(code);
                return (
                  <span key={code} className="text-[10px] px-2 py-1 rounded"
                    style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--accentText)", fontFamily: "monospace" }}>{code}</span>
                    {acc ? ` ${acc.name}` : ""}
                  </span>
                );
              })}
            </div>
          )}
          {A.rows.some((r) => r.category && !r.account) && (
            <p style={{ color: "var(--bad)" }} className="text-[10px] mt-2">
              ⚠ توجد تصنيفات غير مربوطة بحساب في الشجرة — راجعها.
            </p>
          )}
        </Card>

        <p style={{ color: "var(--text3)" }} className="text-[10px] mb-4">
          الأرصدة السابقة محسوبة من كل الحركات قبل التاريخ المختار، فتتطابق مع الدفتر مهما رجعت للخلف.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// الربط مع الأنظمة الأخرى
// ============================================================

export { DailyJournalPage };
