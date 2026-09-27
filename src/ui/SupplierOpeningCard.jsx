import React, { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { KARATS, fine24, fmt, fmtW, roundMoney2, roundW } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

/// الرصيد الافتتاحي للمورد (المرجع 5.2.0): ذهبٌ أو نقد، علينا له أو لنا عنده.
///   يُرحَّل على الخادم: علينا → 3100/2110 (ذهب) أو 3100/2120 (نقد) · لنا عنده → 1320/3100
function SupplierOpeningCard({ supplier, openings = [], price24 = 0, currency = "ر.س", canManage = false, onAdd, onVoid }) {
  const mine = openings.filter((o) => o.supplierId === supplier.id && !o.voided);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "gold", side: "owed", karat: 21, weight: "", amount: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const fine = f.kind === "gold" ? roundW(fine24(Number(f.weight) || 0, Number(f.karat) || 21)) : 0;
  // الذهب يُقيَّم بسعر اليوم افتراضيًّا — 2110 بالعملة، والوزن يبقى في كشف المورد
  const suggested = f.kind === "gold" && price24 > 0 ? roundMoney2(fine * price24) : 0;
  const amount = Number(f.amount) || suggested;
  const valid = amount > 0 && (f.kind === "cash" || Number(f.weight) > 0);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setErr("");
    try {
      await onAdd(supplier.id, { kind: f.kind, side: f.side, karat: Number(f.karat), weight: Number(f.weight) || 0, amount, note: f.note });
      setF({ kind: f.kind, side: f.side, karat: f.karat, weight: "", amount: "", note: "" });
      setOpen(false);
    } catch (e) {
      setErr(e?.message || "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  if (!mine.length && !canManage) return null;
  const chip = (on) => ({ background: on ? "var(--accentBg)" : "var(--panel)", color: on ? "var(--accent)" : "var(--text2)", border: "1px solid var(--edge)" });
  return (
    <Card style={{ padding: 12, marginBottom: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <p style={{ color: "var(--text)", margin: 0 }} className="text-xs font-bold">الرصيد الافتتاحي</p>
        {canManage && !open && (
          <button onClick={() => setOpen(true)} className="px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1" style={chip(true)}>
            <Plus size={12} /> أضف رصيدًا
          </button>
        )}
      </div>
      {mine.length === 0 && !open && <p style={{ color: "var(--text3)" }} className="text-[11px]">لا رصيد افتتاحي لهذا المورد.</p>}
      {mine.map((o) => (
        <div key={o.id} className="flex items-center gap-2 py-1.5" style={{ borderTop: "1px solid var(--line)" }}>
          <span className="text-[11px] font-bold flex-1" style={{ color: o.side === "owed" ? "var(--bad)" : "var(--good)" }}>
            {o.kind === "gold" ? `ذهب ${fmtW(o.weight)} جم عيار ${o.karat} (${fmtW(o.fineWeight)} جم24)` : "نقد"} · {o.side === "owed" ? "علينا له" : "لنا عنده"} · {currency}{fmt(o.amount, 2)}
            {o.note ? <span style={{ color: "var(--text3)", fontWeight: 400 }}> · {o.note}</span> : null}
          </span>
          {canManage && onVoid && (
            <button aria-label="إلغاء الرصيد" onClick={() => { if (window.confirm("إلغاء هذا الرصيد الافتتاحي؟ يُعكس قيده.")) onVoid(o.id); }}>
              <X size={14} color="var(--text3)" />
            </button>
          )}
        </div>
      ))}
      {open && (
        <div className="space-y-2 mt-2">
          <div className="flex gap-1 flex-wrap">
            {[["gold", "ذهب"], ["cash", "نقد"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => set("kind", k)} className="px-3 py-1 rounded-lg text-[11px] font-bold" style={chip(f.kind === k)}>{l}</button>
            ))}
            <span style={{ width: 8 }} />
            {[["owed", "علينا له"], ["due", "لنا عنده"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => set("side", k)} className="px-3 py-1 rounded-lg text-[11px] font-bold" style={chip(f.side === k)}>{l}</button>
            ))}
          </div>
          {f.kind === "gold" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="العيار">
                <select style={inputStyle} value={f.karat} onChange={(e) => set("karat", Number(e.target.value))}>
                  {KARATS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </Field>
              <Field label="الوزن (جم)">
                <NumericInput value={f.weight} onChange={(v) => set("weight", v)} placeholder="0.000" />
              </Field>
            </div>
          )}
          <Field label={f.kind === "gold" ? `القيمة (${currency}) — افتراضيًّا بسعر اليوم` : `المبلغ (${currency})`}>
            <NumericInput value={f.amount} onChange={(v) => set("amount", v)} placeholder={suggested ? String(suggested) : "0.00"} />
          </Field>
          <Field label="ملاحظة (اختياري)">
            <input style={inputStyle} value={f.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
          {f.kind === "gold" && fine > 0 && (
            <p style={{ color: "var(--accentText)" }} className="text-[11px]">بعيار 24: {fmtW(fine)} جم · يدخل كشف المورد وزنًا، ويُرحَّل {currency}{fmt(amount, 2)} على {f.side === "owed" ? "2110" : "1320"}</p>
          )}
          {err && <p style={{ color: "var(--bad)" }} className="text-[11px]">{err}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setOpen(false); setErr(""); }} className="py-2 rounded-xl text-xs font-bold" style={chip(false)}>إلغاء</button>
            <button onClick={submit} disabled={!valid || busy} className="py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)", opacity: valid && !busy ? 1 : 0.5 }}>
              {busy && <Loader2 size={13} className="animate-spin" />} احفظ الرصيد
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

export { SupplierOpeningCard };
