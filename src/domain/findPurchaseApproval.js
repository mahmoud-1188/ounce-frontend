function findPurchaseApproval({ docs = [], weight, amount, karat }) {
  const w = Number(weight) || 0;
  const amt = Number(amount) || 0;
  const live = docs.filter((d) => d.flow === "purchase_request" && d.status === "approved" && !d.consumedAt);
  for (const d of live) {
    const dw = Number(d.weight) || 0;
    const da = Number(d.amount) || 0;
    // ⚠ هامش 5٪: وزن الفاتورة يختلف عن الطلب قليلًا، ورفضُ الفرق كلّه
    // يجعل كل شراءٍ يحتاج موافقةً جديدة.
    const wOk = !dw || (w > 0 && w <= dw * 1.05);
    const aOk = !da || (amt > 0 && amt <= da * 1.05);
    const kOk = !d.karat || !karat || String(d.karat) === String(karat);
    if (wOk && aOk && kOk) return { found: true, doc: d };
  }
  return {
    found: false,
    reason: live.length
      ? `عندك ${live.length} موافقة لكن لا تُغطّي هذا الشراء — الوزن أو المبلغ أو العيار مختلف`
      : "لا موافقة من الإدارة — أرسل «طلب شراء» وانتظر الاعتماد",
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  التكويد المركزي — موظّفٌ يُكوّد نيابةً عن فرع
//
//  ⚠ النطاق لكل موظّف لا لكل شاشة: من فتح شاشة التكويد لموظّفٍ فتحها
//  لكل الفروع. والمكوّد المسؤول عن جدة لا يُكوّد لمخزون الرياض — لأن
//  خطأه هناك يظهر في جردٍ لا يحضره.
// ═══════════════════════════════════════════════════════════════════════

/// الفروع التي يُصرَّح لهذا الموظّف بالتكويد لها.
///
/// `codingScope` على المستخدم: مصفوفة رموز فروع · `"*"` للكل · غيابها = لا شيء.
///
/// ⚠ الغياب يعني «لا شيء» لا «الكل»: من نسي ضبط النطاق لموظّفٍ جديد
/// يجب ألّا يجده مفتوحًا على كل الفروع.

export { findPurchaseApproval };
