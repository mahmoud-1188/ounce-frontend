// واجهة إنجليزية اختيارية: مترجمٌ حيّ يستبدل النصوص العربية على الشاشة من قاموس public/en.json
// اللغة تفضيلٌ للجهاز (localStorage) فتسري من شاشة الدخول قبل تحميل إعدادات الفرع

const UI_LANGS = { ar: { label: "العربية", dir: "rtl" }, en: { label: "English", dir: "ltr" } };
const DEFAULT_UI_LANG = "ar";
const UI_LANG_KEY = "ounce_ui_lang_v1";

const I18N_ATTRS = ["placeholder", "title", "aria-label", "alt"];
const I18N_AR = /[؀-ۿ]/;
const I18N_NUM = /[0-9٠-٩][0-9٠-٩,.:٪%/-]*/g;
const I18N_SEP = /( · | — | – | \| |: |، |؛ | \(|\) |«|»|\n| ← | → )/;

const i18nKey = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

// ترجمة نصٍّ واحد: مطابقةٌ حرفية، ثم قالبٌ بالأرقام (# في القاموس)، ثم قالبٌ بأيّ قيمة، ثم أجزاءٌ بين الفواصل الشائعة
function translateText(dict, text, depth = 0) {
  const key = i18nKey(text);
  if (!key || !I18N_AR.test(key) || !dict) return null;
  const hit = dict[key];
  if (typeof hit === "string") return hit;
  const nums = key.match(I18N_NUM);
  if (nums) {
    const tpl = dict[key.replace(I18N_NUM, "#").replace(/\s+/g, " ").trim()];
    if (typeof tpl === "string") { let i = 0; return tpl.replace(/#/g, () => (i < nums.length ? nums[i++] : "#")); }
  }
  const byTpl = i18nTemplates(dict).match(key);
  if (byTpl != null) return byTpl;
  // رقمٌ أو علامةٌ قبل النصّ أو بعده («500 ر.س» · «عيار 21» · «(3)») — يُترجم اللبّ ويبقى ما حوله
  const edge = key.match(/^([\d\u0660-\u0669,.:%٪()\s\-–]*)(.*?)([\d\u0660-\u0669,.:%٪()\s\-–]*)$/);
  if (edge && (edge[1] || edge[3]) && edge[2] && I18N_AR.test(edge[2])) {
    const core = dict[edge[2]];
    if (typeof core === "string") return edge[1] + core + edge[3];
  }
  // فاصلةٌ أو سهمٌ في طرف النصّ («· حساب 1170» · «التقرير الكامل ›» · «+ مكتب جديد») — يُترجم ما بينهما ويبقى الطرفان
  const bul = key.match(/^([·•—–+↑↓⤴›‹»«)(.\s]*)(.*?)([·•—–›‹»«)(.\s]*)$/);
  if (bul && (bul[1] || bul[3]) && bul[2] && bul[2] !== key && I18N_AR.test(bul[2])) {
    const core = translateText(dict, bul[2], Math.max(depth, 1));
    if (core != null) return bul[1] + core + bul[3];
  }
  if (depth > 1) return null;
  const parts = key.split(I18N_SEP);
  if (parts.length < 3) return null;
  let any = false;
  const out = parts.map((p, i) => {
    if (i % 2) return p;
    const t = p.trim();
    if (!t || !I18N_AR.test(t)) return p;
    const r = translateText(dict, t, depth + 1);
    if (r == null) return null;
    any = true;
    return p.replace(t, r);
  });
  return any && !out.includes(null) ? out.join("") : null;
}

// قوالب القاموس التي فيها # تُجمَّع مرّةً (أطولها أوّلًا) وتُطابَق بتعبيرٍ منتظم، والنتائج تُحفظ
function i18nTemplates(dict) {
  if (dict.__tpl) return dict.__tpl;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rows = Object.keys(dict).filter((k) => k.includes("#") && k !== "__tpl").sort((a, b) => b.length - a.length)
    .map((k) => ({ re: new RegExp("^" + k.split("#").map(esc).join("(.+?)") + "$"), en: dict[k] }));
  const cache = new Map();
  const match = (key) => {
    if (cache.has(key)) return cache.get(key);
    let out = null;
    for (const r of rows) {
      const m = key.match(r.re);
      if (!m) continue;
      // القيمة الملتقَطة تُترجم إن كانت نصًّا من الواجهة («يومية النقدية · فلان · تسليم الصندوق» → الاسم يبقى والبيان يُترجم)
      let i = 1; out = r.en.replace(/#/g, () => { if (i >= m.length) return "#"; const v = m[i++]; const t = I18N_AR.test(v) ? translateText(dict, v, 2) : null; return t == null ? v : t; });
      break;
    }
    if (cache.size > 4000) cache.clear();
    cache.set(key, out);
    return out;
  };
  Object.defineProperty(dict, "__tpl", { value: { match, count: rows.length }, enumerable: false });
  return dict.__tpl;
}

// المترجم الحيّ: يمشي على الشاشة مرّةً عند التفعيل ثم يراقب ما يُضاف أو يتغيّر. ما كتبه يُعلَّم كي لا يُترجَم ثانيةً،
// وعند الإطفاء يعيد الأصل العربي إلى كل عقدةٍ ما زالت على الشاشة (React يعيد ما سواها عند رسمه التالي).
const englishUi = (() => {
  let dict = null, loading = null, observer = null, active = false;
  const marks = new WeakMap();  // عقدة ← { text, orig } للنصوص أو { attrs: { اسم: { v, orig } } } للوسوم
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|NOSCRIPT|PRE)$/;
  const skipped = (el) => !el || SKIP.test(el.nodeName) || !!el.closest?.("[translate=no],[data-i18n-skip]");
  const load = () => {
    if (dict) return Promise.resolve(dict);
    if (!loading) loading = fetch((import.meta.env?.BASE_URL || "/") + "en.json").then((r) => (r.ok ? r.json() : {}))
      .then((d) => { dict = d && typeof d === "object" ? d : {}; return dict; }).catch(() => { dict = {}; return dict; });
    return loading;
  };
  const textNode = (n) => {
    if (skipped(n.parentNode)) return;
    const m = marks.get(n);
    if (m && m.text === n.nodeValue) return;
    const r = translateText(dict, n.nodeValue);
    if (r == null) return;
    const raw = n.nodeValue, v = raw.match(/^\s*/)[0] + r + raw.match(/\s*$/)[0];
    marks.set(n, { text: v, orig: raw });
    n.nodeValue = v;
  };
  const elAttrs = (el) => {
    if (skipped(el)) return;
    for (const a of I18N_ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const cur = el.getAttribute(a), m = marks.get(el) || { attrs: {} };
      if (m.attrs[a] && m.attrs[a].v === cur) continue;
      const r = translateText(dict, cur);
      if (r == null) continue;
      m.attrs[a] = { v: r, orig: cur };
      marks.set(el, m);
      el.setAttribute(a, r);
    }
  };
  const walk = (root) => {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) elAttrs(root);
    const it = document.createTreeWalker(root, 5);
    let n;
    while ((n = it.nextNode())) { if (n.nodeType === 3) textNode(n); else elAttrs(n); }
  };
  const start = async () => {
    await load();
    if (!active) {
      active = true;
      observer = new MutationObserver((recs) => {
        if (!active) return;
        for (const r of recs) {
          if (r.type === "characterData") textNode(r.target);
          else if (r.type === "attributes") elAttrs(r.target);
          else r.addedNodes.forEach(walk);
        }
      });
      observer.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: I18N_ATTRS });
    }
    walk(document.body);
    const t = translateText(dict, document.title);
    if (t) { marks.set(document, { text: t, orig: document.title }); document.title = t; }
  };
  const stop = () => {
    if (!active) return;
    active = false;
    observer?.disconnect(); observer = null;
    const dt = marks.get(document);
    if (dt && document.title === dt.text) document.title = dt.orig;
    const it = document.createTreeWalker(document.body, 5);
    let n;
    while ((n = it.nextNode())) {
      const m = marks.get(n);
      if (!m) continue;
      if (n.nodeType === 3) { if (n.nodeValue === m.text) n.nodeValue = m.orig; }
      else for (const a of Object.keys(m.attrs || {})) if (n.getAttribute(a) === m.attrs[a].v) n.setAttribute(a, m.attrs[a].orig);
      marks.delete(n);
    }
  };
  return { start, stop, load, isActive: () => active, dict: () => dict };
})();

function readUiLang() {
  try { const v = localStorage.getItem(UI_LANG_KEY); return UI_LANGS[v] ? v : DEFAULT_UI_LANG; } catch { return DEFAULT_UI_LANG; }
}

// يضبط lang وdir على المستند وجذور الشاشة ويشغّل المترجم أو يطفئه
function applyUiLang(lang) {
  if (typeof document === "undefined") return;
  const id = UI_LANGS[lang] ? lang : DEFAULT_UI_LANG;
  const root = document.documentElement;
  root.setAttribute("lang", id);
  root.setAttribute("dir", UI_LANGS[id].dir);
  root.setAttribute("data-lang", id);
  document.querySelectorAll(".ons-root").forEach((el) => el.setAttribute("dir", UI_LANGS[id].dir));
  if (id === "en") englishUi.start(); else englishUi.stop();
}

function setUiLang(lang) {
  const id = UI_LANGS[lang] ? lang : DEFAULT_UI_LANG;
  try { localStorage.setItem(UI_LANG_KEY, id); } catch { /* تخزينٌ محجوب */ }
  applyUiLang(id);
  return id;
}

export { UI_LANGS, DEFAULT_UI_LANG, translateText, englishUi, applyUiLang, readUiLang, setUiLang };
