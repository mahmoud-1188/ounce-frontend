import React, { useState } from "react";
import { RFID_DEFAULTS, RFID_MODES, RFID_SECTIONS } from "../core/constants.js";
import { rfidSettingsFor } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { NumericInput } from "./NumericInput.jsx";
import { PowerSlider } from "./PowerSlider.jsx";

function RfidSettingsCard({ settings, onSave }) {
  const cfg = { ...RFID_DEFAULTS, ...(settings || {}) };
  const [open, setOpen] = useState(null);
  const set = (patch) => onSave({ ...cfg, ...patch });
  const setSection = (id, patch) => set({
    perSection: { ...cfg.perSection, [id]: { ...(cfg.perSection?.[id] || {}), ...patch } },
  });

  return (
    <Card style={{ padding: 14, marginBottom: 16 }}>
      <div className="flex items-center justify-between mb-1">
        <span style={{ color: "var(--text)" }} className="text-[12px] font-bold">قارئ RFID</span>
        <button onClick={() => set({ enabled: !cfg.enabled })}
          className="px-3 py-1 rounded-full text-[11px] font-bold"
          style={{ background: cfg.enabled ? "var(--accentBg)" : "var(--field)",
                   color: cfg.enabled ? "var(--accent)" : "var(--text3)",
                   border: `1px solid ${cfg.enabled ? "var(--accentLine)" : "var(--line)"}` }}>
          {cfg.enabled ? "مفعّل" : "معطّل"}
        </button>
      </div>
      <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
        عند التفعيل يظهر زرّ المسح في الأقسام المسموح لها.
      </p>

      {cfg.enabled && (
        <>
          {/* ── خيار للكل ── */}
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[[true, "إعداد واحد للكل"], [false, "إعداد لكل قسم"]].map(([v, lbl]) => (
                <button key={String(v)} onClick={() => set({ applyToAll: v })}
                  className="py-2 rounded-xl text-[11px] font-bold"
                  style={{ background: cfg.applyToAll === v ? "var(--accentBg)" : "var(--field)",
                           color: cfg.applyToAll === v ? "var(--accent)" : "var(--text2)",
                           border: "1px solid var(--line)" }}>
                  {lbl}
                </button>
              ))}
            </div>

            {cfg.applyToAll ? (
              <>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">
                  قوة الإرسال — كل الأقسام
                </p>
                <PowerSlider value={cfg.globalPower} onChange={(v) => set({ globalPower: v })} />
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                {RFID_SECTIONS.map((s) => {
                  const own = cfg.perSection?.[s.id] || {};
                  const on = own.enabled !== false;
                  const eff = rfidSettingsFor(s.id, { rfid: cfg });
                  return (
                    <div key={s.id} style={{ background: "var(--field)", borderRadius: 12, padding: 10 }}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex-1 text-right">
                          <span style={{ color: "var(--text)" }} className="text-[11px] font-bold">{s.label}</span>
                          <span style={{ color: "var(--text3)" }} className="text-[10px] block">
                            {on ? `${eff.power} dBm · ${RFID_MODES.find((m) => m.id === eff.mode)?.label}` : "معطّل هنا"}
                          </span>
                        </button>
                        <button onClick={() => setSection(s.id, { enabled: !on })}
                          className="px-2 py-1 rounded-full text-[10px] font-bold"
                          style={{ background: on ? "var(--accentBg)" : "var(--panel)",
                                   color: on ? "var(--accent)" : "var(--text3)" }}>
                          {on ? "مفعّل" : "معطّل"}
                        </button>
                      </div>
                      {open === s.id && on && (
                        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
                          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{s.hint}</p>
                          <PowerSlider value={own.power ?? s.def.power}
                            onChange={(v) => setSection(s.id, { power: v })} />
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {RFID_MODES.map((m) => {
                              const sel = (own.mode ?? s.def.mode) === m.id;
                              return (
                                <button key={m.id} onClick={() => setSection(s.id, { mode: m.id })}
                                  className="text-right rounded-lg p-2"
                                  style={{ background: sel ? "var(--accentBg)" : "var(--panel)",
                                           border: `1px solid ${sel ? "var(--accentLine)" : "var(--line)"}` }}>
                                  <span style={{ color: sel ? "var(--accent)" : "var(--text)" }} className="text-[10px] font-bold block">{m.label}</span>
                                  <span style={{ color: "var(--text3)" }} className="text-[9px]">{m.hint}</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {[["autoStart", "يبدأ المسح تلقائيًا"], ["beep", "صفير عند القراءة"]].map(([k, lbl]) => {
                              const v = own[k] ?? s.def[k];
                              return (
                                <button key={k} onClick={() => setSection(s.id, { [k]: !v })}
                                  className="py-1.5 rounded-lg text-[10px] font-bold"
                                  style={{ background: v ? "var(--accentBg)" : "var(--panel)",
                                           color: v ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>
                                  {v ? "✓ " : ""}{lbl}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── إعدادات الراديو ── */}
          <details className="mt-3">
            <summary style={{ color: "var(--text3)" }} className="text-[10px]">إعدادات متقدّمة — ملف الراديو</summary>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[["profile", "ملف الوصلة", "53 قياسي · 11 سريع · 13 عميق"],
                ["q", "قيمة Q", "كثافة البطاقات المتوقّعة"],
                ["session", "الجلسة", "0=S0 · 1=S1 · 2=S2 · 3=S3"],
                ["target", "الهدف", "اتركه 0 إلا لحاجة"]].map(([k, lbl, hint]) => (
                <div key={k}>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{lbl}</p>
                  <NumericInput value={String(cfg[k])} onChange={(v) => set({ [k]: Number(v) || 0 })} />
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px]">{hint}</p>
                </div>
              ))}
            </div>
            <p style={{ color: "var(--bad)", margin: "6px 0 0" }} className="text-[10px] leading-6">
              ⚠ لا تُغيّرها بلا سبب. الدليل يوصي بتغيير معاملٍ واحد ثم الاختبار
              ببطاقةٍ مرجعية قبل الاعتماد.
            </p>
          </details>
        </>
      )}
    </Card>
  );
}

export { RfidSettingsCard };
