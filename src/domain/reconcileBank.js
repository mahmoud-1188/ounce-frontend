import { RECON_TOLERANCE, RECON_WINDOW_DAYS } from "../core/money-rules.js";

function reconcileBank(localTx, bankRows, opts = {}) {
  const windowDays = opts.windowDays ?? RECON_WINDOW_DAYS;
  const tol = opts.tolerance ?? RECON_TOLERANCE;
  const dayOf = (d) => String(d || "").slice(0, 10);
  const diffDays = (a, b) =>
    Math.abs((new Date(dayOf(a)) - new Date(dayOf(b))) / 86400000);

  const locals = (localTx || []).map((t) => ({ ...t, _used: false }));
  const banks = (bankRows || []).map((b) => ({ ...b, _used: false }));
  const matched = [];

  // ① مطابقة بالمرجع — أقوى دليل
  banks.forEach((b) => {
    if (b._used || !b.ref) return;
    const hit = locals.find(
      (t) => !t._used && t.authCode && String(t.authCode).trim() === String(b.ref).trim()
    );
    if (hit) {
      hit._used = true; b._used = true;
      matched.push({ bank: b, locals: [hit], amount: b.amount, how: "ref", confidence: "قوي" });
    }
  });

  // ② إيداع مجمّع: البنك يودع مجموع عمليات اليوم دفعة واحدة
  banks.forEach((b) => {
    if (b._used || b.type !== "credit") return;
    const window = locals.filter(
      (t) => !t._used && diffDays(t.date, b.date) <= windowDays && (Number(t.amount) || 0) > 0
    );
    if (!window.length) return;

    // نجرّب مجموعة يوم واحد أولًا — أقرب لسلوك البنك
    const byDay = {};
    window.forEach((t) => { (byDay[dayOf(t.date)] ||= []).push(t); });
    let found = null;
    Object.values(byDay).forEach((group) => {
      if (found) return;
      // ⚠ مجموعة من عنصر واحد ليست «دفعة»: هي مطابقة بالمبلغ والتاريخ،
      // ودليلها ضعيف. نتركها للقاعدة الثالثة لتُوسم بصدق.
      if (group.length < 2) return;
      const sum = group.reduce((a, t) => a + (Number(t.amount) || 0), 0);
      if (Math.abs(sum - b.amount) <= tol) found = { group, how: "batch_day", confidence: "قوي" };
    });

    // ثم مجموعة فرعية صغيرة — نحدّ العدد لأن البحث الشامل ينفجر
    if (!found && window.length <= 12) {
      const n = window.length;
      for (let mask = 1; mask < (1 << n) && !found; mask++) {
        let sum = 0, group = [];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) { sum += Number(window[i].amount) || 0; group.push(window[i]); }
        if (group.length > 1 && Math.abs(sum - b.amount) <= tol)
          found = { group, how: "batch_subset", confidence: "متوسط" };
      }
    }

    if (found) {
      found.group.forEach((t) => (t._used = true));
      b._used = true;
      matched.push({ bank: b, locals: found.group, amount: b.amount, how: found.how, confidence: found.confidence });
    }
  });

  // ③ مطابقة فردية بالمبلغ والتاريخ — أضعفها
  banks.forEach((b) => {
    if (b._used) return;
    const hit = locals.find(
      (t) => !t._used && Math.abs((Number(t.amount) || 0) - b.amount) <= tol &&
        diffDays(t.date, b.date) <= windowDays
    );
    if (hit) {
      hit._used = true; b._used = true;
      matched.push({ bank: b, locals: [hit], amount: b.amount, how: "amount_date", confidence: "ضعيف" });
    }
  });

  const inTransit = locals.filter((t) => !t._used);
  const unrecorded = banks.filter((b) => !b._used);

  const sum = (a, f) => a.reduce((x, y) => x + (Number(f(y)) || 0), 0);
  return {
    matched,
    inTransit,
    unrecorded,
    totals: {
      matched: sum(matched, (m) => m.amount),
      inTransit: sum(inTransit, (t) => t.amount),
      unrecordedIn: sum(unrecorded.filter((b) => b.type === "credit"), (b) => b.amount),
      unrecordedOut: sum(unrecorded.filter((b) => b.type === "debit"), (b) => b.amount),
    },
    weak: matched.filter((m) => m.confidence === "ضعيف").length,
  };
}




// ═══════════════════════════════════════════════════════════════════════
//  دفتر القيود المزدوجة
//
//  كل عملية طرفان: مدين ودائن بمبلغ واحد. ومجموع المدين يساوي مجموع
//  الدائن دائمًا — وإلا فالقيد ناقص لا مجرد غير متوازن.
//
//  ⚠ والقيد المُرحَّل لا يُعدَّل ولا يُحذف. التصحيح **قيدٌ عكسي** يُلغيه
//  ويبقى الاثنان في الدفتر.
//
//  السبب ليس شكليًا: التعديل المباشر يمحو ما حدث فعلًا، فيصير الدفتر
//  روايةً لما يجب أن يكون لا سجلًا لما كان. ومن يراجع بعد شهر لا يرى
//  الخطأ ولا تصحيحه — يرى رقمًا نهائيًا لا يعرف كيف صار إليه.
// ═══════════════════════════════════════════════════════════════════════

export { reconcileBank };
