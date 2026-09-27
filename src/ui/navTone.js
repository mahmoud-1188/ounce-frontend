import { MENU_GROUPS } from "../core/navigation.js";

// لون القسم في التصميم الحديث (المرجع 5.2.0): يُعرف القسم من لون أيقونته قبل قراءة اسمه.
// الكلاسيكي بلا متغيّرات tone-* فيرجع إلى الذهبي (--accent).
const TAB_TONE = { home: "sales", sales: "sales", inventory: "inventory", stocktake: "inventory", cash: "money", expenses: "money" };
const GROUP_TONE = { customers: "people" };

function navTone(id) {
  const g0 = MENU_GROUPS.some((x) => x.id === id) ? id : (TAB_TONE[id] || MENU_GROUPS.find((x) => x.items.includes(id))?.id || "");
  const g = GROUP_TONE[g0] || g0;
  return g ? { fg: `var(--tone-${g}, var(--accentText))`, bg: `var(--tone-${g}-bg, var(--panel))` } : { fg: "var(--accentText)", bg: "var(--panel)" };
}

export { navTone };
