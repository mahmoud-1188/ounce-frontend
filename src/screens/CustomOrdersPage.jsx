import React, { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { KARATS, fmtMoney, fmtW } from "../core/money.js";
import * as api from "../core/api.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// الطلبات الخاصة والتصنيع (وحدة customOrders · migration 059)
const STAGE = { received: "استُلم الطلب", design: "التصميم", workshop: "في الورشة", ready: "جاهز للتسليم", delivered: "سُلّم", cancelled: "أُلغي" };
const NEXT = { received: "design", design: "workshop", workshop: "ready" };

function CustomOrdersPage({ customers = [], currency = "ر.س", canCancel = false, onSell, onBack }) {
  const [orders, setOrders] = useState(null);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ customerId: "", description: "", karat: 21, estWeight: "", estPrice: "", deposit: "", depositMethod: "cash", dueDate: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = () => api.modulesApi.customOrders().then((d) => setOrders(d.orders)).catch(() => setOrders([]));
  useEffect(() => { load(); }, []);
  const m = (v) => `${fmtMoney(v)} ${currency}`;
  const num = (v) => String(v).replace(/[^\d.]/g, "");
  const err = (e) => (e?.body?.error === "module_off" ? "الوحدة مطفأة — فعّلها من «الوحدات الاختيارية»" : "تعذّر التنفيذ");
  const create = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api.modulesApi.createCustomOrder({ ...f, deposit: Number(f.deposit) || 0, estWeight: Number(f.estWeight) || null, estPrice: Number(f.estPrice) || null });
      setMsg({ text: `سُجّل ${r.order.ref}${r.order.deposit ? ` بعربون ${m(r.order.deposit)}` : ""}` }); setShow(false);
      setF({ customerId: "", description: "", karat: 21, estWeight: "", estPrice: "", deposit: "", depositMethod: "cash", dueDate: "", note: "" }); load();
    } catch (e) { setMsg({ bad: true, text: err(e) }); } finally { setBusy(false); }
  };
  const act = async (fn, ok) => { setMsg(null); try { await fn(); setMsg({ text: ok }); load(); } catch (e) { setMsg({ bad: true, text: err(e) }); } };
  return (
    <div className="pb-24">
      <SubPageHeader title="الطلبات الخاصة" onBack={onBack} />
      <div className="px-4 pt-3">
        {!show ? (
          <button onClick={() => setShow(true)} className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-3"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}><Plus size={16} /> طلبٌ جديد</button>
        ) : (
          <Card style={{ padding: 12, marginBottom: 12 }}>
            <select style={inputStyle} value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })}>
              <option value="">اختر العميل</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <textarea rows={2} style={{ ...inputStyle, marginTop: 6, resize: "none" }} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="المواصفة: القطعة والتصميم والمقاس" />
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              <select style={inputStyle} value={f.karat} onChange={(e) => setF({ ...f, karat: Number(e.target.value) })}>{KARATS.map((k) => <option key={k} value={k}>عيار {k}</option>)}</select>
              <input style={inputStyle} inputMode="decimal" value={f.estWeight} onChange={(e) => setF({ ...f, estWeight: num(e.target.value) })} placeholder="الوزن التقديري" />
              <input style={inputStyle} inputMode="decimal" value={f.estPrice} onChange={(e) => setF({ ...f, estPrice: num(e.target.value) })} placeholder="السعر التقديري" />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              <input style={inputStyle} inputMode="decimal" value={f.deposit} onChange={(e) => setF({ ...f, deposit: num(e.target.value) })} placeholder="العربون" />
              <select style={inputStyle} value={f.depositMethod} onChange={(e) => setF({ ...f, depositMethod: e.target.value })}><option value="cash">نقدًا</option><option value="network">شبكة</option></select>
              <input type="date" style={inputStyle} value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => setShow(false)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
              <button onClick={create} disabled={busy || !f.customerId || !f.description.trim()} className="py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)", opacity: !f.customerId || !f.description.trim() ? 0.5 : 1 }}>{busy && <Loader2 size={13} className="animate-spin" />} سجّل الطلب</button>
            </div>
          </Card>
        )}
        {msg && <p className="text-[11px] mb-2" style={{ color: msg.bad ? "var(--bad)" : "var(--good)" }}>{msg.text}</p>}
        {!orders ? <p className="text-xs" style={{ color: "var(--text3)" }}>جارِ التحميل…</p> : orders.map((o) => {
          const late = o.dueDate && !["delivered", "cancelled"].includes(o.stage) && String(o.dueDate).slice(0, 10) < new Date().toISOString().slice(0, 10);
          return (
            <Card key={o.id} style={{ padding: 12, marginBottom: 8, border: late ? "1px solid var(--badLine)" : undefined }}>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold flex-1" style={{ color: "var(--text)", margin: 0 }}>{o.ref} · {o.customerName}</p>
                <span className="text-[11px] font-bold" style={{ color: o.stage === "ready" ? "var(--good)" : o.stage === "cancelled" ? "var(--text3)" : "var(--accent)" }}>{STAGE[o.stage]}</span>
              </div>
              <p className="text-[11px]" style={{ color: "var(--text2)", margin: "4px 0 0" }}>
                {o.description}{o.karat ? ` · عيار ${o.karat}` : ""}{o.estWeight ? ` · ~${fmtW(o.estWeight)} جم` : ""}{o.estPrice ? ` · ~${m(o.estPrice)}` : ""}
              </p>
              <p className="text-[10px]" style={{ color: late ? "var(--bad)" : "var(--text3)", margin: "2px 0 0" }}>
                العربون {m(o.deposit)}{o.depositLeft > 0 && o.depositLeft !== o.deposit ? ` (الباقي ${m(o.depositLeft)})` : ""}{o.dueDate ? ` · الموعد ${String(o.dueDate).slice(0, 10)}${late ? " — متأخّر" : ""}` : ""}
              </p>
              {!["delivered", "cancelled"].includes(o.stage) && (
                <div className="flex gap-2 mt-2">
                  {NEXT[o.stage] && <button onClick={() => act(() => api.modulesApi.customOrderStage(o.id, NEXT[o.stage]), `${o.ref} ← ${STAGE[NEXT[o.stage]]}`)} className="flex-1 py-2 rounded-lg text-[11px] font-bold" style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>{STAGE[NEXT[o.stage]]} ←</button>}
                  {o.stage === "ready" && onSell && <button onClick={() => onSell(o)} className="flex-1 py-2 rounded-lg text-[11px] font-bold" style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>سلّم بفاتورة</button>}
                  {canCancel && <button onClick={() => { if (window.confirm(`إلغاء ${o.ref} وردّ العربون؟`)) act(() => api.modulesApi.cancelCustomOrder(o.id), "أُلغي الطلب ورُدّ العربون"); }} className="px-3 py-2 rounded-lg text-[11px] font-bold" style={{ background: "var(--panel)", color: "var(--bad)", border: "1px solid var(--line)" }}>ألغِ</button>}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export { CustomOrdersPage };
