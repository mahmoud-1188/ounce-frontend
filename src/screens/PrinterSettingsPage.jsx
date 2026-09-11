import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { DEFAULT_PRINTER, PRINTER_SERVICES } from "../core/constants.js";
import { PURITY, fmt, fmtW } from "../core/money.js";
import { btSupported } from "../domain/helpers.js";
import { suggestQuestions } from "../domain/suggestQuestions.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
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
        /* الإذن قد يكون سُحب — يُعاد الاقتران يدويًا */
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

  const testPrint = async () => {
    setError("");
    setBusy("test");
    try {
      if (cfg.mode === "bluetooth" && deviceRef.current) {
        const server = await deviceRef.current.gatt.connect();
        const services = await server.getPrimaryServices();
        let wrote = false;
        for (const svc of services) {
          const chars = await svc.getCharacteristics();
          const target = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
          if (target) {
            const enc = new TextEncoder();
            // ESC @ لتصفير الطابعة، ثم نص، ثم تغذية وقطع
            const bytes = [
              0x1b, 0x40,
              ...enc.encode("\n  ONCE / أونصة\n  تجربة طباعة\n\n"),
              0x0a, 0x0a,
              ...(cfg.autoCut ? [0x1d, 0x56, 0x00] : []),
            ];
            await target.writeValue(new Uint8Array(bytes));
            wrote = true;
            break;
          }
        }
        if (!wrote) throw new Error("no writable characteristic");
        setStatus("أُرسلت تجربة الطباعة");
      } else {
        window.print();
        setStatus("فُتحت طباعة النظام");
      }
    } catch (e) {
      // ⚠ إصلاح محلي: كانت هذه الكتلة تحتوي على كود منسوخ خطأً من شاشة
      // محادثة مختلفة (يستخدم content/nextMessages/setMessages/setLoading
      // غير المعرّفة هنا)، يرمي ReferenceError عند فشل طباعة بلوتوث فعلي
      // ويمنع وصول رسالة الخطأ الصحيحة أدناه. أُزيل الكود الدخيل.
      setError("تعذّرت الطباعة — أعد الاقتران أو استخدم طباعة النظام");
    } finally {
      setBusy("");
    }
  };

  const sample = sampleItem || { karat: 21, weight: 12.4, categoryId: "chain", units: [{ code: "A1001" }] };
  const samplePrice = (Number(sample.weight) || 0) * (PURITY[sample.karat] || sample.karat / 24) * (price24 || 0);

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

// ============================================================
// التصنيفات وطرق البيع
// ============================================================

export { PrinterSettingsPage };
