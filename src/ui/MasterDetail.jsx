import React from "react";
import { Card } from "./Card.jsx";

function MasterDetail({ vp, list, detail, detailOpen, onCloseDetail }) {
  const wide = vp && (vp.size === "lg" || vp.size === "xl");
  if (!wide) {
    return (
      <>
        {list}
        {detailOpen && detail}
      </>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 38%) 1fr", gap: 16 }}>
      <div style={{ minWidth: 0 }}>{list}</div>
      <div style={{ minWidth: 0, position: "sticky", top: 12, alignSelf: "start" }}>
        {detailOpen ? detail : (
          <Card style={{ padding: 24, textAlign: "center" }}>
            <p style={{ color: "var(--text3)" }} className="text-[12px]">
              اختر سجلًا من القائمة لعرض تفاصيله هنا
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

/// ── ميزان المراجعة النقدي ──
///
/// يشمل حسابات العملة وحدها. مجموع المدين يجب أن يساوي مجموع الدائن،
/// وإلا فثمّة قيد بطرف واحد.

export { MasterDetail };
