const stageOf = (e) => {
  // السجلات القديمة بلا مرحلة: الموجب في صندوق الكسر والسالب مستهلك
  if (e?.stage) return e.stage;
  if (e?.status === "used_for_taskir" || e?.status === "converted") return "used";
  return (Number(e?.weight) || 0) < 0 ? "used" : "in_box";
};

/// الكسر القابل للسداد به — في الخزنة فقط.

export { stageOf };
