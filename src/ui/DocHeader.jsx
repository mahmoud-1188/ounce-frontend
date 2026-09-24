import React from "react";

function DocHeader({ info, title = "", sub = "", compact = false }) {
  const i = info || {};
  const meta = [i.cr ? `س.ت ${i.cr}` : null, i.vat ? `الرقم الضريبي ${i.vat}` : null, i.no ? `فرع ${i.no}` : null].filter(Boolean);
  const contact = [i.address, i.city, i.phone, i.email].filter(Boolean);
  return (
    <div style={{ direction: "rtl", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #999", paddingBottom: compact ? 4 : 8, marginBottom: compact ? 6 : 10 }}>
      {i.logo && <img src={i.logo} alt="" style={{ width: compact ? 40 : 56, height: compact ? 40 : 56, objectFit: "contain", borderRadius: 8 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 13 : 16, fontWeight: 800, color: "#000" }}>{i.name}{i.legalName && i.legalName !== i.name ? <span style={{ fontWeight: 400, color: "#444" }}> — {i.legalName}</span> : null}</div>
        {meta.length > 0 && <div style={{ fontSize: 10, color: "#333" }}>{meta.join(" · ")}</div>}
        {contact.length > 0 && <div style={{ fontSize: 10, color: "#555" }}>{contact.join(" · ")}</div>}
      </div>
      {(title || sub) && (
        <div style={{ textAlign: "left", flexShrink: 0 }}>
          {title && <div style={{ fontSize: compact ? 12 : 14, fontWeight: 800, color: "#000" }}>{title}</div>}
          {sub && <div style={{ fontSize: 10, color: "#555" }}>{sub}</div>}
        </div>
      )}
    </div>
  );
}

/// يُصغّر صورة الشعار إلى 256 بكسل ويُرجعها data:URL — كي لا تُثقل التخزين.

export { DocHeader };
