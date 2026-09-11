function buildStockFeed(items, opts = {}) {
  const low = Number(opts.lowStockAlert) || 1;
  const rows = [];
  (items || []).forEach((it) => {
    const free = (it.units || []).filter((u) => !u.sold && !u.onlineStatus && !it.onlineStatus);
    if (!free.length && !opts.includeEmpty) return;
    rows.push({
      itemId: it.id,
      sku: it.sku || null,
      category: it.categoryId,
      karat: it.karat,
      weight: Number(it.weight) || 0,
      available: free.length,
      unitCodes: free.map((u) => u.code),
      lowStock: free.length > 0 && free.length <= low,
      outOfStock: free.length === 0,
    });
  });
  return {
    generatedAt: new Date().toISOString(),
    totalItems: rows.length,
    outOfStock: rows.filter((r) => r.outOfStock).map((r) => r.sku || r.itemId),
    lowStock: rows.filter((r) => r.lowStock).map((r) => r.sku || r.itemId),
    items: rows,
  };
}

/// يتحقق من طلب متجر ويحدد القطع المستهدفة.
/// يعيد ما نفد صراحةً ليُرسل للمتجر فيُخفيه — لا يكتفي بالرفض.

export { buildStockFeed };
