import React from "react";
import { markRowHintSeen } from "../domain/rowHint.js";

/// «⋯» ظاهرٌ دائمًا، وأوّل فعلين متاحين أيقونتان تظهران عند مرور الفأرة (ons-row-quick).
function RowMore({ label = "", acts = [], onMore, onAct }) {
  const quick = acts.filter((a) => !a.disabled && a.icon).slice(0, 2);
  return (
    <span className="flex items-center gap-1" style={{ flexShrink: 0 }}>
      {quick.map((a) => {
        const QuickIcon = a.icon;
        return (
          <button key={a.id} type="button" className="ons-row-quick" aria-label={`${a.label} — ${label}`} title={a.label}
            onClick={(e) => { e.stopPropagation(); onAct?.(a.id); }}
            style={{ width: 34, height: 34, borderRadius: 10, placeItems: "center", background: "var(--field)", border: "1px solid var(--line)" }}>
            <QuickIcon size={15} color="var(--accent)" />
          </button>
        );
      })}
      {onMore && (
        <button type="button" aria-label={`أفعال ${label}`} aria-haspopup="dialog" title="أفعال"
          onClick={(e) => { e.stopPropagation(); markRowHintSeen(); onMore(); }}
          style={{ minWidth: 40, minHeight: 40, borderRadius: 12, color: "var(--text2)", fontSize: 18, fontWeight: 800 }}>⋯</button>
      )}
    </span>
  );
}

export { RowMore };
