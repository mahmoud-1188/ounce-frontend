import React from "react";

function Card({ children, style, className = "" }) {
  // ⚠ الظلّ لا الحدّ.
  //
  // على خلفية داكنة يفصل الحدُّ البطاقةَ عن محيطها. على الفاتحة يصير
  // خطًّا رماديًا حول كل شيء: الشاشة تمتلئ بأقفاص، والعين تتعب من
  // عدّ الحدود قبل أن تقرأ المحتوى.
  //
  // الظلّ الناعم الواسع يرفع البطاقة عن الصفحة بلا خطّ — وهو ما يجعل
  // «طريقة المربعات» تبدو مرتّبة لا مزدحمة.
  return (
    <div
      className={className}
      style={{
        background: "var(--panel)",
        border: "var(--cardBorder, 1px solid var(--edge))",
        borderRadius: "var(--cardRadius, 16px)",
        boxShadow: "var(--cardShadow, none)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export { Card };
