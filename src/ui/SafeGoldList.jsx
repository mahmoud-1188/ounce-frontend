import React from "react";
import { fmtW } from "../core/money.js";
import { Card } from "./Card.jsx";

// حركات ذهب الخزنة بنوعه (مشغول · كسر) وعياره ووجهته — كانت الخزنة تعرض حركات النقد وحدها
function SafeGoldList({ list = [], limit = 30 }) {
  const rows = (list || []).slice(0, limit);
  if (!rows.length) return null;
  return (
    <Card style={{ padding: 12, marginTop: 12 }} data-safe-gold-list>
      <p style={{ color: "var(--text2)" }} className="text-xs mb-1">حركات ذهب الخزنة</p>
      {rows.map((t) => (
        <div key={t.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="flex flex-col leading-tight">
            <span style={{ color: "var(--text)" }} className="text-xs font-bold">{t.type === "in" ? "إيداع" : "سحب"} {t.kind === "crafted" ? "مشغول" : "كسر"} · عيار {t.karat || 21}</span>
            <span style={{ color: "var(--text3)" }} className="text-[11px]">{t.date ? new Date(t.date).toLocaleDateString("en-GB") : ""}{t.destinationLabel ? ` · ${t.destinationLabel}` : ""}{t.supplierName ? ` · ${t.supplierName}` : ""}{t.note ? ` · ${t.note}` : ""}</span>
          </div>
          <span style={{ color: t.type === "in" ? "var(--goodSolid)" : "var(--bad)" }} className="text-xs font-bold">{t.type === "in" ? "+" : "−"}{fmtW(t.weight)} جم</span>
        </div>
      ))}
    </Card>
  );
}

export { SafeGoldList };
