import React from "react";
import { fmtMoney, fmtW } from "../core/money.js";
import { Card } from "./Card.jsx";

const DOC_LABEL = {
  sales: "فاتورة بيع", returns: "مرتجع", purchases: "شراء", expenses: "مصروف", scrap_items: "كسر", cash_tx: "حركة صندوق",
  stocktake: "جرد", daily_custody: "عهدة يومية", fiscal_closures: "إقفال سنة", payroll_runs: "مسيّر رواتب", lots: "دفعة",
};

/// القيد كاملًا (المرجع 5.2.0: EntryDetail): سطوره · رجله الوزنية · من ومتى · ومستنده — الطريق من الرقم إلى الورقة.
/// لا «عكس» هنا: القيد يُصحَّح بمستنده (مرتجع · إلغاء) أو بمهمّةٍ من الإدارة.
function EntryDetail({ entry, journal = [], goldLedger = [], accounts = [], onClose }) {
  const nameOf = (c) => accounts.find((a) => a.code === c)?.name || c;
  const legs = entry.refId ? goldLedger.filter((g) => g.refId === entry.refId && g.refTable === entry.refTable) : [];
  const reversal = entry.reversed ? journal.find((e) => e.reversalOf === entry.id) : null;
  const original = entry.reversalOf ? journal.find((e) => e.id === entry.reversalOf) : null;
  const when = String(entry.date || entry.at || "").slice(0, 16).replace("T", " ");
  const sum = (k) => fmtMoney((entry.lines || []).reduce((a, l) => a + (Number(l[k]) || 0), 0));
  const T = ({ children, bold }) => <p style={{ color: "var(--text3)", margin: bold ? "8px 0 2px" : 0 }} className={`text-[11px] ${bold ? "font-bold" : ""}`}>{children}</p>;
  return (
    <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
      <div className="flex items-baseline justify-between mb-1">
        <span style={{ color: "var(--accent)" }} className="text-[12px] font-bold">القيد {entry.ref}</span>
        <button onClick={onClose} style={{ color: "var(--text3)" }} className="text-[11px] px-2 py-1">إغلاق</button>
      </div>
      <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">{when} · {entry.label || entry.opType}{entry.createdBy ? ` · بواسطة ${entry.createdBy}` : ""}</p>
      {entry.isReversal && <p style={{ color: "var(--bad)", margin: "2px 0 0" }} className="text-[11px]">قيدٌ عكسي لـ{original?.ref || "—"}</p>}
      {entry.reversed && <p style={{ color: "var(--bad)", margin: "2px 0 0" }} className="text-[11px]">عُكس بالقيد {reversal?.ref || "—"}</p>}
      {entry.note && <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[11px]">{entry.note}</p>}
      <T bold>السطور</T>
      {(entry.lines || []).map((l, i) => (
        <div key={i} className="flex items-baseline gap-2 py-0.5">
          <span style={{ color: "var(--text3)", fontFamily: "monospace" }} className="text-[11px]">{l.account}</span>
          <span style={{ color: "var(--text)" }} className="text-[11px] flex-1 truncate">{nameOf(l.account)}</span>
          <span style={{ color: "var(--text2)", fontVariantNumeric: "tabular-nums" }} className="text-[11px]">{Number(l.debit) ? `مدين ${fmtMoney(l.debit)}` : `دائن ${fmtMoney(l.credit)}`}</span>
        </div>
      ))}
      <T>المجموع: مدين {sum("debit")} · دائن {sum("credit")}</T>
      <T bold>الرجل الوزنية</T>
      {legs.length === 0 ? <T>لا رجلَ وزنية مرتبطة بهذا القيد</T> : legs.map((g, i) => (
        <p key={`${g.id}_${i}`} style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">
          {g.accountCode} · {nameOf(String(g.accountCode))} · عيار {g.karat} · {g.type === "in" ? "دخول" : "خروج"} {fmtW(g.weight)} جم
        </p>
      ))}
      <T bold>المستند</T>
      {entry.refTable ? (
        <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">{DOC_LABEL[entry.refTable] || entry.refTable}{entry.refId ? ` · ${String(entry.refId).slice(0, 8).toUpperCase()}` : ""}</p>
      ) : <T>لا مستندَ مرتبط — قيدٌ يدويّ أو نظاميّ</T>}
    </Card>
  );
}

export { EntryDetail };
