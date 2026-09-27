import { fmt, fmtMoney, fmtW } from "../core/money.js";
import { categoryLabel } from "./helpers.js";
import { qrSvg } from "./qrBig.js";

/// الفاتورة المطبوعة (المرجع 5.2.0: printSaleInvoice) — A4 أو إيصالٌ حراري 80مم (وحدة thermalReceipt)،
/// وبلغتين (bilingualInvoice)، ورمز QR الضريبي للمرحلة الأولى (zatca) على الفاتورة الضريبية المبسّطة.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };

/// TLV: وسمٌ بايتًا، وطولٌ بايتًا، ثم القيمة UTF-8 — والكلّ base64 (مواصفة الهيئة للمرحلة الأولى)
function zatcaTlv(fields) {
  const parts = [];
  fields.forEach(([tag, val]) => {
    const v = new TextEncoder().encode(String(val ?? ""));
    parts.push(tag, Math.min(v.length, 255), ...v.slice(0, 255));
  });
  return b64(Uint8Array.from(parts));
}
const zatcaQr = ({ sellerName, vatNumber, issuedAt, total, vat }) =>
  zatcaTlv([[1, sellerName], [2, vatNumber], [3, issuedAt], [4, Number(total || 0).toFixed(2)], [5, Number(vat || 0).toFixed(2)]]);

function invoiceHtml(sale, { info = {}, currency = "ر.س", modules = {} } = {}) {
  const cur = esc(currency);
  const on = (id) => !!modules?.[id]?.on;
  const thermal = on("thermalReceipt"), bi = on("bilingualInvoice");
  const L = (ar, en) => (bi ? `${ar} <span class="en">${en}</span>` : ar);
  const money = (v) => fmtMoney(v || 0);
  const taxed = !!sale.taxApplicable && Number(sale.taxAmount) > 0;
  const title = taxed ? L("فاتورة ضريبية مبسّطة", "Simplified Tax Invoice") : L("فاتورة", "Invoice");
  const seller = info.legalName || info.storeName || info.name || "";
  const qr = taxed && on("zatca") && info.vatNumber
    ? zatcaQr({ sellerName: seller, vatNumber: info.vatNumber, issuedAt: new Date(sale.date).toISOString().slice(0, 19) + "Z", total: sale.total, vat: sale.taxAmount }) : "";
  const pay = { cash: L("نقدًا", "Cash"), card: L("شبكة", "Card"), credit: L("آجل", "Credit"), split: L("نقد + شبكة", "Cash + Card"), trade_in: L("بدل بكسر", "Trade-in") }[sale.paymentMethod] || esc(sale.paymentMethod || "");
  const rows = (sale.lines || []).map((l) => {
    const extra = [
      l.gem ? `${esc(l.gem.carat || "")} ${L("قيراط", "ct")} · ${esc(l.gem.color || "")} · ${esc(l.gem.clarity || "")} · ${esc(l.gem.cut || "")}${l.gem.certNo ? ` · ${esc(l.gem.lab || "")} ${esc(l.gem.certNo)}` : ""}` : "",
      l.watch ? `${esc(l.watch.brand || "")} ${esc(l.watch.model || "")} · ${L("رقم", "S/N")} ${esc(l.watch.serial || "")}${l.watch.warrantyMonths ? ` · ${L("ضمان", "Warranty")} ${esc(l.watch.warrantyMonths)} ${L("شهرًا", "mo")}` : ""}` : "",
    ].filter(Boolean).join("<br>");
    return `<tr><td class="r">${esc(l.itemName || `${categoryLabel(l.category)} ع${l.karatSnapshot || ""}`)}${extra ? `<div class="x">${extra}</div>` : ""}</td>
      <td>${esc(l.karatSnapshot || "")}</td><td>${fmtW(l.weightSnapshot || 0)}</td><td>${esc(l.quantity || 1)}</td><td>${money((Number(l.unitPrice) || 0) * (Number(l.quantity) || 1))}</td></tr>`;
  }).join("");
  const w = thermal ? "72mm" : "190mm";
  const logo = info.logo && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(info.logo) ? `<img class="logo" src="${esc(info.logo)}">` : "";
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(sale.ref)}</title><style>
  @page { size: ${thermal ? "80mm auto" : "A4 portrait"}; margin: ${thermal ? "3mm" : "12mm"}; }
  body { font-family:"Tajawal","Segoe UI",sans-serif; color:#000; margin:0; font-size:${thermal ? "10.5px" : "11.5px"}; }
  .w { width:${w}; margin:0 auto; } .c { text-align:center; } .en { color:#444; font-size:.85em; }
  h1 { font-size:${thermal ? "14px" : "18px"}; margin:4px 0; text-align:center; } .meta { color:#333; font-size:.9em; text-align:center; }
  table { width:100%; border-collapse:collapse; margin:6px 0; } th,td { border-bottom:1px dashed #999; padding:3px 2px; text-align:center; font-size:.95em; }
  th { border-bottom:1.5px solid #000; } td.r { text-align:right; } .x { color:#444; font-size:.85em; }
  .tot div { display:flex; justify-content:space-between; padding:2px 0; } .tot .g { font-weight:800; font-size:1.2em; border-top:1.5px solid #000; }
  .qr { text-align:center; margin:8px 0; } .foot { text-align:center; color:#444; font-size:.85em; margin-top:6px; }
  img.logo { width:${thermal ? "46px" : "64px"}; display:block; margin:0 auto; }
</style></head><body><div class="w">
${logo}
<div class="c" style="font-weight:800;font-size:1.15em">${esc(seller)}</div>
<div class="meta">${[info.vatNumber ? `${L("الرقم الضريبي", "VAT No.")} ${esc(info.vatNumber)}` : "", info.crNumber ? `${L("س.ت", "CR")} ${esc(info.crNumber)}` : "", esc(info.address || ""), esc(info.phone || "")].filter(Boolean).join(" · ")}</div>
<h1>${title}</h1>
<div class="meta">${L("رقم", "No.")} ${esc(sale.ref)} · ${esc(new Date(sale.date).toLocaleString("en-GB"))}${sale.customerName ? ` · ${L("العميل", "Customer")}: ${esc(sale.customerName)}` : ""}</div>
<table><thead><tr><th class="r">${L("الصنف", "Item")}</th><th>${L("العيار", "Karat")}</th><th>${L("الوزن", "Wt")}</th><th>${L("الكمّية", "Qty")}</th><th>${L("المبلغ", "Amount")}</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot">
  ${taxed ? `<div><span>${L("الإجمالي قبل الضريبة", "Total excl. VAT")}</span><span>${cur}${money(sale.netAmount)}</span></div>
  <div><span>${L("ضريبة القيمة المضافة", "VAT")} ${fmt((Number(sale.taxRate) || 0) * 100, 0)}٪</span><span>${cur}${money(sale.taxAmount)}</span></div>` : ""}
  ${Number(sale.depositApplied) > 0 ? `<div><span>${L("عربونٌ مقبوض سلفًا", "Deposit applied")}</span><span>${cur}${money(sale.depositApplied)}</span></div>` : ""}
  ${Number(sale.giftPart) > 0 ? `<div><span>${L("مدفوعٌ ببطاقة هدية", "Paid by gift card")}</span><span>${cur}${money(sale.giftPart)}</span></div>` : ""}
  <div class="g"><span>${L("الإجمالي", "Total")}${taxed ? ` ${L("شامل الضريبة", "incl. VAT")}` : ""}</span><span>${cur}${money(sale.total)}</span></div>
  <div><span>${L("الدفع", "Payment")}</span><span>${pay}</span></div>
</div>
${qr ? `<div class="qr">${qrSvg(qr, thermal ? 120 : 140)}</div>` : ""}
<div class="foot">${sale.sellerName ? `${L("البائع", "Seller")}: ${esc(sale.sellerName)}` : ""}</div>
</div></body></html>`;
}

function printSaleInvoice(sale, opts = {}) {
  if (!sale) return false;
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(invoiceHtml(sale, opts)); win.document.close();
  setTimeout(() => { try { win.focus(); win.print(); } catch { /* المستخدم أغلقها */ } }, 350);
  return true;
}

export { invoiceHtml, printSaleInvoice, zatcaQr, zatcaTlv };
