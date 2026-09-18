function parseAiJson(raw) {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  if (start < 0) return { answer: text, screens: [], followups: [] };
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const obj = JSON.parse(text.slice(start, i + 1));
          if (typeof obj.answer === "string") return obj;
        } catch (e) {
          break;
        }
      }
    }
  }
  return { answer: text, screens: [], followups: [] };
}

export { parseAiJson };
