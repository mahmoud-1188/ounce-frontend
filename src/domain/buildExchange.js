import { POSTING_RULES } from "../core/chart.js";
import { EXCHANGE_VERSION, EXPENSE_CATEGORIES } from "../core/constants.js";
import { exchangeKind } from "./helpers.js";

function buildExchange({ kind, from, to, sales = [], returns = [], expenses = [], receipts = [],
  cashTx = [], safeTx = [], journal = [], items = [], customers = [], suppliers = [],
  accounts = [], branchCode = "", branchName = "" }) {
  const t0 = from ? new Date(from).getTime() : -Infinity;
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;
  const inP = (d) => { const t = new Date(d || 0).getTime(); return t >= t0 && t <= t1; };
  const nm = (list, id) => list.find((x) => x.id === id)?.name || "";
  let rows = [];

  if (kind === "sales") {
    rows = sales.filter((s) => !s.voided && inP(s.date)).map((s) => {
      const codes = (s.lines || []).map((l) => l.unitCode || l.code).filter(Boolean).join(";");
      return [s.ref, String(s.date).slice(0, 10), nm(customers, s.customerId), codes,
        Number(s.total) || 0, Number(s.paidAmount) || 0, s.paymentMethod || "cash", s.note || ""];
    });
  } else if (kind === "revenues") {
    rows = journal.filter((e) => inP(e.at || e.date)).flatMap((e) =>
      (e.lines || []).filter((l) => l.account?.startsWith("4") && (Number(l.credit) || 0) > 0)
        .map((l) => [e.refDoc || "", String(e.at || e.date).slice(0, 10),
          POSTING_RULES[e.opType]?.label || e.opType, Number(l.credit) || 0, l.account, e.note || ""]));
  } else if (kind === "expenses") {
    rows = expenses.filter((x) => inP(x.date)).map((x) => [x.ref, String(x.date).slice(0, 10),
      EXPENSE_CATEGORIES.find((c) => c.id === x.category)?.label || x.category,
      Number(x.amount) || 0, x.fundingSource || "", x.note || ""]);
  } else if (kind === "receipts") {
    rows = receipts.filter((x) => inP(x.date)).map((x) => [x.ref, String(x.date).slice(0, 10),
      nm(customers, x.customerId), Number(x.amount) || 0, x.method || "cash", x.note || ""]);
  } else if (kind === "payments") {
    rows = [...cashTx, ...safeTx].filter((x) => inP(x.date) && x.direction === "out")
      .map((x) => [x.ref, String(x.date).slice(0, 10), x.payee || x.note || "",
        Number(x.amount) || 0, x.method || "cash", x.note || ""]);
  } else if (kind === "journal") {
    rows = journal.filter((e) => inP(e.at || e.date)).flatMap((e) =>
      (e.lines || []).map((l) => [e.refDoc || e.id, String(e.at || e.date).slice(0, 10),
        l.account, Number(l.debit) || 0, Number(l.credit) || 0,
        e.note || POSTING_RULES[e.opType]?.label || ""]));
  } else if (kind === "inventory") {
    rows = items.filter((i) => !i.voided).flatMap((i) =>
      (i.units || []).filter((u) => !u.sold && !u.issued).map((u) =>
        [u.code, i.description, i.category, i.karat, i.weight,
         Number(i.costPerGram) || 0, Number(i.workmanshipPerUnit) || 0]));
  } else if (kind === "customers") {
    rows = customers.map((c) => [c.ref || c.id, c.name, c.phone || "", Number(c.balance) || 0, c.note || ""]);
  } else if (kind === "suppliers") {
    rows = suppliers.map((x) => [x.ref || x.id, x.name, x.phone || "",
      Number(x.balanceCash) || 0, Number(x.balanceFine) || 0, x.note || ""]);
  }

  const def = exchangeKind(kind);
  return {
    v: EXCHANGE_VERSION, kind, label: def?.label || kind,
    source: "oqiyyah", branchCode, branchName,
    period: { from: from || null, to: to || null },
    at: new Date().toISOString(),
    columns: def?.cols || [],
    rows, count: rows.length,
  };
}

/// يفحص ما وصل من نظامٍ آخر — **قبل** أي ترحيل.
///
/// ⚠ يُرجع تقريرًا لا يُرحّل: المستخدم يرى كم صفًّا صالحًا وكم فاسدًا
/// **ولماذا**، ثم يُقرّر. استيرادٌ يبدأ بالترحيل لا يُراجَع أبدًا.

export { buildExchange };
