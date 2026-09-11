import React, { useState } from "react";
import { inputStyle, toLatinDigits } from "../domain/helpers.js";

function PinEditRow({ initialPin, onSave, onCancel }) {
  const [pin, setPin] = useState(initialPin);
  const valid = /^\d{4,6}$/.test(pin);
  return (
    <div className="mt-2">
      <input
        style={{ ...inputStyle, marginBottom: 8 }}
        value={pin}
        onChange={(e) => setPin(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
      />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={!valid}
          onClick={() => onSave(pin)}
          className="py-1.5 rounded-lg text-xs font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
        >
          حفظ
        </button>
      </div>
    </div>
  );
}

export { PinEditRow };
