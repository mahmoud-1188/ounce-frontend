import React, { useEffect, useRef, useState } from "react";
import { fmtMoney } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// المساعد المحاسبي — وكيلٌ يقرأ الدفاتر بأدواتٍ لا بالتخمين (v197 في المرجع).
///
/// ⚠ النموذج لا يرى الأرقام ليحفظها، بل **يستدعي أدواتٍ** تُنفَّذ على الخادم
///   على دفاتر الفرع كاملةً وتُعيد نتيجةً حرفيّة. الأدوات كلّها قراءة؛ الوحيدة
///   التي «تقترح» قيدًا تُنشئ مسودّةً تحتاج ضغطة اعتمادٍ من مديرٍ أو محاسب
///   (Human-in-the-loop) — والترحيل باسم من اعتمد.
const TOOL_LABELS = {
  trial_balance: "ميزان المراجعة", account_ledger: "حركة حساب", income_statement: "قائمة الدخل",
  sales_summary: "ملخّص المبيعات", expenses_by_account: "المصروفات بحسابها", cash_position: "النقد الآن",
  inventory_summary: "المخزون", review_queue: "طابور المراجعة", search_journal: "بحث اليومية",
  supplier_statement: "كشف مورد", propose_journal_entry: "اقتراح قيد",
};

function DraftCard({ draft, canPost, onApprove, onReject }) {
  const [state, setState] = useState(draft.status || "pending");   // pending | approved | rejected
  const [ref, setRef] = useState(draft.journalRef || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = draft.balanced !== false && !(draft.invalidAccounts || []).length;
  const act = async (fn) => {
    setBusy(true); setErr("");
    try {
      const r = await fn();
      if (r?.error) setErr(r.error);
      else if (r?.proposal) { setState(r.proposal.status); setRef(r.proposal.journalRef); }
    } finally { setBusy(false); }
  };
  return (
    <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
      <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-[11px] font-bold">
        {state === "approved" ? "قيدٌ مُرحَّل" : state === "rejected" ? "مسودّة مرفوضة" : "مسودّة قيد — تنتظر اعتمادك"}
      </p>
      {(draft.lines || []).map((l, k) => (
        <p key={k} style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">
          {l.account} {l.name || ""} — {Number(l.debit) > 0 ? `مدين ${fmtMoney(l.debit)}` : `دائن ${fmtMoney(l.credit)}`}
        </p>
      ))}
      <p style={{ color: ok ? "var(--good)" : "var(--bad)", margin: "2px 0 0" }} className="text-[11px]">
        {draft.balanced === false ? "غير متوازن" : "متوازن"} · {fmtMoney(draft.totalDebit)} / {fmtMoney(draft.totalCredit)}{draft.note ? ` · ${draft.note}` : ""}
        {(draft.invalidAccounts || []).length ? ` · ⚠ حسابات غير صالحة: ${draft.invalidAccounts.join(", ")}` : ""}
      </p>
      {state === "pending" && canPost && ok && (
        <div className="grid grid-cols-3 gap-1.5 mt-1.5">
          <button disabled={busy} onClick={() => act(() => onReject(draft.id))} className="py-2 rounded-xl text-[11px] font-bold"
            style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}>رفض</button>
          <button disabled={busy} onClick={() => act(() => onApprove(draft.id))} className="col-span-2 py-2 rounded-xl text-[11px] font-bold"
            style={{ background: "linear-gradient(135deg, var(--gradFrom), var(--gradTo))", color: "var(--bg)", opacity: busy ? 0.6 : 1 }}>
            {busy ? "جارٍ الترحيل…" : "اعتماد وترحيل هذا القيد بنفسي"}
          </button>
        </div>
      )}
      {state === "pending" && !canPost && <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">الاعتماد بيد المدير أو المحاسب.</p>}
      {state === "approved" && <p style={{ color: "var(--good)" }} className="text-[11px] mt-1">✓ رُحّل {ref || ""}</p>}
      {err && <p style={{ color: "var(--bad)" }} className="text-[11px] mt-1">⚠ {err}</p>}
    </div>
  );
}

function AccountantAiPage({ canPost = false, onAsk, onLoadProposals = null, onApprove, onReject, onBack }) {
  const [msgs, setMsgs] = useState([]);     // [{role, text, trace?, drafts?}]
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pending, setPending] = useState([]);
  const endRef = useRef(null);
  const suggestions = ["راجع طابور المراجعة ولخّص ما فيه", "كم صافي الربح هذا الشهر وممّ يتكوّن؟", "أين النقد الآن؟", "اعرض مصروفات الشهر بحسابها", "هل ميزان المراجعة متوازن؟"];
  useEffect(() => {
    let live = true;
    if (onLoadProposals) onLoadProposals().then((list) => { if (live) setPending((list || []).filter((p) => p.status === "pending")); }).catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" }); }, [msgs.length, busy]);
  const ask = async (text) => {
    const t = String(text || q).trim(); if (!t || busy) return;
    setQ(""); setErr(""); setBusy(true);
    const next = [...msgs, { role: "user", text: t }];
    setMsgs(next);
    try {
      const r = await onAsk(next.map((m) => ({ role: m.role, content: m.text })));
      if (r?.error) setErr(r.error);
      else setMsgs((m) => [...m, { role: "assistant", text: r.text || "—", trace: r.trace || [], drafts: r.drafts || [] }]);
    } catch (e) { setErr(String(e?.message || e)); }
    setBusy(false);
  };
  return (
    <div>
      <SubPageHeader title="المساعد المحاسبي" onBack={onBack} />
      <div className="px-4 pt-2 pb-28">
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">يقرأ الدفاتر بأدواتٍ — كل رقمٍ من نتيجة أداة لا من تخمين. لا يرحّل شيئًا: اقتراحاته مسودّات تعتمدها أنت.</p>
        {pending.length > 0 && (
          <Card style={{ padding: 11, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--accent)", margin: 0 }} className="text-[11px] font-bold">مسودّات سابقة تنتظر الاعتماد ({pending.length})</p>
            {pending.slice(0, 5).map((d) => (
              <div key={d.id}>
                <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[10px]">{d.requestedBy || "—"} · {new Date(d.createdAt).toLocaleString("en-GB")}{d.question ? ` · «${d.question.slice(0, 60)}»` : ""}</p>
                <DraftCard draft={{ ...d, balanced: Math.abs(d.totalDebit - d.totalCredit) < 0.005 }} canPost={canPost} onApprove={onApprove} onReject={onReject} />
              </div>
            ))}
          </Card>
        )}
        {msgs.length === 0 && (
          <div className="flex flex-col gap-1.5 mb-3">
            {suggestions.map((s0) => <button key={s0} onClick={() => ask(s0)} className="text-right text-[11px] px-3 py-2 rounded-xl" style={{ background: "var(--field)", color: "var(--text2)" }}>{s0}</button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="mb-2">
            <Card style={{ padding: 11, background: m.role === "user" ? "var(--accentBg)" : "var(--panel)", border: `1px solid ${m.role === "user" ? "var(--accentLine)" : "var(--line)"}` }}>
              <p style={{ color: "var(--text)", whiteSpace: "pre-wrap", margin: 0 }} className="text-xs leading-6">{m.text}</p>
              {m.trace?.length > 0 && (
                <details className="mt-1"><summary style={{ color: "var(--text3)" }} className="text-[11px]">ما جلبه المساعد ({m.trace.length} أداة)</summary>
                  {m.trace.map((t, k) => (
                    <p key={k} style={{ color: t.ok === false ? "var(--bad)" : "var(--text3)", margin: 0 }} className="text-[10px]">
                      {TOOL_LABELS[t.name] || t.name} <span style={{ fontFamily: "monospace", direction: "ltr", display: "inline-block" }}>{JSON.stringify(t.input || {})}</span>
                    </p>
                  ))}
                </details>
              )}
              {(m.drafts || []).map((d) => <DraftCard key={d.id} draft={d} canPost={canPost} onApprove={onApprove} onReject={onReject} />)}
            </Card>
          </div>
        ))}
        {busy && <p style={{ color: "var(--text3)" }} className="text-[11px]">يجلب من الدفاتر…</p>}
        {err && <p style={{ color: "var(--bad)" }} className="text-[11px]">⚠ {err}</p>}
        <div ref={endRef} />
        <div className="fixed left-0 right-0 bottom-0 px-4 py-2 flex gap-2" style={{ background: "var(--bg)", borderTop: "1px solid var(--line)", maxWidth: 560, margin: "0 auto", zIndex: 50 }}>
          <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }} placeholder="اسأل المحاسب الذكي…" />
          <button onClick={() => ask()} disabled={busy || !q.trim()} className="px-4 rounded-xl text-xs font-bold" style={{ background: "linear-gradient(135deg, var(--gradFrom), var(--gradTo))", color: "var(--bg)" }}>أرسل</button>
        </div>
      </div>
    </div>
  );
}

export { AccountantAiPage };
