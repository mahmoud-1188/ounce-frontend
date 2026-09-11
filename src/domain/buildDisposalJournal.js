import { ASSET_CLASSES } from "../core/erp.js";
import { fromHalalas, halalas } from "../core/money.js";
import { assetStatus } from "./assetStatus.js";

function buildDisposalJournal(asset, depreciations, proceeds, target, actor) {
  const st = assetStatus(asset, depreciations);
  const cls = ASSET_CLASSES.find((c) => c.id === asset.classId) || ASSET_CLASSES[0];
  const lines = [];
  const cost = halalas(st.cost);
  const accum = halalas(st.accumulated);
  const cash = halalas(proceeds || 0);
  const book = cost - accum;
  const gain = cash - book;

  if (accum > 0) lines.push({ account: "1490", debit: fromHalalas(accum), credit: 0,
                              memo: "عكس المجمّع" });
  if (cash > 0) lines.push({ account: target || "1110", debit: fromHalalas(cash), credit: 0,
                             memo: "متحصّل البيع" });
  if (gain < 0) lines.push({ account: "6810", debit: fromHalalas(-gain), credit: 0,
                             memo: "خسارة استبعاد" });
  lines.push({ account: cls.account, debit: 0, credit: fromHalalas(cost),
               memo: "إخراج الأصل" });
  if (gain > 0) lines.push({ account: "4210", debit: 0, credit: fromHalalas(gain),
                             memo: "ربح استبعاد" });

  const dr = lines.reduce((a, l) => a + halalas(l.debit), 0);
  const cr = lines.reduce((a, l) => a + halalas(l.credit), 0);
  return {
    entry: {
      id: `${Date.now()}dis`, ref: null, date: new Date().toISOString(),
      opType: "asset_disposal",
      label: `استبعاد ${asset.name}`,
      lines, createdBy: actor || "", posted: true,
      isReversal: false, reversed: false,
    },
    gain: fromHalalas(gain),
    bookValue: fromHalalas(book),
    balanced: dr === cr,
    totals: { debit: fromHalalas(dr), credit: fromHalalas(cr) },
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  دورة الرواتب
//
//  ⚠ الراتب ليس رقمًا واحدًا: أساسيٌّ وبدلات وخصومات وحصّتان في
//  التأمينات. وحصّة المنشأة مصروفٌ عليها لا خصمٌ من الموظف — خلطهما
//  يجعل تكلفة العمالة أقلّ من حقيقتها بنحو عُشرها.
//
//  ومخصّص نهاية الخدمة يتراكم شهريًا لا يُدفع مرة: تأجيله يُظهر ربحًا
//  أعلى طوال سنوات الخدمة ثم يهبط فجأةً في شهر المغادرة.
// ═══════════════════════════════════════════════════════════════════════

export { buildDisposalJournal };
