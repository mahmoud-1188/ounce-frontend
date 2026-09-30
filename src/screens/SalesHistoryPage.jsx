import React from "react";
import { Banknote, Receipt } from "lucide-react";
import { fmt } from "../core/money.js";
import { PAYMENT_METHODS } from "../core/money-rules.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";
import { EntityRow } from "../ui/EntityRow.jsx";
import { RowHint } from "../ui/RowHint.jsx";

function SalesHistoryPage({ sales, currency, totals, customers = [], returns = [], canReturn, onReturnSale, onView, onBack, onOpenEntity, rowActs = null, onRowAct = null }) {
  return (
    <div>
      <SubPageHeader title="سجل المبيعات" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-4">
          {totals.count} فاتورة · إجمالي المبيعات {currency}
          {fmt(totals.sum, 0)}
        </p>

        {sales.length === 0 ? (
          <EmptyState icon={<Receipt size={40} color="var(--accentText)" />} title="لا يوجد مبيعات بعد" sub="الفواتير التي تنشئها من صفحة البيع ستظهر هنا" />
        ) : (
          <div className="flex flex-col gap-3">
            {onOpenEntity && <RowHint />}
            {sales.map((s) => {
              const method = PAYMENT_METHODS.find((m) => m.id === s.paymentMethod);
              const Icon = method?.icon || Banknote;
              const qtyCount = (s.lines || []).reduce((a, l) => a + l.quantity, 0);
              return (
                <Card key={s.id} style={{ padding: 0 }} className="cursor-pointer">
                  <EntityRow
                    label={s.ref || "فاتورة"}
                    acts={rowActs ? rowActs("sale", s) : []}
                    onOpen={() => onView(s)}
                    onMore={onOpenEntity ? () => onOpenEntity("sale", s, "actions") : undefined}
                    onAct={(id) => onRowAct?.(id, s, "sale")}
                    className="pl-1"
                    innerClass="flex-1 min-w-0 text-right p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                        {s.sellerName || "—"}
                        {s.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{s.ref}</span>}
                      </p>
                      <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="font-bold">
                        {currency}
                        {fmt(s.total, 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span style={{ color: "var(--text2)" }} className="text-xs">
                        {qtyCount} قطعة · {new Date(s.date).toLocaleDateString("en-GB")}
                      </span>
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--accentBg)", color: "var(--accentText)", border: "1px solid var(--accentLine)" }}>
                        <Icon size={11} /> {method?.label}
                      </span>
                    </div>
                  </EntityRow>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export { SalesHistoryPage };
