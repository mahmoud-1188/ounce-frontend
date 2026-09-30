import React, { useState } from "react";
import { X } from "lucide-react";
import { markRowHintSeen, rowHintSeen } from "../domain/rowHint.js";

function RowHint() {
  const [show, setShow] = useState(() => !rowHintSeen());
  if (!show) return null;
  return (
    <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2 flex items-center gap-2">
      <span className="flex-1">⋯ في آخر كل صفٍّ فيه أفعاله — أو اضغط على الصفّ مطوّلًا</span>
      <button type="button" aria-label="أخفِ التلميح" onClick={() => { markRowHintSeen(); setShow(false); }} style={{ minWidth: 40, minHeight: 40 }}><X size={14} /></button>
    </p>
  );
}

export { RowHint };
