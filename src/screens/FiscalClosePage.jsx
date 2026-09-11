import React, { useState } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { fmt, fmtW } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { Stat } from "../ui/Stat.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function FiscalClosePage({
  openingBalance,
  fiscalClosures,
  latestClosure,
  currency,
  price24,
  goldEquivalent,
  cashBalance,
  safeBalance,
  safeGoldBalance,
  scrapCustodyBalance,
  partnersTotals,
  sales,
  expenses,
  onClose,
}) {
  const [confirming, setConfirming] = useState(false);
  const [notes, setNotes] = useState("");
  const [viewingClosure, setViewingClosure] = useState(null);

  const periodStart = latestClosure ? latestClosure.closedAt : openingBalance.date;
  const periodSales = sales.filter((s) => !periodStart || new Date(s.date) > new Date(periodStart));
  const periodExpenses = expenses.filter((e) => !periodStart || new Date(e.date) > new Date(periodStart));
  const periodRealizedProfit = periodSales.reduce((acc, s) => {
    const saleProfit = (s.lines || []).reduce((lacc, l) => {
      const basis = (l.costPerGramSnapshot * l.weightSnapshot + (l.workmanshipSnapshot || 0)) * l.quantity;
      return lacc + (l.unitPrice * l.quantity - basis);
    }, 0);
    return acc + saleProfit;
  }, 0);
  const periodExpensesTotal = periodExpenses.reduce((a, e) => a + e.amount, 0);
  const netProfit = periodRealizedProfit - periodExpensesTotal;
  const netProfitGrams = price24 > 0 ? netProfit / price24 : 0;

  if (viewingClosure) {
    const c = viewingClosure;
    return (
      <div>
        <SubPageHeader title={`إقفال ${new Date(c.closedAt).toLocaleDateString("en-GB")}`} onBack={() => setViewingClosure(null)} />
        <div className="px-4 pt-3">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat label="فترة الإقفال" value={`${c.periodStart ? new Date(c.periodStart).toLocaleDateString("en-GB") : "البداية"} → ${new Date(c.closedAt).toLocaleDateString("en-GB")}`} />
            <Stat label="صافي الربح (بعيار 24)" value={`${fmtW(c.netProfitGrams ?? (price24 > 0 ? c.netProfit / price24 : 0))} جم`} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat label="عدد الفواتير" value={c.periodSalesCount} />
            <Stat label="المصروفات" value={`${currency}${fmt(c.periodExpensesTotal, 0)}`} />
          </div>
          <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
            الأرصدة عند الإقفال
          </p>
          <Card style={{ padding: 14 }}>
            {[
              ["صندوق اليومي - نقدي", c.closingBalances.dailyCash],
              ["صندوق اليومي - شبكة", c.closingBalances.dailyNetwork],
              ["الخزنة - نقدي", c.closingBalances.safeCash],
              ["الخزنة - شبكة", c.closingBalances.safeNetwork],
              ["رأس مال الشركاء", c.closingBalances.partnersCapital],
            ].map(([label, val], i) => (
              <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text2)" }} className="text-xs">
                  {label}
                </span>
                <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                  {currency}
                  {fmt(val, 0)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between py-1.5">
              <span style={{ color: "var(--text2)" }} className="text-xs">
                ذهب الخزنة (كسر + مشغول)
              </span>
              <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                {fmtW(c.closingBalances.safeGoldRaw + c.closingBalances.safeGoldCrafted)} جم
              </span>
            </div>
          </Card>
          {c.notes && (
            <p style={{ color: "var(--text2)" }} className="text-xs mt-3">
              ملاحظات: {c.notes}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-4">
          الإقفال يحسب صافي ربح الفترة الحالية، ويحفظ لقطة دائمة من كل الأرصدة، ويجعلها نقطة الأساس الجديدة — بدون حذف أي حركة أو فاتورة قديمة، فتبقى كل التفاصيل التاريخية محفوظة للمراجعة.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Stat label="بداية الفترة الحالية" value={periodStart ? new Date(periodStart).toLocaleDateString("en-GB") : "لم يُحدَّد بعد"} />
          <Stat label="اليوم" value={new Date().toLocaleDateString("en-GB")} />
        </div>

        <Card style={{ padding: 16, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold mb-2">
            صافي ربح الفترة الحالية
          </p>
          <p style={{ fontFamily: "'Cairo', sans-serif", color: netProfit >= 0 ? "var(--goodSolid)" : "var(--bad)" }} className="text-2xl font-extrabold">
            {netProfit >= 0 ? "+" : ""}
            {fmtW(netProfitGrams)} جم
          </p>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
            يعادل {currency}
            {fmt(netProfit, 0)}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <p style={{ color: "var(--text3)" }} className="text-[11px]">
                أرباح المبيعات ({periodSales.length} فاتورة)
              </p>
              <p style={{ color: "var(--text)" }} className="text-xs font-bold">
                {currency}
                {fmt(periodRealizedProfit, 0)}
              </p>
            </div>
            <div>
              <p style={{ color: "var(--text3)" }} className="text-[11px]">
                المصروفات
              </p>
              <p style={{ color: "var(--text)" }} className="text-xs font-bold">
                {currency}
                {fmt(periodExpensesTotal, 0)}
              </p>
            </div>
          </div>
        </Card>

        <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
          الأرصدة اللي راح تصير نقطة البداية الجديدة
        </p>
        <Card style={{ padding: 14, marginBottom: 14 }}>
          <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
            <span style={{ color: "var(--text2)" }} className="text-xs">
              صندوق اليومي
            </span>
            <span style={{ color: "var(--text)" }} className="text-xs font-bold">
              {currency}
              {fmt(cashBalance.total, 0)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
            <span style={{ color: "var(--text2)" }} className="text-xs">
              الخزنة
            </span>
            <span style={{ color: "var(--text)" }} className="text-xs font-bold">
              {currency}
              {fmt(safeBalance.total, 0)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
            <span style={{ color: "var(--text2)" }} className="text-xs">
              عهدة الكسر
            </span>
            <span style={{ color: "var(--text)" }} className="text-xs font-bold">
              {currency}
              {fmt(scrapCustodyBalance.total, 0)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span style={{ color: "var(--text2)" }} className="text-xs">
              الرصيد الإجمالي بعيار 24
            </span>
            <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
              {fmtW(goldEquivalent.goldGrams)} جم
            </span>
          </div>
        </Card>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
          >
            <Lock size={16} /> إقفال السنة الآن
          </button>
        ) : (
          <Card style={{ padding: 14, border: "1px solid var(--badLine)" }}>
            <p style={{ color: "var(--bad)" }} className="text-xs font-bold mb-2 flex items-center gap-1">
              <AlertTriangle size={13} /> تأكيد الإقفال
            </p>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
              بعد التأكيد، هذه الأرصدة تصير نقطة البداية للفترة القادمة، ولا يمكن التراجع عن هذه الخطوة. كل الحركات والفواتير القديمة تبقى محفوظة للمراجعة دائمًا.
            </p>
            <Field label="ملاحظات على هذا الإقفال (اختياري)">
              <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => setConfirming(false)} className="py-2.5 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                إلغاء
              </button>
              <button
                onClick={() => {
                  onClose(notes);
                  setConfirming(false);
                  setNotes("");
                }}
                className="py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
              >
                تأكيد الإقفال
              </button>
            </div>
          </Card>
        )}

        {fiscalClosures.length > 0 && (
          <>
            <p style={{ color: "var(--text2)" }} className="text-xs mt-6 mb-2">
              سجل الإقفالات السابقة
            </p>
            <div className="flex flex-col gap-2">
              {fiscalClosures.map((c) => (
                <button key={c.id} onClick={() => setViewingClosure(c)} className="w-full text-right">
                  <Card style={{ padding: 12 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                        {new Date(c.closedAt).toLocaleDateString("en-GB")}
                      </span>
                      <span style={{ color: c.netProfit >= 0 ? "var(--goodSolid)" : "var(--bad)" }} className="text-sm font-bold">
                        {c.netProfit >= 0 ? "+" : ""}
                        {fmtW(c.netProfitGrams ?? (price24 > 0 ? c.netProfit / price24 : 0))} جم
                      </span>
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                      {c.periodSalesCount} فاتورة · {fmtW(c.goldGramsAtClose ?? 0)} جم ذهب
                    </p>
                  </Card>
                </button>
              ))}
            </div>
          </>
        )}
    </div>
  );
}

export { FiscalClosePage };
