import React, { useState } from "react";
import { CheckCircle2, Circle, X } from "lucide-react";
import { Card } from "./Card.jsx";

const HIDE_KEY = "ounce_start_here_hidden_v1";
const readHidden = () => { try { return localStorage.getItem(HIDE_KEY) === "1"; } catch { return false; } };

/// خطوات «ابدأ هنا» للفرع — من بيانات الفرع نفسها، لا علاماتٍ يدوية. تظهر حتى تكتمل أو يُخفيها المدير.
function branchStartSteps({ storeName = "", price24 = 0, cashIn = 0, pieces = 0, daysOpened = 0, daysClosed = 0, salesCount = 0, workdayOff = false, has = () => true }) {
  const all = [
    { id: "info", go: "settings", done: !!String(storeName || "").trim(), label: "اكتب اسم محلّك", hint: "يظهر على الفاتورة وعرض السعر" },
    { id: "price", go: "price", done: Number(price24) > 0, label: "ضع سعر الذهب اليوم", hint: "كل فاتورةٍ تُحسب منه" },
    { id: "cash", go: "cash", done: Number(cashIn) > 0 || Number(daysOpened) > 0, label: "ضع نقد المحل في الخزنة", hint: "منه تُسلَّم فكّة الدرج كل صباح" },
    { id: "code", go: "addGoods", done: Number(pieces) > 0, label: "كوّد أوّل قطعة", hint: "سجّل القطعة بوزنها وعيارها واطبع ملصقها" },
    !workdayOff && { id: "openDay", go: "workday", done: Number(daysOpened) > 0, label: "افتح يوم العمل", hint: "بعهدة الدرج من الخزنة" },
    { id: "sell", go: "sales", done: Number(salesCount) > 0, label: "بِع أوّل فاتورة", hint: "امسح القطعة أو اخترها وأكّد" },
    !workdayOff && { id: "closeDay", go: "workday", done: Number(daysClosed) > 0, label: "أنهِ اليوم في المساء", hint: "عُدّ الدرج — يُورَّد للخزنة ويُقفل اليوم" },
  ].filter(Boolean);
  return all.filter((s) => has(s.go)).map((s, i) => ({ ...s, n: i + 1 }));
}

function StartHereCard({ steps = [], onGo }) {
  const [hidden, setHidden] = useState(readHidden);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (hidden || steps.length < 3 || done === steps.length) return null;
  const hide = () => { try { localStorage.setItem(HIDE_KEY, "1"); } catch { /* تفضيلٌ محلّي */ } setHidden(true); };
  return (
    <div className="px-4 pt-3">
      <Card style={{ padding: 14, border: "1px solid var(--accentLine)" }} data-start-here>
        <div className="flex items-center justify-between mb-1">
          <p style={{ color: "var(--accent)" }} className="text-sm font-bold">ابدأ هنا · {done} من {steps.length}</p>
          <button onClick={hide} aria-label="إخفاء ابدأ هنا" style={{ color: "var(--text3)" }}><X size={16} /></button>
        </div>
        <div className="h-1.5 rounded-full mb-3" style={{ background: "var(--line)" }}>
          <div className="h-1.5 rounded-full" style={{ width: `${(done / steps.length) * 100}%`, background: "var(--accent)" }} />
        </div>
        <div className="flex flex-col gap-1">
          {steps.map((s) => (
            <button key={s.id} onClick={() => onGo(s.go)} className="flex items-start gap-2 text-right py-1"
              style={{ opacity: s.done ? 0.6 : 1 }}>
              {s.done ? <CheckCircle2 size={16} color="var(--good)" className="shrink-0 mt-0.5" /> : <Circle size={16} color={s === next ? "var(--accent)" : "var(--text3)"} className="shrink-0 mt-0.5" />}
              <span className="min-w-0">
                <span style={{ color: "var(--text)", textDecoration: s.done ? "line-through" : "none" }} className={`block text-[12px] ${s === next ? "font-bold" : ""}`}>{s.n}. {s.label}</span>
                {s === next && <span style={{ color: "var(--text3)" }} className="block text-[11px]">{s.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

export { StartHereCard, branchStartSteps };
