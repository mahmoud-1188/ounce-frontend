import { AR_NUMBERS } from "../core/assistant.js";
import { normAr } from "./normAr.js";
import { stemAr } from "./stemAr.js";

function extractNumber(text) {
  // ⚠ نُطبّع بلا إزالة النقطة العشرية: normAr يُبدّلها فراغًا فتصير
  // «12.5» رقمين، ويؤخذ أولهما — نصف جرام يضيع.
  const t = normAr(String(text).replace(/(\d)[.,](\d)/g, "$1_$2")).replace(/_/g, ".");
  // الأرقام الصريحة أولًا — أدقّ
  const digits = t.match(/\d+(?:\.\d+)?/);
  if (digits) {
    const n = Number(digits[0].replace(",", "."));
    // «5 الاف» = 5000
    if (/\d+\s*(الاف|الف|اف)/.test(t)) return n * 1000;
    if (/\d+\s*(مايه|مئه|ميه)/.test(t)) return n * 100;
    return n;
  }
  const words = t.split(" ");
  let total = 0, cur = 0, found = false;
  words.forEach((w) => {
    const s = stemAr(w);
    const v = AR_NUMBERS[w] ?? AR_NUMBERS[s];
    if (v == null) return;
    found = true;
    // ⚠ «خمسة آلاف»: الخمسة تُضرب في ألف. بلا هذا تُقرأ خمسة وحدها.
    if (v === 1000) { cur = (cur || 1) * 1000; total += cur; cur = 0; }
    else if (v === 100) { cur = (cur || 1) * 100; }
    else cur += v;
  });
  total += cur;
  return found ? total : null;
}

/// العيار من الكلام: «عيار واحد وعشرين» أو «عيار 21».

export { extractNumber };
