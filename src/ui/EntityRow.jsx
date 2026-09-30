import React, { useEffect, useRef } from "react";
import { markRowHintSeen } from "../domain/rowHint.js";
import { RowMore } from "./RowMore.jsx";

/// صفٌّ: الضغط يفتح كما كان، والضغط المطوّل باللمس يفتح الأفعال، و«⋯» في آخره.
function EntityRow({ label = "", acts = [], onOpen, onMore, onAct, children, style, className = "", innerClass = "flex-1 min-w-0 text-right" }) {
  const timer = useRef(null);
  const fired = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const down = (e) => {
    if (!onMore || e.pointerType === "mouse") return;
    fired.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { fired.current = true; markRowHintSeen(); onMore(); }, 550);
  };
  const up = () => clearTimeout(timer.current);
  return (
    <div className={`ons-row flex items-center gap-1 ${className}`} style={style}
      onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
      onContextMenu={(e) => { if (onMore) e.preventDefault(); }}>
      <button type="button" className={innerClass} onClick={() => { if (fired.current) { fired.current = false; return; } onOpen?.(); }}>
        {children}
      </button>
      <RowMore label={label} acts={acts} onMore={onMore} onAct={onAct} />
    </div>
  );
}

export { EntityRow };
