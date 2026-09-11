import { NAV_REGISTRY, SHORTCUT_HINTS } from "../core/navigation.js";

function parseShortcutRequest(text, allowed) {
  const q = String(text || "").toLowerCase()
    .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
  if (!q) return null;
  let best = null;
  Object.entries(SHORTCUT_HINTS).forEach(([pageId, words]) => {
    if (allowed && !allowed.has(pageId)) return;
    words.forEach((w) => {
      const nw = w.replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
      if (!q.includes(nw)) return;
      // الكلمة الأطول أدق: «عهده الكسر» تسبق «كسر»
      const score = nw.length * 2 + (q.startsWith(nw) ? 3 : 0);
      if (!best || score > best.score) {
        const nav = NAV_REGISTRY.find((n) => n.id === pageId);
        best = { pageId, score, label: nav?.label || pageId, icon: nav?.icon || null };
      }
    });
  });
  return best;
}

export { parseShortcutRequest };
