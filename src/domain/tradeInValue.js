const tradeInValue = (lines) =>
  (lines || []).reduce((a, l) => a + (Number(l.total) || 0), 0);

/// وزنه الصافي بعيار 24 — للدفتر الوزني.

export { tradeInValue };
