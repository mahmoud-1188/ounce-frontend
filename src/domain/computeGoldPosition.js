import { weightTrialBalance } from "./helpers.js";

function computeGoldPosition({
  weightBalance,        // من weightTrialBalance
  cashTotal = 0,        // كل النقد: خزنة + صندوق + عهدة + شبكة
  receivables = 0,      // ذمم العملاء بالريال
  cashPayables = 0,     // ما عليك بالريال (أجور مورّدين، مستحقات)
  price24 = 0,
}) {
  const rows = weightBalance?.rows || [];
  const sum = (pred) => rows.filter(pred).reduce((a, r) => a + (r.net || 0) * (r.karat || 24) / 24, 0);

  // ① الذهب المادي — كل حساب أصلٍ وزني (1xxx)
  const physical = {
    inventory: sum((r) => ["1210", "1245", "1290"].includes(String(r.code))),
    scrap:     sum((r) => ["1220", "1225", "1230"].includes(String(r.code))),
    atOffices: sum((r) => String(r.code) === "1240"),
    inTransit: sum((r) => String(r.code) === "1246"),
  };
  physical.total = physical.inventory + physical.scrap + physical.atOffices + physical.inTransit;

  // ② ما عليك ذهبًا — حسابات الالتزام الوزنية (2xxx) رصيدها سالبٌ بطبيعته
  const goldOwed = {
    suppliers: -sum((r) => String(r.code) === "2110"),
    offices:   -sum((r) => String(r.code) === "2130"),
    customers: -sum((r) => String(r.code) === "2420"),   // أمانات
  };
  goldOwed.total = goldOwed.suppliers + goldOwed.offices + goldOwed.customers;

  // ③ النقد وما في حكمه — مقابله بالجرام بسعر اليوم
  const p = Number(price24) || 0;
  const toG = (v) => (p > 0 ? (Number(v) || 0) / p : 0);
  const cashSide = {
    cash: toG(cashTotal),
    receivables: toG(receivables),
    payables: -toG(cashPayables),
  };
  cashSide.total = cashSide.cash + cashSide.receivables + cashSide.payables;

  const net = physical.total - goldOwed.total + cashSide.total;
  return {
    price24: p,
    physical, goldOwed, cashSide,
    // صافي ما تملكه من ذهبٍ فعلًا
    ownedGold: physical.total - goldOwed.total,
    // المركز الكامل — الذهب وما يُعادله
    net: Math.round(net * 1000) / 1000,
    // ⚠ بلا سعرٍ لا يُحسب النقد — ويُعلَن ذلك لا يُخفى
    priceMissing: p <= 0,
  };
}

/// ربح السنة بالجرام: الختامي − الافتتاحي.
///
/// ⚠ التوزيع بين «تجارة» و«سعر» يُعرض للفهم لا للقيد: كلاهما ربحٌ
/// بالجرام. لكن المالك يريد أن يعرف: هل زاد ذهبي لأني تاجرتُ جيدًا، أم
/// لأن السعر صعد وعندي ريالاتٌ صارت تشتري أقلّ؟

export { computeGoldPosition };
