import { fromHalalas, halalas } from "../core/money.js";
import { exchangeKind } from "./helpers.js";

function validateExchange({ kind, columns = [], rows = [], existingRefs = new Set(), accounts = [], items = [] }) {
  // ⚠ فهرسٌ للوحدات قبل الحلقة: البحث الخطّي لكل رمزٍ في كل صفّ يجعل
  // ملفًّا من ألف سطر يتجمّد على جوال.
  const unitIndex = new Map();
  for (const it of items) {
    for (const u of it.units || []) {
      if (u.code) unitIndex.set(u.code, { ...u, item: it });
    }
  }
  const seenCodes = new Set();
  const def = exchangeKind(kind);
  if (!def) return { ok: false, fatal: `نوعٌ غير معروف: ${kind}` };
  const idx = {};
  def.cols.forEach((c) => { idx[c] = columns.indexOf(c); });
  const missing = def.cols.filter((c) => idx[c] < 0 && ["ref", "date", "amount", "total", "account", "code", "name"].includes(c));
  if (missing.length) {
    return { ok: false, fatal: `أعمدة ناقصة: ${missing.join(" · ")} — المتوقّع: ${def.cols.join(" · ")}` };
  }
  const get = (r, c) => (idx[c] >= 0 ? String(r[idx[c]] ?? "").trim() : "");
  const num = (r, c) => {
    const v = get(r, c).replace(/[^\d.\-]/g, "");
    return v === "" ? null : Number(v);
  };
  const good = [], bad = [];
  const seen = new Set();
  rows.forEach((r, i) => {
    const line = i + 2;                            // +2: الصف الأول عناوين
    const ref = get(r, "ref") || get(r, "code") || "";
    const errs = [];
    // ⚠ المرجع المكرّر **داخل الملف** وضد ما سبق: ملفٌ فيه فاتورةٌ مرتين
    // يُضاعف الإيراد، وإعادةُ استيراد ملفٍ سبق تُضاعف كل شيء.
    if (ref) {
      if (seen.has(ref)) errs.push("مرجعٌ مكرّر في الملف نفسه");
      else if (existingRefs.has(ref)) errs.push("مرجعٌ مستوردٌ من قبل");
      seen.add(ref);
    } else if (def.cols.includes("ref")) errs.push("بلا مرجع");

    if (def.cols.includes("date")) {
      const d = get(r, "date");
      if (!d) errs.push("بلا تاريخ");
      else if (Number.isNaN(new Date(d).getTime())) errs.push(`تاريخٌ غير مقروء: ${d}`);
    }
    for (const c of ["total", "amount", "debit", "credit", "weight", "costPerGram"]) {
      if (!def.cols.includes(c)) continue;
      const v = num(r, c);
      if (v === null && ["total", "amount"].includes(c)) { errs.push(`${c} فارغ`); continue; }
      // ⚠ السالب يُرفض: نظامٌ آخر قد يُمثّل المرتجع بمبلغٍ سالب، وقبولُه
      // هنا يُنتج فاتورةً سالبة لا يعرفها الدفتر. المرتجع مستندٌ مستقل.
      if (v !== null && v < 0) errs.push(`${c} سالب (${v}) — المرتجع مستندٌ مستقل`);
    }
    if (def.cols.includes("karat")) {
      const k = num(r, "karat");
      if (k !== null && ![24, 22, 21, 18, 14, 10, 9].includes(k)) errs.push(`عيارٌ غير معروف: ${k}`);
    }
    // ⚠ فحص رموز البيع: القطعة موجودة، وغير مباعةٍ من قبل، ولا مكرّرة
    // في الملف. بيع قطعةٍ مرتين يُخرج وزنها مرتين من مخزونٍ فيه واحدة.
    if (kind === "sales") {
      const cs = get(r, "codes").split(/[;,|]/).map((x) => x.trim()).filter(Boolean);
      if (!cs.length) errs.push("بلا رموز قطع — لا يُربط البيع بمخزون");
      for (const c of cs) {
        const u = unitIndex.get(c);
        if (!u) errs.push(`الرمز ${c} ليس في المخزون`);
        else if (u.sold) errs.push(`الرمز ${c} مباعٌ من قبل`);
        else if (u.issued) errs.push(`الرمز ${c} أُخرج من النظام`);
        else if (seenCodes.has(c)) errs.push(`الرمز ${c} مكرّر في الملف`);
        seenCodes.add(c);
      }
    }
    if (def.cols.includes("account") && kind === "journal") {
      const a = get(r, "account");
      if (!a) errs.push("بلا حساب");
      else if (accounts.length && !accounts.some((x) => x.code === a)) errs.push(`حسابٌ غير موجود: ${a}`);
    }
    (errs.length ? bad : good).push({ line, ref, errs, raw: r, get: (c) => get(r, c), num: (c) => num(r, c) });
  });

  // ⚠ اليومية تتوازن أو تُرفض كلّها: قيدٌ غير متوازن يكسر الميزان، ولا
  // يُكتشف إلا بعد أن يُبنى عليه شهر.
  let balance = null;
  if (kind === "journal" && good.length) {
    const d = good.reduce((a, g) => a + halalas(g.num("debit") || 0), 0);
    const c = good.reduce((a, g) => a + halalas(g.num("credit") || 0), 0);
    balance = { debit: fromHalalas(d), credit: fromHalalas(c), balanced: Math.abs(d - c) < 1 };
  }
  return {
    ok: bad.length === 0 && (!balance || balance.balanced),
    kind, label: def.label,
    total: rows.length, goodCount: good.length, badCount: bad.length,
    good, bad: bad.slice(0, 60), balance,
    summary: (() => {
      const amtCol = def.cols.includes("total") ? "total" : def.cols.includes("amount") ? "amount" : null;
      if (!amtCol) return null;
      return fromHalalas(good.reduce((a, g) => a + halalas(g.num(amtCol) || 0), 0));
    })(),
  };
}

export { validateExchange };
