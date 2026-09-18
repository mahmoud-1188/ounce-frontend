import React, { useMemo, useState } from "react";
import { RECOVERY_WINDOW_MIN } from "../core/constants.js";
import { inputStyle, vendorChallenge } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";

function PinRecoverySheet({ facts = [], branchCode, hasCode, onUnlock, onClose }) {
  const [way, setWay] = useState(facts.length ? "facts" : "code");
  const [code, setCode] = useState("");
  const [answers, setAnswers] = useState({});
  const [vendorAns, setVendorAns] = useState("");
  const [err, setErr] = useState("");
  // ⚠ التحدّي يُثبَّت عند الفتح لا يُعاد حسابه مع كل رسم: لو تغيّر أثناء
  // المكالمة قرأ الموظف رقمًا وأدخل جواب غيره.
  const challenge = useMemo(() => vendorChallenge(branchCode), [branchCode]);

  const tryUnlock = (kind, payload) => {
    const r = onUnlock(kind, payload);
    if (r === true) return;
    setErr(typeof r === "string" ? r : "لم يُقبل — تأكّد ثم أعد المحاولة");
  };

  const WAYS = [
    facts.length ? ["facts", "أسئلة المحل"] : null,
    hasCode ? ["code", "رمز الاسترجاع"] : null,
    ["vendor", "اتصل بالدعم"],
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,.72)" }}>
      <div style={{ background: "var(--panel)", borderRadius: "18px 18px 0 0", maxHeight: "88vh", overflow: "auto" }}
        className="px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: "var(--accent)" }} className="text-[13px] font-bold">نسيت الرقم السري</span>
          <button onClick={onClose} style={{ color: "var(--text3)" }} className="text-[11px]">إغلاق</button>
        </div>
        <p style={{ color: "var(--text3)", margin: "0 0 10px" }} className="text-[10px] leading-6">
          اختر ما تستطيعه. بعد الفتح ضَع رقمًا جديدًا فورًا من صلاحيات الوصول.
        </p>

        <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${WAYS.length}, 1fr)` }}>
          {WAYS.map(([id, lbl]) => (
            <button key={id} onClick={() => { setWay(id); setErr(""); }} className="py-2 rounded-xl text-[11px] font-bold"
              style={{ background: way === id ? "var(--accentBg)" : "var(--field)",
                       color: way === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
              {lbl}
            </button>
          ))}
        </div>

        {way === "facts" && (
          <>
            {facts.map((f) => (
              <Field key={f.id} label={f.q}>
                <input style={inputStyle} value={answers[f.id] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))} />
              </Field>
            ))}
            <button onClick={() => tryUnlock("facts", answers)} className="w-full py-2.5 rounded-xl text-[12px] font-bold"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
              افتح
            </button>
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2 leading-6">
              ⚠ يعرفها صاحب المحل ولا يعرفها من وجد الجهاز.
            </p>
          </>
        )}

        {way === "code" && (
          <>
            <Field label="رمز الاسترجاع — أربع مجموعات">
              <input style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: 2 }} value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX-XXXX" />
            </Field>
            <button onClick={() => tryUnlock("code", code)} className="w-full py-2.5 rounded-xl text-[12px] font-bold"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
              افتح
            </button>
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2 leading-6">
              الرمز الذي طُبع عند التفعيل. يُستعمل مرةً ثم يُولَّد غيره.
            </p>
          </>
        )}

        {way === "vendor" && (
          <>
            <Card style={{ padding: 12, marginBottom: 10, background: "var(--field)" }}>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">اقرأ هذا الرمز للدعم</p>
              <p style={{ color: "var(--accent)", margin: "2px 0 0", fontFamily: "monospace", letterSpacing: 3 }}
                className="text-[22px] font-bold">{challenge}</p>
              <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px] leading-6">
                ⚠ يتغيّر كل {RECOVERY_WINDOW_MIN} دقائق ولا يصلح لجهازٍ آخر.
              </p>
            </Card>
            <Field label="الجواب من الدعم — ستّة محارف">
              <input style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: 3 }} value={vendorAns}
                onChange={(e) => setVendorAns(e.target.value.toUpperCase())} placeholder="XXXXXX" maxLength={8} />
            </Field>
            <button onClick={() => tryUnlock("vendor", vendorAns)} className="w-full py-2.5 rounded-xl text-[12px] font-bold"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
              افتح
            </button>
          </>
        )}

        {err && <p style={{ color: "var(--bad)" }} className="text-[11px] mt-2">⚠ {err}</p>}

        <p className="text-[10px] mt-4 leading-6"
          style={{ color: "var(--text3)", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
          ⚠ وإن كان لديك نسخة احتياطية، استعادتها تُعيد الأرقام السرية معها —
          فهي محفوظة ضمن النسخة.
        </p>
      </div>
    </div>
  );
}

export { PinRecoverySheet };
