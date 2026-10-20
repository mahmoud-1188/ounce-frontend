/// ما يُراجع قبل إنهاء اليوم (المرجع endOfDayBlockers): «block» يوقف الإقفال، و«warn» يُراجع ثم يُكمل.
/// كل سطرٍ يحمل الشاشة التي يُحلّ فيها (go).
function endOfDayBlockers({ stocktakeLock = null, heldUnits = 0, parked = 0, suspendedScrap = 0, approvalsPending = 0, openCustody = false } = {}) {
  const out = [];
  if (stocktakeLock) out.push({ id: "stocktake", level: "block", label: "جردٌ مفتوح", hint: `بدأه ${stocktakeLock.startedBy || "—"} — أنهِ الجرد أو أوقفه أوّلًا`, go: "stocktake" });
  if (heldUnits > 0) out.push({ id: "held", level: "warn", label: `${heldUnits} قطعة معلّقة`, hint: "معلّقةٌ من إخراجٍ قديم — أكمل بيعها أو أعدها من الرئيسية" });
  if (parked > 0) out.push({ id: "parked", level: "warn", label: `${parked} فاتورة معلّقة`, hint: "استأنفها أو ألغِها ليُفكّ حجز قطعها", go: "saleDrafts" });
  if (suspendedScrap > 0) out.push({ id: "scrap", level: "warn", label: `${suspendedScrap} كسر لم يُسوَّ`, hint: "يبقى معلّقًا ويُسجَّل في لقطة اليوم", go: "scrapCustody" });
  // block لا warn: لا يُقفل يومٌ وفيه طلبُ اعتمادٍ ينتظر
  if (approvalsPending > 0) out.push({ id: "approvals", level: "block", label: `${approvalsPending} طلب اعتماد معلّق`, hint: "قرّره أو ألغِه أوّلًا — لا يُقفل اليوم وفيه طلبٌ ينتظر", go: "approvals" });
  if (!openCustody) out.push({ id: "custody", level: "warn", label: "لا عهدة درج مفتوحة", hint: "العدّ يقارن الصندوق بما هو متوقّع فيه" });
  return out;
}

export { endOfDayBlockers };
