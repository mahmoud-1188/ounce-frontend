import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, FileSpreadsheet, FileText, Truck } from "lucide-react";
import * as XLSX from "xlsx";
import { fmt, fmtMoney, fmtW } from "../core/money.js";
import { buildSupplierStatement } from "../domain/buildSupplierStatement.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function SupplierLedgerPage({
  suppliers = [], lots = [], cashTx = [], safeTx = [], safeGoldTx = [], taskirEntries = [],
  currency, price24 = 0, branchName, onBack, flashToast, onFetchStatements = null,
}) {
  const [pick, setPick] = useState(null);          // معرّف المورد
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  // ⚠ المصادر كاملةً من الخادم (bootstrap يقصّ الحركات القديمة، فيخطئ
  //   الرصيد السابق). حتى تصل نعمل ببيانات bootstrap.
  const [full, setFull] = useState(null);
  useEffect(() => {
    let live = true;
    if (onFetchStatements) {
      onFetchStatements().then((d) => { if (live && d) setFull(d); }).catch(() => {});
    }
    return () => { live = false; };
  }, []);
  const src = full || { lots, taskirEntries, safeGoldTx, feeCashTx: [...cashTx, ...safeTx], ledger: null };

  const all = useMemo(
    () => suppliers.map((sup) => buildSupplierStatement(sup, {
      lots: src.lots, taskirEntries: src.taskirEntries, safeGoldTx: src.safeGoldTx,
      cashTx: src.feeCashTx, taskirFeesSettled: src.taskirFeesSettled || null, from, to,
    })).sort((a, b) => b.now.gold - a.now.gold),
    [suppliers, src, from, to]
  );
  // الرصيد الرسمي في دفتر الموردين على الخادم — للمطابقة مع الكشف
  const ledgerOf = (id) => (src.ledger || []).find((x) => x.supplierId === id) || null;
  const A = pick ? all.find((x) => x.sup.id === pick) : null;

  const totals = useMemo(() => ({
    gold: all.reduce((a, x) => a + x.now.gold, 0),
    fees: all.reduce((a, x) => a + x.now.fees, 0),
    withDebt: all.filter((x) => x.now.gold > 0.0005 || x.now.fees > 0.01).length,
  }), [all]);

  const cell = { border: "1px solid var(--line)", padding: "5px 6px", fontSize: 11, whiteSpace: "nowrap" };
  const head = { ...cell, background: "var(--panel)", color: "var(--accent)", fontWeight: 700, textAlign: "center" };

  // ── التصدير ──
  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const sum = [["دفتر الموردين"], [`من ${from} إلى ${to}`], [],
      ["المورد", "ذهب مستحق (جم24)", `أجور مستحقة (${currency})`, "دفعات الفترة", "وارد الفترة (جم24)"]];
    all.forEach((x) =>
      sum.push([x.sup.name, fmtW(x.now.gold), fmt(x.now.fees, 2), x.move.lots, fmtW(x.move.fineIn)]));
    sum.push([]);
    sum.push(["الإجمالي", fmtW(totals.gold), fmt(totals.fees, 2), "", ""]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), "الملخّص");

    all.forEach((x) => {
      if (!x.lines.length && !x.now.gold && !x.now.fees) return;
      const r = [[x.sup.name], [],
        ["التاريخ", "المرجع", "البيان", "العيار", "الوزن", "ذهب ± (جم24)", `أجور ± (${currency})`, `نقد (${currency})`, "رصيد الذهب", "رصيد الأجور", "ملاحظة"],
        ["", "", "رصيد سابق", "", "", "", "", "", fmtW(x.past.gold), fmt(x.past.fees, 2), ""]];
      x.lines.forEach((d) =>
        r.push([String(d.date).slice(0, 10), d.ref, d.kind, d.karat || "", d.weight ? fmtW(d.weight) : "",
          d.gold ? fmtW(d.gold) : "", d.fees ? fmt(d.fees, 2) : "", d.cash ? fmt(d.cash, 2) : "",
          fmtW(d.goldBal), fmt(d.feesBal, 2), d.note || ""]));
      r.push(["", "", "الرصيد الختامي", "", "", "", "", "", fmtW(x.now.gold), fmt(x.now.fees, 2), ""]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r), x.sup.name.slice(0, 28));
    });
    XLSX.writeFile(wb, `دفتر_الموردين_${to}.xlsx`);
  };

  const exportPdf = () => {
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const rows = (x) =>
      `<tr><td class="c">—</td><td class="c"></td><td class="r">رصيد سابق</td><td class="c"></td><td class="c"></td>` +
      `<td class="c">${fmtW(x.past.gold)}</td><td class="c">${fmt(x.past.fees, 2)}</td></tr>` +
      x.lines.map((d) =>
        `<tr><td class="c">${esc(String(d.date).slice(0, 10))}</td>` +
        `<td class="c">${esc(d.ref)}</td><td class="r">${esc(d.kind)}${d.karat ? ` · ع${d.karat} ${fmtW(d.weight)} جم` : ""}${d.note ? ` — ${esc(d.note)}` : ""}</td>` +
        `<td class="c">${d.gold ? (d.gold > 0 ? "+" : "−") + fmtW(Math.abs(d.gold)) : ""}</td>` +
        `<td class="c">${d.fees ? (d.fees > 0 ? "+" : "−") + fmt(Math.abs(d.fees), 2) : ""}</td>` +
        `<td class="c">${fmtW(d.goldBal)}</td><td class="c">${fmt(d.feesBal, 2)}</td></tr>`
      ).join("") +
      `<tr class="tot"><td colspan="5" class="r">الرصيد الختامي</td><td class="c">${fmtW(x.now.gold)}</td><td class="c">${fmt(x.now.fees, 2)}</td></tr>`;

    const blocks = (A ? [A] : all).filter((x) => x.lines.length || x.now.gold || x.now.fees)
      .map((x) => `
        <h2>${esc(x.sup.name)} <span class="ref">${esc(x.sup.ref || "")}</span></h2>
        <table class="bal"><tr>
          <td>رصيد سابق — ذهب</td><td class="c">${fmtW(x.past.gold)} جم24</td>
          <td>رصيد سابق — أجور</td><td class="c">${fmt(x.past.fees, 2)}</td>
        </tr><tr>
          <td>حركة الفترة — ذهب</td>
          <td class="c">+${fmtW(x.move.goldUp)} / −${fmtW(x.move.goldDown)}</td>
          <td>حركة الفترة — أجور</td>
          <td class="c">+${fmt(x.move.feesUp, 2)} / −${fmt(x.move.feesDown, 2)}</td>
        </tr><tr class="tot">
          <td>رصيد حالي — ذهب</td><td class="c">${fmtW(x.now.gold)} جم24</td>
          <td>رصيد حالي — أجور</td><td class="c">${fmt(x.now.fees, 2)}</td>
        </tr></table>
        <table><thead><tr>
          <th>التاريخ</th><th>المرجع</th><th>البيان</th>
          <th>ذهب ± (جم24)</th><th>أجور ± (${esc(currency)})</th><th>رصيد الذهب</th><th>رصيد الأجور</th>
        </tr></thead><tbody>${rows(x)}</tbody></table>
      `).join("");

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>دفتر الموردين</title><style>
  @page { size: A4; margin: 12mm; }
  body { font-family:"Tajawal","Segoe UI",sans-serif; color:#111; margin:0; font-size:11px; }
  h1 { font-size:17px; margin:0 0 2px; }
  h2 { font-size:12.5px; margin:16px 0 5px; padding-bottom:3px; border-bottom:1.5px solid #333; }
  .ref { color:#777; font-size:9px; font-family:monospace; }
  .sub { color:#555; font-size:10px; margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; margin-bottom:6px; }
  th,td { border:1px solid #bbb; padding:3px 5px; font-size:10px; }
  th { background:#eee; font-weight:700; }
  td.c { text-align:center; } td.r { text-align:right; }
  .bal td { background:#fafafa; }
  tr.tot td { font-weight:700; background:#f0f0f0; }
  .none { color:#888; font-size:10px; }
  .rule { color:#666; font-size:9px; margin-top:14px; padding-top:6px; border-top:1px solid #999; }
  .sign { margin-top:20px; display:flex; gap:28px; }
  .sign div { flex:1; border-top:1px solid #333; padding-top:3px; text-align:center; font-size:10px; }
</style></head><body>
<h1>دفتر الموردين — ${esc(branchName || "المحل")}</h1>
<div class="sub">من ${esc(from)} إلى ${esc(to)} · طُبع ${esc(new Date().toLocaleString("en-GB"))}</div>
${blocks}
<div class="rule">
  ⚖ التزام المورد ببُعدين: ذهبٌ بالجرام (2110) وأجورٌ بالعملة (2120) — لا يُجمعان.
  المورد لا يطالبك بريالات عن ذهب، بل بذهب عن ذهب.
</div>
<div class="sign"><div>أعدّه</div><div>راجعه</div><div>اعتمده</div></div>
<script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { flashToast("امنع حظر النوافذ المنبثقة"); return; }
    w.document.write(html); w.document.close();
  };

  return (
    <div>
      <SubPageHeader title={A ? A.sup.name : "دفتر الموردين"} onBack={A ? () => setPick(null) : onBack} />
      <div className="px-4 pt-3">
        {/* المدى */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Field label="من"><input style={inputStyle} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="إلى"><input style={inputStyle} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>

        {!A ? (
          <>
            {/* الإجمالي — دفتران */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Card style={{ padding: 12 }}>
                <p style={{ color: "var(--text2)" }} className="text-[11px]">ذهب مستحق</p>
                <p style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold">
                  {fmtW(totals.gold)} جم
                </p>
                <p style={{ color: "var(--text3)" }} className="text-[10px]">بعيار 24 · حساب 2110</p>
              </Card>
              <Card style={{ padding: 12 }}>
                <p style={{ color: "var(--text2)" }} className="text-[11px]">أجور مستحقة</p>
                <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold">
                  {currency}{fmt(totals.fees, 0)}
                </p>
                <p style={{ color: "var(--text3)" }} className="text-[10px]">بالعملة · حساب 2120</p>
              </Card>
            </div>
            <Card style={{ padding: 10, marginBottom: 12 }}>
              <p style={{ color: "var(--text2)" }} className="text-[11px]">
                ⚖ بُعدان لا يُجمعان — المورد يطالبك بذهب عن ذهب وبريال عن أجور.
                {totals.withDebt > 0 ? ` · ${totals.withDebt} مورد عليه رصيد.` : ""}
              </p>
            </Card>

            {/* قائمة الموردين */}
            {all.length === 0 ? (
              <EmptyState icon={<Truck size={30} color="var(--accentText)" />} title="لا موردين" sub="" />
            ) : (
              <div className="flex flex-col gap-2">
                {all.map((x) => {
                  const has = x.now.gold > 0.0005 || x.now.fees > 0.01;
                  return (
                    <button key={x.sup.id} onClick={() => setPick(x.sup.id)} className="w-full text-right">
                      <Card style={{ padding: 12, border: `1px solid ${has ? "var(--accentLine)" : "var(--line)"}` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold flex-1">
                            {x.sup.name}
                          </span>
                          <ChevronLeft size={15} color="var(--text3)" style={{ transform: "rotate(180deg)" }} />
                        </div>
                        <div className="flex items-center gap-3">
                          <span style={{ color: x.now.gold > 0.0005 ? "var(--accent)" : "var(--accentLine)" }} className="text-[11px]">
                            ذهب {fmtW(x.now.gold)} جم24
                          </span>
                          <span style={{ color: x.now.fees > 0.01 ? "var(--text)" : "var(--accentLine)" }} className="text-[11px]">
                            أجور {currency}{fmt(x.now.fees, 0)}
                          </span>
                        </div>
                        {x.move.lots > 0 && (
                          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                            {x.move.lots} دفعة بالفترة · وارد {fmtW(x.move.fineIn)} جم24
                          </p>
                        )}
                      </Card>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── حساب المورد: كصفحة اليومية ── */}
            <Card style={{ padding: 12, marginBottom: 12 }}>
              <p style={{ color: "var(--text3)" }} className="text-[10px]">{A.sup.ref}</p>
              {A.sup.phone && (
                <p style={{ color: "var(--text2)" }} className="text-[11px]">{A.sup.phone}</p>
              )}
            </Card>

            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">الأرصدة</p>
            <div style={{ overflowX: "auto", marginBottom: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 330 }}>
                <thead>
                  <tr>
                    <th style={head}>البيان</th>
                    <th style={head}>ذهب (جم24)</th>
                    <th style={head}>أجور ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["رصيد سابق", A.past.gold, A.past.fees, "var(--text2)"],
                    ["زيادة الفترة", A.move.goldUp, A.move.feesUp, "var(--bad)"],
                    ["سداد الفترة", -A.move.goldDown, -A.move.feesDown, "var(--goodSolid)"],
                    ["الرصيد الحالي", A.now.gold, A.now.fees, "var(--accent)"],
                  ].map(([l, g, f, c], i, arr) => (
                    <tr key={i}>
                      <td style={{ ...cell, color: i === arr.length - 1 ? "var(--text)" : "var(--text2)",
                        fontWeight: i === arr.length - 1 ? 700 : 400 }}>{l}</td>
                      <td style={{ ...cell, color: c, textAlign: "center",
                        fontWeight: i === arr.length - 1 ? 700 : 400 }}>{fmtW(g)}</td>
                      <td style={{ ...cell, color: c, textAlign: "center",
                        fontWeight: i === arr.length - 1 ? 700 : 400 }}>{fmt(f, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* مشترياته بالعيار */}
            {A.karats.length > 0 && (
              <>
                <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
                  مشتريات الفترة بالعيار
                </p>
                <div style={{ overflowX: "auto", marginBottom: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 340 }}>
                    <thead>
                      <tr>
                        <th style={{ ...head, width: 52 }}>العيار</th>
                        <th style={head}>الوزن</th>
                        <th style={head}>بعيار 24</th>
                        <th style={head}>منها آجل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {A.karats.map((k) => (
                        <tr key={k.karat}>
                          <td style={{ ...cell, color: "var(--accent)", fontWeight: 700, textAlign: "center" }}>{k.karat}</td>
                          <td style={{ ...cell, color: "var(--text)", textAlign: "center" }}>{fmtW(k.weight)}</td>
                          <td style={{ ...cell, color: "var(--text2)", textAlign: "center" }}>{fmtW(k.fine)}</td>
                          <td style={{ ...cell, color: k.deferred ? "var(--accentSoft)" : "var(--accentLine)", textAlign: "center" }}>
                            {k.deferred ? fmtW(k.deferred) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* كشف الحساب — متسلسلٌ برصيدٍ جارٍ ببُعدين */}
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
              كشف الحساب ({A.lines.length} حركة)
            </p>
            {A.lines.length === 0 ? (
              <Card style={{ padding: 11, marginBottom: 12 }}>
                <p style={{ color: "var(--text3)" }} className="text-[11px]">لا حركة في هذه الفترة — الرصيد الختامي هو الرصيد السابق</p>
              </Card>
            ) : (
              <div style={{ overflowX: "auto", marginBottom: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th style={head}>التاريخ</th>
                      <th style={head}>البيان</th>
                      <th style={head}>ذهب ± (جم24)</th>
                      <th style={head}>أجور ± ({currency})</th>
                      <th style={head}>رصيد الذهب</th>
                      <th style={head}>رصيد الأجور</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ ...cell, color: "var(--text3)" }}>—</td>
                      <td style={{ ...cell, color: "var(--text2)" }}>رصيد سابق</td>
                      <td style={cell} />
                      <td style={cell} />
                      <td style={{ ...cell, color: "var(--text2)", textAlign: "center" }}>{fmtW(A.past.gold)}</td>
                      <td style={{ ...cell, color: "var(--text2)", textAlign: "center" }}>{fmt(A.past.fees, 2)}</td>
                    </tr>
                    {A.lines.map((d) => (
                      <tr key={d.id}>
                        <td style={{ ...cell, color: "var(--text3)" }}>{new Date(d.date).toLocaleDateString("en-GB")}</td>
                        <td style={{ ...cell, color: "var(--text)" }}>
                          <span style={{ color: "var(--accentText)", fontFamily: "monospace" }}>{d.ref}</span> {d.kind}
                          {d.karat ? ` · ع${d.karat} ${fmtW(d.weight)} جم` : ""}
                          {d.cash ? ` · ${currency}${fmt(d.cash, 0)}` : ""}
                        </td>
                        <td style={{ ...cell, textAlign: "center", color: d.gold > 0 ? "var(--bad)" : d.gold < 0 ? "var(--goodSolid)" : "var(--text3)" }}>
                          {d.gold > 0 ? `+${fmtW(d.gold)}` : d.gold < 0 ? `−${fmtW(-d.gold)}` : "—"}
                        </td>
                        <td style={{ ...cell, textAlign: "center", color: d.fees > 0 ? "var(--bad)" : d.fees < 0 ? "var(--goodSolid)" : "var(--text3)" }}>
                          {d.fees > 0 ? `+${fmt(d.fees, 0)}` : d.fees < 0 ? `−${fmt(-d.fees, 0)}` : "—"}
                        </td>
                        <td style={{ ...cell, textAlign: "center", color: "var(--text)", fontWeight: 700 }}>{fmtW(d.goldBal)}</td>
                        <td style={{ ...cell, textAlign: "center", color: "var(--text)", fontWeight: 700 }}>{fmt(d.feesBal, 2)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ ...cell, background: "var(--panel)" }} colSpan={2}>
                        <span style={{ color: "var(--text)", fontWeight: 700 }}>الرصيد الختامي</span>
                        <span style={{ color: "var(--text3)" }}> — ما يُطالبك به المورد اليوم</span>
                      </td>
                      <td style={{ ...cell, background: "var(--panel)" }} colSpan={2} />
                      <td style={{ ...cell, background: "var(--panel)", textAlign: "center", color: "var(--accent)", fontWeight: 800 }}>{fmtW(A.now.gold)}</td>
                      <td style={{ ...cell, background: "var(--panel)", textAlign: "center", color: "var(--accent)", fontWeight: 800 }}>{fmt(A.now.fees, 2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
              ⚖ + يزيد ما عليك للمورد · − سداد. ذهبٌ بالجرام 24 وأجورٌ بالعملة — لا يُجمعان.
              {A.move.cashPaid > 0 ? ` · نقدٌ دُفع في الفترة ${currency}${fmtMoney(A.move.cashPaid)}` : ""}
            </p>
            {(() => {
              const L = ledgerOf(A.sup.id);
              if (!L || to < new Date().toISOString().slice(0, 10)) return null;
              const off = Math.abs(L.gold - A.now.gold) > 0.001 || Math.abs(L.fees - A.now.fees) > 0.01;
              return off ? (
                <Card style={{ padding: 10, marginBottom: 12, border: "1px solid var(--badLine)" }}>
                  <p style={{ color: "var(--bad)" }} className="text-[11px]">
                    ⚠ دفتر الموردين على الخادم: ذهب {fmtW(L.gold)} جم24 · أجور {currency}{fmt(L.fees, 2)} — يختلف عن الكشف. راجع الحركات.
                  </p>
                </Card>
              ) : null;
            })()}
          </>
        )}

        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={exportXlsx}
            className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button onClick={exportPdf}
            className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
            <FileText size={14} /> {A ? "كشف المورد" : "دفتر الموردين"}
          </button>
        </div>
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// دفتر مكاتب التسكير
//
// المكتب يسلّم الذهب للمورد نيابةً عنك، فينتقل التزامك إليه.
//
// ⚖ والالتزام بعيار 24 دائمًا: المكاتب تتعامل بالصافي لا بالعيار.
// تركه بعياره يعني رصيدًا لا يُقارن برصيد المكتب وخلافًا عند التصفية.
//
// وسداد المكتب ذهبٌ بذهب أو نقدٌ بسعر اليوم — والاثنان مفصولان.
// ============================================================

export { SupplierLedgerPage };
