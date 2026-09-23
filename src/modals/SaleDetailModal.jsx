import React, { useMemo } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { fmt, fmtW } from "../core/money.js";
import { saleLineProvenance } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";

function SaleDetailModal({ sale, currency, returns = [], items = [], lots = [], suppliers = [], canReturn, onReturn, onClose }) {
  // ⚠ الإرجاع والاستبدال في شاشتهما الواحدة («المرتجعات والاستبدال»)
  //   والفاتورة محدَّدة سلفًا — لا نموذج إرجاعٍ ثانٍ هنا بمحاسبةٍ مختلفة.
  const lines = sale?.lines || [];

  // ما أُرجع سابقًا من هذه الفاتورة — لا يُرجَع مرتين
  const already = useMemo(() => {
    const s = new Set();
    (returns || [])
      .filter((r) => r.saleId === sale?.id)
      .forEach((r) => (r.lineIndexes || []).forEach((i) => s.add(i)));
    return s;
  }, [returns, sale]);

  const available = lines.map((_, i) => i).filter((i) => !already.has(i));
  const allReturned = available.length === 0 && lines.length > 0;

  if (!sale) return null;

  return (
    <ModalShell title={`فاتورة ${sale.ref}`} onClose={onClose}>
      {/* رأس الفاتورة */}
      <Card style={{ padding: 12, marginBottom: 12 }}>
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold">
            {currency}{fmt(sale.total, 2)}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
            {sale.paymentMethod === "cash" ? "نقدي" : sale.paymentMethod === "card" ? "شبكة"
              : sale.paymentMethod === "credit" ? "آجل" : sale.paymentMethod === "trade_in" ? "بدل بكسر" : "مقسّم"}
          </span>
        </div>
        <p style={{ color: "var(--text2)" }} className="text-[11px]">
          {new Date(sale.date).toLocaleString("en-GB")}
          {sale.sellerName ? ` · ${sale.sellerName}` : ""}
          {sale.customerName ? ` · ${sale.customerName}` : ""}
        </p>
        {sale.taxAmount > 0 && (
          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
            شامل ضريبة {currency}{fmt(sale.taxAmount, 2)}
          </p>
        )}
      </Card>

      {/* الأسطر */}
      <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">{`الأصناف (${lines.length})`}</p>
      <div className="flex flex-col gap-2 mb-3">
        {lines.map((l, i) => {
          const done = already.has(i);
          const pv = saleLineProvenance(l, sale, { items, lots, suppliers });
          return (
            <Card key={i} style={{ padding: 11, border: "1px solid var(--line)", opacity: done ? 0.55 : 1 }}>
              <div className="flex items-center gap-2">
                <span style={{ color: done ? "var(--text3)" : "var(--text)" }} className="text-xs flex-1">
                  عيار {l.karatSnapshot} · {fmtW(l.weightSnapshot)} جم
                  {(Number(l.quantity) || 1) > 1 ? ` × ${l.quantity}` : ""}
                  {l.partial ? " (بيع بالوزن)" : ""}
                </span>
                {done ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: "var(--panel)", color: "var(--bad)", border: "1px solid var(--badLine)" }}>
                    مُرجَع
                  </span>
                ) : (
                  <span style={{ color: "var(--text2)" }} className="text-[11px] whitespace-nowrap">
                    {currency}{fmt((Number(l.unitPrice) || 0) * (Number(l.quantity) || 1), 2)}
                  </span>
                )}
              </div>
              {/* ⚖ من أين جاءت القطعة وبكم كان المعدن يوم شرائها ويوم بيعها */}
              <div className="mt-1.5 pt-1.5" style={{ borderTop: "1px solid var(--line)" }}>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">
                  {pv.item?.ref ? <span style={{ fontFamily: "monospace" }}>{pv.item.ref} · </span> : null}
                  المصدر: <span style={{ color: "var(--text2)" }}>{pv.sourceLabel}</span>
                  {pv.lotRef ? ` (${pv.lotRef})` : ""}
                  {pv.purchasedAt ? ` · اشتُريت ${new Date(pv.purchasedAt).toLocaleDateString("en-GB")}` : ""}
                </p>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">
                  سعر جم24 وقت الشراء: <span style={{ color: "var(--text2)" }}>{pv.buyPrice24 > 0 ? `${currency}${fmt(pv.buyPrice24, 2)}` : "—"}</span>
                  {" · "}وقت البيع: <span style={{ color: "var(--text2)" }}>{pv.sellPrice24 > 0 ? `${currency}${fmt(pv.sellPrice24, 2)}` : "—"}</span>
                  {pv.metalMove != null && (
                    <span style={{ color: pv.metalMove >= 0 ? "var(--good)" : "var(--bad)" }}>
                      {" "}({pv.metalMove >= 0 ? "+" : ""}{fmt(pv.metalMove, 2)})
                    </span>
                  )}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* حالة الإرجاع الكامل */}
      {allReturned && (
        <Card style={{ padding: 11, marginBottom: 12, border: "1px solid var(--badLine)" }}>
          <p style={{ color: "var(--bad)" }} className="text-[11px] font-bold">
            أُرجعت الفاتورة كاملة
          </p>
        </Card>
      )}

      {/* الإرجاع أو الاستبدال — في شاشتهما الواحدة والفاتورة محدَّدة */}
      {canReturn && !allReturned && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => { onReturn(sale.id, "return"); onClose(); }}
              className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
            >
              <RotateCcw size={14} /> مرتجع
            </button>
            <button
              onClick={() => { onReturn(sale.id, "exchange"); onClose(); }}
              className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
            >
              <RefreshCw size={14} /> استبدال
            </button>
          </div>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
            قطعةٌ واحدة أو الفاتورة كاملة — تختارها في الشاشة التالية، والردّ بأسعار الفاتورة.
          </p>
        </>
      )}
    </ModalShell>
  );
}

export { SaleDetailModal };
