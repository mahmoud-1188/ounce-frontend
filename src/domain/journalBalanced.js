
import { halalas } from "../core/money.js";

/// يتحقق من توازن قيد جاهز.
function journalBalanced(entry) {
  // تنبيه: بالهللة كحارس التخزين: جمعُ كسورٍ عشرية يتراكم خطؤه في قيدٍ طويل (0.1+0.2 ≠ 0.3)
  //   فيختلف حكم التدقيق عن حكم الحارس على القيد نفسه.
  const dr = (entry?.lines || []).reduce((a, l) => a + halalas(Number(l.debit) || 0), 0);
  const cr = (entry?.lines || []).reduce((a, l) => a + halalas(Number(l.credit) || 0), 0);
  return dr === cr;
}

export { journalBalanced };
