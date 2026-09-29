import React, { useState } from "react";
import { Gem, Loader2, Plus, Trash2 } from "lucide-react";
import * as api from "../core/api.js";
import { fmtW } from "../core/money.js";
import { categoryLabel, inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { NumericInput } from "./NumericInput.jsx";

const mg = (x) => Math.round((Number(x) || 0) * 1000);

/// تكويد بقايا طقم: قطعٌ مجموع أوزانها وزنُ البقايا بالضبط — الخادم يرفض غيره (المرجع 5.2.0: RemnantCodingForm).
function RemnantCodingForm({ item, categories, onDone, onCancel, flashToast }) {
  const [rows, setRows] = useState(() => (item.setParts || []).length
    ? item.setParts.map((p) => ({ categoryId: "", weight: p.weight ? String(p.weight) : "", hint: p.label }))
    : [{ categoryId: "", weight: String(item.weight), hint: "" }]);
  const [busy, setBusy] = useState(false);
  const sum = rows.reduce((a, r) => a + mg(r.weight), 0);
  const diff = mg(item.weight) - sum;
  const valid = rows.length > 0 && rows.every((r) => r.categoryId && mg(r.weight) > 0) && diff === 0 && !busy;
  const set = (i, k, v) => setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = async () => {
    setBusy(true);
    try {
      const res = await api.codeRemnant(item.id, rows.map((r) => ({ categoryId: r.categoryId, weight: Number(r.weight) })));
      flashToast?.(`كُوِّدت البقايا ${res.items.length} قطعة: ${res.items.map((x) => x.code).join(" · ")}`);
      onDone?.();
    } catch (e) {
      flashToast?.(e?.body?.error === "weights_must_equal_remnant" ? "مجموع الأوزان لا يساوي وزن البقايا" : "تعذّر تكويد البقايا");
    } finally { setBusy(false); }
  };
  return (
    <div className="mt-2 flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={i} className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 90px 32px" }}>
          <select style={inputStyle} value={r.categoryId} onChange={(e) => set(i, "categoryId", e.target.value)}>
            <option value="">{r.hint ? `${r.hint} — التصنيف…` : "التصنيف…"}</option>
            {categories.filter((c) => c.saleMode !== "partial").map((c) => <option key={c.id} value={c.id}>{c.label || c.name || categoryLabel(c.id)}</option>)}
          </select>
          <NumericInput value={r.weight} onChange={(v) => set(i, "weight", v)} placeholder="جم" style={{ marginBottom: 0 }} />
          <button onClick={() => setRows((p) => p.filter((_, j) => j !== i))} disabled={rows.length === 1} aria-label="احذف"
            className="rounded-lg flex items-center justify-center" style={{ background: "var(--field)", border: "1px solid var(--edge)", opacity: rows.length === 1 ? 0.4 : 1 }}>
            <Trash2 size={14} color="var(--text2)" />
          </button>
        </div>
      ))}
      <button onClick={() => setRows((p) => [...p, { categoryId: "", weight: diff > 0 ? String(diff / 1000) : "", hint: "" }])}
        className="text-[11px] py-1.5 rounded-lg flex items-center justify-center gap-1" style={{ background: "var(--field)", color: "var(--text2)", border: "1px dashed var(--edge)" }}>
        <Plus size={12} /> قطعة
      </button>
      <p className="text-[11px]" style={{ color: diff === 0 ? "var(--good)" : "var(--bad)", margin: 0 }}>
        المجموع {fmtW(sum / 1000)} من {fmtW(item.weight)} جم{diff !== 0 ? ` — ${diff > 0 ? "ينقص" : "يزيد"} ${fmtW(Math.abs(diff) / 1000)} جم` : " ✓"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
        <button onClick={save} disabled={!valid} className="py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
          style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)", opacity: valid ? 1 : 0.5 }}>
          {busy && <Loader2 size={12} className="animate-spin" />} كوّد القطع
        </button>
      </div>
    </div>
  );
}

/// «بقايا أطقم للتكويد» — أوّل شاشة التكويد: ما بقي من طقمٍ بِيع جزءٌ منه، مملوكٌ بوزنه حتى يُكوَّد قطعًا.
function SetRemnantsCard({ items = [], categories = [], onCoded, flashToast }) {
  const [open, setOpen] = useState(null);
  const remnants = items.filter((it) => it.remnant && (it.units || []).some((u) => !u.sold && !u.issued));
  if (!remnants.length) return null;
  return (
    <div className="px-4 pt-3">
      <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
        <div className="flex items-center gap-2">
          <Gem size={16} color="var(--accent)" />
          <p className="text-sm font-bold flex-1" style={{ color: "var(--text)", margin: 0 }}>بقايا أطقم للتكويد ({remnants.length})</p>
        </div>
        <p className="text-[11px]" style={{ color: "var(--text2)", margin: "4px 0 6px" }}>
          ما بقي من طقمٍ بِيع جزءٌ منه — مملوكٌ بوزنه وتكلفته، ولا يُباع حتى يُكوَّد قطعًا مجموع أوزانها وزنه.
        </p>
        {remnants.map((it) => (
          <div key={it.id} className="py-2" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--text)", margin: 0 }}>{(it.units || [])[0]?.code || it.ref}</p>
                <p className="text-[11px]" style={{ color: "var(--text3)", margin: 0 }}>
                  عيار {it.karat} · {fmtW(it.weight)} جم{(it.setParts || []).length ? ` · ${it.setParts.map((p) => p.label).join(" · ")}` : ""}
                </p>
              </div>
              {open !== it.id && (
                <button onClick={() => setOpen(it.id)} className="text-[11px] px-3 py-1.5 rounded-full font-bold"
                  style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>كوّد</button>
              )}
            </div>
            {open === it.id && (
              <RemnantCodingForm item={it} categories={categories} flashToast={flashToast}
                onCancel={() => setOpen(null)} onDone={() => { setOpen(null); onCoded?.(); }} />
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

export { SetRemnantsCard };
