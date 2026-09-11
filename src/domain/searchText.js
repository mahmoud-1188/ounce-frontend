const searchText = (obj, extra = []) => {
  const parts = [...extra];
  const walk = (v, depth) => {
    if (depth > 2 || v == null) return;
    if (typeof v === "string" || typeof v === "number") {
      const s = String(v);
      // نتجاهل المعرّفات الطويلة والتواريخ الكاملة — ضجيج في البحث
      if (s.length < 40 && !/^\d{13,}/.test(s)) parts.push(s);
    } else if (Array.isArray(v)) v.slice(0, 12).forEach((x) => walk(x, depth + 1));
    else if (typeof v === "object") Object.values(v).forEach((x) => walk(x, depth + 1));
  };
  walk(obj, 0);
  // نخزّن الأصل والمطبَّع معًا فيجد البحث كليهما
  const joined = parts.join(" ").toLowerCase();
  const normalized = joined.replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
  return joined === normalized ? joined : joined + " " + normalized;
};

/// ── ① الفهرس الشامل ──
///
/// كل مخزن يُسطَّح إلى سجلات موحّدة. الحقول المشتركة تجعل البحث والعرض
/// والتتبّع كودًا واحدًا بدل ثمانية عشر فرعًا.

export { searchText };
