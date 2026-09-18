import React from "react";
import { fmt, fmtMoney, fmtW, weightTimesPrice } from "../core/money.js";
import { mgrFeeBreakdown, mgrFeeEnabled, mgrFeeRate } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { GoldPositionCard } from "../ui/GoldPositionCard.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function FinancialStatementsPage({
  totals,
  priceData,
  cashBalance,
  safeBalance,
  safeGoldBalance,
  scrapCustodyBalance,
  scrapTotals,
  expensesTotals,
  partnersTotals,
  salesTotals,
  taxTotals,
  goldEquivalent,
  openingGoldEquivalent,
  openingBalance,
  goldPosition,
  openingGoldPosition,
  sales = [],
  returns = [],
  users = [],
  appSettings,
  onBack,
}) {
  const currency = priceData.currency;
  const price24 = priceData.current || 0;

  // ---- شجرة الحسابات: Assets ----
  const cashAndEquivalents = cashBalance.total + safeBalance.total + scrapCustodyBalance.total;
  // Value the safe's gold at its FINE weight — pricing 18k grams at the 24k
  // rate would overstate assets and inflate the zakat base.
  const safeGoldValue = weightTimesPrice(safeGoldBalance.fineWeight, price24);
  const inventoryAtCost = totals.cost;
  const inventoryAtMarket = totals.value;
  const scrapAtCost = scrapTotals.inStockValue;
  const totalAssetsAtCost = cashAndEquivalents + safeGoldValue + inventoryAtCost + scrapAtCost;
  const totalAssetsAtMarket = cashAndEquivalents + safeGoldValue + inventoryAtMarket + scrapAtCost;

  // ---- شجرة الحسابات: Equity ----
  const partnersCapital = partnersTotals.totalCapital;
  const retainedEarnings = totalAssetsAtCost - partnersCapital; // implied, since no liabilities are tracked

  // ---- قائمة الدخل (مبسّطة) ----
  const cogsApprox = totals.realizedProfit !== undefined ? salesTotals.sum - totals.realizedProfit : 0;
  const grossProfit = totals.realizedProfit || 0;
  const netProfit = grossProfit - expensesTotals.total;

  // ---- الزكاة: وعاء الزكاة التقديري = النقدية + المخزون بالتكلفة + الكسر بالتكلفة - لا يوجد التزامات متداولة مسجّلة ----
  const zakatBase = cashAndEquivalents + safeGoldValue + inventoryAtCost + scrapAtCost;
  const zakatDue = zakatBase * 0.025;

  const netProfitGrams = price24 > 0 ? netProfit / price24 : 0;
  const grossProfitGrams = price24 > 0 ? grossProfit / price24 : 0;

  const Row = ({ label, value, bold, indent }) => (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)", paddingRight: indent ? 12 : 0 }}>
      <span style={{ color: bold ? "var(--text)" : "var(--text2)" }} className={bold ? "text-sm font-bold" : "text-xs"}>
        {label}
      </span>
      <span style={{ color: bold ? "var(--accent)" : "var(--text)" }} className={bold ? "text-sm font-bold" : "text-xs font-bold"}>
        {currency}
        {fmt(value, 0)}
      </span>
    </div>
  );
  // Gains are shown primarily in grams (24k, at today's price) — the SAR
  // figure appears as a smaller secondary reference on the same row.
  const RowGrams = ({ label, valueSar, valueGrams }) => (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--line)" }}>
      <span style={{ color: "var(--text)" }} className="text-sm font-bold">
        {label}
      </span>
      <div className="text-left">
        <p style={{ color: valueGrams >= 0 ? "var(--accent)" : "var(--bad)" }} className="text-sm font-bold">
          {fmtW(valueGrams)} جم
        </p>
        <p style={{ color: "var(--text3)" }} className="text-[10px]">
          {currency}
          {fmt(valueSar, 0)}
        </p>
      </div>
    </div>
  );

  return (
    <div>
      <SubPageHeader title="القوائم المالية والزكاة" onBack={onBack} />
      <div className="px-4 pt-3">
        {goldPosition && <GoldPositionCard position={goldPosition} opening={openingGoldPosition} />}
        <p style={{ color: "var(--text2)" }} className="text-xs mb-4">
          مبنية على شجرة الحسابات: الأصول (نقدية + ذهب + مخزون) مقابل حقوق الملكية (رأس مال الشركاء + الأرباح المحتجزة)
        </p>

        {openingBalance?.date && (
          <Card style={{ padding: 16, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold mb-2">
              المقارنة منذ الرصيد الافتتاحي
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p style={{ color: "var(--text3)" }} className="text-[11px]">
                  الرصيد الافتتاحي
                </p>
                <p style={{ color: "var(--text)" }} className="text-sm font-bold">
                  {fmtW(openingGoldEquivalent.goldGrams)} جم
                </p>
              </div>
              <div>
                <p style={{ color: "var(--text3)" }} className="text-[11px]">
                  الرصيد الحالي
                </p>
                <p style={{ color: "var(--text)" }} className="text-sm font-bold">
                  {fmtW(goldEquivalent.goldGrams)} جم
                </p>
              </div>
            </div>
            <p style={{ color: "var(--text3)" }} className="text-[11px] mt-3 mb-1">
              النمو منذ البداية (بعيار 24)
            </p>
            <p
              style={{ fontFamily: "'Cairo', sans-serif", color: goldEquivalent.goldGrams - openingGoldEquivalent.goldGrams >= 0 ? "var(--goodSolid)" : "var(--bad)" }}
              className="text-2xl font-extrabold"
            >
              {goldEquivalent.goldGrams - openingGoldEquivalent.goldGrams >= 0 ? "+" : ""}
              {fmtW(goldEquivalent.goldGrams - openingGoldEquivalent.goldGrams)} جم
            </p>
          </Card>
        )}

        <Card style={{ padding: 16, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold mb-2">
            وعاء الزكاة المقدَّر
          </p>
          <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--accent)" }} className="text-2xl font-extrabold">
            {currency}
            {fmt(zakatBase, 0)}
          </p>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1 mb-2">
            الزكاة المستحقة (٪2.5)
          </p>
          <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--good)" }} className="text-xl font-extrabold">
            {currency}
            {fmt(zakatDue, 0)}
          </p>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mt-2">
            تقدير مبسّط (نقدية + ذهب الخزنة + مخزون بالتكلفة + كسر بالتكلفة) × 2.5٪ — راجع محاسبك لضبط التعديلات الشرعية والنظامية قبل السداد الفعلي.
          </p>
        </Card>

        <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
          قائمة المركز المالي — الأصول
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <Row label="نقدية وما في حكمها (يومي + خزنة + عهدة الكسر)" value={cashAndEquivalents} indent />
          <Row label="ذهب محفوظ بالخزنة (بسعر اليوم)" value={safeGoldValue} indent />
          <Row label="المخزون (بسعر التكلفة)" value={inventoryAtCost} indent />
          <Row label="كسر بالمخزن (بسعر التكلفة)" value={scrapAtCost} indent />
          <Row label="إجمالي الأصول (بالتكلفة)" value={totalAssetsAtCost} bold />
          <Row label="إجمالي الأصول (بسعر السوق للمخزون)" value={totalAssetsAtMarket} bold />
        </Card>

        <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
          قائمة المركز المالي — حقوق الملكية
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <Row label="رأس مال الشركاء (صافي)" value={partnersCapital} indent />
          <Row label="أرباح محتجزة (ضمنية)" value={retainedEarnings} indent />
          <Row label="إجمالي حقوق الملكية" value={partnersCapital + retainedEarnings} bold />
        </Card>

        <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
          قائمة الدخل (تراكمية منذ البداية)
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <Row label="إجمالي المبيعات" value={salesTotals.sum} indent />
          <Row label="تكلفة البضاعة المباعة (تقديري)" value={cogsApprox} indent />
          <RowGrams label="مجمل الربح" valueSar={grossProfit} valueGrams={grossProfitGrams} />
          <Row label="المصروفات (كل الأنواع)" value={expensesTotals.total} indent />
          <RowGrams label="صافي الربح" valueSar={netProfit} valueGrams={netProfitGrams} />
        </Card>

        <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
          ملخص الضريبة
        </p>
        <Card style={{ padding: 14, marginBottom: mgrFeeEnabled(appSettings) ? 12 : 0 }}>
          <Row label="ضريبة اليوم" value={taxTotals.todayTax} indent />
          <Row label="ضريبة الشهر" value={taxTotals.monthTax} indent />
        </Card>

        {mgrFeeEnabled(appSettings) && (() => {
          const rate = mgrFeeRate(appSettings);
          const mgrFee = mgrFeeBreakdown({ sales, returns, users, dayId: null, rate });
          return (
            <>
              <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
                ملخص عمولة المدير
              </p>
              <Card style={{ padding: 14 }}>
                <Row label={`عمولة كل المبيعات (${rate}٪)`} value={mgrFee.totalFee} indent />
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                  {fmtMoney(mgrFee.totalFee)} على صافي مبيعات {fmtMoney(mgrFee.totalNet)} — تُعتمد فعليًا يوم الإقفال
                </p>
              </Card>
            </>
          );
        })()}
      </div>
    </div>
  );
}

export { FinancialStatementsPage };
