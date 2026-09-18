import { fromHalalas, halalas } from "../core/money.js";
import { buildAccountLedger } from "./buildAccountLedger.js";

function buildMultiAccountLedger({ journal = [], codes = [], accounts = [], from, to }) {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const per = codes.map((c) => ({ code: c, name: byCode.get(c)?.name || c,
    ...buildAccountLedger({ journal, account: c, from, to, nature: byCode.get(c)?.nature }) }));
  const rows = per.flatMap((p) => p.rows.map((r) => ({ ...r, account: p.code, accountName: p.name })))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return {
    rows, per,
    totalDebit: fromHalalas(per.reduce((a, p) => a + halalas(p.totalDebit), 0)),
    totalCredit: fromHalalas(per.reduce((a, p) => a + halalas(p.totalCredit), 0)),
  };
}

export { buildMultiAccountLedger };
