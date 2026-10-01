import React from "react";
import { MessageCircle, Plus, Printer } from "lucide-react";
import { fmtMoney, fmtW, sumMoney } from "../core/money.js";
import { openWhatsApp, prettyPhone } from "../domain/helpers.js";
import { ModalShell } from "../ui/ModalShell.jsx";

/// نصّ الفاتورة لواتساب — سطرٌ لكل قطعة والإجمالي، والآجل بمدفوعه وباقيه
function saleWhatsAppText(sale, { currency = "ر.س", storeName = "" } = {}) {
  if (!sale) return "";
  const lines = (sale.lines || []).map((l) => `• ${l.itemName || "قطعة"} ع${l.karatSnapshot || ""} — ${fmtW(l.weightSnapshot || 0)} جم`);
  const paid = sale.paymentMethod === "credit"
    ? `المدفوع ${currency}${fmtMoney(sale.downPayment || 0)} · الباقي على الحساب ${currency}${fmtMoney(sumMoney([sale.total, -(sale.downPayment || 0)]))}`
    : "";
  return [
    `شكرًا لتسوّقك${storeName ? ` من ${storeName}` : ""}`,
    `فاتورة ${sale.ref} · ${new Date(sale.date || Date.now()).toLocaleDateString("en-GB")}`,
    ...lines,
    `الإجمالي ${currency}${fmtMoney(sale.total)}${Number(sale.taxAmount) > 0 ? ` (شامل الضريبة ${fmtMoney(sale.taxAmount)})` : ""}`,
    paid,
  ].filter(Boolean).join("\n");
}

/// ورقة ما بعد البيع (إعداد «بعد البيع» — مطفأ افتراضًا): ثلاثة أفعال — طباعة · واتساب بجوال العميل · بيع جديد
function PostSaleSheet({ sale, customer = null, currency = "ر.س", storeName = "", onPrint, onNew, onClose }) {
  const phone = customer?.phone || "";
  const big = { minHeight: 52, borderRadius: 16 };
  return (
    <ModalShell title={`تمّ البيع — ${sale.ref}`} onClose={onClose}>
      <div data-post-sale>
        <p style={{ color: "var(--good)", fontFamily: "'Cairo', sans-serif" }} className="text-2xl font-extrabold text-center mb-1">{currency}{fmtMoney(sale.total)}</p>
        <p style={{ color: "var(--text3)" }} className="text-[11px] text-center mb-4">
          {(sale.lines || []).length} قطعة{customer ? ` · ${customer.name}` : ""}
          {sale.paymentMethod === "credit" && sale.downPayment ? ` · مدفوع ${fmtMoney(sale.downPayment)} والباقي على حسابه` : ""}
        </p>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onPrint} className="w-full flex items-center justify-center gap-2 text-sm font-bold"
            style={{ ...big, background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)" }}>
            <Printer size={18} /> اطبع الفاتورة
          </button>
          <button type="button" onClick={() => openWhatsApp(phone, saleWhatsAppText(sale, { currency, storeName }))}
            className="w-full flex items-center justify-center gap-2 text-sm font-bold"
            style={{ ...big, background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
            <MessageCircle size={18} /> {phone ? <>أرسلها بواتساب إلى <bdi dir="ltr">{prettyPhone(phone) || phone}</bdi></> : "أرسلها بواتساب (اختر الرقم)"}
          </button>
          <button type="button" onClick={onNew} data-new-sale className="w-full flex items-center justify-center gap-2 text-sm font-extrabold"
            style={{ ...big, background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
            <Plus size={18} /> بيع جديد
          </button>
          <button type="button" onClick={onClose} className="w-full text-[12px] font-bold" style={{ minHeight: 44, color: "var(--text3)" }}>تمّ — أغلق</button>
        </div>
      </div>
    </ModalShell>
  );
}

export { PostSaleSheet, saleWhatsAppText };
