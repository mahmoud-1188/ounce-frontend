import { POSTING_RULES } from "../core/chart.js";
import { fmtW, fromHalalas, halalas, roundW } from "../core/money.js";
import { inPeriod } from "./helpers.js";

function buildEntityStatement({
  entity, id, from, to,
  sales = [], returns = [], lots = [], items = [], expenses = [], receipts = [],
  cashTx = [], safeTx = [], scrapEntries = [], taskirat = [], officeTx = [],
  partnerTx = [], journal = [], goldLedger = [], businessDays = [], reservations = [], repairs = [],
}) {
  const t0 = from ? new Date(from).getTime() : -Infinity;
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;
  const inP = (d) => { const t = new Date(d || 0).getTime(); return t >= t0 && t <= t1; };
  const before = (d) => new Date(d || 0).getTime() < t0;
  const rows = [];
  const push = (r) => { if (r.at) rows.push(r); };

  // دالةٌ موحّدة: تُضيف الحركة سواءٌ كانت قبل الفترة (للافتتاحي) أو فيها
  const add = (o) => {
    if (!o.at) return;
    if (before(o.at)) { rows.push({ ...o, opening: true }); return; }
    if (inP(o.at)) rows.push(o);
  };

  if (entity === "supplier") {
    for (const l of lots.filter((x) => x.supplierId === id)) {
      const w = (l.lines || []).reduce((a, x) => a + (Number(x.weight) || 0) * (Number(x.karat) || 21) / 24, 0);
      add({ at: l.date || l.createdAt, ref: l.ref, doc: "دفعة شراء",
        note: `${(l.lines || []).length} سطرًا · ${l.paymentMethod === "deferred" ? "آجل" : "نقدي"}`,
        debit: 0, credit: Number(l.workmanshipTotal) || 0, fineIn: w, fineOut: 0 });
    }
    for (const t of [...cashTx, ...safeTx].filter((x) => x.refId === id || x.supplierId === id))
      add({ at: t.date, ref: t.ref, doc: "سداد", note: t.note || "", debit: Number(t.amount) || 0, credit: 0 });
  } else if (entity === "customer") {
    for (const s of sales.filter((x) => x.customerId === id))
      add({ at: s.date, ref: s.ref, doc: "فاتورة بيع",
        note: `${(s.lines || []).length} صنفًا · ${s.paymentMethod}`,
        debit: Number(s.total) || 0, credit: Number(s.paidAmount) || 0 });
    for (const r of returns.filter((x) => x.customerId === id))
      add({ at: r.date, ref: r.ref, doc: "مرتجع", note: r.reason || "", debit: 0, credit: Number(r.total) || 0 });
    for (const r of receipts.filter((x) => x.customerId === id))
      add({ at: r.date, ref: r.ref, doc: "سند قبض", note: r.note || "", debit: 0, credit: Number(r.amount) || 0 });
    for (const v of reservations.filter((x) => x.customerId === id))
      add({ at: v.date, ref: v.ref, doc: "حجز", note: v.description || "", debit: 0, credit: Number(v.deposit) || 0 });
  } else if (entity === "seller") {
    const u = id;
    for (const s of sales.filter((x) => x.createdBy === u || x.sellerId === u))
      add({ at: s.date, ref: s.ref, doc: "بيع", note: s.paymentMethod || "", debit: Number(s.total) || 0, credit: 0 });
    for (const r of returns.filter((x) => x.createdBy === u))
      add({ at: r.date, ref: r.ref, doc: "مرتجع", note: r.reason || "", debit: 0, credit: Number(r.total) || 0 });
  } else if (entity === "office") {
    for (const t of taskirat.filter((x) => x.officeId === id))
      add({ at: t.date, ref: t.ref, doc: "تسكير", note: `عيار ${t.karat}`,
        debit: 0, credit: Number(t.feeTotal) || 0,
        fineIn: (Number(t.weight) || 0) * (Number(t.karat) || 21) / 24, fineOut: 0 });
    for (const t of officeTx.filter((x) => x.officeId === id))
      add({ at: t.date, ref: t.ref, doc: t.mode === "gold" ? "سداد ذهبًا" : "سداد نقدًا",
        note: t.note || "", debit: Number(t.amount) || 0, credit: 0,
        fineIn: 0, fineOut: (Number(t.weight) || 0) * (Number(t.karat) || 24) / 24 });
  } else if (entity === "partner") {
    for (const t of partnerTx.filter((x) => x.partnerId === id))
      add({ at: t.date, ref: t.ref, doc: t.type === "draw" ? "سحب" : "إيداع", note: t.note || "",
        debit: t.type === "draw" ? Number(t.amount) || 0 : 0,
        credit: t.type === "draw" ? 0 : Number(t.amount) || 0 });
  } else if (entity === "item") {
    const it = items.find((x) => x.id === id || x.ref === id);
    if (it) {
      add({ at: it.createdAt, ref: it.ref, doc: "تكويد",
        note: `${it.description} · عيار ${it.karat} · ${fmtW(it.weight)} جم`,
        debit: (Number(it.costPerGram) || 0) * (Number(it.weight) || 0), credit: 0,
        fineIn: (Number(it.weight) || 0) * (Number(it.karat) || 21) / 24, fineOut: 0 });
      for (const s of sales) for (const l of s.lines || []) {
        if (l.itemId !== it.id) continue;
        add({ at: s.date, ref: s.ref, doc: "بيع", note: `${l.quantity || 1} وحدة`,
          debit: 0, credit: Number(l.unitPrice) || 0,
          fineIn: 0, fineOut: (Number(l.weightSnapshot) || 0) * (Number(l.karatSnapshot) || 21) / 24 });
      }
    }
  } else if (entity === "lot") {
    const l = lots.find((x) => x.id === id || x.ref === id);
    if (l) {
      add({ at: l.date || l.createdAt, ref: l.ref, doc: "شراء دفعة",
        note: `${(l.lines || []).length} سطرًا`, debit: 0, credit: Number(l.workmanshipTotal) || 0,
        fineIn: (l.lines || []).reduce((a, x) => a + (Number(x.weight) || 0) * (Number(x.karat) || 21) / 24, 0), fineOut: 0 });
      for (const it of items.filter((x) => x.lotId === l.id))
        add({ at: it.createdAt, ref: it.ref, doc: "تكويد", note: it.description || "",
          debit: 0, credit: 0, fineIn: 0, fineOut: 0 });
    }
  } else if (entity === "account") {
    for (const e of journal) for (const line of e.lines || []) {
      if (line.account !== id) continue;
      add({ at: e.at || e.date, ref: e.refDoc || "", doc: POSTING_RULES[e.opType]?.label || e.opType,
        note: e.note || "", debit: Number(line.debit) || 0, credit: Number(line.credit) || 0 });
    }
  } else if (entity === "day") {
    const d = businessDays.find((x) => x.id === id || x.ref === id);
    if (d) {
      const day = String(d.openedAt || "").slice(0, 10);
      for (const s of sales.filter((x) => String(x.date).slice(0, 10) === day))
        rows.push({ at: s.date, ref: s.ref, doc: "بيع", note: s.paymentMethod || "", debit: Number(s.total) || 0, credit: 0 });
      for (const x of expenses.filter((e) => String(e.date).slice(0, 10) === day))
        rows.push({ at: x.date, ref: x.ref, doc: "مصروف", note: x.note || x.category || "", debit: 0, credit: Number(x.amount) || 0 });
      for (const x of scrapEntries.filter((e) => String(e.date).slice(0, 10) === day))
        rows.push({ at: x.date, ref: x.ref, doc: "شراء كسر", note: `عيار ${x.karat}`,
          debit: 0, credit: Number(x.total) || 0,
          fineIn: (Number(x.weight) || 0) * (Number(x.karat) || 21) / 24, fineOut: 0 });
    }
  } else if (entity === "expenseCat") {
    for (const x of expenses.filter((e) => e.category === id || e.name === id))
      add({ at: x.date, ref: x.ref, doc: "مصروف", note: x.note || "", debit: Number(x.amount) || 0, credit: 0 });
  }

  // ═══ الترتيب والأرصدة المتتابعة ═══
  const opens = rows.filter((r) => r.opening);
  const inPeriod = rows.filter((r) => !r.opening)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const openMoney = fromHalalas(opens.reduce((a, r) => a + halalas(r.debit) - halalas(r.credit), 0));
  const openFine = roundW(opens.reduce((a, r) => a + (r.fineIn || 0) - (r.fineOut || 0), 0));
  let runM = halalas(openMoney), runF = openFine;
  const lines = inPeriod.map((r, i) => {
    runM += halalas(r.debit) - halalas(r.credit);
    runF = roundW(runF + (r.fineIn || 0) - (r.fineOut || 0));
    return { ...r, seq: i + 1, balance: fromHalalas(runM), fineBalance: runF };
  });
  const S = (k) => fromHalalas(inPeriod.reduce((a, r) => a + halalas(r[k] || 0), 0));
  const W = (k) => roundW(inPeriod.reduce((a, r) => a + (r[k] || 0), 0));
  return {
    entity, id, period: { from: from || null, to: to || null },
    openingMoney: openMoney, openingFine: openFine,
    totalDebit: S("debit"), totalCredit: S("credit"),
    totalFineIn: W("fineIn"), totalFineOut: W("fineOut"),
    closingMoney: fromHalalas(runM), closingFine: runF,
    lines, count: lines.length,
    // ⚠ التحقّق يُحسب: الافتتاحي + الحركة = الختامي، وإلا فالكشف مكسور
    consistent: Math.abs(halalas(openMoney) + halalas(S("debit")) - halalas(S("credit")) - runM) < 1,
  };
}

export { buildEntityStatement };
