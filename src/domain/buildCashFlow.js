
import { fromHalalas, halalas } from "../core/money.js";
import { accountRoot, balancesAt } from "./helpers.js";

/// قائمة التدفقات النقدية — الطريقة غير المباشرة.
function buildCashFlow({ journal = [], accounts = [], from, to, netProfit = 0 }) {
  // تنبيه: البنك (1160) والنقد في الطريق بين الفروع (1170) نقدٌ أيضًا: كان إيداعٌ في البنك يظهر
  //   «نقصًا في النقد» بلا تفسير، والقائمة لا تتصالح.
  const CASH = accounts.filter((a) => ["1110", "1120", "1130", "1140", "1150", "1160", "1170"].includes(a.code)).map((a) => a.code);
  const openB = (from ? balancesAt(journal, new Date(new Date(from).getTime() - 1).toISOString()) : {});
  const closeB = balancesAt(journal, to);
  const sumOf = (codes, src) => fromHalalas(codes.reduce((a, c) => a + (src[c] || 0), 0));
  const openCash = sumOf(CASH, openB), closeCash = sumOf(CASH, closeB);

  // التغيّر في بنود رأس المال العامل
  const delta = (code) => fromHalalas((closeB[code] || 0) - (openB[code] || 0));
  // تنبيه: الإشارة من طبيعة الحساب لا من مجموعته: «السحوبات» حسابُ ملكيةٍ
  // مدينُ الطبيعة، فمعاملته كبقية الملكية يجعل السحب تدفّقًا موجبًا —
  // ويظهر المالك وكأنه ضخّ مالًا وهو أخذه.
  const group = (pred) => accounts.filter((a) => !a.group && pred(a))
    .map((a) => ({ code: a.code, name: a.name,
      // زيادة رصيدٍ مدين تستهلك نقدًا، وزيادة رصيدٍ دائن تُوفّره
      amount: fromHalalas(-halalas(delta(a.code))) }))
    .filter((x) => Math.abs(x.amount) > 0);

  // تنبيه: زيادة الأصل تستهلك نقدًا، وزيادة الالتزام تُوفّره — الإشارة معكوسة
  // قاعدة: كل حساب ميزانيةٍ في قسمٍ واحد بالضبط — القوائم الثابتة كانت تُسقط 1225 · 1240 · 1246 · 1290 ·
  //   1320 · 1340 · 1350 · 3200 وغيرها، فيبقى تغيّرها «غير مفسَّر». والباقي خارجها عمدًا: النقد نفسه،
  //   و1490 (الإهلاك يُضاف من 6800)، و3300 (الربح المحتجز يدخل من صافي الربح).
  const FIN_LIAB = ["2270", "2510"];
  const isBS = (a) => a.statement === "balance";
  const root = (a) => accountRoot(a.code, accounts);
  const isInvesting = (a) => a.code.startsWith("14") && a.code !== "1490";
  const isFinancing = (a) => FIN_LIAB.includes(a.code) || (root(a) === "3000" && a.code !== "3300");
  const receivables = group((a) => isBS(a) && root(a) === "1000" && !CASH.includes(a.code) && !a.code.startsWith("12") && !a.code.startsWith("14"));
  const inventory = group((a) => isBS(a) && a.code.startsWith("12"));
  const payables = group((a) => isBS(a) && root(a) === "2000" && !isFinancing(a));
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

  const investing = group(isInvesting);
  const financing = group((a) => isBS(a) && isFinancing(a));
  const invT = S(investing), finT = S(financing);
  const net = fromHalalas(halalas(operating) + halalas(invT) + halalas(finT));
  return {
    netProfit, depreciation,
    receivables, inventory, payables, operating,
    investing, investingTotal: invT,
    financing, financingTotal: finT,
    netChange: net,
    openCash, closeCash,
    // تنبيه: التحقّق: الافتتاحي + التغيّر يجب أن يساوي الختامي بالضبط.
    // اختلافٌ يعني بندًا لم يُصنَّف — والقائمة لا تُسلَّم قبل أن تُصفَّر.
    reconciles: Math.abs(halalas(openCash) + halalas(net) - halalas(closeCash)) < 100,
    unexplained: fromHalalas(halalas(closeCash) - halalas(openCash) - halalas(net)),
  };
}

export { buildCashFlow };
