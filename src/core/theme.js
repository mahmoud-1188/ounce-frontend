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
  // ══ التصميم المُضيء (الثالث) — ضوءٌ حيّ يتحرّك خلف الشاشة، وحوافّ مضيئة، وألوانٌ متوهّجة لكل قسم،
  //    والرئيسية ترتّب المهامّ بأولويّتها الآن («الآن ← ثم ← الأقسام»). يرث تخطيط الحديث (`modern`)
  //    ويزيد عليه ما يخصّه بـ`data-design="radiant"` (أنماطه في tools/build-drop.cjs).
  radiantDay: {
    label: "مُضيء — نهاري",
    hint: "أبيض ناصع بضوءٍ ملوّن يتحرّك وحوافّ متوهّجة",
    modern: true, design: "radiant",
    swatch: ["#FFFFFF", "#FF8A00", "#8B3DFF"],
    vars: {
      bg: "#FFFFFF", panel: "#FFFFFF", line: "#EEF0F7", edge: "#E3E6F0",
      accent: "#E09A00", accentText: "#B47A00", accentSoft: "#F5B83A",
      accentLine: "#FFE3A3", accentBg: "#FFF6DC",
      gradFrom: "#FFC83D", gradTo: "#FF8A00",
      text: "#141A33", text2: "#4F5878", text3: "#727A99",
      good: "#00A86B", goodSolid: "#00B377", goodBg: "#E6FAF2", goodLine: "#B5EED8",
      bad: "#E82A48", badBg: "#FFEEF1", badLine: "#FFC6CF", badLine2: "#FF9AAA",
      veil: "rgba(20,26,51,0.40)",
      field: "#F4F5FB",
      cardRadius: "22px", cardBorder: "1px solid rgba(110,120,200,.12)",
      cardShadow: "0 1px 2px rgba(20,26,51,.05), 0 16px 34px -18px rgba(90,80,220,.30)",
      navBg: "rgba(255,255,255,.78)", navBorder: "1px solid rgba(110,120,200,.16)", navRadius: "26px",
      navMargin: "0 10px 10px", navShadow: "0 16px 36px -14px rgba(255,150,0,.38), 0 8px 24px -12px rgba(90,80,220,.30)", navBlur: "saturate(1.8) blur(18px)",
      aurora1: "rgba(255,190,60,.46)", aurora2: "rgba(130,110,255,.34)", aurora3: "rgba(0,200,220,.30)", glow: "rgba(255,160,0,.45)",
      ...toneVars({
        sales: ["#E09A00", "#FFF3D0"], inventory: ["#2F6BFF", "#E8EFFF"], purchasing: ["#8B3DFF", "#F2E9FF"],
        money: ["#00A86B", "#E2F8EE"], people: ["#F02D8A", "#FFE8F3"], reports: ["#0096C7", "#E0F6FD"],
        accounting: ["#5B4BFF", "#ECEBFF"], central: ["#FF6A00", "#FFEEDF"], links: ["#00A896", "#DDF7F3"],
        system: ["#56627E", "#EEF1F7"],
      }),
    },
  },
  radiantNight: {
    label: "مُضيء — ليلي",
    hint: "ليلٌ عميق بألوان نيون وضوءٍ ذهبيّ يتوهّج",
    modern: true, design: "radiant",
    swatch: ["#090A12", "#FFC940", "#5B9DFF"],
    vars: {
      bg: "#090A12", panel: "#141626", line: "#232641", edge: "#2E3252",
      accent: "#FFC940", accentText: "#FFD466", accentSoft: "#E8B64A",
      accentLine: "#5A4A1E", accentBg: "#2A2410",
      gradFrom: "#FFD95A", gradTo: "#FF9F1C",
      text: "#F5F6FF", text2: "#AAB0D0", text3: "#8088AA",
      good: "#3DF5A0", goodSolid: "#1FD68A", goodBg: "#0E2A20", goodLine: "#1B5540",
      bad: "#FF6B81", badBg: "#2E1119", badLine: "#5A2230", badLine2: "#8A2E44",
      veil: "rgba(3,4,10,0.74)",
      field: "#1B1E33",
      cardRadius: "22px", cardBorder: "1px solid rgba(150,160,255,.16)",
      cardShadow: "0 1px 0 rgba(255,255,255,.04) inset, 0 18px 40px -20px rgba(0,0,0,.9), 0 0 30px -14px rgba(120,110,255,.45)",
      navBg: "rgba(18,20,34,.74)", navBorder: "1px solid rgba(160,170,255,.18)", navRadius: "26px",
      navMargin: "0 10px 10px", navShadow: "0 0 30px -8px rgba(255,201,64,.38), 0 18px 40px -14px rgba(0,0,0,.9)", navBlur: "saturate(1.6) blur(18px)",
      aurora1: "rgba(255,170,40,.30)", aurora2: "rgba(110,90,255,.34)", aurora3: "rgba(0,210,200,.24)", glow: "rgba(255,201,64,.55)",
      ...toneVars({
        sales: ["#FFC940", "#2B2410"], inventory: ["#5B9DFF", "#101D3A"], purchasing: ["#B98CFF", "#22173D"],
        money: ["#3DF5A0", "#0C2A1F"], people: ["#FF7AC6", "#33142A"], reports: ["#3FE0FF", "#0C2733"],
        accounting: ["#9E9BFF", "#1A1A40"], central: ["#FF9A4D", "#33190C"], links: ["#2EF2D8", "#0A2A28"],
        system: ["#B6C0DA", "#1D2233"],
      }),
    },
  },
  // ══ التصميم البسيط (الرابع) — صفحةٌ واحدة: أسعار العيارات، ثم أهمّ الأزرار كبيرةً وداخل كلٍّ ملحقاته،
  //    بلا شريطٍ سفلي، والإعدادات في زرّ القائمة أعلى الشاشة. ألوانٌ فاتحة دافئة مريحة للعين طول اليوم.
  simpleLight: {
    label: "بسيط — فاتح",
    hint: "عاجيٌّ دافئ وألوانٌ هادئة",
    modern: true, design: "simple",
    swatch: ["#FAF7F1", "#C9A24E", "#4A78B8"],
    vars: {
      bg: "#FAF7F1", panel: "#FFFFFF", line: "#EFE9DD", edge: "#E6DECF",
      accent: "#B58A2E", accentText: "#8F6A1E", accentSoft: "#D2B26B",
      accentLine: "#EBDDBB", accentBg: "#FBF3E2",
      gradFrom: "#E9CF8E", gradTo: "#CFA851",
      text: "#2B2A26", text2: "#625D52", text3: "#827C6E",
      good: "#3E8E5E", goodSolid: "#43A06A", goodBg: "#EEF7F0", goodLine: "#CFE8D7",
      bad: "#B9523B", badBg: "#FBEFEA", badLine: "#F0D1C6", badLine2: "#E4AE9E",
      veil: "rgba(43,42,38,0.35)",
      field: "#F5F1E8",
      cardRadius: "22px", cardBorder: "1px solid #EFE7D6",
      cardShadow: "0 1px 2px rgba(60,50,30,.05), 0 10px 26px -16px rgba(60,50,30,.22)",
      navBg: "rgba(255,255,255,.9)", navBorder: "1px solid #EFE7D6", navRadius: "24px",
      navMargin: "0 10px 10px", navShadow: "0 10px 28px -14px rgba(60,50,30,.3)", navBlur: "saturate(1.4) blur(14px)",
      ...toneVars({
        sales: ["#A8761A", "#FBF0D9"], inventory: ["#4072B0", "#EAF1FA"], purchasing: ["#825BB0", "#F2ECF9"],
        money: ["#3A8659", "#E9F5EC"], people: ["#B0557F", "#F9ECF2"], reports: ["#35879B", "#E6F3F6"],
        accounting: ["#565CA8", "#EDEEF8"], central: ["#B8642F", "#FBEEE4"], links: ["#338C80", "#E5F4F2"],
        system: ["#646C7E", "#EFF1F4"],
      }),
    },
  },
  simpleDark: {
    label: "بسيط — داكن",
    hint: "فحميٌّ دافئ لإضاءة المحل",
    modern: true, design: "simple",
    swatch: ["#1B1A17", "#D9B566", "#8FB3E0"],
    vars: {
      bg: "#1B1A17", panel: "#25231F", line: "#322F29", edge: "#3C3831",
      accent: "#D9B566", accentText: "#E4C47D", accentSoft: "#BFA05A",
      accentLine: "#4D4230", accentBg: "#2E2A20",
      gradFrom: "#E6C77E", gradTo: "#BF9848",
      text: "#F1ECE2", text2: "#B5AD9E", text3: "#8F887A",
      good: "#7CCB98", goodSolid: "#5DB980", goodBg: "#1E2C23", goodLine: "#2F4A38",
      bad: "#E38B76", badBg: "#2E1F1B", badLine: "#4D302A", badLine2: "#6E3F35",
      veil: "rgba(0,0,0,0.6)",
      field: "#2C2A25",
      cardRadius: "22px", cardBorder: "1px solid #332F28",
      cardShadow: "0 1px 0 rgba(255,255,255,.03) inset, 0 12px 28px -16px rgba(0,0,0,.7)",
      navBg: "rgba(37,35,31,.9)", navBorder: "1px solid #332F28", navRadius: "24px",
      navMargin: "0 10px 10px", navShadow: "0 12px 30px -12px rgba(0,0,0,.7)", navBlur: "saturate(1.3) blur(14px)",
      ...toneVars({
        sales: ["#E0B962", "#332B19"], inventory: ["#8FB3E0", "#1F2A38"], purchasing: ["#B9A0DC", "#2A2336"],
        money: ["#8ACB9F", "#1E2F24"], people: ["#E09BBB", "#35222C"], reports: ["#86C6D6", "#1C2E33"],
        accounting: ["#A5A9E0", "#252739"], central: ["#E5A276", "#36271D"], links: ["#86CFC4", "#1C302D"],
        system: ["#B7BDC9", "#2A2C31"],
      }),
    },
  },
};

/// التصاميم المعتمدة، ولكلٍّ فاتحٌ وداكن — التبديل بينها يحفظ الإضاءة: الداكن يبقى داكنًا.
const THEME_DESIGNS = {
  simple: { label: "البسيط", hint: "صفحةٌ واحدة — أهمّ الأزرار كبيرة وداخل كلٍّ ملحقاته · بلا شريطٍ سفلي", dark: "simpleDark", light: "simpleLight", isNew: true },
  radiant: { label: "المُضيء", hint: "ضوءٌ حيّ وألوانٌ متوهّجة — والرئيسية ترتّب مهامّك بأولويّتها الآن", dark: "radiantNight", light: "radiantDay", isNew: true },
  modern: { label: "الحديث", hint: "أنظف وأوسع · وصولٌ سريع · شريطٌ عائم", dark: "modernDark", light: "modernLight" },
  classic: { label: "الكلاسيكي", hint: "التصميم الأصلي كما اعتدته", dark: "gold", light: "teal" },
};
const designOfTheme = (id) => THEMES[id]?.design || (THEMES[id]?.modern ? "modern" : "classic");

// المرجع (قرار المالك 2026-09-27): «البسيط الداكن» هو ما يُفتح به الفرع والإدارة ما لم يختر المستخدم غيره (themePicked)
const DEFAULT_THEME = "simpleDark";

/// السمة المعروضة: ما اختاره المستخدم بنفسه (`themePicked`)، وإلا الافتراضي.
/// ⚠ الإعدادات القديمة تحمل `theme: "gold"` لأنه كان الافتراضي لا لأن أحدًا اختاره.
const effectiveTheme = (settings) => (settings?.themePicked && THEMES[settings.theme] ? settings.theme : DEFAULT_THEME);
const isDarkTheme = (id) => id === "gold" || id === "modernDark" || id === "radiantNight" || id === "simpleDark";
const isModernUi = () => typeof document !== "undefined" && document.documentElement.getAttribute("data-ui") === "modern";
/// المُضيء يرث الحديث (isModernUi صادقٌ فيه) ويزيد «الآن» والممرّات والضوء
const isRadiantUi = () => typeof document !== "undefined" && document.documentElement.getAttribute("data-design") === "radiant";
/// البسيط: صفحةٌ واحدة بأزرارٍ كبيرة تحمل ملحقاتها، ولا شريط سفليّ
const isSimpleUi = () => typeof document !== "undefined" && document.documentElement.getAttribute("data-design") === "simple";

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
  root.setAttribute("data-design", designOfTheme(THEMES[id] ? id : DEFAULT_THEME));
  document.body.style.background = t.vars.bg;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.vars.bg);
}


// ⚠ حُذف نظام المقاسات مع عودة الشكل الأصلي: عمودٌ واحد بعرض
// الجوال على كل الأجهزة. المناطق الآمنة وحدها بقيت — شريط الإيماءة
// على الآيفون يقع فوق الأزرار مهما كان الشكل.

export { DEFAULT_THEME, THEMES, THEME_DESIGNS, applyTheme, designOfTheme, effectiveTheme, isDarkTheme, isModernUi, isRadiantUi, isSimpleUi, toneVars };
