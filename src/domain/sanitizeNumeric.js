import { toLatinDigits } from "./helpers.js";

function sanitizeNumeric(raw) {
  const latin = toLatinDigits(raw).replace(/[^\d.]/g, "");
  const parts = latin.split(".");
  return parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : latin;
}

export { sanitizeNumeric };
