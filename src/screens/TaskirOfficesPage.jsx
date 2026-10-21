import React, { useMemo, useState } from "react";
import { Building2, ChevronLeft, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { KARATS, fine24, fmt, fmtMoney, fmtW, pricePerGram, roundMoney2 } from "../core/money.js";
import { exportTablesPdf, inputStyle } from "../domain/helpers.js";
import { officeAccountOf } from "../domain/officeAccount.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

// مكتب التسكير كالبنك: ذهبنا عنده أصلٌ 1240، وما علينا له التزامٌ 2130 بعيار 24 دائمًا.
// سداده ذهبٌ بذهب أو نقدٌ بسعر اليوم (أو بنسبة شراءٍ آجلٍ بعينه)، ولا يُخلطان. الحساب في officeAccountOf لا في الشاشة.
const wtxt = (f) => `${fmtW(f)} جم24`;

function TaskirOfficesPage({
  offices = [], officeTx = [], suppliers = [], currency, price24 = 0,
  branchName, canManage, onSettle, onAddOffice, onBack, flashToast, onHold = null,
}) {
  const [pick, setPick] = useState(null);
  const [form, setForm] = useState(null);   // { kind: "pay"|"buy"|"withdraw"|"toSupplier", … }
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name || "";

  const all = useMemo(() => offices.map((o) => officeAccountOf(o, officeTx, { supplierName }))
    .sort((a, b) => (b.heldFine + b.owedFine) - (a.heldFine + a.owedFine) || String(a.office.name).localeCompare(String(b.office.name), "ar")),
  [offices, officeTx, suppliers]);
  const A = pick ? all.find((x) => x.office.id === pick) : null;
  const totalOwed = all.reduce((a, x) => a + x.owedFine, 0);
  const totalHeld = all.reduce((a, x) => a + x.heldFine, 0);
  const sym = (t) => (t.heldDelta > 0 || t.owedDelta < 0 ? "+" : t.heldDelta < 0 || t.owedDelta > 0 ? "−" : "");
  const txLabel = (t) => `${t.kindLabel}${t.kind === "hold_buy" && t.pay === "deferred" ? " — آجل" : ""}${t.supplierName ? ` · ${t.supplierName}` : ""}`;
  const holdOf = (k) => (A ? A.lines.filter((t) => t.rowKind === "hold" && Number(t.karat) === k).reduce((s, t) => s + (t.type === "debit" ? 1 : -1) * (Number(t.weight) || 0), 0) : 0);

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const sum = [["حسابات مكاتب التسكير"], [], ["المكتب", "ذهبنا عنده (جم24)", "تكلفته", "علينا له (جم24)", `علينا له (${currency})`, "حركات"]];
    all.forEach((x) => sum.push([x.office.name, fmtW(x.heldFine), fmtMoney(x.heldCost), fmtW(x.owedFine), fmtMoney(x.owedAmount), x.count]));
    sum.push([], ["الإجمالي", fmtW(totalHeld), "", fmtW(totalOwed), "", ""]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), "الملخّص");
    all.forEach((x) => {
      if (!x.lines.length) return;
      const r = [[x.office.name], [],
        ["المرجع", "التاريخ", "العملية", "الوزن (جم24)", `المبلغ (${currency})`, "ذهبنا عنده بعدها", "علينا له بعدها", "ملاحظة"]];
      [...x.lines].reverse().forEach((t) =>
        r.push([t.ref || "", String(t.date).slice(0, 10), txLabel(t), `${sym(t)}${fmtW(t.fine)}`, t.amount ? fmtMoney(t.amount) : "",
          fmtW(t.heldAfter), fmtW(t.owedAfter), t.note || ""]));
      r.push([], ["الرصيد", "", "", "", "", fmtW(x.heldFine), fmtW(x.owedFine), ""]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r), x.office.name.slice(0, 28));
    });
    XLSX.writeFile(wb, `مكاتب_التسكير_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const exportPdf = () =>
    exportTablesPdf({
      title: "حسابات مكاتب التسكير",
      subtitle: `ذهبنا عندها ${wtxt(totalHeld)} · علينا لها ${wtxt(totalOwed)}`,
      branchName, onBlocked: flashToast,
      sections: (A ? [A] : all).map((x) => ({
        title: `${x.office.name} — ذهبنا عنده ${wtxt(x.heldFine)} · علينا له ${wtxt(x.owedFine)}`,
        headers: ["المرجع", "التاريخ", "العملية", "الوزن (جم24)", `المبلغ (${currency})`, "ذهبنا عنده", "علينا له"],
        rows: [...x.lines].reverse().map((t) => [t.ref || "", String(t.date).slice(0, 10), txLabel(t), `${sym(t)}${fmtW(t.fine)}`, t.amount ? fmtMoney(t.amount) : "", fmtW(t.heldAfter), fmtW(t.owedAfter)]),
        note: "⚖ بالصافي عيار 24. ذهبنا عند المكتب أصلٌ لنا (1240) لا مشتريات، وأخذُه نقلُ أصلٍ لا شراء.",
      })),
    });

  const btn = (label, on, onClick, extra = {}) => (
    <button key={label} type="button" onClick={onClick} className="rounded-xl text-xs font-bold px-2"
      style={{ minHeight: 44, background: on ? "var(--accentBg)" : "var(--panel)", color: on ? "var(--accent)" : "var(--text2)", border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`, ...extra }}>
      {label}
    </button>
  );
  const ppg = (k) => (price24 > 0 ? pricePerGram(k, price24).toFixed(2) : "");
  const start = (kind) => setForm({ kind, officeId: A.office.id, karat: kind === "pay" ? 21 : 24, weight: "", amount: "", pricePerGram: ppg(24), pay: "safe_cash", mode: "cash", supplierId: suppliers[0]?.id || "", forTxId: "" });
  const fineOf = () => fine24(Number(form?.weight) || 0, Number(form?.karat) || 24);
  const buyTotal = roundMoney2((Number(form?.weight) || 0) * (Number(form?.pricePerGram) || 0));
  const deferredOpen = A ? A.lines.filter((t) => t.pay === "deferred" && t.openAmount > 0.005) : [];
  const run = async (fn) => { setBusy(true); try { if (await fn()) setForm(null); } finally { setBusy(false); } };

  const renderForm = () => {
    if (!form || !A || form.officeId !== A.office.id) return null;
    const close = () => setForm(null);
    const karatField = (
      <Field label="العيار">
        <select style={inputStyle} value={form.karat} onChange={(e) => setForm((f) => ({ ...f, karat: Number(e.target.value), pricePerGram: ppg(Number(e.target.value)) || f.pricePerGram }))}>
          {[24, ...KARATS.filter((k) => k !== 24)].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </Field>
    );
    const weightField = (label = "الوزن (جم)") => (
      <Field label={label}><NumericInput value={form.weight} onChange={(v) => setForm((f) => ({ ...f, weight: v }))} placeholder="0.000" /></Field>
    );
    const actions = (ok, label, onOk) => (
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={close} className="py-2.5 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
        <button type="button" disabled={!ok || busy} onClick={onOk} className="py-2.5 rounded-xl text-xs font-bold" data-office-submit={form.kind}
          style={{ background: ok ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: ok ? "var(--panel)" : "var(--text3)" }}>{busy ? "…" : label}</button>
      </div>
    );
    if (form.kind === "buy") {
      const ok = Number(form.weight) > 0 && Number(form.pricePerGram) > 0;
      return (
        <Card style={{ padding: 13, marginBottom: 12, border: "1px solid var(--accentLine)" }} data-office-form="buy">
          <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">شراء ذهب وإيداعه عند {A.office.name}</p>
          <div className="grid grid-cols-2 gap-2">{karatField}{weightField()}</div>
          <Field label={`سعر الجرام المتّفق (${currency})`}><NumericInput value={form.pricePerGram} onChange={(v) => setForm((f) => ({ ...f, pricePerGram: v }))} placeholder="0.00" /></Field>
          <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">الإجمالي {fmtMoney(buyTotal)} {currency} · يعادل {wtxt(fineOf())} يُضاف إلى ذهبك عنده</p>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-1">الدفع</p>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[["safe_cash", "نقد الخزنة"], ["safe_network", "شبكة / تحويل"], ["deferred", "آجل على المكتب"]].map(([id, l]) => btn(l, form.pay === id, () => setForm((f) => ({ ...f, pay: id }))))}
          </div>
          {form.pay === "deferred" && <p style={{ color: "var(--accentText)" }} className="text-[11px] mb-2">⚖ يُسجَّل الثمن علينا للمكتب (2130) ويُسدَّد من «سداد المكتب» — والذهب لنا عنده من الآن.</p>}
          {actions(ok, "تثبيت الشراء والإيداع", () => run(() => onHold(A.office.id, { action: "buy", karat: form.karat, weight: form.weight, price: form.pricePerGram, source: form.pay })))}
        </Card>
      );
    }
    if (form.kind === "withdraw" || form.kind === "toSupplier") {
      const have = holdOf(Number(form.karat));
      const sup = form.kind === "toSupplier";
      const ok = Number(form.weight) > 0 && Number(form.weight) <= have + 0.0005 && (!sup || !!form.supplierId);
      return (
        <Card style={{ padding: 13, marginBottom: 12, border: "1px solid var(--accentLine)" }} data-office-form={form.kind}>
          <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">{sup ? `سداد مورد من ذهبي عند ${A.office.name}` : `سحب من ذهبي عند ${A.office.name} إلى الخزنة`}</p>
          {sup && (
            <Field label="المورد">
              <select style={inputStyle} value={form.supplierId} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}>
                <option value="">اختر مورد…</option>
                {suppliers.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">{karatField}{weightField(sup ? "الوزن المسدَّد (جم)" : "الوزن المسحوب (جم)")}</div>
          <p style={{ color: Number(form.weight) > have + 0.0005 ? "var(--bad)" : "var(--text2)" }} className="text-[11px] mb-2">
            يعادل {wtxt(fineOf())} · عندك من عيار {form.karat} {fmtW(Math.max(0, have))} جم · يبقى {fmtW(Math.max(0, have - (Number(form.weight) || 0)))} جم
            {sup ? "" : ` — نقل أصلٍ بتكلفته (متوسّط ${fmtMoney(A.avgCost)} ${currency} للجرام 24)، لا شراء`}
          </p>
          {actions(ok, sup ? "سدّد المورد من ذهبي عنده" : "اسحب إلى الخزنة",
            () => run(() => onHold(A.office.id, { action: sup ? "to_supplier" : "withdraw", karat: form.karat, weight: form.weight, supplierId: form.supplierId })))}
        </Card>
      );
    }
    // سداد المكتب: نقدًا (عامًّا بسعر اليوم أو لشراءٍ آجلٍ بعينه) أو ذهبًا من الخزنة
    const forTx = deferredOpen.find((x) => x.id === form.forTxId);
    const fineEq = form.mode === "gold" ? fineOf()
      : forTx ? (forTx.owedAmount > 0 ? forTx.owedDelta * (Number(form.amount) || 0) / forTx.owedAmount : 0)
      : (price24 > 0 ? (Number(form.amount) || 0) / price24 : 0);
    const cap = forTx ? forTx.openAmount : A.owedAmount > 0 ? A.owedAmount : A.owedFine * price24;
    const ok = form.mode === "gold" ? Number(form.weight) > 0
      : Number(form.amount) > 0 && (forTx || price24 > 0) && Number(form.amount) <= cap + 0.005;
    return (
      <Card style={{ padding: 13, marginBottom: 12, border: "1px solid var(--accentLine)" }} data-office-form="pay">
        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">سداد المكتب {A.office.name}</p>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {[["cash", "نقد الخزنة"], ["network", "شبكة / تحويل"], ["gold", "ذهبًا من الخزنة"]].map(([id, l]) => btn(l, form.mode === id, () => setForm((f) => ({ ...f, mode: id }))))}
        </div>
        {form.mode === "gold" ? (
          <div className="grid grid-cols-2 gap-2">{karatField}{weightField()}</div>
        ) : (
          <>
            <Field label={`المبلغ (${currency}) — عليك له ${fmtMoney(cap)}`}>
              <NumericInput value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} placeholder={fmtMoney(cap)} />
            </Field>
            {deferredOpen.length > 0 && (
              <Field label="سدادُ شراءٍ آجلٍ بعينه (اختياري)">
                <select style={inputStyle} value={form.forTxId} data-office-for-tx onChange={(e) => setForm((f) => ({ ...f, forTxId: e.target.value }))}>
                  <option value="">عامّ — يُطفئ ما يعادل المبلغ بسعر اليوم</option>
                  {deferredOpen.map((t) => <option key={t.owedRowId} value={t.id}>{String(t.date).slice(0, 10)} · {wtxt(t.owedDelta)} · باقٍ {fmtMoney(t.openAmount)}</option>)}
                </select>
              </Field>
            )}
          </>
        )}
        <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">⚖ يُطفئ من التزامك {wtxt(fineEq)} · يبقى {wtxt(Math.max(0, A.owedFine - fineEq))}</p>
        {actions(ok, "تثبيت السداد", () => run(() => onSettle(A.office.id, {
          mode: form.mode === "gold" ? "gold" : "cash", karat: form.karat, weight: form.weight, amount: form.amount,
          source: form.mode === "network" ? "safe_network" : "safe_cash", forTxId: forTx ? forTx.owedRowId : null,
        })))}
      </Card>
    );
  };

  return (
    <div>
      <SubPageHeader title={A ? A.office.name : "مكاتب التسكير"} onBack={A ? () => { setPick(null); setForm(null); } : onBack} />
      <div className="px-4 pt-3">
        {!A ? (
          <>
            <Card style={{ padding: 12, marginBottom: 12 }} data-offices-summary>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p style={{ color: "var(--text2)", margin: 0 }} className="text-xs">ذهبنا عند المكاتب</p>
                  <p style={{ color: "var(--goodSolid)", margin: 0 }} className="text-xl font-extrabold">{fmtW(totalHeld)} جم</p>
                </div>
                <div>
                  <p style={{ color: "var(--text2)", margin: 0 }} className="text-xs">علينا للمكاتب</p>
                  <p style={{ color: totalOwed > 0.0005 ? "var(--accent)" : "var(--text3)", margin: 0 }} className="text-xl font-extrabold">{fmtW(totalOwed)} جم</p>
                </div>
              </div>
              <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                بعيار 24{price24 > 0 ? ` · ذهبنا عندها يعادل ${fmt(totalHeld * price24, 0)} ${currency} بسعر اليوم` : ""}
              </p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                ⚖ المكتب كالبنك: تشتري ذهبًا وتحفظه عنده أصلًا لك، وتسحبه متى شئت (نقلٌ لا شراء)، وتسدّد به مورديك، وتسدّد المكتب نقدًا أو آجلًا.
              </p>
            </Card>

            {canManage && (
              showNew ? (
                <Card style={{ padding: 12, marginBottom: 12 }}>
                  <Field label="اسم المكتب">
                    <input style={inputStyle} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مكتب…" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => { setShowNew(false); setNewName(""); }} className="py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
                    <button type="button" disabled={!newName.trim()} onClick={() => { onAddOffice(newName.trim()); setShowNew(false); setNewName(""); }} className="py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: newName.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: newName.trim() ? "var(--panel)" : "var(--text3)" }}>حفظ</button>
                  </div>
                </Card>
              ) : (
                <button type="button" onClick={() => setShowNew(true)} className="w-full py-2.5 rounded-xl text-xs font-bold mb-3"
                  style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>+ مكتب جديد</button>
              )
            )}

            {all.length === 0 ? (
              <EmptyState icon={<Building2 size={30} color="var(--accentText)" />} title="لا مكاتب" sub="أضف مكتب التسكير الذي تتعامل معه — ثم اشترِ ذهبًا واحفظه عنده" />
            ) : (
              <div className="flex flex-col gap-2">
                {all.map((x) => (
                  <button key={x.office.id} type="button" onClick={() => setPick(x.office.id)} className="w-full text-right" data-office-row={x.office.id}
                    data-help={`مكتب التسكير «${x.office.name}»: ذهبنا عنده وما علينا له بالصافي — اضغطه لتفتح حسابه وحركاته (شراء · سحب · سداد).`}>
                    <Card style={{ padding: 12, border: `1px solid ${x.owedFine > 0.0005 ? "var(--accentLine)" : "var(--line)"}` }}>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold flex-1">{x.office.name}</span>
                        <span style={{ color: "var(--goodSolid)" }} className="text-[11px]">عندنا {wtxt(x.heldFine)}</span>
                        <span style={{ color: x.owedFine > 0.0005 ? "var(--accent)" : "var(--text3)" }} className="text-[11px]">علينا {wtxt(x.owedFine)}</span>
                        <ChevronLeft size={15} color="var(--text3)" style={{ transform: "rotate(180deg)" }} />
                      </div>
                      <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">{x.count} حركة{x.office.ref ? ` · ${x.office.ref}` : ""}</p>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Card style={{ padding: 12, marginBottom: 12 }} data-office-account={A.office.id} data-held={fmtW(A.heldFine)} data-owed={fmtW(A.owedFine)}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p style={{ color: "var(--text2)", margin: 0 }} className="text-xs">ذهبي عنده</p>
                  <p style={{ color: "var(--goodSolid)", margin: 0 }} className="text-xl font-extrabold">{wtxt(A.heldFine)}</p>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">تكلفته {fmtMoney(A.heldCost)} {currency}{price24 > 0 && A.heldFine > 0 ? ` · بسعر اليوم ${fmt(A.heldFine * price24, 0)}` : ""}</p>
                </div>
                <div>
                  <p style={{ color: "var(--text2)", margin: 0 }} className="text-xs">علينا له</p>
                  <p style={{ color: A.owedFine > 0.0005 ? "var(--accent)" : "var(--text3)", margin: 0 }} className="text-xl font-extrabold">{wtxt(A.owedFine)}</p>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">{A.owedAmount > 0 ? `${fmtMoney(A.owedAmount)} ${currency}` : A.owedFine > 0.0005 && price24 > 0 ? `يعادل ${fmt(A.owedFine * price24, 2)} ${currency} بسعر اليوم` : "لا شيء"}</p>
                </div>
              </div>
            </Card>

            {canManage && !form && (
              <div className="grid grid-cols-2 gap-2 mb-3" data-office-actions>
                {onHold && btn("اشترِ ذهبًا واحفظه عنده", false, () => start("buy"), { background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)", border: "none" })}
                {onHold && A.heldFine > 0 && btn("اسحب من ذهبي إلى الخزنة", false, () => start("withdraw"))}
                {onHold && A.heldFine > 0 && btn("سدّد موردًا من ذهبي عنده", false, () => start("toSupplier"))}
                {A.owedFine > 0.0005 && btn("سدّد المكتب", false, () => start("pay"))}
              </div>
            )}
            {canManage && renderForm()}

            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">كشف الحساب ({A.count})</p>
            {A.lines.length === 0 ? (
              <Card style={{ padding: 11 }}><p style={{ color: "var(--text3)" }} className="text-[11px]">لا حركات بعد</p></Card>
            ) : (
              <div className="flex flex-col gap-2" data-office-statement>
                {A.lines.map((t) => (
                  <Card key={t.id} style={{ padding: 10 }} data-office-tx={t.kind}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[11px]">{t.ref || "—"}</span>
                      <span style={{ color: "var(--text)" }} className="text-xs flex-1">{txLabel(t)}</span>
                      {t.fine > 0 && (
                        <span style={{ color: t.heldDelta > 0 || t.owedDelta < 0 ? "var(--goodSolid)" : t.heldDelta < 0 || t.owedDelta > 0 ? "var(--bad)" : "var(--text2)" }} className="text-[11px] font-bold">
                          {sym(t)}{wtxt(t.fine)}
                        </span>
                      )}
                      {t.amount > 0 && <span style={{ color: "var(--text2)" }} className="text-[11px]">{fmtMoney(t.amount)} {currency}</span>}
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                      {new Date(t.date).toLocaleDateString("en-GB")} · بعدها: عندي {wtxt(t.heldAfter)} · عليّ {wtxt(t.owedAfter)}
                      {t.pay === "deferred" && t.openAmount > 0.005 ? ` · باقٍ من ثمنه ${fmtMoney(t.openAmount)}` : ""}{t.note ? ` · ${t.note}` : ""}
                    </p>
                    {t.rawLines?.length > 1 && (
                      <p style={{ color: "var(--text3)" }} className="text-[11px]">⚖ محوَّل من {t.rawLines.map((r) => `${fmtW(r.weight)} ع${r.karat}`).join(" · ")}</p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button type="button" onClick={exportXlsx} className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}><FileSpreadsheet size={14} /> Excel</button>
          <button type="button" onClick={exportPdf} className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}><FileText size={14} /> PDF</button>
        </div>
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

export { TaskirOfficesPage };
