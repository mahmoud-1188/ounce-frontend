import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { fmtMoney, fmtW } from "../core/money.js";
import { buildSafeStatement } from "../domain/buildSafeStatement.js";
import { exportTablesPdf, inputStyle } from "../domain/helpers.js";
import { Field } from "../ui/Field.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";

// تاريخ يوم العمل بتوقيت الرياض (YYYY-MM-DD)
const todayRiyadh = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);

// كشف الخزنة لمدّة: النقد بطريقتيه والذهب بنوعيه وعياراته، افتتاحيٌّ ووارد وصادر وختامي، مع Excel وPDF
function SafeStatementSheet({ safeTx = [], safeGoldTx = [], safeBalance = {}, safeGoldBalance = {}, currency = "ر.س", onClose }) {
  const today = todayRiyadh();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const st = useMemo(() => buildSafeStatement({ safeTx, safeGoldTx, safeBalance, safeGoldBalance, from, to }), [safeTx, safeGoldTx, safeBalance, safeGoldBalance, from, to]);
  const cashRows = [["النقد", "افتتاحي", "وارد", "صادر", "ختامي"],
    ...["cash", "network"].map((m) => [m === "cash" ? "نقدي" : "شبكة", fmtMoney(st.cash[m].opening), fmtMoney(st.cash[m].in), fmtMoney(st.cash[m].out), fmtMoney(st.cash[m].closing)])];
  const goldRows = [["الذهب", "العيار", "افتتاحي (جم)", "وارد", "صادر", "ختامي"],
    ...st.gold.map((g) => [g.kind === "raw" ? "كسر" : "مشغول", String(g.karat), fmtW(g.opening), fmtW(g.in), fmtW(g.out), fmtW(g.closing)])];
  const moveRows = [["التاريخ", "البيان", "ملاحظة", "المبلغ أو الوزن"],
    ...st.rows.map((r) => [String(r.date || "").slice(0, 10), r.label, r.note || "", r.unit === "gram" ? `${r.sign}${fmtW(r.value)} جم` : `${r.sign}${fmtMoney(r.value)}`])];
  const sections = [{ title: "كشف الخزنة — النقد", headers: cashRows[0], rows: cashRows.slice(1) }, { title: "الذهب بالخزنة", headers: goldRows[0], rows: goldRows.slice(1) }, { title: "الحركات", headers: moveRows[0], rows: moveRows.slice(1) }];
  const toXlsx = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cashRows), "النقد");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(goldRows), "الذهب");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(moveRows), "الحركات");
    XLSX.writeFile(wb, `كشف-الخزنة-${from}-${to}.xlsx`);
  };
  const toPdf = () => exportTablesPdf({ title: "كشف الخزنة", subtitle: `من ${from} إلى ${to}`, sections });
  const table = (rows) => (
    <div style={{ overflowX: "auto" }}>
      <table className="w-full" data-safe-statement-table>
        <thead><tr>{rows[0].map((h, i) => <th key={i} className="px-1 py-1 text-[11px] text-right" style={{ color: "var(--text3)", borderBottom: "1px solid var(--line)" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.slice(1).map((r, i) => (
          <tr key={i}>{r.map((v, j) => <td key={j} className={`px-1 py-1 text-[11px]${j === 0 ? " font-bold" : ""}`} style={{ color: j === 0 ? "var(--text)" : "var(--text2)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>{v}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
  return (
    <ModalShell title="كشف الخزنة" onClose={onClose}>
      <div data-safe-statement>
        <div className="grid grid-cols-2 gap-3">
          <Field label="من"><input type="date" style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="من تاريخ" /></Field>
          <Field label="إلى"><input type="date" style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} aria-label="إلى تاريخ" /></Field>
        </div>
        <p style={{ color: "var(--text2)" }} className="text-xs font-bold mb-1">النقد ({currency})</p>
        {table(cashRows)}
        <p style={{ color: "var(--text2)" }} className="text-xs font-bold mt-3 mb-1">الذهب (جرام)</p>
        {st.gold.length ? table(goldRows) : <p style={{ color: "var(--text3)" }} className="text-[11px]">لا ذهب في الخزنة في هذه المدّة</p>}
        <p style={{ color: "var(--text2)" }} className="text-xs font-bold mt-3 mb-1">الحركات ({st.rows.length})</p>
        {st.rows.length ? table(moveRows) : <p style={{ color: "var(--text3)" }} className="text-[11px]">لا حركات في المدّة</p>}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button type="button" onClick={toXlsx} data-help="ينزّل كشف الخزنة ملفّ Excel بثلاث أوراق: النقد والذهب والحركات." className="py-2 rounded-xl text-xs font-bold" style={{ minHeight: 40, background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>Excel</button>
          <button type="button" onClick={toPdf} data-help="يطبع كشف الخزنة بالصيغة الرسمية (PDF) للمدّة المختارة." className="py-2 rounded-xl text-xs font-bold" style={{ minHeight: 40, background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>PDF</button>
        </div>
      </div>
    </ModalShell>
  );
}

export { SafeStatementSheet };
