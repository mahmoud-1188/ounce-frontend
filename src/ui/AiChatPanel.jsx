import React, { useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";
import { INDEX_KINDS } from "../core/assistant.js";
import { fmt, fmtW } from "../core/money.js";
import { fetchAiChatReply, inputStyle, useVoice } from "../domain/helpers.js";
import { matchIntent } from "../domain/matchIntent.js";
import { searchIndex } from "../domain/searchIndex.js";
import { AiLogoBadge } from "./AiLogoBadge.jsx";

function AiChatPanel({ role, contextText, onClose, seed = "", index = [], facts = null }) {
  // ⚠ إسناد الإجابة: نبحث في الفهرس بكلمات السؤال ونمرّر السجلات
  // المطابقة بمراجعها. المساعد بلا سجلات يُخمّن، وبها يستشهد بما
  // تستطيع فتحه بنفسك.
  const groundingFor = (question) => {
    const hits = searchIndex(index, question, { limit: 12 });
    if (!hits.length) return "";
    const lines = hits.map(
      (r) =>
        `${r.ref} | ${(INDEX_KINDS[r.kind] || {}).label || r.kind} | ${r.summary}` +
        (r.amount ? ` | ${fmt(r.amount, 2)}` : "") +
        (r.fine ? ` | ${fmtW(r.fine)} جم24` : "") +
        (r.date ? ` | ${String(r.date).slice(0, 10)}` : "")
    );
    return (
      "\n\nسجلات من قاعدة البيانات تخصّ السؤال — استشهد بمراجعها ولا تذكر رقمًا " +
      "ليس فيها:\n" + lines.join("\n")
    );
  };
  const [messages, setMessages] = useState([]); // [{role:'user'|'assistant', content}]
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const voice = useVoice("ar-SA");

  // ⚠ السؤال القادم من الورقة يُرسل فورًا.
  //
  // كان يُملأ في الحقل فقط، فيضغط البائع سؤالًا جاهزًا ولا يحدث شيء
  // ظاهر — يبدو أن الأسئلة «لا تعمل». وهي جاهزة أصلًا فلا حاجة لتعديلها.
  const seeded = useRef(false);
  useEffect(() => {
    if (seed && !seeded.current) {
      seeded.current = true;
      sendMessage(seed);
    }
  }, [seed]);

  const suggestions = [
    "كيف أسجل بيع جديد؟",
    "وش الفرق بين الخزنة وصندوق اليومي؟",
    "كيف أسوي جرد بالأقسام؟",
    "كم رصيد الصندوق الحالي؟",
  ];

  const sendMessage = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    // ── ① الإجابة المحلية أولًا ──
    //
    // أكثر ما يُسأل عنه أرقامٌ في الجهاز: كم بعت · كم بالصندوق · ما
    // حالة المخزون. إرسالها للشبكة يُبطئ ويفشل عند انقطاعها، والجواب
    // عندنا أصلًا وأدقّ.
    const intent = facts ? matchIntent(content) : null;
    if (intent) {
      const local = intent.answer(facts);
      if (local) {
        setMessages([...nextMessages, { role: "assistant", content: local, local: true }]);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError("");
    try {
      // السياق + السجلات المطابقة للسؤال
      // ⚠ content لا text: الأخير قد يكون undefined حين يُرسل من الحقل
      const grounded = contextText + groundingFor(content);
      const reply = await fetchAiChatReply(nextMessages, grounded);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
      // ⚠ id = nextMessages.length: نفس الفهرس الذي سيحمله هذا الرد الجديد
      // في مصفوفة الرسائل بعد الإضافة أعلاه — يطابق ما يقارنه زرّ "استماع"
      // الخاص بهذه الرسالة (isThisSpeaking = voice.speakingId === i)، فلا
      // يظهر زرّها "إيقاف" بالغلط ولا يُقاطَع نطقها بضغط زرّ رسالة أخرى.
      if (autoSpeak) voice.speak(reply, nextMessages.length);
    } catch (e) {
      console.error("ai chat failed", e);
      setError("تعذر الرد الآن، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--edge)" }}>
        <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-base font-bold flex items-center gap-2">
          أوقية
        </span>
        <div className="flex items-center gap-2">
          {voice.ttsSupported && (
            <button
              onClick={() => {
                if (voice.speaking) voice.stopSpeaking();
                setAutoSpeak((v) => !v);
              }}
              title={autoSpeak ? "إيقاف قراءة الردود" : "قراءة الردود صوتيًا"}
              style={{ color: autoSpeak ? "var(--accent)" : "var(--text3)" }}
            >
              {autoSpeak ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
          )}
          <button
            onClick={() => {
              voice.stopSpeaking();
              voice.stopListening();
              onClose();
            }}
            style={{ color: "var(--text2)" }}
          >
            <X size={22} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: "50vh" }}>
            <div className="mb-3">
              <AiLogoBadge width={80} />
            </div>
            <p style={{ color: "var(--text)" }} className="text-sm font-bold mb-1">
              اسألني أي شي بالتطبيق أو ببياناتك
            </p>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-5">
              طريقة استخدام ميزة، أو رقم من أرقام محلك
            </p>
            <div className="flex flex-col gap-2 w-full" style={{ maxWidth: 280 }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="text-xs py-2 px-3 rounded-full text-right"
                  style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className="flex" style={{ justifyContent: m.role === "user" ? "flex-start" : "flex-end" }}>
              <div
                className="text-sm leading-relaxed"
                style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: 14,
                  background: m.role === "user" ? "var(--panel)" : "var(--accentBg)",
                  color: "var(--text)",
                  border: m.role === "user" ? "1px solid var(--edge)" : "1px solid var(--accentLine)",
                  // ⚠ الأسطر الجديدة في الإجابات المحلية تحتاج pre-wrap،
                  // وبدونها تلتصق أسطر الأرصدة في سطر واحد.
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}

                {/* اقتراحات قابلة للضغط — لا نص جامد */}
                {m.suggestions?.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-2">
                    {m.suggestions.map((q, k) => (
                      <button
                        key={k}
                        onClick={() => sendMessage(q)}
                        className="text-right text-[12px] px-3 py-2 rounded-xl"
                        style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {m.local && (
                  <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[9px]">
                    من بيانات جهازك — بلا اتصال
                  </p>
                )}

                {m.role === "assistant" && voice.ttsSupported && (() => {
                  // ⚠ لكل رسالة زرّها الخاص: نقارن speakingId بمعرّف هذه
                  // الرسالة (i) لا بـ speaking العام — قبل هذا كان كل زرّ
                  // "استماع" في كل الرسائل يعرض نفس الحالة المشتركة، فالضغط
                  // على زرّ رسالة يوقف قراءة رسالة أخرى جارية بدل بدء قراءته هو.
                  const isThisSpeaking = voice.speakingId === i;
                  return (
                    <button
                      onClick={() => (isThisSpeaking ? voice.stopSpeaking() : voice.speak(m.content, i))}
                      className="flex items-center gap-1 mt-2 text-[11px]"
                      style={{ color: "var(--accentText)" }}
                    >
                      {isThisSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      {isThisSpeaking ? "إيقاف" : "استماع"}
                    </button>
                  );
                })()}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex" style={{ justifyContent: "flex-end" }}>
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text2)", padding: "10px 14px" }}>
                <Loader2 size={14} className="animate-spin" /> جاري الرد...
              </div>
            </div>
          )}
          {error && (
            <p style={{ color: "var(--bad)" }} className="text-xs text-center">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 pt-2" style={{ borderTop: "1px solid var(--edge)" }}>
        <div className="flex items-center gap-2">
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={voice.listening ? "جاري الاستماع..." : "اكتب سؤالك أو اضغط الميكروفون..."}
          />
          {voice.sttSupported && (
            <button
              onClick={() =>
                voice.listening
                  ? voice.stopListening()
                  : voice.startListening((text) => setInput(text))
              }
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: voice.listening ? "var(--accentBg)" : "var(--panel)",
                border: `1px solid ${voice.listening ? "var(--bad)" : "var(--edge)"}`,
                color: voice.listening ? "var(--bad)" : "var(--accentSoft)",
              }}
              title={voice.listening ? "إيقاف الاستماع" : "إدخال صوتي"}
            >
              {voice.listening ? <MicOff size={18} className="animate-pulse" /> : <Mic size={18} />}
            </button>
          )}
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: input.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--panel)",
              color: input.trim() ? "var(--panel)" : "var(--accentLine)",
            }}
          >
            <Check size={18} />
          </button>
        </div>
        {voice.voiceError && (
          <p style={{ color: "var(--bad)" }} className="text-[11px] mt-2">
            {voice.voiceError}
          </p>
        )}
        {voice.listening && (
          <p style={{ color: "var(--text2)" }} className="text-[11px] mt-2">
            تكلّم الآن — يتوقف التسجيل تلقائيًا عند صمتك.
          </p>
        )}
      </div>
    </div>
  );
}

export { AiChatPanel };
