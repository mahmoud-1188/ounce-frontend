import { AI_INTENTS } from "../core/assistant.js";
import { key } from "./key.js";
import { tokensAr } from "./tokensAr.js";

function matchIntent(text) {
  const toks = tokensAr(text);
  if (!toks.length) return null;
  let best = null;
  AI_INTENTS.forEach((it) => {
    const hit = (w) => {
      const k = key(w);
      return toks.some((t) => t === k || t.includes(k) || k.includes(t));
    };
    if (!it.must.some(hit)) return;
    // كلمات تنفي النية وإن طابقت إلزامها
    if ((it.not || []).some(hit)) return;
    const score = it.words.reduce((a, w) => a + (hit(w) ? 1 : 0), 0);
    if (!best || score > best.score) best = { intent: it, score };
  });
  return best && best.score >= 1 ? best.intent : null;
}

/// تقارب كلمتين بحرف أو حرفين — للأخطاء الإملائية الشائعة.
/// نكتفي بمسافة تحرير ≤ 2 وبطول متقارب، فالأطول يجرّ اقتراحات بعيدة.

export { matchIntent };
