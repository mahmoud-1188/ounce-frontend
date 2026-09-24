import React, { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../domain/helpers.js";

function Sparkline({ values = [], tone = "", width = 96, height = 28, animate = true }) {
  const vals = values.map((v) => Number(v) || 0);
  const ref = useRef(null);
  const [len, setLen] = useState(0);
  useEffect(() => { if (ref.current) setLen(ref.current.getTotalLength?.() || 0); }, [vals.join(",")]);
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pad = 2;
  const pts = vals.map((v, i) => [pad + (i / (vals.length - 1)) * (width - pad * 2), height - pad - ((v - min) / span) * (height - pad * 2)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  const color = tone === "good" ? "var(--good)" : tone === "bad" ? "var(--bad)" : tone === "warn" ? "var(--accent)" : "var(--accentText)";
  const last = pts[pts.length - 1];
  const reduced = prefersReducedMotion() || !animate;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }} aria-hidden="true">
      <path d={area} fill={color} opacity="0.12" />
      <path ref={ref} d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        style={reduced ? undefined : { strokeDasharray: len || 1, strokeDashoffset: len ? 0 : 1, transition: "stroke-dashoffset .7s ease-out" }}
        key={vals.join(",")} />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={color}>
        {!reduced && <animate attributeName="r" values="2.4;3.6;2.4" dur="1.8s" repeatCount="indefinite" />}
      </circle>
    </svg>
  );
}

/// شريطٌ مجزّأ — نسبُ الأجزاء بعرضها، والتسمية تحت كلٍّ منها.
///
/// ⚠ يجيب «ممّ يتكوّن الرقم؟» بلا جدول: المبيعات نقدًا/شبكة/آجل، أو
///   الذهب بعياراته. والأجزاء تنمو من الصفر عند الظهور.

export { Sparkline };
