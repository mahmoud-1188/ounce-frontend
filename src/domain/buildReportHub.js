import { EXPENSE_CATEGORIES } from "../core/constants.js";
import { fmtMoney } from "../core/money.js";
import { buildCashFlow } from "./buildCashFlow.js";
import { buildIncomeStatement } from "./buildIncomeStatement.js";
import { remainingQty } from "./helpers.js";
import { buildBalanceSheet } from "./buildBalanceSheet.js";

function buildReportHub({
  journal = [], accounts = [], goldLedger = [], sales = [], returns = [], lots = [], expenses = [],
  items = [], customers = [], suppliers = [], scrapEntries = [], users = [],
  cashBalance = {}, safeBalance = {}, safeGoldBalance = {}, totals = {}, taxRate = 0.15,
  reservations = [], audits = [], cashTx = [], safeTx = [], partners = [], partnersTotals = {},
  taskirOffices = [], taskirEntries = [], bankRecons = [], lastBankRecon = null,
  from, to, currency = "ر.س",
}) {
  const inR = (d) => { const t = d ? String(d) : ""; return t >= from && t <= to; };
  const c = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const je = journal.filter((e) => !e.voided);
  const jeIn = je.filter((e) => inR(e.date));

  // ── الأرصدة التراكمية حتى نهاية الفترة (للمركز والذمم) ──
  // ⚠ قيدٌ بلا تاريخ = افتتاحيّ، يُحتسب دائمًا: `String(undefined) > to` كان
  //   يُقصيه فتظهر الخزنة −491,010 وهي +208,990. كشفته المطابقات نفسها.
  const upTo = (e) => !e.date || String(e.date) <= to;
  const bal = {};
  for (const e of je) { if (!upTo(e)) continue;
    for (const l of e.lines || []) bal[l.account] = (bal[l.account] || 0) + c(l.debit) - c(l.credit); }
  const acc = (code) => c(bal[code] || 0);
  const name = (code) => accounts.find((a) => a.code === code)?.name || code;

  // ── القوائم ──
  const income = buildIncomeStatement({ journal: je, accounts, from, to });
  // ⚠ **المركز المالي يحتاج ربحًا تراكميًّا لا ربح الفترة:** أرصدته حتى `to`
  //   من أول الدفتر، فربحُ الشهر وحده يجعله «لا يتوازن» — وهو متوازن. الصفحة
  //   الرسمية تحسب الربح من أول السنة؛ هنا من أول قيدٍ حتى `to` — لأنّ الأرباح
  //   المحتجزة لا تُرحَّل آليًّا عند الإقفال في كل الدفاتر.
  const firstDate = je.reduce((a, e) => (!a || String(e.date) < a ? String(e.date) : a), "") || from;
  const cumFrom = firstDate < from ? firstDate : from;
  const incomeCum = cumFrom === from ? income : buildIncomeStatement({ journal: je, accounts, from: cumFrom, to });
  const bs = buildBalanceSheet({ journal: je, accounts, to, netProfit: incomeCum.netProfit });
  const cf = buildCashFlow({ journal: je, accounts, from, to, netProfit: income.netProfit });

  // ── ميزان المراجعة للفترة ──
  let tbDr = 0, tbCr = 0; const tbRows = {};
  for (const e of jeIn) for (const l of e.lines || []) {
    tbDr += c(l.debit); tbCr += c(l.credit);
    const r = tbRows[l.account] || (tbRows[l.account] = { code: l.account, name: name(l.account), debit: 0, credit: 0 });
    r.debit += c(l.debit); r.credit += c(l.credit);
  }
  const tbList = Object.values(tbRows).sort((a, b) => a.code.localeCompare(b.code));

  // ── الذمم ──
  const arByCust = {};
  for (const e of je) { if (!upTo(e)) continue;
    for (const l of e.lines || []) if (l.account === "1310" && l.party) arByCust[l.party] = (arByCust[l.party] || 0) + c(l.debit) - c(l.credit); }
  // ⚠ بطريقة التطبيق نفسها (الموقف الذهبيّ): الآجلة غير المسوّاة − المدفوع منها
  const arRows = Object.keys(arByCust).length
    ? Object.entries(arByCust).map(([id, v]) => ({ id, label: customers.find((x) => x.id === id)?.name || id, amount: c(v) }))
    : (() => { const m = {}; for (const s2 of sales) { if (s2.voided || s2.paymentMethod !== "credit" || s2.settled || (s2.date && String(s2.date) > to)) continue;
        const due = c((Number(s2.total) || 0) - (Number(s2.paidAmount) || 0)); if (due <= 0) continue;
        const k = s2.customerId || s2.customerName || "—"; m[k] = (m[k] || 0) + due; }
        return Object.entries(m).map(([id, v]) => ({ id, label: customers.find((x) => x.id === id)?.name || (sales.find((s2) => s2.customerId === id)?.customerName) || id, amount: c(v) })); })();
  const arTotal = c(arRows.reduce((a, r) => a + r.amount, 0));
  const apFee = -acc("2120"), apGoldFine = (() => { let g = 0; for (const x of goldLedger) { if (x.accountCode !== "2110" || (x.date && String(x.date) > to)) continue;
      const f = (Number(x.weight) || 0) * (Number(x.karat) || 24) / 24; g += x.type === "in" ? f : -f; } return Math.round(Math.abs(g) * 1000) / 1000; })();
  const deposits = -acc("2210");

  // ── العمليات ──
  const salesIn = sales.filter((s) => !s.voided && inR(s.date));
  const salesTotal = c(salesIn.reduce((a, s) => a + (Number(s.total) || 0), 0));
  const bySeller = {}; for (const s of salesIn) { const k = s.createdBy || "—"; bySeller[k] = (bySeller[k] || { n: 0, t: 0 }); bySeller[k].n++; bySeller[k].t += Number(s.total) || 0; }
  const byMethod = {}; for (const s of salesIn) { const k = s.paymentMethod || "—"; byMethod[k] = (byMethod[k] || 0) + (Number(s.total) || 0); }
  const retIn = returns.filter((r) => inR(r.date || r.createdAt));
  const retTotal = c(retIn.reduce((a, r) => a + (Number(r.refund) || Number(r.total) || 0), 0));
  const lotsIn = lots.filter((l) => inR(l.date));
  const purchTotal = c(lotsIn.reduce((a, l) => a + (Number(l.goldCost) || 0) + (Number(l.workmanshipTotal) || 0), 0));
  const purchWeight = Math.round(lotsIn.reduce((a, l) => a + (Number(l.weight) || 0), 0) * 1000) / 1000;
  const bySupplier = {}; for (const l of lotsIn) { const k = l.supplierId || "—"; bySupplier[k] = (bySupplier[k] || { w: 0, t: 0 }); bySupplier[k].w += Number(l.weight) || 0; bySupplier[k].t += (Number(l.goldCost) || 0) + (Number(l.workmanshipTotal) || 0); }
  const expIn = expenses.filter((x) => inR(x.date || x.createdAt));
  const expTotal = c(expIn.reduce((a, x) => a + (Number(x.amount) || 0), 0));
  const byCat = {}; for (const x of expIn) { const k = x.category || "—"; byCat[k] = (byCat[k] || 0) + (Number(x.amount) || 0); }
  const vatOut = c(salesTotal - salesTotal / (1 + taxRate));
  const vatIn = c(-acc("1410") > 0 ? 0 : 0);

  // ── الذهب ──
  const goldByAcc = {}; for (const x of goldLedger) { if (x.date && String(x.date) > to) continue;
    const f = (Number(x.weight) || 0) * (Number(x.karat) || 24) / 24; goldByAcc[x.accountCode] = (goldByAcc[x.accountCode] || 0) + (x.type === "in" ? f : -f); }
  const g3 = (v) => Math.round((v || 0) * 1000) / 1000;
  const goldRows = Object.entries(goldByAcc).filter(([k, v]) => k.startsWith("1") && Math.abs(v) > 0.0005)
    .map(([k, v]) => ({ id: k, label: name(k), amount: g3(v), unit: "جم24" })).sort((a, b) => b.amount - a.amount);
  const goldOwned = g3(goldRows.reduce((a, r) => a + r.amount, 0) - Math.abs(goldByAcc["2110"] || 0) * 0);
  const byKarat = {}; for (const it of items) { if (it.voided) continue; const left = remainingQty(it);
    if (!left) continue; const k = String(it.karat || "—"); byKarat[k] = (byKarat[k] || { pcs: 0, w: 0 }); byKarat[k].pcs += left; byKarat[k].w += (Number(it.weight) || 0) * (it.units?.length ? left : 1); }

  // ── المطابقات ──
  const near = (a, b2, eps = 0.01) => Math.abs((Number(a) || 0) - (Number(b2) || 0)) <= eps;
  // ⚠ «كم بقي» بدالّة التطبيق نفسها (`remainingQty`) — لا بحسابٍ موازٍ يختلف عن شاشة المخزون
  const soldFine = g3(items.filter((it) => !it.voided).reduce((a, it) => a + remainingQty(it) * ((Number(it.weight) || 0) * (Number(it.karat) || 21)) / 24, 0));
  const salesNet = c(salesIn.reduce((a, s2) => a + (Number(s2.netAmount) || Number(s2.total) || 0), 0));
  const revJe = c(jeIn.reduce((a, e) => a + (e.lines || []).filter((l) => /^4(?!190)/.test(String(l.account))).reduce((x, l) => x + c(l.credit) - c(l.debit), 0), 0));
  const reconRows = [
    { label: "الصندوق اليومي — نقد", ok: near(cashBalance?.cash, acc("1130")), detail: `الشاشة ${fmtMoney(cashBalance?.cash || 0)} · الدفتر ${fmtMoney(acc("1130"))}`, open: { page: "generalLedger", account: "1130" } },
    { label: "الخزنة — نقد", ok: near(safeBalance?.cash, acc("1110")), detail: `الشاشة ${fmtMoney(safeBalance?.cash || 0)} · الدفتر ${fmtMoney(acc("1110"))}`, open: { page: "generalLedger", account: "1110" } },
    { label: "ذمم العملاء", ok: near(arTotal, acc("1310"), 0.05), detail: `الفواتير ${fmtMoney(arTotal)} · الدفتر ${fmtMoney(acc("1310"))}`, open: { page: "generalLedger", account: "1310" } },
    { label: "إيراد الفترة", ok: near(salesNet, revJe, 0.05),
      detail: `صافي الفواتير ${fmtMoney(salesNet)} · حسابات الإيراد ${fmtMoney(revJe)}`, open: { page: "generalLedger", account: "4100" } },
    { label: "المخزون الوزني", ok: Math.abs((goldByAcc["1210"] || 0) - soldFine) < 0.005 || !items.length, detail: `القطع ${soldFine.toFixed(3)} · الدفتر ${g3(goldByAcc["1210"] || 0).toFixed(3)} جم24`, open: { page: "trialBalance" } },
  ];
  const reconAll = reconRows.every((r) => r.ok);
  // ── تفاصيل البطاقات الأخرى ──
  const depRows = reservations.filter((r) => r.status !== "cancelled" && r.status !== "completed" && (Number(r.deposit) || 0) > 0)
    .map((r) => ({ label: r.customerName || customers.find((x) => x.id === r.customerId)?.name || "عميل", amount: `${fmtMoney(r.deposit)} ${currency}`, sub: (r.description || "").slice(0, 24), open: { page: "anyStatement", entity: "customer", id: r.customerId } }));
  const partnerRows = partners.map((pp) => ({ label: pp.name, amount: `${fmtMoney((partnersTotals?.byPartner || {})[pp.id] || 0)} ${currency}`, sub: pp.sharePct != null ? `${pp.sharePct}٪` : "", open: { page: "anyStatement", entity: "partner", id: pp.id } }));
  const officeRows = taskirOffices.map((of) => { const open = taskirEntries.filter((t) => t.officeId === of.id && t.status !== "settled" && t.status !== "closed");
    const w = open.reduce((a, t) => a + (Number(t.weight) || 0), 0); return { label: of.name, amount: `${w.toFixed(3)} جم`, sub: `${open.length} تسكير مفتوح`, open: { page: "anyStatement", entity: "office", id: of.id } }; });
  const lastAudit = audits[0];
  const auditRows = lastAudit ? (lastAudit.entries || []).filter((e) => (Number(e.countedQty) || 0) !== (Number(e.expectedQty ?? e.systemQty ?? e.countedQty) || 0)).slice(0, 8)
    .map((e) => ({ label: items.find((it) => it.id === e.itemId)?.ref || e.itemId, amount: `عدّ ${e.countedQty} / دفتر ${e.expectedQty ?? e.systemQty ?? "—"}` })) : [];
  const txRows = (arr, n = 6) => arr.filter((t) => inR(t.date)).slice(0, n).map((t) => ({ label: t.note || t.kind || t.type || "حركة", amount: `${t.type === "out" || t.direction === "out" || (Number(t.amount) || 0) < 0 ? "−" : "+"}${fmtMoney(Math.abs(Number(t.amount) || 0))}`, sub: String(t.date || "").slice(0, 10) }));
  const bankRows = lastBankRecon ? [
    { label: "رصيد كشف البنك", amount: `${fmtMoney(lastBankRecon.statementBalance || 0)} ${currency}` },
    { label: "رصيد الدفتر", amount: `${fmtMoney(lastBankRecon.ledgerBalance || 0)} ${currency}` },
    { label: "الفرق", amount: `${fmtMoney((lastBankRecon.statementBalance || 0) - (lastBankRecon.ledgerBalance || 0))} ${currency}`, strong: true },
  ] : [];
  const scrapRows = Object.entries(scrapEntries.filter((x) => x.status === "in_stock").reduce((m, x) => { const k = String(x.karat || "—"); m[k] = (m[k] || 0) + (Number(x.weight) || 0); return m; }, {}))
    .sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, w]) => ({ label: `عيار ${k}`, amount: `${w.toFixed(3)} جم` }));
  // ⚠ وعاء الزكاة للتاجر: **الأصول المتداولة** (النقد + الذمم المدينة + المخزون
  //   بالتكلفة) − **الالتزامات المتداولة**. الأصول الثابتة (14xx) خارجه.
  //   والمخزون في الأستاذ الدوريّ قد يكون أقلّ من الواقع حتى قيد التسوية —
  //   فتُضاف قيمة القطع الجاهزة بالتكلفة إن كانت أكبر من رصيد الحساب.
  const zCash = c(["1110", "1120", "1130", "1140", "1150"].reduce((a, k) => a + acc(k), 0));
  const zAR = c(Math.max(0, acc("1310")) + Math.max(0, acc("1320")) + Math.max(0, acc("1340")));
  // ⚠ التكلفة على الدفعة لا القطعة: `lots[lotId].costPerGram` × الوزن + حصّة الأجور
  const stockCost = c(items.filter((it) => !it.voided).reduce((a, it) => { const left = remainingQty(it);
    const lot = lots.find((l) => l.id === it.lotId); const cpg = Number(it.costPerGram) || Number(lot?.costPerGram) || 0;
    const unitCost = cpg * (Number(it.weight) || 0) + (Number(it.workmanshipPerUnit) || Number(it.lotWorkmanshipShare) || 0); return a + unitCost * left; }, 0));
  const zStock = c(Math.max(["1210", "1220", "1225", "1230"].reduce((a, k) => a + acc(k), 0), stockCost));
  const zLiab = c(Object.keys(bal).filter((k) => k.startsWith("2")).reduce((a, k) => a + Math.max(0, -acc(k)), 0));
  const zakatBase = c(Math.max(0, zCash + zAR + zStock - zLiab));
  const zakatDue = c(zakatBase * 0.025);
  const money = (v) => `${fmtMoney(c(v))} ${currency}`;
  const W = (v) => `${(Math.round((v || 0) * 1000) / 1000).toFixed(3)} جم`;

  // ── سلاسل زمنيّة — للرسوم المصغّرة ──
  //
  // ⚠ **الرقم وحده لا يقول إن كان جيّدًا:** 43,000 ربحًا — أهو صعودٌ أم هبوط؟
  //   الخطّ الصغير تحت الرقم يُجيب قبل أن يُسأل. الفترة تُقسَّم 8–12 سلّة:
  //   أيامًا إن قصُرت، وأسابيع إن طالت.
  const spanDays = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000));
  const nBuckets = spanDays <= 14 ? spanDays : spanDays <= 62 ? Math.min(12, Math.ceil(spanDays / 7)) : 12;
  const bucketMs = (new Date(to) - new Date(from)) / nBuckets;
  const bucketOf = (d) => { const t = new Date(d).getTime() - new Date(from).getTime(); return Math.max(0, Math.min(nBuckets - 1, Math.floor(t / bucketMs))); };
  const zeros = () => Array.from({ length: nBuckets }, () => 0);
  const series = { sales: zeros(), expenses: zeros(), purchases: zeros(), profit: zeros(), cash: zeros() };
  for (const x of salesIn) series.sales[bucketOf(x.date)] += Number(x.total) || 0;
  for (const x of expIn) series.expenses[bucketOf(x.date || x.createdAt)] += Number(x.amount) || 0;
  for (const x of lotsIn) series.purchases[bucketOf(x.date)] += (Number(x.goldCost) || 0) + (Number(x.workmanshipTotal) || 0);
  // الربح التقريبيّ بالسلّة: إيراد 4xxx − مصروف 5xxx/6xxx من القيود
  for (const e of jeIn) { const k = bucketOf(e.date); for (const l of e.lines || []) {
    if (String(l.account).startsWith("4")) series.profit[k] += c(l.credit) - c(l.debit);
    else if (/^[56]/.test(String(l.account))) series.profit[k] -= c(l.debit) - c(l.credit); } }
  // النقد التراكميّ: رصيد أول الفترة ثم يتحرّك
  { let run = 0; for (const e of je) { if (String(e.date) >= from) break; for (const l of e.lines || []) if (/^11[1-4]0$/.test(String(l.account))) run += c(l.debit) - c(l.credit); }
    const delta = zeros(); for (const e of jeIn) { const k = bucketOf(e.date); for (const l of e.lines || []) if (/^11[1-4]0$/.test(String(l.account))) delta[k] += c(l.debit) - c(l.credit); }
    for (let k = 0; k < nBuckets; k++) { run += delta[k]; series.cash[k] = c(run); } }

  // ── الفترة السابقة بالطول نفسه — للمقارنة ──
  const prevFrom = new Date(new Date(from).getTime() - (new Date(to) - new Date(from)) - 1).toISOString();
  const inPrev = (d) => { const t = d ? String(d) : ""; return t >= prevFrom && t < from; };
  const prevSales = c(sales.filter((x) => !x.voided && inPrev(x.date)).reduce((a, x) => a + (Number(x.total) || 0), 0));
  const prevExp = c(expenses.filter((x) => inPrev(x.date || x.createdAt)).reduce((a, x) => a + (Number(x.amount) || 0), 0));
  const prevPurch = c(lots.filter((l) => inPrev(l.date)).reduce((a, l) => a + (Number(l.goldCost) || 0) + (Number(l.workmanshipTotal) || 0), 0));
  const prevIncome = buildIncomeStatement({ journal: je, accounts, from: prevFrom, to: new Date(new Date(from).getTime() - 1).toISOString() });
  const delta = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
  const compare = {
    sales: { cur: salesTotal, prev: prevSales, pct: delta(salesTotal, prevSales) },
    expenses: { cur: expTotal, prev: prevExp, pct: delta(expTotal, prevExp) },
    purchases: { cur: purchTotal, prev: prevPurch, pct: delta(purchTotal, prevPurch) },
    profit: { cur: income.netProfit, prev: prevIncome.netProfit, pct: delta(income.netProfit, prevIncome.netProfit) },
  };

  const sections = [
    { id: "statements", title: "القوائم المالية", cards: [
      { id: "income", label: "قائمة الدخل", headline: money(income.netProfit), tone: income.netProfit >= 0 ? "good" : "bad", pct: compare.profit.pct, up: "good", series: series.profit,
        hint: income.netProfit >= 0 ? "صافي الربح" : "صافي الخسارة",
        rows: [
          { label: "الإيراد", amount: money(income.revenue) }, { label: "الخصومات", amount: money(-income.discounts) },
          { label: "تكلفة المبيعات (دوريّ)", amount: money(-income.cogs) }, { label: "مجمل الربح", amount: money(income.grossProfit), strong: true },
          ...income.opex.slice(0, 6).map((o) => ({ label: o.name, amount: money(-o.amount), open: { page: "generalLedger", account: o.code } })),
          { label: "صافي الربح", amount: money(income.netProfit), strong: true },
        ], open: { page: "fullStatements" } },
      // ⚠ **السبب بالاسم لا «لا تتوازن»:** المُنشئ يعرف الفرق — غالبًا قيدُ تسوية
      //   المخزون في النظام الدوريّ لم يُرحَّل بعد — ويقول كم وأين. والتحذير الأحمر
      //   يُحفظ لخللٍ حقيقيّ في الدفتر.
      { id: "balance", label: "المركز المالي", headline: money(bs.assetsTotal),
        hint: bs.balanced ? "الأصول — والميزانية متوازنة ✓" : `⚠ ${bs.reason || "الميزانية لا تتوازن"}`,
        tone: bs.balanced ? "" : /تسوية المخزون/.test(bs.reason || "") ? "warn" : "bad",
        rows: [
          { label: "الأصول", amount: money(bs.assetsTotal), strong: true },
          ...(bs.assets || []).slice(0, 6).map((a) => ({ label: a.name, amount: money(a.amount), open: { page: "generalLedger", account: a.code } })),
          { label: "الالتزامات", amount: money(bs.liabilitiesTotal), strong: true },
          { label: "حقوق الملكية (بعد الربح)", amount: money(bs.equityTotal), strong: true },
        ], open: { page: "fullStatements" } },
      { id: "cashflow", label: "التدفق النقدي", headline: money(cf.netChange), tone: cf.netChange >= 0 ? "good" : "bad", hint: "صافي التغيّر في النقد",
        rows: [
          { label: "من التشغيل", amount: money(cf.operating) }, { label: "من الاستثمار", amount: money(cf.investingTotal) },
          { label: "من التمويل", amount: money(cf.financingTotal) }, { label: "نقد أول الفترة", amount: money(cf.openCash) }, { label: "نقد آخر الفترة", amount: money(cf.closeCash), strong: true },
        ], open: { page: "fullStatements" } },
      // ⚠ الوعاء من الأستاذ لا من الشاشات: النقد (111x-115x) + المخزون بالتكلفة
      //   (121x-123x) − الالتزامات المتداولة (2xxx). والنسبة 2.5٪ للسنة الهجرية —
      //   والصفحة الكاملة تفصّل الافتراضات.
      { id: "zakat", label: "الزكاة", headline: money(zakatDue), hint: `2.5٪ من وعاءٍ تقديريّ ${money(zakatBase)}`,
        rows: [
          { label: "النقد والبنك", amount: money(zCash) }, { label: "الذمم المدينة", amount: money(zAR) }, { label: "المخزون والكسر بالتكلفة", amount: money(zStock) },
          { label: "− الالتزامات المتداولة", amount: money(-zLiab) }, { label: "وعاء الزكاة", amount: money(zakatBase), strong: true },
          { label: "الزكاة المستحقّة 2.5٪", amount: money(zakatDue), strong: true },
        ], open: { page: "financials" } },
    ]},
    { id: "books", title: "الدفاتر", cards: [
      { id: "trial", label: "ميزان المراجعة", headline: Math.abs(tbDr - tbCr) < 0.01 ? "متوازن ✓" : `⚠ فرق ${money(tbDr - tbCr)}`,
        tone: Math.abs(tbDr - tbCr) < 0.01 ? "good" : "bad", hint: `مدين ${money(tbDr)} · دائن ${money(tbCr)}`,
        rows: tbList.slice(0, 12).map((r) => ({ label: `${r.code} ${r.name}`, amount: `${fmtMoney(c(r.debit))} / ${fmtMoney(c(r.credit))}`, open: { page: "generalLedger", account: r.code } })),
        open: { page: "trialBalance" } },
      { id: "ledger", label: "الأستاذ العام", headline: `${Object.keys(bal).filter((k) => Math.abs(bal[k]) > 0.005).length} حسابًا`, hint: "كل حسابٍ وحركاته — اضغط حسابًا",
        rows: Object.entries(bal).filter(([, v]) => Math.abs(v) > 0.005).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 12)
          .map(([k, v]) => ({ label: `${k} ${name(k)}`, amount: money(v), open: { page: "generalLedger", account: k } })),
        open: { page: "generalLedger" } },
      { id: "journal", label: "دفتر اليومية", headline: `${jeIn.length} قيدًا`, hint: `من ${je.length} في كل الدفتر`,
        rows: jeIn.slice(-8).reverse().map((e) => ({ label: `${e.ref || ""} ${e.label || e.opType || ""}`, amount: money((e.lines || []).reduce((a, l) => a + c(l.debit), 0)), sub: String(e.date || "").slice(0, 10), open: { page: "journal", entry: e.id } })),
        open: { page: "journal" } },
      // ⚠ **المطابقة الحقيقية هنا لا في التقرير الكامل وحده:** الشاشة تقرأ السجلات
      //   والميزان يقرأ القيود. اختلافُهما هو أوّل ما يسأل عنه المراجع — فنعرضه
      //   صفًّا صفًّا: الصندوق، الخزنة، الذمم، المبيعات، والمخزون الوزني.
      { id: "recon", label: "المطابقات", headline: reconAll ? "متطابقة ✓" : `⚠ ${reconRows.filter((r) => !r.ok).length} فرق`,
        tone: reconAll ? "good" : "bad", hint: "الشاشة ↔ الأستاذ — بندًا بندًا",
        rows: reconRows.map((r) => ({ label: r.label, amount: r.ok ? "✓ متطابق" : `⚠ ${r.detail}`, strong: !r.ok, open: r.open })),
        open: { page: "reports" } },
    ]},
    { id: "parties", title: "الذمم وكشوف الحسابات", cards: [
      { id: "ar", label: "العملاء — لنا عندهم", headline: money(arTotal), tone: arTotal > 0 ? "warn" : "", hint: `${arRows.length} عميل`,
        rows: arRows.sort((a, b) => b.amount - a.amount).slice(0, 10).map((r) => ({ label: r.label, amount: money(r.amount), open: { page: "anyStatement", entity: "customer", id: r.id } })),
        open: { page: "customerReport" } },
      { id: "ap", label: "الموردون — عليهم لنا / لنا عليهم", headline: apGoldFine > 0 ? `${W(apGoldFine)}24 + ${money(apFee)}` : money(apFee), hint: "ذهبٌ بالجرام وأجورٌ بالنقد", tone: (apFee > 0 || apGoldFine > 0) ? "warn" : "",
        rows: suppliers.slice(0, 10).map((sp) => ({ label: sp.name, amount: "كشف الحساب ›", open: { page: "anyStatement", entity: "supplier", id: sp.id } })),
        open: { page: "supplierLedger" } },
      { id: "deposits", label: "عرابين الحجز", headline: money(deposits), hint: `${depRows.length} حجزٌ قائم — التزامٌ للعملاء لا إيراد`, rows: depRows, open: { page: "reservations" } },
      { id: "partners", label: "الشركاء", headline: money(-acc("3150")), hint: `${partners.length} شريك — جاري الشركاء`, rows: partnerRows, open: { page: "partners" } },
      { id: "offices", label: "مكاتب التسكير", headline: `${taskirOffices.length} مكتب`, hint: "ما عند كل مكتبٍ من ذهبٍ لم يُسوَّ", rows: officeRows, open: { page: "officeLedger" } },
    ]},
    { id: "ops", title: "العمليات", cards: [
      { id: "sales", label: "المبيعات", headline: money(salesTotal), hint: `${salesIn.length} فاتورة`, tone: "good", pct: compare.sales.pct, up: "good", series: series.sales, segments: Object.entries(byMethod).map(([k, v]) => ({ label: { cash: "نقد", card: "شبكة", network: "شبكة", credit: "آجل", partial: "وزن" }[k] || k, value: v })),
        rows: [
          ...Object.entries(byMethod).map(([k, v]) => ({ label: { cash: "نقدًا", card: "شبكة", network: "شبكة", credit: "آجل", partial: "بالوزن" }[k] || k, amount: money(v) })),
          ...Object.entries(bySeller).sort((a, b) => b[1].t - a[1].t).slice(0, 6).map(([k, v]) => ({ label: `البائع: ${k}`, amount: money(v.t), sub: `${v.n} فاتورة`, open: { page: "sellerReports" } })),
        ], open: { page: "salesHistory" } },
      { id: "returns", label: "المرتجعات", headline: money(retTotal), hint: `${retIn.length} مرتجع`, tone: retTotal > 0 ? "warn" : "",
        rows: retIn.slice(0, 8).map((r) => ({ label: r.ref || r.saleRef || "مرتجع", amount: money(Number(r.refund) || Number(r.total) || 0), sub: String(r.date || r.createdAt || "").slice(0, 10) })),
        open: { page: "salesHistory" } },
      { id: "purchases", label: "المشتريات", headline: money(purchTotal), hint: `${lotsIn.length} دفعة · ${W(purchWeight)}`, pct: compare.purchases.pct, up: "", series: series.purchases,
        rows: Object.entries(bySupplier).sort((a, b) => b[1].t - a[1].t).slice(0, 8).map(([k, v]) => ({ label: suppliers.find((x) => x.id === k)?.name || k, amount: money(v.t), sub: W(v.w), open: { page: "anyStatement", entity: "supplier", id: k } })),
        open: { page: "supplierLedger" } },
      { id: "expenses", label: "المصروفات", headline: money(expTotal), hint: `${expIn.length} مصروف`, tone: "warn", pct: compare.expenses.pct, up: "bad", series: series.expenses,
        rows: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ label: (typeof EXPENSE_CATEGORIES !== "undefined" && EXPENSE_CATEGORIES.find((x) => x.id === k)?.label) || k, amount: money(v) })),
        open: { page: "expenses" } },
      { id: "vat", label: "ضريبة القيمة المضافة", headline: money(vatOut), hint: `ضريبة المخرجات على مبيعات ${money(salesTotal)}`, rows: [
          { label: "المبيعات شاملة الضريبة", amount: money(salesTotal) }, { label: "صافي المبيعات", amount: money(salesTotal - vatOut) }, { label: `الضريبة ${Math.round(taxRate * 100)}٪`, amount: money(vatOut), strong: true },
        ], open: { page: "financials" } },
    ]},
    { id: "gold", title: "الذهب والمخزون", cards: [
      { id: "goldpos", label: "الموقف الذهبي", headline: `${W(goldRows.reduce((a, r) => a + r.amount, 0))}24`, hint: "ما نملكه — بمعادل عيار 24", tone: "good", segments: goldRows.map((r) => ({ label: r.label.replace(/^(الذهب|ذهب|مخزون)\s*/, "").slice(0, 8), value: r.amount })),
        rows: goldRows.map((r) => ({ label: r.label, amount: `${W(r.amount)}24`, open: { page: "generalLedger", account: r.id } })), open: { page: "trialBalance" } },
      { id: "stockk", label: "المخزون بالعيار", headline: `${Object.values(byKarat).reduce((a, v) => a + v.pcs, 0)} قطعة`, hint: "الجاهز للبيع",
        rows: Object.entries(byKarat).sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, v]) => ({ label: `عيار ${k}`, amount: W(v.w), sub: `${v.pcs} قطعة`, open: { page: "inventory" } })), open: { page: "inventory" } },
      { id: "scrap", label: "الكسر", headline: W(scrapEntries.filter((x) => x.status === "in_stock").reduce((a, x) => a + (Number(x.weight) || 0), 0)), hint: "في الصندوق بانتظار التصفية — بالعيار",
        rows: scrapRows, open: { page: "scrap" } },
      { id: "stocktake", label: "الجرد", headline: lastAudit ? (auditRows.length ? `⚠ ${auditRows.length} فرق` : "بلا فروق ✓") : "لم يُجرَد", tone: lastAudit ? (auditRows.length ? "warn" : "good") : "",
        hint: lastAudit ? `آخر جرد ${String(lastAudit.date || "").slice(0, 10)}${lastAudit.applied ? " — طُبّقت الفروق" : ""}` : "ابدأ جردًا من تبويب الجرد", rows: auditRows, open: { page: "stocktake" } },
    ]},
    { id: "cash", title: "النقد والبنك", cards: [
      { id: "till", label: "الصندوق اليومي", headline: money(cashBalance?.cash || 0), hint: `شبكة ${money(cashBalance?.network || 0)}`,
        rows: [{ label: "نقد", amount: money(cashBalance?.cash || 0), strong: true }, { label: "شبكة", amount: money(cashBalance?.network || 0), strong: true }, ...txRows(cashTx)], open: { page: "cash" } },
      { id: "safe", label: "الخزنة", headline: money(safeBalance?.cash || 0), hint: `شبكة ${money(safeBalance?.network || 0)} · ذهب ${W(safeGoldBalance?.total || 0)}`,
        rows: [{ label: "نقد", amount: money(safeBalance?.cash || 0), strong: true }, { label: "شبكة", amount: money(safeBalance?.network || 0), strong: true }, ...txRows(safeTx)], open: { page: "cash" } },
      { id: "bank", label: "مطابقة البنك", headline: lastBankRecon ? (Math.abs((lastBankRecon.statementBalance || 0) - (lastBankRecon.ledgerBalance || 0)) < 0.01 ? "متطابق ✓" : "⚠ فرق") : "لم تُطابَق",
        tone: lastBankRecon ? (Math.abs((lastBankRecon.statementBalance || 0) - (lastBankRecon.ledgerBalance || 0)) < 0.01 ? "good" : "bad") : "", hint: lastBankRecon ? `آخر مطابقة ${String(lastBankRecon.date || "").slice(0, 10)}` : "ارفع كشف البنك وطابِق", rows: bankRows, open: { page: "bankRecon" } },
    ]},
    { id: "tools", title: "أدواتٌ وتقاريرُ أخرى", cards: [
      { id: "master", label: "التقرير الشامل", headline: "›", hint: "كل شيءٍ في صفحةٍ واحدة للطباعة", rows: [], open: { page: "masterReport" } },
      { id: "custrep", label: "تقرير العملاء", headline: "›", hint: "الشراء والإصلاح والحجز لكل عميل", rows: [], open: { page: "customerReport" } },
      { id: "sellers", label: "تقارير البائعين", headline: "›", hint: "المبيعات والعمولات لكل بائع", rows: [], open: { page: "sellerReports" } },
      { id: "coding", label: "تقارير التكويد", headline: "›", hint: "ما كُوّد وما لم يُكوَّد من كل دفعة", rows: [], open: { page: "codingReport" } },
      { id: "opening", label: "مقارنة الافتتاحي", headline: "›", hint: "الرصيد الافتتاحي مقابل الواقع", rows: [], open: { page: "openingCompare" } },
      { id: "query", label: "مُنشئ الاستعلام", headline: "›", hint: "تقريرٌ بشروطك أنت", rows: [], open: { page: "queryBuilder" } },
      { id: "search", label: "البحث الشامل", headline: "›", hint: "فاتورة، قطعة، عميل — بكلمة", rows: [], open: { page: "search" } },
      { id: "doccycle", label: "الدورة المستندية", headline: "›", hint: "كيف يتحرّك المستند في النظام", rows: [], open: { page: "docCycle" } },
    ]},
  ];
  const glance = [
    { label: "صافي الربح", value: money(income.netProfit), raw: income.netProfit, tone: income.netProfit >= 0 ? "good" : "bad", series: series.profit, pct: compare.profit.pct, up: "good" },
    { label: "المبيعات", value: money(salesTotal), raw: salesTotal, series: series.sales, pct: compare.sales.pct, up: "good" },
    { label: "النقد (صندوق+خزنة)", value: money((cashBalance?.cash || 0) + (cashBalance?.network || 0) + (safeBalance?.cash || 0) + (safeBalance?.network || 0)), raw: (cashBalance?.cash || 0) + (cashBalance?.network || 0) + (safeBalance?.cash || 0) + (safeBalance?.network || 0), series: series.cash, up: "good" },
    { label: "الذهب المملوك", value: `${W(goldRows.reduce((a, r) => a + r.amount, 0))}24`, raw: goldRows.reduce((a, r) => a + r.amount, 0), unit: "جم24", segments: Object.entries(byKarat).sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, v]) => ({ label: `ع${k}`, value: v.w })) },
  ];
  // ⚠ **فترةٌ بلا حركة تُقال لا تُعرض أصفارًا:** شاشةٌ من أصفارٍ تبدو مكسورة.
  //   نقترح أقرب فترةٍ فيها قيود.
  const activity = jeIn.length + salesIn.length + expIn.length + lotsIn.length;
  const lastEntryDate = je.reduce((a, e) => (String(e.date) > a ? String(e.date) : a), "");
  return { sections, glance, period: { from, to }, activity, lastEntryDate, series, compare,
    byKarat: Object.entries(byKarat).sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, v]) => ({ label: `ع${k}`, value: v.w })),
    byMethod: Object.entries(byMethod).map(([k, v]) => ({ label: { cash: "نقد", card: "شبكة", network: "شبكة", credit: "آجل", partial: "وزن" }[k] || k, value: v })) };
}


/// مركز التقارير — الشاشة.
///
/// ⚠ **ثلاث قواعد للبساطة:** فترةٌ واحدة في الأعلى تُورَث لكل شيء ·
/// ستّة أقسام ثابتة الترتيب لا تُخصَّص · كلُّ بطاقةٍ رقمٌ واحد كبير
/// وسطرُ سياق. **والضغطة الأولى تُفصّل في مكانها**، والثانية تفتح
/// التقرير الكامل بأدواته. المحاسب لا يحتاج أن يعرف اسم التقرير
/// ليجد الرقم — الرقم أمامه والاسم تحته.

export { buildReportHub };
