import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { COMPARE_MODES, KPI_DEFS, REPORT_RANGES } from "../core/constants.js";
import { fmtMoney, fmtW } from "../core/money.js";
import { buildReportDataset } from "../domain/buildReportDataset.js";
import { diffDatasets, exportTablesPdf, inputStyle, resolveCompare, resolveRange } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { DrillSection } from "../ui/DrillSection.jsx";
import { Field } from "../ui/Field.jsx";
import { KpiCard } from "../ui/KpiCard.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function MasterReportPage({
  sales = [], returns = [], expenses = [], cashTx = [], safeTx = [],
  items = [], lots = [], scrapEntries = [], commissionLog = [], journal = [],
  scrapCustodyTx = [], safeGoldTx = [], priceData = {},
  currency = "ر.س", branchName = "", onBack,
}) {
  const [mode, setMode] = useState("summary");     // summary | detail
  const [rangeId, setRangeId] = useState("this_month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [compareOn, setCompareOn] = useState(false);
  const [cmpMode, setCmpMode] = useState("prev");
  const [cmpCustom, setCmpCustom] = useState({ from: "", to: "" });

  const stores = { sales, returns, expenses, cashTx, safeTx, items, lots,
    scrapEntries, commissionLog, journal, scrapCustodyTx, safeGoldTx, priceData };

  const range = useMemo(() => resolveRange(rangeId, custom), [rangeId, custom]);
  const report = useMemo(() => buildReportDataset(range, stores),
    [range, sales, returns, expenses, lots, scrapEntries, commissionLog]);

  const cmpRange = useMemo(
    () => (compareOn ? resolveCompare(range, cmpMode, cmpCustom) : null),
    [compareOn, range, cmpMode, cmpCustom]);
  const cmpData = useMemo(
    () => (cmpRange ? buildReportDataset(cmpRange, stores) : null),
    [cmpRange, sales, returns, expenses, lots, scrapEntries, commissionLog]);
  const diff = useMemo(
    () => (cmpData ? diffDatasets(report, cmpData) : null), [report, cmpData]);

  const fmtDay = (t) => new Date(t).toLocaleDateString("en-GB");

  // ── جداول التفصيل ──
  const SECTIONS = [
    {
      title: "المبيعات", rows: report.rows.sales, count: report.kpi.salesCount,
      columns: [
        { key: "ref", label: "المرجع" },
        { key: "date", label: "التاريخ", render: (r) => fmtDay(r.date) },
        { key: "customer", label: "العميل" },
        { key: "weight", label: "الوزن", render: (r) => `${fmtW(r.weight)} جم` },
        { key: "total", label: "الإجمالي", align: "left",
          render: (r) => `${currency}${fmtMoney(r.total)}` },
        { key: "seller", label: "البائع" },
      ],
    },
    {
      title: "المشتريات", rows: report.rows.purchases, count: report.kpi.buyCount,
      columns: [
        { key: "ref", label: "المرجع" },
        { key: "date", label: "التاريخ", render: (r) => fmtDay(r.date) },
        { key: "karat", label: "العيار" },
        { key: "weight", label: "الوزن", render: (r) => `${fmtW(r.weight)} جم` },
        { key: "pieces", label: "القطع" },
        { key: "cost", label: "التكلفة", align: "left",
          render: (r) => `${currency}${fmtMoney(r.cost)}` },
      ],
    },
    {
      title: "الكسر", rows: report.rows.scrap, count: report.kpi.scrapCount,
      columns: [
        { key: "ref", label: "المرجع" },
        { key: "date", label: "التاريخ", render: (r) => fmtDay(r.date) },
        { key: "karat", label: "العيار" },
        { key: "weight", label: "الوزن", render: (r) => `${fmtW(r.weight)} جم` },
        { key: "paid", label: "المدفوع", align: "left",
          render: (r) => `${currency}${fmtMoney(r.paid)}` },
      ],
    },
    {
      title: "المصروفات", rows: report.rows.expenses,
      count: `${currency}${fmtMoney(report.kpi.expenses)}`,
      columns: [
        { key: "ref", label: "المرجع" },
        { key: "date", label: "التاريخ", render: (r) => fmtDay(r.date) },
        { key: "desc", label: "البيان" },
        { key: "amount", label: "المبلغ", align: "left",
          render: (r) => `${currency}${fmtMoney(r.amount)}` },
      ],
    },
    {
      title: "المرتجعات", rows: report.rows.returns, count: report.kpi.retCount,
      columns: [
        { key: "ref", label: "المرجع" },
        { key: "date", label: "التاريخ", render: (r) => fmtDay(r.date) },
        { key: "total", label: "المبلغ", align: "left",
          render: (r) => `${currency}${fmtMoney(r.total)}` },
        { key: "reason", label: "السبب" },
      ],
    },
  ];

  // ── التصدير ──
  //
  // ⚠ يُصدَّر ما يُرى: من فتح المقارنة يريدها في الملف، ومن أغلقها
  // لا يريد أعمدةً فارغة تُربك من يقرأ.
  const exportPdf = () => {
    const secs = [{
      title: `المؤشّرات — ${report.range.label}`,
      head: compareOn
        ? ["المؤشّر", "الفترة", "المقارَنة", "الفرق", "٪"]
        : ["المؤشّر", "القيمة"],
      rows: KPI_DEFS.map((d) => {
        const v = report.kpi[d.key];
        const s = d.unit === "money" ? `${currency}${fmtMoney(v)}`
          : d.unit === "weight" ? `${fmtW(v)} جم` : String(v);
        if (!compareOn) return [d.label, s];
        const c = diff[d.key];
        const b = d.unit === "money" ? `${currency}${fmtMoney(c.before)}`
          : d.unit === "weight" ? `${fmtW(c.before)} جم` : String(c.before);
        const df = d.unit === "money" ? `${currency}${fmtMoney(c.diff)}`
          : d.unit === "weight" ? `${fmtW(c.diff)} جم` : String(c.diff);
        return [d.label, s, b, df, c.pct === null ? "—" : `${c.pct}٪`];
      }),
    }];
    if (mode === "detail") {
      SECTIONS.forEach((sec) => {
        if (!sec.rows.length) return;
        secs.push({
          title: sec.title,
          head: sec.columns.map((c) => c.label),
          rows: sec.rows.map((r) => sec.columns.map((c) =>
            String(c.render ? c.render(r) : (r[c.key] ?? "—")))),
        });
      });
    }
    exportTablesPdf({
      title: "التقرير الموحّد",
      subtitle: `${fmtDay(range.from)} — ${fmtDay(range.to)}`
        + (compareOn ? ` · مقارنةً بـ${cmpRange.label}` : ""),
      branchName, sections: secs, landscape: mode === "detail",
    });
  };

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const kpiRows = [
      compareOn ? ["المؤشّر", "الفترة", "المقارَنة", "الفرق", "٪"]
        : ["المؤشّر", "القيمة"],
      ...KPI_DEFS.map((d) => {
        const v = report.kpi[d.key];
        if (!compareOn) return [d.label, v];
        const c = diff[d.key];
        return [d.label, c.now, c.before, c.diff, c.pct === null ? "" : c.pct];
      }),
    ];
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.aoa_to_sheet(kpiRows), "المؤشّرات");
    if (mode === "detail") {
      SECTIONS.forEach((sec) => {
        if (!sec.rows.length) return;
        const aoa = [sec.columns.map((c) => c.label),
          ...sec.rows.map((r) => sec.columns.map((c) => r[c.key] ?? ""))];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa),
          sec.title.slice(0, 30));
      });
    }
    XLSX.writeFile(wb, `تقرير-${range.from}-${range.to}.xlsx`);
  };

  return (
    <div>
      <SubPageHeader title="التقارير الموحّدة" onBack={onBack} />
      <div className="px-4 pt-3">

        {/* ── مفتاح العرض ── */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[["summary", "مختصر"], ["detail", "تفصيلي"]].map(([id, lbl]) => {
            const on = mode === id;
            return (
              <button key={id} onClick={() => setMode(id)}
                className="py-2.5 rounded-xl text-[12px] font-bold"
                style={{
                  background: on ? "var(--accentBg)" : "var(--panel)",
                  color: on ? "var(--accent)" : "var(--text2)",
                  border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`,
                }}>
                {lbl}
              </button>
            );
          })}
        </div>

        {/* ── المحرّك الزمني ── */}
        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1.5">
          الفترة
        </p>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {REPORT_RANGES.map((r) => {
            const on = rangeId === r.id;
            return (
              <button key={r.id} onClick={() => setRangeId(r.id)}
                className="py-2 rounded-lg text-[10px] font-bold"
                style={{
                  background: on ? "var(--accentBg)" : "var(--field)",
                  color: on ? "var(--accent)" : "var(--text2)",
                  border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`,
                }}>
                {r.label}
              </button>
            );
          })}
        </div>
        {rangeId === "custom" && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Field label="من">
              <input type="date" style={inputStyle} value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </Field>
            <Field label="إلى">
              <input type="date" style={inputStyle} value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </Field>
          </div>
        )}
        <p style={{ color: "var(--text3)" }} className="text-[10px] mb-3">
          {fmtDay(range.from)} — {fmtDay(range.to)}
        </p>


        {/* ── المقارنة ── */}
        <button
          onClick={() => setCompareOn((v) => !v)}
          className="w-full py-2 rounded-xl text-[11px] font-bold mb-2"
          style={{
            background: compareOn ? "var(--accentBg)" : "var(--field)",
            color: compareOn ? "var(--accent)" : "var(--text2)",
            border: `1px solid ${compareOn ? "var(--accentLine)" : "var(--line)"}`,
          }}>
          {compareOn ? "✓ المقارنة مفعّلة" : "مقارنة بفترة أخرى"}
        </button>
        {compareOn && (
          <>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {COMPARE_MODES.map((m) => {
                const on = cmpMode === m.id;
                return (
                  <button key={m.id} onClick={() => setCmpMode(m.id)}
                    className="py-2 rounded-lg text-right px-2"
                    style={{
                      background: on ? "var(--accentBg)" : "var(--field)",
                      border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`,
                    }}>
                    <span style={{ color: on ? "var(--accent)" : "var(--text)" }}
                      className="text-[11px] font-bold block">{m.label}</span>
                    <span style={{ color: "var(--text3)" }} className="text-[9px]">
                      {m.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            {cmpMode === "custom" && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Field label="من">
                  <input type="date" style={inputStyle} value={cmpCustom.from}
                    onChange={(e) => setCmpCustom((c) => ({ ...c, from: e.target.value }))} />
                </Field>
                <Field label="إلى">
                  <input type="date" style={inputStyle} value={cmpCustom.to}
                    onChange={(e) => setCmpCustom((c) => ({ ...c, to: e.target.value }))} />
                </Field>
              </div>
            )}
            {cmpRange && (
              <p style={{ color: "var(--text3)" }} className="text-[10px] mb-3">
                تُقارَن بـ {fmtDay(cmpRange.from)} — {fmtDay(cmpRange.to)}
              </p>
            )}
          </>
        )}



        {/* ── الرصيد الآن ── */}
        {/* ⚠ لا يتبع المدى: «كم عندي الآن» سؤالٌ عن اللحظة لا عن
            الفترة. ومن يقرأ رصيدًا مُصفّى بشهرٍ مضى يظنّ خزنته فارغة. */}
        <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--accent)", margin: 0 }} className="text-[11px] font-bold mb-2">
            الرصيد الآن — لا يتبع الفترة
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">النقد</p>
              <p style={{ color: "var(--text)", margin: 0 }} className="text-[15px] font-bold">
                {currency}{fmtMoney(report.balanceNow.cash.total)}
              </p>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px] leading-5">
                يومي {fmtMoney(report.balanceNow.cash.daily)} ·
                خزنة {fmtMoney(report.balanceNow.cash.safe)} ·
                عهدة {fmtMoney(report.balanceNow.cash.custody)}
              </p>
            </div>
            <div>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">الذهب</p>
              <p style={{ color: "var(--accent)", margin: 0 }} className="text-[15px] font-bold">
                {fmtW(report.balanceNow.gold.fine)} جم24
              </p>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px] leading-5">
                مشغول {fmtW(report.balanceNow.gold.crafted)} ·
                كسر {fmtW(report.balanceNow.gold.scrap)} ·
                خزنة {fmtW(report.balanceNow.gold.vault)}
              </p>
            </div>
          </div>

          {report.balanceNow.gold.byKarat.length > 0 && (
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
              {report.balanceNow.gold.byKarat.map((k) => (
                <div key={k.karat} className="flex items-baseline justify-between py-0.5">
                  <span style={{ color: "var(--text2)" }} className="text-[10px]">
                    عيار {k.karat}
                  </span>
                  <span style={{ color: "var(--text3)" }} className="text-[10px]">
                    {fmtW(k.crafted + k.scrap + Math.max(0, k.vault))} جم ·
                    يعادل {fmtW(k.fine)} جم24
                  </span>
                </div>
              ))}
            </div>
          )}

          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2 leading-6">
            ⚖ التقويم بسعر اليوم {currency}{fmtMoney(report.balanceNow.gold.valuedAt)}/جم24
            = {currency}{fmtMoney(report.balanceNow.gold.value)} — مرجعٌ لا رصيد.
            الوزن يبقى وزنًا ولا يُجمع مع النقد.
          </p>
        </Card>

        {/* ── المؤشّرات ── */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {KPI_DEFS.map((d) => (
            <KpiCard key={d.key} def={d} value={report.kpi[d.key]}
              cmp={diff ? diff[d.key] : null} currency={currency} />
          ))}
        </div>

        {/* ── حسب البائع ── */}
        {mode === "summary" && report.bySeller.length > 0 && (
          <Card style={{ padding: 12, marginBottom: 10 }}>
            <p style={{ color: "var(--accent)", margin: "0 0 6px" }}
              className="text-[11px] font-bold">المبيعات حسب البائع</p>
            {report.bySeller.map((s) => {
              const pct = report.kpi.salesGross > 0
                ? Math.round((s.total / report.kpi.salesGross) * 100) : 0;
              return (
                <div key={s.name} className="py-1.5"
                  style={{ borderBottom: "1px solid var(--line)" }}>
                  <div className="flex items-baseline justify-between">
                    <span style={{ color: "var(--text)" }} className="text-[11px] font-bold">
                      {s.name}
                    </span>
                    <span style={{ color: "var(--accent)" }} className="text-[11px] font-bold">
                      {currency}{fmtMoney(s.total)}
                    </span>
                  </div>
                  <div style={{ height: 4, background: "var(--field)", borderRadius: 2,
                    marginTop: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%",
                      background: "var(--accent)" }} />
                  </div>
                  <span style={{ color: "var(--text3)" }} className="text-[9px]">
                    {s.count} فاتورة · {fmtW(s.weight)} جم · {pct}٪
                  </span>
                </div>
              );
            })}
          </Card>
        )}

        {/* ── التفصيل ── */}
        {mode === "detail" && (
          <>
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">
              التفصيل — اضغط أي قسم ليتوسّع
            </p>
            {SECTIONS.map((sec) => (
              <DrillSection key={sec.title} {...sec} currency={currency} />
            ))}
          </>
        )}

        {/* ── التصدير ── */}
        <div className="grid grid-cols-2 gap-2 mt-3 mb-6">
          <button onClick={exportPdf}
            className="py-2.5 rounded-xl text-[12px] font-bold"
            style={{ background: "var(--panel)", color: "var(--accent)",
                     border: "1px solid var(--accentLine)" }}>
            PDF
          </button>
          <button onClick={exportXlsx}
            className="py-2.5 rounded-xl text-[12px] font-bold"
            style={{ background: "var(--panel)", color: "var(--good)",
                     border: "1px solid var(--goodLine)" }}>
            Excel
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  سجل العميل الموحّد — طبقة البيانات
//
//  ⚠ العميل واحدٌ وسجلّاته عشرة.
//
//  يشتري في «المبيعات»، ويُرجع في «المرتجعات»، ويترك خاتمًا في
//  «الإصلاحات»، ويحجز في «الحجوزات»، ويودع في «الحسابات الجارية»،
//  ويدفع في «السندات». ومن يريد أن يعرف ما جرى معه يفتح ستّ شاشات
//  ويجمع بعينه.
//
//  فنجمعها في خطٍّ زمنيّ واحد.
//
//  ⚠ ورصيده ثلاثة أبعاد لا رقمٌ واحد: نقدٌ له أو عليه، وذهبٌ محفوظ
//  باسمه، وقطعٌ في يدك. دمجُها يجعل من أودع عشرين جرامًا يظهر دائنًا
//  بثمنها — وهي ليست ثمنًا بل أمانة.
// ═══════════════════════════════════════════════════════════════════════

/// أنواع الأحداث — ولونها وأثرها.

export { MasterReportPage };
