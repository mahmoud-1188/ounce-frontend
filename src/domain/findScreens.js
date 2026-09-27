import { AI_APP_MANUAL } from "../core/constants.js";
import { MAIN_TAB_IDS, MENU_GROUPS, NAV_REGISTRY, SHORTCUT_HINTS } from "../core/navigation.js";
import { normalizeName } from "./helpers.js";

/// البحث عن شاشة (المرجع 5.2.0): الاسم في السجلّ، والمرادفات في دليل المساعد
/// وكلمات الاختصارات، ومكانها في القائمة («في: التقارير»).
/// بلا تشكيلٍ ولا همزات: «الاعتمادات» = «اعتماد».
function findScreens(query, allowed = () => true) {
  const norm = (t) => normalizeName(String(t || "")).replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/^ال/, "").toLowerCase();
  const words = norm(query).split(" ").filter(Boolean).map((w) => w.replace(/^ال/, ""));
  if (!words.length) return [];
  const manual = {};
  (AI_APP_MANUAL || []).forEach((m) => { manual[m[0]] = m; });
  const groupOf = (id) => MENU_GROUPS.find((g) => g.items.includes(id))?.label || (MAIN_TAB_IDS.includes(id) ? "الشريط السفلي" : "القائمة");
  const out = [];
  for (const o of NAV_REGISTRY) {
    if (o.id === "more" || !allowed(o.id)) continue;
    const m = manual[o.id];
    const hay = norm([o.label, m && m[1], m && m[4], ...(SHORTCUT_HINTS[o.id] || [])].filter(Boolean).join(" "));
    let score = 0;
    for (const w of words) { if (!hay.includes(w)) { score = -1; break; } score += norm(o.label).includes(w) ? 3 : 1; }
    if (score > 0) out.push({ id: o.id, label: o.label, icon: o.icon, where: `في: ${groupOf(o.id)}`, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 12);
}

export { findScreens };
