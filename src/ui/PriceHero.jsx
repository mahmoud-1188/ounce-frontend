import React, { useEffect, useState } from "react";
import { fmt } from "../core/money.js";
import { OqiyyahLogo } from "./OqiyyahLogo.jsx";
import { markupLabel } from "../domain/helpers.js";

function PriceHero({ chartData = [], price, prevPrice, currency, updatedAt, karat = 24, compact = false, world24 = 0, markup = null }) {
  const [shown, setShown] = useState(Number(price) || 0);

  // العدّ التصاعدي نحو القيمة الجديدة — قفزة الرقم المفاجئة لا تُلاحَظ.
  useEffect(() => {
    const target = Number(price) || 0;
    const start = shown;
    if (Math.abs(target - start) < 0.005) {
      setShown(target);
      return;
    }
    const t0 = performance.now();
    const dur = 700;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const ease = 1 - Math.pow(1 - k, 3);
      setShown(start + (target - start) * ease);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [price]);

  const cur = Number(price) || 0;
  const prev = Number(prevPrice) || 0;
  const delta = prev > 0 ? cur - prev : 0;
  const pct = prev > 0 ? (delta / prev) * 100 : 0;
  const up = delta >= 0;
  const accent = delta === 0 ? "var(--accentSoft)" : up ? "var(--goodSolid)" : "var(--bad)";

  // منحنى الخلفية بـSVG خالص: أخفّ من مكتبة رسم كاملة لعنصر زخرفي،
  // ويسمح بالتحكم في تدرّج التعبئة وحركة الرسم.
  const pts = chartData.slice(-40).map((d) => Number(d.price) || 0).filter((v) => v > 0);
  const W = 400;
  const H = compact ? 90 : 130;
  let path = "";
  let areaPath = "";
  if (pts.length >= 2) {
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;
    const step = W / (pts.length - 1);
    const xy = pts.map((v, i) => [i * step, H - 8 - ((v - min) / span) * (H - 26)]);
    path = xy.map(([x, y], i) => (i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`)).join(" ");
    areaPath = `${path} L${W},${H} L0,${H} Z`;
  }

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 16,
        background: "linear-gradient(160deg,var(--panel) 0%,var(--bg) 100%)",
        border: `1px solid ${delta === 0 ? "var(--edge)" : up ? "var(--goodLine)" : "var(--badLine)"}`,
        padding: compact ? "14px 16px" : "18px 18px 16px",
      }}
    >
      {/* ⚠ الشعار علامةٌ مائية خلف الرقم لا فوقه: السعر هو ما يُقرأ،
          والشعار يُذكّر بالهوية بلا أن يزاحمه. */}
      {!compact && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
          pointerEvents: "none", opacity: 0.07, zIndex: 0 }} aria-hidden="true">
          <OqiyyahLogo size={180} still glow={false} />
        </div>
      )}
      {/* الخلفية: المنحنى */}
      {path && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5 }}
        >
          <defs>
            <linearGradient id={`ph-fill-${up ? "up" : "dn"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#ph-fill-${up ? "up" : "dn"})`} className="ph-area" />
          <path
            d={path}
            fill="none"
            stroke={accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ph-line"
          />
        </svg>
      )}

      {/* المقدمة: الأرقام */}
      <div style={{ position: "relative" }}>
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: "var(--text2)" }} className="text-[11px]">
            جرام عيار {karat}
          </span>
          {delta !== 0 && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{ background: up ? "var(--goodBg)" : "var(--badBg)", color: accent }}
            >
              {up ? "▲" : "▼"} {fmt(Math.abs(pct), 2)}٪
            </span>
          )}
        </div>

        <p
          style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)", lineHeight: 1.05 }}
          className={compact ? "text-3xl font-extrabold" : "text-4xl font-extrabold"}
        >
          {fmt(shown)}
          <span style={{ color: "var(--text2)" }} className="text-base font-bold mr-1.5">
            {currency}
          </span>
        </p>

        <div className="flex items-center justify-between mt-1.5">
          <span style={{ color: accent }} className="text-xs font-bold">
            {delta === 0 ? "بلا تغيير" : `${up ? "+" : "−"}${fmt(Math.abs(delta))} ${currency}`}
          </span>
          {updatedAt && (
            <span style={{ color: "var(--text3)" }} className="text-[10px]">
              {new Date(updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        {/* ⚖ سعر العمل = العالمي + زيادة الإدارة — يُعرض التركيب لا الرقم وحده */}
        {markup && Number(markup.value) > 0 && Number(world24) > 0 && (
          <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[11px]">
            عالمي {currency}{fmt(world24)} + زيادة الإدارة {markupLabel(markup)} = <span style={{ color: "var(--accent)" }}>{currency}{fmt(price)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// Combined landing screen: shown immediately on launch, before any login. It
// displays live gold prices + chart AND the PIN pad on the same screen — as
// soon as a valid PIN is entered, the app opens directly with no extra
// "enter app" step in between.

export { PriceHero };
