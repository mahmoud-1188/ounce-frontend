import React, { useEffect, useState } from "react";
import { Hammer, Scale } from "lucide-react";
import * as api from "../core/api.js";
import { KARATS, fmtMoney, fmtW } from "../core/money.js";
import { inputStyle, wastageSettingsOf } from "../domain/helpers.js";
import { SCALE_LINK, scaleConnect, scaleLinkWait } from "../domain/scale.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// الورشة ونسبة الهدر من الميزان: صرفٌ موزونٌ للورشة واستلامٌ موزونٌ منها، والهدر يُحسب بالصافي وحده.
/// كل وزنةٍ دليلها: من الميزان بقراءته، أو مكتوبةٌ بسببٍ إلزامي. ما فوق المسموح يعتمده غير من سجّله.
const STATUS = { open: ["عند الورشة", "var(--accent)"], pending: ["ينتظر اعتماد الهدر", "var(--bad)"], closed: ["مُقفلة", "var(--good)"] };

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

function WorkshopPage({ settings = null, price24 = 0, currency = "ر.س", flashToast, onBack, onPending }) {
  const [jobs, setJobs] = useState(null);
  const [form, setForm] = useState(null);
  const [recv, setRecv] = useState(null);
  const [msg, setMsg] = useState("");
  const load = () => api.workshopApi.list().then((d) => setJobs(d.jobs || [])).catch(() => setJobs([]));
  useEffect(() => { load(); }, []);
  const say = (t) => { setMsg(t); flashToast?.(t); };
  const err = (e, fb) => {
    const c = e?.body?.error;
    return ({ insufficient_safe_gold: `ذهب الخزنة الخام لا يكفي (المتاح ${fmtW(e?.body?.available || 0)} جم)`, returned_more_than_issued: "المستلم أكثر من المصروف — أعد الوزن",
      price_required: "سعر اليوم مطلوب لتقويم الهدر", ledger_setup: "فترة التجهيز — لا حركة قبل «بدء التشغيل»" })[c] || fb;
  };
  const issue = async () => {
    try {
      await api.workshopApi.issue({ workshopName: form.name, karat: form.karat, weight: Number(form.weight), allowedPct: Number(form.pct) || 0, basis: form.basis, evidence: { issued: form.ev } });
      say(`صُرف ${fmtW(Number(form.weight))} جم عيار ${form.karat} للورشة ${form.name}`); setForm(null); load();
    } catch (e) { say(err(e, "تعذّر الصرف")); }
  };
  const receive = async (j, approvalId = null) => {
    try {
      const r = await api.workshopApi.receive(j.id, { workedWeight: Number(recv.worked) || 0, returnedWeight: Number(recv.returned) || 0, price24, evidence: { worked: recv.wEv, returned: recv.rEv }, ...(approvalId ? { approvalId } : {}) });
      if (r?.approvalPending) { onPending?.(r.approvalPending); say(`الهدر فوق المسموح بـ${fmtW(r.wastage.excess)} جم — أُرسل للاعتماد ${r.approvalPending.ref}`); }
      else say(`أُقفلت ${j.ref} — الهدر ${fmtW(r.wastage.wastage)} جم صافٍ (المسموح ${fmtW(r.wastage.allowed)})`);
      setRecv(null); load();
    } catch (e) { say(err(e, "تعذّر الاستلام")); }
  };
  const preview = (j) => {
    if (!recv) return null;
    const p = { 24: 1, 22: 22 / 24, 21: 0.875, 18: 0.75, 14: 14 / 24 }[j.karat] || j.karat / 24;
    const issued = j.issuedWeight * p, worked = (Number(recv.worked) || 0) * p, back = (Number(recv.returned) || 0) * p;
    const wastage = issued - worked - back, allowed = (j.basis === "out" ? worked : issued) * j.allowedPct / 100;
    const excess = wastage - allowed - 0.03 * p;
    return { wastage, allowed, excess: excess > 0.0005 ? excess : 0 };
  };
  return (
    <div className="pb-24">
      <SubPageHeader title="الورشة" onBack={onBack} />
      <div className="px-4 pt-3" data-workshop>
        <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">اصرف ذهبًا خامًا للورشة بوزنه، واستلم المشغول والمردود بوزنهما — الهدر يُحسب بالصافي، وما فوق نسبة العقد يعتمده غيرك.</p>
        {!(price24 > 0) && <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">ضع سعر الذهب اليوم — الهدر يُقوَّم به عند الاستلام.</p>}
        {msg && <p style={{ color: "var(--accentText)" }} className="text-[11px] mb-2">{msg}</p>}
        {!form ? (
          <button type="button" data-workshop-new onClick={() => setForm({ name: "", karat: 21, weight: "", pct: String(wastageSettingsOf(settings || {}).defaultAllowPct), basis: "in", ev: null })} className="w-full py-2.5 rounded-xl text-xs font-bold mb-3 flex items-center justify-center gap-1.5"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}><Hammer size={14} /> صرف للورشة</button>
        ) : (
          <Card style={{ padding: 12, marginBottom: 12 }}>
            <Field label="الورشة"><input style={inputStyle} value={form.name} data-workshop-name onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="العيار"><select style={inputStyle} value={form.karat} onChange={(e) => setForm((f) => ({ ...f, karat: Number(e.target.value) }))}>{KARATS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
              <Field label="نسبة الهدر المسموحة ٪"><NumericInput value={form.pct} onChange={(v) => setForm((f) => ({ ...f, pct: v }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {[["in", "من المصروف"], ["out", "من المشغول"]].map(([id, l]) => (
                <button key={id} type="button" onClick={() => setForm((f) => ({ ...f, basis: id }))} className="py-1.5 rounded-xl text-[11px] font-bold"
                  style={{ background: form.basis === id ? "var(--accentBg)" : "var(--panel)", color: form.basis === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>النسبة {l}</button>
              ))}
            </div>
            <WeightField label="الوزن المصروف (جم)" value={form.weight} ev={form.ev} settings={settings} say={say} onChange={(v, ev) => setForm((f) => ({ ...f, weight: v, ev }))} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm(null)} className="py-2.5 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
              <button type="button" data-workshop-issue disabled={!form.name.trim() || !(Number(form.weight) > 0) || !evOk(form.weight, form.ev)} onClick={issue} className="py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)", opacity: !form.name.trim() || !(Number(form.weight) > 0) || !evOk(form.weight, form.ev) ? 0.5 : 1 }}>صرف</button>
            </div>
          </Card>
        )}
        {(jobs || []).map((j) => {
          const [label, tone] = STATUS[j.status] || STATUS.open;
          const pv = recv?.id === j.id ? preview(j) : null;
          return (
            <Card key={j.id} style={{ padding: 12, marginBottom: 8 }}>
              <div data-workshop-job={j.ref} className="flex items-center justify-between gap-2">
                <span style={{ color: "var(--text)" }} className="text-xs font-bold">{j.ref} · {j.workshopName}</span>
                <span style={{ color: tone }} className="text-[11px] font-bold">{label}</span>
              </div>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                صُرف {fmtW(j.issuedWeight)} جم عيار {j.karat} · مسموح {j.allowedPct}٪ {j.basis === "out" ? "من المشغول" : "من المصروف"}
                {j.status === "closed" ? ` · مشغول ${fmtW(j.workedWeight || 0)} · مردود ${fmtW(j.returnedWeight || 0)} · الهدر ${fmtW(j.wastageFine || 0)} جم صافٍ${j.excessFine > 0 ? ` (زائد معتمد ${fmtW(j.excessFine)})` : ""}` : ""}
              </p>
              {j.status !== "closed" && recv?.id !== j.id && (
                <button type="button" data-workshop-receive-open={j.ref} onClick={() => setRecv({ id: j.id, worked: "", returned: "", wEv: null, rEv: null })} className="w-full mt-2 py-2 rounded-xl text-xs font-bold"
                  style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>{j.status === "pending" ? "أعد الاستلام بعد الاعتماد" : "استلام من الورشة"}</button>
              )}
              {recv?.id === j.id && (
                <div className="mt-2">
                  <WeightField label="المشغول (جم)" value={recv.worked} ev={recv.wEv} settings={settings} say={say} onChange={(v, ev) => setRecv((r) => ({ ...r, worked: v, wEv: ev }))} />
                  <WeightField label="المردود خامًا (جم)" value={recv.returned} ev={recv.rEv} settings={settings} say={say} onChange={(v, ev) => setRecv((r) => ({ ...r, returned: v, rEv: ev }))} />
                  {pv && (Number(recv.worked) > 0 || Number(recv.returned) > 0) && (
                    <p data-workshop-preview style={{ color: pv.excess > 0 ? "var(--bad)" : "var(--text2)" }} className="text-[11px] mb-2">
                      الهدر ≈ {fmtW(pv.wastage)} جم صافٍ · المسموح {fmtW(pv.allowed)}{pv.excess > 0 ? ` · زائد ${fmtW(pv.excess)} يُرسل للاعتماد` : " · ضمن المسموح"}
                      {price24 > 0 && pv.wastage > 0 ? ` · ≈ ${fmtMoney(pv.wastage * price24)} ${currency}` : ""}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setRecv(null)} className="py-2.5 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
                    <button type="button" data-workshop-receive disabled={!(Number(recv.worked) + Number(recv.returned) > 0) || !evOk(recv.worked, recv.wEv) || !evOk(recv.returned, recv.rEv)}
                      onClick={() => receive(j, j.status === "pending" ? j.approvalId : null)} className="py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>استلام وإقفال</button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {jobs && jobs.length === 0 && !form && <p style={{ color: "var(--text3)" }} className="text-[11px]">لا عمليات ورشة بعد.</p>}
      </div>
    </div>
  );
}

export { WorkshopPage };
