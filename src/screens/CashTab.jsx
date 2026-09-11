import React, { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Lock } from "lucide-react";
import { PURITY, fine24, fmt, fmtW } from "../core/money.js";
import { METHOD_LABELS } from "../core/money-rules.js";
import { Card } from "../ui/Card.jsx";
import { CustodyCloseForm } from "../ui/CustodyCloseForm.jsx";
import { CustodyOpenForm } from "../ui/CustodyOpenForm.jsx";
import { FundCustodyForm } from "../ui/FundCustodyForm.jsx";
import { Hallmark } from "../ui/Hallmark.jsx";
import { SafeGoldForm } from "../ui/SafeGoldForm.jsx";
import { SimpleAmountForm } from "../ui/SimpleAmountForm.jsx";
import { TransactionList } from "../ui/TransactionList.jsx";

function CashTab({
  dailyBalance,
  safeBalance,
  safeGoldBalance,
  custodyBalance,
  currency,
  dailyTx,
  safeTx,
  safeGoldTx,
  custodyTx,
  goldEquivalent,
  onCashIn,
  onCashOut,
  onTransferToSafe,
  onTransferSafeToDaily,
  dailyCustody,
  openCustodySession,
  onOpenCustody,
  onCloseCustody,
  onCloseDay,
  onSafeIn,
  onSafeOut,
  onAddSafeGold,
  onFundCustody,
  onCloseScrapDay,
  // ⚠ إصلاح محلي: SafeGoldForm أدناه يُمرَّر له suppliers، لكن هذا
  // المكوّن لم يكن يستقبله كـ prop أصلاً — فكان suppliers يُقرأ من
  // نطاقٍ غير موجود ويرمي ReferenceError فور فتح نموذج ذهب الخزنة.
  suppliers = [],
}) {
  const [pill, setPill] = useState("daily"); // 'safe' | 'daily' | 'scrap'
  const [showSafeForm, setShowSafeForm] = useState(null); // 'transfer' | 'in' | 'out' | 'gold' | null
  const [showFundForm, setShowFundForm] = useState(false);
  const [custodyForm, setCustodyForm] = useState(null); // "open" | "close" | null

  const sourceLabel = {
    sale: "بيع",
    scrap: "شراء كسر",
    manual: "يدوي",
    custody_transfer: "تحويل لعهدة الكسر",
    safe_transfer: "تحويل للخزنة",
    daily_transfer: "من صندوق اليومي",
    taskir: "تسكير مورد",
    expense: "مصروف",
    partner: "شريك",
    purchase: "شراء من مورد",
    scrap_day_close: "إقفال صندوق الكسر اليومي",
    custody_count: "جرد عهدة الصندوق",
  };
  const methodLabel = METHOD_LABELS;
  const totalAll = dailyBalance.total + safeBalance.total + custodyBalance.total;

  return (
    <div className="px-4 pt-6">
      <h1 style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)" }} className="text-2xl font-extrabold mb-1">
        الصندوق
      </h1>
      <p style={{ color: "var(--text3)" }} className="text-[11px] mb-4">
        الإجمالي: {currency}
        {fmt(totalAll, 0)} · يعادل {fmtW(goldEquivalent.cashGrams)} جم بعيار 24
      </p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => setPill("safe")}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: pill === "safe" ? "var(--accentBg)" : "var(--panel)", color: pill === "safe" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
        >
          الخزنة
        </button>
        <button
          onClick={() => setPill("daily")}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: pill === "daily" ? "var(--accentBg)" : "var(--panel)", color: pill === "daily" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
        >
          صندوق اليومي
        </button>
        <button
          onClick={() => setPill("scrap")}
          className="py-2 rounded-xl text-xs font-bold"
          style={{ background: pill === "scrap" ? "var(--accentBg)" : "var(--panel)", color: pill === "scrap" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
        >
          صندوق الكسر
        </button>
      </div>

      {pill === "daily" && (
        <>
          <Card style={{ padding: 18 }}>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
              رصيد صندوق اليومي
            </p>
            <p style={{ fontFamily: "'Cairo', sans-serif", color: dailyBalance.total >= 0 ? "var(--accent)" : "var(--bad)" }} className="text-3xl font-extrabold">
              {currency}
              {fmt(dailyBalance.total, 0)}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="px-2 py-2 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                <p style={{ color: "var(--text2)" }} className="text-[11px]">
                  نقدي
                </p>
                <p style={{ color: "var(--text)" }} className="text-xs font-bold">
                  {currency}
                  {fmt(dailyBalance.cash, 0)}
                </p>
              </div>
              <div className="px-2 py-2 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                <p style={{ color: "var(--text2)" }} className="text-[11px]">
                  شبكة
                </p>
                <p style={{ color: "var(--text)" }} className="text-xs font-bold">
                  {currency}
                  {fmt(dailyBalance.network, 0)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button onClick={onCashIn} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold" style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
                <ArrowDownCircle size={16} /> إيداع
              </button>
              <button onClick={onCashOut} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold" style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}>
                <ArrowUpCircle size={16} /> مصروف
              </button>
            </div>
            <button
              onClick={onCloseDay}
              className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
            >
              <Lock size={14} /> توريد نهاية اليوم للخزنة (كامل الرصيد)
            </button>
          {/* عهدة الصندوق اليومي */}
          <Card style={{ padding: 14, marginTop: 12, border: openCustodySession ? "1px solid var(--accentLine)" : "1px solid var(--line)" }}>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
              عهدة الصندوق اليومي
            </p>
            {openCustodySession ? (
              <>
                <p style={{ color: "var(--text)" }} className="text-sm font-bold">
                  عهدة مفتوحة باسم {openCustodySession.openedBy || "—"}
                </p>
                <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                  فُتحت {new Date(openCustodySession.openedAt).toLocaleString("en-GB")} · عهدة ابتدائية {currency}
                  {fmt(openCustodySession.floatCash + openCustodySession.floatNetwork, 0)}
                </p>
                <div className="px-3 py-2 rounded-xl mt-2" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                  <p style={{ color: "var(--text2)" }} className="text-[11px]">
                    المتوقع بالصندوق اليومي الآن
                  </p>
                  <p style={{ color: "var(--accent)" }} className="text-sm font-bold">
                    {currency}
                    {fmt(dailyBalance.total, 0)}
                  </p>
                  <p style={{ color: "var(--text3)" }} className="text-[10px]">
                    نقدي {fmt(dailyBalance.cash, 0)} · شبكة {fmt(dailyBalance.network, 0)}
                  </p>
                </div>
                <button
                  onClick={() => setCustodyForm(custodyForm === "close" ? null : "close")}
                  className="w-full mt-2 py-2 rounded-xl text-xs font-bold"
                  style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
                >
                  جرد وإقفال العهدة
                </button>
                {custodyForm === "close" && (
                  <CustodyCloseForm
                    expectedCash={dailyBalance.cash}
                    expectedNetwork={dailyBalance.network}
                    currency={currency}
                    onCancel={() => setCustodyForm(null)}
                    onSubmit={(cc, cn, note) => {
                      onCloseCustody(cc, cn, note);
                      setCustodyForm(null);
                    }}
                  />
                )}
              </>
            ) : (
              <>
                <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
                  سلّم عهدة ابتدائية من الخزنة لمن يقف على الصندوق، وعند نهاية الوردية اجرد الصندوق اليومي فعليًا وسجّل الفرق.
                </p>
                <button
                  onClick={() => setCustodyForm(custodyForm === "open" ? null : "open")}
                  className="w-full py-2 rounded-xl text-xs font-bold"
                  style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
                >
                  فتح عهدة جديدة
                </button>
                {custodyForm === "open" && (
                  <CustodyOpenForm
                    currency={currency}
                    onCancel={() => setCustodyForm(null)}
                    onSubmit={(fc, fn, note) => {
                      onOpenCustody(fc, fn, note);
                      setCustodyForm(null);
                    }}
                  />
                )}
              </>
            )}
            {dailyCustody.filter((c) => c.status === "closed").length > 0 && (
              <>
                <p style={{ color: "var(--text2)" }} className="text-[11px] mt-3 mb-1">
                  آخر الجرود
                </p>
                {dailyCustody
                  .filter((c) => c.status === "closed")
                  .slice(0, 5)
                  .map((c) => {
                    const v = (c.varianceCash || 0) + (c.varianceNetwork || 0);
                    return (
                      <div key={c.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                        <div className="flex flex-col leading-tight">
                          <span style={{ color: "var(--text)" }} className="text-xs">
                            {c.openedBy || "—"}
                          </span>
                          <span style={{ color: "var(--text3)" }} className="text-[10px]">
                            {new Date(c.closedAt).toLocaleDateString("en-GB")}
                          </span>
                        </div>
                        <span style={{ color: Math.abs(v) < 0.0001 ? "var(--goodSolid)" : v > 0 ? "var(--accent)" : "var(--bad)" }} className="text-xs font-bold">
                          {Math.abs(v) < 0.0001 ? "مطابق" : `${v > 0 ? "زيادة" : "عجز"} ${currency}${fmt(Math.abs(v), 0)}`}
                        </span>
                      </div>
                    );
                  })}
              </>
            )}
          </Card>

            <button
              onClick={() => setShowSafeForm(showSafeForm === "transfer" ? null : "transfer")}
              className="w-full mt-2 py-2 rounded-xl text-xs font-bold"
              style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
            >
              تحويل جزئي إلى الخزنة
            </button>
          </Card>
          {showSafeForm === "transfer" && (
            <SimpleAmountForm
              onCancel={() => setShowSafeForm(null)}
              withMethod
              hideCategory
              onSubmit={async (amount, note, method) => {
                // ⚠ إصلاح حقيقي مع الربط: onTransferToSafe صار غير متزامن
                // (ينادي الباك إند فعليًا) — إغلاق النموذج فورًا بصرف
                // النظر عن النتيجة كان سيُخفي فشل الطلب.
                const res = await onTransferToSafe(amount, method, note);
                if (res) setShowSafeForm(null);
              }}
              submitLabel="تحويل"
            />
          )}
          <TransactionList transactions={dailyTx} currency={currency} sourceLabel={sourceLabel} methodLabel={methodLabel} emptyTitle="لا توجد حركات بعد" emptySub="حركات البيع النقدي ستظهر هنا تلقائيًا" />
        </>
      )}

      {pill === "safe" && (
        <>
          <Card style={{ padding: 18 }}>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
              رصيد الخزنة
            </p>
            <p style={{ fontFamily: "'Cairo', sans-serif", color: safeBalance.total >= 0 ? "var(--accent)" : "var(--bad)" }} className="text-3xl font-extrabold">
              {currency}
              {fmt(safeBalance.total, 0)}
            </p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="px-3 py-2 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                <p style={{ color: "var(--text2)" }} className="text-[11px]">
                  نقدي
                </p>
                <p style={{ color: "var(--text)" }} className="text-sm font-bold">
                  {currency}
                  {fmt(safeBalance.cash, 0)}
                </p>
              </div>
              <div className="px-3 py-2 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                <p style={{ color: "var(--text2)" }} className="text-[11px]">
                  شبكة
                </p>
                <p style={{ color: "var(--text)" }} className="text-sm font-bold">
                  {currency}
                  {fmt(safeBalance.network, 0)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                onClick={() => setShowSafeForm(showSafeForm === "in" ? null : "in")}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}
              >
                <ArrowDownCircle size={16} /> إيداع يدوي
              </button>
              <button
                onClick={() => setShowSafeForm(showSafeForm === "out" ? null : "out")}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
              >
                <ArrowUpCircle size={16} /> سحب
              </button>
            </div>
          </Card>
          <button
            onClick={() => setShowSafeForm(showSafeForm === "toDaily" ? null : "toDaily")}
            className="w-full mt-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
          >
            تحويل إلى صندوق اليومي
          </button>
          {showSafeForm === "in" && (
            <SimpleAmountForm withMethod direction="in" onCancel={() => setShowSafeForm(null)} onSubmit={async (a, n, m, c) => { const res = await onSafeIn(a, n, m, c); if (res) setShowSafeForm(null); }} submitLabel="إيداع" />
          )}
          {showSafeForm === "out" && (
            <SimpleAmountForm withMethod direction="out" onCancel={() => setShowSafeForm(null)} onSubmit={async (a, n, m, c) => { const res = await onSafeOut(a, n, m, c); if (res) setShowSafeForm(null); }} submitLabel="سحب" />
          )}
          {showSafeForm === "toDaily" && (
            <SimpleAmountForm
              withMethod
              hideCategory
              onCancel={() => setShowSafeForm(null)}
              onSubmit={async (a, n, m) => {
                const res = await onTransferSafeToDaily(a, m, n);
                if (res) setShowSafeForm(null);
              }}
              submitLabel="تحويل"
            />
          )}

          <Card style={{ padding: 16, marginTop: 12 }}>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
              الذهب المحفوظ بالخزنة
            </p>
            <div className="px-3 py-2 rounded-xl mb-2" style={{ background: "var(--panel)", border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--text2)" }} className="text-[11px]">
                الإجمالي محوَّلًا لعيار 24
              </p>
              <p style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold">
                {fmtW(safeGoldBalance.fineWeight)} جم
              </p>
              <p style={{ color: "var(--text3)" }} className="text-[11px]">
                الوزن الفعلي {fmtW(safeGoldBalance.total)} جم · كسر {fmt(safeGoldBalance.raw)} · مشغول {fmt(safeGoldBalance.crafted)}
              </p>
            </div>
            {Object.keys(safeGoldBalance.byKarat).length === 0 ? (
              <p style={{ color: "var(--text3)" }} className="text-[11px]">
                لا يوجد ذهب بالخزنة
              </p>
            ) : (
              <>
                <p style={{ color: "var(--text2)" }} className="text-[11px] mb-1">
                  التفصيل حسب العيار
                </p>
                {Object.entries(safeGoldBalance.byKarat)
                  .filter(([, v]) => Math.abs(v.total) > 0.0001)
                  .sort((a, b) => Number(b[0]) - Number(a[0]))
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                      <div className="flex items-center gap-2">
                        <Hallmark karat={Number(k)} size={26} />
                        <div className="flex flex-col leading-tight">
                          <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                            عيار {k}
                          </span>
                          {/* ⚠ المعادل بجانب الخام لا بديلًا عنه.
                              عشرة بعيار 18 ليست عشرة بعيار 24 — ومن يقرأ
                              الخام وحده يظنّ خزنته أثقل مما هي. */}
                          <span style={{ color: "var(--text3)" }} className="text-[10px]">
                            {fmtW(v.total)} جم · يعادل {fmtW(fine24(v.total, Number(k)))} جم24
                          </span>
                          <span style={{ color: "var(--text3)" }} className="text-[10px]">
                            كسر {fmt(v.raw)} · مشغول {fmt(v.crafted)}
                          </span>
                        </div>
                      </div>
                      <div className="text-left">
                        <p style={{ color: "var(--text)" }} className="text-xs font-bold">
                          {fmtW(v.total)} جم
                        </p>
                        <p style={{ color: "var(--accentText)" }} className="text-[10px]">
                          = {fmt(v.total * (PURITY[k] || Number(k) / 24))} جم (24)
                        </p>
                      </div>
                    </div>
                  ))}
              </>
            )}
            <button
              onClick={() => setShowSafeForm(showSafeForm === "gold" ? null : "gold")}
              className="w-full mt-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
            >
              إيداع / سحب ذهب من الخزنة
            </button>
          </Card>
          {showSafeForm === "gold" && (
            <SafeGoldForm suppliers={suppliers} onCancel={() => setShowSafeForm(null)} onSubmit={async (type, kind, weight, note, karat, dest, supId) => { const res = await onAddSafeGold(type, kind, weight, note, karat, dest, supId); if (res) setShowSafeForm(null); }} />
          )}

          <TransactionList transactions={safeTx} currency={currency} sourceLabel={sourceLabel} methodLabel={methodLabel} emptyTitle="لا توجد حركات بعد" emptySub="التحويلات من صندوق اليومي ستظهر هنا" />
        </>
      )}

      {pill === "scrap" && (
        <>
          <Card style={{ padding: 18 }}>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
              رصيد صندوق الكسر اليومي
            </p>
            <p style={{ fontFamily: "'Cairo', sans-serif", color: custodyBalance.total >= 0 ? "var(--accent)" : "var(--bad)" }} className="text-3xl font-extrabold">
              {currency}
              {fmt(custodyBalance.total, 0)}
            </p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="px-3 py-2 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                <p style={{ color: "var(--text2)" }} className="text-[11px]">
                  نقدي
                </p>
                <p style={{ color: "var(--text)" }} className="text-sm font-bold">
                  {currency}
                  {fmt(custodyBalance.cash, 0)}
                </p>
              </div>
              <div className="px-3 py-2 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                <p style={{ color: "var(--text2)" }} className="text-[11px]">
                  شبكة
                </p>
                <p style={{ color: "var(--text)" }} className="text-sm font-bold">
                  {currency}
                  {fmt(custodyBalance.network, 0)}
                </p>
              </div>
            </div>
            <button
              onClick={onCloseScrapDay}
              className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
            >
              <Lock size={14} /> إقفال صندوق الكسر اليومي وتوريده للخزنة
            </button>
            <button
              onClick={() => setShowFundForm((v) => !v)}
              className="w-full mt-2 py-2 rounded-xl text-xs font-bold"
              style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
            >
              تمويل العهدة
            </button>
          </Card>
          {showFundForm && (
            <FundCustodyForm onCancel={() => setShowFundForm(false)} onSubmit={async (a, m, n, src) => { const res = await onFundCustody(a, m, n, src); if (res) setShowFundForm(false); }} />
          )}
          <TransactionList
            transactions={custodyTx}
            currency={currency}
            sourceLabel={sourceLabel}
            methodLabel={methodLabel}
            emptyTitle="لا توجد حركات بعد"
            emptySub="التمويل ومشتريات الكسر ستظهر هنا"
            typeMap={{ fund: "in", purchase: "out" }}
          />
        </>
      )}
    </div>
  );
}

export { CashTab };
