import React, { useState } from "react";
import { Loader2, Package } from "lucide-react";
import { PURITY, fmt, fmtMoney, fmtW } from "../core/money.js";
import { CARD_NETWORKS } from "../core/money-rules.js";
import { cardFeeOf, categoryLabel, inputStyle, marginFor, r3 } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";

/// أطقمٌ على الرفّ يُباع منها جزء: تصنيفها «طقم» (أو لها مكوّنات)، وحدتها مملوكة، وليست بقايا.
const isSellableSet = (it, categories) => {
  const cat = categories.find((c) => c.id === it.categoryId);
  return (cat?.saleMode === "set" || (it.setParts || []).length > 0) && !it.remnant
    && (Number(it.weight) || 0) > 0.0005 && (it.units || []).some((u) => !u.sold && !u.issued);
};

/// بيع جزءٍ من طقم (المرجع 5.2.0): الجزء بوزنه (أقلّ من الطقم) ويُسعَّر بالجرام كأيّ سطر ذهب —
/// العيار · نصيب المصنعية · الهامش · الضريبة. والباقي «بقايا طقم» مملوكٌ بوزنه حتى يُكوَّد.
function SetPartSaleModal({ items, categories, customers, currency, price24, settings, onClose, onConfirm }) {
  const sets = items.filter((it) => isSellableSet(it, categories));
  const [itemId, setItemId] = useState(sets.length === 1 ? sets[0].id : "");
  const [part, setPart] = useState("");
  const [weight, setWeight] = useState("");
  const [price, setPrice] = useState("");
  const [method, setMethod] = useState("cash");
  const [network, setNetwork] = useState("mada");
  const [customerId, setCustomerId] = useState("");
  const [taxOn, setTaxOn] = useState(settings?.taxEnabled !== false);
  const [busy, setBusy] = useState(false);

  const item = sets.find((it) => it.id === itemId);
  const available = Number(item?.weight) || 0;
  const w = Number(weight) || 0;
  const purity = item ? PURITY[item.karat] || item.karat / 24 : 0;
  const metal = w * purity * (price24 || 0);
  const wmShare = available > 0 ? (Number(item?.workmanshipPerUnit) || 0) * (w / available) : 0;
  const m = item ? marginFor(settings, item.karat) : { perGram: 0, fixed: 0 };
  const base = metal + wmShare + w * m.perGram + m.fixed;
  const taxRate = taxOn ? Number(settings?.taxRate) || 0 : 0;
  const suggested = base * (1 + taxRate);
  const entered = Number(price) || 0;
  const tooHeavy = item && w >= available - 0.0005;
  const valid = !!item && !!part.trim() && w > 0 && !tooHeavy && entered > 0 && !(method === "credit" && !customerId) && !busy;

  const submit = async () => {
    setBusy(true);
    try {
      const ok = await onConfirm({
        itemId: item.id, partLabel: part.trim(), partWeight: w, total: entered, paymentMethod: method,
        cardNetwork: method === "card" ? network : null, customerId: customerId || null, taxApplicable: taxOn, price24Snapshot: price24,
      });
      if (ok) onClose();
    } finally { setBusy(false); }
  };

  const chip = (on) => ({ background: on ? "var(--accentBg)" : "var(--panel)", color: on ? "var(--accent)" : "var(--text2)", border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}` });

  return (
    <ModalShell title="بيع جزء من طقم" onClose={onClose}>
      {sets.length === 0 ? (
        <EmptyState icon={<Package size={32} color="var(--accentText)" />} title="لا أطقم على الرفّ"
          sub="الطقم يُكوَّد بتصنيف «طقم» ومكوّناته — ثم يُباع منه جزء" />
      ) : (
        <>
          <Field label="الطقم">
            <select style={inputStyle} value={itemId} onChange={(e) => { setItemId(e.target.value); setPart(""); setWeight(""); setPrice(""); }}>
              <option value="">اختر...</option>
              {sets.map((it) => (
                <option key={it.id} value={it.id}>
                  {(it.units || [])[0]?.code || it.ref} · {categoryLabel(it.categoryId)} · عيار {it.karat} · {fmtW(it.weight)} جم
                </option>
              ))}
            </select>
          </Field>

          {item && (
            <>
              <Field label="الجزء المباع">
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {(item.setParts || []).map((p, i) => (
                    <button key={`${p.label}_${i}`} onClick={() => { setPart(p.label); if (p.weight) setWeight(String(p.weight)); }}
                      className="text-[11px] px-2.5 py-1 rounded-full" style={chip(part === p.label)}>
                      {p.label}{p.weight ? ` · ${fmtW(p.weight)} جم` : ""}
                    </button>
                  ))}
                </div>
                <input style={inputStyle} value={part} onChange={(e) => setPart(e.target.value)} placeholder="أو اكتب اسم الجزء" />
              </Field>

              <Field label={`وزن الجزء (جم) — أقلّ من ${fmtW(available)}`}>
                <NumericInput value={weight} onChange={setWeight} placeholder="0.000" />
              </Field>
              {tooHeavy && (
                <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">الجزء أقلّ من الطقم — بيع الطقم كلّه من «فاتورة بيع جديدة».</p>
              )}
              {w > 0 && !tooHeavy && (
                <Card style={{ padding: 10, marginBottom: 12, background: "var(--bg)" }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">يبقى «بقايا طقم» للتكويد</span>
                    <span style={{ color: "var(--goodSolid)" }} className="text-sm font-bold">{fmtW(r3(available - w))} جم</span>
                  </div>
                </Card>
              )}

              <label className="text-[11px] flex items-center gap-2 mb-2" style={{ color: "var(--text2)" }}>
                <input type="checkbox" checked={taxOn} onChange={(e) => setTaxOn(e.target.checked)} /> السعر شامل الضريبة ({fmt(taxRate * 100, 0)}٪)
              </label>
              <Field label={`السعر الإجمالي (${currency})`}>
                <NumericInput value={price} onChange={setPrice} placeholder="السعر" />
                {w > 0 && !tooHeavy && (
                  <button onClick={() => setPrice(suggested.toFixed(2))} className="text-[10px] px-2 py-1 rounded-full mt-1.5"
                    style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--line)" }}>
                    المقترح {fmtMoney(suggested)} — معدن {fmtMoney(metal)}{wmShare > 0 ? ` + مصنعية ${fmtMoney(wmShare)}` : ""}
                  </button>
                )}
              </Field>

              <Field label="طريقة الدفع">
                <div className="grid grid-cols-3 gap-2">
                  {[{ id: "cash", label: "نقدي" }, { id: "card", label: "شبكة" }, { id: "credit", label: "آجل" }].map((o) => (
                    <button key={o.id} onClick={() => setMethod(o.id)} className="py-2 rounded-xl text-[11px] font-bold" style={chip(method === o.id)}>{o.label}</button>
                  ))}
                </div>
              </Field>
              {method === "card" && (
                <Field label="الشبكة">
                  <select style={inputStyle} value={network} onChange={(e) => setNetwork(e.target.value)}>
                    {CARD_NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.label} — {fmt(cardFeeOf(settings, n.id), 2)}٪</option>)}
                  </select>
                </Field>
              )}
              {method === "credit" && (
                <Field label="العميل">
                  <select style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">اختر...</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              )}

              <button disabled={!valid} onClick={submit} className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}>
                {busy && <Loader2 size={14} className="animate-spin" />} بيع {part || "الجزء"}{entered > 0 ? ` — ${fmtMoney(entered)} ${currency}` : ""}
              </button>
            </>
          )}
        </>
      )}
    </ModalShell>
  );
}

export { SetPartSaleModal, isSellableSet };
