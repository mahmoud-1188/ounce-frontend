import { fromHalalas, halalas, roundW } from "../core/money.js";

function buildComparison({ current = [], prior = [], keyOf = (x) => x.code, labelOf = (x) => x.name,
  amountOf = (x) => x.amount, unit = "money" }) {
  const valueOf = amountOf;
  // ⚠ نُسقط الفارغ قبل القراءة: صفٌّ واحدٌ `null` في قائمةٍ من مئة
  // يُسقط التقرير كلّه — وسنةُ عملٍ كاملة كشفت هذا في أول تشغيل.
  const cur = (current || []).filter(Boolean);
  const pri = (prior || []).filter(Boolean);
  const P = new Map(pri.map((x) => [keyOf(x), x]));
  const seen = new Set();
  const rows = [];
  const R = (v) => (unit === "weight" ? roundW(v) : fromHalalas(halalas(v)));
  for (const c of cur) {
    const k = keyOf(c);
    seen.add(k);
    const p = P.get(k);
    const now = Number(valueOf(c)) || 0;
    const was = p ? Number(valueOf(p)) || 0 : 0;
    rows.push({ key: k, label: labelOf(c), now: R(now), was: R(was),
      diff: R(now - was),
      // ⚠ النسبة تُحجب حين كان الأساس صفرًا: القسمة على صفرٍ تُنتج
      // «∞٪» أو «زيادة 100٪» — وكلاهما يُضلّل. الصواب: «جديد».
      pct: Math.abs(was) < (unit === "weight" ? 0.0005 : 0.01)
        ? null : Math.round(((now - was) / Math.abs(was)) * 1000) / 10 });
  }
  // ⚠ ما كان ولم يعد: بندٌ اختفى هو خبرٌ لا فراغ — مصروفٌ توقّف أو
  // إيرادٌ انقطع، وإغفالُه يُخفي نصف القصة.
  for (const p of pri) {
    const k = keyOf(p);
    if (seen.has(k)) continue;
    const was = Number(valueOf(p)) || 0;
    if (Math.abs(was) < 0.01) continue;
    rows.push({ key: k, label: labelOf(p), now: 0, was: R(was), diff: R(-was), pct: -100, gone: true });
  }
  const sum = (f) => R(rows.reduce((a, r) => a + f(r), 0));
  return {
    rows: rows.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)),
    totalNow: sum((r) => r.now), totalWas: sum((r) => r.was), totalDiff: sum((r) => r.diff),
    unit,
  };
}

/// يفحص صحّة الدفتر ويُرجع ما يستحقّ التنبيه.
///
/// ⚠ الميزان يُحسب ويُعرض ولا يُنبّه — ومن لم يفتحه لا يعرف أن دفتره
/// انكسر، وقد يمرّ شهر. الفحص يجري من نفسه ويظهر حيث يُرى.

export { buildComparison };
