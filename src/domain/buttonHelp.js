// زرّ «؟» على كل زرّ: الضغط على العلامة أو الضغط المطوّل أو F1 يفتح شرح الزرّ بدل تنفيذه
import { BUTTON_HELP } from "../core/buttonHelp.js";
import { normAr } from "./normAr.js";

const BTN_HELP_SEL = "button, [role=button]";

const buttonHelpKey = (label) => normAr(String(label || "")
  .replace(/ـ/g, "")
  .replace(/[A-Za-z]+[-_/][\w\-/]*\d[\w\-/]*/g, " ")
  .replace(/[0-9٠-٩۰-۹]+(?:[.,٫٬:/][0-9٠-٩۰-۹]+)*/g, " ")
  .replace(/ر\.س|SAR/gi, " "))
  .replace(/\S*\d\S*/g, " ").replace(/_/g, " ").replace(/\s+/g, " ").trim();

const buttonHelpVariants = (label) => {
  const s = String(label || "").replace(/\s+/g, " ").trim();
  if (!s) return [];
  const base = [s, s.split(" — ")[0], s.split(" · ")[0], s.split(/[:：]/)[0], s.split("(")[0]].map((x) => x.trim()).filter(Boolean);
  // بلا الرموز اللاتينية كرمز القطعة واسم الطابعة: «حدّد KN6DN8CT» يطابق «حدّد»
  const bare = base.map((x) => x.replace(/[A-Za-z0-9][\w\-/.×]*/g, " ").replace(/\s+/g, " ").replace(/^[\s—·:]+|[\s—·:]+$/g, "").trim())
    .filter((x) => /[\u0600-\u06FF]/.test(x));
  return [...new Set([...base, ...bare])];
};

// فهرس الشرح يُبنى مرّةً: الأسماء الحرفية والقوالب ذات النجمة
function buttonHelpIndex() {
  if (buttonHelpIndex.cache) return buttonHelpIndex.cache;
  const exact = new Map(), patterns = [];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  Object.entries(BUTTON_HELP).forEach(([label, v]) => {
    if (label.includes("*")) patterns.push([new RegExp(`^${label.split("*").map((p) => esc(buttonHelpKey(p))).join(".*")}$`), v]);
    else exact.set(buttonHelpKey(label), v);
  });
  return (buttonHelpIndex.cache = { exact, patterns });
}

// ترتيب الشرح: data-help على الزرّ، ثم BUTTON_HELP باسمه، ثم data-help-each على الحاوية، وأخيرًا جوابٌ عامّ
function resolveButtonHelp({ labels = [], help = null, screen = "home", ctx = [], each = null } = {}) {
  const cands = [];
  labels.forEach((l) => buttonHelpVariants(l).forEach((text) => { const key = buttonHelpKey(text); if (key && !cands.some((c) => c.key === key)) cands.push({ text, key }); }));
  const first = cands[0]?.text || String(labels.find((l) => String(l || "").trim()) || "").trim() || "زرّ";
  const pair = (v) => {
    if (Array.isArray(v)) return { what: String(v[0] || ""), how: String(v[1] || "") };
    const t = String(v);
    let depth = 0, at = -1;
    for (let i = 0; i < t.length && at < 0; i++) {
      if (t[i] === "«" || t[i] === "(") depth++;
      else if (t[i] === "»" || t[i] === ")") depth = Math.max(0, depth - 1);
      else if (!depth && t.startsWith(" — ", i)) at = i;
    }
    return at < 0 ? { what: t.trim(), how: "" } : { what: t.slice(0, at).trim(), how: t.slice(at + 3).trim() };
  };
  const out = (label, v, source, key = null) => { const p = pair(v); return { label, what: p.what, how: p.how || "اضغطه لتنفيذه.", source, key: key || buttonHelpKey(label) }; };
  if (help) return out(first, help, "attr");
  const idx = buttonHelpIndex();
  const base = String(screen || "home").split(":")[0];
  const pick = (v) => {
    if (!v || Array.isArray(v) || typeof v === "string") return v || null;
    for (const c of ctx) if (v[`@${c}`]) return v[`@${c}`];
    return v[screen] || v[base] || v["*"] || null;
  };
  for (const c of cands) { const v = pick(idx.exact.get(c.key)); if (v) return out(c.text, v, "registry", c.key); }
  for (const c of cands) for (const [re, val] of idx.patterns) { const v = re.test(c.key) ? pick(val) : null; if (v) return out(c.text, v, "pattern", c.key); }
  if (each) return out(first, each, "attr");
  return out(first, [`زرّ «${first}» في هذه الشاشة.`, "اضغطه لتنفيذ ما يقوله اسمه."], "generic");
}

function buttonHelpEligible(el) {
  if (!el || typeof el.closest !== "function" || typeof document === "undefined" || !document.documentElement.dataset.helpBadges) return false;
  return !!el.matches?.(BTN_HELP_SEL) && !el.hasAttribute("data-help-btn") && !el.closest("[data-no-help]");
}

function buttonHelpLabelsOf(el) {
  // مكافئ الذهب الصغير (GoldEq) بجانب المبلغ ليس من اسم الزرّ
  let text = String(el.innerText || el.textContent || "");
  if (el.querySelectorAll) el.querySelectorAll("[data-gold-eq]").forEach((g) => { const t = String(g.textContent || "").trim(); if (t) text = text.replace(t, ""); });
  return [el.getAttribute("data-help-label"), el.getAttribute("aria-label"), el.getAttribute("title"),
    ...text.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3), text.replace(/\s+/g, " ").trim()]
    .map((s) => String(s || "").trim()).filter(Boolean);
}

function buttonHelpInfoOf(el, { screen = "home" } = {}) {
  const ctx = [];
  for (let p = el.parentElement; p; p = p.parentElement) { const c = p.getAttribute("data-help-ctx"); if (c) ctx.push(c); }
  const eachEl = el.parentElement?.closest("[data-help-each]");
  const dlg = el.closest("[role=dialog]");
  const titleId = dlg?.getAttribute("aria-labelledby");
  const dialog = String((titleId && document.getElementById(titleId)?.textContent) || dlg?.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
  return { labels: buttonHelpLabelsOf(el), help: el.getAttribute("data-help"), each: eachEl ? eachEl.getAttribute("data-help-each") : null, ctx, screen, dialog };
}

// موضع العلامة على الشاشة بإزاحتها (translate) كما رُسمت
function buttonBadgeRect(el) {
  if (document.documentElement.dataset.helpBadges !== "on") return null;
  const ps = getComputedStyle(el, el.classList.contains("ons-hero") ? "::before" : "::after");
  if (!/؟/.test(ps.content || "") || ps.display === "none") return null;
  const r = el.getBoundingClientRect(), bs = getComputedStyle(el), size = parseFloat(ps.height) || 0;
  if (!size || !r.width) return null;
  const m = /matrix\(([^)]+)\)/.exec(ps.transform || "");
  const [tx, ty] = m ? m[1].split(",").slice(4).map((v) => parseFloat(v) || 0) : [0, 0];
  const top = r.top + (parseFloat(bs.borderTopWidth) || 0) + (parseFloat(ps.top) || 0) + ty;
  const left = (bs.direction === "rtl" ? r.left + (parseFloat(bs.borderLeftWidth) || 0) + (parseFloat(ps.left) || 0)
    : r.right - (parseFloat(bs.borderRightWidth) || 0) - (parseFloat(ps.right) || 0) - size) + tx;
  return { left, top, width: size, height: size };
}

// الشرح لدائرة العلامة وحدها (وهامش 3px للإصبع)، وأكثرها فوق حافّة الزرّ،
// فالضغط على الزرّ نفسه يُنفّذه ولو قرب حافّته. وفي الزرّ الصغير (كـ«إزالة» النصّي) تبلغ الدائرة وسطه،
// فالضغطة الأقرب إلى وسط الزرّ منها إلى وسط العلامة للزرّ — وإلا صار زرٌّ لا يُضغط أبدًا
function buttonBadgeHit(el, x, y) {
  const b = buttonBadgeRect(el);
  if (!b) return false;
  const dBadge = Math.hypot(x - (b.left + b.width / 2), y - (b.top + b.height / 2));
  if (dBadge > b.width / 2 + 3) return false;
  const r = el.getBoundingClientRect();
  const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  return !inside || dBadge < Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
}

// يفتح الشرح بدل تنفيذ الزر: ضغطة على «؟»، أو ضغط مطوّل، أو F1 على زر مركَّز.
// المستمعات في طور الالتقاط على المستند كي تسبق جذر React. getCtx() يعيد { screen, isHq, open(topic) }.
// الزر ذو الضغط المطوّل الخاص يُعلَّم data-own-press فلا يُزاحَم
function installButtonHelp(getCtx) {
  if (typeof document === "undefined") return () => {};
  if (typeof window !== "undefined" && window.__onsButtonHelpOff) window.__onsButtonHelpOff();
  let armed = null, fired = null, hold = null, swallow = 0;
  const fresh = (m, ms) => m && Date.now() - m.at < ms;
  const btnOf = (e) => { const el = e.target?.closest?.(BTN_HELP_SEL); return el && buttonHelpEligible(el) ? el : null; };
  const open = (el) => { const c = getCtx() || {}, info = buttonHelpInfoOf(el, c); c.open?.({ ...resolveButtonHelp(info), dialog: info.dialog }); };
  const stop = (e, prevent = true) => { if (prevent && e.cancelable) e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
  const endHold = () => { if (hold) clearTimeout(hold.t); hold = null; };
  const onDown = (e) => {
    endHold();
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = btnOf(e);
    if (!el) { armed = null; return; }
    if (buttonBadgeHit(el, e.clientX, e.clientY)) { armed = { el, at: Date.now() }; stop(e); return; }
    armed = null;
    if (el.closest("[data-own-press]")) return;
    hold = { el, x: e.clientX, y: e.clientY, t: setTimeout(() => { hold = null; fired = { el, at: Date.now() }; try { navigator.vibrate?.(12); } catch { /* لا اهتزاز */ } open(el); }, e.pointerType === "mouse" ? 800 : 600) };
  };
  const onMove = (e) => { if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) endHold(); };
  const mine = (e, m, ms) => fresh(m, ms) && e.target?.closest?.(BTN_HELP_SEL) === m.el;
  const onUp = (e) => {
    endHold();
    if (!mine(e, armed, 1500)) return;
    stop(e, e.type !== "touchend");
    // الزر المعطَّل لا يصله click، فالشرح عند رفع الإصبع وتُبتلع النقرة التالية كي لا تُغلق الورقة
    if (e.type === "pointerup" && armed.el.disabled) { const el = armed.el; armed = null; swallow = e.pointerType === "mouse" ? 0 : Date.now(); open(el); }
  };
  const onCompat = (e) => { if (mine(e, armed, 1500)) stop(e, e.type !== "touchstart"); };
  const onClick = (e) => {
    if (swallow && Date.now() - swallow < 700) { swallow = 0; stop(e); return; }
    swallow = 0;
    if (mine(e, armed, 1500)) { const el = armed.el; armed = null; stop(e); open(el); return; }
    armed = null;
    if (mine(e, fired, 2500)) { fired = null; stop(e); }
  };
  const onMenu = (e) => { if (fresh(fired, 2500) || hold) e.preventDefault(); };
  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !(e.key === "F1" || e.key === "?" || e.key === "؟")) return;
    const el = document.activeElement;
    if (el && el.matches?.(BTN_HELP_SEL) && buttonHelpEligible(el)) { stop(e); open(el); }
  };
  const on = [["pointerdown", onDown], ["pointermove", onMove], ["pointerup", onUp], ["pointercancel", onUp], ["touchend", onUp],
    ["mousedown", onCompat], ["mouseup", onCompat], ["touchstart", onCompat], ["click", onClick], ["contextmenu", onMenu], ["keydown", onKey]];
  on.forEach(([t, f]) => document.addEventListener(t, f, { capture: true, passive: t === "pointermove" }));
  const off = () => { endHold(); on.forEach(([t, f]) => document.removeEventListener(t, f, { capture: true })); if (typeof window !== "undefined" && window.__onsButtonHelpOff === off) delete window.__onsButtonHelpOff; };
  if (typeof window !== "undefined") window.__onsButtonHelpOff = off;
  return off;
}

export { BTN_HELP_SEL, buttonHelpKey, resolveButtonHelp, installButtonHelp };
