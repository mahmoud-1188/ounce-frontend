
import { fromHalalas, halalas } from "../core/money.js";
import { accountRoot, balancesAt, goldClassOf } from "./helpers.js";

/// قائمة المركز المالي.
/// قائمة المركز المالي.
///
/// تنبيه: `netProfit` يجب أن يأتي من قائمة الدخل نفسها، وهي تحسب الجرد
/// كمُعامل (`openingStock` و`closingStock`) لا كقيدٍ في الدفتر. فإن
/// لم يُرحَّل قيد الجرد، عرف الدخلُ ما لا يعرفه الميزان — والفرق يظهر
/// هنا كأنه كسر.
///
/// فنكشف الفرق ونُسمّيه بدل أن يُنسب للدفتر: `stockAdjNeeded` يقول كم
/// ينقص قيدُ الجرد ليتطابق الاثنان.
function buildBalanceSheet({ journal = [], accounts = [], to, netProfit = 0 }) {
  const b = balancesAt(journal, to);
  // قاعدة: الإشارة من جانب القسم لا من طبيعة الحساب: الأصول مدينة، والالتزامات والملكية دائنة.
  //   فالحساب المقابل (طبيعته عكس قسمه) يخرج سالبًا فيُطرح وحده. كانت الإشارة من طبيعة
  //   الحساب، فـ3400 «سحوبات الملاك» (مدين) يُجمع مع حقوق الملكية بدل أن يُطرح منها —
  //   سحبٌ بألفين يرفع الملكية ألفين، والميزانية تختلّ بأربعة آلاف.
  const pick = (pred, side) => accounts.filter((a) => !a.group && pred(a) && Math.abs(b[a.code] || 0) > 0)
    .map((a) => ({ code: a.code, name: a.name, amount: fromHalalas((b[a.code] || 0) * (side === "credit" ? -1 : 1)),
      ...(a.nature !== side ? { contra: true } : {}) }));
  // والقسم من الجذر (سلسلة الآباء) لا من أوّل رقم: 2350 «سلف موظفين» أصلٌ برمزٍ يبدأ بـ2
  const inRoot = (root) => (a) => a.statement === "balance" && accountRoot(a.code, accounts) === root;
  // تنبيه: الحسابات المقابلة (contra) تُطرح لا تُجمع.
  //
  // `1490` مجمّع الإهلاك رقمُه يبدأ بـ1 وطبيعتُه دائنة — فقلبُ الإشارة
  // يجعله موجبًا ويُجمع مع الأصول. والصواب أن يُطرح منها: أصلٌ بستّين
  // ألفًا أُهلك أربعةَ عشر يساوي ستةً وأربعين، لا أربعةً وسبعين.
  //
  // الفرق كان ضعف المجمّع بالضبط.
  const assets = pick(inRoot("1000"), "debit");
  const liabilities = pick(inRoot("2000"), "credit");
  const equity = pick(inRoot("3000"), "credit");
  const S = (arr) => fromHalalas(arr.reduce((a, x) => a + halalas(x.amount), 0));
  // قاعدة: مخزون الذهب بصنفيه (قرار المالك): مشغول = المُدخل بالتكويد · غير مشغول = الكسر
  const goldOf = (cls) => assets.filter((x) => goldClassOf(x.code) === cls);
  const goldClasses = { worked: { rows: goldOf("worked"), amount: S(goldOf("worked")) }, unworked: { rows: goldOf("unworked"), amount: S(goldOf("unworked")) } };
  const assetsT = S(assets), liabT = S(liabilities), eqT = S(equity);
  // تنبيه: ربح الفترة يُضاف لحقوق الملكية ولم يُقفل بعد: بلاه لا تتوازن القائمة
  // أبدًا قبل الإقفال السنوي، ويظنّ القارئ الدفتر مكسورًا.
  // تنبيه: صافي الدفتر: أرصدة 4xxx و5xxx و6xxx حتى التاريخ — بعد قيود إقفال السنة. هو الربح الذي لم يُنقل بعد إلى
  //   الأرباح المحتجزة، وهو ما يُضاف لحقوق الملكية. كان يُضاف `netProfit` (ربح الفترة المعروضة): بعد إقفال سنةٍ
  //   داخل الفترة يُعدّ ربحها مرّتين — في 3300 وفي «ربح الفترة» — فلا تتوازن القائمة.
  const ledgerNet = fromHalalas(-accounts
    .filter((a) => !a.group && a.statement === "income")
    .reduce((acc, a) => acc + (b[a.code] || 0), 0));
  const eqWithProfit = fromHalalas(halalas(eqT) + halalas(ledgerNet));
  const diff = fromHalalas(halalas(assetsT) - halalas(liabT) - halalas(eqWithProfit));
  const stockAdjNeeded = fromHalalas(halalas(netProfit) - halalas(ledgerNet));

  return {
    assets, liabilities, equity, goldClasses,
    netProfit, ledgerNet, stockAdjNeeded,
    assetsTotal: assetsT, liabilitiesTotal: liabT, equityTotal: eqWithProfit,
    balanced: Math.abs(halalas(diff)) < 100,
    difference: diff,
    // تنبيه: سببٌ مُسمّى بدل «لا يتوازن»: من قرأ الأخيرة ظنّ دفتره مكسورًا،
    // ومن قرأ «ينقص قيد جرد بـ524,964» عرف ما يفعل.
    // قاعدة: الملكية بربح الدفتر غير المُقفل: الفرق لا يكون إلا من دفترٍ غير متوازن — والمخزون يُقاس بقيد IFRS لا بمُعامل
    reason: Math.abs(halalas(diff)) < 100 ? null : "راجع ميزان المراجعة — الخلل في الدفتر لا في العرض",
  };
}

export { buildBalanceSheet };
