import React, { useState } from "react";
import { FileText, Flame } from "lucide-react";
import { fmt, fmtW } from "../core/money.js";
import { SCRAP_STAGES } from "../core/workflow.js";
import { stageOf } from "../domain/stageOf.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { FundCustodyForm } from "../ui/FundCustodyForm.jsx";
import { RefineScrapForm } from "../ui/RefineScrapForm.jsx";
import { Stat } from "../ui/Stat.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function ScrapSubPage({ scrapEntries, totals, currency, priceData, custodyBalance, surplusLog, onAdd, onFundCustody, onConvert, onSendRefinery, onRefine, onBack }) {
  /* ⚠ التسميات تُقرأ من `SCRAP_STAGES` لا تُكتب هنا ثانيةً.
     قائمتان لحالةٍ واحدة تتباعدان مع أول مرحلة تُضاف: تظهر في شاشة
     ولا تظهر في أخرى، ويرى الموظف قطعةً «بلا حالة». */
  const statusLabel = {
    ...Object.fromEntries(Object.entries(SCRAP_STAGES).map(([k, v]) => [k, v.label])),
    // أسماء قديمة تبقى للتوافق مع سجلات سابقة
    in_stock: SCRAP_STAGES.in_box.label,
    converted: "أُدخل للمخزون",
    used_for_taskir: "استُخدم لتسكير مورد",
  };
  const statusColor = { in_stock: "var(--accent)", converted: "var(--goodSolid)", sent: "var(--accent)", used_for_taskir: "var(--accentSoft)", in_safe: "var(--goodSolid)" };
  const [showFund, setShowFund] = useState(false);
  const [refiningId, setRefiningId] = useState(null);
  const [showSurplusReport, setShowSurplusReport] = useState(false);
  const totalSurplus = surplusLog.reduce((a, s) => a + s.weight, 0);

  if (showSurplusReport) {
    return (
      <div>
        <SubPageHeader title="تقرير فائض الفصوص" onBack={() => setShowSurplusReport(false)} />
        <div className="px-4 pt-3">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat label="عدد التصفيات" value={surplusLog.length} />
            <Stat label="إجمالي الفائض" value={`${fmtW(totalSurplus)} جم`} />
          </div>
          {surplusLog.length === 0 ? (
            <EmptyState icon={<Flame size={36} color="var(--accentText)" />} title="لا يوجد فائض بعد" sub="سيظهر هنا كل فائض ذهب نتج عن تصفية هامش الفصوص" />
          ) : (
            <div className="flex flex-col gap-2">
              {surplusLog.map((s) => (
                <Card key={s.id} style={{ padding: 12 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }} className="text-sm">
                      {s.description || "قطعة كسر"}
                    </span>
                    <span style={{ color: "var(--good)" }} className="text-sm font-bold">
                      +{fmtW(s.weight)} جم
                    </span>
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                    {new Date(s.date).toLocaleDateString("en-GB")}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SubPageHeader title="الكسر" onBack={onBack} />
      <div className="px-4 pt-3">
        <Card style={{ padding: 16, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
            عهدة الكسر (منفصلة عن الصندوق الرئيسي)
          </p>
          <p style={{ fontFamily: "'Cairo', sans-serif", color: custodyBalance.total >= 0 ? "var(--accent)" : "var(--bad)" }} className="text-2xl font-extrabold">
            {currency}
            {fmt(custodyBalance.total, 0)}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <p style={{ color: "var(--text3)" }} className="text-[11px]">
                نقدي: {currency}
                {fmt(custodyBalance.cash, 0)}
              </p>
            </div>
            <div>
              <p style={{ color: "var(--text3)" }} className="text-[11px]">
                شبكة: {currency}
                {fmt(custodyBalance.network, 0)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowFund(true)}
            className="w-full mt-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
          >
            تمويل العهدة من الصندوق الرئيسي
          </button>
        </Card>

        {showFund && <FundCustodyForm onCancel={() => setShowFund(false)} onSubmit={(a, m, n, src, cat) => { onFundCustody(a, m, n, src, cat); setShowFund(false); }} />}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Stat label="كسر بالمخزن" value={`${fmtW(totals.weightInStock)} جم`} />
          <Stat label="إجمالي المدفوع" value={`${currency}${fmt(totals.spentTotal, 0)}`} />
        </div>
        <button
          onClick={() => setShowSurplusReport(true)}
          className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mb-4"
          style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
        >
          <FileText size={14} /> تقرير فائض الفصوص ({fmtW(totalSurplus)} جم)
        </button>
        <button
          onClick={onAdd}
          className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-6"
          style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
        >
          <Flame size={18} /> تسجيل كسر جديد
        </button>

        {scrapEntries.length === 0 ? (
          <EmptyState icon={<Flame size={36} color="var(--accentText)" />} title="لا يوجد كسر مسجل" sub="سجّل مشتريات الذهب المكسور أو القديم من العملاء" />
        ) : (
          <div className="flex flex-col gap-3">
            {scrapEntries.map((s) => (
              <Card key={s.id} style={{ padding: 12 }}>
                <div className="flex items-center justify-between">
                  <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                    {s.description || "قطعة كسر"}
                  </p>
                  <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                    {currency}
                    {fmt(s.total, 0)}
                  </span>
                </div>
                <p style={{ color: "var(--text2)" }} className="text-xs mt-1">
                  {fmtW(s.weight)} جم · عيار {s.karat === "unknown" ? "غير محدد" : s.karat} · {currency}
                  {fmt(s.pricePerGram)}/جم · {s.paymentMethod === "network" ? "شبكة" : "نقدي"}
                </p>
                {s.stonesMarginEstimate > 0 && (
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                    هامش فصوص تقديري: {fmtW(s.stonesMarginEstimate)} جم
                    {s.refined ? ` · فعلي: ${fmtW(s.actualStonesWeight)} جم` : " · لم تُصفَّ بعد"}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--accentBg)", color: statusColor[stageOf(s)] || "var(--text2)", border: "1px solid var(--accentLine)" }}>
                    {statusLabel[stageOf(s)] || SCRAP_STAGES[stageOf(s)]?.label || "—"}
                  </span>
                  {s.status === "in_stock" && (
                    <div className="flex gap-2">
                      {s.stonesMarginEstimate > 0 && !s.refined && (
                        <button onClick={() => setRefiningId(refiningId === s.id ? null : s.id)} className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--panel)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
                          تصفية
                        </button>
                      )}
                      {/* ⚠ الإرسال لمن في صندوق الكسر فقط.
                          إظهاره لكل قطعة يجعل الموظف يضغطه على ما هو
                          لدى الإدارة سلفًا — فيُرفض ولا يفهم لماذا. */}
                      {stageOf(s) === "in_box" && (
                        <button onClick={() => onSendRefinery(s)} className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                          إرسال للفحص
                        </button>
                      )}
                      <button onClick={() => onConvert(s)} className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                        تحويل لمخزون
                      </button>
                    </div>
                  )}
                </div>
                {refiningId === s.id && (
                  <RefineScrapForm
                    estimate={s.stonesMarginEstimate}
                    onCancel={() => setRefiningId(null)}
                    onSubmit={(actual) => {
                      onRefine(s.id, actual);
                      setRefiningId(null);
                    }}
                  />
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { ScrapSubPage };
