function buildRfidSession({ kind = "rfid", sessionId, branch = {}, user = "", found = [], missing = [], unknown = [], otherStore = [],
  categories = [], scannedAt = null }) {
  const at = scannedAt || new Date().toISOString();
  const nameOf = (it) => it?.description || (categories.find((c) => c.id === (it?.categoryId || it?.category))?.label) || it?.category || "قطعة";
  const rows = [];
  for (const f of found) {
    const it = f.item || {}; rows.push({ epc: String(f.epc || f.unit?.epc || "").toUpperCase(), code: f.unit?.code || f.code || "", name: `${nameOf(it)} عيار ${it.karat || "—"}`,
      weight: Number(it.weight) || 0, karat: Number(it.karat) || null, status: "Verified", rssi: f.tag?.rssi ?? f.rssi ?? null, at }); }
  for (const m of missing) { const it = m.item || m; rows.push({ epc: String(m.unit?.epc || m.epc || "").toUpperCase(), code: m.unit?.code || m.code || "", name: `${nameOf(it)} عيار ${it.karat || "—"}`,
      weight: Number(it.weight) || 0, karat: Number(it.karat) || null, status: "Missing", rssi: null, at }); }
  for (const u of unknown) rows.push({ epc: String(u).toUpperCase(), code: "", name: "رقاقةٌ غير معروفة", weight: 0, karat: null, status: "Unknown", rssi: null, at });
  for (const o of otherStore) rows.push({ epc: String(o.epc || o).toUpperCase(), code: o.code || "", name: "رقاقةُ محلٍّ آخر", weight: 0, karat: null, status: "OtherStore", rssi: null, at });
  const verified = rows.filter((r) => r.status === "Verified");
  return {
    kind, session_id: sessionId, timestamp: at,
    branch_id: branch.code || branch.id || "LOCAL", branch_name: branch.name || "", branch_vat: branch.vat || "", branch_cr: branch.cr || "", branch_phone: branch.phone || "", branch_logo: branch.logo || null,
    user, total_items: verified.length, missing_items: rows.filter((r) => r.status === "Missing").length,
    unknown_items: rows.filter((r) => r.status !== "Verified" && r.status !== "Missing").length,
    total_weight: Math.round(verified.reduce((a, r) => a + r.weight, 0) * 1000) / 1000,
    rows,
  };
}

/// JSON — مخطّط المواصفة حرفيًّا.

export { buildRfidSession };
