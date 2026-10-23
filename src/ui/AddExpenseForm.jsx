import React, { useState } from "react";
import { Plus } from "lucide-react";
import { EXPENSE_CATEGORIES, ROLES } from "../core/constants.js";
import { selectableExpenseCategories } from "../domain/customAccounts.js";
import { fmtMoney } from "../core/money.js";
import { FUNDING_SOURCES } from "../core/workflow.js";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { InvoiceAttachField } from "./InvoiceAttachField.jsx";

/// المصروف بخطوتين: ① المبلغ ② ما هو (مسمّى محفوظ أو مصروفٌ ثابت مستحقّ أو تصنيف) — والباقي في «مزيد».
function AddExpenseForm({ expenseNames = [], fixedDue = [], users = [], onAddExpenseName, onDeleteExpenseName = null, onCancel, onSave }) {
  const [name, setName] = useState("");
  const [autoName, setAutoName] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].id);
  const [amount, setAmount] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [fundingSource, setFundingSource] = useState("daily_cash");
  const [note, setNote] = useState("");
  const [installments, setInstallments] = useState("1");
  const [invoiceFile, setInvoiceFile] = useState(null);
  // ضريبة المدخلات داخل المبلغ — تُخصم من ضريبة المبيعات في الإقرار
  const [vatAmount, setVatAmount] = useState("");
  const [more, setMore] = useState(false);
  // مصروفٌ ثابت مستحقّ اختير: الخادم يعلّم شهره مسجَّلًا بعد نجاح القيد
  const [fixedId, setFixedId] = useState(null);
  const isPayroll = category === "salaries" || category === "advance";
  // الراتب أو السلفة بلا موظف رقم بلا معنى — لا يمكن نسبه لأحد لاحقًا.
  const valid = Number(amount) > 0 && (isPayroll ? !!employeeId : name.trim().length > 0);
  // المسميات المحفوظة للتصنيف الحالي أولًا، ثم البقية — الإيجار لا يظهر ضمن مقترحات الرواتب.
  const saved = [
    ...expenseNames.filter((n) => n.category === category),
    ...expenseNames.filter((n) => n.category !== category),
  ];
  const chip = (on) => ({ minHeight: 36, background: on ? "var(--accentBg)" : "var(--panel)", color: on ? "var(--accent)" : "var(--text2)", border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}` });
  const srcLabel = FUNDING_SOURCES.find((x) => x.id === fundingSource)?.label || fundingSource;
  const missing = [!(Number(amount) > 0) && "اكتب المبلغ", isPayroll ? !employeeId && "اختر الموظف" : !name.trim() && "اختر أو اكتب اسم المصروف"].filter(Boolean);

  return (
    <Card style={{ padding: 14, marginBottom: 16 }}>
      <div data-expense-form>
        <Field label="① المبلغ">
          <input style={{ ...inputStyle, fontSize: 20, fontWeight: 800 }} type="text" inputMode="decimal" value={amount} autoFocus
            onChange={(e) => setAmount(sanitizeNumeric(e.target.value))} placeholder="0.00" aria-label="مبلغ المصروف" />
        </Field>
        <p style={{ color: "var(--text2)" }} className="text-[11px] mb-1.5">② ما هو؟ اختر المسمّى أو التصنيف</p>
        {(fixedDue.length > 0 || saved.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-2" data-expense-chips>
            {fixedDue.slice(0, 6).map((f) => (
              <button key={`f${f.id}`} type="button" data-expense-fixed={f.id}
                onClick={() => { setName(f.name); setAutoName(false); setCategory(f.category); setAmount(String(f.amount)); if (f.fundingSource) setFundingSource(f.fundingSource); setRecurring(true); setFixedId(f.id); }}
                data-help={`مصروفٌ ثابت «${f.name}» مستحقٌّ هذا الشهر — اضغطه ليُملأ الاسم والتصنيف والمبلغ ومصدر الدفع معًا.`}
                className="text-[11px] px-2.5 rounded-full font-bold" style={chip(fixedId === f.id)}>
                ⏰ {f.name} · {fmtMoney(f.amount)}
              </button>
            ))}
            {saved.slice(0, 10).map((n) => (
              <span key={n.id} className="flex items-center gap-0.5">
                <button type="button" data-expense-chip={n.name}
                  onClick={() => { setName(n.name); setAutoName(false); setCategory(n.category); setFixedId(null); }}
                  data-help={`مسمّى مصروفٍ محفوظ «${n.name}» — اضغطه ليُملأ الاسم وتصنيفه معًا.`}
                  className="text-[11px] px-2.5 rounded-full font-bold" style={chip(name === n.name && !fixedId)}>
                  {n.name}
                </button>
                {onDeleteExpenseName && (
                  <button type="button" aria-label={`حذف المسمّى ${n.name}`} data-expense-chip-delete={n.name} onClick={() => onDeleteExpenseName(n.id)}
                    data-help="يحذف هذا المسمّى من المحفوظات — لا يمسّ مصروفًا سُجّل به."
                    className="text-[11px] rounded-full" style={{ minWidth: 22, minHeight: 22, color: "var(--text3)", background: "var(--panel)", border: "1px solid var(--line)" }}>×</button>
                )}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mb-2" role="radiogroup" aria-label="تصنيف المصروف">
          {selectableExpenseCategories().map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={category === c.id} data-cat={c.id}
              data-help={`تصنيف المصروف «${c.label}» — اختره فيُقيَّد المصروف على حسابه.`}
              onClick={() => {
                setCategory(c.id); setFixedId(null);
                if (c.id !== "salaries" && c.id !== "advance") setEmployeeId("");
                if (!name.trim() || autoName) { setName(c.id === "salaries" || c.id === "advance" ? "" : c.label); setAutoName(true); }
              }}
              className="text-[11px] px-2.5 rounded-full" style={chip(category === c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <Field label={isPayroll ? "اسم المصروف (اختياري)" : "اسم المصروف"}>
          <input style={inputStyle} value={name} onChange={(e) => { setName(e.target.value); setAutoName(false); setFixedId(null); }} placeholder="مثال: إيجار المحل" aria-label="اسم المصروف" />
        </Field>
        {/* الرواتب والسحبيات تُنسب لموظف بعينه — بدونه لا تظهر في كشفه ولا تُخصم من مستحقاته. */}
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
                      {u.ref && <span style={{ color: "var(--text3)" }} className="text-[11px] mr-1">{u.ref}</span>}
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
            {category === "advance" && (
              <Field label="عدد الأقساط (تُخصم من الرواتب القادمة)">
                <input style={inputStyle} type="text" inputMode="numeric" value={installments}
                  onChange={(e) => setInstallments(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="1" />
                {Number(installments) > 1 && Number(amount) > 0 && (
                  <p className="text-[11px] mt-1" style={{ color: "var(--text3)" }}>القسط الشهري ≈ {fmtMoney(Number(amount) / Number(installments))} على {Math.min(60, Number(installments))} شهرًا</p>
                )}
              </Field>
            )}
          </>
        )}
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2" data-expense-source>يُدفع من: <b style={{ color: "var(--text2)" }}>{srcLabel}</b> — غيّره من «مزيد»</p>

        <button type="button" onClick={() => setMore((v) => !v)} className="w-full rounded-xl text-[11px] font-bold mb-2" data-expense-more
          style={{ minHeight: 40, background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          {more ? "إخفاء «مزيد»" : "مزيد: مصدر الدفع · حفظ المسمّى · متكرّر · ملاحظات"}
        </button>
        {more && (
          <div className="p-2 mb-2" style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--bg)" }}>
            <Field label="الدفع من">
              <select style={inputStyle} value={fundingSource} onChange={(e) => setFundingSource(e.target.value)} aria-label="مصدر دفع المصروف">
                {FUNDING_SOURCES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            {name.trim() && !expenseNames.some((n) => n.name === name.trim()) && onAddExpenseName && (
              <button
                type="button"
                onClick={() => onAddExpenseName(name.trim(), category)}
                className="w-full py-2 rounded-xl text-[11px] font-bold mb-3 flex items-center justify-center gap-1"
                style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
              >
                <Plus size={12} /> حفظ المسمى للاستخدام المتكرر
              </button>
            )}
            <label className="flex items-center gap-2 text-xs mb-3" style={{ color: "var(--text2)", minHeight: 36 }}>
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
              مصروف ثابت (متكرر شهريًا مثل الإيجار أو الرواتب)
            </label>
            <Field label="ملاحظات (اختياري)">
              <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        )}
        {!isPayroll && (
          <Field label="منها ضريبة القيمة المضافة (اختياري)">
            <div className="flex gap-2">
              <input style={{ ...inputStyle, flex: 1, marginBottom: 0 }} type="text" inputMode="decimal" value={vatAmount}
                onChange={(e) => setVatAmount(sanitizeNumeric(e.target.value))} placeholder="0.00" aria-label="ضريبة المدخلات" />
              <button type="button" data-expense-vat-15 disabled={!(Number(amount) > 0)}
                onClick={() => setVatAmount((Math.round((Number(amount) * 15 / 115) * 100) / 100).toFixed(2))}
                className="px-3 rounded-xl text-[11px] font-bold" style={{ minHeight: 44, background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                15٪ داخل المبلغ
              </button>
            </div>
            {Number(vatAmount) >= Number(amount) && Number(amount) > 0 && <p style={{ color: "var(--bad)" }} className="text-[11px] mt-1">الضريبة أكبر من المبلغ</p>}
          </Field>
        )}
        {!isPayroll && (
          <div data-expense-invoice>
            <InvoiceAttachField value={invoiceFile} onChange={setInvoiceFile} optional
              label={category === "purchases" ? "فاتورة الشراء (اختياري) — صوّرها أو أرفق ملفًّا" : "الفاتورة أو الإيصال (اختياري)"} />
          </div>
        )}
        {!valid && missing.length > 0 && <p style={{ color: "var(--text3)" }} className="text-[11px] mb-1.5 text-center" data-expense-missing>قبل الحفظ: {missing.join(" · ")}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ minHeight: 44, background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>
            إلغاء
          </button>
          <button
            disabled={!valid}
            onClick={() =>
              onSave({
                category, amount, recurring, fundingSource, note: note.trim(),
                name: name.trim(),
                employeeId: isPayroll ? employeeId : null,
                installments: category === "advance" ? Math.min(60, Math.max(1, Number(installments) || 1)) : undefined,
                ...(fixedId ? { fixedId } : {}),
                ...(!isPayroll && Number(vatAmount) > 0 && Number(vatAmount) < Number(amount) ? { vatAmount: Number(vatAmount) } : {}),
                invoiceFile: isPayroll ? null : invoiceFile,
              })
            }
            className="py-2 rounded-xl text-xs font-bold"
            style={{ minHeight: 44, background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
          >
            حفظ المصروف
          </button>
        </div>
      </div>
    </Card>
  );
}

export { AddExpenseForm };
