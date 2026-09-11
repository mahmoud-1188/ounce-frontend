import { DEFAULT_INTEGRATION } from "../core/constants.js";
import { fmt } from "../core/money.js";
import { normalizeName } from "./helpers.js";

function validateExternalInvoice(payload, ctx) {
  const errors = [];
  const cfg = ctx.config || DEFAULT_INTEGRATION;

  if (!payload || typeof payload !== "object") return { ok: false, errors: ["الحمولة غير صالحة"] };
  const extId = String(payload.externalId || payload.invoiceNumber || "").trim();
  if (!extId) errors.push("معرّف الفاتورة الخارجي مفقود (externalId)");

  if ((ctx.received || []).some((r) => r.externalId === extId && r.status === "accepted")) {
    return { ok: false, duplicate: true, externalId: extId, errors: ["فاتورة بنفس المعرّف مسجّلة مسبقًا"] };
  }

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  if (lines.length === 0) errors.push("الفاتورة بلا أصناف");

  // البائع
  let seller = null;
  if (payload.sellerRef) seller = (ctx.users || []).find((u) => u.ref === payload.sellerRef);
  if (!seller && payload.sellerId) seller = (ctx.users || []).find((u) => u.id === payload.sellerId);
  if (!seller && payload.sellerName)
    seller = (ctx.users || []).find((u) => normalizeName(u.name) === normalizeName(payload.sellerName));
  if (!seller && cfg.defaultSellerId) seller = (ctx.users || []).find((u) => u.id === cfg.defaultSellerId);
  if (!seller) {
    errors.push("البائع غير معروف — أرسل sellerRef (الرقم الوظيفي) أو حدّد بائعًا افتراضيًا");
  } else if (payload.sellerRef && seller.ref !== payload.sellerRef) {
    // ⚠ رقم وظيفي غير مطابق: قبولها بالافتراضي ينسب البيع لغير صاحبه،
    // فتُحتسب عمولته لغيره ويختل تقييم أدائه.
    errors.push(`الرقم الوظيفي ${payload.sellerRef} غير مسجّل في هذا الفرع`);
  }

  // العميل (اختياري)
  let customer = null;
  if (payload.customerPhone) customer = (ctx.customers || []).find((c) => c.phone === payload.customerPhone);
  if (!customer && payload.customerName)
    customer = (ctx.customers || []).find((c) => normalizeName(c.name) === normalizeName(payload.customerName));

  // مطابقة الأصناف
  const resolved = [];
  lines.forEach((l, idx) => {
    const qty = Math.max(1, Number(l.quantity) || 1);
    const price = Number(l.unitPrice) || 0;
    let item = null;
    let unitCodes = [];

    if (Array.isArray(l.unitCodes) && l.unitCodes.length) {
      // مطابقة بالرقاقة — الأدق: تحدد القطعة بعينها
      const codes = l.unitCodes.map(String);
      item = (ctx.items || []).find((it) => (it.units || []).some((u) => codes.includes(u.code)));
      if (item) {
        unitCodes = codes.filter((c) => (item.units || []).some((u) => u.code === c && !u.sold));
        const soldAlready = codes.filter((c) => (item.units || []).some((u) => u.code === c && u.sold));
        if (soldAlready.length) errors.push(`السطر ${idx + 1}: الرقاقة ${soldAlready[0]} مباعة مسبقًا`);
      }
    } else if (l.sku) {
      item = (ctx.items || []).find((it) => String(it.sku || "") === String(l.sku));
      if (item) unitCodes = (item.units || []).filter((u) => !u.sold).slice(0, qty).map((u) => u.code);
    } else if (l.itemId) {
      item = (ctx.items || []).find((it) => it.id === l.itemId);
      if (item) unitCodes = (item.units || []).filter((u) => !u.sold).slice(0, qty).map((u) => u.code);
    }

    if (!item) {
      if (cfg.requireKnownItems) errors.push(`السطر ${idx + 1}: الصنف غير موجود في المخزون`);
      return;
    }
    const available = (item.units || []).filter((u) => !u.sold).length;
    if (available < qty) errors.push(`السطر ${idx + 1}: المتاح ${available} والمطلوب ${qty}`);
    if (price <= 0) errors.push(`السطر ${idx + 1}: السعر غير صالح`);

    resolved.push({
      itemId: item.id,
      unitCodes: unitCodes.slice(0, qty),
      quantity: qty,
      unitPrice: price,
      // ⚠ لقطة التكلفة من مخزوننا لا من النظام الخارجي: الربح يُحسب
      // بتكلفتنا الحقيقية، وأي رقم يرسله الطرف الآخر لا يُوثق به.
      costPerGramSnapshot: Number(item.costPerGram) || 0,
      weightSnapshot: Number(item.weight) || 0,
      workmanshipSnapshot: Number(item.lotWorkmanshipShare) || 0,
      karatSnapshot: item.karat,
    });
  });

  const total = resolved.reduce((a, l) => a + l.unitPrice * l.quantity, 0);
  const claimed = Number(payload.total) || 0;
  if (claimed > 0 && Math.abs(claimed - total) > 0.5) {
    errors.push(`إجمالي الفاتورة المرسل ${fmt(claimed, 2)} لا يطابق مجموع الأصناف ${fmt(total, 2)}`);
  }

  const method = ["cash", "card", "credit", "split"].includes(payload.paymentMethod) ? payload.paymentMethod : "cash";
  if (method === "credit" && !customer) errors.push("البيع الآجل يتطلب عميلًا معروفًا");

  return {
    ok: errors.length === 0,
    errors,
    externalId: extId,
    draft: {
      externalId: extId,
      source: payload.system || cfg.systemName || "نظام خارجي",
      sellerId: seller?.id || null,
      sellerRef: seller?.ref || null,
      sellerName: seller?.name || "",
      // هل جاء الرقم من النظام الخارجي أم استُخدم الافتراضي؟
      sellerMatchedBy: payload.sellerRef ? "ref" : payload.sellerName ? "name" : "default",
      customerId: customer?.id || null,
      customerName: customer?.name || null,
      paymentMethod: method,
      cardNetwork: payload.cardNetwork || null,
      cashPart: Number(payload.cashPart) || 0,
      networkPart: Number(payload.networkPart) || 0,
      taxApplicable: !!payload.taxApplicable,
      taxAmount: Number(payload.taxAmount) || 0,
      total,
      lines: resolved,
      issuedAt: payload.issuedAt || new Date().toISOString(),
    },
  };
}

/// مثال الحمولة — يُعرض للمبرمج ويُستخدم في الاختبار.

export { validateExternalInvoice };
