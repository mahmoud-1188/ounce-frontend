import React, { useEffect, useState } from "react";
import { PackageMinus } from "lucide-react";
import { fmtW } from "../core/money.js";
import * as api from "../core/api.js";
import { Card } from "./Card.jsx";

/// القطع المعلّقة من الوضع الخفي (migration 047) — للمدير: تُباع من الوضع الكامل
/// (البيع يأخذ المعلّقة أولًا) أو يعيدها إلى الرفّ.
function HeldUnitsCard({ flashToast }) {
  const [units, setUnits] = useState(null);
  const load = () => api.hiddenApi.heldUnits().then((d) => setUnits(d.units || [])).catch(() => setUnits([]));
  useEffect(() => { load(); }, []);
  if (!units || units.length === 0) return null;
  const release = async (code) => {
    if (!window.confirm(`إعادة ${code} إلى الرفّ؟`)) return;
    try { await api.hiddenApi.release(code); flashToast?.(`أُعيدت ${code} إلى المخزون`); load(); }
    catch { flashToast?.("تعذّرت الإعادة"); }
  };
  const w = units.reduce((a, u) => a + (Number(u.weight) || 0), 0);
  return (
    <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
      <div className="flex items-center gap-2 mb-1">
        <PackageMinus size={15} color="var(--accent)" />
        <p className="text-xs font-bold flex-1" style={{ color: "var(--text)", margin: 0 }}>قطعٌ معلّقة من الوضع الخفي ({units.length} · {fmtW(w)} جم)</p>
      </div>
      <p className="text-[11px]" style={{ color: "var(--text3)", margin: "0 0 6px" }}>خرجت من الرفّ لا من الدفتر — أكمل بيعها أو أعدها.</p>
      {units.map((u) => (
        <div key={u.code} className="flex items-center gap-2 py-1.5" style={{ borderTop: "1px solid var(--line)" }}>
          <span className="text-[11px] flex-1" style={{ color: "var(--text)" }}>
            <b>{u.code}</b> · {u.category} عيار {u.karat} · {fmtW(u.weight)} جم · {String(u.heldAt || "").slice(0, 10)} {u.heldRef}{u.heldNote ? ` · ${u.heldNote}` : ""}
          </span>
          <button onClick={() => release(u.code)} className="px-2 py-1 rounded-lg text-[11px] font-bold" style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>أعِدها</button>
        </div>
      ))}
    </Card>
  );
}

export { HeldUnitsCard };
