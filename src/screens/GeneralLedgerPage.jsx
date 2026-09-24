import React, { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { CASH_LEDGER_CODES, WAGES_LEDGER_CODES } from "../core/constants.js";
import { fmtMoney, fmtW } from "../core/money.js";
import { buildAccountLedger } from "../domain/buildAccountLedger.js";
import { buildAccountTreeReport } from "../domain/buildAccountTreeReport.js";
import { buildAging } from "../domain/buildAging.js";
import { buildGoldByKaratLedger } from "../domain/buildGoldByKaratLedger.js";
import { buildMultiAccountLedger } from "../domain/buildMultiAccountLedger.js";
import { buildOfficialStatement } from "../domain/buildOfficialStatement.js";
import { exportLedgerXlsx, exportTablesPdf, inputStyle, normalizeArabicQuery } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function GeneralLedgerPage({ journal = [], goldLedger = [], accounts = [], agingEntries = [], agingWeightEntries = [], currency = "ر.س", branchName = "", preparedBy = "", onBackfill, onBack }) {
  const [tab, setTab] = useState("tree");        // tree | account | gold | cash | wages
  const [treeView, setTreeView] = useState("balance");
  const [agingUnit, setAgingUnit] = useState("money");   // moved | balance | all
  // ⚠ أي سطرٍ يُضغط تظهر تفاصيله — لا رقمٌ بلا مستند خلفه
  const [detail, setDetail] = useState(null);
  const [code, setCode] = useState("");
  const [q, setQ] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  // ⚠ الفترة تتبع الدفتر لا التقويم.
  //
  // كانت تفتح على «هذا الشهر» دائمًا — فمن فتح الأستاذ على بياناتٍ أقدم
  // (تجريبية، أو محلّ أقفل الشهر) رأى **أصفارًا بلا تفسير** وظنّ الشاشة
  // معطّلة. الآن تبدأ من أول قيدٍ إلى آخره، وتقول أي فترةٍ تعرض.
  const span = useMemo(() => {
    const ds = journal.map((e) => String(e.at || e.date).slice(0, 10)).filter(Boolean).sort();
    return ds.length ? { first: ds[0], last: ds[ds.length - 1] } : null;
  }, [journal]);
  // ⚠ الافتتاح على **كل** الدفتر لا على الشهر:
  //
  // «هذا الشهر» يُظهر جزءًا من الصورة ويُخفي الباقي بلا أن يقول. ومن فتح
  // الأستاذ أول مرة يريد أن يرى ما عنده كلّه، ثم يُضيّق بنفسه بزرٍّ واحد.
  const [from, setFrom] = useState(() => {
    const ds = journal.map((e) => String(e.at || e.date).slice(0, 10)).filter(Boolean).sort();
    return ds.length ? ds[0] : monthStart;
  });
  const [to, setTo] = useState(today);

  const tree = useMemo(
    () => buildAccountTreeReport({ journal, accounts, from, to }),
    [journal, accounts, from, to]
  );
  const acc = accounts.find((a) => a.code === code);
  const led = useMemo(
    () => (code ? buildAccountLedger({ journal, account: code, from, to, nature: acc?.nature }) : null),
    [journal, code, from, to, acc]
  );

  const gold = useMemo(() => buildGoldByKaratLedger({ goldLedger, from, to }), [goldLedger, from, to]);
  const cash = useMemo(() => buildMultiAccountLedger({ journal, codes: CASH_LEDGER_CODES, accounts, from, to }), [journal, accounts, from, to]);
  const wages = useMemo(() => buildMultiAccountLedger({ journal, codes: WAGES_LEDGER_CODES, accounts, from, to }), [journal, accounts, from, to]);

  const shown = useMemo(() => {
    // ⚠ الافتراضي «ذات الرصيد»: من يفتح الشجرة يريد ما عنده، لا 119 حسابًا
    // معظمها صفر. والصفر الحقيقي يُرى باختيار «الكل».
    const list = tree.rows.filter((r) => {
      if (treeView === "all") return true;
      if (treeView === "balance") return Math.abs(r.closing) > 0.005;
      return r.count > 0;
    });
    if (!q.trim()) return list;
    const needle = normalizeArabicQuery(q);
    return list.filter((r) => normalizeArabicQuery(`${r.code} ${r.name}`).includes(needle));
  }, [tree, q, treeView]);

  const money = (v) => `${currency}${fmtMoney(v || 0)}`;
  const meta = [`الفرع: ${branchName || "—"}`, `الفترة: من ${from} إلى ${to}`,
    `طُبع: ${new Date().toLocaleString("en-GB")}`];

  const exportTree = (kind) => {
    const headers = ["الكود", "الحساب", "افتتاحي", "مدين", "دائن", "ختامي", "حركات"];
    const rows = shown.map((r) => [
      r.code, `${"— ".repeat(Math.max(0, r.level))}${r.name}`,
      r.opening, r.debit, r.credit, r.closing, r.count,
    ]);
    const totals = ["", "الإجمالي", "", tree.totalDebit, tree.totalCredit, "", ""];
    if (kind === "xlsx") {
      exportLedgerXlsx({ title: "تقرير الشجرة المحاسبية", meta, headers, rows, totals,
        fileBase: "الشجرة_المحاسبية" });
      return;
    }
    exportTablesPdf({
      title: "تقرير الشجرة المحاسبية", subtitle: `من ${from} إلى ${to}`,
      branchName, landscape: true,
      sections: [{ headers, rows: [...rows.map((r) => r.map(String)), totals.map(String)] }],
    });
  };

  const exportAcc = (kind) => {
    if (!led) return;
    const headers = ["التاريخ", "المرجع", "البيان", "بواسطة", "مدين", "دائن", "الرصيد"];
    const rows = led.rows.map((r) => [
      String(r.at).slice(0, 10), r.ref, r.note || r.opType, r.by, r.debit, r.credit, r.balance,
    ]);
    const totals = ["", "", "الإجمالي", "", led.totalDebit, led.totalCredit, led.closing];
    const title = `كشف حساب ${code} — ${acc?.name || ""}`;
    if (kind === "xlsx") {
      exportLedgerXlsx({ title, meta: [...meta, `الرصيد الافتتاحي: ${led.opening}`],
        headers, rows, totals, fileBase: `كشف_${code}` });
      return;
    }
    exportTablesPdf({
      title, subtitle: `من ${from} إلى ${to} · افتتاحي ${money(led.opening)}`,
      branchName, landscape: true,
      sections: [{ headers, rows: [...rows.map((r) => r.map(String)), totals.map(String)] }],
    });
  };

  return (
    <div>
      <SubPageHeader title="الأستاذ العام" onBack={onBack} />
      <div className="px-4 pt-3">
        {/* ⚠ دفترٌ فارغ يُقال صراحةً — لا أصفارٌ صامتة.
            من يرى الشجرة كلّها أصفارًا يظنّ التقرير معطّلًا، والحقيقة أن
            الحركات القائمة لم تُرحَّل بعد. */}
        {journal.length === 0 && (
          <Card style={{ padding: 13, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--accentText)", margin: 0 }} className="text-[12px] font-bold">
              الدفتر فارغ — لا قيود بعد
            </p>
            <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px] leading-6">
              الأستاذ يعرض ما في دفتر القيد. إن كانت عندك مبيعات ومشتريات
              قديمة من قبل تفعيل الدفتر، رحّلها مرةً واحدة فتُكتب قيودها
              بتواريخها. والحركات الجديدة تُقيَّد تلقائيًّا.
            </p>
            {onBackfill && (
              <button onClick={onBackfill} className="w-full mt-2 py-2.5 rounded-xl text-[12px] font-bold"
                style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
                رحّل الحركات القائمة
              </button>
            )}
          </Card>
        )}

        {/* ── الفترة ── */}
        <Card style={{ padding: 12, marginBottom: 10 }}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="من"><input type="date" style={inputStyle} value={from}
              onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="إلى"><input type="date" style={inputStyle} value={to}
              onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          {span && (
            <p style={{ color: "var(--text3)", margin: "0 0 6px" }} className="text-[10px]">
              الدفتر من <b>{span.first}</b> إلى <b>{span.last}</b>
              {(from && from > span.last) && <span style={{ color: "var(--bad)" }}> — الفترة المختارة بعد آخر حركة، لذلك الأرقام صفر</span>}
            </p>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {[["اليوم", today, today],
              ["هذا الشهر", monthStart, today],
              ["هذه السنة", `${today.slice(0, 4)}-01-01`, today],
              ["الكل", "", today]].map(([lbl, f, t]) => (
              <button key={lbl} onClick={() => { setFrom(f); setTo(t); }}
                className="px-3 py-1.5 rounded-full text-[10px]"
                style={{ background: from === f ? "var(--accentBg)" : "var(--field)",
                  color: from === f ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
                {lbl}
              </button>
            ))}
          </div>
        </Card>

        <div className="flex gap-1 mb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {[["tree", "الشجرة"], ["account", "كشف"], ["official", "كشف رسمي"], ["aging", "أعمار الديون"], ["gold", "الذهب"], ["cash", "النقدية"], ["wages", "الأجور"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} className="py-2 px-3 rounded-xl text-[11px] font-bold"
              style={{ background: tab === id ? "var(--accentBg)" : "var(--field)", whiteSpace: "nowrap", flexShrink: 0,
                color: tab === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* ══ أعمار الديون ══ */}
        {tab === "aging" && (() => {
          const isW = agingUnit === "weight";
          const ag = buildAging({ asOf: to, unit: agingUnit,
            entries: isW ? agingWeightEntries : agingEntries });
          const fmtU = (v) => (isW ? `${fmtW(v)} جم24` : `${currency}${fmtMoney(v)}`);
          return (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[["money", "نقديّ — على العملاء"], ["weight", "وزنيّ — للموردين"]].map(([u, l]) => (
                  <button key={u} onClick={() => setAgingUnit(u)} className="py-2.5 rounded-xl text-[11px] font-bold"
                    style={{ background: agingUnit === u ? "var(--accentBg)" : "var(--field)",
                      color: agingUnit === u ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
                ))}
              </div>
              <Card style={{ padding: 11, marginBottom: 8, border: "1px solid var(--accentLine)" }}>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-6">
                  ⚠ <b>رصيدٌ إجمالي لا يُنبئ بشيء.</b> مئة ألفٍ عمرها أسبوع غير مئة ألفٍ عمرها
                  سنة — والثانية غالبًا لن تُحصَّل.
                </p>
              </Card>
              <Card style={{ padding: 12, marginBottom: 8 }}>
                {ag.labels.map((l, i) => (
                  <div key={l} className="flex items-baseline justify-between py-0.5">
                    <span style={{ color: i === ag.labels.length - 1 ? "var(--bad)" : "var(--text3)" }}
                      className="text-[11px]">{l}</span>
                    <span style={{ color: i === ag.labels.length - 1 ? "var(--bad)" : "var(--text2)" }}
                      className="text-[11px] font-bold">{fmtU(ag.totals[i])}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid var(--line)", marginTop: 5, paddingTop: 5 }}>
                  <div className="flex items-baseline justify-between">
                    <span style={{ color: "var(--text)" }} className="text-[11px] font-bold">الإجمالي</span>
                    <span style={{ color: "var(--text)" }} className="text-[12px] font-bold">{fmtU(ag.total)}</span>
                  </div>
                </div>
                {ag.overdue > 0 && (
                  <p style={{ color: "var(--bad)", margin: "6px 0 0" }} className="text-[11px] leading-6">
                    ⚠ {fmtU(ag.overdue)} متأخّرٌ أكثر من 90 يومًا — {isW
                      ? <><b>وهذا أخطر من المتأخّر النقدي:</b> ذهبٌ مستحقٌّ عليك منذ سنة يعني
                        أنك <b>بعتَ ذهب غيرك وصرفتَ ثمنه</b>.</>
                      : <><b>يُخصَّص له مقابل الديون المشكوك فيها</b> في التسويات الجردية.</>}
                  </p>
                )}
              </Card>
              {ag.rows.length === 0 ? (
                <p style={{ color: "var(--text3)" }} className="text-[11px]">لا ديونٍ قائمة.</p>
              ) : ag.rows.map((r, i) => (
                <Card key={i} style={{ padding: 9, marginBottom: 3 }}>
                  <div className="flex items-baseline justify-between">
                    <span style={{ color: "var(--text)" }} className="text-[11px]">{r.name}</span>
                    <span style={{ color: r.bucket === 3 ? "var(--bad)" : "var(--text2)" }}
                      className="text-[11px] font-bold">{fmtU(r.balance)}</span>
                  </div>
                  <p style={{ color: r.bucket === 3 ? "var(--bad)" : "var(--text3)", margin: 0 }}
                    className="text-[11px]">{r.days} يومًا</p>
                </Card>
              ))}
            </>
          );
        })()}

        {/* ── تفاصيل السطر المضغوط ── */}
        {detail && (
          <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
            <div className="flex items-baseline justify-between mb-1">
              <span style={{ color: "var(--accent)" }} className="text-[11px] font-bold">تفاصيل الحركة</span>
              <button onClick={() => setDetail(null)} style={{ color: "var(--text3)" }} className="text-[10px]">إغلاق</button>
            </div>
            {Object.entries(detail).filter(([k, v]) => v !== "" && v !== null && v !== undefined && k !== "id").map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between py-0.5">
                <span style={{ color: "var(--text3)" }} className="text-[10px]">
                  {({ at: "التاريخ", ref: "المرجع", opType: "العملية", account: "الحساب", accountName: "اسم الحساب",
                     karat: "العيار", in: "دخول", out: "خروج", debit: "مدين", credit: "دائن",
                     balance: "الرصيد", fine: "معادل 24", note: "البيان", by: "بواسطة" })[k] || k}
                </span>
                <span style={{ color: "var(--text)" }} className="text-[11px]">
                  {typeof v === "number" ? fmtMoney(v) : String(v).slice(0, 60)}
                </span>
              </div>
            ))}
          </Card>
        )}

        {/* ══ كشف حسابٍ رسمي ══ */}
        {tab === "official" && (() => {
          const st = code ? buildOfficialStatement({
            journal, account: code, accounts, from, to,
            branchName, branchCode: "", preparedBy: preparedBy || "", currency,
          }) : null;
          return (
            <>
              <Card style={{ padding: 11, marginBottom: 8, border: "1px solid var(--accentLine)" }}>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
                  كشفٌ قابلٌ للتسليم لجهةٍ خارجية: <b>رصيدٌ افتتاحيّ مُرحَّل</b> · ترقيمٌ متسلسل ·
                  <b> يشمل كل الحسابات الفرعية</b> · ختمٌ ببصمة.
                </p>
              </Card>
              <select style={{ ...inputStyle, marginBottom: 8 }} value={code} onChange={(e) => setCode(e.target.value)}>
                <option value="">— اختر الحساب —</option>
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}{a.group ? " (يشمل فروعه)" : ""}</option>
                ))}
              </select>
              {!st ? (
                <p style={{ color: "var(--text3)" }} className="text-[11px]">اختر حسابًا لاستخراج كشفه.</p>
              ) : st.error ? (
                <p style={{ color: "var(--bad)" }} className="text-[11px]">{st.error}</p>
              ) : (
                <>
                  <Card style={{ padding: 12, marginBottom: 8 }}>
                    <p style={{ color: "var(--accent)", margin: 0 }} className="text-[12px] font-bold">
                      {st.account.code} · {st.account.name}
                    </p>
                    {st.includes.length > 0 && (
                      <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[10px]">
                        يشمل: {st.includes.join(" · ")}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {[["الرصيد الافتتاحي", st.opening], ["إجمالي المدين", st.totalDebit],
                        ["إجمالي الدائن", st.totalCredit], ["الرصيد الختامي", st.closingNatural]].map(([l, v]) => (
                        <div key={l}>
                          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px]">{l}</p>
                          <p style={{ color: "var(--text)", margin: 0 }} className="text-[12px] font-bold">{money(v)}</p>
                        </div>
                      ))}
                    </div>
                    <p style={{ color: st.consistent ? "var(--good)" : "var(--bad)", margin: "6px 0 0" }} className="text-[10px]">
                      {st.consistent ? "✓ الافتتاحي + الحركة = الختامي" : "⚠ كسرٌ في الحساب — راجع الدفتر"}
                      {" · "}{st.count} حركة
                    </p>
                    <p style={{ color: "var(--text3)", margin: "4px 0 0", fontFamily: "monospace", direction: "ltr" }}
                      className="text-[9px]">
                      {st.stamp.digest} · {String(st.stamp.preparedAt).slice(0, 16).replace("T", " ")}
                      {st.stamp.preparedBy ? ` · ${st.stamp.preparedBy}` : ""}
                    </p>
                  </Card>
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => exportLedgerXlsx({
                      title: `كشف حساب ${st.account.code} — ${st.account.name}`, meta,
                      headers: ["#", "التاريخ", "المرجع", "الحساب", "البيان", "بواسطة", "مدين", "دائن", "الرصيد"],
                      rows: [["", "", "", "", "الرصيد الافتتاحي المُرحَّل", "", "", "", st.opening],
                        ...st.lines.map((r) => [r.seq, String(r.at).slice(0, 10), r.ref,
                          `${r.account} ${r.accountName}`, r.note || r.opType, r.by, r.debit, r.credit, r.balance])],
                      totals: ["", "", "", "", "الإجمالي", "", st.totalDebit, st.totalCredit, st.closing],
                      fileBase: `كشف_${st.account.code}` })}
                      className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>Excel</button>
                    <button onClick={() => exportTablesPdf({
                      title: `كشف حساب — ${st.account.name}`,
                      subtitle: `${st.account.code} · من ${from || "البداية"} إلى ${to || "اليوم"} · ${st.stamp.digest}`,
                      branchName, landscape: true,
                      sections: [{ headers: ["#", "التاريخ", "المرجع", "البيان", "مدين", "دائن", "الرصيد"],
                        rows: [["", "", "", "الرصيد الافتتاحي", "", "", fmtMoney(st.opening)],
                          ...st.lines.map((r) => [String(r.seq), String(r.at).slice(0, 10), r.ref,
                            r.note || r.opType, fmtMoney(r.debit), fmtMoney(r.credit), fmtMoney(r.balance)]),
                          ["", "", "", "الإجمالي", fmtMoney(st.totalDebit), fmtMoney(st.totalCredit), fmtMoney(st.closing)]] }] })}
                      className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>PDF</button>
                  </div>
                  {st.lines.length === 0 ? (
                    <p style={{ color: "var(--text3)" }} className="text-[11px]">لا حركات في الفترة — الرصيد كما هو.</p>
                  ) : st.lines.map((r) => (
                    <button key={r.seq} onClick={() => setDetail(r)} className="w-full text-right">
                      <Card style={{ padding: 9, marginBottom: 4 }}>
                        <div className="flex items-baseline gap-2">
                          <span style={{ color: "var(--text3)" }} className="text-[10px]">{r.seq}</span>
                          <span style={{ color: "var(--text3)" }} className="text-[10px]">{String(r.at).slice(0, 10)}</span>
                          <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[10px]">{r.ref}</span>
                          <span style={{ color: "var(--text2)" }} className="text-[10px] flex-1 truncate">{r.accountName}</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span style={{ color: "var(--text3)" }} className="text-[10px] truncate flex-1">{r.note || r.opType}</span>
                          <span style={{ color: r.debit ? "var(--good)" : "var(--bad)" }} className="text-[11px] font-bold">
                            {r.debit ? `+${fmtMoney(r.debit)}` : `−${fmtMoney(r.credit)}`}
                          </span>
                          <span style={{ color: "var(--text)" }} className="text-[11px] font-bold mr-2">{fmtMoney(r.balance)}</span>
                        </div>
                      </Card>
                    </button>
                  ))}
                </>
              )}
            </>
          );
        })()}

        {/* ── دفتر الذهب بالعيار ── */}
        {tab === "gold" && (
          <>
            <Card style={{ padding: 11, marginBottom: 8 }}>
              <p style={{ color: "var(--accent)", margin: "0 0 6px" }} className="text-[11px] font-bold">
                الرصيد بالعيار — معادل 24: {fmtW(gold.totals.closingFine)} جم
              </p>
              {gold.byKarat.map((k) => (
                <div key={k.karat} className="flex items-baseline justify-between py-1"
                  style={{ borderTop: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--text)" }} className="text-[11px] font-bold">عيار {k.karat}</span>
                  <span style={{ color: "var(--text3)" }} className="text-[10px]">
                    افتتاحي {fmtW(k.opening)} · دخل {fmtW(k.in)} · خرج {fmtW(k.out)}
                  </span>
                  <span style={{ color: k.closing >= 0 ? "var(--text)" : "var(--bad)" }} className="text-[12px] font-bold">
                    {fmtW(k.closing)} جم
                  </span>
                </div>
              ))}
              {/* ⚠ العيارات لا تُجمع خامًا — المعادل 24 للمقارنة فقط */}
            </Card>
            <div className="flex gap-2 mb-3">
              <button onClick={() => exportLedgerXlsx({ title: "دفتر الذهب بالعيار", meta,
                headers: ["التاريخ", "المرجع", "العملية", "الحساب", "العيار", "دخول", "خروج", "الرصيد", "معادل 24", "بواسطة"],
                rows: gold.rows.map((r) => [String(r.at).slice(0, 10), r.ref, r.opType, r.account, r.karat, r.in, r.out, r.balance, r.fine, r.by]),
                totals: ["", "", "الإجمالي", "", "", gold.totals.inFine, gold.totals.outFine, gold.totals.closingFine, "", ""],
                fileBase: "دفتر_الذهب" })}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>Excel</button>
              <button onClick={() => exportTablesPdf({ title: "دفتر الذهب بالعيار", subtitle: `من ${from} إلى ${to}`, branchName, landscape: true,
                sections: [{ headers: ["التاريخ", "المرجع", "العملية", "العيار", "دخول", "خروج", "الرصيد"],
                  rows: gold.rows.map((r) => [String(r.at).slice(0, 10), r.ref, r.opType, String(r.karat), fmtW(r.in), fmtW(r.out), fmtW(r.balance)]) }] })}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>PDF</button>
            </div>
            {gold.rows.length === 0 ? <p style={{ color: "var(--text3)" }} className="text-[11px]">لا حركات وزنية في الفترة</p>
              : gold.rows.map((r, i) => (
              <button key={`${r.id}-${i}`} onClick={() => setDetail(r)} className="w-full text-right">
                <Card style={{ padding: 9, marginBottom: 4 }}>
                  <div className="flex items-baseline gap-2">
                    <span style={{ color: "var(--text3)" }} className="text-[10px]">{String(r.at).slice(0, 10)}</span>
                    <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[10px]">{r.ref}</span>
                    <span style={{ color: "var(--text2)" }} className="text-[10px] flex-1 truncate">{r.note || r.opType}</span>
                    <span style={{ color: "var(--text3)" }} className="text-[10px]">ع{r.karat}</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span style={{ color: r.in ? "var(--good)" : "var(--bad)" }} className="text-[10px]">
                      {r.in ? `+${fmtW(r.in)}` : `−${fmtW(r.out)}`} جم
                    </span>
                    <span style={{ color: "var(--text)" }} className="text-[11px] font-bold">{fmtW(r.balance)} جم</span>
                  </div>
                </Card>
              </button>
            ))}
          </>
        )}

        {/* ── دفتر النقدية / الأجور ── */}
        {(tab === "cash" || tab === "wages") && (() => {
          const L = tab === "cash" ? cash : wages;
          const title = tab === "cash" ? "دفتر النقدية" : "دفتر الأجور";
          return (
            <>
              <Card style={{ padding: 11, marginBottom: 8 }}>
                <p style={{ color: "var(--accent)", margin: "0 0 6px" }} className="text-[11px] font-bold">{title} — بالحساب</p>
                {L.per.filter((p) => p.rows.length || p.opening).map((p) => (
                  <button key={p.code} onClick={() => { setCode(p.code); setTab("account"); }} className="w-full text-right">
                    <div className="flex items-baseline justify-between py-1" style={{ borderTop: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--text3)", fontFamily: "monospace" }} className="text-[10px]">{p.code}</span>
                      <span style={{ color: "var(--text)" }} className="text-[11px] flex-1 mr-2 truncate">{p.name}</span>
                      <span style={{ color: p.closing >= 0 ? "var(--text)" : "var(--bad)" }} className="text-[11px] font-bold">{money(p.closing)}</span>
                    </div>
                  </button>
                ))}
                <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[10px]">
                  مدين {money(L.totalDebit)} · دائن {money(L.totalCredit)} · اضغط حسابًا لكشفه
                </p>
              </Card>
              <div className="flex gap-2 mb-3">
                <button onClick={() => exportLedgerXlsx({ title, meta,
                  headers: ["التاريخ", "المرجع", "الحساب", "البيان", "بواسطة", "مدين", "دائن", "الرصيد"],
                  rows: L.rows.map((r) => [String(r.at).slice(0, 10), r.ref, `${r.account} ${r.accountName}`, r.note || r.opType, r.by, r.debit, r.credit, r.balance]),
                  totals: ["", "", "", "الإجمالي", "", L.totalDebit, L.totalCredit, ""], fileBase: title.replace(/\s+/g, "_") })}
                  className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                  style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>Excel</button>
                <button onClick={() => exportTablesPdf({ title, subtitle: `من ${from} إلى ${to}`, branchName, landscape: true,
                  sections: [{ headers: ["التاريخ", "المرجع", "الحساب", "البيان", "مدين", "دائن"],
                    rows: L.rows.map((r) => [String(r.at).slice(0, 10), r.ref, r.accountName, r.note || r.opType, fmtMoney(r.debit), fmtMoney(r.credit)]) }] })}
                  className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                  style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>PDF</button>
              </div>
              {L.rows.length === 0 ? <p style={{ color: "var(--text3)" }} className="text-[11px]">لا حركات في الفترة</p>
                : L.rows.map((r, i) => (
                <button key={`${r.id}-${i}`} onClick={() => setDetail(r)} className="w-full text-right">
                  <Card style={{ padding: 9, marginBottom: 4 }}>
                    <div className="flex items-baseline gap-2">
                      <span style={{ color: "var(--text3)" }} className="text-[10px]">{String(r.at).slice(0, 10)}</span>
                      <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[10px]">{r.ref}</span>
                      <span style={{ color: "var(--text2)" }} className="text-[10px] flex-1 truncate">{r.accountName}</span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span style={{ color: "var(--text3)" }} className="text-[10px] truncate flex-1">{r.note || r.opType}</span>
                      <span style={{ color: r.debit ? "var(--good)" : "var(--bad)" }} className="text-[11px] font-bold">
                        {r.debit ? `+${fmtMoney(r.debit)}` : `−${fmtMoney(r.credit)}`}
                      </span>
                    </div>
                  </Card>
                </button>
              ))}
            </>
          );
        })()}

        {tab === "tree" && (
          <>
            <Card style={{ padding: 11, marginBottom: 8,
              border: `1px solid ${tree.balanced ? "var(--goodLine)" : "var(--badLine)"}` }}>
              <div className="flex items-baseline justify-between">
                <span style={{ color: tree.balanced ? "var(--good)" : "var(--bad)" }}
                  className="text-[11px] font-bold">
                  {tree.balanced ? "✓ متوازن" : `⚠ فرق ${money(tree.difference)}`}
                </span>
                <span style={{ color: "var(--text3)" }} className="text-[10px]">
                  مدين {money(tree.totalDebit)} · دائن {money(tree.totalCredit)}
                </span>
              </div>
              {/* ⚠ التوازن يُحسب من الأوراق: جمعُ الآباء مع الأبناء يحسب
                  المبلغ مرتين ويُظهر خللًا لا وجود له. */}
            </Card>

            <input style={{ ...inputStyle, marginBottom: 8 }} value={q}
              onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالكود أو الاسم" />
            <div className="flex gap-1.5 mb-2">
              {[["moved", "المتحرّكة"], ["balance", "ذات الرصيد"], ["all", "الكل"]].map(([v, l]) => (
                <button key={v} onClick={() => setTreeView(v)} className="px-3 py-1.5 rounded-full text-[10px]"
                  style={{ background: treeView === v ? "var(--accentBg)" : "var(--field)",
                    color: treeView === v ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>{l}</button>
              ))}
              <span style={{ color: "var(--text3)", alignSelf: "center" }} className="text-[10px]">
                {shown.length} من {tree.rows.length}
              </span>
            </div>

            <div className="flex gap-2 mb-3">
              <button onClick={() => exportTree("xlsx")} className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                Excel
              </button>
              <button onClick={() => exportTree("pdf")} className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                PDF
              </button>
            </div>

            {shown.map((r) => (
              <button key={r.code} onClick={() => { setCode(r.code); setTab("account"); }}
                className="w-full text-right">
                <Card style={{ padding: 9, marginBottom: 4,
                  background: r.hasOwn ? "var(--panel)" : "var(--bg)" }}>
                  <div className="flex items-baseline gap-2"
                    style={{ paddingRight: Math.min(3, r.level) * 12 }}>
                    <span style={{ color: "var(--text3)", fontFamily: "monospace" }} className="text-[10px]">
                      {r.code}
                    </span>
                    <span style={{ color: r.hasOwn ? "var(--text)" : "var(--text2)" }}
                      className="text-[11px] font-bold flex-1 truncate">{r.name}</span>
                    <span style={{ color: r.closing >= 0 ? "var(--text)" : "var(--bad)" }}
                      className="text-[11px] font-bold">
                      {r.unit === "gram" ? `${fmtW(r.closing)} جم` : money(r.closing)}
                    </span>
                  </div>
                  {r.count > 0 && (
                    <p style={{ color: "var(--text3)", margin: "2px 0 0",
                      paddingRight: Math.min(3, r.level) * 12 }} className="text-[10px]">
                      افتتاحي {r.unit === "gram" ? fmtW(r.opening) : fmtMoney(r.opening)} ·
                      مدين {fmtMoney(r.debit)} · دائن {fmtMoney(r.credit)} · {r.count} حركة
                    </p>
                  )}
                </Card>
              </button>
            ))}
          </>
        )}

        {tab === "account" && (
          <>
            <Field label="الحساب">
              <select style={inputStyle} value={code} onChange={(e) => setCode(e.target.value)}>
                <option value="">— اختر حسابًا —</option>
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))}
              </select>
            </Field>

            {!led ? (
              <EmptyState icon={<FileText size={28} color="var(--accentSoft)" />}
                title="اختر حسابًا" sub="كل حركةٍ بمرجعها ورصيدٍ متتابع" />
            ) : (
              <>
                <Card style={{ padding: 12, marginBottom: 8 }}>
                  {[["الرصيد الافتتاحي", led.opening], ["إجمالي المدين", led.totalDebit],
                    ["إجمالي الدائن", led.totalCredit], ["الرصيد الختامي", led.closing]].map(([l, v], i) => (
                    <div key={l} className="flex items-baseline justify-between py-1"
                      style={i === 3 ? { borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 6 } : {}}>
                      <span style={{ color: "var(--text3)" }} className="text-[11px]">{l}</span>
                      <span style={{ color: i === 3 ? "var(--accent)" : "var(--text2)" }}
                        className={i === 3 ? "text-[13px] font-bold" : "text-[11px]"}>
                        {acc?.unit === "gram" ? `${fmtW(v)} جم` : money(v)}
                      </span>
                    </div>
                  ))}
                  {!led.consistent && (
                    <p style={{ color: "var(--bad)", margin: "6px 0 0" }} className="text-[10px]">
                      ⚠ الرصيد لا يتّسق مع الحركات — راجع الدفتر
                    </p>
                  )}
                  {/* ⚠ صفرٌ مع حركةٍ ليس عطلًا: الصندوق اليومي يُسلَّم للخزنة كل
                      مساء فيُقفل على صفر. بلا هذا السطر يظنّ المستخدم التقرير
                      معطّلًا ويُبلّغ عن عطلٍ لا وجود له. */}
                  {Math.abs(led.closing) < 0.005 && led.rows.length > 0 && (
                    <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[10px] leading-6">
                      الرصيد صفر و{led.rows.length} حركة في الفترة — الحساب اشتغل وأُقفل.
                      {["1130", "1140"].includes(code) && " الصندوق اليومي يُسلَّم للخزنة كل مساء فيبيت على صفر."}
                    </p>
                  )}
                </Card>

                <div className="flex gap-2 mb-3">
                  <button onClick={() => exportAcc("xlsx")} className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                    style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                    Excel
                  </button>
                  <button onClick={() => exportAcc("pdf")} className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                    style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                    PDF
                  </button>
                </div>

                {led.rows.length === 0 ? (
                  <p style={{ color: "var(--text3)" }} className="text-[11px]">لا حركات في هذه الفترة</p>
                ) : led.rows.map((r, i) => (
                  <button key={`${r.id}-${i}`} onClick={() => setDetail({ ...r, account: code, accountName: acc?.name })} className="w-full text-right">
                  <Card style={{ padding: 9, marginBottom: 4 }}>
                    <div className="flex items-baseline gap-2">
                      <span style={{ color: "var(--text3)" }} className="text-[10px]">
                        {String(r.at).slice(0, 10)}
                      </span>
                      <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[10px]">
                        {r.ref}
                      </span>
                      <span style={{ color: "var(--text2)" }} className="text-[10px] flex-1 truncate">
                        {r.note || r.opType}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span style={{ color: "var(--text3)" }} className="text-[10px]">
                        {r.debit > 0 ? `مدين ${fmtMoney(r.debit)}` : `دائن ${fmtMoney(r.credit)}`}
                        {r.by ? ` · ${r.by}` : ""}
                      </span>
                      <span style={{ color: "var(--text)" }} className="text-[11px] font-bold">
                        {acc?.unit === "gram" ? `${fmtW(r.balance)} جم` : money(r.balance)}
                      </span>
                    </div>
                  </Card>
                  </button>
                ))}
              </>
            )}
          </>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

export { GeneralLedgerPage };
