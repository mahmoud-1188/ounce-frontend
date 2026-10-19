import React from "react";
import { labelModelList, switchLabelModel } from "../domain/labelModels.js";

/// اختيار نموذج الملصق بضغطة — في الإعدادات وعند الطباعة بعد التكويد
function LabelModelPicker({ cfg, onChange, compact = false }) {
  if (!cfg || !onChange) return null;
  return (
    <div className="grid grid-cols-3 gap-1.5" data-label-models>
      {labelModelList(cfg).map((m) => (
        <button key={m.id} type="button" aria-pressed={m.active} data-label-model={m.id}
          onClick={() => { if (!m.active) onChange(switchLabelModel(cfg, m.id)); }}
          className="rounded-xl text-[11px] font-bold"
          style={{ minHeight: compact ? 40 : 48, background: m.active ? "var(--accentBg)" : "var(--field)", color: m.active ? "var(--accent)" : "var(--text2)", border: `1px solid ${m.active ? "var(--accentLine)" : "var(--line)"}` }}>
          {m.name}<span style={{ color: "var(--text3)" }} className="block text-[10px] font-normal">{m.w}×{m.h} مم</span>
        </button>
      ))}
    </div>
  );
}

export { LabelModelPicker };
