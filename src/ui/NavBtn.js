import React, { useEffect, useRef } from "react";
import { NavBtnInner } from "./NavBtnInner.jsx";

function NavBtn({ active, onClick, icon, label, navId,
                 onReorderStart, onReorderOver, onReorderEnd, reordering }) {
  const timer = useRef(null);
  const holdTimer = useRef(null);
  const fired = useRef(false);
  /* ⚠ مرجعٌ لا حالة.

     `reordering` خاصيّةٌ تصل بعد إعادة رسم، و`pointermove` قد يقع قبلها.
     فالحركة الأولى — وهي التي تُحدّد الاتجاه — تُهمَل، والمستخدم يرى
     زرًّا يهتزّ ولا يتحرّك.

     والمرجع يُضبط في اللحظة نفسها، فلا يفوت شيء. */
  const dragging = useRef(false);

  const start = (e) => {
    if (!onReorderStart) return;
    fired.current = false;
    // ⚠ نلتقط المؤشّر: بلا التقاطٍ يفلت السحب حين يخرج الإصبع عن الزرّ.
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
    // ⚠ 600 مللي: الشريط يُلمس عشرات المرات يوميًا، وأقلّ منها يُطلق
    // الترتيب بالخطأ فيجد المستخدم أزراره تبدّلت بلا سبب.
    holdTimer.current = setTimeout(() => {
      fired.current = true;
      dragging.current = true;
      if (navigator.vibrate) navigator.vibrate([8, 40, 8]);
      onReorderStart(e);
    }, 600);
  };
  const cancel = () => {
    clearTimeout(timer.current);
    clearTimeout(holdTimer.current);
    if (dragging.current) {
      dragging.current = false;
      onReorderEnd?.();
    }
  };
  const tap = () => {
    // ⚠ لا ننفّذ القصيرة بعد المطوّلة: الإصبع يرفع بعدها فيُطلق
    // `click` — فتُفتح شاشتان.
    if (fired.current) { fired.current = false; return; }
    onClick?.();
  };
  useEffect(() => () => {
    clearTimeout(timer.current);
    clearTimeout(holdTimer.current);
  }, []);

  /// أين الإصبع الآن؟
  ///
  /// ⚠ `pointerenter` لا يقع على اللمس.
  ///
  /// الهاتف يلتقط المؤشّر للعنصر الأول ضمنًا، فكل حدثٍ بعده يذهب إليه
  /// وحده — ولا يشعر الزرّ المجاور بمرور الإصبع فوقه أبدًا.
  ///
  /// وهذا سبب أن السحب كان يعمل بالفأرة ولا يعمل بالإصبع: الفأرة
  /// تُغادر العنصر فعلًا، والإصبع لا يُغادر في نظر المتصفح.
  ///
  /// فنسأل الصفحة: ما العنصر تحت هذه النقطة؟
  const move = (e) => {
    if (!dragging.current || !onReorderOver) return;
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const btn = el?.closest?.("button[data-nav-id]");
    const id = btn?.getAttribute("data-nav-id");
    if (id) onReorderOver(id);
  };

  return NavBtnInner({
    active, icon, label, reordering, navId,
    onClick: tap,
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: cancel,
    onPointerCancel: cancel,
  });
}

export { NavBtn };
