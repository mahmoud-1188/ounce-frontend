import React, { useState } from "react";
import { AlertTriangle, Plus, Receipt, ShieldCheck, UserRound } from "lucide-react";
import { fmt, fmtW } from "../core/money.js";
import { inputStyle, normalizeName, toLatinDigits, useViewport } from "../domain/helpers.js";
import { key } from "../domain/key.js";
import { AdaptiveTable } from "../ui/AdaptiveTable.jsx";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { Stat } from "../ui/Stat.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function CustomersPage({ customers, sales, returns = [], repairs = [], trustGold = [], receipts = [], currency, canManage, onAdd, onCollect, onBack, onOpenEntity, onEditCustomer }) {
  const vp = useViewport();
  // مديونية العميل = مبيعاته الآجلة − ما حصّلته منه − مرتجعاته الآجلة.
  const receivableFor = (id) => {
    const credit = sales
      .filter((s) => s.customerId === id && s.paymentMethod === "credit")
      .reduce((a, s) => a + (Number(s.total) || 0), 0);
    const paid = receipts.filter((r) => r.customerId === id).reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const returned = (returns || [])
      .filter((r) => r.customerId === id)
      .reduce((a, r) => a + (Number(r.refundAmount) || 0), 0);
    const openSales = sales.filter((s) => s.customerId === id && s.paymentMethod === "credit");
    return { credit, paid, returned, due: credit - paid - returned, openSales };
  };
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [search, setSearch] = useState("");
  const [showCollect, setShowCollect] = useState(false);
  const [collectAmt, setCollectAmt] = useState("");
  const [collectMethod, setCollectMethod] = useState("cash");

  const taken = customers.some((c) => normalizeName(c.name) === normalizeName(name));
  const valid = name.trim().length > 0 && !taken;

  const statsFor = (id) => {
    const mySales = sales.filter((s) => s.customerId === id);
    const myReturns = returns.filter((r) => r.customerId === id);
    const myRepairs = repairs.filter((r) => r.customerId === id);
    const myTrust = trustGold.filter((t) => t.customerId === id && t.status === "held");
    return {
      sales: mySales,
      spent: mySales.reduce((a, s) => a + s.total, 0) - myReturns.reduce((a, r) => a + r.refund, 0),
      returns: myReturns,
      repairs: myRepairs,
      trust: myTrust,
      trustWeight: myTrust.reduce((a, t) => a + (Number(t.weight) || 0), 0),
    };
  };

  const filtered = search.trim()
    ? customers.filter((c) => (c.name + " " + (c.phone || "") + " " + (c.ref || "")).includes(search.trim()))
    : customers;

  if (detailId) {
    const c = customers.find((x) => x.id === detailId);
    if (!c) return null;
    const st = statsFor(detailId);
    return (
      <div>
        <SubPageHeader title={c.name} onBack={() => setDetailId(null)} />
        <div className="px-4 pt-3">
          <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-base font-bold">
              {c.name}
              {c.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{c.ref}</span>}
            </p>
            {c.phone && <p style={{ color: "var(--text2)" }} className="text-xs mt-0.5">{c.phone}</p>}
            {c.note && <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">{c.note}</p>}
          </Card>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <Stat label="إجمالي مشترياته" value={`${currency}${fmt(st.spent, 0)}`} accent="var(--accent)" />
            <Stat label="عدد الفواتير" value={st.sales.length} />
            <Stat label="مرتجعات" value={st.returns.length} accent={st.returns.length ? "var(--bad)" : undefined} />
            <Stat label="ذهب أمانة" value={st.trustWeight > 0 ? `${fmtW(st.trustWeight)} جم` : "—"} accent={st.trustWeight > 0 ? "var(--accentSoft)" : undefined} />
          </div>

          {/* ── الحساب الآجل ── */}
          {(() => {
            const rv = receivableFor(detailId);
            if (rv.credit <= 0.01) return null;
            const settled = rv.due <= 0.01;
            return (
              <Card style={{ padding: 14, marginBottom: 12, border: `1px solid ${settled ? "var(--goodLine)" : "var(--badLine)"}` }}>
                <p style={{ color: settled ? "var(--goodSolid)" : "var(--bad)" }} className="text-xs font-bold mb-2">
                  {settled ? "الحساب الآجل مسدَّد" : "مستحق عليه"}
                </p>
                {!settled && (
                  <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--bad)" }} className="text-2xl font-extrabold mb-2">
                    {currency}
                    {fmt(rv.due, 0)}
                  </p>
                )}
                {[
                  ["مبيعات آجلة", rv.credit, "var(--text)"],
                  ["حُصِّل منه", rv.paid, "var(--goodSolid)"],
                  ...(rv.returned > 0 ? [["مرتجعات", rv.returned, "var(--text2)"]] : []),
                ].map(([l, v, col], i) => (
                  <div key={i} className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">{l}</span>
                    <span style={{ color: col }} className="text-xs font-bold">
                      {currency}{fmt(v, 0)}
                    </span>
                  </div>
                ))}

                {!settled && canManage && (
                  <>
                    {!showCollect ? (
                      <button
                        onClick={() => {
                          setCollectAmt(String(Math.round(rv.due)));
                          setShowCollect(true);
                        }}
                        className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold"
                        style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
                      >
                        تسجيل تحصيل
                      </button>
                    ) : (
                      <div className="mt-3">
                        <Field label={`المبلغ المحصَّل (${currency})`}>
                          <NumericInput value={collectAmt} onChange={setCollectAmt} />
                        </Field>
                        <Field label="طريقة الاستلام">
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: "cash", label: "نقدي" },
                              { id: "network", label: "شبكة" },
                            ].map((m) => (
                              <button
                                key={m.id}
                                onClick={() => setCollectMethod(m.id)}
                                className="py-2 rounded-xl text-[11px] font-bold"
                                style={{
                                  background: collectMethod === m.id ? "var(--accentBg)" : "var(--panel)",
                                  color: collectMethod === m.id ? "var(--accent)" : "var(--text2)",
                                  border: "1px solid var(--line)",
                                }}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </Field>
                        {Number(collectAmt) > rv.due + 0.01 && (
                          <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">
                            المبلغ أكبر من المستحق ({fmt(rv.due, 0)}).
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setShowCollect(false)}
                            className="py-2 rounded-xl text-xs font-bold"
                            style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
                          >
                            إلغاء
                          </button>
                          <button
                            disabled={!(Number(collectAmt) > 0) || Number(collectAmt) > rv.due + 0.01}
                            onClick={() => {
                              onCollect(detailId, null, Number(collectAmt), collectMethod);
                              setShowCollect(false);
                              setCollectAmt("");
                            }}
                            className="py-2 rounded-xl text-xs font-bold"
                            style={{
                              background:
                                Number(collectAmt) > 0 && Number(collectAmt) <= rv.due + 0.01
                                  ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))"
                                  : "var(--accentBg)",
                              color: Number(collectAmt) > 0 && Number(collectAmt) <= rv.due + 0.01 ? "var(--panel)" : "var(--text3)",
                            }}
                          >
                            تأكيد التحصيل
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {receipts.filter((r) => r.customerId === detailId).length > 0 && (
                  <div className="mt-3 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
                    <p style={{ color: "var(--text2)" }} className="text-[11px] mb-1">سجل التحصيل</p>
                    {receipts
                      .filter((r) => r.customerId === detailId)
                      .slice(0, 8)
                      .map((r) => (
                        <div key={r.id} className="flex items-center justify-between py-1">
                          <span style={{ color: "var(--text3)" }} className="text-[10px]">
                            {r.ref} · {new Date(r.date).toLocaleDateString("en-GB")} · {r.method === "network" ? "شبكة" : "نقدي"}
                            {r.createdBy ? ` · ${r.createdBy}` : ""}
                          </span>
                          <span style={{ color: "var(--good)" }} className="text-[11px] font-bold">
                            {currency}{fmt(r.amount, 0)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </Card>
            );
          })()}

          {st.trust.length > 0 && (
            <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--badLine)" }}>
              <p style={{ color: "var(--bad)" }} className="text-xs font-bold flex items-center gap-1.5">
                <ShieldCheck size={13} /> لديك {st.trust.length} قطعة أمانة لهذا العميل
              </p>
              {st.trust.map((t) => (
                <p key={t.id} style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                  {t.description || "قطعة"} · عيار {t.karat} · {fmtW(t.weight)} جم
                </p>
              ))}
            </Card>
          )}

          <p style={{ color: "var(--text2)" }} className="text-xs mb-2">فواتيره ({st.sales.length})</p>
          {st.sales.length === 0 ? (
            <EmptyState icon={<Receipt size={30} color="var(--accentText)" />} title="لا فواتير" sub="لم يشترِ بعد" />
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              {st.sales.map((s) => (
                <Card key={s.id} style={{ padding: 12 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }} className="text-sm">
                      {s.ref || "—"}
                    </span>
                    <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                      {currency}{fmt(s.total, 0)}
                    </span>
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                    {new Date(s.date).toLocaleString("en-GB")} · {(s.lines || []).length} صنف · {s.sellerName || ""}
                  </p>
                </Card>
              ))}
            </div>
          )}

          {st.repairs.length > 0 && (
            <>
              <p style={{ color: "var(--text2)" }} className="text-xs mb-2">إصلاحاته ({st.repairs.length})</p>
              <div className="flex flex-col gap-2 mb-3">
                {st.repairs.map((r) => (
                  <Card key={r.id} style={{ padding: 10 }}>
                    <p style={{ color: "var(--text)" }} className="text-xs">{r.description || "إصلاح"}</p>
                    <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                      {new Date(r.date).toLocaleDateString("en-GB")} · {currency}{fmt(r.price || 0, 0)}
                    </p>
                  </Card>
                ))}
              </div>
            </>
          )}
          <div style={{ height: 20 }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SubPageHeader title="العملاء" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
          سجّل العميل مرة، فتُربط به فواتيره وإصلاحاته وذهبه الأمانة — ويصير الإرجاع والضمان ممكنين.
        </p>

        {canManage &&
          (!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-4"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
            >
              <Plus size={18} /> إضافة عميل
            </button>
          ) : (
            <Card style={{ padding: 14, marginBottom: 16 }}>
              <Field label="اسم العميل">
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="الجوال (اختياري)">
                <input style={inputStyle} value={phone} onChange={(e) => setPhone(toLatinDigits(e.target.value))} inputMode="numeric" />
              </Field>
              <Field label="ملاحظات (اختياري)">
                <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              {taken && name.trim() && (
                <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">يوجد عميل بهذا الاسم</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowAdd(false)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                  إلغاء
                </button>
                <button
                  disabled={!valid}
                  onClick={() => { onAdd(name.trim(), phone.trim(), note.trim()); setName(""); setPhone(""); setNote(""); setShowAdd(false); }}
                  className="py-2 rounded-xl text-xs font-bold"
                  style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
                >
                  حفظ
                </button>
              </div>
            </Card>
          ))}

        {customers.length > 0 && (
          <input style={{ ...inputStyle, marginBottom: 10 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الجوال..." />
        )}

        {(() => {
          const totalDue = customers.reduce((a, c) => a + Math.max(0, receivableFor(c.id).due), 0);
          const debtors = customers.filter((c) => receivableFor(c.id).due > 0.01);
          if (totalDue <= 0.01) return null;
          return (
            <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--badLine)" }}>
              <p style={{ color: "var(--bad)" }} className="text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle size={13} /> مستحقات آجلة على {debtors.length} عميل
              </p>
              <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold mt-1">
                {currency}
                {fmt(totalDue, 0)}
              </p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mt-0.5">
                مبيعات بيعت آجلًا ولم تُحصَّل بعد — افتح العميل لتسجيل التحصيل.
              </p>
            </Card>
          );
        })()}

        {customers.length === 0 ? (
          <EmptyState icon={<UserRound size={36} color="var(--accentText)" />} title="لا عملاء بعد" sub="أضف أول عميل لتتبّع مشترياته" />
        ) : (
          <div className="flex flex-col gap-2">
            {(() => {
              const cols = [
                { key: "name", label: "الاسم", editable: canManage },
                { key: "phone", label: "الجوال", editable: canManage, type: "tel" },
                { key: "_sales", label: "الفواتير",
                  render: (c) => statsFor(c.id).sales.length },
                { key: "_spent", label: "المشتريات", align: "left",
                  render: (c) => `${currency}${fmt(statsFor(c.id).spent, 0)}` },
                { key: "note", label: "ملاحظة", editable: canManage },
              ];
              return (
                <AdaptiveTable
                  vp={vp}
                  rows={filtered}
                  columns={cols}
                  keyOf={(c) => c.id}
                  selectedId={detailId}
                  /* ⚠ لا `onSelect` على الصفّ.
                     `detailId` يستبدل القائمة كاملةً بشاشة التفصيل،
                     فالضغط على خلية للتعديل يُحدّد الصفّ فتختفي القائمة
                     والحقل معها — والضغط يبدو بلا أثر.
                     والتفصيل يُفتح بزرّه الصريح لا بنقر الصفّ. */
                  onEdit={(row, key, value) => onEditCustomer?.(row.id, key, value)}
                  actions={[
                    { id: "sheet", label: "كل ما يخصّه" },
                    { id: "detail", label: "التفاصيل", tone: "text2" },
                  ]}
                  onAction={(a, c) => {
                    if (a === "sheet") onOpenEntity?.("customer", c);
                    else setDetailId(c.id);
                  }}
                  empty="لا عملاء بعد"
                />
              );
            })()}
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// ذهب الأمانة — ذهب العميل عندك، ليس ملكك ولا يدخل مخزونك
// ============================================================
/// أنواع حركة الحساب الجاري.
///
/// ⚠ الإيداع والسحب اتجاهان لشيء واحد، والشراء والبيع تحويلٌ بينهما.
/// خلطها بالبيع العادي يجعل الفاتورة تُنقص مخزونًا وتزيد نقدًا —
/// وهنا لا نقد يدخل: العميل يدفع من رصيده.

export { CustomersPage };
