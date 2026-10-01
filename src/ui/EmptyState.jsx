import React from "react";

/// الحالة الفارغة تقول الخطوة التالية — وزرّها إن مُرّر action { label, onClick }
function EmptyState({ icon, title, sub, action = null }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="mb-4 opacity-70">{icon}</div>
      <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-base mb-1">
        {title}
      </p>
      <p style={{ color: "var(--text2)" }} className="text-sm">
        {sub}
      </p>
      {action && (
        <button type="button" onClick={action.onClick} className="mt-4 px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export { EmptyState };
