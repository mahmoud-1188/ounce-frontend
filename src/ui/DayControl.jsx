import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronLeft } from "lucide-react";
import { ROLES } from "../core/constants.js";
import { fmtMoney, fmtW, sumMoney } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { ModalShell } from "./ModalShell.jsx";
import { NumericInput } from "./NumericInput.jsx";

function DayControl({
  openDay, businessDays = [], cashBalance, safeBalance, custodyBalance,
  scrapEntries = [], sales = [], expenses = [], currency, role,
  onOpen, onClose, onGoTo, compact = false, workdayOff = false,
}) {
  const [sheet, setSheet] = useState(null);      // "open" | "close" | null
  const [openCash, setOpenCash] = useState("");
  const [openCustody, setOpenCustody] = useState("");
  const [note, setNote] = useState("");
  // ⚠ onOpen/onClose صارا نداءي شبكة غير متزامنين — بلا هذه الحالة كانت
  // الورقة تُغلق فورًا بصرف النظر عن نجاح الطلب.
  const [submitting, setSubmitting] = useState(false);

  // ⚠ العَلم لا الدور: منح الصلاحية لموظفٍ بعينه لا يحتاج تعديل شيفرة.
  const canManage = !!ROLES[role]?.canManageDay;

  // ── ما يُقترح ──
  //
  // ⚠ الافتراض من إقفال أمس لا من الصفر: البائع يكتب الرقم نفسه كل
  // صباح، وكتابته يدويًا تعني خطأً مطبعيًا يظهر عند الإقفال بلا مصدر.
  const lastClosed = useMemo(() => {
    const done = (businessDays || [])
      .filter((d) => d.status === "closed")
      .sort((a, b) => String(b.closedAt || b.date).localeCompare(String(a.closedAt || a.date)));
    return done[0] || null;
  }, [businessDays]);

  const suggested = {
    cash: lastClosed?.openingCash ?? 1000,
    custody: lastClosed?.openingCustody ?? 5000,
  };

  useEffect(() => {
    if (sheet === "open") {
      setOpenCash(String(suggested.cash));
      setOpenCustody(String(suggested.custody));
    }
  }, [sheet]);

  // ── فحوصات ما قبل الإقفال ──
  //
  // ⚠ نعرضها قبل الضغط لا بعده: رسالة رفض بعد ضغطتين تُشعر البائع
  // أنه أخطأ، وقائمةٌ ظاهرة تُريه ما بقي عليه.
  const today = new Date().toISOString().slice(0, 10);
  const checks = useMemo(() => {
    const list = [];
    // نُسطّح الأرصدة: قد تصل كائنًا بوسائله أو رقمًا مباشرًا
    const flat = (b) =>
      typeof b === "number" ? b
        : b && typeof b === "object"
          ? Object.values(b).reduce((a, x) => a + (Number(x) || 0), 0)
          : 0;
    const custodyTotal = flat(custodyBalance);
    // ⚠ الكسر غير المُسوّى يُعلَّق ولا يمنع الإقفال.
    //
    // كان مانعًا، فيحبس اليوم كلّه على قطعةٍ واحدة: البائع أنهى عمله
    // ولا يستطيع الإقفال، فيُكسّر على عجل بلا ميزان دقيق أو يترك اليوم
    // مفتوحًا لليوم التالي — فتختلط حركة يومين ولا يُعرف ربح أيّهما.
    //
    // ⚠ وبقيّة العمليات لا ذنب لها: البيع والنقد والمصروفات تُقفل
    // ويُورَّد صندوقها، والكسر وحده يبقى معلّقًا حتى يُسوّى.
    //
    // والتعليق ظاهرٌ لا مخفيّ: يُعرض بعدده ووزنه وما دُفع فيه، فمن
    // يُقفل يعرف ما تركه.
    const suspended = (scrapEntries || []).filter((e) => {
      const st = e.stage || "";
      return st === "pending_break" || st === "in_box" || st === "received";
    });
    const suspW = suspended.reduce((a, e) => a + (Number(e.weight) || 0), 0);
    const suspPaid = suspended.reduce((a, e) => a + (Number(e.total) || 0), 0);
    list.push({
      id: "scrap",
      label: "كسر معلّق لم تتم تسويته",
      ok: suspended.length === 0,
      detail: suspended.length
        ? `${suspended.length} قطعة · ${fmtW(suspW)} جم · ${currency}${fmtMoney(suspPaid)}`
        : "لا شيء معلّق",
      block: false,
      goTo: "scrapCustody",
    });
    // ⚠ كسرٌ ثُبِّت وزنه ولم يُودَع: يبقى خارج الخزنة بلا سبب.
    const readyToDeposit = (scrapEntries || []).filter(
      (e) => (e.stage === "approved") || (e.refined && e.stage === "received")
    );
    list.push({
      id: "deposit",
      label: "إيداع كسر اليوم في خزنته",
      ok: readyToDeposit.length === 0,
      detail: readyToDeposit.length
        ? `${readyToDeposit.length} قطعة جاهزة`
        : "لا شيء معلّق",
      block: false,
      goTo: "scrapCustody",
    });
    list.push({
      id: "custody",
      label: "عهدة الكسر مُقفلة",
      ok: custodyTotal <= 0.01,
      detail: custodyTotal > 0.01
        ? `${currency}${fmtMoney(custodyTotal)} لم تُورَّد`
        : "مُقفلة",
      block: false,
      goTo: "scrapCustody",
    });
    // ⚠ الأرصدة كائنات بوسائلها لا أرقامًا: `balance > 0.01` على كائن
    // تُعطي false دائمًا، فيبدو الصفّ ناقصًا وهو مكتمل.
    const drawer = cashBalance?.cash || 0;
    const net = cashBalance?.network || 0;
    list.push({
      id: "drawer",
      label: "توريد الصندوق اليومي للخزنة",
      ok: drawer + net <= 0.01,
      detail: drawer + net > 0.01
        ? `${currency}${fmtMoney(drawer + net)} في الصندوق اليومي`
        : "فارغ",
      block: false,
      goTo: null,
    });
    return list;
  }, [scrapEntries, custodyBalance, cashBalance, currency]);

  const blockers = checks.filter((c) => c.block && !c.ok);
  const warnings = checks.filter((c) => !c.block && !c.ok);
  const canClose = blockers.length === 0;

  // ── حصيلة اليوم ──
  const summary = useMemo(() => {
    if (!openDay) return null;
    const mine = (arr) => (arr || []).filter((x) => x.businessDayId === openDay.id);
    const daySales = mine(sales);
    return {
      sales: daySales.length,
      revenue: sumMoney(daySales, (x) => x.total),
      expenses: sumMoney(mine(expenses), (x) => x.amount),
      hours: openDay.openedAt
        ? Math.max(0, Math.round((Date.now() - new Date(openDay.openedAt).getTime()) / 36e5))
        : 0,
    };
  }, [openDay, sales, expenses]);

  // ── يوم العمل مطفأ ولا يوم حقيقي مفتوح: شريطٌ هادئ لا إنذار ──
  // الحركات تُسجَّل بلا يوم، وفتح يومٍ يبقى ممكنًا لمن أراد إقفالًا موثّقًا.
  if (compact && workdayOff && !openDay) {
    return (
      <>
        <button
          disabled={!canManage}
          onClick={() => { if (canManage) setSheet("open"); }}
          className="w-full flex items-center gap-2 px-4 py-2"
          style={{ background: "var(--panel)", borderBottom: "1px solid var(--line)" }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--text3)", flexShrink: 0 }} />
          <span style={{ color: "var(--text2)" }} className="text-[11px] font-bold flex-1 text-right">
            يوم العمل مطفأ · الحركات بلا يوم
          </span>
          {canManage && (
            <span style={{ color: "var(--text3)" }} className="text-[10px]">فتح يوم اختياري</span>
          )}
        </button>
        {sheet && renderSheet()}
      </>
    );
  }

  // ── الشريط المختصر ──
  if (compact) {
    return (
      <>
        <button
          disabled={!canManage}
          onClick={() => {
            if (!canManage) return;
            setSheet(openDay ? "close" : "open");
          }}
          className="w-full flex items-center gap-2 px-4 py-2"
          style={{
            background: openDay ? "var(--accentBg)" : "var(--badBg)",
            borderBottom: `1px solid ${openDay ? "var(--accentLine)" : "var(--badLine)"}`,
          }}
        >
          <span
            style={{
              width: 8, height: 8, borderRadius: 4,
              background: openDay ? "var(--good)" : "var(--bad)",
              animation: openDay ? "none" : "dayPulse 1.6s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
          <span
            style={{ color: openDay ? "var(--accent)" : "var(--bad)" }}
            className="text-[11px] font-bold flex-1 text-right"
          >
            {openDay ? `يوم مفتوح · ${openDay.ref}` : "لا يوجد يوم عمل مفتوح"}
          </span>
          <span style={{ color: "var(--text2)" }} className="text-[10px]">
            {openDay
              ? summary?.hours != null ? `${summary.hours} ساعة` : ""
              : canManage ? "اضغط لفتحه" : "راجع المدير"}
          </span>
        </button>
        {sheet && renderSheet()}
        <style>{`@keyframes dayPulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
      </>
    );
  }

  return <>{renderSheet()}</>;

  function renderSheet() {
    if (!sheet) return null;

    // ── ورقة الفتح ──
    if (sheet === "open") {
      const cash = Number(openCash) || 0;
      const cust = Number(openCustody) || 0;
      const need = cash + cust;
      const enough = need <= (safeBalance?.cash ?? Infinity) + 0.01;
      return (
        <ModalShell title="فتح يوم عمل" onClose={() => setSheet(null)}>
          <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
            ⚖ العهدتان نقدٌ من الخزنة: الصندوق اليومي يستقبل البيع، وعهدة الكسر تدفع
            للزبائن. كلاهما يعود للخزنة عند الإقفال.
          </p>

          {lastClosed && (
            <Card style={{ padding: 10, marginBottom: 10 }}>
              <p style={{ color: "var(--text3)" }} className="text-[10px]">
                مقترح من إقفال {lastClosed.ref}
              </p>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label={`عهدة الصندوق (${currency})`}>
              <NumericInput value={openCash} onChange={setOpenCash}
                placeholder={String(suggested.cash)} />
            </Field>
            <Field label={`عهدة الكسر (${currency})`}>
              <NumericInput value={openCustody} onChange={setOpenCustody}
                placeholder={String(suggested.custody)} />
            </Field>
          </div>

          <Card style={{ padding: 11, marginBottom: 12 }}>
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--text2)" }} className="text-[11px]">
                يخرج من الخزنة
              </span>
              <span style={{ color: enough ? "var(--accent)" : "var(--bad)" }}
                className="text-sm font-bold">
                {currency}{fmtMoney(need)}
              </span>
            </div>
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
              المتاح {currency}{fmtMoney(safeBalance?.cash || 0)}
            </p>
            {!enough && (
              <p style={{ color: "var(--bad)" }} className="text-[10px] mt-1 font-bold">
                ⚠ الخزنة لا تكفي — موّلها أو أنقص العهدة
              </p>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setSheet(null)}
              className="py-3 rounded-xl text-sm font-bold"
              style={{ background: "var(--field)", color: "var(--text2)",
                       border: "1px solid var(--edge)" }}>
              إلغاء
            </button>
            <button
              /* ⚠ `need <= 0` كان يمنع فتح يومٍ بلا فكّة.

                  وفتح اليوم مراجعةٌ لا تمويل: صاحب المحل يفتح ليُثبّت
                  أن رصيده الافتتاحي هو ما أقفل عليه أمس — ولو كان صفرًا.

                  ومحلٌّ يبيع بالشبكة وحدها لا يحتاج فكّة، ومنعُه يُجبر
                  صاحبه على كتابة رقمٍ ليس في درجه ليمرّ. */
                disabled={!enough || need < 0 || submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  const ok = await onOpen(cash, cust, note);
                  if (ok) setSheet(null);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="py-3 rounded-xl text-sm font-bold"
              style={{
                /* ⚠ الشكل يتبع `disabled` نفسه.
                   زرٌّ يُضغط ويبدو رماديًا يجعل المستخدم يظنّه معطّلًا
                   فلا يضغطه — والميزة موجودة ولا تُستعمل. */
                background: enough && need >= 0
                  ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)",
                color: enough && need > 0 ? "var(--panel)" : "var(--text3)",
              }}
            >
              {submitting ? "جارٍ الفتح..." : "افتح اليوم"}
            </button>
          </div>
        </ModalShell>
      );
    }

    // ── ورقة الإقفال ──
    return (
      <ModalShell title="إقفال يوم العمل" onClose={() => setSheet(null)}>
        {summary && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              ["فواتير", summary.sales, "var(--accent)"],
              ["مبيعات", fmtMoney(summary.revenue), "var(--good)"],
              ["مصروفات", fmtMoney(summary.expenses), "var(--bad)"],
            ].map(([l, v, c], i) => (
              <Card key={i} style={{ padding: 10, textAlign: "center" }}>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{l}</p>
                <p style={{ color: c, margin: 0 }} className="text-sm font-bold">{v}</p>
              </Card>
            ))}
          </div>
        )}

        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
          قبل الإقفال
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {checks.map((c) => (
            <button
              key={c.id}
              onClick={() => { if (c.goTo && !c.ok) { setSheet(null); onGoTo?.(c.goTo); } }}
              className="w-full text-right rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={{
                background: c.ok ? "var(--goodBg)" : c.block ? "var(--badBg)" : "var(--accentBg)",
                border: `1px solid ${c.ok ? "var(--goodLine)" : c.block ? "var(--badLine)" : "var(--accentLine)"}`,
              }}
            >
              <span style={{ flexShrink: 0 }}>
                {c.ok
                  ? <Check size={15} color="var(--good)" strokeWidth={3} />
                  : <AlertTriangle size={15} color={c.block ? "var(--bad)" : "var(--accent)"} />}
              </span>
              <span style={{ color: "var(--text)" }} className="text-[11px] flex-1">
                {c.label}
              </span>
              <span style={{ color: c.ok ? "var(--good)" : "var(--text2)" }} className="text-[10px]">
                {c.detail}
              </span>
              {!c.ok && c.goTo && (
                <ChevronLeft size={13} color="var(--text3)" style={{ transform: "rotate(180deg)" }} />
              )}
            </button>
          ))}
        </div>

        {blockers.length > 0 && (
          <p style={{ color: "var(--bad)" }} className="text-[10px] mb-3">
            ⚠ الإقفال يورّد للخزنة، وتوريد وزنٍ لم يُكسَّر يعني رصيدًا لم يُوزن.
          </p>
        )}
        {blockers.length === 0 && warnings.length > 0 && (
          <p style={{ color: "var(--text3)" }} className="text-[10px] mb-3">
            ما بقي يُورَّد تلقائيًا مع الإقفال.
          </p>
        )}

        <Field label="ملاحظة الإقفال (اختياري)">
          <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setSheet(null)}
            className="py-3 rounded-xl text-sm font-bold"
            style={{ background: "var(--field)", color: "var(--text2)",
                     border: "1px solid var(--edge)" }}>
            لاحقًا
          </button>
          <button
            disabled={!canClose || submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                const ok = await onClose(note);
                if (ok) {
                  setSheet(null);
                  setNote("");
                }
              } finally {
                setSubmitting(false);
              }
            }}
            className="py-3 rounded-xl text-sm font-bold"
            style={{
              background: canClose
                ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)",
              color: canClose ? "var(--panel)" : "var(--text3)",
            }}
          >
            {submitting ? "جارٍ الإقفال..." : canClose ? "أقفل اليوم" : `${blockers.length} مانع`}
          </button>
        </div>
      </ModalShell>
    );
  }
}

// ============================================================
// إخراج القطع من النظام
//
// ⚠ القطعة تخرج بسببٍ مُعلَن لا بحذفٍ صامت.
//
// حذفُها يجعل المخزون يطابق الواقع ويُخفي لماذا اختلفا: من يراجع
// بعد شهر يرى رقمًا نقص ولا يعرف أضاع أم بيع أم أُعيد للمورد.
//
// وهي لا تُحذف بل تُوسَم خارجةً — يبقى سجلها وتكلفتها وتاريخها.
// ============================================================

export { DayControl };
