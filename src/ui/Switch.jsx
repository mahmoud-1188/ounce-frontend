import React from "react";

function Switch({ on, onChange, label, disabled = false, ...rest }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} disabled={disabled}
      data-help={`مفتاحٌ يشغّل «${label || "هذا الخيار"}» أو يطفئه — هو ${on ? "مشغَّلٌ" : "مطفأٌ"} الآن؛ اضغطه للتبديل، والسطر بجانبه يقول ما يتغيّر.`} {...rest}
      onClick={() => { if (!disabled) onChange(!on); }}
      style={{ width: 46, height: 25, borderRadius: 13, position: "relative", flexShrink: 0, opacity: disabled ? 0.5 : 1,
        background: on ? "var(--goodSolid)" : "var(--edge)", transition: "background .2s" }}>
      <div style={{ width: 19, height: 19, borderRadius: "50%", background: "var(--text)",
        position: "absolute", top: 3, insetInlineStart: on ? 24 : 3, transition: "inset-inline-start .2s" }} />
    </button>
  );
}

export { Switch };
