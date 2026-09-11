import React from "react";
import { ChevronRight } from "lucide-react";

function SubPageHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-6 pb-1">
      {onBack && (
        <button onClick={onBack} style={{ color: "var(--accentText)" }}>
          <ChevronRight size={22} />
        </button>
      )}
      <h1 style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)" }} className="text-xl font-extrabold">
        {title}
      </h1>
    </div>
  );
}

export { SubPageHeader };
