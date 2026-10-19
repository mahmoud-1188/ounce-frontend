import React, { useState } from "react";
import { DOC_KINDS } from "../core/constants.js";
import { fmtMoney } from "../core/money.js";
import { inputStyle, printDocumentPdf } from "../domain/helpers.js";
import { OFFICIAL_KINDS, printOfficialDoc } from "../domain/officialDocs.js";
import { Card } from "./Card.jsx";

// official: الصيغة الرسمية من الإعدادات — السندات والإشعار الدائن بترويسةٍ ومبلغٍ كتابةً وتوقيعات (أصل وصورة)
function DocumentsArchive({ docs = [], currency = "ر.س", branchName = "", onOpenAttachment = null, onBlocked, compact = false, official = false, info = {}, salesById = null }) {
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = docs.filter((d) => (kind === "all" || d.kind === kind)
    && (!from || String(d.date).slice(0, 10) >= from) && (!to || String(d.date).slice(0, 10) <= to)
    && (!q.trim() || [d.ref, d.party, d.note].some((f) => String(f || "").toLowerCase().includes(q.trim().toLowerCase()))));
  const total = list.reduce((a, d) => a + (Number(d.amount) || 0), 0);
  const kinds = Object.entries(DOC_KINDS).filter(([k]) => docs.some((d) => d.kind === k));
  return (
    <>
      <div className="flex gap-1.5 mb-2" style={{ overflowX: "auto" }}>
        {[["all", `الكلّ (${docs.length})`], ...kinds.map(([k, l]) => [k, `${l} (${docs.filter((d) => d.kind === k).length})`])].map(([id, l]) => (
          <button key={id} onClick={() => setKind(id)} className="text-[11px] px-2.5 py-1.5 rounded-full whitespace-nowrap font-bold"
            style={{ background: kind === id ? "var(--accentBg)" : "var(--panel)", color: kind === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <input style={{ ...inputStyle, marginBottom: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="رقم · طرف · بيان" />
        <input type="date" style={{ ...inputStyle, marginBottom: 0, fontSize: 10 }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" style={{ ...inputStyle, marginBottom: 0, fontSize: 10 }} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">{list.length} مستند · {fmtMoney(total)} {currency}</p>
      <div className="flex flex-col gap-1.5" style={compact ? { maxHeight: 420, overflowY: "auto" } : {}}>
        {list.slice(0, 300).map((d) => (
          <Card key={d.id} style={{ padding: 10 }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--line)" }}>{DOC_KINDS[d.kind] || d.kind}</span>
              <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[11px]">{d.ref}</span>
              <span className="flex-1" />
              <span style={{ color: "var(--text)" }} className="text-xs font-bold">{fmtMoney(d.amount)} {currency}</span>
            </div>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">{d.party}{d.note ? ` · ${d.note}` : ""} · {new Date(d.date).toLocaleDateString("en-GB")}</p>
            <div className="flex gap-1.5 mt-1.5">
              <button onClick={() => printDocumentPdf(d, { currency, branchName, onBlocked })} className="text-[11px] px-2.5 py-1 rounded-full font-bold"
                style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>عرض / طباعة PDF</button>
              {official && OFFICIAL_KINDS.has(d.kind) && (
                <button data-official-print={d.kind} onClick={() => { if (!printOfficialDoc(d, { currency, info: { ...info, name: info.name || branchName }, sale: salesById?.get(d.rec?.saleId) || null })) onBlocked?.("اسمح بالنوافذ المنبثقة للطباعة"); }}
                  className="text-[11px] px-2.5 py-1 rounded-full font-bold" style={{ background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)" }}>
                  {d.kind === "ret" ? "إشعار دائن رسمي" : "سند رسمي"}
                </button>
              )}
              {d.attachId && onOpenAttachment && (
                <button onClick={() => onOpenAttachment(d.attachId, d.attachFallback)} className="text-[11px] px-2.5 py-1 rounded-full"
                  style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>فاتورة المورد المرفقة</button>
              )}
            </div>
          </Card>
        ))}
        {list.length > 300 && <p style={{ color: "var(--text3)" }} className="text-[11px]">… يُعرض 300 — ضيّق المدى</p>}
      </div>
    </>
  );
}

export { DocumentsArchive };
