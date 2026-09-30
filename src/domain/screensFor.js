import { findScreens } from "./findScreens.js";

// «وين/افتح …» سؤالٌ عن شاشة لا عن رقم — نجيبه من سجلّ الشاشات بلا شبكة.
// ⚠ «كيف» ليست منها: سؤال الطريقة يحتاج شرحًا لا زرًّا فقط.
const WHERE_WORDS = /(^|\s)(وين|اين|أين|فين|افتح|ودني|ودّني|شاشه|شاشة|صفحه|صفحة)(\s|$)/;
const STOP_WORDS = new Set(["وين", "اين", "أين", "فين", "افتح", "ودني", "ودّني", "شاشه", "شاشة", "صفحه", "صفحة", "الشاشه", "الشاشة", "الصفحه", "الصفحة", "اسوي", "أسوي", "اعمل", "أعمل", "اسجل", "أسجل", "القى", "ألقى", "الاقي", "ألاقي", "هي", "في", "من", "على", "عن", "ابغى", "أبغى", "اريد", "أريد"]);
const isScreenQuestion = (text) => WHERE_WORDS.test(String(text || "").replace(/[؟?!.,،]/g, " "));

function screensFor(text, allowed) {
  const clean = String(text || "").replace(/[؟?!.,،]/g, " ");
  if (!WHERE_WORDS.test(clean)) return [];
  const rest = clean.split(/\s+/).filter((w) => w && !STOP_WORDS.has(w)).join(" ");
  if (!rest) return [];
  const all = findScreens(rest, allowed);
  if (all.length) return all.slice(0, 4);
  // كلمةً كلمة — «وين جرد الأقسام» تكفيها «جرد»
  const seen = new Map();
  rest.split(" ").forEach((w) => findScreens(w, allowed).forEach((h) => { if (!seen.has(h.id)) seen.set(h.id, h); }));
  return [...seen.values()].slice(0, 4);
}

export { isScreenQuestion, screensFor };
