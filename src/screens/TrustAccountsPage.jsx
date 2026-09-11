import React, { useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { TRUST_MOVES } from "../core/constants.js";
import { PURITY, fine24, fmtMoney, fmtW, roundW, sumMoney } from "../core/money.js";
import { inputStyle, trustBalance } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function TrustAccountsPage({
  holders = [], ledger = [], currency, price24 = 0, openDay,
  canManage, onAddHolder, onMove, onBack,
  onReceipt, onShare,
  // ── الأمانة العينية: قطعةٌ بعينها تُردّ كما هي ──
  //
  // ⚠ غير الحساب الجاري: هذه قطعةٌ تُردّ بذاتها، وذاك رصيدٌ يُردّ
  // بمثله. خلطهما يجعل خاتم الإصلاح رصيدًا يُشترى به ذهب.
  //
  // وصاحبهما واحد — فالشاشة واحدة والتبويب مختلف.
  trustItems = [], onAddItem, onReturnItem,
}) {
  const [tab, setTab] = useState("list");
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", note: "" });
  const [mv, setMv] = useState({ move: "deposit_cash", amount: "", weight: "", karat: 21, note: "" });
  const [err, setErr] = useState([]);

  const balances = useMemo(() => {
    const m = {};
    holders.forEach((h) => { m[h.id] = trustBalance(ledger, h.id); });
    return m;
  }, [holders, ledger]);

  const totals = useMemo(() => {
    const v = Object.values(balances);
    return {
      cash: sumMoney(v, (b) => b.cash),
      fine: roundW(v.reduce((a, b) => a + b.fine, 0)),
      count: holders.length,
    };
  }, [balances, holders]);

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return holders;
    return holders.filter((h) =>
      `${h.name} ${h.phone || ""} ${h.ref || ""}`.includes(t));
  }, [q, holders]);

  const selected = sel ? holders.find((h) => h.id === sel) : null;
  const selBal = sel ? balances[sel] : null;
  const selRows = useMemo(
    () => (ledger || []).filter((r) => r.holderId === sel),
    [ledger, sel]);

  const moveDef = TRUST_MOVES.find((m) => m.id === mv.move);
  const needsCash = ["deposit_cash", "withdraw_cash"].includes(mv.move);
  const needsGold = ["deposit_gold", "withdraw_gold", "buy_gold", "sell_gold"].includes(mv.move);

  const preview = useMemo(() => {
    const w = Number(mv.weight) || 0;
    const k = Number(mv.karat) || 21;
    if (mv.move === "buy_gold") {
      return { label: "يُخصم من رصيده",
        value: `${currency}${fmtMoney(fine24(w, k) * price24)}` };
    }
    if (mv.move === "sell_gold") {
      return { label: "يُضاف لرصيده",
        value: `${currency}${fmtMoney(fine24(w, k) * price24)}` };
    }
    if (needsGold && w > 0) {
      return { label: "بمعادل عيار 24", value: `${fmtW(fine24(w, k))} جم` };
    }
    return null;
  }, [mv, price24, currency, needsGold]);

  const submit = () => {
    if (!sel) { setErr(["اختر صاحب الحساب"]); return; }
    const res = onMove({
      holderId: sel, move: mv.move,
      amount: Number(mv.amount) || 0,
      weight: Number(mv.weight) || 0,
      karat: Number(mv.karat) || 21,
      note: mv.note,
    });
    if (res) {
      setMv({ move: "deposit_cash", amount: "", weight: "", karat: 21, note: "" });
      setErr([]);
    }
  };

  return (
    <div>
      <SubPageHeader title="الحسابات الجارية — الأمانة" onBack={onBack} />
      <div className="px-4 pt-3">

        {/* ── الإجمالي ── */}
        <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--accent)", margin: 0 }} className="text-[11px] font-bold mb-1">
            التزاماتك تجاه أصحاب الحسابات
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">حسابات</p>
              <p style={{ color: "var(--text)", margin: 0 }} className="text-[14px] font-bold">
                {totals.count}
              </p>
            </div>
            <div>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">نقد لديك</p>
              <p style={{ color: "var(--bad)", margin: 0 }} className="text-[14px] font-bold">
                {currency}{fmtMoney(totals.cash)}
              </p>
            </div>
            <div>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">ذهب لديك</p>
              <p style={{ color: "var(--bad)", margin: 0 }} className="text-[14px] font-bold">
                {fmtW(totals.fine)} جم24
              </p>
            </div>
          </div>
          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1.5">
            ⚠ ليست ملكك — التزامٌ عليك يُسلَّم عند الطلب. لا تدخل ربحك ولا
            زكاتك ولا جردك.
          </p>
        </Card>

        <div className="flex gap-1.5 mb-3">
          {[["list", "الحسابات"], ["move", "حركة"], ["new", "حساب جديد"]].map(([id, lbl]) => {
            const on = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold"
                style={{
                  background: on ? "var(--accentBg)" : "var(--field)",
                  color: on ? "var(--accent)" : "var(--text2)",
                  border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`,
                }}>
                {lbl}
              </button>
            );
          })}
        </div>

        {err.length > 0 && (
          <Card style={{ padding: 10, marginBottom: 10, border: "1px solid var(--badLine)" }}>
            {err.map((e, i) => (
              <p key={i} style={{ color: "var(--bad)" }} className="text-[11px]">⚠ {e}</p>
            ))}
          </Card>
        )}

        {/* ── الحسابات ── */}
        {tab === "list" && (
          holders.length === 0 ? (
            <EmptyState icon={<Landmark size={34} color="var(--accentSoft)" />}
              title="لا حسابات جارية" sub="افتح حسابًا من «حساب جديد»" />
          ) : (
            <>
              <input style={inputStyle} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث بالاسم أو الجوال" className="mb-2" />
              <div className="flex flex-col gap-1.5">
                {filtered.map((h) => {
                  const b = balances[h.id] || { cash: 0, fine: 0, rows: 0 };
                  const on = sel === h.id;
                  return (
                    <Card key={h.id} style={{
                      padding: 11,
                      border: `1px solid ${on ? "var(--accentLine)" : "var(--edge)"}`,
                    }}>
                      <button onClick={() => setSel(on ? null : h.id)}
                        className="w-full text-right">
                        <div className="flex items-center gap-2">
                          <span style={{ color: "var(--text)" }}
                            className="text-[12px] font-bold flex-1 truncate">
                            {h.name}
                          </span>
                          <span style={{ color: "var(--text3)", fontFamily: "monospace" }}
                            className="text-[10px]">{h.ref}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span style={{ color: b.cash > 0 ? "var(--accent)" : "var(--text3)" }}
                            className="text-[11px] font-bold">
                            {currency}{fmtMoney(b.cash)}
                          </span>
                          <span style={{ color: b.fine > 0 ? "var(--accent)" : "var(--text3)" }}
                            className="text-[11px] font-bold">
                            {fmtW(b.fine)} جم24
                          </span>
                          <span style={{ color: "var(--text3)" }} className="text-[10px]">
                            {b.rows} حركة
                          </span>
                        </div>
                      </button>

                      {on && (
                        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
                          {Object.entries(selBal?.byKarat || {}).filter(([, w]) => Math.abs(w) > 0.0005)
                            .length > 0 && (
                            <p style={{ color: "var(--text3)" }} className="text-[10px] mb-1">
                              {Object.entries(selBal.byKarat)
                                .filter(([, w]) => Math.abs(w) > 0.0005)
                                .map(([k, w]) => `${fmtW(w)} ع${k}`).join(" · ")}
                            </p>
                          )}
                          {selRows.slice(0, 8).map((r) => (
                            <div key={r.id} className="py-1.5"
                              style={{ borderBottom: "1px solid var(--line)" }}>
                              <div className="flex items-baseline justify-between">
                                <span style={{ color: "var(--text2)" }} className="text-[10px]">
                                  {new Date(r.date).toLocaleDateString("en-GB")} · {r.moveLabel}
                                  {r.ref ? ` · ${r.ref}` : ""}
                                </span>
                                <span style={{
                                  color: r.dir === "in" ? "var(--good)" : "var(--bad)",
                                }} className="text-[11px] font-bold">
                                  {r.weight > 0 ? `${fmtW(r.weight)} ع${r.karat}` : ""}
                                  {r.weight > 0 && r.amount > 0 ? " · " : ""}
                                  {r.amount > 0 ? `${currency}${fmtMoney(r.amount)}` : ""}
                                </span>
                              </div>
                              {/* ⚠ السند لكل حركة لا للحساب كله.
                                  العميل يريد ورقة ما استلمه اليوم، لا كشفًا
                                  بكل تاريخه. */}
                              <div className="flex gap-1.5 mt-1">
                                <button
                                  onClick={() => onReceipt?.(h, r)}
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{ background: "var(--field)", color: "var(--accent)",
                                           border: "1px solid var(--accentLine)" }}>
                                  سند PDF
                                </button>
                                <button
                                  onClick={() => onShare?.(h, r)}
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{ background: "var(--field)", color: "var(--good)",
                                           border: "1px solid var(--goodLine)" }}>
                                  واتساب
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => { setTab("move"); }}
                            className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold"
                            style={{ background: "var(--accentBg)", color: "var(--accent)",
                                     border: "1px solid var(--accentLine)" }}>
                            حركة جديدة له
                          </button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </>
          )
        )}

        {/* ── حركة ── */}
        {tab === "move" && (
          <>
            <Field label="صاحب الحساب">
              <select style={inputStyle} value={sel || ""} onChange={(e) => setSel(e.target.value)}>
                <option value="">اختر…</option>
                {holders.map((h) => {
                  const b = balances[h.id] || {};
                  return (
                    <option key={h.id} value={h.id}>
                      {h.name} — {currency}{fmtMoney(b.cash || 0)} · {fmtW(b.fine || 0)} جم24
                    </option>
                  );
                })}
              </select>
            </Field>

            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
              نوع الحركة
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {TRUST_MOVES.map((m) => {
                const on = m.id === mv.move;
                return (
                  <button key={m.id} onClick={() => setMv((p) => ({ ...p, move: m.id }))}
                    className="text-right rounded-xl p-2.5"
                    style={{
                      background: on ? "var(--accentBg)" : "var(--field)",
                      border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`,
                    }}>
                    <p style={{ color: on ? "var(--accent)" : "var(--text)", margin: 0 }}
                      className="text-[11px] font-bold">{m.label}</p>
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">
                      {m.hint}
                    </p>
                  </button>
                );
              })}
            </div>

            {needsCash && (
              <Field label="المبلغ">
                <NumericInput value={mv.amount}
                  onChange={(v) => setMv((p) => ({ ...p, amount: v }))} />
              </Field>
            )}
            {needsGold && (
              <>
                <Field label="الوزن">
                  <NumericInput value={mv.weight}
                    onChange={(v) => setMv((p) => ({ ...p, weight: v }))} />
                </Field>
                <Field label="العيار">
                  <select style={inputStyle} value={mv.karat}
                    onChange={(e) => setMv((p) => ({ ...p, karat: Number(e.target.value) }))}>
                    {Object.keys(PURITY).map((k) => (
                      <option key={k} value={k}>عيار {k}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="ملاحظة (اختياري)">
              <input style={inputStyle} value={mv.note}
                onChange={(e) => setMv((p) => ({ ...p, note: e.target.value }))} />
            </Field>

            {preview && (
              <Card style={{ padding: 11, marginBottom: 10 }}>
                <div className="flex items-baseline justify-between">
                  <span style={{ color: "var(--text2)" }} className="text-[11px]">
                    {preview.label}
                  </span>
                  <span style={{ color: "var(--accent)" }} className="text-[13px] font-bold">
                    {preview.value}
                  </span>
                </div>
                {["buy_gold", "sell_gold"].includes(mv.move) && (
                  <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                    ⚖ بسعر اليوم {currency}{fmtMoney(price24)}/جم24 — يُثبَّت في السطر
                    فلا يتغيّر الكشف غدًا.
                  </p>
                )}
              </Card>
            )}

            <button onClick={submit}
              disabled={!canManage || !sel || !openDay}
              className="w-full py-3 rounded-xl text-sm font-bold mb-6"
              style={{
                background: (canManage && sel && openDay)
                  ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)",
                color: (canManage && sel && openDay) ? "var(--panel)" : "var(--text3)",
              }}>
              {!openDay ? "افتح يوم العمل أولًا"
                : !canManage ? "خارج صلاحيتك"
                : !sel ? "اختر صاحب الحساب"
                : `سجّل — ${moveDef?.label || ""}`}
            </button>
          </>
        )}


        {/* ── حساب جديد ── */}
        {tab === "new" && (
          <>
            <Field label="الاسم">
              <input style={inputStyle} value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field label="الجوال">
              <input style={inputStyle} type="tel" value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </Field>
            <Field label="ملاحظة">
              <input style={inputStyle} value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
            </Field>
            <button
              onClick={() => {
                const r = onAddHolder(form);
                if (r) { setForm({ name: "", phone: "", note: "" }); setTab("list"); }
              }}
              disabled={!canManage || !form.name.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold mb-6"
              style={{
                background: (canManage && form.name.trim())
                  ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)",
                color: (canManage && form.name.trim()) ? "var(--panel)" : "var(--text3)",
              }}>
              افتح الحساب
            </button>
          </>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

export { TrustAccountsPage };
