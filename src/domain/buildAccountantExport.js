import { JOURNALS } from "../core/chart.js";
import { fromHalalas, halalas, roundW } from "../core/money.js";

/// صيغ التصدير لمكتب المحاسبة — من المرجع (ACCOUNTANT_FORMATS).
///
/// ⚠ «أوقية — بدفترين» الصيغة الوحيدة التي تحمل الوزن: غيرها يُسقطه،
/// ومحاسبٌ خارجيّ لا يرى إلا الريال فيظنّ المحل خاسرًا وهو رابحٌ بالجرام.
const ACCOUNTANT_FORMATS = [
  { id: "generic", label: "عام — عمودان لكل سطر",
    cols: ["التاريخ", "المرجع", "الحساب", "اسم الحساب", "مدين", "دائن", "البيان"],
    row: (e, l, acc) => [String(e.at || e.date).slice(0, 10), e.refDoc || e.ref || "",
      l.account, acc, l.debit || 0, l.credit || 0, e.note || e.label || ""] },
  { id: "onyx", label: "أونكس / الأمين — قيدٌ بسطرين",
    cols: ["رقم القيد", "التاريخ", "رقم الحساب", "مدين", "دائن", "البيان", "المرجع"],
    row: (e, l, acc, i) => [i, String(e.at || e.date).slice(0, 10),
      l.account, l.debit || 0, l.credit || 0, e.note || e.label || "", e.refDoc || e.ref || ""] },
  { id: "quickbooks", label: "QuickBooks — IIF",
    cols: ["!TRNS", "DATE", "ACCNT", "AMOUNT", "MEMO", "DOCNUM"],
    row: (e, l, acc) => ["TRNS", String(e.at || e.date).slice(0, 10), acc,
      fromHalalas(halalas(l.debit) - halalas(l.credit)), e.note || e.label || "", e.refDoc || e.ref || ""] },
  { id: "dual", label: "أوقية — بدفترين",
    cols: ["التاريخ", "المرجع", "اليومية", "الحساب", "اسم الحساب", "مدين", "دائن", "وزن داخل", "وزن خارج", "البيان"],
    row: (e, l, acc) => [String(e.at || e.date).slice(0, 10), e.refDoc || e.ref || "",
      (JOURNALS.find((j) => j.id === e.journalId)
        || JOURNALS.find((j) => (j.ops || []).includes(e.opType))
        || { label: "اليومية العامة" }).label,
      l.account, acc, l.debit || 0, l.credit || 0,
      e.fineIn || 0, e.fineOut || 0, e.note || e.label || ""] },
];

function buildAccountantExport({ format = "generic", journal = [], goldLedger = [], accounts = [], from, to }) {
  const def = ACCOUNTANT_FORMATS.find((f) => f.id === format) || ACCOUNTANT_FORMATS[0];
  const t0 = from ? new Date(from).getTime() : -Infinity;
  const t1 = to ? new Date(String(to).length <= 10 ? `${to}T23:59:59.999` : to).getTime() : Infinity;
  const nameOf = (code) => accounts.find((a) => a.code === code)?.name || code;
  // ⚠ الوزن يُلحق بالقيد قبل التصدير: الدفتران منفصلان في التخزين،
  // ومكتب المحاسبة يريد سطرًا واحدًا يحمل الاثنين.
  const fineBy = {};
  for (const g of goldLedger) {
    const k = g.refId || g.ref;
    if (!k) continue;
    const f = (Number(g.weight) || 0) * (Number(g.karat) || 24) / 24;
    const rec = (fineBy[k] ??= { in: 0, out: 0 });
    if (g.type === "in") rec.in = roundW(rec.in + f); else rec.out = roundW(rec.out + f);
  }
  const rows = [];
  let n = 0;
  for (const e of journal) {
    const t = new Date(e.at || e.date).getTime();
    if (t < t0 || t > t1) continue;
    n += 1;
    const fine = fineBy[e.refDoc] || fineBy[e.ref] || fineBy[e.refId] || { in: 0, out: 0 };
    for (const l of e.lines || []) {
      rows.push(def.row({ ...e, fineIn: fine.in, fineOut: fine.out }, l, nameOf(l.account), n));
    }
  }
  return { format: def.id, label: def.label, columns: def.cols, rows, count: rows.length, entries: n };
}

export { ACCOUNTANT_FORMATS, buildAccountantExport };
