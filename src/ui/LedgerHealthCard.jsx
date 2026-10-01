import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import * as api from "../core/api.js";
import { Card } from "./Card.jsx";

/// صحّة الدفتر (المرجع 5.2.0: auditHealth) — تُفحص على الخادم من الدفاتر كاملةً وتظهر حيث يُرى الدفتر.
/// سليمًا: سطرٌ واحد. وإلا: كل تنبيهٍ بسببه وأين يُراجَع.
function LedgerHealthCard({ canRepost = false, onReposted = null }) {
  const [h, setH] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => { setBusy(true); api.ledgerHealth().then(setH).catch(() => setH(null)).finally(() => setBusy(false)); };
  useEffect(load, []);
  const [posting, setPosting] = useState(null);
  const [msg, setMsg] = useState("");
  // ⚖ فحص الدفاتر (المرجع ت١): الفاتورة البسيطة بلا قيد يُرحّل قيدها المدير بضغطة، وغيرها يُقال إنه يدوي
  const repost = async (u) => {
    setPosting(u.id); setMsg("");
    try { await api.repostSale(u.id); setMsg(`رُحّل قيد ${u.ref}`); onReposted?.(); load(); }
    catch (e) { setMsg(e?.body?.error === "needs_manual_entry" ? `${u.ref}: قيدها يُكتب يدويًا` : `تعذّر ترحيل ${u.ref}`); }
    finally { setPosting(null); }
  };
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
      {(h.unposted || []).length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {h.unposted.slice(0, 20).map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span style={{ color: "var(--text2)" }}>{u.label} {u.ref} — بلا قيد</span>
              {u.repairable && canRepost ? (
                <button onClick={() => repost(u)} disabled={!!posting} className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                  style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                  {posting === u.id && <Loader2 size={10} className="animate-spin" />} رحّل قيدها
                </button>
              ) : (
                <span style={{ color: "var(--text3)" }} className="text-[10px]">{u.repairable ? "للمدير" : "قيدٌ يدوي"}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {msg && <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[10px]">{msg}</p>}
    </Card>
  );
}

export { LedgerHealthCard };
