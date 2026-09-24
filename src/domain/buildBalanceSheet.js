import { fmtMoney, fromHalalas, halalas } from "../core/money.js";
import { balancesAt } from "./helpers.js";

function buildBalanceSheet({ journal = [], accounts = [], to, netProfit = 0 }) {
  const b = balancesAt(journal, to);
  const pick = (pred) => accounts.filter((a) => !a.group && pred(a) && Math.abs(b[a.code] || 0) > 0)
    .map((a) => ({ code: a.code, name: a.name, amount: fromHalalas((b[a.code] || 0) * (a.nature === "credit" ? -1 : 1)) }));
  // ⚠ **الحسابات المقابلة** (contra) تُطرح لا تُجمع.
  //
  // `1490` مجمّع الإهلاك رقمُه يبدأ بـ1 وطبيعتُه دائنة — فقلبُ الإشارة
  // يجعله موجبًا **ويُجمع مع الأصول**. والصواب أن يُطرح منها: أصلٌ بستّين
  // ألفًا أُهلك أربعةَ عشر يساوي ستةً وأربعين، لا أربعةً وسبعين.
  //
  // كشفته محاكاة سنةِ عمل: الفرق كان ضعف المجمّع بالضبط.
  const assets = pick((a) => a.code.startsWith("1") && a.statement === "balance")
    .map((x) => {
      const acc = accounts.find((a) => a.code === x.code);
      return acc?.nature === "credit" ? { ...x, amount: -x.amount, contra: true } : x;
    });
  const liabilities = pick((a) => a.code.startsWith("2") && a.statement === "balance");
  const equity = pick((a) => a.code.startsWith("3") && a.statement === "balance");
  const S = (arr) => fromHalalas(arr.reduce((a, x) => a + halalas(x.amount), 0));
  const assetsT = S(assets), liabT = S(liabilities), eqT = S(equity);
  // ⚠ ربح الفترة يُضاف لحقوق الملكية ولم يُقفل بعد: بلاه لا تتوازن القائمة
  // أبدًا قبل الإقفال السنوي، ويظنّ القارئ الدفتر مكسورًا.
  const eqWithProfit = fromHalalas(halalas(eqT) + halalas(netProfit));
  const diff = fromHalalas(halalas(assetsT) - halalas(liabT) - halalas(eqWithProfit));

  // ⚠ صافي الدفتر: أرصدة 4xxx و5xxx و6xxx كما هي، بلا مُعاملات الجرد.
  // الفرق بينه وبين `netProfit` هو **بالضبط** قيد الجرد غير المُرحَّل.
  const ledgerNet = fromHalalas(-accounts
    .filter((a) => !a.group && a.statement === "income")
    .reduce((acc, a) => acc + (b[a.code] || 0), 0));
  const stockAdjNeeded = fromHalalas(halalas(netProfit) - halalas(ledgerNet));

  return {
    assets, liabilities, equity,
    netProfit, ledgerNet, stockAdjNeeded,
    assetsTotal: assetsT, liabilitiesTotal: liabT, equityTotal: eqWithProfit,
    balanced: Math.abs(halalas(diff)) < 100,
    difference: diff,
    // ⚠ سببٌ مُسمّى بدل «لا يتوازن»: من قرأ الأخيرة ظنّ دفتره مكسورًا،
    // ومن قرأ «ينقص قيد جرد بـ524,964» عرف ما يفعل.
    reason: Math.abs(halalas(diff)) < 100
      ? null
      // ⚠ الإشارة: الفرق في المركز = −(فرق الربح). ربحٌ أعلى في القائمة
      // يعني حقوق ملكيةٍ أعلى، فالأصول تبدو أنقص بنفس المقدار.
      : Math.abs(halalas(diff) + halalas(stockAdjNeeded)) < 200
        ? `ينقص قيد تسوية المخزون بـ${fmtMoney(Math.abs(stockAdjNeeded))} — رحّله من التسويات الجردية`
        : "راجع ميزان المراجعة — الخلل في الدفتر لا في العرض",
  };
}

/// قائمة التغيّر في حقوق الملكية.

export { buildBalanceSheet };
