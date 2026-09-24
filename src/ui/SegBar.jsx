import React, { useEffect, useState } from "react";
import { prefersReducedMotion } from "../domain/helpers.js";

function SegBar({ parts = [], height = 8, show = true }) {
  const total = parts.reduce((a, p) => a + (Number(p.value) || 0), 0);
  const [grown, setGrown] = useState(prefersReducedMotion());
  useEffect(() => { const t = setTimeout(() => setGrown(true), 30); return () => clearTimeout(t); }, [parts.map((p) => p.value).join(",")]);
  if (!total || !parts.length) return null;
  const palette = ["var(--accent)", "var(--good)", "var(--accentText)", "var(--text3)", "var(--bad)"];
  return (
    <div>
      <div style={{ display: "flex", height, borderRadius: height, overflow: "hidden", background: "var(--field)", gap: 2 }}>
        {parts.map((p, i) => (
          <div key={i} title={p.label} style={{ width: grown ? `${Math.max(2, ((Number(p.value) || 0) / total) * 100)}%` : "0%",
            background: palette[i % palette.length], transition: "width .6s cubic-bezier(.2,.8,.2,1)", transitionDelay: `${i * 60}ms` }} />
        ))}
      </div>
      {show && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {parts.map((p, i) => (
            <span key={i} className="text-[9px]" style={{ color: "var(--text3)" }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: palette[i % palette.length], marginInlineEnd: 4, verticalAlign: "middle" }} />
              {p.label} {Math.round(((Number(p.value) || 0) / total) * 100)}٪
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/// شارةُ المقارنة بالفترة السابقة: ▲ 12٪ أو ▼ 8٪ — بلون المعنى لا الاتجاه.
///
/// ⚠ **الأخضر للجيّد لا للصعود:** مصروفاتٌ صاعدة حمراء، مبيعاتٌ صاعدة خضراء.

export { SegBar };
