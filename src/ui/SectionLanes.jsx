import React from "react";
import { NAV_REGISTRY } from "../core/navigation.js";
const tone = (t) => ({ fg: `var(--tone-${t}, var(--accentText))`, bg: `var(--tone-${t}-bg, var(--panel))` });

/// ممرّات الأقسام: كل قسمٍ صفٌّ بلونه وعنوانه المضيء — الأعلى أولويّةً في يومه أوّلًا.
/// `lanes`: [{ tone, title, ids }] — الشاشة تظهر لمن يملكها، والممرّ الفارغ يختفي.
function SectionLanes({ lanes = [], has = () => true, onGo }) {
  const rows = lanes.map((l) => ({ ...l, items: l.ids.filter((id) => has(id)).slice(0, 4).map((id) => NAV_REGISTRY.find((n) => n.id === id)).filter(Boolean) }))
    .filter((l) => l.items.length);
  if (!rows.length) return null;
  return (
    <div className="mb-4 flex flex-col gap-3">
      {rows.map((l, li) => (
        <div key={l.title} className="ons-in" style={{ animationDelay: `${80 + 70 * li}ms` }}>
          <div className="flex items-center gap-2" style={{ margin: "0 2px 6px" }}>
            <span style={{ width: 18, height: 3, borderRadius: 3, background: tone(l.tone).fg, boxShadow: `0 0 10px ${tone(l.tone).fg}` }} />
            <p style={{ color: tone(l.tone).fg, margin: 0 }} className="text-xs font-black">{l.title}</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {l.items.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => onGo(t.id)} className="ons-tile flex flex-col items-center gap-1.5 py-3"
                  style={{ background: "var(--panel)", border: "var(--cardBorder)", borderRadius: 18, boxShadow: "var(--cardShadow)" }}>
                  <span className="flex items-center justify-center ons-glowicon" style={{ width: 38, height: 38, borderRadius: 12, background: tone(l.tone).bg, color: tone(l.tone).fg }}>
                    <Icon size={19} />
                  </span>
                  <span style={{ color: "var(--text)", lineHeight: 1.25 }} className="text-[11px] font-bold text-center px-1">{t.label.split(" — ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export { SectionLanes };
