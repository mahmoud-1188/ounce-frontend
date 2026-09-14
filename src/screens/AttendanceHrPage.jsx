import React, { useEffect, useState } from "react";
import { CalendarCheck, Plus } from "lucide-react";
import { LEAVE_TYPES } from "../core/erp.js";
import * as api from "../core/api.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

const selectStyle = { width: "100%", padding: "10px 12px", borderRadius: 12, background: "var(--field)", border: "1px solid var(--line)", color: "var(--text)" };

/**
 * شاشة جديدة لا مقابل مباشر لها في المرجع — المرجع نفسه لا يوفّر أي
 * واجهة لتسجيل الحضور/الإجازات فعليًا رغم قراءته لهما في computePayslip
 * (راجع تعليق migration 016) — absentDays/unpaidLeaveDays كانا صفرًا
 * دائمًا عمليًا هناك. بما أن النطاق المطلوب هنا كامل، هذه الشاشة تسدّ
 * تلك الفجوة: تسجيل يوم حضور/غياب/تأخير لكل موظف، وتقديم/اعتماد طلبات
 * إجازة — كلاهما يغذّي احتساب الرواتب في PayrollPage.jsx مباشرة.
 */
function AttendanceHrPage({ users = [], canManage, onBack, flashToast }) {
  const [tab, setTab] = useState("attendance");
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
      const [attRes, leaveRes] = await Promise.all([
        api.payrollApi.fetchAttendance(thisMonth),
        api.payrollApi.fetchLeaveRequests(),
      ]);
      setAttendance(attRes.attendance);
      setLeaveRequests(leaveRes.leaveRequests);
    } catch (err) {
      flashToast?.("تعذّر جلب بيانات الحضور/الإجازات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      <SubPageHeader title="الحضور والإجازات" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[["attendance", "الحضور"], ["leaves", "الإجازات"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} className="py-2 rounded-xl text-xs font-bold"
              style={{ background: tab === id ? "var(--accentBg)" : "var(--panel)", color: tab === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
              {lbl}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: "var(--text3)" }} className="text-[12px]">جارٍ التحميل…</p>
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
