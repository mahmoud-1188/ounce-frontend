import { useEffect, useState } from "react";
import * as api from "../core/api.js";
import { fmtMoney, fmtW } from "../core/money.js";

/// سطور العرض — واحدةٌ لكل موضع (القوائم · باب التقارير) من نتيجة الخادم (GET /zakat).
function zakatRows(z, fmtM = (x) => fmtMoney(x)) {
  if (!z || z.on === false) return [];
  const pct = `${Math.round(z.rate * 1000000) / 10000}٪`;
  return [
    { key: "cash", label: "النقد والبنك", amount: z.cash },
    { key: "recv", label: "الذمم بالريال المرجوّ تحصيلها", amount: z.receivables },
    { key: "gold", label: `الذهب المملوك ${fmtW(z.goldFine)} جم24 × سعر اليوم`, amount: z.goldValue },
    { key: "work", label: `مصنعيّة القطع المملوكة (${z.pieces || 0} قطعة — من تكلفة المخزون)`, amount: z.workmanship || 0 },
    { key: "grecv", label: `ذهبٌ لنا عند الغير ${fmtW(z.goldRecvFine || 0)} جم24 × سعر اليوم`, amount: z.goldRecvValue || 0 },
    { key: "liab", label: "− الالتزامات المتداولة بالريال", amount: -z.liabilities || 0 },
    { key: "owed", label: `− ما علينا ذهبًا ${fmtW(z.goldOwedFine)} جم24 × سعر اليوم`, amount: -z.goldOwedValue || 0 },
    { key: "base", label: "وعاء الزكاة", amount: z.base, strong: true },
    { key: "due", label: `الزكاة ${pct} — سنة ${z.year === "hijri" ? "هجرية" : "ميلادية"}`, amount: z.due, strong: true },
  ].map((r) => ({ ...r, text: fmtM(r.amount) }));
}

/// الزكاة من الخادم بطريقةٍ واحدة — الدفاتر كاملة لا آخر 2000 قيد المحمّلة في الواجهة.
/// ترجع null أثناء التحميل أو عند الخطأ، و{ on: false } حين تُطفأ من الإعدادات.
function useZakat(price24, asOf = null) {
  const [z, setZ] = useState(null);
  useEffect(() => {
    let live = true;
    api.fetchZakat({ price24, asOf }).then((r) => { if (live) setZ(r); }).catch(() => { if (live) setZ(null); });
    return () => { live = false; };
  }, [price24, asOf]);
  return z;
}

export { useZakat, zakatRows };
