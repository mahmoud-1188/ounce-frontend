import { CASH_REF_PREFIX } from "../core/money-rules.js";

function nextCashRef(method, existing) {
  const prefix = CASH_REF_PREFIX[method] || "CSH";
  let max = 0;
  (existing || []).forEach((x) => {
    const m = String(x?.ref || "").match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/// يقرأ نوع العملية من مرجعها — للفرز والبحث والتقارير.

export { nextCashRef };
