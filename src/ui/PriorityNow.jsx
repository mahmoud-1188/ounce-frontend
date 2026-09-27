import React from "react";
import { Check } from "lucide-react";
const tone = (t) => ({ fg: `var(--tone-${t}, var(--accentText))`, bg: `var(--tone-${t}-bg, var(--panel))` });

/// بطاقة «الآن»: رقمُ الأولويّة يتوهّج بلون قسمه، وما يوقف العمل ينبض. بلا مهامّ: «كل شيءٍ على ما يرام».
function PriorityNow({ tasks = [], onPick }) {
  const LEVEL = { block: "يوقف العمل", act: "ينتظرك", soon: "حان وقته" };
  return (
    <div className="mb-4 ons-in">
      <div className="flex items-center gap-2 mb-2" style={{ margin: "0 2px 8px" }}>
        <span className="ons-dot" style={{ width: 8, height: 8, borderRadius: 99, background: tasks.length ? "var(--accent)" : "var(--goodSolid)" }} />
        <p style={{ color: "var(--text)", margin: 0 }} className="text-sm font-black">الآن</p>
        <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">{tasks.length ? "مرتّبةً بأولويّتها" : ""}</p>
      </div>
      {tasks.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--panel)", border: "var(--cardBorder)", borderRadius: 18, boxShadow: "var(--cardShadow)" }}>
          <span className="flex items-center justify-center ons-glowicon" style={{ width: 34, height: 34, borderRadius: 11, background: "var(--goodBg)", color: "var(--goodSolid)" }}><Check size={18} /></span>
          <p style={{ color: "var(--text)", margin: 0 }} className="text-xs font-bold">كل شيءٍ على ما يرام — لا شيء ينتظرك</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((t, i) => (
            <button key={t.id + i} onClick={() => onPick(t)} className={`ons-tile ons-in w-full text-right flex items-center gap-3 px-3 py-3${t.level === "block" ? " ons-live" : ""}`}
              style={{ animationDelay: `${60 * i}ms`, background: "var(--panel)", border: "var(--cardBorder)", borderRadius: 18, boxShadow: "var(--cardShadow)",
                borderInlineStart: `4px solid ${tone(t.tone).fg}` }}>
              <span className="flex items-center justify-center font-black ons-glowicon" style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0,
                background: tone(t.tone).bg, color: tone(t.tone).fg, fontFamily: "'Cairo', sans-serif" }}>{i + 1}</span>
              <span className="flex-1" style={{ minWidth: 0 }}>
                <span style={{ color: "var(--text)", display: "block" }} className="text-sm font-extrabold">{t.label}</span>
                <span style={{ color: "var(--text3)", display: "block" }} className="text-[11px]">{t.hint}</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: tone(t.tone).bg, color: tone(t.tone).fg }}>{LEVEL[t.level]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { PriorityNow };
