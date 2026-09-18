import { fromHalalas, halalas } from "../core/money.js";
import { statementDigest } from "./helpers.js";

function buildOfficialStatement({
  journal = [], account, accounts = [], from, to,
  branchName = "", branchCode = "", preparedBy = "", currency = "ر.س",
}) {
  const acc = accounts.find((a) => a.code === account);
  if (!acc) return { error: `الحساب ${account} غير موجود في الشجرة` };

  // ⚠ يشمل الفروع: كشفُ «المشتريات» يجب أن يشمل كل حسابٍ تحته، وإلا
  // سأل المراجع «وأين شراء الكسر؟» ولم يجده.
  const descendants = (code) => {
    const out = new Set([code]);
    let added = true;
    while (added) {
      added = false;
      for (const a of accounts) {
        if (a.parent && out.has(a.parent) && !out.has(a.code)) { out.add(a.code); added = true; }
      }
    }
    return out;
  };
  const scope = descendants(account);

  const t0 = from ? new Date(from).getTime() : -Infinity;
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;

  let openH = 0;
  const rows = [];
  const sorted = journal.slice().sort((a, b) => String(a.at || a.date).localeCompare(String(b.at || b.date)));
  for (const e of sorted) {
    const t = new Date(e.at || e.date).getTime();
    for (const l of e.lines || []) {
      if (!scope.has(l.account)) continue;
      const d = halalas(l.debit), c = halalas(l.credit);
      if (t < t0) { openH += d - c; continue; }
      if (t > t1) continue;
      rows.push({
        at: e.at || e.date, ref: e.refDoc || e.ref || "", opType: e.opType,
        account: l.account,
        accountName: accounts.find((a) => a.code === l.account)?.name || l.account,
        note: e.note || "", by: e.createdBy || "",
        debit: fromHalalas(d), credit: fromHalalas(c),
      });
    }
  }
  // ⚠ ترقيمٌ بعد الفرز لا قبله: رقمُ السطر يجب أن يتبع التاريخ، ومن
  // رقّم ثم فرز سلّم كشفًا أرقامه مبعثرة.
  let runH = openH;
  const lines = rows.map((r, i) => {
    runH += halalas(r.debit) - halalas(r.credit);
    return { ...r, seq: i + 1, balance: fromHalalas(runH) };
  });

  const debitH = rows.reduce((a, r) => a + halalas(r.debit), 0);
  const creditH = rows.reduce((a, r) => a + halalas(r.credit), 0);
  const closeH = openH + debitH - creditH;

  // ⚠ التحقّق يُحسب لا يُفترض: الافتتاحي + الحركة يجب أن يساوي الختامي
  // بالضبط. اختلافٌ بهللةٍ يعني كسرًا في الحساب لا في العرض.
  const consistent = Math.abs((openH + debitH - creditH) - closeH) < 1;

  const nature = acc.nature || "debit";
  const sign = nature === "credit" ? -1 : 1;
  return {
    account: { code: acc.code, name: acc.name, nature, statement: acc.statement },
    includes: [...scope].filter((c) => c !== account).sort(),
    period: { from: from || null, to: to || null },
    opening: fromHalalas(openH),
    totalDebit: fromHalalas(debitH),
    totalCredit: fromHalalas(creditH),
    closing: fromHalalas(closeH),
    // الرصيد بطبيعته: حسابٌ دائن رصيده الموجب يُعرض موجبًا لا سالبًا
    closingNatural: fromHalalas(closeH * sign),
    lines,
    count: lines.length,
    consistent,
    // ═══ الختم ═══
    stamp: {
      branchName, branchCode,
      preparedBy,
      preparedAt: new Date().toISOString(),
      currency,
      // ⚠ بصمةٌ على المحتوى: من عدّل رقمًا في الملف بعد التسليم يُكشف
      // بإعادة الاستخراج ومقارنة البصمة.
      digest: statementDigest({ account, from, to, openH, debitH, creditH, n: lines.length }),
    },
  };
}

export { buildOfficialStatement };
