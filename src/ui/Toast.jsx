import React from "react";

/// إشعارٌ قصير، ومعه «الخطوة التالية» زرّان على الأكثر — الضغط يُغلق ثم يفعل
function Toast({ message, actions = [], onClose }) {
  if (!message) return null;
  const acts = (actions || []).slice(0, 2);
  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 bottom-24 z-50 px-4 py-2 ${acts.length ? "rounded-2xl" : "rounded-full"} text-sm shadow-lg`}
      style={{ background: "var(--accentBg)", border: "1px solid var(--accentSoft)", color: "var(--text)", fontFamily: "'Cairo','Tajawal',system-ui,sans-serif", maxWidth: "92vw" }}
      data-toast
    >
      <span>{message}</span>
      {acts.length > 0 && (
        <span className="flex gap-2 mt-1.5" data-next-step>
          {acts.map((a) => (
            <button key={a.label} type="button" data-next-action={a.label}
              onClick={() => { onClose?.(); a.go?.(); }}
              className="px-3 py-1 rounded-full text-[12px] font-bold"
              style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
              {a.label}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}

export { Toast };
