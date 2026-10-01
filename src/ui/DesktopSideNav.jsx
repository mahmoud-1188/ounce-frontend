import React, { useState } from "react";
import { ChevronDown, FileText, Home, X } from "lucide-react";
import { MENU_GROUPS, NAV_REGISTRY } from "../core/navigation.js";
import { BRANCH_HUBS, hubPages, visibleHub } from "../core/hubs.js";

const SIDE_NAV_W = 248;

/// الشريط الجانبي على الحاسب (المرجع م1): أقسامه أبواب الفرع (core/hubs.js) بصلاحيات الشخص نفسها،
/// وما لا باب له (البحث · المساعد) في «أدوات». يظهر على الشاشات العريضة وحدها.
/// `drawer`: الشكل نفسه درجًا ينزلق على الجوال (زرٌّ عائم يفتحه) — الأبواب مطويّةٌ إلا باب الشاشة الحالية،
/// والاختيار يغلقه.
function DesktopSideNav({ permitted, disabled = [], current, onSelect, onHome, drawer = false, onClose = null }) {
  const reg = new Map(NAV_REGISTRY.map((n) => [n.id, n]));
  const allowed = (id) => permitted.has(id) && !disabled.includes(id);
  const inHubs = hubPages();
  const groups = BRANCH_HUBS.map((h) => visibleHub(h, (id) => allowed(id) && reg.has(id)))
    .filter(Boolean)
    .map((h) => ({ id: h.key, label: h.title, icon: h.icon, items: h.tabs.flatMap((t) => t.views) }));
  // ⚠ شاشةٌ في القائمة القديمة بلا باب لا تضيع: تظهر في «أدوات»
  const tools = [...new Set(MENU_GROUPS.flatMap((g) => g.items))].filter((id) => !inHubs.has(id) && allowed(id) && reg.has(id));
  if (tools.length) groups.push({ id: "tools", label: "أدوات", icon: FileText, items: tools });
  // ⚠ على الجوال القائمة كاملةً أطول من الشاشة مرّات — تبدأ مطويّةً إلا باب ما أنت فيه
  const [closed, setClosed] = useState(() => new Set(drawer ? groups.filter((g) => !g.items.includes(current)).map((g) => g.id) : []));
  const pick = (id) => { onSelect(id); if (drawer) onClose?.(); };
  const toggle = (id) => setClosed((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const item = (id) => {
    const n = reg.get(id);
    const Icon = n.icon || FileText;
    const on = current === id;
    return (
      <button key={id} type="button" onClick={() => pick(id)} className={`w-full flex items-center gap-2 px-3 rounded-lg text-right ${drawer ? "py-2.5 text-[13px]" : "py-1.5 text-[12px]"}`}
        style={{ background: on ? "var(--accentBg)" : "transparent", color: on ? "var(--accent)" : "var(--text2)", fontWeight: on ? 700 : 400 }}>
        <Icon size={14} /> <span className="truncate">{n.label}</span>
      </button>
    );
  };
  const nav = (
    <nav aria-label="التنقل" className="fixed top-0 bottom-0 overflow-y-auto py-3 px-2"
      style={{ insetInlineStart: 0, width: drawer ? "min(300px, 85vw)" : SIDE_NAV_W, background: "var(--panel)", borderInlineEnd: "1px solid var(--line)",
        zIndex: drawer ? 61 : 30, paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", boxShadow: drawer ? "0 0 40px rgba(0,0,0,.5)" : "none" }}>
      {drawer && (
        <div className="flex justify-start mb-1">
          <button type="button" aria-label="إغلاق القائمة" onClick={onClose} style={{ minWidth: 40, minHeight: 40, color: "var(--text2)" }}><X size={18} /></button>
        </div>
      )}
      <button type="button" onClick={() => { onHome(); if (drawer) onClose?.(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-bold mb-2"
        style={{ background: current === "home" ? "var(--accentBg)" : "transparent", color: "var(--text)" }}>
        <Home size={15} /> الرئيسية
      </button>
      {groups.map((g) => {
        const Icon = g.icon || FileText;
        const isClosed = closed.has(g.id);
        return (
          <div key={g.id} className="mb-1">
            <button type="button" onClick={() => toggle(g.id)} aria-expanded={!isClosed}
              className={`w-full flex items-center gap-2 px-3 font-bold ${drawer ? "py-2.5 text-[12px]" : "py-1.5 text-[11px]"}`}
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
  if (!drawer) return nav;
  return (
    <>
      <div onClick={onClose} aria-hidden="true" className="fixed inset-0" style={{ background: "rgba(0,0,0,.55)", zIndex: 60 }} />
      {nav}
    </>
  );
}

export { DesktopSideNav, SIDE_NAV_W };
