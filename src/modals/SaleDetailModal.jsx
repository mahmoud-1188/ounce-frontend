import React, { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { fmt, fmtW } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";

function SaleDetailModal({ sale, currency, returns = [], canReturn, onReturn, onClose }) {
  // ── الإرجاع من داخل الفاتورة ──
  //
  // مكانه الصحيح هنا لا في زر منفصل: الإرجاع لا يبدأ من فراغ، بل من
  // فاتورة تفتحها لتتأكّد ماذا بيع ولمن وبكم. زر «إرجاع» في القائمة
  // يعني بحثًا عن الفاتورة مرتين.
  const [mode, setMode] = useState(null);        // null | "pick"
  const [picked, setPicked] = useState([]);      // فهارس الأسطر
  const [source, setSource] = useState("daily"); // مصدر ردّ المبلغ
  const [note, setNote] = useState("");

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
  const refund = picked.reduce(
    (a, i) => a + (Number(lines[i]?.unitPrice) || 0) * (Number(lines[i]?.quantity) || 1), 0
  );
  const isFull = picked.length > 0 && picked.length === available.length;

  const toggle = (i) =>
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

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
              : sale.paymentMethod === "credit" ? "آجل" : "مقسّم"}
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
      <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
        {mode === "pick" ? "اختر ما تُرجعه" : `الأصناف (${lines.length})`}
      </p>
      <div className="flex flex-col gap-2 mb-3">
        {lines.map((l, i) => {
          const done = already.has(i);
          const on = picked.includes(i);
          const clickable = mode === "pick" && !done;
          return (
            <button key={i} onClick={() => clickable && toggle(i)} disabled={!clickable}
              className="w-full text-right">
              <Card style={{
                padding: 11,
                border: `1px solid ${done ? "var(--line)" : on ? "var(--accentLine)" : "var(--line)"}`,
                opacity: done ? 0.55 : 1,
              }}>
                <div className="flex items-center gap-2">
                  {clickable && (
                    <div style={{
                      width: 17, height: 17, borderRadius: 5, flexShrink: 0,
                      background: on ? "var(--accent)" : "transparent",
                      border: `1px solid ${on ? "var(--accent)" : "var(--edge)"}`,
                      display: "grid", placeItems: "center",
                    }}>
                      {on && <Check size={11} color="var(--bg)" />}
                    </div>
                  )}
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
              </Card>
            </button>
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

      {/* بدء الإرجاع */}
      {canReturn && !allReturned && mode !== "pick" && (
        <button
          onClick={() => { setMode("pick"); setPicked([]); }}
          className="w-full py-2.5 rounded-xl text-xs font-bold mb-2"
          style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
        >
          إرجاع من هذه الفاتورة
        </button>
      )}

      {/* نموذج الإرجاع */}
      {mode === "pick" && (
        <Card style={{ padding: 13, marginBottom: 12, border: "1px solid var(--badLine)" }}>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setPicked(picked.length === available.length ? [] : available)}
              className="text-[10px] px-2.5 py-1 rounded-full"
              style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
            >
              {isFull ? "إلغاء الكل" : "الفاتورة كاملة"}
            </button>
            <span className="flex-1" />
            {picked.length > 0 && (
              <span style={{ color: "var(--bad)" }} className="text-xs font-bold">
                {currency}{fmt(refund, 2)}
              </span>
            )}
          </div>

          {picked.length > 0 && (
            <>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
                {isFull ? "إرجاع كامل" : `إرجاع جزئي — ${picked.length} من ${lines.length}`}
                {" · "}تعود القطع للمخزون بتكلفتها الأصلية.
              </p>

              <Field label="من أين يُردّ المبلغ؟">
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "daily", label: "الصندوق اليومي" },
                    { id: "safe", label: "الخزنة" },
                    { id: "credit", label: "خصم من دينه" },
                  ].map((o) => (
                    <button key={o.id} onClick={() => setSource(o.id)}
                      className="py-2 rounded-xl text-[11px] font-bold"
                      style={{
                        background: source === o.id ? "var(--accentBg)" : "var(--panel)",
                        color: source === o.id ? "var(--accent)" : "var(--text2)",
                        border: "1px solid var(--line)",
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
                {source === "credit" && !sale.customerId && (
                  <p style={{ color: "var(--bad)" }} className="text-[10px] mt-1">
                    ⚠ الفاتورة بلا عميل — لا يمكن الخصم من دين.
                  </p>
                )}
              </Field>

              <Field label="سبب الإرجاع">
                <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="عيب · مقاس · عدول العميل" />
              </Field>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setMode(null); setPicked([]); setNote(""); }}
              className="py-2.5 rounded-xl text-xs font-bold"
              style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
              إلغاء
            </button>
            <button
              disabled={!picked.length || (source === "credit" && !sale.customerId)}
              onClick={() => {
                onReturn(sale.id, picked, source, note);
                setMode(null); setPicked([]); setNote("");
                onClose();
              }}
              className="py-2.5 rounded-xl text-xs font-bold"
              style={{
                background: picked.length && !(source === "credit" && !sale.customerId) ? "var(--bad)" : "var(--accentBg)",
                color: picked.length && !(source === "credit" && !sale.customerId) ? "var(--bg)" : "var(--text3)",
              }}
            >
              {isFull ? "إرجاع الفاتورة" : `إرجاع ${picked.length}`}
            </button>
          </div>
        </Card>
      )}
    </ModalShell>
  );
}

export { SaleDetailModal };
