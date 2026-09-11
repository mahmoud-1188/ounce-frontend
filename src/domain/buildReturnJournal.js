import { fromHalalas, halalas } from "../core/money.js";

function buildReturnJournal({ amounts, target, ref, saleRef, actor, date }) {
  const lines = [];
  const h = (v) => fromHalalas(halalas(v));

  // ① عكس البيع
  if (halalas(amounts.net) > 0)
    lines.push({ account: "4190", debit: h(amounts.net), credit: 0,
      memo: "مردودات المبيعات" });
  if (halalas(amounts.tax) > 0)
    lines.push({ account: "2220", debit: h(amounts.tax), credit: 0,
      memo: "ضريبة مسترجعة" });
  if (halalas(amounts.gross) > 0)
    lines.push({ account: target.account, debit: 0, credit: h(amounts.gross),
      memo: target.label });

  // ② عكس التكلفة — التكلفة المستمرة
  if (halalas(amounts.cost) > 0) {
    lines.push({ account: "1200", debit: h(amounts.cost), credit: 0,
      memo: "عودة المخزون بتكلفته" });
    lines.push({ account: "5100", debit: 0, credit: h(amounts.cost),
      memo: "عكس تكلفة البضاعة المباعة" });
  }

  const dr = lines.reduce((a, l) => a + halalas(l.debit), 0);
  const cr = lines.reduce((a, l) => a + halalas(l.credit), 0);

  return {
    entry: {
      id: `${Date.now()}rj`,
      ref,
      date: date || new Date().toISOString(),
      opType: "sale_return",
      label: `مرتجع مبيعات — ${saleRef}`,
      lines,
      refId: null,
      refDoc: saleRef,
      createdBy: actor || "",
      posted: true,
      isReversal: false,
      reversed: false,
    },
    balanced: dr === cr,
    totals: { debit: fromHalalas(dr), credit: fromHalalas(cr) },
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  سجل التطبيق — أثر التدقيق
//
//  ⚠ السجل يُضاف إليه ولا يُعدَّل ولا يُحذف. سجلٌّ يُمكن تعديله ليس
//  سجلًّا: من عبث بالبيانات يعبث بسجلها في الخطوة نفسها.
//
//  ولهذا كل قيد يحمل بصمة سابقه (سلسلة تجزئة): تغيير سجل واحد يكسر
//  البصمات بعده كلها، فيُكتشف بلا مقارنة بنسخة أخرى.
//
//  والمراجع الخارجي يطلبه أولًا: «من غيّر ماذا ومتى» قبل أن ينظر في
//  رقم واحد.
// ═══════════════════════════════════════════════════════════════════════
/// تجزئة الرقم السري.
///
/// ⚠ الرقم بنصّ صريح في التخزين يعني أن من يفتح وحدة التحكم يقرأ
/// أرقام كل الموظفين. قِستُه: ["1111","9999","2222"] ظاهرةً بسطر واحد.
///
/// وهذه تجزئة مع ملح لا تشفير: تمنع القراءة المباشرة ولا تمنع التخمين
/// من رقمٍ من أربع خانات. الحماية الحقيقية في قصر المحاولات — وهي
/// مطبَّقة أدناه.

export { buildReturnJournal };
