import React, { useEffect, useState } from "react";
import { LOGO_AR, LOGO_EN } from "../../_single/logo-data.js";
import { LOGO_FADE_MS, LOGO_SWAP_MS } from "../core/constants.js";

function OqiyyahLogo({ size = 56, still = false, glow = true, className = "", style = {} }) {
  const [showArabic, setShowArabic] = useState(true);
  const reduceMotion = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (still || reduceMotion) return undefined;
    const t = setInterval(() => setShowArabic((v) => !v), LOGO_SWAP_MS);
    return () => clearInterval(t);
  }, [still, reduceMotion]);

  // التوهّج بـdrop-shadow لا box-shadow: الأول يتبع حواف الذهب الشفافة،
  // والثاني يرسم مربّعًا حول الصورة كلها.
  const halo = size * 0.18;
  const layer = (on) => ({
    position: "absolute", inset: 0, width: "100%", height: "100%",
    objectFit: "contain", opacity: on ? 1 : 0,
    transition: `opacity ${LOGO_FADE_MS}ms ease-in-out`,
    filter: glow
      ? `drop-shadow(0 0 ${halo * 0.5}px rgba(255,214,110,.55)) drop-shadow(0 0 ${halo}px rgba(212,175,55,.35))`
      : "none",
    animation: glow && !reduceMotion ? "oqiyyahBreathe 4s ease-in-out infinite" : "none",
  });

  return (
    <div
      className={className}
      style={{ position: "relative", width: size, height: size, flexShrink: 0, ...style }}
      aria-label="أوقية"
      role="img"
    >
      <style>{`@keyframes oqiyyahBreathe{0%,100%{filter:drop-shadow(0 0 ${halo * 0.5}px rgba(255,214,110,.45)) drop-shadow(0 0 ${halo}px rgba(212,175,55,.25))}50%{filter:drop-shadow(0 0 ${halo * 0.7}px rgba(255,214,110,.7)) drop-shadow(0 0 ${halo * 1.3}px rgba(212,175,55,.45))}}`}</style>
      <img src={LOGO_AR} alt="" draggable={false} style={layer(showArabic)} />
      <img src={LOGO_EN} alt="" draggable={false} style={layer(!showArabic)} />
    </div>
  );
}

// الشارة الصغيرة للرصيف والشريط — تُبقي الاسم القديم لأن خمسة مواضع تستدعيه.

export { OqiyyahLogo };
