import React, { useState } from "react";
import { CreditCard } from "lucide-react";
import { inputStyle } from "../domain/helpers.js";
import { PAY_TERMINAL_BRANDS, payTerminalPing, payTerminalRaw, payTerminalSave } from "../domain/payTerminal.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";

/// إعداد جهاز الدفع لهذا الجهاز: الجسر المحلّي (عنوانه ورمزه المشترك) وهل الاعتماد إلزاميٌّ قبل حفظ فاتورة الشبكة
function PayTerminalCard() {
  const [cfg, setCfg] = useState(() => payTerminalRaw());
  const [msg, setMsg] = useState(null);
  const set = (k, v) => { const next = { ...cfg, [k]: v }; setCfg(next); payTerminalSave(next); };
  const test = async () => { setMsg({ t: "…" }); const r = await payTerminalPing(cfg); setMsg(r.ok ? { t: `✓ ${r.info}`, good: true } : { t: `✗ ${r.why}` }); };
  return (
    <div data-pay-terminal-settings>
      <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 flex items-center gap-1.5"><CreditCard size={14} /> جهاز الدفع (مدى)</p>
      <Card style={{ padding: 14, marginBottom: 16 }}>
        <label className="flex items-center justify-between gap-2 text-[12px]" style={{ color: "var(--text)" }}>
          <span>اربط جهاز الدفع بشاشة البيع<span style={{ color: "var(--text3)" }} className="block text-[11px]">المبلغ يُرسل للجهاز ويُحفظ اعتماده على الفاتورة — عبر جسرٍ محلّي على هذا الجهاز</span></span>
          <input type="checkbox" data-pay-terminal-on checked={!!cfg.enabled} onChange={(e) => set("enabled", e.target.checked)} style={{ accentColor: "var(--accent)", width: 18, height: 18 }} />
        </label>
        {cfg.enabled && (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {PAY_TERMINAL_BRANDS.map((b) => (
                <button key={b.id} type="button" onClick={() => set("brand", b.id)} className="py-1.5 rounded-xl text-[11px] font-bold"
                  style={{ background: cfg.brand === b.id ? "var(--accentBg)" : "var(--panel)", color: cfg.brand === b.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{b.label}</button>
              ))}
            </div>
            <Field label="عنوان الجسر"><input style={inputStyle} dir="ltr" value={cfg.url} onChange={(e) => set("url", e.target.value.trim())} placeholder="http://127.0.0.1:9777" /></Field>
            <Field label="الرمز المشترك (اختياري)"><input style={inputStyle} dir="ltr" value={cfg.token} onChange={(e) => set("token", e.target.value.trim())} /></Field>
            <label className="flex items-center gap-2 text-[11px] mb-2" style={{ color: "var(--text2)" }}>
              <input type="checkbox" checked={!!cfg.require} onChange={(e) => set("require", e.target.checked)} style={{ accentColor: "var(--accent)" }} />
              لا تُحفظ فاتورة شبكةٍ بلا اعتماد (من الجهاز أو رقمه من الإيصال)
            </label>
            <button type="button" data-pay-terminal-test onClick={test} className="w-full py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>اختبر الاتصال بالجسر</button>
            {msg && <p data-pay-terminal-msg style={{ color: msg.good ? "var(--good)" : "var(--text2)" }} className="text-[11px] mt-1">{msg.t}</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

export { PayTerminalCard };
