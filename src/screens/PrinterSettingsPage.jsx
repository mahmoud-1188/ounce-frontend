import React, { useEffect, useRef, useState } from "react";
import { labelModelList, renameLabelModel } from "../domain/labelModels.js";
import { LabelModelPicker } from "../ui/LabelModelPicker.jsx";
import { Check } from "lucide-react";
import { DEFAULT_PRINTER, PRINTER_SERVICES } from "../core/constants.js";
import { PURITY, fmt, fmtW } from "../core/money.js";
import { buildCalibrationCanvas } from "../domain/buildCalibrationCanvas.js";
import { buildPlateEpc } from "../domain/buildPlateEpc.js";
import { CALIBRATE_MODES, askPrinter, bleWriteChunked, btSupported, codeToEpcHex, inputStyle, printLabelToDevice, sendRawToPrinter, tsplCalibrateBytes, tsplJobBytes, tsplOffsetBytes, usbPrint, zplOffsetBytes } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { LabelLayoutEditor } from "../ui/LabelLayoutEditor.jsx";
import { MmInput } from "../ui/MmInput.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";
import { rememberBluetoothDevice } from "../domain/labelPrint.js";
import { RfidSettingsCard } from "../ui/RfidSettingsCard.jsx";
import { PayTerminalCard } from "../ui/PayTerminalCard.jsx";

// قوالب الضبط المحفوظة على هذا الجهاز (بلا الجهاز المقترن: معرّفه خاصٌّ بهذا الجوّال)
const PRESETS_KEY = "ounce_printer_presets_v1";
const readPresets = () => { try { const v = JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };

function PrinterSettingsPage({ config, onSave, sampleItem, currency, price24, onBack, settings = null, onSaveSettings = null, rfidCfg = null, onSaveRfid = null }) {
  const [cfg, setCfg] = useState({ ...DEFAULT_PRINTER, ...(config || {}) });
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const deviceRef = useRef(null);
  const [showBytes, setShowBytes] = useState("");
  const [calPrinted, setCalPrinted] = useState(false);
  const [askRfid, setAskRfid] = useState(false);
  const [askResult, setAskResult] = useState(null);
  const [presets, setPresets] = useState(readPresets);
  const [presetName, setPresetName] = useState("");
  const [importText, setImportText] = useState("");
  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  // ما يغيّر الطباعة نفسها يُحفظ فورًا — كان مفتاح الرقاقة يضيع إن خرج المستخدم قبل «حفظ»
  const setNow = (k, v) => setCfg((p) => { const n = { ...p, [k]: v }; onSave(n); return n; });
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
          rememberBluetoothDevice(match);
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
      rememberBluetoothDevice(device);
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
    rememberBluetoothDevice(null);
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
    await sendRaw(`SIZE ${cfg.labelWidthMm || 50} mm, ${cfg.labelHeightMm || 30} mm\r\nGAP ${cfg.gapMm ?? 2} mm, 0 mm\r\nCLS\r\nTEXT 30,30,"3",0,1,1,"AWNSAH TEST"\r\nBARCODE 30,80,"128",60,1,0,2,2,"R7K2M9PQ"\r\nPRINT 1,1\r\n`, "TSPL نصّ");
    setStatus("③ إن طُبع نصٌّ وباركود فـTSPL يعمل — الخلل في الصورة أو RFID"); } catch (e) { setError(String(e?.message || e)); log(`✗ ${e?.message || e}`); } finally { setBusy(""); } };

  /// ⑤ الرقاقة وحدها: أمر الكتابة كما سيُرسل + سطر نصٍّ — يعزل «الطابعة لا تفهم أمر RFID» عن الصورة
  const stepRfid = async () => {
    setError(""); setBusy("rfid");
    try {
      if (cfg.rfidMode === "zpl") {
        const hex = buildPlateEpc({ code: "R7K2M9PQ", storeId: cfg.storeId || 0 });
        await sendRaw(`^XA^RS8,,,1,N^RFW,H^FD${hex}^FS^FO40,40^A0N,40,40^FDRFID R7K2M9PQ^FS^PQ1^XZ\r\n`, "RFID وحده (ZPL)");
        setStatus("⑤ اقرأ الرقاقة بالقارئ: إن بدأ رقمها بـ 52374B32 فالكتابة تعمل");
        setAskRfid(true);
        return;
      }
      const line = String(cfg.rfidCommand || 'RFID WRITE,H,0,96,EPC,"{HEX}"').replace("{HEX}", buildPlateEpc({ code: "R7K2M9PQ", storeId: cfg.storeId || 0 })).replace("{CODE}", "R7K2M9PQ");
      log(`أمر الرقاقة: ${line}`);
      await sendRaw(`SIZE ${cfg.labelWidthMm || 50} mm, ${cfg.labelHeightMm || 30} mm\r\nGAP ${cfg.gapMm ?? 2} mm, 0 mm\r\nCLS\r\n${line}\r\nTEXT 30,30,"3",0,1,1,"RFID R7K2M9PQ"\r\nPRINT 1,1\r\n`, "RFID وحده");
      setStatus("⑤ اقرأ الرقاقة بالقارئ: إن ظهر R7K2M9PQ فالكتابة تعمل — وإن طُبع النص بلا كتابة فالطابعة لا تفهم صيغة الأمر، جرّب الصيغة الأخرى");
      setAskRfid(true);
    } catch (e) { setError(String(e?.message || e)); log(`✗ ${e?.message || e}`); } finally { setBusy(""); }
  };

  /// ⑥ أربع صيغٍ لأمر الكتابة على أربع ملصقات — كلّ ملصقٍ برمزٍ يدلّ على صيغته (FMTA…FMTD).
  ///   الطابعات تتجاهل الأمر الذي لا تفهمه بصمت؛ فالرقاقة التي تُقرأ برمزها تكشف الصيغة الصحيحة.
  const RFID_FORMATS = [
    { id: "A", label: "TSC كاملة", cmd: 'RFID WRITE,H,0,96,EPC,"{HEX}"' },
    { id: "B", label: "TSC من الكتلة 2", cmd: 'RFID WRITE,H,2,96,EPC,"{HEX}"' },
    { id: "C", label: "مختصرة", cmd: 'RFID WRITE,EPC,"{HEX}"' },
    { id: "D", label: "ZPL", zpl: true },
  ];
  const stepFormats = async () => {
    setError(""); setBusy("fmt");
    try {
      for (const f of RFID_FORMATS) {
        const code = `FMT${f.id}`;
        const hex = buildPlateEpc({ code, storeId: cfg.storeId || 0 });
        if (f.zpl) {
          await sendRaw(`^XA^RS8,,,1,N^RFW,H^FD${hex}^FS^FO40,40^A0N,40,40^FD${code} ZPL^FS^PQ1^XZ\r\n`, `${code} (ZPL)`);
        } else {
          const line = f.cmd.replace("{HEX}", hex);
          log(`${code}: ${line}`);
          await sendRaw(`SIZE ${cfg.labelWidthMm || 50} mm, ${cfg.labelHeightMm || 30} mm\r\nGAP ${cfg.gapMm ?? 2} mm, 0 mm\r\nCLS\r\n${line}\r\nTEXT 30,30,"3",0,1,1,"${code}"\r\nPRINT 1,1\r\n`, code);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      setStatus("⑥ طُبعت 4 ملصقات (FMTA…FMTD). اقرأ رقاقة كلٍّ منها: الصحيحة تبدأ بـ 464D54 ثم 41/42/43/44 — واختر صيغتها أدناه");
    } catch (e) { setError(String(e?.message || e)); log(`✗ ${e?.message || e}`); } finally { setBusy(""); }
  };

  /// يجعل الطابعة تقيس الورق بنفسها وتحفظ المقاس.
  const calibrate = async () => {
    setError(""); setBusy("cal");
    try {
      const bytes = tsplCalibrateBytes({
        widthMm: cfg.labelWidthMm || 50,
        heightMm: cfg.labelHeightMm || 20,
        gapMm: cfg.gapMm ?? 2,
        offsetMm: cfg.labelOffsetMm ?? 0,
        shiftDots: cfg.labelShiftDots ?? 0,
        mode: cfg.calibrateMode || "gapdetect",
      });
      setShowBytes(new TextDecoder().decode(bytes));
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
      setStatus("طُبع الإطار — قِسه بمسطرة واختر تحته كيف خرج.");
      setCalPrinted(true);
    } catch (e) { setError(String(e?.message || e)); } finally { setBusy(""); }
  };

  /// الإزاحة وحدها — بلغة الطابعة: ZPL (~TA و^LT) أو TSPL (OFFSET وSHIFT)
  const applyOffset = async () => {
    setError(""); setBusy("offset");
    try {
      const bytes = cfg.rfidMode === "zpl"
        ? zplOffsetBytes({ offsetMm: cfg.labelOffsetMm ?? 0, shiftDots: cfg.labelShiftDots ?? 0, dpi: cfg.dpi })
        : tsplOffsetBytes({ widthMm: cfg.labelWidthMm || 50, heightMm: cfg.labelHeightMm || 20, gapMm: cfg.gapMm ?? 2, offsetMm: cfg.labelOffsetMm ?? 0, shiftDots: cfg.labelShiftDots ?? 0 });
      setShowBytes(new TextDecoder().decode(bytes));
      await sendRawToPrinter(bytes, cfg, deviceRef, (serial) => set("usbSerial", serial));
      onSave(cfg);
      setStatus("✓ أُرسلت الإزاحة — اطبع إطار الفحص لترى أثرها.");
    } catch (e) { setError(String(e?.message || e)); } finally { setBusy(""); }
  };

  const askDevice = async () => {
    setError(""); setBusy("ask"); setAskResult(null);
    try {
      const r = await askPrinter(cfg, deviceRef);
      setAskResult(r);
      setStatus(r.supported ? (r.text ? "ردّت الطابعة" : "لم تردّ — قد لا تدعم السؤال") : "");
    } catch (e) { setError(String(e?.message || e)); } finally { setBusy(""); }
  };

  // يعيد إعدادات التطبيق لا الطابعة — والاقتران كما هو
  const factoryReset = () => {
    if (!window.confirm("إعادة إعدادات الملصق في التطبيق للبداية؟ الاقتران يبقى كما هو.")) return;
    const n = { ...DEFAULT_PRINTER, deviceId: cfg.deviceId, deviceName: cfg.deviceName, usbSerial: cfg.usbSerial, mode: cfg.mode, transport: cfg.transport };
    setCfg(n); onSave(n);
    setStatus("✓ عادت إعدادات التطبيق للبداية — والطابعة مقترنةٌ كما هي.");
  };

  const savePresets = (next) => { setPresets(next); try { localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); } catch { /* تخزينٌ محجوب */ } };
  const savePreset = () => {
    const name = presetName.trim() || `ملصق ${cfg.labelWidthMm || "?"}×${cfg.labelHeightMm || "?"} مم`;
    const { deviceId, deviceName, usbSerial, ...keep } = cfg; // eslint-disable-line no-unused-vars
    savePresets([...presets.filter((x) => x.name !== name), { name, at: new Date().toISOString().slice(0, 10), cfg: keep }].slice(-8));
    setPresetName("");
    setStatus(`✓ حُفظ الضبط باسم «${name}»`);
  };
  const copySettings = async () => {
    const txt = JSON.stringify({ v: 1, kind: "printerSettings", at: new Date().toISOString(), cfg }, null, 1);
    try { await navigator.clipboard.writeText(txt); setStatus("نُسخت الإعدادات — احفظها عندك"); }
    catch { setImportText(txt); setStatus("انسخها من الصندوق أدناه"); }
  };
  const pasteSettings = () => {
    setError("");
    try {
      const o = JSON.parse(importText.trim());
      const incoming = o?.kind === "printerSettings" ? o.cfg : o;
      if (!incoming || typeof incoming !== "object") throw new Error("ليست إعدادات طابعة");
      const next = { ...DEFAULT_PRINTER, ...incoming, deviceId: cfg.deviceId, deviceName: cfg.deviceName, usbSerial: cfg.usbSerial };
      setCfg(next); onSave(next); setImportText("");
      setStatus(`استُرجعت — ${next.labelWidthMm}×${next.labelHeightMm} مم · ${next.dpi || 203} dpi`);
    } catch (e) { setError(`تعذّرت القراءة: ${e?.message || e}`); }
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
        setStatus(`أُرسل ${Math.round(r.bytes / 1024)} ك بلغة ${r.lang === "zpl" ? "ZPL (مع الرقاقة)" : r.lang === "tspl" ? "TSPL (ملصقات)" : "ESC/POS"} عبر ${r.transport === "usb" ? "USB" : "بلوتوث"}`);
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
        {/* طابعتان منفصلتان: الملصقات هنا، والفواتير من سجلّ المبيعات على طابعة الجهاز */}
        <Card style={{ padding: 12, marginBottom: 12, background: "var(--field)" }}>
          <div data-print-split>
            <p style={{ color: "var(--text)", margin: 0 }} className="text-[12px] font-bold">طابعتان منفصلتان</p>
            <p style={{ color: "var(--text2)", margin: "4px 0 0" }} className="text-[11px] leading-6">
              🏷 <b>ملصقات التكويد</b>: هنا — على طابعة الملصقات مباشرةً، الرقاقة مع كل ملصق.<br />
              🧾 <b>الفواتير</b>: {settings?.invoicePrintOn
                ? <>من سجلّ المبيعات على طابعة الجهاز العادية — لا تشترك في إعدادٍ مع الملصقات.</>
                : <><b>معطّلة في الفرع حاليًا</b> — المفعّل طباعة ملصقات التكويد وحدها.</>}
            </p>
            {onSaveSettings && settings && (
              <button type="button" data-invoice-print-toggle onClick={() => onSaveSettings({ ...settings, invoicePrintOn: !settings.invoicePrintOn })}
                className="mt-2 px-3 rounded-xl text-[11px] font-bold" style={{ minHeight: 36, background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                {settings.invoicePrintOn ? "عطّل طباعة الفواتير" : "فعّل طباعة الفواتير"}
              </button>
            )}
          </div>
        </Card>

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
              <button onClick={stepRfid} disabled={!!busy || !cfg.rfid} className="w-full py-2 rounded-xl text-[11px] font-bold mb-2"
                style={{ background: "var(--field)", color: cfg.rfid ? "var(--text2)" : "var(--text3)", border: "1px solid var(--line)" }}>
                {busy === "rfid" ? "…" : cfg.rfid ? "⑤ اكتب رقاقةً تجريبية فقط (R7K2M9PQ)" : "⑤ فعّل «الكتابة في الرقاقة» أدناه لتجربتها"}
              </button>
              <button onClick={stepFormats} disabled={!!busy} className="w-full py-2 rounded-xl text-[11px] font-bold mb-2"
                style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                {busy === "fmt" ? "… جارٍ طباعة 4 ملصقات" : "⑥ جرّب 4 صيغ للرقاقة — FMTA · FMTB · FMTC · FMTD"}
              </button>
              <button onClick={askDevice} disabled={!!busy} className="w-full py-2 rounded-xl text-[11px] font-bold mb-2"
                style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                {busy === "ask" ? "يسأل…" : "اسأل الطابعة عن طرازها"}
              </button>
              {askResult && (
                <div data-ask-result style={{ background: "var(--bg)", borderRadius: 10, padding: 10, marginBottom: 8 }}>
                  {!askResult.supported ? (
                    <p style={{ color: "var(--bad)", margin: 0 }} className="text-[11px] leading-7">⚠ {askResult.reason}</p>
                  ) : !askResult.text ? (
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-7">لم يصل جواب. بعض الطُّرز لا تردّ عبر البلوتوث — اقرأ الطراز من ملصق الجهاز نفسه.</p>
                  ) : (
                    <>
                      <p style={{ color: "var(--accentText)", margin: "0 0 3px" }} className="text-[11px] font-bold">ردّ الطابعة{askResult.model ? ` — ${askResult.model}` : ""}</p>
                      <p style={{ color: "var(--text2)", margin: 0, direction: "ltr", fontFamily: "monospace", fontSize: 10, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{askResult.text}</p>
                      {askResult.oem && <p style={{ color: "var(--accentText)", margin: "5px 0 0" }} className="text-[11px] leading-7">⚠ الصانع الحقيقي <b>{askResult.oem}</b> — الاسم على العلبة قد يختلف. <b>ابحث عن دليل الطراز أعلاه</b> لا عن اسم العلبة.</p>}
                      <p style={{ color: askResult.mentionsRfid ? "var(--good)" : "var(--bad)", margin: "5px 0 0" }} className="text-[11px] leading-7">
                        {askResult.mentionsRfid ? "✓ الجواب يذكر RFID — الطراز يدعم الرقاقة."
                          : <>⚠ <b>الجواب لا يذكر RFID.</b> وهذا لا يحسم: <b>اطبع صفحة SELFTEST</b> (②). إن لم تذكر RFID فالطابعة <b>بلا وحدة ترميز</b> — ولا صيغةَ أمرٍ تُصلح ذلك.</>}
                      </p>
                    </>
                  )}
                </div>
              )}
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
              <button onClick={() => setNow("rfid", !cfg.rfid)} className="w-full py-2 rounded-xl text-[11px] font-bold mb-2"
                style={{ background: cfg.rfid ? "var(--accentBg)" : "var(--field)",
                  color: cfg.rfid ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
                {cfg.rfid ? "✓ يُكتب الرمز في الرقاقة مع كل ملصق" : "الكتابة في الرقاقة معطّلة"}
              </button>
              {cfg.rfid && (
                <>
                  <Field label="صيغة أمر الكتابة">
                    <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                      {[["A · TSC كاملة", 'RFID WRITE,H,0,96,EPC,"{HEX}"'], ["B · من الكتلة 2", 'RFID WRITE,H,2,96,EPC,"{HEX}"'], ["C · مختصرة", 'RFID WRITE,EPC,"{HEX}"'], ["D · ZPL", "zpl"]].map(([l, v]) => {
                        const on = v === "zpl" ? cfg.rfidMode === "zpl" : cfg.rfidMode !== "zpl" && cfg.rfidCommand === v;
                        return (
                          <button key={l} className="py-2 rounded-xl text-[11px] font-bold"
                            onClick={() => setCfg((p) => { const n = v === "zpl" ? { ...p, rfidMode: "zpl" } : { ...p, rfidMode: "tspl", rfidCommand: v }; onSave(n); return n; })}
                            style={{ background: on ? "var(--accentBg)" : "var(--field)",
                              color: on ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
                        );
                      })}
                    </div>
                    {cfg.rfidMode === "zpl" && (
                      <>
                        <p style={{ color: "var(--text3)", margin: "0 0 6px" }} className="text-[10px] leading-6">
                          الملصق كاملًا يُرسل بلغة ZPL مع أمر الرقاقة <span style={{ fontFamily: "monospace", direction: "ltr", display: "inline-block" }}>^RFW,H</span> — لطابعاتٍ مثل Urovo D813R تتجاهل أمر الرقاقة بلغة TSPL.
                        </p>
                        <button onClick={() => setNow("zplInvert", !cfg.zplInvert)} className="w-full py-2 rounded-xl text-[11px] font-bold"
                          style={{ background: cfg.zplInvert ? "var(--accentBg)" : "var(--field)", color: cfg.zplInvert ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
                          {cfg.zplInvert ? "✓ الملصق مقلوب 180°" : "اقلب الملصق 180° (إن خرج معكوسًا)"}
                        </button>
                      </>
                    )}
                  </Field>
                  <Field label="أمر الكتابة — {HEX} يُستبدل بالرمز (12 بايت)">
                    <input style={{ ...inputStyle, fontFamily: "monospace", direction: "ltr" }} value={cfg.rfidCommand || ""}
                      onChange={(e) => set("rfidCommand", e.target.value)} onBlur={() => onSave(cfg)} />
                  </Field>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
                    ⚠ الأمر يختلف بين الشركات. الافتراضي صيغة TSC. راجع دليل SDK طابعتك —
                    السطر الذي فيه <b>RFID</b> — والصقه هنا بنفس الشكل.
                    <br />مثال لرمز <b>R7K2M9PQ</b>: <span style={{ fontFamily: "monospace", direction: "ltr", display: "inline-block" }}>{buildPlateEpc({ code: "R7K2M9PQ", storeId: cfg.storeId || 0 })}</span>
                  </p>
                  <Field label="رقم المحل على الرقاقة (0–65535)">
                    <NumericInput value={String(cfg.storeId || "")} onChange={(v) => setNow("storeId", Math.max(0, Math.min(65535, Math.round(Number(v) || 0))))} placeholder="0" />
                  </Field>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
                    الرقاقة تحمل الرمز ورقم المحل وتاريخ الكتابة — فرقاقةُ فرعٍ آخر تُقرأ «ليست لنا» لا «مفقودة».
                  </p>
                  <div className="flex items-center gap-2 my-2 px-3 py-2 rounded-xl" data-rfid-verified={cfg.rfidVerified ? "1" : "0"}
                    style={{ background: cfg.rfidVerified ? "var(--goodBg)" : "var(--field)", border: `1px solid ${cfg.rfidVerified ? "var(--goodLine)" : "var(--line)"}` }}>
                    <span className="text-[11px] font-bold flex-1" style={{ color: cfg.rfidVerified ? "var(--good)" : "var(--text2)" }}>
                      {cfg.rfidVerified ? "✓ جُرّبت الكتابة وقرأها القارئ" : "لم تُؤكَّد الكتابة بالقارئ بعد — جرّب ⑤ في سلّم الفحص"}
                    </span>
                  </div>
                  {askRfid && (
                    <div className="flex flex-col gap-1.5 mb-2" data-rfid-ask>
                      <p style={{ color: "var(--accentText)", margin: 0 }} className="text-[11px] font-bold">ماذا قرأ القارئ؟</p>
                      <button onClick={() => { setNow("rfidVerified", true); setAskRfid(false); setStatus("✓ الرقاقة تُكتب — وتُكتب الآن مع كل ملصق."); }}
                        className="w-full text-right py-2.5 px-3 rounded-xl text-[11px] font-bold" style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
                        ✓ قرأ رمز التجربة — الكتابة تعمل
                      </button>
                      <button onClick={() => { setNow("rfidVerified", false); setAskRfid(false); setStatus("جرّب الصيغة التالية (⑥) ثم اكتب مرةً أخرى."); }}
                        className="w-full text-right py-2.5 px-3 rounded-xl text-[11px]" style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                        ✗ الرمز المصنعيّ ما زال — لم تُكتب
                      </button>
                    </div>
                  )}
                  <div style={{ background: "var(--bg)", borderRadius: 10, padding: 10, marginTop: 8 }}>
                    <p style={{ color: "var(--accentText)", margin: "0 0 4px" }} className="text-[11px] font-bold">قبل أول تجربة — معايرة الرقاقة من الطابعة</p>
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-7">
                      والطابعة جاهزة والضوء الأزرق ثابت، <b>اضغط FEED نحو 4 ثوانٍ</b> حتى تبدأ بسحب الورق ثم أفلت. تقيس الورق
                      <b> وموضع كتابة الرقاقة تحت الهوائي</b>، وتنتهي حين يثبت الضوء الأزرق. ثم ⑤ — <b>يخرج ملصقٌ واحد</b> برقاقته — وامسحه بالقارئ.
                    </p>
                    <p style={{ color: "var(--bad)", margin: "6px 0 0" }} className="text-[10px] leading-7">
                      ⚠ <b>وموضع الهوائي يهمّ.</b> صفحة الفحص تُظهر <b>ANTENNA POSITION</b> — والرقاقة تُكتب وهي تحته تمامًا. فإن كان الملصق مائلًا أو الورق غير مشدود مرّت بلا كتابة. <b>عايِر الطابعة</b> قبل التجربة.
                    </p>
                    <div style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8 }}>
                      <p style={{ color: "var(--accentText)", margin: "0 0 3px" }} className="text-[11px] font-bold">لماذا القارئ يُظهر رمزًا طويلًا؟</p>
                      <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-7">رقاقة EPC تحفظ <b>96 بت رقمية</b> لا حروفًا، والقارئ العام يعرضها <b>ست عشريًّا</b> — وهذا سليم:</p>
                      <p style={{ color: "var(--text2)", margin: "4px 0", fontFamily: "monospace", direction: "ltr", fontSize: 10 }}>R7K2M9PQ → {codeToEpcHex("R7K2M9PQ")}</p>
                      <p style={{ color: "var(--good)", margin: 0 }} className="text-[10px] leading-7">✓ <b>وقارئ أونصة يفكّه ويعرض الرمز نفسه.</b> جرّب من: الجرد ← قارئ RFID.</p>
                    </div>
                  </div>
                </>
              )}
            </Card>

            {/* ── تخطيط الملصق ── */}
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">تخطيط الملصق — اسحب بإصبعك</p>
            <Card style={{ padding: 14, marginBottom: 12 }}>
              {/* ثلاثة نماذج ملصق لكلٍّ مقاسه وتخطيطه واسمه، وتُختار عند الطباعة بعد التكويد أيضًا */}
              <Card style={{ padding: 11, marginBottom: 10, border: "1px solid var(--accentLine)" }} data-label-models-settings>
                <p style={{ color: "var(--accent)", margin: "0 0 5px" }} className="text-[11px] font-bold">نماذج الملصق — اختر نموذجًا ثم اضبط مقاسه وتخطيطه</p>
                <div className="mb-2"><LabelModelPicker cfg={cfg} onChange={(n) => { setCfg(n); onSave(n); }} /></div>
                <Field label="اسم النموذج الفعّال">
                  <input style={inputStyle} aria-label="اسم النموذج الفعّال" data-label-model-name maxLength={24}
                    value={labelModelList(cfg).find((m) => m.active)?.name || ""}
                    onChange={(e) => setCfg(renameLabelModel(cfg, cfg.activeModel || "m1", e.target.value))}
                    onBlur={() => onSave(cfg)} />
                </Field>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-6">المقاس والتخطيط لكل نموذج وحده، والباقي (الطابعة · الدقّة · الرقاقة) مشترك.</p>
              </Card>
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
                  {/* سؤالٌ بعد طباعة الإطار لا تحذيرٌ أحمر */}
                  {calPrinted ? (
                    <div style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8 }} data-cal-ask>
                      <p style={{ color: "var(--accentText)", margin: "0 0 6px" }} className="text-[11px] font-bold">كيف خرج الإطار؟</p>
                      <div className="flex flex-col gap-1.5">
                        <button onClick={() => { setCalPrinted(false); setStatus("✓ ضُبطت الطابعة — ابدأ الطباعة."); }}
                          className="w-full text-right py-2.5 px-3 rounded-xl text-[11px] font-bold" style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
                          ✓ يملأ الملصق تمامًا — انتهيت
                        </button>
                        <button onClick={() => { const next = (Number(cfg.dpi) || 203) === 203 ? 300 : 203; setNow("dpi", next); setStatus(`بُدّلت الدقّة إلى ${next} dpi — اطبع الإطار ثانيةً.`); }}
                          className="w-full text-right py-2.5 px-3 rounded-xl text-[11px]" style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                          <b>أصغر بنحو الثلث</b> — علامة 40 عند 27 مم
                          <span className="block text-[10px]" style={{ color: "var(--text3)", marginTop: 2 }}>الدقّة خاطئة ← بدّلها إلى {(Number(cfg.dpi) || 203) === 203 ? "300" : "203"} dpi</span>
                        </button>
                        <button onClick={() => { setCalPrinted(false); setStatus("قِس الملصق بمسطرة وصحّح العرض والطول أعلاه، ثم اطبع الإطار."); }}
                          className="w-full text-right py-2.5 px-3 rounded-xl text-[11px]" style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                          <b>أصغر أو أكبر قليلًا</b><span className="block text-[10px]" style={{ color: "var(--text3)", marginTop: 2 }}>المقاس خاطئ ← صحّح الأرقام أعلاه</span>
                        </button>
                        <button onClick={() => { setCalPrinted(false); setStatus("المقاس أكبر من ورقك — أنقِص العرض أو الطول ثم اطبع الإطار."); }}
                          className="w-full text-right py-2.5 px-3 rounded-xl text-[11px]" style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                          <b>انقطع من جهة</b><span className="block text-[10px]" style={{ color: "var(--text3)", marginTop: 2 }}>المقاس أكبر من ورقك ← أنقِصه</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[10px] leading-7">بعد الطباعة يسألك التطبيق كيف خرج الإطار، ويقول لك ماذا تغيّر.</p>
                  )}
                </div>

                {/* صيغة أمر القياس — بعض الطابعات تفهم غير GAPDETECT */}
                <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
                  <p style={{ color: "var(--accentText)", margin: "0 0 5px" }} className="text-[11px] font-bold">صيغة المعايرة — جرّبها إن لم تتحرّك الطابعة</p>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {CALIBRATE_MODES.map((m) => {
                      const on = (cfg.calibrateMode || "gapdetect") === m.id;
                      return (
                        <button key={m.id} data-cal-mode={m.id} onClick={() => setNow("calibrateMode", m.id)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                          style={{ background: on ? "var(--accentBg)" : "var(--field)", color: on ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>{m.label}</button>
                      );
                    })}
                  </div>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">{(CALIBRATE_MODES.find((m) => m.id === (cfg.calibrateMode || "gapdetect")) || {}).hint} — وإن لم تتحرّك طابعتك فجرّب غيرها، ثم ④ لتعرف أن الاتصال سليم.</p>
                </div>

                {/* اتجاه الطباعة */}
                <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
                  <p style={{ color: "var(--accentText)", margin: "0 0 6px" }} className="text-[11px] font-bold">اتجاه الطباعة</p>
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    {[[false, "الافتراضي"], [true, "اقلب 180°"]].map(([flip, lab]) => {
                      const on = cfg.rfidMode === "zpl" ? !!cfg.zplInvert === flip : (Number(cfg.direction ?? 1) === 0) === flip;
                      return (
                        <button key={lab} data-direction={flip ? "flip" : "normal"}
                          onClick={() => setCfg((p) => { const n = p.rfidMode === "zpl" ? { ...p, zplInvert: flip } : { ...p, direction: flip ? 0 : 1 }; onSave(n); return n; })}
                          className="py-2.5 rounded-xl text-[11px] font-bold"
                          style={{ background: on ? "var(--accentBg)" : "var(--field)", color: on ? "var(--accent)" : "var(--text3)", border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}` }}>
                          {on ? "✓ " : ""}{lab}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-7">
                    اطبع <b>إطار الفحص</b>: <b>المربّع الأسود يجب أن يخرج في الزاوية اليمنى العليا</b> — كما في المعاينة. إن خرج في الزاوية المقابلة، اضغط «اقلب 180°».
                  </p>
                </div>

                {/* متقدّم — الإزاحة */}
                <details className="mt-3" data-offsets>
                  <summary style={{ color: "var(--text2)", minHeight: 44 }} className="text-xs font-bold">متقدّم — الإزاحة (الطباعة مائلة أو تُقطع خطأً)</summary>
                  <Field label={`موضع التوقّف: ${cfg.labelOffsetMm ?? 0} مم`}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setNow("labelOffsetMm", Math.max(-10, (Number(cfg.labelOffsetMm) || 0) - 0.5))} aria-label="أنقص موضع التوقّف نصف مليمتر"
                        style={{ width: 40, height: 36, borderRadius: 10, background: "var(--field)", border: "1px solid var(--line)", fontSize: 16, fontWeight: 800 }}>−</button>
                      <input type="range" min={-10} max={10} step={0.5} style={{ flex: 1 }} value={Number(cfg.labelOffsetMm) || 0}
                        onChange={(e) => set("labelOffsetMm", Number(e.target.value))} onMouseUp={() => onSave(cfg)} onTouchEnd={() => onSave(cfg)} />
                      <button onClick={() => setNow("labelOffsetMm", Math.min(10, (Number(cfg.labelOffsetMm) || 0) + 0.5))} aria-label="زد موضع التوقّف نصف مليمتر"
                        style={{ width: 40, height: 36, borderRadius: 10, background: "var(--field)", border: "1px solid var(--line)", fontSize: 16, fontWeight: 800 }}>+</button>
                    </div>
                  </Field>
                  <p style={{ color: "var(--text3)", margin: "-4px 0 8px" }} className="text-[10px] leading-6">
                    ⚠ <b>أين تقف الورقة بعد الطباعة.</b> زِده إن كان الملصق لا يخرج كفايةً لتقطعه، وأنقِصه إن كانت تُقطع على الملصق التالي.
                  </p>
                  <Field label={`إزاحة الطباعة: ${cfg.labelShiftDots ?? 0} نقطة (${((Number(cfg.labelShiftDots) || 0) / ((Number(cfg.dpi) || 203) / 25.4)).toFixed(1)} مم)`}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setNow("labelShiftDots", Math.max(-120, (Number(cfg.labelShiftDots) || 0) - 6))} aria-label="أنقص إزاحة الطباعة نصف مليمتر"
                        style={{ width: 40, height: 36, borderRadius: 10, background: "var(--field)", border: "1px solid var(--line)", fontSize: 16, fontWeight: 800 }}>−</button>
                      <input type="range" min={-120} max={120} step={6} style={{ flex: 1 }} value={Number(cfg.labelShiftDots) || 0}
                        onChange={(e) => set("labelShiftDots", Number(e.target.value))} onMouseUp={() => onSave(cfg)} onTouchEnd={() => onSave(cfg)} />
                      <button onClick={() => setNow("labelShiftDots", Math.min(120, (Number(cfg.labelShiftDots) || 0) + 6))} aria-label="زد إزاحة الطباعة نصف مليمتر"
                        style={{ width: 40, height: 36, borderRadius: 10, background: "var(--field)", border: "1px solid var(--line)", fontSize: 16, fontWeight: 800 }}>+</button>
                    </div>
                  </Field>
                  <p style={{ color: "var(--text3)", margin: "-4px 0 8px" }} className="text-[10px] leading-6">
                    ⚠ <b>يُحرّك الصورة على الورقة رأسيًّا</b> — لا الورقة نفسها. زِده إن كانت الكتابة قريبةً من الحافّة العليا.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={applyOffset} disabled={!!busy} data-apply-offset className="py-2.5 rounded-xl text-[11px] font-bold"
                      style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>{busy === "offset" ? "يُرسل…" : "طبّق الإزاحة"}</button>
                    <button onClick={printCalLabel} disabled={!!busy} className="py-2.5 rounded-xl text-[11px] font-bold"
                      style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>اطبع إطار الفحص</button>
                  </div>
                  <button onClick={() => setCfg((p) => { const n = { ...p, labelOffsetMm: 0, labelShiftDots: 0 }; onSave(n); return n; })} className="w-full py-2 rounded-xl text-[10px] mt-2" style={{ color: "var(--text3)" }}>
                    أعِد الإزاحة للصفر
                  </button>
                </details>

                {/* إعادة الطابعة لإعدادات المصنع ومعنى الأضواء — من دليل الشركة */}
                <details className="mt-1">
                  <summary style={{ color: "var(--text2)", minHeight: 44 }} className="text-xs font-bold">ماذا يعني ضوء الطابعة؟ · إعادتها لإعدادات المصنع</summary>
                  <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px", marginBottom: 8 }} className="text-[10px] leading-7">
                    <b style={{ color: "var(--accentText)" }}>ماذا يعني الضوء؟</b><br />
                    🔵 أزرق ثابت = جاهزة (ومعه 🟢 أخضر = وضع الشريط)<br />
                    🔴 أحمر يومض = <b>انتهى الورق</b><br />
                    🔴🔵 أحمر وأزرق يومضان = <b>لا تجد الفجوة</b> ← عايِر<br />
                    🔴 أحمر ثابت + 🟢 أخضر يومض = <b>انتهى الشريط</b> أو ملفوفٌ خطأ<br />
                    🔴🟢 أحمر وأخضر بالتناوب = خطأٌ آخر<br />
                    ⚠ بعد إصلاح السبب: <b>اضغط FEED مرّة</b> لإلغاء الخطأ.
                  </div>
                  <p style={{ color: "var(--bad)", margin: "0 0 6px" }} className="text-[11px] font-bold">إعادة الطابعة لإعدادات المصنع</p>
                  <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[10px] leading-7">
                    ① أطفئ الطابعة · ② <b>اضغط FEED واستمرّ</b> · ③ شغّلها وأنت ضاغط · ④ <b>أفلت حين يثبت الضوء الأزرق وحده</b> — فتصفّر <b>خمس مرّات</b> وتعود لإعدادات المصنع.<br />
                    ⚠ أضواءٌ أخرى أثناء الضغط تعني وظائف أخرى: <b>الأخضر وحده</b> = صفحة فحص · <b>الأحمر وحده</b> = تخطّي AUTO.BAS · <b>الأزرق والأحمر معًا</b> = وضع Dump.
                  </p>
                  <button onClick={factoryReset} disabled={!!busy} className="w-full py-2.5 rounded-xl text-[11px] font-bold"
                    style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>أعِد إعدادات التطبيق للبداية</button>
                </details>

                {/* ما أُرسل للطابعة */}
                {showBytes && (
                  <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }} data-shown-bytes>
                    <div className="flex items-baseline justify-between mb-1">
                      <span style={{ color: "var(--accentText)" }} className="text-[11px] font-bold">ما أُرسل للطابعة</span>
                      <button onClick={() => setShowBytes("")} style={{ color: "var(--text3)" }} className="text-[10px]">أخفِ</button>
                    </div>
                    <pre style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 9, fontSize: 10, lineHeight: 1.9, direction: "ltr", textAlign: "left", overflowX: "auto", color: "var(--text2)", margin: 0, maxHeight: 150, fontFamily: "ui-monospace,Menlo,monospace" }}>{showBytes}</pre>
                    <button onClick={() => { navigator.clipboard?.writeText(showBytes).catch(() => {}); }} className="w-full py-2 rounded-xl text-[10px] mt-2"
                      style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>انسخ — لإرساله للمطوّر</button>
                  </div>
                )}

                {/* قوالب الضبط */}
                <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }} data-presets>
                  <p style={{ color: "var(--accentText)", margin: "0 0 6px" }} className="text-[11px] font-bold">احفظ هذا الضبط</p>
                  <div className="flex gap-2 mb-2">
                    <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={presetName} onChange={(e) => setPresetName(e.target.value)}
                      placeholder={`ملصق ${cfg.labelWidthMm || "?"}×${cfg.labelHeightMm || "?"} مم`} />
                    <button onClick={savePreset} data-preset-save className="px-4 rounded-xl text-[11px] font-bold" style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>احفظ</button>
                  </div>
                  <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[10px] leading-6">⚠ <b>الجهاز المقترن لا يُحفظ</b> — معرّفُه خاصٌّ بهذا الجوّال.</p>
                  {presets.map((ps) => (
                    <div key={ps.name} className="flex items-center gap-2 mb-1.5">
                      <button onClick={() => { const n = { ...cfg, ...ps.cfg, deviceId: cfg.deviceId, deviceName: cfg.deviceName, usbSerial: cfg.usbSerial }; setCfg(n); onSave(n); setStatus(`استُعيد «${ps.name}» — اطبع إطار الفحص للتأكّد.`); }}
                        className="flex-1 text-right py-2.5 px-3 rounded-xl text-[11px]" style={{ background: "var(--bg)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                        <b>{ps.name}</b><span className="block text-[10px]" style={{ color: "var(--text3)", marginTop: 1 }}>{ps.cfg?.labelWidthMm}×{ps.cfg?.labelHeightMm} مم · {ps.cfg?.dpi || 203} dpi · حُفظ {ps.at}</span>
                      </button>
                      <button onClick={() => savePresets(presets.filter((x) => x.name !== ps.name))} aria-label={`احذف القالب ${ps.name}`} style={{ color: "var(--bad)", padding: "0 6px" }} className="text-[11px]">✕</button>
                    </div>
                  ))}
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
                {fmt(samplePrice, 0)} {currency}
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

        <Card style={{ padding: 11, marginTop: 10, marginBottom: 12 }}>
          <div data-printer-backup>
            <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-[11px] font-bold">نسخة الإعدادات</p>
            <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[11px] leading-7">
              ⚠ ضبطُ الملصق يأخذ وقتًا وورقًا. <b>انسخه واحفظه عندك</b> — تسترجعه في أي جهازٍ أو فرعٍ جديد بلصقةٍ واحدة.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={copySettings} className="py-2.5 rounded-xl text-[11px] font-bold" style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>انسخ إعداداتي</button>
              <button onClick={pasteSettings} disabled={!importText.trim()} className="py-2.5 rounded-xl text-[11px] font-bold"
                style={{ background: importText.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)", color: importText.trim() ? "var(--panel)" : "var(--text3)", border: "1px solid var(--line)" }}>استرجع</button>
            </div>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="الصق نسخة الإعدادات هنا ثم اضغط «استرجع»"
              style={{ ...inputStyle, minHeight: 66, marginTop: 8, direction: "ltr", fontFamily: "monospace", fontSize: 10 }} />
            <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[11px] leading-6">⚠ الاسترجاع <b>لا يمسّ اقتران الطابعة</b>.</p>
          </div>
        </Card>

        {/* الأجهزة الأخرى في المكان نفسه: قارئ RFID وجهاز الدفع */}
        {rfidCfg && onSaveRfid && (
          <div className="mt-3">
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">قارئ RFID</p>
            <RfidSettingsCard settings={rfidCfg} onSave={onSaveRfid} />
          </div>
        )}
        <div className="mt-3 mb-6">
          <PayTerminalCard />
        </div>
      </div>
    </div>
  );
}

export { PrinterSettingsPage };
