import { accountByCode } from "./accountByCode.js";
import { journalBalanced } from "./journalBalanced.js";

function auditJournal(journal) {
  const issues = [];
  const seen = new Set();
  (journal || []).forEach((e) => {
    if (!journalBalanced(e)) issues.push({ ref: e.ref, why: "قيد غير متوازن" });
    if ((e.lines || []).length < 2) issues.push({ ref: e.ref, why: "قيد بطرف واحد" });
    if (seen.has(e.id)) issues.push({ ref: e.ref, why: "معرّف مكرر" });
    seen.add(e.id);
    if (e.isReversal && !e.reversalOf) issues.push({ ref: e.ref, why: "عكس بلا أصل" });
    (e.lines || []).forEach((l) => {
      if (!accountByCode(l.account)) issues.push({ ref: e.ref, why: `حساب غير معرّف ${l.account}` });
      if ((Number(l.debit) || 0) > 0 && (Number(l.credit) || 0) > 0)
        issues.push({ ref: e.ref, why: "سطر مدين ودائن معًا" });
    });
  });
  // قيد أُلغي مرتين
  const revs = {};
  (journal || []).filter((e) => e.isReversal).forEach((e) => {
    revs[e.reversalOf] = (revs[e.reversalOf] || 0) + 1;
  });
  Object.entries(revs).forEach(([id, n]) => {
    if (n > 1) issues.push({ ref: id, why: `أُلغي ${n} مرات` });
  });
  return issues;
}


// ═══════════════════════════════════════════════════════════════════════
//  التحقق عند حدّ التخزين
//
//  ⚠ فحص الواجهة راحةٌ للمستخدم لا حمايةٌ للبيانات.
//
//  الواجهة تُتجاوَز بثلاث طرق على الأقل: أدوات المطوّر في المتصفح،
//  ونسخة احتياطية مستوردة من جهاز آخر، والربط عبر الواجهة البرمجية.
//  وفي الثلاث لا يمرّ السجل على أي حقل ولا زر.
//
//  فالفحص هنا — حيث تدخل البيانات المخزن — لا هناك. وما يُرفض هنا
//  يُرفض مهما كان مصدره.
// ═══════════════════════════════════════════════════════════════════════

/// أنواع الحقول المتاحة للتحقق.

export { auditJournal };
