import React, { useEffect, useRef, useState } from "react";
import { Gem, Search, X } from "lucide-react";
import * as api from "../core/api.js";
import { fmtMoney, fmtW, roundW } from "../core/money.js";
import { HeldUnitsCard } from "../ui/HeldUnitsCard.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// استعلام القطع (المرجع 5.2.0) — امسح أو اكتب أو الصق عدّة رموز فتظهر لكل قطعةٍ
/// بطاقتها من الخادم: الصنف والوزن والعيار وبعيار 24، والمورد ودفعة الشراء، ومن
/// كوّدها، وحالتها الحقيقية (متاحة · مباعة بفاتورتها وعميلها · مُخرَجة بسببها ·
/// محجوزة). قراءةٌ فقط؛ التكلفة يرسلها الخادم لمن يراها وحده.
const STATUS = {
  available: { label: "متاحة", tone: "var(--good)" },
  held: { label: "معلّقة", tone: "var(--accent)" },
  sold: { label: "مباعة", tone: "var(--accent)" },
  issued: { label: "مُخرَجة", tone: "var(--bad)" },
  reserved: { label: "محجوزة", tone: "var(--accentText)" },
};
const splitCodes = (t) => String(t || "").split(/[\s,،;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
const dt = (v) => (v ? String(v).slice(0, 10) : "—");

function PieceInquiryPage({ price24 = 0, currency = "ر.س", canManageHeld = false, flashToast = null, onBack }) {
  const [input, setInput] = useState("");
  const [cards, setCards] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [zoom, setZoom] = useState(null);
  const inputRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 200); return () => clearTimeout(t); }, []);

  const add = async () => {
    const more = splitCodes(input).filter((c) => !cards.some((x) => x.asked === c));
    setInput("");
    inputRef.current?.focus();
    if (!more.length) return;
    setBusy(true); setErr("");
    try {
      const r = await api.pieceInquiryApi.query(more);
      setCards((prev) => [...(r.cards || []).reverse(), ...prev]);
    } catch {
      setErr("تعذّر الاستعلام — تحقّق من الاتصال");
    } finally { setBusy(false); }
  };

  const found = cards.filter((c) => c.found);
  const totW = roundW(found.reduce((a, c) => a + (c.weight || 0), 0));
  const totF = roundW(found.reduce((a, c) => a + (c.fine || 0), 0));
  const Row = ({ k, v }) => (v === "" || v == null ? null : (
    <div className="flex gap-2 py-0.5">
      <span style={{ color: "var(--text3)", minWidth: 92 }} className="text-[11px]">{k}</span>
      <span style={{ color: "var(--text)" }} className="text-[11px] font-bold flex-1">{v}</span>
    </div>
  ));
  const remove = (asked) => setCards((p) => p.filter((x) => x.asked !== asked));

  return (
    <div className="pb-24">
      <SubPageHeader title="استعلام القطع" onBack={onBack} />
      <div className="px-4">
        {canManageHeld && <HeldUnitsCard flashToast={flashToast} />}
        <div className="flex gap-2">
          <textarea ref={inputRef} value={input} rows={2} aria-label="رموز القطع"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } }}
            placeholder="امسح أو اكتب رمز القطعة — أو الصق عدّة رموز معًا"
            className="flex-1 rounded-xl px-3 py-2 text-sm" style={{ background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)", resize: "none" }} />
          <button onClick={add} disabled={busy} aria-label="استعلم" className="px-4 rounded-xl text-xs font-bold flex items-center gap-1"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)", opacity: busy ? 0.6 : 1 }}>
            <Search size={14} /> {busy ? "…" : "استعلم"}
          </button>
        </div>
        {err && <p style={{ color: "var(--bad)" }} className="text-[11px] mt-2">{err}</p>}
        {cards.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px] flex-1">
              {cards.length} رمزًا · وُجد {found.length} · {fmtW(totW)} جم · بعيار 24: {fmtW(totF)} جم
            </p>
            <button onClick={() => setCards([])} className="px-3 py-1 rounded-full text-[11px] font-bold"
              style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>مسح الكل</button>
          </div>
        )}
        {cards.map((c) => (!c.found ? (
          <div key={c.asked} className="rounded-2xl p-3 mt-3" style={{ background: "var(--badBg)", border: "1px solid var(--badLine)" }}>
            <div className="flex items-center gap-2">
              <p style={{ color: "var(--bad)", margin: 0 }} className="text-xs font-bold flex-1">{c.asked} — لا قطعة بهذا الرمز</p>
              <button onClick={() => remove(c.asked)} aria-label={`أزل ${c.asked}`}><X size={14} color="var(--bad)" /></button>
            </div>
          </div>
        ) : (
          <div key={c.asked} className="rounded-2xl p-3 mt-3" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
            <div className="flex gap-3">
              {c.photo ? (
                <button onClick={() => setZoom(c)} aria-label={`صورة ${c.code}`} style={{ flexShrink: 0 }}>
                  <img src={c.photo} alt="" style={{ width: 84, height: 84, borderRadius: 12, objectFit: "cover" }} />
                </button>
              ) : (
                <div style={{ width: 84, height: 84, borderRadius: 12, background: "var(--bg)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Gem size={26} color="var(--text3)" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p style={{ color: "var(--text)", margin: 0 }} className="text-sm font-bold flex-1">{c.code}</p>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ color: STATUS[c.status]?.tone, border: `1px solid ${STATUS[c.status]?.tone}` }}>
                    {STATUS[c.status]?.label || c.status}
                  </span>
                  <button onClick={() => remove(c.asked)} aria-label={`أزل ${c.code}`}><X size={14} color="var(--text3)" /></button>
                </div>
                <p style={{ color: "var(--text2)", margin: "2px 0 0" }} className="text-[11px]">{c.category}{c.ref ? ` · ${c.ref}` : ""}</p>
                <p style={{ color: "var(--accent)", margin: "4px 0 0" }} className="text-base font-bold">{fmtW(c.weight)} جم · عيار {c.karat}</p>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">بعيار 24: {fmtW(c.fine)} جم{c.stonesWeight ? ` · فصوص ${fmtW(c.stonesWeight)} جم` : ""}</p>
              </div>
            </div>
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
              <Row k="المورد" v={c.supplier ? `${c.supplier.name}${c.supplier.phone ? ` · ${c.supplier.phone}` : ""}` : "—"} />
              <Row k="دفعة الشراء" v={c.lot ? `${c.lot.ref} · ${dt(c.lot.date)} · ${fmtW(c.lot.weight)} جم${c.lot.opening ? " · افتتاحي" : ""}${c.lot.purchaseRef ? ` · فاتورة ${c.lot.purchaseRef}` : ""}${c.lot.invoicePending ? " · فاتورة المورد معلّقة" : ""}` : (c.fromScrap ? "من الكسر" : "—")} />
              <Row k="التكويد" v={`${c.codedBy || "—"} · ${dt(c.codedAt)}${c.printed ? " · الملصق مطبوع" : ""}`} />
              {c.cost != null && <Row k="التكلفة" v={`${fmtMoney(c.cost)} ${currency} (${fmtMoney(c.costPerGram)} ${currency}/جم + مصنعية ${fmtMoney(c.workmanship)} ${currency})`} />}
              <Row k="قيمة اليوم" v={price24 ? `${fmtMoney(Math.round((c.fine * price24 + (c.workmanship || 0)) * 100) / 100)} ${currency}` : ""} />
              <Row k="من الصنف" v={`${c.siblings.available} متاحة من ${c.siblings.total}`} />
              {c.gem && <Row k="الحجر" v={[c.gem.carat ? `${c.gem.carat} قيراط` : "", c.gem.color, c.gem.clarity, c.gem.cut, c.gem.certNo ? `${c.gem.lab || "شهادة"} ${c.gem.certNo}` : ""].filter(Boolean).join(" · ")} />}
              {c.watch && <Row k="الساعة" v={[c.watch.brand, c.watch.model, c.watch.serial ? `رقم ${c.watch.serial}` : "", c.watch.warrantyMonths ? `ضمان ${c.watch.warrantyMonths} شهرًا` : ""].filter(Boolean).join(" · ")} />}
              {c.sale && <Row k="البيع" v={`${c.sale.ref} · ${dt(c.sale.date)} · ${c.sale.customer}${c.sale.price ? ` · ${fmtMoney(c.sale.price)} ${currency}` : ""}${c.sale.seller ? ` · البائع ${c.sale.seller}` : ""}`} />}
              {c.status === "sold" && !c.sale && <Row k="البيع" v="مباعة قبل ربط الوحدة بفاتورتها" />}
              {c.held && <Row k="معلّقة" v={`${c.held.ref} · ${dt(c.held.at)}${c.held.by ? ` · ${c.held.by}` : ""}${c.held.note ? ` · ${c.held.note}` : ""} — تُكمَل بالبيع`} />}
              {c.issued && <Row k="الإخراج" v={`${c.issued.reason}${c.issued.ref ? ` · ${c.issued.ref}` : ""} · ${dt(c.issued.at)}${c.issued.by ? ` · ${c.issued.by}` : ""}${c.issued.note ? ` · ${c.issued.note}` : ""}`} />}
              {c.reservation && <Row k="محجوزة" v={`${c.reservation.ref} · ${c.reservation.customer}`} />}
            </div>
          </div>
        )))}
        {!cards.length && (
          <p style={{ color: "var(--text3)" }} className="text-xs text-center py-8 leading-7">
            امسح القطع واحدةً بعد الأخرى بالقارئ — كل مسحةٍ تضيف بطاقة.<br />أو الصق قائمة رموزٍ دفعةً واحدة.
          </p>
        )}
      </div>
      {zoom && (
        <div onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "var(--veil, rgba(0,0,0,.7))" }}>
          <img src={zoom.photo} alt="" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12 }} />
        </div>
      )}
    </div>
  );
}

export { PieceInquiryPage };
