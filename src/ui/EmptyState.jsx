import React from "react";

function EmptyState({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="mb-4 opacity-70">{icon}</div>
      <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-base mb-1">
        {title}
      </p>
      <p style={{ color: "var(--text2)" }} className="text-sm">
        {sub}
      </p>
    </div>
  );
}

export { EmptyState };
