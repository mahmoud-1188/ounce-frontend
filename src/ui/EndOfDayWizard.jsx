import React, { useState } from "react";
import { fmtMoney } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

// إنهاء اليوم بثلاث خطوات: العوائق، ثم عدّ الصندوق (أعمى: لا يُرى المتوقَّع قبل تسجيل العدّ)، ثم الفرق وزرٌّ واحد.
// الخادم (POST /day/end) يقيّد الفرق ويُقفل العهدة ويورّد ويُقفل اليوم في معاملةٍ واحدة،
// وفرقٌ فوق الحدّ يُرسَل لمن يعتمده فيُقفل اليوم عند اعتماده.
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

function EndOfDayWizard({ blockers = [], cashBalance = {}, currency = "ر.س", onEndOfDay, onGo, onCancel }) {
  const [ack, setAck] = useState(false);
  const [cc, setCc] = useState("");
  const [cn, setCn] = useState("");
  const [note, setNote] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [busy, setBusy] = useState(false);
  const hardBlock = blockers.filter((b) => b.level === "block");
  const warns = blockers.filter((b) => b.level !== "block");
  const filled = cc !== "" && cn !== "";
  // فرقٌ أُرسل للاعتماد يبقى في الخطوة 3 ولا يعود للعوائق، مع أن طلبه المعلّق عائق
  const step = outcome?.kind === "variance" ? 3 : hardBlock.length || (warns.length && !ack) ? 1 : !revealed ? 2 : 3;
  const vCash = r2((Number(cc) || 0) - (Number(cashBalance.cash) || 0));
  const vNet = r2((Number(cn) || 0) - (Number(cashBalance.network) || 0));
  const vTot = r2(vCash + vNet);
  const STEPS = ["العوائق", "عدّ الصندوق", "الفرق والإقفال"];
  const btn = { minHeight: 48, borderRadius: 14 };
  const primary = { ...btn, background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" };
  const finish = async () => {
    if (busy || !onEndOfDay) return;
    setBusy(true);
    let r = null;
    try { r = await onEndOfDay({ countedCash: Number(cc) || 0, countedNetwork: Number(cn) || 0, note }); } finally { setBusy(false); }
    if (r?.approvalPending) { setOutcome({ kind: "variance", ref: r.approvalPending.ref || "" }); return; }
    if (r) { setOutcome(null); return; }
    setOutcome({ kind: "error", why: "لم يُقفل اليوم — اقرأ الرسالة الظاهرة أعلى الشاشة" });
  };
  const moneyRow = (l, v, exp) => (
    <div key={l} className="flex items-center justify-between text-[12px] py-0.5">
      <span style={{ color: "var(--text2)" }}>{l}: المتوقّع {fmtMoney(exp || 0)}</span>
      <span style={{ color: Math.abs(v) < 0.005 ? "var(--goodSolid)" : "var(--bad)" }} className="font-bold">
        {Math.abs(v) < 0.005 ? "مطابق" : v > 0 ? `زيادة ${fmtMoney(v)}` : `عجز ${fmtMoney(-v)}`}
      </span>
    </div>
  );
  return (
    <Card style={{ padding: 14, marginTop: 12, border: "1px solid var(--accentLine)" }}>
      <div data-eod-wizard data-eod-step={step}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ color: "var(--accent)", margin: 0 }} className="text-sm font-extrabold">إنهاء اليوم</p>
          <button type="button" onClick={onCancel} className="text-[11px] font-bold" style={{ color: "var(--text3)", minHeight: 36 }}>لاحقًا</button>
        </div>
        <div className="grid grid-cols-3 gap-1 mb-3">
          {STEPS.map((l, i) => {
            const n = i + 1, done = n < step, on = n === step;
            return (
              <div key={l} className="text-center">
                <div style={{ width: 24, height: 24, borderRadius: 99, margin: "0 auto 2px", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800,
                  background: done ? "var(--goodBg)" : on ? "var(--accentBg)" : "var(--field)", color: done ? "var(--goodSolid)" : on ? "var(--accent)" : "var(--text3)" }}>{done ? "✓" : n}</div>
                <span style={{ color: on ? "var(--text)" : "var(--text3)" }} className="text-[10px]">{l}</span>
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div>
            <p style={{ color: "var(--text2)" }} className="text-[12px] mb-2">قبل الإقفال: {hardBlock.length ? "حلّ ما يوقف الإقفال أوّلًا — اضغط السطر يأخذك إليه." : "راجع ما يلي — ثم أكمل."}</p>
            <div className="flex flex-col gap-1.5 mb-2">
              {blockers.map((b) => (
                <button type="button" key={b.id} onClick={() => b.go && onGo?.(b.go)} className="w-full text-right px-3 py-2 rounded-xl" data-eod-blocker={b.level}
                  style={{ background: b.level === "block" ? "var(--badBg)" : "var(--field)", border: `1px solid ${b.level === "block" ? "var(--badLine)" : "var(--line)"}` }}>
                  <span style={{ color: b.level === "block" ? "var(--bad)" : "var(--text)" }} className="text-xs font-bold block">{b.level === "block" ? "يوقف: " : ""}{b.label}</span>
                  <span style={{ color: "var(--text3)" }} className="text-[11px]">{b.hint}{b.go ? " ←" : ""}</span>
                </button>
              ))}
            </div>
            {!hardBlock.length && (
              <button type="button" onClick={() => setAck(true)} className="w-full text-sm font-bold" data-eod-ack style={primary}>
                راجعتُها — التالي: عدّ الصندوق
              </button>
            )}
          </div>
        )}

        {step >= 2 && (
          <div>
            <p style={{ color: "var(--text2)" }} className="text-[12px] mb-2">
              عدّ ما في الدرج الآن واكتبه — والشبكة من إيصال الجهاز (اكتب 0 إن لم يكن شيء).
              {!revealed ? " لن ترى الرقم المتوقَّع حتى تسجّل ما عددت." : ""}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field label={`النقد المعدود (${currency})`}>
                {revealed ? <p style={{ color: "var(--text)" }} className="text-sm font-bold" data-eod-counted-cash>{fmtMoney(Number(cc) || 0)}</p>
                  : <NumericInput value={cc} onChange={setCc} />}
              </Field>
              <Field label={`الشبكة (${currency})`}>
                {revealed ? <p style={{ color: "var(--text)" }} className="text-sm font-bold">{fmtMoney(Number(cn) || 0)}</p>
                  : <NumericInput value={cn} onChange={setCn} />}
              </Field>
            </div>
            {!revealed && (
              <button type="button" disabled={!filled} onClick={() => setRevealed(true)} className="w-full text-sm font-bold" data-eod-count
                style={filled ? primary : { ...btn, background: "var(--accentBg)", color: "var(--text3)" }}>
                سجّل ما عددت — التالي: الفرق
              </button>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="p-2 mb-2" style={{ borderRadius: 12, background: "var(--bg)", border: "1px solid var(--line)" }} data-eod-variance>
              {moneyRow("النقد", vCash, cashBalance.cash)}
              {moneyRow("الشبكة", vNet, cashBalance.network)}
              {Math.abs(vTot) >= 0.005 && (
                <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[11px]">
                  يُسجَّل {vTot > 0 ? "الزائد" : "الناقص"} باسم صاحب الصندوق. وإن كان فوق الحدّ المسموح يُرسل لمن يعتمده ولا يُقفل اليوم قبل اعتماده.
                </p>
              )}
            </div>
            <Field label="ملاحظة (اختياري)"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            {outcome?.kind === "variance" ? (
              <div className="p-3 mb-2" style={{ borderRadius: 12, background: "var(--accentBg)", border: "1px solid var(--accentLine)" }} data-eod-pending="count_variance">
                <p style={{ color: "var(--accent)", margin: 0 }} className="text-[12px] font-bold">الفرق فوق الحدّ — أُرسل للاعتماد{outcome.ref ? ` (${outcome.ref})` : ""}</p>
                <p style={{ color: "var(--text2)", margin: "4px 0 0" }} className="text-[11px] leading-6">
                  التالي: اطلب من المدير أو نائبه اعتماده من «الاعتمادات». حين يُعتمد يُقفل اليوم بهذا العدّ ويُورَّد للخزنة.
                  لا تُحرّك الصندوق قبل ذلك — وإن تحرّك فسيُطلب منك عدٌّ جديد.
                </p>
                {onGo && (
                  <button type="button" data-eod-approvals onClick={() => onGo("approvals")} className="w-full mt-2 rounded-xl text-xs font-bold"
                    style={{ minHeight: 44, background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                    افتح الاعتمادات
                  </button>
                )}
              </div>
            ) : (
              <>
                {outcome?.kind === "error" && (
                  <p style={{ color: "var(--bad)" }} className="text-[12px] font-bold mb-2" data-eod-error>{outcome.why} — صحّحه ثم اضغط «إنهاء اليوم» مرّةً أخرى.</p>
                )}
                <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">بضغطةٍ واحدة: يُسجَّل العدّ وفرقه، ويُورَّد المعدود للخزنة، ويُقفل اليوم. وإن تعذّر شيءٌ منها لا يتغيّر شيء.</p>
                {/* لا «أعد العدّ» بعد رؤية المتوقَّع — وإلا لم يبقَ العدّ أعمى */}
                <button type="button" disabled={busy} onClick={finish} className="w-full text-sm font-extrabold" data-eod-finish style={primary}>
                  {busy ? "…" : "إنهاء اليوم"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export { EndOfDayWizard };
