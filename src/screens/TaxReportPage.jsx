import React from "react";
import { FileText } from "lucide-react";
import { fmt } from "../core/money.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Stat } from "../ui/Stat.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function TaxReportPage({ taxTotals, currency, onBack }) {
  const days = Object.entries(taxTotals.byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  return (
    <div>
      <SubPageHeader title="تقرير الضرائب" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label="ضريبة اليوم" value={`${currency}${fmt(taxTotals.todayTax, 0)}`} />
          <Stat label="ضريبة الشهر" value={`${currency}${fmt(taxTotals.monthTax, 0)}`} />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label="مبيعات اليوم بضريبة" value={`${currency}${fmt(taxTotals.todayTaxable, 0)}`} />
          <Stat label="مبيعات اليوم بدون ضريبة" value={`${currency}${fmt(taxTotals.todayExempt, 0)}`} />
        </div>
        <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
          تفصيل يومي
        </p>
        {days.length === 0 ? (
          <EmptyState icon={<FileText size={36} color="var(--accentText)" />} title="لا يوجد مبيعات بعد" sub="ستظهر هنا حصيلة الضريبة يومًا بيوم" />
        ) : (
          <div className="flex flex-col gap-2">
            {days.map(([day, d]) => (
              <Card key={day} style={{ padding: 12 }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text)" }} className="text-sm">
                    {day}
                  </span>
                  <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                    {currency}
                    {fmt(d.tax, 0)}
                  </span>
                </div>
                <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                  بضريبة: {currency}
                  {fmt(d.taxable, 0)} · بدون: {currency}
                  {fmt(d.exempt, 0)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { TaxReportPage };
