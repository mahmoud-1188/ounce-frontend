import { fromHalalas, halalas } from "../core/money.js";

function buildPayrollJournal(slips, period, actor) {
  const sum = (f) => slips.reduce((a, s) => a + halalas(f(s)), 0);
  const lines = [];
  const push = (account, debit, credit, memo) => {
    if (halalas(debit) <= 0 && halalas(credit) <= 0) return;
    lines.push({ account, debit: fromHalalas(halalas(debit)),
                 credit: fromHalalas(halalas(credit)), memo });
  };

  push("6710", fromHalalas(sum((s) => s.basic)), 0, "الرواتب الأساسية");
  push("6720", fromHalalas(sum((s) => s.housing)), 0, "بدل سكن");
  push("6730", fromHalalas(sum((s) => s.transport + s.other)), 0, "بدلات أخرى");
  push("6760", fromHalalas(sum((s) => s.commission)), 0, "عمولات البائعين");
  push("6740", fromHalalas(sum((s) => s.gosiEmployer)), 0, "حصة المنشأة");
  push("6750", fromHalalas(sum((s) => s.eosAccrual)), 0, "مخصّص نهاية الخدمة");

  push("2320", 0, fromHalalas(sum((s) => s.gosiEmployee + s.gosiEmployer)),
       "التأمينات المستحقة — الحصّتان");
  push("2350", 0, fromHalalas(sum((s) => s.advances)), "استرداد سلف");
  push("2330", 0, fromHalalas(sum((s) => s.eosAccrual)), "مخصّص نهاية الخدمة");
  push("2310", 0, fromHalalas(sum((s) => s.net)), "رواتب مستحقة");

  // ⚠ خصم الغياب يُنقص المصروف لا يزيد الإيراد
  const absent = sum((s) => s.absenceDeduction);
  if (absent > 0) push("6710", 0, fromHalalas(absent), "خصم غياب");

  const dr = lines.reduce((a, l) => a + halalas(l.debit), 0);
  const cr = lines.reduce((a, l) => a + halalas(l.credit), 0);
  return {
    entry: {
      id: `${Date.now()}pr`, ref: null, date: new Date().toISOString(),
      opType: "payroll_run",
      label: `رواتب ${period}`,
      lines, createdBy: actor || "", posted: true,
      isReversal: false, reversed: false,
    },
    balanced: dr === cr,
    totals: { debit: fromHalalas(dr), credit: fromHalalas(cr) },
    employerCost: fromHalalas(sum((s) => s.employerCost)),
    netPayable: fromHalalas(sum((s) => s.net)),
  };
}

/// مستحقّ نهاية الخدمة عند المغادرة.
///
/// ⚠ الاستقالة تختلف عن إنهاء العقد: الأولى تُقلّص المستحقّ بحسب مدة
/// الخدمة، والثانية تُوفّيه. تطبيق واحدة على الاثنتين ظلمٌ أو تكلفةٌ
/// بلا سبب.

export { buildPayrollJournal };
