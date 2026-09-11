import React, { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { KARATS, PURITY, fmt, fmtMoney, fmtW } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { key } from "../domain/key.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { InvoiceAttachField } from "../ui/InvoiceAttachField.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";

function AddPurchaseModal({ suppliers, offices = [], onClose, onSave }) {
  const [supplierId, setSupplierId] = useState("");
  const [scrapWeight, setScrapWeight] = useState("");
  const [scrapKarat, setScrapKarat] = useState(21);
  // كل سطر عيار مستقل: الشراء الواحد قد يضم 21 و22 و24 معًا.
  const [lines, setLines] = useState([{ key: Math.random().toString(36).slice(2), karat: 21, weight: "", costPerGram: "", workmanshipTotal: "" }]);
  const [paymentMethod, setPaymentMethod] = useState("safe_cash");
  const [officeId, setOfficeId] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [skipInvoice, setSkipInvoice] = useState(false);
  const [payFeesNow, setPayFeesNow] = useState(false);

  const addLine = () =>
    setLines((p) => [...p, { key: Math.random().toString(36).slice(2), karat: 21, weight: "", costPerGram: "", workmanshipTotal: "" }]);
  const removeLine = (key) => setLines((p) => (p.length === 1 ? p : p.filter((l) => l.key !== key)));
  const updateLine = (key, field, val) => setLines((p) => p.map((l) => (l.key === key ? { ...l, [field]: val } : l)));

  const lineTotal = (l) => (Number(l.weight) || 0) * (Number(l.costPerGram) || 0) + (Number(l.workmanshipTotal) || 0);
  const grandTotal = lines.reduce((a, l) => a + lineTotal(l), 0);
  const totalWeight = lines.reduce((a, l) => a + (Number(l.weight) || 0), 0);
  const totalFine = lines.reduce((a, l) => a + (Number(l.weight) || 0) * (PURITY[l.karat] || 1), 0);
  const totalWorkmanship = lines.reduce((a, l) => a + (Number(l.workmanshipTotal) || 0), 0);

  const hasSupplier = !!supplierId;
  // كل حقل إلزامي: العيار والوزن وسعر الجرام والأجور. سطر ناقص يعني تكلفة
  // قطعة غير قابلة للحساب لاحقًا.
  const linesValid = lines.every(
    (l) => Number(l.karat) > 0 && Number(l.weight) > 0 && Number(l.costPerGram) > 0 && String(l.workmanshipTotal).trim() !== ""
  );
  const officeOk = paymentMethod !== "office" || !!officeId;
  // الفاتورة لم تعد شرطًا للحفظ: قد لا تكون بيد المستخدم لحظة الشراء.
  // لكن الحفظ بدونها يتطلب إقرارًا صريحًا، وتُوسَم العملية «بانتظار فاتورة»
  // حتى لا يضيع الأثر المستندي بصمت.
  // السداد بالكسر بلا وزن يترك المورد دائنًا رغم تسجيل السداد.
  const scrapOk = paymentMethod !== "scrap" || Number(scrapWeight) > 0;
  const valid = hasSupplier && linesValid && officeOk && scrapOk && (!!invoiceFile || skipInvoice);

  return (
    <ModalShell title="تسجيل شراء من مورد" onClose={onClose}>
      <Field label="المورد (إجباري)">
        <select style={inputStyle} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">اختر موردًا...</option>
          {suppliers.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name}
            </option>
          ))}
        </select>
      </Field>
      {suppliers.length === 0 && (
        <p style={{ color: "var(--bad)" }} className="text-[11px] mb-3">
          لا يوجد موردون مسجّلون. أضف المورد من صفحة الموردين أولًا، ثم سجّل الشراء.
        </p>
      )}

      <div className="flex items-center justify-between mb-2">
        <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
          العيارات المشتراة ({lines.length})
        </span>
        <button
          onClick={addLine}
          className="text-[11px] px-3 py-1.5 rounded-full flex items-center gap-1"
          style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
        >
          <Plus size={12} /> إضافة عيار
        </button>
      </div>

      <div className="flex flex-col gap-2 mb-3">
        {lines.map((l, idx) => (
          <Card key={l.key} style={{ padding: 12, background: "var(--bg)" }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: "var(--text2)" }} className="text-[11px]">
                عيار {idx + 1}
              </span>
              {lines.length > 1 && (
                <button onClick={() => removeLine(l.key)} style={{ color: "var(--bad)" }}>
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="العيار *">
                <select style={inputStyle} value={l.karat} onChange={(e) => updateLine(l.key, "karat", Number(e.target.value))}>
                  {KARATS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="الوزن (جم) *">
                <NumericInput value={l.weight} onChange={(v) => updateLine(l.key, "weight", v)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="سعر شراء الجرام *">
                <NumericInput value={l.costPerGram} onChange={(v) => updateLine(l.key, "costPerGram", v)} />
              </Field>
              <Field label="إجمالي الأجور *">
                <NumericInput value={l.workmanshipTotal} onChange={(v) => updateLine(l.key, "workmanshipTotal", v)} />
              </Field>
            </div>
            {lineTotal(l) > 0 && (
              <p style={{ color: "var(--text3)" }} className="text-[11px]">
                إجمالي هذا العيار: {fmtMoney(lineTotal(l))} · يعادل {fmtW((Number(l.weight) || 0) * (PURITY[l.karat] || 1))} جم عيار 24
              </p>
            )}
          </Card>
        ))}
      </div>

      <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
        توزيع الأجور على القطع يتم لاحقًا عند التكويد، لأن عدد القطع وأوزانها
        لا تكون معروفة وقت الشراء.
      </p>

      <Field label="طريقة السداد">
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "safe_cash", label: "الخزنة نقدي", hint: "يُخصم من نقدي الخزنة" },
            { id: "safe_network", label: "الخزنة شبكة", hint: "يُخصم من شبكة الخزنة" },
            { id: "scrap", label: "سداد بالكسر", hint: "ذهب لا نقد" },
            { id: "office", label: "تسكير من مكتب", hint: "التزام على المكتب" },
            { id: "deferred", label: "آجل على المورد", hint: "لا شيء يخرج الآن" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setPaymentMethod(m.id)}
              className="py-2 rounded-xl text-[11px] font-bold text-right px-2.5"
              style={{ background: paymentMethod === m.id ? "var(--accentBg)" : "var(--panel)", color: paymentMethod === m.id ? "var(--accent)" : "var(--text2)", border: `1px solid ${paymentMethod === m.id ? "var(--accentLine)" : "var(--edge)"}` }}
            >
              {m.label}
              <span style={{ color: "var(--text3)" }} className="block text-[10px]">{m.hint}</span>
            </button>
          ))}
        </div>
      </Field>

      {paymentMethod === "scrap" && (
        <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
            الكسر المدفوع للمورد
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="الوزن (جرام)">
              <NumericInput value={scrapWeight} onChange={setScrapWeight} placeholder="0.00" />
            </Field>
            <Field label="العيار">
              <select style={inputStyle} value={scrapKarat} onChange={(e) => setScrapKarat(Number(e.target.value))}>
                {KARATS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </Field>
          </div>
          {Number(scrapWeight) > 0 && (
            <p style={{ color: "var(--text2)" }} className="text-[11px]">
              يعادل {fmt(Number(scrapWeight) * (PURITY[scrapKarat] || 1))} جم بعيار 24 · يخرج من مخزون الكسر
            </p>
          )}
          <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
            الكسر يسدّد الذهب فقط. الأجور تُدفع نقدًا من الخزنة.
          </p>
        </Card>
      )}

      {paymentMethod === "deferred" ? (
        <>
          <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--badLine)" }}>
            <p style={{ color: "var(--bad)" }} className="text-xs font-bold mb-2">
              سيُسجَّل على حساب المورد
            </p>
            <div className="flex items-center justify-between py-1">
              <span style={{ color: "var(--text2)" }} className="text-[11px]">ذهب مستحق</span>
              <span style={{ color: "var(--text)" }} className="text-xs font-bold">{fmtW(totalFine)} جم عيار 24</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span style={{ color: "var(--text2)" }} className="text-[11px]">أجور مستحقة</span>
              <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                {payFeesNow ? "تُسدَّد الآن" : `${fmtMoney(totalWorkmanship)}`}
              </span>
            </div>
          </Card>
          <button
            onClick={() => setPayFeesNow((v) => !v)}
            className="w-full py-2 rounded-xl text-[11px] font-bold mb-3 flex items-center justify-center gap-2"
            style={{
              background: payFeesNow ? "var(--accentBg)" : "var(--panel)",
              color: payFeesNow ? "var(--accent)" : "var(--text2)",
              border: `1px solid ${payFeesNow ? "var(--accentLine)" : "var(--edge)"}`,
            }}
          >
            {payFeesNow ? <Check size={13} /> : null}
            سداد الأجور نقدًا الآن من الخزنة
          </button>
        </>
      ) : paymentMethod === "office" ? (
        <>
          <Field label="المكتب">
            <select style={inputStyle} value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
              <option value="">اختر مكتبًا...</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <p style={{ color: "var(--accentText)" }} className="text-[11px] mb-3">
            لن يخرج نقد الآن. يُسجَّل التزام على المكتب بـ {fmtW(totalFine)} جم عيار 24 وقيمته {fmtMoney(grandTotal)}.
          </p>
          {offices.length === 0 && (
            <p style={{ color: "var(--bad)" }} className="text-[11px] mb-3">
              لا توجد مكاتب مسجّلة — أضف مكتبًا من صفحة التسكيرات أولًا.
            </p>
          )}
        </>
      ) : (
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
          سيُخصم المبلغ من {paymentMethod === "safe_network" ? "شبكة الخزنة" : "نقدي الخزنة"}.
        </p>
      )}

      <InvoiceAttachField value={invoiceFile} onChange={setInvoiceFile} label="فاتورة الشراء" optional />
      {!invoiceFile && (
        <button
          onClick={() => setSkipInvoice((v) => !v)}
          className="w-full py-2 rounded-xl text-[11px] font-bold mb-3 flex items-center justify-center gap-2"
          style={{
            background: skipInvoice ? "var(--accentBg)" : "var(--panel)",
            color: skipInvoice ? "var(--accent)" : "var(--text2)",
            border: `1px solid ${skipInvoice ? "var(--accentLine)" : "var(--edge)"}`,
          }}
        >
          {skipInvoice ? <Check size={13} /> : null}
          الحفظ بدون فاتورة الآن (تُرفق لاحقًا)
        </button>
      )}

      <Field label="ملاحظات (اختياري)">
        <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <Card style={{ padding: 12, marginBottom: 12 }}>
        <div className="flex items-center justify-between py-1">
          <span style={{ color: "var(--text2)" }} className="text-xs">الوزن الإجمالي</span>
          <span style={{ color: "var(--text)" }} className="text-xs font-bold">
            {fmtW(totalWeight)} جم · {fmtW(totalFine)} جم عيار 24
          </span>
        </div>
        <div className="flex items-center justify-between py-1" style={{ borderTop: "1px solid var(--line)" }}>
          <span style={{ color: "var(--text)" }} className="text-sm font-bold">الإجمالي المستحق</span>
          <span style={{ color: "var(--accent)" }} className="text-base font-bold">{fmtMoney(grandTotal)}</span>
        </div>
      </Card>

      <button
        disabled={!valid}
        onClick={() =>
          onSave({
            supplierId,
            lines: lines.map((l) => ({
              karat: l.karat,
              weight: Number(l.weight),
              costPerGram: Number(l.costPerGram),
              workmanshipTotal: Number(l.workmanshipTotal) || 0,
            })),
            paymentMethod,
            officeId,
            scrapWeight: paymentMethod === "scrap" ? Number(scrapWeight) || 0 : 0,
            scrapKarat: paymentMethod === "scrap" ? scrapKarat : null,
            payFeesNow,
            invoiceFile,
            invoicePending: !invoiceFile,
            notes: notes.trim(),
          })
        }
        className="w-full py-3 rounded-xl font-bold mt-1"
        style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
      >
        حفظ الشراء
      </button>
    </ModalShell>
  );
}




// ============================================================
// Print labels (الطباعة)
// ============================================================

export { AddPurchaseModal };
