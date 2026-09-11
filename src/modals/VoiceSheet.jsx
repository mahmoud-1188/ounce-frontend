import React, { useState } from "react";
import { Mic, X } from "lucide-react";
import { fmt } from "../core/money.js";
import { useVoice } from "../domain/helpers.js";
import { parseVoiceCommand } from "../domain/parseVoiceCommand.js";
import { Card } from "../ui/Card.jsx";

function VoiceSheet({ scope, onNav, onAsk, onAction, onClose }) {
  const voice = useVoice("ar-SA");
  const [heard, setHeard] = useState("");
  const [cmd, setCmd] = useState(null);
  const [err, setErr] = useState("");

  const listen = () => {
    setErr(""); setHeard(""); setCmd(null);
    voice.startListening((text) => {
      const t = String(text || "").trim();
      setHeard(t);
      const parsed = parseVoiceCommand(t, scope);
      setCmd(parsed);
      // ⚠ التنقّل والاستعلام فقط يُنفَّذان فورًا. العمليات تنتظر تأكيدك:
      // «بعشرة آلاف» و«بعشرين ألف» متقاربتان صوتيًا.
      if (parsed && !parsed.needsConfirm) {
        if (parsed.kind === "nav") { onNav(parsed.pageId); onClose(); }
        else if (parsed.kind === "ask") { onAsk(parsed.question); onClose(); }
      }
    });
  };

  const EX = [
    "افتح المخزون",
    "كم رصيد الصندوق",
    "فاتورة بيع جديدة",
    "سجل مصروف مئتين",
    "استلم كسر عيار 21",
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "var(--veil)" }}>
      <button className="flex-1" onClick={onClose} aria-label="إغلاق" />
      <div
        style={{
          background: "var(--panel)", borderTop: "1px solid var(--accentLine)",
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          maxHeight: "80vh", display: "flex", flexDirection: "column", minHeight: 0,
        }}
      >
        <div className="flex items-center justify-center py-2.5" style={{ flexShrink: 0 }}>
          <span style={{ width: 38, height: 4, borderRadius: 2, background: "var(--edge)", display: "block" }} />
        </div>

        <div className="px-4 pb-5" style={{ overflowY: "auto", minHeight: 0 }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold">
              الأوامر الصوتية
            </span>
            <button onClick={onClose} style={{ color: "var(--text2)" }}>
              <X size={18} />
            </button>
          </div>

          {!voice.sttSupported ? (
            <Card style={{ padding: 12 }}>
              <p style={{ color: "var(--bad)" }} className="text-[11px]">
                هذا المتصفح لا يدعم التعرّف على الكلام. جرّب Chrome على أندرويد
                أو Safari على آيفون.
              </p>
            </Card>
          ) : (
            <>
              {/* زر الاستماع */}
              <button
                onClick={voice.listening ? voice.stopListening : listen}
                className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-2xl mb-3"
                style={{
                  background: voice.listening ? "var(--accentBg)" : "var(--panel)",
                  border: `1px solid ${voice.listening ? "var(--accent)" : "var(--edge)"}`,
                }}
              >
                <div
                  style={{
                    width: 58, height: 58, borderRadius: 29,
                    background: voice.listening
                      ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))"
                      : "var(--accentBg)",
                    display: "grid", placeItems: "center",
                    animation: voice.listening ? "pulse 1.3s ease-in-out infinite" : "none",
                  }}
                >
                  <Mic size={26} color={voice.listening ? "var(--panel)" : "var(--accent)"} />
                </div>
                <span style={{ color: voice.listening ? "var(--accent)" : "var(--text2)" }} className="text-xs font-bold">
                  {voice.listening ? "أستمع… تكلّم الآن" : "اضغط وتكلّم"}
                </span>
              </button>

              {voice.voiceError && (
                <Card style={{ padding: 10, marginBottom: 10, border: "1px solid var(--badLine)" }}>
                  <p style={{ color: "var(--bad)" }} className="text-[11px]">{voice.voiceError}</p>
                </Card>
              )}

              {/* ما سُمع */}
              {heard && (
                <Card style={{ padding: 11, marginBottom: 10 }}>
                  <p style={{ color: "var(--text3)" }} className="text-[10px] mb-0.5">سمعتُ</p>
                  <p style={{ color: "var(--text)" }} className="text-sm">«{heard}»</p>
                </Card>
              )}

              {/* التأكيد قبل التنفيذ */}
              {cmd?.needsConfirm && (
                <Card style={{ padding: 13, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
                  <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
                    فهمتُ: {cmd.label}
                  </p>
                  {cmd.params?.amount != null && (
                    <p style={{ color: "var(--text)" }} className="text-sm">
                      المبلغ {fmt(cmd.params.amount, 2)}
                    </p>
                  )}
                  {cmd.params?.karat != null && (
                    <p style={{ color: "var(--text)" }} className="text-sm">
                      عيار {cmd.params.karat}
                    </p>
                  )}
                  <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1 mb-3">
                    ⚠ راجع قبل التنفيذ — التعرّف على الكلام يُخطئ، والخطأ هنا في المال.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setCmd(null); setHeard(""); }}
                      className="py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={() => { onAction(cmd); onClose(); }}
                      className="py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
                    >
                      نفّذ
                    </button>
                  </div>
                </Card>
              )}

              {/* لم نفهم */}
              {cmd?.kind === "unknown" && (
                <Card style={{ padding: 12, marginBottom: 10 }}>
                  <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
                    لم أفهم الأمر. جرّب أحد هذه:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {(cmd.suggestions || []).map((sx, i) => (
                      <div key={i}
                        className="text-[12px] px-3 py-2 rounded-xl"
                        style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                        «{sx}»
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* أمثلة */}
              {!heard && (
                <>
                  <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">أمثلة</p>
                  <div className="flex flex-col gap-1.5">
                    {EX.map((e, i) => (
                      <div key={i}
                        className="text-[12px] px-3 py-2 rounded-xl"
                        style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                        «{e}»
                      </div>
                    ))}
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[10px] mt-3">
                    ⚖ التنقّل والاستعلام يُنفَّذان فورًا. ما يمسّ المال أو المخزون
                    يعرض تأكيدًا أولًا.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`}</style>
    </div>
  );
}

// ============================================================
// دفتر الموردين — حساب كل مورد
//
// مبني بمنطق اليومية نفسه: رصيد سابق ثم حركة اليوم/الفترة ثم رصيد
// حالي، **في دفترين لا يلتقيان**.
//
// ⚠ التزام المورد ببُعدين: ذهبٌ بالجرام وأجورٌ بالعملة. جمعهما في
// رقم واحد يجعل الرصيد يتغيّر بسعر السوق دون أن تشتري شيئًا — والمورد
// لا يطالبك بريالات عن ذهب، بل بذهب عن ذهب.
// ============================================================

export { VoiceSheet };
