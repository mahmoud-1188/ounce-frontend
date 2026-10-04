import React, { useEffect, useState } from "react";
import { fmtMoney } from "../core/money.js";
import * as api from "../core/api.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// سجلّ العمليات النقدية الكبيرة (وحدة aml) — كل فاتورةٍ بلغ نقدها حدّ الهوية، بهوية المشتري
function AmlRegisterPage({ currency = "ر.س", onBack }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.modulesApi.amlRegister().then(setD).catch(() => setD({ on: false, rows: [] })); }, []);
  const m = (v) => `${fmtMoney(v)} ${currency}`;
  return (
    <div className="pb-24">
      <SubPageHeader title="سجلّ مكافحة غسل الأموال" onBack={onBack} />
      <div className="px-4 pt-3">
        {!d ? <p className="text-xs" style={{ color: "var(--text3)" }}>جارِ التحميل…</p> : (
          <>
            <p className="text-[11px] mb-2" style={{ color: "var(--text2)" }}>
              {d.on ? `الحدّ النقدي ${m(d.threshold)} — ما يبلغه يُسجَّل بهوية المشتري.` : "الوحدة مطفأة — فعّلها من «الوحدات الاختيارية»."}
            </p>
            {d.rows.length === 0 ? <p className="text-xs" style={{ color: "var(--text3)" }}>لا عمليات.</p> : d.rows.map((r) => (
              <Card key={r.id} style={{ padding: 12, marginBottom: 8 }}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold flex-1" style={{ color: "var(--text)", margin: 0 }}>{r.ref} · {m(r.cash)} نقدًا</p>
                  <span className="text-[11px] font-bold" style={{ color: r.idNumber ? "var(--good)" : "var(--bad)" }}>{r.idNumber ? "بهوية" : "بلا هوية"}</span>
                </div>
                <p className="text-[11px]" style={{ color: "var(--text2)", margin: "4px 0 0" }}>
                  {r.customer || "—"}{r.idNumber ? ` · ${r.idNumber}` : ""} · {String(r.date).slice(0, 10)} · الإجمالي {m(r.total)}{r.seller ? ` · ${r.seller}` : ""}
                </p>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export { AmlRegisterPage };
