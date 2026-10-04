import React, { useState } from "react";
import { BookmarkCheck, Plus } from "lucide-react";
import { fmt, fmtMoney, fromHalalas, halalas } from "../core/money.js";
import { inputStyle, itemLabel } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

const todayYmd = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/// جدول التقسيط للمعاينة — نفس قسمة الخادم: دفعاتٌ متساوية وآخرها يأخذ كسر الهللة
function instalmentPreview({ total, deposit, count, firstDue, everyDays }) {
  const left = halalas(total) - halalas(deposit);
  const n = Math.max(1, Math.min(24, Math.round(Number(count) || 1)));
  if (left <= 0) return [];
  const base = Math.floor(left / n);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(firstDue || "") ? new Date(`${firstDue}T12:00:00Z`) : new Date(Date.now() + 30 * 86400000);
  const step = Math.max(1, Math.round(Number(everyDays) || 30));
  return Array.from({ length: n }, (_, i) => ({
    n: i + 1,
    due: new Date(start.getTime() + i * step * 86400000).toISOString().slice(0, 10),
    amount: fromHalalas(i === n - 1 ? left - base * (n - 1) : base),
  }));
}

/// حالة التقسيط: المدفوع بعد العربون الأول يغطّي الدفعات بالترتيب، والمتأخّر ما حلّ أجله ولم يُغطَّ
function instalmentState(r, today = todayYmd()) {
  const plan = r?.plan;
  if (!plan || !Array.isArray(plan.schedule)) return null;
  let paid = halalas(r.deposit) - halalas(plan.initialDeposit || 0);
  let overdue = 0, overdueCount = 0, next = null;
  for (const x of plan.schedule) {
    const a = halalas(x.amount);
    const cover = Math.min(Math.max(paid, 0), a);
    paid -= cover;
    const rest = a - cover;
    if (rest > 0) {
      if (x.due < today) { overdue += rest; overdueCount += 1; }
      if (!next) next = { ...x, rest: fromHalalas(rest) };
    }
  }
  return { overdue: fromHalalas(overdue), overdueCount, next };
}

/// «محجوز حتى»: none بلا تاريخ · ok · due (اليوم أو غدًا) · expired (مضت المهلة)
function holdState(r, today = todayYmd()) {
  if (!r?.holdUntil || r.status !== "open") return { state: "none" };
  const days = Math.round((Date.parse(`${r.holdUntil}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return { state: days < 0 ? "expired" : days <= 1 ? "due" : "ok", days };
}

function ReservationsPage({ reservations, customers, activeItems, currency, canManage, onAdd, onCancel, onPay, onHold, onBack }) {
  const [showAdd, setShowAdd] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [itemId, setItemId] = useState("");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState("cash");
  const [holdUntil, setHoldUntil] = useState("");
  const [usePlan, setUsePlan] = useState(false);
  const [planCount, setPlanCount] = useState("3");
  const [planFirst, setPlanFirst] = useState(plusDays(30));
  const [planEvery, setPlanEvery] = useState("30");
  const [payFor, setPayFor] = useState(null);

  const open = reservations.filter((r) => r.status === "open");
  const held = open.reduce((a, r) => a + (Number(r.deposit) || 0), 0);
  const valid = customerId && Number(total) > 0 && Number(deposit) > 0 && Number(deposit) <= Number(total);
  const preview = usePlan && valid ? instalmentPreview({ total, deposit, count: planCount, firstDue: planFirst, everyDays: planEvery }) : [];
  const attention = open.filter((r) => holdState(r).state === "expired" || (instalmentState(r)?.overdueCount || 0) > 0).length;

  return (
    <div>
      <SubPageHeader title="الحجوزات والعربون" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
          العميل يدفع عربونًا ويستلم لاحقًا. البضاعة تبقى في مخزونك والمبلغ التزام عليك — لا إيراد حتى التسليم.
        </p>

        {open.length > 0 && (
          <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-1">عرابين محتجزة</p>
            <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--accent)" }} className="text-2xl font-extrabold">
              {fmt(held, 0)} {currency}
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">{open.length} حجز قائم — التزام حتى التسليم أو الإلغاء</p>
            {attention > 0 && (
              <p style={{ color: "var(--bad)" }} className="text-[11px] mt-1 font-bold">{attention} حجز انتهت مهلته أو تأخّر قسطه — راجعه مع العميل</p>
            )}
          </Card>
        )}

        {canManage &&
          (!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              disabled={customers.length === 0}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-4"
              style={{
                background: customers.length ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                color: customers.length ? "var(--panel)" : "var(--text3)",
              }}
            >
              <Plus size={17} /> {customers.length ? "حجز جديد" : "أضف عميلًا أولًا"}
            </button>
          ) : (
            <Card style={{ padding: 14, marginBottom: 16 }}>
              <Field label="العميل (إجباري)">
                <select style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">اختر العميل...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ""}</option>
                  ))}
                </select>
              </Field>
              <Field label="القطعة المحجوزة (اختياري)">
                <select style={inputStyle} value={itemId} onChange={(e) => setItemId(e.target.value)}>
                  <option value="">بلا قطعة محددة</option>
                  {activeItems.slice(0, 200).map((it) => (
                    <option key={it.id} value={it.id}>{itemLabel(it)}</option>
                  ))}
                </select>
              </Field>
              <Field label="الوصف (اختياري)">
                <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="مثال: طقم عيار 21 بالطلب" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`السعر المتفق (${currency})`}>
                  <NumericInput value={total} onChange={setTotal} />
                </Field>
                <Field label={`العربون (${currency})`}>
                  <NumericInput value={deposit} onChange={setDeposit} />
                </Field>
              </div>
              {Number(deposit) > Number(total) && Number(total) > 0 && (
                <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">العربون أكبر من السعر المتفق.</p>
              )}
              <Field label="محجوز حتى (اختياري — يُذكّرك بانتهاء المهلة)">
                <input type="date" style={inputStyle} value={holdUntil} min={todayYmd()} onChange={(e) => setHoldUntil(e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text)" }}>
                <input type="checkbox" checked={usePlan} onChange={(e) => setUsePlan(e.target.checked)} />
                الباقي بالتقسيط
              </label>
              {usePlan && (
                <div className="grid grid-cols-3 gap-2">
                  <Field label="عدد الدفعات"><NumericInput value={planCount} onChange={setPlanCount} /></Field>
                  <Field label="أول دفعة"><input type="date" style={inputStyle} value={planFirst} onChange={(e) => setPlanFirst(e.target.value)} /></Field>
                  <Field label="كل (يوم)"><NumericInput value={planEvery} onChange={setPlanEvery} /></Field>
                </div>
              )}
              {preview.length > 0 && (
                <div className="mb-3 text-[11px]" style={{ color: "var(--text2)" }}>
                  {preview.map((x) => <p key={x.n}>دفعة {x.n} · {x.due} · {fmtMoney(x.amount)} {currency}</p>)}
                </div>
              )}
              <Field label="استلام العربون">
                <div className="grid grid-cols-2 gap-2">
                  {[{ id: "cash", label: "نقدي" }, { id: "network", label: "شبكة" }].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className="py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: method === m.id ? "var(--accentBg)" : "var(--panel)", color: method === m.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Field>
              {Number(total) > 0 && Number(deposit) > 0 && (
                <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
                  المتبقي عند التسليم: {fmt(Number(total) - Number(deposit), 0)} {currency}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowAdd(false)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                  إلغاء
                </button>
                <button
                  disabled={!valid}
                  onClick={() => {
                    onAdd({ customerId, itemId: itemId || null, description, total: Number(total), deposit: Number(deposit), method,
                      holdUntil: holdUntil || null,
                      plan: usePlan ? { count: Number(planCount) || 1, firstDue: planFirst, everyDays: Number(planEvery) || 30 } : null });
                    setCustomerId(""); setItemId(""); setDescription(""); setTotal(""); setDeposit(""); setHoldUntil(""); setUsePlan(false); setShowAdd(false);
                  }}
                  className="py-2 rounded-xl text-xs font-bold"
                  style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
                >
                  حفظ الحجز
                </button>
              </div>
            </Card>
          ))}

        {reservations.length === 0 ? (
          <EmptyState icon={<BookmarkCheck size={36} color="var(--accentText)" />} title="لا حجوزات" sub="سجّل أول حجز بعربون"
            action={canManage && customers.length > 0 && !showAdd ? { label: "حجز جديد", onClick: () => setShowAdd(true) } : null} />
        ) : (
          <div className="flex flex-col gap-2">
            {reservations.map((r) => (
              <Card key={r.id} style={{ padding: 12, border: r.status === "open" ? "1px solid var(--accentLine)" : "1px solid var(--line)" }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                    {r.customerName}
                    <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{r.ref}</span>
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--panel)",
                      color: r.status === "open" ? "var(--accent)" : r.status === "cancelled" ? "var(--bad)" : "var(--goodSolid)",
                    }}
                  >
                    {r.status === "open" ? "قائم" : r.status === "cancelled" ? "ملغى" : "مُسلَّم"}
                  </span>
                </div>
                <p style={{ color: "var(--text2)" }} className="text-[11px] mt-0.5">
                  {r.description || "—"} · السعر {fmt(r.total, 0)} {currency} · عربون {fmt(r.deposit, 0)} {currency}
                </p>
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                  المتبقي {fmt(r.remaining, 0)} {currency} · {new Date(r.date).toLocaleDateString("en-GB")}
                  {r.createdBy ? ` · ${r.createdBy}` : ""}
                </p>
                {(() => {
                  const h = holdState(r);
                  const st = r.status === "open" ? instalmentState(r) : null;
                  return (
                    <>
                      {h.state !== "none" && (
                        <p style={{ color: h.state === "expired" ? "var(--bad)" : h.state === "due" ? "var(--accent)" : "var(--text3)" }} className="text-[11px] mt-0.5 font-bold">
                          {h.state === "expired" ? `انتهت المهلة ${r.holdUntil} — تواصل مع العميل` : `محجوز حتى ${r.holdUntil}`}
                        </p>
                      )}
                      {st && (
                        <p style={{ color: st.overdueCount ? "var(--bad)" : "var(--text2)" }} className="text-[11px] mt-0.5">
                          {st.overdueCount ? `متأخّر ${st.overdueCount} قسط — ${fmtMoney(st.overdue)} ${currency} · ` : ""}
                          {st.next ? `القسط التالي ${st.next.due} · ${fmtMoney(st.next.rest)} ${currency}` : "سُدّدت الأقساط"}
                        </p>
                      )}
                    </>
                  );
                })()}
                {r.status === "open" && canManage && onPay && (Number(r.total) - Number(r.deposit)) > 0.005 && (
                  payFor?.id === r.id ? (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1"><NumericInput value={payFor.amount} onChange={(v) => setPayFor({ ...payFor, amount: v })} placeholder="المبلغ" /></div>
                      <select style={{ ...inputStyle, width: 90 }} value={payFor.method} onChange={(e) => setPayFor({ ...payFor, method: e.target.value })}>
                        <option value="cash">نقدي</option>
                        <option value="network">شبكة</option>
                      </select>
                      <button disabled={!(Number(payFor.amount) > 0) || payFor.busy}
                        onClick={async () => { setPayFor({ ...payFor, busy: true }); const ok = await onPay(r.id, Number(payFor.amount), payFor.method); setPayFor(ok ? null : { ...payFor, busy: false }); }}
                        className="px-3 py-2 rounded-xl text-[11px] font-bold" style={{ background: "var(--accent)", color: "var(--panel)" }}>سجّل</button>
                      <button onClick={() => setPayFor(null)} className="px-2 py-2 text-[11px]" style={{ color: "var(--text3)" }}>✕</button>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setPayFor({ id: r.id, amount: String(instalmentState(r)?.next?.rest || ""), method: "cash" })}
                        className="flex-1 py-2 rounded-xl text-[11px] font-bold" style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                        + دفعة على الحجز
                      </button>
                      {onHold && (
                        <button onClick={() => { const v = window.prompt("محجوز حتى (YYYY-MM-DD) — اتركه فارغًا لإزالة المهلة", r.holdUntil || plusDays(7)); if (v !== null) onHold(r.id, v.trim()); }}
                          className="px-3 py-2 rounded-xl text-[11px] font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                          المهلة
                        </button>
                      )}
                    </div>
                  )
                )}
                {r.status === "open" && canManage && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => onCancel(r.id, true)}
                      className="py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
                    >
                      إلغاء وإرجاع العربون
                    </button>
                    <button
                      onClick={() => onCancel(r.id, false)}
                      className="py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
                    >
                      إلغاء ومصادرة العربون (إيراد)
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// اليومية — ملخص الحركة اليومية على صفحة واحدة
//
// تخطيط دفتر المحل الورقي: حركة الريال يمينًا، البيان وسطًا، حركة الكسر
// يسارًا، والأرصدة أسفل. الغرض ورقة واحدة تُقرأ وتُوقَّع وتُحفظ — لا
// شاشة تُتصفَّح.
// ============================================================

export { ReservationsPage };
