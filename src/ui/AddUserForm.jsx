import React, { useState } from "react";
import { inputStyle, toLatinDigits } from "../domain/helpers.js";
import { Card } from "./Card.jsx";

function AddUserForm({ onCancel, onSave }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const valid = name.trim() && /^\d{4,6}$/.test(pin);
  return (
    <Card style={{ padding: 10, marginBottom: 8, background: "var(--bg)" }}>
      <input style={{ ...inputStyle, marginBottom: 8 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" />
      <input
        style={{ ...inputStyle, marginBottom: 8 }}
        value={pin}
        onChange={(e) => setPin(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
        placeholder="رقم سري (4-6 أرقام)"
        inputMode="numeric"
      />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          إلغاء
        </button>
        <button
          disabled={!valid}
          onClick={() => onSave(name, pin)}
          className="py-1.5 rounded-lg text-xs font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
        >
          إضافة
        </button>
      </div>
    </Card>
  );
}

export { AddUserForm };
