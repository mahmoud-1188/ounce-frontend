import { fmtMoney, fromHalalas } from "../core/money.js";
import { balancesAt } from "./helpers.js";

function suggestAdjustments({ journal = [], accounts = [], to, assets = [], expenses = [], sales = [] }) {
  const b = balancesAt(journal, to);
  const out = [];
  const bal = (c) => fromHalalas(b[c] || 0);

  const prepaid = bal("1180");
  if (prepaid > 0) out.push({ id: "prepaid", label: "إطفاء المصروفات المدفوعة مقدّمًا",
    why: `رصيد 1180 = ${fmtMoney(prepaid)} — ما استُهلك منه يجب أن يصير مصروفًا`,
    debit: "6900", credit: "1180", amount: null, needsInput: true });

  const accrued = bal("2250");
  if (Math.abs(accrued) > 0) out.push({ id: "accrued", label: "إثبات المصروفات المستحقة",
    why: `رصيد 2250 = ${fmtMoney(-accrued)} — مصروفات وقعت ولم تُدفع`,
    debit: "6900", credit: "2250", amount: null, needsInput: true });

  const openAssets = (assets || []).filter((a) => !a.disposedAt);
  if (openAssets.length) out.push({ id: "depreciation", label: "إهلاك الفترة",
    why: `${openAssets.length} أصلًا قائمًا — الإهلاك مصروفٌ لا يُدفع نقدًا`,
    debit: "6800", credit: "1490", amount: null, needsInput: true });

  const receivables = bal("1310");
  if (receivables > 0) out.push({ id: "doubtful", label: "مخصّص الديون المشكوك فيها",
    why: `ذمم ${fmtMoney(receivables)} — ما لا يُتوقّع تحصيله يُخصَّص`,
    debit: "6910", credit: "1195", amount: null, needsInput: true });

  const stock = bal("1210");
  if (stock > 0) out.push({ id: "inventoryClose", label: "إثبات مخزون آخر المدة",
    why: `النظام دوري: تكلفة المبيعات = أول المدة + مشتريات − آخر المدة`,
    debit: "5160", credit: "5100", amount: stock, needsInput: false });

  const vatOut = -bal("2225"), vatIn = bal("1360");
  if (vatOut || vatIn) out.push({ id: "vat", label: "تسوية ضريبة القيمة المضافة",
    why: `مخرجات ${fmtMoney(vatOut)} − مدخلات ${fmtMoney(vatIn)} = ${fmtMoney(vatOut - vatIn)} مستحقة`,
    debit: "2225", credit: "1360", amount: Math.min(vatOut, vatIn), needsInput: false });

  return out;
}

export { suggestAdjustments };
