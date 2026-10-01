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
      {/* «؟»: مسرد المصطلحات من أي صفحة — التطبيق يستمع للحدث ويفتحه */}
      <button type="button" aria-label="ما معنى هذا؟ مسرد المصطلحات" title="مسرد المصطلحات"
        onClick={() => { try { window.dispatchEvent(new CustomEvent("ons-glossary", { detail: "" })); } catch { /* خارج المتصفّح */ } }}
        className="shrink-0 w-7 h-7 rounded-full text-[13px] font-bold flex items-center justify-center"
        style={{ color: "var(--text3)", border: "1px solid var(--line)" }}>؟</button>
    </div>
  );
}

export { SubPageHeader };
