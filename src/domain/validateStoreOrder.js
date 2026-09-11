import { DEFAULT_STORE } from "../core/constants.js";
import { fmt } from "../core/money.js";

function validateStoreOrder(payload, ctx) {
  const errors = [];
  const outOfStock = [];
  const cfg = ctx.config || DEFAULT_STORE;

  if (!payload || typeof payload !== "object") return { ok: false, errors: ["الحمولة غير صالحة"] };
  const orderId = String(payload.orderId || payload.externalId || "").trim();
  if (!orderId) errors.push("رقم الطلب مفقود (orderId)");

  const state = String(payload.status || "paid").toLowerCase();
  if (!["pending", "paid", "cancelled"].includes(state)) errors.push("حالة الطلب غير معروفة");

  const prior = (ctx.orders || []).find((o) => o.orderId === orderId);
  // الطلب نفسه قد يمرّ بمرحلتين (حجز ثم دفع) — تكراره بنفس الحالة فقط
  // هو ما يُرفض.
  if (prior && prior.status === state) {
    return { ok: false, duplicate: true, orderId, errors: [`الطلب مسجّل مسبقًا بحالة «${state}»`] };
  }

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  if (state !== "cancelled" && lines.length === 0) errors.push("الطلب بلا أصناف");

  const resolved = [];
  lines.forEach((l, idx) => {
    const qty = Math.max(1, Number(l.quantity) || 1);
    const price = Number(l.unitPrice) || 0;
    let item = null;
    if (Array.isArray(l.unitCodes) && l.unitCodes.length) {
      const cs = l.unitCodes.map(String);
      item = (ctx.items || []).find((it) => (it.units || []).some((u) => cs.includes(u.code)));
    } else if (l.sku) {
      item = (ctx.items || []).find((it) => String(it.sku || "") === String(l.sku));
    } else if (l.itemId) {
      item = (ctx.items || []).find((it) => it.id === l.itemId);
    }
    if (!item) {
      outOfStock.push(l.sku || l.itemId || (l.unitCodes || [])[0] || `line-${idx + 1}`);
      errors.push(`السطر ${idx + 1}: الصنف غير موجود`);
      return;
    }
    // المتاح = غير مباع وغير ملتزَم به (إلا لهذا الطلب نفسه عند ترقيته للدفع)
    const free = (item.units || []).filter(
      (u) => !u.sold && (!u.onlineStatus || (prior && u.onlineOrderId === orderId))
    );
    if (free.length < qty) {
      outOfStock.push(item.sku || item.id);
      errors.push(`السطر ${idx + 1}: المتاح ${free.length} والمطلوب ${qty}`);
      return;
    }
    resolved.push({
      itemId: item.id,
      unitCodes: free.slice(0, qty).map((u) => u.code),
      quantity: qty,
      unitPrice: price,
      costPerGramSnapshot: Number(item.costPerGram) || 0,
      weightSnapshot: Number(item.weight) || 0,
      workmanshipSnapshot: Number(item.lotWorkmanshipShare) || 0,
      karatSnapshot: item.karat,
    });
  });

  const total = resolved.reduce((a, l) => a + l.unitPrice * l.quantity, 0);
  const claimed = Number(payload.total) || 0;
  if (state === "paid" && claimed > 0 && Math.abs(claimed - total) > 0.5) {
    errors.push(`إجمالي الطلب ${fmt(claimed, 2)} لا يطابق مجموع الأصناف ${fmt(total, 2)}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    outOfStock,
    orderId,
    state,
    draft: {
      orderId,
      state,
      customerName: payload.customerName || null,
      customerPhone: payload.customerPhone || null,
      paymentMethod: payload.paymentMethod === "card" ? "card" : "cash",
      cardNetwork: payload.cardNetwork || null,
      total,
      lines: resolved,
      placedAt: payload.placedAt || new Date().toISOString(),
    },
  };
}

export { validateStoreOrder };
