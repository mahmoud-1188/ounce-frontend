import React, { useState } from "react";
import { ChevronDown, FileText, Home } from "lucide-react";
import { MAIN_TAB_IDS, MENU_GROUPS, NAV_REGISTRY } from "../core/navigation.js";

const SIDE_NAV_W = 248;

/// الشريط الجانبي على الحاسب (المرجع 5.2.0: DesktopSideNav) — أقسام القائمة نفسها (MENU_GROUPS)
/// وبصلاحيات الشخص نفسها؛ يظهر على الشاشات العريضة وحدها، وعلى الجوال يبقى ☰ والشريط السفلي.
function DesktopSideNav({ permitted, disabled = [], current, onSelect, onHome }) {
  const [closed, setClosed] = useState(() => new Set());
  const reg = new Map(NAV_REGISTRY.map((n) => [n.id, n]));
  const allowed = (id) => permitted.has(id) && !disabled.includes(id);
  const groups = MENU_GROUPS.map((g) => ({ ...g, items: g.items.filter((id, i, arr) => allowed(id) && arr.indexOf(id) === i && reg.has(id)) }))
    .filter((g) => g.items.length);
  // ⚠ شاشات الشريط السفلي (المخزون · المبيعات · النقد …) أوّلًا: ليست في أقسام القائمة،
  //   وبلاها لا طريق إليها على الحاسب إلا الرئيسية.
  const mainTabs = MAIN_TAB_IDS.filter((id) => allowed(id) && reg.has(id));
  const toggle = (id) => setClosed((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const item = (id) => {
    const n = reg.get(id);
    const Icon = n.icon || FileText;
    const on = current === id;
    return (
      <button key={id} type="button" onClick={() => onSelect(id)} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-right"
        style={{ background: on ? "var(--accentBg)" : "transparent", color: on ? "var(--accent)" : "var(--text2)", fontWeight: on ? 700 : 400 }}>
        <Icon size={14} /> <span className="truncate">{n.label}</span>
      </button>
    );
  };
  return (
    <nav aria-label="التنقل" className="fixed top-0 bottom-0 overflow-y-auto py-3 px-2"
      style={{ insetInlineStart: 0, width: SIDE_NAV_W, background: "var(--panel)", borderInlineEnd: "1px solid var(--line)", zIndex: 30 }}>
      <button type="button" onClick={onHome} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-bold mb-2"
        style={{ background: current === "home" ? "var(--accentBg)" : "transparent", color: "var(--text)" }}>
        <Home size={15} /> الرئيسية
      </button>
      {mainTabs.length > 0 && <div className="mb-2">{mainTabs.map(item)}</div>}
      {groups.map((g) => {
        const Icon = g.icon || FileText;
        const isClosed = closed.has(g.id);
        return (
          <div key={g.id} className="mb-1">
            <button type="button" onClick={() => toggle(g.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold"
              style={{ color: "var(--accentText)" }}>
              <Icon size={13} /> <span className="flex-1 text-right">{g.label}</span>
              <ChevronDown size={12} style={{ transform: isClosed ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
            </button>
            {!isClosed && g.items.map(item)}
          </div>
        );
      })}
    </nav>
  );
}

export { DesktopSideNav, SIDE_NAV_W };
