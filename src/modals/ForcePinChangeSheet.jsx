import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { inputStyle } from "../domain/helpers.js";
import { Field } from "../ui/Field.jsx";

const ERRORS = {
  weak_pin: "رقمٌ سهل التخمين — اختر غيره",
  pin_taken: "اختر رقمًا آخر",
  pin_unchanged: "اختر رقمًا غير رقمك الحالي",
  invalid_current_pin: "الرقم الحالي غير صحيح",
  invalid_pin_format: "الرقم من 4 إلى 6 أرقام",
};

/// تغيير رقمٍ ضعيف (9999 · 1234 · 0000 …) — لا يُغلق إلا بالحفظ أو الخروج (المرجع 5.2.0).
function ForcePinChangeSheet({ userName = "", onSave, onLogout }) {
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const digits = (v) => v.replace(/\D/g, "").slice(0, 6);
  const ready = current.length >= 4 && pin.length >= 4 && !busy;
  const save = async () => {
    if (pin !== pin2) { setMsg("الرقمان غير متطابقين"); return; }
    setBusy(true);
    setMsg("");
    try {
      await onSave(current, pin);
    } catch (e) {
      setMsg(ERRORS[e?.body?.error] || "تعذّر الحفظ — حاول مجددًا");
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,.82)" }} role="dialog" aria-modal="true">
      <div style={{ background: "var(--panel)", borderRadius: "18px 18px 0 0", padding: 18 }}>
        <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-sm font-bold">غيّر رقمك السري أوّلًا</p>
        <p style={{ color: "var(--text2)", margin: "0 0 12px" }} className="text-[12px] leading-6">
          {userName}، رقمك الحالي من الأرقام السهلة المعروفة (مثل 9999 أو 1234). اختر رقمًا جديدًا من 4 إلى 6 أرقام.
        </p>
        <Field label="الرقم الحالي">
          <input style={inputStyle} type="password" inputMode="numeric" autoComplete="current-password" value={current} onChange={(e) => setCurrent(digits(e.target.value))} />
        </Field>
        <Field label="الرقم الجديد">
          <input style={inputStyle} type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(digits(e.target.value))} />
        </Field>
        <Field label="أعد كتابته">
          <input style={inputStyle} type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(digits(e.target.value))}
            onKeyDown={(e) => { if (e.key === "Enter" && ready) { e.preventDefault(); save(); } }} />
        </Field>
        {msg && <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">{msg}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onLogout} className="py-3 rounded-xl text-[12px] font-bold" style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>خروج</button>
          <button onClick={save} disabled={!ready} className="py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1"
            style={{ background: "linear-gradient(135deg, var(--gradFrom), var(--gradTo))", color: "var(--bg)", opacity: ready ? 1 : 0.5 }}>
            {busy && <Loader2 size={12} className="animate-spin" />} حفظ
          </button>
        </div>
      </div>
    </div>
  );
}

export { ForcePinChangeSheet };
