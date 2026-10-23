import React, { useEffect, useState } from "react";
import { CalendarCheck, Plus } from "lucide-react";
import { LEAVE_TYPES } from "../core/erp.js";
import * as api from "../core/api.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";
import { EvaluationsPanel, LoansPanel } from "../ui/HrLoansEvals.jsx";
import { HrAdjustments, HrDash, HrPolicy, HrSelf, HrStaff, monthSummary } from "../ui/HrTabs.jsx";

const selectStyle = { width: "100%", padding: "10px 12px", borderRadius: 12, background: "var(--field)", border: "1px solid var(--line)", color: "var(--text)" };

/**
 * شاشة جديدة لا مقابل مباشر لها في المرجع — المرجع نفسه لا يوفّر أي
 * واجهة لتسجيل الحضور/الإجازات فعليًا رغم قراءته لهما في computePayslip
 * (راجع تعليق migration 016) — absentDays/unpaidLeaveDays كانا صفرًا
 * دائمًا عمليًا هناك. بما أن النطاق المطلوب هنا كامل، هذه الشاشة تسدّ
 * تلك الفجوة: تسجيل يوم حضور/غياب/تأخير لكل موظف، وتقديم/اعتماد طلبات
 * إجازة — كلاهما يغذّي احتساب الرواتب في PayrollPage.jsx مباشرة.
 */
function AttendanceHrPage({ users = [], canManage, currentUser = null, currency = "ر.س", onOpenPayroll, onBack, flashToast }) {
  // تبويبات المرجع (HrPage): للمدير كلّها، ولغيره «خدمتي» وحدها
  const TABS = canManage
    ? [["dash", "اللوحة"], ["self", "خدمتي"], ["staff", "الموظفون"], ["attendance", "الحضور"], ["leaves", "الإجازات"], ["loans", "القروض"], ["adj", "الإضافي والجزاءات"], ["eval", "التقييم"], ["policy", "السياسة"]]
    : [["self", "خدمتي"]];
  const [tab, setTab] = useState(TABS[0][0]);
  const [staff, setStaff] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [runs, setRuns] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [adjPreset, setAdjPreset] = useState(null);
  const [sumMonth, setSumMonth] = useState(new Date().toISOString().slice(0, 7));
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markDate, setMarkDate] = useState(today);
  const [leaveForm, setLeaveForm] = useState({ userId: "", type: "annual", startDate: today, endDate: today });
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [attRes, leaveRes, polRes] = await Promise.all([
        api.payrollApi.fetchAttendance(sumMonth),
        api.payrollApi.fetchLeaveRequests(),
        api.payrollApi.hrPolicy().catch(() => ({ policy: null })),
      ]);
      setAttendance(attRes.attendance);
      setLeaveRequests(leaveRes.leaveRequests);
      setPolicy(polRes.policy);
      if (canManage) {
        const [s, a, r] = await Promise.all([
          api.payrollApi.fetchStaff().catch(() => ({ staff: [] })),
          api.payrollApi.hrAlerts().catch(() => ({ alerts: [] })),
          api.payrollApi.fetchRuns().catch(() => ({ runs: [] })),
        ]);
        setStaff((s.staff || []).filter((u) => u.active !== false && !u.left_at));
        setAlerts(a.alerts || []);
        setRuns(r.runs || []);
      }
    } catch (err) {
      flashToast?.("تعذّر جلب بيانات الحضور/الإجازات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [sumMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // الحضور والانصراف بوقته — التأخير والإضافي من الوردية وسماحها على الخادم
  async function check(userId, action) {
    try { await api.payrollApi.check(action, userId); flashToast?.(action === "in" ? "سُجّل الحضور" : "سُجّل الانصراف"); await load(); }
    catch (err) { flashToast?.(err?.body?.error === "not_checked_in" ? "لم يُسجَّل حضورٌ اليوم" : "تعذّر التسجيل"); }
  }
  async function requestLeave(body) {
    try { await api.payrollApi.requestLeave(body); flashToast?.("قُدِّم طلب الإجازة"); await load(); }
    catch { flashToast?.("تعذّر تقديم طلب الإجازة"); }
  }
  async function savePolicy(p) {
    try { const r = await api.payrollApi.saveHrPolicy(p); setPolicy(r.policy); flashToast?.("حُفظت السياسة"); }
    catch { flashToast?.("تعذّر حفظ السياسة"); }
  }
  const me = currentUser ? users.find((u) => u.id === currentUser.id) || currentUser : null;

  const activeStaff = users.filter((u) => u.active !== false);

  async function mark(userId, status) {
    try {
      await api.payrollApi.markAttendance({ userId, date: markDate, status });
      flashToast?.("سُجِّل الحضور");
      await load();
    } catch (err) {
      flashToast?.("تعذّر تسجيل الحضور");
    }
  }

  async function submitLeave() {
    if (!leaveForm.userId) { flashToast?.("اختر الموظف"); return; }
    try {
      await api.payrollApi.requestLeave(leaveForm);
      flashToast?.("قُدِّم طلب الإجازة");
      setShowLeaveForm(false);
      setLeaveForm({ userId: "", type: "annual", startDate: today, endDate: today });
      await load();
    } catch (err) {
      flashToast?.("تعذّر تقديم طلب الإجازة");
    }
  }

  async function decide(id, decision) {
    try {
      await api.payrollApi.decideLeave(id, decision);
      flashToast?.(decision === "approved" ? "اعتُمدت الإجازة" : "رُفضت الإجازة");
      await load();
    } catch (err) {
      flashToast?.("تعذّر اتخاذ القرار");
    }
  }

  const attendanceForDate = (userId) => attendance.find((a) => a.user_id === userId && String(a.date).slice(0, 10) === markDate);

  return (
    <div>
      <SubPageHeader title="الموارد البشرية" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {TABS.map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} className="px-3 py-1.5 rounded-full text-[11px] font-bold"
              style={{ background: tab === id ? "var(--accentBg)" : "var(--field)", color: tab === id ? "var(--accent)" : "var(--text2)", border: `1px solid ${tab === id ? "var(--accentLine)" : "var(--line)"}` }}>
              {lbl}{id === "leaves" && leaveRequests.some((l) => l.status === "pending") ? ` (${leaveRequests.filter((l) => l.status === "pending").length})` : ""}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: "var(--text3)" }} className="text-[12px]">جارٍ التحميل…</p>
        ) : tab === "dash" ? (
          <HrDash staff={staff} attendance={attendance} leaves={leaveRequests} alerts={alerts} runs={runs} policy={policy} currency={currency} onGo={setTab} />
        ) : tab === "self" ? (
          <HrSelf me={me} attendance={attendance} leaves={leaveRequests} policy={policy} onCheck={check} onRequestLeave={requestLeave} />
        ) : tab === "staff" ? (
          <HrStaff staff={staff} alerts={alerts} currency={currency} onEdit={() => onOpenPayroll?.()} />
        ) : tab === "loans" ? (
          <LoansPanel currency={currency} />
        ) : tab === "adj" ? (
          <HrAdjustments staff={staff} currency={currency} flashToast={flashToast} preset={adjPreset} />
        ) : tab === "eval" ? (
          <EvaluationsPanel staff={staff.map((u) => ({ id: u.id, name: u.name }))} period={thisMonth} canManage={canManage} />
        ) : tab === "policy" ? (
          <HrPolicy policy={policy} canManage={canManage} onSave={savePolicy} />
        ) : tab === "attendance" ? (
          <>
            <Field label="اليوم">
              <input type="date" style={selectStyle} value={markDate} onChange={(e) => setMarkDate(e.target.value)} />
            </Field>
            {activeStaff.length === 0 ? (
              <EmptyState icon={<CalendarCheck size={30} color="var(--accentSoft)" />} title="لا موظفين" sub="لا يوجد موظفون نشطون" />
            ) : activeStaff.map((u) => {
              const rec = attendanceForDate(u.id);
              return (
                <Card key={u.id} style={{ padding: 10, marginBottom: 6 }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span style={{ color: "var(--text)" }} className="text-[12px] font-bold flex-1">{u.name}</span>
                    {rec && (
                      <span className="text-[9px] px-1.5 rounded-full" style={{
                        background: rec.status === "present" ? "var(--goodBg)" : rec.status === "late" ? "var(--accentBg)" : "var(--badBg)",
                        color: rec.status === "present" ? "var(--good)" : rec.status === "late" ? "var(--accent)" : "var(--bad)",
                      }}>
                        {rec.status === "present" ? "حاضر" : rec.status === "late" ? "متأخر" : "غائب"}{rec.excused ? " (بعذر)" : ""}
                      </span>
                    )}
                  </div>
                  {rec?.check_in && (
                    <p style={{ color: "var(--text3)" }} className="text-[10px] mb-1">
                      حضور {new Date(new Date(rec.check_in).getTime() + 3 * 3600 * 1000).toISOString().slice(11, 16)}
                      {rec.check_out ? ` · انصراف ${new Date(new Date(rec.check_out).getTime() + 3 * 3600 * 1000).toISOString().slice(11, 16)}` : ""}
                      {rec.late_min ? ` · تأخير ${rec.late_min} د` : ""}{rec.overtime_min ? ` · إضافي ${rec.overtime_min} د` : ""}
                    </p>
                  )}
                  {markDate === today && (
                    <div className="flex gap-1.5 mb-1.5">
                      {!rec?.check_in && <button onClick={() => check(u.id, "in")} className="flex-1 py-1.5 rounded-lg text-[11px]" style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>تسجيل حضور</button>}
                      {rec?.check_in && !rec?.check_out && <button onClick={() => check(u.id, "out")} className="flex-1 py-1.5 rounded-lg text-[11px]" style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>تسجيل انصراف</button>}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    {[["present", "حاضر"], ["late", "متأخر"], ["absent", "غائب"]].map(([id, lbl]) => (
                      <button key={id} onClick={() => mark(u.id, id)} className="flex-1 py-1.5 rounded-lg text-[11px] font-bold"
                        style={{ background: rec?.status === id ? "var(--accentBg)" : "var(--field)", color: rec?.status === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
            <p style={{ color: "var(--text)" }} className="text-xs font-bold mt-3 mb-1">ملخّص الشهر</p>
            <Field label="الشهر"><input type="month" style={selectStyle} value={sumMonth} onChange={(e) => setSumMonth(e.target.value)} /></Field>
            {activeStaff.map((u) => {
              const sm = monthSummary(u.id, sumMonth, attendance, leaveRequests);
              const otHours = Math.round((sm.overtimeMin / 60) * 100) / 100;
              return (
                <div key={u.id} className="flex items-center justify-between gap-2 mb-1">
                  <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">{u.name}: حضور {sm.present} · تأخير {sm.late} ({sm.lateMin} د) · غياب {sm.absent} · بعذر {sm.excused} · إجازة {sm.leaveDays} · إضافي {otHours} س</p>
                  {canManage && otHours > 0 && !runs.some((r) => String(r.period).slice(0, 7) === sumMonth) && (
                    <button className="px-2 py-1 rounded-lg text-[10px] whitespace-nowrap" style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}
                      onClick={() => { setAdjPreset({ employeeId: u.id, period: sumMonth, kind: "overtime", hours: String(otHours), reason: "من سجلّ الحضور" }); setTab("adj"); }}>أضِف كإضافي</button>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <>
            {!showLeaveForm ? (
              <button onClick={() => setShowLeaveForm(true)} className="w-full py-3 rounded-xl text-sm font-bold mb-3 flex items-center justify-center gap-2"
                style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                <Plus size={16} /> طلب إجازة جديد
              </button>
            ) : (
              <Card style={{ padding: 12, marginBottom: 10 }}>
                <Field label="الموظف">
                  <select style={selectStyle} value={leaveForm.userId} onChange={(e) => setLeaveForm((x) => ({ ...x, userId: e.target.value }))}>
                    <option value="">اختر…</option>
                    {activeStaff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label="نوع الإجازة">
                  <select style={selectStyle} value={leaveForm.type} onChange={(e) => setLeaveForm((x) => ({ ...x, type: e.target.value }))}>
                    {LEAVE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}{t.paid ? "" : " (بلا راتب)"}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="من"><input type="date" style={selectStyle} value={leaveForm.startDate} onChange={(e) => setLeaveForm((x) => ({ ...x, startDate: e.target.value }))} /></Field>
                  <Field label="إلى"><input type="date" style={selectStyle} value={leaveForm.endDate} onChange={(e) => setLeaveForm((x) => ({ ...x, endDate: e.target.value }))} /></Field>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowLeaveForm(false)} className="flex-1 py-2 rounded-xl text-[11px]" style={{ background: "var(--field)", color: "var(--text2)" }}>إلغاء</button>
                  <button onClick={submitLeave} className="flex-1 py-2 rounded-xl text-[11px] font-bold" style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>تقديم</button>
                </div>
              </Card>
            )}

            {leaveRequests.length === 0 ? (
              <EmptyState icon={<CalendarCheck size={30} color="var(--accentSoft)" />} title="لا طلبات إجازة" sub="اضغط أعلاه لتقديم طلب" />
            ) : leaveRequests.map((l) => {
              const emp = users.find((u) => u.id === l.user_id);
              const typeInfo = LEAVE_TYPES.find((t) => t.id === l.type);
              return (
                <Card key={l.id} style={{ padding: 10, marginBottom: 6 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: "var(--text)" }} className="text-[12px] font-bold flex-1">{emp?.name || "—"}</span>
                    <span className="text-[9px] px-1.5 rounded-full" style={{
                      background: l.status === "approved" ? "var(--goodBg)" : l.status === "rejected" ? "var(--badBg)" : "var(--field)",
                      color: l.status === "approved" ? "var(--good)" : l.status === "rejected" ? "var(--bad)" : "var(--text2)",
                    }}>
                      {l.status === "approved" ? "معتمَدة" : l.status === "rejected" ? "مرفوضة" : "بانتظار"}
                    </span>
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[10px]">
                    {typeInfo?.label || l.type} · {String(l.start_date).slice(0, 10)} → {String(l.end_date).slice(0, 10)}
                  </p>
                  {canManage && l.status === "pending" && (
                    <div className="flex gap-1.5 mt-2">
                      <button onClick={() => decide(l.id, "approved")} className="flex-1 py-1.5 rounded-lg text-[11px] font-bold"
                        style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>اعتماد</button>
                      <button onClick={() => decide(l.id, "rejected")} className="flex-1 py-1.5 rounded-lg text-[11px] font-bold"
                        style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}>رفض</button>
                    </div>
                  )}
                </Card>
              );
            })}
          </>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

export { AttendanceHrPage };
