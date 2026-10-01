import React, { useEffect, useState } from "react";
import { PanelRight } from "lucide-react";
import { DesktopSideNav } from "./DesktopSideNav.jsx";

/// زرٌّ عائم على الجوال يفتح القائمة الجانبية نفسها التي على الحاسب — درجًا ينزلق من الجانب.
/// ☰ باقٍ كما هو؛ هذا طريقٌ إضافي إلى أي شاشةٍ بلمستين.
/// ⚠ يجلس فوق ما في أسفل الشاشة (الشريط السفلي أو زرّ «الرئيسية» في البسيط) لا فوقه:
///   ارتفاعهما يتغيّر بالتصميم وعدد الصفوف، فيُقاس لا يُفترض.
function NavDrawerFab({ permitted, disabled, current, onSelect, onHome, layoutKey = "" }) {
  const [open, setOpen] = useState(false);
  const [lift, setLift] = useState(16);
  useEffect(() => {
    const measure = () => {
      let h = 0;
      for (const id of ["ons-bottom-nav", "ons-home-pill"]) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.height) h = Math.max(h, window.innerHeight - r.top);
      }
      setLift(h ? h + 10 : 16);
    };
    measure();
    // ⚠ بعد الرسم أيضًا: الشريط السفلي يظهر في الرسم نفسه الذي تغيّر فيه التصميم
    const raf = requestAnimationFrame(measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ["ons-bottom-nav", "ons-home-pill"].forEach((id) => { const el = document.getElementById(id); if (el && ro) ro.observe(el); });
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, [current, layoutKey]);
  // الرجوع في المتصفح يغلق الدرج بدل أن يغادر الشاشة
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button type="button" aria-label="القائمة الجانبية" onClick={() => setOpen(true)}
        className="fixed flex items-center justify-center rounded-full"
        style={{ zIndex: 41, insetInlineStart: 16, bottom: `calc(${lift}px + env(safe-area-inset-bottom, 0px))`, width: 48, height: 48,
          background: "var(--accentBg)", color: "var(--accentText)", border: "1px solid var(--accentLine)", boxShadow: "var(--cardShadow, 0 6px 20px rgba(0,0,0,.35))" }}>
        <PanelRight size={20} />
      </button>
      {open && (
        <DesktopSideNav drawer permitted={permitted} disabled={disabled} current={current}
          onSelect={onSelect} onHome={onHome} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

export { NavDrawerFab };
