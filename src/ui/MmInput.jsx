import React, { useEffect, useState } from "react";
import { inputStyle } from "../domain/helpers.js";

function MmInput({ value, onCommit, min = 0, max = 300, width = 52, label }) {
  const [txt, setTxt] = useState(String(value ?? ""));
  const [live, setLive] = useState(false);
  // ⚠ لا نكتب فوق ما يكتبه المستخدم: التزامن يقع حين لا يكون الحقل نشطًا
  useEffect(() => { if (!live) setTxt(String(value ?? "")); }, [value, live]);

  const commit = () => {
    setLive(false);
    const n = Number(String(txt).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n)) { setTxt(String(value ?? "")); return; }
    // ⚠ يُقصّ داخل المدى بدل الرفض: من كتب 500 يريد الأكبر، فيأخذ الحدّ
    const v = Math.min(max, Math.max(min, Math.round(n * 2) / 2));
    setTxt(String(v));
    if (v !== value) onCommit(v);
  };

  return (
    <div className="flex items-center gap-1">
      {label && <span style={{ color: "var(--text3)" }} className="text-[9px]">{label}</span>}
      <input
        type="text" inputMode="decimal" value={txt}
        onFocus={() => setLive(true)}
        onChange={(e) => setTxt(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.target.blur(); } }}
        style={{ ...inputStyle, width, padding: "5px 6px", fontSize: 11, textAlign: "center",
          marginBottom: 0, fontVariantNumeric: "tabular-nums" }}
      />
    </div>
  );
}

export { MmInput };
