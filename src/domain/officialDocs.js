import { fmtMoney, fmtW } from "../core/money.js";
import { categoryLabel } from "./helpers.js";

/// الصيغ الرسمية للمحاسبين والجهات الرسمية (تُشغَّل من الإعدادات: officialPrint):
/// سندات بالمبلغ كتابةً وثلاثة توقيعات وأصلٍ وصورة، وإشعارٌ دائن للمرتجع يحيل إلى فاتورته — بترويسةٍ بالرقم الضريبي والسجلّ.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const AR_ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const AR_TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const AR_HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function arabicNumberWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return "صفر";
  if (n >= 1e9) return String(n);
  const below1000 = (x) => {
    const h = Math.floor(x / 100), r = x % 100, parts = [];
    if (h) parts.push(AR_HUNDREDS[h]);
    if (r) {
      if (r < 20) parts.push(AR_ONES[r]);
      else { const o = r % 10, t = Math.floor(r / 10); parts.push(o ? `${AR_ONES[o]} و${AR_TENS[t]}` : AR_TENS[t]); }
    }
    return parts.join(" و");
  };
  // التمييز بآخر رقمين: 3–10 جمع (آلاف)، 11–99 مفردٌ منصوب (ألفًا)، والمئات والصفر مفردٌ مجرور (مائة ألف)
  const scale = (x, one, two, few, many) => {
    if (x === 1) return one;
    if (x === 2) return two;
    const r2 = x % 100;
    return `${below1000(x)} ${r2 >= 3 && r2 <= 10 ? few : r2 >= 11 ? many : one}`;
  };
  const m = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), r = n % 1000, parts = [];
  if (m) parts.push(scale(m, "مليون", "مليونان", "ملايين", "مليونًا"));
  if (th) parts.push(scale(th, "ألف", "ألفان", "آلاف", "ألفًا"));
  if (r) parts.push(below1000(r));
  return parts.join(" و");
}

function arabicAmountWords(amount, { unit = "ريال سعودي", sub = "هللة" } = {}) {
  const h = Math.round(Math.abs(Number(amount) || 0) * 100), whole = Math.floor(h / 100), cents = h % 100;
  return `${arabicNumberWords(whole)} ${unit}${cents ? ` و${arabicNumberWords(cents)} ${sub}` : ""} فقط لا غير`;
}

const OFFICIAL_DOC_CSS = `
  body { font-family:"Tajawal","Segoe UI",sans-serif; color:#111; margin:0; font-size:11.5px; }
  table { width:100%; border-collapse:collapse; margin:6px 0; } th,td { border:1px solid #999; padding:4px 6px; font-size:10.5px; }
  th { background:#eee; font-weight:700; text-align:center; } td.c { text-align:center; } td.r { text-align:right; }
  .kv { display:grid; grid-template-columns:1fr 1fr; gap:4px 16px; margin:8px 0; } .kv div { border-bottom:1px dotted #999; padding:3px 0; font-size:11px; }
  .kv b { color:#333; margin-left:6px; } .box { border:1.5px solid #333; border-radius:6px; padding:8px 10px; margin:8px 0; font-size:12px; }
  .amount { font-size:18px; font-weight:800; text-align:center; border:2px solid #333; border-radius:6px; padding:6px; margin:8px 0; }
  .sign { margin-top:26px; display:flex; gap:24px; } .sign div { flex:1; border-top:1px solid #333; padding-top:4px; text-align:center; font-size:10.5px; }
  .foot { margin-top:10px; padding-top:4px; border-top:1px solid #999; color:#555; font-size:9px; display:flex; justify-content:space-between; }
  .copy { text-align:center; color:#666; font-size:10px; margin-bottom:4px; } .brk { page-break-after:always; }`;

const VOUCHER_KINDS = {
  receipt: { title: "سند قبض", who: "استلمنا من السيد/السادة", signs: ["المستلم", "المحاسب", "المدير"] },
  expense: { title: "سند صرف", who: "يُصرف إلى السيد/السادة", signs: ["المستلم", "المحاسب", "المدير"] },
  settle: { title: "سند سداد مورد", who: "سُدِّد إلى المورد", signs: ["المستلم", "المحاسب", "المدير"] },
  scrap: { title: "سند شراء ذهب مستعمل", who: "اشترينا من السيد/السادة", signs: ["البائع", "المشتري", "المدير"] },
  office: { title: "سند شراء من مكتب", who: "اشترينا من", signs: ["المكتب", "المحاسب", "المدير"] },
};

// ترويسةٌ رسمية: الاسم القانوني والسجل التجاري والرقم الضريبي والعنوان
function officialHeadHtml(title, sub, info = {}) {
  const meta = [info.crNumber ? `س.ت ${esc(info.crNumber)}` : "", info.vatNumber ? `الرقم الضريبي ${esc(info.vatNumber)}` : "",
    esc([info.address, info.city].filter(Boolean).join(" · ")), info.phone ? `هاتف ${esc(info.phone)}` : ""].filter(Boolean).join(" · ");
  const logo = info.logo && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(info.logo) ? `<img src="${esc(info.logo)}" alt="" style="width:56px;height:56px;object-fit:contain" />` : "";
  return `<div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:12px">
    ${logo}<div style="flex:1"><div style="font-size:15px;font-weight:800">${esc(info.legalName || info.storeName || info.name || "")}</div>
    ${meta ? `<div style="font-size:10px;color:#444">${meta}</div>` : ""}</div>
    <div style="text-align:left"><div style="font-size:16px;font-weight:800">${esc(title)}</div>${sub ? `<div style="font-size:10px;color:#555">${esc(sub)}</div>` : ""}</div></div>`;
}

// أصلٌ وصورة على صفحتين حين copies = 2
function officialDocHtml({ title, sub = "", size = "A5 portrait", margin = "10mm", body = "", info = {}, copies = 1 }) {
  const page = (label) => `${label ? `<div class="copy">${label}</div>` : ""}${officialHeadHtml(title, sub, info)}${body}
<div class="foot"><span>${esc(info.name || "")}</span><span>طُبع ${esc(new Date().toLocaleString("en-GB"))}</span></div>`;
  const pages = copies > 1 ? `${page("الأصل")}<div class="brk"></div>${page("صورة")}` : page("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page { size: ${size}; margin: ${margin}; }${OFFICIAL_DOC_CSS}</style></head><body>${pages}</body></html>`;
}

const METHOD_LABEL = { cash: "نقدًا", network: "شبكة", card: "شبكة", bank: "تحويل بنكي", safe_cash: "نقدًا من الخزنة", safe_network: "من شبكة الخزنة",
  daily_cash: "نقدًا — الصندوق", daily_network: "شبكة — الصندوق", deferred: "آجل", credit: "آجل" };

function voucherHtml(doc, { currency = "ر.س", info = {}, copies = 2 } = {}) {
  const x = doc.rec || {}, k = VOUCHER_KINDS[doc.kind] || VOUCHER_KINDS.receipt;
  const method = x.method || x.paymentMethod || x.fundingSource || "";
  const about = doc.kind === "scrap" ? `${fmtW(x.weight || 0)} جم عيار ${esc(x.karat || "")}${x.pricePerGram ? ` × ${fmtMoney(x.pricePerGram)}` : ""}`
    : (x.note || x.name || x.category || doc.note || "");
  const body = `
<div class="kv">
  <div><b>رقم السند</b> ${esc(doc.ref || "")}</div><div><b>التاريخ</b> ${esc(new Date(doc.date).toLocaleString("en-GB"))}</div>
  <div style="grid-column:1/3"><b>${k.who}</b> ${esc(doc.party || "")}</div>
  <div style="grid-column:1/3"><b>مبلغًا وقدره</b> ${esc(arabicAmountWords(doc.amount))}</div>
  <div style="grid-column:1/3"><b>وذلك عن</b> ${esc(about || "—")}</div>
  <div><b>طريقة الدفع</b> ${esc(METHOD_LABEL[method] || method || "—")}</div><div><b>العملة</b> ${esc(currency)}</div>
</div>
<div class="amount">${esc(currency)} ${fmtMoney(doc.amount)}</div>
<div class="sign">${k.signs.map((t) => `<div>${esc(t)}</div>`).join("")}</div>`;
  return officialDocHtml({ title: k.title, sub: info.name || "", body, info, copies });
}

// إشعار دائن للمرتجع يحيل إلى الفاتورة الأصل — بسطور ما رجع منها وضريبته
function creditNoteHtml(doc, { currency = "ر.س", info = {}, sale = null, copies = 2 } = {}) {
  const r = doc.rec || {};
  const saved = Array.isArray(r.lines) ? r.lines : [];
  const lines = saved.length
    ? saved.map((l) => ({ name: `${categoryLabel(l.category)} ع${l.karat || ""}`, karat: l.karat, weight: Number(l.weight_snapshot) || 0, quantity: Number(l.quantity) || 1, amount: (Number(l.unit_price) || 0) * (Number(l.quantity) || 1) }))
    : (sale?.lines || []).filter((_, i) => !(r.lineIndexes || []).length || r.lineIndexes.includes(i))
      .map((l) => ({ name: l.itemName || `${categoryLabel(l.category)} ع${l.karatSnapshot || ""}`, karat: l.karatSnapshot, weight: Number(l.weightSnapshot) || 0, quantity: Number(l.quantity) || 1, amount: (Number(l.unitPrice) || 0) * (Number(l.quantity) || 1) }));
  const refund = Number(r.refund ?? doc.amount) || 0;
  const rate = sale && Number(sale.taxAmount) > 0 ? Number(sale.taxRate) || 0 : 0;
  const tax = rate > 0 ? Math.round((refund - refund / (1 + rate)) * 100) / 100 : 0;
  const rows = lines.map((l) => `<tr><td class="r">${esc(l.name)}</td><td class="c">${esc(l.karat || "")}</td><td class="c">${fmtW(l.weight)}</td><td class="c">${esc(l.quantity)}</td><td class="c">${fmtMoney(l.amount)}</td></tr>`).join("");
  const body = `
<div class="kv">
  <div><b>رقم الإشعار</b> ${esc(doc.ref || "")}</div><div><b>التاريخ</b> ${esc(new Date(doc.date).toLocaleString("en-GB"))}</div>
  <div><b>الفاتورة الأصل</b> ${esc(r.saleRef || sale?.ref || "")}</div><div><b>تاريخها</b> ${sale?.date ? esc(new Date(sale.date).toLocaleDateString("en-GB")) : "—"}</div>
  <div><b>العميل</b> ${esc(doc.party || r.customerName || sale?.customerName || "عميل نقدي")}</div><div><b>السبب</b> ${esc(r.note || "")}</div>
</div>
${rows ? `<table><thead><tr><th>الصنف</th><th>العيار</th><th>الوزن</th><th>الكمّية</th><th>المبلغ</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
<div class="box">
  <div style="display:flex;justify-content:space-between"><span>الصافي قبل الضريبة</span><span>${esc(currency)} ${fmtMoney(refund - tax)}</span></div>
  <div style="display:flex;justify-content:space-between"><span>ضريبة القيمة المضافة</span><span>${esc(currency)} ${fmtMoney(tax)}</span></div>
  <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;border-top:1px solid #333;margin-top:4px;padding-top:4px"><span>إجمالي الإشعار الدائن</span><span>${esc(currency)} ${fmtMoney(refund)}</span></div>
  <div style="color:#444;font-size:10px;margin-top:4px">${esc(arabicAmountWords(refund))}</div>
</div>
<div class="sign"><div>العميل</div><div>البائع</div><div>المدير</div></div>`;
  return officialDocHtml({ title: "إشعار دائن", sub: info.name || "", size: "A4 portrait", margin: "12mm", body, info, copies });
}

const OFFICIAL_KINDS = new Set([...Object.keys(VOUCHER_KINDS), "ret"]);

function printOfficialDoc(doc, opts = {}) {
  if (!OFFICIAL_KINDS.has(doc.kind)) return false;
  const html = doc.kind === "ret" ? creditNoteHtml(doc, opts) : voucherHtml(doc, opts);
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open(); win.document.write(html); win.document.close();
  setTimeout(() => { try { win.focus(); win.print(); } catch { /* أُغلقت */ } }, 350);
  return true;
}

export { arabicAmountWords, arabicNumberWords, creditNoteHtml, OFFICIAL_KINDS, printOfficialDoc, voucherHtml };
