import React, { useEffect, useState } from "react";
import { Hammer, Plus, Scale, Trash2 } from "lucide-react";
import * as api from "../core/api.js";
import { KARATS, fmtMoney, fmtW } from "../core/money.js";
import { inputStyle, wastageSettingsOf } from "../domain/helpers.js";
import { SCALE_LINK, scaleConnect, scaleLinkWait } from "../domain/scale.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";
import { WastageReportView } from "../ui/WastageReportView.jsx";

/// الورشة كاملة: الورش موردون بعقدٍ (نسبة الهدر وأساسها)، والصرف بأكثر من وزنة، والاستلام قطعةً قطعة تُكوَّد فورًا
/// في المخزون، والبرادة لصندوق الكسر، والمردود للخزنة. عند الإقفال يُشطب المسموح وتُستحقّ الأجور، والزائد مطالبةٌ
/// على الورشة تُسوّى خصمًا أو ذهبًا مردودًا، أو تُشطب/تُبقى باعتماد. كل وزنةٍ دليلها: من الميزان أو باليد بسبب.
const STATUS = {
  open: ["عند الورشة", "var(--accent)"], received: ["استُلم جزئيًا — بانتظار الإقفال", "var(--accent)"],
  pending: ["ينتظر اعتماد الهدر", "var(--bad)"], closed: ["مُقفلة", "var(--good)"],
};
const SETTLE = { cash: "خصم نقدي (من أجورها أوّلًا)", return: "ذهب مردود", writeoff: "شطب خسارة (باعتماد)", keep: "إبقاء المطالبة (باعتماد)" };
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ""));
const btn = { background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" };
const primary = { background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" };
const soft = { background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" };

// خانة وزن: من الميزان (يُحفظ الدليل) أو باليد بسبب
function WeightField({ label, value, ev, onChange, settings, say }) {
  const [busy, setBusy] = useState(false);
  const read = async () => {
    setBusy(true);
    try {
      if (SCALE_LINK.state !== "on") { const r = await scaleConnect(settings || {}); if (!r?.ok) throw new Error(r?.why || "تعذّر الاتصال بالميزان"); }
      // قراءةٌ جديدة لا السابقة: الميزان الذي يُسأل (لا يبثّ) يبقى على آخر قراءةٍ حتى يُسأل ثانيةً
      SCALE_LINK.stable = null;
      const r = await scaleLinkWait(5000);
      const g = Number(r?.grams) || 0;
      if (!(g > 0)) throw new Error("الميزان يقرأ صفرًا — ضع الذهب ثم اقرأ");
      onChange(String(g), { source: "scale", raw: r.raw || String(g) });
    } catch (e) { say(String(e?.message || e).slice(0, 140)); } finally { setBusy(false); }
  };
  return (
    <div className="mb-2">
      <div className="flex gap-2 items-end">
        <div className="flex-1"><Field label={label}><NumericInput value={value} onChange={(v) => onChange(v, { source: "manual", reason: ev?.source === "manual" ? ev.reason || "" : "" })} placeholder="0.000" /></Field></div>
        <button type="button" onClick={read} disabled={busy} data-scale-read={label} className="mb-3 px-3 py-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1"
          style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}><Scale size={13} /> {busy ? "…" : "من الميزان"}</button>
      </div>
      {ev?.source === "scale" && <p style={{ color: "var(--good)" }} className="text-[10px] -mt-2 mb-1">✓ من الميزان: {ev.raw}</p>}
      {ev?.source === "manual" && Number(value) > 0 && (
        <input style={{ ...inputStyle, marginBottom: 0 }} value={ev.reason || ""} placeholder="سبب الكتابة باليد (إلزامي)"
          onChange={(e) => onChange(value, { source: "manual", reason: e.target.value })} />
      )}
    </div>
  );
}

const evOk = (v, ev) => !(Number(v) > 0) || ev?.source === "scale" || (ev?.source === "manual" && String(ev.reason || "").trim().length >= 3);
// دليل الاستلام كله: من الميزان إن كانت كل وزناته منه، وإلا أوّل سببٍ مكتوب
const batchEvidence = (rows) => {
  const used = rows.filter((r) => Number(r.v) > 0);
  if (used.length && used.every((r) => r.ev?.source === "scale")) return { source: "scale", raw: used.map((r) => r.ev.raw).join(" + ").slice(0, 60) };
  const m = used.find((r) => r.ev?.source === "manual");
  return m ? { source: "manual", reason: m.ev.reason } : null;
};
const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

function WorkshopPage({ settings = null, price24 = 0, currency = "ر.س", categories = [], isManager = false, taxRate = 0, flashToast, onBack, onPending, onChanged }) {
  const [jobs, setJobs] = useState(null);
  const [shops, setShops] = useState([]);
  const [form, setForm] = useState(null);
  const [more, setMore] = useState(null);     // وزنة صرفٍ إضافية: { id, rows }
  const [recv, setRecv] = useState(null);
  const [settle, setSettle] = useState(null); // { id, kind, v, ev }
  const [terms, setTerms] = useState(null);   // تعديل عقد ورشة
  const [pay, setPay] = useState(null);       // سداد أجور
  const [msg, setMsg] = useState("");
  const [view, setView] = useState("jobs");
  const ws = wastageSettingsOf(settings || {});
  const cats = (categories || []).filter((c) => isUuid(c.id));
  const load = () => {
    api.workshopApi.list().then((d) => setJobs(d.jobs || [])).catch(() => setJobs([]));
    api.workshopApi.workshops().then((d) => setShops(d.workshops || [])).catch(() => setShops([]));
  };
  useEffect(() => { load(); }, []);
  const say = (t) => { setMsg(t); flashToast?.(t); };
  const err = (e, fb) => {
    const b = e?.body || {};
    return ({
      insufficient_safe_gold: `ذهب الخزنة الخام لا يكفي (المتاح ${fmtW(b.available || 0)} جم)`, returned_more_than_issued: "المستلم أكثر من المصروف — أعد الوزن",
      price_required: "سعر اليوم مطلوب لتقويم الهدر", ledger_setup: "فترة التجهيز — لا حركة قبل «بدء التشغيل»", category_required: "اختر تصنيف كل قطعة",
      receipt_pieces_used: `قطعٌ من هذا الاستلام بِيعت أو صُرفت أو حُجزت (${(b.codes || []).join("، ")}) — لا يُعكس`, receipt_filings_used: "البرادة خرجت من صندوق الكسر — لا يُعكس",
      amount_exceeds_owed: `المبلغ أكبر من المستحق (${fmtMoney(b.owed || 0)})`, insufficient_safe_cash: `نقد الخزنة لا يكفي (المتاح ${fmtMoney(b.available || 0)})`,
      approval_self_decided: "الهدر يعتمده غير من سجّله", nothing_received: "لم يُستلم شيءٌ بعد", job_not_open: "الأمر مُقفل",
    })[b.error] || fb;
  };
  const run = async (fn, ok, fb, changed = false) => {
    try {
      const r = await fn();
      if (r?.approvalPending) { onPending?.(r.approvalPending); say(`أُرسل للاعتماد ${r.approvalPending.ref || ""}`); }
      else say(typeof ok === "function" ? ok(r) : ok);
      if (changed) onChanged?.();
      load();
      return true;
    } catch (e) { say(err(e, fb)); return false; }
  };
  const weighings = (rows) => rows.filter((r) => Number(r.v) > 0).map((r) => ({ weight: Number(r.v), evidence: r.ev }));
  const rowsOk = (rows) => rows.some((r) => Number(r.v) > 0) && rows.every((r) => evOk(r.v, r.ev));

  const issue = () => run(
    () => api.workshopApi.issue({ workshopId: form.workshopId || undefined, workshopName: form.name, karat: form.karat, allowedPct: Number(form.pct) || 0, basis: form.basis, weighings: weighings(form.rows), note: form.note }),
    (r) => `صُرف ${fmtW(r.job.issuedWeight)} جم عيار ${r.job.karat} — ${r.job.ref}`, "تعذّر الصرف").then((ok) => ok && setForm(null));
  const addIssue = (j) => run(() => api.workshopApi.addIssue(j.id, { weighings: weighings(more.rows) }), `أُضيفت وزنة صرف على ${j.ref}`, "تعذّر الصرف").then((ok) => ok && setMore(null));
  const receive = (j) => {
    const pieces = recv.pieces.filter((p) => Number(p.v) > 0);
    const evidence = batchEvidence([...pieces, { v: recv.filings, ev: recv.fEv }, { v: recv.returned, ev: recv.rEv }]);
    return run(() => api.workshopApi.receipt(j.id, {
      pieces: pieces.map((p) => ({ weight: Number(p.v), stonesWeight: Number(p.stones) || 0, categoryId: p.cat })),
      filings: Number(recv.filings) || 0, returned: Number(recv.returned) || 0, feesPerGram: Number(recv.fee) || 0, vatPct: Number(recv.vatPct) || 0, price24, evidence,
    }), (r) => `استُلم على ${j.ref}${r.receipt.pieces.length ? ` — ${r.receipt.pieces.length} قطعة كُوِّدت: ${r.receipt.pieces.map((p) => p.code).join("، ")}` : ""}`, "تعذّر الاستلام", true)
      .then((ok) => ok && setRecv(null));
  };
  const reverse = (j, r) => {
    const reason = window.prompt("سبب عكس هذا الاستلام؟");
    if (!reason || reason.trim().length < 3) return;
    run(() => api.workshopApi.reverseReceipt(j.id, r.id, reason.trim()), `عُكس الاستلام — رجع الوزن «لدى الورشة»`, "تعذّر العكس", true);
  };
  const close = (j, decision) => run(() => api.workshopApi.close(j.id, { price24, decision, ...(j.status === "pending" && j.approvalId ? { approvalId: j.approvalId } : {}) }),
    (r) => `أُقفلت ${j.ref} — الهدر ${fmtW(r.wastage.wastage)} جم صافٍ${r.job.settlement ? ` · مطالبة ${fmtW(r.job.settlement.fine)} جم على الورشة` : ""}`, "تعذّر الإقفال");
  const doSettle = (j) => run(() => api.workshopApi.settle(j.id, { kind: settle.kind, price24, ...(settle.kind === "return" ? { evidence: settle.ev } : {}) }),
    `سُوّيت مطالبة ${j.ref} — ${SETTLE[settle.kind]}`, "تعذّر التسوية").then((ok) => ok && setSettle(null));
  const saveTerms = () => run(() => api.workshopApi.setWorkshop(terms.id, { workshop: terms.workshop, allowPct: terms.pct === "" ? null : Number(terms.pct), basis: terms.basis }),
    "حُفظ عقد الورشة", "تعذّر الحفظ").then((ok) => ok && setTerms(null));
  const payFees = () => run(() => api.workshopApi.payFees({ workshopId: pay.id, amount: Number(pay.amount), method: pay.method }),
    (r) => `سُدِّدت الأجور — الباقي ${fmtMoney(r.owed)} ${currency}`, "تعذّر السداد").then((ok) => ok && setPay(null));

  const workshops = shops.filter((s) => s.workshop);
  const claims = (jobs || []).filter((j) => j.settlement?.kind === "claim" && !j.settlement.settledAt);
  const aged = claims.filter((j) => daysSince(j.settlement.openedAt) > ws.claimDays);
  const newForm = () => {
    const w = workshops[0];
    setForm({ workshopId: w?.id || "", name: "", karat: 21, pct: String(w?.allowPct ?? ws.defaultAllowPct), basis: w?.basis || "in", rows: [{ v: "", ev: null }], note: "" });
  };
  const pickShop = (id) => {
    const w = workshops.find((x) => x.id === id);
    setForm((f) => ({ ...f, workshopId: id, pct: String(w?.allowPct ?? ws.defaultAllowPct), basis: w?.basis || "in" }));
  };
  // دالةٌ لا مكوّن: مكوّنٌ معرَّفٌ داخل الصفحة يُعاد تركيبه كل رسم فتفقد الخانة تركيزها
  const weighRows = (rows, set, label) => (
    <>
      {rows.map((r, i) => (
        <WeightField key={i} label={`${label} ${rows.length > 1 ? i + 1 : ""} (جم)`} value={r.v} ev={r.ev} settings={settings} say={say}
          onChange={(v, ev) => set(rows.map((x, k) => (k === i ? { v, ev } : x)))} />
      ))}
      <button type="button" data-workshop-add-weighing onClick={() => set([...rows, { v: "", ev: null }])} className="text-[11px] font-bold mb-2 flex items-center gap-1" style={{ color: "var(--accent)" }}>
        <Plus size={12} /> وزنة أخرى
      </button>
    </>
  );

  return (
    <div className="pb-24">
      <SubPageHeader title="الورشة" onBack={onBack} />
      <div className="px-4 pt-3" data-workshop>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {[["jobs", "الأوامر والورش"], ["report", "تقرير الهدر"]].map(([id, l]) => (
            <button key={id} type="button" data-workshop-view={id} onClick={() => setView(id)} className="py-2 rounded-xl text-[11px] font-bold" style={view === id ? soft : btn}>{l}</button>
          ))}
        </div>
        {view === "report" ? <WastageReportView currency={currency} /> : (<>
        <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">اصرف خامًا للورشة بوزنه، واستلم القطع قطعةً قطعة فتُكوَّد فورًا، والبرادة لصندوق الكسر — الهدر بالصافي، والزائد على العقد مطالبةٌ على الورشة.</p>
        {!(price24 > 0) && <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">ضع سعر الذهب اليوم — القطع والهدر يُقوَّمان به.</p>}
        {msg && <p data-workshop-msg style={{ color: "var(--accentText)" }} className="text-[11px] mb-2">{msg}</p>}

        {claims.length > 0 && (
          <Card style={{ padding: 12, marginBottom: 12, border: aged.length ? "1px solid var(--bad)" : undefined }}>
            <p data-workshop-claims style={{ color: aged.length ? "var(--bad)" : "var(--text)" }} className="text-xs font-bold">
              مطالبات مفتوحة على الورش: {claims.length} · {fmtW(claims.reduce((s, j) => s + Number(j.settlement.fine), 0))} جم صافٍ
              {aged.length ? ` · ${aged.length} تجاوزت ${ws.claimDays} يومًا` : ""}
            </p>
          </Card>
        )}

        {/* الورش وعقودها وأجورها المستحقة */}
        <Card style={{ padding: 12, marginBottom: 12 }}>
          <p style={{ color: "var(--text)" }} className="text-xs font-bold mb-2">الورش</p>
          {shops.length === 0 && <p style={{ color: "var(--text3)" }} className="text-[11px]">أضف الورشة موردًا أولًا من «الموردون»، ثم علّمها ورشةً هنا.</p>}
          {shops.filter((s) => s.workshop || isManager).map((s) => (
            <div key={s.id} data-workshop-shop={s.name} className="py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="flex items-center justify-between gap-2">
                <span style={{ color: s.workshop ? "var(--text)" : "var(--text3)" }} className="text-[12px] font-bold">{s.name}</span>
                <span style={{ color: "var(--text2)" }} className="text-[11px]">
                  {s.workshop ? `هدر ${s.allowPct ?? ws.defaultAllowPct}٪ ${s.basis === "out" ? "من المشغول" : "من المصروف"}${s.allowPct == null ? " (الافتراضي)" : ""}` : "ليست ورشة"}
                  {s.feesOwed > 0 ? ` · أجور مستحقة ${fmtMoney(s.feesOwed)} ${currency}` : ""}
                </span>
              </div>
              {isManager && terms?.id !== s.id && pay?.id !== s.id && (
                <div className="flex gap-3 mt-1">
                  <button type="button" data-workshop-terms={s.name} onClick={() => setTerms({ id: s.id, workshop: true, pct: s.allowPct == null ? "" : String(s.allowPct), basis: s.basis })} className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>{s.workshop ? "العقد" : "علّمها ورشة"}</button>
                  {s.workshop && <button type="button" onClick={() => run(() => api.workshopApi.setWorkshop(s.id, { workshop: false }), "أُلغيت كورشة", "تعذّر")} className="text-[11px]" style={{ color: "var(--text3)" }}>ليست ورشة</button>}
                  {s.feesOwed > 0 && <button type="button" data-workshop-pay={s.name} onClick={() => setPay({ id: s.id, amount: String(s.feesOwed), method: "cash" })} className="text-[11px] font-bold" style={{ color: "var(--good)" }}>سداد الأجور</button>}
                </div>
              )}
              {terms?.id === s.id && (
                <div className="mt-2">
                  <Field label="نسبة الهدر المسموحة ٪ (فارغ = الافتراضي)"><NumericInput value={terms.pct} onChange={(v) => setTerms((t) => ({ ...t, pct: v }))} /></Field>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {[["in", "من المصروف"], ["out", "من المشغول"]].map(([id, l]) => (
                      <button key={id} type="button" onClick={() => setTerms((t) => ({ ...t, basis: id }))} className="py-1.5 rounded-xl text-[11px] font-bold"
                        style={terms.basis === id ? soft : btn}>النسبة {l}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setTerms(null)} className="py-2 rounded-xl text-xs font-bold" style={btn}>إلغاء</button>
                    <button type="button" data-workshop-terms-save onClick={saveTerms} className="py-2 rounded-xl text-xs font-bold" style={primary}>حفظ العقد</button>
                  </div>
                </div>
              )}
              {pay?.id === s.id && (
                <div className="mt-2">
                  <Field label={`المبلغ (${currency})`}><NumericInput value={pay.amount} onChange={(v) => setPay((p) => ({ ...p, amount: v }))} /></Field>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {[["cash", "نقد الخزنة"], ["network", "شبكة / تحويل"]].map(([id, l]) => (
                      <button key={id} type="button" onClick={() => setPay((p) => ({ ...p, method: id }))} className="py-1.5 rounded-xl text-[11px] font-bold" style={pay.method === id ? soft : btn}>{l}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setPay(null)} className="py-2 rounded-xl text-xs font-bold" style={btn}>إلغاء</button>
                    <button type="button" data-workshop-pay-save disabled={!(Number(pay.amount) > 0)} onClick={payFees} className="py-2 rounded-xl text-xs font-bold" style={primary}>سداد</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </Card>

        {/* صرفٌ جديد بأكثر من وزنة */}
        {!form ? (
          <button type="button" data-workshop-new onClick={newForm} className="w-full py-2.5 rounded-xl text-xs font-bold mb-3 flex items-center justify-center gap-1.5" style={primary}>
            <Hammer size={14} /> صرف للورشة
          </button>
        ) : (
          <Card style={{ padding: 12, marginBottom: 12 }}>
            {workshops.length > 0 ? (
              <Field label="الورشة">
                <select style={inputStyle} value={form.workshopId} data-workshop-pick onChange={(e) => pickShop(e.target.value)}>
                  {workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  <option value="">ورشة غير مسجّلة…</option>
                </select>
              </Field>
            ) : null}
            {!form.workshopId && <Field label="اسم الورشة"><input style={inputStyle} value={form.name} data-workshop-name onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>}
            <div className="grid grid-cols-2 gap-2">
              <Field label="العيار"><select style={inputStyle} value={form.karat} onChange={(e) => setForm((f) => ({ ...f, karat: Number(e.target.value) }))}>{KARATS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
              {form.workshopId
                ? <Field label="الهدر المسموح (من العقد)"><input style={{ ...inputStyle, opacity: 0.7 }} readOnly value={`${form.pct}٪ ${form.basis === "out" ? "من المشغول" : "من المصروف"}`} /></Field>
                : <Field label="نسبة الهدر المسموحة ٪"><NumericInput value={form.pct} onChange={(v) => setForm((f) => ({ ...f, pct: v }))} /></Field>}
            </div>
            {!form.workshopId && (
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {[["in", "من المصروف"], ["out", "من المشغول"]].map(([id, l]) => (
                  <button key={id} type="button" onClick={() => setForm((f) => ({ ...f, basis: id }))} className="py-1.5 rounded-xl text-[11px] font-bold" style={form.basis === id ? soft : btn}>النسبة {l}</button>
                ))}
              </div>
            )}
            {weighRows(form.rows, (rows) => setForm((f) => ({ ...f, rows })), "وزنة الصرف")}
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">المجموع {fmtW(form.rows.reduce((s, r) => s + (Number(r.v) || 0), 0))} جم</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm(null)} className="py-2.5 rounded-xl text-xs font-bold" style={btn}>إلغاء</button>
              <button type="button" data-workshop-issue disabled={(!form.workshopId && !form.name.trim()) || !rowsOk(form.rows)} onClick={issue} className="py-2.5 rounded-xl text-xs font-bold"
                style={{ ...primary, opacity: (!form.workshopId && !form.name.trim()) || !rowsOk(form.rows) ? 0.5 : 1 }}>صرف</button>
            </div>
          </Card>
        )}

        {(jobs || []).map((j) => {
          const [label, tone] = STATUS[j.status] || STATUS.open;
          const c = j.calc || {};
          const live = (j.receipts || []).filter((r) => !r.reversedAt);
          const claimOpen = j.settlement?.kind === "claim" && !j.settlement.settledAt;
          const canWork = j.status === "open" || j.status === "received";
          const excess = Math.max(0, c.wastage - c.allowed - c.noise);
          return (
            <Card key={j.id} style={{ padding: 12, marginBottom: 8 }}>
              <div data-workshop-job={j.ref} className="flex items-center justify-between gap-2">
                <span style={{ color: "var(--text)" }} className="text-xs font-bold">{j.ref} · {j.workshopName}</span>
                <span style={{ color: claimOpen ? "var(--bad)" : tone }} className="text-[11px] font-bold">{claimOpen ? "مطالبة مفتوحة" : label}</span>
              </div>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                صُرف {fmtW(c.issued)} جم عيار {j.karat} في {(j.issues || []).length} وزنة · مسموح {j.allowedPct}٪ {j.basis === "out" ? "من المشغول" : "من المصروف"}
              </p>
              {live.length > 0 && (
                <p data-workshop-calc style={{ color: "var(--text2)" }} className="text-[11px]">
                  قطع {c.count} ({fmtW(c.pieces)} جم صافٍ) · برادة {fmtW(c.filings)} · مردود {fmtW(c.returned)} · الهدر {fmtW(c.wastage)} جم صافٍ (المسموح {fmtW(c.allowed)})
                  {c.fees > 0 ? ` · أجور ${fmtMoney(c.fees)}${c.vat > 0 ? ` + ضريبة ${fmtMoney(c.vat)}` : ""}` : ""}
                </p>
              )}
              {claimOpen && (
                <p style={{ color: daysSince(j.settlement.openedAt) > ws.claimDays ? "var(--bad)" : "var(--text2)" }} className="text-[11px]">
                  مطالبة {fmtW(j.settlement.fine)} جم صافٍ على الورشة · منذ {daysSince(j.settlement.openedAt)} يوم{price24 > 0 ? ` · ≈ ${fmtMoney(j.settlement.fine * price24)} ${currency}` : ""}
                </p>
              )}
              {j.settlement?.settledAt && <p style={{ color: "var(--good)" }} className="text-[11px]">سُوّيت المطالبة: {SETTLE[j.settlement.settledKind]}</p>}

              {/* سجلّ الاستلامات مع العكس */}
              {(j.receipts || []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 mt-1" data-workshop-receipt>
                  <span style={{ color: r.reversedAt ? "var(--text3)" : "var(--text2)", textDecoration: r.reversedAt ? "line-through" : "none" }} className="text-[10px]">
                    {new Date(r.at).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn")} · {r.pieces.length} قطعة{r.filings > 0 ? ` · برادة ${fmtW(r.filings)}` : ""}{r.returned > 0 ? ` · مردود ${fmtW(r.returned)}` : ""}
                    {r.reversedAt ? ` · معكوس: ${r.reverseReason}` : ""}
                  </span>
                  {!r.reversedAt && canWork && <button type="button" data-workshop-reverse onClick={() => reverse(j, r)} className="text-[10px]" style={{ color: "var(--bad)" }}><Trash2 size={11} /></button>}
                </div>
              ))}

              {canWork && !recv && !more && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button type="button" data-workshop-more={j.ref} onClick={() => setMore({ id: j.id, rows: [{ v: "", ev: null }] })} className="py-2 rounded-xl text-xs font-bold" style={btn}>صرف إضافي</button>
                  <button type="button" data-workshop-receive-open={j.ref} onClick={() => setRecv({ id: j.id, pieces: [{ v: "", ev: null, stones: "", cat: cats[0]?.id || "" }], filings: "", fEv: null, returned: "", rEv: null, fee: "", vatPct: String(Math.round((Number(taxRate) || 0) * 100)) })}
                    className="py-2 rounded-xl text-xs font-bold" style={soft}>استلام</button>
                </div>
              )}
              {more?.id === j.id && (
                <div className="mt-2">
                  {weighRows(more.rows, (rows) => setMore((m) => ({ ...m, rows })), "وزنة الصرف")}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setMore(null)} className="py-2 rounded-xl text-xs font-bold" style={btn}>إلغاء</button>
                    <button type="button" data-workshop-more-save disabled={!rowsOk(more.rows)} onClick={() => addIssue(j)} className="py-2 rounded-xl text-xs font-bold" style={primary}>صرف</button>
                  </div>
                </div>
              )}
              {recv?.id === j.id && (
                <div className="mt-2" data-workshop-receive-form>
                  {recv.pieces.map((p, i) => (
                    <div key={i} className="mb-1" style={{ borderBottom: "1px dashed var(--line)" }}>
                      <WeightField label={`القطعة ${i + 1} (جم)`} value={p.v} ev={p.ev} settings={settings} say={say}
                        onChange={(v, ev) => setRecv((r) => ({ ...r, pieces: r.pieces.map((x, k) => (k === i ? { ...x, v, ev } : x)) }))} />
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="التصنيف">
                          <select style={inputStyle} value={p.cat} data-workshop-piece-cat onChange={(e) => setRecv((r) => ({ ...r, pieces: r.pieces.map((x, k) => (k === i ? { ...x, cat: e.target.value } : x)) }))}>
                            <option value="">—</option>
                            {cats.map((c2) => <option key={c2.id} value={c2.id}>{c2.label || c2.name}</option>)}
                          </select>
                        </Field>
                        <Field label="أحجار (جم)"><NumericInput value={p.stones} onChange={(v) => setRecv((r) => ({ ...r, pieces: r.pieces.map((x, k) => (k === i ? { ...x, stones: v } : x)) }))} /></Field>
                      </div>
                    </div>
                  ))}
                  <button type="button" data-workshop-add-piece onClick={() => setRecv((r) => ({ ...r, pieces: [...r.pieces, { v: "", ev: null, stones: "", cat: r.pieces[r.pieces.length - 1]?.cat || "" }] }))}
                    className="text-[11px] font-bold mb-2 flex items-center gap-1" style={{ color: "var(--accent)" }}><Plus size={12} /> قطعة أخرى</button>
                  <WeightField label="البرادة (جم) — لصندوق الكسر" value={recv.filings} ev={recv.fEv} settings={settings} say={say} onChange={(v, ev) => setRecv((r) => ({ ...r, filings: v, fEv: ev }))} />
                  <WeightField label="المردود خامًا (جم)" value={recv.returned} ev={recv.rEv} settings={settings} say={say} onChange={(v, ev) => setRecv((r) => ({ ...r, returned: v, rEv: ev }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={`أجرة الجرام (${currency})`}><NumericInput value={recv.fee} onChange={(v) => setRecv((r) => ({ ...r, fee: v }))} /></Field>
                    <Field label="ضريبة الأجور ٪"><NumericInput value={recv.vatPct} onChange={(v) => setRecv((r) => ({ ...r, vatPct: v }))} /></Field>
                  </div>
                  {(() => {
                    const pieces = recv.pieces.filter((p) => Number(p.v) > 0);
                    const ok = (pieces.length || Number(recv.filings) > 0 || Number(recv.returned) > 0)
                      && pieces.every((p) => p.cat && evOk(p.v, p.ev) && (Number(p.stones) || 0) < Number(p.v)) && evOk(recv.filings, recv.fEv) && evOk(recv.returned, recv.rEv)
                      && (!pieces.length || price24 > 0);
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setRecv(null)} className="py-2.5 rounded-xl text-xs font-bold" style={btn}>إلغاء</button>
                        <button type="button" data-workshop-receive disabled={!ok} onClick={() => receive(j)} className="py-2.5 rounded-xl text-xs font-bold" style={{ ...primary, opacity: ok ? 1 : 0.5 }}>استلام وتكويد</button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* الإقفال: المسموح يُشطب، والزائد مطالبةٌ أو شطبٌ باعتماد */}
              {(j.status === "received" || j.status === "pending") && !recv && !more && (
                <div className="mt-2">
                  {excess > 0.0005 && <p data-workshop-excess style={{ color: "var(--bad)" }} className="text-[11px] mb-1">الهدر فوق المسموح بـ{fmtW(excess)} جم صافٍ{price24 > 0 ? ` (≈ ${fmtMoney(excess * price24)} ${currency})` : ""}</p>}
                  {j.status === "pending" ? (
                    <button type="button" data-workshop-close-approved onClick={() => close(j, "writeoff")} className="w-full py-2 rounded-xl text-xs font-bold" style={primary}>إقفال بعد الاعتماد</button>
                  ) : excess > 0.0005 ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" data-workshop-close-claim onClick={() => close(j, "claim")} className="py-2 rounded-xl text-xs font-bold" style={primary}>إقفال ومطالبة الورشة</button>
                      <button type="button" data-workshop-close-writeoff onClick={() => close(j, "writeoff")} className="py-2 rounded-xl text-xs font-bold" style={btn}>شطب الزائد (اعتماد)</button>
                    </div>
                  ) : (
                    <button type="button" data-workshop-close onClick={() => close(j, "claim")} className="w-full py-2 rounded-xl text-xs font-bold" style={primary}>إقفال الأمر</button>
                  )}
                </div>
              )}

              {/* تسوية المطالبة */}
              {claimOpen && settle?.id !== j.id && (
                <button type="button" data-workshop-settle-open={j.ref} onClick={() => setSettle({ id: j.id, kind: "cash", v: "", ev: null })} className="w-full mt-2 py-2 rounded-xl text-xs font-bold" style={soft}>تسوية المطالبة</button>
              )}
              {settle?.id === j.id && (
                <div className="mt-2">
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {Object.entries(SETTLE).map(([id, l]) => (
                      <button key={id} type="button" data-workshop-settle-kind={id} onClick={() => setSettle((s) => ({ ...s, kind: id }))} className="py-1.5 rounded-xl text-[11px] font-bold" style={settle.kind === id ? soft : btn}>{l}</button>
                    ))}
                  </div>
                  {settle.kind === "return" && (
                    <WeightField label={`الذهب المردود (≈ ${fmtW(j.settlement.fine / ({ 24: 1, 22: 22 / 24, 21: 0.875, 18: 0.75, 14: 14 / 24 }[j.karat] || 1))} جم)`} value={settle.v} ev={settle.ev}
                      settings={settings} say={say} onChange={(v, ev) => setSettle((s) => ({ ...s, v, ev }))} />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setSettle(null)} className="py-2 rounded-xl text-xs font-bold" style={btn}>إلغاء</button>
                    <button type="button" data-workshop-settle disabled={settle.kind === "return" ? !(Number(settle.v) > 0 && evOk(settle.v, settle.ev)) : settle.kind !== "keep" && !(price24 > 0)}
                      onClick={() => doSettle(j)} className="py-2 rounded-xl text-xs font-bold" style={primary}>تسوية</button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {jobs && jobs.length === 0 && !form && <p style={{ color: "var(--text3)" }} className="text-[11px]">لا عمليات ورشة بعد.</p>}
        </>)}
      </div>
    </div>
  );
}

export { WorkshopPage };
