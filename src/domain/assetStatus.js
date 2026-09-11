import { fromHalalas, halalas } from "../core/money.js";

function assetStatus(asset, depreciations = []) {
  const mine = depreciations.filter((d) => d.assetId === asset.id);
  const accum = mine.reduce((a, d) => a + halalas(d.amount), 0);
  const cost = halalas(asset.cost);
  const salvage = halalas(asset.salvage ?? (asset.cost * (asset.salvagePct || 0)) / 100);
  const months = Math.max(1, (Number(asset.years) || 1) * 12);
  return {
    cost: fromHalalas(cost),
    salvage: fromHalalas(salvage),
    accumulated: fromHalalas(accum),
    bookValue: fromHalalas(cost - accum),
    monthsRun: mine.length,
    monthsTotal: months,
    // ⚠ لا يُهلَك تحت قيمة الخردة: الاستمرار يُنشئ مصروفًا وهميًا
    // ويجعل الأصل بقيمة سالبة في الميزانية.
    fullyDepreciated: cost - accum <= salvage + 1,
    pct: Math.min(100, Math.round((accum / Math.max(1, cost - salvage)) * 100)),
  };
}

/// قيد الإهلاك الشهري — لكل الأصول العاملة.
///
///   مدين  6800 مصروف الإهلاك
///   دائن  1490 مجمّع إهلاك الأصول

export { assetStatus };
