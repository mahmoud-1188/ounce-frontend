import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { DEFAULT_PRINTER, FS, M830, PRINTER_SERVICES, RFID_DEFAULTS } from "../core/constants.js";
import { PURITY, fmt, fmtW } from "../core/money.js";
import { buildCalibrationCanvas } from "../domain/buildCalibrationCanvas.js";
import { inputStyle } from "../domain/helpers.js";
import { CALIBRATE_MODES, LABEL_GAP_MM, askPrinter, bleWriteChunked, btSupported, codeToEpcHex, labelJobBytes, labelPrinterCfg, printLabelToDevice, renderLabelCanvas, rfidTestBytes, sendRawToPrinter, tsplCalibrateBytes, tsplOffsetBytes, usbPrint } from "../domain/labelPrinter.js";
import { labelModelList, renameLabelModel, switchLabelModel } from "../domain/labelModels.js";
import { rememberBluetoothDevice } from "../domain/labelPrint.js";
import { key } from "../domain/key.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { LabelLayoutEditor } from "../ui/LabelLayoutEditor.jsx";
import { MmInput } from "../ui/MmInput.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { PayTerminalCard } from "../ui/PayTerminalCard.jsx";
import { RfidProtocolLine } from "../ui/RfidProtocolLine.jsx";
import { RfidSettingsCard } from "../ui/RfidSettingsCard.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";
import { Switch } from "../ui/Switch.jsx";

// تطبيق الفرع: الإدارة في تطبيقها
const HQ_MODE = false, IS_HQ_APP = false;
// طباعة الفواتير مفعّلةٌ في الفرع؟ (إعداد invoicePrintOn)
const invoicePrintOn = (settings) => !!settings?.invoicePrintOn;
// وحدةٌ اختيارية من الخادم مفعّلة؟ (serverModules — migration 050)
const modOn = (settings, id) => !!settings?.serverModules?.[id]?.on;
// قوالب الضبط محفوظةٌ على هذا الجهاز (بلا الجهاز المقترن: معرّفه خاصٌّ بهذا الجوّال)
const PRESETS_KEY = "ounce_printer_presets_v1";
const readPresets = () => { try { const v = JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };

function PrinterSettingsPage({ config, onSave, sampleItem, currency, price24, onBack, settings = null, onSaveSettings = null, rfidCfg = null, onSaveRfid = null }) {
  const [presets, setPresets] = useState(readPresets);
  const onSavePresets = (next) => { setPresets(next); try { localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); } catch { /* تخزينٌ محجوب */ } };
  const [cfg, setCfg] = useState(() => labelPrinterCfg(config));
  // نصّ الاسترجاع محلّي لا في الخطّاف، فحالة الخطّاف مشتركة بين كل من يستعمله
  const [importText, setImportText] = useState("");
  const [askResult, setAskResult] = useState(null);
  const [calPrinted, setCalPrinted] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [askRfid, setAskRfid] = useState(false);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const deviceRef = useRef(null);
  // كل تغيير يُحفظ فورًا، فالتكويد يقرأ المحفوظ وإلا طبع بلا رقاقة بصمت.
  // cfgRef لا cfg، فضغطتان متتاليتان تقرآن cfg القديم نفسه فتمحو الثانية الأولى.
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);
  const set = (k, v) => {
    const n = { ...cfgRef.current, [k]: v };
    cfgRef.current = n;
    setCfg(n);
    onSave?.(n, { quiet: true });
  };
  const supported = btSupported();

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

  // يضمن جهازًا قبل أي إرسال ويقترن في الضغطة نفسها إن لزم.
  // getDevices غير مدعومة في كروم أندرويد، وrequestDevice مسموح داخل تفاعل مباشر.
  const ensureDevice = async () => {
    if (cfg.transport === "usb") return true;
    if (deviceRef.current) return true;
    if (!supported) {
      setError("البلوتوث غير مدعوم — استعمل كروم على أندرويد أو ويندوز، والصفحة من https");
      return false;
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true, optionalServices: PRINTER_SERVICES,
      });
      deviceRef.current = device;
      rememberBluetoothDevice(device);
      onSave?.({ ...cfg, deviceId: device.id, deviceName: device.name || "",
        mode: "bluetooth", transport: "bluetooth" });
      setStatus(`مقترنة: ${device.name || "طابعة"}`);
      return true;
    } catch (e) {
      const raw = String(e?.message || e);
      if (!/cancel|User cancelled|chooser/i.test(raw)) setError(raw);
      return false;
    }
  };

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
    await sendRaw(`SIZE ${cfg.labelWidthMm || 50} mm, ${cfg.labelHeightMm || 30} mm\r\nGAP ${LABEL_GAP_MM} mm, 0 mm\r\nCLS\r\nTEXT 30,30,"3",0,1,1,"OUNSAH TEST"\r\nBARCODE 30,80,"128",60,1,0,2,2,"R7K2M9PQ"\r\nPRINT 1,1\r\n`, "TSPL نصّ");
    setStatus("③ إن طُبع نصٌّ وباركود فـTSPL يعمل — الخلل في الصورة أو RFID"); } catch (e) { setError(String(e?.message || e)); log(`✗ ${e?.message || e}`); } finally { setBusy(""); } };

  const send = async (bytes, what) => {
    const t0 = Date.now();
    try {
      const r = await sendRawToPrinter(bytes, cfg, deviceRef,
        (serial) => set("usbSerial", serial));
      const ms = Date.now() - t0;
      setStatus(`✓ ${what}: ${bytes.length} بايتًا في ${ms} مل`
        + (r?.ack ? " · تأكّد الوصول" : " · ⚠ بلا تأكيد وصول")
        + (r?.chunk ? ` · حزمة ${r.chunk}` : "")
        + (r?.attempts > 1 ? ` · بعد ${r.attempts} محاولات` : "")
        + (r?.service ? `\nالقناة: ${String(r.service).slice(0, 8)}` : "")
        + "\nإن لم تتحرّك الطابعة: الأمر وصلها ولم تفهمه.");
      return true;
    } catch (e) {
      setError(`✗ ${what}: ${String(e?.message || e)}`);
      return false;
    }
  };

  const [showBytes, setShowBytes] = useState("");

  const calibrate = async () => {
    setError("");
    if (!(await ensureDevice())) return; setBusy("cal");
    try {
      const bytes = tsplCalibrateBytes({
        widthMm: cfg.labelWidthMm || 50,
        heightMm: cfg.labelHeightMm || 20,
        gapMm: LABEL_GAP_MM,
        offsetMm: cfg.labelOffsetMm ?? 0,
        shiftDots: cfg.labelShiftDots ?? 0,
        mode: cfg.calibrateMode || "autodetect",
      });
      setShowBytes(new TextDecoder().decode(bytes));
      await send(bytes, "المعايرة");
    } catch (e) {
      setError(`✗ تعذّر التجهيز: ${String(e?.message || e)}`);
    } finally { setBusy(""); }
  };

  const applyOffset = async () => {
    setError("");
    if (!(await ensureDevice())) return; setBusy("offset");
    try {
      const bytes = tsplOffsetBytes({
        widthMm: cfg.labelWidthMm || 50,
        heightMm: cfg.labelHeightMm || 20,
        gapMm: LABEL_GAP_MM,
        offsetMm: cfg.labelOffsetMm ?? 0,
        shiftDots: cfg.labelShiftDots ?? 0,
      });
      setShowBytes(new TextDecoder().decode(bytes));
      await send(bytes, "الإزاحة");
    } catch (e) {
      setError(`✗ تعذّر التجهيز: ${String(e?.message || e)}`);
    } finally { setBusy(""); }
  };

  const printCalLabel = async () => {
    setError("");
    if (!(await ensureDevice())) return; setBusy("calprint"); setCalPrinted(false);
    try {
      const canvas = buildCalibrationCanvas({
        widthMm: cfg.labelWidthMm || 50,
        heightMm: cfg.labelHeightMm || 20,
        dpi: Number(cfg.dpi) || 203,
      });
      // بلا RFID، فإطار الفحص يُطبع مرارًا وكتابة رقاقة في كل مرة تُتلفها
      const bytes = labelJobBytes({ canvas, cfg: { ...cfg, rfid: false }, copies: 1, code: "" });
      if (await send(bytes, "إطار الفحص")) setCalPrinted(true);
    } catch (e) {
      setError(`✗ تعذّر التجهيز: ${String(e?.message || e)}`);
    } finally { setBusy(""); }
  };

  // يعيد إعدادات التطبيق لا الطابعة، ولا يُرسل INITIALPRINTER لأن دليل GA-3406T لا يوثّقه
  const factoryReset = () => {
    setCfg((p) => ({ ...DEFAULT_PRINTER,
      deviceId: p.deviceId, deviceName: p.deviceName, usbSerial: p.usbSerial,
      mode: p.mode, transport: p.transport }));
    setStatus("✓ عادت إعدادات التطبيق للبداية — والطابعة مقترنةٌ كما هي.");
  };

  const savePreset = () => {
    const name = (presetName || "").trim()
      || `ملصق ${cfg.labelWidthMm || "?"}×${cfg.labelHeightMm || "?"} مم`;
    // الجهاز لا يُحفظ في الضبط، فمعرّف البلوتوث خاصٌّ بهذا الجوّال
    const { deviceId, deviceName, usbSerial, ...keep } = cfg;
    const next = [
      ...(presets || []).filter((x) => x.name !== name),
      { name, at: new Date().toISOString().slice(0, 10), cfg: keep },
    ].slice(-8);
    onSavePresets?.(next);
    setPresetName("");
    setStatus(`✓ حُفظ الضبط باسم «${name}»`);
  };

  const copySettings = async () => {
    const txt = JSON.stringify({ v: 1, kind: "printerSettings", at: new Date().toISOString(), cfg }, null, 1);
    try { await navigator.clipboard.writeText(txt); setStatus("نُسخت الإعدادات — احفظها عندك"); }
    catch (e) { setImportText(txt); setStatus("انسخها من الصندوق أدناه"); }
  };

  const pasteSettings = () => {
    setError("");
    try {
      const o = JSON.parse(importText.trim());
      const incoming = o?.kind === "printerSettings" ? o.cfg : o;
      if (!incoming || typeof incoming !== "object") throw new Error("ليست إعدادات طابعة");
      const next = { ...DEFAULT_PRINTER, ...incoming,
        deviceId: cfg.deviceId, deviceName: cfg.deviceName, usbSerial: cfg.usbSerial };
      setCfg(next); onSave(next); setImportText("");
      setStatus(`استُرجعت — ${next.labelWidthMm}×${next.labelHeightMm} مم · ${next.dpi || 203} dpi`);
    } catch (e) { setError(`تعذّرت القراءة: ${e?.message || e}`); }
  };

  const askDevice = async () => {
    setError(""); setBusy("ask"); setAskResult(null);
    try {
      const r = await askPrinter(cfg, deviceRef);
      setAskResult(r);
      if (r.supported) setStatus(r.text ? "ردّت الطابعة" : "لم تردّ — قد لا تدعم السؤال");
      else setStatus("");
    } catch (e) { setError(String(e?.message || e)); } finally { setBusy(""); }
  };

  const testRfid = async () => {
    setError("");
    if (!(await ensureDevice())) return; setBusy("rfid");
    try {
      const bytes = rfidTestBytes({ cfg, code: "TESTRFID" });
      setShowBytes(new TextDecoder().decode(bytes));
      if (await send(bytes, "كتابة الرقاقة")) {
        setStatus((p) => `${p}\nامسح الملصق بقارئ RFID — يجب أن تقرأ TESTRFID.`);
        setAskRfid(true);
      }
    } catch (e) {
      setError(`✗ تعذّر التجهيز: ${String(e?.message || e)}`);
    } finally { setBusy(""); }
  };

  const testFull = async () => {
    setError("");
    if (!(await ensureDevice())) return;
    setBusy("full");
    try {
      const code = "TESTFULL";
      const c2 = { ...cfg, rfid: true, rfidVerified: true };
      const canvas = renderLabelCanvas({
        item: sampleItem || { karat: 21, weight: 1.234, category: "ring" },
        code, cfg: c2, currency, price24,
      });
      const bytes = labelJobBytes({ canvas, cfg: c2, code });
      setShowBytes(new TextDecoder().decode(bytes).replace(/(\^GFA,[0-9]+,[0-9]+,[0-9]+,)[0-9A-F]+/, "$1…"));
      if (await send(bytes, "ملصقٌ كامل برقاقة")) {
        setStatus((p) => `${p}\nامسحه بالقارئ — الصحيح يبدأ بـ 5445535446554C4C (= TESTFULL)`);
      }
    } catch (e) {
      setError(`✗ تعذّر التجهيز: ${String(e?.message || e)}`);
    } finally { setBusy(""); }
  };

  const testPrint = async () => {
    setError("");
    if (!(await ensureDevice())) return;
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
        // لا نافذة طباعة للملصقات، فهي تحوّلها إلى PDF
        setError("طابعة الملصقات بالبلوتوث أو USB فقط — اقترن بها أوّلًا");
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy("");
    }
  };

  const sample = sampleItem || { karat: 21, weight: 12.4, categoryId: "chain", units: [{ code: "A1001" }] };
  const samplePrice = (Number(sample.weight) || 0) * (PURITY[sample.karat] || sample.karat / 24) * (price24 || 0);

  return (
    <div>
      <SubPageHeader title="الأجهزة" onBack={onBack} />
      <div className="px-4 pt-3">
        <Card style={{ padding: 12, marginBottom: 12, background: "var(--field)" }} data-print-split>
          <p style={{ color: "var(--text)", margin: 0 }} className="text-[12px] font-bold">طابعتان منفصلتان</p>
          <p style={{ color: "var(--text2)", margin: "4px 0 0" }} className="text-[11px] leading-6">
            🏷 <b>ملصقات التكويد</b>: هنا — على طابعة الملصقات مباشرةً بالبلوتوث، بلا نافذة طباعة ولا PDF، الرقاقة مع كل ملصق والفجوة {LABEL_GAP_MM} مم ثابتة.<br />
            🧾 <b>الفواتير</b>: {invoicePrintOn(settings)
              ? <>من سجلّ المبيعات على طابعة الجهاز العادية — {settings && modOn(settings, "thermalReceipt") ? "بورق 80 مم (الإيصال الحراري مفعّل)" : "بورق A4 (فعّل «إيصال حراري 80مم» من الإضافات لورق الكاشير)"}. لا تشترك في إعدادٍ مع الملصقات.</>
              : <><b>معطّلة في الفرع حاليًا</b> — المفعّل طباعة ملصقات التكويد بالبلوتوث وحدها.</>}
          </p>
          {!IS_HQ_APP && onSaveSettings && (
            <button type="button" data-invoice-print-toggle onClick={() => onSaveSettings({ ...(settings || {}), invoicePrintOn: !invoicePrintOn(settings) })}
              className="mt-2 px-3 rounded-xl text-[11px] font-bold" style={{ minHeight: 36, background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
              {invoicePrintOn(settings) ? "عطّل طباعة الفواتير" : "فعّل طباعة الفواتير"}
            </button>
          )}
        </Card>
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">طابعة الملصقات (التكويد)</p>
        { (
          <Card style={{ padding: 14, marginBottom: 12, border: `1px solid ${cfg.deviceId ? "var(--goodLine)" : "var(--edge)"}` }}>
            {!supported ? (
              <p style={{ color: "var(--bad)" }} className="text-[11px]">
                هذا المتصفح لا يدعم البلوتوث. استخدم Chrome أو Edge على أندرويد أو ويندوز — ملصقات التكويد لا تُطبع عبر نافذة الطباعة.
              </p>
            ) : cfg.deviceId ? (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: "var(--good)" }} className="text-xs font-bold flex items-center gap-1.5">
                    <Check size={13} /> {cfg.deviceName}
                  </span>
                  <button
                    onClick={forget}
                    className="text-[11px] px-2 py-1 rounded-full"
                    style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
                  >
                    نسيان
                  </button>
                </div>
                <p style={{ color: "var(--text3)" }} className="text-[11px]">
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

        {status && (
          <p style={{ color: "var(--good)", whiteSpace: "pre-line", lineHeight: 1.9 }}
            className="text-[11px] mb-2">{status}</p>
        )}
        {error && (
          <p style={{ color: "var(--bad)", whiteSpace: "pre-line", lineHeight: 1.9 }}
            className="text-[11px] mb-2">{error}</p>
        )}

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">نوع الطابعة</p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <Field label="شعار المحل على الملصق — اختره من الاستوديو">
            <input type="file" accept="image/*" style={{ ...inputStyle, padding: 6, fontSize: 11 }}
              onChange={(e) => { const f = e.target.files?.[0]; if (!f) return;
                const r = new FileReader(); r.onload = () => { set("customLogo", r.result); set("showLogo", true); }; r.readAsDataURL(f); }} />
          </Field>
          {cfg.customLogo ? (
            <div className="flex items-center gap-2 mb-2">
              <img src={cfg.customLogo} alt="" style={{ height: 36, background: "#fff", borderRadius: 6, padding: 2 }} />
              <button onClick={() => { set("customLogo", null); set("showLogo", false); }} className="px-2 py-1 rounded-lg text-[11px]"
                style={{ background: "var(--field)", color: "var(--text3)", border: "1px solid var(--line)" }}>إزالة</button>
            </div>
          ) : (
            <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[11px]">لا شعار — الملصق يُطبع بلا شعار حتى تختار صورة.</p>
          )}
          <p style={{ color: "var(--text3)", margin: "0 0 10px" }} className="text-[11px] leading-6">
            {cfg.deviceName
              ? <>الطابعة المقترنة: <b>{cfg.deviceName}</b></>
              : <>طابعة ملصقات <b>TSPL</b></>} — ملصقات ورقائق RFID. لا طباعة فواتير في التطبيق.
          </p>
          {/* الوصل بالبلوتوث وحده، وخيار USB مخفي لأن labelPrinterCfg يفرض البلوتوث */}
          <p style={{ color: "var(--text2)", margin: "4px 0 0" }} className="text-[11px] font-bold" data-transport-fixed>الوصل: بلوتوث</p>
        </Card>

        <details className="mb-3">
        <summary style={{ color: "var(--text2)", minHeight: 44 }} className="text-xs font-bold">متقدّم — حلّ المشاكل</summary>
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">الطابعة لم تعمل؟ — افحص درجةً درجة</p>
        <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[11px] leading-6">
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
          <p style={{ color: "var(--text3)", margin: "0 0 6px" }} className="text-[11px]">
            ④ «تجربة طباعة» في الأسفل = الملصق كاملًا بالصورة وRFID.
          </p>
          {diag.length > 0 && (
            <pre style={{ background: "var(--bg)", color: "var(--text2)", padding: 8, borderRadius: 8, fontSize: FS.xs,
              direction: "ltr", textAlign: "left", whiteSpace: "pre-wrap", margin: 0, maxHeight: 180, overflow: "auto" }}>
              {diag.join("\n")}
            </pre>
          )}
          {diag.length > 0 && (
            <button onClick={() => { navigator.clipboard?.writeText(diag.join("\n")); setStatus("نُسخ السجل"); }}
              className="w-full mt-2 py-1.5 rounded-lg text-[11px]"
              style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
              انسخ السجل لإرساله
            </button>
          )}
        </Card>
        </details>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">رقاقة RFID</p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          {/* الرقاقة تُكتب مع كل ملصق ولا مفتاح لإيقافها */}
          <p className="w-full py-2 rounded-xl text-[11px] font-bold mb-2 text-center" data-rfid-fixed
            style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--line)", margin: "0 0 8px" }}>
            ✓ يُكتب الرمز في الرقاقة مع كل ملصق — ثابت
          </p>
          {cfg.rfid && (
            <>
              {/* لا قفل بـ^RL حتى يُتحقَّق من ترتيب معاملاته في الدليل وتثبت الكتابة أولًا */}
              <p style={{ color: "var(--text3)", margin: "4px 0 8px" }} className="text-[11px] leading-7">
                الأمر ثابتٌ من دليل Zebra الرسميّ: <b style={{ direction: "ltr", display: "inline-block" }}>^RFW,H,2,12,1</b>
                — الرقاقة Impinj M830 بـ96 بتًا، بنك EPC وحده. <b>القفل يُضاف بعد أن تثبت الكتابة.</b>
              </p>

              <button onClick={askDevice} disabled={busy === "ask"}
                className="w-full py-2.5 rounded-xl text-[11px] font-bold mb-2"
                style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                {busy === "ask" ? "يسأل…" : "اسأل الطابعة عن طرازها"}
              </button>
              {askResult && (
                <Card style={{ padding: 10, marginBottom: 8, background: "var(--bg)" }}>
                  {!askResult.supported ? (
                    <p style={{ color: "var(--bad)", margin: 0 }} className="text-[11px] leading-7">⚠ {askResult.reason}</p>
                  ) : !askResult.text ? (
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-7">
                      لم يصل جواب. بعض الطُّرز لا تردّ عبر البلوتوث — اقرأ الطراز من ملصق الجهاز نفسه.
                    </p>
                  ) : (
                    <>
                      <p style={{ color: "var(--accentText)", margin: "0 0 3px" }} className="text-[11px] font-bold">
                        ردّ الطابعة{askResult.model ? ` — ${askResult.model}` : ""}
                      </p>
                      <p style={{ color: "var(--text2)", margin: 0, direction: "ltr", fontFamily: "monospace",
                        fontSize: FS.xs, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{askResult.text}</p>
                      {askResult.oem && (
                        <p style={{ color: "var(--accentText)", margin: "5px 0 0" }} className="text-[11px] leading-7">
                          ⚠ الصانع الحقيقي <b>{askResult.oem}</b> — الاسم على العلبة قد يختلف.
                          <b> ابحث عن دليل الطراز أعلاه</b> لا عن اسم العلبة.
                        </p>
                      )}
                      <p style={{ color: askResult.mentionsRfid ? "var(--good)" : "var(--bad)", margin: "5px 0 0" }}
                        className="text-[11px] leading-7">
                        {askResult.mentionsRfid
                          ? "✓ الجواب يذكر RFID — الطراز يدعم الرقاقة."
                          : <>⚠ <b>الجواب لا يذكر RFID.</b> وهذا لا يحسم، لكنّ الحاسم واحد:
                            <b> اطبع صفحة SELFTEST</b> من الزرّ أعلى الشاشة. إن لم تذكر RFID
                            فالطابعة <b>بلا وحدة ترميز</b> — ولا صيغةَ أمرٍ تُصلح ذلك، لأن
                            العتاد نفسه غير موجود.</>}
                      </p>
                    </>
                  )}
                </Card>
              )}

              <button onClick={testRfid} disabled={busy === "rfid"}
                className="w-full py-2.5 rounded-xl text-[11px] font-bold"
                style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
                {busy === "rfid" ? "يكتب…" : "اكتب في الرقاقة وحدها — جرّب الصيغة"}
              </button>

              <div style={{ background: "var(--bg)", borderRadius: 10, padding: 10, marginTop: 8 }}>
                <p style={{ color: "var(--accentText)", margin: "0 0 4px" }} className="text-[11px] font-bold">
                  إن لم تُكتب الرقاقة
                </p>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-7">
                  <b>①</b> ابدأ بـ<b>«الكلّ معًا»</b> — هي المختارة. اضغط الزرّ أعلاه ثم
                  <b>امسح الملصق بقارئ RFID</b>. إن قرأتَ <b>TESTRFID</b> فقد نجحت، واتركها.<br />
                  <b>②</b> إن لم يُقرأ شيء — جرّب الصيغ <b>واحدةً واحدة</b> بالترتيب.<br />
                  <b>③</b> إن لم تعمل واحدةٌ منها، فافتح <b>Sample_Code.java</b> في حزمة SDK
                  الشركة، وابحث عن السطر الذي فيه <b>RFID</b>، والصقه في الصندوق أعلاه كما هو
                  مع وضع <b>{"{HEX}"}</b> مكان البيانات.
                </p>
                <p style={{ color: "var(--bad)", margin: "6px 0 0" }} className="text-[11px] leading-7">
                  ⚠ <b>وموضع الهوائي يهمّ.</b> صفحة الفحص تُظهر <b>ANTENNA POSITION</b> —
                  والرقاقة تُكتب وهي تحته تمامًا. فإن كان الملصق مائلًا أو الورق غير مشدود
                  مرّت بلا كتابة. <b>عايِر الطابعة</b> قبل التجربة.
                </p>
                <div style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8 }}>
                  <p style={{ color: "var(--accentText)", margin: "0 0 3px" }} className="text-[11px] font-bold">
                    لماذا القارئ يُظهر رمزًا طويلًا؟
                  </p>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-7">
                    رقاقة EPC تحفظ <b>96 بت رقمية</b> لا حروفًا. فيُكتب الرمز مُشفَّرًا،
                    والقارئ العام يعرضه <b>ست عشريًّا</b> — وهذا سليم:
                  </p>
                  <p style={{ color: "var(--text2)", margin: "4px 0", fontFamily: "monospace",
                    direction: "ltr", fontSize: FS.xs }}>
                    R7K2M9PQ → {codeToEpcHex("R7K2M9PQ")}
                  </p>
                  <p style={{ color: "var(--good)", margin: 0 }} className="text-[11px] leading-7">
                    ✓ <b>وقارئ أونصة يفكّه ويعرض الرمز نفسه.</b> جرّب من: الجرد ← قارئ RFID —
                    ستجد القطعة باسمها ووزنها.
                  </p>
                </div>
              </div>
            </>
          )}
        </Card>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">تخطيط الملصق — اسحب بإصبعك</p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          {/* ثلاثة نماذج ملصق لكلٍّ مقاسه وتخطيطه واسمه، وتُختار من صفحة التكويد أيضًا */}
          <Card style={{ padding: 11, marginBottom: 10, border: "1px solid var(--accentLine)" }} data-label-models-settings>
            <p style={{ color: "var(--accent)", margin: "0 0 5px" }} className="text-[11px] font-bold">نماذج الملصق — اختر نموذجًا ثم اضبط مقاسه وتخطيطه</p>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {labelModelList(cfg).map((m) => (
                <button key={m.id} type="button" aria-pressed={m.active} data-label-model-set={m.id}
                  data-help={`نموذج الملصق «${m.name}» (${m.w}×${m.h} مم) — اختره ثم اضبط مقاسه وتخطيطه تحته؛ ويُختار أيضًا من صفحة التكويد.`}
                  onClick={() => { if (m.active) return; const n = switchLabelModel(cfgRef.current, m.id); cfgRef.current = n; setCfg(n); onSave?.(n, { quiet: true }); }}
                  className="rounded-xl text-[11px] font-bold" style={{ minHeight: 48, background: m.active ? "var(--accentBg)" : "var(--field)", color: m.active ? "var(--accent)" : "var(--text2)", border: `1px solid ${m.active ? "var(--accentLine)" : "var(--line)"}` }}>
                  {m.name}<span style={{ color: "var(--text3)" }} className="block text-[10px] font-normal">{m.w}×{m.h} مم</span>
                </button>
              ))}
            </div>
            <Field label="اسم النموذج الفعّال">
              <input style={inputStyle} aria-label="اسم النموذج الفعّال" data-label-model-name maxLength={24}
                value={labelModelList(cfg).find((m) => m.active)?.name || ""}
                onChange={(e) => { const n = renameLabelModel(cfgRef.current, cfgRef.current.activeModel || "m1", e.target.value); cfgRef.current = n; setCfg(n); onSave?.(n, { quiet: true }); }} />
            </Field>
            <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-6">المقاس والتخطيط لكل نموذج وحده، والباقي (الطابعة · الدقّة · الرقاقة) مشترك.</p>
          </Card>
          <Card style={{ padding: 11, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--accent)", margin: "0 0 5px" }} className="text-[11px] font-bold">
              ① مقاس الورق — قِسه بمسطرة
            </p>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <MmInput label="العرض" value={cfg.labelWidthMm} max={120}
                onCommit={(v) => { const n = { ...cfg, labelWidthMm: v }; setCfg(n); onSave(n); }} />
              <MmInput label="الطول" value={cfg.labelHeightMm} max={200}
                onCommit={(v) => { const n = { ...cfg, labelHeightMm: v }; setCfg(n); onSave(n); }} />
              <span style={{ color: "var(--text2)" }} className="text-[11px]" data-gap-fixed>الفجوة {LABEL_GAP_MM} ثابتة</span>
              <span style={{ color: "var(--text3)" }} className="text-[11px]">مم</span>
            </div>
            {/* أمرٌ واحد موثّق: ^RFW من دليل Zebra، والطابعة تحاكي ZPL حسب دليل Gainscha */}
            <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
              <p style={{ color: "var(--accentText)", margin: "0 0 5px" }} className="text-[11px] font-bold">
                كتابة الرقاقة
              </p>
              <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl"
                style={{ background: (cfg.rfid && cfg.rfidVerified) ? "var(--goodBg)" : "var(--badBg)",
                  border: `1px solid ${(cfg.rfid && cfg.rfidVerified) ? "var(--goodLine)" : "var(--badLine)"}` }}>
                <span className="text-[11px] font-bold flex-1"
                  style={{ color: (cfg.rfid && cfg.rfidVerified) ? "var(--good)" : "var(--bad)" }}>
                  {(cfg.rfid && cfg.rfidVerified)
                    ? "✓ الرقاقة تُكتب مع كل ملصق"
                    : "⚠ الرقاقة لا تُكتب مع الطباعة"}
                </span>
              </div>
              <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[10px] leading-7">
                <b>قبل أول تجربة — معايرة الرقاقة من الطابعة</b> (من دليل الشركة):
                والطابعة جاهزة والضوء الأزرق ثابت، <b>اضغط FEED نحو 4 ثوانٍ</b> حتى تبدأ
                بسحب الورق ثم أفلت. تقيس الورق <b>وموضع كتابة الرقاقة تحت الهوائي</b>،
                وتنتهي حين يثبت الضوء الأزرق.<br />
                ثم «اكتب على الرقاقة وحدها» — <b>يخرج ملصقٌ واحد فارغ</b> برقاقته — وامسحه بالقارئ.
              </p>
              <button onClick={testFull} disabled={!!busy}
                className="w-full py-2.5 rounded-xl text-[11px] font-bold mb-1"
                style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                {busy === "full" ? "يُرسل…" : "اطبع ملصقًا كاملًا برقاقته — كما في التكويد"}
              </button>
              <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[10px] leading-7">
                إن كتبت «الرقاقة وحدها» ولم يكتب التكويد: اطبع هذا وامسحه. الصحيح يبدأ بـ
                <b style={{ direction: "ltr", display: "inline-block" }}> 5445535446554C4C</b> (= TESTFULL).
              </p>
              {askRfid && (
                <div className="flex flex-col gap-1.5 mb-2">
                  <p style={{ color: "var(--accentText)", margin: 0 }} className="text-[11px] font-bold">
                    ماذا قرأ القارئ؟
                  </p>
                  <button onClick={() => { set("rfidVerified", true); setAskRfid(false);
                      setStatus("✓ الرقاقة تُكتب — وتُكتب الآن مع كل ملصق."); }}
                    className="w-full text-right py-2.5 px-3 rounded-xl text-[11px] font-bold"
                    style={{ background: "var(--goodBg)", color: "var(--good)",
                      border: "1px solid var(--goodLine)" }}>
                    ✓ TESTRFID — أو 5445535452464944 بالهكس
                  </button>
                  <button onClick={() => { setAskRfid(false);
                      setStatus("جرّب الصيغة التالية ثم اكتب مرةً أخرى."); }}
                    className="w-full text-right py-2.5 px-3 rounded-xl text-[11px]"
                    style={{ background: "var(--field)", color: "var(--text2)",
                      border: "1px solid var(--line)" }}>
                    ✗ الرمز المصنعيّ ما زال — لم تُكتب
                  </button>
                </div>
              )}
            </div>

            {/* GAPDETECT معيارية في TSPL لكن بعض الطابعات تفهم غيرها، والأمر غير المفهوم يُبتلع بصمت */}
            <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
              <p style={{ color: "var(--accentText)", margin: "0 0 5px" }} className="text-[11px] font-bold">
                صيغة المعايرة — جرّبها إن لم تتحرّك الطابعة
              </p>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {CALIBRATE_MODES.map((m) => {
                  const on = (cfg.calibrateMode || "autodetect") === m.id;
                  return (
                    <button key={m.id} onClick={() => set("calibrateMode", m.id)}
                      data-help={`صيغة أمر المعايرة ${m.label} (${m.hint}) — اخترها ثم «عايِر الطابعة»؛ جرّب غيرها إن لم تتحرّك الورقة.`}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                      style={{ background: on ? "var(--accentBg)" : "var(--field)",
                        color: on ? "var(--accent)" : "var(--text3)",
                        border: "1px solid var(--line)" }}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
                {(CALIBRATE_MODES.find((m) => m.id === (cfg.calibrateMode || "autodetect")) || {}).hint}
                {" · "}
                <b>①  مُجرَّبة وتعمل</b> — وإن لم تتحرّك طابعتك فجرّب ②③،
                ثم ④ لتعرف أن الاتصال سليم.
              </p>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
              <p style={{ color: "var(--bad)", margin: "0 0 6px" }} className="text-[11px] font-bold">
                إعادة الطابعة لإعدادات المصنع — من دليل الشركة
              </p>
              <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[10px] leading-7">
                ① أطفئ الطابعة · ② <b>اضغط FEED واستمرّ</b> · ③ شغّلها وأنت ضاغط ·
                ④ <b>أفلت حين يثبت الضوء الأزرق وحده</b> — فتصفّر <b>خمس مرّات</b>
                وتعود لإعدادات المصنع.<br />
                ⚠ أضواءٌ أخرى أثناء الضغط تعني وظائف أخرى: <b>الأخضر وحده</b> = صفحة
                فحص · <b>الأحمر وحده</b> = تخطّي AUTO.BAS · <b>الأزرق والأحمر معًا</b> = وضع Dump.
              </p>

              <div style={{ background: "var(--bg)", border: "1px solid var(--line)",
                borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}
                className="text-[10px] leading-7">
                <b style={{ color: "var(--accentText)" }}>ماذا يعني الضوء؟</b><br />
                🔵 أزرق ثابت = جاهزة (ومعه 🟢 أخضر = وضع الشريط)<br />
                🔴 أحمر يومض = <b>انتهى الورق</b><br />
                🔴🔵 أحمر وأزرق يومضان = <b>لا تجد الفجوة</b> ← عايِر<br />
                🔴 أحمر ثابت + 🟢 أخضر يومض = <b>انتهى الشريط</b> أو ملفوفٌ خطأ<br />
                🔴🟢 أحمر وأخضر بالتناوب = خطأٌ آخر<br />
                ⚠ بعد إصلاح السبب: <b>اضغط FEED مرّة</b> لإلغاء الخطأ.
              </div>

              <button onClick={factoryReset} disabled={!!busy}
                className="w-full py-2.5 rounded-xl text-[11px] font-bold"
                style={{ background: "var(--field)", color: "var(--text2)",
                  border: "1px solid var(--line)" }}>
                أعِد إعدادات التطبيق للبداية
              </button>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
              <p style={{ color: "var(--accentText)", margin: "0 0 6px" }} className="text-[11px] font-bold">
                احفظ هذا الضبط
              </p>
              <div className="flex gap-2 mb-2">
                <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                  value={presetName} onChange={(e) => setPresetName(e.target.value)}
                  placeholder={`ملصق ${cfg.labelWidthMm || "?"}×${cfg.labelHeightMm || "?"} مم`} />
                <button onClick={savePreset}
                  className="px-4 rounded-xl text-[11px] font-bold"
                  style={{ background: "var(--accentBg)", color: "var(--accent)",
                    border: "1px solid var(--accentLine)" }}>
                  احفظ
                </button>
              </div>
              <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[10px] leading-6">
                ⚠ <b>الجهاز المقترن لا يُحفظ</b> — معرّفُه خاصٌّ بهذا الجوّال، واستعادتُه
                على جوّالٍ آخر تُشير لطابعةٍ غير موجودة.
              </p>

              {(presets || []).length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {presets.map((ps) => (
                    <div key={ps.name} className="flex items-center gap-2">
                      <button onClick={() => {
                          setCfg((p2) => ({ ...p2, ...ps.cfg,
                            deviceId: p2.deviceId, deviceName: p2.deviceName,
                            usbSerial: p2.usbSerial }));
                          setStatus(`استُعيد «${ps.name}» — اطبع إطار الفحص للتأكّد.`);
                        }}
                        data-help={`قالب إعدادٍ محفوظ «${ps.name}» — اضغطه لتستعيد ضبطه (والاقتران كما هو) ثم اطبع إطار الفحص.`}
                        className="flex-1 text-right py-2.5 px-3 rounded-xl text-[11px]"
                        style={{ background: "var(--bg)", color: "var(--text2)",
                          border: "1px solid var(--line)" }}>
                        <b>{ps.name}</b>
                        <span className="block text-[10px]" style={{ color: "var(--text3)", marginTop: 1 }}>
                          {ps.cfg?.dpi} dpi · {ps.cfg?.calibrateMode} · حُفظ {ps.at}
                        </span>
                      </button>
                      <button onClick={() => onSavePresets?.((presets || []).filter((x) => x.name !== ps.name))} aria-label={`احذف القالب ${ps.name}`}
                        style={{ color: "var(--bad)", padding: "0 6px" }} className="text-[11px]">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showBytes && (
              <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
                <div className="flex items-baseline justify-between mb-1">
                  <span style={{ color: "var(--accentText)" }} className="text-[11px] font-bold">
                    ما أُرسل للطابعة
                  </span>
                  <button onClick={() => setShowBytes("")}
                    style={{ color: "var(--text3)" }} className="text-[10px]">أخفِ</button>
                </div>
                <pre style={{ background: "var(--bg)", border: "1px solid var(--line)",
                  borderRadius: 10, padding: 9, fontSize: 10, lineHeight: 1.9,
                  direction: "ltr", textAlign: "left", overflowX: "auto",
                  color: "var(--text2)", margin: 0, maxHeight: 150,
                  fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace" }}>
                  {showBytes}
                </pre>
                <button
                  onClick={() => { navigator.clipboard?.writeText(showBytes).catch(() => {}); }}
                  className="w-full py-2 rounded-xl text-[10px] mt-2"
                  style={{ background: "var(--field)", color: "var(--text2)",
                    border: "1px solid var(--line)" }}>
                  انسخ — لإرساله للمطوّر
                </button>
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
              <p style={{ color: "var(--accentText)", margin: "0 0 6px" }} className="text-[11px] font-bold">
                اتجاه الطباعة
              </p>
              <div className="grid grid-cols-2 gap-2 mb-1">
                {[[1, "الافتراضي"], [0, "اقلب 180°"]].map(([d, lab]) => {
                  const on = Number(cfg.direction ?? 1) === d;
                  return (
                    <button key={d} onClick={() => set("direction", d)}
                      data-help={d === 1 ? "اتجاه الطباعة الافتراضي — اختره إن خرج الملصق معتدلًا." : "يقلب الطباعة 180° — اختره إن خرج الملصق مقلوبًا."}
                      className="py-2.5 rounded-xl text-[11px] font-bold"
                      style={{ background: on ? "var(--accentBg)" : "var(--field)",
                        color: on ? "var(--accent)" : "var(--text3)",
                        border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}` }}>
                      {on ? "✓ " : ""}{lab}
                    </button>
                  );
                })}
              </div>
              <p style={{ color: "var(--text3)", margin: "0 0 4px" }} className="text-[10px] leading-7">
                اطبع <b>إطار الفحص</b>: <b>المربّع الأسود يجب أن يخرج في الزاوية اليمنى العليا</b> —
                كما في المعاينة. إن خرج في الزاوية المقابلة، اضغط «اقلب 180°». والملصقات تتبع الإطار تمامًا.
              </p>
            </div>

            <details className="mt-3">
              <summary style={{ color: "var(--text2)", minHeight: 44 }} className="text-xs font-bold">متقدّم — المعايرة والإزاحة والدقّة</summary>
              <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
                <p style={{ color: "var(--accentText)", margin: "0 0 6px" }} className="text-[11px] font-bold">
                  الإزاحة — إن كانت الطباعة تخرج مائلةً أو تُقطع خطأً
                </p>

                <Field label={`موضع التوقّف: ${cfg.labelOffsetMm ?? 0} مم`}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => set("labelOffsetMm", Math.max(-10, (Number(cfg.labelOffsetMm) || 0) - 0.5))} aria-label="أنقص موضع التوقّف نصف مليمتر"
                      style={{ width: 40, height: 36, borderRadius: 10, background: "var(--field)",
                        border: "1px solid var(--line)", fontSize: 16, fontWeight: 800 }}>−</button>
                    <input type="range" min={-10} max={10} step={0.5} style={{ flex: 1 }}
                      value={Number(cfg.labelOffsetMm) || 0}
                      onChange={(e) => set("labelOffsetMm", Number(e.target.value))} />
                    <button onClick={() => set("labelOffsetMm", Math.min(10, (Number(cfg.labelOffsetMm) || 0) + 0.5))} aria-label="زد موضع التوقّف نصف مليمتر"
                      style={{ width: 40, height: 36, borderRadius: 10, background: "var(--field)",
                        border: "1px solid var(--line)", fontSize: 16, fontWeight: 800 }}>+</button>
                  </div>
                </Field>
                <p style={{ color: "var(--text3)", margin: "-4px 0 8px" }} className="text-[10px] leading-6">
                  ⚠ <b>أين تقف الورقة بعد الطباعة.</b> زِده إن كان الملصق لا يخرج كفايةً
                  لتقطعه، وأنقِصه إن كانت تُقطع على الملصق التالي.
                </p>

                <Field label={`إزاحة الطباعة: ${cfg.labelShiftDots ?? 0} نقطة (${((Number(cfg.labelShiftDots) || 0) / 12).toFixed(1)} مم)`}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => set("labelShiftDots", Math.max(-120, (Number(cfg.labelShiftDots) || 0) - 6))} aria-label="أنقص إزاحة الطباعة نصف مليمتر"
                      style={{ width: 40, height: 36, borderRadius: 10, background: "var(--field)",
                        border: "1px solid var(--line)", fontSize: 16, fontWeight: 800 }}>−</button>
                    <input type="range" min={-120} max={120} step={6} style={{ flex: 1 }}
                      value={Number(cfg.labelShiftDots) || 0}
                      onChange={(e) => set("labelShiftDots", Number(e.target.value))} />
                    <button onClick={() => set("labelShiftDots", Math.min(120, (Number(cfg.labelShiftDots) || 0) + 6))} aria-label="زد إزاحة الطباعة نصف مليمتر"
                      style={{ width: 40, height: 36, borderRadius: 10, background: "var(--field)",
                        border: "1px solid var(--line)", fontSize: 16, fontWeight: 800 }}>+</button>
                  </div>
                </Field>
                <p style={{ color: "var(--text3)", margin: "-4px 0 8px" }} className="text-[10px] leading-6">
                  ⚠ <b>يُحرّك الصورة على الورقة رأسيًّا</b> — لا الورقة نفسها. زِده إن كانت
                  الكتابة قريبةً من الحافّة العليا. وعند 300 dpi كل 12 نقطةً ≈ 1 مم.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={applyOffset} disabled={!!busy}
                    className="py-2.5 rounded-xl text-[11px] font-bold"
                    style={{ background: "var(--accentBg)", color: "var(--accent)",
                      border: "1px solid var(--accentLine)" }}>
                    {busy === "offset" ? "يُرسل…" : "طبّق الإزاحة"}
                  </button>
                  <button onClick={printCalLabel} disabled={!!busy}
                    className="py-2.5 rounded-xl text-[11px] font-bold"
                    style={{ background: "var(--field)", color: "var(--text2)",
                      border: "1px solid var(--line)" }}>
                    اطبع إطار الفحص
                  </button>
                </div>
                <button onClick={() => { set("labelOffsetMm", 0); set("labelShiftDots", 0); }}
                  className="w-full py-2 rounded-xl text-[10px] mt-2"
                  style={{ color: "var(--text3)" }}>
                  أعِد الإزاحة للصفر
                </button>
              </div>

              <div className="flex items-center gap-1.5 mb-2">
                <span style={{ color: "var(--text3)" }} className="text-[11px]">دقّة الطابعة</span>
                {[203, 300].map((d) => {
                  const on = (Number(cfg.dpi) || 203) === d;
                  return (
                    <button key={d}
                      onClick={() => { const n = { ...cfg, dpi: d }; setCfg(n); onSave(n); }}
                      data-help={`دقّة الطابعة ${d} نقطة في البوصة — اخترها كما في ملصق الطابعة؛ الخطأ فيها يصغّر الطباعة أو يكبّرها.`}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
                      style={{ background: on ? "var(--accentBg)" : "var(--field)",
                        color: on ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>
                      {d} dpi
                    </button>
                  );
                })}
                <span style={{ color: "var(--text3)", marginInlineStart: "auto" }} className="text-[11px]">
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
              <div style={{ background: "var(--bg)", borderRadius: 10, padding: 10, marginTop: 8 }}>
                <p style={{ color: "var(--accentText)", margin: "0 0 4px" }} className="text-[11px] font-bold">
                  كيف تضبطها — بالترتيب
                </p>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-7">
                  <b>①</b> قِس الملصق بمسطرة واكتب العرض والطول.<br />
                  <b>②</b> «عايِر الطابعة» — تسحب ورقتين وتقيسهما بنفسها.<br />
                  <b>③</b> «اطبع إطار الفحص» ثم <b>قِس الإطار المطبوع بمسطرة</b>:
                </p>
                {/* سؤالٌ بعد الطباعة لا تحذير أحمر، فالأحمر في التطبيق يعني مالًا يضيع */}
                {calPrinted && (
                  <div style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8 }}>
                    <p style={{ color: "var(--accentText)", margin: "0 0 6px" }} className="text-[11px] font-bold">
                      كيف خرج الإطار؟
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => { setCalPrinted(false); setStatus("✓ ضُبطت الطابعة — ابدأ الطباعة."); }}
                        className="w-full text-right py-2.5 px-3 rounded-xl text-[11px] font-bold"
                        style={{ background: "var(--goodBg)", color: "var(--good)",
                          border: "1px solid var(--goodLine)" }}>
                        ✓ يملأ الملصق تمامًا — انتهيت
                      </button>

                      <button onClick={() => {
                          const next = (Number(cfg.dpi) || 203) === 203 ? 300 : 203;
                          set("dpi", next);
                          setStatus(`بُدّلت الدقّة إلى ${next} dpi — اطبع الإطار ثانيةً.`);
                        }}
                        className="w-full text-right py-2.5 px-3 rounded-xl text-[11px]"
                        style={{ background: "var(--field)", color: "var(--text2)",
                          border: "1px solid var(--line)" }}>
                        <b>أصغر بنحو الثلث</b> — علامة 40 عند 27 مم
                        <span className="block text-[10px]" style={{ color: "var(--text3)", marginTop: 2 }}>
                          الدقّة خاطئة ← بدّلها إلى {(Number(cfg.dpi) || 203) === 203 ? "300" : "203"} dpi
                        </span>
                      </button>

                      <button onClick={() => { setCalPrinted(false);
                          setStatus("قِس الملصق بمسطرة وصحّح العرض والطول أعلاه، ثم اطبع الإطار."); }}
                        className="w-full text-right py-2.5 px-3 rounded-xl text-[11px]"
                        style={{ background: "var(--field)", color: "var(--text2)",
                          border: "1px solid var(--line)" }}>
                        <b>أصغر أو أكبر قليلًا</b>
                        <span className="block text-[10px]" style={{ color: "var(--text3)", marginTop: 2 }}>
                          المقاس خاطئ ← صحّح الأرقام أعلاه
                        </span>
                      </button>

                      <button onClick={() => { setCalPrinted(false);
                          setStatus("المقاس أكبر من ورقك — أنقِص العرض أو الطول ثم اطبع الإطار."); }}
                        className="w-full text-right py-2.5 px-3 rounded-xl text-[11px]"
                        style={{ background: "var(--field)", color: "var(--text2)",
                          border: "1px solid var(--line)" }}>
                        <b>انقطع من جهة</b>
                        <span className="block text-[10px]" style={{ color: "var(--text3)", marginTop: 2 }}>
                          المقاس أكبر من ورقك ← أنقِصه
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </details>
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
              <p style={{ color: "var(--text2)", margin: 0, minHeight: 36, display: "flex", alignItems: "center" }} className="text-[12px] font-bold">{LABEL_GAP_MM} — ثابتة</p>
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
            <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
              كثافة أعلى تُنتج طباعة أوضح وتستهلك الرأس أسرع.
            </p>
          </Field>
        </Card>

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
                {hint && <span style={{ color: "var(--text3)" }} className="block text-[11px]">{hint}</span>}
              </span>
              <Switch on={!!cfg[k]} onChange={() => set(k, !cfg[k])} label={label} />
            </div>
          ))}
        </Card>

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
              <span style={{ color: "var(--panel)", fontSize: FS.xs, fontWeight: 800, letterSpacing: 1 }}>ounce</span>
            )}
            <span style={{ color: "var(--panel)", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
              {(sample.units || [{}])[0].code || "A1001"}
            </span>
            <span style={{ color: "var(--panel)", fontSize: FS.xs }}>
              {cfg.showKarat ? `عيار ${sample.karat}` : ""}
              {cfg.showKarat && cfg.showWeight ? " · " : ""}
              {cfg.showWeight ? `${fmtW(sample.weight)} جم` : ""}
            </span>
            {cfg.showPrice && (
              <span style={{ color: "var(--panel)", fontSize: FS.xs, fontWeight: 700 }}>
                {currency}{fmt(samplePrice, 0)}
              </span>
            )}
            <div style={{ display: "flex", gap: 1, marginTop: 2 }}>
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} style={{ width: i % 3 === 0 ? 2 : 1, height: 12, background: "var(--panel)" }} />
              ))}
            </div>
          </div>
          <p style={{ color: "var(--text3)" }} className="text-[11px] text-center mt-2">
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

        <Card style={{ padding: 11, marginTop: 10 }}>
          <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-[11px] font-bold">
            نسخة الإعدادات
          </p>
          <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[11px] leading-7">
            ⚠ ضبطُ الملصق يأخذ وقتًا وورقًا. <b>انسخه واحفظه عندك</b> — تسترجعه في أي جهازٍ
            أو فرعٍ جديد بلصقةٍ واحدة، بدل إعادة الضبط من الصفر.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={copySettings} className="py-2.5 rounded-xl text-[11px] font-bold"
              style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
              انسخ إعداداتي
            </button>
            <button onClick={pasteSettings} disabled={!importText.trim()}
              className="py-2.5 rounded-xl text-[11px] font-bold"
              style={{ background: importText.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)",
                color: importText.trim() ? "var(--panel)" : "var(--text3)", border: "1px solid var(--line)" }}>
              استرجع
            </button>
          </div>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
            placeholder="الصق نسخة الإعدادات هنا ثم اضغط «استرجع»"
            style={{ ...inputStyle, minHeight: 66, marginTop: 8, direction: "ltr",
              fontFamily: "monospace", fontSize: 10 }} />
          <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[11px] leading-6">
            ⚠ الاسترجاع <b>لا يمسّ اقتران الطابعة</b> — يبقى اقتران هذا الجهاز كما هو.
          </p>
        </Card>

        {/* قارئ RFID جهازٌ ثانٍ في الأجهزة، يضبطه من يملك الإعدادات ويرى الباقون حالته */}
        {settings && (onSaveRfid ? (
          <div className="mt-3">
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">قارئ RFID</p>
            <RfidSettingsCard settings={rfidCfg} onSave={onSaveRfid} />
          </div>
        ) : (
          <Card style={{ padding: 12, marginTop: 12, marginBottom: 12 }}>
            <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">قارئ RFID: {({ ...RFID_DEFAULTS, ...(rfidCfg || {}) }).enabled ? "مفعّل" : "معطّل"} — يضبطه المدير</p>
            <RfidProtocolLine compact />
          </Card>
        ))}

        {/* جهاز الدفع جهازٌ ثالث: إعداده لهذا الجهاز وحده (كل نقطة بيعٍ جهازها)، ولا مال في وضع المخزون */}
        {settings && settings.appMode !== "inventory" && (
          <div className="mt-3">
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">جهاز الدفع</p>
            <PayTerminalCard />
          </div>
        )}

      </div>
    </div>
  );
}

export { PrinterSettingsPage };
