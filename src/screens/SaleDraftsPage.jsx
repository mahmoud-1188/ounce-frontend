import React from "react";
import { ClipboardList, Printer, Play, X } from "lucide-react";
import { fmtMoney, fmtW } from "../core/money.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/// طباعة عرض السعر — ورقةٌ للعميل بأسطرها وصلاحيتها، لا فاتورة ضريبية ولا التزام بيع.
function printQuote(d, { items = [], currency = "ر.س", shopName = "" } = {}) {
  const w = window.open("", "_blank");
  if (!w) return false;
  const rows = (d.payload?.lines || []).map((l) => {
    const it = items.find((x) => x.id === l.itemId);
    const name = it ? `${it.ref || ""} · عيار ${it.karat} · ${fmtW(it.weight)} جم` : "قطعة";
    return `<tr><td>${esc(name)}</td><td>${l.quantity}</td><td>${esc(fmtMoney(l.unitPrice))}</td><td>${esc(fmtMoney(l.unitPrice * l.quantity))}</td></tr>`;
  }).join("");
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(d.ref)}</title>
<style>body{font-family:system-ui,Tahoma,sans-serif;padding:24px;color:#111}h1{font-size:20px;margin:0 0 4px}
table{width:100%;border-collapse:collapse;margin-top:14px}td,th{border:1px solid #bbb;padding:6px 8px;text-align:right;font-size:13px}
th{background:#f3f0e8}.t{font-weight:700;font-size:15px;margin-top:10px}.m{color:#555;font-size:12px}</style></head><body>
<h1>عرض سعر ${esc(d.ref)}</h1><div class="m">${esc(shopName)} · ${new Date(d.createdAt).toLocaleDateString("en-GB")}${d.customerName ? ` · للعميل: ${esc(d.customerName)}` : ""}</div>
<table><tr><th>القطعة</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr>${rows}</table>
<div class="t">الإجمالي ${esc(fmtMoney(d.total))} ${esc(currency)} — شامل الضريبة</div>
<div class="m">${d.validUntil ? `صالحٌ حتى ${esc(d.validUntil)}. ` : ""}السعر يتبع سعر الذهب ويُثبَّت عند إصدار الفاتورة. هذا عرضٌ وليس فاتورة.</div>
<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
  return true;
}

/// الفواتير المعلّقة وعروض الأسعار (المرجع D — SaleDraftsPage): تُستأنف فاتورةً بكل رقابتها، أو تُطبع، أو تُلغى.
function SaleDraftsPage({ drafts = [], items = [], currency = "ر.س", shopName = "", onResume, onCancel, onBack }) {
  const open = drafts.filter((d) => d.status === "open");
  const closed = drafts.filter((d) => d.status !== "open").slice(0, 20);
  const Row = ({ d }) => {
    const lines = d.payload?.lines || [];
    const gone = lines.filter((l) => !items.some((i) => i.id === l.itemId)).length;
    const expired = d.kind === "quote" && d.validUntil && d.validUntil < new Date().toISOString().slice(0, 10);
    return (
      <Card style={{ padding: 11, marginBottom: 8 }}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p style={{ color: "var(--text)", margin: 0 }} className="text-[13px] font-bold">
              {d.kind === "quote" ? "عرض سعر" : "معلّقة"} {d.ref}{d.customerName ? ` · ${d.customerName}` : ""}
            </p>
            <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">
              {lines.length} سطر · {currency}{fmtMoney(d.total)} · {d.createdByName || ""} · {new Date(d.createdAt).toLocaleString("en-GB")}
              {d.validUntil ? ` · صالحٌ حتى ${d.validUntil}` : ""}
            </p>
            {gone > 0 && <p style={{ color: "var(--warn, var(--accent))", margin: 0 }} className="text-[11px]">⚠ {gone} قطعة بيعت أو خرجت منذ الحفظ — تسقط عند الاستئناف</p>}
            {expired && <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">انتهت صلاحية العرض — الأسعار تُراجع عند الاستئناف</p>}
          </div>
          {d.status === "open" ? (
            <div className="flex gap-1.5 flex-shrink-0">
              {d.kind === "quote" && (
                <button aria-label="طباعة العرض" onClick={() => printQuote(d, { items, currency, shopName })} className="p-2 rounded-lg" style={{ background: "var(--field)", border: "1px solid var(--line)" }}>
                  <Printer size={15} color="var(--accent)" />
                </button>
              )}
              <button onClick={() => onResume(d)} className="px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1"
                style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                <Play size={13} /> استأنف
              </button>
              <button aria-label="إلغاء" onClick={() => onCancel(d)} className="p-2 rounded-lg" style={{ background: "var(--field)", border: "1px solid var(--line)" }}>
                <X size={15} color="var(--text3)" />
              </button>
            </div>
          ) : (
            <span style={{ color: "var(--text3)" }} className="text-[11px]">{d.status === "done" ? "أُكملت فاتورة" : "أُلغيت"}</span>
          )}
        </div>
      </Card>
    );
  };
  return (
    <div className="pb-24">
      <SubPageHeader title="الفواتير المعلّقة وعروض الأسعار" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
          من نافذة البيع: «علّق الفاتورة» لزبونٍ يعود، أو «عرض سعر» يُطبع له. لا تُحجز القطع ولا يُكتب قيد — الحركة كلّها عند إتمامها.
        </p>
        {open.length === 0 ? (
          <EmptyState icon={<ClipboardList size={34} color="var(--accentText)" />} title="لا فواتير معلّقة" sub="علّق فاتورةً أو احفظ عرض سعرٍ من نافذة البيع" />
        ) : open.map((d) => <Row key={d.id} d={d} />)}
        {closed.length > 0 && (
          <>
            <p style={{ color: "var(--text3)" }} className="text-[11px] font-bold mt-4 mb-2">آخر ما أُغلق</p>
            {closed.map((d) => <Row key={d.id} d={d} />)}
          </>
        )}
      </div>
    </div>
  );
}

export { SaleDraftsPage, printQuote };
