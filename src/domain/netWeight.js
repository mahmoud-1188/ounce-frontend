import { PURITY } from "../core/money.js";

/// صافي الفرع بالوزن بعد الالتزامات حتى الآن: الذهب المملوك + النقد كلّه (كاش وشبكة) بسعر اليوم
/// − الالتزامات (الدائنون والرواتب المستحقّة والضريبة المستحقّة والمصروفات الثابتة المستحقّة غير المسجّلة).
/// الذمم المدينة تُعرض منفصلةً: «مع ما لنا عند الناس».
const CASH_CODES = ["1110", "1120", "1130", "1140", "1150", "1160"];
const RECEIVABLE_CODES = ["1310", "1315", "1320", "2350"];
const VAT_OUT = ["2220", "2225"], VAT_IN = "1360";
const r3 = (x) => Math.round((Number(x) || 0) * 1000) / 1000;
const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;

function accountBalances(journal = []) {
  const bal = {};
  for (const e of journal || []) {
    for (const l of e.lines || []) {
      const c = String(l.account || "");
      if (!c) continue;
      bal[c] = (bal[c] || 0) + (Number(l.debit) || 0) - (Number(l.credit) || 0);
    }
  }
  return bal;
}

function netWeightPosition({ journal = [], price24 = 0, goldOwned24 = 0, fixedDue = [], baseKarat = 21, accountName = (c) => c } = {}) {
  const p = Number(price24) || 0;
  const k = Number(baseKarat) === 24 ? 24 : 21;
  const perGram = p * (PURITY[k] || k / 24);
  const toG = (v) => (perGram > 0 ? (Number(v) || 0) / perGram : 0);
  const bal = accountBalances(journal);
  const cashRows = CASH_CODES.map((c) => ({ code: c, name: accountName(c), amount: r2(bal[c] || 0) })).filter((r) => Math.abs(r.amount) >= 0.005);
  const cash = r2(cashRows.reduce((a, r) => a + r.amount, 0));
  const liabRows = Object.keys(bal).filter((c) => c.startsWith("2") && c !== "2350" && !VAT_OUT.includes(c))
    .map((c) => ({ code: c, name: accountName(c), amount: r2(-(bal[c] || 0)) })).filter((r) => r.amount >= 0.005);
  const vatNet = r2(VAT_OUT.reduce((a, c) => a - (bal[c] || 0), 0) - (bal[VAT_IN] || 0));
  if (Math.abs(vatNet) >= 0.005) liabRows.push({ code: "vat", name: vatNet >= 0 ? "ضريبة القيمة المضافة — صافي المستحقّ" : "ضريبة القيمة المضافة — مدخلاتٌ زائدة لنا", amount: vatNet });
  const dueRows = (fixedDue || []).map((f) => ({ code: `fx:${f.id}`, name: `${f.name} — مستحقٌّ لم يُسجَّل`, amount: r2(f.amount) }));
  const liabilities = r2([...liabRows, ...dueRows].reduce((a, r) => a + r.amount, 0));
  const recvRows = RECEIVABLE_CODES.map((c) => ({ code: c, name: accountName(c), amount: r2(bal[c] || 0) })).filter((r) => r.amount >= 0.005);
  const receivables = r2(recvRows.reduce((a, r) => a + r.amount, 0));
  // الذهب المملوك بعيار الاحتساب
  const goldK = r3((Number(goldOwned24) || 0) / (PURITY[k] || k / 24));
  const net = r3(goldK + toG(cash) - toG(liabilities));
  return {
    karat: k, price24: p, priceMissing: !(perGram > 0),
    gold: { grams: goldK },
    cash: { rows: cashRows, total: cash, grams: r3(toG(cash)) },
    liabilities: { rows: [...liabRows, ...dueRows], total: liabilities, grams: r3(toG(liabilities)) },
    receivables: { rows: recvRows, total: receivables, grams: r3(toG(receivables)) },
    net: { grams: net, withReceivables: r3(net + toG(receivables)), value: r2(net * perGram) },
  };
}

export { accountBalances, netWeightPosition };
