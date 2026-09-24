import React from "react";
import { ChevronRight } from "lucide-react";

function SubPageHeader({ title, onBack, right = null }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-6 pb-1">
      {onBack && (
        <button onClick={onBack} style={{ color: "var(--accentText)" }}>
          <ChevronRight size={22} />
        </button>
      )}
      <h1 style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)" }} className="text-xl font-extrabold flex-1">
        {title}
      </h1>
      {right}
    </div>
  );
}

export { SubPageHeader };
