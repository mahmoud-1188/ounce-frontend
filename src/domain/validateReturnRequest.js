import { REFUND_TARGETS, RETURN_REASONS } from "../core/workflow.js";

function validateReturnRequest(req, ctx) {
  const errors = [];
  const { sales = [], returns = [], openDay = null, stocktakeLock = false } = ctx || {};

  const sale = sales.find((s) => s.id === req?.saleId);
  if (!sale) {
    return { ok: false, errors: ["الفاتورة غير موجودة"], sale: null };
  }

  // ⚠ لا إرجاع بلا يوم مفتوح: الحركة تحتاج يومًا تُنسب إليه، وإلا
  // ظهرت في يوم آخر عند الإقفال.
  if (!openDay) errors.push("افتح يوم العمل قبل تسجيل المرتجع");
  if (stocktakeLock) errors.push("المخزون مقفل للجرد — لا حركة الآن");

  const idx = Array.isArray(req?.lineIndexes) ? req.lineIndexes : [];
  if (!idx.length) errors.push("اختر سطرًا واحدًا على الأقل");

  const lines = sale.lines || [];
  idx.forEach((i) => {
    if (i < 0 || i >= lines.length) {
      errors.push(`السطر ${i + 1} غير موجود في الفاتورة`);
      return;
    }
    const l = lines[i];
    // ⚠ منع الإرجاع المزدوج: نفحص كل مرتجع سابق لهذه الفاتورة.
    const already = (returns || []).some(
      (r) => r.saleId === sale.id && (r.lineIndexes || []).includes(i)
    );
    if (already) {
      errors.push(`السطر ${i + 1} (${l.itemName || l.name || ""}) مُرتجع سلفًا`);
    }
    // ⚠ الحالة يجب أن تكون «مباعة»
    if (l.status && l.status !== "sold") {
      errors.push(`السطر ${i + 1} حالته «${l.status}» لا «مباعة»`);
    }
  });

  const reason = RETURN_REASONS.find((r) => r.id === req?.reasonId);
  if (!reason) errors.push("اختر سبب الإرجاع");

  const target = REFUND_TARGETS.find((t) => t.id === req?.refundTarget);
  if (!target) errors.push("اختر وجهة ردّ المبلغ");

  // ⚠ الآجل يُخصم من الدَّين لا يُردّ نقدًا
  if (target && target.id !== "credit" && sale.paymentMethod === "credit") {
    errors.push("الفاتورة آجلة — الردّ يُخصم من دَين العميل لا نقدًا");
  }

  return { ok: errors.length === 0, errors, sale, reason, target };
}

/// ── ④ حساب مبالغ المرتجع ──
///
/// ⚠ الضريبة تُحسب على السطر لا بالنسبة من الإجمالي: قسمة ضريبة
/// الفاتورة على عدد الأسطر تُعطي رقمًا خاطئًا حين تختلف أسعار الأسطر.

export { validateReturnRequest };
