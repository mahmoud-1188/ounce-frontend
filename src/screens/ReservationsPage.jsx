import React, { useState } from "react";
import { BookmarkCheck, Plus } from "lucide-react";
import { fmt } from "../core/money.js";
import { inputStyle, itemLabel } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function ReservationsPage({ reservations, customers, activeItems, currency, canManage, onAdd, onCancel, onBack }) {
  const [showAdd, setShowAdd] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [itemId, setItemId] = useState("");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState("cash");

  const open = reservations.filter((r) => r.status === "open");
  const held = open.reduce((a, r) => a + (Number(r.deposit) || 0), 0);
  const valid = customerId && Number(total) > 0 && Number(deposit) > 0 && Number(deposit) <= Number(total);

  return (
    <div>
      <SubPageHeader title="الحجوزات والعربون" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
          العميل يدفع عربونًا ويستلم لاحقًا. البضاعة تبقى في مخزونك والمبلغ التزام عليك — لا إيراد حتى التسليم.
        </p>

        {open.length > 0 && (
          <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-1">عرابين محتجزة</p>
            <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--accent)" }} className="text-2xl font-extrabold">
              {currency}{fmt(held, 0)}
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">{open.length} حجز قائم — التزام حتى التسليم أو الإلغاء</p>
          </Card>
        )}

        {canManage &&
          (!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              disabled={customers.length === 0}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-4"
              style={{
                background: customers.length ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                color: customers.length ? "var(--panel)" : "var(--text3)",
              }}
            >
              <Plus size={17} /> {customers.length ? "حجز جديد" : "أضف عميلًا أولًا"}
            </button>
          ) : (
            <Card style={{ padding: 14, marginBottom: 16 }}>
              <Field label="العميل (إجباري)">
                <select style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">اختر العميل...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ""}</option>
                  ))}
                </select>
              </Field>
              <Field label="القطعة المحجوزة (اختياري)">
                <select style={inputStyle} value={itemId} onChange={(e) => setItemId(e.target.value)}>
                  <option value="">بلا قطعة محددة</option>
                  {activeItems.slice(0, 200).map((it) => (
                    <option key={it.id} value={it.id}>{itemLabel(it)}</option>
                  ))}
                </select>
              </Field>
              <Field label="الوصف (اختياري)">
                <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="مثال: طقم عيار 21 بالطلب" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`السعر المتفق (${currency})`}>
                  <NumericInput value={total} onChange={setTotal} />
                </Field>
                <Field label={`العربون (${currency})`}>
                  <NumericInput value={deposit} onChange={setDeposit} />
                </Field>
              </div>
              {Number(deposit) > Number(total) && Number(total) > 0 && (
                <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">العربون أكبر من السعر المتفق.</p>
              )}
              <Field label="استلام العربون">
                <div className="grid grid-cols-2 gap-2">
                  {[{ id: "cash", label: "نقدي" }, { id: "network", label: "شبكة" }].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className="py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: method === m.id ? "var(--accentBg)" : "var(--panel)", color: method === m.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Field>
              {Number(total) > 0 && Number(deposit) > 0 && (
                <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
                  المتبقي عند التسليم: {currency}{fmt(Number(total) - Number(deposit), 0)}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowAdd(false)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                  إلغاء
                </button>
                <button
                  disabled={!valid}
                  onClick={() => {
                    onAdd({ customerId, itemId: itemId || null, description, total: Number(total), deposit: Number(deposit), method });
                    setCustomerId(""); setItemId(""); setDescription(""); setTotal(""); setDeposit(""); setShowAdd(false);
                  }}
                  className="py-2 rounded-xl text-xs font-bold"
                  style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
                >
                  حفظ الحجز
                </button>
              </div>
            </Card>
          ))}

        {reservations.length === 0 ? (
          <EmptyState icon={<BookmarkCheck size={36} color="var(--accentText)" />} title="لا حجوزات" sub="سجّل أول حجز بعربون" />
        ) : (
          <div className="flex flex-col gap-2">
            {reservations.map((r) => (
              <Card key={r.id} style={{ padding: 12, border: r.status === "open" ? "1px solid var(--accentLine)" : "1px solid var(--line)" }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                    {r.customerName}
                    <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{r.ref}</span>
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--panel)",
                      color: r.status === "open" ? "var(--accent)" : r.status === "cancelled" ? "var(--bad)" : "var(--goodSolid)",
                    }}
                  >
                    {r.status === "open" ? "قائم" : r.status === "cancelled" ? "ملغى" : "مُسلَّم"}
                  </span>
                </div>
                <p style={{ color: "var(--text2)" }} className="text-[11px] mt-0.5">
                  {r.description || "—"} · السعر {currency}{fmt(r.total, 0)} · عربون {currency}{fmt(r.deposit, 0)}
                </p>
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                  المتبقي {currency}{fmt(r.remaining, 0)} · {new Date(r.date).toLocaleDateString("en-GB")}
                  {r.createdBy ? ` · ${r.createdBy}` : ""}
                </p>
                {r.status === "open" && canManage && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => onCancel(r.id, true)}
                      className="py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
                    >
                      إلغاء وإرجاع العربون
                    </button>
                    <button
                      onClick={() => onCancel(r.id, false)}
                      className="py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
                    >
                      إلغاء واحتجاز العربون
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// اليومية — ملخص الحركة اليومية على صفحة واحدة
//
// تخطيط دفتر المحل الورقي: حركة الريال يمينًا، البيان وسطًا، حركة الكسر
// يسارًا، والأرصدة أسفل. الغرض ورقة واحدة تُقرأ وتُوقَّع وتُحفظ — لا
// شاشة تُتصفَّح.
// ============================================================

export { ReservationsPage };
