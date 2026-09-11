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
};

const DEFAULT_THEME = "gold";

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
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
  root.setAttribute("data-theme", id);
  document.body.style.background = t.vars.bg;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.vars.bg);
}


// ⚠ حُذف نظام المقاسات مع عودة الشكل الأصلي: عمودٌ واحد بعرض
// الجوال على كل الأجهزة. المناطق الآمنة وحدها بقيت — شريط الإيماءة
// على الآيفون يقع فوق الأزرار مهما كان الشكل.

export { DEFAULT_THEME, THEMES, applyTheme };
