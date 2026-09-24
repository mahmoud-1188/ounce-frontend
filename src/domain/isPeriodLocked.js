function isPeriodLocked(date, locks, role) {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return { locked: false };
  const all = locks?.lockAll ? new Date(`${locks.lockAll}T23:59:59.999`).getTime() : null;
  const posted = locks?.lockPosted ? new Date(`${locks.lockPosted}T23:59:59.999`).getTime() : null;
  if (all && t <= all) {
    return { locked: true, why: `الفترة حتى ${locks.lockAll} مقفلة نهائيًّا — لا قيود فيها` };
  }
  if (posted && t <= posted && role !== "manager") {
    return { locked: true, why: `الفترة حتى ${locks.lockPosted} مقفلة — المدير وحده يُعدّل فيها` };
  }
  return { locked: false };
}

/// أعمار الديون — كم مضى على كل رصيد.
///
/// ⚠ رصيدٌ إجمالي لا يُنبئ بشيء: مئة ألفٍ عمرها أسبوع غير مئة ألفٍ عمرها
/// سنة. والثانية غالبًا لن تُحصَّل.

export { isPeriodLocked };
