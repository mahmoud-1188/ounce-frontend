import React, { useState } from "react";
import { Package } from "lucide-react";
import { PURITY, fmt, fmtMoney, fmtW } from "../core/money.js";
import { CARD_NETWORKS } from "../core/money-rules.js";
import { cardFeeOf, categoryLabel, inputStyle, marginFor, r3 } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";

function PartialSaleModal({ items, categories, customers, currency, price24, settings, onClose, onConfirm }) {
  const [itemId, setItemId] = useState("");
  const [weight, setWeight] = useState("");
  const [price, setPrice] = useState("");
  const [method, setMethod] = useState("cash");
  const [network, setNetwork] = useState("mada");
  const [customerId, setCustomerId] = useState("");
  // ⚠ إصلاح حقيقي: onConfirm صار غير متزامن (ينادي الباك إند فعليًا
  // ويتحقق من الطلب فعليًا هناك). كانت هذه الشاشة تُغلق نفسها فورًا بعد
  // استدعاء onConfirm بصرف النظر عن النتيجة — إغلاق قبل معرفة النجاح
  // من الفشل يُظهر للمستخدم أن البيع تم وهو لم يتم بعد، أو لم يتم إطلاقًا.
  const [submitting, setSubmitting] = useState(false);

  // القطع القابلة للتجزئة والمتاحة فقط
  const partialItems = items.filter((it) => {
    const cat = categories.find((c) => c.id === it.categoryId);
    return cat?.saleMode === "partial" && (Number(it.weight) || 0) > 0.0005 &&
      (it.units || []).some((u) => !u.sold);
  });

  const item = partialItems.find((it) => it.id === itemId);
  const cat = item ? categories.find((c) => c.id === item.categoryId) : null;
  const available = Number(item?.weight) || 0;
  const minW = Number(cat?.minSaleWeight) || 0;
  const sellW = Number(weight) || 0;
  const remaining = r3(available - sellW);
  const takesAll = item && Math.abs(sellW - available) < 0.0005;

  // التسعير الإرشادي — البائع يقرر
  const purity = item ? PURITY[item.karat] || item.karat / 24 : 0;
  const metal = sellW * purity * (price24 || 0);
  const ratio = available > 0 ? sellW / available : 0;
  const wmShare = (Number(item?.lotWorkmanshipShare) || 0) * ratio;
  const m = item ? marginFor(settings, item.karat) : { perGram: 0, fixed: 0 };
  const suggested = metal + wmShare + sellW * m.perGram + m.fixed;
  const entered = Number(price) || 0;
  const marginNow = entered - metal - wmShare;
  const costPart = sellW * (Number(item?.costPerGram) || 0) + wmShare;
  const profit = entered - costPart;

  const overWeight = item && sellW > available + 0.0005;
  const underMin = item && minW > 0 && sellW > 0 && sellW < minW && !takesAll;
  const valid = !!item && sellW > 0 && !overWeight && !underMin && entered > 0 &&
    !(method === "credit" && !customerId);

  return (
    <ModalShell title="بيع بالوزن" onClose={onClose}>
      {partialItems.length === 0 ? (
        <EmptyState
          icon={<Package size={32} color="var(--accentText)" />}
          title="لا أصناف قابلة للتجزئة"
          sub="اضبط طريقة البيع «بيع بالوزن» من صفحة التصنيفات"
        />
      ) : (
        <>
          <Field label="القطعة">
            <select style={inputStyle} value={itemId} onChange={(e) => { setItemId(e.target.value); setWeight(""); setPrice(""); }}>
              <option value="">اختر...</option>
              {partialItems.map((it) => (
                <option key={it.id} value={it.id}>
                  {categoryLabel(it.categoryId)} · عيار {it.karat} · متاح {fmtW(it.weight)} جم
                </option>
              ))}
            </select>
          </Field>

          {item && (
            <>
              <Card style={{ padding: 10, marginBottom: 12, background: "var(--bg)" }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text2)" }} className="text-[11px]">المتاح الآن</span>
                  <span style={{ color: "var(--accent)" }} className="text-base font-bold">
                    {fmtW(available)} جم عيار {item.karat}
                  </span>
                </div>
                {(item.units || [])[0]?.code && (
                  <p style={{ color: "var(--text3)", fontFamily: "monospace" }} className="text-[10px] mt-0.5">
                    {(item.units || [])[0].code}
                  </p>
                )}
                {minW > 0 && (
                  <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                    أقل بيع {fmtW(minW)} جم — إلا إن كان هو الباقي كله
                  </p>
                )}
              </Card>

              <Field label="الوزن المباع (جم)">
                <NumericInput value={weight} onChange={setWeight} placeholder="0.000" />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[1, 5, 10, 50].filter((w) => w <= available).map((w) => (
                    <button key={w} onClick={() => setWeight(String(w))}
                      className="text-[10px] px-2 py-1 rounded-full"
                      style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>
                      {w} جم
                    </button>
                  ))}
                  <button onClick={() => setWeight(String(available))}
                    className="text-[10px] px-2 py-1 rounded-full"
                    style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                    الكل ({fmt(available)})
                  </button>
                </div>
              </Field>

              {overWeight && (
                <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">
                  المتاح {fmtW(available)} جم فقط.
                </p>
              )}
              {underMin && (
                <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">
                  أقل بيع من هذا التصنيف {fmtW(minW)} جم.
                </p>
              )}

              {sellW > 0 && !overWeight && (
                <Card style={{ padding: 10, marginBottom: 12, background: "var(--bg)" }}>
                  <div className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">المتبقي بعد البيع</span>
                    <span style={{ color: takesAll ? "var(--bad)" : "var(--goodSolid)" }} className="text-sm font-bold">
                      {takesAll ? "تنفد القطعة" : `${fmtW(remaining)} جم`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">الوزن الصافي المباع</span>
                    <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                      {fmtW(sellW * purity)} جم عيار 24
                    </span>
                  </div>
                </Card>
              )}

              <Field label={`السعر الإجمالي (${currency})`}>
                <NumericInput value={price} onChange={setPrice} placeholder="السعر" />
                {sellW > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <button onClick={() => setPrice(suggested.toFixed(2))}
                      className="text-[10px] px-2 py-1 rounded-full"
                      style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--line)" }}>
                      المقترح {fmtMoney(suggested)}
                    </button>
                    <button onClick={() => setPrice((metal + wmShare).toFixed(2))}
                      className="text-[10px] px-2 py-1 rounded-full"
                      style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                      بلا ربح {fmtMoney(metal + wmShare)}
                    </button>
                  </div>
                )}
                {entered > 0 && sellW > 0 && (
                  <p className="text-[10px] mt-1"
                    style={{ color: marginNow > 0 ? "var(--goodSolid)" : marginNow < 0 ? "var(--bad)" : "var(--text2)" }}>
                    معدن {fmtMoney(metal)}
                    {wmShare > 0 ? ` + مصنعية ${fmtMoney(wmShare)}` : ""} ← ربحك{" "}
                    {profit >= 0 ? "+" : "−"}{fmtMoney(Math.abs(profit))}
                    {profit < 0 ? " ⚠ بيع بخسارة" : ""}
                  </p>
                )}
              </Field>

              <Field label="طريقة الدفع">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "cash", label: "نقدي" },
                    { id: "card", label: "شبكة" },
                    { id: "credit", label: "آجل" },
                  ].map((o) => (
                    <button key={o.id} onClick={() => setMethod(o.id)}
                      className="py-2 rounded-xl text-[11px] font-bold"
                      style={{
                        background: method === o.id ? "var(--accentBg)" : "var(--panel)",
                        color: method === o.id ? "var(--accent)" : "var(--text2)",
                        border: "1px solid var(--line)",
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </Field>

              {method === "card" && (
                <Field label="الشبكة">
                  <select style={inputStyle} value={network} onChange={(e) => setNetwork(e.target.value)}>
                    {CARD_NETWORKS.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label} — {fmt(cardFeeOf(settings, n.id), 2)}٪
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {(method === "credit" || customers.length > 0) && (
                <Field label={method === "credit" ? "العميل (إجباري)" : "العميل (اختياري)"}>
                  <select style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">{method === "credit" ? "اختر العميل..." : "بلا عميل"}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
              )}

              <button
                disabled={!valid || submitting}
                onClick={async () => {
                  const cust = customers.find((c) => c.id === customerId);
                  setSubmitting(true);
                  try {
                    const result = await onConfirm({
                      itemId, weight: sellW, unitPrice: entered,
                      paymentMethod: method,
                      cardNetwork: method === "card" ? network : null,
                      customerId: customerId || null,
                      customerName: cust?.name || null,
                    });
                    // ⚠ تُغلَق الشاشة فقط عند نجاح فعلي (سطر مُرجَع من
                    // handlePartialSale) — فشل التحقق أو رفض السيرفر يُبقيها
                    // مفتوحة مع رسالة الخطأ (flashToast) ظاهرة خلفها.
                    if (result) onClose();
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="w-full py-3 rounded-xl font-bold"
                style={{
                  background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                  color: valid ? "var(--panel)" : "var(--text3)",
                }}
              >
                {submitting ? "جارٍ التنفيذ..." : takesAll ? "بيع القطعة كاملة" : `بيع ${fmtW(sellW)} جم`}
              </button>
            </>
          )}
        </>
      )}
    </ModalShell>
  );
}

// ============================================================
// ورقة الزر المجمّع
//
// تفتح بضغطة واحدة وتُغلق باختيار. الخيار الواحد يفتح مباشرة بلا ورقة —
// عرض قائمة من عنصر واحد خطوة زائدة.
// ============================================================

export { PartialSaleModal };
