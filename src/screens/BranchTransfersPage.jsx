import React, { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { fmtMoney, fmtW } from "../core/money.js";
import * as api from "../core/api.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// التحويل بين الفروع (وحدة branchTransfer · migration 051) — إرسالٌ برمز شحنة واستلامٌ هناك
function BranchTransfersPage({ currency = "ر.س", canMove = false, onChanged, onBack }) {
  const [d, setD] = useState(null);
  const [to, setTo] = useState("");
  const [codes, setCodes] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => api.modulesApi.transfers().then((x) => { setD(x); if (!to && x.branches[0]) setTo(x.branches[0].id); }).catch(() => setD({ branches: [], transfers: [] }));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const err = (e, f) => (e?.body?.errors?.[0] || (e?.body?.error === "module_off" ? "الوحدة مطفأة — فعّلها من «الوحدات الاختيارية»" : e?.body?.error === "stocktake_locked" ? "المخزون مقفلٌ للجرد" : f));
  const send = async () => {
    setBusy("send"); setMsg(null);
    try {
      const r = await api.modulesApi.sendTransfer({ toBranchId: to, codes: codes.split(/[\s,،;]+/).filter(Boolean), note });
      setMsg({ text: `أُرسلت ${r.transfer.pieces} قطعة (${r.transfer.ref})` }); setCodes(""); setNote(""); load(); onChanged?.();
    } catch (e) { setMsg({ bad: true, text: err(e, "تعذّر الإرسال") }); } finally { setBusy(null); }
  };
  const act = async (id, kind) => {
    if (kind === "cancel" && !window.confirm("إلغاء التحويل وإعادة القطع للرفّ؟")) return;
    setBusy(id); setMsg(null);
    try {
      await (kind === "receive" ? api.modulesApi.receiveTransfer(id) : api.modulesApi.cancelTransfer(id));
      setMsg({ text: kind === "receive" ? "استُلمت القطع ودخلت المخزون" : "أُلغي التحويل" }); load(); onChanged?.();
    } catch (e) { setMsg({ bad: true, text: err(e, "تعذّر التنفيذ") }); } finally { setBusy(null); }
  };
  const ST = { sent: ["في الطريق", "var(--accent)"], received: ["استُلم", "var(--good)"], cancelled: ["أُلغي", "var(--text3)"] };
  return (
    <div className="pb-24">
      <SubPageHeader title="التحويل بين الفروع" onBack={onBack} />
      <div className="px-4 pt-3">
        {canMove && d && d.branches.length > 0 && (
          <Card style={{ padding: 12, marginBottom: 12 }}>
            <p className="text-xs font-bold mb-2" style={{ color: "var(--text)" }}>إرسال قطع</p>
            <select style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)}>
              {d.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <textarea rows={3} value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="امسح رموز القطع أو الصقها"
              style={{ ...inputStyle, marginTop: 6, resize: "none" }} />
            <input style={{ ...inputStyle, marginTop: 6 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" />
            <button onClick={send} disabled={busy === "send" || !codes.trim() || !to} className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)", opacity: !codes.trim() ? 0.5 : 1 }}>
              {busy === "send" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} أرسل
            </button>
            <p className="text-[10px] mt-1.5" style={{ color: "var(--text3)" }}>تخرج القطع من الرفّ «في الطريق» حتى يستلمها الفرع — والتكلفة تنتقل معها (1350 ↔ 2140).</p>
          </Card>
        )}
        {msg && <p className="text-[11px] mb-2" style={{ color: msg.bad ? "var(--bad)" : "var(--good)" }}>{msg.text}</p>}
        {!d ? <p className="text-xs" style={{ color: "var(--text3)" }}>جارِ التحميل…</p> : d.transfers.length === 0 ? <p className="text-xs" style={{ color: "var(--text3)" }}>لا تحويلات بعد.</p>
          : d.transfers.map((t) => (
            <Card key={t.id} style={{ padding: 12, marginBottom: 8 }}>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold flex-1" style={{ color: "var(--text)", margin: 0 }}>{t.direction === "in" ? `وارد من ${t.fromName}` : `صادر إلى ${t.toName}`} · {t.ref}</p>
                <span className="text-[11px] font-bold" style={{ color: ST[t.status][1] }}>{ST[t.status][0]}</span>
              </div>
              <p className="text-[11px]" style={{ color: "var(--text2)", margin: "4px 0 0" }}>
                {t.pieces} قطعة · {fmtW(t.totalWeight)} جم · بعيار 24: {fmtW(t.totalFine)} جم · التكلفة {currency}{fmtMoney(t.totalCost)}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text3)", margin: "2px 0 0" }}>{t.lines.map((l) => l.code).join(" · ")}{t.note ? ` — ${t.note}` : ""}</p>
              {canMove && t.status === "sent" && (
                <div className="flex gap-2 mt-2">
                  {t.direction === "in"
                    ? <button onClick={() => act(t.id, "receive")} disabled={busy === t.id} className="flex-1 py-2 rounded-lg text-[11px] font-bold" style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>استلم</button>
                    : <button onClick={() => act(t.id, "cancel")} disabled={busy === t.id} className="flex-1 py-2 rounded-lg text-[11px] font-bold" style={{ background: "var(--panel)", color: "var(--bad)", border: "1px solid var(--line)" }}>ألغِ</button>}
                </div>
              )}
            </Card>
          ))}
      </div>
    </div>
  );
}

export { BranchTransfersPage };
