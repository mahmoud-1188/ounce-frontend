path = "helpers.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = '''      const arVoice = window.speechSynthesis.getVoices().find((v) => (v.lang || "").toLowerCase().startsWith("ar"));

      let cancelled = false;
      const speakNext = (idx) => {
        if (cancelled || idx >= sentences.length) {
          setSpeakingId((cur) => (cur === id ? null : cur));
          return;
        }
        const u = new SpeechSynthesisUtterance(sentences[idx]);
        u.lang = locale;
        u.rate = 0.95; // أبطأ قليلًا: النطق الافتراضي للعربية سريع ويصعب متابعته
        u.pitch = 1;
        if (arVoice) u.voice = arVoice;
        u.onend = () => speakNext(idx + 1);
        u.onerror = () => speakNext(idx + 1);
        window.speechSynthesis.speak(u);
      };'''

new = '''      const allVoices = window.speechSynthesis.getVoices();
      const arVoice = allVoices.find((v) => (v.lang || "").toLowerCase().startsWith("ar"));
      console.log("[TTS DEBUG] original text length:", text.length);
      console.log("[TTS DEBUG] cleaned text:", JSON.stringify(cleaned));
      console.log("[TTS DEBUG] sentences count:", sentences.length, sentences);
      console.log("[TTS DEBUG] available voices:", allVoices.map((v) => v.name + " | " + v.lang));
      console.log("[TTS DEBUG] chosen arVoice:", arVoice ? arVoice.name + " | " + arVoice.lang : "NONE (using browser default)");

      let cancelled = false;
      const speakNext = (idx) => {
        console.log("[TTS DEBUG] speakNext called, idx=", idx, "cancelled=", cancelled, "total=", sentences.length);
        if (cancelled || idx >= sentences.length) {
          console.log("[TTS DEBUG] stopping chain at idx=", idx);
          setSpeakingId((cur) => (cur === id ? null : cur));
          return;
        }
        const u = new SpeechSynthesisUtterance(sentences[idx]);
        u.lang = locale;
        u.rate = 0.95; // أبطأ قليلًا: النطق الافتراضي للعربية سريع ويصعب متابعته
        u.pitch = 1;
        if (arVoice) u.voice = arVoice;
        u.onstart = () => console.log("[TTS DEBUG] onstart idx=", idx, "text=", JSON.stringify(sentences[idx]));
        u.onend = () => { console.log("[TTS DEBUG] onend idx=", idx); speakNext(idx + 1); };
        u.onerror = (ev) => { console.log("[TTS DEBUG] onerror idx=", idx, "error=", ev.error); speakNext(idx + 1); };
        u.onboundary = (ev) => console.log("[TTS DEBUG] onboundary idx=", idx, "charIndex=", ev.charIndex, "name=", ev.name);
        window.speechSynthesis.speak(u);
        console.log("[TTS DEBUG] speak() called for idx=", idx, "pending=", window.speechSynthesis.pending, "speaking=", window.speechSynthesis.speaking);
      };'''

assert content.count(old) == 1, "count=" + str(content.count(old))
content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("OK")
