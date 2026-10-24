import { DEFAULT_PRINTER } from "../core/constants.js";
import { fitLayout } from "./labelPrinter.js";

/// نماذج الملصق الثلاثة: لكلٍّ اسمه ومقاسه وتخطيطه، والباقي (الطابعة · الدقّة · الرقاقة · الفجوة) مشترك.
/// ⚠ ما حُفظ قبل النماذج يصير «نموذج 1» بمقاسه وتخطيطه.
const LABEL_MODEL_IDS = Object.freeze(["m1", "m2", "m3"]);
const LABEL_MODEL_DEFAULTS = Object.freeze({
  m1: { name: "نموذج 1", labelWidthMm: 50, labelHeightMm: 20 },
  m2: { name: "نموذج 2", labelWidthMm: 40, labelHeightMm: 30 },
  m3: { name: "نموذج 3", labelWidthMm: 30, labelHeightMm: 15 },
});

// لا نقصّ المسافة الأخيرة أثناء الكتابة وإلا ضاعت المسافة قبل الكلمة التالية
const cleanLabelModelName = (v, fallback) => { const t = String(v == null ? "" : v).replace(/\s{2,}/g, " ").replace(/^\s+/, "").slice(0, 24); return t.trim() ? t : fallback; };

function syncActiveLabelModel(cfg) {
  const base = { ...(cfg || {}) };
  const active = LABEL_MODEL_IDS.includes(base.activeModel) ? base.activeModel : "m1";
  const saved = base.models && typeof base.models === "object" ? base.models : {};
  const models = {};
  for (const id of LABEL_MODEL_IDS) {
    const d = LABEL_MODEL_DEFAULTS[id], sv = saved[id] || {};
    const w = Number(sv.labelWidthMm) > 0 ? Number(sv.labelWidthMm) : d.labelWidthMm;
    const h = Number(sv.labelHeightMm) > 0 ? Number(sv.labelHeightMm) : d.labelHeightMm;
    models[id] = { name: cleanLabelModelName(sv.name, d.name), labelWidthMm: w, labelHeightMm: h,
      layout: sv.layout && typeof sv.layout === "object" ? sv.layout : fitLayout(DEFAULT_PRINTER.layout, w, h) };
  }
  // النموذج الفعّال يأخذ المقاس والتخطيط الحاليين
  const w = Number(base.labelWidthMm) > 0 ? Number(base.labelWidthMm) : models[active].labelWidthMm;
  const h = Number(base.labelHeightMm) > 0 ? Number(base.labelHeightMm) : models[active].labelHeightMm;
  models[active] = { ...models[active], labelWidthMm: w, labelHeightMm: h, layout: base.layout && typeof base.layout === "object" ? base.layout : models[active].layout };
  return { ...base, activeModel: active, models };
}

function switchLabelModel(cfg, id) {
  if (!LABEL_MODEL_IDS.includes(id)) return syncActiveLabelModel(cfg);
  const s = syncActiveLabelModel(cfg);
  const m = s.models[id];
  return { ...s, activeModel: id, labelWidthMm: m.labelWidthMm, labelHeightMm: m.labelHeightMm, layout: m.layout };
}

function renameLabelModel(cfg, id, name) {
  const s = syncActiveLabelModel(cfg);
  if (!LABEL_MODEL_IDS.includes(id)) return s;
  return { ...s, models: { ...s.models, [id]: { ...s.models[id], name: cleanLabelModelName(name, LABEL_MODEL_DEFAULTS[id].name) } } };
}

function labelModelList(cfg) {
  const s = syncActiveLabelModel(cfg);
  return LABEL_MODEL_IDS.map((id) => ({ id, name: s.models[id].name, w: s.models[id].labelWidthMm, h: s.models[id].labelHeightMm, active: id === s.activeModel }));
}

export { LABEL_MODEL_DEFAULTS, LABEL_MODEL_IDS, labelModelList, renameLabelModel, switchLabelModel, syncActiveLabelModel };
