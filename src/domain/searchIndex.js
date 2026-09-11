function searchIndex(index, query, opts = {}) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];

  // ⚠ البادئات العربية تكسر البحث الحرفي: «لأحمد» لا تطابق «أحمد»،
  // و«بالفاتورة» لا تطابق «فاتورة». نجرّب الكلمة ومجرّدها معًا.
  const strip = (w) => {
    let x = w;
    // ال · و · ب · ل · ك · ف — بالترتيب من الأطول
    x = x.replace(/^(وال|بال|كال|فال|ال)/, "");
    x = x.replace(/^[وبلكف](?=.{2,})/, "");
    return x;
  };
  // التطبيع: الألف بأشكالها والتاء المربوطة — «احمد» تجد «أحمد»
  const norm = (w) => w.replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

  const raw = q.split(/\s+/).filter(Boolean);
  const terms = [...new Set(raw.flatMap((w) => [w, strip(w), norm(w), norm(strip(w))]))]
    .filter((w) => w.length >= 2);
  const kinds = opts.kinds && opts.kinds.length ? new Set(opts.kinds) : null;

  const scored = [];
  for (const rec of index) {
    if (kinds && !kinds.has(rec.kind)) continue;
    let score = 0;
    const ref = String(rec.ref || "").toLowerCase();
    for (const t of terms) {
      if (ref === t) score += 100;
      else if (ref.includes(t)) score += 40;
      if (String(rec.summary || "").toLowerCase().includes(t)) score += 15;
      if (String(rec.who || "").toLowerCase().includes(t)) score += 12;
      if (rec.text.includes(t)) score += 6;
      // البحث بالمبلغ أو الوزن
      const n = Number(t.replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) {
        if (Math.abs((rec.amount || 0) - n) < 0.01) score += 30;
        if (Math.abs((rec.weight || 0) - n) < 0.001) score += 30;
        if (rec.karat === n) score += 10;
      }
      if (String(rec.date || "").startsWith(t)) score += 20;
    }
    if (score > 0) scored.push({ ...rec, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, opts.limit || 50);
}

/// ── ③ سلسلة الإسناد ──
///
/// من أين جاء هذا السجل، وماذا تفرّع عنه. الروابط في اتجاهين: ما يشير
/// إليه السجل (آباؤه) وما يشير إليه غيره (أبناؤه).

export { searchIndex };
