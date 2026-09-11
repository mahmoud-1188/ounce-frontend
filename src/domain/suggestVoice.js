import { VOICE_COMMANDS } from "../core/assistant.js";
import { normAr } from "./normAr.js";
import { stemAr } from "./stemAr.js";
import { tokensAr } from "./tokensAr.js";

function suggestVoice(text) {
  const toks = tokensAr(text);
  const scored = VOICE_COMMANDS.map((c) => {
    const iw = [...c.words, ...tokensAr(c.say)].map((w) => stemAr(normAr(w)));
    let s = 0;
    toks.forEach((t) =>
      iw.forEach((w) => {
        if (t === w) s += 3;
        else if (t.length > 2 && (w.includes(t) || t.includes(w))) s += 1;
      })
    );
    return { say: c.say, s };
  });
  const hits = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  return (hits.length ? hits : scored).slice(0, 3).map((x) => x.say);
}

export { suggestVoice };
