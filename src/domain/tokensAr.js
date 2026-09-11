import { normAr } from "./normAr.js";
import { stemAr } from "./stemAr.js";

const tokensAr = (t) => normAr(t).split(" ").filter((w) => w.length > 1).map(stemAr);

/// ⚠ كلمات النوايا تمرّ بنفس التطبيع: السؤال يُطبَّع فتصير «بائع»
/// «بايع»، وكلمة النية تبقى «بائع» فلا تتطابقان أبدًا.

export { tokensAr };
