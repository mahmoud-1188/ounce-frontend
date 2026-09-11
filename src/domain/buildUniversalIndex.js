import { CATEGORY_TO_ACCOUNT } from "../core/chart.js";
import { ROLES } from "../core/constants.js";
import { fine24, fmt, fmtW } from "../core/money.js";
import { REQ_STATUS, SCRAP_STAGES } from "../core/workflow.js";
import { accountByCode } from "./accountByCode.js";
import { accountLabel, categoryLabel } from "./helpers.js";
import { searchText } from "./searchText.js";
import { stageOf } from "./stageOf.js";

function buildUniversalIndex(S) {
  const out = [];
  const push = (rec) => {
    if (!rec.ref && !rec.id) return;
    out.push({
      amount: 0, weight: 0, karat: null, fine: 0, links: [], who: "", ...rec,
      text: rec.text || "",
    });
  };
  const D = (x) => x?.date || x?.createdAt || x?.openedAt || null;

  (S.sales || []).forEach((x) => {
    const w = (x.lines || []).reduce((a, l) => a + (Number(l.weightSnapshot) || 0) * (Number(l.quantity) || 1), 0);
    const k = (x.lines || [])[0]?.karatSnapshot || null;
    push({
      id: x.id, ref: x.ref, kind: "sale", date: D(x), day: x.dayRef,
      who: x.sellerName || "", amount: Number(x.total) || 0, weight: w, karat: k,
      fine: (x.lines || []).reduce((a, l) => a + fine24((Number(l.weightSnapshot) || 0) * (Number(l.quantity) || 1), l.karatSnapshot), 0),
      account: "4100", category: "sales_revenue",
      links: [x.customerId, x.sellerId, ...(x.lines || []).map((l) => l.itemId)].filter(Boolean),
      summary: `بيع ${fmt(x.total, 0)} · ${(x.lines || []).length} صنف · ${x.sellerName || ""}`,
      text: searchText(x, [x.ref, x.sellerName, x.customerName, x.paymentMethod, String(x.total)]),
      raw: x,
    });
  });

  (S.lots || []).forEach((x) => {
    const sup = (S.suppliers || []).find((s) => s.id === x.supplierId);
    push({
      id: x.id, ref: x.ref, kind: "purchase", date: D(x), day: x.dayRef,
      who: x.createdBy || "", amount: Number(x.goldCost) || 0,
      weight: Number(x.weight) || 0, karat: x.karat, fine: fine24(x.weight, x.karat),
      account: "5110", category: "gold_purchase_supplier",
      links: [x.supplierId, x.officeId].filter(Boolean),
      summary: `شراء ${fmtW(x.weight)} جم عيار ${x.karat} من ${sup?.name || "مورد"}`,
      text: searchText(x, [x.ref, sup?.name, x.paymentMethod, String(x.weight), String(x.karat)]),
      raw: x,
    });
  });

  (S.items || []).forEach((x) => {
    const avail = (x.units || []).filter((u) => !u.sold).length;
    push({
      id: x.id, ref: (x.units || [])[0]?.code || x.id, kind: "item", date: D(x),
      who: x.createdBy || "", weight: Number(x.weight) || 0, karat: x.karat,
      fine: fine24(x.weight, x.karat), amount: (Number(x.costPerGram) || 0) * (Number(x.weight) || 0),
      account: "1210", links: [x.lotId].filter(Boolean),
      summary: `${categoryLabel(x.categoryId)} · ${fmtW(x.weight)} جم عيار ${x.karat} · متاح ${avail}`,
      text: searchText(x, [(x.units || []).map((u) => u.code).join(" "), categoryLabel(x.categoryId), String(x.karat)]),
      raw: x,
    });
  });

  (S.scrapEntries || []).forEach((x) => {
    push({
      id: x.id, ref: x.ref, kind: "scrap", date: D(x), day: x.dayRef,
      who: x.createdBy || "", amount: Number(x.total) || 0,
      weight: Number(x.weight) || 0, karat: x.karat, fine: fine24(x.weight, x.karat),
      account: "1230", category: "gold_purchase_scrap",
      stage: stageOf(x), links: [x.customerId, x.requestId].filter(Boolean),
      summary: `كسر ${fmtW(x.weight)} جم عيار ${x.karat} · ${(SCRAP_STAGES[stageOf(x)] || {}).label || ""}`,
      text: searchText(x, [x.ref, x.description, String(x.karat), String(x.weight)]),
      raw: x,
    });
  });

  (S.scrapRequests || []).forEach((x) => {
    push({
      id: x.id, ref: x.ref, kind: "scrapReq", date: D(x), day: x.dayRef,
      who: x.createdBy || "", fine: Number(x.assessedFine || x.sentFine) || 0,
      links: x.scrapIds || [],
      summary: `طلب فحص · ${(x.sentLines || []).length} قطعة · ${(REQ_STATUS[x.status] || {}).label || x.status}`,
      text: searchText(x, [x.ref, x.status, x.note, x.assessNote]),
      raw: x,
    });
  });

  [...(S.cashTx || []), ...(S.safeTx || []), ...(S.scrapCustodyTx || [])].forEach((x) => {
    const isExp = /expense|salary|rent/.test(x.category || "");
    push({
      id: x.id, ref: x.ref || x.id, kind: isExp ? "expense" : "cash", date: D(x), day: x.dayRef,
      who: x.createdBy || "", amount: Number(x.amount) || 0,
      account: CATEGORY_TO_ACCOUNT[x.category] || null, category: x.category,
      links: [x.refId].filter(Boolean), pool: x.pool || x.method,
      summary: `${x.type === "out" ? "صرف" : "قبض"} ${fmt(x.amount, 0)} · ${accountLabel(x.category)}`,
      text: searchText(x, [x.note, x.category, accountLabel(x.category), String(x.amount)]),
      raw: x,
    });
  });

  (S.goldLedger || []).forEach((x) => {
    const acc = accountByCode(x.accountCode);
    push({
      id: x.id, ref: x.id, kind: "gold", date: D(x), day: x.dayRef,
      who: x.createdBy || "", weight: Number(x.weight) || 0, karat: x.karat,
      fine: Number(x.fineWeight) || 0, account: x.accountCode,
      links: [x.refId].filter(Boolean),
      summary: `${x.type === "out" ? "خروج" : "دخول"} ${fmtW(x.weight)} جم عيار ${x.karat} · ${acc?.name || x.accountCode}`,
      text: searchText(x, [x.note, x.opType, acc?.name, String(x.karat)]),
      raw: x,
    });
  });

  (S.suppliers || []).forEach((x) =>
    push({ id: x.id, ref: x.ref, kind: "supplier", date: D(x), who: x.createdBy || "",
      summary: x.name, text: searchText(x, [x.name, x.phone, x.ref]), raw: x }));
  (S.customers || []).forEach((x) =>
    push({ id: x.id, ref: x.ref, kind: "customer", date: D(x),
      summary: x.name, text: searchText(x, [x.name, x.phone, x.ref]), raw: x }));
  (S.users || []).forEach((x) =>
    push({ id: x.id, ref: x.ref, kind: "user", date: D(x),
      summary: `${x.name} · ${ROLES[x.role]?.label || x.role}`,
      text: searchText({ name: x.name, ref: x.ref, role: x.role }), raw: x }));
  (S.receipts || []).forEach((x) =>
    push({ id: x.id, ref: x.ref, kind: "receipt", date: D(x), day: x.dayRef,
      who: x.createdBy || "", amount: Number(x.amount) || 0, links: [x.customerId].filter(Boolean),
      summary: `تحصيل ${fmt(x.amount, 0)}`, text: searchText(x, [x.ref, String(x.amount)]), raw: x }));
  (S.repairs || []).forEach((x) =>
    push({ id: x.id, ref: x.ref, kind: "repair", date: D(x), day: x.dayRef,
      who: x.createdBy || "", amount: Number(x.price) || 0, links: [x.customerId].filter(Boolean),
      summary: `إصلاح · ${x.description || ""}`, text: searchText(x, [x.ref, x.description]), raw: x }));
  (S.trustGold || []).forEach((x) =>
    push({ id: x.id, ref: x.ref, kind: "trust", date: D(x), day: x.dayRef,
      weight: Number(x.weight) || 0, karat: x.karat, fine: fine24(x.weight, x.karat),
      account: "7100", links: [x.customerId].filter(Boolean),
      summary: `أمانة ${fmtW(x.weight)} جم عيار ${x.karat}`,
      text: searchText(x, [x.ref, x.description, String(x.karat)]), raw: x }));
  (S.weightAdjustments || []).forEach((x) =>
    push({ id: x.id, ref: x.ref, kind: "adjust", date: D(x), day: x.dayRef,
      who: x.createdBy || "", weight: Number(x.weight) || 0, karat: x.karat,
      fine: fine24(x.weight, x.karat), amount: Number(x.value) || 0,
      category: x.category, account: CATEGORY_TO_ACCOUNT[x.category] || null,
      summary: `${x.kind === "wastage" ? "هالك" : "فائض"} ${fmtW(x.weight)} جم`,
      text: searchText(x, [x.ref, x.note, x.kind]), raw: x }));
  (S.businessDays || []).forEach((x) =>
    push({ id: x.id, ref: x.ref, kind: "day", date: D(x), who: x.openedBy || "",
      summary: `يوم ${x.status === "open" ? "مفتوح" : "مقفل"}`,
      text: searchText({ ref: x.ref, by: x.openedBy, status: x.status }), raw: x }));
  (S.taskirEntries || []).forEach((x) =>
    push({ id: x.id, ref: x.ref, kind: "taskir", date: D(x), day: x.dayRef,
      who: x.createdBy || "", weight: Number(x.weight) || 0, karat: x.karat,
      fine: fine24(x.weight, x.karat), amount: Number(x.total) || 0,
      links: [x.officeId].filter(Boolean),
      summary: `تسكير ${fmtW(x.weight)} جم عيار ${x.karat}`,
      text: searchText(x, [x.ref, String(x.weight)]), raw: x }));
  (S.partners || []).forEach((x) =>
    push({ id: x.id, ref: x.ref || x.id, kind: "partner", date: D(x),
      summary: `${x.name} · ${fmt(x.sharePct, 1)}٪`, text: searchText(x, [x.name]), raw: x }));

  return out.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

/// ── ② البحث الحر ──
///
/// يقبل أي حرف: مرجع أو اسم أو مبلغ أو تاريخ أو عيار. الترتيب بالصلة:
/// المطابقة التامة للمرجع أولًا، ثم بداية الكلمة، ثم الاحتواء.

export { buildUniversalIndex };
