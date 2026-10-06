import React from "react";
import { C128 } from "../core/constants.js";
import { qrMatrix } from "../domain/helpers.js";

/// رمز الملصق المطبوع من المتصفح — حقيقيٌّ يُقرأ بالماسح: Code 128 (مجموعة B) أو QR حسب «إعدادات الطابعة».
/// (كان أشرطةً شكلية لا تُقرأ.)
function code128Bars(text) {
  const t = String(text || "").replace(/[^\x20-\x7e]/g, "");
  if (!t) return [];
  const codes = [104];
  let sum = 104;
  for (let i = 0; i < t.length; i++) { const v = t.charCodeAt(i) - 32; codes.push(v); sum += v * (i + 1); }
  codes.push(sum % 103, 106);
  return codes.map((c) => C128[c]).join("").split("").map(Number);
}

function PseudoBarcode({ code, symbology = "barcode", height = 32 }) {
  if (symbology === "qr") {
    const m = qrMatrix(code);
    const n = m.length, q = 2, size = n + q * 2;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) d += `M${c + q} ${r + q}h1v1h-1z`;
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={height * 1.6} height={height * 1.6} shapeRendering="crispEdges" style={{ background: "#fff", alignSelf: "center" }}>
        <path d={d} fill="#000" />
      </svg>
    );
  }
  const widths = code128Bars(code);
  const quiet = 10;
  const total = widths.reduce((a, w) => a + w, 0) + quiet * 2;
  let x = quiet, dark = true;
  const rects = [];
  widths.forEach((w, i) => { if (dark) rects.push(<rect key={i} x={x} y={0} width={w} height={height} />); x += w; dark = !dark; });
  return (
    <svg viewBox={`0 0 ${total} ${height}`} width="100%" height={height} preserveAspectRatio="none" shapeRendering="crispEdges" style={{ background: "#fff" }}>
      <g fill="#000">{rects}</g>
    </svg>
  );
}

export { PseudoBarcode };
