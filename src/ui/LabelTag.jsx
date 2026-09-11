import React from "react";
import { fmtW } from "../core/money.js";
import { categoryLabel } from "../domain/helpers.js";
import { PseudoBarcode } from "./PseudoBarcode.jsx";

function LabelTag({ item, code }) {
  return (
    <div
      style={{
        width: "50mm",
        height: "30mm",
        border: "1px solid #000",
        padding: "3mm",
        fontFamily: "sans-serif",
        color: "#000",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "2mm" }}>
        {item.photoDataUrl && (
          <img src={item.photoDataUrl} alt="" style={{ width: "9mm", height: "9mm", objectFit: "cover", flexShrink: 0 }} />
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: "11px" }}>{categoryLabel(item.categoryId)}</div>
          <div style={{ fontSize: "9px" }}>
            عيار {item.karat} · {fmtW(item.weight)} جم
            {item.stonesWeight > 0 ? ` +${fmtW(item.stonesWeight)} جم فصوص` : ""}
          </div>
        </div>
      </div>
      <PseudoBarcode code={code} />
      <div style={{ fontWeight: 700, fontSize: "11px", letterSpacing: "0.5px" }}>{code}</div>
    </div>
  );
}

export { LabelTag };
