import { fromHalalas, halalas, roundW } from "../core/money.js";

function computeFix({ weight_24k, cash_amount, price24 }) {
  const p = Number(price24) || 0;
  if (p <= 0) return { error: "سعر التثبيت لازم" };
  const w = Number(weight_24k) || 0;
  const c = Number(cash_amount) || 0;
  if (w > 0 && c > 0) return { error: "أدخل الوزن أو المبلغ — لا كليهما" };
  if (w > 0) {
    return { weight_24k: roundW(w),
      cash_amount: fromHalalas(Math.round(w * p * 100)), price24: p };
  }
  if (c > 0) {
    return { weight_24k: roundW(c / p),
      cash_amount: fromHalalas(halalas(c)), price24: p };
  }
  return { error: "أدخل وزنًا أو مبلغًا" };
}

/// ── ميزان المراجعة النقدي ──
///
/// يشمل حسابات العملة وحدها. مجموع المدين يجب أن يساوي مجموع الدائن،
/// وإلا فثمّة قيد بطرف واحد.

export { computeFix };
