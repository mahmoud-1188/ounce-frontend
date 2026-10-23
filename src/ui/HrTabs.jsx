import React, { useEffect, useState } from "react";
import * as api from "../core/api.js";
import { LEAVE_TYPES } from "../core/erp.js";
import { fmtMoney } from "../core/money.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";

// تبويبات «الموارد البشرية» كما في المرجع (HrPage): اللوحة · خدمتي · الموظفون · الإضافي والجزاءات · السياسة —
// والحضور والإجازات والقروض والتقييم في الصفحة نفسها. الإضافي والجزاءات والسياسة على الخادم (migration 099).

const HR_WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const inp = { width: "100%", padding: "10px 12px", borderRadius: 12, background: "var(--field)", border: "1px solid var(--line)", color: "var(--text)" };
const row = { color: "var(--text2)", margin: 0 };
const btn = (primary) => ({ background: primary ? "linear-gradient(135deg, var(--gradFrom), var(--gradTo))" : "var(--field)", color: primary ? "var(--bg)" : "var(--text2)", border: primary ? "none" : "1px solid var(--line)" });
const riyadhDay = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const hhmm = (t) => (t ? new Date(new Date(t).getTime() + 3 * 3600 * 1000).toISOString().slice(11, 16) : "—");
const dayOf = (a) => String(a.date).slice(0, 10);
const gross = (u) => (Number(u.basic_salary) || 0) + (Number(u.housing) || 0) + (Number(u.transport) || 0) + (Number(u.other_allowance) || 0);

const stat = (label, value, tone) => (
  <Card style={{ padding: 10 }}>
    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{label}</p>
    <p style={{ color: tone || "var(--text)", margin: "2px 0 0" }} className="text-sm font-bold">{value}</p>
  </Card>
);

/// ملخّص شهرٍ لموظف من سجلّ الحضور والإجازات المعتمدة
function monthSummary(userId, month, attendance, leaves) {
  const recs = attendance.filter((a) => a.user_id === userId && dayOf(a).slice(0, 7) === month);
  const leaveDays = leaves.filter((l) => l.user_id === userId && l.status === "approved").reduce((n, l) => {
    const a = String(l.start_date).slice(0, 10), b = String(l.end_date || l.start_date).slice(0, 10);
    let c = 0; for (let d = new Date(a); d <= new Date(b); d.setDate(d.getDate() + 1)) if (d.toISOString().slice(0, 7) === month) c++;
    return n + c;
  }, 0);
  return {
    present: recs.filter((a) => a.status !== "absent").length,
    late: recs.filter((a) => a.status === "late").length,
    lateMin: recs.reduce((s, a) => s + (Number(a.late_min) || 0), 0),
    absent: recs.filter((a) => a.status === "absent" && !a.excused).length,
    excused: recs.filter((a) => a.status === "absent" && a.excused).length,
    overtimeMin: recs.reduce((s, a) => s + (Number(a.overtime_min) || 0), 0),
    leaveDays,
  };
}

/// اللوحة: الموظفون والسعودة والحضور اليوم والمتأخّرون ومن في إجازة، والإجازات المعلّقة، والوثائق التي تنتهي، وآخر مسيّر
function HrDash({ staff, attendance, leaves, alerts, runs, policy, currency, onGo }) {
  const today = riyadhDay();
  const todayRecs = attendance.filter((a) => dayOf(a) === today);
  const onLeave = leaves.filter((l) => l.status === "approved" && String(l.start_date).slice(0, 10) <= today && String(l.end_date || l.start_date).slice(0, 10) >= today).length;
  const saudi = staff.filter((u) => (u.nationality || "saudi") === "saudi").length;
  const pending = leaves.filter((l) => l.status === "pending").length;
  const late = todayRecs.filter((a) => a.status === "late").length;
  const last = runs[0];
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {stat("الموظفون", staff.length)}
        {stat("السعودة", staff.length ? `${Math.round((saudi / staff.length) * 100)}٪` : "—")}
        {stat("في إجازة", onLeave)}
        {stat("حاضرون اليوم", todayRecs.filter((a) => a.status !== "absent").length, "var(--good)")}
        {stat("متأخّرون", late, late ? "var(--bad)" : undefined)}
        {stat("غائبون", todayRecs.filter((a) => a.status === "absent").length)}
      </div>
      {pending > 0 && <button onClick={() => onGo("leaves")} className="w-full py-2 rounded-xl text-[11px] font-bold mb-2" style={btn(true)}>{pending} طلب إجازة بانتظار الاعتماد</button>}
      <Card style={{ padding: 12, marginBottom: 8 }}>
        <p style={{ color: "var(--text)" }} className="text-xs font-bold mb-1">وثائق تنتهي خلال {policy?.docAlertDays || 30} يومًا</p>
        {alerts.length === 0 ? <p style={row} className="text-[11px]">لا شيء ✓</p> : alerts.map((a, i) => (
          <p key={i} style={{ color: a.daysLeft < 0 ? "var(--bad)" : "var(--text2)", margin: 0 }} className="text-[11px]">
            {a.daysLeft < 0 ? "⚠ انتهت" : "⏳"} {a.doc} — {a.name} · {a.date} ({a.daysLeft < 0 ? `منذ ${-a.daysLeft} يومًا` : `بعد ${a.daysLeft} يومًا`})
          </p>
        ))}
      </Card>
      {last && <p style={row} className="text-[11px]">آخر مسيّر {String(last.period).slice(0, 7)}{last.total != null ? `: ${fmtMoney(last.total)} ${currency}` : ""}</p>}
    </div>
  );
}

/// خدمتي: حضوري وانصرافي اليوم، وملخّص شهري، وطلب إجازة، وطلباتي
function HrSelf({ me, attendance, leaves, policy, onCheck, onRequestLeave }) {
  const today = riyadhDay();
  const [form, setForm] = useState({ type: "annual", startDate: today, endDate: today });
  if (!me) return <p style={row} className="text-[11px]">سجّل الدخول أوّلًا</p>;
  const rec = attendance.find((a) => a.user_id === me.id && dayOf(a) === today);
  const sm = monthSummary(me.id, today.slice(0, 7), attendance, leaves);
  const mine = leaves.filter((l) => l.user_id === me.id).slice(0, 10);
  return (
    <div>
      <Card style={{ padding: 12, marginBottom: 10 }}>
        <p style={{ color: "var(--text)", margin: 0 }} className="text-xs font-bold">{me.name} — {today}</p>
        <p style={row} className="text-[11px]">الوردية {policy?.shiftStart || "—"} → {policy?.shiftEnd || "—"} · حضور {hhmm(rec?.check_in)} · انصراف {hhmm(rec?.check_out)}{rec?.late_min ? ` · تأخير ${rec.late_min} د` : ""}</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button disabled={!!rec?.check_in} className="py-2 rounded-xl text-[11px] font-bold" style={btn(!rec?.check_in)} onClick={() => onCheck(me.id, "in")}>تسجيل حضور</button>
          <button disabled={!rec?.check_in || !!rec?.check_out} className="py-2 rounded-xl text-[11px] font-bold" style={btn(!!rec?.check_in && !rec?.check_out)} onClick={() => onCheck(me.id, "out")}>تسجيل انصراف</button>
        </div>
      </Card>
      <p style={row} className="text-[11px] mb-2">هذا الشهر: حضور {sm.present} · تأخير {sm.late} مرّة ({sm.lateMin} د) · غياب {sm.absent} · إجازة {sm.leaveDays} يومًا</p>
      <Card style={{ padding: 12, marginBottom: 10 }}>
        <p style={{ color: "var(--text)" }} className="text-xs font-bold mb-2">طلب إجازة</p>
        <Field label="النوع"><select style={inp} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>{LEAVE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="من"><input type="date" style={inp} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} /></Field>
          <Field label="إلى"><input type="date" style={inp} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} /></Field>
        </div>
        <button className="w-full py-2 rounded-xl text-[11px] font-bold" style={btn(true)} onClick={() => onRequestLeave({ ...form, userId: me.id })}>إرسال الطلب</button>
      </Card>
      <p style={{ color: "var(--text)" }} className="text-xs font-bold mb-1">طلباتي</p>
      {mine.length === 0 ? <p style={row} className="text-[11px]">لا طلبات</p> : mine.map((l) => (
        <p key={l.id} style={row} className="text-[11px]">{LEAVE_TYPES.find((t) => t.id === l.type)?.label || l.type} · {String(l.start_date).slice(0, 10)} → {String(l.end_date).slice(0, 10)} · {l.status === "approved" ? "معتمدة" : l.status === "rejected" ? "مرفوضة" : "معلّقة"}</p>
      ))}
    </div>
  );
}

/// الموظفون: الملف والإجمالي والتعيين وسنوات الخدمة ووثائقه — والتعديل من «الرواتب»
function HrStaff({ staff, alerts, currency, onEdit }) {
  return staff.map((u) => {
    const docs = alerts.filter((a) => a.userId === u.id);
    const years = u.hire_date ? Math.floor((Date.now() - new Date(u.hire_date).getTime()) / (365.25 * 86400000)) : null;
    const p = u.hr_profile || {};
    return (
      <Card key={u.id} style={{ padding: 10, marginBottom: 6 }}>
        <button onClick={() => onEdit(u.id)} className="w-full text-right">
          <div className="flex items-center justify-between">
            <p style={{ color: "var(--text)", margin: 0 }} className="text-xs font-bold">{u.name}{p.jobTitle ? ` · ${p.jobTitle}` : ""}</p>
            <span style={{ color: "var(--text3)" }} className="text-[10px]">{(u.nationality || "saudi") === "saudi" ? "سعودي" : "غير سعودي"}</span>
          </div>
          <p style={row} className="text-[11px]">الإجمالي {fmtMoney(gross(u))} {currency} · التعيين {u.hire_date ? String(u.hire_date).slice(0, 10) : "—"}{years != null ? ` · ${years} سنة خدمة` : ""}</p>
          {docs.map((a, i) => <p key={i} style={{ color: a.daysLeft < 0 ? "var(--bad)" : "var(--accent)", margin: 0 }} className="text-[10px]">{a.doc}: {a.date}</p>)}
          {!p.nationalId && !p.iqamaNo && <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">الملف ناقص — اضغط لإكماله من «الرواتب»</p>}
        </button>
      </Card>
    );
  });
}

/// الإضافي والجزاءات: بندٌ في مسيّر الشهر — الإضافي بالساعات (أجر الساعة + 50٪ من الأساسي — م107)،
/// والجزاء بسببٍ ولا يتجاوز أجر خمسة أيام (م67). لا يُلغى بعد مسيّر شهره.
function HrAdjustments({ staff, currency, flashToast, preset = null }) {
  const month = riyadhDay().slice(0, 7);
  const [list, setList] = useState(null);
  const [form, setForm] = useState({ employeeId: "", period: month, kind: "overtime", hours: "", amount: "", reason: "" });
  const load = () => api.payrollApi.adjustments().then((d) => setList(d.adjustments || [])).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (preset) setForm((f) => ({ ...f, ...preset })); }, [preset]);
  const err = (e) => ({ payroll_already_run: "صُرف مسيّر هذا الشهر — لا يُضاف إليه", reason_required: "السبب إلزاميٌّ للجزاء", hours_required: "أدخل الساعات",
    invalid_amount: "المبلغ غير صالح", manager_only: "للمدير وحده" }[e?.body?.error] || "تعذّر الحفظ");
  const add = async () => {
    if (!form.employeeId) { flashToast?.("اختر الموظف"); return; }
    try {
      await api.payrollApi.addAdjustment({ ...form, hours: Number(form.hours) || 0, amount: Number(form.amount) || 0 });
      flashToast?.("أُضيف البند لمسيّر الشهر"); setForm((f) => ({ ...f, hours: "", amount: "", reason: "" })); load();
    } catch (e) { flashToast?.(err(e)); }
  };
  const cancel = async (id) => { try { await api.payrollApi.cancelAdjustment(id); load(); } catch (e) { flashToast?.("لا يُلغى بعد مسيّر شهره"); } };
  return (
    <div>
      <Card style={{ padding: 12, marginBottom: 10 }}>
        <p style={{ color: "var(--text)" }} className="text-xs font-bold mb-2">بندٌ في مسيّر الشهر</p>
        <Field label="الموظف">
          <select style={inp} value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}>
            <option value="">اختر الموظف</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="النوع"><select style={inp} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}><option value="overtime">عمل إضافي</option><option value="bonus">مكافأة</option><option value="penalty">جزاء</option></select></Field>
          <Field label="الشهر"><input type="month" style={inp} value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} /></Field>
        </div>
        {form.kind === "overtime"
          ? <Field label="الساعات"><input inputMode="decimal" style={inp} value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder="0" /></Field>
          : <Field label="المبلغ"><input inputMode="decimal" style={inp} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" /></Field>}
        {form.kind === "overtime" && <p style={{ color: "var(--text3)" }} className="text-[10px] mb-1">يُحسب على الخادم: أجر الساعة + 50٪ من أجر الساعة الأساسي (نظام العمل م107)</p>}
        {form.kind === "penalty" && <p style={{ color: "var(--text3)" }} className="text-[10px] mb-1">الجزاءات في الشهر لا تتجاوز أجر خمسة أيام (م67) — الزائد لا يُخصم</p>}
        <Field label={form.kind === "penalty" ? "السبب (إلزامي)" : "السبب"}><input style={inp} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></Field>
        <button className="w-full py-2 rounded-xl text-[11px] font-bold" style={btn(true)} onClick={add}>إضافة</button>
      </Card>
      {list === null && <p style={row} className="text-[11px]">جارِ التحميل…</p>}
      {(list || []).filter((a) => !a.cancelled).slice(0, 40).map((a) => (
        <Card key={a.id} style={{ padding: 10, marginBottom: 6 }}>
          <div className="flex items-center justify-between">
            <p style={{ color: "var(--text)", margin: 0 }} className="text-xs font-bold">{a.name} · {a.kind === "overtime" ? `إضافي ${a.hours} س` : a.kind === "bonus" ? "مكافأة" : "جزاء"} · {fmtMoney(a.amount)} {currency}</p>
            {!a.inRun ? <button className="px-2 py-1 rounded-lg text-[10px]" style={btn(false)} onClick={() => cancel(a.id)}>إلغاء</button>
              : <span style={{ color: "var(--good)" }} className="text-[10px]">في المسيّر</span>}
          </div>
          <p style={row} className="text-[11px]">{a.period}{a.reason ? ` · ${a.reason}` : ""}{a.by ? ` · ${a.by}` : ""}</p>
        </Card>
      ))}
    </div>
  );
}

/// السياسة: الوردية وسماح التأخير وتنبيه الوثائق وحدود القروض والإجازة الأسبوعية
function HrPolicy({ policy, canManage, onSave }) {
  const [pol, setPol] = useState(policy || {});
  useEffect(() => { setPol(policy || {}); }, [policy]);
  const set = (k) => (e) => setPol((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Card style={{ padding: 12 }}>
      <div className="grid grid-cols-2 gap-2">
        <Field label="بداية الوردية"><input type="time" style={inp} value={pol.shiftStart || ""} onChange={set("shiftStart")} /></Field>
        <Field label="نهاية الوردية"><input type="time" style={inp} value={pol.shiftEnd || ""} onChange={set("shiftEnd")} /></Field>
        <Field label="سماح التأخير (دقيقة)"><input type="number" style={inp} value={pol.graceMin ?? ""} onChange={set("graceMin")} /></Field>
        <Field label="تنبيه الوثائق قبل (يوم)"><input type="number" style={inp} value={pol.docAlertDays ?? ""} onChange={set("docAlertDays")} /></Field>
        <Field label="حدّ القرض (× الراتب)"><input type="number" style={inp} value={pol.maxLoanMultiple ?? ""} onChange={set("maxLoanMultiple")} /></Field>
        <Field label="أقصى أقساط"><input type="number" style={inp} value={pol.maxLoanMonths ?? ""} onChange={set("maxLoanMonths")} /></Field>
      </div>
      <p style={row} className="text-[11px] mb-1">الإجازة الأسبوعية</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {HR_WEEKDAYS.map((d, i) => { const on = (pol.weeklyOff || []).includes(i); return (
          <button key={d} type="button" onClick={() => setPol((p) => ({ ...p, weeklyOff: on ? (p.weeklyOff || []).filter((x) => x !== i) : [...(p.weeklyOff || []), i] }))}
            className="px-2 py-1 rounded-lg text-[11px]" style={{ background: on ? "var(--accentBg)" : "var(--field)", color: on ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>{d}</button>
        ); })}
      </div>
      <button disabled={!canManage} className="w-full py-2 rounded-xl text-[11px] font-bold" style={btn(canManage)} onClick={() => onSave(pol)}>حفظ السياسة</button>
    </Card>
  );
}

export { HrAdjustments, HrDash, HrPolicy, HrSelf, HrStaff, monthSummary };
