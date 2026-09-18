import React, { useMemo, useState } from "react";
import { ROLES, STATEMENT_ENTITIES } from "../core/constants.js";
import { fmtMoney, fmtW } from "../core/money.js";
import { buildEntityStatement } from "../domain/buildEntityStatement.js";
import { exportLedgerXlsx, exportTablesPdf, inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function AnyStatementPage({
  suppliers = [], customers = [], users = [], taskirOffices = [], partners = [],
  items = [], lots = [], accounts = [], businessDays = [], expenseNames = [],
  sales = [], returns = [], expenses = [], receipts = [], cashTx = [], safeTx = [],
  scrapEntries = [], taskirat = [], officeTx = [], partnerTx = [], journal = [],
  goldLedger = [], reservations = [], repairs = [],
  currency = "ر.س", branchName = "", preparedBy = "", onBack,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [kind, setKind] = useState("customer");
  const [target, setTarget] = useState("");
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(today);
  const [q, setQ] = useState("");
  const money = (v) => `${currency}${fmtMoney(v || 0)}`;

  // ⚠ قائمة الأهداف من الكيان نفسه: لا جداول ثابتة تنحرف عن البيانات
  const options = useMemo(() => {
    const L = {
      supplier: suppliers.map((x) => ({ id: x.id, label: x.name })),
      customer: customers.map((x) => ({ id: x.id, label: x.name })),
      seller: users.map((x) => ({ id: x.name, label: `${x.name} · ${ROLES[x.role]?.label || x.role}` })),
      office: taskirOffices.map((x) => ({ id: x.id, label: x.name })),
      partner: partners.map((x) => ({ id: x.id, label: x.name })),
      item: items.filter((x) => !x.voided).map((x) => ({ id: x.id, label: `${x.ref} · ${x.description}` })),
      lot: lots.map((x) => ({ id: x.id, label: `${x.ref} · ${suppliers.find((s) => s.id === x.supplierId)?.name || ""}` })),
      account: accounts.filter((a) => !a.group).map((x) => ({ id: x.code, label: `${x.code} · ${x.name}` })),
      day: businessDays.map((x) => ({ id: x.id, label: `${x.ref} · ${String(x.openedAt).slice(0, 10)}` })),
      expenseCat: [...new Set(expenses.map((e) => e.category).filter(Boolean))].map((c) => ({ id: c, label: EXPENSE_CATEGORIES?.find((x) => x.id === c)?.label || c })),
    }[kind] || [];
    const nq = q.trim().toLowerCase();
    return nq ? L.filter((o) => String(o.label).toLowerCase().includes(nq)) : L;
  }, [kind, q, suppliers, customers, users, taskirOffices, partners, items, lots, accounts, businessDays, expenses]);

  const st = useMemo(() => (target ? buildEntityStatement({
    entity: kind, id: target, from, to,
    sales, returns, lots, items, expenses, receipts, cashTx, safeTx,
    scrapEntries, taskirat, officeTx, partnerTx, journal, goldLedger, businessDays, reservations, repairs,
  }) : null), [kind, target, from, to, sales, returns, lots, items, expenses, receipts,
    cashTx, safeTx, scrapEntries, taskirat, officeTx, partnerTx, journal, goldLedger, businessDays]);

  const def = STATEMENT_ENTITIES.find((e) => e.id === kind);
  const targetLabel = options.find((o) => o.id === target)?.label || target;

  return (
    <div>
      <SubPageHeader title="كشف حساب — أي شيء" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="flex gap-1 mb-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {STATEMENT_ENTITIES.map((e) => (
            <button key={e.id} onClick={() => { setKind(e.id); setTarget(""); setQ(""); }}
              className="py-2 px-3 rounded-xl text-[11px] font-bold"
              style={{ background: kind === e.id ? "var(--accentBg)" : "var(--field)", whiteSpace: "nowrap", flexShrink: 0,
                color: kind === e.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{e.label}</button>
          ))}
        </div>
        {def && <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[10px]">{def.hint}</p>}

        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field label="من"><input type="date" style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="إلى"><input type="date" style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>

        {options.length > 12 && (
          <input style={{ ...inputStyle, marginBottom: 6 }} value={q}
            onChange={(e) => setQ(e.target.value)} placeholder={`ابحث في ${options.length} ${def?.label || ""}`} />
        )}
        <select style={{ ...inputStyle, marginBottom: 10 }} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">— اختر {def?.label || ""} —</option>
          {options.slice(0, 400).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>

        {!target ? (
          <Card style={{ padding: 13 }}>
            <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-6">
              اختر {def?.label || "كيانًا"} لاستخراج كشفه. {options.length === 0 ? "لا عناصر في هذا النوع بعد." : `${options.length} متاحًا.`}
            </p>
          </Card>
        ) : (
          <>
            <Card style={{ padding: 12, marginBottom: 8, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--accent)", margin: 0 }} className="text-[12px] font-bold">{targetLabel}</p>
              <p style={{ color: "var(--text3)", margin: "1px 0 6px" }} className="text-[10px]">
                {def?.label} · من {from} إلى {to}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[["الرصيد الافتتاحي", money(st.openingMoney)], ["إجمالي المدين", money(st.totalDebit)],
                  ["إجمالي الدائن", money(st.totalCredit)], ["الرصيد الختامي", money(st.closingMoney)]].map(([l, v]) => (
                  <div key={l}>
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px]">{l}</p>
                    <p style={{ color: "var(--text)", margin: 0 }} className="text-[12px] font-bold">{v}</p>
                  </div>
                ))}
              </div>
              {/* ⚠ الوزن يُعرض حين يوجد فقط: صفرٌ بالجرام في كشف بائعٍ يُربك */}
              {def?.weight && (st.totalFineIn || st.totalFineOut || st.openingFine) && (
                <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
                  <div className="flex items-baseline justify-between">
                    <span style={{ color: "var(--text3)" }} className="text-[10px]">
                      وزنًا: افتتاحي {fmtW(st.openingFine)} · داخل {fmtW(st.totalFineIn)} · خارج {fmtW(st.totalFineOut)}
                    </span>
                    <span style={{ color: "var(--accent)" }} className="text-[11px] font-bold">
                      {fmtW(st.closingFine)} جم24
                    </span>
                  </div>
                </div>
              )}
              <p style={{ color: st.consistent ? "var(--good)" : "var(--bad)", margin: "6px 0 0" }} className="text-[10px]">
                {st.consistent ? "✓ الافتتاحي + الحركة = الختامي" : "⚠ كسرٌ في الحساب"} · {st.count} حركة
              </p>
            </Card>

            <div className="flex gap-2 mb-3">
              <button onClick={() => exportLedgerXlsx({
                title: `كشف ${def?.label} — ${targetLabel}`,
                meta: { branchName, from, to, preparedBy },
                headers: ["#", "التاريخ", "المرجع", "المستند", "البيان", "مدين", "دائن", "الرصيد", "وزن داخل", "وزن خارج", "رصيد وزني"],
                rows: [["", "", "", "", "الرصيد الافتتاحي", "", "", st.openingMoney, "", "", st.openingFine],
                  ...st.lines.map((r) => [r.seq, String(r.at).slice(0, 10), r.ref, r.doc, r.note,
                    r.debit, r.credit, r.balance, r.fineIn || 0, r.fineOut || 0, r.fineBalance])],
                totals: ["", "", "", "", "الإجمالي", st.totalDebit, st.totalCredit, st.closingMoney,
                  st.totalFineIn, st.totalFineOut, st.closingFine],
                fileBase: `كشف_${kind}` })}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>Excel</button>
              <button onClick={() => exportTablesPdf({
                title: `كشف ${def?.label} — ${targetLabel}`,
                subtitle: `من ${from} إلى ${to}`, branchName, landscape: true,
                sections: [{ headers: ["#", "التاريخ", "المرجع", "المستند", "البيان", "مدين", "دائن", "الرصيد"],
                  rows: [["", "", "", "", "الرصيد الافتتاحي", "", "", fmtMoney(st.openingMoney)],
                    ...st.lines.map((r) => [String(r.seq), String(r.at).slice(0, 10), r.ref, r.doc,
                      r.note, fmtMoney(r.debit), fmtMoney(r.credit), fmtMoney(r.balance)]),
                    ["", "", "", "", "الإجمالي", fmtMoney(st.totalDebit), fmtMoney(st.totalCredit), fmtMoney(st.closingMoney)]] }] })}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>PDF</button>
            </div>

            {st.lines.length === 0 ? (
              <p style={{ color: "var(--text3)" }} className="text-[11px]">لا حركات في الفترة.</p>
            ) : st.lines.map((r) => (
              <Card key={r.seq} style={{ padding: 9, marginBottom: 4 }}>
                <div className="flex items-baseline gap-2">
                  <span style={{ color: "var(--text3)" }} className="text-[10px]">{r.seq}</span>
                  <span style={{ color: "var(--text3)" }} className="text-[10px]">{String(r.at).slice(0, 10)}</span>
                  <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[10px]">{r.ref}</span>
                  <span style={{ color: "var(--text2)" }} className="text-[10px] flex-1 truncate">{r.doc}</span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span style={{ color: "var(--text3)" }} className="text-[10px] truncate flex-1">{r.note}</span>
                  {(r.debit || r.credit) ? (
                    <span style={{ color: r.debit ? "var(--good)" : "var(--bad)" }} className="text-[11px] font-bold">
                      {r.debit ? `+${fmtMoney(r.debit)}` : `−${fmtMoney(r.credit)}`}
                    </span>
                  ) : null}
                  <span style={{ color: "var(--text)" }} className="text-[11px] font-bold mr-2">{fmtMoney(r.balance)}</span>
                </div>
                {(r.fineIn || r.fineOut) ? (
                  <p style={{ color: "var(--accentText)", margin: "1px 0 0" }} className="text-[9px]">
                    {r.fineIn ? `+${fmtW(r.fineIn)}` : `−${fmtW(r.fineOut)}`} جم24 · الرصيد {fmtW(r.fineBalance)}
                  </p>
                ) : null}
              </Card>
            ))}
          </>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

export { AnyStatementPage };
