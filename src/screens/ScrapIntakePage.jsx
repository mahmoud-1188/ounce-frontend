import React, { useState } from "react";
import { KARATS, PURITY, fine24, fmt, fmtMoney, fmtW, pricePerGram, roundW, weightTimesPrice } from "../core/money.js";
import { inputStyle, scrapPrice24 } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function ScrapIntakePage({
  scrapEntries, customers, currency, price24, settings, custodyBalance,
  onConfirm, onBack,
}) {
  const [step, setStep] = useState(1);
  const [grossWeight, setGrossWeight] = useState("");
  const [netInput, setNetInput] = useState("");
  const [karat, setKarat] = useState(21);
  const [karatMethod, setKaratMethod] = useState("stamp");
  const [customerId, setCustomerId] = useState("");
  const [note, setNote] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [pricePerGramInput, setPricePerGramInput] = useState("");
  // ⚠ الوضع: بسعر الجرام أو بالإجمالي. المُدخَل يدويًا هو المعتمد.
  const [totalMode, setTotalMode] = useState(false);
  const [totalInput, setTotalInput] = useState("");
  const [photoNote, setPhotoNote] = useState("");
  // ⚠ سلة القطع: العميل يأتي بخاتم عيار 21 وسلسلة 18 معًا. إدخالها
  // عمليتين يفصل ما هو صفقة واحدة، فيصعب مراجعتها ويربك حساب العهدة.
  const [basket, setBasket] = useState([]);
  // ⚠ حالة جديدة مع الربط: onConfirm صار نداء شبكة غير متزامن — بلا هذه
  // الحالة كان الزر قابلًا للنقر المتكرر أثناء التنفيذ (تكرار الإرسال).
  const [submitting, setSubmitting] = useState(false);

  const gross = roundW(Number(grossWeight) || 0);
  // ⚠ المعتمد هو المُدخَل؛ وبلا إدخال يساوي القائم (بلا فصوص).
  // والفصوص فرقٌ لا مُدخَل: كتابتها مستقلةً تجعل رقمين يجب أن
  // يتوافقا، وأحدهما يُنسى فيختلف الحساب عن الميزان.
  const netTyped = netInput.trim() === "" ? null : roundW(Number(netInput) || 0);
  const netWeight = netTyped == null ? gross : Math.max(0, Math.min(netTyped, gross));
  const stones = roundW(Math.max(0, gross - netWeight));
  const purity = PURITY[karat] || karat / 24;
  const fineWeight = netWeight * purity;

  // السعر المرجعي: سعر السوق للعيار ناقص خصم الشراء المعتاد
  // ⚠ المرجع هو سعر الشراء لا العالمي — الخصم مثبَّت من الإعدادات
  // فلا يحسبه البائع في رأسه كل مرة.
  const buyBase24 = scrapPrice24(settings, price24);
  const marketPerGram = pricePerGram(karat, buyBase24);
  const worldPerGram = pricePerGram(karat, price24);
  const disc = Number(discountPct) || 0;
  const suggestedPerGram = marketPerGram * (1 - disc / 100);
  // ── التسعير: بالجرام أو بالإجمالي ──
  //
  // السوق يساوم على المبلغ لا على سعر الجرام: «خذها بثمانية عشر ألفًا».
  // فإدخال الإجمالي يشتقّ سعر الجرام، وإدخال سعر الجرام يشتقّ الإجمالي.
  //
  // ⚠ والمُدخَل يدويًا هو المعتمد: اشتقاق الإجمالي من سعر مقرَّب يُنتج
  // 17,999.55 بينما اتُّفق على 18,000 — والعميل يرى ما لم يوافق عليه.
  const actualPerGram = totalMode
    ? (netWeight > 0 ? (Number(totalInput) || 0) / netWeight : 0)
    : (Number(pricePerGramInput) || suggestedPerGram);
  const total = totalMode
    ? (Number(totalInput) || 0)
    : weightTimesPrice(netWeight, actualPerGram);
  const marginVsMarket = netWeight * marketPerGram - total;

  // تقريب نقدي موحّد — الهللة أصغر وحدة تُدفع
  function roundMoney(v) {
    return Math.round((Number(v) || 0) * 100) / 100;
  }

  const KARAT_METHODS = [
    { id: "stamp", label: "الدمغة", hint: "ختم العيار على القطعة" },
    { id: "acid", label: "المحك والحمض", hint: "اختبار كيميائي" },
    { id: "device", label: "جهاز فحص", hint: "قراءة إلكترونية" },
    { id: "estimate", label: "تقدير", hint: "بلا فحص — احتياط" },
  ];

  // الإجمالي يشمل السلة والقطعة الجارية معًا — الحد يُفحص عليهما
  const basketTotal = basket.reduce((a, b) => a + b.total, 0);
  const basketFine = basket.reduce((a, b) => a + fine24(b.weight, b.karat), 0);
  const grandTotal = basketTotal + (netWeight > 0 ? total : 0);
  const enough = grandTotal <= custodyBalance + 0.01;
  const lineValid = netWeight > 0 && actualPerGram > 0;
  const canConfirm = (basket.length > 0 || lineValid) && enough;

  // تصفير سطر القطعة فقط — بيانات الصفقة (العميل والوصف) تبقى
  const resetLine = () => {
    setGrossWeight(""); setNetInput(""); setKarat(21);
    setKaratMethod("stamp"); setDiscountPct(""); setPricePerGramInput("");
    setTotalMode(false); setTotalInput("");
  };
  const resetAll = () => {
    resetLine();
    setStep(1); setBasket([]); setCustomerId(""); setNote(""); setPhotoNote("");
  };

  const addToBasket = () => {
    if (!lineValid) return;
    setBasket((b) => [
      ...b,
      {
        key: Math.random().toString(36).slice(2),
        weight: netWeight, grossWeight: gross, stonesMargin: stones,
        karat, karatMethod, pricePerGram: actualPerGram,
        marketPerGram, discountPct: disc, total,
      },
    ]);
    resetLine();
    setStep(1);
  };

  const recent = (scrapEntries || []).filter((e) => (Number(e.weight) || 0) > 0).slice(0, 8);

  const StepDot = ({ n, label }) => (
    <div className="flex-1 text-center">
      <div
        style={{
          width: 26, height: 26, borderRadius: "50%", margin: "0 auto 4px",
          background: step >= n ? "var(--accentBg)" : "var(--bg)",
          border: `1px solid ${step >= n ? "var(--accentLine)" : "var(--line)"}`,
          color: step >= n ? "var(--accent)" : "var(--accentLine)",
          display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700,
        }}
      >
        {step > n ? "✓" : n}
      </div>
      <span style={{ color: step >= n ? "var(--text2)" : "var(--accentLine)" }} className="text-[10px]">{label}</span>
    </div>
  );

  return (
    <div>
      <SubPageHeader title="استلام الكسر" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="flex items-start mb-4">
          <StepDot n={1} label="القياس" />
          <StepDot n={2} label="الفحص" />
          <StepDot n={3} label="التسعير" />
          <StepDot n={4} label="التثبيت" />
        </div>

        <Card style={{ padding: 10, marginBottom: 12 }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text2)" }} className="text-[11px]">عهدة الكسر المتاحة</span>
            <span style={{ color: enough ? "var(--goodSolid)" : "var(--bad)" }} className="text-xs font-bold">
              {currency}{fmtMoney(custodyBalance)}
            </span>
          </div>
          {grandTotal > 0 && (
            <div className="flex items-center justify-between mt-1" style={{ borderTop: "1px solid var(--line)", paddingTop: 6 }}>
              <span style={{ color: "var(--text2)" }} className="text-[11px]">إجمالي هذه الصفقة</span>
              <span style={{ color: enough ? "var(--accent)" : "var(--bad)" }} className="text-xs font-bold">
                {currency}{fmt(grandTotal, 2)}
              </span>
            </div>
          )}
        </Card>

        {/* سلة القطع */}
        {basket.length > 0 && (
          <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: "var(--accent)" }} className="text-[11px] font-bold">
                قطع الصفقة ({basket.length})
              </span>
              <span style={{ color: "var(--text2)" }} className="text-[11px]">
                {fmtW(basketFine)} جم عيار 24
              </span>
            </div>
            {basket.map((b, i) => (
              <div key={b.key} className="flex items-center gap-2 py-1.5"
                style={{ borderTop: i > 0 ? "1px solid var(--line)" : "none" }}>
                <span style={{ color: "var(--text)" }} className="text-xs flex-1">
                  عيار {b.karat} · {fmtW(b.weight)} جم
                  {b.stonesMargin > 0 && (
                    <span style={{ color: "var(--text3)" }} className="text-[10px]"> (فصوص {fmt(b.stonesMargin)})</span>
                  )}
                </span>
                <span style={{ color: "var(--text2)" }} className="text-[11px] whitespace-nowrap">
                  {currency}{fmtMoney(b.total)}
                </span>
                <button
                  onClick={() => setBasket((arr) => arr.filter((x) => x.key !== b.key))}
                  className="text-[10px] px-2 py-1 rounded-full"
                  style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
                >
                  حذف
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
              <span style={{ color: "var(--text2)" }} className="text-[11px]">مجموع السلة</span>
              <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
                {currency}{fmt(basketTotal, 2)}
              </span>
            </div>
          </Card>
        )}

        {/* ① القياس */}
        {step === 1 && (
          <Card style={{ padding: 14, marginBottom: 12 }}>
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-1">① القياس</p>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
              زِن القطعة كاملة، ثم قدّر وزن ما ليس ذهبًا: فصوص، لحام، مشابك، أوساخ.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {/* ── الوزنان ──
                  ⚠ يُدخَل القائم ثم الوزن المعتمد مباشرة، لا القائم
                  وهامش الفصوص. البائع يزن ثم يقدّر ما سيدفع عليه —
                  فيكتبه كما هو بدل أن يحسب الفرق ذهنيًا ويخطئ.
                  وهامش الفصوص يُشتقّ: القائم ناقص المعتمد. */}
              <Field label="الوزن القائم (جم)">
                <NumericInput value={grossWeight} onChange={setGrossWeight} placeholder="0.000" />
              </Field>
              <Field label="الوزن المعتمد (جم)">
                <NumericInput
                  value={netInput}
                  onChange={setNetInput}
                  placeholder={gross > 0 ? fmtW(gross) : "0.000"}
                />
              </Field>
            </div>
            {gross > 0 && (
              <Card style={{ padding: 10, marginBottom: 12, background: "var(--bg)" }}>
                {/* الأوزان الثلاثة: القائم والمعتمد والفرق المشتقّ */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    ["القائم", gross, "var(--text)"],
                    ["المعتمد", netWeight, netWeight > 0 ? "var(--goodSolid)" : "var(--bad)"],
                    ["الفصوص", stones, stones > 0.0005 ? "var(--bad)" : "var(--accentLine)"],
                  ].map(([l, v, c], i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px]">{l}</p>
                      <p style={{ color: c, margin: 0 }} className="text-sm font-bold">{fmtW(v)}</p>
                    </div>
                  ))}
                </div>
                {stones > 0.0005 && (
                  <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1.5">
                    ⚖ الفصوص فرقٌ مشتقّ ({fmt((stones / gross) * 100, 1)}٪) — لا يُدفع ثمنها ذهبًا،
                    وتُنزع قبل الإقفال.
                  </p>
                )}
                {netTyped != null && netTyped > gross + 0.0005 && (
                  <p style={{ color: "var(--bad)" }} className="text-[10px] mt-1 font-bold">
                    ⚠ المعتمد أكبر من القائم — قُصّ إلى {fmtW(gross)}
                  </p>
                )}
                {stones > 0 && stones / gross > 0.3 && (
                  <p style={{ color: "var(--bad)" }} className="text-[10px] mt-1">
                    ⚠ نسبة الشوائب مرتفعة — تأكّد من القياس
                  </p>
                )}
              </Card>
            )}
            <button
              disabled={netWeight <= 0}
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl font-bold"
              style={{
                background: netWeight > 0 ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                color: netWeight > 0 ? "var(--panel)" : "var(--text3)",
              }}
            >
              التالي — الفحص
            </button>
          </Card>
        )}

        {/* ② الفحص */}
        {step === 2 && (
          <Card style={{ padding: 14, marginBottom: 12 }}>
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-1">② فحص العيار</p>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
              العيار الخطأ يعني دفع ثمن ذهب لا تستلمه. سجّل طريقة الفحص لتعرف مدى الثقة لاحقًا.
            </p>
            <Field label="العيار">
              <div className="grid grid-cols-5 gap-1.5">
                {KARATS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setKarat(k)}
                    className="py-2.5 rounded-xl text-xs font-bold"
                    style={{
                      background: karat === k ? "var(--accentBg)" : "var(--panel)",
                      color: karat === k ? "var(--accent)" : "var(--text2)",
                      border: `1px solid ${karat === k ? "var(--accentLine)" : "var(--edge)"}`,
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="طريقة التحقق">
              <div className="grid grid-cols-2 gap-2">
                {KARAT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setKaratMethod(m.id)}
                    className="py-2 rounded-xl text-[11px] font-bold text-right px-2.5"
                    style={{
                      background: karatMethod === m.id ? "var(--accentBg)" : "var(--panel)",
                      color: karatMethod === m.id ? "var(--accent)" : "var(--text2)",
                      border: `1px solid ${karatMethod === m.id ? "var(--accentLine)" : "var(--edge)"}`,
                    }}
                  >
                    {m.label}
                    <span style={{ color: "var(--text3)" }} className="block text-[10px]">{m.hint}</span>
                  </button>
                ))}
              </div>
            </Field>
            {karatMethod === "estimate" && (
              <p style={{ color: "var(--bad)" }} className="text-[11px] mb-3">
                ⚠ تقدير بلا فحص — خذ خصمًا أعلى في الخطوة التالية احتياطًا.
              </p>
            )}
            <Card style={{ padding: 10, marginBottom: 12, background: "var(--bg)" }}>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text2)" }} className="text-[11px]">الذهب الصافي</span>
                <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                  {fmtW(fineWeight)} جم عيار 24
                </span>
              </div>
              <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                {fmtW(netWeight)} جم عيار {karat} × {fmt(purity, 4)}
              </p>
            </Card>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep(1)} className="py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                رجوع
              </button>
              <button onClick={() => setStep(3)} className="py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
                التالي — التسعير
              </button>
            </div>
          </Card>
        )}

        {/* ③ التسعير */}
        {step === 3 && (
          <Card style={{ padding: 14, marginBottom: 12 }}>
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-1">③ التسعير</p>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
              سعر السوق لعيار {karat}: {currency}{fmt(marketPerGram)} للجرام. الشراء عادةً بخصم يغطي
              التصفية والفاقد وهامشك.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="خصم الشراء (٪)">
                <NumericInput value={discountPct} onChange={setDiscountPct} placeholder="0" />
              </Field>
              <Field label={`سعر الجرام (${currency})`}>
                <NumericInput
                  value={totalMode ? (actualPerGram ? fmtMoney(actualPerGram) : "") : pricePerGramInput}
                  onChange={(v) => { setTotalMode(false); setPricePerGramInput(v); }}
                  placeholder={fmtMoney(suggestedPerGram)}
                />
                {totalMode && (
                  <p style={{ color: "var(--accentText)" }} className="text-[10px] mt-1">
                    مشتقّ من الإجمالي — اكتب هنا للعودة للتسعير بالجرام
                  </p>
                )}
              </Field>

              {/* ── الإجمالي قابل للتعديل ── */}
              <Field label={`الإجمالي (${currency}) — قابل للتعديل`}>
                <NumericInput
                  value={totalMode ? totalInput : (total ? fmtMoney(total) : "")}
                  onChange={(v) => { setTotalMode(true); setTotalInput(v); }}
                  placeholder={fmtMoney(weightTimesPrice(netWeight, suggestedPerGram))}
                />
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                  ⚖ السوق يساوم على المبلغ لا على سعر الجرام. اكتب المتّفق عليه
                  وسعر الجرام يُشتقّ منه — والمحفوظ هو ما كتبته.
                </p>
                {totalMode && netWeight > 0 && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">
                      {fmtW(netWeight)} جم × {fmtMoney(actualPerGram)}
                    </span>
                    <span className="flex-1" />
                    <button
                      onClick={() => { setTotalMode(false); setTotalInput(""); }}
                      className="text-[10px] px-2.5 py-1 rounded-full"
                      style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
                    >
                      تسعير بالجرام
                    </button>
                  </div>
                )}
              </Field>
            </div>
            <Card style={{ padding: 10, marginBottom: 12, background: "var(--bg)" }}>
              {[
                ["سعر السوق للجرام", `${currency}${fmt(marketPerGram)}`, "var(--text2)"],
                ["سعر الشراء المطبَّق", `${currency}${fmt(actualPerGram)}`, "var(--text)"],
                ["الإجمالي المدفوع", `${currency}${fmt(total, 2)}`, "var(--accent)"],
                ["الفرق لصالحك", `${currency}${fmt(marginVsMarket, 2)}`, marginVsMarket >= 0 ? "var(--goodSolid)" : "var(--bad)"],
              ].map(([l, v, c], i, arr) => (
                <div key={i} className="flex items-center justify-between py-1"
                  style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <span style={{ color: "var(--text2)" }} className="text-[11px]">{l}</span>
                  <span style={{ color: c }} className="text-xs font-bold">{v}</span>
                </div>
              ))}
            </Card>
            {marginVsMarket < 0 && (
              <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">
                ⚠ تشتري بأعلى من سعر السوق — راجع السعر.
              </p>
            )}
            {!enough && (
              <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">
                عهدة الكسر {currency}{fmtMoney(custodyBalance)} لا تكفي — موّلها أولًا.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep(2)} className="py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                رجوع
              </button>
              <button
                disabled={!lineValid || !enough}
                onClick={() => setStep(4)}
                className="py-2.5 rounded-xl text-xs font-bold"
                style={{
                  background: lineValid && enough ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                  color: lineValid && enough ? "var(--panel)" : "var(--text3)",
                }}
              >
                التالي — التثبيت
              </button>
            </div>
            <button
              disabled={!lineValid || !enough}
              onClick={addToBasket}
              className="w-full py-2.5 rounded-xl text-xs font-bold mt-2"
              style={{
                background: "var(--panel)",
                color: lineValid && enough ? "var(--accent)" : "var(--accentLine)",
                border: "1px solid var(--line)",
              }}
            >
              + أضف قطعة أخرى بعيار مختلف
            </button>
          </Card>
        )}

        {/* ④ التثبيت */}
        {step === 4 && (
          <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-3">
              ④ المراجعة والتثبيت
              {basket.length > 0 ? ` — ${basket.length + (lineValid ? 1 : 0)} قطعة` : ""}
            </p>
            {basket.length > 0 && (
              <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
                {basket.map((b, i) => (
                  <div key={b.key} className="flex items-center justify-between py-0.5">
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">
                      {i + 1}. عيار {b.karat} · {fmtW(b.weight)} جم
                    </span>
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">
                      {currency}{fmtMoney(b.total)}
                    </span>
                  </div>
                ))}
                {lineValid && (
                  <div className="flex items-center justify-between py-0.5">
                    <span style={{ color: "var(--accent)" }} className="text-[11px]">
                      {basket.length + 1}. عيار {karat} · {fmtW(netWeight)} جم (الحالية)
                    </span>
                    <span style={{ color: "var(--accent)" }} className="text-[11px]">
                      {currency}{fmtMoney(total)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1.5 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--text)" }} className="text-xs font-bold">إجمالي الصفقة</span>
                  <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                    {currency}{fmt(grandTotal, 2)}
                  </span>
                </div>
              </div>
            )}
            {[
              ["الوزن القائم", `${fmtW(gross)} جم`],
              ["الفصوص والشوائب", `−${fmtW(stones)} جم`],
              ["الوزن الصافي", `${fmtW(netWeight)} جم عيار ${karat}`],
              ["الذهب الصافي", `${fmtW(fineWeight)} جم عيار 24`],
              ["طريقة الفحص", KARAT_METHODS.find((m) => m.id === karatMethod)?.label || ""],
              ["سعر الجرام", `${currency}${fmt(actualPerGram)}`],
              ["الإجمالي المدفوع", `${currency}${fmt(total, 2)}`],
            ].map(([l, v], i, arr) => (
              <div key={i} className="flex items-center justify-between py-1.5"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                <span style={{ color: "var(--text2)" }} className="text-[11px]">{l}</span>
                <span style={{ color: i >= 5 ? "var(--accent)" : "var(--text)" }} className="text-xs font-bold">{v}</span>
              </div>
            ))}

            <div style={{ marginTop: 12 }}>
              {customers.length > 0 && (
                <Field label="البائع للمحل (اختياري)">
                  <select style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">بلا تسجيل</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="وصف القطع">
                <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="مثال: سلسلتان وخاتم" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep(3)} className="py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                رجوع
              </button>
              <button
                disabled={!canConfirm || submitting}
                onClick={async () => {
                  // القطعة الجارية تُضاف للسلة إن كانت مكتملة، ثم تُثبَّت
                  // الصفقة كاملة — سطر لكل عيار.
                  const lines = lineValid
                    ? [
                        ...basket,
                        {
                          weight: netWeight, grossWeight: gross, stonesMargin: stones,
                          karat, karatMethod, pricePerGram: actualPerGram,
                          marketPerGram, discountPct: disc, total,
                          // ⚠ نمرّر المبلغ المُدخَل يدويًا وسببه: إعادة
                          // اشتقاقه من سعر مقرَّب تُنتج فرقًا بالهللات
                          // عمّا اتُّفق عليه.
                          totalOverride: totalMode ? roundMoney(Number(totalInput) || 0) : null,
                          pricedBy: totalMode ? "total" : "gram",
                        },
                      ]
                    : basket;
                  // ⚠ إصلاح حقيقي مع الربط: onConfirm صار غير متزامن (ينادي
                  // الباك إند فعليًا، ويتحقق من رصيد عهدة الكسر حيًّا في كل
                  // استدعاء). كان الكود القديم يُطلق كل الأسطر معًا بلا
                  // انتظار ثم يمسح السلة فورًا — لو فشل أحد الأسطر (رصيد
                  // العهدة غير كافٍ لسطر لاحق مثلًا) كانت السلة تُفرَّغ رغم
                  // ذلك، فيختفي السطر الفاشل بلا أثر. الآن: تنفيذ متتابع (لا
                  // Promise.all — كل سطر يُنقص رصيد العهدة الذي يعتمد عليه
                  // التالي)، والسلة تُمسح فقط إن نجحت كل الأسطر؛ عند فشل
                  // سطر، تبقى الأسطر التي لم تُنفَّذ بعد في السلة ليُعاد
                  // إرسالها بعد حل المشكلة (نقدًا أو تمويل العهدة).
                  setSubmitting(true);
                  try {
                    let succeeded = 0;
                    for (let i = 0; i < lines.length; i++) {
                      const l = lines[i];
                      const ok = await onConfirm({
                        weight: l.weight,
                        grossWeight: l.grossWeight,
                        stonesMargin: l.stonesMargin,
                        karat: l.karat,
                        karatMethod: l.karatMethod,
                        pricePerGram: l.pricePerGram,
                        marketPerGram: l.marketPerGram,
                        discountPct: l.discountPct,
                        totalOverride: l.totalOverride ?? null,
                        pricedBy: l.pricedBy || "gram",
                        customerId: customerId || null,
                        description:
                          (note || "كسر مستلَم") + (lines.length > 1 ? ` (${i + 1}/${lines.length})` : ""),
                      });
                      if (!ok) break;
                      succeeded++;
                    }
                    if (succeeded === lines.length) {
                      resetAll();
                    } else if (succeeded > 0) {
                      // امسح ما نجح فقط وأبقِ الباقي في السلة لإعادة المحاولة
                      setBasket((prev) => prev.slice(succeeded - (lineValid ? 0 : 1)));
                    }
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="py-2.5 rounded-xl text-xs font-bold"
                style={{
                  background: canConfirm ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                  color: canConfirm ? "var(--panel)" : "var(--text3)",
                }}
              >
                {submitting ? "جارٍ التنفيذ..." : "تثبيت الاستلام"}
              </button>
            </div>
          </Card>
        )}

        {recent.length > 0 && (
          <>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-2 mt-2">آخر ما استُلم</p>
            <div className="flex flex-col gap-2">
              {recent.map((e) => (
                <Card key={e.id} style={{ padding: 10 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }} className="text-xs">{e.description || "كسر"}</span>
                    <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
                      {fmtW(e.weight)} جم عيار {e.karat}
                    </span>
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                    {e.ref} · {currency}{fmtMoney(e.total || 0)}
                    {e.karatMethod ? ` · ${KARAT_METHODS.find((m) => m.id === e.karatMethod)?.label || ""}` : ""}
                    {e.stonesMargin > 0 ? ` · فصوص ${fmtW(e.stonesMargin)} جم` : ""}
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

// ═══════════════════════════════════════════════════════════════════════
//  الطابعة — الاقتران مرة واحدة
//
//  المتصفح لا يسمح بالاتصال ببلوتوث إلا باستجابة لضغطة المستخدم، ولا
//  يحتفظ بالإذن تلقائيًا. لذلك: نقترن مرة، نحفظ معرّف الجهاز، ثم نستخدم
//  getDevices() في الجلسات التالية فيعود الاتصال بلا اختيار متكرر.
//
//  المتصفحات التي لا تدعم Web Bluetooth تُعرَض عليها الطباعة العادية
//  بدل رسالة خطأ — الطابعة عبر النظام تعمل في كل الحالات.
// ═══════════════════════════════════════════════════════════════════════

export { ScrapIntakePage };
