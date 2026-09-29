import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import * as api from "../core/api.js";
import { Card } from "./Card.jsx";

/// صحّة الدفتر (المرجع 5.2.0: auditHealth) — تُفحص على الخادم من الدفاتر كاملةً وتظهر حيث يُرى الدفتر.
/// سليمًا: سطرٌ واحد. وإلا: كل تنبيهٍ بسببه وأين يُراجَع.
function LedgerHealthCard() {
  const [h, setH] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => { setBusy(true); api.ledgerHealth().then(setH).catch(() => setH(null)).finally(() => setBusy(false)); };
  useEffect(load, []);
  if (!h) return null;
  const clean = h.alerts.length === 0;
  const color = h.blocks ? "var(--bad)" : h.warns ? "var(--warn)" : "var(--good)";
  return (
    <Card style={{ padding: 11, marginBottom: 10, border: `1px solid ${h.blocks ? "var(--badLine)" : h.warns ? "var(--warnLine)" : "var(--goodLine)"}` }}>
      <div className="flex items-center justify-between gap-2">
        <p style={{ color, margin: 0 }} className="text-[12px] font-bold">
          {clean ? "✓ الدفتر كلّه متوازن — الصناديق والمخزون يطابقان الأستاذ" : h.blocks ? `✗ الدفتر مكسور — ${h.blocks} مانع` : `⚠ ${h.warns} تنبيه في الدفتر`}
        </p>
        <button onClick={load} disabled={busy} className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1"
          style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          {busy && <Loader2 size={10} className="animate-spin" />} أعد الفحص
        </button>
      </div>
      {h.alerts.map((a, i) => (
        <div key={i} className="mt-1.5">
          <p style={{ color: a.level === "block" ? "var(--bad)" : "var(--text)", margin: 0 }} className="text-[11px] font-bold">{a.title}</p>
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{a.why}{a.where ? ` · راجع: ${a.where}` : ""}</p>
        </div>
      ))}
    </Card>
  );
}

export { LedgerHealthCard };
