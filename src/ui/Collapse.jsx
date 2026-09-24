import React from "react";
import { prefersReducedMotion } from "../domain/helpers.js";

function Collapse({ open, children }) {
  // ⚠ **المطويّ يُخفى لا يُصغَّر فقط:** بارتفاع صفر يبقى في الشجرة، فيصله
  //   التنقّل بلوحة المفاتيح وقارئ الشاشة — ويضغط المستخدم صفًّا لا يراه.
  //   `visibility: hidden` بعد انتهاء الحركة، و`inert` يمنع التركيز.
  const reduced = prefersReducedMotion();
  return (
    <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: reduced ? "none" : "grid-template-rows .28s cubic-bezier(.2,.8,.2,1)" }}>
      <div style={{ overflow: "hidden", minHeight: 0, visibility: open ? "visible" : "hidden",
        transition: reduced ? "none" : (open ? "visibility 0s" : "visibility 0s linear .28s") }}
        aria-hidden={!open} {...(open ? {} : { inert: "" })}>
        {children}
      </div>
    </div>
  );
}

/// حدود الفترة من مفتاحٍ مختصر — أو من تاريخين.

export { Collapse };
