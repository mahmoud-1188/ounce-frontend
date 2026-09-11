import { fine24, fromHalalas, halalas, roundW } from "../core/money.js";

function computeReturnAmounts(sale, lineIndexes, taxRate = 0) {
  const lines = sale.lines || [];
  const picked = (lineIndexes || []).map((i) => lines[i]).filter(Boolean);

  const net = picked.reduce(
    (a, l) => a + halalas((Number(l.unitPrice) || 0) * (Number(l.quantity) || 1)), 0
  );
  // نسبة الضريبة الفعلية من الفاتورة إن وُجدت، وإلا المعدّل الحالي
  const saleNet = lines.reduce(
    (a, l) => a + halalas((Number(l.unitPrice) || 0) * (Number(l.quantity) || 1)), 0
  );
  const saleTax = halalas(sale.taxAmount || 0);
  const rate = saleNet > 0 ? saleTax / saleNet : Number(taxRate) || 0;
  const tax = Math.round(net * rate);

  // التكلفة الأصلية — لعكس تكلفة البضاعة المباعة
  const cost = picked.reduce(
    (a, l) => a + halalas(Number(l.unitCost) || Number(l.costSnapshot) || 0), 0
  );

  return {
    net: fromHalalas(net),
    tax: fromHalalas(tax),
    gross: fromHalalas(net + tax),
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

/// ── ⑤ بناء قيد اليومية ──
///
/// جانبان: عكس البيع، وعكس التكلفة.
///
///   مدين  4190 مردودات المبيعات      الصافي
///   مدين  2220 ضريبة القيمة المضافة  الضريبة
///   دائن  النقد/البنك/الذمم           الإجمالي
///
///   مدين  1200 المخزون                التكلفة
///   دائن  5100 تكلفة الذهب المباع     التكلفة
///
/// ⚠ الجانبان في قيد واحد لا اثنين: فصلهما يجعل أحدهما يُرحَّل والآخر
/// يفشل، فيظهر مرتجعٌ بلا تكلفة أو تكلفةٌ بلا مرتجع.

export { computeReturnAmounts };
