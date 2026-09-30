const KEY = "ounce_row_hint_seen";

/// تلميح «⋯» يظهر مرّةً حتى يُستعمل أو يُخفى — التخزين قد يُحجب فنتسامح.
function rowHintSeen() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return true; }
}
function markRowHintSeen() {
  try { localStorage.setItem(KEY, "1"); } catch { /* تخزينٌ محجوب */ }
}

export { markRowHintSeen, rowHintSeen };
