import React, { useState } from "react";
import { FileSpreadsheet, FileText, Receipt, Users } from "lucide-react";
import * as XLSX from "xlsx";
import { COMMISSION_BASES, DEFAULT_COMMISSION, PERIODS } from "../core/erp.js";
import { fmt, fmtMoney, fmtW } from "../core/money.js";
import { computeCommission } from "../domain/computeCommission.js";
import { exportTablesPdf, inPeriod, saleProfitOf, saleProfitSplit } from "../domain/helpers.js";
import { key } from "../domain/key.js";
import { Card } from "../ui/Card.jsx";
import { CommissionRuleForm } from "../ui/CommissionRuleForm.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Stat } from "../ui/Stat.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function SellerReportsPage({ sales, users, commissions, expenses = [], currency, price24, canManage, onSaveCommission, onBack, flashToast }) {
  // حساب الموظف المالي: ما استحقه (عمولة) مقابل ما استلمه (راتب + سلف).
  // عرضهما منفصلين يخفي السؤال الحقيقي: هل هو دائن أم مدين للمحل؟
  const payrollFor = (userId) => {
    const mine = expenses.filter((e) => e.employeeId === userId);
    const inP = (d) => inPeriod(d, period);
    const salary = mine.filter((e) => e.category === "salaries" && inP(e.date)).reduce((a, e) => a + e.amount, 0);
    const advance = mine.filter((e) => e.category === "advance" && inP(e.date)).reduce((a, e) => a + e.amount, 0);
    const other = mine.filter((e) => e.category !== "salaries" && e.category !== "advance" && inP(e.date)).reduce((a, e) => a + e.amount, 0);
    return { salary, advance, other, total: salary + advance + other, history: mine.filter((e) => inP(e.date)) };
  };
  const [period, setPeriod] = useState("month");
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [editingRule, setEditingRule] = useState(null);

  const periodSales = sales.filter((s) => inPeriod(s.date, period));

  // Group by seller id where available, falling back to name for invoices
  // recorded before sellers were identified by id.
  const bySeller = {};
  periodSales.forEach((s) => {
    const key = s.sellerId || `name:${s.sellerName || "غير معروف"}`;
    if (!bySeller[key]) bySeller[key] = { key, id: s.sellerId || null, name: s.sellerName || "غير معروف", sales: [] };
    bySeller[key].sales.push(s);
  });
  // Include active staff who sold nothing this period — a zero row is
  // information, not noise.
  (users || [])
    .filter((u) => u.role === "employee" || u.role === "assistant" || u.role === "manager")
    .forEach((u) => {
      if (!bySeller[u.id]) bySeller[u.id] = { key: u.id, id: u.id, name: u.name, sales: [] };
    });

  const rows = Object.values(bySeller)
    .map((g) => {
      // ⚠ الأداء يُقاس بالربح التشغيلي بالجرام لا بالمبيعات بالريال.
      //
      // المبيعات بالريال تكافئ من يبيع قطعًا ثقيلة بهامش ضعيف، وترتفع
      // بارتفاع سعر الذهب دون أن يتحسّن أحد. الربح التشغيلي بالجرام يعزل
      // الأمرين: يقيس ما أضافه البائع بعمله، بوحدة لا تتضخّم بالسوق.
      const split = g.sales.reduce(
        (a, x) => {
          const sp = saleProfitSplit(x, price24);
          return {
            operating: a.operating + sp.operatingProfit,
            capital: a.capital + sp.capitalGain,
            metal: a.metal + sp.metalAtSale,
          };
        },
        { operating: 0, capital: 0, metal: 0 }
      );
      const g24 = (v) => (price24 > 0 ? v / price24 : 0);
      const salesSum = g.sales.reduce((a, x) => a + (Number(x.total) || 0), 0);
      return {
        ...g,
        ...computeCommission(commissions?.[g.id], g.sales, price24),
        operatingProfit: split.operating,
        capitalGain: split.capital,
        operatingGrams: g24(split.operating),
        capitalGrams: g24(split.capital),
        // الهامش التشغيلي: نسبة ما أضافه البائع من إجمالي ما باعه
        operatingMargin: salesSum > 0 ? (split.operating / salesSum) * 100 : 0,
        // متوسط الربح التشغيلي للفاتورة — يكشف من يبيع كثيرًا بهامش ضعيف
        avgOperatingPerSale: g.sales.length ? split.operating / g.sales.length : 0,
      };
    })
    // ⚠ الترتيب بالربح التشغيلي: الترتيب بالمبيعات يضع من يبيع كثيرًا
    // بهامش ضعيف فوق من يبيع أقل بهامش جيد.
    .sort((a, b) => b.operatingProfit - a.operatingProfit);

  const totals = rows.reduce(
    (a, r) => ({
      count: a.count + r.count,
      salesTotal: a.salesTotal + r.salesTotal,
      profitTotal: a.profitTotal + r.profitTotal,
      commission: a.commission + r.commission,
      commissionGrams: a.commissionGrams + r.commissionGrams,
    }),
    { count: 0, salesTotal: 0, profitTotal: 0, commission: 0, commissionGrams: 0 }
  );

  const periodLabel = PERIODS.find((p) => p.id === period)?.label || "";

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const head = [["البائع", "عدد الفواتير", `المبيعات (${currency})`, `الأرباح (${currency})`, "أساس العمولة", "النسبة %", `الحد المطلوب (${currency})`, `عمولة ثابتة/فاتورة`, `العمولة (${currency})`, "العمولة (جم)"]];
    rows.forEach((r) => {
      const rule = { ...DEFAULT_COMMISSION, ...(commissions?.[r.id] || {}) };
      head.push([
        r.name,
        r.count,
        fmt(r.salesTotal, 0),
        fmt(r.profitTotal, 0),
        COMMISSION_BASES.find((b) => b.id === rule.basis)?.label || rule.basis,
        fmt((Number(rule.rate) || 0) * 100, 2),
        fmt(Number(rule.target) || 0, 0),
        fmt(Number(rule.perInvoice) || 0, 0),
        fmt(r.commission, 0),
        fmt(r.commissionGrams),
      ]);
    });
    head.push([]);
    head.push(["الإجمالي", totals.count, fmt(totals.salesTotal, 0), fmt(totals.profitTotal, 0), "", "", "", "", fmt(totals.commission, 0), fmt(totals.commissionGrams)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(head), "عمولات البائعين");
    XLSX.writeFile(wb, `عمولات_البائعين_${periodLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (selectedSeller) {
    const r = rows.find((x) => x.key === selectedSeller);
    if (!r) return null;
    const rule = { ...DEFAULT_COMMISSION, ...(commissions?.[r.id] || {}) };
    return (
      <div>
        <SubPageHeader title={r.name} onBack={() => setSelectedSeller(null)} />
        <div className="px-4 pt-3">
          <div className="grid grid-cols-3 gap-2 mb-3">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className="py-2 rounded-xl text-xs font-bold"
                style={{ background: period === p.id ? "var(--accentBg)" : "var(--panel)", color: period === p.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Card style={{ padding: 16, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
              عمولة {periodLabel}
            </p>
            <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--accent)" }} className="text-2xl font-extrabold">
              {fmtW(r.commissionGrams)} جم
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
              يعادل {currency}
              {fmt(r.commission, 0)}
            </p>
            {!r.metTarget && (Number(rule.target) || 0) > 0 && (
              <p style={{ color: "var(--bad)" }} className="text-[11px] mt-2">
                لم يبلغ الحد المطلوب ({currency}
                {fmt(rule.target, 0)}) — النسبة غير مستحقة، والعمولة الثابتة فقط.
              </p>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <Stat label="عدد الفواتير" value={r.count} />
            <Stat label="المبيعات" value={`${currency}${fmt(r.salesTotal, 0)}`} />
            <Stat
              label="ربح تشغيلي (أداؤه)"
              value={`${fmtW(r.operatingGrams)} جم`}
              sub={`${currency}${fmt(r.operatingProfit, 0)} · هامش ${fmt(r.operatingMargin, 1)}٪`}
              accent="var(--goodSolid)"
            />
            <Stat
              label="ربح رأسمالي (من السوق)"
              value={`${fmtW(r.capitalGrams)} جم`}
              sub={`${currency}${fmt(r.capitalGain, 0)} — لا يُنسب لأدائه`}
              accent="var(--accentSoft)"
            />
            <Stat label="متوسط الفاتورة" value={`${currency}${fmt(r.count ? r.salesTotal / r.count : 0, 0)}`} />
          </div>

          {(() => {
            const pay = payrollFor(r.id);
            const netDue = r.commission - pay.advance;
            return (
              <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
                <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
                  حسابه المالي — {periodLabel}
                </p>
                {[
                  ["العمولة المستحقة", r.commission, "var(--goodSolid)"],
                  ["الراتب المصروف", pay.salary, "var(--bad)"],
                  ["السلف", pay.advance, "var(--bad)"],
                  ...(pay.other > 0 ? [["مصروفات أخرى باسمه", pay.other, "var(--bad)"]] : []),
                ].map(([l, v, c], i) => (
                  <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--text2)" }} className="text-xs">{l}</span>
                    <div className="text-left">
                      <span style={{ color: c }} className="text-xs font-bold">
                        {currency}{fmt(v, 0)}
                      </span>
                      <span style={{ color: "var(--text3)" }} className="text-[10px] block">
                        {price24 > 0 ? fmt(v / price24) : "0.00"} جم
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                    {netDue >= 0 ? "المستحق له بعد السلف" : "المستحق عليه"}
                  </span>
                  <div className="text-left">
                    <span style={{ color: netDue >= 0 ? "var(--goodSolid)" : "var(--bad)" }} className="text-base font-bold">
                      {currency}{fmt(Math.abs(netDue), 0)}
                    </span>
                    <span style={{ color: "var(--text3)" }} className="text-[10px] block">
                      {price24 > 0 ? fmt(Math.abs(netDue) / price24) : "0.00"} جم
                    </span>
                  </div>
                </div>
                {netDue < 0 && (
                  <p style={{ color: "var(--bad)" }} className="text-[11px] mt-1">
                    سحب أكثر من عمولته — يُخصم من المستحق القادم.
                  </p>
                )}
                {pay.history.length > 0 && (
                  <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
                    <p style={{ color: "var(--text2)" }} className="text-[11px] mb-1">حركاته ({pay.history.length})</p>
                    {pay.history.slice(0, 8).map((e) => (
                      <div key={e.id} className="flex items-center justify-between py-1">
                        <span style={{ color: "var(--text2)" }} className="text-[11px]">
                          {e.name || e.category}
                          <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">
                            {new Date(e.date).toLocaleDateString("en-GB")}
                          </span>
                        </span>
                        <span style={{ color: "var(--bad)" }} className="text-[11px] font-bold">
                          −{fmt(e.amount, 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })()}

          <Card style={{ padding: 12, marginBottom: 12 }}>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
              تفصيل احتساب العمولة
            </p>
            {[
              ["الأساس", COMMISSION_BASES.find((b) => b.id === rule.basis)?.label],
              ["المبلغ الخاضع", `${currency}${fmt(r.base, 0)}`],
              ["النسبة", `${fmt((Number(rule.rate) || 0) * 100, 2)}٪`],
              ["قيمة النسبة", `${currency}${fmt(r.pct, 0)}`],
              ["عمولة ثابتة", `${currency}${fmt(r.flat, 0)} (${r.count} × ${fmt(Number(rule.perInvoice) || 0, 0)})`],
            ].map(([l, v], i) => (
              <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text2)" }} className="text-xs">
                  {l}
                </span>
                <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                  {v}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                الإجمالي
              </span>
              <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                {currency}
                {fmt(r.commission, 0)}
              </span>
            </div>
          </Card>

          {canManage && (
            <>
              {editingRule !== r.key ? (
                <button
                  onClick={() => setEditingRule(r.key)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold mb-4"
                  style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
                >
                  تعديل إعداد العمولة
                </button>
              ) : (
                <CommissionRuleForm
                  rule={rule}
                  currency={currency}
                  onCancel={() => setEditingRule(null)}
                  onSave={(next) => {
                    onSaveCommission(r.id, next);
                    setEditingRule(null);
                  }}
                />
              )}
            </>
          )}

          <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
            فواتير {periodLabel} ({r.sales.length})
          </p>
          {r.sales.length === 0 ? (
            <EmptyState icon={<Receipt size={32} color="var(--accentText)" />} title="لا توجد فواتير بهذه الفترة" sub="جرّب فترة أخرى" />
          ) : (
            <div className="flex flex-col gap-2">
              {r.sales.map((s) => (
                <Card key={s.id} style={{ padding: 12 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }} className="text-sm">
                      {new Date(s.date).toLocaleDateString("en-GB")}
                    </span>
                    <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                      {currency}
                      {fmt(s.total, 0)}
                    </span>
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                    ربح: {currency}
                    {fmt(saleProfitOf(s), 0)}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SubPageHeader title="تقارير البائعين والعمولات" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className="py-2 rounded-xl text-xs font-bold"
              style={{ background: period === p.id ? "var(--accentBg)" : "var(--panel)", color: period === p.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Stat label={`مبيعات ${periodLabel}`} value={`${currency}${fmt(totals.salesTotal, 0)}`} />
          <Stat label="عدد الفواتير" value={totals.count} />
          <Stat label="الأرباح المحققة" value={`${currency}${fmt(totals.profitTotal, 0)}`} accent="var(--goodSolid)" />
          <Stat label="إجمالي العمولات" value={`${fmtW(totals.commissionGrams)} جم`} accent="var(--accent)" />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() =>
            exportTablesPdf({
              title: "تقارير البائعين",
              onBlocked: flashToast,
              sections: [{
                title: "أداء البائعين",
                headers: ["البائع", "الفواتير", `المبيعات (${currency})`, "الوزن (جم24)", `العمولة (${currency})`],
                rows: (rows || []).map((r) => [
                  r.name, r.count, fmtMoney(r.total), fmtW(r.fine || 0), fmtMoney(r.commission || 0),
                ]),
                note: "⚖ العمولة تُحسب على الربح التشغيلي لا على قيمة المعدن.",
              }],
            })
          }
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
        >
          <FileText size={16} /> PDF
        </button>
        <button
          onClick={exportXlsx}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}
        >
          <FileSpreadsheet size={16} /> Excel
        </button>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<Users size={36} color="var(--accentText)" />} title="لا يوجد بائعون" sub="أضف المستخدمين من صلاحيات الوصول" />
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((r) => (
              <button key={r.key} onClick={() => setSelectedSeller(r.key)} className="w-full text-right">
                <Card style={{ padding: 12 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                      {r.name}
                    </span>
                    <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                      {currency}
                      {fmt(r.salesTotal, 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">
                      {r.count} فاتورة · ربح {currency}
                      {fmt(r.profitTotal, 0)}
                    </span>
                    <span style={{ color: r.commission > 0 ? "var(--goodSolid)" : "var(--text3)" }} className="text-[11px] font-bold">
                      عمولة {fmtW(r.commissionGrams)} جم
                      {(() => {
                        const pay = payrollFor(r.id);
                        if (pay.total === 0) return null;
                        const net = r.commission - pay.advance;
                        return (
                          <span style={{ color: net >= 0 ? "var(--text2)" : "var(--bad)" }} className="block text-[10px]">
                            {net >= 0 ? "صافي له " : "عليه "}
                            {currency}{fmt(Math.abs(net), 0)}
                          </span>
                        );
                      })()}
                    </span>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { SellerReportsPage };
