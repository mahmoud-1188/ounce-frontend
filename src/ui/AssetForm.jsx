import React, { useState } from "react";
import { ASSET_CLASSES, DEPRECIATION_METHODS } from "../core/erp.js";
import { fmtMoney } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { monthlyDepreciation } from "../domain/monthlyDepreciation.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

/**
 * منقول عن AssetForm.js المرجعي حرفيًا في الشكل، بفرقين حقيقيين يطابقان
 * أن هذا النموذج الآن يرسل لباك إند فعلي لا يحفظ محليًا فقط:
 *
 * 1) onSave أصبح async — الزر يعرض "جارٍ الحفظ…" ولا يُغلق النموذج إلا
 *    بعد نجاح فعلي، ويعرض رسالة خطأ لو رفض الخادم (فئة غير صالحة، إلخ)
 *    بدل الإغلاق الصامت الذي كان يفترضه `onSave` المحلي البحت.
 * 2) `supplier`/`note` المرجعيان غير مُرسَلين: لا عمود لهما في
 *    fixed_assets حاليًا (لا حقل مورّد/ملاحظة في الجدول) — أُبقيا في
 *    النموذج لأنهما موجودان بصريًا في تجربة المستخدم المرجعية، لكنهما
 *    غير مُرسَلين فعليًا حتى تُضاف الأعمدة لاحقًا لو احتاج المستخدم ذلك.
 */
function AssetForm({ currency, onCancel, onSave }) {
  const [f, setF] = useState({
    classId: "display", name: "", cost: "", years: "", salvagePct: "", method: "straight",
    inServiceDate: new Date().toISOString().slice(0, 10), paid: true, source: "safe_cash",
    supplier: "", note: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const cls = ASSET_CLASSES.find((c) => c.id === f.classId);
  const years = Number(f.years) || cls.years;
  const salvage = f.salvagePct === "" ? cls.salvagePct : Number(f.salvagePct);
  const monthly = Number(f.cost) > 0 ? monthlyDepreciation({ cost: Number(f.cost), salvagePct: salvage, years, method: f.method }, 0) : 0;
  const valid = Number(f.cost) > 0 && !saving;

  async function submit() {
    setError("");
    setSaving(true);
    const payload = {
      classId: f.classId,
      name: f.name.trim() || cls.label,
      cost: Number(f.cost),
      purchasedAt: f.inServiceDate,
      // ⚠ null صريح (لا "") حين لم يُخصَّص المستخدم شيئًا — الباك إند
      // يعامل null كـ"اتّبع الفئة"، بخلاف 0 وهي قيمة صالحة فعلًا.
      years: f.years === "" ? null : Number(f.years),
      salvagePct: f.salvagePct === "" ? null : Number(f.salvagePct),
      method: f.method,
      fundingSource: f.paid ? f.source : "deferred",
    };
    const ok = await onSave(payload);
    setSaving(false);
    if (!ok) setError("تعذّر حفظ الأصل — تحقّق من البيانات");
  }

  return (
    <div>
      <Field label="الفئة">
        <select style={inputStyle} value={f.classId} onChange={(e) => { set("classId")(e.target.value); set("years")(""); set("salvagePct")(""); }}>
          {ASSET_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label} — {c.years} سنة</option>)}
        </select>
      </Field>
      <Field label="الاسم"><input style={inputStyle} value={f.name} onChange={(e) => set("name")(e.target.value)} placeholder={cls.label} /></Field>
      <Field label={`التكلفة ${currency}`}><NumericInput value={f.cost} onChange={set("cost")} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={`العمر (سنوات) — ${cls.years}`}><NumericInput value={f.years} onChange={set("years")} /></Field>
        <Field label={`خردة ٪ — ${cls.salvagePct}`}><NumericInput value={f.salvagePct} onChange={set("salvagePct")} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {DEPRECIATION_METHODS.map((m) => (
          <button key={m.id} onClick={() => set("method")(m.id)} className="text-right rounded-xl p-2"
            style={{ background: f.method === m.id ? "var(--accentBg)" : "var(--field)", border: `1px solid ${f.method === m.id ? "var(--accentLine)" : "var(--line)"}` }}>
            <p style={{ color: f.method === m.id ? "var(--accent)" : "var(--text)", margin: 0 }} className="text-[11px] font-bold">{m.label}</p>
            <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px]">{m.hint}</p>
          </button>
        ))}
      </div>
      <Field label="بدء التشغيل"><input type="date" style={inputStyle} value={f.inServiceDate} onChange={(e) => set("inServiceDate")(e.target.value)} /></Field>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {[["safe_cash", "كاش", true], ["safe_network", "شبكة", true], ["deferred", "آجل", false]].map(([id, lbl, paid]) => {
          const on = paid ? (f.paid && f.source === id) : !f.paid;
          return (
            <button key={id} onClick={() => { set("paid")(paid); if (paid) set("source")(id); }} className="py-2 rounded-xl text-[11px] font-bold"
              style={{ background: on ? "var(--accentBg)" : "var(--field)", color: on ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{lbl}</button>
          );
        })}
      </div>
      {valid && (
        <Card style={{ padding: 10, background: "var(--field)", marginBottom: 8 }}>
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">الإهلاك الشهري الأول</p>
          <p style={{ color: "var(--accent)", margin: 0 }} className="text-[13px] font-bold">{currency}{fmtMoney(monthly)} × {years * 12} شهر</p>
        </Card>
      )}
      {error && <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[12px]" style={{ background: "var(--field)", color: "var(--text2)" }}>إلغاء</button>
        <button disabled={!valid} onClick={submit} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)", color: valid ? "var(--panel)" : "var(--text3)" }}>
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      </div>
    </div>
  );
}

export { AssetForm };
