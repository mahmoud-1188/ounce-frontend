import React, { useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { REVIEW_SEVERITY, REVIEW_VERDICTS, ROLES } from "../core/constants.js";
import { fmtMoney, fmtW, roundW } from "../core/money.js";
import { auditLedgerHealth } from "../domain/auditLedgerHealth.js";
import { ACCOUNTANT_FORMATS, buildAccountantExport } from "../domain/buildAccountantExport.js";
import { buildComparison } from "../domain/buildComparison.js";
import { buildIncomeStatement } from "../domain/buildIncomeStatement.js";
import { comparePeriods, inputStyle, priorPeriodOf, reviewSummary, signStatement, toCsv } from "../domain/helpers.js";
import { verifyStatement } from "../domain/verifyStatement.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function AccountantReviewPage({ queue = [], reviews = [], audits = [], items = [], journal = [], goldLedger = [], accounts = [], currency, canReview = false, reviewer = "", reviewerRole = "", branchName = "", periodLocks = null, onReview, onGo, onBack }) {
  const [tab, setTab] = useState("queue");     // queue | stocktake | log
  const [sev, setSev] = useState("all");
  const [openKey, setOpenKey] = useState(null);
  const [verdict, setVerdict] = useState("approved");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const sum = reviewSummary(queue);
  const shown = queue.filter((it) => (sev === "all" ? true : it.severity === sev) && (tab === "stocktake" ? it.kind === "stocktake_variance" : it.kind !== "stocktake_variance" || tab === "queue"));
  const submit = async (item) => {
    setErr("");
    if (verdict !== "approved" && !note.trim()) { setErr("اكتب السبب — «يحتاج تعديلًا» و«ملاحظة» بلا نصٍّ لا يُفيدان أحدًا"); return; }
    if (item.kind === "stocktake_variance" && !note.trim()) { setErr("فرق الجرد يُعتمد بسببه — اكتب السبب"); return; }
    setBusy(true);
    try {
      const r = onReview ? await onReview(item, verdict, note) : null;
      if (r?.error) { setErr(r.error); return; }
      if (r) { setOpenKey(null); setNote(""); setVerdict("approved"); }
    } finally { setBusy(false); }
  };
  const itemName = (id) => { const it = items.find((x) => x.id === id); return it ? (it.ref || it.description || it.category || id) : id; };
  const cell = { border: "1px solid var(--line)", padding: "5px 6px", fontSize: 11, whiteSpace: "nowrap" };
  const head = { ...cell, background: "var(--panel)", color: "var(--accent)", fontWeight: 700, textAlign: "center" };

  return (
    <div>
      <SubPageHeader title="المراجعة المحاسبية" onBack={onBack} />
      <div className="px-4 pt-3">
        {/* الملخّص */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[["block", "يمنع الإقفال"], ["warn", "يحتاج مراجعة"], ["info", "للعلم"]].map(([k, l]) => (
            <button key={k} onClick={() => setSev(sev === k ? "all" : k)}
              style={{ background: sev === k ? "var(--accentBg)" : "var(--panel)", border: `1px solid ${sev === k ? "var(--accentLine)" : "var(--line)"}`, borderRadius: 12, padding: "8px 6px", textAlign: "center" }}>
              <p style={{ color: REVIEW_SEVERITY[k].color, fontFamily: "'Cairo', sans-serif", margin: 0 }} className="text-lg font-extrabold">{sum[k] || 0}</p>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">{l}</p>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {[["queue", "الطابور"], ["stocktake", "فروقات الجرد"], ["log", `السجل (${reviews.length})`]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} className="py-2 rounded-xl text-xs font-bold"
              style={{ background: tab === id ? "var(--accentBg)" : "var(--panel)", color: tab === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[["health", "سلامة الدفاتر"], ["compare", "مقارنة الفترات"], ["export", "التصدير والتوقيع"]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} className="py-2 rounded-xl text-[11px] font-bold"
              style={{ background: tab === id ? "var(--accentBg)" : "var(--panel)", color: tab === id ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>
              {l}
            </button>
          ))}
        </div>
        {periodLocks && (periodLocks.lockAll || periodLocks.lockPosted) && (
          <p style={{ color: "var(--accentText)" }} className="text-[11px] mb-2">
            🔒 {periodLocks.lockAll ? `مقفل نهائيًّا حتى ${periodLocks.lockAll}` : ""}{periodLocks.lockAll && periodLocks.lockPosted ? " · " : ""}{periodLocks.lockPosted ? `لا يعدّل حتى ${periodLocks.lockPosted} إلا المدير` : ""}
          </p>
        )}
        {tab === "health" && <HealthTab journal={journal} goldLedger={goldLedger} accounts={accounts} onGo={onGo} />}
        {tab === "compare" && <CompareTab journal={journal} goldLedger={goldLedger} accounts={accounts} currency={currency} />}
        {tab === "export" && <ExportTab journal={journal} goldLedger={goldLedger} accounts={accounts} reviewer={reviewer} reviewerRole={reviewerRole} branchName={branchName} />}
        {!canReview && ["queue", "stocktake", "log"].includes(tab) && (
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">⚖ القراءة للجميع — والحكم بيد المحاسب أو المدير.</p>
        )}

        {(tab === "queue" || tab === "stocktake") && (
          shown.length === 0 ? (
            <EmptyState icon={<ClipboardCheck size={30} color="var(--accentSoft)" />}
              title={tab === "stocktake" ? "لا فروقات جرد بلا سبب" : "لا شيء يحتاج مراجعة"}
              sub={queue.length ? "ما هنا اعتُمد أو رُشّح" : "الدفاتر متّسقة: كل فاتورةٍ بقيد، وكل قيدٍ متوازن"} />
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              {shown.map((it) => {
                const open = openKey === it.key;
                const aud = it.kind === "stocktake_variance" ? audits.find((a) => a.id === it.id) : null;
                const diffs = aud ? (aud.entries || []).filter((en) => (Number(en.countedQty) || 0) !== (Number(en.systemQty) || 0) || Math.abs((Number(en.countedWeight) || 0) - (Number(en.systemWeight) || 0)) > 0.0005) : [];
                return (
                  <Card key={it.key} style={{ padding: 11, border: `1px solid ${it.severity === "block" ? "var(--badLine)" : it.severity === "warn" ? "var(--accentLine)" : "var(--line)"}` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--panel)", color: REVIEW_SEVERITY[it.severity].color, border: "1px solid var(--line)" }}>
                        {it.label}
                      </span>
                      <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[11px] flex-1">{it.ref}</span>
                      {it.date && <span style={{ color: "var(--text3)" }} className="text-[11px]">{new Date(it.date).toLocaleDateString("en-GB")}</span>}
                    </div>
                    <p style={{ color: "var(--text)" }} className="text-xs mt-1">{it.why}</p>
                    {it.lastReview && (
                      <p style={{ color: REVIEW_VERDICTS[it.lastReview.verdict]?.color || "var(--text2)" }} className="text-[11px] mt-1">
                        {it.changedSinceReview ? "⚠ تغيّرت بعد اعتمادها — " : ""}
                        آخر حكم: {REVIEW_VERDICTS[it.lastReview.verdict]?.label} · {it.lastReview.reviewer}
                        {it.lastReview.note ? ` — ${it.lastReview.note}` : ""}
                      </p>
                    )}
                    {diffs.length > 0 && open && (
                      <div style={{ overflowX: "auto", margin: "8px 0" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 320 }}>
                          <thead><tr><th style={head}>الصنف</th><th style={head}>النظام</th><th style={head}>العدّ</th><th style={head}>الفرق</th></tr></thead>
                          <tbody>
                            {diffs.map((en, i) => {
                              const dq = (Number(en.countedQty) || 0) - (Number(en.systemQty) || 0);
                              return (
                                <tr key={i}>
                                  <td style={{ ...cell, color: "var(--text)" }}>{itemName(en.itemId)} <span style={{ color: "var(--text3)" }}>ع{en.karat}</span></td>
                                  <td style={{ ...cell, textAlign: "center", color: "var(--text2)" }}>{en.systemQty} · {fmtW(en.systemWeight)} جم</td>
                                  <td style={{ ...cell, textAlign: "center", color: "var(--text2)" }}>{en.countedQty} · {fmtW(en.countedWeight)} جم</td>
                                  <td style={{ ...cell, textAlign: "center", color: dq < 0 ? "var(--bad)" : "var(--goodSolid)" }}>{dq > 0 ? `+${dq}` : dq}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => onGo && onGo(it.page)} className="text-[11px] px-2.5 py-1 rounded-full"
                        style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>
                        افتح موضعها
                      </button>
                      <span className="flex-1" />
                      {canReview && (
                        <button onClick={() => { setOpenKey(open ? null : it.key); setErr(""); setNote(""); setVerdict(it.kind === "stocktake_variance" ? "approved" : "approved"); }}
                          className="text-[11px] px-2.5 py-1 rounded-full"
                          style={{ background: open ? "var(--accentBg)" : "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                          {open ? "إغلاق" : "حكم المحاسب"}
                        </button>
                      )}
                    </div>
                    {open && canReview && (
                      <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
                        <div className="grid grid-cols-3 gap-1.5 mb-2">
                          {Object.entries(REVIEW_VERDICTS).map(([id, v]) => (
                            <button key={id} onClick={() => setVerdict(id)} className="py-2 rounded-xl text-[11px] font-bold"
                              style={{ background: verdict === id ? "var(--accentBg)" : "var(--field)", color: verdict === id ? v.color : "var(--text2)", border: `1px solid ${verdict === id ? "var(--accentLine)" : "var(--edge)"}` }}>
                              {v.label}
                            </button>
                          ))}
                        </div>
                        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-1">{REVIEW_VERDICTS[verdict].hint}</p>
                        <Field label={it.kind === "stocktake_variance" ? "سبب الفرق (إجباري)" : verdict === "approved" ? "ملاحظة (اختياري)" : "السبب (إجباري)"}>
                          <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)}
                            placeholder={it.kind === "stocktake_variance" ? "بيعٌ لم يُسجَّل · قطعةٌ في الإصلاح · خطأ عدّ…" : "ما الذي يجب تعديله ولماذا"} />
                        </Field>
                        {err && <p style={{ color: "var(--bad)" }} className="text-[11px] mb-1">⚠ {err}</p>}
                        <button onClick={() => submit(it)} disabled={busy} className="w-full py-2.5 rounded-xl text-xs font-bold"
                          style={{ background: "linear-gradient(135deg, var(--gradFrom), var(--gradTo))", color: "var(--bg)", opacity: busy ? 0.6 : 1 }}>
                          {busy ? "جارٍ التسجيل…" : "تسجيل الحكم باسمي"}
                        </button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )
        )}

        {tab === "log" && (
          reviews.length === 0 ? (
            <EmptyState icon={<ClipboardCheck size={30} color="var(--accentSoft)" />} title="لا مراجعات بعد" sub="كل حكمٍ يُسجَّل هنا باسم صاحبه ووقته ولا يُعدَّل" />
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              {reviews.map((r) => (
                <Card key={r.id} style={{ padding: 10 }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--panel)", color: REVIEW_VERDICTS[r.verdict]?.color, border: "1px solid var(--line)" }}>
                      {REVIEW_VERDICTS[r.verdict]?.label || r.verdict}
                    </span>
                    <span style={{ color: "var(--text)" }} className="text-xs flex-1">{r.label} · <span style={{ color: "var(--accentText)", fontFamily: "monospace" }}>{r.targetRef}</span></span>
                    {r.amount > 0 && <span style={{ color: "var(--text2)" }} className="text-[11px]">{currency}{fmtMoney(r.amount)}</span>}
                  </div>
                  {r.note && <p style={{ color: "var(--text)" }} className="text-[11px] mt-1">{r.note}</p>}
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                    {r.reviewer}{r.reviewerRole ? ` (${ROLES[r.reviewerRole]?.label || r.reviewerRole})` : ""} · {new Date(r.date).toLocaleString("en-GB")}
                  </p>
                </Card>
              ))}
            </div>
          )
        )}
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-4">
          ⚖ المحاسب لا يكتب في الدفاتر: يحكم ويُعلّق، والتعديل بيد من يملكه في شاشته. الحكم لا يُعدَّل — تعديلُه حكمٌ جديد فوقه.
        </p>
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  أدوات المحاسب — ما يطلبه المراجع: فحصٌ ومقارنةٌ وتصديرٌ وتوقيع
//
//  ⚠ في المرجع هذه محرّكاتٌ بلا شاشة (auditLedgerHealth · buildComparison ·
//  buildAccountantExport · signStatement/verifyStatement). موضعها هنا لأن
//  المحاسب هو من يسألها — وكلها تقرأ الدفاتر ولا تكتب فيها.
// ═══════════════════════════════════════════════════════════════════════

function HealthTab({ journal = [], goldLedger = [], accounts = [], onGo }) {
  const complete = journal.length < 2000 && goldLedger.length < 2000;
  const h = useMemo(() => auditLedgerHealth({ journal, goldLedger, accounts, complete }), [journal, goldLedger, accounts, complete]);
  return (
    <div className="mb-3">
      <Card style={{ padding: 12, marginBottom: 8, border: `1px solid ${h.healthy ? "var(--goodLine)" : "var(--badLine)"}` }}>
        <p style={{ color: h.healthy ? "var(--good)" : "var(--bad)", margin: 0 }} className="text-sm font-extrabold">
          {h.ok ? "✓ الدفتر سليم" : h.healthy ? "✓ لا خلل يكسر الميزان" : `⚠ ${h.blocks} خللًا يكسر الميزان`}
        </p>
        <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[11px]">
          فُحص {h.checked.entries} قيدًا و{h.checked.weightMoves} حركةً وزنية{h.warns ? ` · ${h.warns} تنبيهًا` : ""}{complete ? "" : " · أحدثُ الحركات فقط — الرصيد الوزني يُراجع من ميزان المراجعة"}
        </p>
      </Card>
      {h.issues.map((x) => (
        <Card key={x.code} style={{ padding: 11, marginBottom: 6, border: `1px solid ${x.level === "block" ? "var(--badLine)" : "var(--accentLine)"}` }}>
          <p style={{ color: x.level === "block" ? "var(--bad)" : "var(--accent)", margin: 0 }} className="text-xs font-bold">{x.why}</p>
          <p style={{ color: "var(--text3)", margin: "3px 0 0" }} className="text-[11px]">{x.fix}</p>
        </Card>
      ))}
      <div className="flex gap-2">
        <button onClick={() => onGo && onGo("trialBalance")} className="text-[11px] px-2.5 py-1 rounded-full"
          style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>ميزان المراجعة</button>
        <button onClick={() => onGo && onGo("generalLedger")} className="text-[11px] px-2.5 py-1 rounded-full"
          style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>الأستاذ العام</button>
      </div>
      <p style={{ color: "var(--text3)" }} className="text-[11px] mt-2">⚖ الميزان يُحسب ويُعرض ولا يُنبّه — والفحص يجري من نفسه ويظهر هنا حيث يُرى.</p>
    </div>
  );
}

function CompareTab({ journal = [], goldLedger = [], accounts = [], currency = "ر.س" }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const prior = priorPeriodOf(from, to);
  const data = useMemo(() => {
    if (!prior) return null;
    const cur = buildIncomeStatement({ journal, accounts, from, to });
    const pri = buildIncomeStatement({ journal, accounts, from: prior.from, to: prior.to });
    const fineOf = (a, b) => {
      const t0 = new Date(a).getTime(), t1 = new Date(`${b}T23:59:59.999`).getTime();
      let fin = 0, fout = 0;
      for (const g of goldLedger) {
        const t = new Date(g.at || g.date).getTime();
        if (!(t >= t0 && t <= t1)) continue;
        const f = (Number(g.weight) || 0) * (Number(g.karat) || 24) / 24;
        if (g.type === "in") fin += f; else fout += f;
      }
      let close = 0;
      for (const g of goldLedger) {
        const t = new Date(g.at || g.date).getTime();
        if (t > t1) continue;
        const f = (Number(g.weight) || 0) * (Number(g.karat) || 24) / 24;
        close += g.type === "in" ? f : -f;
      }
      return { fineIn: roundW(fin), fineOut: roundW(fout), fineClosing: roundW(close) };
    };
    const head = comparePeriods({ current: { ...cur, ...fineOf(from, to) }, prior: { ...pri, ...fineOf(prior.from, prior.to) } });
    const opex = buildComparison({ current: cur.opex, prior: pri.opex });
    return { head, opex };
  }, [journal, goldLedger, accounts, from, to, prior?.from, prior?.to]);
  const cell = { padding: "5px 6px", fontSize: 11, borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" };
  const fmtV = (v, unit) => (unit === "weight" ? `${fmtW(v)} جم24` : `${currency}${fmtMoney(v)}`);
  const pctCell = (r) => (r.pct == null ? "جديد" : `${r.pct > 0 ? "▲" : r.pct < 0 ? "▼" : ""} ${Math.abs(r.pct)}٪`);
  const Table = ({ rows }) => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 330 }}>
        <thead><tr>{["البند", "الحالية", "السابقة", "الفرق", "٪"].map((h) => <th key={h} style={{ ...cell, color: "var(--accent)", textAlign: "center" }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td style={{ ...cell, color: "var(--text)" }}>{r.label}{r.gone ? " (توقّف)" : ""}</td>
              <td style={{ ...cell, textAlign: "center", color: "var(--text2)" }}>{fmtV(r.now, r.unit)}</td>
              <td style={{ ...cell, textAlign: "center", color: "var(--text3)" }}>{fmtV(r.was, r.unit)}</td>
              <td style={{ ...cell, textAlign: "center", color: r.diff < 0 ? "var(--bad)" : "var(--goodSolid)" }}>{fmtV(r.diff, r.unit)}</td>
              <td style={{ ...cell, textAlign: "center", color: "var(--text3)" }}>{pctCell(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="mb-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="من"><input type="date" style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="إلى"><input type="date" style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {!prior || !data ? <p style={{ color: "var(--bad)" }} className="text-[11px]">⚠ فترةٌ غير صالحة</p> : (
        <>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">مقارنةً بـ {prior.from} ← {prior.to} ({prior.days} يومًا — الطول نفسه)</p>
          <Card style={{ padding: 10, marginBottom: 8 }}>
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">بالريال</p>
            <Table rows={data.head.money} />
          </Card>
          <Card style={{ padding: 10, marginBottom: 8 }}>
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">بالجرام (معادل 24)</p>
            <Table rows={data.head.weight} />
          </Card>
          {data.opex.rows.length > 0 && (
            <Card style={{ padding: 10, marginBottom: 8 }}>
              <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">المصروفات بندًا بندًا</p>
              <Table rows={data.opex.rows.map((r) => ({ ...r, unit: "money" }))} />
            </Card>
          )}
          <p style={{ color: "var(--text3)" }} className="text-[11px]">⚖ محلٌّ ربحه بالريال زاد ووزنه نقص باع ذهبه في سوقٍ صاعد — فالمقارنة بالدفترين.</p>
        </>
      )}
    </div>
  );
}

function ExportTab({ journal = [], goldLedger = [], accounts = [], reviewer = "", reviewerRole = "", branchName = "" }) {
  const today = new Date().toISOString().slice(0, 10);
  const [format, setFormat] = useState("dual");
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [note, setNote] = useState("");
  const [check, setCheck] = useState(null);
  const x = useMemo(() => buildAccountantExport({ format, journal, goldLedger, accounts, from, to }), [format, journal, goldLedger, accounts, from, to]);
  const download = (blob, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const exportCsv = () => download(new Blob([toCsv(x.columns, x.rows)], { type: "text/csv;charset=utf-8" }), `قيود-${x.format}-${from}-${to}.csv`);
  const exportSigned = () => {
    // ⚠ التوقيع على المحتوى كاملًا: أيّ رقمٍ يُعدَّل بعده يكشفه التحقّق.
    const signed = signStatement({ payload: { format: x.format, from, to, columns: x.columns, rows: x.rows }, by: reviewer, role: reviewerRole, branchName, note });
    download(new Blob([JSON.stringify(signed, null, 2)], { type: "application/json" }), `قيود-موقّعة-${from}-${to}.json`);
  };
  const verifyFile = async (file) => {
    if (!file) return;
    try { setCheck(verifyStatement(JSON.parse(await file.text()))); }
    catch { setCheck({ ok: false, why: "ليس ملفًّا موقَّعًا صالحًا" }); }
  };
  return (
    <div className="mb-3">
      <Field label="الصيغة">
        <select style={inputStyle} value={format} onChange={(e) => setFormat(e.target.value)}>
          {ACCOUNTANT_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="من"><input type="date" style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="إلى"><input type="date" style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">{x.entries} قيدًا · {x.count} سطرًا{format !== "dual" ? " · ⚠ هذه الصيغة تُسقط الوزن" : ""}</p>
      <button onClick={exportCsv} disabled={!x.count} className="w-full py-2.5 rounded-xl text-xs font-bold mb-2"
        style={{ background: x.count ? "var(--accentBg)" : "var(--field)", color: x.count ? "var(--accent)" : "var(--text3)", border: "1px solid var(--accentLine)" }}>
        تصدير CSV لمكتب المحاسبة
      </button>
      <Card style={{ padding: 11, marginBottom: 8 }}>
        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">نسخةٌ موقَّعة باسمك</p>
        <Field label="ملاحظة التوقيع (اختياري)"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="قوائم الربع الثالث — للمراجع الخارجي" /></Field>
        <button onClick={exportSigned} disabled={!x.count} className="w-full py-2.5 rounded-xl text-xs font-bold"
          style={{ background: x.count ? "linear-gradient(135deg, var(--gradFrom), var(--gradTo))" : "var(--field)", color: x.count ? "var(--bg)" : "var(--text3)" }}>
          تصدير موقَّع ({reviewer || "—"})
        </button>
        <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">⚠ توقيعٌ داخليّ للمساءلة يكشف أيّ تعديلٍ بعد الإصدار — لا توقيعٌ رقميّ معتمد من جهةٍ خارجية.</p>
      </Card>
      <Card style={{ padding: 11 }}>
        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">التحقّق من ملفٍّ موقَّع</p>
        <input type="file" accept="application/json,.json" onChange={(e) => verifyFile(e.target.files?.[0])} className="text-[11px]" style={{ color: "var(--text2)" }} />
        {check && (
          <p style={{ color: check.ok ? "var(--good)" : "var(--bad)" }} className="text-[11px] mt-1">
            {check.ok ? `✓ سليم — أصدره ${check.by || "—"}${check.role ? ` (${ROLES[check.role]?.label || check.role})` : ""} · ${new Date(check.at).toLocaleString("en-GB")}` : `⚠ ${check.why}`}
          </p>
        )}
      </Card>
    </div>
  );
}

export { AccountantReviewPage };
