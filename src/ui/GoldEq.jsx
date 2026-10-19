import React from "react";
import { PURITY, fmtW } from "../core/money.js";

// المكافئ الذهبي بجانب كل مبلغ — بسعر اليوم وعيار الاحتساب (21 أو 24) من الإعدادات.
// أساس البرنامج الربح بالذهب: كل مبلغٍ يُقرأ أيضًا جرامات.
const GOLD_EQ = { price24: 0, karat: 21, on: true };
const setGoldEqContext = (patch) => { Object.assign(GOLD_EQ, patch || {}); };

function goldEqGrams(amount) {
  const p = Number(GOLD_EQ.price24) || 0;
  const k = Number(GOLD_EQ.karat) === 24 ? 24 : 21;
  const perGram = p * (PURITY[k] || k / 24);
  const a = Number(amount) || 0;
  if (!GOLD_EQ.on || !(perGram > 0) || !a) return null;
  return { grams: a / perGram, karat: k };
}

/// «≈ 1.234 جم ع21» صغيرًا بجانب المبلغ — لا شيء بلا سعرٍ أو والمكافئ مطفأ
function GoldEq({ v }) {
  const g = goldEqGrams(v);
  if (!g) return null;
  return (
    <span data-gold-eq style={{ color: "var(--text3)", fontWeight: 400, fontSize: "0.68em", marginInlineStart: 6, whiteSpace: "nowrap" }}>
      ≈ {fmtW(Math.abs(g.grams))} جم ع{g.karat}
    </span>
  );
}

export { GOLD_EQ, GoldEq, goldEqGrams, setGoldEqContext };
