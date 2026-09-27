import React, { useEffect, useState } from "react";
import { EyeOff } from "lucide-react";
import * as api from "../core/api.js";
import { Card } from "./Card.jsx";

/// إعداد الوضع الخفي (migration 047) — للمدير: تفعيله، وتغيير رقمه (الافتراضي 123456).
function HiddenModeSettingsCard() {
  const [cfg, setCfg] = useState(null);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState(null);
  useEffect(() => { api.hiddenApi.settings().then(setCfg).catch(() => setCfg(false)); }, []);
  if (!cfg) return null;
  const save = async (body) => {
    setMsg(null);
    try {
      const r = await api.hiddenApi.saveSettings(body);
      setCfg(r); setPin("");
      setMsg({ text: body.pin ? "تغيّر رقم الوضع الخفي" : r.enabled ? "فُعّل الوضع الخفي" : "عُطّل الوضع الخفي" });
    } catch (e) {
      setMsg({ bad: true, text: e?.body?.error === "pin_taken" ? "الرقم مستخدمٌ لموظّف — اختر غيره" : e?.body?.error === "invalid_pin" ? "من 4 إلى 6 أرقام" : "تعذّر الحفظ" });
    }
  };
  return (
    <Card style={{ padding: 14, marginBottom: 12 }}>
      <div className="flex items-center gap-2 mb-1">
        <EyeOff size={15} color="var(--accent)" />
        <p className="text-xs font-bold flex-1" style={{ color: "var(--text)", margin: 0 }}>الوضع الخفي</p>
        <button onClick={() => save({ enabled: !cfg.enabled })} className="px-3 py-1 rounded-lg text-[11px] font-bold"
          style={{ background: cfg.enabled ? "var(--goodBg)" : "var(--panel)", color: cfg.enabled ? "var(--good)" : "var(--text2)", border: "1px solid var(--line)" }}>
          {cfg.enabled ? "مفعّل" : "معطّل"}
        </button>
      </div>
      <p className="text-[11px]" style={{ color: "var(--text3)", margin: "0 0 8px" }}>
        رقمٌ سرّيّ يُكتب في شاشة الدخول فيفتح الجهاز على المخزون والجرد وحدهما، وما يُخرج منه يُعلَّق حتى يُكمَل بيعه. الخروج برقم المدير.
        {cfg.isDefaultPin ? " ⚠ الرقم الآن الافتراضي 123456 — غيّره." : ""}
      </p>
      <div className="flex gap-2">
        <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="رقمٌ جديد (4–6)"
          className="flex-1 rounded-xl px-3 py-2 text-sm" style={{ background: "var(--field, var(--bg))", color: "var(--text)", border: "1px solid var(--line)" }} />
        <button disabled={pin.length < 4} onClick={() => save({ pin })} className="px-4 rounded-xl text-xs font-bold"
          style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)", opacity: pin.length < 4 ? 0.5 : 1 }}>غيّر</button>
      </div>
      {msg && <p className="text-[11px] mt-1.5" style={{ color: msg.bad ? "var(--bad)" : "var(--good)", margin: "6px 0 0" }}>{msg.text}</p>}
    </Card>
  );
}

export { HiddenModeSettingsCard };
