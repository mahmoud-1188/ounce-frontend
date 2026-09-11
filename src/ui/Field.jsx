import React from "react";

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label style={{ color: "var(--text2)" }} className="text-xs mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}

export { Field };
