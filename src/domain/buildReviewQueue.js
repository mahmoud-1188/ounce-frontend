import { REVIEW_KINDS, REVIEW_SEVERITY } from "../core/constants.js";
import { fmtMoney, fmtW } from "../core/money.js";
import { reviewFingerprint, reviewKey } from "./helpers.js";
import { journalBalanced } from "./journalBalanced.js";

function buildReviewQueue({ journal = [], sales = [], returns = [], expenses = [], lots = [], audits = [],
  approvals = [], businessDays = [], reviews = [], settings = {}, journalComplete = true } = {}) {
  const out = [];
  // ⚠ اليومية المحمّلة قد تكون أحدثَ جزءٍ فقط (الخادم يقصّ): مستندٌ أقدم من
  //   أقدم قيدٍ محمَّل يبدو «بلا قيد» وله قيد. فلا يُحكم إلا على ما يقع داخل
  //   نافذة اليومية، والأرصدة لا تُقرأ إلا من يوميةٍ كاملة.
  const jFrom = journalComplete ? "" : journal.map((e) => String(e.date || "")).filter(Boolean).sort()[0] || "";
  const inWindow = (d) => !jFrom || String(d || "") >= jFrom;
  const push = (kind, id, ref, date, why, extra = {}) => {
    const def = REVIEW_KINDS[kind];
    out.push({ key: reviewKey(kind, id), kind, id, ref: ref || "—", date: date || null,
      label: def.label, severity: def.severity, page: def.page, why, ...extra });
  };
  const jByRef = new Map();
  journal.forEach((e) => {
    if (e.refId) jByRef.set(e.refId, (jByRef.get(e.refId) || []).concat(e));
    if (e.refDoc) jByRef.set(e.refDoc, (jByRef.get(e.refDoc) || []).concat(e));
  });
  const hasJ = (...keys) => keys.some((k) => k && (jByRef.get(k) || []).some((e) => !e.reversed));

  // ① القيود
  journal.forEach((e) => {
    if (e.isReversal) return;
    if (!journalBalanced(e)) push("journal_unbalanced", e.id, e.ref, e.date,
      `المدين ${fmtMoney(e.totalDebit ?? (e.lines || []).reduce((a, l) => a + (Number(l.debit) || 0), 0))} ≠ الدائن ${fmtMoney(e.totalCredit ?? (e.lines || []).reduce((a, l) => a + (Number(l.credit) || 0), 0))}`,
      { amount: e.totalDebit || 0, lines: (e.lines || []).length });
    else if (e.reversed) push("journal_reversed", e.id, e.ref, e.date, `${e.label || e.opType} — عُكس${e.reversalReason ? `: ${e.reversalReason}` : ""}`,
      { amount: e.totalDebit || 0, lines: (e.lines || []).length, reversed: true });
  });
  // ② نقدٌ سالب
  const bal = {};
  journal.forEach((e) => (e.lines || []).forEach((l) => { bal[l.account] = (bal[l.account] || 0) + (Number(l.debit) || 0) - (Number(l.credit) || 0); }));
  if (journalComplete) ["1110", "1120", "1130", "1140", "1150"].forEach((acc) => {
    if ((bal[acc] || 0) < -0.01) push("negative_cash", acc, acc, null, `رصيد ${acc} في الأستاذ ${fmtMoney(bal[acc])}`, { amount: Math.abs(bal[acc]) });
  });
  // ③ فواتير ومرتجعات ومصروفات بلا قيد
  const workdayRequired = settings.workdayMode !== "off";
  sales.forEach((x) => {
    if (x.voided || !inWindow(x.date)) return;
    if (!hasJ(x.id, x.ref)) push("sale_no_journal", x.id, x.ref, x.date, `فاتورة ${fmtMoney(x.total)} · ${x.paymentMethod || ""} — لا قيدَ لها`, { amount: x.total, lines: (x.lines || []).length });
    else if (workdayRequired && !x.businessDayId) push("no_workday", `sale_${x.id}`, x.ref, x.date, `فاتورة ${fmtMoney(x.total)} بلا يوم عمل — لا تظهر في أي إقفال`, { amount: x.total });
  });
  returns.forEach((r) => {
    if (inWindow(r.date) && !r.journalRef && !hasJ(r.id, r.ref)) push("return_no_journal", r.id, r.ref, r.date, `مرتجع ${fmtMoney(r.refund)} من ${r.saleRef || ""} — لا قيدَ له`, { amount: r.refund });
  });
  expenses.forEach((x) => {
    if (x.voided || !inWindow(x.date)) return;
    if ((Number(x.amount) || 0) > 0 && !hasJ(x.id, x.ref)) push("expense_no_journal", x.id, x.ref, x.date, `مصروف ${fmtMoney(x.amount)} — ${x.name || x.category || ""} — لا قيدَ له`, { amount: x.amount });
    else if (workdayRequired && !x.businessDayId) push("no_workday", `expense_${x.id}`, x.ref, x.date, `مصروف ${fmtMoney(x.amount)} بلا يوم عمل`, { amount: x.amount });
  });
  // ④ فروقات الجرد
  audits.forEach((a) => {
    const diffs = (a.entries || []).filter((en) =>
      (Number(en.countedQty) || 0) !== (Number(en.systemQty) || 0) || Math.abs((Number(en.countedWeight) || 0) - (Number(en.systemWeight) || 0)) > 0.0005);
    if (!diffs.length) return;
    const missing = diffs.filter((en) => (Number(en.countedQty) || 0) < (Number(en.systemQty) || 0)).length;
    push("stocktake_variance", a.id, `جرد ${new Date(a.date).toLocaleDateString("en-GB")}`, a.date,
      `${diffs.length} صنف بفرق (${missing} عجز · ${diffs.length - missing} زيادة)${a.applied ? " — اعتُمد على المخزون" : " — لم يُطبَّق"}`,
      { lines: diffs.length, amount: diffs.length });
  });
  // ⑤ الاعتمادات المعلّقة
  approvals.forEach((ap) => {
    if (ap.status !== "pending") return;
    push("approval_pending", ap.id, ap.ref || ap.kindLabel, ap.requestedAt, `${ap.kindLabel} ${fmtMoney(ap.amount)} — طلبه ${ap.requester || ""}`, { amount: ap.amount });
  });
  // ⑥ شراءٌ آجل بلا فاتورة مرفقة
  lots.forEach((l) => {
    if (l.source === "opening" || l.voided) return;
    if (l.paymentMethod === "deferred" && l.invoicePending) push("lot_no_invoice", l.id, l.ref, l.date, `دفعة ${fmtW(l.weight)} جم عيار ${l.karat} آجلة بلا فاتورة مورد مرفقة`, { amount: l.totalCost || 0 });
  });
  // ⑦ يومٌ مفتوح من أمس
  const today = new Date().toISOString().slice(0, 10);
  businessDays.forEach((d) => {
    if (d.status === "open" && String(d.openedAt || d.date || "").slice(0, 10) < today)
      push("day_stale", d.id, d.ref, d.openedAt || d.date, `فُتح ${String(d.openedAt || d.date || "").slice(0, 10)} ولم يُقفل`, {});
  });

  // ⑧ ما رُوجع: المعتمد يختفي ما لم يتغيّر، وما يحتاج تعديلًا يبقى موسومًا
  const latest = new Map();
  [...reviews].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((r) => latest.set(r.key, r));
  return out
    .map((it) => {
      const r = latest.get(it.key) || null;
      const fp = reviewFingerprint(it);
      const changed = !!(r && r.verdict === "approved" && r.fingerprint && r.fingerprint !== fp);
      return { ...it, fingerprint: fp, lastReview: r, changedSinceReview: changed,
        resolved: !!(r && r.verdict === "approved" && !changed) };
    })
    .filter((it) => !it.resolved)
    .sort((a, b) => (REVIEW_SEVERITY[a.severity].order - REVIEW_SEVERITY[b.severity].order) || String(b.date || "").localeCompare(String(a.date || "")));
}

/// سجلّ مراجعة — يُضاف ولا يُعدَّل.

export { buildReviewQueue };
