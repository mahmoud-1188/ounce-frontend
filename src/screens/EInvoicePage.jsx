import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import * as api from "../core/api.js";
import { fmtMoney } from "../core/money.js";
import { inputStyle, toCsv } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { qrSvg } from "../domain/qrBig.js";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

const saveText = (name, text, type = "text/plain;charset=utf-8") => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

/// الفوترة الإلكترونية (المرجع 5.2.0) — السلسلة وفحصها، وملف XML ورمز QR لكل مستند.
/// تُصدر على الخادم داخل معاملة البيع/المرتجع، فتبقى سلسلةً واحدة لكل أجهزة الفرع.
function EInvoicePage({ currency = "ر.س", onOpenModules, onBack, flashToast }) {
  const [data, setData] = useState(null);
  const [chain, setChain] = useState(null);
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");
  const load = () => api.einvoiceApi.list().then(setData).catch(() => setData({ error: true }));
  useEffect(() => { load(); }, []);
  const verify = async () => {
    setChecking(true);
    try { setChain(await api.einvoiceApi.verify()); } catch { flashToast?.("تعذّر فحص السلسلة"); } finally { setChecking(false); }
  };
  const downloadXml = async (e) => {
    try { saveText(`${e.ref}.xml`, await api.einvoiceApi.xml(e.id), "application/xml;charset=utf-8"); } catch { flashToast?.("تعذّر تنزيل الملف"); }
  };
  const list = (data?.einvoices || []).filter((e) => !q.trim() || String(e.ref || "").includes(q.trim()));
  const exportLog = () => saveText(`سلسلة-الفوترة-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(["العدّاد", "النوع", "المرجع", "UUID", "التاريخ", "الإجمالي", "الضريبة", "التجزئة", "تجزئة السابق"],
      [...(data?.einvoices || [])].sort((a, b) => a.icv - b.icv).map((e) => [e.icv, e.type === "381" ? "إشعار دائن" : "فاتورة مبسّطة", e.ref, e.uuid, e.docDate, fmtMoney(e.total), fmtMoney(e.vat), e.hash, e.pih])),
    "text/csv;charset=utf-8");
  const btn = { background: "var(--field)", color: "var(--accent)", border: "1px solid var(--line)" };

  return (
    <div>
      <SubPageHeader title="الفوترة الإلكترونية" onBack={onBack} />
      <div className="px-4 pb-5">
        {!data ? (
          <p style={{ color: "var(--text3)" }} className="text-[12px] py-6 text-center">جارٍ التحميل…</p>
        ) : data.error ? (
          <p style={{ color: "var(--bad)" }} className="text-[12px] py-6 text-center">تعذّر تحميل السلسلة</p>
        ) : (
          <>
            {!data.on && (
              <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--warnLine)" }}>
                <p style={{ color: "var(--text)", margin: 0 }} className="text-[12px] font-bold">الوحدة مطفأة — لا تُصدر مستنداتٌ جديدة</p>
                <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[11px]">الوحدات الاختيارية ← «رمز QR الضريبي على الفاتورة». تبدأ السلسلة من أوّل فاتورةٍ بعد التفعيل.</p>
                {onOpenModules && <button onClick={onOpenModules} className="mt-2 text-[11px] px-3 py-1.5 rounded-full font-bold" style={btn}>افتح الوحدات</button>}
              </Card>
            )}
            {!data.vatSet && (
              <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--badLine)" }}>
                <p style={{ color: "var(--bad)", margin: 0 }} className="text-[12px] font-bold">⚠ الرقم الضريبي غير مضبوط (15 رقمًا)</p>
                <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[11px]">يُضبط في هوية الفرع من الإدارة المركزية — يدخل رمز QR وكل ملف XML، ويُحفظ مع كل مستندٍ كما كان لحظة إصداره.</p>
              </Card>
            )}
            <Card style={{ padding: 12, marginBottom: 10, border: `1px solid ${chain ? (chain.ok ? "var(--goodLine)" : "var(--badLine)") : "var(--line)"}` }}>
              <p style={{ color: chain ? (chain.ok ? "var(--good)" : "var(--bad)") : "var(--text)", margin: 0 }} className="text-sm font-black">
                {data.count === 0 ? "لا مستندات بعد — كل فاتورةٍ جديدة تدخل السلسلة"
                  : !chain ? `${data.count} مستند في السلسلة`
                  : chain.ok ? `✓ السلسلة سليمة — ${chain.count} مستند` : `✗ ${chain.issues.length} مشكلة في السلسلة`}
              </p>
              {chain && !chain.ok && chain.issues.slice(0, 6).map((x, i) => <p key={i} style={{ color: "var(--text2)", margin: "2px 0 0" }} className="text-[11px]">{x.ref}: {x.why}</p>)}
              <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[11px] leading-6">
                لكل مستندٍ UUID وعدّادٌ متسلسل وتجزئةُ سابقه (SHA-256) — المرحلة الثانية من «فاتورة». التوقيع والإبلاغ للهيئة يحتاجان شهادة الجهاز (CSID) عبر مزوّد حلولٍ معتمد يستلم هذه الملفات.
              </p>
              {data.count > 0 && (
                <button disabled={checking} onClick={verify} className="mt-2 text-[11px] px-3 py-1.5 rounded-full font-bold flex items-center gap-1" style={btn}>
                  {checking && <Loader2 size={11} className="animate-spin" />} افحص السلسلة
                </button>
              )}
            </Card>
            <div className="flex gap-2 mb-2">
              <input style={{ ...inputStyle, marginBottom: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالمرجع" />
              <button onClick={exportLog} disabled={!data.count} className="px-3 rounded-xl text-[11px] font-bold" style={btn}>صدّر السجل</button>
            </div>
            {list.map((e) => (
              <Card key={e.id} style={{ padding: 10, marginBottom: 6 }}>
                <button onClick={() => setOpen(open === e.id ? null : e.id)} className="w-full text-right">
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }} className="text-[12px] font-bold">#{e.icv} · {e.type === "381" ? "إشعار دائن" : "فاتورة"} {e.ref}</span>
                    <span style={{ color: e.type === "381" ? "var(--bad)" : "var(--accent)" }} className="text-[12px] font-bold">{fmtMoney(e.total)} {currency}</span>
                  </div>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{new Date(e.docDate).toLocaleString("en-GB")} · ضريبة {fmtMoney(e.vat)} · {String(e.hash).slice(0, 16)}…</p>
                </button>
                {open === e.id && (
                  <div className="mt-2">
                    <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: qrSvg(e.qr, 150) }} />
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button onClick={() => downloadXml(e)} className="py-2 rounded-xl text-[11px] font-bold" style={btn}>تنزيل XML</button>
                      <button onClick={() => saveText(`${e.ref}-qr.txt`, e.qr)} className="py-2 rounded-xl text-[11px] font-bold" style={btn}>نصّ الرمز</button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export { EInvoicePage };
