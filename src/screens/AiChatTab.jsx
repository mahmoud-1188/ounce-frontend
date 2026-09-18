import React, { useEffect, useRef, useState } from "react";
import { AI_APP_MANUAL, AI_PROMPTS, AI_SYSTEM_RULES } from "../core/constants.js";
import { buildAiAccounts } from "../domain/buildAiAccounts.js";
import { buildAiDetail } from "../domain/buildAiDetail.js";
import { buildAiSnapshot } from "../domain/buildAiSnapshot.js";
import { askReportAi, guessScreens, inputStyle, normalizeArabicQuery, useVoice } from "../domain/helpers.js";
import { parseAiJson } from "../domain/parseAiJson.js";
import { Card } from "../ui/Card.jsx";
import { VoiceBar } from "../ui/VoiceBar.jsx";

function AiChatTab({ ctx, currency, onOpenScreen, voiceFirst = false, onVoiceConsumed }) {
  const voice = useVoice("ar-SA");
  const [autoSpeak, setAutoSpeak] = useState(voiceFirst);
  const [greeted, setGreeted] = useState(false);

  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const send = async (text) => {
    const question = String(text || q).trim();
    if (!question || busy) return;
    setQ("");
    setErr("");
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const norm = normalizeArabicQuery(question);
      // الشجرة ثقيلة — تُرسَل فقط لسؤالٍ يخصّ حسابًا أو قيدًا، بعد التطبيع
      // كي يُلتقط «حسب» و«ميزن» و«قيود» بأخطائها.
      const needsAccounts = /حساب|حسب|ميزان|ميزن|قيد|قيود|شجر|مدين|دائن|\d{4}/.test(norm);
      // التفصيل يُرسَل لسؤالٍ عن شخصٍ أو صنفٍ أو ترتيب — لا لكل سؤال
      const needsDetail = /باع|بائع|عميل|زبون|صنف|قطع|اكثر|اقل|افضل|راكد|يوم|امس|الاسبوع/.test(norm);
      const hint = guessScreens(question);

      const payload = {
        "معطيات النظام": buildAiSnapshot(ctx),
        ...(needsDetail ? { "تفصيل": buildAiDetail(ctx) } : {}),
        ...(needsAccounts ? { "شجرة الحسابات بأرصدتها": buildAiAccounts(ctx) } : {}),
      };
      const manual = AI_APP_MANUAL.map(([id, label, path, does]) =>
        `${id} | ${label} | ${path} | ${does}`).join("\n");

      const history = msgs.slice(-6).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.role === "user" ? m.text : JSON.stringify({ answer: m.text }),
      }));

      // ⚠ الثابت (القواعد + الدليل) يُلحق بأول رسالة مستخدم لا في حقل
      // `system` منفصل — هذا المسار يمرّ عبر خادمنا (`aiApi.chat`) الذي
      // لا يقرأ حقل system، فحقنه فيه بلا فائدة، واستدعاء نموذج الذكاء
      // مباشرةً من الواجهة هو الثقب الأمني الذي أُغلق في هذا التطبيق.
      const raw = await askReportAi([
        ...history,
        {
          role: "user",
          content:
            (hint.length ? `شاشات مرجّحة من كلمات السؤال: ${hint.map((h) => h.id).join("، ")}\n\n` : "") +
            `معطيات النظام:\n${JSON.stringify(payload, null, 1)}\n\n` +
            `السؤال: ${question}`,
        },
      ], 1400, `${AI_SYSTEM_RULES}\n\nدليل الشاشات (معرّف | اسم | الطريق | ماذا يفعل):\n${manual}`);

      // النموذج يُطالَب بـJSON خالص، لكنه أحيانًا يُغلّفه بسياجٍ أو يُقدّم له
      // بجملة. نلتقط أول كائنٍ متوازن بدل الفشل على الردّ كله.
      const parsed = parseAiJson(raw);
      setMsgs((m) => [...m, {
        role: "ai",
        text: parsed.answer,
        screens: (parsed.screens || []).filter((id) => AI_APP_MANUAL.some((r) => r[0] === id)),
        followups: parsed.followups || [],
        // ⚠ الاستيضاح خياراتٌ تُضغط لا سؤالٌ يُكتب له جواب: المستخدم
        // واقفٌ وزبونٌ أمامه — يضغط ولا يكتب.
        clarify: Array.isArray(parsed.clarify) ? parsed.clarify.slice(0, 4) : [],
      }]);
      // ⚠ «ودّني الجرد» تفتح الجرد — لا تعرض زرًّا ليضغطه. المستخدم
      // واقفٌ وزبونٌ أمامه؛ الضغطة الزائدة هي الفرق بين مساعدٍ وقائمة.
      const nav = typeof parsed.navigate === "string" ? parsed.navigate.trim() : "";
      if (nav && AI_APP_MANUAL.some((r) => r[0] === nav)) {
        setTimeout(() => onOpenScreen?.(nav), 600);
      }
    } catch (e) {
      // ⚠ السبب كما جاء لا مبتلعًا: «المفتاح غير مضبوط» علاجُها غير
      // «تجاوزت الحدّ»، وخلطهما يجعل المستخدم يُعيد المحاولة بلا فائدة.
      setErr(String(e?.message || "") || "تعذّر الوصول لخدمة الذكاء");
    } finally {
      setBusy(false);
    }
  };

  // ═══ الترحيب الصوتي ═══
  //
  // ⚠ يُرحّب ثم يستمع — لا يستمع وهو يتكلّم: الميكروفون يلتقط صوت
  // التطبيق فيُرسل «أهلًا عزيزي» سؤالًا لنفسه.
  //
  // ويُستهلك العلم فورًا كي لا يُعاد الترحيب مع كل رسم.
  const greetRef = useRef(false);
  useEffect(() => {
    if (!voiceFirst || greetRef.current) return undefined;
    greetRef.current = true;
    onVoiceConsumed?.();
    const hour = new Date().getHours();
    const hi = hour < 12 ? "صباح الخير" : hour < 18 ? "مساء الخير" : "مساء الخير";
    const line = `${hi} عزيزي. أنا مساعد أوقية. اسألني بصوتك عن أي شيء في التطبيق أو عن أرقام محلك.`;
    setGreeted(true);
    setMsgs((m) => (m.length ? m : [{ role: "ai", text: line, screens: [], followups: [
      "كيف أبيع قطعة؟", "كم بعت اليوم؟", "اشرح لي الشاشة الرئيسية" ], clarify: [] }]));
    // ⚠ لا نطقَ هنا: شريط الصوت ينطق آخر ردٍّ تلقائيًّا في الوضع الصوتي،
    // ونطقُنا فوقه يُسمِع الترحيب مرتين.
    //
    // ⚠ ولا تنظيف للمؤقّت: `onVoiceConsumed` يُغيّر `voiceFirst` فيُعاد
    // تشغيل الأثر، ولو أعدنا دالة تنظيفٍ لقتلت المؤقّت قبل أن يبدأ
    // الاستماع — وهذا ما وقع. المؤقّت يعيش في مرجع.
    if (voice.sttSupported) {
      greetTimerRef.current = setTimeout(() => {
        if (!voice.listening) {
          voice.startListening((text, isFinal) => { if (isFinal && text.trim()) send(text.trim()); });
        }
      }, 4200);
    }
    return undefined;
  }, [voiceFirst]);
  const greetTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(greetTimerRef.current), []);

  const screenLabel = (id) => AI_APP_MANUAL.find((r) => r[0] === id)?.[1] || id;

  return (
    <>
      {msgs.length === 0 && (
        <>
          <Card style={{ padding: 12, marginBottom: 10 }}>
            <p style={{ color: "var(--accent)", margin: 0 }} className="text-[11px] font-bold">
              اسأل بأي صيغة
            </p>
            <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px] leading-6">
              عن أرقامك: «كم ربحت الشهر» · «مين باع أكثر» · «وش عندي عيار 21».
              عن التطبيق: «كيف أضيف مورد» · «وين أسجّل مصروف». يفهم العامية
              والأخطاء الإملائية، ويفتح لك الشاشة.
            </p>
          </Card>
          <div className="flex flex-col gap-1.5 mb-3">
            {AI_PROMPTS.map((p) => (
              <button key={p} onClick={() => send(p)}
                className="w-full text-right px-3 py-2 rounded-xl text-[11px]"
                style={{ background: "var(--field)", color: "var(--text2)",
                         border: "1px solid var(--line)" }}>
                {p}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex flex-col gap-2 mb-3">
        {msgs.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-start" : "stretch",
            maxWidth: m.role === "user" ? "88%" : "100%",
          }}>
            <Card style={{
              padding: 11,
              background: m.role === "user" ? "var(--accentBg)" : "var(--panel)",
              border: `1px solid ${m.role === "user" ? "var(--accentLine)" : "var(--edge)"}`,
            }}>
              <p style={{
                color: m.role === "user" ? "var(--accent)" : "var(--text)",
                margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.9,
              }} className="text-[12px]">
                {m.text}
              </p>
              {m.screens?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {m.screens.map((id) => (
                    <button key={id} onClick={() => onOpenScreen?.(id)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                      style={{ background: "var(--accentBg)", color: "var(--accent)",
                               border: "1px solid var(--accentLine)" }}>
                      افتح {screenLabel(id)} ←
                    </button>
                  ))}
                </div>
              )}
              {m.clarify?.length > 0 && (
                <div className="mt-2">
                  <p style={{ color: "var(--accentText)", margin: "0 0 4px" }} className="text-[10px] font-bold">أيّها تقصد؟</p>
                  <div className="flex flex-col gap-1">
                    {m.clarify.map((c) => (
                      <button key={c} onClick={() => send(c)}
                        className="text-right px-3 py-2 rounded-xl text-[11px] font-bold"
                        style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {m.followups?.length > 0 && (
                <div className="flex flex-col gap-1 mt-2 pt-2"
                  style={{ borderTop: "1px solid var(--line)" }}>
                  {m.followups.map((f) => (
                    <button key={f} onClick={() => send(f)}
                      className="text-right text-[10px] px-1"
                      style={{ color: "var(--text3)" }}>
                      ↳ {f}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ))}
        {busy && (
          <Card style={{ padding: 11 }}>
            <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">يفكّر…</p>
          </Card>
        )}
        <div ref={endRef} />
      </div>

      {err && (
        <Card style={{ padding: 10, marginBottom: 8, border: "1px solid var(--badLine)" }}>
          <p style={{ color: "var(--bad)", margin: 0 }} className="text-[11px]">⚠ {err}</p>
        </Card>
      )}

      <div className="flex gap-2 mb-4">
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="اكتب بأي صيغة…"
        />
        <button
          onClick={() => send()}
          disabled={busy || !q.trim()}
          className="px-4 rounded-xl text-[12px] font-bold"
          style={{
            background: busy || !q.trim() ? "var(--field)"
              : "linear-gradient(135deg,var(--gradFrom),var(--gradTo))",
            color: busy || !q.trim() ? "var(--text3)" : "var(--panel)",
          }}>
          اسأل
        </button>
      </div>
      <VoiceBar
        voice={voice}
        autoSpeak={autoSpeak}
        onToggleAuto={() => setAutoSpeak((v) => !v)}
        onTranscript={(t) => { setQ(t); send(t); }}
        replyText={[...msgs].reverse().find((m) => m.role === "ai")?.text || ""}
      />

      {msgs.length > 0 && (
        <button onClick={() => { setMsgs([]); setErr(""); }}
          className="w-full py-2 rounded-xl text-[11px] mb-6"
          style={{ background: "var(--field)", color: "var(--text3)",
                   border: "1px solid var(--line)" }}>
          محادثة جديدة
        </button>
      )}
    </>
  );
}

export { AiChatTab };
