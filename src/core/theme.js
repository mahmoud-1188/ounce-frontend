/// ألوان الأقسام في التصميم الحديث: `{ sales: [لون, خلفية] }` ← `--tone-sales` و`--tone-sales-bg`.
/// الكلاسيكي بلا ألوان أقسام — `navTone` يرجع فيه إلى الذهبي (`--accent`).
const toneVars = (map) => Object.fromEntries(Object.entries(map).flatMap(([k, [fg, bg]]) => [[`tone-${k}`, fg], [`tone-${k}-bg`, bg]]));

const THEMES = {
  gold: {
    label: "ذهبي داكن",
    hint: "الأصل — لا يبهر العين في إضاءة المحل",
    swatch: ["#12100C", "#D4AF37", "#B8935B"],
    vars: {
      bg: "#12100C", panel: "#1A1712", line: "#2A241C", edge: "#3A332A",
      accent: "#D4AF37", accentText: "#D4AF37", accentSoft: "#B8935B",
      accentLine: "#4A3E27", accentBg: "#2A2419",
      gradFrom: "#E9C874", gradTo: "#A67C3D",
      text: "#EDE7DA", text2: "#8A8175", text3: "#6B6459",
      good: "#7A9471", goodSolid: "#7A9471", goodBg: "#1F2A1F", goodLine: "#34432F",
      bad: "#B3654F", badBg: "#2A1F1D", badLine: "#43302B", badLine2: "#6B3A32",
      veil: "rgba(0,0,0,0.72)",
    },
  },
  teal: {
    label: "فيروزي فاتح",
    hint: "أوضح تحت ضوء النهار وعلى الشاشات الباهتة",
    swatch: ["#F4FAFB", "#0E7490", "#3FB6C1"],
    vars: {
      bg: "#F4FAFB", panel: "#FFFFFF", line: "#EEF3F5", edge: "#E2EAED",
      accent: "#0E7490", accentText: "#12798A", accentSoft: "#3FB6C1",
      accentLine: "#CDE9ED", accentBg: "#E8F6F8",
      gradFrom: "#4FC3CE", gradTo: "#2FA1AD",
      text: "#334155", text2: "#64748B", text3: "#66788A",
      good: "#15803D", goodSolid: "#16A34A", goodBg: "#F0FDF4", goodLine: "#BBF7D0",
      bad: "#DC2626", badBg: "#FEF2F2", badLine: "#FECACA", badLine2: "#FCA5A5",
      veil: "rgba(15,23,42,0.45)",
    },
  },
  // ══ التصميم الحديث (معتمد) — بطاقاتٌ بلا أقفاص بظلٍّ ناعم، شريطٌ سفليّ عائم زجاجيّ،
  //    وصولٌ سريع في الرئيسية، والقائمة مربّعات. والكلاسيكي معتمدٌ كذلك: التبديل من الإعدادات ← شكل التطبيق.
  modernLight: {
    label: "حديث — فاتح",
    hint: "التصميم الجديد: خلفيةٌ بيضاء وألوانٌ حيّة لكل قسم",
    modern: true,
    swatch: ["#FAFAF8", "#B8860B", "#2563EB"],
    // قاعدة (قرار المالك 2026-09-27): الأبيض الحديث هو شكل التطبيق — خلفيةٌ أقرب للأبيض، وذهبٌ أنصع،
    //   ولكل قسمٍ لونُه (tone-*) فيُعرف القسم من لون أيقونته قبل قراءة اسمه.
    vars: {
      bg: "#FAFAF8", panel: "#FFFFFF", line: "#F0EEE9", edge: "#E7E3DB",
      accent: "#B8860B", accentText: "#9A6C08", accentSoft: "#D9A93A",
      accentLine: "#F1DFAF", accentBg: "#FFF6DF",
      gradFrom: "#E0A92E", gradTo: "#A8700C",
      text: "#161E2C", text2: "#526073", text3: "#778196",
      good: "#0E9F55", goodSolid: "#12A150", goodBg: "#EAFBF1", goodLine: "#BDEFD2",
      bad: "#DC3F24", badBg: "#FFF1EC", badLine: "#FBD0C2", badLine2: "#F5A68E",
      veil: "rgba(17,24,39,0.42)",
      field: "#F4F3EF",
      cardRadius: "20px", cardBorder: "1px solid rgba(17,24,39,.04)",
      cardShadow: "0 1px 2px rgba(17,24,39,.05), 0 12px 30px -16px rgba(17,24,39,.22)",
      navBg: "rgba(255,255,255,.88)", navBorder: "1px solid rgba(17,24,39,.06)", navRadius: "24px",
      navMargin: "0 10px 10px", navShadow: "0 14px 36px -12px rgba(17,24,39,.30)", navBlur: "saturate(1.8) blur(16px)",
      ...toneVars({
        sales: ["#B8860B", "#FFF3D1"], inventory: ["#2563EB", "#EAF1FF"], purchasing: ["#7C3AED", "#F3EDFF"],
        money: ["#059669", "#E5F8EF"], people: ["#DB2777", "#FDEDF5"], reports: ["#0891B2", "#E4F6FA"],
        accounting: ["#4F46E5", "#EDEEFF"], central: ["#EA580C", "#FFF0E6"], links: ["#0D9488", "#E3F6F3"],
        system: ["#475569", "#EEF2F6"],
      }),
    },
  },
  modernDark: {
    label: "حديث — داكن",
    hint: "التصميم الجديد بلونٍ داكنٍ هادئ لإضاءة المحل",
    modern: true,
    swatch: ["#0F1115", "#E2B659", "#F3F4F6"],
    vars: {
      bg: "#0F1115", panel: "#181B21", line: "#23272F", edge: "#2C313A",
      accent: "#E2B659", accentText: "#E7C06E", accentSoft: "#C9A45A",
      accentLine: "#4A3F28", accentBg: "#241F16",
      gradFrom: "#F0CD7A", gradTo: "#C2923A",
      text: "#F3F4F6", text2: "#A3A9B5", text3: "#7D8492",
      good: "#4ADE80", goodSolid: "#22C55E", goodBg: "#12251A", goodLine: "#1E4D2E",
      bad: "#F87171", badBg: "#2A1515", badLine: "#4C2323", badLine2: "#7A2E2E",
      veil: "rgba(0,0,0,0.7)",
      field: "#1F232A",
      cardRadius: "20px", cardBorder: "1px solid rgba(255,255,255,.04)",
      cardShadow: "0 1px 0 rgba(255,255,255,.03) inset, 0 12px 30px -16px rgba(0,0,0,.8)",
      navBg: "rgba(24,27,33,.82)", navBorder: "1px solid rgba(255,255,255,.06)", navRadius: "24px",
      navMargin: "0 10px 10px", navShadow: "0 14px 36px -12px rgba(0,0,0,.8)", navBlur: "saturate(1.4) blur(16px)",
      ...toneVars({
        sales: ["#F0C75E", "#2B2413"], inventory: ["#7AA7FF", "#16213A"], purchasing: ["#B79BFF", "#231B38"],
        money: ["#4ADE9A", "#11261C"], people: ["#F58BBF", "#2E1624"], reports: ["#5CD0EA", "#102830"],
        accounting: ["#9C98FF", "#1C1B38"], central: ["#FF9F66", "#2E1B10"], links: ["#4FD6C8", "#0F2826"],
        system: ["#A9B4C4", "#1E232B"],
      }),
    },
  },
};

// المرجع 5.2.0 (قرار المالك): الحديث الأبيض هو ما يُفتح به التطبيق
const DEFAULT_THEME = "modernLight";

/// السمة المعروضة: ما اختاره المستخدم بنفسه (`themePicked`)، وإلا الافتراضي.
/// ⚠ الإعدادات القديمة تحمل `theme: "gold"` لأنه كان الافتراضي لا لأن أحدًا اختاره.
const effectiveTheme = (settings) => (settings?.themePicked && THEMES[settings.theme] ? settings.theme : DEFAULT_THEME);
const isDarkTheme = (id) => id === "gold" || id === "modernDark";
const isModernUi = () => typeof document !== "undefined" && document.documentElement.getAttribute("data-ui") === "modern";

// ═══════════════════════════════════════════════════════════════════════
//  أوضاع التطبيق
//
//  ⚠ محلٌّ يريد المخزون وحده لا يحتاج شاشات البيع والصندوق والموردين.
//  وإخفاؤها ليس تجميلًا: كل شاشة زائدة بابٌ يُفتح ووقتٌ يُهدر في البحث،
//  ورقمٌ يظهر في تقرير لا يعني قارئه.
//
//  والوضع يُغيَّر من الإعدادات ولا يمسّ البيانات — من بدأ بالمخزون
//  ثم أراد البيع يجد كل شيء كما تركه.
// ═══════════════════════════════════════════════════════════════════════

function applyTheme(id) {
  if (typeof document === "undefined") return;
  const t = THEMES[id] || THEMES[DEFAULT_THEME];
  const root = document.documentElement;
  // متغيّرات التصميم الحديث تُمحى عند العودة للكلاسيكي — وإلا بقي ظلّ البطاقة وشكل الشريط
  new Set(Object.values(THEMES).flatMap((x) => Object.keys(x.vars)))
    .forEach((k) => { if (!(k in t.vars)) root.style.removeProperty(`--${k}`); });
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
  root.setAttribute("data-theme", THEMES[id] ? id : DEFAULT_THEME);
  root.setAttribute("data-ui", t.modern ? "modern" : "classic");
  document.body.style.background = t.vars.bg;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.vars.bg);
}


// ⚠ حُذف نظام المقاسات مع عودة الشكل الأصلي: عمودٌ واحد بعرض
// الجوال على كل الأجهزة. المناطق الآمنة وحدها بقيت — شريط الإيماءة
// على الآيفون يقع فوق الأزرار مهما كان الشكل.

export { DEFAULT_THEME, THEMES, applyTheme, effectiveTheme, isDarkTheme, isModernUi, toneVars };
