function traceRecord(index, refOrId, depth = 2) {
  const find = (k) => index.find((r) => r.ref === k || r.id === k);
  const root = find(refOrId);
  if (!root) return null;

  const seen = new Set([root.id]);
  const up = [];
  const down = [];

  const collectUp = (rec, d) => {
    if (d <= 0) return;
    (rec.links || []).forEach((l) => {
      const p = find(l);
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        up.push({ ...p, depth: depth - d + 1 });
        collectUp(p, d - 1);
      }
    });
  };
  const collectDown = (rec, d) => {
    if (d <= 0) return;
    index.forEach((c) => {
      if (seen.has(c.id)) return;
      if ((c.links || []).includes(rec.id) || (c.links || []).includes(rec.ref)) {
        seen.add(c.id);
        down.push({ ...c, depth: depth - d + 1 });
        collectDown(c, d - 1);
      }
    });
  };
  collectUp(root, depth);
  collectDown(root, depth);

  return {
    root,
    parents: up,
    children: down,
    // ثابت التحقّق: مجموع أوزان الأبناء لا يتجاوز وزن الأصل
    weightOk: down.length === 0 || down.reduce((a, c) => a + (c.fine || 0), 0) <= (root.fine || 0) + 0.001,
  };
}

/// ── تدقيق الإسناد ──
///
/// سجل يشير إلى مرجع غير موجود يعني رابطًا مكسورًا: تفتح الفاتورة فلا
/// تجد عميلها، أو القيد فلا تجد مستنده.

export { traceRecord };
