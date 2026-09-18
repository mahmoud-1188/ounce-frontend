import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { fmtMoney } from "../core/money.js";
import { fetchLiveGram24 } from "../domain/helpers.js";

function GoldTicker({ shopPrice = 0, currency = "ر.س", onUseLive, canUse,
                      streamUrl = "" }) {
  const [live, setLive] = useState(null);        // { gram24, source, at }
  const [prev, setPrev] = useState(null);
  const [dir, setDir] = useState("flat");        // up | down | flat
  const [state, setState] = useState("idle");    // idle | loading | ok | fail
  const [open, setOpen] = useState(false);

  const pending = useRef(null);                  // آخر قيمة وصلت
  const paintAt = useRef(0);
  const timer = useRef(null);
  const abort = useRef(null);

  // ⚠ الخنق بمِراسٍ لا بحالة.
  //
  // كل تحديث حالة يُعيد الرسم. وسعرٌ يصل كل ثانية على شاشة جرد يجعل
  // القائمة ترتجف والمسح يتلعثم — والبائع يلوم الماسح.
  //
  // فنجمع ما يصل في مِرْجَع، ونرسم مرة كل 1800 مللي.
  const PAINT_MS = 1800;
  const POLL_MS = 15000;

  const paint = () => {
    const next = pending.current;
    if (!next) return;
    setLive((old) => {
      if (old && Math.abs(next.gram24 - old.gram24) > 0.0001) {
        setPrev(old);
        setDir(next.gram24 > old.gram24 ? "up" : "down");
      }
      return next;
    });
    paintAt.current = Date.now();
  };

  const tick = async () => {
    setState((s) => (s === "ok" ? "ok" : "loading"));
    abort.current?.abort();
    abort.current = new AbortController();
    const got = await fetchLiveGram24(abort.current.signal);
    if (!got) {
      setState("fail");
      return;
    }
    setState("ok");
    pending.current = got;
    const since = Date.now() - paintAt.current;
    if (since >= PAINT_MS) paint();
    else {
      clearTimeout(timer.current);
      timer.current = setTimeout(paint, PAINT_MS - since);
    }
  };

  // ══ البثّ إن وُجد خادم، وإلا الاستطلاع المباشر ══
  //
  // ⚠ السقوط للاستطلاع ليس ترفًا.
  //
  // خادم Render المجاني ينام بعد ربع ساعة ويستيقظ في نحو خمسين ثانية.
  // ولو انتظرناه لرأى البائع شريطًا فارغًا كلّما فتح المحل صباحًا —
  // فيظنّ الميزة معطّلة ويكفّ عن النظر إليها.
  //
  // فنسأل المصدر مباشرةً حتى يستيقظ، ثم نعود للبثّ.
  useEffect(() => {
    let stop = false;
    let es = null;
    let pollTimer = null;

    const startPolling = () => {
      const loop = async () => {
        if (stop) return;
        // ⚠ لا نسأل والتبويب مخفيّ: الجوال يخنق المؤقّتات في الخلفية،
        // فتتراكم الطلبات وتنطلق دفعةً عند العودة — ويُحظر الجهاز.
        if (document.visibilityState === "visible") await tick();
        if (!stop) pollTimer = setTimeout(loop, POLL_MS);
      };
      loop();
    };

    const startStream = () => {
      try {
        es = new EventSource(`${streamUrl}/stream`);
        es.addEventListener("price", (ev) => {
          try {
            const j = JSON.parse(ev.data);
            if (!(Number(j?.gram24) > 0)) return;
            setState("ok");
            pending.current = {
              gram24: j.gram24,
              source: `${j.source || "بثّ"} · مباشر`,
              at: j.at || Date.now(),
            };
            const since = Date.now() - paintAt.current;
            if (since >= PAINT_MS) paint();
            else {
              clearTimeout(timer.current);
              timer.current = setTimeout(paint, PAINT_MS - since);
            }
          } catch (_) { /* حدثٌ مشوّه — نتجاهله ولا نُسقط القناة */ }
        });
        es.onerror = () => {
          // ⚠ المتصفح يُعيد الاتصال وحده. لا نُغلق ولا نُنشئ قناةً
          // ثانية — قناتان تُضاعفان الأحداث وتُربكان النبضة.
          setState((st) => (st === "ok" ? "ok" : "fail"));
        };
      } catch (_) {
        startPolling();
      }
    };

    if (streamUrl && typeof EventSource !== "undefined") {
      startStream();
      // ⚠ ونستطلع مرة فورًا: البثّ لا يُرسل شيئًا حتى يستيقظ الخادم،
      // والشاشة تبقى «…» دقيقةً كاملة بلا هذا.
      tick();
    } else {
      startPolling();
    }

    const onVis = () => {
      if (document.visibilityState === "visible" && !streamUrl) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearTimeout(timer.current);
      clearTimeout(pollTimer);
      abort.current?.abort();
      es?.close();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [streamUrl]);

  // فرق السوق عن سعر المحل
  const gap = live && shopPrice > 0
    ? Math.round((live.gram24 - shopPrice) * 100) / 100
    : null;
  const gapPct = gap != null && shopPrice > 0
    ? Math.round((gap / shopPrice) * 1000) / 10
    : null;
  // ⚠ نصف بالمئة حدٌّ عمليّ: أقلّ منه ضجيج سوقٍ لا يستحق تغيير سعر
  // المحل، وأكثر منه فرقٌ يظهر في فاتورة عشرين جرامًا.
  const drifted = gapPct != null && Math.abs(gapPct) >= 0.5;

  const tone = dir === "up" ? "good" : dir === "down" ? "bad" : "text2";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "—";
  const delta = live && prev
    ? Math.round((live.gram24 - prev.gram24) * 100) / 100
    : 0;

  return (
    <>
      <style>{`
        @keyframes ouncePulseUp {
          0% { background: var(--goodBg); }
          100% { background: transparent; }
        }
        @keyframes ouncePulseDown {
          0% { background: var(--badBg); }
          100% { background: transparent; }
        }
      `}</style>

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-right px-3 py-2 flex items-center gap-2"
        style={{
          borderBottom: "1px solid var(--line)",
          // ⚠ النبضة على الخلفية لا على النصّ: تلوين الرقم يجعله يُقرأ
          // بصعوبة لحظةَ تغيّره — وهي اللحظة التي يُقرأ فيها.
          animation: dir === "up" ? "ouncePulseUp 1.2s ease-out"
            : dir === "down" ? "ouncePulseDown 1.2s ease-out" : "none",
        }}
        aria-label="سعر الذهب الحيّ"
      >
        <span style={{ color: `var(--${tone})` }} className="text-[13px] font-bold">
          {arrow}
        </span>
        <span className="flex-1 min-w-0">
          <span style={{ color: "var(--text)" }} className="text-[12px] font-bold">
            {state === "fail" && !live
              ? "تعذّر جلب السعر"
              : live
                ? `${currency}${fmtMoney(live.gram24)}`
                : "…"}
          </span>
          <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1.5">
            السوق · جم24
          </span>
          {live && prev && Math.abs(delta) > 0.004 && (
            <span style={{ color: `var(--${tone})` }} className="text-[10px] mr-1.5">
              {delta > 0 ? "+" : ""}{fmtMoney(delta)}
            </span>
          )}
        </span>
        {drifted && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{
              background: "var(--accentBg)", color: "var(--accent)",
              border: "1px solid var(--accentLine)",
            }}
          >
            يبعد {gapPct > 0 ? "+" : ""}{gapPct}٪
          </span>
        )}
        <ChevronDown
          size={13}
          color="var(--text3)"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
        />
      </button>

      {open && (
        <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="flex items-baseline justify-between py-1">
            <span style={{ color: "var(--text3)" }} className="text-[11px]">سعر المحل</span>
            <span style={{ color: "var(--accent)" }} className="text-[13px] font-bold">
              {currency}{fmtMoney(shopPrice)}
            </span>
          </div>
          <div className="flex items-baseline justify-between py-1">
            <span style={{ color: "var(--text3)" }} className="text-[11px]">السوق الآن</span>
            <span style={{ color: `var(--${tone})` }} className="text-[13px] font-bold">
              {live ? `${currency}${fmtMoney(live.gram24)}` : "—"}
            </span>
          </div>
          {gap != null && (
            <div className="flex items-baseline justify-between py-1"
              style={{ borderTop: "1px solid var(--line)" }}>
              <span style={{ color: "var(--text3)" }} className="text-[11px]">الفرق</span>
              <span
                style={{ color: gap > 0 ? "var(--good)" : gap < 0 ? "var(--bad)" : "var(--text2)" }}
                className="text-[13px] font-bold"
              >
                {gap > 0 ? "+" : ""}{currency}{fmtMoney(gap)} ({gapPct > 0 ? "+" : ""}{gapPct}٪)
              </span>
            </div>
          )}

          {/* ⚠ التحديث بقرار المدير لا آليًا.
              سعرٌ يتغيّر تحت يد البائع أثناء كتابة الفاتورة يجعل الإجمالي
              يقفز بين سطرٍ وسطر — والزبونة ترى رقمًا ثم غيره. */}
          {canUse && live && (
            <button
              onClick={() => { onUseLive?.(live.gram24); setOpen(false); }}
              className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold"
              style={{
                background: "var(--accentBg)", color: "var(--accent)",
                border: "1px solid var(--accentLine)",
              }}
            >
              اعتمد سعر السوق لليوم — {currency}{fmtMoney(live.gram24)}
            </button>
          )}

          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2 leading-6">
            ⚖ الفواتير تُحسب بسعر المحل لا بالسوق. سعرٌ يتحرّك كل ثانية
            يجعل فاتورتين بينهما دقيقتان بسعرين، فلا يُعرف ربح اليوم.
          </p>
          <p style={{ color: "var(--text3)" }} className="text-[10px]">
            {state === "fail"
              ? "⚠ تعذّر الوصول للمصادر — قد تكون بلا اتصال"
              : live
                ? `المصدر ${live.source} · ${new Date(live.at).toLocaleTimeString("en-GB")}`
                : "جارٍ الجلب…"}
          </p>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  محرّك التقارير الموحّد — طبقة البيانات
//
//  ⚠ دوالٌ نقيّة بلا React.
//
//  خلطُ الحساب بالرسم يجعل كل تغيير عرضٍ يُعيد الحساب، وكل خطأ حسابٍ
//  يحتاج متصفحًا ليُكشف. وهذه تُختبَر بـ`node` في ملّي ثانية.
//
//  ⚠ ولا استعلام مخزنٍ هنا: يُمرَّر ما حُمِّل سلفًا، فلا يُقرأ القرص
//  مرتين لتقريرٍ واحد.
// ═══════════════════════════════════════════════════════════════════════

/// اختصارات المدى — ماضٍ وحاضر فقط.
///
/// ⚠ لا فتراتٍ مستقبلية.
///
/// كنتُ أضفتُ «الأسبوع القادم» و«الشهر القادم»، وهما خطأ: **التقرير
/// يعرض ما وقع لا ما لم يقع**. وفترةٌ بلا حركة تُعرض أصفارًا، فيراها
/// صاحب المحل ويظنّ للحظةٍ أن بيعه انهار — ثم يتذكّر أنها لم تأتِ.
///
/// والتنبؤ ليس تقريرًا: من أراده أراد نموذجًا يفترض ويُخطئ، لا سجلًّا
/// يقول ما جرى. وخلطُهما في شاشةٍ واحدة يُفقد السجلَّ ثقتَه.

export { GoldTicker };
