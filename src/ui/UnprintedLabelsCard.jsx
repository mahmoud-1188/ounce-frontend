import React, { useState } from "react";
import { isLabelPrinter, printLabelsToDevice } from "../domain/labelPrint.js";

/// قطعٌ مختارة للخروج بلا ملصقٍ مطبوع: تُذكر بعددها، وتُطبع هنا على طابعة الملصقات قبل الإرسال
/// units: [{ item, code }]
function UnprintedLabelsCard({ units = [], where = "التحويل", printerCfg = null, onSavePrinter = null, onBindEpc = null, onSetPrinted = null, currency = "ر.س", price24 = 0 }) {
  const [status, setStatus] = useState(null);
  if (!units.length) return null;
  const canPrint = isLabelPrinter(printerCfg);
  const printNow = () => {
    setStatus({ text: `جارٍ الإرسال للطابعة… 0 من ${units.length}` });
    printLabelsToDevice(units, {
      cfg: printerCfg, currency, price24, onBindEpc,
      onRemember: (serial) => onSavePrinter?.({ ...printerCfg, usbSerial: serial }),
      onProgress: (n, total) => setStatus({ text: `جارٍ الإرسال للطابعة… ${n} من ${total}` }),
    }).then((n) => {
      // ⚠ يُعلَّم «مطبوعًا» ما أُرسل فعلًا فقط
      const byItem = {};
      units.forEach((u) => { (byItem[u.item.id] = byItem[u.item.id] || []).push(u.code); });
      Object.entries(byItem).forEach(([itemId, codes]) => onSetPrinted?.(itemId, codes, true));
      setStatus({ ok: true, text: `✓ طُبع ${n} ملصق — أرسل الآن` });
    }).catch((e) => setStatus({ bad: true, text: `تعذّرت الطباعة: ${e?.message || e}` }));
  };
  return (
    <div data-unprinted-card className="mt-2 p-3 rounded-xl" style={{ background: "var(--badBg)", border: "1px solid var(--badLine)" }}>
      <p style={{ color: "var(--bad)", margin: 0 }} className="text-[12px] font-bold">
        ⚠ {units.length} قطعة مختارة بلا ملصقٍ مطبوع — لا تخرج قطعةٌ في {where} بلا ملصقها
      </p>
      <p style={{ color: "var(--text2)", margin: "4px 0 0", fontFamily: "monospace" }} className="text-[11px]">{units.map((u) => u.code).join(" · ")}</p>
      {canPrint ? (
        <button type="button" data-print-unprinted onClick={printNow} className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold"
          style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
          اطبع ملصقاتها الآن ({units.length})
        </button>
      ) : (
        <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[11px]">اضبط طابعة الملصقات من «إعدادات الطابعة»، أو اطبعها من «إعادة الطباعة».</p>
      )}
      {status && (
        <p style={{ color: status.bad ? "var(--bad)" : status.ok ? "var(--good)" : "var(--accent)", margin: "6px 0 0" }} className="text-[11px]" data-unprinted-status>{status.text}</p>
      )}
    </div>
  );
}

export { UnprintedLabelsCard };
