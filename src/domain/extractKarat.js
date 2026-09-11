import { PURITY } from "../core/money.js";
import { normAr } from "./normAr.js";

function extractKarat(text) {
  const t = normAr(text);
  const m = t.match(/عيار\s*(\d{2})/);
  if (m) {
    const k = Number(m[1]);
    if (PURITY[k]) return k;
  }
  for (const k of [24, 22, 21, 18, 14]) {
    if (new RegExp(`\\b${k}\\b`).test(t)) return k;
  }
  const spoken = {
    "اربعه وعشرين": 24, "اربع وعشرين": 24,
    "اثنين وعشرين": 22, "ثنين وعشرين": 22,
    "واحد وعشرين": 21, "احد وعشرين": 21,
    "ثمانيه عشر": 18, "ثمنطعش": 18,
    "اربعه عشر": 14, "اربعطعش": 14,
  };
  for (const [w, k] of Object.entries(spoken)) if (t.includes(w)) return k;
  return null;
}

/// ── جدول الأوامر ──
///
/// `safe: true` يعني التنفيذ الفوري — لا يمسّ مالًا ولا مخزونًا.

export { extractKarat };
