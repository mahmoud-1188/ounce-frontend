import { fmt, fmtW } from "../core/money.js";
import { accountLabel, hiddenNumbersScan, saleProfitOf } from "./helpers.js";

function traceEvidence(topicId, M, ctx) {
  const cur = ctx.currency;
  const out = [];
  const add = (title, items) => {
    if (items && items.length) out.push({ title, items });
  };
  const money = (v) => `${cur}${fmt(v, 0)}`;

  if (topicId === "cash") {
    // فجوات المطابقة أولًا — هي التفسير المباشر لأي نقص
    const gaps = hiddenNumbersScan(ctx).filter((g) =>
      ["صندوق", "خزنة", "قيد", "مصروفات", "فواتير", "سداد"].some((w) => g.title.includes(w))
    );
    add("فجوات مطابقة الدفاتر", gaps.map((g) => `${g.title}: ${g.detail}`));

    const untagged = [...(ctx.cashTx || []), ...(ctx.safeTx || [])].filter((t) => !t.category);
    add("قيود بلا تصنيف", untagged.slice(0, 8).map((t) => `${money(t.amount)} · ${t.note || "بلا بيان"} · ${new Date(t.date).toLocaleDateString("en-GB")}`));

    const variances = (ctx.dailyCustody || [])
      .filter((c) => Math.abs((c.varianceCash || 0) + (c.varianceNetwork || 0)) > 0.01)
      .slice(0, 6);
    add("فروقات جرد الصندوق اليومي", variances.map((c) => {
      const v = (c.varianceCash || 0) + (c.varianceNetwork || 0);
      return `${c.ref} · ${v > 0 ? "زيادة" : "عجز"} ${money(Math.abs(v))} · ${c.openedBy || ""}`;
    }));

    const safeAudits = (ctx.safeAudits || [])
      .filter((a) => Math.abs((a.varianceCash || 0) + (a.varianceNetwork || 0)) > 0.01)
      .slice(0, 5);
    add("فروقات جرد الخزنة", safeAudits.map((a) => {
      const v = (a.varianceCash || 0) + (a.varianceNetwork || 0);
      return `${a.ref} · ${v > 0 ? "زيادة" : "عجز"} ${money(Math.abs(v))} · ${a.createdBy || ""}`;
    }));

    const big = [...(ctx.cashTx || []), ...(ctx.safeTx || [])]
      .filter((t) => t.type === "out")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
    add("أكبر عمليات الخروج", big.map((t) => `${money(t.amount)} · ${t.note || accountLabel(t.category)} · ${t.createdBy || "—"} · ${new Date(t.date).toLocaleDateString("en-GB")}`));
  }

  if (topicId === "gold") {
    const openGap = (ctx.lots || [])
      .filter((l) => l.status !== "closed" && (Number(l.enteredWeight) || 0) > 0)
      .map((l) => ({ l, gap: (Number(l.weight) || 0) - (Number(l.enteredWeight) || 0) }))
      .filter((x) => Math.abs(x.gap) > 0.001)
      .slice(0, 8);
    add("دفعات لم تُقفل — وزن معلّق", openGap.map((x) =>
      `${x.l.ref || ""} · ${ctx.supplierNameOf ? ctx.supplierNameOf(x.l.supplierId) : ""} · متبقٍ ${fmtW(x.gap)} جم عيار ${x.l.karat}`
    ));

    const wast = (M.fAdj || []).filter((a) => a.kind === "wastage").slice(0, 8);
    add("هالك مسجّل", wast.map((a) => `${fmtW(a.weight)} جم عيار ${a.karat} · ${money(a.value)} · ${a.note || ""} · ${a.createdBy || ""}`));

    const repairs = (ctx.weightAdjustments || []).filter((a) => a.kind === "repair_add" || a.kind === "repair_reduce").slice(0, 6);
    add("تعديلات وزن بالإصلاح", repairs.map((a) => `${a.kind === "repair_add" ? "أُضيف" : "خُصم"} ${fmtW(a.weight)} جم عيار ${a.karat} · ${a.createdBy || ""}`));

    const goldOut = (ctx.safeGoldTx || []).filter((t) => t.type === "out").slice(0, 8);
    add("سحوبات ذهب من الخزنة", goldOut.map((t) =>
      `${fmtW(t.weight)} جم عيار ${t.karat} ${t.kind === "raw" ? "خام" : "مشغول"} → ${t.destinationLabel || "بلا وجهة"}${t.supplierName ? " · " + t.supplierName : ""} · ${t.createdBy || ""}`
    ));

    const noDest = (ctx.safeGoldTx || []).filter((t) => t.type === "out" && !t.destination);
    if (noDest.length) add("⚠ سحوبات بلا وجهة مسجّلة", [`${noDest.length} سحب — سُجّلت قبل تفعيل الوجهات`]);
  }

  if (topicId === "profit") {
    const losses = (M.fSales || [])
      .map((x) => ({ x, p: saleProfitOf(x) }))
      .filter((o) => o.p <= 0)
      .slice(0, 8);
    add("فواتير بلا ربح أو بخسارة", losses.map((o) => `${o.x.ref || ""} · ${o.x.sellerName || ""} · بيع ${money(o.x.total)} · ربح ${money(o.p)}`));

    const thin = (M.fSales || [])
      .map((x) => ({ x, p: saleProfitOf(x), m: x.total > 0 ? (saleProfitOf(x) / x.total) * 100 : 0 }))
      .filter((o) => o.p > 0 && o.m < 8)
      .slice(0, 6);
    add("فواتير بهامش ضعيف", thin.map((o) => `${o.x.ref || ""} · هامش ${fmt(o.m, 1)}٪ · ${o.x.sellerName || ""}`));

    add("مؤشرات الفترة", [
      `المبيعات ${money(M.salesSum)} · الأرباح ${money(M.salesProfit)} · الهامش ${fmt(M.margin, 1)}٪`,
      `متوسط تكلفة الجرام المشترى: ${M.purchWeight > 0 ? money(M.purchGold / M.purchWeight) : "—"}`,
      `الهالك ${fmtW(M.wastage)} جم من ${fmtW(M.purchWeight)} جم مشتراة`,
    ]);
  }

  if (topicId === "expense") {
    const byCat = {};
    (M.fExpenses || []).forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));
    add("المصروفات حسب التصنيف", Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([k, v]) => `${accountLabel(k) !== "—" ? accountLabel(k) : k}: ${money(v)}`));

    const big = [...(M.fExpenses || [])].sort((a, b) => b.amount - a.amount).slice(0, 8);
    add("أكبر المصروفات", big.map((e) => `${e.name || e.category} · ${money(e.amount)} · ${e.createdBy || ""} · ${new Date(e.date).toLocaleDateString("en-GB")}`));

    const payroll = (M.fExpenses || []).filter((e) => e.category === "salaries" || e.category === "advance");
    add("رواتب وسحبيات", payroll.slice(0, 8).map((e) => `${e.employeeName || "—"} · ${e.category === "advance" ? "سحبية" : "راتب"} ${money(e.amount)}`));
  }

  if (topicId === "inventory") {
    const audits = (M.fAudits || []).slice(0, 5);
    add("عمليات الجرد", audits.map((a) => {
      const miss = (a.entries || []).filter((e) => e.status === "missing").length;
      return `${new Date(a.date).toLocaleDateString("en-GB")} · ${miss} مفقود من ${(a.entries || []).length} · ${a.createdBy || ""}`;
    }));

    const gaps = hiddenNumbersScan(ctx).filter((g) =>
      ["أصناف", "أكواد", "قطع", "وزن"].some((w) => g.title.includes(w))
    );
    add("فجوات المخزون", gaps.map((g) => `${g.title}: ${g.detail}`));

    add("حركة الفترة", [
      `مشتريات ${fmtW(M.purchWeight)} جم · هالك ${fmtW(M.wastage)} جم · فائض ${fmtW(M.surplus)} جم`,
      `مبيعات ${M.salesCount} فاتورة`,
    ]);
  }

  return out;
}

export { traceEvidence };
