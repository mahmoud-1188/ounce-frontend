import { fine24, fromHalalas, halalas } from "../core/money.js";

/// حساب مكتب التسكير كالبنك (المرجع officeAccountOf): ذهبنا عنده أصلٌ (1240) بتكلفته، وما علينا له التزامٌ (2130)
/// بالصافي عيار 24 وبمبلغه إن كان شراءً آجلًا. كل سطرٍ يحمل رصيدَي ما بعده — كشف حسابٍ لا قائمة حركات.
const OFFICE_TX_KINDS = {
  hold_buy: "شراء وإيداع عنده", hold_withdraw: "سحب إلى الخزنة", hold_to_supplier: "سداد مورد من ذهبنا عنده",
  owed: "علينا له", paid: "سداد المكتب",
};

// نوع السطر من بنيته: الإيداع/السحب ذهبٌ لنا (hold)، وغيره دَينٌ له أو سدادٌ منه.
// السطور القديمة (قبل ربطها) تُعرف من ملاحظتها.
function officeTxKind(t) {
  if (t.kind === "hold") {
    if (t.type === "debit") return "hold_buy";
    return t.refTable === "suppliers" || String(t.note || "").startsWith("سداد المورد") ? "hold_to_supplier" : "hold_withdraw";
  }
  return t.type === "debit" ? "owed" : "paid";
}

// سطر الدَّين الآجل يُدمج في سطر إيداعه: شراءٌ واحدٌ يزيد ذهبنا عنده وما علينا له معًا
function deferredOwedRowOf(t, rows) {
  return rows.find((o) => o.kind !== "hold" && o.type === "debit" && (
    (o.refTable === "taskir_office_tx" && o.refId === t.id)
    || (!o.refId && String(o.note || "").endsWith("— آجل") && o.date === t.date)
  )) || null;
}

function officeAccountOf(office, tx = [], { supplierName = () => "" } = {}) {
  const id = office && typeof office === "object" ? office.id : office;
  const rows = (tx || []).filter((t) => t && t.officeId === id)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || (a.kind === "hold" ? -1 : 1));
  const merged = new Set();
  for (const t of rows) {
    if (t.kind === "hold" && t.type === "debit") { const o = deferredOwedRowOf(t, rows); if (o) merged.add(o.id); }
  }
  const paidFor = {};
  for (const t of rows) if (t.type === "credit" && t.refTable === "taskir_office_tx" && t.refId) paidFor[t.refId] = (paidFor[t.refId] || 0) + halalas(t.amount || 0);
  let heldFine = 0, heldCostH = 0, owedFine = 0, owedH = 0;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const lines = [];
  for (const t of rows) {
    if (merged.has(t.id)) continue;
    const kind = officeTxKind(t);
    const fine = r3(fine24(Number(t.weight) || 0, Number(t.karat) || 24));
    const amtH = halalas(Number(t.amount) || 0);
    let heldDelta = 0, owedDelta = 0, pay = null, owedRowId = null, owedAmount = 0;
    if (kind === "hold_buy") {
      heldDelta = fine; heldCostH += amtH;
      const o = deferredOwedRowOf(t, rows);
      if (o) {
        pay = "deferred"; owedRowId = o.id;
        owedDelta = r3(fine24(Number(o.weight) || 0, Number(o.karat) || 24));
        owedH += halalas(o.amount || 0); owedAmount = Number(o.amount) || 0;
      }
    } else if (kind === "hold_withdraw" || kind === "hold_to_supplier") {
      heldDelta = -fine; heldCostH = Math.max(0, heldCostH - amtH);
    } else if (kind === "owed") { owedDelta = fine; owedH += amtH; }
    else { owedDelta = -fine; owedH -= amtH; }
    heldFine = r3(heldFine + heldDelta); owedFine = r3(owedFine + owedDelta);
    if (heldFine <= 0.0005) { heldFine = 0; heldCostH = 0; }
    if (Math.abs(owedFine) <= 0.0005) owedFine = 0;
    lines.push({
      ...t, kind, rowKind: t.kind, kindLabel: OFFICE_TX_KINDS[kind], fine, heldDelta, owedDelta, pay, owedRowId,
      amount: Number(t.amount) || 0, owedAmount,
      openAmount: owedRowId ? Math.max(0, fromHalalas(halalas(owedAmount) - (paidFor[owedRowId] || 0))) : 0,
      supplierName: t.refTable === "suppliers" ? supplierName(t.refId) : t.supplierName || "",
      heldAfter: heldFine, owedAfter: owedFine,
    });
  }
  return {
    office: office && typeof office === "object" ? office : { id }, lines: [...lines].reverse(), count: lines.length,
    heldFine, heldCost: fromHalalas(heldCostH), avgCost: heldFine > 0 ? fromHalalas(Math.round(heldCostH / heldFine)) : 0,
    owedFine, owedAmount: fromHalalas(Math.max(0, owedH)),
  };
}

export { OFFICE_TX_KINDS, officeAccountOf, officeTxKind };
