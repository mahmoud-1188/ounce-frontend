# -*- coding: utf-8 -*-
path = "helpers.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

marker_start = '  const speak = (text, id = text) => {'
marker_end = '  const stopSpeaking = () => {'

start_idx = content.index(marker_start)
end_idx = content.index(marker_end, start_idx)

old_block = content[start_idx:end_idx]

new_block = '''  // getVoices() قد ترجع قائمة فارغة (أو ناقصة) عند أول استدعاء - تحميل
  // الأصوات في المتصفح (خصوصًا أصوات النظام SAPI المضافة حديثًا في
  // ويندوز) يتم بشكل غير متزامن. لو لم نجد صوتًا عربيًا من أول محاولة
  // ننتظر حدث voiceschanged (أو حتى 1.5 ثانية كحد أقصى احتياطًا لو لم
  // يُطلَق الحدث إطلاقًا) قبل الحكم فعليًا بعدم وجود صوت عربي.
  const getArabicVoiceAsync = () =>
    new Promise((resolve) => {
      const find = () =>
        window.speechSynthesis.getVoices().find((v) => (v.lang || "").toLowerCase().startsWith("ar"));
      const immediate = find();
      if (immediate) {
        resolve(immediate);
        return;
      }
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        window.speechSynthesis.removeEventListener("voiceschanged", onChange);
        resolve(v || null);
      };
      const onChange = () => finish(find());
      window.speechSynthesis.addEventListener("voiceschanged", onChange);
      setTimeout(() => finish(find()), 1500);
    });

  const speak = async (text, id = text) => {
    if (!ttsSupported || !text) return;
    try {
      window.speechSynthesis.cancel();

      const arVoice = await getArabicVoiceAsync();
      if (!arVoice) {
        setVoiceError("لا يوجد صوت عربي مثبَّت على هذا الجهاز/المتصفح - أضِف صوتًا عربيًا من إعدادات النظام لتفعيل القراءة الصوتية");
        setSpeakingId(null);
        return;
      }

      // تنظيف رموز Markdown قبل النطق: ردود الذكاء الاصطناعي قد تحوي
      // **تعريض** أو *تمييل* أو `كود` أو # عناوين - رموز لا معنى لها صوتيًا.
      const cleaned = text
        .replace(/\\*\\*(.*?)\\*\\*/g, "$1")
        .replace(/\\*(.*?)\\*/g, "$1")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/^#{1,6}\\s*/gm, "")
        .replace(/[*_`#]/g, "");

      // تقسيم النص لجمل قصيرة وتشغيلها كسلسلة utterances متتابعة
      // (بدل جملة واحدة ضخمة).
      const sentences = cleaned
        .split(/(?<=[.!؟?\\n])\\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (sentences.length === 0) return;

      let cancelled = false;
      const speakNext = (idx) => {
        if (cancelled || idx >= sentences.length) {
          setSpeakingId((cur) => (cur === id ? null : cur));
          return;
        }
        const u = new SpeechSynthesisUtterance(sentences[idx]);
        u.lang = locale;
        u.rate = 0.95; // أبطأ قليلًا
        u.pitch = 1;
        u.voice = arVoice;
        u.onend = () => speakNext(idx + 1);
        u.onerror = () => speakNext(idx + 1);
        window.speechSynthesis.speak(u);
      };
      speakStopRef.current = () => {
        cancelled = true;
      };
      setSpeakingId(id);
      speakNext(0);
    } catch (e) {
      console.error("tts failed", e);
      setSpeakingId(null);
    }
  };

'''

assert old_block.count("speak = (text, id = text)") == 1
content = content[:start_idx] + new_block + content[end_idx:]

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("OK, replaced block of length", len(old_block))
