import React, { useEffect, useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { fmtMoney } from "../core/money.js";
import * as api from "../core/api.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// بطاقات الهدايا ونقاط الولاء (migration 052)
function GiftCardsPage({ customers = [], currency = "ر.س", isManager = false, onBack }) {
  const [d, setD] = useState(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [customerId, setCustomerId] = useState("");
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => api.modulesApi.giftCards().then(setD).catch(() => setD(false));
  useEffect(() => { load(); }, []);
  const m = (v) => `${fmtMoney(v)} ${currency}`;
  const run = async (key, fn, ok) => {
    setBusy(key); setMsg(null);
    try { const r = await fn(); setMsg({ text: ok(r) }); load(); }
    catch (e) {
      const code = e?.body?.error;
      setMsg({ bad: true, text: code === "module_off" ? "الوحدة مطفأة — فعّلها من «الوحدات الاختيارية»" : code === "insufficient_points" ? `النقاط لا تكفي (${e.body.available})` : code === "gift_card_used" ? "استُعملت البطاقة — لا تُلغى" : "تعذّر التنفيذ" });
    } finally { setBusy(null); }
  };
  if (d === false) return <div><SubPageHeader title="بطاقات الهدايا" onBack={onBack} /><p className="px-4 text-xs" style={{ color: "var(--bad)" }}>تعذّر التحميل</p></div>;
  const ST = { active: ["فعّالة", "var(--good)"], used: ["مستعملة", "var(--text3)"], void: ["ملغاة", "var(--bad)"] };
  return (
    <div className="pb-24">
      <SubPageHeader title="بطاقات الهدايا والولاء" onBack={onBack} />
      <div className="px-4 pt-3">
        {!d ? <p className="text-xs" style={{ color: "var(--text3)" }}>جارِ التحميل…</p> : (
          <>
            {!d.giftCardsOn && <Card style={{ padding: 12, marginBottom: 10 }}><p className="text-xs" style={{ color: "var(--text2)", margin: 0 }}>بطاقات الهدايا مطفأة — فعّلها من «الوحدات الاختيارية».</p></Card>}
            {d.giftCardsOn && (
              <Card style={{ padding: 12, marginBottom: 12 }}>
                <p className="text-xs font-bold mb-2 flex items-center gap-1" style={{ color: "var(--text)" }}><Gift size={14} /> بيع بطاقة</p>
                <div className="grid grid-cols-2 gap-2">
                  <input style={inputStyle} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="المبلغ" />
                  <select style={inputStyle} value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="cash">نقدًا</option><option value="network">شبكة</option>
                  </select>
                </div>
                <select style={{ ...inputStyle, marginTop: 6 }} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">بلا عميل</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button disabled={!(Number(amount) > 0) || busy === "sell"} onClick={() => run("sell", () => api.modulesApi.sellGiftCard({ amount: Number(amount), method, customerId: customerId || null }), (r) => { setAmount(""); return `بطاقة ${r.card.code} بـ${m(r.card.initial)}`; })}
                  className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                  style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)", opacity: Number(amount) > 0 ? 1 : 0.5 }}>
                  {busy === "sell" && <Loader2 size={13} className="animate-spin" />} بِع البطاقة
                </button>
              </Card>
            )}
            {msg && <p className="text-[11px] mb-2" style={{ color: msg.bad ? "var(--bad)" : "var(--good)" }}>{msg.text}</p>}
            {d.loyaltyOn && (
              <Card style={{ padding: 12, marginBottom: 12 }}>
                <p className="text-xs font-bold mb-1" style={{ color: "var(--text)" }}>نقاط الولاء</p>
                <p className="text-[10px] mb-1" style={{ color: "var(--text3)" }}>نقطةٌ لكل {d.loyalty.sarPerPoint} {currency} · قيمة النقطة {m(d.loyalty.pointValue)}</p>
                {d.points.length === 0 ? <p className="text-[11px]" style={{ color: "var(--text3)" }}>لا نقاط بعد.</p> : d.points.map((p) => (
                  <div key={p.customerId} className="flex items-center gap-2 py-1.5" style={{ borderTop: "1px solid var(--line)" }}>
                    <span className="text-[12px] flex-1" style={{ color: "var(--text)" }}>{p.name} · <b>{p.points}</b> نقطة</span>
                    {d.giftCardsOn && p.points > 0 && (
                      <button disabled={busy === p.customerId} onClick={() => run(p.customerId, () => api.modulesApi.redeemPoints(p.customerId, p.points), (r) => `بطاقة ${r.card.code} بـ${m(r.card.initial)}`)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold" style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>استبدل ببطاقة</button>
                    )}
                  </div>
                ))}
              </Card>
            )}
            {d.cards.map((g) => (
              <Card key={g.id} style={{ padding: 12, marginBottom: 8 }}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold flex-1" style={{ color: "var(--text)", margin: 0, fontFamily: "monospace" }}>{g.code}</p>
                  <span className="text-[11px] font-bold" style={{ color: ST[g.status][1] }}>{ST[g.status][0]}</span>
                </div>
                <p className="text-[11px]" style={{ color: "var(--text2)", margin: "4px 0 0" }}>
                  الرصيد {m(g.balance)} من {m(g.initial)}{g.customerName ? ` · ${g.customerName}` : ""} · {g.source === "loyalty" ? "من النقاط" : g.method === "network" ? "بيعت بالشبكة" : "بيعت نقدًا"} · {String(g.createdAt).slice(0, 10)}
                </p>
                {isManager && g.status === "active" && g.balance === g.initial && (
                  <button onClick={() => { if (window.confirm(`إلغاء ${g.code}؟`)) run(g.id, () => api.modulesApi.voidGiftCard(g.id), () => "أُلغيت البطاقة"); }}
                    className="mt-1 text-[11px] font-bold" style={{ color: "var(--bad)" }}>ألغِ</button>
                )}
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export { GiftCardsPage };
