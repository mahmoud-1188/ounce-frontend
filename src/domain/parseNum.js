const parseNum = (v) => {
  const s = String(v || "").replace(/[^\d.\-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export { parseNum };
