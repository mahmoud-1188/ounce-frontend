import React from "react";
import { X } from "lucide-react";

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "var(--veil)" }}>
      <div
        className="w-full rounded-t-3xl p-5"
        style={{
          maxWidth: 448,
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderBottom: "none",
          maxHeight: "88dvh",
          overflowY: "auto" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)" }} className="text-lg font-bold">
            {title}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text2)" }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Numeric input for money/weight fields.
//
// Deliberately type="text" + inputMode="decimal" instead of type="number":
//  - type="text" REJECTS Arabic-Indic digits (٠١٢٣…) outright, returning an
//    empty value — on an Arabic keyboard the field simply appears dead, which
//    is exactly the "won't type, won't delete" symptom.
//  - it also discards intermediate states (a lone ".", an emptied field), and
//    behaves inconsistently across mobile browsers and embedded frames.
// Filtering the text ourselves gives predictable behaviour everywhere, and
// lets us transparently accept both Arabic and Latin numerals.

export { ModalShell };
