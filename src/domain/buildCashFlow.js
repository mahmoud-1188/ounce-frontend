import { fromHalalas, halalas } from "../core/money.js";
import { balancesAt } from "./helpers.js";

function buildCashFlow({ journal = [], accounts = [], from, to, netProfit = 0 }) {
  const CASH = accounts.filter((a) => ["1110", "1120", "1130", "1140", "1150"].includes(a.code)).map((a) => a.code);
  const openB = balancesAt(journal, from ? new Date(new Date(from).getTime() - 1).toISOString() : null);
  const closeB = balancesAt(journal, to);
  const sumOf = (codes, src) => fromHalalas(codes.reduce((a, c) => a + (src[c] || 0), 0));
  const openCash = sumOf(CASH, openB), closeCash = sumOf(CASH, closeB);

  // التغيّر في بنود رأس المال العامل
  const delta = (code) => fromHalalas((closeB[code] || 0) - (openB[code] || 0));
  // ⚠ الإشارة من طبيعة الحساب لا من مجموعته: «السحوبات» حسابُ ملكيةٍ
  // **مدينُ الطبيعة**، فمعاملته كبقية الملكية يجعل السحب تدفّقًا موجبًا —
  // ويظهر المالك وكأنه ضخّ مالًا وهو أخذه.
  const group = (pred) => accounts.filter((a) => !a.group && pred(a))
    .map((a) => ({ code: a.code, name: a.name,
      // زيادة رصيدٍ مدين تستهلك نقدًا، وزيادة رصيدٍ دائن تُوفّره
      amount: fromHalalas(-halalas(delta(a.code))) }))
    .filter((x) => Math.abs(x.amount) > 0);

  // ⚠ زيادة الأصل تستهلك نقدًا، وزيادة الالتزام تُوفّره — الإشارة معكوسة
  const receivables = group((a) => ["1310", "1315", "1330"].includes(a.code));
  const inventory = group((a) => ["1210", "1220", "1230"].includes(a.code));
  const payables = group((a) => a.code.startsWith("2") && a.statement === "balance");
  const depreciation = fromHalalas(
    journal.filter((e) => {
      const t = new Date(e.at || e.date).getTime();
      return t >= (from ? new Date(from).getTime() : -Infinity)
        && t <= (to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity);
    }).reduce((a, e) => a + (e.lines || []).reduce((x, l) => x + (l.account === "6800" ? halalas(l.debit) : 0), 0), 0)
  );
  const S = (arr) => fromHalalas(arr.reduce((a, x) => a + halalas(x.amount), 0));
  const operating = fromHalalas(halalas(netProfit) + halalas(depreciation)
    + halalas(S(receivables)) + halalas(S(inventory)) + halalas(S(payables)));

  const investing = group((a) => a.code.startsWith("14") && a.code !== "1490");
  const financing = group((a) => ["2270", "2510", "3100", "3150", "3400"].includes(a.code));
  const invT = S(investing), finT = S(financing);
  const net = fromHalalas(halalas(operating) + halalas(invT) + halalas(finT));
  return {
    netProfit, depreciation,
    receivables, inventory, payables, operating,
    investing, investingTotal: invT,
    financing, financingTotal: finT,
    netChange: net,
    openCash, closeCash,
    // ⚠ التحقّق: الافتتاحي + التغيّر يجب أن يساوي الختامي بالضبط.
    // اختلافٌ يعني بندًا لم يُصنَّف — والقائمة لا تُسلَّم قبل أن تُصفَّر.
    reconciles: Math.abs(halalas(openCash) + halalas(net) - halalas(closeCash)) < 100,
    unexplained: fromHalalas(halalas(closeCash) - halalas(openCash) - halalas(net)),
  };
}

/// قائمة التدفّقات الوزنية — بالجرام، وهي ما يخصّ الذهب وحده.
///
/// ⚠ التدفّق النقدي لا يكفي محلّ ذهب: من باع 10 كيلو واشترى 12 تدفّقه
/// النقدي سالب وهو رابح. الوزن يُجيب عمّا لا يُجيبه الريال.

export { buildCashFlow };
