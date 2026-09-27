import React, { useEffect, useState } from "react";
import { fmtW } from "../core/money.js";
import * as api from "../core/api.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// حدود إعادة الطلب (وحدة reorderAlerts) — المتاح على الرفّ مقابل الحدّ الأدنى لكل تصنيفٍ وعيار
function ReorderPage({ onBack, onOpenModules }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.modulesApi.reorder().then(setD).catch(() => setD({ on: false, rows: [] })); }, []);
  const TONE = { out: "var(--bad)", low: "var(--accent)", ok: "var(--good)" };
  const LBL = { out: "نفد", low: "تحت الحدّ", ok: "كافٍ" };
  return (
    <div className="pb-24">
      <SubPageHeader title="حدود إعادة الطلب" onBack={onBack} />
      <div className="px-4 pt-3">
        {!d ? <p className="text-xs" style={{ color: "var(--text3)" }}>جارِ التحميل…</p>
          : !d.on ? (
            <Card style={{ padding: 14 }}>
              <p className="text-xs" style={{ color: "var(--text2)", margin: 0 }}>الوحدة مطفأة — فعّلها وحدّد الحدود من «الوحدات الاختيارية».</p>
              {onOpenModules && <button onClick={onOpenModules} className="mt-2 text-xs font-bold" style={{ color: "var(--accentText)" }}>افتح الوحدات</button>}
            </Card>
          ) : d.rows.length === 0 ? <p className="text-xs" style={{ color: "var(--text3)" }}>لا حدود محدّدة بعد.</p> : (
            d.rows.map((r) => (
              <Card key={r.key} style={{ padding: 12, marginBottom: 8 }}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold flex-1" style={{ color: "var(--text)", margin: 0 }}>{r.category} · عيار {r.karat}</p>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ color: TONE[r.status], border: `1px solid ${TONE[r.status]}` }}>{LBL[r.status]}</span>
                </div>
                <p className="text-[11px]" style={{ color: "var(--text2)", margin: "4px 0 0" }}>
                  المتاح {r.available} قطعة ({fmtW(r.weight)} جم) · الحدّ {r.min}{r.shortBy > 0 ? ` · يلزم ${r.shortBy} قطعة` : ""}
                </p>
              </Card>
            ))
          )}
      </div>
    </div>
  );
}

export { ReorderPage };
