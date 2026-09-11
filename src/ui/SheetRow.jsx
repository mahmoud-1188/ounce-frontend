import React from "react";

function SheetRow({ label, value, tone = "text" }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-baseline justify-between py-1.5"
      style={{ borderBottom: "1px solid var(--line)" }}>
      <span style={{ color: "var(--text3)" }} className="text-[11px]">{label}</span>
      <span style={{ color: `var(--${tone})` }} className="text-[12px] font-bold">{value}</span>
    </div>
  );
}

/// زرّ إجراء — شكلٌ واحد لكل الأفعال.

export { SheetRow };
