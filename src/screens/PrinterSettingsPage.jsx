import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { DEFAULT_PRINTER, PRINTER_SERVICES } from "../core/constants.js";
import { PURITY, fmt, fmtW } from "../core/money.js";
import { buildCalibrationCanvas } from "../domain/buildCalibrationCanvas.js";
import { bleWriteChunked, btSupported, codeToEpcHex, inputStyle, printLabelToDevice, sendRawToPrinter, tsplCalibrateBytes, tsplJobBytes, usbPrint } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { LabelLayoutEditor } from "../ui/LabelLayoutEditor.jsx";
import { MmInput } from "../ui/MmInput.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function PrinterSettingsPage({ config, onSave, sampleItem, currency, price24, onBack }) {
  const [cfg, setCfg] = useState({ ...DEFAULT_PRINTER, ...(config || {}) });
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const deviceRef = useRef(null);
  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  const supported = btSupported();

  // محاولة استعادة الاقتران السابق بلا مربّع اختيار
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supported || cfg.mode !== "bluetooth" || !cfg.deviceId) return;
      try {
        if (!navigator.bluetooth.getDevices) return;
        const known = await navigator.bluetooth.getDevices();
        const match = known.find((d) => d.id === cfg.deviceId);
        if (match && !cancelled) {
          deviceRef.current = match;
          setStatus(`مقترنة: ${match.name || cfg.deviceName || "طابعة"}`);
        }
      } catch (e) {
        if (!cancelled) setStatus("الطابعة لم تعد مقترنة — أعد الاقتران");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, cfg.mode, cfg.deviceId]);

  const pair = async () => {
    setError("");
    setBusy("pair");
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES,
      });
      deviceRef.current = device;
      const next = { ...cfg, mode: "bluetooth", deviceId: device.id, deviceName: device.name || "طابعة بلوتوث" };
      setCfg(next);
      onSave(next);
      setStatus(`اقترنت: ${device.name || "طابعة"}`);
    } catch (e) {
      // إلغاء المستخدم لمربّع الاختيار ليس خطأ
      if (e && e.name === "NotFoundError") setError("لم تُختَر طابعة");
      else setError("تعذّر الاقتران — تأكّد أن الطابعة مفتوحة وقريبة");
    } finally {
      setBusy("");
    }
  };

  const forget = () => {
    deviceRef.current = null;
    const next = { ...cfg, mode: "system", deviceId: null, deviceName: null };
    setCfg(next);
    onSave(next);
    setStatus("");
  };

  // ═══ سُلّم الفحص ═══
  //
  // ⚠ «لم تعمل» لا تُخبر بشيء. أربع درجات تعزل السبب:
  //   ① الوصل: هل نصل للطابعة أصلًا؟ (طلب اقتران/اختيار)
  //   ② الطابعة تسمع: SELFTEST يطبع صفحة إعداداتها — بلا رسمٍ ولا RFID
  //   ③ TSPL يعمل: نصٌّ لاتيني بخطّ الطابعة — بلا صورة
  //   ④ الملصق كاملًا — صورةٌ وRFID
  // إن نجحت ② وفشلت ④ فالخلل في الصورة/RFID لا الوصل.
  //
  // ⚠ متاحٌ فقط لوضعَي بلوتوث/USB — طابعة النظام لا تفهم TSPL.
  const [diag, setDiag] = useState([]);
  const log = (line) => setDiag((d) => [...d.slice(-12), `${new Date().toLocaleTimeString("en-GB")} ${line}`]);
  const sendRaw = async (text, label) => {
    const bytes = new TextEncoder().encode(text);
    log(`→ ${label}: ${bytes.length} بايت`);
    if (cfg.transport === "usb") {
      await usbPrint(bytes, cfg, (serial) => set("usbSerial", serial));
      log(`✓ أُرسل عبر USB`);
      return;
    }
    if (!deviceRef.current) throw new Error("لا طابعة بلوتوث — اضغط «اقتران» أولًا");
    log(`الجهاز: ${deviceRef.current.name || deviceRef.current.id}`);
    const server = await deviceRef.current.gatt.connect();
    log(`GATT متصل: ${server.connected}`);
    const services = await server.getPrimaryServices();
    log(`خدمات: ${services.length}`);
    for (const svc of services) {
      const chars = await svc.getCharacteristics();
      const w = chars.filter((c) => c.properties.write || c.properties.writeWithoutResponse);
      log(`خدمة ${svc.uuid.slice(0, 8)}: ${chars.length} خاصية، ${w.length} للكتابة`);
      if (w.length) {
        await bleWriteChunked(w[0], bytes);
        log(`✓ كُتب على ${w[0].uuid.slice(0, 8)}`);
        return;
      }
    }
    throw new Error("لا خاصية كتابة في أي خدمة — الطابعة قد تكون بلوتوث كلاسيكي (SPP) لا BLE");
  };
  const step2 = async () => { setError(""); setBusy("2"); try { await sendRaw("SELFTEST\r\n", "SELFTEST"); setStatus("② إن طُبعت صفحة الإعدادات فالوصل سليم"); } catch (e) { setError(String(e?.message || e)); log(`✗ ${e?.message || e}`); } finally { setBusy(""); } };
  const step3 = async () => { setError(""); setBusy("3"); try {
    await sendRaw(`SIZE ${cfg.labelWidthMm || 50} mm, ${cfg.labelHeightMm || 30} mm\r\nGAP ${cfg.gapMm ?? 2} mm, 0 mm\r\nCLS\r\nTEXT 30,30,"3",0,1,1,"OQIYYAH TEST"\r\nBARCODE 30,80,"128",60,1,0,2,2,"R7K2M9PQ"\r\nPRINT 1,1\r\n`, "TSPL نصّ");
    setStatus("③ إن طُبع نصٌّ وباركود فـTSPL يعمل — الخلل في الصورة أو RFID"); } catch (e) { setError(String(e?.message || e)); log(`✗ ${e?.message || e}`); } finally { setBusy(""); } };

  /// يجعل الطابعة تقيس الورق بنفسها وتحفظ المقاس.
  const calibrate = async () => {
    setError(""); setBusy("cal");
    try {
      const bytes = tsplCalibrateBytes({
        widthMm: cfg.labelWidthMm || 50,
        heightMm: cfg.labelHeightMm || 20,
        gapMm: cfg.gapMm ?? 2,
      });
      await sendRawToPrinter(bytes, cfg, deviceRef, (serial) => set("usbSerial", serial));
      setStatus("أُرسل أمر القياس — ستسحب الطابعة ورقتين وتقيسهما. انتظر توقّفها ثم اطبع الإطار.");
    } catch (e) { setError(String(e?.message || e)); } finally { setBusy(""); }
  };

  /// يطبع إطارًا يملأ الورقة — يُرى فورًا إن كان المقاس صحيحًا.
  const printCalLabel = async () => {
    setError(""); setBusy("calprint");
    try {
      const canvas = buildCalibrationCanvas({
        widthMm: cfg.labelWidthMm || 50,
        heightMm: cfg.labelHeightMm || 20,
        dpi: Number(cfg.dpi) || 203,
      });
      // ⚠ بلا RFID في إطار الفحص: يُطبع مرارًا حتى يضبط المقاس، وكتابة
      // رقاقةٍ في كل مرة تُتلف رقائق بلا فائدة.
      const bytes = tsplJobBytes({ canvas, cfg: { ...cfg, rfid: false }, copies: 1, code: "" });
      await sendRawToPrinter(bytes, cfg, deviceRef, (serial) => set("usbSerial", serial));
      setStatus("طُبع الإطار — إن انقطع من جهةٍ فالمقاس أكبر من ورقك، وإن بقي فراغٌ واسع فأصغر.");
    } catch (e) { setError(String(e?.message || e)); } finally { setBusy(""); }
  };

  const testPrint = async () => {
    setError("");
    setBusy("test");
    try {
      if (cfg.mode === "bluetooth" || cfg.transport === "usb") {
        const r = await printLabelToDevice({
          item: sampleItem || { description: "تجربة طباعة", karat: 21, weight: 5.25, ref: "TEST-001" },
          code: "TEST-001", cfg, currency, price24, deviceRef,
          onRemember: (serial) => set("usbSerial", serial),
        });
        setStatus(`أُرسل ${Math.round(r.bytes / 1024)} ك بلغة ${r.lang === "tspl" ? "TSPL (ملصقات)" : "ESC/POS"} عبر ${r.transport === "usb" ? "USB" : "بلوتوث"}`);
      } else {
        window.print();
        setStatus("أُرسل لطابعة النظام");
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy("");
    }
  };

  const sample = sampleItem || { karat: 21, weight: 12.4, categoryId: "chain", units: [{ code: "A1001" }] };
  const samplePrice = (Number(sample.weight) || 0) * (PURITY[sample.karat] || sample.karat / 24) * (price24 || 0);
  const isLabelPrinter = cfg.mode === "bluetooth" || cfg.transport === "usb";

  return (
    <div>
      <SubPageHeader title="إعدادات الطابعة" onBack={onBack} />
      <div className="px-4 pt-3">
        {/* طريقة الطباعة */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">طريقة الطباعة</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { id: "system", label: "طابعة النظام", hint: "تعمل دائمًا" },
            { id: "bluetooth", label: "بلوتوث", hint: supported ? "طابعة ملصقات" : "غير مدعوم هنا" },
          ].map((o) => {
            const disabled = o.id === "bluetooth" && !supported;
            const on = cfg.mode === o.id;
            return (
              <button
                key={o.id}
                disabled={disabled}
                onClick={() => set("mode", o.id)}
                className="py-2.5 rounded-xl text-[11px] font-bold text-right px-2.5"
                style={{
                  background: on ? "var(--accentBg)" : "var(--panel)",
                  color: disabled ? "var(--accentLine)" : on ? "var(--accent)" : "var(--text2)",
                  border: `1px solid ${on ? "var(--accentLine)" : "var(--edge)"}`,
                }}
              >
                {o.label}
                <span style={{ color: "var(--text3)" }} className="block text-[10px]">{o.hint}</span>
              </button>
            );
          })}
        </div>

        {cfg.mode === "bluetooth" && (
          <Card style={{ padding: 14, marginBottom: 12, border: `1px solid ${cfg.deviceId ? "var(--goodLine)" : "var(--edge)"}` }}>
            {!supported ? (
              <p style={{ color: "var(--bad)" }} className="text-[11px]">
                هذا المتصفح لا يدعم البلوتوث. استخدم Chrome على أندرويد أو ويندوز، أو اختر طابعة النظام.
              </p>
            ) : cfg.deviceId ? (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: "var(--good)" }} className="text-xs font-bold flex items-center gap-1.5">
                    <Check size={13} /> {cfg.deviceName}
                  </span>
                  <button
                    onClick={forget}
                    className="text-[10px] px-2 py-1 rounded-full"
                    style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
                  >
                    نسيان
                  </button>
                </div>
                <p style={{ color: "var(--text3)" }} className="text-[10px]">
                  الاقتران محفوظ — لن يُطلب اختيار الطابعة في كل مرة.
                </p>
              </>
            ) : (
              <>
                <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
                  افتح الطابعة وقرّبها، ثم اقترن مرة واحدة. يُحفظ الاختيار للجلسات القادمة.
                </p>
                <button
                  onClick={pair}
                  disabled={busy === "pair"}
                  className="w-full py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
                >
                  {busy === "pair" ? "جارٍ البحث..." : "اقتران بطابعة"}
                </button>
              </>
            )}
          </Card>
        )}

        {status && <p style={{ color: "var(--good)" }} className="text-[11px] mb-2">{status}</p>}
        {error && <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">{error}</p>}

        {/* ── إعدادات خاصة بطابعات الملصقات (بلوتوث/USB) ── */}
        {isLabelPrinter && (
          <>
            {/* ── نوع الطابعة وطريقة الوصل ── */}
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">إعدادات طابعة الملصقات</p>
            <Card style={{ padding: 14, marginBottom: 12 }}>
              <Field label="شعار المحل على الملصق — اختره من جهازك">
                <input type="file" accept="image/*" style={{ ...inputStyle, padding: 6, fontSize: 11 }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (!f) return;
                    const r = new FileReader(); r.onload = () => { set("customLogo", r.result); set("showLogo", true); }; r.readAsDataURL(f); }} />
              </Field>
              {cfg.customLogo ? (
                <div className="flex items-center gap-2 mb-2">
                  <img src={cfg.customLogo} alt="" style={{ height: 36, background: "#fff", borderRadius: 6, padding: 2 }} />
                  <button onClick={() => { set("customLogo", null); set("showLogo", false); }} className="px-2 py-1 rounded-lg text-[10px]"
                    style={{ background: "var(--field)", color: "var(--text3)", border: "1px solid var(--line)" }}>إزالة</button>
                </div>
              ) : (
                <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[10px]">لا شعار — الملصق يُطبع بلا شعار حتى تختار صورة.</p>
              )}
              <p style={{ color: "var(--text3)", margin: "0 0 10px" }} className="text-[10px] leading-6">
                طابعات ملصقاتٍ ورقائق RFID بلغة TSPL — لا طباعة فواتير هنا.
              </p>
              <Field label="الوصل">
                <div className="grid grid-cols-2 gap-1.5">
                  {[["bluetooth", "بلوتوث"], ["usb", "USB"]].map(([v, l]) => (
                    <button key={v} onClick={() => set("transport", v)} className="py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: cfg.transport === v ? "var(--accentBg)" : "var(--field)",
                        color: cfg.transport === v ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
                  ))}
                </div>
              </Field>
              {cfg.transport === "usb" && (
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
                  USB يعمل في <b>كروم على الحاسب وأندرويد</b> (لا سفاري). أول تجربةٍ تفتح مربّع اختيار الطابعة ثم تُذكَر.
                  {cfg.usbSerial ? ` · مربوطة: ${cfg.usbSerial}` : ""}
                  {typeof navigator !== "undefined" && !navigator.usb && <><br />⚠ هذا المتصفّح لا يدعم WebUSB.</>}
                </p>
              )}
            </Card>

            {/* ── سُلّم الفحص ── */}
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">الطابعة لم تعمل؟ — افحص درجةً درجة</p>
            <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[10px] leading-6">
                كل زرٍّ يعزل سببًا. ابدأ من الأول، وأرسل ما ظهر هنا مع ما خرج من الطابعة.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button onClick={step2} disabled={!!busy} className="py-2 rounded-xl text-[11px] font-bold"
                  style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                  {busy === "2" ? "…" : "② SELFTEST — صفحة الإعدادات"}
                </button>
                <button onClick={step3} disabled={!!busy} className="py-2 rounded-xl text-[11px] font-bold"
                  style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                  {busy === "3" ? "…" : "③ نصٌّ وباركود بلا صورة"}
                </button>
              </div>
              <p style={{ color: "var(--text3)", margin: "0 0 6px" }} className="text-[10px]">
                ④ «طباعة تجريبية» في الأسفل = الملصق كاملًا بالصورة وRFID.
              </p>
              {diag.length > 0 && (
                <pre style={{ background: "var(--bg)", color: "var(--text2)", padding: 8, borderRadius: 8, fontSize: 10,
                  direction: "ltr", textAlign: "left", whiteSpace: "pre-wrap", margin: 0, maxHeight: 180, overflow: "auto" }}>
                  {diag.join("\n")}
                </pre>
              )}
              {diag.length > 0 && (
                <button onClick={() => { navigator.clipboard?.writeText(diag.join("\n")); setStatus("نُسخ السجل"); }}
                  className="w-full mt-2 py-1.5 rounded-lg text-[10px]"
                  style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                  انسخ السجل لإرساله
                </button>
              )}
            </Card>

            {/* ── RFID ── */}
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">رقاقة RFID</p>
            <Card style={{ padding: 14, marginBottom: 12 }}>
              <button onClick={() => set("rfid", !cfg.rfid)} className="w-full py-2 rounded-xl text-[11px] font-bold mb-2"
                style={{ background: cfg.rfid ? "var(--accentBg)" : "var(--field)",
                  color: cfg.rfid ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
                {cfg.rfid ? "✓ يُكتب الرمز في الرقاقة مع كل ملصق" : "الكتابة في الرقاقة معطّلة"}
              </button>
              {cfg.rfid && (
                <>
                  <Field label="أمر الكتابة — {HEX} يُستبدل بالرمز (12 بايت)">
                    <input style={{ ...inputStyle, fontFamily: "monospace", direction: "ltr" }} value={cfg.rfidCommand || ""}
                      onChange={(e) => set("rfidCommand", e.target.value)} />
                  </Field>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
                    ⚠ الأمر يختلف بين الشركات. الافتراضي صيغة TSC. راجع دليل SDK طابعتك —
                    السطر الذي فيه <b>RFID</b> — والصقه هنا بنفس الشكل.
                    <br />مثال لرمز <b>R7K2M9PQ</b>: <span style={{ fontFamily: "monospace", direction: "ltr", display: "inline-block" }}>{codeToEpcHex("R7K2M9PQ")}</span>
                  </p>
                </>
              )}
            </Card>

            {/* ── تخطيط الملصق ── */}
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">تخطيط الملصق — اسحب بإصبعك</p>
            <Card style={{ padding: 14, marginBottom: 12 }}>
              {/* ══ ① المقاس والمعايرة — قبل أي شيء ══ */}
              <Card style={{ padding: 11, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
                <p style={{ color: "var(--accent)", margin: "0 0 5px" }} className="text-[11px] font-bold">
                  ① مقاس الورق — قِسه بمسطرة
                </p>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {/* ⚠ المقاس يُحفظ فورًا لا بزرّ حفظ: من عايَر ثم خرج بلا حفظ
                      يعود فيجد المقاس القديم، ويظنّ المعايرة فشلت. */}
                  <MmInput label="العرض" value={cfg.labelWidthMm} max={120}
                    onCommit={(v) => { const n = { ...cfg, labelWidthMm: v }; setCfg(n); onSave(n); }} />
                  <MmInput label="الطول" value={cfg.labelHeightMm} max={200}
                    onCommit={(v) => { const n = { ...cfg, labelHeightMm: v }; setCfg(n); onSave(n); }} />
                  <MmInput label="الفجوة" value={cfg.gapMm ?? 2} max={10} width={44}
                    onCommit={(v) => { const n = { ...cfg, gapMm: v }; setCfg(n); onSave(n); }} />
                  <span style={{ color: "var(--text3)" }} className="text-[9px]">مم</span>
                </div>
                {/* ══ الدقّة — أخطر رقمٍ في الشاشة ══ */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span style={{ color: "var(--text3)" }} className="text-[10px]">دقّة الطابعة</span>
                  {[203, 300].map((d) => {
                    const on = (Number(cfg.dpi) || 203) === d;
                    return (
                      <button key={d}
                        onClick={() => { const n = { ...cfg, dpi: d }; setCfg(n); onSave(n); }}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
                        style={{ background: on ? "var(--accentBg)" : "var(--field)",
                          color: on ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>
                        {d} dpi
                      </button>
                    );
                  })}
                  <span style={{ color: "var(--text3)", marginRight: "auto" }} className="text-[9px]">
                    {Math.round((cfg.labelWidthMm || 50) / 25.4 * (Number(cfg.dpi) || 203))} نقطة
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={calibrate} disabled={busy === "cal"}
                    className="py-2.5 rounded-xl text-[11px] font-bold"
                    style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
                    {busy === "cal" ? "يقيس…" : "عايِر الطابعة"}
                  </button>
                  <button onClick={printCalLabel} disabled={busy === "calprint"}
                    className="py-2.5 rounded-xl text-[11px] font-bold"
                    style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                    {busy === "calprint" ? "يطبع…" : "اطبع إطار الفحص"}
                  </button>
                </div>
                {/* ⚠ الشرح تحت الزرّ لا في دليلٍ منفصل: من يُعايِر يحتاج أن
                    يعرف ماذا يرى وماذا يفعل به. */}
                <div style={{ background: "var(--bg)", borderRadius: 10, padding: 10, marginTop: 8 }}>
                  <p style={{ color: "var(--accentText)", margin: "0 0 4px" }} className="text-[10px] font-bold">
                    كيف تضبطها — بالترتيب
                  </p>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-7">
                    <b>①</b> قِس الملصق بمسطرة واكتب العرض والطول.<br />
                    <b>②</b> «عايِر الطابعة» — تسحب ورقتين وتقيسهما بنفسها.<br />
                    <b>③</b> «اطبع إطار الفحص» ثم <b>قِس الإطار المطبوع بمسطرة</b>:
                  </p>
                  <div style={{ borderTop: "1px solid var(--line)", marginTop: 6, paddingTop: 6 }}>
                    <p style={{ color: "var(--good)", margin: 0 }} className="text-[10px] leading-7">
                      ✓ <b>يملأ الملصق تمامًا</b> — انتهيتَ.
                    </p>
                    <p style={{ color: "var(--bad)", margin: "3px 0 0" }} className="text-[10px] leading-7">
                      ⚠ <b>أصغر بنحو الثلث</b> (علامة 40 عند 27 مم مثلًا) — <b>الدقّة خاطئة</b>:
                      بدّلها إلى {(Number(cfg.dpi) || 203) === 203 ? "300" : "203"} dpi وأعد.
                      <br />⚠ <b>أصغر أو أكبر قليلًا</b> — المقاس خاطئ: عدّل الأرقام أعلاه وأعد.
                      <br />⚠ <b>انقطع من جهة</b> — المقاس أكبر من ورقك.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="flex gap-1.5 mb-2">
                {[["barcode", "باركود"], ["qr", "QR"]].map(([v, l]) => (
                  <button key={v} onClick={() => set("symbology", v)} className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                    style={{ background: (cfg.symbology || "barcode") === v ? "var(--accentBg)" : "var(--field)",
                      color: (cfg.symbology || "barcode") === v ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
                ))}
              </div>
              <LabelLayoutEditor cfg={cfg} onChange={(layout) => set("layout", layout)} sampleItem={sampleItem} currency={currency} price24={price24} />
            </Card>
          </>
        )}

        {/* مقاس الملصق */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">مقاس الملصق</p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <div className="grid grid-cols-3 gap-2">
            <Field label="العرض (مم)">
              <NumericInput value={String(cfg.labelWidthMm)} onChange={(v) => set("labelWidthMm", Number(v) || 0)} />
            </Field>
            <Field label="الارتفاع (مم)">
              <NumericInput value={String(cfg.labelHeightMm)} onChange={(v) => set("labelHeightMm", Number(v) || 0)} />
            </Field>
            <Field label="الفجوة (مم)">
              <NumericInput value={String(cfg.gapMm ?? 2)} onChange={(v) => set("gapMm", Number(v) || 0)} />
            </Field>
            <Field label="عدد النسخ">
              <NumericInput value={String(cfg.copies)} onChange={(v) => set("copies", Math.max(1, Number(v) || 1))} />
            </Field>
          </div>
          <Field label={`كثافة الطباعة (${cfg.density}/15)`}>
            <input
              type="range"
              min="0"
              max="15"
              value={cfg.density}
              onChange={(e) => set("density", Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
              كثافة أعلى تُنتج طباعة أوضح وتستهلك الرأس أسرع.
            </p>
          </Field>
        </Card>

        {/* محتوى الملصق */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">محتوى الملصق</p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          {[
            ["showKarat", "العيار", ""],
            ["showWeight", "الوزن", ""],
            ["showLogo", "الشعار", ""],
            ["showPrice", "السعر", "⚠ السعر على الرقاقة يُلزمك به أمام العميل حتى لو تغيّر السوق"],
            ["autoCut", "قطع تلقائي", "للطابعات التي تدعمه"],
          ].map(([k, label, hint]) => (
            <div key={k} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--line)" }}>
              <span>
                <span style={{ color: "var(--text)" }} className="text-xs">{label}</span>
                {hint && <span style={{ color: "var(--text3)" }} className="block text-[10px]">{hint}</span>}
              </span>
              <button
                onClick={() => set(k, !cfg[k])}
                style={{
                  width: 42, height: 23, borderRadius: 12, flexShrink: 0,
                  background: cfg[k] ? "var(--goodSolid)" : "var(--edge)", position: "relative",
                }}
              >
                <div style={{ width: 17, height: 17, borderRadius: "50%", background: "var(--text)", position: "absolute", top: 3, right: cfg[k] ? 22 : 3, transition: "right .2s" }} />
              </button>
            </div>
          ))}
        </Card>

        {/* معاينة */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">المعاينة</p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <div
            style={{
              width: `${Math.max(30, cfg.labelWidthMm) * 2.4}px`,
              height: `${Math.max(18, cfg.labelHeightMm) * 2.4}px`,
              background: "var(--text)",
              borderRadius: 4,
              margin: "0 auto",
              padding: 8,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 2,
            }}
          >
            {cfg.showLogo && (
              <span style={{ color: "var(--panel)", fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>ounce</span>
            )}
            <span style={{ color: "var(--panel)", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
              {(sample.units || [{}])[0].code || "A1001"}
            </span>
            <span style={{ color: "var(--panel)", fontSize: 9 }}>
              {cfg.showKarat ? `عيار ${sample.karat}` : ""}
              {cfg.showKarat && cfg.showWeight ? " · " : ""}
              {cfg.showWeight ? `${fmtW(sample.weight)} جم` : ""}
            </span>
            {cfg.showPrice && (
              <span style={{ color: "var(--panel)", fontSize: 9, fontWeight: 700 }}>
                {currency}{fmt(samplePrice, 0)}
              </span>
            )}
            <div style={{ display: "flex", gap: 1, marginTop: 2 }}>
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} style={{ width: i % 3 === 0 ? 2 : 1, height: 12, background: "var(--panel)" }} />
              ))}
            </div>
          </div>
          <p style={{ color: "var(--text3)" }} className="text-[10px] text-center mt-2">
            {cfg.labelWidthMm} × {cfg.labelHeightMm} مم · {cfg.copies} نسخة
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={testPrint}
            disabled={!!busy}
            className="py-2.5 rounded-xl text-xs font-bold"
            style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
          >
            {busy === "test" ? "جارٍ..." : "طباعة تجريبية"}
          </button>
          <button
            onClick={() => {
              onSave(cfg);
              setStatus("حُفظت الإعدادات");
            }}
            className="py-2.5 rounded-xl text-xs font-bold"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
          >
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}

export { PrinterSettingsPage };
