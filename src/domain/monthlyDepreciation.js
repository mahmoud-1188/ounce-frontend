import { fromHalalas, halalas } from "../core/money.js";

function monthlyDepreciation(asset, monthIndex = 0) {
  const cost = halalas(asset.cost);
  const salvage = halalas(asset.salvage ?? (asset.cost * (asset.salvagePct || 0)) / 100);
  const base = Math.max(0, cost - salvage);
  const months = Math.max(1, (Number(asset.years) || 1) * 12);

  if (asset.method === "declining") {
    // ⚠ المتناقص على الرصيد الدفتري لا على التكلفة: الأول أكبر ثم يقلّ.
    const rate = 2 / months;
    let book = cost;
    let amount = 0;
    for (let m = 0; m <= monthIndex; m++) {
      amount = Math.max(0, Math.min(Math.round(book * rate), book - salvage));
      book -= amount;
    }
    return fromHalalas(amount);
  }
  return fromHalalas(Math.round(base / months));
}

/// عمر الأصل: المشتراة، المهلَك، الدفتري.

export { monthlyDepreciation };
