function buildReversal(entry, reason, actor, now) {
  if (!entry) return { error: "القيد غير موجود" };
  if (entry.reversed) return { error: "القيد مُلغى سلفًا" };
  if (entry.isReversal) return { error: "لا يُعكس قيدٌ عكسي" };
  return {
    entry: {
      id: `${Date.now()}rv`,
      ref: null,                       // يُملأ عند الحفظ
      date: now || new Date().toISOString(),
      opType: entry.opType,
      label: `عكس: ${entry.label || entry.opType}`,
      lines: (entry.lines || []).map((l) => ({
        account: l.account,
        debit: Number(l.credit) || 0,   // مقلوبان
        credit: Number(l.debit) || 0,
      })),
      isReversal: true,
      reversalOf: entry.id,
      reversalOfRef: entry.ref || null,
      reason: reason || "",
      refId: entry.refId || null,
      createdBy: actor || "",
      posted: true,
    },
  };
}

/// ميزان مراجعة من دفتر القيود — يجب أن يتوازن تمامًا.

export { buildReversal };
