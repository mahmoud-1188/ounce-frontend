function journalBalanced(entry) {
  const dr = (entry?.lines || []).reduce((a, l) => a + (Number(l.debit) || 0), 0);
  const cr = (entry?.lines || []).reduce((a, l) => a + (Number(l.credit) || 0), 0);
  return Math.abs(dr - cr) < 0.005;
}

/// يبني القيد العكسي: نفس الأسطر بطرفين مقلوبين.
///
/// ⚠ لا يُنشأ عكسٌ لقيد مُلغى سلفًا — وإلا صار الإلغاء دورةً لا نهاية
/// لها، ويُقيَّد المبلغ ثلاث مرات.

export { journalBalanced };
