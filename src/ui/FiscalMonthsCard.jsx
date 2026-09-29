import React, { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import * as api from "../core/api.js";
import { fmt } from "../core/money.js";
import { Card } from "./Card.jsx";

const ERR = { period_not_ended: "الشهر لم ينتهِ بعد", already_closed: "أُقفل هذا الشهر سلفًا", manager_only: "الإقفال للمدير" };

/// الإقفال الشهري ودخل الفترة من الدفتر (المرجع 5.2.0: FiscalYearPage) — الشهر المُقفل لا يقبل قيدًا بتاريخه.
/// والأشهر الماضية غير المُقفلة تحذيرٌ قبل إقفال السنة.
function FiscalMonthsCard({ currency = "ر.س", reloadKey = 0, flashToast }) {
  const [st, setSt] = useState(null);
  const [yr, setYr] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = () => {
    api.fiscalApi.status().then(setSt).catch(() => setSt(null));
    api.fiscalApi.year().then(setYr).catch(() => setYr(null));
  };
  useEffect(load, [reloadKey]);
  const close = async (period) => {
    setBusy(period);
    try {
      await api.fiscalApi.closeMonth(period);
      flashToast?.(`أُقفل شهر ${period}`);
      load();
    } catch (e) {
      flashToast?.(ERR[e?.body?.error] || "تعذّر إقفال الشهر");
    } finally { setBusy(null); }
  };
  if (!st && !yr) return null;
  const months = [...(st?.months || [])].reverse();
  return (
    <>
      {yr && (
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <p style={{ color: "var(--text2)" }} className="text-xs mb-1">دخل الفترة من الدفتر {yr.since ? `منذ ${new Date(yr.since).toLocaleDateString("en-GB")}` : "منذ البداية"}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["الإيرادات", yr.revenue], ["المصروفات", yr.expenses], ["الصافي", yr.netIncome]].map(([l, v]) => (
              <div key={l}>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{l}</p>
                <p style={{ color: l === "الصافي" ? (v >= 0 ? "var(--goodSolid)" : "var(--bad)") : "var(--text)", margin: 0 }} className="text-xs font-bold">{currency}{fmt(v, 0)}</p>
              </div>
            ))}
          </div>
          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2">إقفال السنة يقيّد هذا الصافي في 3300 الأرباح المحتجزة ويصفّر حسابات الدخل للسنة التالية.</p>
          {(yr.warnings || []).map((w) => <p key={w} style={{ color: "var(--warn)" }} className="text-[11px] mt-1">⚠ {w}</p>)}
        </Card>
      )}
      {months.length > 0 && (
        <>
          <p style={{ color: "var(--text2)" }} className="text-xs mb-2">الإقفال الشهري — الشهر المُقفل لا يقبل قيدًا بتاريخه</p>
          <Card style={{ padding: 10, marginBottom: 12 }}>
            {months.slice(0, 12).map((m) => (
              <div key={m.period} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text)" }} className="text-xs font-bold">{m.period} <span style={{ color: "var(--text3)" }} className="font-normal">· {m.entries} قيد</span></span>
                {m.closed ? (
                  <span style={{ color: "var(--goodSolid)" }} className="text-[11px] flex items-center gap-1"><Lock size={11} /> مُقفل</span>
                ) : (
                  <button disabled={busy === m.period} onClick={() => close(m.period)} className="text-[11px] px-3 py-1 rounded-full font-bold flex items-center gap-1"
                    style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                    {busy === m.period && <Loader2 size={11} className="animate-spin" />} أقفل الشهر
                  </button>
                )}
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

export { FiscalMonthsCard };
