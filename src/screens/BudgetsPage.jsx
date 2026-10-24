import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fmtMoney } from "../core/money.js";
import * as api from "../core/api.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// الموازنات (migration 060) — المخطَّط لكل حساب مصروف وإيراد مقابل الفعلي من دفتر اليومية على الخادم،
/// ومراكز التكلفة (migration 100): يُنسب المصروف إليها عند تسجيله ويُرى مجموع كلٍّ منها في الشهر
const monthOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const prevOf = (p) => { const [y, m] = p.split("-").map(Number); return monthOf(new Date(y, m - 2, 1)); };

function BudgetsPage({ currency = "ر.س", canEdit = false, onBack }) {
  const [period, setPeriod] = useState(monthOf());
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [cc, setCc] = useState("");
  const addCenter = async () => {
    const name = cc.trim();
    if (name.length < 2 || busy) return;
    setBusy(true); setMsg(null);
    try { await api.budgetsApi.addCenter(name); setCc(""); setMsg({ text: `أُضيف مركز «${name}»` }); load(period); }
    catch (e) { setMsg({ bad: true, text: e?.body?.error === "cost_center_exists" ? "اسمٌ مكرّر — المركز موجود" : "تعذّرت الإضافة" }); }
    finally { setBusy(false); }
  };
  const toggleCenter = async (c) => {
    setBusy(true); setMsg(null);
    try { await api.budgetsApi.updateCenter(c.id, { active: !c.active }); load(period); }
    catch { setMsg({ bad: true, text: "تعذّر التعديل" }); } finally { setBusy(false); }
  };
  const load = (p = period) => { setData(null); api.budgetsApi.get(p).then((d) => { setData(d); setDraft({}); }).catch(() => setData({ rows: [], totals: {} })); };
  useEffect(() => { load(period); }, [period]);
  const m = (v) => `${fmtMoney(v)} ${currency}`;
  const dirty = Object.keys(draft).length > 0;
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const d = await api.budgetsApi.save(period, Object.entries(draft).map(([account, v]) => ({ account, amount: Number(v) || 0 })));
      setData(d); setDraft({}); setMsg({ text: "حُفظت الموازنة" });
    } catch { setMsg({ bad: true, text: "تعذّر الحفظ" }); } finally { setBusy(false); }
  };
  const copy = async () => {
    setBusy(true); setMsg(null);
    try { const d = await api.budgetsApi.copy(prevOf(period), period); setData(d); setDraft({}); setMsg({ text: d.copied ? `نُسخ ${d.copied} سطرًا من ${prevOf(period)}` : `لا موازنة في ${prevOf(period)} أو كُتبت هنا مسبقًا` }); }
    catch { setMsg({ bad: true, text: "تعذّر النسخ" }); } finally { setBusy(false); }
  };
  const rows = (data?.rows || []).filter((r) => showAll || r.planned != null || r.actual !== 0 || draft[r.account] != null);
  const exp = rows.filter((r) => r.nature === "debit"), inc = rows.filter((r) => r.nature === "credit");
  const t = data?.totals || {};
  const Row = (r) => {
    const planned = draft[r.account] ?? (r.planned ?? "");
    const pct = r.planned > 0 ? Math.round((r.actual / r.planned) * 100) : null;
    return (
      <Card key={r.account} style={{ padding: 10, marginBottom: 6, border: `1px solid ${r.over ? "var(--badLine)" : "var(--line)"}` }}>
        <div className="flex items-center justify-between gap-2">
          <span style={{ color: "var(--text)" }} className="text-[12px] font-bold">{r.account} {r.name}</span>
          {canEdit
            ? <div style={{ width: 110 }}><NumericInput value={String(planned)} placeholder="المخطَّط" onChange={(v) => setDraft((d) => ({ ...d, [r.account]: v }))} /></div>
            : <span className="text-[11px]" style={{ color: "var(--text2)" }}>{r.planned != null ? m(r.planned) : "—"}</span>}
        </div>
        <p style={{ color: r.over ? "var(--bad)" : "var(--text3)", margin: "2px 0 0" }} className="text-[11px]">
          الفعلي {m(r.actual)}{pct != null ? ` · ${pct}٪` : ""}{r.over ? (r.nature === "debit" ? " — تجاوز" : " — دون المستهدف") : ""}
        </p>
        {pct != null && (
          <div style={{ height: 5, background: "var(--field)", borderRadius: 3, marginTop: 3 }}>
            <div style={{ width: `${Math.min(100, pct)}%`, height: 5, borderRadius: 3, background: r.over ? "var(--bad)" : "var(--goodSolid, var(--good))" }} />
          </div>
        )}
      </Card>
    );
  };
  return (
    <div className="pb-24">
      <SubPageHeader title="الموازنات ومراكز التكلفة" onBack={onBack} />
      <div className="px-4 pt-3">
        <Card style={{ padding: 12, marginBottom: 10 }}>
          <div className="flex gap-2 items-center mb-2">
            <input type="month" style={{ ...inputStyle, marginBottom: 0 }} value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
            {canEdit && <button onClick={copy} disabled={busy} className="px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap" style={{ background: "var(--field)", color: "var(--accent)", border: "1px solid var(--line)" }}>انسخ {prevOf(period)}</button>}
          </div>
          <div className="flex justify-between text-xs" style={{ color: "var(--text2)" }}><span>مصروفٌ مخطَّط</span><b style={{ color: "var(--text)" }}>{m(t.plannedExpense || 0)}</b></div>
          <div className="flex justify-between text-xs" style={{ color: "var(--text2)" }}><span>الفعلي منه</span><b style={{ color: "var(--text)" }}>{m(t.actualExpense || 0)}</b></div>
          <div className="flex justify-between text-xs" style={{ color: "var(--text2)" }}>
            <span>{(t.actualExpense || 0) > (t.plannedExpense || 0) ? "تجاوز" : "المتبقي"}</span>
            <b style={{ color: (t.actualExpense || 0) > (t.plannedExpense || 0) ? "var(--bad)" : "var(--good)" }}>{m(Math.abs((t.plannedExpense || 0) - (t.actualExpense || 0)))}</b>
          </div>
          {t.overCount > 0 && <p className="text-[11px] font-bold" style={{ color: "var(--bad)", margin: "4px 0 0" }}>{t.overCount} حساب خارج الموازنة</p>}
        </Card>
        {msg && <p className="text-xs font-bold mb-2" style={{ color: msg.bad ? "var(--bad)" : "var(--good)" }}>{msg.text}</p>}
        {!data ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" size={20} color="var(--accent)" /></div> : (
          <>
            <label className="flex items-center gap-2 text-[11px] mb-2" style={{ color: "var(--text2)" }}>
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> اعرض كل الحسابات (لكتابة موازنةٍ لحسابٍ بلا حركة)
            </label>
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">المصروفات والتكاليف</p>
            {exp.length ? exp.map(Row) : <p className="text-[11px] mb-3" style={{ color: "var(--text3)" }}>لا حركة ولا موازنة هذا الشهر.</p>}
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-3">الإيرادات (المستهدف)</p>
            {inc.length ? inc.map(Row) : <p className="text-[11px]" style={{ color: "var(--text3)" }}>لا حركة ولا مستهدف هذا الشهر.</p>}
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-3">مراكز التكلفة — مصروفات {period}</p>
            <Card style={{ padding: 12, marginBottom: 10 }} data-cost-centers>
              {(data.byCenter || []).length === 0
                ? <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">لا مراكز بعد — أضف مركزًا (معرض، ورشة، تسويق…) ثم انسب المصروف إليه عند تسجيله.</p>
                : data.byCenter.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 py-1" style={{ borderBottom: "1px solid var(--line)", opacity: c.active ? 1 : 0.55 }}>
                    <span className="text-[12px]" style={{ color: "var(--text)" }}>{c.name}{c.active ? "" : " (موقوف)"}{c.count ? <span className="text-[10px]" style={{ color: "var(--text3)" }}> · {c.count} مصروف</span> : null}</span>
                    <span className="flex items-center gap-2">
                      <b className="text-[12px]" style={{ color: "var(--text)" }}>{m(c.amount)}</b>
                      {canEdit && (
                        <button onClick={() => toggleCenter(c)} disabled={busy} className="text-[10px] px-2 py-0.5 rounded-full"
                          data-help={c.active ? "يوقف المركز فلا يظهر في نموذج المصروف — مصروفاته السابقة تبقى منسوبةً إليه" : "يعيد المركز إلى نموذج المصروف"}
                          style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>{c.active ? "أوقف" : "أعِد"}</button>
                      )}
                    </span>
                  </div>
                ))}
              {canEdit && (
                <div className="flex gap-2 mt-2">
                  <input style={{ ...inputStyle, marginBottom: 0 }} value={cc} onChange={(e) => setCc(e.target.value)} placeholder="اسم مركزٍ جديد" aria-label="اسم مركز التكلفة" />
                  <button onClick={addCenter} disabled={busy || cc.trim().length < 2} className="px-3 rounded-xl text-[11px] font-bold"
                    style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>أضف</button>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
      {canEdit && dirty && (
        <div className="fixed bottom-20 left-0 right-0 px-4">
          <button onClick={save} disabled={busy} className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
            {busy && <Loader2 size={14} className="animate-spin" />} احفظ الموازنة ({Object.keys(draft).length})
          </button>
        </div>
      )}
    </div>
  );
}

export { BudgetsPage };
