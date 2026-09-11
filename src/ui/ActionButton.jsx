import React from "react";
import { ChevronLeft } from "lucide-react";

function ActionButton({ icon: Icon, label, hint, tone = "accent", disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-right rounded-xl px-3 py-2.5 flex items-center gap-2.5"
      style={{
        background: disabled ? "var(--field)" : "var(--panel)",
        border: `1px solid ${disabled ? "var(--line)" : `var(--${tone}Line)`}`,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {Icon && <Icon size={16} color={disabled ? "var(--text3)" : `var(--${tone})`} />}
      <span className="flex-1">
        <span style={{ color: disabled ? "var(--text3)" : "var(--text)" }}
          className="text-[12px] font-bold block">{label}</span>
        {hint && (
          <span style={{ color: "var(--text3)" }} className="text-[10px] block">{hint}</span>
        )}
      </span>
      <ChevronLeft size={13} color="var(--text3)" style={{ transform: "rotate(180deg)" }} />
    </button>
  );
}

/// الورقة نفسها.
///
/// ⚠ ورقة سفلية لا صفحة: الصفحة تمحو ما خلفها فيفقد المستخدم مكانه،
/// والورقة تطفو فوقه فيرى أين كان ويعود بضغطة.

export { ActionButton };
