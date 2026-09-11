import React, { useState } from "react";
import { Plus } from "lucide-react";
import { KARATS, fmtMoney, pricePerGram } from "../core/money.js";
import { FUNDING_SOURCES } from "../core/workflow.js";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { InvoiceAttachField } from "./InvoiceAttachField.jsx";

function AddTaskirForm({ suppliers, offices, priceData, onAddOffice, onCancel, onSave }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [karat, setKarat] = useState(21);
  const [weight, setWeight] = useState("");
  const [goldSource, setGoldSource] = useState("scrap"); // 'scrap' | 'purchased'
  const [pricePerGramInput, setPricePerGramInput] = useState(() => pricePerGram(21, priceData.current).toFixed(2));
  const [workmanshipAmount, setWorkmanshipAmount] = useState("");
  const [fundingSource, setFundingSource] = useState("daily_cash");
  const [officeId, setOfficeId] = useState(offices[0]?.id || "");
  const [showNewOffice, setShowNewOffice] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState("");
  const [newOfficePhone, setNewOfficePhone] = useState("");
  const [localOffices, setLocalOffices] = useState([]);
  const [notes, setNotes] = useState("");
  const [invoiceFile, setInvoiceFile] = useState(null);

  const allOffices = [...localOffices, ...offices];

  const handleCreateOffice = () => {
    if (!newOfficeName.trim()) return;
    const office = onAddOffice(newOfficeName, newOfficePhone);
    if (office) {
      setLocalOffices((prev) => [office, ...prev]);
      setOfficeId(office.id);
    }
    setShowNewOffice(false);
    setNewOfficeName("");
    setNewOfficePhone("");
  };

  const goldCost = goldSource === "purchased" ? (Number(weight) || 0) * (Number(pricePerGramInput) || 0) : 0;
  const totalCash = goldCost + (Number(workmanshipAmount) || 0);
  const valid = !!supplierId && Number(weight) > 0 && (goldSource !== "purchased" || !!officeId);

  return (
    <Card style={{ padding: 14, marginBottom: 16 }}>
      <Field label="المورد">
        <select style={inputStyle} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">اختر مورد...</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="العيار">
          <select style={inputStyle} value={karat} onChange={(e) => setKarat(Number(e.target.value))}>
            {KARATS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الوزن (جرام)">
          <input style={inputStyle} type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(sanitizeNumeric(e.target.value))} placeholder="0.00" />
        </Field>
      </div>
      <Field label="مصدر الذهب">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setGoldSource("scrap")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: goldSource === "scrap" ? "var(--accentBg)" : "var(--panel)", color: goldSource === "scrap" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            من الكسر (بدون تكلفة نقدية)
          </button>
          <button
            onClick={() => setGoldSource("purchased")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: goldSource === "purchased" ? "var(--accentBg)" : "var(--panel)", color: goldSource === "purchased" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            شراء جديد
          </button>
        </div>
      </Field>
      {goldSource === "purchased" && (
        <Field label="سعر الشراء لكل جرام">
          <input style={inputStyle} type="text" inputMode="decimal" value={pricePerGramInput} onChange={(e) => setPricePerGramInput(sanitizeNumeric(e.target.value))} />
        </Field>
      )}
      {goldSource === "purchased" && (
        <>
          <Field label="مكتب الذهب الخام (إجباري)">
            <select style={inputStyle} value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
              <option value="">اختر مكتب...</option>
              {allOffices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          {!showNewOffice ? (
            <button
              onClick={() => setShowNewOffice(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 w-fit mb-3"
              style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
            >
              <Plus size={13} /> مكتب جديد
            </button>
          ) : (
            <div className="mb-3">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input style={inputStyle} value={newOfficeName} onChange={(e) => setNewOfficeName(e.target.value)} placeholder="اسم المكتب" />
                <input style={inputStyle} value={newOfficePhone} onChange={(e) => setNewOfficePhone(e.target.value)} placeholder="جوال (اختياري)" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowNewOffice(false)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                  إلغاء
                </button>
                <button
                  onClick={handleCreateOffice}
                  disabled={!newOfficeName.trim()}
                  className="py-2 rounded-xl text-xs font-bold"
                  style={{ background: newOfficeName.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: newOfficeName.trim() ? "var(--panel)" : "var(--text3)" }}
                >
                  إضافة
                </button>
              </div>
            </div>
          )}
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
            تُدفع قيمة الذهب المشترى من المكتب نقدًا أو تحويلًا حسب المصدر أدناه.
          </p>
        </>
      )}
      <Field label="الأجور / المصنعية (نقدًا)">
        <input style={inputStyle} type="text" inputMode="decimal" value={workmanshipAmount} onChange={(e) => setWorkmanshipAmount(sanitizeNumeric(e.target.value))} placeholder="0.00" />
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

      <InvoiceAttachField value={invoiceFile} onChange={setInvoiceFile} label="مستند التسكير" optional />
      <Field label="ملاحظات (اختياري)">
        <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between py-2 mb-2" style={{ borderTop: "1px solid var(--edge)" }}>
        <span style={{ color: "var(--text2)" }} className="text-sm">
          إجمالي المدفوع نقدًا
        </span>
        <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold">
          {priceData.currency}
          {fmtMoney(totalCash)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={!valid}
          onClick={() =>
            onSave({
              supplierId,
              karat,
              weight: Number(weight),
              goldSource,
              pricePerGram: Number(pricePerGramInput) || 0,
              workmanshipAmount: Number(workmanshipAmount) || 0,
              fundingSource,
              officeId: goldSource === "purchased" ? officeId : null,
              invoiceFile,
              notes: notes.trim(),
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
// Partners accounts (حسابات الشركاء)
// ============================================================

export { AddTaskirForm };
