import React, { useEffect, useRef, useState } from "react";
import { inputStyle } from "../domain/helpers.js";

function EditableCell({ value, type = "text", editable, onCommit, align = "right" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const ref = useRef(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { if (!editing) setDraft(String(value ?? "")); }, [value, editing]);

  if (!editable) {
    return <span style={{ color: "var(--text)" }} className="text-[12px]">{value ?? "—"}</span>;
  }

  const commit = () => {
    setEditing(false);
    // ⚠ لا نُبلّغ إن لم يتغيّر شيء: نداءٌ بلا تغيير يُنشئ قيد تدقيق
    // فارغًا ويُعيد الرسم بلا سبب.
    if (String(draft) !== String(value ?? "")) onCommit?.(draft);
  };
  const cancel = () => { setDraft(String(value ?? "")); setEditing(false); };

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          // ⚠ نمنع الصعود للصفّ.
          //
          // الصفّ في الجدول يستقبل النقر ليُحدّد السجل، والضغط على
          // خليةٍ للتعديل يصعد إليه فيُعيد الرسم — والحقل يُفتح ويُغلق
          // في اللحظة نفسها، فيبدو الضغط بلا أثر.
          e.stopPropagation();
          setEditing(true);
        }}
        className="text-[12px] w-full"
        style={{ color: "var(--text)", textAlign: align, borderBottom: "1px dashed var(--edge)" }}
        title="اضغط للتعديل"
      >
        {value ?? "—"}
      </button>
    );
  }
  return (
    <input
      ref={ref}
      value={draft}
      type={type === "number" ? "text" : type}
      inputMode={type === "number" ? "decimal" : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      // ⚠ Enter يحفظ وEsc يُلغي — على الحاسب والجوال معًا.
      // الجوال يُظهر «تم» في لوحته وهي تُطلق Enter.
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") { e.preventDefault(); cancel(); }
      }}
      style={{
        ...inputStyle, padding: "4px 8px", fontSize: 12,
        textAlign: align, width: "100%",
      }}
    />
  );
}

export { EditableCell };
