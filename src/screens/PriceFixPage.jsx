import React, { useEffect, useMemo, useState } from "react";
import { fmtMoney } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import * as api from "../core/api.js";
import { Card } from "../ui/Card.jsx";
import { DualHeader } from "../ui/DualHeader.jsx";
import { DualRow } from "../ui/DualRow.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

const FIX_KINDS = {
  gold_to_cash: {
    label: "تثبيت ذهب → نقد",
    hint: "تبيع وزنًا من رصيدك بسعر اليوم — يخرج الوزن ويدخل النقد",
    goldDir: "out", cashDir: "in",
  },
  cash_to_gold: {
    label: "تثبيت نقد → ذهب",
    hint: "تشتري وزنًا برصيدك النقدي بسعر اليوم — يخرج النقد ويدخل الوزن",
    goldDir: "in", cashDir: "out",
  },
};

const fundingOptions = [
  { id: "safe_cash", label: "نقدًا" },
  { id: "safe_network", label: "شبكة" },
];

/**
 * منقولة عن PriceFixPage.js المرجعي في البنية والتسمية، مع تحويلات
 * حقيقية عن السلوك المحلي القديم:
 *
 * 1) لا حساب محلي للرصيد من مصفوفات safeGoldTx/safeTx كاملة (المرجع
 *    يُعيد جمعها في كل رندر) — الرصيد ورقم التثبيت يُجلَبان من
 *    GET /api/price-fix (محسوبَين في الخادم من نفس الجداول الحقيقية)،
 *    مطابقةً لنمط PayrollPage/AttendanceHrPage/HqReportPage.
 * 2) fundingSource (نقدًا/شبكة) حقل جديد لا مقابل له في المرجع: المرجع
 *    يفترض "الخزنة" ككتلة نقد واحدة (safeTx بلا تمييز method)، لكن
 *    باك إندنا يفرّق 1110 (نقدي) عن 1120 (شبكة) دائمًا في كل مسار آخر —
 *    فالتثبيت يحتاج معرفة أيّهما يُخصَم/يُضاف إليه فعليًا.
 * 3) onFix أصبح async ويعيد Promise لا نتيجة متزامنة — الحقول لا تُفرَّغ
 *    إلا بعد نجاح فعلي مؤكَّد من الخادم (نفس نمط AssetForm/DisposeForm).
 * 4) لا حساب ربح/خسارة رأسمالية هنا (4210/4220) — قرار محاسبي صريح
 *    (راجع تعليق migration 018 في price-fix.routes.js): مقاصة مباشرة
 *    بين وزن الخزنة ونقدها بلا حساب فرق تكلفة، لأن لا تكلفة متتبَّعة
 *    لذهب الخزنة أصلًا، ولا المرجع نفسه أكمل هذا الحساب فعليًا.
 */
function PriceFixPage({ priceData = {}, openDay, canManage, onBack, flashToast }) {
  const [kind, setKind] = useState("gold_to_cash");
  const [w, setW] = useState("");
  const [c, setC] = useState("");
  const [price, setPrice] = useState(String(priceData.current || ""));
  const [fundingSource, setFundingSource] = useState("safe_cash");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const currency = priceData.currency || "ر.س";

  async function load() {
    setLoading(true);
    try {
      const res = await api.priceFixApi.fetch();
      setData(res);
    } catch (err) {
      flashToast?.("تعذّر جلب سجل التثبيت");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goldNow = data?.safeGoldFine24 || 0;
  const cashNow = fundingSource === "safe_cash" ? (data?.safeCash || 0) : (data?.safeNetwork || 0);
  const fixes = data?.fixes || [];

  const calc = useMemo(() => {
    const p = Number(price) || 0;
    if (p <= 0) return { error: "سعر التثبيت لازم" };
    const wv = Number(w) || 0;
    const cv = Number(c) || 0;
    if (wv > 0 && cv > 0) return { error: "أدخل الوزن أو المبلغ — لا كليهما" };
    if (wv > 0) return { weight24: wv, cashAmount: wv * p, price24: p };
    if (cv > 0) return { weight24: cv / p, cashAmount: cv, price24: p };
    return { error: "أدخل وزنًا أو مبلغًا" };
  }, [w, c, price]);

  const def = FIX_KINDS[kind];
  const canSubmit = canManage && openDay && !calc.error && !submitting;

  const totals = useMemo(() => {
    let sold = 0, bought = 0, cashIn = 0, cashOut = 0;
    for (const f of fixes) {
      if (f.kind === "gold_to_cash") { sold += Number(f.weight_24k); cashIn += Number(f.cash_amount); }
      else { bought += Number(f.weight_24k); cashOut += Number(f.cash_amount); }
    }
    return { sold, bought, cashIn, cashOut };
  }, [fixes]);

  async function submit() {
    setSubmitting(true);
    try {
      await api.priceFixApi.create({
        kind,
        weight24: Number(w) || 0,
        cashAmount: Number(c) || 0,
        price24: Number(price) || 0,
        fundingSource,
        note,
      });
      flashToast?.(`${def.label} · ${calc.error ? "" : `${calc.weight24?.toFixed?.(3) || ""} جم24`}`);
      setW(""); setC(""); setNote("");
      await load();
    } catch (err) {
      const code = err?.body?.error;
      const msg = code === "insufficient_gold" ? "ذهب الخزنة لا يكفي"
        : code === "insufficient_cash" ? "نقد الخزنة لا يكفي"
        : code === "day_not_open" ? "افتح يوم العمل أولًا"
        : "تعذّر تنفيذ التثبيت";
      flashToast?.(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <SubPageHeader title="التثبيت — ذهب ↔ نقد" onBack={onBack} />
      <div className="px-4 pt-3">

        {loading ? (
          <p style={{ color: "var(--text3)" }} className="text-[12px]">جارٍ التحميل…</p>
        ) : (
          <>
            <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--accent)", margin: 0 }} className="text-[11px] font-bold mb-1">
                رصيد الخزنة الآن
              </p>
              <DualHeader currency={currency} />
              <DualRow label="الخزنة" weight_24k={goldNow} cash_amount={cashNow} currency={currency} />
              <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2 leading-6">
                ⚖ التثبيت هو الجسر الوحيد بين الدفترين. الوزن لا يصير نقدًا من
                تلقاء نفسه — ومن يكتب «قيمة الذهب» في ميزانٍ يومي يُعيد حساب
                ماضيه بسعر يومه.
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {Object.entries(FIX_KINDS).map(([id, d]) => {
                const on = kind === id;
                return (
                  <button key={id} onClick={() => { setKind(id); setW(""); setC(""); }}
                    className="text-right rounded-xl p-2.5"
                    style={{
                      background: on ? "var(--accentBg)" : "var(--field)",
                      border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`,
                    }}>
                    <p style={{ color: on ? "var(--accent)" : "var(--text)", margin: 0 }}
                      className="text-[11px] font-bold">{d.label}</p>
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px] leading-4">
                      {d.hint}
                    </p>
                  </button>
                );
              })}
            </div>

            <Field label="التمويل من">
              <div className="grid grid-cols-2 gap-2">
                {fundingOptions.map((f) => (
                  <button key={f.id} onClick={() => setFundingSource(f.id)}
                    className="py-2 rounded-xl text-[11px] font-bold"
                    style={{
                      background: fundingSource === f.id ? "var(--accentBg)" : "var(--field)",
                      color: fundingSource === f.id ? "var(--accent)" : "var(--text2)",
                      border: "1px solid var(--line)",
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="سعر التثبيت — للجرام عيار 24">
              <NumericInput value={price} onChange={setPrice} />
              {Number(price) > 0 && Number(priceData.current) > 0
                && Math.abs(Number(price) - priceData.current) / priceData.current > 0.02 && (
                <p style={{ color: "var(--bad)" }} className="text-[10px] mt-1">
                  ⚠ يبعد {Math.round(Math.abs(Number(price) - priceData.current) / priceData.current * 100)}٪
                  عن سعر المحل {currency}{fmtMoney(priceData.current)}
                </p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="الوزن جم24">
                <NumericInput value={w} onChange={(v) => { setW(v); if (v) setC(""); }} />
              </Field>
              <Field label={`أو المبلغ ${currency}`}>
                <NumericInput value={c} onChange={(v) => { setC(v); if (v) setW(""); }} />
              </Field>
            </div>

            {!calc.error && (
              <Card style={{ padding: 11, marginBottom: 10 }}>
                <DualHeader currency={currency} />
                <DualRow label={def.label}
                  weight_24k={def.goldDir === "out" ? -calc.weight24 : calc.weight24}
                  cash_amount={def.cashDir === "out" ? -calc.cashAmount : calc.cashAmount}
                  currency={currency} />
                <DualRow label="بعد التثبيت"
                  weight_24k={goldNow + (def.goldDir === "out" ? -calc.weight24 : calc.weight24)}
                  cash_amount={cashNow + (def.cashDir === "out" ? -calc.cashAmount : calc.cashAmount)}
                  currency={currency} tone="accent" />
              </Card>
            )}
            {calc.error && (w || c) && (
              <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">⚠ {calc.error}</p>
            )}

            <Field label="ملاحظة (اختياري)">
              <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>

            <button
              disabled={!canSubmit}
              onClick={submit}
              className="w-full py-3 rounded-xl text-sm font-bold mb-4"
              style={{
                background: canSubmit ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)",
                color: canSubmit ? "var(--panel)" : "var(--text3)",
              }}>
              {submitting ? "جارٍ التثبيت…" : !openDay ? "افتح يوم العمل أولًا" : !canManage ? "بيد المدير"
                : calc.error ? "أكمل البيانات" : `ثبّت — ${def.label}`}
            </button>

            {fixes.length > 0 && (
              <>
                <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
                  التثبيتات السابقة — {fixes.length}
                </p>
                <Card style={{ padding: 11, marginBottom: 10 }}>
                  <DualHeader currency={currency} />
                  <DualRow label="ثُبّت للنقد" weight_24k={-totals.sold}
                    cash_amount={totals.cashIn} currency={currency} />
                  <DualRow label="ثُبّت للذهب" weight_24k={totals.bought}
                    cash_amount={-totals.cashOut} currency={currency} />
                </Card>
                <div className="flex flex-col gap-1.5">
                  {fixes.slice(0, 30).map((f) => (
                    <Card key={f.id} style={{ padding: 10 }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{ color: "var(--text3)", fontFamily: "monospace" }}
                          className="text-[10px]">{f.ref}</span>
                        <span style={{ color: "var(--text2)" }} className="text-[10px] flex-1">
                          {FIX_KINDS[f.kind]?.label} · {new Date(f.created_at).toLocaleDateString("en-GB")}
                        </span>
                        <span style={{ color: "var(--text3)" }} className="text-[10px]">
                          @{fmtMoney(f.price24)}
                        </span>
                      </div>
                      <DualRow label={f.note || "—"}
                        weight_24k={f.kind === "gold_to_cash" ? -f.weight_24k : f.weight_24k}
                        cash_amount={f.kind === "gold_to_cash" ? f.cash_amount : -f.cash_amount}
                        currency={currency} />
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

export { PriceFixPage };
