import React, { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import * as api from "../core/api.js";
import { fmtMoney } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";

/// سلف الموظفين بالأقساط (migration 060): المبلغ والمسدَّد والقسط القادم — تُصرف السلفة من «المصروفات ← سلفة»
function LoansPanel({ currency = "ر.س" }) {
  const [loans, setLoans] = useState(null);
  useEffect(() => { api.payrollApi.loans().then((d) => setLoans(d.loans || [])).catch(() => setLoans([])); }, []);
  const m = (v) => `${currency}${fmtMoney(v)}`;
  if (!loans) return <div className="flex justify-center py-6"><Loader2 className="animate-spin" size={18} color="var(--accent)" /></div>;
  const open = loans.filter((l) => !l.settled);
  return (
    <>
      <Card style={{ padding: 12, marginBottom: 10 }}>
        <div className="flex justify-between text-xs"><span style={{ color: "var(--text2)" }}>سلفٌ مفتوحة</span><b style={{ color: "var(--text)" }}>{open.length}</b></div>
        <div className="flex justify-between text-xs"><span style={{ color: "var(--text2)" }}>المتبقّي على الموظفين</span><b style={{ color: "var(--accent)" }}>{m(open.reduce((s, l) => s + l.left, 0))}</b></div>
        <div className="flex justify-between text-xs"><span style={{ color: "var(--text2)" }}>يُخصم في المسيّر القادم</span><b style={{ color: "var(--text)" }}>{m(open.reduce((s, l) => s + l.installment, 0))}</b></div>
        <p className="text-[10px]" style={{ color: "var(--text3)", margin: "6px 0 0" }}>تُصرف السلفة من المصروفات بتصنيف «سلفة» مع عدد الأقساط، ويخصم كل مسيّر قسطًا حتى تُسدَّد.</p>
      </Card>
      {loans.length === 0 && <p className="text-[11px]" style={{ color: "var(--text3)" }}>لا سلف مسجّلة.</p>}
      {loans.map((l) => {
        const pct = l.amount > 0 ? Math.round((l.repaid / l.amount) * 100) : 0;
        return (
          <Card key={l.id} style={{ padding: 10, marginBottom: 6, opacity: l.settled ? 0.6 : 1 }}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold" style={{ color: "var(--text)" }}>{l.employeeName} · {l.ref}</span>
              <span className="text-[11px] font-bold" style={{ color: l.settled ? "var(--good)" : "var(--accent)" }}>{l.settled ? "سُدّدت" : `باقٍ ${m(l.left)}`}</span>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text2)", margin: "2px 0 0" }}>
              {m(l.amount)} على {l.installments} {l.installments > 1 ? "أقساط" : "دفعة"} · سُدّد {m(l.repaid)}{!l.settled ? ` · القسط القادم ${m(l.installment)}` : ""}
            </p>
            <div style={{ height: 4, background: "var(--field)", borderRadius: 3, marginTop: 4 }}>
              <div style={{ width: `${Math.min(100, pct)}%`, height: 4, borderRadius: 3, background: "var(--good)" }} />
            </div>
          </Card>
        );
      })}
    </>
  );
}

const CRIT = [["attendance", "الانضباط"], ["sales", "المبيعات"], ["conduct", "التعامل"], ["skill", "المهارة"]];
function Stars({ value, onChange, size = 16 }) {
  return (
    <div className="flex gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange?.(n)} aria-label={`${n}`} style={{ background: "none", border: 0, padding: 1, cursor: onChange ? "pointer" : "default" }}>
          <Star size={size} color="var(--accent)" fill={n <= value ? "var(--accent)" : "none"} />
        </button>
      ))}
    </div>
  );
}

/// تقييم الأداء الشهري (migration 060): درجةٌ عامة 1–5 ومعايير اختيارية وملاحظة — المدير يقيّم
function EvaluationsPanel({ staff = [], period, canManage }) {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = () => api.payrollApi.evaluations(period).then((d) => setList(d.evaluations || [])).catch(() => setList([]));
  useEffect(() => { setList(null); load(); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await api.payrollApi.saveEvaluation({ userId: edit.userId, period, score: edit.score, criteria: edit.criteria, note: edit.note });
      setMsg({ text: "حُفظ التقييم" }); setEdit(null); load();
    } catch { setMsg({ bad: true, text: "تعذّر الحفظ" }); } finally { setBusy(false); }
  };
  if (!list) return <div className="flex justify-center py-6"><Loader2 className="animate-spin" size={18} color="var(--accent)" /></div>;
  const by = Object.fromEntries(list.map((v) => [v.userId, v]));
  const avg = list.length ? (list.reduce((s, v) => s + v.score, 0) / list.length).toFixed(1) : "—";
  return (
    <>
      <Card style={{ padding: 12, marginBottom: 10 }}>
        <div className="flex justify-between text-xs"><span style={{ color: "var(--text2)" }}>قُيّم في {period}</span><b style={{ color: "var(--text)" }}>{list.length} من {staff.length}</b></div>
        <div className="flex justify-between text-xs"><span style={{ color: "var(--text2)" }}>متوسط الدرجة</span><b style={{ color: "var(--accent)" }}>{avg}</b></div>
      </Card>
      {msg && <p className="text-xs font-bold mb-2" style={{ color: msg.bad ? "var(--bad)" : "var(--good)" }}>{msg.text}</p>}
      {staff.map((s) => {
        const v = by[s.id];
        const open = edit?.userId === s.id;
        return (
          <Card key={s.id} style={{ padding: 10, marginBottom: 6, border: open ? "1px solid var(--accentLine)" : undefined }}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold" style={{ color: "var(--text)" }}>{s.name}</span>
              {v ? <Stars value={v.score} size={13} /> : <span className="text-[11px]" style={{ color: "var(--text3)" }}>لم يُقيَّم</span>}
            </div>
            {v && !open && (
              <p className="text-[11px]" style={{ color: "var(--text2)", margin: "2px 0 0" }}>
                {CRIT.filter(([k]) => v.criteria?.[k]).map(([k, l]) => `${l} ${v.criteria[k]}`).join(" · ")}{v.note ? ` — ${v.note}` : ""}{v.by ? ` (${v.by})` : ""}
              </p>
            )}
            {canManage && !open && (
              <button onClick={() => setEdit({ userId: s.id, score: v?.score || 3, criteria: { ...(v?.criteria || {}) }, note: v?.note || "" })}
                className="mt-1 text-[11px] font-bold" style={{ color: "var(--accent)", background: "none", border: 0, padding: 0 }}>{v ? "عدّل التقييم" : "قيّم"}</button>
            )}
            {open && (
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1"><span className="text-[11px] font-bold" style={{ color: "var(--text2)" }}>الدرجة العامة</span><Stars value={edit.score} onChange={(n) => setEdit({ ...edit, score: n })} /></div>
                {CRIT.map(([k, l]) => (
                  <div key={k} className="flex justify-between items-center mb-1"><span className="text-[11px]" style={{ color: "var(--text2)" }}>{l}</span>
                    <Stars value={edit.criteria[k] || 0} size={13} onChange={(n) => setEdit({ ...edit, criteria: { ...edit.criteria, [k]: n } })} /></div>
                ))}
                <input style={{ ...inputStyle, marginTop: 4 }} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="ملاحظة (اختياري)" />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setEdit(null)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
                  <button onClick={save} disabled={busy} className="py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                    style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>{busy && <Loader2 size={12} className="animate-spin" />} احفظ</button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}

export { LoansPanel, EvaluationsPanel };
