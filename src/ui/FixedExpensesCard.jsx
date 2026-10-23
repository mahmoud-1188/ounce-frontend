import React, { useEffect, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { selectableExpenseCategories } from "../domain/customAccounts.js";
import { FUNDING_SOURCES } from "../core/workflow.js";
import { fmtMoney } from "../core/money.js";
import * as api from "../core/api.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

const ymNow = () => new Date().toISOString().slice(0, 7);
// المستحقّ: فعّالٌ وحلّ يومه هذا الشهر ولم يُسجَّل له
const isDue = (f, now = new Date()) => f.active && f.lastPosted !== ymNow() && now.getDate() >= f.day;
// تُقرأ وقت الرسم: الحسابات المخصّصة تُسجَّل بعد التحميل
const fixedCats = () => selectableExpenseCategories().filter((c) => !["salaries", "advance"].includes(c.id));

/// المصروفات الثابتة بمسمّيات المحل (الإيجار · الكهرباء · …): تُذكَّر بالمستحقّ وتُسجَّل بضغطة مصروفًا عاديًّا بحدوده واعتماده
function FixedExpensesCard({ currency = "ر.س", onAdd, flashToast }) {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState("");
  const load = () => api.fixedExpensesApi.list().then((r) => setList(r.fixed || [])).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const save = async () => {
    setBusy("save");
    try {
      if (form.id) await api.fixedExpensesApi.update(form.id, form);
      else await api.fixedExpensesApi.create(form);
      setForm(null); load();
    } catch (e) {
      const code = e?.body?.error;
      flashToast?.({ duplicate_name: "الاسم موجود — اختر اسمًا آخر", invalid_day: "اليوم من 1 إلى 28", invalid_amount: "المبلغ غير صالح", name_required: "اكتب الاسم" }[code] || "تعذّر حفظ المصروف الثابت");
    } finally { setBusy(""); }
  };
  const post = async (f) => {
    setBusy(f.id);
    try {
      const rec = await onAdd?.({ category: f.category, amount: f.amount, name: f.name, recurring: true, fundingSource: f.fundingSource, note: f.note, fixedId: f.id });
      if (rec) load();
    } finally { setBusy(""); }
  };
  if (!list) return null;
  const due = list.filter((f) => isDue(f));
  return (
    <Card style={{ padding: 12, marginBottom: 12 }} data-fixed-expenses>
      <div className="flex items-center justify-between mb-2">
        <p style={{ color: "var(--accent)", margin: 0 }} className="text-xs font-bold flex items-center gap-1"><CalendarClock size={14} /> المصروفات الثابتة{due.length ? ` · ${due.length} مستحق` : ""}</p>
        <button type="button" data-fixed-add onClick={() => setForm({ name: "", category: fixedCats()[0]?.id || "rent", amount: "", day: "1", fundingSource: FUNDING_SOURCES[0].id, note: "" })}
          className="text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1" style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
          <Plus size={12} /> قالب جديد
        </button>
      </div>
      {list.length === 0 && !form && <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">أضف الإيجار والفواتير بأسمائك — يُذكَّر بها كل شهر في يومها وتُسجَّل بضغطة.</p>}
      {list.map((f) => {
        const d = isDue(f), done = f.lastPosted === ymNow();
        return (
          <div key={f.id} data-fixed={f.id} className="flex items-center gap-2 py-1.5" style={{ borderTop: "1px solid var(--line)", opacity: f.active ? 1 : 0.5 }}>
            <button type="button" className="flex-1 min-w-0 text-right" onClick={() => setForm({ ...f, amount: String(f.amount), day: String(f.day) })}>
              <span style={{ color: "var(--text)" }} className="text-[12px] font-bold block truncate">{f.name}</span>
              <span style={{ color: "var(--text3)" }} className="text-[11px]">يوم {f.day} · {fmtMoney(f.amount)} {currency}{done ? " · ✓ سُجّل هذا الشهر" : d ? " · مستحق" : ""}</span>
            </button>
            {d && (
              <button type="button" data-fixed-post={f.id} disabled={busy === f.id} onClick={() => post(f)} className="text-[11px] px-3 py-1.5 rounded-full font-bold"
                style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
                {busy === f.id ? "…" : "سجّل"}
              </button>
            )}
          </div>
        );
      })}
      {form && (
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
          <Field label="الاسم (كما تريده)"><input style={inputStyle} value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="إيجار المحل" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="المبلغ"><NumericInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="0" /></Field>
            <Field label="يوم الاستحقاق (1–28)"><NumericInput value={form.day} onChange={(v) => setForm({ ...form, day: v })} placeholder="1" /></Field>
            <Field label="التصنيف">
              <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {fixedCats().map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="الدفع من">
              <select style={inputStyle} value={form.fundingSource} onChange={(e) => setForm({ ...form, fundingSource: e.target.value })}>
                {FUNDING_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          {form.id && (
            <label className="flex items-center gap-2 text-[11px] mb-2" style={{ color: "var(--text2)" }}>
              <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> فعّال
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setForm(null)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
            <button type="button" data-fixed-save onClick={save} disabled={busy === "save"} className="py-2 rounded-xl text-xs font-bold"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>{busy === "save" ? "…" : "حفظ القالب"}</button>
          </div>
        </div>
      )}
    </Card>
  );
}

export { FixedExpensesCard };
