import React, { useState } from "react";
import { KARATS, fmtMoney, fmtW, pricePerGram, roundW } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Field } from "../ui/Field.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";

// ⚠ حُوِّلت للباك إند: POST /scrap يتطلّب عيارًا رقميًا معروفًا وقت
// الشراء دائمًا (ترحيل دفتر الوزن يحتاج فاين-جرام لكل عيار) — لا يقبل
// "غير محدد" إطلاقًا (400 karat_required)، بخلاف هذا النموذج القديم الذي
// كان يسمح باختياره بلا أي تحقق فعلي هنا أصلًا. أُزيل الخيار بدل ترك
// المستخدم يصطدم برفض مؤكَّد من الخادم.
function AddScrapModal({ priceData, onClose, onSave }) {
  const [description, setDescription] = useState("");
  const [karat, setKarat] = useState(21);
  const [weight, setWeight] = useState("");
  const [pricePerGramInput, setPricePerGramInput] = useState(() => (pricePerGram(21, priceData.current) * 0.9).toFixed(2));
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [grossW, setGrossW] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // الفصوص فرقٌ مشتقّ: القائم ناقص المعتمد
  const derivedStones = Math.max(0,
    roundW((Number(grossW) || 0) - (Number(weight) || 0)));
  const stonesMarginEstimate = derivedStones;

  const handleKaratChange = (val) => {
    setKarat(val);
    setPricePerGramInput((pricePerGram(val, priceData.current) * 0.9).toFixed(2));
  };

  const total = (Number(weight) || 0) * (Number(pricePerGramInput) || 0);
  const valid = Number(weight) > 0 && Number(pricePerGramInput) >= 0;

  return (
    <ModalShell title="تسجيل كسر جديد" onClose={onClose}>
      <Field label="وصف القطعة (اختياري)">
        <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="مثال: دبل قديم" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="العيار التقديري">
          <select style={inputStyle} value={karat} onChange={(e) => handleKaratChange(Number(e.target.value))}>
            {KARATS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
        {/* ⚠ نفس ترتيب الاستلام: القائم ثم المعتمد، والفصوص فرقٌ مشتقّ */}
        <Field label="الوزن القائم (جرام)">
          <input style={inputStyle} type="text" inputMode="decimal" value={grossW}
            onChange={(e) => setGrossW(sanitizeNumeric(e.target.value))} placeholder="0.000" />
        </Field>
      </div>
      <Field label="الوزن المعتمد (جرام)">
        <input style={inputStyle} type="text" inputMode="decimal" value={weight}
          onChange={(e) => setWeight(sanitizeNumeric(e.target.value))}
          placeholder={Number(grossW) > 0 ? fmtW(Number(grossW)) : "0.000"} />
      </Field>
      <Field label="سعر الشراء لكل جرام">
        <input style={inputStyle} type="text" inputMode="decimal" value={pricePerGramInput} onChange={(e) => setPricePerGramInput(sanitizeNumeric(e.target.value))} />
      </Field>
      {derivedStones > 0.0005 && (
        <p style={{ color: "var(--bad)" }} className="text-[11px] mb-3">
          الفصوص {fmtW(derivedStones)} جم — فرقٌ مشتقّ لا يُدفع ثمنه ذهبًا،
          وتُنزع قبل إقفال اليوم.
        </p>
      )}
      <Field label="الدفع من عهدة الكسر">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setPaymentMethod("cash")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: paymentMethod === "cash" ? "var(--accentBg)" : "var(--panel)", color: paymentMethod === "cash" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            نقدي
          </button>
          <button
            onClick={() => setPaymentMethod("network")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: paymentMethod === "network" ? "var(--accentBg)" : "var(--panel)", color: paymentMethod === "network" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            شبكة
          </button>
        </div>
      </Field>
      <Field label="اسم العميل (اختياري)">
        <input style={inputStyle} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between py-2 mb-2" style={{ borderTop: "1px solid var(--edge)" }}>
        <span style={{ color: "var(--text2)" }} className="text-sm">
          إجمالي المبلغ المدفوع
        </span>
        <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold">
          {priceData.currency}
          {fmtMoney(total)}
        </span>
      </div>
      <button
        disabled={!valid || submitting}
        onClick={async () => {
          setSubmitting(true);
          try {
            // ⚠ grossWeight (لا stonesMarginEstimate) هو ما يقرأه الباك إند
            // فعليًا — يشتق الفصوص التقديرية بنفسه من الفرق (gross-weight).
            // إرسال stonesMarginEstimate وحده بلا grossWeight كان سيجعل
            // الخادم يحسب فصوصًا صفرية دائمًا (لا حقل مقابل لها في جدول
            // scrap_items أصلًا).
            const ok = await onSave({
              description: description.trim(),
              karat,
              weight: Number(weight),
              grossWeight: Number(grossW) || Number(weight),
              pricePerGram: Number(pricePerGramInput),
              customerName: customerName.trim() || null,
              paymentMethod,
            });
            if (ok) onClose();
          } finally {
            setSubmitting(false);
          }
        }}
        className="w-full py-3 rounded-xl font-bold"
        style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
      >
        {submitting ? "جارٍ الحفظ..." : "حفظ وتسجيل الدفع"}
      </button>
    </ModalShell>
  );
}

// ============================================================
// Taskirat — supplier gold-for-gold settlements (تسكيرات)
// ============================================================

export { AddScrapModal };
