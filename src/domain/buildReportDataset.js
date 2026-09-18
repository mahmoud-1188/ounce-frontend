import { fine24, fromHalalas, halalas, roundW } from "../core/money.js";
import { isLiveScrap } from "./helpers.js";
import { key } from "./key.js";

function buildReportDataset(range, stores = {}) {
  const {
    sales = [], returns = [], expenses = [], cashTx = [], safeTx = [],
    scrapCustodyTx = [], safeGoldTx = [],
    items = [], lots = [], scrapEntries = [], journal = [],
    priceData = {},
  } = stores;
  // ⚠ سعر اليوم للتقويم لا للحساب.
  //
  // الأوزان تبقى أوزانًا والمبالغ مبالغ. والسعر يُستعمل مرةً واحدة:
  // ليقول «هذا الوزن يساوي كذا اليوم» — ولا يُحوَّل به وزنٌ إلى رقمٍ
  // يُجمع مع النقد.
  const p24 = Number(priceData.current) || 0;
  // ⚠ `commissions` كائنٌ لا مصفوفة: قواعد العمولة لكل بائع، لا سجل
  // العمولات المستحقّة. وتخريطُه كمصفوفة يرمي «not iterable» ويُسقط
  // الشاشة كلّها.
  //
  // وسجل العمولات يُشتقّ من المبيعات لا من مخزنٍ مستقلّ.
  const commissionRows = Array.isArray(stores.commissionLog)
    ? stores.commissionLog : [];
  const inR = (d) => {
    const t = Date.parse(d || "");
    return Number.isFinite(t) && t >= range.from && t <= range.to;
  };

  // ── مبيعات ──
  let salesCount = 0, salesGross = 0, salesTax = 0, salesWeight = 0, salesCost = 0;
  const byPay = {}, bySeller = {}, byDay = {};
  const saleRows = [];
  for (const s of sales) {
    if (!inR(s.date)) continue;
    salesCount += 1;
    const total = halalas(s.total);
    salesGross += total;
    salesTax += halalas(s.taxAmount || 0);
    salesCost += halalas(s.costTotal || 0);
    const w = (s.lines || []).reduce((a, l) => a + (Number(l.weight) || 0), 0);
    salesWeight += w;
    const pm = s.paymentMethod || "cash";
    byPay[pm] = (byPay[pm] || 0) + total;
    const sk = s.sellerName || s.createdBy || "—";
    if (!bySeller[sk]) bySeller[sk] = { total: 0, count: 0, weight: 0 };
    bySeller[sk].total += total;
    bySeller[sk].count += 1;
    bySeller[sk].weight += w;
    const dk = String(s.date).slice(0, 10);
    byDay[dk] = (byDay[dk] || 0) + total;
    // ⚠ المعادل يُحسب هنا لا لاحقًا: السطر يحمل عياره، والفاتورة قد
    // تحمل عيارات مختلفة — فجمعُها بعد فقدان العيار مستحيل.
    const fineW = (s.lines || []).reduce(
      (a, l) => a + fine24(l.weight, l.karat ?? s.karat ?? 21), 0);
    saleRows.push({
      ref: s.ref, date: s.date, customer: s.customerName || "نقدي",
      lines: (s.lines || []).length, weight: w, fine: roundW(fineW),
      total: fromHalalas(total), method: pm, seller: sk,
    });
  }

  // ── مرتجعات ──
  let retCount = 0, retTotal = 0;
  const retRows = [];
  for (const r of returns) {
    if (!inR(r.date)) continue;
    retCount += 1;
    const t = halalas(r.total || r.amount || 0);
    retTotal += t;
    retRows.push({ ref: r.ref, date: r.date, total: fromHalalas(t),
      reason: r.reason || "—" });
  }

  // ── مصروفات ──
  let expTotal = 0;
  const byExpCat = {}, expRows = [];
  for (const e of expenses) {
    if (!inR(e.date)) continue;
    const a = halalas(e.amount);
    expTotal += a;
    const c = e.category || "misc";
    byExpCat[c] = (byExpCat[c] || 0) + a;
    expRows.push({ ref: e.ref, date: e.date, desc: e.description || "—",
      category: c, amount: fromHalalas(a) });
  }

  // ── مشتريات ──
  let buyCount = 0, buyWeight = 0, buyCost = 0;
  const buyRows = [];
  for (const l of lots) {
    if (!inR(l.date)) continue;
    buyCount += 1;
    buyWeight += Number(l.weight) || 0;
    buyCost += halalas(l.totalCost || 0);
    buyRows.push({ ref: l.ref, date: l.date, karat: l.karat,
      weight: Number(l.weight) || 0, pieces: Number(l.pieces) || 0,
      cost: fromHalalas(halalas(l.totalCost || 0)) });
  }

  // ── كسر ──
  let scrapCount = 0, scrapWeight = 0, scrapPaid = 0;
  const scrapRows = [];
  for (const e of scrapEntries) {
    if (!inR(e.date)) continue;
    scrapCount += 1;
    scrapWeight += Number(e.weight) || 0;
    scrapPaid += halalas(e.total || 0);
    scrapRows.push({ ref: e.ref, date: e.date, karat: e.karat,
      weight: Number(e.weight) || 0, paid: fromHalalas(halalas(e.total || 0)),
      stage: e.stage || "" });
  }

  // ── عمولات ──
  let commTotal = 0;
  for (const c of commissionRows) {
    if (!inR(c.date)) continue;
    commTotal += halalas(c.amount || 0);
  }

  const net = salesGross - retTotal;
  const profit = net - salesCost - expTotal;

  // ══ الرصيد الحالي — نقدًا ووزنًا ══
  //
  // ⚠ الرصيد لا يتبع المدى.
  //
  // «كم عندي الآن» سؤالٌ عن اللحظة لا عن الفترة. ومن يقرأ رصيدًا
  // مُصفّى بشهرٍ مضى يظنّ خزنته فارغة — وهي مليئة بما دخل بعده.
  const nowCash = (arr) => arr.reduce(
    (a, t) => a + (t.type === "out" ? -halalas(t.amount) : halalas(t.amount)), 0);
  const cashNowDaily = nowCash(cashTx);
  const cashNowSafe = nowCash(safeTx);
  const cashNowCustody = nowCash(scrapCustodyTx);

  // الوزن الحاضر: مشغولٌ متاح + كسرٌ حيّ + خزنة
  let wCrafted = 0, wScrap = 0, wVault = 0;
  const wByKarat = {};
  const bump = (k, w, key) => {
    const kk = Number(k) || 21;
    if (!wByKarat[kk]) wByKarat[kk] = { crafted: 0, scrap: 0, vault: 0 };
    wByKarat[kk][key] = roundW(wByKarat[kk][key] + (Number(w) || 0));
  };
  for (const it of items) {
    const avail = (it.units || []).filter((u) => !u.sold && !u.issued).length;
    if (!avail) continue;
    const w = (Number(it.weight) || 0) * avail;
    bump(it.karat, w, "crafted");
    wCrafted += fine24(w, it.karat);
  }
  for (const e of scrapEntries) {
    if (!isLiveScrap(e)) continue;
    bump(e.karat, e.weight, "scrap");
    wScrap += fine24(e.weight, e.karat);
  }
  for (const t of safeGoldTx) {
    const sign = t.type === "out" ? -1 : 1;
    bump(t.karat, sign * (Number(t.weight) || 0), "vault");
    wVault += sign * fine24(t.weight, t.karat);
  }
  const fineNow = roundW(wCrafted + wScrap + Math.max(0, wVault));

  return {
    range,
    // ⚠ الفترة المستقبلية بلا حركة — نُعلّمها لا نعرضها صفرًا صامتًا
    empty: salesCount === 0 && buyCount === 0 && expTotal === 0 && scrapCount === 0,
    kpi: {
      salesCount,
      salesGross: fromHalalas(salesGross),
      salesNet: fromHalalas(net),
      salesTax: fromHalalas(salesTax),
      salesWeight: roundW(salesWeight),
      cogs: fromHalalas(salesCost),
      grossProfit: fromHalalas(net - salesCost),
      expenses: fromHalalas(expTotal),
      commissions: fromHalalas(commTotal),
      netProfit: fromHalalas(profit),
      returns: fromHalalas(retTotal),
      retCount,
      buyCount,
      buyWeight: roundW(buyWeight),
      buyCost: fromHalalas(buyCost),
      scrapCount,
      scrapWeight: roundW(scrapWeight),
      scrapPaid: fromHalalas(scrapPaid),
      avgTicket: salesCount ? fromHalalas(Math.round(net / salesCount)) : 0,

      // ══ بُعد الوزن ══
      //
      // ⚠ بمعادل 24 لا بالخام: العيارات لا تُجمع، ومقارنة الخام بالخام
      // تُظهر نموًّا وهميًا حين يتحوّل 24 إلى 18.
      soldFine: roundW(saleRows.reduce(
        (a, r) => a + (Number(r.fine) || 0), 0)),
      boughtFine: roundW(buyRows.reduce(
        (a, r) => a + fine24(r.weight, r.karat), 0)),
      scrapFine: roundW(scrapRows.reduce(
        (a, r) => a + fine24(r.weight, r.karat), 0)),
      // صافي حركة الوزن في المدى: ما دخل ناقص ما خرج
      netFine: roundW(
        buyRows.reduce((a, r) => a + fine24(r.weight, r.karat), 0)
        + scrapRows.reduce((a, r) => a + fine24(r.weight, r.karat), 0)
        - saleRows.reduce((a, r) => a + (Number(r.fine) || 0), 0)),
    },

    // ══ الرصيد الآن — لا يتبع المدى ══
    balanceNow: {
      cash: {
        daily: fromHalalas(cashNowDaily),
        safe: fromHalalas(cashNowSafe),
        custody: fromHalalas(cashNowCustody),
        total: fromHalalas(cashNowDaily + cashNowSafe + cashNowCustody),
      },
      gold: {
        crafted: roundW(wCrafted),
        scrap: roundW(wScrap),
        vault: roundW(Math.max(0, wVault)),
        fine: fineNow,
        byKarat: Object.entries(wByKarat)
          .filter(([, v]) => Math.abs(v.crafted + v.scrap + v.vault) > 0.0005)
          .map(([k, v]) => ({
            karat: Number(k),
            crafted: roundW(v.crafted),
            scrap: roundW(v.scrap),
            vault: roundW(v.vault),
            fine: roundW(fine24(v.crafted + v.scrap + Math.max(0, v.vault), k)),
          }))
          .sort((a, b) => b.karat - a.karat),
        // ⚠ التقويم مرجعٌ لا رصيد: يقول «هذا الوزن يساوي كذا اليوم»،
        // ولا يُجمع مع النقد — الوزن يبقى وزنًا.
        valuedAt: p24,
        value: fromHalalas(Math.round(fineNow * p24 * 100)),
      },
    },
    byPay: Object.fromEntries(
      Object.entries(byPay).map(([k, v]) => [k, fromHalalas(v)])),
    byExpCat: Object.fromEntries(
      Object.entries(byExpCat).map(([k, v]) => [k, fromHalalas(v)])),
    bySeller: Object.entries(bySeller)
      .map(([name, v]) => ({ name, total: fromHalalas(v.total),
        count: v.count, weight: roundW(v.weight) }))
      .sort((a, b) => b.total - a.total),
    byDay: Object.entries(byDay)
      .map(([d, v]) => ({ day: d, total: fromHalalas(v) }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    rows: { sales: saleRows, returns: retRows, expenses: expRows,
      purchases: buyRows, scrap: scrapRows },
  };
}

/// الفرق بين مجموعتين.
///
/// ⚠ القسمة على صفرٍ تُعطي Infinity.
///
/// من كان بيعه أمس صفرًا واليوم ألفًا لا يُقال «نموّ ∞٪» — يُقال «من
/// لا شيء». والرقم اللانهائي في تقرير يجعل قارئه يشكّ في كل ما فيه.

export { buildReportDataset };
