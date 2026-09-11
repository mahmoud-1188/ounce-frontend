import React, { useRef, useState } from "react";

function FloatingDock({ pos, onPosChange, collapsed, onToggle, actions = [] }) {
  const [dragging, setDragging] = useState(false);
  const info = useRef({ sx: 0, sy: 0, ox: 0, oy: 0, moved: false });

  const W = 50;
  const GAP = 8;
  const H = collapsed ? 34 : actions.length * (W + GAP) - GAP + 34;

  /// الموضع الابتدائي — أعلى الشاشة.
  ///
  /// ⚠ كان أسفلها فوق الشريط: يزاحم أزرار التنقّل ويحجب آخر سطرٍ من
  /// كل قائمة، فيسحبه المستخدم في كل شاشة ليقرأ ما تحته.
  ///
  /// وأعلى الشاشة فارغٌ دائمًا — الترويسة نصٌّ لا أزرار.
  ///
  /// و96 لا صفر: تحت الترويسة وشريط يوم العمل، فلا يحجبهما.
  const fallback = () => ({
    x: Math.max(8, window.innerWidth - W - 14),
    y: 96,
  });
  const cur = pos || fallback();

  const clamp = (x, y) => ({
    x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - W)),
    y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - H)),
  });

  const down = (e) => {
    info.current = { sx: e.clientX, sy: e.clientY, ox: cur.x, oy: cur.y, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!dragging) return;
    const dx = e.clientX - info.current.sx;
    const dy = e.clientY - info.current.sy;
    // ⚠ عتبة 4 بكسل: بدونها كل ضغطة تُحسب سحبًا فلا يُفتح شيء
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) info.current.moved = true;
    onPosChange(clamp(info.current.ox + dx, info.current.oy + dy));
  };
  const up = (e) => {
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const wasDrag = () => info.current.moved;

  return (
    <div
      className="fixed z-40"
      style={{
        left: cur.x, top: cur.y, width: W,
        touchAction: "none",
        transition: dragging ? "none" : "top .18s ease, left .18s ease",
      }}
    >
      {/* المقبض: يُطوي ويُظهر، وهو نفسه مقبض السحب */}
      <button
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onClick={() => { if (!wasDrag()) onToggle(); }}
        aria-label={collapsed ? "إظهار الأزرار" : "طيّ الأزرار"}
        style={{
          width: W, height: 30, borderRadius: 15,
          background: "var(--panel)", border: "1px solid var(--accentLine)",
          display: "grid", placeItems: "center",
          cursor: dragging ? "grabbing" : "grab",
          boxShadow: "0 2px 8px var(--veil)",
        }}
      >
        <span
          style={{
            width: 18, height: 3, borderRadius: 2,
            background: collapsed ? "var(--accentLine)" : "var(--accent)",
            display: "block", transition: "background .2s",
          }}
        />
      </button>

      {/* الأزرار */}
      <div
        style={{
          marginTop: collapsed ? 0 : 6,
          maxHeight: collapsed ? 0 : actions.length * (W + GAP),
          opacity: collapsed ? 0 : 1,
          overflow: "hidden",
          transition: "max-height .22s ease, opacity .18s ease, margin-top .22s ease",
        }}
      >
        {actions.map((a, i) => (
          <button
            key={a.id}
            onClick={a.onPress}
            aria-label={a.label}
            title={a.label}
            style={{
              width: W, height: W, borderRadius: W / 2,
              marginBottom: i < actions.length - 1 ? GAP : 0,
              background: a.accent || "var(--panel)",
              border: `1px solid ${a.border || "var(--accentLine)"}`,
              display: "grid", placeItems: "center",
              boxShadow: "0 3px 10px var(--veil)",
            }}
          >
            {a.node}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ورقة الأوامر الصوتية
// ============================================================

export { FloatingDock };
