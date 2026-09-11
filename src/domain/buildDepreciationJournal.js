import { fromHalalas, halalas } from "../core/money.js";
import { assetStatus } from "./assetStatus.js";
import { monthlyDepreciation } from "./monthlyDepreciation.js";

function buildDepreciationJournal(assets, depreciations, period, actor) {
  const lines = [];
  const details = [];
  (assets || []).forEach((a) => {
    if (a.disposed) return;
    const st = assetStatus(a, depreciations);
    if (st.fullyDepreciated) return;
    // لا يُهلَك قبل تاريخ التشغيل
    if (a.inServiceDate && String(a.inServiceDate).slice(0, 7) > period) return;
    // ولا يُهلَك مرتين لنفس الشهر
    if ((depreciations || []).some((d) => d.assetId === a.id && d.period === period)) return;

    let amt = monthlyDepreciation(a, st.monthsRun);
    // ⚠ القسط الأخير يُقصّ ليقف عند الخردة بالضبط
    const room = fromHalalas(halalas(st.bookValue) - halalas(st.salvage));
    if (halalas(amt) > halalas(room)) amt = room;
    if (halalas(amt) <= 0) return;

    details.push({ assetId: a.id, assetRef: a.ref, name: a.name, amount: amt,
                   costCenterId: a.costCenterId || null });
  });

  const total = details.reduce((a, d) => a + halalas(d.amount), 0);
  if (total > 0) {
    lines.push({ account: "6800", debit: fromHalalas(total), credit: 0,
                 memo: `إهلاك ${period}` });
    lines.push({ account: "1490", debit: 0, credit: fromHalalas(total),
                 memo: "مجمّع الإهلاك" });
  }
  return {
    entry: total > 0 ? {
      id: `${Date.now()}dep`,
      ref: null, date: new Date().toISOString(),
      opType: "depreciation",
      label: `إهلاك شهر ${period}`,
      lines, createdBy: actor || "", posted: true,
      isReversal: false, reversed: false,
    } : null,
    details,
    total: fromHalalas(total),
    balanced: true,
  };
}

/// قيد التخلّص من الأصل.
///
///   مدين  1490 المجمّع        بما أُهلك
///   مدين  النقد               بالمتحصّل
///   دائن  حساب الأصل          بالتكلفة
///   والفرق: ربح (4220) أو خسارة (6810)

export { buildDepreciationJournal };
