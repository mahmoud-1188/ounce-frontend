import { fromHalalas, halalas } from "../core/money.js";
import { computeReturnAmounts } from "./computeReturnAmounts.js";

/// حساب الاستبدال — دالّةٌ نقية، ونسخة العرض المطابقة للخادم
/// (POST /sales/:id/exchange).
///   { returnAmounts, newNet, newTax, newTotal, diff, direction }
///   diff > 0: يدفع العميل · diff < 0: يُردّ له · 0: متعادل
function computeExchangeAmounts({ sale, lineIndexes, newLines, taxRate = 0 }) {
  const returnAmounts = computeReturnAmounts(sale, lineIndexes);
  const rate = Number(taxRate) || 0;
  const newTotalH = (newLines || []).reduce(
    (a, l) => a + halalas((Number(l.unitPrice) || 0) * (Number(l.quantity) || 1)), 0);
  // ⚠ الضريبة تُطبَّق على الفاتورة الجديدة كما طُبّقت على الأصل (شاملة)
  const taxable = !!sale.taxApplicable && rate > 0;
  const newTaxH = taxable ? newTotalH - Math.round(newTotalH / (1 + rate)) : 0;
  const diff = fromHalalas(newTotalH - halalas(returnAmounts.gross));
  return {
    returnAmounts,
    newTotal: fromHalalas(newTotalH),
    newTax: fromHalalas(newTaxH),
    newNet: fromHalalas(newTotalH - newTaxH),
    diff,
    direction: diff > 0 ? "customer_pays" : diff < 0 ? "shop_refunds" : "even",
  };
}

export { computeExchangeAmounts };
