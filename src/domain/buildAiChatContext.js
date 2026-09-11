import { fmt, fmtW } from "../core/money.js";

function buildAiChatContext(role, ctx) {
  if (role === "manager") {
    return [
      `عدد قطع المخزون: ${ctx.totals.pieces}, الوزن بعيار 24: ${fmtW(ctx.totals.fineWeight)} جم`,
      `تكلفة المخزون: ${ctx.currency}${fmt(ctx.totals.cost, 0)}, القيمة الحالية: ${ctx.currency}${fmt(ctx.totals.value, 0)}`,
      `مبيعات: ${ctx.salesTotals.count} فاتورة بإجمالي ${ctx.currency}${fmt(ctx.salesTotals.sum, 0)}, أرباح محققة: ${ctx.currency}${fmt(ctx.totals.realizedProfit, 0)}`,
      `صندوق اليومي: ${ctx.currency}${fmt(ctx.cashBalance.total, 0)} (نقدي ${fmt(ctx.cashBalance.cash, 0)}, شبكة ${fmt(ctx.cashBalance.network, 0)})`,
      `الخزنة: ${ctx.currency}${fmt(ctx.safeBalance.total, 0)} نقدي/شبكة, ذهب كسر ${fmtW(ctx.safeGoldBalance.raw)} جم, ذهب مشغول ${fmtW(ctx.safeGoldBalance.crafted)} جم`,
      `عهدة الكسر: ${ctx.currency}${fmt(ctx.custodyBalance.total, 0)}, كسر بالمخزن: ${fmtW(ctx.scrapTotals.weightInStock)} جم`,
      `المصروفات: ${ctx.currency}${fmt(ctx.expensesTotals.total, 0)} (ثابتة: ${ctx.currency}${fmt(ctx.expensesTotals.fixedTotal, 0)})`,
      `عدد الموردين: ${ctx.suppliers.length}, عدد الدفعات المفتوحة: ${ctx.lots.filter((l) => l.status === "open").length}`,
      `عدد الشركاء: ${ctx.partners.length}, رأس المال: ${ctx.currency}${fmt(ctx.partnersTotals.totalCapital, 0)}`,
      `الذهب الفعلي: ${fmtW(ctx.goldEquivalent.goldGrams)} جم عيار 24 · النقد: ${fmt(ctx.goldEquivalent.cashAmount, 0)} (يعادل ${fmtW(ctx.goldEquivalent.cashGrams)} جم — لا يُجمع مع الذهب)`,
      `سعر جرام عيار 24 اليوم: ${ctx.currency}${fmt(ctx.priceData.current)}`,
    ].join("\n");
  }
  if (role === "assistant") {
    return [
      `مبيعات اليوم/الإجمالي: ${ctx.salesTotals.count} فاتورة بإجمالي ${ctx.currency}${fmt(ctx.salesTotals.sum, 0)}`,
      `عدد قطع المخزون المتاحة للبيع: ${ctx.totals.pieces}`,
      `سعر جرام عيار 24 اليوم: ${ctx.currency}${fmt(ctx.priceData.current)}`,
    ].join("\n");
  }
  // employee
  return [
    `سعر جرام عيار 24 اليوم: ${ctx.currency}${fmt(ctx.priceData.current)}`,
    `عدد الفواتير الإجمالي المسجَّل بالنظام: ${ctx.salesTotals.count}`,
  ].join("\n");
}


// ═══════════════════════════════════════════════════════════════════════
//  محرّك النوايا المحلي
//
//  المساعد كان يعتمد على الشبكة كليًا: يسأل البائع فينتظر ثم يفشل إن
//  انقطع الاتصال أو رُفض الطلب. وأكثر ما يُسأل عنه أرقامٌ موجودة في
//  الجهاز — لا تحتاج شبكة أصلًا.
//
//  فالترتيب صار: نفهم السؤال محليًا ونُجيب من البيانات فورًا؛ وإن لم
//  نفهمه اقترحنا أقرب الأسئلة بدل «لم أفهم».
//
//  والاقتراح ليس تجميلًا: البائع الذي يُقال له «لم أفهم» يترك المساعد،
//  والذي يرى ثلاثة أسئلة قريبة يجد مراده في واحدة منها.
// ═══════════════════════════════════════════════════════════════════════

/// تطبيع عربي للمطابقة: الهمزات والتاء المربوطة والألف المقصورة
/// والتشكيل والبادئات — كلها تكسر المطابقة الحرفية.

export { buildAiChatContext };
