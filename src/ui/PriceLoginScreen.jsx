import React, { useState } from "react";
import { Check, ChevronLeft, Delete, RefreshCw, X } from "lucide-react";
import { ROLES } from "../core/constants.js";
import { GRAMS_PER_OUNCE, KARATS, fmt, pricePerGram } from "../core/money.js";
import { Card } from "./Card.jsx";
import { GoldPriceChart } from "./GoldPriceChart.jsx";
import { Hallmark } from "./Hallmark.jsx";
import { OqiyyahLogo } from "./OqiyyahLogo.jsx";
import { PriceHero } from "./PriceHero.jsx";

function PriceLoginScreen({ priceData, autoUpdating, autoError, lastAutoFetch, onRefreshNow, onLogin, requirePin = true, users = [], onDirectLogin }) {
  const [showPinPad, setShowPinPad] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  // ⚠ تغيير حقيقي عن المرجع: كان الرقم السري يُفحَص محليًا مقابل كل
  // المستخدمين دفعة واحدة (تجزئة بسيطة قابلة للمطابقة الجماعية). الباك
  // إند يستخدم bcrypt — تجزئة مُملَّحة لكل مستخدم على حدة لا تُقارَن إلا
  // بمعرفة "لمن" الرقم أولًا (هذا مصمَّم عمدًا هكذا في auth.routes.js: راجع
  // تعليقه "pick branch -> tap a name -> enter PIN"). لذلك صار اختيار
  // الاسم خطوة أولى إلزامية حتى مع الحماية بالرقم السري مفعّلة، لا فقط في
  // وضع "الحماية مطفأة" كما كان سابقًا.
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // ⚠ تغيير حقيقي مقصود عن نسخة "اكتب اسمك فتظهر نتائج مطابقة": لا نعرض
  // أي معلومة عن أي موظف قبل معرفة رمزه (ref) الفريد كاملًا — رمزٌ فريدٌ
  // 100% (لا تكرار كالأسماء) فلا حاجة لقائمة اقتراحات أصلًا. المطابقة
  // ضد users المُحمَّلة أصلًا (لا نداء شبكة إضافي)، ورمزٌ غير موجود يُعرض
  // بنفس رسالة "رقم سري غير صحيح" تمامًا — بلا تمييز بين الحالتين، حتى
  // لا يُخبَر من يخمّن أي جزءٍ كان صحيحًا (نفس مبدأ أي نظام دخول آمن).
  const [refInput, setRefInput] = useState("");
  const [refError, setRefError] = useState(false);
  const [refShake, setRefShake] = useState(false);

  const handleRefSubmit = () => {
    const code = refInput.trim().toUpperCase();
    if (!code) return;
    const found = users.find((u) => String(u.ref || "").toUpperCase() === code);
    if (!found) {
      setRefError(true);
      setRefShake(true);
      setTimeout(() => setRefShake(false), 400);
      return;
    }
    setRefError(false);
    setSelectedUser(found);
  };

  const last = priceData.history[priceData.history.length - 2];
  const trend = last ? priceData.current - last.price : 0;
  const ouncePriceSar = priceData.current * GRAMS_PER_OUNCE;
  const chartData = priceData.history.slice(-30).map((h, idx) => ({
    idx,
    time: new Date(h.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    price: Number(h.price.toFixed(2)),
  }));

  const handleDigit = (d) => {
    if (pin.length >= 6) return;
    setError(false);
    setPin((p) => p + d);
  };
  const handleBackspace = () => {
    setError(false);
    setPin((p) => p.slice(0, -1));
  };
  const handleSubmit = async () => {
    if (!pin || !selectedUser || submitting) return;
    setSubmitting(true);
    try {
      // ⚠ هنا فقط انتظار شبكة حقيقي مقبول في كل هذا التطبيق: الدخول
      // حدث لمرة واحدة لكل جلسة، لا تنقّل بين شاشات — لا يتعارض مع شرط
      // "بلا لود أثناء التنقل".
      const ok = await onLogin(pin, selectedUser.id);
      if (!ok) {
        setError(true);
        setShake(true);
        setPin("");
        setTimeout(() => setShake(false), 400);
      }
    } finally {
      setSubmitting(false);
    }
  };
  const closePinPad = () => {
    setShowPinPad(false);
    setSelectedUser(null);
    setPin("");
    setError(false);
    setRefInput("");
    setRefError(false);
  };

  return (
    <div dir="rtl" style={{ background: "var(--bg)", minHeight: "100vh", fontFamily: "'Cairo','Tajawal',system-ui,sans-serif" }}>
      <style>{`
        @keyframes shakeX { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-8px);} 75%{transform:translateX(8px);} }
        @keyframes chartPulseRing { 0% { r: 4; opacity: 0.55; } 100% { r: 15; opacity: 0; } }
        .chart-pulse-ring { animation: chartPulseRing 1.8s ease-out infinite; }
      `}</style>
      <div className="mx-auto px-4 pt-6 pb-10">
        <div className="flex items-center gap-3 mb-4">
          <OqiyyahLogo size={64} />
          <h1 style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)", margin: 0 }} className="text-2xl font-extrabold">
            أسعار الذهب
          </h1>
        </div>
        <Card style={{ padding: 18 }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span
                style={{ width: 7, height: 7, borderRadius: "50%", background: autoUpdating ? "var(--accent)" : "var(--goodSolid)", display: "inline-block" }}
                className={autoUpdating ? "animate-pulse" : ""}
              />
              <span style={{ color: "var(--text2)" }} className="text-xs">
                {autoUpdating ? "جاري التحديث..." : "مرتبط بسعر الذهب العالمي"}
              </span>
            </div>
            <button onClick={onRefreshNow} disabled={autoUpdating} style={{ color: "var(--accentText)" }}>
              <RefreshCw size={16} className={autoUpdating ? "animate-spin" : ""} />
            </button>
          </div>
          <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
            سعر جرام عيار 24
          </p>
          {/* ⚠ الرسم خلفية للسعر لا بطاقة منفصلة: عينك تقرأ الرقم والاتجاه
              معًا في نظرة، بدل تمرير بينهما. */}
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
            {chartData.length >= 2 && (
              <div style={{ position: "absolute", inset: 0, opacity: 0.55, pointerEvents: "none" }}>
                <GoldPriceChart data={chartData} currency={priceData.currency} height={210} bare />
              </div>
            )}
            <div style={{ position: "relative" }}>
              <PriceHero
                chartData={[]}
                price={priceData.current}
                prevPrice={last?.price}
                currency={priceData.currency}
                updatedAt={lastAutoFetch}
                world24={priceData.world24}
                markup={priceData.markup}
                compact
              />
            </div>
          </div>
          <p style={{ color: "var(--text3)" }} className="text-xs mt-2">
            سعر الأونصة العالمية: {priceData.currency}
            {fmt(ouncePriceSar, 0)}
          </p>
        </Card>

        <p style={{ color: "var(--text2)" }} className="text-xs mt-6 mb-2">
          السعر حسب العيار
        </p>
        <div className="flex flex-col gap-2">
          {KARATS.map((k) => (
            <Card key={k} style={{ padding: 10 }}>
              <div className="flex items-center gap-3">
                <Hallmark karat={k} size={36} />
                <div className="flex-1 flex items-center justify-between">
                  <span style={{ color: "var(--text)" }} className="text-sm">
                    عيار {k}
                  </span>
                  <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="font-bold">
                    {priceData.currency}
                    {fmt(pricePerGram(k, priceData.current))}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-center mt-8">
          {/* ⚠ إصلاح واجهة حقيقي: كان هذا الزر مربعًا شفافًا بلا نص (بلا
              حتى لون ظاهر مختلف عن الخلفية) — عمليًا غير مرئي لأي مستخدم
              لا يعرف مسبقًا مكانه بالضبط. الآن زر واضح بنص "تسجيل الدخول". */}
          <button
            onClick={() => setShowPinPad(true)}
            aria-label="تسجيل الدخول"
            className="flex items-center gap-2 font-bold"
            style={{
              padding: "12px 28px",
              borderRadius: 12,
              background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))",
              color: "var(--panel)",
              fontFamily: "'Cairo', sans-serif",
              fontSize: 15,
              boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
            }}
          >
            تسجيل الدخول
          </button>
        </div>
      </div>

      {/* ── الدخول بلا رقم سري ── */}
      {showPinPad && !requirePin && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6" style={{ background: "var(--veil)" }}>
          <button onClick={closePinPad} className="fixed z-50" style={{ top: 20, left: 20, color: "var(--text2)" }}>
            <X size={24} />
          </button>
          <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-base font-bold mb-1">
            من يستخدم التطبيق؟
          </p>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-5">
            الحماية بالرقم السري مطفأة — يمكن تفعيلها من الإعدادات
          </p>
          <div className="w-full" style={{ maxWidth: 320 }}>
            {users.length === 0 ? (
              <p style={{ color: "var(--bad)" }} className="text-xs text-center">
                لا يوجد مستخدمون — حمّل النسخة التجريبية أو أضف مستخدمًا
              </p>
            ) : (
              users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onDirectLogin && onDirectLogin(u.id)}
                  className="w-full text-right mb-2"
                >
                  <Card style={{ padding: 13 }}>
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                          background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))",
                          display: "grid", placeItems: "center",
                        }}
                      >
                        <span style={{ color: "var(--panel)", fontWeight: 800, fontSize: 16 }}>
                          {(u.name || "؟").charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif", margin: 0 }} className="text-sm font-bold">
                          {u.name}
                        </p>
                        <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">
                          {ROLES[u.role]?.label || ""}
                          {u.ref ? ` · ${u.ref}` : ""}
                        </p>
                      </div>
                      <ChevronLeft size={16} color="var(--text3)" style={{ transform: "rotate(180deg)" }} />
                    </div>
                  </Card>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ⚠ تغيير مقصود (طلب المستخدم صراحةً): الدخول عن طريق رمز الموظف
          (ref) فقط — بلا أي عرض لأسماء أو نتائج مطابقة أثناء الكتابة.
          حقل واحد + زر متابعة، ورمزٌ غير موجود يُعامَل بنفس رسالة/رجّة
          "رقم سري غير صحيح" تمامًا (راجع handleRefSubmit أعلاه) حتى لا
          تُكشف أي معلومة عن وجود/عدم وجود موظف بهذا الرمز. */}
      {showPinPad && requirePin && !selectedUser && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6" style={{ background: "var(--veil)" }}>
          <button onClick={closePinPad} className="fixed z-50" style={{ top: 20, left: 20, color: "var(--text2)" }}>
            <X size={24} />
          </button>
          <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-base font-bold mb-1">
            أدخل رمز الموظف
          </p>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-5">
            الرمز القصير الخاص بك — اطلبه من المدير إن لم تحفظه
          </p>
          <div className="w-full" style={{ maxWidth: 320, animation: refShake ? "shakeX 0.4s" : "none" }}>
            {users.length === 0 ? (
              <p style={{ color: "var(--bad)" }} className="text-xs text-center">
                تعذّر تحميل قائمة المستخدمين — تحقّق من الاتصال بالخادم
              </p>
            ) : (
              <>
                <input
                  autoFocus
                  value={refInput}
                  onChange={(e) => {
                    setRefInput(e.target.value.toUpperCase());
                    setRefError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRefSubmit();
                  }}
                  placeholder="رمز الموظف"
                  dir="ltr"
                  autoCapitalize="characters"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "var(--field)",
                    border: `1px solid ${refError ? "var(--bad)" : "var(--line)"}`,
                    color: "var(--text)",
                    fontFamily: "'Cairo', sans-serif",
                    fontSize: 18,
                    letterSpacing: 3,
                    textAlign: "center",
                    marginBottom: 12,
                  }}
                />
                {refError && (
                  <p style={{ color: "var(--bad)" }} className="text-xs text-center mb-3">
                    رقم سري غير صحيح
                  </p>
                )}
                <button
                  onClick={handleRefSubmit}
                  disabled={!refInput.trim()}
                  className="w-full font-bold"
                  style={{
                    padding: "12px 0",
                    borderRadius: 12,
                    background: refInput.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--panel)",
                    color: refInput.trim() ? "var(--panel)" : "var(--text3)",
                    fontFamily: "'Cairo', sans-serif",
                    fontSize: 15,
                    border: refInput.trim() ? "none" : "1px solid var(--line)",
                  }}
                >
                  متابعة
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showPinPad && requirePin && selectedUser && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6" style={{ background: "var(--veil)" }}>
          <button onClick={() => setSelectedUser(null)} className="fixed z-50" style={{ top: 20, left: 20, color: "var(--text2)" }}>
            <X size={24} />
          </button>
          <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold mb-1">
            {selectedUser.name}
          </p>
          <p style={{ color: "var(--text2)" }} className="text-xs mb-4">
            أدخل الرقم السري للدخول
          </p>
          <div className="flex items-center gap-3 mb-6" style={{ animation: shake ? "shakeX 0.4s" : "none" }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: i < pin.length ? (error ? "var(--bad)" : "var(--accent)") : "transparent",
                  border: `1px solid ${error ? "var(--bad)" : "var(--accentLine)"}`,
                }}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3" style={{ width: 240 }}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                onClick={() => handleDigit(d)}
                className="rounded-full text-lg font-bold"
                style={{ width: 64, height: 64, background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)" }}
              >
                {d}
              </button>
            ))}
            <button onClick={handleBackspace} className="rounded-full flex items-center justify-center" style={{ width: 64, height: 64, color: "var(--text2)" }}>
              <Delete size={20} />
            </button>
            <button
              onClick={() => handleDigit("0")}
              className="rounded-full text-lg font-bold"
              style={{ width: 64, height: 64, background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)" }}
            >
              0
            </button>
            <button
              onClick={handleSubmit}
              disabled={!pin || submitting}
              className="rounded-full flex items-center justify-center"
              style={{ width: 64, height: 64, background: pin ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--panel)", color: pin ? "var(--panel)" : "var(--accentLine)" }}
            >
              {submitting ? <RefreshCw size={20} className="animate-spin" /> : <Check size={22} />}
            </button>
          </div>
          {error && (
            <p style={{ color: "var(--bad)" }} className="text-xs mt-4">
              رقم سري غير صحيح
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export { PriceLoginScreen };
