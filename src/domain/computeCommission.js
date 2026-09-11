import { DEFAULT_COMMISSION } from "../core/erp.js";
import { saleProfitOf } from "./helpers.js";

function computeCommission(rule, salesForSeller, price24) {
  const r = { ...DEFAULT_COMMISSION, ...(rule || {}) };
  const count = salesForSeller.length;
  const salesTotal = salesForSeller.reduce((a, s) => a + s.total, 0);
  const profitTotal = salesForSeller.reduce((a, s) => a + saleProfitOf(s), 0);
  const base = r.basis === "sales" ? salesTotal : profitTotal;
  const metTarget = salesTotal >= (Number(r.target) || 0);
  const pct = metTarget ? base * (Number(r.rate) || 0) : 0;
  const flat = count * (Number(r.perInvoice) || 0);
  // A negative percentage would mean the shop bills the seller for a loss —
  // clamp it, and let the flat per-invoice amount stand on its own.
  const commission = Math.max(0, pct) + flat;
  return {
    count,
    salesTotal,
    profitTotal,
    base,
    metTarget,
    pct: Math.max(0, pct),
    flat,
    commission,
    commissionGrams: price24 > 0 ? commission / price24 : 0,
  };
}

export { computeCommission };
