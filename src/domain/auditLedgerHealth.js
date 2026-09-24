import { fmtW, fromHalalas, halalas, roundW } from "../core/money.js";

function auditLedgerHealth({ journal = [], goldLedger = [], accounts = [], complete = true }) {
  const issues = [];
  // ① كل قيدٍ متوازن بذاته
  let unbalanced = 0;
  for (const e of journal) {
    const d = (e.lines || []).reduce((a, l) => a + halalas(l.debit), 0);
    const c = (e.lines || []).reduce((a, l) => a + halalas(l.credit), 0);
    if (Math.abs(d - c) >= 1) unbalanced++;
  }
  if (unbalanced) {
    issues.push({ level: "block", code: "unbalanced",
      why: `${unbalanced} قيدًا غير متوازن — الميزان مكسور`,
      fix: "افتح الأستاذ العام ← اليوميات وابحث عنها، ثم صحّحها بقيدٍ عكسي" });
  }
  // ② مجموع المدين = مجموع الدائن
  const td = journal.reduce((a, e) => a + (e.lines || []).reduce((x, l) => x + halalas(l.debit), 0), 0);
  const tc = journal.reduce((a, e) => a + (e.lines || []).reduce((x, l) => x + halalas(l.credit), 0), 0);
  if (Math.abs(td - tc) >= 1) {
    issues.push({ level: "block", code: "totals",
      why: `المدين ${fromHalalas(td)} لا يساوي الدائن ${fromHalalas(tc)} — فرق ${fromHalalas(td - tc)}`,
      fix: "راجع آخر القيود المُرحَّلة" });
  }
  // ③ حسابٌ ليس في الشجرة
  const known = new Set(accounts.map((a) => a.code));
  const orphan = new Set();
  for (const e of journal) for (const l of e.lines || []) {
    if (l.account && known.size && !known.has(l.account)) orphan.add(l.account);
  }
  if (orphan.size) {
    issues.push({ level: "block", code: "orphanAccount",
      why: `${orphan.size} حسابًا في الدفتر ليس في الشجرة: ${[...orphan].slice(0, 5).join(" · ")}`,
      fix: "أضفها للشجرة أو صحّح القيود — وإلا لن تظهر في أي قائمة" });
  }
  // ④ ⚠ الأصل الوزني السالب — الخلل الوحيد في الدفتر الوزني
  const fine = {};
  for (const g of goldLedger) {
    const acc = g.accountCode || g.account;
    if (!acc) continue;
    const f = (Number(g.weight) || 0) * (Number(g.karat) || 24) / 24;
    fine[acc] = roundW((fine[acc] || 0) + (g.type === "in" ? f : -f));
  }
  // ⚠ الرصيد الوزني لا يُقرأ من دفترٍ مقصوص: أحدثُ الحركات وحدها تُظهر
  //   خروجًا بلا دخوله فيبدو الأصل سالبًا وهو ليس كذلك.
  const negAssets = !complete ? [] : Object.entries(fine)
    .filter(([code, w]) => code.startsWith("1") && w < -0.0005);
  if (negAssets.length) {
    issues.push({ level: "block", code: "negativeWeight",
      why: `أصلٌ وزنيّ سالب: ${negAssets.map(([c, w]) => `${c} (${fmtW(w)} جم)`).join(" · ")}`,
      fix: "أُخرج وزنٌ أكثر مما دخل — راجع البيع والجرد والإخراج" });
  }
  // ⑤ قيدٌ بلا مستند
  const noRef = journal.filter((e) => !e.ref && !e.refDoc).length;
  if (noRef) {
    issues.push({ level: "warn", code: "noRef",
      why: `${noRef} قيدًا بلا مرجع مستند`,
      fix: "المراجع يطلب المستند لكل قيد" });
  }
  // ⑥ عيارٌ غير معروف في الدفتر الوزني
  const badKarat = goldLedger.filter((g) => ![18, 21, 22, 24].includes(Number(g.karat))).length;
  if (badKarat) {
    issues.push({ level: "warn", code: "badKarat",
      why: `${badKarat} حركةً وزنية بعيارٍ غير معروف`,
      fix: "العيار يُحدّد المعادل 24 — وخطؤه يُفسد المخزون" });
  }
  const blocks = issues.filter((x) => x.level === "block").length;
  return {
    ok: issues.length === 0,
    healthy: blocks === 0,
    issues, blocks,
    warns: issues.length - blocks,
    checked: { entries: journal.length, weightMoves: goldLedger.length, complete },
  };
}

/// ④ سجل تغيّر الصلاحيات.
///
/// ⚠ سجلّ التدقيق يحفظ **ما فُعل**، لا **من صار يستطيع فعله**. وسؤالٌ
/// يُسأل بعد كل اختلاس: «من أعطى فلانًا صلاحية الحذف ومتى؟» — ولا جواب
/// إن لم يُسجَّل المنح نفسه.
///
/// ⚠ ويُسجَّل الفرق لا الحالة: «صار له 42 شاشة» لا يُنبئ، و«أُضيفت له
/// إخراج القطع وحُذف منه الجرد» يُنبئ.

export { auditLedgerHealth };
