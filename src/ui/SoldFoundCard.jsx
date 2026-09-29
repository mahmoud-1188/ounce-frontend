import React, { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import * as api from "../core/api.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";

const DECISIONS = [
  { id: "sale_ok", label: "البيع صحيح — القطعة ليست لنا" },
  { id: "returned", label: "إرجاع البيع" },
  { id: "added", label: "إضافة كقطعة جديدة" },
];

const ERRORS = {
  reason_required: "اكتب سبب القرار",
  already_decided: "قُرِّر هذا البند من قبل",
  return_not_found: "سجّل مرتجع الفاتورة أولًا ثم اربطه هنا",
  manager_only: "القرار للمدير",
  period_locked: "الفترة مقفلة — لا قيد جرد فيها",
};

/// «قطع مبيعة وُجدت في الجرد» (قرار المالك 2026-09-29): قطعةٌ مسجّلة مباعة قرأها الجرد على الرفّ لا تُضاف
/// زيادةً آليًّا — تبقى بند مراجعةٍ بفاتورتها وعميلها حتى يقرّر المدير بسببٍ مكتوب:
///   البيع صحيح (بلا قيد) · إرجاع البيع (بمرتجع الفاتورة بمساره المعتاد) · إضافة كقطعة جديدة (زيادة جرد بالتكلفة).
function SoldFoundCard({ reloadKey = 0, returns = [], canDecide = false, price24 = 0, onOpenReturn, onDecided, flashToast }) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(null);
  const [decision, setDecision] = useState("sale_ok");
  const [reason, setReason] = useState("");
  const [held, setHeld] = useState(false);
  const [returnId, setReturnId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.soldFoundApi.list().then((d) => setList((d.soldFound || []).filter((x) => x.status === "pending"))).catch(() => {});
  useEffect(() => { load(); }, [reloadKey]);
  if (!list.length) return null;

  const start = (f) => { setOpen(f.id); setDecision("sale_ok"); setReason(""); setHeld(false); setReturnId(""); };
  const submit = async (f) => {
    setBusy(true);
    try {
      await api.soldFoundApi.decide(f.id, { decision, reason, heldForCustomer: held, returnId: returnId || null, price24 });
      flashToast?.(decision === "added" ? `${f.code} أُضيفت قطعةً جديدة — زيادة جرد بتكلفتها`
        : decision === "returned" ? `أُغلق بند ${f.code} بمرتجع الفاتورة ${f.saleRef || ""}`
        : `البيع صحيح — ${f.code} ليست لنا${held ? " (أمانة بانتظار الاستلام)" : ""}`);
      setOpen(null);
      load();
      onDecided?.(decision);
    } catch (e) {
      flashToast?.(ERRORS[e?.body?.error] || "تعذّر حفظ القرار");
    } finally { setBusy(false); }
  };

  return (
    <div className="px-4 pt-3">
      <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--warnLine)" }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} color="var(--warn)" />
          <p className="text-sm font-bold flex-1" style={{ color: "var(--text)", margin: 0 }}>
            قطع مبيعة وُجدت في الجرد ({list.length})
          </p>
        </div>
        <p className="text-[11px]" style={{ color: "var(--text2)", margin: "4px 0 8px" }}>
          مسجّلة مباعة وقرأها الجرد على الرفّ — للمراجعة، لا تُضاف ولا تُباع حتى يُقرَّر فيها.
        </p>
        {list.map((f) => {
          const saleReturns = returns.filter((r) => r.saleId && r.saleId === f.saleId);
          return (
            <div key={f.id} className="py-2" style={{ borderTop: "1px solid var(--line)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--text)", margin: 0 }}>{f.code}</p>
              <p className="text-[11px]" style={{ color: "var(--text3)", margin: "2px 0 0" }}>
                فاتورة {f.saleRef || "—"}{f.saleDate ? ` · ${new Date(f.saleDate).toLocaleDateString("en-GB")}` : ""}
                {f.customerName ? ` · ${f.customerName}` : ""} · قرأها {f.foundBy || "—"} {f.foundAt ? new Date(f.foundAt).toLocaleString("en-GB") : ""}
              </p>
              {!canDecide ? (
                <p className="text-[11px] mt-1" style={{ color: "var(--text3)", margin: 0 }}>ينتظر قرار المدير.</p>
              ) : open !== f.id ? (
                <button onClick={() => start(f)} className="mt-2 text-[11px] px-3 py-1.5 rounded-full font-bold"
                  style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                  قرّر
                </button>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="grid grid-cols-1 gap-1">
                    {DECISIONS.map((d) => (
                      <button key={d.id} onClick={() => setDecision(d.id)} className="py-2 rounded-xl text-[11px] font-bold"
                        style={{ background: decision === d.id ? "var(--accentBg)" : "var(--field)", color: decision === d.id ? "var(--accent)" : "var(--text2)",
                          border: `1px solid ${decision === d.id ? "var(--accentLine)" : "var(--edge)"}` }}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {decision === "sale_ok" && (
                    <label className="text-[11px] flex items-center gap-2" style={{ color: "var(--text2)" }}>
                      <input type="checkbox" checked={held} onChange={(e) => setHeld(e.target.checked)} /> أمانة — بانتظار استلام العميل
                    </label>
                  )}
                  {decision === "returned" && (saleReturns.length ? (
                    <select style={inputStyle} value={returnId} onChange={(e) => setReturnId(e.target.value)}>
                      <option value="">اختر مرتجع الفاتورة…</option>
                      {saleReturns.map((r) => <option key={r.id} value={r.id}>{r.ref}</option>)}
                    </select>
                  ) : (
                    <button onClick={() => onOpenReturn?.(f.saleId)} className="py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--edge)" }}>
                      افتح مرتجع الفاتورة {f.saleRef || ""} — ثم عُد لربطه
                    </button>
                  ))}
                  {decision === "added" && (
                    <p className="text-[11px]" style={{ color: "var(--text3)", margin: 0 }}>
                      زيادة جرد بتكلفة الصنف في الدفترين، برمزٍ جديد — والرمز القديم يبقى على فاتورته.
                    </p>
                  )}
                  <input style={inputStyle} placeholder="السبب (مطلوب)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setOpen(null)} className="py-2 rounded-xl text-xs font-bold"
                      style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
                    <button disabled={busy || !reason.trim() || (decision === "returned" && !returnId)} onClick={() => submit(f)}
                      className="py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                      style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)",
                        opacity: busy || !reason.trim() || (decision === "returned" && !returnId) ? 0.5 : 1 }}>
                      {busy && <Loader2 size={12} className="animate-spin" />} احفظ القرار
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

export { SoldFoundCard };
