import React, { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { KARATS, fmtMoney, fmtW } from "../core/money.js";
import * as api from "../core/api.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// أوامر الشراء (وحدة purchaseOrders · migration 057) — أمرٌ للمورد ثم استلامه شراءً بالمقارنة
const blank = () => ({ key: Math.random().toString(36).slice(2), karat: 21, weight: "", pieces: "", costPerGram: "" });
const num = (v) => String(v).replace(/[^\d.]/g, "");
const PAY = [["deferred", "آجل"], ["safe_cash", "نقد الخزنة"], ["safe_network", "شبكة الخزنة"]];

function PurchaseOrdersPage({ suppliers = [], currency = "ر.س", onReceived, onBack }) {
  const [orders, setOrders] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [lines, setLines] = useState([blank()]);
  const [note, setNote] = useState("");
  const [recv, setRecv] = useState(null); // { order, pay, lines }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = () => api.modulesApi.purchaseOrders().then((d) => setOrders(d.orders)).catch(() => setOrders([]));
  useEffect(() => { load(); }, []);
  const m = (v) => `${fmtMoney(v)} ${currency}`;
  const err = (e) => (e?.body?.error === "module_off" ? "الوحدة مطفأة — فعّلها من «الوحدات الاختيارية»" : e?.body?.error === "insufficient_safe_balance" ? "رصيد الخزنة لا يكفي" : "تعذّر التنفيذ");
  const create = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api.modulesApi.createPurchaseOrder({ supplierId, note, lines: lines.filter((l) => Number(l.weight) > 0).map((l) => ({ karat: Number(l.karat), weight: Number(l.weight), pieces: Number(l.pieces) || 0, costPerGram: Number(l.costPerGram) || 0 })) });
      setMsg({ text: `أُنشئ ${r.order.ref}` }); setShowNew(false); setLines([blank()]); setNote(""); load();
    } catch (e) { setMsg({ bad: true, text: err(e) }); } finally { setBusy(false); }
  };
  const receive = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api.modulesApi.receivePurchaseOrder(recv.order.id, { paymentMethod: recv.pay, lines: recv.lines.map((l) => ({ karat: Number(l.karat), weight: Number(l.weight), costPerGram: Number(l.costPerGram), workmanshipTotal: Number(l.workmanshipTotal) || 0 })) });
      setMsg({ text: `استُلم ${recv.order.ref} شراءً ${r.purchase.ref} — الفرق عن المطلوب ${fmtW(r.variance)} جم` }); setRecv(null); load(); onReceived?.();
    } catch (e) { setMsg({ bad: true, text: err(e) }); } finally { setBusy(false); }
  };
  const ST = { open: ["مفتوح", "var(--accent)"], received: ["استُلم", "var(--good)"], cancelled: ["أُلغي", "var(--text3)"] };
  return (
    <div className="pb-24">
      <SubPageHeader title="أوامر الشراء" onBack={onBack} />
      <div className="px-4 pt-3">
        {!showNew ? (
          <button onClick={() => setShowNew(true)} className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-3"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}><Plus size={16} /> أمر شراء جديد</button>
        ) : (
          <Card style={{ padding: 12, marginBottom: 12 }}>
            <select style={inputStyle} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-4 gap-1 mt-1.5">
                <select style={inputStyle} value={l.karat} onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, karat: Number(e.target.value) } : x)))}>{KARATS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
                {[["weight", "الوزن"], ["pieces", "القطع"], ["costPerGram", "سعر الجرام"]].map(([f, ph]) => (
                  <input key={f} style={inputStyle} inputMode="decimal" placeholder={ph} value={l[f]} onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, [f]: num(e.target.value) } : x)))} />
                ))}
              </div>
            ))}
            <button onClick={() => setLines((p) => [...p, blank()])} className="text-[11px] mt-1" style={{ color: "var(--accentText)" }}>+ سطر</button>
            <input style={{ ...inputStyle, marginTop: 6 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => setShowNew(false)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
              <button onClick={create} disabled={busy || !supplierId || !lines.some((l) => Number(l.weight) > 0)} className="py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>{busy && <Loader2 size={13} className="animate-spin" />} احفظ الأمر</button>
            </div>
          </Card>
        )}
        {msg && <p className="text-[11px] mb-2" style={{ color: msg.bad ? "var(--bad)" : "var(--good)" }}>{msg.text}</p>}
        {!orders ? <p className="text-xs" style={{ color: "var(--text3)" }}>جارِ التحميل…</p> : orders.map((o) => (
          <Card key={o.id} style={{ padding: 12, marginBottom: 8 }}>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold flex-1" style={{ color: "var(--text)", margin: 0 }}>{o.ref} · {o.supplierName}</p>
              <span className="text-[11px] font-bold" style={{ color: ST[o.status][1] }}>{ST[o.status][0]}</span>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text2)", margin: "4px 0 0" }}>
              {o.lines.map((l) => `عيار ${l.karat} · ${fmtW(l.weight)} جم${l.pieces ? ` · ${l.pieces} قطعة` : ""}`).join(" | ")} · تقديريًّا {m(o.estTotal)}
              {o.receivedWeight != null ? ` · المستلم ${fmtW(o.receivedWeight)} جم (${fmtW(o.receivedWeight - o.totalWeight)})` : ""}
            </p>
            {o.status === "open" && recv?.order.id !== o.id && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => setRecv({ order: o, pay: "deferred", lines: o.lines.map((l) => ({ ...l, workmanshipTotal: "" })) })} className="flex-1 py-2 rounded-lg text-[11px] font-bold" style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>استلم</button>
                <button onClick={async () => { if (window.confirm(`إلغاء ${o.ref}؟`)) { await api.modulesApi.cancelPurchaseOrder(o.id).catch(() => {}); load(); } }} className="px-3 py-2 rounded-lg text-[11px] font-bold" style={{ background: "var(--panel)", color: "var(--bad)", border: "1px solid var(--line)" }}>ألغِ</button>
              </div>
            )}
            {recv?.order.id === o.id && (
              <div className="mt-2 space-y-1.5">
                <p className="text-[11px] font-bold" style={{ color: "var(--text)" }}>المستلم فعلًا</p>
                {recv.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-4 gap-1">
                    <span className="text-[11px] self-center" style={{ color: "var(--text2)" }}>عيار {l.karat}</span>
                    {[["weight", "الوزن"], ["costPerGram", "سعر الجرام"], ["workmanshipTotal", "المصنعية"]].map(([f, ph]) => (
                      <input key={f} style={inputStyle} inputMode="decimal" placeholder={ph} value={l[f]} onChange={(e) => setRecv((r) => ({ ...r, lines: r.lines.map((x, j) => (j === i ? { ...x, [f]: num(e.target.value) } : x)) }))} />
                    ))}
                  </div>
                ))}
                <select style={inputStyle} value={recv.pay} onChange={(e) => setRecv((r) => ({ ...r, pay: e.target.value }))}>{PAY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setRecv(null)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
                  <button onClick={receive} disabled={busy} className="py-2 rounded-xl text-xs font-bold" style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>سجّل الشراء</button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export { PurchaseOrdersPage };
