import { REF_KIND } from "../core/money-rules.js";

const kindOfRef = (ref) => REF_KIND[String(ref || "").split("-")[0]] || null;

/// يبني الرقم التالي بالتسلسل ضمن نوعه: SUP-001, SUP-002...

export { kindOfRef };
