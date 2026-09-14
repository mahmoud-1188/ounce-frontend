import React, { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import * as api from "../core/api.js";
import { fmtMoney } from "../core/money.js";
import { Card } from "../ui/Card.jsx";
import { CommissionRuleForm } from "../ui/CommissionRuleForm.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { HrFieldsForm } from "../ui/HrFieldsForm.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/**
 * منقولة عن PayrollPage.js المرجعي في التبويبات (الشهر/التأمينات/نهاية
 * الخدمة) والفكرة، لكن مبنية على بيانات مجلوبة فعليًا من الباك إند
 * (migration 016) بدل حالة محلية بحتة — لهذا فرقان جوهريان عن المرجع:
 *
 * 1) لا bootstrap: هذه الشاشة تجلب staff/runs بنفسها عند الفتح
 *    (useEffect) لا من props محمَّلة سلفًا — الرواتب بيانات حساسة
 *    ومُستبعَدة عمدًا من GET /api/bootstrap العام (راجع تعليق
 *    bootstrap.routes.js)، فلا تصل الشاشة إلا حين يفتحها من يملك
 *    صلاحية "payroll" فعلًا.
 * 2) "المعاينة" (preview) والاحتساب الفعلي كلاهما من الخادم — لا حساب
 *    محلي مزدوج يخاطر بالتفاوت (GOSI/عمولة/غياب كلها تعتمد بيانات
 *    مبيعات/حضور حقيقية على الخادم، لا شيء منها متاح محليًا هنا أصلًا).
 */
function PayrollPage({ currency = "ر.س", safeBalance = {}, canManage, onBack, flashToast }) {
  const [tab, setTab] = useState("run");
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(thisMonth);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [runs, setRuns] = useState([]);
  const [lines, setLines] = useState([]);
  const [preview, setPreview] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [accruing, setAccruing] = useState(false);
  const [hrEdit, setHrEdit] = useState(null);
  const [commissionEdit, setCommissionEdit] = useState(null);
  const [eos, setEos] = useState({ employeeId: "", reason: "termination", atDate: "", note: "", fundingSource: "safe_cash" });

  async function loadStaffAndRuns() {
    setLoading(true);
    try {
      const [staffRes, runsRes] = await Promise.all([api.payrollApi.fetchStaff(), api.payrollApi.fetchRuns()]);
      setStaff(staffRes.staff);
      setRuns(runsRes.runs);
      setLines(runsRes.lines);
    } catch (err) {
      flashToast?.("تعذّر جلب بيانات الرواتب");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStaffAndRuns(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useMemo(
    () => runs.find((r) => String(r.period).slice(0, 7) === period) || null,
    [runs, period]
  );
  const runLines = useMemo(
    () => (run ? lines.filter((l) => l.payroll_run_id === run.id) : []),
    [lines, run]
  );

  useEffect(() => {
    if (run || tab === "eos") return;
    let cancelled = false;
    setPreviewLoading(true);
    api.payrollApi.preview(period)
      .then((res) => { if (!cancelled) setPreview(res.slips); })
      .catch(() => { if (!cancelled) setPreview([]); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [period, run, tab]);

  const slips = run
    ? runLines.map((l) => ({
        employeeId: l.user_id,
        employeeName: staff.find((u) => u.id === l.user_id)?.name || "",
        nationality: staff.find((u) => u.id === l.user_id)?.nationality === "expat" ? "غير سعودي" : "سعودي",
        basic: Number(l.base_salary), housing: Number(l.housing), transport: Number(l.transport),
        other: Number(l.other_allowance), commission: Number(l.commission),
        gosiEmployee: Number(l.gosi_employee), gosiEmployer: Number(l.gosi_employer),
        advances: Number(l.advances), absentDays: l.absent_days, unpaidLeaveDays: l.unpaid_leave_days,
        absenceDeduction: Number(l.absence_deduction), net: Number(l.net_pay),
        employerCost: Number(l.employer_cost), paidAt: l.paid_at, paidSource: l.paid_source,
      }))
    : preview.map((s) => ({ ...s, nationality: s.nationality === "expat" ? "غير سعودي" : "سعودي" }));

  const totals = useMemo(() => ({
    gross: slips.reduce((a, s) => a + s.basic + s.housing + s.transport + (s.other || 0), 0),
    net: slips.reduce((a, s) => a + s.net, 0),
    gosi: slips.reduce((a, s) => a + s.gosiEmployee + s.gosiEmployer, 0),
    cost: slips.reduce((a, s) => a + (s.employerCost || 0), 0),
  }), [slips]);

  const activeStaff = staff.filter((u) => u.active !== false);
  const eosEmp = activeStaff.find((u) => u.id === eos.employeeId);
  const eosPreview = useMemo(() => {
    if (!eosEmp) return null;
    const basic = Number(eosEmp.basic_salary) || 0;
    const housing = eosEmp.housing != null ? Number(eosEmp.housing) : basic * 0.25;
    const gross = basic + housing + (Number(eosEmp.transport) || 0) + (Number(eosEmp.other_allowance) || 0);
    const start = eosEmp.hire_date ? new Date(eosEmp.hire_date).getTime() : Date.now();
    const end = eos.atDate ? new Date(eos.atDate).getTime() : Date.now();
    const years = Math.max(0, (end - start) / (365.25 * 24 * 3600 * 1000));
    const first5 = Math.min(years, 5);
    const after5 = Math.max(0, years - 5);
    let due = gross * 0.5 * first5 + gross * after5;
    if (eos.reason === "resignation") {
      if (years < 2) due = 0;
      else if (years < 5) due = due / 3;
      else if (years < 10) due = (due * 2) / 3;
    }
    return { years: Math.round(years * 100) / 100, due, basis: eos.reason === "resignation" ? "استقالة — مُقلَّص بالمدة" : "إنهاء عقد — كامل" };
  }, [eosEmp, eos.reason, eos.atDate]);

  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); });

  async function accrue() {
    setAccruing(true);
    try {
      const res = await api.payrollApi.accrue(period);
      flashToast?.(`احتُسبت رواتب ${period} — ${res.staffCount} موظف · صافي ${fmtMoney(res.netPayable)}`);
      await loadStaffAndRuns();
    } catch (err) {
      flashToast?.(err?.body?.error === "no_staff" ? "لا موظفين برواتب" : "تعذّر احتساب الرواتب");
    } finally {
      setAccruing(false);
    }
  }

  async function pay(employeeId, source) {
    try {
      await api.payrollApi.pay(run.id, employeeId, source);
      flashToast?.("صُرف الراتب");
      await loadStaffAndRuns();
    } catch (err) {
      flashToast?.("تعذّر صرف الراتب");
    }
  }

  async function payGosi(source) {
    try {
      await api.payrollApi.payGosi(run.id, source);
      flashToast?.("سُدّدت التأمينات");
      await loadStaffAndRuns();
    } catch (err) {
      flashToast?.("تعذّر سداد التأمينات");
    }
  }

  async function saveHr(userId, patch) {
    try {
      await api.payrollApi.saveHr(userId, patch);
      await loadStaffAndRuns();
      return true;
    } catch (err) {
      flashToast?.("تعذّر حفظ بيانات الموظف");
      return false;
    }
  }

  async function saveCommission(userId, rule) {
    try {
      await api.payrollApi.saveCommission(userId, rule);
      flashToast?.("حُفظت قاعدة العمولة");
      setCommissionEdit(null);
      return true;
    } catch (err) {
      flashToast?.("تعذّر حفظ قاعدة العمولة");
      return false;
    }
  }

  async function payEos() {
    try {
      const res = await api.payrollApi.payEos({
        employeeId: eos.employeeId, reason: eos.reason, atDate: eos.atDate || undefined, fundingSource: eos.fundingSource,
      });
      flashToast?.(`صُرفت نهاية خدمة ${res.user.name} — ${fmtMoney(res.due)} عن ${res.years} سنة`);
      setEos({ employeeId: "", reason: "termination", atDate: "", note: "", fundingSource: "safe_cash" });
      await loadStaffAndRuns();
    } catch (err) {
      flashToast?.(err?.body?.error === "nothing_due" ? "لا مستحقّ — المدة أقلّ من سنتين باستقالة" : "تعذّر صرف نهاية الخدمة");
    }
  }

  if (loading) {
    return (
      <div>
        <SubPageHeader title="الرواتب" onBack={onBack} />
        <div className="px-4 pt-3"><p style={{ color: "var(--text3)" }} className="text-[12px]">جارٍ التحميل…</p></div>
      </div>
    );
  }

  return (
    <div>
      <SubPageHeader title="الرواتب" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[["run", "الشهر"], ["gosi", "التأمينات"], ["eos", "نهاية الخدمة"]].map(([id, lbl]) => {
            const on = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} className="py-2 rounded-xl text-xs font-bold"
                style={{ background: on ? "var(--accentBg)" : "var(--panel)", color: on ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
                {lbl}
              </button>
            );
          })}
        </div>

        {tab !== "eos" && (
          <div className="flex gap-1.5 mb-3 overflow-x-auto">
            {months.map((m) => (
              <button key={m} onClick={() => setPeriod(m)} className="px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0"
                style={{ background: period === m ? "var(--accentBg)" : "var(--field)", color: period === m ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
                {m}{runs.some((r) => String(r.period).slice(0, 7) === m) ? " ✓" : ""}
              </button>
            ))}
          </div>
        )}

        {tab === "run" && (
          <>
            <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
              <div className="grid grid-cols-2 gap-2">
                {[["الإجمالي", totals.gross], ["صافي الصرف", totals.net], ["التأمينات", totals.gosi], ["تكلفة المنشأة", totals.cost]].map(([l, v]) => (
                  <div key={l}>
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{l}</p>
                    <p style={{ color: l === "تكلفة المنشأة" ? "var(--accent)" : "var(--text)", margin: 0 }} className="text-[14px] font-bold">{currency}{fmtMoney(v)}</p>
                  </div>
                ))}
              </div>
              <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2 leading-6">
                {run ? `احتُسب · ${run.ref}` : previewLoading ? "جارٍ حساب المعاينة…" : "معاينة — لم يُحتسب بعد. الاحتساب يُقيَّد استحقاقًا ويُجمّد الكشف."}
              </p>
              {!run && canManage && slips.length > 0 && (
                <button onClick={accrue} disabled={accruing} className="w-full mt-2 py-2.5 rounded-xl text-[12px] font-bold"
                  style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
                  {accruing ? "جارٍ الاحتساب…" : `احتساب رواتب ${period}`}
                </button>
              )}
            </Card>

            {slips.length === 0 ? (
              <EmptyState icon={<Users size={30} color="var(--accentSoft)" />} title="لا موظفين برواتب" sub="أضِف الراتب الأساسي من بيانات الموظف" />
            ) : (
              <div className="flex flex-col gap-1.5">
                {slips.map((s) => (
                  <Card key={s.employeeId} style={{ padding: 11 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: "var(--text)" }} className="text-[12px] font-bold flex-1">{s.employeeName}</span>
                      <span style={{ color: "var(--text3)" }} className="text-[10px]">{s.nationality}</span>
                      {s.paidAt && <span className="text-[9px] px-1.5 rounded-full" style={{ background: "var(--goodBg)", color: "var(--good)" }}>صُرف</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3" style={{ fontSize: 10, color: "var(--text3)" }}>
                      <span>أساسي {fmtMoney(s.basic)}</span><span>سكن {fmtMoney(s.housing)}</span>
                      <span>مواصلات {fmtMoney(s.transport)}</span><span>عمولة {fmtMoney(s.commission)}</span>
                      <span style={{ color: "var(--bad)" }}>تأمينات −{fmtMoney(s.gosiEmployee)}</span>
                      <span style={{ color: "var(--bad)" }}>سلف −{fmtMoney(s.advances)}</span>
                      {s.absentDays + s.unpaidLeaveDays > 0 && <span style={{ color: "var(--bad)" }}>غياب {s.absentDays + s.unpaidLeaveDays} يوم −{fmtMoney(s.absenceDeduction)}</span>}
                    </div>
                    <div className="flex items-baseline justify-between mt-1.5 pt-1.5" style={{ borderTop: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--text3)" }} className="text-[10px]">الصافي</span>
                      <span style={{ color: "var(--accent)" }} className="text-[14px] font-bold">{currency}{fmtMoney(s.net)}</span>
                    </div>
                    {run && !s.paidAt && canManage && s.net > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {[["safe_cash", "كاش"], ["safe_network", "شبكة"]].map(([src, lbl]) => (
                          <button key={src} onClick={() => pay(s.employeeId, src)} className="flex-1 py-1.5 rounded-lg text-[11px] font-bold"
                            style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                            صرف {lbl}
                          </button>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {canManage && (
              <>
                <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mt-4 mb-1">بيانات الرواتب للموظفين</p>
                {activeStaff.map((u) => (
                  <Card key={u.id} style={{ padding: 10, marginBottom: 6 }}>
                    {hrEdit?.id === u.id ? (
                      <HrFieldsForm
                        user={{
                          basicSalary: u.basic_salary, housing: u.housing, transport: u.transport,
                          otherAllowance: u.other_allowance, nationality: u.nationality, hireDate: u.hire_date,
                        }}
                        onCancel={() => setHrEdit(null)}
                        onSave={(patch) => saveHr(u.id, patch)}
                      />
                    ) : (
                      <button onClick={() => setHrEdit(u)} className="w-full text-right">
                        <div className="flex items-center gap-2">
                          <span style={{ color: "var(--text)" }} className="text-[11px] font-bold flex-1">{u.name}</span>
                          <span style={{ color: "var(--text3)" }} className="text-[10px]">
                            {Number(u.basic_salary) > 0 ? `${fmtMoney(u.basic_salary)} · ${u.nationality === "saudi" ? "سعودي" : "غير سعودي"}` : "بلا راتب — اضغط للإضافة"}
                          </span>
                        </div>
                      </button>
                    )}
                    {commissionEdit === u.id ? (
                      <div className="mt-2">
                        <CommissionRuleForm
                          rule={{ basis: u.commission_basis || "profit", rate: Number(u.commission_rate) || 0, target: Number(u.commission_target) || 0, perInvoice: Number(u.commission_per_invoice) || 0 }}
                          currency={currency}
                          onCancel={() => setCommissionEdit(null)}
                          onSave={(rule) => saveCommission(u.id, rule)}
                        />
                      </div>
                    ) : hrEdit?.id !== u.id && (
                      <button onClick={() => setCommissionEdit(u.id)} className="mt-2 text-[10px] px-2 py-1 rounded-full"
                        style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                        {u.commission_basis ? "تعديل قاعدة العمولة" : "إضافة عمولة"}
                      </button>
                    )}
                  </Card>
                ))}
              </>
            )}
          </>
        )}

        {tab === "gosi" && (
          <>
            {!run ? (
              <EmptyState icon={<ShieldCheck size={30} color="var(--accentSoft)" />} title={`لم تُحتسب رواتب ${period}`} sub="احتسب الشهر أولًا ثم سدّد التأمينات" />
            ) : (
              <Card style={{ padding: 12 }}>
                <div className="flex items-baseline justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--text3)" }} className="text-[11px]">حصة الموظفين</span>
                  <span style={{ color: "var(--text)" }} className="text-[12px] font-bold">{currency}{fmtMoney(runLines.reduce((a, l) => a + Number(l.gosi_employee), 0))}</span>
                </div>
                <div className="flex items-baseline justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--text3)" }} className="text-[11px]">حصة المنشأة</span>
                  <span style={{ color: "var(--text)" }} className="text-[12px] font-bold">{currency}{fmtMoney(runLines.reduce((a, l) => a + Number(l.gosi_employer), 0))}</span>
                </div>
                <div className="flex items-baseline justify-between py-1.5">
                  <span style={{ color: "var(--accent)" }} className="text-[11px] font-bold">المستحق للتأمينات</span>
                  <span style={{ color: "var(--accent)" }} className="text-[15px] font-bold">{currency}{fmtMoney(Number(run.gosi_due))}</span>
                </div>
                {run.gosi_paid_at ? (
                  <p style={{ color: "var(--good)" }} className="text-[11px] mt-2">✓ سُدّدت</p>
                ) : canManage && (
                  <div className="flex gap-1.5 mt-3">
                    {[["safe_cash", "سداد كاش"], ["safe_network", "سداد شبكة"]].map(([src, lbl]) => (
                      <button key={src} onClick={() => payGosi(src)} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold"
                        style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>{lbl}</button>
                    ))}
                  </div>
                )}
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2 leading-6">
                  سعودي: 9.75٪ موظف + 11.75٪ منشأة على الأساسي والسكن حتى {fmtMoney(45000)}. غير سعودي: 2٪ أخطار مهنية على المنشأة فقط.
                </p>
              </Card>
            )}
          </>
        )}

        {tab === "eos" && (
          <Card style={{ padding: 12 }}>
            <Field label="الموظف">
              <select className="w-full" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--field)", border: "1px solid var(--line)", color: "var(--text)" }}
                value={eos.employeeId} onChange={(e) => setEos((x) => ({ ...x, employeeId: e.target.value }))}>
                <option value="">اختر…</option>
                {activeStaff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              {[["termination", "إنهاء عقد"], ["resignation", "استقالة"]].map(([id, lbl]) => (
                <button key={id} onClick={() => setEos((x) => ({ ...x, reason: id }))} className="py-2 rounded-xl text-[11px] font-bold"
                  style={{ background: eos.reason === id ? "var(--accentBg)" : "var(--field)", color: eos.reason === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{lbl}</button>
              ))}
            </div>
            <Field label="تاريخ المغادرة">
              <input type="date" style={{ width: "100%", padding: "10px 12px", borderRadius: 12, background: "var(--field)", border: "1px solid var(--line)", color: "var(--text)" }}
                value={eos.atDate} onChange={(e) => setEos((x) => ({ ...x, atDate: e.target.value }))} />
            </Field>
            {eosEmp && eosPreview && (
              <Card style={{ padding: 10, background: "var(--field)", marginBottom: 8 }}>
                {[["تاريخ التعيين", eosEmp.hire_date ? new Date(eosEmp.hire_date).toLocaleDateString("en-GB") : "غير مسجّل"],
                  ["مدة الخدمة", `${eosPreview.years} سنة`], ["الأساس", eosPreview.basis],
                  ["المستحق", `${currency}${fmtMoney(eosPreview.due)}`]].map(([l, v]) => (
                  <div key={l} className="flex items-baseline justify-between py-1">
                    <span style={{ color: "var(--text3)" }} className="text-[10px]">{l}</span>
                    <span style={{ color: l === "المستحق" ? "var(--accent)" : "var(--text)" }} className="text-[12px] font-bold">{v}</span>
                  </div>
                ))}
                {!eosEmp.hire_date && <p style={{ color: "var(--bad)" }} className="text-[10px] mt-1">⚠ بلا تاريخ تعيين — المدة تُحسب من اليوم. أضفه من بيانات الموظف.</p>}
              </Card>
            )}
            {canManage && eosEmp && eosPreview?.due > 0 && (
              <div className="flex gap-1.5">
                {[["safe_cash", "صرف كاش"], ["safe_network", "صرف شبكة"]].map(([src, lbl]) => (
                  <button key={src} onClick={() => { setEos((x) => ({ ...x, fundingSource: src })); }}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-bold"
                    style={{ background: eos.fundingSource === src ? "var(--badBg)" : "var(--field)", color: eos.fundingSource === src ? "var(--bad)" : "var(--text2)", border: "1px solid var(--badLine)" }}>{lbl}</button>
                ))}
              </div>
            )}
            {canManage && eosEmp && eosPreview?.due > 0 && (
              <button onClick={payEos} className="w-full mt-2 py-2.5 rounded-xl text-[12px] font-bold"
                style={{ background: "var(--bad)", color: "var(--panel)" }}>
                تأكيد صرف نهاية الخدمة
              </button>
            )}
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2 leading-6">
              نصف شهر عن كل سنة في الخمس الأولى وشهر لما بعدها. الاستقالة: لا شيء تحت سنتين، ثلث حتى خمس، ثلثان حتى عشر. الصرف يُنهي خدمة الموظف.
            </p>
          </Card>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

export { PayrollPage };
