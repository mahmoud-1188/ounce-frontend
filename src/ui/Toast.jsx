import React from "react";

function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 px-4 py-2 rounded-full text-sm shadow-lg"
      style={{ background: "var(--accentBg)", border: "1px solid var(--accentSoft)", color: "var(--text)", fontFamily: "'Cairo','Tajawal',system-ui,sans-serif" }}
    >
      {message}
    </div>
  );
}

export { Toast };
