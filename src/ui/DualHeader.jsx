import React from "react";

function DualHeader({ currency }) {
  return (
    <div className="grid py-1"
      style={{ gridTemplateColumns: "1.3fr 1fr 1fr", gap: 8,
               borderBottom: "1px solid var(--accentLine)" }}>
      <span style={{ color: "var(--text3)" }} className="text-[10px]">البند</span>
      <span style={{ color: "var(--accent)" }} className="text-[10px] font-bold text-left" dir="ltr">
        جم24
      </span>
      <span style={{ color: "var(--accent)" }} className="text-[10px] font-bold text-left" dir="ltr">
        {currency}
      </span>
    </div>
  );
}

export { DualHeader };
