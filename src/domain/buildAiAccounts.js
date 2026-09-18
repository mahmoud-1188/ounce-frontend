import { ALL_ACCOUNT_NODES } from "../core/constants.js";
import { fromHalalas, halalas } from "../core/money.js";

function buildAiAccounts(ctx) {
  const { journal = [] } = ctx || {};
  const acc = {};
  for (const e of journal) {
    for (const l of e.lines || []) {
      const c = String(l.account || "");
      if (!c) continue;
      if (!acc[c]) acc[c] = { debit: 0, credit: 0 };
      acc[c].debit += halalas(l.debit || 0);
      acc[c].credit += halalas(l.credit || 0);
    }
  }
  return ALL_ACCOUNT_NODES
    .filter((a) => acc[a.code])
    .map((a) => ({
      الرمز: a.code, الاسم: a.name, الطبيعة: a.nature === "debit" ? "مدين" : "دائن",
      الوحدة: a.unit === "gram" ? "جرام" : a.unit === "both" ? "كلاهما" : "عملة",
      مدين: fromHalalas(acc[a.code].debit),
      دائن: fromHalalas(acc[a.code].credit),
      الرصيد: fromHalalas(a.nature === "debit"
        ? acc[a.code].debit - acc[a.code].credit
        : acc[a.code].credit - acc[a.code].debit),
    }));
}

export { buildAiAccounts };
