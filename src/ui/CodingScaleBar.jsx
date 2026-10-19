import React, { useEffect, useRef, useState } from "react";
import { Loader2, Minus, RadioTower, RotateCcw, Scale, Zap } from "lucide-react";
import { fmtW, roundW } from "../core/money.js";
import { SCALE_LINK, SCALE_TEST_FEED, btSupported, scaleAutoWrite, scaleCommandBytes, scaleConnect, scaleDisconnect, scaleLinkCfgOf, scaleLinkConfigure, scaleLinkPoll, scaleLinkSend, scaleLinkWait, scaleRememberedDevice, scaleTransportFor, useScaleLink } from "../domain/scale.js";

function CodingScaleBar({ settings, auto = false, onAuto, row = null, rowLabel = "", fresh = 0, countCat = false, msg = null, onMsg, onWeight, onReadScale = null }) {
  const L = useScaleLink();
  const cfg = scaleLinkCfgOf(settings);
  const on = L.state === "on";
  const [busy, setBusy] = useState("");
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const say = (text, tone = "info") => { if (onMsg) onMsg(text ? { text, tone } : null); };
  // فحص الميزان اليومي غير مفعّل هنا — كل قراءةٍ مستقرّة مقبولة
  const rd = { ok: true, why: "" };
  const canBle = btSupported();
  const canSerial = typeof navigator !== "undefined" && !!navigator.serial;
  const st = L.stable, last = L.last;
  // دليل الوزنة: من الميزان بقراءته الخام — فلا يمسّها الوزن التلقائي إن كُتبت باليد بعدها
  const evOf = (r) => ({ source: "scale", grams: r.grams, raw: r.raw || "", unit: r.unit || "g", port: r.port || L.port || "", at: new Date().toISOString() });

  useEffect(() => { scaleLinkConfigure(settings); }, [cfg.protocol, cfg.baud, cfg.resolution, cfg.transport]);
  useEffect(() => { if (L.error && L.errorAt) say(L.error, "bad"); }, [L.errorAt]);
  useEffect(() => {
    if (SCALE_LINK.state === "off" && !SCALE_LINK.userOff && scaleRememberedDevice()) scaleConnect(settings, { quiet: true });
  }, []);
  useEffect(() => {
    if (!auto || !on) return undefined;
    scaleLinkPoll("coding", true);
    return () => { scaleLinkPoll("coding", false); };
  }, [auto, on, cfg.protocol]);
  const [silent, setSilent] = useState(false);
  useEffect(() => {
    setSilent(false);
    if (!on || !auto) return undefined;
    const t = setTimeout(() => setSilent(SCALE_LINK.lines === 0), 3500);
    return () => clearTimeout(t);
  }, [on, auto, L.at]);
  // التلقائي يكتب القراءة المستقرّة في الصنف الحالي وحده (scaleAutoWrite): لا يمسّ ما كُتب باليد، ولا يأخذ قراءةً بدأت قبل الانتقال إليه
  const skip = scaleAutoWrite({ row, stable: st, auto, on, ok: rd.ok, fresh });
  const stKey = st ? `${st.grams}|${st.since}` : "";
  useEffect(() => {
    if (!scaleAutoWrite({ row, stable: st, auto, on, ok: rd.ok, fresh }).write) return;
    onWeight(st.grams, evOf(st));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stKey, auto, on, row?.key, row?.weight, row?.weightEv?.source, fresh, rd.ok]);

  const connect = async (transport = null) => {
    if (busy) return;
    if (on) { await scaleDisconnect("", { user: true }); say("قُطع الاتصال بالميزان — اضغط «اتصل بالميزان» متى شئت"); return; }
    setBusy("connect");
    say("");
    const r = await scaleConnect(settings, transport ? { transport } : {});
    if (alive.current) setBusy("");
    if (r.ok) say(`✓ متّصل بالميزان «${SCALE_LINK.name || "الميزان"}»${auto ? " — الوزن التلقائي يعمل: ضع القطعة" : " — شغّل «وزن تلقائي» أو ضع القطعة واضغط «اقرأ الوزن»"}`, "good");
    else if (r.why) say(r.why, "bad");
  };
  const toggleAuto = () => {
    const next = !auto;
    onAuto(next);
    say(next ? (on ? "الوزن التلقائي يعمل — ضع القطعة على الميزان فيُكتب وزنها في الصنف الحالي حين يستقرّ، وما تكتبه بيدك لا يُمسّ" : "شُغّل الوزن التلقائي — اتصل بالميزان ليبدأ")
      : "أُوقف الوزن التلقائي — اكتب الوزن بيدك، أو ضع القطعة واضغط «اقرأ الوزن»");
  };
  // قراءةٌ واحدة بضغطة تُكتب في الصنف الحالي: من الاتصال الحيّ، أو بالقارئ الفردي (يتّصل ويقرأ) إن لم يكن اتصال
  const readNow = async () => {
    if (busy) return;
    if (!row) { say("أضف صنفًا أوّلًا — القراءة تُكتب في الصنف الحالي", "bad"); return; }
    if (!on && !onReadScale) { say(scaleTransportFor({}).why, "bad"); return; }
    if (!rd.ok) { say(rd.why, "bad"); return; }
    setBusy("read");
    say(on ? "ينتظر استقرار الميزان…" : "");
    try {
      const r = on ? await scaleLinkWait(4000) : await onReadScale();
      const reading = r && typeof r === "object" ? r : { grams: Number(r), raw: String(r ?? ""), unit: "g", mode: "GS" };
      const w = roundW(Number(reading.grams) || 0);
      if (!(w > 0)) throw new Error("الميزان يقرأ صفرًا — ضع القطعة ثم اضغط «اقرأ الوزن»");
      onWeight(w, evOf({ ...reading, grams: w }));
      say(`✓ ${rowLabel}: ${fmtW(w)} جم من الميزان`, "good");
    } catch (e) { say(String(e?.message || e).slice(0, 160), "bad"); } finally { if (alive.current) setBusy(""); }
  };
  const hasCmd = (k) => scaleCommandBytes(cfg.protocol, k).length > 0;
  const send = async (kind) => {
    if (busy) return;
    if (!on) { say("اتصل بالميزان أوّلًا", "bad"); return; }
    if (!hasCmd(kind)) { say("هذا النوع من الموازين لا يقبل أوامر — استعمل زرّ الميزان نفسه، أو غيّر «نوع الميزان» في إعداد الميزان", "bad"); return; }
    setBusy(kind);
    const ok = await scaleLinkSend(kind);
    if (alive.current) setBusy("");
    say(ok ? (kind === "zero" ? "أُرسل «تصفير» (Z) إلى الميزان — الكفّة الفارغة تقرأ صفرًا" : "أُرسل «طرح الوعاء» (T) إلى الميزان — ضع القطعة في الوعاء")
      : (SCALE_LINK.note || "لم يصل الأمر إلى الميزان"), ok ? "good" : "bad");
  };

  const noWay = !canBle && !canSerial && !SCALE_TEST_FEED.on;
  const way = L.transport === "ble" ? "بلوتوث" : L.transport === "serial" ? "USB / COM" : L.transport === "test" ? (SCALE_TEST_FEED.shown || "تجريبي") : "";
  const status = on ? `● متّصل — ${L.name || "الميزان"}${way ? ` (${way})` : ""}` : L.state === "connecting" ? `… ${L.note || "جارٍ الاتصال بالميزان"}` : "○ غير متّصل";
  const live = on && last ? (last.ok ? `${fmtW(last.grams)} جم` : last.why || "") : "";
  const alert = [noWay && scaleTransportFor({}).why, !on && L.error, on && !rd.ok && rd.why,
    on && silent && !L.lines && "متّصلٌ ولا تصل قراءات — تأكّد من «نوع الميزان» و«سرعة المنفذ» في إعداد الميزان",
    on && L.junk >= 3 && !last && "تصل بياناتٌ غير مفهومة — تأكّد من «سرعة المنفذ» (9600 غالبًا) و«نوع الميزان» في إعداد الميزان"].find(Boolean) || "";
  const hint = [countCat && "صنفٌ بالعدد: ضع على الميزان قطعةً واحدة — الوزن للقطعة الواحدة",
    on && auto && st && row && skip.why === "stale" && `على الميزان قراءةٌ سابقة (${fmtW(st.grams)} جم) — ارفع القطعة وضعها من جديد لتُكتب في ${rowLabel}، أو اضغط «اقرأ الوزن»`,
    on && auto && st && row && skip.why === "typed" && `وزن ${rowLabel} مكتوبٌ باليد فلا يغيّره الميزان — امسح الخانة أو اضغط «اقرأ الوزن» لتأخذ قراءته`].find(Boolean) || "";
  const chip = (active = false, dim = false) => ({ minHeight: 32, padding: "0 9px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 4, opacity: dim ? 0.55 : 1,
    background: active ? "var(--accentBg)" : "var(--panel)", color: active ? "var(--accent)" : "var(--text2)", border: `1px solid ${active ? "var(--accentLine)" : "var(--line)"}` });
  const canRead = on || !!onReadScale;
  return (
    <div data-scale-bar data-scale-state={L.state} className="mb-2" style={{ background: "var(--field)", border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`, borderRadius: 12, padding: "6px 8px" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <Scale size={14} color={on ? "var(--accent)" : "var(--text3)"} />
        <span data-scale-status className="text-[11px] font-bold" style={{ color: on ? "var(--good)" : L.state === "connecting" ? "var(--accentText)" : "var(--text3)" }}>الميزان: {status}</span>
        {live && (
          <span data-scale-live data-scale-stable={st ? "1" : "0"} className="text-[12px] font-bold" style={{ color: last?.ok ? (st ? "var(--good)" : "var(--accentText)") : "var(--bad)" }}>
            {live}{last?.ok ? (st ? " ✓ مستقرّ" : " … يتذبذب") : ""}
          </span>
        )}
        {on && row && <span data-scale-target className="text-[11px]" style={{ color: "var(--accentText)" }}>يكتب في {rowLabel}</span>}
        <span className="flex items-center gap-1 flex-wrap" style={{ marginInlineStart: "auto" }}>
          <button type="button" data-scale-connect onClick={() => connect()} disabled={L.state === "connecting" || busy === "connect"} className="text-[11px] font-bold" style={chip(on)}
            data-help={on ? "يقطع الاتصال بالميزان — استعمله حين تنتهي أو لتختار ميزانًا آخر."
              : "يصل التطبيق بالميزان عبر البلوتوث أو منفذ USB ويعرض قراءته هنا — اضغطه مرّةً واختر الميزان من القائمة، وبعدها يتذكّره ويعود وحده."}>
            {busy === "connect" || L.state === "connecting" ? <Loader2 size={13} className="animate-spin" /> : <RadioTower size={13} />}{on ? "افصل الميزان" : "اتصل بالميزان"}
          </button>
          {!on && L.state !== "connecting" && cfg.transport === "auto" && canBle && canSerial && (
            <button type="button" data-scale-serial onClick={() => connect("serial")} className="text-[11px] font-bold" style={chip(false)}
              data-help="يصل بالميزان عبر منفذ USB أو منفذ COM لبلوتوثٍ مقترنٍ من إعدادات النظام — استعمله إن لم يظهر الميزان في قائمة البلوتوث.">
              عبر USB / COM
            </button>
          )}
          <button type="button" data-scale-auto aria-pressed={auto} onClick={toggleAuto} className="text-[11px] font-bold" style={chip(auto)}
            data-help="يجعل وزن القطعة يأتي من الميزان إلى الصنف الحالي كلما استقرّت القراءة — شغّله مرّةً وضع كل قطعةٍ على الميزان؛ وما تكتبه بيدك في أي خانة يبقى كما كتبته.">
            <Zap size={13} />وزن تلقائي{auto ? " ✓" : ""}
          </button>
          {canRead && (
            <button type="button" data-scale-read onClick={readNow} disabled={busy === "read"} className="text-[11px] font-bold" style={chip(false)}
              data-help="يأخذ قراءة الميزان المستقرّة الآن ويكتبها في الصنف الحالي — ضع القطعة واضغطه؛ يفيد حين يكون الوزن التلقائي مطفأً، أو لإعادة وزن قطعةٍ كتبت وزنها بيدك.">
              {busy === "read" ? <Loader2 size={13} className="animate-spin" /> : <Scale size={13} />}اقرأ الوزن
            </button>
          )}
          {on && (
            <button type="button" data-scale-zero onClick={() => send("zero")} className="text-[11px] font-bold" style={chip(false, !hasCmd("zero"))}
              data-help="يرسل أمر التصفير (Z) إلى الميزان — اضغطه والكفّة فارغة إن لم تقرأ صفرًا.">
              <RotateCcw size={13} />تصفير
            </button>
          )}
          {on && (
            <button type="button" data-scale-tare onClick={() => send("tare")} className="text-[11px] font-bold" style={chip(false, !hasCmd("tare"))}
              data-help="يرسل أمر طرح الوعاء (T) إلى الميزان — ضع الوعاء أو الكيس فارغًا واضغطه، فيُحسب وزن ما تضعه فيه وحده.">
              <Minus size={13} />طرح الوعاء
            </button>
          )}
        </span>
      </div>
      {/* سطرُ ردٍّ واحد كي يبقى الشريط صغيرًا: التنبيه (إن خالف الرسالة) ثم ردّ آخر ضغطة ثم تلميح الصنف الحالي */}
      {(() => {
        const line = alert && alert !== msg?.text ? { key: "alert", text: alert, color: "var(--bad)" }
          : msg?.text ? { key: "msg", text: msg.text, color: msg.tone === "bad" ? "var(--bad)" : msg.tone === "good" ? "var(--good)" : "var(--text2)" }
          : hint ? { key: "hint", text: hint, color: "var(--accentText)" } : null;
        if (!line) return null;
        return (
          <p {...{ [`data-scale-${line.key}`]: "" }} role={line.key === "alert" ? "alert" : "status"} className="text-[11px] leading-5" style={{ margin: "4px 0 0", color: line.color }}>
            {line.text}
          </p>
        );
      })()}
    </div>
  );
}

export { CodingScaleBar };

