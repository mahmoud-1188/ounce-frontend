import { VOICE_COMMANDS } from "../core/assistant.js";
import { extractKarat } from "./extractKarat.js";
import { extractNumber } from "./extractNumber.js";
import { matchIntent } from "./matchIntent.js";
import { normAr } from "./normAr.js";
import { parseShortcutRequest } from "./parseShortcutRequest.js";
import { stemAr } from "./stemAr.js";
import { suggestVoice } from "./suggestVoice.js";
import { tokensAr } from "./tokensAr.js";

function parseVoiceCommand(text, allowedPages) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const toks = tokensAr(raw);
  const hit = (w) => {
    const k = stemAr(normAr(w));
    return toks.some((t) => t === k || t.includes(k) || k.includes(t));
  };

  // ⚠ السؤال يسبق كل شيء: «كم بعت اليوم» استعلام لا أمر بيع، و«بعت»
  // فيها تخدع مطابقة العمليات.
  // ⚠ \b في JavaScript يعتمد على ASCII: «كم\b» لا تُطابق العربية أبدًا
  // لأن الميم ليست حرفًا في نظره. نستخدم فراغًا أو نهاية النصّ.
  const isQuestion = /^(كم|وش|ايش|ما|هل|من|متي|اين)(?=\s|$)/.test(normAr(raw));
  if (isQuestion) {
    const q = matchIntent(raw);
    if (q) return { kind: "ask", intentId: q.id, question: raw, spoken: raw, needsConfirm: false };
  }

  // ⚠ فعل التنقّل مع صفحة معروفة يسبق العمليات: «ودّني للمبيعات» تنقّل،
  // و«مبيعات» تحوي «بيع» فتخدع مطابقة فتح الفاتورة.
  const navVerb = ["افتح", "روح", "ودني", "اعرض", "شوف", "انتقل"].some(hit);
  const pageEarly = parseShortcutRequest(raw, allowedPages);
  const actionWord = ["فاتوره", "سجل", "استلم", "اقفل", "اصرف"].some(hit);
  if (navVerb && pageEarly && !actionWord) {
    return { kind: "nav", pageId: pageEarly.pageId, label: pageEarly.label, spoken: raw, needsConfirm: false };
  }

  // ① عملية
  for (const c of VOICE_COMMANDS.filter((x) => x.kind === "action")) {
    if (!(c.must || []).some(hit)) continue;
    const params = {};
    if (c.slot === "amount") params.amount = extractNumber(raw);
    if (c.slot === "karat") params.karat = extractKarat(raw);
    return {
      kind: "action", id: c.id, action: c.action, label: c.label,
      params, spoken: raw, needsConfirm: true,
    };
  }

  // ② تنقّل — نستخدم مطابق الاختصارات نفسه
  const page = parseShortcutRequest(raw, allowedPages);
  if (page && VOICE_COMMANDS[0].words.some(hit)) {
    return { kind: "nav", pageId: page.pageId, label: page.label, spoken: raw, needsConfirm: false };
  }

  // ③ استعلام
  const intent = matchIntent(raw);
  if (intent) return { kind: "ask", intentId: intent.id, question: raw, spoken: raw, needsConfirm: false };

  // ④ تنقّل بلا فعل صريح: «المخزون»
  if (page) return { kind: "nav", pageId: page.pageId, label: page.label, spoken: raw, needsConfirm: false };

  return { kind: "unknown", spoken: raw, suggestions: suggestVoice(raw) };
}

/// أمثلة قريبة حين لا نفهم — الصوت أصعب من الكتابة فالاقتراح أهمّ.

export { parseVoiceCommand };
