import { POSTING_RULES } from "../core/chart.js";

function buildJournalLines(opType, amount, extra = {}) {
  const rule = POSTING_RULES[opType];
  if (!rule) return { lines: [], balanced: false, error: `عملية غير معلَنة: ${opType}` };
  const amt = Math.round((Number(amount) || 0) * 100) / 100;
  if (amt <= 0) return { lines: [], balanced: true, error: null };

  const lines = [];
  // القاعدة تحمل الطرف الأشيع؛ المستدعي يبدّله حين يخرج المال من مصدر آخر
  // (الشبكة بدل الكاش) — بدل تكرار قاعدة لكل مصدر.
  const debitAcc = extra.debitOverride || rule.cash?.debit;
  const creditAcc = extra.creditOverride || rule.cash?.credit;
  if (debitAcc) lines.push({ account: debitAcc, debit: amt, credit: 0 });
  if (creditAcc) lines.push({ account: creditAcc, debit: 0, credit: amt });

  // أطراف إضافية معلَنة في الاستدعاء — الضريبة مثلًا
  (extra.splits || []).forEach((sp) => {
    const v = Math.round((Number(sp.amount) || 0) * 100) / 100;
    if (v <= 0) return;
    lines.push({
      account: sp.account,
      debit: sp.side === "debit" ? v : 0,
      credit: sp.side === "credit" ? v : 0,
    });
  });

  const dr = lines.reduce((a, l) => a + l.debit, 0);
  const cr = lines.reduce((a, l) => a + l.credit, 0);
  return {
    lines,
    balanced: Math.abs(dr - cr) < 0.005,
    error: lines.length < 2 ? "قيد بطرف واحد — ناقص لا غير متوازن" : null,
    totals: { debit: Math.round(dr * 100) / 100, credit: Math.round(cr * 100) / 100 },
  };
}

/// يتحقق من توازن قيد جاهز.

export { buildJournalLines };
