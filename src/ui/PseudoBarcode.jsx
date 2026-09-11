import React from "react";

function PseudoBarcode({ code }) {
  const bars = [];
  for (let i = 0; i < code.length; i++) {
    const w = (code.charCodeAt(i) % 3) + 1;
    bars.push(w);
  }
  return (
    <div style={{ display: "flex", alignItems: "stretch", height: 32, gap: 1 }}>
      {bars.map((w, i) => (
        <div key={i} style={{ width: w, background: "#000" }} />
      ))}
    </div>
  );
}

export { PseudoBarcode };
