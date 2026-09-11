import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { WEIGHT_UNITS, fine24, fmt, fmtMoney, fmtW, weightTimesPrice } from "../core/money.js";
import { auditJournal } from "../domain/auditJournal.js";
import { cashTrialBalance, exportTablesPdf, fmtWeight, journalTrialBalance, weightTrialBalance } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function TrialBalancePage({
  cashTx, safeTx, scrapCustodyTx, scrapEntries, safeGoldTx, items, sales,
  lots, weightAdjustments, goldLedger = [], journal = [], currency, price24, onBack, flashToast,
}) {
  // ⚖ ميزان القيود المزدوجة: يتوازن تمامًا أو فالدفتر معطوب
  const jTB = useMemo(() => journalTrialBalance(journal), [journal]);
  const jIssues = useMemo(() => auditJournal(journal), [journal]);
  const [ledger, setLedger] = useState("weight");
  const [unit, setUnit] = useState("g");

  const cashTB = useMemo(
    () => cashTrialBalance([...cashTx, ...safeTx, ...scrapCustodyTx]),
    [cashTx, safeTx, scrapCustodyTx]
  );
  const weightTB = useMemo(
    () => weightTrialBalance({ scrapEntries, safeGoldTx, items, sales, lots, weightAdjustments, goldLedger }),
    [scrapEntries, safeGoldTx, items, sales, lots, weightAdjustments, goldLedger]
  );

  const cell = { border: "1px solid var(--line)", padding: "5px 6px", fontSize: 11, whiteSpace: "nowrap" };
  const head = { ...cell, background: "var(--panel)", color: "var(--accent)", fontWeight: 700, textAlign: "center" };

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    // ورقة لكل دفتر — دمجهما في ورقة واحدة يوحي بأنهما ميزان واحد
    const wRows = [
      ["ميزان المراجعة الوزني — بالجرام الصافي عيار 24"],
      [],
      ["الحساب", "الكود", "العيار", "وارد", "منصرف", "الصافي", "صافي عيار 24"],
    ];
    weightTB.rows.forEach((r) =>
      wRows.push([r.name, r.code, r.karat, fmt(r.in), fmt(r.out), fmt(r.net), fmt(r.fineNet)])
    );
    wRows.push([]);
    wRows.push(["الإجمالي", "", "", fmt(weightTB.totals.fineIn), fmt(weightTB.totals.fineOut), "", fmt(weightTB.netFine)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wRows), "الميزان الوزني");

    const cRows = [
      [`ميزان المراجعة النقدي — ${currency}`],
      [],
      ["الحساب", "الكود", "مدين", "دائن", "الرصيد"],
    ];
    cashTB.rows.forEach((r) =>
      cRows.push([r.name, r.code || "", fmt(r.debit, 2), fmt(r.credit, 2), fmt(r.credit - r.debit, 2)])
    );
    cRows.push([]);
    cRows.push(["الإجمالي", "", fmt(cashTB.totals.debit, 2), fmt(cashTB.totals.credit, 2), fmt(cashTB.diff, 2)]);
    cRows.push(["التوازن", cashTB.balanced ? "متوازن" : "غير متوازن"]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cRows), "الميزان النقدي");

    XLSX.writeFile(wb, `ميزان_المراجعة_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <SubPageHeader title="ميزان المراجعة" onBack={onBack} />
      <div className="px-4 pt-3">
        <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
            دفتران مستقلان
          </p>
          <p style={{ color: "var(--text2)" }} className="text-[11px]">
            الوزن بالجرام الصافي والنقد بالعملة. لا يُجمعان ولا يُوازن أحدهما بالآخر —
            وزن الذهب حقيقة ثابتة وقيمته بالريال تتغيّر كل دقيقة.
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { id: "weight", label: "الميزان الوزني", hint: "بالجرام" },
            { id: "cash", label: "الميزان النقدي", hint: currency },
          ].map((t) => (
            <button key={t.id} onClick={() => setLedger(t.id)}
              className="py-2.5 rounded-xl text-[11px] font-bold text-right px-2.5"
              style={{
                background: ledger === t.id ? "var(--accentBg)" : "var(--panel)",
                color: ledger === t.id ? "var(--accent)" : "var(--text2)",
                border: `1px solid ${ledger === t.id ? "var(--accentLine)" : "var(--edge)"}`,
              }}>
              {t.label}
              <span style={{ color: "var(--text3)" }} className="block text-[10px]">{t.hint}</span>
            </button>
          ))}
        </div>

        {/* ── الميزان الوزني ── */}
        {ledger === "weight" && (
          <>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {WEIGHT_UNITS.map((u) => (
                <button key={u.id} onClick={() => setUnit(u.id)}
                  className="text-[10px] px-2.5 py-1 rounded-full"
                  style={{
                    background: unit === u.id ? "var(--accentBg)" : "var(--panel)",
                    color: unit === u.id ? "var(--accent)" : "var(--text2)",
                    border: "1px solid var(--line)",
                  }}>
                  {u.label}
                </button>
              ))}
            </div>

            <Card style={{ padding: 12, marginBottom: 12 }}>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text2)" }} className="text-[11px]">صافي الذهب</span>
                <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold">
                  {fmtWeight(weightTB.netFine, unit)}
                </span>
              </div>
              <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                وارد {fmtWeight(weightTB.totals.fineIn, unit)} · منصرف {fmtWeight(weightTB.totals.fineOut, unit)}
              </p>
              {price24 > 0 && (
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                  قيمته بسعر اليوم {currency}{fmt(weightTimesPrice(weightTB.netFine, price24), 0)} — للعلم لا للجمع
                </p>
              )}
            </Card>

            <p style={{ color: "var(--text3)" }} className="text-[10px] mb-2">
              {weightTB.rows.some((r) => r.fromLedger)
                ? "المصدر: دفتر الوزن — قيود مسجّلة"
                : "المصدر: مشتقّ من المستندات — لا قيود وزنية بعد"}
            </p>

            {/* ── ميزان القيود المزدوجة ── */}
            {jTB.entries > 0 && (
              <Card style={{ padding: 12, marginBottom: 10,
                border: `1px solid ${jTB.balanced ? "var(--goodLine)" : "var(--badLine)"}` }}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: "var(--accent)" }} className="text-[11px] font-bold">
                    دفتر القيود المزدوجة
                  </span>
                  <span style={{ color: jTB.balanced ? "var(--goodSolid)" : "var(--bad)" }}
                    className="text-xs font-bold">
                    {jTB.balanced ? "متوازن" : `فرق ${fmtMoney(jTB.diff)}`}
                  </span>
                </div>
                <p style={{ color: "var(--text2)" }} className="text-[11px]">
                  مدين {currency}{fmtMoney(jTB.totals.debit)} · دائن {currency}{fmtMoney(jTB.totals.credit)}
                </p>
                <p style={{ color: "var(--text3)" }} className="text-[10px]">
                  {jTB.entries} قيدًا · منها {jTB.reversals} عكسيًا
                </p>
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                  ⚖ كل قيد بطرفين متساويين — والتصحيح بقيد عكسي لا بتعديل.
                </p>
                {jIssues.length > 0 && (
                  <p style={{ color: "var(--bad)" }} className="text-[10px] mt-1 font-bold">
                    ⚠ {jIssues.length} خلل: {jIssues[0].why}
                  </p>
                )}
              </Card>
            )}

            {weightTB.flows?.length > 0 && (
              <Card style={{ padding: 10, marginBottom: 10 }}>
                <p style={{ color: "var(--text2)" }} className="text-[11px] font-bold mb-1">
                  تدفّقات الفترة ({weightTB.flows.length})
                </p>
                {weightTB.flows.map((r, i) => (
                  <p key={i} style={{ color: "var(--text2)" }} className="text-[10px]">
                    {r.name} عيار {r.karat}: {fmtW(Math.abs(r.net))} جم
                    {r.net < 0 ? " خروج" : " دخول"}
                  </p>
                ))}
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                  ⚖ هذه حركات لا أرصدة — إشارتها اتجاه لا نقص.
                </p>
              </Card>
            )}

            {weightTB.liabilities?.length > 0 && (
              <Card style={{ padding: 10, marginBottom: 10 }}>
                <p style={{ color: "var(--text2)" }} className="text-[11px] font-bold mb-1">
                  التزامات ({weightTB.liabilities.length})
                </p>
                {weightTB.liabilities.map((r, i) => (
                  <p key={i} style={{ color: "var(--text2)" }} className="text-[10px]">
                    {r.name} عيار {r.karat}: {fmtW(Math.abs(r.net))} جم عليك
                  </p>
                ))}
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                  ⚖ الالتزام سالب بطبيعته — عليك لا لك.
                </p>
              </Card>
            )}

            {weightTB.negatives.length > 0 && (
              <Card style={{ padding: 10, marginBottom: 10, border: "1px solid var(--badLine)" }}>
                <p style={{ color: "var(--bad)" }} className="text-[11px] font-bold">
                  ⚠ {weightTB.negatives.length} حساب أصل برصيد سالب — صُرف ما لا تملك
                </p>
                {weightTB.negatives.map((r, i) => (
                  <p key={i} style={{ color: "var(--text2)" }} className="text-[10px] mt-0.5">
                    {r.name} عيار {r.karat}: {fmtW(r.net)} جم — صُرف أكثر مما دخل
                  </p>
                ))}
              </Card>
            )}

            {/* الأرصدة بالعيار */}
            <p style={{ color: "var(--text2)" }} className="text-xs mb-2">الأرصدة حسب العيار</p>
            <div style={{ overflowX: "auto", marginBottom: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 380 }}>
                <thead>
                  <tr>
                    <th style={{ ...head, width: 60 }}>العيار</th>
                    <th style={head}>وارد</th>
                    <th style={head}>منصرف</th>
                    <th style={head}>الصافي</th>
                    <th style={head}>عيار 24</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(weightTB.byKarat)
                    .sort((a, b) => Number(b[0]) - Number(a[0]))
                    .map(([k, v]) => {
                      const net = v.in - v.out;
                      return (
                        <tr key={k}>
                          <td style={{ ...cell, color: "var(--accent)", fontWeight: 700, textAlign: "center" }}>{k}</td>
                          <td style={{ ...cell, color: "var(--good)", textAlign: "center" }}>{fmt(v.in)}</td>
                          <td style={{ ...cell, color: "var(--bad)", textAlign: "center" }}>{fmt(v.out)}</td>
                          <td style={{ ...cell, color: net >= 0 ? "var(--text)" : "var(--bad)", textAlign: "center", fontWeight: 700 }}>
                            {fmt(net)}
                          </td>
                          <td style={{ ...cell, color: "var(--text2)", textAlign: "center" }}>{fmt(fine24(net, k))}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* التفصيل بالحساب */}
            <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
              التفصيل بالحساب ({weightTB.rows.length})
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460 }}>
                <thead>
                  <tr>
                    <th style={{ ...head, width: 48 }}>الكود</th>
                    <th style={head}>الحساب</th>
                    <th style={{ ...head, width: 46 }}>العيار</th>
                    <th style={head}>الصافي</th>
                    <th style={head}>عيار 24</th>
                  </tr>
                </thead>
                <tbody>
                  {weightTB.rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ ...cell, color: "var(--accentText)", fontFamily: "monospace", textAlign: "center" }}>{r.code}</td>
                      <td style={{ ...cell, color: "var(--text)", whiteSpace: "normal" }}>{r.name}</td>
                      <td style={{ ...cell, color: "var(--text2)", textAlign: "center" }}>{r.karat}</td>
                      <td style={{ ...cell, color: r.net >= 0 ? "var(--text)" : "var(--bad)", textAlign: "center" }}>
                        {fmt(r.net)}
                      </td>
                      <td style={{ ...cell, color: "var(--text2)", textAlign: "center" }}>{fmt(r.fineNet)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={head} colSpan={3}>الإجمالي</td>
                    <td style={{ ...head, textAlign: "center" }}>—</td>
                    <td style={{ ...head, textAlign: "center" }}>{fmt(weightTB.netFine)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2">
              ⚠ الميزان الوزني لا «يتوازن» كالنقدي — أصوله والتزاماته بوحدة واحدة
              فلا يتقابلان. والفحص هو غياب الأصل السالب، لا الالتزام السالب فهو طبيعي.
            </p>
          </>
        )}

        {/* ── الميزان النقدي ── */}
        {ledger === "cash" && (
          <>
            <Card
              style={{
                padding: 12, marginBottom: 12,
                border: `1px solid ${cashTB.balanced ? "var(--goodLine)" : "var(--badLine)"}`,
              }}
            >
              <div className="flex items-center justify-between">
                <span style={{ color: cashTB.balanced ? "var(--goodSolid)" : "var(--bad)" }} className="text-xs font-bold flex items-center gap-1.5">
                  {cashTB.balanced ? <Check size={14} /> : <AlertTriangle size={14} />}
                  {cashTB.balanced ? "متوازن" : "غير متوازن"}
                </span>
                {!cashTB.balanced && (
                  <span style={{ color: "var(--bad)" }} className="text-xs font-bold">
                    فرق {currency}{fmt(Math.abs(cashTB.diff), 2)}
                  </span>
                )}
              </div>
              <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                وارد {currency}{fmt(cashTB.totals.credit, 2)} · منصرف {currency}{fmt(cashTB.totals.debit, 2)}
                {" "}· الصافي {currency}{fmt(cashTB.net, 2)}
              </p>
              <p style={{ color: "var(--text3)" }} className="text-[10px]">
                رصيد الصناديق {currency}{fmt(cashTB.poolNet, 2)}
              </p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                {cashTB.balanced
                  ? "صافي الحركات المصنّفة يساوي رصيد الصناديق."
                  : "الفرق يعني حركة لم تُصنَّف أو صندوقًا لم يُحدَّث."}
              </p>
            </Card>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 470 }}>
                <thead>
                  <tr>
                    <th style={{ ...head, width: 48 }}>الكود</th>
                    <th style={head}>الحساب</th>
                    <th style={head}>مدين</th>
                    <th style={head}>دائن</th>
                    <th style={head}>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {cashTB.rows.map((r, i) => {
                    const bal = r.credit - r.debit;
                    return (
                      <tr key={i}>
                        <td style={{ ...cell, color: r.code ? "var(--accentSoft)" : "var(--bad)", fontFamily: "monospace", textAlign: "center" }}>
                          {r.code || "—"}
                        </td>
                        <td style={{ ...cell, color: "var(--text)", whiteSpace: "normal" }}>
                          {r.name}
                          {r.count > 1 && <span style={{ color: "var(--text3)" }} className="text-[10px]"> ({r.count})</span>}
                        </td>
                        <td style={{ ...cell, color: r.debit ? "var(--bad)" : "var(--accentLine)", textAlign: "center" }}>
                          {r.debit ? fmt(r.debit, 0) : "—"}
                        </td>
                        <td style={{ ...cell, color: r.credit ? "var(--goodSolid)" : "var(--accentLine)", textAlign: "center" }}>
                          {r.credit ? fmt(r.credit, 0) : "—"}
                        </td>
                        <td style={{ ...cell, color: bal >= 0 ? "var(--text)" : "var(--bad)", textAlign: "center", fontWeight: 700 }}>
                          {fmt(bal, 0)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td style={head} colSpan={2}>الإجمالي</td>
                    <td style={{ ...head, textAlign: "center" }}>{fmt(cashTB.totals.debit, 0)}</td>
                    <td style={{ ...head, textAlign: "center" }}>{fmt(cashTB.totals.credit, 0)}</td>
                    <td style={{ ...head, textAlign: "center", color: cashTB.balanced ? "var(--goodSolid)" : "var(--bad)" }}>
                      {fmt(cashTB.diff, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {cashTB.rows.some((r) => !r.code) && (
              <p style={{ color: "var(--bad)" }} className="text-[10px] mt-2">
                ⚠ توجد تصنيفات غير مربوطة بحساب في الشجرة.
              </p>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={exportXlsx}
            className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button
            onClick={() =>
              exportTablesPdf({
                title: "ميزان المراجعة المزدوج",
                subtitle: `صافي الذهب ${fmtW(weightTB.netFine)} جم24`,
                landscape: true,
                onBlocked: flashToast,
                sections: [
                  {
                    title: "الميزان الوزني — بالجرام الصافي",
                    headers: ["الحساب", "الكود", "العيار", "الصافي", "بعيار 24"],
                    rows: weightTB.rows.map((r) => [r.name, r.code, r.karat, fmtW(r.net), fmtW(r.fineNet)])
                      .concat([["الإجمالي", "", "", "", fmtW(weightTB.netFine)]]),
                    note: "⚖ لا يتوازن كالنقدي — أصوله والتزاماته بوحدة واحدة. الفحص غياب الأصل السالب.",
                  },
                  {
                    title: `الميزان النقدي — ${currency}`,
                    headers: ["الحساب", "الكود", "وارد", "منصرف", "الرصيد"],
                    rows: cashTB.rows.map((r) => [r.name, r.code || "—",
                      fmtMoney(r.credit), fmtMoney(r.debit), fmtMoney(r.credit - r.debit)])
                      .concat([["الإجمالي", "", fmtMoney(cashTB.totals.credit),
                        fmtMoney(cashTB.totals.debit), fmtMoney(cashTB.net)]]),
                    note: cashTB.balanced
                      ? "صافي الحركات المصنّفة يساوي رصيد الصناديق."
                      : "⚠ فرق — حركة لم تُصنَّف أو صندوق لم يُحدَّث.",
                  },
                ],
              })
            }
            className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
            <FileText size={14} /> PDF
          </button>
        </div>
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// البحث الشامل والتتبّع
//
// أي حرف يوصلك لأي سجل: مرجع · اسم · مبلغ · وزن · تاريخ · عيار.
// وكل سجل يفتح سلسلته: من أين جاء وماذا تفرّع عنه.
// ============================================================
/// ⚠ يؤخّر القيمة حتى يتوقف الكتابة.
///
/// البحث على كل ضغطة يعني إعادة فرز الفهرس كاملًا مع كل حرف: خمسة
/// أحرف = خمس عمليات، وأربع منها نتيجتها تُرمى قبل أن تُرى. والحقل
/// يتلعثم تحت الإصبع.

export { TrialBalancePage };
