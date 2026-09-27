import React, { useState } from "react";
import { EyeOff, Loader2, LogOut, PackageMinus } from "lucide-react";
import { Card } from "./Card.jsx";

/// شريط الوضع الخفي (المرجع 5.2.0): الجهاز على المخزون والجرد وحدهما.
///   «إخراج قطعة» يُعلّقها (تخرج من الرفّ لا من الدفتر) حتى يُكمَل بيعها في الوضع الكامل،
///   و«خروج» برقم مديرٍ وحده — التحديث والخمول لا يُخرجان منه.
function HiddenModeBar({ onHold, onExit }) {
  const [panel, setPanel] = useState(null); // 'hold' | 'exit'
  const [codes, setCodes] = useState("");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const close = () => { setPanel(null); setMsg(null); setPin(""); };
  const run = async (fn) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ bad: true, text: e?.message || "تعذّر التنفيذ" }); } finally { setBusy(false); }
  };
  const btn = { background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)" };
  const field = { width: "100%", background: "var(--field, var(--bg))", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px" };
  return (
    <>
      <div className="mx-4 mt-2 mb-1 rounded-2xl px-3 py-2 flex items-center gap-2" style={{ background: "var(--accentBg)", border: "1px solid var(--accentLine)" }}>
        <EyeOff size={15} color="var(--accent)" />
        <span className="text-[11px] font-bold flex-1" style={{ color: "var(--accent)" }}>الوضع الخفي — المخزون والجرد فقط</span>
        <button onClick={() => setPanel("hold")} className="px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1" style={btn}>
          <PackageMinus size={12} /> إخراج قطعة
        </button>
        <button onClick={() => setPanel("exit")} aria-label="خروج من الوضع الخفي" className="px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1" style={{ ...btn, color: "var(--bad)" }}>
          <LogOut size={12} /> خروج
        </button>
      </div>
      {panel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "var(--veil)" }} onClick={close}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340 }}>
            <Card style={{ padding: 18 }}>
              {panel === "hold" ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold" style={{ color: "var(--text)", margin: 0 }}>إخراج قطعٍ من الرفّ</p>
                  <p className="text-[11px]" style={{ color: "var(--text3)", margin: 0 }}>تُعلَّق القطعة حتى يُكمَل بيعها في الوضع الكامل أو يعيدها المدير — لا قيد عليها.</p>
                  <textarea rows={3} value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="امسح الرموز أو الصقها" style={{ ...field, resize: "none" }} />
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" style={field} />
                  {msg && <p className="text-[11px]" style={{ color: msg.bad ? "var(--bad)" : "var(--good)", margin: 0 }}>{msg.text}</p>}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button onClick={close} className="py-2.5 rounded-xl text-xs font-bold" style={btn}>إغلاق</button>
                    <button disabled={busy || !codes.trim()} onClick={() => run(async () => {
                      const r = await onHold(codes.split(/[\s,،;]+/).filter(Boolean), note);
                      setMsg({ text: `أُخرجت ${r.codes.length} قطعة (${r.ref})` }); setCodes(""); setNote("");
                    })} className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                      style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)", opacity: busy || !codes.trim() ? 0.5 : 1 }}>
                      {busy && <Loader2 size={13} className="animate-spin" />} أخرِج
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-center" style={{ color: "var(--text)", margin: 0 }}>الخروج من الوضع الخفي</p>
                  <p className="text-[11px] text-center" style={{ color: "var(--text3)", margin: 0 }}>برقم المدير السرّي وحده</p>
                  <input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    onKeyDown={(e) => { if (e.key === "Enter" && pin) run(() => onExit(pin)); }}
                    placeholder="••••" style={{ ...field, textAlign: "center", letterSpacing: 6 }} />
                  {msg && <p className="text-[11px] text-center" style={{ color: "var(--bad)", margin: 0 }}>{msg.text}</p>}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button onClick={close} className="py-2.5 rounded-xl text-xs font-bold" style={btn}>إلغاء</button>
                    <button disabled={busy || !pin} onClick={() => run(() => onExit(pin))} className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                      style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)", opacity: busy || !pin ? 0.5 : 1 }}>
                      {busy && <Loader2 size={13} className="animate-spin" />} خروج
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

export { HiddenModeBar };
