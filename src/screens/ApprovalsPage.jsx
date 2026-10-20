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
const LIVE_KINDS = ["expense", "refund", "supplier_settle", "asset_purchase", "asset_disposal", "payroll_run", "hq_purchase"];
// من طلب لا يعتمد طلبه في هذه الأنواع — الشخص الثاني (الخادم يرفض أيضًا)
const NO_SELF_KINDS = ["count_variance", "workshop_wastage"];
// الشاشة التي يظهر فيها أثر الطلب بعد تنفيذه
const KIND_PAGE = {
  expense: "expenses", refund: "salesReturn", supplier_settle: "suppliers", asset_purchase: "fixedAssets", asset_disposal: "fixedAssets",
  payroll_run: "payroll", workshop_wastage: "workshop", count_variance: "workday", safe_audit: "safeAudit", credit_limit: "sales",
  price_floor: "sales", item_uncode: "inventory", label_reprint: "inventory", journal_reverse: "generalLedger", period_close: "settings",
};

function ApprovalsPage({ approvals = [], currency, canDecide = false, settings = {}, routing = {}, onDecide, onExecute, onBack, meId = null, onCancel = null, onOpenPage = null }) {
  const [tab, setTab] = useState("pending");
  const [openId, setOpenId] = useState(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  // ⚠ المعتمَد الذي لم يُنفَّذ بعد (كقرار الإدارة) يبقى في «المعلّقة» — ينتظر «نفِّذ الآن»
  const awaitingRun = (a) => a.status === "approved" && !a.executedAt;
  const pending = approvals.filter((a) => a.status === "pending" || awaitingRun(a));
  const done = approvals.filter((a) => a.status !== "pending" && !awaitingRun(a));
  // ما اعتمده صاحبه لنفسه — يُراجَع هنا وفي الإدارة
  const selfApproved = approvals.filter((a) => a.selfApproved);
  const list = tab === "pending" ? pending : tab === "self" ? selfApproved : done;
  const kindRules = APPROVAL_RULES.filter((r) => LIVE_KINDS.includes(r.id))
    .map((r) => ({ ...r, th: settings.approvalThresholds?.[r.id] ?? r.threshold }));
  const P = (v) => `${fmtMoney(v || 0)} ${currency}`;
  const describe = (a) => {
    const p = a.payload || {};
    if (a.kind === "expense") return `${p.name || p.category || "مصروف"} · من ${p.fundingSource || "الصندوق"}`;
    if (a.kind === "refund") return `مرتجع فاتورة · ${(p.lineIndexes || []).length} سطر${p.refundTarget || p.refundSource ? ` · ${p.refundTarget || p.refundSource}` : ""}`;
    if (a.kind === "supplier_settle") return `سداد مورد${p.weight ? ` · ${p.weight} جم` : ""}${p.workmanshipAmount ? ` · أجور ${fmtMoney(p.workmanshipAmount)}` : ""}`;
    if (a.kind === "asset_purchase") return `شراء أصل · ${p.name || ""}${p.fundingSource ? ` · من ${p.fundingSource}` : ""}`;
    if (a.kind === "asset_disposal") return `استبعاد أصل · ${a.note || ""}${p.reason === "scrap" ? " · إتلاف" : p.proceeds ? ` · بيع ${fmtMoney(p.proceeds)}` : ""}`;
    if (a.kind === "payroll_run") return `مسيّر رواتب ${p.period || ""}`;
    if (a.kind === "count_variance") return `فرق عدّ الصندوق${p.diff != null ? ` · ${fmtMoney(p.diff)}` : ""}`;
    if (a.kind === "workshop_wastage") return `هدر الورشة فوق المسموح${a.note ? ` · ${a.note}` : ""}`;
    if (a.kind === "credit_limit") return `بيعٌ آجل فوق حدّ العميل${p.customerName ? ` · ${p.customerName}` : ""}`;
    if (a.kind === "price_floor") return `بيعٌ تحت أرضية السعر${p.code ? ` · ${p.code}` : ""}`;
    if (a.kind === "go_live") return `بدء التشغيل من ${p.startDate || "—"}`;
    if (a.kind === "safe_audit") return `فرق جرد الخزنة${p.diff != null ? ` · ${fmtMoney(p.diff)}` : ""}`;
    if (a.kind === "item_uncode") return `إلغاء تكويد ${p.code || "قطعة"}`;
    if (a.kind === "label_reprint") return `إعادة طباعة ملصق ${p.code || ""}`;
    if (a.kind === "journal_reverse") return `قيد عكسي${p.ref ? ` لـ${p.ref}` : ""}`;
    if (a.kind === "hq_purchase") return `شراء الإدارة من ${p.supplierName || "مورد"} · ${(p.lines || []).reduce((x, l) => x + (Number(l.weight) || 0), 0)} جم · من ${p.payFrom === "safe_network" ? "شبكة الخزنة" : "نقد الخزنة"}${p.by ? ` · ${p.by}` : ""}`;
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
        <div className={`grid ${selfApproved.length ? "grid-cols-3" : "grid-cols-2"} gap-2 mb-3`}>
          {[["pending", `المعلّقة (${pending.length})`], ["done", `السجل (${done.length})`], ...(selfApproved.length ? [["self", `ذاتيًّا (${selfApproved.length})`]] : [])].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} data-approvals-tab={id} className="py-2 rounded-xl text-xs font-bold"
              style={{ background: tab === id ? "var(--accentBg)" : "var(--panel)", color: tab === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
          ))}
        </div>
        {tab === "self" && (
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">⚖ ما اعتمده صاحبه لنفسه فوق حدّ «الشخص الثاني» لأنه لا أحد غيره يعتمده — يُراجَع هنا وفي الإدارة.</p>
        )}
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
                    طلبه {a.requester || "—"} · {a.requestedAt ? new Date(a.requestedAt).toLocaleString("en-GB") : ""} · {a.approverKind === "hq" ? "تعتمده الإدارة" : "يعتمده المدير"}
                    {a.note ? ` · ${a.note}` : ""}
                  </p>
                  {a.status !== "pending" && (
                    <p style={{ color: st.color }} className="text-[11px] mt-1">
                      {a.status === "expired" ? "انتهت مهلته (72 ساعة) دون قرار" : a.status === "cancelled" ? "ألغاه طالبه" : a.selfApproved ? "اعتمادٌ ذاتيّ للمدير — دُوِّن" : a.status === "rejected" ? "رُفض" : "اعتُمد"} — {a.approver || "—"}{a.approverKind === "hq" ? " (الإدارة)" : ""} · {a.decidedAt ? new Date(a.decidedAt).toLocaleString("en-GB") : ""}
                      {a.decisionNote ? ` — ${a.decisionNote}` : ""}{a.executedAt ? ` · نُفِّذ ${new Date(a.executedAt).toLocaleString("en-GB")}` : ""}
                    </p>
                  )}
                  {a.status === "pending" && a.requesterId === meId && (
                    <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                      {NO_SELF_KINDS.includes(a.kind) ? "⚖ من طلب لا يعتمد طلبه — يقرّره من يملك اعتماده، ولك إلغاؤه." : a.approverKind === "hq" ? "⏳ بانتظار من يملك اعتماده في الإدارة." : "⚖ هذا طلبك — يعتمده غيرك، ولك إلغاؤه."}
                    </p>
                  )}
                  {a.executedAt && onOpenPage && KIND_PAGE[a.kind] && (
                    <button type="button" data-approval-open={a.id} onClick={() => onOpenPage(KIND_PAGE[a.kind])}
                      data-help="يفتح الشاشة التي ظهر فيها أثر هذا الطلب بعد تنفيذه — لتراجعه أو تكمل منه."
                      className="mt-2 px-3 rounded-xl text-[11px] font-bold" style={{ minHeight: 32, background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                      افتح شاشته ←
                    </button>
                  )}
                  {/* الطالب يُلغي طلبه المعلّق (المرجع ت٢) */}
                  {a.status === "pending" && onCancel && (a.requesterId === meId || canDecide) && (
                    <button onClick={async () => { setBusyId(a.id); try { await onCancel(a); } finally { setBusyId(null); } }} disabled={busy}
                      className="mt-2 px-3 py-1.5 rounded-xl text-[11px] font-bold"
                      style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                      {a.requesterId === meId ? "ألغِ طلبي" : "ألغِ الطلب"}
                    </button>
                  )}
                  {/* ⚠ معتمَدٌ لم يُنفَّذ: تعثّر تنفيذه (رصيدٌ لا يكفي، يومٌ مقفل) — يُعاد بالحمولة نفسها */}
                  {a.status === "approved" && !a.executedAt && canDecide && onExecute && (
                    <button onClick={async () => { setBusyId(a.id); try { await onExecute(a); } finally { setBusyId(null); } }} disabled={busy}
                      className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                      {busy ? "جارٍ التنفيذ…" : "نفِّذ الآن"}
                    </button>
                  )}
                  {/* ⚠ مسارُه للإدارة: القرار في التطبيق المركزي، والتنفيذ هنا بعد اعتمادها */}
                  {a.status === "pending" && a.approverKind === "hq" && (
                    <p style={{ color: "var(--accent)" }} className="text-[11px] mt-2 pt-2 font-bold" >
                      ⏳ بانتظار قرار الإدارة — يظهر هنا «نفِّذ الآن» فور اعتمادها
                    </p>
                  )}
                  {a.status === "pending" && a.approverKind !== "hq" && canDecide && !(NO_SELF_KINDS.includes(a.kind) && a.requesterId === meId) && (
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
              <span style={{ color: "var(--text3)" }} className="text-[11px]">{r.th > 0 ? `من ${fmtMoney(r.th)}` : "دائمًا"} · {routing[r.id] === "hq" ? "الإدارة" : routing[r.id] === "hq_above" ? `المدير · الإدارة من ${fmtMoney(routing.hqAbove?.[r.id] || 0)}` : "المدير"}</span>
            </div>
          ))}
          <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">⚖ المدير يعتمد نفسه فقط لأن لا أحدَ فوقه في الفرع — ويُدوَّن اعتمادًا ذاتيًّا. وما جعلته الإدارة لها يُقرَّر في التطبيق المركزي ويُنفَّذ هنا.</p>
        </Card>
      </div>
    </div>
  );
}

export { ApprovalsPage };
