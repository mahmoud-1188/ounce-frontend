import React, { useRef, useState } from "react";
import { AiLogoBadge } from "./AiLogoBadge.jsx";

function DraggableAiButton({ pos, onPosChange, onOpen }) {
  const [dragging, setDragging] = useState(false);
  const dragInfo = useRef({ startX: 0, startY: 0, origX: 0, origY: 0, moved: false });
  const BTN_W = 46;
  const BTN_H = Math.round(46 * (220 / 170));

  /// الموضع الابتدائي — أعلى الشاشة.
  ///
  /// ⚠ كان أسفلها فوق الشريط: يزاحم أزرار التنقّل ويحجب آخر سطرٍ من
  /// كل قائمة، فيسحبه المستخدم في كل شاشة ليقرأ ما تحته.
  ///
  /// وأعلى الشاشة فارغٌ دائمًا — الترويسة نصٌّ لا أزرار.
  const defaultPos = () => ({
    x: Math.max(8, window.innerWidth - BTN_W - 16),
    y: 96,
  });
  const current = pos || defaultPos();

  const clamp = (x, y) => ({
    x: Math.min(Math.max(0, x), window.innerWidth - BTN_W),
    y: Math.min(Math.max(0, y), window.innerHeight - BTN_H),
  });

  const handlePointerDown = (e) => {
    const p = current;
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: p.x,
      origY: p.y,
      moved: false,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragInfo.current.startX;
    const dy = e.clientY - dragInfo.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragInfo.current.moved = true;
    const next = clamp(dragInfo.current.origX + dx, dragInfo.current.origY + dy);
    onPosChange(next);
  };
  const handlePointerUp = () => {
    setDragging(false);
    if (!dragInfo.current.moved) onOpen();
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="fixed z-50"
      style={{
        left: current.x,
        top: current.y,
        width: BTN_W,
        height: BTN_H,
        touchAction: "none",
        cursor: dragging ? "grabbing" : "grab",
        background: "transparent",
        border: "none",
      }}
    >
      <AiLogoBadge width={BTN_W} />
    </div>
  );
}

export { DraggableAiButton };
