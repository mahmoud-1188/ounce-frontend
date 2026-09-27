/// يحوّل عناصر الزرّ إلى صفوفٍ لمن يملكها — المجهول يسقط، والزرّ بلا صفوف يختفي. دالّةٌ نقيّة.
function simpleRows(items, has, registry = []) {
  return items.map((it) => {
    if (it && typeof it === "object" && !Array.isArray(it)) {
      const need = [].concat(it.need || []);
      return need.length && !need.some((n) => has(n)) ? null : { id: `act:${it.act}`, act: it.act, label: it.label, primary: true };
    }
    const [id, label] = Array.isArray(it) ? it : [it, null];
    const base = id.split(":")[0];
    const reg = registry.find((n) => n.id === base);
    if (!has(base) || (!reg && !label)) return null;
    return { id, label: label || reg.label.split(" — ")[0], icon: reg?.icon };
  }).filter(Boolean);
}

/// «الآن» — المهامّ مرتّبةً بأولويّتها في هذه اللحظة (المرجع 2026-09-27):
///   ١ ما يوقف العمل (يومٌ مغلق · سعرٌ لم يُجلب) ← ٢ ما ينتظر قرارك (تنبيهات · اعتمادات) ← ٣ ما يحين وقته (إقفال المساء).
///   `level`: "block" يوقف · "act" ينتظرك · "soon" يحين.
const RANK = { block: 0, act: 1, soon: 2 };
function branchNowTasks({ openDay = null, has = () => false, priceOk = true, alerts = 0, approvals = 0, hour = 12 } = {}) {
  const t = [];
  if (!openDay && has("sales")) t.push({ id: "openDay", level: "block", tone: "sales", label: "افتح يوم العمل", hint: "البيع والصندوق يبدآن بعده" });
  if (!priceOk && has("price")) t.push({ id: "price", level: "block", tone: "money", label: "حدّث سعر الذهب", hint: "لم يُجلب السعر — الفواتير تحتاجه" });
  if (approvals > 0 && has("approvals")) t.push({ id: "approvals", level: "act", tone: "accounting", label: `${approvals} طلبًا ينتظر اعتمادك`, hint: "الاعتمادات" });
  if (alerts > 0) t.push({ id: has("accountantReview") ? "accountantReview" : "dashboard", level: "act", tone: "accounting", label: `${alerts} يحتاج انتباهك`, hint: "مراجعة وتطابق" });
  if (openDay && hour >= 20 && has("workday")) t.push({ id: "workday", level: "soon", tone: "system", label: "أقفل يوم العمل", hint: "آخر المساء — طابق الصندوق وأقفل" });
  return t.sort((a, b) => RANK[a.level] - RANK[b.level]);
}

function hqNowTasks({ branches = 0, stale = 0, inbox = 0, alerts = [] } = {}) {
  const t = [];
  if (!branches) t.push({ id: "branches", level: "block", tone: "central", label: "أضف فرعك الأوّل", hint: "الإدارة تبدأ بفرع" });
  if (inbox > 0) t.push({ id: "approvals", level: "act", tone: "accounting", label: `${inbox} طلبًا من الفروع ينتظر اعتمادك`, hint: "الاعتمادات" });
  if (alerts.length) t.push({ id: "alerts", level: alerts.some((a) => a.level === "block") ? "block" : "act", tone: "central", label: `${alerts.length} يحتاج انتباهك`, hint: `${alerts[0].name || ""}: ${alerts[0].label || ""}` });
  if (branches && stale > 0) t.push({ id: "branches", level: "soon", tone: "links", label: `${stale} فرعًا بلا حركة اليوم`, hint: "تحقّق من اتصالها" });
  return t.sort((a, b) => RANK[a.level] - RANK[b.level]);
}

export { branchNowTasks, hqNowTasks, simpleRows };
