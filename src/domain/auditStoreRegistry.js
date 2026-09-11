import { STORE_REGISTRY } from "../core/stores.js";

function auditStoreRegistry() {
  const issues = [];
  const keys = STORE_REGISTRY.map((r) => r.key);
  const names = STORE_REGISTRY.map((r) => r.name);
  keys.forEach((k, i) => {
    if (!k) issues.push({ i, why: "مفتاح فارغ" });
    else if (keys.indexOf(k) !== i) issues.push({ key: k, why: "مفتاح مكرر" });
  });
  names.forEach((n, i) => {
    if (names.indexOf(n) !== i) issues.push({ name: n, why: "اسم مكرر" });
  });
  return issues;
}

/// يقرأ كل المخازن دفعة واحدة ويُعيد كائنًا بأسماء الحالة.
/// ⚠ النتيجة تُطابَق بالاسم لا بالموضع — هذا هو الفرق كله.

export { auditStoreRegistry };
