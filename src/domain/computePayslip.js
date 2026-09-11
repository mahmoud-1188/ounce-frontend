import { GOSI_RATES } from "../core/erp.js";
import { fromHalalas, halalas } from "../core/money.js";
import { payrollComponents } from "./payrollComponents.js";

function computePayslip(emp, period, ctx = {}) {
  const { advances = [], commissions = [], attendance = [], leaves = [], settings = {} } = ctx;
  const c = payrollComponents(emp, settings);
  const rates = GOSI_RATES[emp.nationality === "saudi" ? "saudi" : "expat"];

  // ── الخصومات ──
  const subj = halalas(c.gosiSubject);
  const gosiEmp = Math.round(subj * rates.employee);
  const gosiCo = Math.round(subj * rates.employer);

  const adv = advances
    .filter((a) => a.employeeId === emp.id && !a.settled)
    .reduce((s, a) => s + halalas(a.amount), 0);

  // ⚠ الغياب يُخصم بأجر اليوم لا بنسبة تقديرية: الشهر ثلاثون يومًا
  // نظاميًا مهما كانت أيامه الفعلية.
  const absentDays = attendance.filter(
    (a) => a.employeeId === emp.id &&
           String(a.date).slice(0, 7) === period &&
           a.status === "absent" && !a.excused
  ).length;
  const unpaidLeaveDays = leaves.filter(
    (l) => l.employeeId === emp.id && l.status === "approved" &&
           l.typeId === "unpaid" && String(l.from).slice(0, 7) === period
  ).reduce((s, l) => s + (Number(l.days) || 0), 0);
  const dayRate = Math.round(halalas(c.gross) / 30);
  const absenceDeduction = dayRate * (absentDays + unpaidLeaveDays);

  const comm = commissions
    .filter((x) => x.employeeId === emp.id && String(x.period) === period && !x.paid)
    .reduce((s, x) => s + halalas(x.amount), 0);

  const deductions = gosiEmp + adv + absenceDeduction;
  const net = halalas(c.gross) + comm - deductions;

  // ── مخصّص نهاية الخدمة ──
  //
  // ⚠ نصف شهر لكل سنة في الخمس الأولى، وشهر لما بعدها.
  // احتساب شهر من البداية يُضخّم الالتزام، والعكس يُخفيه.
  const years = emp.hireDate
    ? (Date.now() - new Date(emp.hireDate).getTime()) / (365.25 * 24 * 3600 * 1000)
    : 0;
  const eosMonthly = years <= 5
    ? Math.round(halalas(c.gross) / 24)   // نصف شهر ÷ 12
    : Math.round(halalas(c.gross) / 12);  // شهر ÷ 12

  return {
    employeeId: emp.id,
    employeeName: emp.name,
    period,
    nationality: rates.label,
    ...c,
    commission: fromHalalas(comm),
    gosiEmployee: fromHalalas(gosiEmp),
    gosiEmployer: fromHalalas(gosiCo),
    advances: fromHalalas(adv),
    absentDays,
    unpaidLeaveDays,
    absenceDeduction: fromHalalas(absenceDeduction),
    deductions: fromHalalas(deductions),
    net: fromHalalas(net),
    eosAccrual: fromHalalas(eosMonthly),
    // ⚖ التكلفة على المنشأة: الإجمالي + حصّتها + المخصّص، لا الصافي
    employerCost: fromHalalas(halalas(c.gross) + comm + gosiCo + eosMonthly),
  };
}

/// قيد الرواتب الشهري.
///
///   مدين  6710 الرواتب الأساسية
///   مدين  6720 بدل سكن · 6730 بدل مواصلات
///   مدين  6760 عمولات البائعين
///   مدين  6740 حصة المنشأة في التأمينات
///   مدين  6750 مصروف نهاية الخدمة
///   دائن  2320 التأمينات المستحقة   (الحصّتان معًا)
///   دائن  2350 سلف موظفين           (استرداد السلفة)
///   دائن  2330 مخصّص نهاية الخدمة
///   دائن  2310 رواتب مستحقة         (الصافي)

export { computePayslip };
