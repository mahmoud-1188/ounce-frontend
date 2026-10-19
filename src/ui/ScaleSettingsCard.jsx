import React, { useState } from "react";
import { inputStyle } from "../domain/helpers.js";
import { SCALE_PROTOCOLS, SCALE_TRANSPORTS, saveScaleSettings, scaleDisconnect, scaleRemember, scaleRememberedDevice, scaleSettings, useScaleLink } from "../domain/scale.js";
import { Field } from "./Field.jsx";

/// إعداد الميزان في هذا الجهاز: تفعيله ونوعه وسرعة منفذه، والميزان المحفوظ ونسيانه
function ScaleSettingsCard() {
  const L = useScaleLink();
  const [cfg, setCfg] = useState(scaleSettings);
  const [done, setDone] = useState("");
  const set = (patch) => { const next = { ...cfg, ...patch }; setCfg(next); saveScaleSettings(next); setDone("✓ حُفظ إعداد الميزان في هذا الجهاز"); };
  const mem = scaleRememberedDevice();
  const way = (t) => (t === "ble" ? "بلوتوث" : t === "serial" ? "منفذ تسلسلي" : t === "test" ? "تجريبي" : "");
  const forget = async () => {
    await scaleDisconnect("", { user: true });
    scaleRemember(null);
    setDone("✓ نُسي الميزان — اختره من جديد بـ«اتصل بالميزان» في صفحة التكويد");
  };
  return (
    <div data-scale-settings className="mb-3" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: 12 }}>
      <label className="flex items-center justify-between gap-2 mb-2">
        <span style={{ color: "var(--text)" }} className="text-[12px] font-bold">ميزان البلوتوث / USB في التكويد</span>
        <input type="checkbox" data-scale-enable checked={!!cfg.enabled} onChange={(e) => set({ enabled: e.target.checked })} style={{ accentColor: "var(--accent)", width: 18, height: 18 }} />
      </label>
      <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[11px] leading-5">
        يظهر شريط الميزان مرّةً واحدة أعلى قائمة التكويد: اتصل مرّةً وضع القطعة فيُكتب وزنها — ومن يكتب بيده يكتب في الخانة مباشرة.
      </p>
      {cfg.enabled && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="نوع الميزان">
              <select style={inputStyle} value={cfg.protocol} onChange={(e) => set({ protocol: e.target.value })}>
                {Object.entries(SCALE_PROTOCOLS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="سرعة المنفذ (baud)">
              <select style={inputStyle} value={cfg.baud} onChange={(e) => set({ baud: Number(e.target.value) })}>
                {[2400, 4800, 9600, 19200, 38400].map((b) => <option key={b} value={b}>{b}{b === 9600 ? " (المصنع)" : ""}</option>)}
              </select>
            </Field>
            <Field label="دقّة الميزان">
              <select style={inputStyle} value={cfg.resolution} onChange={(e) => set({ resolution: Number(e.target.value) })}>
                <option value={0.01}>0.01 جم</option>
                <option value={0.001}>0.001 جم</option>
              </select>
            </Field>
            <Field label="طريقة الاتصال">
              <select style={inputStyle} value={cfg.transport} onChange={(e) => set({ transport: e.target.value })}>
                {Object.entries(SCALE_TRANSPORTS).map(([id, t]) => <option key={id} value={id}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div data-scale-device className="mt-2" style={{ background: "var(--field)", border: "1px solid var(--line)", borderRadius: 12, padding: 10 }}>
            <p style={{ color: L.state === "on" ? "var(--good)" : "var(--text2)", margin: 0 }} className="text-[11px] font-bold">
              {L.state === "on" ? `● متّصل الآن — ${L.name || "الميزان"} (${way(L.transport)})` : "○ الميزان غير متّصل الآن — يتّصل من صفحة التكويد"}
            </p>
            <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[11px]">
              {mem ? `المحفوظ في هذا الجهاز: ${mem.name || "ميزان"} — ${way(mem.transport)}` : "لا ميزان محفوظ في هذا الجهاز بعد — يُحفظ عند أوّل اتصال"}
            </p>
            {(mem || L.state === "on") && (
              <button type="button" data-scale-forget onClick={forget} className="mt-2 px-3 rounded-xl text-[11px] font-bold"
                style={{ minHeight: 36, background: "var(--panel)", color: "var(--bad)", border: "1px solid var(--line)" }}>
                انسَ الميزان
              </button>
            )}
          </div>
        </>
      )}
      {done && <p style={{ color: "var(--good)", margin: "6px 0 0" }} className="text-[11px]">{done}</p>}
    </div>
  );
}

export { ScaleSettingsCard };
