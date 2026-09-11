import React from "react";
import { fmt, fmtW } from "../core/money.js";
import { categoryLabel, remainingQty } from "../domain/helpers.js";
import { Hallmark } from "../ui/Hallmark.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";

function ItemDetailModal({ item, lots, suppliers, onClose }) {
  const lot = lots.find((l) => l.id === item.lotId);
  const supplier = lot ? suppliers.find((s) => s.id === lot.supplierId) : null;
  const qty = remainingQty(item);
  const catLabel = categoryLabel(item.categoryId);

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
    </ModalShell>
  );
}

// Reusable mandatory-attachment field: capture a photo of the invoice or
// upload a file (image/PDF). Used by supplier purchases and taskir office
// settlements, where a document is required before the entry can be saved.

export { ItemDetailModal };
