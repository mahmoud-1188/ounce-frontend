import React, { useState } from "react";
import { Landmark } from "lucide-react";
import { KARATS, fmtMoney, fmtW } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

/// مكتب التسكير كالبنك: ذهبٌ لنا محفوظٌ عنده (1240) بوزنه وتكلفته — شراءٌ وإيداع، سحبٌ للخزنة، سداد مورد منه.
/// holdings من سطور المكتب بنوع hold: [{ karat, weight, cost }]
function holdingsOf(tx = []) {
  const by = {};
  for (const t of tx) {
    if (t.kind !== "hold") continue;
    const k = Number(t.karat) || 24;
    const s = t.type === "debit" ? 1 : -1;
    by[k] = by[k] || { karat: k, weight: 0, cost: 0 };
    by[k].weight += s * (Number(t.weight) || 0);
    by[k].cost += s * (Number(t.amount) || 0);
  }
  return Object.values(by).filter((h) => h.weight > 0.0005).sort((a, b) => b.karat - a.karat);
}

const ACTIONS = [
  { id: "buy", label: "شراء وإيداع", hint: "ذهبٌ لنا عنده" },
  { id: "withdraw", label: "سحب للخزنة", hint: "بتكلفته" },
  { id: "to_supplier", label: "سداد مورد", hint: "من ذهبنا عنده" },
];

function OfficeHoldingsCard({ tx = [], suppliers = [], currency = "ر.س", price24 = 0, canManage = false, onHold }) {
  const holdings = holdingsOf(tx);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const held = form ? holdings.find((h) => h.karat === Number(form.karat)) : null;
  const w = Number(form?.weight) || 0;
  const valid = form && w > 0 && (form.action === "buy" ? Number(form.price) > 0 : held && w <= held.weight + 0.0005)
    && (form.action !== "to_supplier" || form.supplierId);
  const submit = async () => {
    setBusy(true);
    try { if (await onHold(form)) setForm(null); } finally { setBusy(false); }
  };
  const chip = (on) => ({ background: on ? "var(--accentBg)" : "var(--panel)", color: on ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" });
  return (
    <div data-office-holdings>
    <Card style={{ padding: 12, marginBottom: 12 }}>
      <p style={{ color: "var(--accent)" }} className="text-[12px] font-bold flex items-center gap-1.5 mb-1"><Landmark size={14} /> ذهبنا عند المكتب</p>
      {holdings.length === 0 ? (
        <p style={{ color: "var(--text3)" }} className="text-[11px]">لا ذهب لنا محفوظٌ عنده — المكتب كالبنك: اشترِ واترك الذهب عنده، ثم اسحبه أو سدّد منه موردًا.</p>
      ) : holdings.map((h) => (
        <div key={h.karat} data-holding={h.karat} className="flex items-baseline justify-between text-[12px] py-0.5">
          <span style={{ color: "var(--text)" }}>عيار {h.karat} · <b>{fmtW(h.weight)} جم</b></span>
          <span style={{ color: "var(--text3)" }} className="text-[11px]">تكلفته {fmtMoney(h.cost)} {currency}</span>
        </div>
      ))}
      {canManage && (!form ? (
        <button type="button" data-hold-open onClick={() => setForm({ action: "buy", karat: 24, weight: "", price: price24 ? String(price24) : "", source: "safe_cash", supplierId: "" })}
          className="w-full mt-2 py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
          حركة على ذهبنا عند المكتب
        </button>
      ) : (
        <div className="mt-2">
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {ACTIONS.map((a) => (
              <button key={a.id} type="button" data-hold-action={a.id} onClick={() => set("action", a.id)} disabled={a.id !== "buy" && !holdings.length}
                className="py-2 rounded-xl text-[11px] font-bold" style={{ ...chip(form.action === a.id), opacity: a.id !== "buy" && !holdings.length ? 0.4 : 1 }}>
                {a.label}<span style={{ color: "var(--text3)" }} className="block text-[9px]">{a.hint}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="العيار">
              <select style={inputStyle} value={form.karat} onChange={(e) => set("karat", Number(e.target.value))}>
                {(form.action === "buy" ? KARATS : holdings.map((h) => h.karat)).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
            <Field label="الوزن (جم)"><NumericInput value={form.weight} onChange={(v) => set("weight", v)} placeholder={held ? fmtW(held.weight) : "0.000"} /></Field>
          </div>
          {form.action === "buy" && (
            <>
              <Field label={`سعر الجرام (${currency})`}><NumericInput value={form.price} onChange={(v) => set("price", v)} placeholder="0.00" /></Field>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {[["safe_cash", "الخزنة نقدي"], ["safe_network", "الخزنة شبكة"], ["deferred", "آجل للمكتب"]].map(([id, label]) => (
                  <button key={id} type="button" data-hold-source={id} onClick={() => set("source", id)} className="py-2 rounded-xl text-[11px] font-bold" style={chip(form.source === id)}>{label}</button>
                ))}
              </div>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">الثمن {fmtMoney(w * (Number(form.price) || 0))} {currency} — أصلٌ لنا عند المكتب لا مشتريات{form.source === "deferred" ? "، ودَينٌ للمكتب يُسدَّد من «سداد المكتب»" : ""}.</p>
            </>
          )}
          {form.action === "to_supplier" && (
            <Field label="المورد">
              <select style={inputStyle} value={form.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
                <option value="">اختر المورد…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          {form.action !== "buy" && held && <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">يخرج بتكلفته ≈ {fmtMoney((held.cost / held.weight) * w)} {currency}{form.action === "withdraw" ? " ويدخل خزنتنا كسرًا" : " ويُنقص دين المورد بوزنه الصافي"}.</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setForm(null)} className="py-2.5 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
            <button type="button" data-hold-confirm disabled={!valid || busy} onClick={submit} className="py-2.5 rounded-xl text-xs font-bold"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)", opacity: !valid || busy ? 0.5 : 1 }}>تثبيت</button>
          </div>
        </div>
      ))}
    </Card>
    </div>
  );
}

export { OfficeHoldingsCard, holdingsOf };
