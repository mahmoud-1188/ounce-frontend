import React, { useCallback, useState } from "react";
import { Camera } from "lucide-react";
import { inputStyle, useWedgeScanner } from "../domain/helpers.js";
import { CameraScanner } from "./CameraScanner.jsx";

/**
 * حقل رمزٍ يقبل المسح والكتابة معًا — قارئ HID (يعمل تلقائيًا كلوحة
 * مفاتيح) أو الكاميرا أو الكتابة اليدوية، الثلاثة بدائل حسب قرارك.
 */
function ScanField({ value, onChange, onSubmit, placeholder = "امسح أو اكتب الرمز", autoScan = true }) {
  const [cam, setCam] = useState(false);
  const [lastSource, setLastSource] = useState("");
  const handle = useCallback((code, source) => {
    setLastSource(source);
    setCam(false);
    onChange(code);
    onSubmit?.(code, source);
  }, [onChange, onSubmit]);
  useWedgeScanner(handle, { enabled: autoScan && !cam });

  return (
    <div>
      <div className="flex gap-2">
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit?.(value.trim(), "manual"); }}
          placeholder={placeholder}
          inputMode="text"
        />
        <button onClick={() => setCam((v) => !v)} aria-label="مسح بالكاميرا"
          className="px-3 rounded-xl" style={{ background: "var(--field)", border: "1px solid var(--line)" }}>
          <Camera size={16} color="var(--accent)" />
        </button>
      </div>
      {cam && <div className="mt-2"><CameraScanner onScan={handle} onClose={() => setCam(false)} /></div>}
      <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px] leading-5">
        قارئ RFID أو الباركود يعمل مباشرةً — امسح والرمز يدخل وحده.
        {lastSource === "wedge" && " ✓ قُرئ بالقارئ"}
        {lastSource === "camera" && " ✓ قُرئ بالكاميرا"}
      </p>
    </div>
  );
}

export { ScanField };
