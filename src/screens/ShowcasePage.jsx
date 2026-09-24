import React, { useState } from "react";
import { fmtMoney, fmtW } from "../core/money.js";
import { categoryLabel, inputStyle } from "../domain/helpers.js";
import { suggestedUnitPrice } from "../domain/suggestedUnitPrice.js";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

const catOf = (it) => it.categoryId || it.category || null;

function ShowcasePage({ items = [], categories = [], price24 = 0, settings = {}, currency = "ر.س", onSell = null, onBack }) {
  const [cat, setCat] = useState("all");
  const [k, setK] = useState("all");
  const [q, setQ] = useState("");
  const [big, setBig] = useState(null);
  const live = items.filter((it) => !it.voided && (it.units || []).some((u) => !u.sold && !u.issued && u.sellable !== false));
  const cats = [...new Set(live.map((it) => catOf(it)).filter(Boolean))];
  const catLabel = (id) => categories.find((c) => c.id === id)?.label || categoryLabel(id) || id;
  const list = live.filter((it) => (cat === "all" || catOf(it) === cat) && (k === "all" || String(it.karat) === k)
    && (!q.trim() || [it.description, it.name, it.ref, catLabel(catOf(it))].some((f) => String(f || "").includes(q.trim()))));
  const price = (it) => suggestedUnitPrice(it, price24, settings);
  return (
    <div>
      <SubPageHeader title="الاستعراض" onBack={onBack} />
      <div className="px-4 pt-2 pb-6">
        <div className="flex gap-1.5 mb-2" style={{ overflowX: "auto" }}>
          {[["all", "الكلّ"], ...cats.map((c) => [c, catLabel(c)])].map(([id, l]) => (
            <button key={id} onClick={() => setCat(id)} className="text-[11px] px-3 py-1.5 rounded-full whitespace-nowrap font-bold"
              style={{ background: cat === id ? "var(--accentBg)" : "var(--panel)", color: cat === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1.5 mb-3">
          {[["all", "كل العيارات"], ["24", "24"], ["22", "22"], ["21", "21"], ["18", "18"]].map(([id, l]) => (
            <button key={id} onClick={() => setK(id)} className="text-[11px] px-2.5 py-1 rounded-full font-bold" style={{ background: k === id ? "var(--accentBg)" : "var(--field)", color: k === id ? "var(--accent)" : "var(--text3)" }}>{l}</button>
          ))}
          <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث" />
        </div>
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">{list.length} قطعة · سعر جم24 اليوم {currency}{fmtMoney(price24)} · الأسعار إرشادية</p>
        <div className="grid grid-cols-2 gap-2">
          {list.slice(0, 200).map((it) => (
            <button key={it.id} onClick={() => setBig(big === it.id ? null : it.id)} className="text-right" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ aspectRatio: "1 / 1", background: "var(--field)", display: "grid", placeItems: "center" }}>
                {(it.photoDataUrl || it.photoUrl) ? <img src={(it.photoDataUrl || it.photoUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "var(--text3)" }} className="text-[11px]">{catLabel(catOf(it))}</span>}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <p style={{ color: "var(--text)", margin: 0 }} className="text-xs font-bold truncate">{it.description || it.name || catLabel(catOf(it))}</p>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">عيار {it.karat} · {fmtW(it.weight)} جم</p>
                <p style={{ color: "var(--accent)", margin: "2px 0 0", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-extrabold">{currency}{fmtMoney(price(it))}</p>
              </div>
            </button>
          ))}
        </div>
        {big && (() => { const it = list.find((x) => x.id === big); if (!it) return null; return (
          <div className="fixed inset-0 flex items-end" style={{ background: "rgba(0,0,0,.6)", zIndex: 9000 }} onClick={() => setBig(null)}>
            <div style={{ background: "var(--bg)", width: "100%", borderRadius: "22px 22px 0 0", padding: 16, maxWidth: 393, margin: "0 auto" }} onClick={(e) => e.stopPropagation()}>
              {(it.photoDataUrl || it.photoUrl) && <img src={(it.photoDataUrl || it.photoUrl)} alt="" style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 14, background: "var(--field)" }} />}
              <p style={{ color: "var(--text)" }} className="text-base font-bold mt-2">{it.description || it.name || catLabel(catOf(it))}</p>
              <p style={{ color: "var(--text2)" }} className="text-xs">عيار {it.karat} · {fmtW(it.weight)} جم{it.stonesWeight ? ` · فصوص ${fmtW(it.stonesWeight)} جم` : ""} · متاح {(it.units || []).filter((u) => !u.sold && !u.issued).length}</p>
              <p style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-2xl font-extrabold">{currency}{fmtMoney(price(it))}</p>
              {onSell && <button onClick={() => onSell(it.id)} className="w-full mt-2 py-3 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, var(--gradFrom), var(--gradTo))", color: "var(--bg)" }}>بيع هذه القطعة</button>}
            </div>
          </div>
        ); })()}
      </div>
    </div>
  );
}

export { ShowcasePage };
