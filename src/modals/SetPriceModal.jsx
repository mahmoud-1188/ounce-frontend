import React, { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { fetchGoldPriceSAR, inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { Field } from "../ui/Field.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";

function SetPriceModal({ current, onClose, onSave }) {
  const [val, setVal] = useState(current.current || "");
  const [currency, setCurrency] = useState(current.currency || "ر.س");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [asOf, setAsOf] = useState("");
  const valid = Number(val) > 0;

  const handleFetchLive = async () => {
    setFetching(true);
    setFetchError("");
    try {
      const result = await fetchGoldPriceSAR();
      setVal(result.perGram.toFixed(2));
      setCurrency("ر.س");
      setAsOf(result.asOf);
    } catch (e) {
      console.error("Live price fetch failed", e);
      setFetchError("تعذر جلب السعر العالمي الآن، أدخل السعر يدويًا");
    } finally {
      setFetching(false);
    }
  };

  return (
    <ModalShell title="تعديل السعر يدويًا" onClose={onClose}>
      <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
        السعر مرتبط تلقائيًا بالسعر العالمي. استخدم هذا فقط إذا أردت تجاوزه بسعر مخصص أو تعديل العملة.
      </p>
      <button
        onClick={handleFetchLive}
        disabled={fetching}
        className="w-full py-2.5 rounded-xl font-bold mb-4 flex items-center justify-center gap-2 text-sm"
        style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
      >
        {fetching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        {fetching ? "جاري الجلب من السعر العالمي..." : "إعادة الجلب من السعر العالمي الآن"}
      </button>
      {fetchError && (
        <p style={{ color: "var(--bad)" }} className="text-xs mb-3">
          {fetchError}
        </p>
      )}
      {asOf && !fetchError && (
        <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
          آخر سعر عالمي بحسب المصدر: {asOf}
        </p>
      )}
      <Field label="سعر جرام عيار 24">
        <input style={inputStyle} type="text" inputMode="decimal" value={val} onChange={(e) => setVal(sanitizeNumeric(e.target.value))} placeholder="0.00" />
      </Field>
      <Field label="رمز العملة">
        <input style={inputStyle} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="ر.س / $" />
      </Field>
      <button
        disabled={!valid}
        onClick={() => onSave(Number(val), currency || "ر.س")}
        className="w-full py-3 rounded-xl font-bold mt-2"
        style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
      >
        حفظ السعر
      </button>
    </ModalShell>
  );
}

// ============================================================
// Reports
// ============================================================
// ============================================================
// التقارير — صفحة واحدة، فلتر واحد، وتبويبات.
//
// مبدأ التصميم: كل التقارير تشترك في نفس شريط التاريخ ونفس مفتاح
// (تفصيلي/إجمالي). تفريقها على صفحات منفصلة كان يعني إعادة ضبط الفلتر
// في كل مرة، وهو ما يجعل المقارنة بين تقريرين مرهقة.
// ============================================================
// ═══════════════════════════════════════════════════════════════════════
//  ذكاء التقارير
//
//  قاعدة صارمة: كل رقم يُحسب هنا بالكود. النموذج يستقبل الأرقام كحقائق
//  جاهزة ويُطلب منه الشرح والترتيب فقط. سؤاله أن يحسب يعني احتمال رقم
//  مختلق في تقرير مالي — وهو ما لا يُقبل مهما كان الشرح جميلًا.
// ═══════════════════════════════════════════════════════════════════════

/// فحوصات حتمية على أرقام الفترة. تُنتج ملاحظات بأدلة رقمية.

export { SetPriceModal };
