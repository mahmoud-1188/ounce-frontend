import React, { useState } from "react";
import { X } from "lucide-react";
import { fmtW } from "../core/money.js";
import { ModalShell } from "./ModalShell.jsx";

/// بيعٌ بلا سعر في فترة التجهيز: امسح القطع التي بيعت من البضاعة القديمة فتخرج من المخزون بلا فاتورةٍ ولا قيد،
/// ولا تدخل الرصيد الافتتاحي يوم «بدء التشغيل». items: أصناف الفرع بقطعها (units)
function SetupExitSheet({ items = [], exited = null, onExit, onClose }) {
  const [codes, setCodes] = useState([]);
  const [input, setInput] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const findUnit = (code) => {
    for (const it of items) for (const u of it.units || []) if (String(u.code).toUpperCase() === code) return { it, u };
    return null;
  };
  const add = (raw) => {
    const c = String(raw || "").trim().toUpperCase();
    if (!c) return;
    setInput("");
    if (codes.includes(c)) { setErr(`${c}: مضافة سلفًا`); return; }
    const f = findUnit(c);
    if (!f) { setErr(`${c}: ليست في المخزون`); return; }
    if (f.u.sold || f.u.issued || f.u.held) { setErr(`${c}: خرجت سلفًا`); return; }
    setErr("");
    setCodes((p) => [...p, c]);
  };
  const weight = codes.reduce((a, c) => a + (Number(findUnit(c)?.it.weight) || 0), 0);
  const submit = async () => {
    setBusy(true);
    try { const ok = await onExit(codes, note.trim()); if (ok) onClose(); } finally { setBusy(false); }
  };
  const box = { background: "var(--panel2, var(--panel))", color: "var(--text)", border: "1px solid var(--line)" };
  return (
    <ModalShell title="بيعٌ بلا سعر — فترة التجهيز" onClose={onClose}>
      <div data-setup-exit className="flex flex-col gap-3">
        <p style={{ color: "var(--text2)", margin: 0 }} className="text-[12px] leading-6">
          قبل «بدء التشغيل» لا فاتورة ولا سعر ولا قيد. إن باعت قطعةٌ من البضاعة القديمة فامسحها هنا لتخرج من المخزون — ولا تدخل الرصيد الافتتاحي.
        </p>
        <input data-setup-exit-input value={input} onChange={(e) => setInput(e.target.value)} autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
          placeholder="امسح رمز القطعة أو اكتبه ثم Enter" className="w-full px-3 py-2.5 rounded-xl text-sm" style={box} />
        {err && <p data-setup-exit-err style={{ color: "var(--bad)", margin: 0 }} className="text-[11px]">{err}</p>}
        {codes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {codes.map((c) => (
              <span key={c} data-setup-exit-code={c} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg" style={{ border: "1px solid var(--line)", color: "var(--text)" }}>
                {c}
                <button type="button" aria-label={`إزالة ${c}`} data-no-help="" onClick={() => setCodes((p) => p.filter((x) => x !== c))} style={{ color: "var(--text3)" }}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" className="w-full px-3 py-2 rounded-xl text-xs" style={box} />
        <button type="button" data-setup-exit-confirm disabled={busy || !codes.length} onClick={submit}
          className="w-full py-3 rounded-xl text-sm font-bold"
          style={{ background: codes.length ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--panel)", color: codes.length ? "var(--panel)" : "var(--text3)", border: "1px solid var(--line)" }}>
          {busy ? "…" : codes.length ? `أخرج ${codes.length} قطعة · ${fmtW(weight)} جم` : "أخرج القطع"}
        </button>
        {exited && exited.pieces > 0 && (
          <p data-setup-exited style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">خرج قبل التشغيل حتى الآن: {exited.pieces} قطعة · {fmtW(exited.weight)} جم</p>
        )}
      </div>
    </ModalShell>
  );
}

export { SetupExitSheet };
