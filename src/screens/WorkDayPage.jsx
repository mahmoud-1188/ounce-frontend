import React, { useState } from "react";
import { AlertTriangle, Check, Lock } from "lucide-react";
import { fmt, fmtW } from "../core/money.js";
import { inputStyle, saleProfitOf } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { CustodyCloseForm } from "../ui/CustodyCloseForm.jsx";
import { CustodyOpenForm } from "../ui/CustodyOpenForm.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function WorkDayPage({
  priceData, cashBalance, safeBalance, openCustodySession, sales, expenses, items, lots = [],
  openDay, businessDays = [], onOpenDay, onCloseDay2, workdayOff = false,
  currency, onOpenCustody, onCloseCustody, onCloseDay, onGo, onBack,
}) {
  const [form, setForm] = useState(null); // "open" | "close"
  const [dayNote, setDayNote] = useState("");
  const [tillFloat, setTillFloat] = useState("");
  const [scrapFloat, setScrapFloat] = useState("");
  // ⚠ onOpenDay/onCloseDay2/onOpenCustody/onCloseCustody صارت نداءات شبكة
  // غير متزامنة — بلا هذه الحالة كانت النماذج تُغلق وتُصفَّر فورًا بصرف
  // النظر عن نجاح الطلب من عدمه.
  const [submitting, setSubmitting] = useState(false);

  // ⚠ الحركة تُنسب ليوم العمل لا لتاريخ التقويم. المحل قد يُقفل بعد منتصف
  // الليل، وبيعة الساعة 1:30 فجرًا تخصّ يوم أمس — التقويم يفصلها عنه.
  const ofDay = (arr) => (openDay ? arr.filter((x) => x.businessDayId === openDay.id) : []);
  const todaySales = ofDay(sales);
  const todayExpenses = ofDay(expenses);
  const salesSum = todaySales.reduce((a, s) => a + s.total, 0);
  const expSum = todayExpenses.reduce((a, e) => a + e.amount, 0);
  const profit = todaySales.reduce((a, s) => a + saleProfitOf(s), 0);
  const price24 = priceData.current || 0;
  const g = (v) => (price24 > 0 ? v / price24 : 0);

  const unprinted = items.reduce(
    (a, it) => a + (it.units || []).filter((u) => !u.sold && !u.printed).length,
    0
  );

  return (
    <div>
      <SubPageHeader title="يوم العمل" onBack={onBack} />
      <div className="px-4 pt-2">
        {workdayOff && !openDay && (
          <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)", background: "var(--accentBg)" }}>
            <p style={{ color: "var(--accent)" }} className="text-sm font-bold mb-1">يوم العمل مطفأ</p>
            <p style={{ color: "var(--text2)" }} className="text-[11px]">
              البيع والشراء والمرتجعات تعمل بلا فتحٍ وإقفال يوميّ، ولا تُنسب الحركات ليومٍ بعينه.
              لتشغيله: الإعدادات ← يوم العمل. ويبقى فتح يومٍ من هنا ممكنًا متى أردت إقفالًا موثّقًا.
            </p>
          </Card>
        )}
        {/* ── حالة يوم العمل ── */}
        {/* ⚠ عهدة معلّقة بلا يوم عمل حالة غير منطقية — نطلب إقفالها أولًا
            بدل عرض نموذجين معًا يبدوان تكرارًا. */}
        {!openDay && openCustodySession ? (
          <Card style={{ padding: 16, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--accent)" }} className="text-sm font-bold flex items-center gap-1.5">
              <AlertTriangle size={15} /> عهدة درج معلّقة من يوم سابق
            </p>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1 mb-3">
              أقفلها أولًا — لا يمكن فتح يوم جديد وعهدة الأمس ما زالت مفتوحة.
              انزل لقسم «حركة اليوم» أدناه واجرد الصندوق اليومي.
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[11px]">
              فتحها {openCustodySession.openedBy} ·{" "}
              {new Date(openCustodySession.openedAt).toLocaleString("en-GB")} · تسليم{" "}
              {currency}{fmt(openCustodySession.floatCash || 0, 0)}
            </p>
          </Card>
        ) : !openDay ? (
          <Card style={{ padding: 16, marginBottom: 12, border: "1px solid var(--badLine)" }}>
            <p style={{ color: "var(--bad)" }} className="text-sm font-bold flex items-center gap-1.5">
              <AlertTriangle size={15} /> لا يوجد يوم عمل مفتوح
            </p>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1 mb-3">
              افتح اليوم قبل أي بيع أو صرف. الحركات المسجّلة بلا يوم مفتوح لن تظهر في إقفال أي يوم.
            </p>
            {form !== "openDay" ? (
              <button
                onClick={() => setForm("openDay")}
                className="w-full py-3 rounded-xl font-bold"
                style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
              >
                فتح يوم عمل جديد
              </button>
            ) : (
              <>
                <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
                  العهدتان نقد فقط من الخزنة — الصندوق اليومي يستقبل نقدًا وشراء الكسر يُدفع نقدًا.
                  نقدي الخزنة المتاح: {currency}{fmt(safeBalance?.cash || 0, 0)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={`عهدة الصندوق (${currency})`}>
                    <NumericInput value={tillFloat} onChange={setTillFloat} placeholder="0" />
                  </Field>
                  <Field label={`عهدة الكسر (${currency})`}>
                    <NumericInput value={scrapFloat} onChange={setScrapFloat} placeholder="0" />
                  </Field>
                </div>
                {openCustodySession && Number(tillFloat) > 0 && (
                  <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">
                    توجد عهدة درج مفتوحة — لن تُفتح ثانية. أقفلها أولًا إن أردت عهدة جديدة.
                  </p>
                )}
                {(Number(tillFloat) || 0) + (Number(scrapFloat) || 0) > (safeBalance?.cash || 0) + 0.01 && (
                  <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">
                    المجموع يتجاوز نقدي الخزنة المتاح.
                  </p>
                )}
                <Field label="ملاحظة (اختياري)">
                  <input style={inputStyle} value={dayNote} onChange={(e) => setDayNote(e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setForm(null)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                    إلغاء
                  </button>
                  <button
                    disabled={submitting || (Number(tillFloat) || 0) + (Number(scrapFloat) || 0) > (safeBalance?.cash || 0) + 0.01}
                    onClick={async () => {
                      setSubmitting(true);
                      try {
                        const ok = await onOpenDay(dayNote, tillFloat, scrapFloat);
                        if (ok) {
                          setDayNote("");
                          setTillFloat("");
                          setScrapFloat("");
                          setForm(null);
                        }
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    className="py-2 rounded-xl text-xs font-bold"
                    style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
                  >
                    {submitting ? "جارٍ الفتح..." : "تأكيد الفتح"}
                  </button>
                </div>
              </>
            )}
          </Card>
        ) : (
          <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--good)" }} className="text-sm font-bold">
                يوم عمل مفتوح · {openDay.ref}
              </span>
              <span style={{ color: "var(--text3)" }} className="text-[10px]">
                {new Date(openDay.openedAt).toLocaleString("en-GB")}
              </span>
            </div>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
              فتحه {openDay.openedBy} · كل حركة تُسجَّل الآن تُنسب لهذا اليوم حتى لو تجاوزت منتصف الليل.
            </p>
            {form !== "closeDay" ? (
              <button
                onClick={() => setForm("closeDay")}
                className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
              >
                إقفال يوم العمل
              </button>
            ) : (
              <div className="mt-3">
                <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
                  ستُحفظ لقطة بأرقام اليوم عند الإقفال، ولن يُقبل تسجيل حركات جديدة حتى تفتح يومًا آخر.
                </p>
                <Field label="ملاحظة الإقفال (اختياري)">
                  <input style={inputStyle} value={dayNote} onChange={(e) => setDayNote(e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setForm(null)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                    تراجع
                  </button>
                  <button
                    disabled={submitting}
                    onClick={async () => {
                      setSubmitting(true);
                      try {
                        const ok = await onCloseDay2(dayNote);
                        if (ok) {
                          setDayNote("");
                          setForm(null);
                        }
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    className="py-2 rounded-xl text-xs font-bold"
                    style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
                  >
                    {submitting ? "جارٍ الإقفال..." : "تأكيد الإقفال"}
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* سجل الأيام السابقة */}
        {businessDays.filter((d) => d.status === "closed").length > 0 && (
          <>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-2">الأيام السابقة</p>
            <div className="flex flex-col gap-2 mb-3">
              {businessDays.filter((d) => d.status === "closed").slice(0, 8).map((d) => (
                <Card key={d.id} style={{ padding: 10 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }} className="text-xs font-bold">{d.ref}</span>
                    <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
                      {currency}{fmt(d.snapshot?.salesSum || 0, 0)}
                    </span>
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                    {new Date(d.openedAt).toLocaleString("en-GB")} ← {d.closedAt ? new Date(d.closedAt).toLocaleString("en-GB") : "—"}
                  </p>
                  <p style={{ color: "var(--text3)" }} className="text-[10px]">
                    {d.snapshot?.salesCount || 0} فاتورة · ربح {fmt(d.snapshot?.profit || 0, 0)} · مصروفات {fmt(d.snapshot?.expenses || 0, 0)} · أقفله {d.closedBy}
                  </p>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="px-4 pt-2">
        {/* سعر اليوم */}
        <Card style={{ padding: 14, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ color: "var(--text2)" }} className="text-xs">سعر جرام عيار 24 اليوم</p>
              <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--accent)" }} className="text-xl font-extrabold">
                {currency}{fmt(price24)}
              </p>
            </div>
            <button
              onClick={() => onGo("price")}
              className="text-[11px] px-3 py-1.5 rounded-full"
              style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
            >
              تحديث
            </button>
          </div>
          {priceData.asOf && (
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">آخر تحديث: {priceData.asOf}</p>
          )}
        </Card>

        {/* العهدة */}
        <Card style={{ padding: 14, marginBottom: 10, border: openCustodySession ? "1px solid var(--accentLine)" : "1px solid var(--badLine)" }}>
          {openCustodySession ? (
            <>
              <p style={{ color: "var(--good)" }} className="text-xs font-bold flex items-center gap-1.5">
                <Check size={13} /> العهدة مفتوحة باسم {openCustodySession.openedBy || "—"}
              </p>
              <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                المتوقع بالصندوق اليومي الآن: {currency}{fmt(cashBalance.total, 0)}
              </p>
              {form !== "close" ? (
                <button
                  onClick={() => setForm("close")}
                  className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
                >
                  جرد وإقفال العهدة
                </button>
              ) : (
                <CustodyCloseForm
                  expectedCash={cashBalance.cash}
                  expectedNetwork={cashBalance.network}
                  currency={currency}
                  onCancel={() => setForm(null)}
                  onSubmit={async (cc, cn, note) => {
                    const ok = await onCloseCustody(cc, cn, note);
                    if (ok) setForm(null);
                  }}
                />
              )}
            </>
          ) : (
            <>
              <p style={{ color: "var(--bad)" }} className="text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle size={13} /> لم تُفتح عهدة اليوم بعد
              </p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                سلّم عهدة من الخزنة لمن يقف على الصندوق قبل بدء البيع.
              </p>
              {form !== "open" ? (
                <button
                  onClick={() => setForm("open")}
                  className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
                >
                  فتح عهدة اليوم
                </button>
              ) : (
                <CustodyOpenForm
                  currency={currency}
                  onCancel={() => setForm(null)}
                  onSubmit={async (fc, fn, note) => {
                    const ok = await onOpenCustody(fc, fn, note);
                    if (ok) setForm(null);
                  }}
                />
              )}
            </>
          )}
        </Card>

        {/* حركة اليوم */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">حركة اليوم</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Card style={{ padding: 12 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px]">المبيعات</p>
            <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-base font-extrabold">
              {currency}{fmt(salesSum, 0)}
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[10px]">{todaySales.length} فاتورة</p>
          </Card>
          <Card style={{ padding: 12 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px]">الأرباح</p>
            <p style={{ color: "var(--good)", fontFamily: "'Cairo', sans-serif" }} className="text-base font-extrabold">
              {fmtW(g(profit))} جم
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[10px]">{currency}{fmt(profit, 0)}</p>
          </Card>
          <Card style={{ padding: 12 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px]">المصروفات</p>
            <p style={{ color: "var(--bad)", fontFamily: "'Cairo', sans-serif" }} className="text-base font-extrabold">
              {currency}{fmt(expSum, 0)}
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[10px]">{todayExpenses.length} عملية</p>
          </Card>
          <Card style={{ padding: 12 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px]">صافي اليوم</p>
            <p
              style={{ color: salesSum - expSum >= 0 ? "var(--goodSolid)" : "var(--bad)", fontFamily: "'Cairo', sans-serif" }}
              className="text-base font-extrabold"
            >
              {currency}{fmt(salesSum - expSum, 0)}
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[10px]">{fmtW(g(salesSum - expSum))} جم</p>
          </Card>
        </div>

        {unprinted > 0 && (
          <Card style={{ padding: 10, marginBottom: 10, border: "1px solid var(--badLine)" }}>
            <p style={{ color: "var(--bad)" }} className="text-[11px] flex items-center gap-1.5">
              <AlertTriangle size={12} /> {unprinted} قطعة بلا رقاقة مطبوعة
            </p>
          </Card>
        )}

        {/* إقفال اليوم */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">نهاية اليوم</p>
        <Card style={{ padding: 12, marginBottom: 20 }}>
          <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
            {openCustodySession
              ? "اجرد العهدة أولًا، ثم ورّد رصيد الصندوق للخزنة."
              : "ورّد كامل رصيد الصندوق للخزنة وأقفل اليوم."}
          </p>
          <button
            onClick={async () => {
              setSubmitting(true);
              try {
                await onCloseDay();
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={cashBalance.total <= 0 || submitting}
            className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            style={{
              background: cashBalance.total > 0 ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
              color: cashBalance.total > 0 ? "var(--panel)" : "var(--text3)",
            }}
          >
            <Lock size={14} /> {submitting ? "جارٍ التوريد..." : `توريد ${currency}${fmt(cashBalance.total, 0)} للخزنة`}
          </button>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// العملاء — سجل موحّد يربط الفواتير والإصلاحات والأمانة
// ============================================================

export { WorkDayPage };
