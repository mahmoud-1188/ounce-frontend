import { fromHalalas, halalas } from "../core/money.js";

function buildAccountTreeReport({ journal = [], accounts = [], from, to }) {
  const t0 = from ? new Date(from).getTime() : -Infinity;
  // ⚠ «إلى» نهاية اليوم لا بدايته: `new Date("2026-09-15")` منتصف الليل،
  // فكل حركات اليوم المختار تُستبعد ويظنّ المستخدم الدفتر فارغًا.
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;

  const own = new Map();     // حركة الحساب نفسه
  const before = new Map();  // ما قبل الفترة
  for (const e of journal) {
    const t = new Date(e.at || e.date).getTime();
    for (const l of e.lines || []) {
      const d = halalas(l.debit) - halalas(l.credit);
      if (t < t0) { before.set(l.account, (before.get(l.account) || 0) + d); continue; }
      if (t > t1) continue;
      const cur = own.get(l.account) || { debit: 0, credit: 0, count: 0 };
      cur.debit += halalas(l.debit);
      cur.credit += halalas(l.credit);
      cur.count += 1;
      own.set(l.account, cur);
    }
  }

  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const kids = new Map();
  for (const a of accounts) {
    if (!a.parent) continue;
    if (!kids.has(a.parent)) kids.set(a.parent, []);
    kids.get(a.parent).push(a.code);
  }

  // ⚠ التجميع من الأوراق للأعلى: الترتيب مهمّ — تجميعٌ من الأعلى يقرأ
  // أبناءً لم تُحسب أرصدتهم بعد فيُعطي أصفارًا.
  const memo = new Map();
  const roll = (code) => {
    if (memo.has(code)) return memo.get(code);
    const self = own.get(code) || { debit: 0, credit: 0, count: 0 };
    let d = self.debit, c = self.credit, n = self.count;
    let ob = before.get(code) || 0;
    for (const k of kids.get(code) || []) {
      const r = roll(k);
      d += r.rawDebit; c += r.rawCredit; n += r.count; ob += r.rawOpening;
    }
    const acc = byCode.get(code) || {};
    const sign = acc.nature === "credit" ? -1 : 1;
    const closing = ob + d - c;
    const out = {
      code, name: acc.name || code, parent: acc.parent || null,
      level: String(code).length <= 1 ? 0 : Math.floor(String(code).length / 2),
      unit: acc.unit || "currency", nature: acc.nature || "debit",
      statement: acc.statement || "",
      hasOwn: self.count > 0,
      count: n,
      rawDebit: d, rawCredit: c, rawOpening: ob,
      opening: fromHalalas(ob * sign),
      debit: fromHalalas(d),
      credit: fromHalalas(c),
      closing: fromHalalas(closing * sign),
    };
    memo.set(code, out);
    return out;
  };

  const rows = accounts.map((a) => roll(a.code))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));

  // ⚠ التوازن يُفحص على الأوراق لا على الكل: جمعُ الآباء مع الأبناء
  // يحسب المبلغ مرتين ويُظهر خللًا لا وجود له.
  const leaves = rows.filter((r) => !(kids.get(r.code) || []).length);
  const sumD = leaves.reduce((a, r) => a + r.rawDebit, 0);
  const sumC = leaves.reduce((a, r) => a + r.rawCredit, 0);

  return {
    rows,
    moved: rows.filter((r) => r.count > 0),
    totalDebit: fromHalalas(sumD),
    totalCredit: fromHalalas(sumC),
    balanced: Math.abs(sumD - sumC) < 1,
    difference: fromHalalas(sumD - sumC),
  };
}

/// تصدير موحّد لكشف الحساب.
///
/// ⚠ ورقةٌ واحدة لكل الكشوف: كل كشفٍ بدالة تصديرٍ خاصة يعني أن إصلاح
/// عمودٍ في واحدةٍ يترك الباقي.

export { buildAccountTreeReport };
