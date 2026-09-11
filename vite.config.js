import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// المصدر المرجعي (ounce-source) يسمّي كل ملفاته .js حتى ما يحوي JSX —
// esbuild يحتاج تصريحًا صريحًا ليعامل .js كـ JSX، وإلا فشل التحليل.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    host: true,
  },
});
