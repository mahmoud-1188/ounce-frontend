import { fine24, fromHalalas, halalas, roundW } from "../core/money.js";

/// قيمة المرتجع بأسعار الفاتورة الأصل — نسخة العرض المطابقة للخادم
/// (computeReturnAmounts في ounce-backend/src/domain/saleOps.js).
///
/// ⚠ سعر السطر شاملٌ للضريبة: مجموع الأسطر = إجمالي الفاتورة، والضريبة
///   مستخرجة منه. فالمرتجع يُردّ بقيمة أسطره كما دُفعت، والضريبة جزءٌ
///   منها بنسبة الفاتورة الفعلية — لا تُضاف فوقها (كانت تُضاف فيُعرض ردٌّ
///   أكبر مما دفع العميل).
function computeReturnAmounts(sale, lineIndexes) {
  const lines = sale.lines || [];
  const picked = (lineIndexes || []).map((i) => lines[i]).filter(Boolean);
  const lineH = (l) => halalas((Number(l.unitPrice) || 0) * (Number(l.quantity) || 1));

  const gross = picked.reduce((a, l) => a + lineH(l), 0);
  const saleLines = lines.reduce((a, l) => a + lineH(l), 0);
  const saleTax = halalas(sale.taxAmount || 0);
  const tax = saleLines > 0 ? Math.round((gross * saleTax) / saleLines) : 0;

  // ⚖ التكلفة للعرض فقط: تكلفة الشراء وقتها (لقطة السطر) — لا تُرحَّل.
  const lineCost = (l) =>
    (Number(l.costPerGramSnapshot) || 0) * (Number(l.weightSnapshot) || 0) + (Number(l.workmanshipSnapshot) || 0);
  const cost = picked.reduce((a, l) => a + halalas(lineCost(l) * (Number(l.quantity) || 1)), 0);

  return {
    net: fromHalalas(gross - tax),
    tax: fromHalalas(tax),
    gross: fromHalalas(gross),
    cost: fromHalalas(cost),
    lines: picked,
    // الوزن للدفتر الوزني — بُعدٌ مستقل عن المال
    fine: picked.reduce(
      (a, l) => a + fine24(
        (Number(l.weightSnapshot) || 0) * (Number(l.quantity) || 1), l.karatSnapshot
      ), 0
    ),
    byKarat: picked.reduce((m, l) => {
      const k = Number(l.karatSnapshot) || 21;
      const w = (Number(l.weightSnapshot) || 0) * (Number(l.quantity) || 1);
      m[k] = roundW((m[k] || 0) + w);
      return m;
    }, {}),
  };
}

/// ── قيد اليومية (buildReturnJournal) ──
///
///   مدين  4190 مردودات المبيعات      الصافي
///   مدين  2220 ضريبة القيمة المضافة  الضريبة
///   دائن  النقد/البنك/الذمم           الإجمالي
///
/// ⚠ لا سطر تكلفة: النظام دوري (البيع لا يقيّد تكلفة)، و1200/5100 حسابا
///   مجموعة لا يُرحَّل إليهما.

export { computeReturnAmounts };
