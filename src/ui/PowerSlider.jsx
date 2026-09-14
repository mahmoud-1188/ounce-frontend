import React from "react";
import { NHR_POWER_MAX_DBM } from "../core/constants.js";

function PowerSlider({ value, onChange }) {
  const v = Math.min(Number(value) || 0, NHR_POWER_MAX_DBM);
  // ⚠ التسمية بالمعنى لا بالرقم: «12 dBm» لا تعني شيئًا لصاحب المحل،
  // و«قريب — نصف متر» تعني كل شيء.
  const label = v <= 12 ? "قريب جدًا — حتى نصف متر"
    : v <= 18 ? "قريب — متر تقريبًا"
      : v <= 23 ? "متوسّط — رفّ كامل"
        : "بعيد — الغرفة كلّها";
  return (
    <>
      <div className="flex items-baseline justify-between mt-1">
        <span style={{ color: "var(--accent)" }} className="text-[13px] font-bold">{v} dBm</span>
        <span style={{ color: "var(--text3)" }} className="text-[10px]">{label}</span>
      </div>
      <input type="range" min={5} max={NHR_POWER_MAX_DBM} step={1} value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent)" }} />
      <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px]">
        الحدّ النظامي {NHR_POWER_MAX_DBM} dBm — لا يتجاوزه التطبيق
      </p>
    </>
  );
}

export { PowerSlider };
