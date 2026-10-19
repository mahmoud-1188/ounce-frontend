import React, { useState } from "react";
import { fmt, fmtW } from "../core/money.js";
import { categoryLabel, remainingQty } from "../domain/helpers.js";
import { Hallmark } from "../ui/Hallmark.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";

function ItemDetailModal({ item, lots, suppliers, onClose, onUncode = null }) {
  const lot = lots.find((l) => l.id === item.lotId);
  const supplier = lot ? suppliers.find((s) => s.id === lot.supplierId) : null;
  const qty = remainingQty(item);
  const catLabel = categoryLabel(item.categoryId);
  // إلغاء التكويد: ما لم يُبع من قطع الصنف، بسببٍ مكتوب
  const free = (item.units || []).filter((u) => !u.sold && !u.issued && !u.held);
  const [uncodeOpen, setUncodeOpen] = useState(false);
  const [picked, setPicked] = useState(() => new Set(free.length === 1 ? [free[0].code] : []));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const lotOk = !!lot && lot.status !== "closed";

  return (
    <ModalShell title="تفاصيل الصنف" onClose={onClose}>
      {item.photoDataUrl ? (
        <img src={item.photoDataUrl} alt="" style={{ width: "100%", height: 160, borderRadius: 12, objectFit: "cover", marginBottom: 12 }} />
      ) : (
        <div className="flex items-center justify-center mb-3" style={{ width: "100%", height: 100 }}>
          <Hallmark karat={item.karat} size={64} />
        </div>
      )}
      <div className="flex flex-col gap-2">
        {[
          ["التصنيف", catLabel],
          ["العيار", item.karat],
          ["وزن الذهب", `${fmtW(item.weight)} جم`],
          ...(item.stonesWeight > 0 ? [["وزن الفصوص", `${fmtW(item.stonesWeight)} جم`]] : []),
          ["الكمية المتبقية", `${qty} من ${item.quantity}`],
          ["تكلفة الجرام وقت الشراء", fmt(item.costPerGram)],
          ["مصنعية القطعة الواحدة", fmt(item.workmanshipPerUnit || 0)],
          ["تاريخ الإدخال", new Date(item.dateAdded).toLocaleString("en-GB")],
          ["المورد", supplier?.name || "بدون مورد"],
          ...(lot ? [["سعر الدفعة وقت الشراء", `${fmt(lot.costPerGram)}/جم`]] : []),
        ].map(([label, value], idx) => (
          <div key={idx} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
            <span style={{ color: "var(--text2)" }} className="text-xs">
              {label}
            </span>
            <span style={{ color: "var(--text)" }} className="text-xs font-bold">
              {value}
            </span>
          </div>
        ))}
      </div>
      {onUncode && free.length > 0 && lotOk && (
        <div data-uncode className="mt-4 p-3 rounded-xl" style={{ border: "1px solid var(--line)" }}>
          {!uncodeOpen ? (
            <button type="button" data-uncode-open onClick={() => setUncodeOpen(true)} className="w-full py-2 rounded-xl text-xs font-bold"
              data-help="يعيد وزن القطعة لدفعتها «لم يُكوَّد» ويُلغي رمزها لتُكوَّد صحيحة — بموافقة المدير وسببٍ مكتوب"
              style={{ background: "var(--panel)", color: "var(--bad)", border: "1px solid var(--line)" }}>
              إلغاء التكويد
            </button>
          ) : (
            <>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">يعود وزن ما تختاره «لم يُكوَّد» في {lot.ref || "دفعته"} ويُلغى رمزه نهائيًّا — ثم كوّده من جديد.</p>
              {free.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {free.map((u) => (
                    <label key={u.code} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg" style={{ border: "1px solid var(--line)", color: "var(--text)" }}>
                      <input type="checkbox" data-uncode-unit={u.code} checked={picked.has(u.code)} style={{ accentColor: "var(--accent)" }}
                        onChange={(e) => setPicked((prev) => { const n = new Set(prev); if (e.target.checked) n.add(u.code); else n.delete(u.code); return n; })} />
                      {u.code}
                    </label>
                  ))}
                </div>
              )}
              <input data-uncode-reason value={reason} onChange={(e) => setReason(e.target.value)} placeholder="السبب (مثلًا: خطأ في الوزن)"
                className="w-full px-3 py-2 rounded-xl text-xs mb-2" style={{ background: "var(--panel2, var(--panel))", color: "var(--text)", border: "1px solid var(--line)" }} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setUncodeOpen(false)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>تراجع</button>
                <button type="button" data-uncode-confirm disabled={busy || !picked.size || reason.trim().length < 4}
                  onClick={async () => { setBusy(true); try { await onUncode([...picked], reason.trim()); } finally { setBusy(false); } }}
                  className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--bad)", color: "#fff", opacity: busy || !picked.size || reason.trim().length < 4 ? 0.5 : 1 }}>
                  ألغِ تكويد {picked.size > 1 ? `${picked.size} قطع` : "القطعة"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </ModalShell>
  );
}

// Reusable mandatory-attachment field: capture a photo of the invoice or
// upload a file (image/PDF). Used by supplier purchases and taskir office
// settlements, where a document is required before the entry can be saved.

export { ItemDetailModal };
