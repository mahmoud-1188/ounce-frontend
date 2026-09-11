import React, { useMemo, useState } from "react";
import { ChevronLeft, FileSpreadsheet, FileText, Truck } from "lucide-react";
import * as XLSX from "xlsx";
import { fine24, fmt, fmtW } from "../core/money.js";
import { accountLabel, inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function SupplierLedgerPage({
  suppliers = [], lots = [], cashTx = [], safeTx = [], scrapEntries = [],
  taskirOfficeTx = [], currency, price24 = 0, branchName, onBack, flashToast,
}) {
  const [pick, setPick] = useState(null);          // معرّف المورد
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const inRange = (d) => {
    const x = String(d || "").slice(0, 10);
    return x >= from && x <= to;
  };
  const before = (d) => String(d || "").slice(0, 10) < from;

  // ── حساب كل مورد ──
  //
  // الدفعة الآجلة تُنشئ التزامًا؛ السداد يُنقصه. والأجور مسار مستقل.
  const build = (sup) => {
    const mine = lots.filter((l) => l.supplierId === sup.id);
    const pays = [...cashTx, ...safeTx].filter(
      (t) => t.supplierId === sup.id || (t.refId && mine.some((l) => l.id === t.refId))
    );
    const settleScrap = scrapEntries.filter(
      (e) => e.supplierId === sup.id && (Number(e.weight) || 0) < 0
    );

    const goldUp = (arr) =>
      arr.filter((l) => l.paymentMethod === "deferred")
        .reduce((a, l) => a + fine24(l.weight, l.karat), 0);
    const feesUp = (arr) =>
      arr.filter((l) => l.paymentMethod === "deferred")
        .reduce((a, l) => a + (Number(l.workmanship) || 0), 0);
    const goldDown = (arr) => arr.reduce((a, e) => a + fine24(-e.weight, e.karat), 0);
    const feesDown = (arr) =>
      arr.filter((t) => t.type === "out" && /workmanship|supplier_fee/.test(t.category || ""))
        .reduce((a, t) => a + (Number(t.amount) || 0), 0);

    const past = {
      gold: goldUp(mine.filter((l) => before(l.date))) - goldDown(settleScrap.filter((e) => before(e.date))),
      fees: feesUp(mine.filter((l) => before(l.date))) - feesDown(pays.filter((t) => before(t.date))),
    };
    const nowLots = mine.filter((l) => inRange(l.date));
    const nowScrap = settleScrap.filter((e) => inRange(e.date));
    const nowPays = pays.filter((t) => inRange(t.date));
    const move = {
      goldUp: goldUp(nowLots), goldDown: goldDown(nowScrap),
      feesUp: feesUp(nowLots), feesDown: feesDown(nowPays),
      cashPaid: nowLots.filter((l) => l.paymentMethod !== "deferred")
        .reduce((a, l) => a + (Number(l.goldCost) || 0) + (Number(l.workmanship) || 0), 0),
      lots: nowLots.length,
      fineIn: nowLots.reduce((a, l) => a + fine24(l.weight, l.karat), 0),
    };

    // الأوزان بالعيار — كما في اليومية
    const byKarat = {};
    nowLots.forEach((l) => {
      const k = Number(l.karat) || 21;
      byKarat[k] = byKarat[k] || { karat: k, weight: 0, fine: 0, lots: 0, deferred: 0 };
      byKarat[k].weight += Number(l.weight) || 0;
      byKarat[k].fine += fine24(l.weight, l.karat);
      byKarat[k].lots += 1;
      if (l.paymentMethod === "deferred") byKarat[k].deferred += fine24(l.weight, l.karat);
    });

    return {
      sup, past, move,
      karats: Object.values(byKarat).sort((a, b) => b.karat - a.karat),
      now: {
        gold: past.gold + move.goldUp - move.goldDown,
        fees: past.fees + move.feesUp - move.feesDown,
      },
      docs: [
        ...nowLots.map((l) => ({
          id: l.id, ref: l.ref, date: l.date, kind: "شراء",
          karat: l.karat, fine: fine24(l.weight, l.karat),
          cash: l.paymentMethod === "deferred" ? 0 : (Number(l.goldCost) || 0) + (Number(l.workmanship) || 0),
          deferred: l.paymentMethod === "deferred",
          note: l.paymentMethod === "deferred" ? "آجل" : "مسدَّد",
        })),
        ...nowScrap.map((e) => ({
          id: e.id, ref: e.ref, date: e.date, kind: "سداد بالكسر",
          karat: e.karat, fine: fine24(-e.weight, e.karat), cash: 0, settle: true, note: "",
        })),
        ...nowPays.filter((t) => t.type === "out").map((t) => ({
          id: t.id, ref: t.ref || t.id, date: t.date, kind: "سداد نقدي",
          karat: null, fine: 0, cash: Number(t.amount) || 0, settle: true,
          note: accountLabel(t.category),
        })),
      ].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    };
  };

  const all = useMemo(
    () => suppliers.map(build).sort((a, b) => b.now.gold - a.now.gold),
    [suppliers, lots, cashTx, safeTx, scrapEntries, from, to]
  );
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
      if (!x.docs.length) return;
      const r = [[x.sup.name], [], ["رصيد سابق — ذهب", fmtW(x.past.gold)], ["رصيد سابق — أجور", fmt(x.past.fees, 2)], [],
        ["التاريخ", "المرجع", "النوع", "العيار", "الوزن (جم24)", `النقد (${currency})`, "ملاحظة"]];
      x.docs.forEach((d) =>
        r.push([String(d.date).slice(0, 10), d.ref, d.kind, d.karat || "",
          d.fine ? fmtW(d.fine) : "", d.cash ? fmt(d.cash, 2) : "", d.note]));
      r.push([]);
      r.push(["رصيد حالي — ذهب", fmtW(x.now.gold)]);
      r.push(["رصيد حالي — أجور", fmt(x.now.fees, 2)]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r), x.sup.name.slice(0, 28));
    });
    XLSX.writeFile(wb, `دفتر_الموردين_${to}.xlsx`);
  };

  const exportPdf = () => {
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const rows = (x) =>
      x.docs.map((d) =>
        `<tr><td class="c">${esc(String(d.date).slice(0, 10))}</td>` +
        `<td class="c">${esc(d.ref)}</td><td class="r">${esc(d.kind)}${d.note ? ` — ${esc(d.note)}` : ""}</td>` +
        `<td class="c">${d.karat || ""}</td>` +
        `<td class="c">${d.fine ? (d.settle ? "−" : "+") + fmtW(d.fine) : ""}</td>` +
        `<td class="c">${d.cash ? fmt(d.cash, 2) : ""}</td></tr>`
      ).join("");

    const blocks = (A ? [A] : all).filter((x) => x.docs.length || x.now.gold || x.now.fees)
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
        ${x.docs.length ? `<table><thead><tr>
          <th>التاريخ</th><th>المرجع</th><th>البيان</th><th>العيار</th>
          <th>الذهب (جم24)</th><th>النقد (${esc(currency)})</th>
        </tr></thead><tbody>${rows(x)}</tbody></table>` : `<p class="none">لا حركة في الفترة</p>`}
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

            {/* حركاته */}
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
              حركة الفترة ({A.docs.length})
            </p>
            {A.docs.length === 0 ? (
              <Card style={{ padding: 11, marginBottom: 12 }}>
                <p style={{ color: "var(--text3)" }} className="text-[11px]">لا حركة في هذه الفترة</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {A.docs.map((d) => (
                  <Card key={d.id} style={{ padding: 10 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[10px]">{d.ref}</span>
                      <span style={{ color: "var(--text)" }} className="text-xs flex-1">
                        {d.kind}
                        {d.karat ? ` · عيار ${d.karat}` : ""}
                      </span>
                      {d.fine > 0 && (
                        <span style={{ color: d.settle ? "var(--goodSolid)" : "var(--bad)" }} className="text-[11px]">
                          {d.settle ? "−" : "+"}{fmtW(d.fine)} جم
                        </span>
                      )}
                      {d.cash > 0 && (
                        <span style={{ color: "var(--text2)" }} className="text-[11px]">
                          {currency}{fmt(d.cash, 0)}
                        </span>
                      )}
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                      {new Date(d.date).toLocaleDateString("en-GB")}
                      {d.note ? ` · ${d.note}` : ""}
                      {d.deferred ? " · لا نقد — التزام" : ""}
                    </p>
                  </Card>
                ))}
              </div>
            )}
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
