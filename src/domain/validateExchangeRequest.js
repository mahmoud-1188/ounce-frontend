import { EXCHANGE_SETTLE } from "../core/workflow.js";
import { validateReturnRequest } from "./validateReturnRequest.js";

/// التحقق من طلب الاستبدال قبل إرساله: شروط المرتجع + قطعٌ جديدة متاحة +
/// طريقة تسوية. الخادم يعيد التحقق كاملًا داخل المعاملة — هذا للعرض فقط.
function validateExchangeRequest(req, ctx) {
  const { items = [] } = ctx || {};
  const base = validateReturnRequest({ ...req, reasonId: req?.reasonId || "changed_mind", refundTarget: "daily_cash" }, ctx);
  // ⚠ لا نمنع الآجل هنا: الاستبدال يُسوّى بطريقته لا بردٍّ نقدي
  const errors = base.errors.filter((e) => !e.includes("الفاتورة آجلة"));
  const settle = EXCHANGE_SETTLE.find((t) => t.id === req?.settle);
  if (!settle) errors.push("اختر طريقة تسوية الفرق");
  if (settle?.id === "credit" && !base.sale?.customerId) errors.push("التسوية على الحساب تحتاج فاتورةً بعميل");
  const newLines = Array.isArray(req?.newLines) ? req.newLines : [];
  if (!newLines.length) errors.push("اختر القطعة الجديدة");
  newLines.forEach((l) => {
    const it = items.find((x) => x.id === l.itemId);
    if (!it) { errors.push("قطعةٌ جديدة غير موجودة"); return; }
    const u = l.unitCode ? (it.units || []).find((x) => String(x.code).toUpperCase() === String(l.unitCode).toUpperCase()) : null;
    if (l.unitCode && !u) errors.push(`${l.unitCode}: ليست في هذا الصنف`);
    else if (u && u.sold) errors.push(`${l.unitCode}: قطعةٌ مباعة`);
    else if (u && u.issued) errors.push(`${l.unitCode}: غير قابلة للبيع — تُفحص أولًا`);
    if (!(Number(l.unitPrice) > 0)) errors.push("سعر القطعة الجديدة غير صالح");
  });
  return { ok: errors.length === 0, errors, sale: base.sale, reason: base.reason, settle };
}

export { validateExchangeRequest };
