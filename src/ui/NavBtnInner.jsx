import React from "react";

function NavBtnInner({ active, onClick, icon, label, reordering, navId, ...press }) {
  return (
    <button
      onClick={onClick}
      {...press}
      data-nav-id={navId}
      /* ⚠ نمنع قائمة النظام.

         الضغط المطوّل على الهاتف يفتح «نسخ / تحديد» فوق الشاشة،
         فيظنّ المستخدم أنها أزرار التطبيق — وهي أزرار المتصفح تحجب
         ما تحتها وتُلغي السحب قبل أن يبدأ. */
      onContextMenu={(e) => e.preventDefault()}
      className="flex flex-col items-center justify-center gap-0.5 py-2.5"
      style={{
        color: active ? "var(--accent)" : "var(--text2)",
        /* ⚠ `none` دائمًا لا عند السحب فقط.

           المتصفح **يقفل `touch-action` لحظة ملامسة الإصبع** ولا يقرأه
           ثانيةً. فجعلُه `none` بعد بدء الترتيب متأخّرٌ بلحظة: اللمسة
           بدأت بـ`manipulation`، فالمتصفح ملك الإيماءة ويُلغي أحداثنا
           عند أول تحرّك.

           وهذا سبب أن الضغط يُظهر «حُفظ الترتيب» ولا يتحرّك شيء:
           `pointerdown` وقع و`pointerup` وقع، وما بينهما ابتلعه المتصفح.

           والشريط ثابت لا يُمرَّر، فمنعُ الإيماءات عليه لا يفقد شيئًا. */
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        transform: reordering ? "scale(1.14)" : "none",
        opacity: reordering ? 0.65 : 1,
        transition: "transform .15s, opacity .15s",
        zIndex: reordering ? 5 : "auto",
      }}
    >
      {icon}
      <span style={{ fontSize: 9, fontFamily: "'Cairo','Tajawal',system-ui,sans-serif" }}>{label}</span>
    </button>
  );
}

// ============================================================
// Inventory
// ============================================================

export { NavBtnInner };
