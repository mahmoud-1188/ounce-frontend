import React, { useState } from "react";
import { FileMinus, FileSpreadsheet, FileText, Plus } from "lucide-react";
import * as XLSX from "xlsx";
import { CATEGORY_TO_ACCOUNT } from "../core/chart.js";
import { EXPENSE_CATEGORIES } from "../core/constants.js";
import { fmt, fmtMoney } from "../core/money.js";
import { accountLabel, exportTablesPdf, fundingSourceLabel, inputStyle } from "../domain/helpers.js";
import { AddExpenseForm } from "../ui/AddExpenseForm.jsx";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";

function ExpensesTab({ expenseNames = [], users = [], onAddExpenseName, onDeleteExpenseName, expenses, totals, currency, onAdd, flashToast }) {
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState("list"); // list | byCategory | payroll
  const [period, setPeriod] = useState("month");
  const [search, setSearch] = useState("");
  const [openMonth, setOpenMonth] = useState(null);

  const inRange = (d) => {
    if (period === "all") return true;
    const x = new Date(d);
    const now = new Date();
    if (period === "today") return x.toDateString() === now.toDateString();
    return x.getFullYear() === now.getFullYear() && x.getMonth() === now.getMonth();
  };
  const catLabel = (id) => EXPENSE_CATEGORIES.find((c) => c.id === id)?.label || id;

  const filtered = expenses
    .filter((e) => inRange(e.date))
    .filter((e) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [e.name, e.ref, e.note, e.employeeName, e.createdBy, catLabel(e.category)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });

  const periodTotal = filtered.reduce((a, e) => a + (Number(e.amount) || 0), 0);

  // تجميع حسب التصنيف مع الإجماليات — يجيب سؤال «أين ذهب المبلغ؟»
  const byCat = {};
  filtered.forEach((e) => {
    if (!byCat[e.category]) byCat[e.category] = { total: 0, items: [] };
    byCat[e.category].total += Number(e.amount) || 0;
    byCat[e.category].items.push(e);
  });
  const catRows = Object.entries(byCat).sort((a, b) => b[1].total - a[1].total);

  // كشف الرواتب لكل موظف
  const payroll = users.map((u) => {
    const mine = expenses.filter((e) => e.employeeId === u.id);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const paidMonth = mine
      .filter((e) => e.category === "salaries" && (e.periodMonth || e.date.slice(0, 7)) === thisMonth)
      .reduce((a, e) => a + e.amount, 0);
    const advMonth = mine
      .filter((e) => e.category === "advance" && (e.periodMonth || e.date.slice(0, 7)) === thisMonth)
      .reduce((a, e) => a + e.amount, 0);
    const salary = Number(u.salary) || 0;
    return {
      user: u,
      salary,
      paidMonth,
      advMonth,
      // المتبقي = الراتب − ما صُرف − ما سُحب سلفًا
      remaining: salary - paidMonth - advMonth,
      history: mine.sort((a, b) => new Date(b.date) - new Date(a.date)),
    };
  });

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const rows = [["المرجع", "التاريخ", "البيان", "التصنيف", `المبلغ (${currency})`, "مصدر الصرف", "الموظف", "من سجّله", "ملاحظات"]];
    filtered.forEach((e) =>
      rows.push([
        e.ref || "",
        new Date(e.date).toLocaleString("en-GB"),
        e.name || "—",
        catLabel(e.category),
        fmt(e.amount, 2),
        fundingSourceLabel(e.fundingSource),
        e.employeeName || "",
        e.createdBy || "",
        e.note || "",
      ])
    );
    rows.push([]);
    rows.push(["الإجمالي", "", "", "", fmt(periodTotal, 2)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "المصروفات");

    const cr = [["التصنيف", `الإجمالي (${currency})`, "عدد العمليات", "النسبة %"]];
    catRows.forEach(([id, v]) =>
      cr.push([catLabel(id), fmt(v.total, 2), v.items.length, periodTotal ? fmt((v.total / periodTotal) * 100, 1) : "0"])
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cr), "حسب التصنيف");

    const pr = [["الموظف", `الراتب (${currency})`, `صُرف (${currency})`, `سلف (${currency})`, `المتبقي (${currency})`]];
    payroll.forEach((p) => pr.push([p.user.name, fmtMoney(p.salary), fmtMoney(p.paidMonth), fmtMoney(p.advMonth), fmtMoney(p.remaining)]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pr), "الرواتب");

    XLSX.writeFile(wb, `المصروفات_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const ExpenseRow = ({ e }) => (
    <Card style={{ padding: 12 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold">
            {e.name || catLabel(e.category)}
          </p>
          <p style={{ color: "var(--text2)" }} className="text-[11px] mt-0.5">
            {catLabel(e.category)}
            {e.recurring ? " · ثابت" : " · يومي"}
            {e.employeeName ? ` · ${e.employeeName}` : ""}
          </p>
        </div>
        <span style={{ color: "var(--bad)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold whitespace-nowrap">
          −{currency}
          {fmtMoney(e.amount)}
        </span>
      </div>
      <div className="flex items-center flex-wrap gap-x-2 mt-1.5 pt-1.5" style={{ borderTop: "1px solid var(--line)" }}>
        {e.ref && (
          <span style={{ color: "var(--accent)", fontFamily: "monospace" }} className="text-[10px]">
            {e.ref}
          </span>
        )}
        <span style={{ color: "var(--text3)" }} className="text-[10px]">
          {new Date(e.date).toLocaleString("en-GB")}
        </span>
        <span style={{ color: "var(--text3)" }} className="text-[10px]">
          · من {fundingSourceLabel(e.fundingSource)}
        </span>
        {e.createdBy && (
          <span style={{ color: "var(--text3)" }} className="text-[10px]">
            · سجّله {e.createdBy}
          </span>
        )}
      </div>
      {e.note && (
        <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
          {e.note}
        </p>
      )}
    </Card>
  );

  return (
    <div className="px-4 pt-2">
      <h1 style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)" }} className="text-2xl font-extrabold mb-3">
        المصروفات
      </h1>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { id: "today", label: "اليوم" },
          { id: "month", label: "الشهر" },
          { id: "all", label: "الكل" },
        ].map((x) => (
          <button
            key={x.id}
            onClick={() => setPeriod(x.id)}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: period === x.id ? "var(--accentBg)" : "var(--panel)", color: period === x.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            {x.label}
          </button>
        ))}
      </div>

      <Card style={{ padding: 16, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
        <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
          إجمالي المصروفات
        </p>
        <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--bad)" }} className="text-2xl font-extrabold">
          {currency}
          {fmtMoney(periodTotal)}
        </p>
        <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
          {filtered.length} عملية · ثابتة {currency}
          {fmt(filtered.filter((e) => e.recurring).reduce((a, e) => a + e.amount, 0), 0)} · يومية {currency}
          {fmt(filtered.filter((e) => !e.recurring).reduce((a, e) => a + e.amount, 0), 0)}
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { id: "list", label: "التفاصيل" },
          { id: "byCategory", label: "حسب التصنيف" },
          { id: "payroll", label: "الرواتب" },
        ].map((x) => (
          <button
            key={x.id}
            onClick={() => setView(x.id)}
            className="py-2 rounded-xl text-[11px] font-bold"
            style={{ background: view === x.id ? "var(--accentBg)" : "var(--panel)", color: view === x.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            {x.label}
          </button>
        ))}
      </div>

      {!showForm ? (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setShowForm(true)}
            className="py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
          >
            <Plus size={17} /> تسجيل مصروف
          </button>
          <button
            onClick={() =>
              exportTablesPdf({
                title: "المصروفات",
                onBlocked: flashToast,
                sections: [{
                  title: "بنود المصروفات",
                  headers: ["البند", "التاريخ", `المبلغ (${currency})`, "الحساب", "بواسطة"],
                  rows: (list || []).map((e) => [
                    e.name || accountLabel(e.category),
                    String(e.date || "").slice(0, 10),
                    fmtMoney(e.amount),
                    CATEGORY_TO_ACCOUNT[e.category] || "6000",
                    e.createdBy || "",
                  ]).concat([["المجموع", "",
                    fmtMoney((list || []).reduce((a, e) => a + (Number(e.amount) || 0), 0)), "", ""]]),
                }],
              })
            }
            className="py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
          >
            <FileText size={16} /> PDF
          </button>
          <button
            onClick={exportXlsx}
            className="py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}
          >
            <FileSpreadsheet size={16} /> Excel
          </button>
        </div>
      ) : (
        <AddExpenseForm
          expenseNames={expenseNames}
          users={users}
          onAddExpenseName={onAddExpenseName}
          onCancel={() => setShowForm(false)}
          onSave={(entry) => {
            onAdd(entry);
            setShowForm(false);
          }}
        />
      )}

      {view === "list" && (
        <>
          <input style={{ ...inputStyle, marginBottom: 10 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالبيان أو المرجع أو الموظف..." />
          {filtered.length === 0 ? (
            <EmptyState icon={<FileMinus size={36} color="var(--accentText)" />} title="لا توجد مصروفات" sub="سجّل أول مصروف لهذه الفترة" />
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((e) => (
                <ExpenseRow key={e.id} e={e} />
              ))}
            </div>
          )}
        </>
      )}

      {view === "byCategory" && (
        <div className="flex flex-col gap-2">
          {catRows.length === 0 ? (
            <EmptyState icon={<FileMinus size={36} color="var(--accentText)" />} title="لا توجد مصروفات" sub="جرّب فترة أخرى" />
          ) : (
            catRows.map(([id, v]) => (
              <div key={id}>
                <button onClick={() => setOpenMonth(openMonth === id ? null : id)} className="w-full text-right">
                  <Card style={{ padding: 12, border: openMonth === id ? "1px solid var(--accentLine)" : "1px solid var(--line)" }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                        {catLabel(id)}
                      </span>
                      <span style={{ color: "var(--bad)" }} className="text-sm font-bold">
                        {currency}
                        {fmtMoney(v.total)}
                      </span>
                    </div>
                    <div className="mt-1.5" style={{ height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${periodTotal ? (v.total / periodTotal) * 100 : 0}%`, height: "100%", background: "var(--bad)" }} />
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                      {v.items.length} عملية · {periodTotal ? fmt((v.total / periodTotal) * 100, 1) : 0}٪ من الإجمالي · اضغط للتفصيل
                    </p>
                  </Card>
                </button>
                {openMonth === id && (
                  <div className="flex flex-col gap-2 mt-2 mb-2" style={{ paddingRight: 10 }}>
                    {v.items.map((e) => (
                      <ExpenseRow key={e.id} e={e} />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {view === "payroll" && (
        <div className="flex flex-col gap-2">
          <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
            كشف رواتب الشهر الحالي. السلفة تُخصم من المتبقي، فتعرف ما استلمه كل موظف وما بقي له.
          </p>
          {payroll.map((p) => (
            <div key={p.user.id}>
              <button onClick={() => setOpenMonth(openMonth === p.user.id ? null : p.user.id)} className="w-full text-right">
                <Card style={{ padding: 12, border: openMonth === p.user.id ? "1px solid var(--accentLine)" : "1px solid var(--line)" }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                      {p.user.name}
                      {p.user.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{p.user.ref}</span>}
                    </span>
                    <span
                      style={{ color: p.salary === 0 ? "var(--text3)" : Math.abs(p.remaining) < 0.01 ? "var(--goodSolid)" : p.remaining > 0 ? "var(--accent)" : "var(--bad)" }}
                      className="text-sm font-bold"
                    >
                      {p.salary === 0 ? "بلا راتب" : Math.abs(p.remaining) < 0.01 ? "مسدَّد" : `متبقٍ ${fmtMoney(p.remaining)}`}
                    </span>
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                    الراتب {fmtMoney(p.salary)} · صُرف {fmtMoney(p.paidMonth)} · سلف {fmtMoney(p.advMonth)}
                  </p>
                  {p.remaining < 0 && (
                    <p style={{ color: "var(--bad)" }} className="text-[11px] mt-0.5">
                      صُرف له أكثر من راتبه بـ{fmtMoney(Math.abs(p.remaining))} — يُخصم من الشهر القادم.
                    </p>
                  )}
                </Card>
              </button>
              {openMonth === p.user.id && (
                <div className="flex flex-col gap-2 mt-2 mb-2" style={{ paddingRight: 10 }}>
                  {p.history.length === 0 ? (
                    <p style={{ color: "var(--text3)" }} className="text-[11px] px-2">
                      لا توجد حركات رواتب لهذا الموظف
                    </p>
                  ) : (
                    p.history.map((e) => <ExpenseRow key={e.id} e={e} />)
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 20 }} />
    </div>
  );
}

export { ExpensesTab };
