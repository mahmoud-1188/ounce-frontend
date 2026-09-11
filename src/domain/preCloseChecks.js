import { fmt, fromHalalas, halalas } from "../core/money.js";
import { isPeriodClosed } from "./isPeriodClosed.js";

function preCloseChecks(period, ctx) {
  const { journal = [], businessDays = [], scrapEntries = [], depreciations = [],
          fixedAssets = [], payrollRuns = [], closes = [] } = ctx || {};
  const issues = [];

  if (isPeriodClosed(closes, period)) issues.push({ level: "block", why: "الفترة مقفلة سلفًا" });

  // ⚠ يوم مفتوح داخل الفترة يعني حركةً لم تُورَّد
  const openDays = businessDays.filter(
    (d) => String(d.date || d.openedAt || "").slice(0, 7) === period && d.status === "open"
  );
  if (openDays.length) issues.push({ level: "block", why: `${openDays.length} يوم عمل ما زال مفتوحًا` });

  // كسر ينتظر التكسير
  const waiting = (scrapEntries || []).filter((e) => (e.stage || "") === "pending_break");
  if (waiting.length) issues.push({ level: "block", why: `${waiting.length} قطعة كسر تنتظر التكسير` });

  // إهلاك الشهر
  const depDone = (depreciations || []).some((d) => d.period === period);
  const hasAssets = (fixedAssets || []).some((a) => !a.disposed);
  if (hasAssets && !depDone) issues.push({ level: "warn", why: "لم يُرحَّل إهلاك الشهر" });

  // رواتب الشهر
  if (!(payrollRuns || []).some((r) => r.period === period && r.status === "posted")) {
    issues.push({ level: "warn", why: "لم يُرحَّل مسيّر رواتب الشهر" });
  }

  // توازن القيود
  const inP = (journal || []).filter((e) => String(e.date || "").slice(0, 7) === period);
  const dr = inP.reduce((a, e) => a + (e.lines || []).reduce((x, l) => x + halalas(l.debit), 0), 0);
  const cr = inP.reduce((a, e) => a + (e.lines || []).reduce((x, l) => x + halalas(l.credit), 0), 0);
  if (dr !== cr) issues.push({ level: "block", why: `القيود غير متوازنة — فرق ${fmt(fromHalalas(dr - cr), 2)}` });

  return {
    canClose: !issues.some((i) => i.level === "block"),
    issues,
    entries: inP.length,
    totals: { debit: fromHalalas(dr), credit: fromHalalas(cr) },
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  الربط الخارجي
//
//  ⚠ القراءة فقط: الواجهة تُخرج ولا تُدخل. سماحُ الكتابة من الخارج
//  يعني قيودًا تدخل الدفتر بلا مرورها بحرّاس التطبيق — والدفتر يفقد
//  ضمانه في اللحظة نفسها.
// ═══════════════════════════════════════════════════════════════════════

/// أحداث تُبثّ للأنظمة المشتركة.

export { preCloseChecks };
