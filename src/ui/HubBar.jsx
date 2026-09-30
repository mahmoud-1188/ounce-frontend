import React from "react";
import { NAV_REGISTRY } from "../core/navigation.js";
import { hubOf, visibleHub } from "../core/hubs.js";

/// شريط الباب أعلى الشاشة (المرجع م1): تبويبات الباب، وتحت التبويب المفتوح شاشاته المتقاربة رقاقات.
/// ⚠ لا يظهر لبابٍ لم يبقَ منه لمن يجلس إلا شاشةٌ واحدة — شريطٌ بزرٍّ واحد ضجيجٌ لا تنقّل.
function HubBar({ current, allowed, onOpen }) {
  const found = hubOf(current);
  if (!found) return null;
  const hub = visibleHub(found.hub, allowed);
  if (!hub) return null;
  const count = hub.tabs.reduce((a, t) => a + t.views.length, 0);
  if (count < 2) return null;
  const tab = hub.tabs.find((t) => t.key === found.tab.key);
  const label = (t, id) => t.labels?.[id] || NAV_REGISTRY.find((n) => n.id === id)?.label || id;
  const Icon = hub.icon;
  return (
    <div className="px-4 pt-1 pb-2" role="navigation" aria-label={`باب ${hub.title}`}>
      <div className="flex items-center gap-1.5" style={{ overflowX: "auto", scrollbarWidth: "none" }}>
        <span className="flex items-center gap-1 text-[11px] font-bold flex-shrink-0 pl-1" style={{ color: "var(--accentText)" }}>
          {Icon && <Icon size={13} />} {hub.title}
        </span>
        {hub.tabs.map((t) => {
          const on = t.key === found.tab.key;
          return (
            <button key={t.key} type="button" aria-current={on ? "page" : undefined}
              onClick={() => { if (!on) onOpen(t.views[0]); }}
              className="px-3 py-1.5 rounded-full text-[11px] font-bold flex-shrink-0"
              style={{ background: on ? "var(--accentBg)" : "transparent", color: on ? "var(--accent)" : "var(--text2)",
                border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}` }}>
              {t.label}
            </button>
          );
        })}
      </div>
      {tab && tab.views.length > 1 && (
        <div className="flex gap-1 mt-1.5" style={{ overflowX: "auto", scrollbarWidth: "none" }}>
          {tab.views.map((id) => {
            const on = id === current;
            return (
              <button key={id} type="button" aria-current={on ? "page" : undefined}
                onClick={() => { if (!on) onOpen(id); }}
                className="px-2.5 py-1 rounded-lg text-[10px] flex-shrink-0"
                style={{ background: on ? "var(--field)" : "transparent", color: on ? "var(--text)" : "var(--text3)",
                  fontWeight: on ? 700 : 400, border: `1px solid ${on ? "var(--line)" : "transparent"}` }}>
                {label(tab, id)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { HubBar };
