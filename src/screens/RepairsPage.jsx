import React, { useState } from "react";
import { Wrench } from "lucide-react";
import { fmt, fmtW } from "../core/money.js";
import { AddRepairForm } from "../ui/AddRepairForm.jsx";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Stat } from "../ui/Stat.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function RepairsPage({ repairs, currency, price24, onAdd, onBack }) {
  const [showForm, setShowForm] = useState(false);
  const totalProfit = repairs.reduce((a, r) => a + r.profit, 0);
  const totalProfitGrams = repairs.reduce((a, r) => a + (r.profitGrams || (price24 > 0 ? r.profit / price24 : 0)), 0);
  const totalCost = repairs.reduce((a, r) => a + r.cost, 0);

  return (
    <div>
      <SubPageHeader title="إصلاحات" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
          استلام قطع للتقصير أو التعديل — تسجّل التكلفة والمكسب، والمكسب يُضاف تلقائيًا للصندوق
        </p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat label="عدد الإصلاحات" value={repairs.length} />
          <Stat label="إجمالي التكلفة" value={`${currency}${fmt(totalCost, 0)}`} />
          <Stat label="إجمالي المكسب (بعيار 24)" value={`${fmtW(totalProfitGrams)} جم`} />
        </div>

        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-6"
          style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
        >
          <Wrench size={18} /> إصلاح جديد
        </button>

        {showForm && (
          <AddRepairForm
            onCancel={() => setShowForm(false)}
            onSave={(entry) => {
              onAdd(entry);
              setShowForm(false);
            }}
          />
        )}

        {repairs.length === 0 ? (
          <EmptyState icon={<Wrench size={36} color="var(--accentText)" />} title="لا يوجد إصلاحات مسجلة" sub="سجّل أول عملية تقصير أو تعديل لقطعة عميل" />
        ) : (
          <div className="flex flex-col gap-3">
            {repairs.map((r) => (
              <Card key={r.id} style={{ padding: 12 }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                    {r.customerName || "بدون اسم"}
                  </span>
                  <span style={{ color: "var(--good)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                    +{fmtW(r.profitGrams || (price24 > 0 ? r.profit / price24 : 0))} جم
                  </span>
                </div>
                {r.description && (
                  <p style={{ color: "var(--text2)" }} className="text-xs mt-1">
                    {r.description}
                  </p>
                )}
                <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                  تكلفة: {currency}
                  {fmt(r.cost, 0)} · مكسب: {currency}
                  {fmt(r.profit, 0)} · {new Date(r.date).toLocaleDateString("en-GB")}
                  {r.createdBy ? ` · ${r.createdBy}` : ""}
                </p>
                {r.notes && (
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                    {r.notes}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { RepairsPage };
