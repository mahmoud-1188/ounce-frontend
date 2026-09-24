import React, { useEffect, useMemo, useState } from "react";
import { fine24, fmtMoney, fmtW, roundW, sumMoney } from "../core/money.js";
import { buildSupplierStatement } from "../domain/buildSupplierStatement.js";
import { reviewSummary, saleProfitOf } from "../domain/helpers.js";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function BranchDashboardPage({ totals, sales = [], returns = [], lots = [], expenses = [], journal = [], audits = [], suppliers = [],
  taskirEntries = [], cashTx = [], safeTx = [], safeGoldTx = [], scrapEntries = [], cashBalance = {}, safeBalance = {}, custodyBalance = {},
  reviewQueue = [], priceData = {}, openDay = null, branchName = "", onFetchStatements = null, onGo, onBack }) {
  const [period, setPeriod] = useState("month");
  // ⚠ أرصدة الموردين من مصادرها كاملةً (كشف المورد نفسه): bootstrap يقصّ
  //   الحركات القديمة، فرصيدٌ يُبنى منها وحدها يختلف عن تقريره.
  const [full, setFull] = useState(null);
  useEffect(() => {
    let live = true;
    if (onFetchStatements) onFetchStatements().then((d) => { if (live && d) setFull(d); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const currency = priceData.currency || "ر.س";
  // ⚠ `inPeriod` يعرف اليوم والشهر فقط؛ الأسبوع والسنة هنا بتاريخ التقويم
  const inP = (iso) => {
    const d = new Date(iso), now = new Date();
    if (Number.isNaN(d.getTime())) return false;
    if (period === "today") return d.toDateString() === now.toDateString();
    if (period === "week") return now.getTime() - d.getTime() <= 7 * 864e5 && d <= now;
    if (period === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    return d.getFullYear() === now.getFullYear();
  };
  const D = useMemo(() => {
    const ps = sales.filter((x) => !x.voided && inP(x.date));
    const pr = returns.filter((x) => inP(x.date));
    const pl = lots.filter((l) => l.source !== "opening" && !l.voided && inP(l.date));
    const pe = expenses.filter((x) => !x.voided && inP(x.date));
    const salesSum = sumMoney(ps.map((x) => x.total));
    const returnsSum = sumMoney(pr.map((x) => x.refund));
    const purchases = sumMoney(pl.map((l) => l.totalCost));
    const purchasesFine = roundW(pl.reduce((a, l) => a + fine24(l.weight, l.karat), 0));
    const expensesSum = sumMoney(pe.map((x) => x.amount));
    const profit = sumMoney(ps.map((x) => saleProfitOf(x)));
    const ar = journal.reduce((a, e) => a + (e.lines || []).filter((l) => l.account === "1310").reduce((b, l) => b + (Number(l.debit) || 0) - (Number(l.credit) || 0), 0), 0);
    const src = full || { lots, taskirEntries, safeGoldTx, feeCashTx: [...cashTx, ...safeTx] };
    const sup = suppliers.map((sp) => buildSupplierStatement(sp, { lots: src.lots, taskirEntries: src.taskirEntries,
      safeGoldTx: src.safeGoldTx, cashTx: src.feeCashTx, taskirFeesSettled: src.taskirFeesSettled || null }));
    const supGold = roundW(sup.reduce((a, x) => a + x.now.gold, 0));
    const supFees = sumMoney(sup.map((x) => x.now.fees));
    const varianceAudits = audits.filter((a) => (a.entries || []).some((en) => (Number(en.countedQty) || 0) !== (Number(en.systemQty) || 0)));
    const rq = reviewSummary(reviewQueue);
    return { ps, salesSum, returnsSum, purchases, purchasesFine, expensesSum, profit, ar: sumMoney([ar]), supGold, supFees, varianceAudits, rq };
  }, [sales, returns, lots, expenses, journal, audits, suppliers, taskirEntries, cashTx, safeTx, scrapEntries, reviewQueue, period, full]);

  const Tile = ({ label, value, sub, color = "var(--text)", page }) => (
    <button onClick={() => page && onGo && onGo(page)} className="text-right" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: "10px 12px" }}>
      <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">{label}</p>
      <p style={{ color, fontFamily: "'Cairo', sans-serif", margin: 0, fontVariantNumeric: "tabular-nums" }} className="text-base font-extrabold">{value}</p>
      {sub && <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">{sub}</p>}
    </button>
  );
  const P = (v) => `${currency}${fmtMoney(v)}`;
  return (
    <div>
      <SubPageHeader title="لوحة التحكم" onBack={onBack} />
      <div className="px-4 pt-2">
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
          {branchName || "المحل"} · سعر جم24 اليوم {currency}{fmtMoney(priceData.current || 0)} · {openDay ? `يوم مفتوح ${openDay.ref}` : "لا يوم عمل مفتوح"}
        </p>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {[["today", "اليوم"], ["week", "الأسبوع"], ["month", "الشهر"], ["year", "السنة"]].map(([id, l]) => (
            <button key={id} onClick={() => setPeriod(id)} className="py-1.5 rounded-xl text-[11px] font-bold"
              style={{ background: period === id ? "var(--accentBg)" : "var(--panel)", color: period === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
          ))}
        </div>

        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">الحركة</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Tile label="المبيعات" value={P(D.salesSum)} sub={`${D.ps.length} فاتورة${D.returnsSum ? ` · مرتجع ${fmtMoney(D.returnsSum)}` : ""}`} color="var(--goodSolid)" page="salesHistory" />
          <Tile label="المشتريات" value={P(D.purchases)} sub={`${fmtW(D.purchasesFine)} جم24`} page="purchases" />
          <Tile label="ربح المبيعات" value={P(D.profit)} sub="على تكلفة القطع المباعة" color={D.profit >= 0 ? "var(--goodSolid)" : "var(--bad)"} page="masterReport" />
          <Tile label="المصروفات" value={P(D.expensesSum)} color="var(--bad)" page="expenses" />
        </div>

        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">المخزون</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Tile label="قيمة المخزون بسعر اليوم" value={P(totals?.value || 0)} sub={`التكلفة ${fmtMoney(totals?.cost || 0)}`} page="inventory" />
          <Tile label="وزن الذهب بالمخزون" value={`${fmtW(totals?.weight || 0)} جم`} sub={`${fmtW(totals?.fineWeight || 0)} جم24 · ${totals?.pieces || 0} قطعة`} page="inventory" />
        </div>

        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">النقد والخزائن</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Tile label="الصندوق اليومي" value={P(cashBalance?.cash || 0)} sub={`شبكة ${fmtMoney(cashBalance?.network || 0)}`} page="cash" />
          <Tile label="الخزنة" value={P(safeBalance?.cash || 0)} sub={`شبكة ${fmtMoney(safeBalance?.network || 0)}${custodyBalance?.cash != null ? ` · عهدة الكسر ${fmtMoney(custodyBalance.cash || 0)}` : ""}`} page="cash" />
        </div>

        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">الأرصدة</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Tile label="على العملاء (آجل)" value={P(D.ar)} sub="ميزان 1310" color={D.ar > 0 ? "var(--accent)" : "var(--text)"} page="customers" />
          <Tile label="للموردين" value={`${fmtW(D.supGold)} جم24`} sub={`أجور ${fmtMoney(D.supFees)}`} color={D.supGold > 0 ? "var(--bad)" : "var(--text)"} page="supplierLedger" />
        </div>

        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">الرقابة</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Tile label="يحتاج مراجعة محاسبية" value={String(D.rq.total)} sub={`${D.rq.block} يمنع الإقفال · ${D.rq.warn} يحتاج مراجعة`} color={D.rq.block ? "var(--bad)" : D.rq.warn ? "var(--accent)" : "var(--goodSolid)"} page="accountantReview" />
          <Tile label="جرد بفروقات" value={String(D.varianceAudits.length)} sub={`من ${audits.length} جرد`} color={D.varianceAudits.length ? "var(--accent)" : "var(--text)"} page="stocktake" />
        </div>
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-4">
          ⚖ كل رقمٍ هنا هو رقم تقريره: اضغط البطاقة لتصل إليه. الوزن بالجرام والمال بالعملة — لا يُجمعان.
        </p>
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

export { BranchDashboardPage };
