import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// المصدر المرجعي (ounce-source) يسمّي كل ملفاته .js حتى ما يحوي JSX —
// esbuild يحتاج تصريحًا صريحًا ليعامل .js كـ JSX، وإلا فشل التحليل.
// ⚠ __EDITION__: يسمح ببناء نسختين (فرع/مركز) من نفس المصدر بدون تفريع
// الكود — نفس الفكرة الموجودة عند العميل، لكن هنا كمتغيّر Vite عادي بدل
// أداة بناء منفصلة، لأن هذا المشروع بيتصلح ويُطوَّر يدويًا وليس مولَّدًا
// من ملف واحد ضخم. القيمة تُقرأ من OQIYYAH_EDITION وقت البناء، وتساوي
// "branch" افتراضيًا حتى لا يتأثر أي أمر بناء حالي.
const EDITION = process.env.OQIYYAH_EDITION || "branch";

export default defineConfig({
  plugins: [react()],
  define: {
    __EDITION__: JSON.stringify(EDITION),
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    host: true,
  },
});
