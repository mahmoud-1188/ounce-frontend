import React, { useState } from "react";
import { AlertTriangle, Check, FileMinus, FileSpreadsheet, FileText, Loader2, Receipt, Search, Sparkles, Truck } from "lucide-react";
import * as XLSX from "xlsx";
import { REPORT_AI_RULES, TRACE_TOPICS } from "../core/assistant.js";
import { EXPENSE_CATEGORIES } from "../core/constants.js";
import { REPORT_PERIODS } from "../core/erp.js";
import { PURITY, fmt, fmtW } from "../core/money.js";
import { askReportAi, detectTraceTopic, fundingSourceLabel, hiddenNumbersScan, inputStyle, periodRange, reportFactsText, reportFindings, saleProfitOf, saleProfitSplit } from "../domain/helpers.js";
import { traceEvidence } from "../domain/traceEvidence.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { GramRow } from "../ui/GramRow.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function ReportsTab({
  totals, priceData, salesTotals, cashBalance, safeBalance, safeGoldBalance, revaluation,
  scrapCustodyBalance, scrapTotals, goldEquivalent, purchasesTotals,
  sales = [], expenses = [], expensesTotals, cashTx = [], safeTx = [],
  activeItems = [], items = [], lots = [], suppliers = [], scrapEntries = [],
  taskirEntries = [], weightAdjustments = [], audits = [], users = [],
  safeGoldTx = [], dailyCustody = [], safeAudits = [],
  openingBalance = {}, openDay = null, onBack,
}) {
  const [period, setPeriod] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detailed, setDetailed] = useState(false);
  const [tab, setTab] = useState("overview");
  const [compare, setCompare] = useState(false);
  const [periodB, setPeriodB] = useState("yesterday");
  const [aiNarrative, setAiNarrative] = useState("");
  const [aiFindings, setAiFindings] = useState(null);
  const [aiFindingsText, setAiFindingsText] = useState("");
  const [aiHidden, setAiHidden] = useState(null);
  const [aiHiddenText, setAiHiddenText] = useState("");
  const [aiQ, setAiQ] = useState("");
  const [traceQ, setTraceQ] = useState("");
  const [traceTopic, setTraceTopic] = useState(null);
  const [traceEv, setTraceEv] = useState(null);
  const [traceText, setTraceText] = useState("");
  const [aiA, setAiA] = useState("");
  const [aiBusy, setAiBusy] = useState("");
  const [aiError, setAiError] = useState("");
  const [fromB, setFromB] = useState("");
  const [toB, setToB] = useState("");

  const currency = priceData.currency;
  const range = periodRange(period, from, to, openDay?.id);
  const rangeB = periodRange(periodB, fromB, toB, openDay?.id);
  const labelOf = (pid, f, t) =>
    pid === "custom" ? `${f || "البداية"} ← ${t || "اليوم"}` : REPORT_PERIODS.find((p) => p.id === pid)?.label || "";
  const rangeLabel = labelOf(period, from, to);
  const rangeLabelB = labelOf(periodB, fromB, toB);

  const supplierName = (id) => suppliers.find((x) => x.id === id)?.name || "—";
  const catLabel = (id) => EXPENSE_CATEGORIES.find((c) => c.id === id)?.label || id;
  const price24 = priceData.current || 0;
  const toGrams = (v) => (price24 > 0 ? v / price24 : 0);

  // كل أرقام الفترة تُحسب من دالة واحدة تأخذ نطاقًا. هذا ما يجعل المطابقة
  // موثوقة: العمودان يمرّان بنفس المنطق حرفيًا، فأي فرق بينهما فرق في
  // البيانات لا في طريقة الحساب.
  const metricsFor = (r) => {
    // فلترة يوم العمل بالمعرّف لا بالتاريخ — هذا جوهر النظام: حركة الساعة
    // 1:30 فجرًا تخصّ اليوم المفتوح لا التقويم.
    const inR = r.dayId
      ? (d, rec) => rec?.businessDayId === r.dayId
      : (d) => {
          const x = new Date(d).getTime();
          return x >= r.start.getTime() && x <= r.end.getTime();
        };
    const fSales = sales.filter((x) => inR(x.date, x));
    const fExpenses = expenses.filter((x) => inR(x.date, x));
    const fLots = lots.filter((x) => inR(x.date, x));
    const fScrap = scrapEntries.filter((x) => inR(x.date, x));
    const fTaskir = taskirEntries.filter((x) => inR(x.date, x));
    const fAdj = weightAdjustments.filter((x) => inR(x.date, x));
    const fAudits = audits.filter((x) => inR(x.date, x));

    const salesSum = fSales.reduce((a, x) => a + x.total, 0);
    const salesProfit = fSales.reduce((a, x) => a + saleProfitOf(x), 0);
    // فصل الربح: رأسمالي من السوق · تشغيلي من عملك
    const splitAgg = fSales.reduce(
      (a, x) => {
        const sp = saleProfitSplit(x, priceData.current);
        return {
          capital: a.capital + sp.capitalGain,
          operating: a.operating + sp.operatingProfit,
          metalValue: a.metalValue + sp.metalAtSale,
          workmanship: a.workmanship + sp.workmanshipCost,
        };
      },
      { capital: 0, operating: 0, metalValue: 0, workmanship: 0 }
    );
    const expSum = fExpenses.reduce((a, x) => a + x.amount, 0);
    const supplierGold = fLots.reduce((a, l) => a + (Number(l.goldCost) || 0), 0);
    const supplierFees = fLots.reduce((a, l) => a + (Number(l.workmanshipTotal) || 0), 0);
    const scrapCost = fScrap.reduce((a, e) => a + (Number(e.total) || 0), 0);
    const taskirCost = fTaskir.reduce(
      (a, t) => a + (t.goldSource === "purchased" ? Number(t.goldCost) || 0 : 0) + (Number(t.workmanshipAmount) || 0),
      0
    );
    const purchGold = supplierGold + supplierFees + scrapCost + taskirCost;
    const purchNonGold = fExpenses.filter((e) => e.category === "purchases").reduce((a, e) => a + e.amount, 0);
    const opExpenses = expSum - purchNonGold;
    const purchWeight = fLots.reduce((a, l) => a + (Number(l.weight) || 0), 0) + fScrap.reduce((a, e) => a + (Number(e.weight) || 0), 0);

    // كل مبلغ يقابله وزن مكافئ بسعر اليوم — فيُقرأ الأداء بوحدة مستقرة.
    const g = (v) => (price24 > 0 ? v / price24 : 0);

    return {
      fSales, fExpenses, fLots, fScrap, fTaskir, fAdj, fAudits,
      salesGrams: g(salesSum),
      profitGrams: g(salesProfit),
      purchGoldGrams: g(purchGold),
      expGrams: g(expSum),
      opExpGrams: g(opExpenses),
      netGrams: g(salesSum - purchGold - expSum),
      salesCount: fSales.length,
      salesSum, salesProfit,
      // فصل الربح: رأسمالي من السوق · تشغيلي من عملك
      capitalGain: splitAgg.capital,
      operatingProfit: splitAgg.operating,
      metalValueSold: splitAgg.metalValue,
      workmanshipSold: splitAgg.workmanship,
      capitalGainGrams: g(splitAgg.capital),
      operatingProfitGrams: g(splitAgg.operating),
      avgSale: fSales.length ? salesSum / fSales.length : 0,
      margin: salesSum ? (salesProfit / salesSum) * 100 : 0,
      // هامش تشغيلي: يستبعد أثر السوق — المقياس الحقيقي لأداء المحل
      operatingMargin: salesSum ? (splitAgg.operating / salesSum) * 100 : 0,
      expSum,
      expFixed: fExpenses.filter((e) => e.recurring).reduce((a, e) => a + e.amount, 0),
      expDaily: fExpenses.filter((e) => !e.recurring).reduce((a, e) => a + e.amount, 0),
      supplierGold, supplierFees, scrapCost, taskirCost,
      purchGold, purchNonGold, opExpenses, purchWeight,
      wastage: fAdj.filter((a) => a.kind === "wastage").reduce((a, x) => a + x.weight, 0),
      surplus: fAdj.filter((a) => a.kind === "surplus").reduce((a, x) => a + x.weight, 0),
      auditCount: fAudits.length,
      net: salesSum - purchGold - expSum,
    };
  };

  const M = metricsFor(range);
  const MB = compare ? metricsFor(rangeB) : null;

  // السياق المُمرَّر لأدوات التحليل: أرقام جاهزة لا مصادر خام، فلا يحتاج
  // النموذج أن يحسب شيئًا.
  const aiCtx = {
    currency,
    label: rangeLabel,
    labelB: rangeLabelB,
    price24,
    lots,
    users,
    expenses,
    activeItems,
    totals,
    cashBalance,
    safeBalance,
    cashTx,
    safeTx,
    safeGoldTx,
    dailyCustody,
    safeAudits,
    weightAdjustments,
    sales,
    items,
    scrapEntries,
    openingBalance,
    custodyTotal: scrapCustodyBalance?.total || 0,
    goldEquivalentGrams: goldEquivalent?.goldGrams || 0,
  };

  // اختصارات للعرض المفرد
  const { fSales, fExpenses, fLots, fScrap, fTaskir, fAdj, fAudits } = M;
  const salesSum = M.salesSum, salesProfit = M.salesProfit, expSum = M.expSum;
  const purchGold = M.purchGold, purchNonGold = M.purchNonGold, opExpenses = M.opExpenses;
  const netMovement = M.net;
  const inRange = (d) => {
    const x = new Date(d).getTime();
    return x >= range.start.getTime() && x <= range.end.getTime();
  };

  const Row = ({ label, value, accent, strong, indent }) => (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)", paddingRight: indent ? 12 : 0 }}>
      <span style={{ color: strong ? "var(--text)" : "var(--text2)" }} className={strong ? "text-xs font-bold" : "text-xs"}>
        {label}
      </span>
      <span style={{ color: accent || "var(--text)" }} className={strong ? "text-sm font-bold" : "text-xs font-bold"}>
        {value}
      </span>
    </div>
  );

  // صف مطابقة: قيمتان والفرق بينهما. الفرق بالنسبة المئوية يُحسب على
  // الفترة الثانية كأساس — مقارنة اليوم بالأمس تسأل «كم تغيّرت عن أمس؟».
  const CmpRow = ({ label, a, b, fmtFn = (v) => fmt(v, 0), prefix = "", invert = false, strong }) => {
    const diff = a - b;
    const pct = b !== 0 ? (diff / Math.abs(b)) * 100 : null;
    const good = invert ? diff <= 0 : diff >= 0;
    const flat = Math.abs(diff) < 0.005;
    return (
      <div className="py-2" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: strong ? "var(--text)" : "var(--text2)" }} className={strong ? "text-xs font-bold" : "text-xs"}>
            {label}
          </span>
          <span
            style={{ color: flat ? "var(--text2)" : good ? "var(--goodSolid)" : "var(--bad)" }}
            className="text-[11px] font-bold"
          >
            {flat ? "بلا تغيير" : `${diff > 0 ? "▲" : "▼"} ${prefix}${fmtFn(Math.abs(diff))}${pct !== null ? ` (${fmt(Math.abs(pct), 0)}٪)` : ""}`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="px-2 py-1.5 rounded-lg" style={{ background: "var(--panel)" }}>
            <p style={{ color: "var(--text3)" }} className="text-[10px]">{rangeLabel}</p>
            <p style={{ color: "var(--text)" }} className="text-xs font-bold">{prefix}{fmtFn(a)}</p>
          </div>
          <div className="px-2 py-1.5 rounded-lg" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
            <p style={{ color: "var(--text3)" }} className="text-[10px]">{rangeLabelB}</p>
            <p style={{ color: "var(--text2)" }} className="text-xs font-bold">{prefix}{fmtFn(b)}</p>
          </div>
        </div>
      </div>
    );
  };

  const Section = ({ title, children }) => (
    <>
      <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-3">
        {title}
      </p>
      <Card style={{ padding: 14, marginBottom: 4 }}>{children}</Card>
    </>
  );

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const head = [[`تقرير ${rangeLabel}`, new Date().toLocaleString("en-GB")], []];

    head.push(["— الملخص —"]);
    head.push([`المبيعات (${currency})`, fmt(salesSum, 2), `${fSales.length} فاتورة`]);
    head.push([`أرباح المبيعات (${currency})`, fmt(salesProfit, 2)]);
    head.push([`مشتريات الذهب (${currency})`, fmt(purchGold, 2)]);
    head.push([`مصروفات تشغيلية (${currency})`, fmt(opExpenses, 2)]);
    head.push([`مشتريات غير ذهبية (${currency})`, fmt(purchNonGold, 2)]);
    head.push([`صافي الحركة (${currency})`, fmt(netMovement, 2)]);
    head.push([]);
    head.push(["— الأرصدة الحالية —"]);
    head.push([`صندوق اليومي (${currency})`, fmt(cashBalance.total, 2)]);
    head.push([`الخزنة (${currency})`, fmt(safeBalance.total, 2)]);
    head.push(["ذهب الخزنة بعيار 24 (جم)", fmt(safeGoldBalance.fineWeight)]);
    head.push([`عهدة الكسر (${currency})`, fmt(scrapCustodyBalance.total, 2)]);
    head.push(["المخزون — قطع", totals.pieces]);
    head.push(["المخزون بعيار 24 (جم)", fmt(totals.fineWeight)]);
    head.push(["الذهب الفعلي بعيار 24 (جم)", fmt(goldEquivalent.goldGrams)]);
    head.push(["النقد (لا يُجمع مع الذهب)", fmt(goldEquivalent.cashAmount, 2)]);
    head.push(["  يعادل بالجرام", fmt(goldEquivalent.cashGrams)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(head), "الملخص");

    if (compare && MB) {
      const cmp = [["البند", rangeLabel, rangeLabelB, "الفرق", "٪"]];
      const add = (label, a, b, dec = 2) => {
        const d = a - b;
        cmp.push([label, fmt(a, dec), fmt(b, dec), fmt(d, dec), b !== 0 ? fmt((d / Math.abs(b)) * 100, 1) : "—"]);
      };
      add("المبيعات", M.salesSum, MB.salesSum);
      add("عدد الفواتير", M.salesCount, MB.salesCount, 0);
      add("متوسط الفاتورة", M.avgSale, MB.avgSale);
      add("أرباح المبيعات", M.salesProfit, MB.salesProfit);
      add("هامش الربح ٪", M.margin, MB.margin, 1);
      add("مشتريات الذهب", M.purchGold, MB.purchGold);
      add("الوزن المشترى (جم)", M.purchWeight, MB.purchWeight);
      add("المصروفات", M.expSum, MB.expSum);
      add("منها ثابتة", M.expFixed, MB.expFixed);
      add("منها يومية", M.expDaily, MB.expDaily);
      add("هالك (جم)", M.wastage, MB.wastage);
      add("صافي الحركة", M.net, MB.net);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cmp), "المطابقة");
    }

    const sr = [["المرجع", "التاريخ", "البائع", `الإجمالي (${currency})`, `الربح (${currency})`, "الأصناف"]];
    fSales.forEach((x) =>
      sr.push([x.ref || "", new Date(x.date).toLocaleString("en-GB"), x.sellerName || "", fmt(x.total, 2), fmt(saleProfitOf(x), 2), (x.lines || []).length])
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sr), "المبيعات");

    const pr = [["المرجع", "التاريخ", "المورد", "العيار", "الوزن", `سعر الجرام`, `الأجور`, `الإجمالي (${currency})`]];
    fLots.forEach((l) =>
      pr.push([l.ref || "", new Date(l.date).toLocaleDateString("en-GB"), supplierName(l.supplierId), l.karat, fmt(l.weight), fmt(l.costPerGram), fmt(l.workmanshipTotal || 0, 2), fmt(l.totalCost, 2)])
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pr), "المشتريات");

    const er = [["المرجع", "التاريخ", "البيان", "التصنيف", `المبلغ (${currency})`, "مصدر الصرف", "الموظف", "من سجّله"]];
    fExpenses.forEach((e) =>
      er.push([e.ref || "", new Date(e.date).toLocaleString("en-GB"), e.name || "", catLabel(e.category), fmt(e.amount, 2), fundingSourceLabel(e.fundingSource), e.employeeName || "", e.createdBy || ""])
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(er), "المصروفات");

    const ir = [["التصنيف", "العيار", "الوزن (جم)", "بعيار 24 (جم)", "القطع", `التكلفة (${currency})`]];
    const byK = {};
    activeItems.forEach((it) => {
      const q = (it.units || []).filter((u) => !u.sold).length;
      const w = (Number(it.weight) || 0) * q;
      const k = it.karat;
      if (!byK[k]) byK[k] = { w: 0, f: 0, q: 0, c: 0 };
      byK[k].w += w;
      byK[k].f += w * (PURITY[k] || 1);
      byK[k].q += q;
      byK[k].c += ((Number(it.costPerGram) || 0) * (Number(it.weight) || 0) + (Number(it.workmanship) || 0)) * q;
    });
    Object.entries(byK).forEach(([k, v]) => ir.push(["", k, fmt(v.w), fmt(v.f), v.q, fmt(v.c, 2)]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ir), "الجرد");

    XLSX.writeFile(wb, `تقرير_${rangeLabel.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const TABS = [
    { id: "overview", label: "نظرة عامة" },
    { id: "sales", label: "المبيعات" },
    { id: "purchases", label: "المشتريات" },
    { id: "expenses", label: "المصروفات" },
    { id: "inventory", label: "الجرد" },
    { id: "ai", label: "التحليل الذكي" },
  ];

  return (
    <div>
      <SubPageHeader title="التقارير" onBack={onBack} />
      <div className="px-4 pt-2">
        {/* شريط الفترة */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          {REPORT_PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className="py-2 rounded-xl text-[11px] font-bold"
              style={{ background: period === p.id ? "var(--accentBg)" : "var(--panel)", color: period === p.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Field label="من">
              <input style={inputStyle} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="إلى">
              <input style={inputStyle} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}

        <button
          onClick={() => setCompare((v) => !v)}
          className="w-full py-2 rounded-xl text-[11px] font-bold mb-2 flex items-center justify-center gap-2"
          style={{
            background: compare ? "var(--accentBg)" : "var(--panel)",
            color: compare ? "var(--accent)" : "var(--text2)",
            border: `1px solid ${compare ? "var(--accentLine)" : "var(--edge)"}`,
          }}
        >
          {compare ? <Check size={13} /> : null} مطابقة مع فترة أخرى
        </button>

        {compare && (
          <Card style={{ padding: 10, marginBottom: 10, background: "var(--bg)" }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
              الفترة المقارَن بها
            </p>
            <div className="grid grid-cols-5 gap-1.5 mb-1">
              {REPORT_PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriodB(p.id)}
                  className="py-1.5 rounded-lg text-[10px] font-bold"
                  style={{ background: periodB === p.id ? "var(--accentBg)" : "var(--panel)", color: periodB === p.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {periodB === "custom" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Field label="من">
                  <input style={inputStyle} type="date" value={fromB} onChange={(e) => setFromB(e.target.value)} />
                </Field>
                <Field label="إلى">
                  <input style={inputStyle} type="date" value={toB} onChange={(e) => setToB(e.target.value)} />
                </Field>
              </div>
            )}
          </Card>
        )}

        {/* تفصيلي / إجمالي */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { v: false, label: "إجمالي" },
            { v: true, label: "تفصيلي" },
          ].map((o) => (
            <button
              key={String(o.v)}
              onClick={() => setDetailed(o.v)}
              className="py-2 rounded-xl text-[11px] font-bold"
              style={{ background: detailed === o.v ? "var(--accentBg)" : "var(--panel)", color: detailed === o.v ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 mb-3" style={{ overflowX: "auto", paddingBottom: 2 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap"
              style={{ background: tab === t.id ? "var(--accentBg)" : "var(--panel)", color: tab === t.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={exportXlsx} className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2" style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={() => window.print()} className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2" style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>
            <FileText size={15} /> طباعة
          </button>
        </div>

        {/* ── نظرة عامة ── */}
        {tab === "overview" && compare && MB && (
          <>
            <Section title="مطابقة الحركة">
              <CmpRow label="المبيعات" a={M.salesSum} b={MB.salesSum} prefix={currency} />
              <CmpRow label="عدد الفواتير" a={M.salesCount} b={MB.salesCount} fmtFn={(v) => fmt(v, 0)} />
              <CmpRow label="أرباح المبيعات" a={M.salesProfit} b={MB.salesProfit} prefix={currency} />
              <CmpRow label="مشتريات الذهب" a={M.purchGold} b={MB.purchGold} prefix={currency} invert />
              <CmpRow label="المصروفات التشغيلية" a={M.opExpenses} b={MB.opExpenses} prefix={currency} invert />
              <CmpRow label="صافي الحركة" a={M.net} b={MB.net} prefix={currency} strong />
            </Section>
            <div style={{ height: 20 }} />
          </>
        )}

        {tab === "overview" && !compare && (
          <>
            <Card style={{ padding: 16, marginBottom: 4, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
                صافي حركة {rangeLabel}
              </p>
              <p
                style={{ fontFamily: "'Cairo', sans-serif", color: M.netGrams >= 0 ? "var(--goodSolid)" : "var(--bad)" }}
                className="text-2xl font-extrabold"
              >
                {M.netGrams >= 0 ? "+" : "−"}
                {fmtW(Math.abs(M.netGrams))} جم
              </p>
              <p style={{ color: "var(--text2)" }} className="text-sm font-bold">
                {currency}
                {fmt(Math.abs(netMovement), 0)}
              </p>
              <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                المبيعات − المشتريات − المصروفات · محوَّل بسعر اليوم {currency}
                {fmt(price24)}/جم
              </p>
            </Card>

            <Section title="الحركة خلال الفترة">
              <p style={{ color: "var(--text3)" }} className="text-[10px] mb-1">
                الوزن أساس القياس · المبلغ محوَّل بسعر اليوم
              </p>
              <GramRow label={`المبيعات (${fSales.length} فاتورة)`} grams={M.salesGrams} amount={salesSum} currency={currency} accent="var(--text)" />
              <GramRow label="أرباح المبيعات" grams={M.profitGrams} amount={salesProfit} currency={currency} indent />
              <GramRow label={`مشتريات الذهب (${fLots.length + fScrap.length})`} grams={-M.purchGoldGrams} amount={purchGold} currency={currency} accent="var(--bad)" />
              <GramRow label="مصروفات تشغيلية" grams={-M.opExpGrams} amount={opExpenses} currency={currency} accent="var(--bad)" />
              <GramRow label="مشتريات غير ذهبية" grams={-toGrams(purchNonGold)} amount={purchNonGold} currency={currency} accent="var(--bad)" />
              <GramRow label="الصافي" grams={M.netGrams} amount={netMovement} currency={currency} strong />
            </Section>

            <Section title="الأرصدة الحالية">
              <Row label="صندوق اليومي" value={`${currency}${fmt(cashBalance.total, 0)}`} />
              <Row label="نقدي" value={`${currency}${fmt(cashBalance.cash, 0)}`} indent />
              <Row label="شبكة" value={`${currency}${fmt(cashBalance.network, 0)}`} indent />
              <Row label="الخزنة" value={`${currency}${fmt(safeBalance.total, 0)}`} />
              <Row label="عهدة الكسر" value={`${currency}${fmt(scrapCustodyBalance.total, 0)}`} />
              <Row label="إجمالي النقد" value={`${currency}${fmt(cashBalance.total + safeBalance.total + scrapCustodyBalance.total, 0)}`} strong />
            </Section>

            <Section title="الذهب">
              <Row label="المخزون" value={`${totals.pieces} قطعة · ${fmtW(totals.weight)} جم`} />
              <Row label="المخزون بعيار 24" value={`${fmtW(totals.fineWeight)} جم`} indent />
              <Row label="ذهب الخزنة بعيار 24" value={`${fmtW(safeGoldBalance.fineWeight)} جم`} />
              <Row label="الكسر بالمخزن" value={`${fmtW(scrapTotals.fineWeightInStock)} جم عيار 24`} />
              <Row label="الذهب الفعلي بعيار 24" value={`${fmtW(goldEquivalent.goldGrams)} جم`} accent="var(--accent)" strong />
              <Row
                label="النقد (لا يُجمع مع الذهب)"
                value={`${priceData.currency}${fmt(goldEquivalent.cashAmount, 0)} · يعادل ${fmtW(goldEquivalent.cashGrams)} جم`}
              />
            </Section>
            <div style={{ height: 20 }} />
          </>
        )}

        {/* ── المبيعات ── */}
        {tab === "sales" && compare && MB && (
          <>
            <Section title="مطابقة المبيعات">
              <CmpRow label="عدد الفواتير" a={M.salesCount} b={MB.salesCount} fmtFn={(v) => fmt(v, 0)} />
              <CmpRow label="الإجمالي" a={M.salesSum} b={MB.salesSum} prefix={currency} strong />
              <CmpRow label="متوسط الفاتورة" a={M.avgSale} b={MB.avgSale} prefix={currency} />
              <CmpRow label="الأرباح المحققة" a={M.salesProfit} b={MB.salesProfit} prefix={currency} />
              <CmpRow label="ربح تشغيلي" a={M.operatingProfit} b={MB.operatingProfit} prefix={currency} />
              <CmpRow label="ربح رأسمالي" a={M.capitalGain} b={MB.capitalGain} prefix={currency} />
              <CmpRow label="هامش تشغيلي ٪" a={M.operatingMargin} b={MB.operatingMargin} fmtFn={(v) => fmt(v, 1) + "٪"} />
              <CmpRow label="هامش الربح ٪" a={M.margin} b={MB.margin} fmtFn={(v) => fmt(v, 1)} />
            </Section>
            <div style={{ height: 20 }} />
          </>
        )}

        {tab === "sales" && !compare && (
          <>
            <Section title={`المبيعات — ${rangeLabel}`}>
              <Row label="عدد الفواتير" value={fSales.length} />
              <GramRow label="الإجمالي" grams={M.salesGrams} amount={salesSum} currency={currency} accent="var(--text)" />
              <GramRow label="متوسط الفاتورة" grams={toGrams(M.avgSale)} amount={M.avgSale} currency={currency} accent="var(--text)" />
              <GramRow label="الأرباح المحققة" grams={M.profitGrams} amount={salesProfit} currency={currency} strong />
              <GramRow label="  منها تشغيلي (من عملك)" grams={M.operatingProfitGrams} amount={M.operatingProfit} currency={currency} accent="var(--goodSolid)" indent />
              <GramRow label="  منها رأسمالي (من السوق)" grams={M.capitalGainGrams} amount={M.capitalGain} currency={currency} accent={M.capitalGain >= 0 ? "var(--accentSoft)" : "var(--bad)"} indent />
              {revaluation && (
                <GramRow
                  label="فرق تقييم المخزون (غير محقق)"
                  grams={revaluation.diffGrams}
                  amount={revaluation.diff}
                  currency={currency}
                  accent={revaluation.diff >= 0 ? "var(--accentSoft)" : "var(--bad)"}
                />
              )}
              <Row label="هامش الربح" value={`${fmt(salesSum ? (salesProfit / salesSum) * 100 : 0, 1)}٪`} strong />
            </Section>
            {detailed && (
              <div className="flex flex-col gap-2 mt-3">
                {fSales.length === 0 ? (
                  <EmptyState icon={<Receipt size={32} color="var(--accentText)" />} title="لا مبيعات بهذه الفترة" sub="جرّب فترة أخرى" />
                ) : (
                  fSales.map((x) => (
                    <Card key={x.id} style={{ padding: 12 }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                          {x.sellerName || "—"}
                          {x.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{x.ref}</span>}
                        </span>
                        <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                          {currency}{fmt(x.total, 0)}
                        </span>
                      </div>
                      <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                        {new Date(x.date).toLocaleString("en-GB")} · {(x.lines || []).length} صنف · ربح {fmt(saleProfitOf(x), 0)}
                      </p>
                    </Card>
                  ))
                )}
              </div>
            )}
            <div style={{ height: 20 }} />
          </>
        )}

        {/* ── المشتريات ── */}
        {tab === "purchases" && compare && MB && (
          <>
            <Section title="مطابقة المشتريات">
              <CmpRow label="ذهب من الموردين" a={M.supplierGold} b={MB.supplierGold} prefix={currency} invert />
              <CmpRow label="أجور ومصنعية" a={M.supplierFees} b={MB.supplierFees} prefix={currency} invert />
              <CmpRow label="شراء كسر" a={M.scrapCost} b={MB.scrapCost} prefix={currency} invert />
              <CmpRow label="تسكيرات" a={M.taskirCost} b={MB.taskirCost} prefix={currency} invert />
              <CmpRow label="إجمالي مشتريات الذهب" a={M.purchGold} b={MB.purchGold} prefix={currency} invert strong />
              <CmpRow label="الوزن المشترى (جم)" a={M.purchWeight} b={MB.purchWeight} fmtFn={(v) => fmt(v)} />
              <CmpRow label="هالك (جم)" a={M.wastage} b={MB.wastage} fmtFn={(v) => fmt(v)} invert />
            </Section>
            <div style={{ height: 20 }} />
          </>
        )}

        {tab === "purchases" && !compare && (
          <>
            <Section title={`المشتريات — ${rangeLabel}`}>
              <Row label={`من الموردين (${fLots.length} دفعة)`} value={`${currency}${fmt(fLots.reduce((a, l) => a + (Number(l.goldCost) || 0), 0), 0)}`} />
              <Row label="أجور ومصنعية" value={`${currency}${fmt(fLots.reduce((a, l) => a + (Number(l.workmanshipTotal) || 0), 0), 0)}`} indent />
              <Row label={`شراء كسر (${fScrap.length})`} value={`${currency}${fmt(fScrap.reduce((a, e) => a + e.total, 0), 0)}`} />
              <Row label={`تسكيرات (${fTaskir.length})`} value={`${currency}${fmt(fTaskir.reduce((a, t) => a + (t.goldSource === "purchased" ? Number(t.goldCost) || 0 : 0) + (Number(t.workmanshipAmount) || 0), 0), 0)}`} />
              <GramRow label="إجمالي مشتريات الذهب" grams={M.purchGoldGrams} amount={purchGold} currency={currency} accent="var(--accent)" strong />
              <Row label="الوزن المشترى" value={`${fmtW(fLots.reduce((a, l) => a + l.weight, 0) + fScrap.reduce((a, e) => a + e.weight, 0))} جم`} />
              <Row label="مشتريات غير ذهبية" value={`${currency}${fmt(purchNonGold, 0)}`} accent="var(--bad)" />
            </Section>
            {fAdj.length > 0 && (
              <Section title="فروقات الوزن">
                <Row label="هالك" value={`${fmtW(fAdj.filter((a) => a.kind === "wastage").reduce((a, x) => a + x.weight, 0))} جم`} accent="var(--bad)" />
                <Row label="فائض" value={`${fmtW(fAdj.filter((a) => a.kind === "surplus").reduce((a, x) => a + x.weight, 0))} جم`} accent="var(--goodSolid)" />
              </Section>
            )}
            {detailed && (
              <div className="flex flex-col gap-2 mt-3">
                {fLots.length === 0 ? (
                  <EmptyState icon={<Truck size={32} color="var(--accentText)" />} title="لا مشتريات بهذه الفترة" sub="جرّب فترة أخرى" />
                ) : (
                  fLots.map((l) => (
                    <Card key={l.id} style={{ padding: 12 }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                          {supplierName(l.supplierId)}
                          {l.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{l.ref}</span>}
                        </span>
                        <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                          {currency}{fmt(l.totalCost, 0)}
                        </span>
                      </div>
                      <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                        عيار {l.karat} · {fmtW(l.weight)} جم · {currency}{fmt(l.costPerGram)}/جم · {new Date(l.date).toLocaleDateString("en-GB")}
                      </p>
                    </Card>
                  ))
                )}
              </div>
            )}
            <div style={{ height: 20 }} />
          </>
        )}

        {/* ── المصروفات ── */}
        {tab === "expenses" && compare && MB && (
          <>
            <Section title="مطابقة المصروفات">
              <CmpRow label="عدد العمليات" a={M.fExpenses.length} b={MB.fExpenses.length} fmtFn={(v) => fmt(v, 0)} />
              <CmpRow label="الإجمالي" a={M.expSum} b={MB.expSum} prefix={currency} invert strong />
              <CmpRow label="ثابتة" a={M.expFixed} b={MB.expFixed} prefix={currency} invert />
              <CmpRow label="يومية" a={M.expDaily} b={MB.expDaily} prefix={currency} invert />
              <CmpRow label="مشتريات غير ذهبية" a={M.purchNonGold} b={MB.purchNonGold} prefix={currency} invert />
            </Section>
            <Section title="مطابقة التصنيفات">
              {(() => {
                const byA = {}, byB = {};
                M.fExpenses.forEach((e) => (byA[e.category] = (byA[e.category] || 0) + e.amount));
                MB.fExpenses.forEach((e) => (byB[e.category] = (byB[e.category] || 0) + e.amount));
                const ids = [...new Set([...Object.keys(byA), ...Object.keys(byB)])];
                if (ids.length === 0) return <p style={{ color: "var(--text3)" }} className="text-xs">لا مصروفات في الفترتين</p>;
                return ids
                  .sort((x, y) => (byA[y] || 0) - (byA[x] || 0))
                  .map((id) => <CmpRow key={id} label={catLabel(id)} a={byA[id] || 0} b={byB[id] || 0} prefix={currency} invert />);
              })()}
            </Section>
            <div style={{ height: 20 }} />
          </>
        )}

        {tab === "expenses" && !compare && (
          <>
            <Section title={`المصروفات — ${rangeLabel}`}>
              <Row label="عدد العمليات" value={fExpenses.length} />
              <GramRow label="الإجمالي" grams={-M.expGrams} amount={expSum} currency={currency} accent="var(--bad)" strong />
              <Row label="ثابتة" value={`${currency}${fmt(fExpenses.filter((e) => e.recurring).reduce((a, e) => a + e.amount, 0), 0)}`} indent />
              <Row label="يومية" value={`${currency}${fmt(fExpenses.filter((e) => !e.recurring).reduce((a, e) => a + e.amount, 0), 0)}`} indent />
            </Section>
            <Section title="حسب التصنيف">
              {(() => {
                const by = {};
                fExpenses.forEach((e) => (by[e.category] = (by[e.category] || 0) + e.amount));
                const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
                if (rows.length === 0) return <p style={{ color: "var(--text3)" }} className="text-xs">لا توجد مصروفات</p>;
                return rows.map(([id, v]) => (
                  <div key={id} className="py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text2)" }} className="text-xs">{catLabel(id)}</span>
                      <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                        {currency}{fmt(v, 0)} · {fmt(expSum ? (v / expSum) * 100 : 0, 0)}٪
                      </span>
                    </div>
                    <div className="mt-1" style={{ height: 3, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${expSum ? (v / expSum) * 100 : 0}%`, height: "100%", background: "var(--bad)" }} />
                    </div>
                  </div>
                ));
              })()}
            </Section>
            {detailed && (
              <div className="flex flex-col gap-2 mt-3">
                {fExpenses.length === 0 ? (
                  <EmptyState icon={<FileMinus size={32} color="var(--accentText)" />} title="لا مصروفات بهذه الفترة" sub="جرّب فترة أخرى" />
                ) : (
                  fExpenses.map((e) => (
                    <Card key={e.id} style={{ padding: 12 }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                          {e.name || catLabel(e.category)}
                          {e.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{e.ref}</span>}
                        </span>
                        <span style={{ color: "var(--bad)" }} className="text-sm font-bold">
                          −{currency}{fmt(e.amount, 0)}
                        </span>
                      </div>
                      <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                        {catLabel(e.category)} · {fundingSourceLabel(e.fundingSource)} · {new Date(e.date).toLocaleString("en-GB")}
                        {e.createdBy ? ` · ${e.createdBy}` : ""}
                      </p>
                    </Card>
                  ))
                )}
              </div>
            )}
            <div style={{ height: 20 }} />
          </>
        )}

        {/* ── الجرد ── */}
        {tab === "inventory" && compare && MB && (
          <>
            <Section title="مطابقة الجرد">
              <CmpRow label="عمليات الجرد" a={M.auditCount} b={MB.auditCount} fmtFn={(v) => fmt(v, 0)} />
              <CmpRow label="الوزن المشترى (جم)" a={M.purchWeight} b={MB.purchWeight} fmtFn={(v) => fmt(v)} />
              <CmpRow label="هالك (جم)" a={M.wastage} b={MB.wastage} fmtFn={(v) => fmt(v)} invert />
              <CmpRow label="فائض (جم)" a={M.surplus} b={MB.surplus} fmtFn={(v) => fmt(v)} />
            </Section>
            <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
              المخزون رصيد لحظي لا يتغيّر بتغيّر الفترة، فالمطابقة هنا على حركة الفترة لا على الرصيد.
            </p>
            <div style={{ height: 20 }} />
          </>
        )}

        {tab === "inventory" && !compare && (
          <>
            <Section title="المخزون الحالي">
              <Row label="عدد القطع" value={totals.pieces} />
              <Row label="الوزن الإجمالي" value={`${fmtW(totals.weight)} جم`} />
              <Row label="بعيار 24" value={`${fmtW(totals.fineWeight)} جم`} indent />
              <Row label="التكلفة" value={`${currency}${fmt(totals.cost, 0)}`} />
              <Row label="القيمة بسعر اليوم" value={`${currency}${fmt(totals.value, 0)}`} accent="var(--accent)" />
              <GramRow label="أرباح غير محققة" grams={toGrams(totals.value - totals.cost)} amount={totals.value - totals.cost} currency={currency} strong />
            </Section>

            <Section title="حسب العيار">
              {(() => {
                const byK = {};
                activeItems.forEach((it) => {
                  const q = (it.units || []).filter((u) => !u.sold).length;
                  const w = (Number(it.weight) || 0) * q;
                  if (!byK[it.karat]) byK[it.karat] = { w: 0, q: 0 };
                  byK[it.karat].w += w;
                  byK[it.karat].q += q;
                });
                const rows = Object.entries(byK).sort((a, b) => Number(b[0]) - Number(a[0]));
                if (rows.length === 0) return <p style={{ color: "var(--text3)" }} className="text-xs">المخزون فارغ</p>;
                return rows.map(([k, v]) => (
                  <Row key={k} label={`عيار ${k} — ${v.q} قطعة`} value={`${fmtW(v.w)} جم (${fmt(v.w * (PURITY[k] || 1))} عيار 24)`} />
                ));
              })()}
            </Section>

            <Section title={`عمليات الجرد — ${rangeLabel}`}>
              <Row label="عدد عمليات الجرد" value={fAudits.length} />
              {fAudits.length > 0 && (
                <Row label="آخر جرد" value={new Date(fAudits[0].date).toLocaleDateString("en-GB")} />
              )}
            </Section>

            {detailed && fAudits.length > 0 && (
              <div className="flex flex-col gap-2 mt-3">
                {fAudits.map((a) => {
                  const missing = (a.entries || []).filter((e) => e.status === "missing").length;
                  const found = (a.entries || []).filter((e) => e.status === "found").length;
                  return (
                    <Card key={a.id} style={{ padding: 12 }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                          {new Date(a.date).toLocaleString("en-GB")}
                        </span>
                        <span style={{ color: missing > 0 ? "var(--bad)" : "var(--goodSolid)" }} className="text-xs font-bold">
                          {missing > 0 ? `${missing} مفقود` : "مطابق"}
                        </span>
                      </div>
                      <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                        {found} موجود · {(a.entries || []).length} إجمالي
                        {a.applied ? " · طُبِّقت التسوية" : ""}
                        {a.createdBy ? ` · ${a.createdBy}` : ""}
                      </p>
                    </Card>
                  );
                })}
              </div>
            )}
            <div style={{ height: 20 }} />
          </>
        )}
        {/* ── التحليل الذكي ── */}
        {tab === "ai" && (
          <>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
              كل الأرقام محسوبة داخل التطبيق. الذكاء الاصطناعي يشرحها ويرتّب أولوياتها فقط — لا يحسب ولا يضيف رقمًا من عنده.
            </p>

            {/* ١. تحليل الفترة */}
            <button
              onClick={async () => {
                setAiBusy("narrative");
                setAiError("");
                try {
                  const txt = await askReportAi([
                    {
                      role: "user",
                      content:
                        "أنت محلل مالي لمحل ذهب. اكتب تحليلًا موجزًا (٥-٧ جمل، فقرة واحدة بلا عناوين) يغطي: ماذا حدث في هذه الفترة، وما الذي حرّك الأرقام، وإجراء عملي واحد مقترح. " +
                        (MB ? "قارن بالفترة الأخرى المرفقة وفسّر سبب الفرق. " : "") +
                        REPORT_AI_RULES +
                        "\n\nالمعطيات:\n" +
                        reportFactsText(M, MB, aiCtx),
                    },
                  ]);
                  setAiNarrative(txt);
                } catch (e) {
                  setAiError("تعذّر الاتصال بالتحليل — حاول مجددًا");
                } finally {
                  setAiBusy("");
                }
              }}
              disabled={!!aiBusy}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-2"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
            >
              {aiBusy === "narrative" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {aiBusy === "narrative" ? "جاري التحليل..." : compare ? "حلّل الفترتين وفسّر الفرق" : "حلّل هذه الفترة"}
            </button>
            {aiNarrative && (
              <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
                <p style={{ color: "var(--text)" }} className="text-xs leading-relaxed">
                  {aiNarrative}
                </p>
              </Card>
            )}

            {/* ٢. الملاحظات */}
            <button
              onClick={async () => {
                const found = reportFindings(M, MB, aiCtx);
                setAiFindings(found);
                setAiFindingsText("");
                setAiError("");
                if (found.length === 0) return;
                setAiBusy("findings");
                try {
                  const txt = await askReportAi([
                    {
                      role: "user",
                      content:
                        "هذه ملاحظات استُخرجت آليًا من فحص أرقام محل ذهب (وليست منك). رتّبها حسب الخطورة واشرح كل واحدة بجملة أو جملتين مع الإجراء المقترح. " +
                        REPORT_AI_RULES +
                        "\n\nالملاحظات:\n" +
                        found.map((x, i) => `${i + 1}. [${x.severity}] ${x.title}: ${x.detail}`).join("\n"),
                    },
                  ]);
                  setAiFindingsText(txt);
                } catch (e) {
                  setAiError("الملاحظات أدناه دقيقة (مستخرجة آليًا)، لكن تعذّر جلب الشرح");
                } finally {
                  setAiBusy("");
                }
              }}
              disabled={!!aiBusy}
              className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mb-2"
              style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
            >
              {aiBusy === "findings" ? <Loader2 size={15} className="animate-spin" /> : <AlertTriangle size={15} />}
              {aiBusy === "findings" ? "جاري الفحص..." : "افحص واكشف الملاحظات"}
            </button>

            {aiFindings && aiFindings.length === 0 && (
              <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--goodLine)" }}>
                <p style={{ color: "var(--good)" }} className="text-sm font-bold flex items-center gap-2">
                  <Check size={16} /> لا ملاحظات — الأرقام منتظمة في هذه الفترة
                </p>
              </Card>
            )}
            {aiFindingsText && (
              <Card style={{ padding: 14, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
                <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 flex items-center gap-1.5">
                  <Sparkles size={13} /> ملخص وترتيب الأولويات
                </p>
                <p style={{ color: "var(--text)" }} className="text-xs leading-relaxed">
                  {aiFindingsText}
                </p>
              </Card>
            )}
            {aiFindings && aiFindings.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {aiFindings.map((x, i) => (
                  <Card key={i} style={{ padding: 12 }}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                        {x.title}
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: "var(--panel)",
                          color: x.severity === "error" ? "var(--bad)" : x.severity === "warning" ? "var(--accent)" : "var(--text2)",
                        }}
                      >
                        {x.severity === "error" ? "خطأ" : x.severity === "warning" ? "تنبيه" : "معلومة"}
                      </span>
                    </div>
                    <p style={{ color: "var(--text2)" }} className="text-[11px]">
                      {x.detail}
                    </p>
                  </Card>
                ))}
              </div>
            )}

            {/* ٣. كشف الأرقام المخفية */}
            <button
              onClick={async () => {
                const found = hiddenNumbersScan(aiCtx);
                setAiHidden(found);
                setAiHiddenText("");
                setAiError("");
                if (found.length === 0) return;
                setAiBusy("hidden");
                try {
                  const txt = await askReportAi([
                    {
                      role: "user",
                      content:
                        "هذه فجوات اكتُشفت آليًا بمطابقة دفاتر محل ذهب ببعضها (وليست منك). لكل فجوة: اشرح ماذا تعني عمليًا، وما السبب الأرجح، وما الخطوة الأولى لإغلاقها. رتّبها بالأخطر أولًا. " +
                        REPORT_AI_RULES +
                        "\n\nالفجوات:\n" +
                        found.map((x, i) => `${i + 1}. [${x.severity}] ${x.title}: ${x.detail}`).join("\n"),
                    },
                  ]);
                  setAiHiddenText(txt);
                } catch (e) {
                  setAiError("الفجوات أدناه دقيقة (مطابقة آلية)، لكن تعذّر جلب الشرح");
                } finally {
                  setAiBusy("");
                }
              }}
              disabled={!!aiBusy}
              className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mb-2"
              style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
            >
              {aiBusy === "hidden" ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              {aiBusy === "hidden" ? "جاري المطابقة..." : "اكشف الأرقام المخفية"}
            </button>
            <p style={{ color: "var(--text3)" }} className="text-[10px] mb-3">
              يطابق دفتر الصندوق والخزنة بالأرصدة، والفواتير بالقيود، والمشتريات بالمخزون — ويُظهر الفجوات التي لا تبين في التقارير العادية.
            </p>

            {aiHidden && aiHidden.length === 0 && (
              <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--goodLine)" }}>
                <p style={{ color: "var(--good)" }} className="text-sm font-bold flex items-center gap-2">
                  <Check size={16} /> لا فجوات — الدفاتر متطابقة
                </p>
                <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                  مجموع القيود يطابق الأرصدة، وكل فاتورة ومشترى لهما قيد مقابل.
                </p>
              </Card>
            )}
            {aiHiddenText && (
              <Card style={{ padding: 14, marginBottom: 10, border: "1px solid var(--badLine)" }}>
                <p style={{ color: "var(--bad)" }} className="text-xs font-bold mb-2 flex items-center gap-1.5">
                  <Sparkles size={13} /> تفسير الفجوات
                </p>
                <p style={{ color: "var(--text)" }} className="text-xs leading-relaxed">
                  {aiHiddenText}
                </p>
              </Card>
            )}
            {aiHidden && aiHidden.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {aiHidden.map((x, i) => (
                  <Card key={i} style={{ padding: 12, border: x.severity === "error" ? "1px solid var(--badLine)" : "1px solid var(--line)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                        {x.title}
                      </span>
                      {Math.abs(x.gap) > 0.01 && (
                        <span style={{ color: "var(--bad)", fontFamily: "'Cairo', sans-serif" }} className="text-xs font-bold">
                          {currency}
                          {fmt(Math.abs(x.gap), 0)}
                        </span>
                      )}
                    </div>
                    <p style={{ color: "var(--text2)" }} className="text-[11px]">
                      {x.detail}
                    </p>
                    {Math.abs(x.gap) > 0.01 && price24 > 0 && (
                      <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                        يعادل {fmtW(Math.abs(x.gap) / price24)} جم بسعر اليوم
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* ٤. تتبّع مصدر الفرق */}
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-3">
              من أين جاء هذا الفرق؟
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
              اسأل عن نقص أو زيادة، فيجمع النظام السجلات المتعلقة به ويشرح المصدر المحتمل.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {TRACE_TOPICS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTraceTopic(t.id);
                    setTraceQ(t.label);
                    setTraceEv(null);
                    setTraceText("");
                  }}
                  className="text-[11px] px-2.5 py-1.5 rounded-xl text-right"
                  style={{
                    background: traceTopic === t.id ? "var(--accentBg)" : "var(--panel)",
                    color: traceTopic === t.id ? "var(--accent)" : "var(--text2)",
                    border: `1px solid ${traceTopic === t.id ? "var(--accentLine)" : "var(--edge)"}`,
                  }}
                >
                  {t.label}
                  <span style={{ color: "var(--text3)" }} className="block text-[10px]">{t.hint}</span>
                </button>
              ))}
            </div>

            <div className="flex items-end gap-2 mb-2">
              <input
                style={inputStyle}
                value={traceQ}
                onChange={(e) => {
                  setTraceQ(e.target.value);
                  const t = detectTraceTopic(e.target.value);
                  if (t) setTraceTopic(t.id);
                }}
                placeholder="مثال: من وين جاي النقص في الخزنة؟"
              />
              <button
                onClick={async () => {
                  const topic = traceTopic || detectTraceTopic(traceQ)?.id;
                  if (!topic) {
                    setAiError("اختر موضوعًا من الأزرار أعلاه أو وضّح سؤالك");
                    return;
                  }
                  setTraceTopic(topic);
                  setAiBusy("trace");
                  setAiError("");
                  setTraceText("");
                  const ev = traceEvidence(topic, M, { ...aiCtx, supplierNameOf: supplierName });
                  setTraceEv(ev);
                  try {
                    const flat = ev
                      .map((g) => `— ${g.title} —\n` + g.items.map((x) => "• " + x).join("\n"))
                      .join("\n\n");
                    const txt = await askReportAi([
                      {
                        role: "user",
                        content:
                          "صاحب محل ذهب يسأل عن مصدر فرق في حساباته. هذه سجلات فعلية جُمعت آليًا من دفاتره (وليست منك). " +
                          "رتّب الاحتمالات من الأرجح للأقل، واذكر لكل احتمال الدليل من السجلات والخطوة العملية للتحقق منه. " +
                          "إن لم تكفِ السجلات لتحديد المصدر، قل ذلك واذكر ما ينقص. " +
                          REPORT_AI_RULES +
                          "\n\nالسؤال: " + (traceQ || "من أين جاء الفرق؟") +
                          "\n\nالسجلات:\n" + (flat || "لا سجلات متعلقة بهذا الموضوع في الفترة المختارة"),
                      },
                    ], 1200);
                    setTraceText(txt);
                  } catch (e) {
                    setAiError("السجلات أدناه دقيقة، لكن تعذّر جلب التحليل");
                  } finally {
                    setAiBusy("");
                  }
                }}
                disabled={!!aiBusy}
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))",
                  color: "var(--panel)",
                }}
              >
                {aiBusy === "trace" ? <Loader2 size={17} className="animate-spin" /> : <Search size={18} />}
              </button>
            </div>

            {traceText && (
              <Card style={{ padding: 14, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
                <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 flex items-center gap-1.5">
                  <Sparkles size={13} /> الاحتمالات مرتّبة
                </p>
                <p style={{ color: "var(--text)" }} className="text-xs leading-relaxed">
                  {traceText}
                </p>
              </Card>
            )}

            {traceEv && traceEv.length === 0 && (
              <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--goodLine)" }}>
                <p style={{ color: "var(--good)" }} className="text-xs font-bold flex items-center gap-1.5">
                  <Check size={13} /> لا سجلات تفسّر فرقًا في هذا الموضوع
                </p>
              </Card>
            )}

            {traceEv && traceEv.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                <p style={{ color: "var(--text2)" }} className="text-[11px]">
                  السجلات التي فُحصت
                </p>
                {traceEv.map((g, i) => (
                  <Card key={i} style={{ padding: 12 }}>
                    <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1.5">
                      {g.title}
                    </p>
                    {g.items.map((x, k) => (
                      <p
                        key={k}
                        className="text-[11px] py-0.5"
                        style={{
                          color: "var(--text2)",
                          borderBottom: k < g.items.length - 1 ? "1px solid var(--line)" : "none",
                        }}
                      >
                        {x}
                      </p>
                    ))}
                  </Card>
                ))}
              </div>
            )}

            {/* ٥. اسأل عن التقرير */}
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-3">
              اسأل عن هذا التقرير
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {["وين راحت فلوسي هذي الفترة؟", "ليش الربح قليل؟", "أكبر بند مصروف وش هو؟", "وش أقدر أحسّنه؟"].map((q) => (
                <button
                  key={q}
                  onClick={() => setAiQ(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full"
                  style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2 mb-3">
              <input
                style={inputStyle}
                value={aiQ}
                onChange={(e) => setAiQ(e.target.value)}
                placeholder="اكتب سؤالك عن أرقام هذه الفترة..."
              />
              <button
                onClick={async () => {
                  if (!aiQ.trim()) return;
                  setAiBusy("qa");
                  setAiError("");
                  setAiA("");
                  try {
                    const txt = await askReportAi([
                      {
                        role: "user",
                        content:
                          "أنت مساعد محاسبي لمحل ذهب. أجب عن سؤال صاحب المحل بالاعتماد على المعطيات المرفقة فقط، بإيجاز شديد (٢-٤ جمل). " +
                          REPORT_AI_RULES +
                          "\n\nالسؤال: " +
                          aiQ.trim() +
                          "\n\nالمعطيات:\n" +
                          reportFactsText(M, MB, aiCtx),
                      },
                    ]);
                    setAiA(txt);
                  } catch (e) {
                    setAiError("تعذّر جلب الإجابة");
                  } finally {
                    setAiBusy("");
                  }
                }}
                disabled={!!aiBusy || !aiQ.trim()}
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: aiQ.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--panel)",
                  color: aiQ.trim() ? "var(--panel)" : "var(--accentLine)",
                }}
              >
                {aiBusy === "qa" ? <Loader2 size={17} className="animate-spin" /> : <Check size={18} />}
              </button>
            </div>
            {aiA && (
              <Card style={{ padding: 14, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
                <p style={{ color: "var(--text)" }} className="text-xs leading-relaxed">
                  {aiA}
                </p>
              </Card>
            )}

            {aiError && (
              <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">
                {aiError}
              </p>
            )}
            <div style={{ height: 24 }} />
          </>
        )}
      </div>

      <div className="print-area" style={{ display: "none" }}>
        <div style={{ fontFamily: "sans-serif", color: "#000", padding: "10mm", direction: "rtl" }}>
          <h1 style={{ fontSize: 16, marginBottom: 2 }}>تقرير {rangeLabel}</h1>
          <p style={{ fontSize: 11, color: "#555", marginBottom: "5mm" }}>{new Date().toLocaleString("en-GB")}</p>
          <p style={{ fontSize: 12 }}>
            المبيعات: {currency}{fmt(salesSum, 0)} ({fSales.length} فاتورة) · الأرباح: {currency}{fmt(salesProfit, 0)}
          </p>
          <p style={{ fontSize: 12 }}>
            مشتريات الذهب: {currency}{fmt(purchGold, 0)} · المصروفات: {currency}{fmt(expSum, 0)}
          </p>
          <p style={{ fontSize: 12 }}>صافي الحركة: {currency}{fmt(netMovement, 0)}</p>
          <p style={{ fontSize: 12 }}>
            الأرصدة — يومي: {currency}{fmt(cashBalance.total, 0)} · خزنة: {currency}{fmt(safeBalance.total, 0)} · عهدة: {currency}{fmt(scrapCustodyBalance.total, 0)}
          </p>
          <p style={{ fontSize: 12 }}>
            المخزون: {totals.pieces} قطعة · {fmtW(totals.fineWeight)} جم عيار 24 · الذهب الفعلي: {fmtW(goldEquivalent.goldGrams)} جم · النقد {fmt(goldEquivalent.cashAmount, 0)} (يعادل {fmtW(goldEquivalent.cashGrams)} جم، لا يُجمع)
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sales
// ============================================================

export { ReportsTab };
