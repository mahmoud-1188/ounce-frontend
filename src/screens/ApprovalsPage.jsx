import React, { useState } from "react";
import { Check } from "lucide-react";
import { APPROVAL_RULES, APPROVAL_STATUS } from "../core/erp.js";
import { fmtMoney } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// الاعتمادات — الطلبات فوق الحدّ: من طلب، كم، لماذا، ومن يعتمد.
///
/// المدير يقرّر؛ والمعتمَد يُنفَّذ فورًا بحمولته مرةً واحدة (الخادم يختم
/// التنفيذ في معاملته)، والمرفوض يبقى شاهدًا.
const LIVE_KINDS = ["expense", "refund", "supplier_settle"];

function ApprovalsPage({ approvals = [], currency, canDecide = false, settings = {}, onDecide, onExecute, onBack }) {
  const [tab, setTab] = useState("pending");
  const [openId, setOpenId] = useState(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const pending = approvals.filter((a) => a.status === "pending");
  const done = approvals.filter((a) => a.status !== "pending");
  const list = tab === "pending" ? pending : done;
  const kindRules = APPROVAL_RULES.filter((r) => LIVE_KINDS.includes(r.id))
    .map((r) => ({ ...r, th: settings.approvalThresholds?.[r.id] ?? r.threshold }));
  const P = (v) => `${currency}${fmtMoney(v || 0)}`;
  const describe = (a) => {
    const p = a.payload || {};
    if (a.kind === "expense") return `${p.name || p.category || "مصروف"} · من ${p.fundingSource || "الصندوق"}`;
    if (a.kind === "refund") return `مرتجع فاتورة · ${(p.lineIndexes || []).length} سطر${p.refundTarget || p.refundSource ? ` · ${p.refundTarget || p.refundSource}` : ""}`;
    if (a.kind === "supplier_settle") return `سداد مورد${p.weight ? ` · ${p.weight} جم` : ""}${p.workmanshipAmount ? ` · أجور ${fmtMoney(p.workmanshipAmount)}` : ""}`;
    return a.kindLabel;
  };
  const decide = async (a, decision) => {
    setErr("");
    if (decision === "rejected" && !note.trim()) { setOpenId(a.id); setErr("اكتب سبب الرفض — الطالب يحتاج أن يعرف لماذا"); return; }
    setBusyId(a.id);
    try {
      const r = await onDecide(a, decision, note);
      if (r?.error) { setErr(r.error); return; }
      setOpenId(null); setNote("");
    } finally { setBusyId(null); }
  };
  return (
    <div>
      <SubPageHeader title="الاعتمادات" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[["pending", `المعلّقة (${pending.length})`], ["done", `السجل (${done.length})`]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} className="py-2 rounded-xl text-xs font-bold"
              style={{ background: tab === id ? "var(--accentBg)" : "var(--panel)", color: tab === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
          ))}
        </div>
        {err && <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">⚠ {err}</p>}
        {list.length === 0 ? (
          <EmptyState icon={<Check size={30} color="var(--accentSoft)" />} title={tab === "pending" ? "لا طلبات معلّقة" : "لا سجلّ بعد"}
            sub="ما فوق الحدّ من مصروفٍ أو ردٍّ أو سدادٍ يظهر هنا طلبًا ويُنفَّذ عند اعتماده" />
        ) : (
          <div className="flex flex-col gap-2 mb-3">
            {list.map((a) => {
              const st = APPROVAL_STATUS[a.status] || APPROVAL_STATUS.pending;
              const open = openId === a.id;
              const busy = busyId === a.id;
              return (
                <Card key={a.id} style={{ padding: 11, border: `1px solid ${a.status === "pending" ? "var(--accentLine)" : "var(--line)"}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--panel)", color: st.color, border: "1px solid var(--line)" }}>{st.label}</span>
                    <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[11px]">{a.ref}</span>
                    <span className="flex-1" />
                    <span style={{ color: "var(--text)" }} className="text-sm font-extrabold">{P(a.amount)}</span>
                  </div>
                  <p style={{ color: "var(--text)" }} className="text-xs mt-1">{a.kindLabel} — {describe(a)}</p>
                  <p style={{ color: "var(--text3)" }} className="text-[11px]">
                    طلبه {a.requester || "—"} · {a.requestedAt ? new Date(a.requestedAt).toLocaleString("en-GB") : ""} · يعتمده المدير
                    {a.note ? ` · ${a.note}` : ""}
                  </p>
                  {a.status !== "pending" && (
                    <p style={{ color: st.color }} className="text-[11px] mt-1">
                      {a.selfApproved ? "اعتمادٌ ذاتيّ للمدير — دُوِّن" : a.status === "rejected" ? "رُفض" : "اعتُمد"} — {a.approver || "—"} · {a.decidedAt ? new Date(a.decidedAt).toLocaleString("en-GB") : ""}
                      {a.decisionNote ? ` — ${a.decisionNote}` : ""}{a.executedAt ? ` · نُفِّذ ${new Date(a.executedAt).toLocaleString("en-GB")}` : ""}
                    </p>
                  )}
                  {/* ⚠ معتمَدٌ لم يُنفَّذ: تعثّر تنفيذه (رصيدٌ لا يكفي، يومٌ مقفل) — يُعاد بالحمولة نفسها */}
                  {a.status === "approved" && !a.executedAt && canDecide && onExecute && (
                    <button onClick={async () => { setBusyId(a.id); try { await onExecute(a); } finally { setBusyId(null); } }} disabled={busy}
                      className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                      {busy ? "جارٍ التنفيذ…" : "نفِّذ الآن"}
                    </button>
                  )}
                  {a.status === "pending" && canDecide && (
                    <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
                      {open && <Field label="ملاحظة القرار (إجبارية عند الرفض)"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} /></Field>}
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => { setOpenId(open ? null : a.id); setNote(""); setErr(""); }} className="py-2 rounded-xl text-[11px] font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>{open ? "إغلاق" : "ملاحظة"}</button>
                        <button disabled={busy} onClick={() => decide(a, "rejected")} className="py-2 rounded-xl text-[11px] font-bold" style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}>رفض</button>
                        <button disabled={busy} onClick={() => decide(a, "approved")} className="py-2 rounded-xl text-[11px] font-bold" style={{ background: "linear-gradient(135deg, var(--gradFrom), var(--gradTo))", color: "var(--bg)", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : "اعتماد وتنفيذ"}</button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
        <Card style={{ padding: 11, marginBottom: 12 }}>
          <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">القواعد الجارية{settings.approvalsEnabled === false ? " — ⚠ الاعتماد معطَّل" : ""}</p>
          {kindRules.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-0.5">
              <span style={{ color: "var(--text2)" }} className="text-[11px]">{r.label}</span>
              <span style={{ color: "var(--text3)" }} className="text-[11px]">{r.th > 0 ? `من ${fmtMoney(r.th)}` : "دائمًا"} · المدير</span>
            </div>
          ))}
          <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">⚖ المدير يعتمد نفسه فقط لأن لا أحدَ فوقه في الفرع — ويُدوَّن اعتمادًا ذاتيًّا.</p>
        </Card>
      </div>
    </div>
  );
}

export { ApprovalsPage };
