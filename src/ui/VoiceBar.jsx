import React, { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

function VoiceBar({ voice, onTranscript, replyText, autoSpeak, onToggleAuto, compact }) {
  const { listening, speaking, voiceError, sttSupported, ttsSupported,
    startListening, stopListening, speak, stopSpeaking } = voice;
  const [partial, setPartial] = useState("");

  // ⚠ النطق التلقائي يتبع آخر ردّ: لا يُعاد نطقه مع كل رسم، ولا يُنطق
  // ردٌّ قديم حين يُفتح الشريط.
  const spokenRef = useRef("");
  useEffect(() => {
    if (!autoSpeak || !ttsSupported || !replyText) return;
    if (spokenRef.current === replyText) return;
    spokenRef.current = replyText;
    speak(replyText);
  }, [replyText, autoSpeak, ttsSupported]);

  if (!sttSupported && !ttsSupported) return null;

  const mic = () => {
    if (listening) { stopListening(); return; }
    setPartial("");
    startListening((text, isFinal) => {
      setPartial(text);
      if (isFinal && text.trim()) { setPartial(""); onTranscript?.(text.trim()); }
    });
  };

  return (
    <div style={{ marginTop: compact ? 6 : 8 }}>
      <div className="flex items-center gap-2">
        {sttSupported && (
          <button onClick={mic} aria-label={listening ? "أوقف الاستماع" : "اسأل بصوتك"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold"
            style={{ background: listening ? "var(--badBg)" : "var(--accentBg)",
              color: listening ? "var(--bad)" : "var(--accent)",
              border: `1px solid ${listening ? "var(--badLine)" : "var(--accentLine)"}` }}>
            <Mic size={13} />
            {listening ? "يستمع… اضغط لتتوقّف" : "اسأل بصوتك"}
          </button>
        )}
        {ttsSupported && (
          <>
            <button onClick={() => (speaking ? stopSpeaking() : replyText && speak(replyText))}
              disabled={!speaking && !replyText}
              aria-label={speaking ? "أوقف النطق" : "انطق الجواب"}
              className="px-3 py-2 rounded-xl text-[11px] font-bold"
              style={{ background: speaking ? "var(--badBg)" : "var(--field)",
                color: speaking ? "var(--bad)" : replyText ? "var(--text2)" : "var(--text3)",
                border: "1px solid var(--line)" }}>
              {speaking ? "أوقف" : "اسمع الجواب"}
            </button>
            {onToggleAuto && (
              <button onClick={onToggleAuto} aria-label="النطق التلقائي"
                className="px-2.5 py-2 rounded-xl text-[11px]"
                style={{ background: autoSpeak ? "var(--accentBg)" : "var(--field)",
                  color: autoSpeak ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>
                {autoSpeak ? "✓ تلقائي" : "تلقائي"}
              </button>
            )}
          </>
        )}
      </div>

      {/* ⚠ النصّ الجزئي يُعرض أثناء الكلام: بلاه لا يعرف المستخدم أفهِم
          عنه أم لا، فيُعيد الجملة بلا داعٍ. */}
      {listening && (
        <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[11px] leading-6">
          {partial || "تكلّم الآن…"}
        </p>
      )}
      {voiceError && (
        <p style={{ color: "var(--bad)", margin: "6px 0 0" }} className="text-[11px] leading-6">
          ⚠ {voiceError}
        </p>
      )}
      {!sttSupported && ttsSupported && (
        <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[10px] leading-6">
          الإدخال الصوتي غير مدعوم هنا — يعمل في كروم على أندرويد والحاسب.
        </p>
      )}
    </div>
  );
}

export { VoiceBar };
