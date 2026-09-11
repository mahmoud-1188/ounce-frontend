import { detectColumns, splitCsvLine } from "./helpers.js";
import { parseDate } from "./parseDate.js";
import { parseNum } from "./parseNum.js";

function parseBankStatement(text) {
  const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], error: "الملف فارغ أو بلا صفوف" };

  const headers = splitCsvLine(lines[0]);
  const cols = detectColumns(headers);
  if (cols.date == null) return { rows: [], error: "لم أجد عمود التاريخ", headers };
  if (cols.amount == null && cols.credit == null && cols.debit == null)
    return { rows: [], error: "لم أجد عمود المبلغ", headers };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i]);
    if (c.every((x) => !x)) continue;
    const date = parseDate(c[cols.date]);
    if (!date) continue;

    // عمود واحد بإشارة، أو عمودان منفصلان
    let amount = 0, type = "credit";
    if (cols.credit != null || cols.debit != null) {
      const cr = parseNum(c[cols.credit]), db = parseNum(c[cols.debit]);
      if (cr > 0) { amount = cr; type = "credit"; }
      else if (db > 0) { amount = db; type = "debit"; }
    } else {
      const v = parseNum(c[cols.amount]);
      amount = Math.abs(v);
      type = v < 0 ? "debit" : "credit";
    }
    if (amount === 0) continue;

    rows.push({
      id: `bk_${date}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      date, amount, type,
      ref: cols.ref != null ? String(c[cols.ref] || "").trim() : "",
      desc: cols.desc != null ? String(c[cols.desc] || "").trim() : "",
      raw: lines[i].slice(0, 200),
    });
  }
  return { rows, cols, headers, error: rows.length ? null : "لم أستخرج أي حركة" };
}

/// ── محرّك المطابقة ──
///
/// الترتيب مقصود: الأقوى دليلًا أولًا. المطابقة بالمبلغ وحده آخر
/// الخيارات لأن عمليتين بنفس المبلغ واردتان — ونوسمها «ضعيفة» ليراجعها
/// المحاسب بدل أن تُعتمد صامتة.

export { parseBankStatement };
