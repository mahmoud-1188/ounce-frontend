import { stageOf } from "./stageOf.js";

const settleableScrap = (entries) =>
  (entries || []).filter((e) => stageOf(e) === "in_safe" || (Number(e.weight) || 0) < 0);

export { settleableScrap };
