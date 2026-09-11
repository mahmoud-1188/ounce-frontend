import React, { useState } from "react";
import { Plus } from "lucide-react";
import { EXPENSE_CATEGORIES, ROLES } from "../core/constants.js";
import { fmtMoney } from "../core/money.js";
import { FUNDING_SOURCES } from "../core/workflow.js";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";

function AddExpenseForm({ expenseNames = [], users = [], onAddExpenseName, onCancel, onSave }) {
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].id);
  const [amount, setAmount] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [fundingSource, setFundingSource] = useState("daily_cash");
  const [note, setNote] = useState("");
  const isPayroll = category === "salaries" || category === "advance";
  // الراتب أو السلفة بلا موظف رقم بلا معنى — لا يمكن نسبه لأحد لاحقًا.
  const valid = Number(amount) > 0 && (isPayroll ? !!employeeId : name.trim().length > 0);
  // المسميات المحفوظة للتصنيف الحالي أولًا، ثم البقية — الإيجار لا يظهر
  // ضمن مقترحات الرواتب.
  const saved = [
    ...expenseNames.filter((n) => n.category === category),
    ...expenseNames.filter((n) => n.category !== category),
  ];

  return (
    <Card style={{ padding: 14, marginBottom: 16 }}>
      <Field label="اسم المصروف">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: إيجار المحل" />
      </Field>
      {saved.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {saved.slice(0, 12).map((n) => (
            <button
              key={n.id}
              onClick={() => {
                setName(n.name);
                setCategory(n.category);
              }}
              className="text-[11px] px-2.5 py-1 rounded-full"
              style={{
                background: name === n.name ? "var(--accentBg)" : "var(--panel)",
                color: name === n.name ? "var(--accent)" : "var(--text2)",
                border: "1px solid var(--line)",
              }}
            >
              {n.name}
            </button>
          ))}
        </div>
      )}
      {name.trim() && !expenseNames.some((n) => n.name === name.trim()) && onAddExpenseName && (
        <button
          onClick={() => onAddExpenseName(name.trim(), category)}
          className="w-full py-2 rounded-xl text-[11px] font-bold mb-3 flex items-center justify-center gap-1"
          style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
        >
          <Plus size={12} /> حفظ المسمى للاستخدام المتكرر
        </button>
      )}
      <Field label="التصنيف">
        <select
          style={inputStyle}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            if (e.target.value !== "salaries" && e.target.value !== "advance") setEmployeeId("");
          }}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      {/* الرواتب والسحبيات تُنسب لموظف بعينه — بدونه لا تظهر في كشفه
          ولا تُخصم من مستحقاته. */}
      {isPayroll && (
        <>
          <Field label={category === "advance" ? "صاحب السحبية (إجباري)" : "صاحب الراتب (إجباري)"}>
            <select style={inputStyle} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">اختر الموظف...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.ref ? ` (${u.ref})` : ""}
                  {u.salary > 0 ? ` — راتب ${fmtMoney(u.salary)}` : " — بلا راتب مسجّل"}
                </option>
              ))}
            </select>
          </Field>
          {employeeId &&
            (() => {
              const u = users.find((x) => x.id === employeeId);
              if (!u) return null;
              return (
                <Card style={{ padding: 10, marginBottom: 12, background: "var(--bg)" }}>
                  <p style={{ color: "var(--text)" }} className="text-xs font-bold">
                    {u.name}
                    {u.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{u.ref}</span>}
                  </p>
                  <p style={{ color: "var(--text2)" }} className="text-[11px] mt-0.5">
                    {ROLES[u.role]?.label || ""}
                    {u.salary > 0 ? ` · راتبه ${fmtMoney(u.salary)}` : " · بلا راتب مسجّل"}
                  </p>
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                    {category === "advance"
                      ? "تُخصم السحبية من مستحقاته في كشف الرواتب وتقرير البائعين."
                      : "يُسجَّل صرف راتب عن الشهر الحالي في كشفه."}
                  </p>
                </Card>
              );
            })()}
        </>
      )}

      <Field label="المبلغ">
        <input style={inputStyle} type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeNumeric(e.target.value))} placeholder="0.00" />
      </Field>
      <Field label="الدفع من">
        <select style={inputStyle} value={fundingSource} onChange={(e) => setFundingSource(e.target.value)}>
          {FUNDING_SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-xs mb-3" style={{ color: "var(--text2)" }}>
        <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
        مصروف ثابت (متكرر شهريًا مثل الإيجار أو الرواتب)
      </label>
      <Field label="ملاحظات (اختياري)">
        <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={!valid}
          onClick={() =>
            onSave({
              category, amount, recurring, fundingSource, note: note.trim(),
              // ⚠ إصلاح فجوة حقيقية: كانت onSave لا ترسل name ولا
              // employeeId إطلاقًا رغم أن handleAddExpense كان يقرأهما —
              // فالاسم المكتوب يُفقد دائمًا، والراتب/السلفة لا يُنسبان
              // لموظف أبدًا مهما اختير من القائمة أعلاه.
              name: name.trim(),
              employeeId: isPayroll ? employeeId : null,
            })
          }
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
        >
          حفظ
        </button>
      </div>
    </Card>
  );
}

// ============================================================
// More menu
// ============================================================

// ═══════════════════════════════════════════════════════════════════════
//  القائمة — مجموعات لا قائمة مسطّحة
//
//  ثمانية وعشرون زرًا في شبكة واحدة تعني البحث البصري في كل مرة. التجميع
//  يجعل الوصول قرارين قصيرين بدل مسح طويل: أي مجال؟ ثم أي صفحة؟
//
//  والتقارير في زر واحد كما هي في الذهن: «أريد تقريرًا» أولًا، ثم أيّها.
// ═══════════════════════════════════════════════════════════════════════

export { AddExpenseForm };
