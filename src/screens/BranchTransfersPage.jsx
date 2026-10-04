import React, { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { fmtMoney, fmtW } from "../core/money.js";
import * as api from "../core/api.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// التحويل بين الفروع (وحدة branchTransfer · migration 051) — إرسالٌ برمز شحنة واستلامٌ هناك
/// الحلقة المغلقة (migration 069): المستلِم يعدّ ما وصل — الناقص يبقى «في الطريق» عند المرسِل حتى يقرّر مديره
function BranchTransfersPage({ currency = "ر.س", canMove = false, isManager = false, onChanged, onBack }) {
  const [d, setD] = useState(null);
  const [to, setTo] = useState("");
  const [codes, setCodes] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  // العدّ عند الاستلام: { id, arrived: Set(codes), weight, scan }
  const [count, setCount] = useState(null);
  const load = () => api.modulesApi.transfers().then((x) => { setD(x); if (!to && x.branches[0]) setTo(x.branches[0].id); }).catch(() => setD({ branches: [], transfers: [] }));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ERR = {
    module_off: "الوحدة مطفأة — فعّلها من «الوحدات الاختيارية»", stocktake_locked: "المخزون مقفلٌ للجرد",
    transfer_unknown_codes: "رمزٌ ليس في هذه الشحنة", transfer_nothing_received: "لم يصل شيء — اطلب من المرسِل إلغاء التحويل",
    transfer_no_open_shortage: "لا ناقص مفتوح على هذا التحويل", manager_only: "القرار للمدير", transfer_received: "استُلم من قبل",
    transfer_cancelled: "أُلغي التحويل", invalid_counted_weight: "وزن العدّ غير صالح",
  };
  const err = (e, f) => e?.body?.errors?.[0] || ERR[e?.body?.error] || f;
  const send = async () => {
    setBusy("send"); setMsg(null);
    try {
      const r = await api.modulesApi.sendTransfer({ toBranchId: to, codes: codes.split(/[\s,،;]+/).filter(Boolean), note });
      setMsg({ text: `أُرسلت ${r.transfer.pieces} قطعة (${r.transfer.ref})` }); setCodes(""); setNote(""); load(); onChanged?.();
    } catch (e) { setMsg({ bad: true, text: err(e, "تعذّر الإرسال") }); } finally { setBusy(null); }
  };
  const startCount = (t) => setCount({ id: t.id, arrived: new Set(t.lines.map((l) => String(l.code).toUpperCase())), weight: "", scan: "" });
  const receive = async (t) => {
    const missing = t.lines.map((l) => String(l.code).toUpperCase()).filter((c) => !count.arrived.has(c));
    if (missing.length === t.lines.length) { setMsg({ bad: true, text: "لم يصل شيء؟ — اطلب من المرسِل إلغاء التحويل" }); return; }
    setBusy(t.id); setMsg(null);
    try {
      const r = await api.modulesApi.receiveTransfer(t.id, { missing, countedWeight: count.weight === "" ? null : Number(count.weight) });
      setMsg({ text: r.transfer.status === "short"
        ? `استُلمت ${t.pieces - missing.length} قطعة — ناقص ${missing.length} يبقى في الطريق عند المرسِل حتى يقرّر مديره`
        : "استُلمت القطع كاملةً ودخلت المخزون" });
      setCount(null); load(); onChanged?.();
    } catch (e) { setMsg({ bad: true, text: err(e, "تعذّر الاستلام") }); } finally { setBusy(null); }
  };
  const settle = async (t, decision) => {
    const q = decision === "write_off"
      ? `تُقيَّد ${t.missing.length} قطعة عجزًا بتكلفتها ${fmtMoney(t.shortCost)} ${currency} (عجز التحويل 5340)؟`
      : `وُجدت ${t.missing.length} قطعة عندنا — تعود للرفّ؟`;
    if (!window.confirm(q)) return;
    setBusy(t.id); setMsg(null);
    try {
      await api.modulesApi.settleTransferShort(t.id, decision);
      setMsg({ text: decision === "write_off" ? "قُيّد الناقص عجزًا" : "عادت القطع للرفّ" }); load(); onChanged?.();
    } catch (e) { setMsg({ bad: true, text: err(e, "تعذّر القرار") }); } finally { setBusy(null); }
  };
  const act = async (id) => {
    if (!window.confirm("إلغاء التحويل وإعادة القطع للرفّ؟")) return;
    setBusy(id); setMsg(null);
    try {
      await api.modulesApi.cancelTransfer(id);
      setMsg({ text: "أُلغي التحويل" }); load(); onChanged?.();
    } catch (e) { setMsg({ bad: true, text: err(e, "تعذّر التنفيذ") }); } finally { setBusy(null); }
  };
  const ST = { sent: ["في الطريق", "var(--accent)"], received: ["استُلم", "var(--good)"], short: ["وصل ناقصًا", "var(--bad)"], cancelled: ["أُلغي", "var(--text3)"] };
  const openShort = d ? d.transfers.filter((t) => t.status === "short" && t.direction === "out").length : 0;
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
            <p className="text-[10px] mt-1.5" style={{ color: "var(--text3)" }}>تخرج القطع من الرفّ «في الطريق» حتى يعدّها الفرع ويستلمها — والتكلفة تنتقل معها (1350 ↔ 2140)، وما نقص يبقى في الطريق حتى قرار المدير.</p>
          </Card>
        )}
        {msg && <p className="text-[11px] mb-2" style={{ color: msg.bad ? "var(--bad)" : "var(--good)" }}>{msg.text}</p>}
        {openShort > 0 && (
          <Card style={{ padding: 10, marginBottom: 10, border: "1px solid var(--badLine)", background: "var(--badBg)" }}>
            <p className="text-[12px] font-bold" style={{ color: "var(--bad)", margin: 0 }}>{openShort} تحويل وصل ناقصًا — ينتظر قرار المدير</p>
            <p className="text-[11px]" style={{ color: "var(--text2)", margin: "2px 0 0" }}>الناقص يبقى «في الطريق» بتكلفته حتى يُقيَّد عجزًا أو يُوجد عندنا.</p>
          </Card>
        )}
        {!d ? <p className="text-xs" style={{ color: "var(--text3)" }}>جارِ التحميل…</p> : d.transfers.length === 0 ? <p className="text-xs" style={{ color: "var(--text3)" }}>لا تحويلات بعد.</p>
          : d.transfers.map((t) => (
            <Card key={t.id} style={{ padding: 12, marginBottom: 8 }}>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold flex-1" style={{ color: "var(--text)", margin: 0 }}>{t.direction === "in" ? `وارد من ${t.fromName}` : `صادر إلى ${t.toName}`} · {t.ref}</p>
                {t.stale && <span className="text-[10px] font-bold px-1.5 rounded" style={{ color: "var(--bad)", border: "1px solid var(--badLine)" }}>{t.ageDays} أيام في الطريق</span>}
                <span className="text-[11px] font-bold" style={{ color: (ST[t.status] || ST.sent)[1] }}>{(ST[t.status] || ST.sent)[0]}</span>
              </div>
              <p className="text-[11px]" style={{ color: "var(--text2)", margin: "4px 0 0" }}>
                {t.pieces} قطعة · {fmtW(t.totalWeight)} جم · بعيار 24: {fmtW(t.totalFine)} جم · التكلفة {fmtMoney(t.totalCost)} {currency}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text3)", margin: "2px 0 0" }}>{t.lines.map((l) => l.code).join(" · ")}{t.note ? ` — ${t.note}` : ""}</p>
              {(t.missing || []).length > 0 && (
                <p className="text-[11px]" style={{ color: "var(--bad)", margin: "4px 0 0" }}>
                  ناقص {t.missing.length}: {t.missing.join(" · ")} · {fmtMoney(t.shortCost)} {currency}
                  {t.shortDecision ? ` — ${t.shortDecision === "write_off" ? "قُيّد عجزًا" : "وُجد عند المرسِل"}` : ""}
                  {t.countedWeight != null ? ` · وزن العدّ ${fmtW(t.countedWeight)} جم` : ""}
                </p>
              )}
              {canMove && t.status === "sent" && t.direction === "in" && count?.id === t.id && (
                <div className="mt-2 p-2 rounded-lg" style={{ border: "1px solid var(--line)" }} data-transfer-count>
                  <p className="text-[11px] font-bold mb-1" style={{ color: "var(--text)" }}>عُدّ ما وصل — ألغِ علامة ما لم يصل، أو امسح رمز ما وصل</p>
                  <input style={inputStyle} value={count.scan} placeholder="امسح رمز قطعة وصلت ثم Enter"
                    onChange={(e) => setCount({ ...count, scan: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const c = count.scan.trim().toUpperCase();
                      if (!t.lines.some((l) => String(l.code).toUpperCase() === c)) { setMsg({ bad: true, text: `الرمز ${c} ليس في هذه الشحنة` }); setCount({ ...count, scan: "" }); return; }
                      const next = count.scanned ? new Set(count.arrived) : new Set();
                      next.add(c); setCount({ ...count, arrived: next, scanned: true, scan: "" });
                    }} />
                  <div className="flex flex-col gap-1 mt-1.5">
                    {t.lines.map((l) => {
                      const c = String(l.code).toUpperCase();
                      const on = count.arrived.has(c);
                      return (
                        <label key={c} className="flex items-center gap-2 text-[11px]" style={{ color: on ? "var(--text)" : "var(--bad)" }}>
                          <input type="checkbox" checked={on} onChange={() => { const next = new Set(count.arrived); on ? next.delete(c) : next.add(c); setCount({ ...count, arrived: next }); }} />
                          <span dir="ltr">{l.code}</span> · {l.category} · {fmtW(l.weight)} جم {on ? "" : "— ناقص"}
                        </label>
                      );
                    })}
                  </div>
                  <input style={{ ...inputStyle, marginTop: 6 }} inputMode="decimal" value={count.weight} onChange={(e) => setCount({ ...count, weight: e.target.value })}
                    placeholder={`وزن ما وصل بالميزان (اختياري) — المتوقّع ${fmtW(t.lines.filter((l) => count.arrived.has(String(l.code).toUpperCase())).reduce((a, l) => a + Number(l.weight || 0), 0))} جم`} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => receive(t)} disabled={busy === t.id} className="flex-1 py-2 rounded-lg text-[11px] font-bold" style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
                      {count.arrived.size === t.lines.length ? "استلم الكل" : `استلم ${count.arrived.size} — ناقص ${t.lines.length - count.arrived.size}`}
                    </button>
                    <button onClick={() => setCount(null)} className="px-3 py-2 rounded-lg text-[11px]" style={{ color: "var(--text2)", border: "1px solid var(--line)" }}>تراجع</button>
                  </div>
                </div>
              )}
              {canMove && t.status === "sent" && count?.id !== t.id && (
                <div className="flex gap-2 mt-2">
                  {t.direction === "in"
                    ? <button onClick={() => startCount(t)} disabled={busy === t.id} className="flex-1 py-2 rounded-lg text-[11px] font-bold" style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>عُدّ واستلم</button>
                    : <button onClick={() => act(t.id)} disabled={busy === t.id} className="flex-1 py-2 rounded-lg text-[11px] font-bold" style={{ background: "var(--panel)", color: "var(--bad)", border: "1px solid var(--line)" }}>ألغِ</button>}
                </div>
              )}
              {isManager && t.status === "short" && t.direction === "out" && !t.shortDecision && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => settle(t, "write_off")} disabled={busy === t.id} className="flex-1 py-2 rounded-lg text-[11px] font-bold" style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}>قيّده عجزًا</button>
                  <button onClick={() => settle(t, "found")} disabled={busy === t.id} className="flex-1 py-2 rounded-lg text-[11px] font-bold" style={{ background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)" }}>وُجدت عندنا</button>
                </div>
              )}
            </Card>
          ))}
      </div>
    </div>
  );
}

export { BranchTransfersPage };
