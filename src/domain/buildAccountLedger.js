import { fromHalalas, halalas } from "../core/money.js";

function buildAccountLedger({ journal = [], account, from, to, nature = "debit" }) {
  const t0 = from ? new Date(from).getTime() : -Infinity;
  // ⚠ «إلى» نهاية اليوم لا بدايته: `new Date("2026-09-15")` منتصف الليل،
  // فكل حركات اليوم المختار تُستبعد ويظنّ المستخدم الدفتر فارغًا.
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;
  let opening = 0;
  const rows = [];

  const flat = [];
  for (const e of journal) {
    for (const l of e.lines || []) {
      if (l.account !== account) continue;
      flat.push({
        at: e.at || e.date,
        ref: e.refDoc || e.ref || "",
        id: e.id,
        opType: e.opType,
        note: l.note || e.note || "",
        by: e.createdBy || "",
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      });
    }
  }
  flat.sort((a, b) => String(a.at).localeCompare(String(b.at)));

  const sign = nature === "credit" ? -1 : 1;
  for (const r of flat) {
    const t = new Date(r.at).getTime();
    const delta = halalas(r.debit) - halalas(r.credit);
    if (t < t0) { opening += delta; continue; }
    if (t > t1) continue;
    rows.push(r);
  }

  let run = opening;
  const withBalance = rows.map((r) => {
    run += halalas(r.debit) - halalas(r.credit);
    return { ...r, balance: fromHalalas(run * sign) };
  });

  const totDebit = fromHalalas(rows.reduce((a, r) => a + halalas(r.debit), 0));
  const totCredit = fromHalalas(rows.reduce((a, r) => a + halalas(r.credit), 0));
  return {
    account,
    opening: fromHalalas(opening * sign),
    rows: withBalance,
    totalDebit: totDebit,
    totalCredit: totCredit,
    closing: fromHalalas(run * sign),
    // ⚠ يُعلن التوازن: مجموع المدين ناقص الدائن زائد الافتتاحي = الختامي
    consistent: Math.abs((opening + halalas(totDebit) - halalas(totCredit)) - run) < 1,
  };
}

/// تقرير الشجرة المحاسبية: كل حساب برصيده وحركته.
///
/// ⚠ الأرصدة تتجمّع للأب: حسابٌ رئيسي لا حركة عليه مباشرةً يجب أن يُظهر
/// مجموع أبنائه — وإلا بدت المجموعات صفرًا والتقرير بلا معنى.

export { buildAccountLedger };
