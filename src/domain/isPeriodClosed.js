const isPeriodClosed = (closes, dateOrPeriod) => {
  const p = String(dateOrPeriod || "").slice(0, 7);
  return (closes || []).some((c) => c.period === p && c.status === "closed");
};

/// فحوصات ما قبل الإقفال.

export { isPeriodClosed };
