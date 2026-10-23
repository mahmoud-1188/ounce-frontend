import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import * as api from "../core/api.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// ملف حماية الأجور (المرجع WpsPage تحت «الرواتب»): لكل مسيّرٍ صُرف ملفّه للبنك CSV،
/// وما ينقص من بيانات الموظفين (الآيبان والهوية) يُقال قبل أن يرفضه البنك.
function WpsPage({ currency = "ر.س", flashToast, onBack }) {
  const [runs, setRuns] = useState(null);
  useEffect(() => { api.payrollApi.fetchRuns().then((r) => setRuns(r.runs || [])).catch(() => setRuns([])); }, []);
  async function download(run) {
    try {
      const d = await api.payrollApi.wps(run.id);
      const blob = new Blob([d.csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `WPS-${d.period}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      if (d.missing?.length) flashToast?.(`⚠ بيانات ناقصة يرفضها البنك: ${d.missing.join("، ")}`);
    } catch { flashToast?.("تعذّر إنشاء ملف حماية الأجور"); }
  }
  return (
    <div className="px-4 pt-4 pb-24" data-wps>
      <SubPageHeader title="ملف حماية الأجور" onBack={onBack} />
      <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">ملفٌّ لكل مسيّر رواتب يُرفع لبنك المنشأة. يحتاج آيبان كل موظفٍ ورقم هويته من «الموظفون».</p>
      {runs === null && <p style={{ color: "var(--text3)" }} className="text-xs">جارِ التحميل…</p>}
      {runs && runs.length === 0 && <Card style={{ padding: 12 }}><p style={{ color: "var(--text3)", margin: 0 }} className="text-xs">لا مسيّرات بعد — أنشئ المسيّر من «الرواتب».</p></Card>}
      {(runs || []).map((r) => (
        <Card key={r.id} style={{ padding: 12, marginBottom: 8 }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p style={{ color: "var(--text)", margin: 0 }} className="text-sm font-bold">{String(r.period).slice(0, 7)}</p>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">{r.status === "paid" ? "صُرف" : r.status === "accrued" ? "مستحقّ" : r.status || ""}{r.total != null ? ` · ${Number(r.total).toLocaleString("en-US")} ${currency}` : ""}</p>
            </div>
            <button type="button" onClick={() => download(r)} className="flex items-center gap-1 px-3 rounded-xl text-xs font-bold"
              style={{ minHeight: 40, background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
              <Download size={14} /> الملف
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export { WpsPage };
