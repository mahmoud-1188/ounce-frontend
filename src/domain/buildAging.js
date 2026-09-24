import { fromHalalas, halalas, roundW } from "../core/money.js";

function buildAging({ entries = [], asOf, buckets = [30, 60, 90], unit = "money" }) {
  const now = asOf ? new Date(asOf).getTime() : Date.now();
  // ⚠ عتبة الإهمال تختلف بالوحدة: هللةٌ لا تُذكر، لكن **ميلّي جرامٍ
  // من الذهب يُذكر** — عشرة آلاف قطعةٍ بفرق ميلّي تساوي عشرة جرامات.
  const eps = unit === "weight" ? 0.0005 : 0.01;
  const rows = [];
  for (const e of entries) {
    const bal = Number(e.balance) || 0;
    if (Math.abs(bal) < eps) continue;
    const days = Math.max(0, Math.floor((now - new Date(e.since || e.date).getTime()) / 86400000));
    let bucket = 0;
    for (let i = 0; i < buckets.length; i++) if (days > buckets[i]) bucket = i + 1;
    rows.push({ ...e, days, bucket, balance: bal });
  }
  const labels = ["حتى " + buckets[0] + " يومًا",
    ...buckets.slice(0, -1).map((b, i) => `${b + 1}–${buckets[i + 1]}`),
    `أكثر من ${buckets[buckets.length - 1]}`];
  // ⚠ الجمع بوحدته: الهللة تُدوَّر لمئةٍ من الريال، والجرام لألفٍ منه.
  // من جمع الوزن بحساب المال فقد ميلّي جرامٍ في كل سطر.
  const sum = (list) => unit === "weight"
    ? roundW(list.reduce((a, r) => a + r.balance, 0))
    : fromHalalas(list.reduce((a, r) => a + halalas(r.balance), 0));
  const totals = labels.map((_, i) => sum(rows.filter((r) => r.bucket === i)));
  return {
    rows: rows.sort((a, b) => b.days - a.days),
    labels, totals, unit,
    total: sum(rows),
    // ⚠ المتأخّر جدًّا يُبرز وحده: في المال يُخصَّص له مقابلُ ديونٍ
    // مشكوك فيها، وفي الوزن **أخطر**: ذهبٌ مستحقٌّ عليك منذ سنةٍ يعني
    // أنك بعتَ ذهب غيرك وصرفتَ ثمنه.
    overdue: totals[totals.length - 1],
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  ما يُتمّ البرنامج محاسبيًّا — خمسة محرّكات
// ═══════════════════════════════════════════════════════════════════════

/// ② مقارنة الفترات.
///
/// ⚠ رقمٌ واحد لا يُنبئ بشيء. «صافي الربح 300 ألف» — أهو نموٌّ أم تراجع؟
/// والمراجع لا يقرأ عمودًا واحدًا أبدًا: كل قائمةٍ رسمية عمودان.
///
/// ⚠ وبدفترين: المقارنة بالريال **وبالجرام**. محلٌّ ربحه بالريال زاد
/// ووزنه نقص باع ذهبه في سوقٍ صاعد — وهو خسارةٌ تبدو ربحًا.

export { buildAging };
