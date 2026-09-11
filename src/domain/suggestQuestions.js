import { AI_INTENTS } from "../core/assistant.js";
import { closeAr } from "./closeAr.js";
import { key } from "./key.js";
import { tokensAr } from "./tokensAr.js";

function suggestQuestions(text, limit = 3) {
  const toks = tokensAr(text);
  const scored = AI_INTENTS.map((it) => {
    const iw = [...it.words.map(key), ...tokensAr(it.q)];
    let s = 0;
    toks.forEach((t) => {
      iw.forEach((w) => {
        if (t === w) s += 3;
        else if (t.length > 2 && (w.includes(t) || t.includes(w))) s += 2;
        // ⚠ الخطأ الإملائي شائع: «مخزن» مقابل «مخزون» حرف واحد فرقًا.
        // بلا هذا يرى البائع اقتراحات لا صلة لها بسؤاله.
        else if (t.length >= 3 && w.length >= 3 && closeAr(t, w)) s += 1;
      });
    });
    return { q: it.q, id: it.id, s };
  });
  const hits = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  // بلا تشابه إطلاقًا: نعرض الأكثر استخدامًا بدل لا شيء
  return (hits.length ? hits : scored.slice(0, limit).map((x) => ({ ...x, s: 0 })))
    .slice(0, limit)
    .map((x) => x.q);
}


// ═══════════════════════════════════════════════════════════════════════
//  الأوامر الصوتية
//
//  البائع يداه مشغولتان: ميزان في يد وقطعة في الأخرى. الصوت يوفّر عليه
//  وضع القطعة ليضغط شاشة.
//
//  ⚠ لكن التعرّف على الكلام يُخطئ، والخطأ هنا في المال لا في نصّ.
//  «بعشرة آلاف» و«بعشرين ألف» متقاربتان صوتيًا، وتنفيذ الخطأ صامتًا
//  يُنشئ فاتورة بمبلغ لم يُقصد.
//
//  فالقاعدة: **الأمر الذي يحرّك مالًا أو مخزونًا لا يُنفَّذ إلا بتأكيد.**
//  والتنقّل يُنفَّذ فورًا لأن أسوأ ما فيه صفحة خاطئة تُغلق بضغطة.
// ═══════════════════════════════════════════════════════════════════════

/// الأرقام المنطوقة عربيةً — التعرّف يعيدها كلمات لا أرقامًا أحيانًا.

export { suggestQuestions };
