import React, { useState } from "react";
import { WEAK_PINS } from "../core/constants.js";
import { deviceLabel, inputStyle, toLatinDigits } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { ScanField } from "../ui/ScanField.jsx";

/// شاشة الموظّف: يمسح رمز الربط ويضع رقمه السري على جهازه.
///
/// ⚠ الرمز يُتحقَّق منه على الخادم عند الحفظ (POST /enroll/claim): صلاحيته
///   ومرّته الواحدة وأن الرقم لا يتكرّر في الفرع. هنا شكلُه فقط.
const CODE_RE = /^OQE1[A-Z0-9]{10}$/;

function EnrollClaimSheet({ branchName = "", onClaim, onClose }) {
  const [step, setStep] = useState("scan");     // scan | pin
  const [raw, setRaw] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const read = (text) => {
    const c = String(text || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!CODE_RE.test(c)) { setErr("ليس رمز ربط أوقية — الرمز يبدأ بـOQE1 وطوله 14"); return; }
    setCode(c); setErr(""); setStep("pin");
  };
  const valid = /^\d{4,6}$/.test(pin) && pin === pin2;
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const r = await onClaim(code, pin);
      if (r?.error) { setErr(r.error); if (r.back) setStep("scan"); return; }
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,.78)" }}>
      <div style={{ background: "var(--panel)", borderRadius: "18px 18px 0 0", maxHeight: "92vh", overflow: "auto" }}
        className="px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: "var(--accent)" }} className="text-[13px] font-bold">ربط هذا الجهاز</span>
          <button onClick={onClose} style={{ color: "var(--text3)" }} className="text-[11px]">إغلاق</button>
        </div>

        {step === "scan" && (
          <>
            <p style={{ color: "var(--text3)", margin: "0 0 10px" }} className="text-[11px] leading-6">
              امسح رمز الربط الذي أعطاك إياه مدير الفرع، أو الصقه.
            </p>
            <ScanField value={raw} onChange={(v) => { setRaw(v); setErr(""); }}
              onSubmit={(c) => read(c)} placeholder="OQE1..." autoScan />
            <button onClick={() => read(raw)} disabled={!raw.trim()}
              className="w-full mt-2 py-2.5 rounded-xl text-[12px] font-bold"
              style={{ background: raw.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)",
                       color: raw.trim() ? "var(--panel)" : "var(--text3)" }}>
              اقرأ الرمز
            </button>
          </>
        )}

        {step === "pin" && (
          <>
            <Card style={{ padding: 11, margin: "6px 0 10px", background: "var(--field)", border: "1px solid var(--goodLine)" }}>
              <p style={{ color: "var(--good)", margin: 0, fontFamily: "monospace", direction: "ltr", textAlign: "right" }} className="text-[11px] font-bold">✓ {code}</p>
              <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[11px]">
                {branchName ? `الفرع ${branchName} · ` : ""}{deviceLabel()}
              </p>
            </Card>
            <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[11px] leading-6">
              ضَع رقمك السري. لا يعرفه المدير، وتدخل به باسمك من هذا الجهاز.
            </p>
            <Field label="الرقم السري (4 إلى 6 أرقام)">
              <input style={{ ...inputStyle, letterSpacing: 6, textAlign: "center" }} type="password"
                inputMode="numeric" maxLength={6} value={pin}
                onChange={(e) => setPin(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 6))} />
            </Field>
            <Field label="أعده للتأكيد">
              <input style={{ ...inputStyle, letterSpacing: 6, textAlign: "center" }} type="password"
                inputMode="numeric" maxLength={6} value={pin2}
                onChange={(e) => setPin2(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 6))} />
            </Field>
            {pin2 && pin !== pin2 && (
              <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">الرقمان غير متطابقين</p>
            )}
            {WEAK_PINS.includes(pin) && (
              <p style={{ color: "var(--accentText)" }} className="text-[11px] mb-2">
                ⚠ رقمٌ سهل التخمين — يُقبل، والأفضل غيره
              </p>
            )}
            <button disabled={!valid || busy} onClick={submit}
              className="w-full py-2.5 rounded-xl text-[12px] font-bold"
              style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)",
                       color: valid ? "var(--panel)" : "var(--text3)" }}>
              {busy ? "جارٍ الربط…" : "اربط الجهاز"}
            </button>
          </>
        )}
        {err && <p style={{ color: "var(--bad)" }} className="text-[11px] mt-2">⚠ {err}</p>}
        <p style={{ color: "var(--text3)", margin: "10px 0 0" }} className="text-[11px] leading-6">
          ⚠ جوالٌ جديد يحتاج رمزًا جديدًا من المدير — بالاسم نفسه، فلا
          تتغيّر حساباتك ولا حركاتك.
        </p>
      </div>
    </div>
  );
}

export { EnrollClaimSheet };
