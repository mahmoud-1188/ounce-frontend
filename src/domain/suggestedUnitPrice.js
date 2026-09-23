import { pricePerGram } from "../core/money.js";
import { marginFor } from "./helpers.js";

/// السعر الإرشادي للقطعة: معدنٌ بسعر اليوم + أجورها + هامش العيار من
/// الإعدادات. إرشاديٌّ — البائع يقرّر.
function suggestedUnitPrice(item, price24, settings) {
  if (!item) return 0;
  const w = Number(item.weight) || 0;
  const m = marginFor(settings, item.karat);
  const v = pricePerGram(item.karat, price24) * w + (Number(item.workmanshipPerUnit ?? item.workmanship) || 0) + w * (Number(m.perGram) || 0) + (Number(m.fixed) || 0);
  return Math.round(v * 100) / 100;
}

export { suggestedUnitPrice };
