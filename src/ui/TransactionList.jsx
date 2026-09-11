import React from "react";
import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { fmt } from "../core/money.js";
import { accountLabel } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { EmptyState } from "./EmptyState.jsx";

function TransactionList({ transactions, currency, sourceLabel, methodLabel, emptyTitle, emptySub, typeMap = {} }) {
  return (
    <>
      <p style={{ color: "var(--text2)" }} className="text-xs mt-6 mb-2">
        الحركات
      </p>
      {transactions.length === 0 ? (
        <EmptyState icon={<Wallet size={36} color="var(--accentText)" />} title={emptyTitle} sub={emptySub} />
      ) : (
        <div className="flex flex-col gap-2">
          {transactions.map((t) => {
            const isIn = (typeMap[t.type] || t.type) === "in";
            return (
              <Card key={t.id} style={{ padding: 12 }}>
                <div className="flex items-center gap-3">
                  {isIn ? <ArrowDownCircle size={20} color="var(--good)" /> : <ArrowUpCircle size={20} color="var(--bad)" />}
                  <div className="flex-1 min-w-0">
                    <p style={{ color: "var(--text)" }} className="text-sm truncate">
                      {t.note}
                    </p>
                    <p style={{ color: "var(--text3)" }} className="text-[11px]">
                      {t.category ? accountLabel(t.category) : sourceLabel[t.source] || "يدوي"} · {methodLabel[t.method || "cash"]} · {new Date(t.date).toLocaleString("en-GB")}
                    </p>
                  </div>
                  <span style={{ color: isIn ? "var(--goodSolid)" : "var(--bad)" }} className="text-sm font-bold">
                    {isIn ? "+" : "-"}
                    {currency}
                    {fmt(t.amount, 0)}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

export { TransactionList };
