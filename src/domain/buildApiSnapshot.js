import { roundW } from "../core/money.js";

function buildApiSnapshot(ctx, { from, to, sections } = {}) {
  const inRange = (d) => {
    const x = String(d || "").slice(0, 10);
    return (!from || x >= from) && (!to || x <= to);
  };
  const want = (s) => !sections || sections.includes(s);
  const out = { generatedAt: new Date().toISOString(), from: from || null, to: to || null };

  if (want("sales")) out.sales = (ctx.sales || []).filter((x) => inRange(x.date))
    .map((s) => ({ ref: s.ref, date: s.date, total: s.total, tax: s.taxAmount,
                   method: s.paymentMethod, lines: (s.lines || []).length,
                   customer: s.customerName || null, seller: s.sellerName || null }));
  if (want("journal")) out.journal = (ctx.journal || []).filter((x) => inRange(x.date))
    .map((e) => ({ ref: e.ref, date: e.date, type: e.opType, label: e.label,
                   lines: e.lines, reversed: !!e.reversed }));
  if (want("inventory")) out.inventory = {
    units: (ctx.items || []).reduce((a, i) => a + (i.units || []).filter((u) => !u.sold).length, 0),
    byKarat: (ctx.items || []).reduce((m, i) => {
      const q = (i.units || []).filter((u) => !u.sold).length;
      if (q) m[i.karat] = roundW((m[i.karat] || 0) + (Number(i.weight) || 0) * q);
      return m;
    }, {}),
  };
  if (want("balances")) out.balances = ctx.balances || null;
  return out;
}


// ═══════════════════════════════════════════════════════════════════════
//  نظام التكيّف
//
//  ⚠ التطبيق يعمل على أندرويد وiOS وويندوز. والحلّ ليس تقليص الميزات
//  على الصغيرة، بل **تغيير شكل عرضها**.
//
//  الجدول ذو الأعمدة الستّة لا يُقرأ على 390 بكسل — لكن بياناته
//  نفسها تُقرأ بطاقةً تتوسّع. والمنطق واحد والشكل يتبدّل.
//
//  وكنتُ ألغيتُ هذا النظام حين طُلب الشكل الأصلي، فثبّتُّ العرض عند
//  448 على كل شاشة. وذلك خطأ: الشكل الأصلي هو **ما يراه صاحب الجوال**،
//  لا سقفٌ يُفرض على من يفتح على حاسبه.
// ═══════════════════════════════════════════════════════════════════════

export { buildApiSnapshot };
