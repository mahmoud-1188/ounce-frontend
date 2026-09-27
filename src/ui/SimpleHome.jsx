import React, { useState } from "react";
import { ChevronLeft, Warehouse } from "lucide-react";
import { PURITY, fmtMoney } from "../core/money.js";
import { NAV_REGISTRY } from "../core/navigation.js";
import { simpleRows } from "../domain/nowTasks.js";
const toneOf = (t) => ({ fg: `var(--tone-${t}, var(--accentText))`, bg: `var(--tone-${t}-bg, var(--panel))` });
import { ModalShell } from "./ModalShell.jsx";

/// `stock`: مختصر المخزون تحت الأسعار — { title, value, unit, chips: [[تسمية, قيمة]], go } (الضغط يفتح `go`).
function SimpleHome({ layout, has = () => true, sell24 = 0, currency = "ر.س", tasks = [], onSell, onScrap, onGo, badges = {}, stock = null }) {
  const [open, setOpen] = useState(null);
  const num = { fontFamily: "'Cairo', sans-serif", fontVariantNumeric: "tabular-nums" };
  const run = (row) => {
    setOpen(null);
    if (row.act === "sell") return onSell?.();
    if (row.act === "scrap") return onScrap?.();
    const [p, t] = row.id.split(":");
    return onGo(p, t || null);
  };
  const withRows = (g) => ({ ...g, rows: simpleRows(g.items, has, NAV_REGISTRY) });
  const big = layout.big.map(withRows).filter((g) => g.rows.length);
  const small = layout.small.map(withRows).filter((g) => g.rows.length);
  const sheet = open ? [...big, ...small].find((g) => g.key === open) : null;
  const badge = (n) => (n > 0 ? <span className="text-[11px] font-bold px-2 rounded-full" style={{ background: "var(--bad)", color: "#fff" }}>{n}</span> : null);
  // تنبيه: «السهم في دائرة» و«الأيقونة الخافتة» زخرفةٌ لا تُقرأ — aria-hidden
  const Arrow = ({ light }) => (
    <span aria-hidden="true" className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 99, flexShrink: 0,
      background: light ? "rgba(255,255,255,.55)" : "var(--panel)", boxShadow: light ? "none" : "0 1px 2px rgba(0,0,0,.06)" }}>
      <ChevronLeft size={16} color={light ? "#3B2A0A" : "var(--text2)"} />
    </span>
  );
  return (
    <div className="px-4 pt-3 pb-28">
      {/* ① أسعار العيارات — صفٌّ واحد بسعر البيع للجرام اليوم */}
      <div className="mb-3 px-2 py-2.5" style={{ background: "var(--panel)", border: "var(--cardBorder)", borderRadius: 20, boxShadow: "var(--cardShadow)" }}>
        <div className="grid grid-cols-4">
          {[24, 22, 21, 18].map((k, i) => (
            <div key={k} className="text-center" style={{ borderInlineStart: i ? "1px solid var(--line)" : "none", padding: "2px 2px" }}>
              <p style={{ color: "var(--accentText)", margin: 0 }} className="text-[11px] font-bold">عيار {k}</p>
              <p style={{ color: "var(--text)", margin: 0, ...num }} className="text-sm font-extrabold">{sell24 > 0 ? fmtMoney(sell24 * PURITY[k]) : "—"}</p>
            </div>
          ))}
        </div>
        <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px] text-center">سعر البيع للجرام اليوم · {currency}</p>
      </div>

      {/* ② مختصر المخزون — الذهب كلّه بمكافئ عيار الاحتساب، وتفصيله في سطر */}
      {stock && (
        <button onClick={() => { if (!stock.go) return; const [p, t] = stock.go.split(":"); onGo(p, t || null); }} aria-label={stock.title} className="w-full text-right mb-3 px-4 py-3"
          style={{ background: "linear-gradient(135deg, var(--accentBg), var(--panel) 70%)", border: "1px solid var(--accentLine)", borderRadius: 20, boxShadow: "var(--cardShadow)" }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text2)" }} className="text-xs font-bold">{stock.title}</span>
            <span className="flex items-center gap-1"><Warehouse size={14} color="var(--accent)" /></span>
          </div>
          <p style={{ color: "var(--text)", margin: "2px 0 6px", ...num }} className="text-3xl font-black">
            {stock.value}<span style={{ color: "var(--text3)", fontSize: 12, marginInlineStart: 6 }}>{stock.unit}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {stock.chips.map(([l, v]) => (
              <span key={l} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)", ...num }}>
                {l} <b style={{ color: "var(--text)" }}>{v}</b>
              </span>
            ))}
          </div>
        </button>
      )}

      {/* ③ الآن — سطرٌ لكل ما ينتظر، بأولويّته */}
      {tasks.slice(0, 2).map((t) => (
        <button key={t.id} onClick={() => run({ id: t.id, act: t.id === "openDay" ? "sell" : null })}
          className="w-full text-right flex items-center gap-2 px-3 py-2.5 mb-2"
          style={{ background: t.level === "block" ? "var(--badBg)" : "var(--accentBg)", border: `1px solid ${t.level === "block" ? "var(--badLine)" : "var(--accentLine)"}`, borderRadius: 16 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: t.level === "block" ? "var(--bad)" : "var(--accent)" }} />
          <span style={{ color: "var(--text)" }} className="text-xs font-bold flex-1">{t.label}</span>
          <span style={{ color: "var(--text3)" }} className="text-[11px]">{t.hint}</span>
        </button>
      ))}

      {/* ④ الأزرار الكبيرة — بأولويّة يوم المحل: أيقونةٌ ملوّنة، وتلميحاتٌ كشارات، وأيقونةٌ خافتة في الزاوية */}
      <div className="flex flex-col gap-3 mt-2 mb-3">
        {big.map((g, i) => {
          const Icon = g.icon;
          const hero = i === 0;
          const tone = toneOf(g.tone);
          return (
            <button key={g.key} onClick={() => setOpen(g.key)} aria-haspopup="dialog" aria-label={g.title}
              className="w-full flex items-center gap-3 px-4 text-right relative"
              style={{ overflow: "hidden", minHeight: hero ? 104 : 84, borderRadius: 26, boxShadow: "var(--cardShadow)",
                background: hero ? "linear-gradient(135deg, var(--gradFrom), var(--gradTo))" : `linear-gradient(120deg, ${tone.bg} 0%, var(--panel) 85%)`,
                border: hero ? "none" : "var(--cardBorder)" }}>
              <span aria-hidden="true" style={{ position: "absolute", insetInlineEnd: -14, bottom: -18, opacity: hero ? 0.13 : 0.07, color: hero ? "#3B2A0A" : tone.fg, pointerEvents: "none" }}>
                <Icon size={hero ? 118 : 96} />
              </span>
              <span className="flex items-center justify-center" style={{ width: hero ? 58 : 50, height: hero ? 58 : 50, borderRadius: 18, flexShrink: 0, position: "relative",
                background: hero ? "rgba(255,255,255,.5)" : tone.fg, color: hero ? "#3B2A0A" : "var(--panel)",
                boxShadow: hero ? "0 0 0 4px rgba(255,255,255,.25)" : `0 6px 16px -8px ${tone.fg}` }}>
                <Icon size={hero ? 29 : 24} />
              </span>
              <span className="flex-1" style={{ position: "relative", minWidth: 0 }}>
                <span style={{ display: "block", color: hero ? "#2B1F07" : "var(--text)" }} className={`${hero ? "text-2xl" : "text-lg"} font-black`}>{g.title}</span>
                <span className="flex flex-wrap gap-1 mt-1">
                  {g.hint.split(" · ").map((h) => (
                    <span key={h} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: hero ? "rgba(255,255,255,.45)" : "var(--panel)", color: hero ? "#3B2A0A" : tone.fg }}>{h}</span>
                  ))}
                </span>
              </span>
              {badge(badges[g.key])}
              <Arrow light={hero} />
            </button>
          );
        })}
      </div>

      {/* ⑤ الأزرار الأصغر — مربّعاتٌ بعمودين: أيقونةٌ ملوّنة فوق اسمها، وخطٌّ رفيع بلون القسم */}
      <div className="grid grid-cols-2 gap-3">
        {small.map((g) => {
          const Icon = g.icon;
          const tone = toneOf(g.tone);
          return (
            <button key={g.key} onClick={() => setOpen(g.key)} aria-haspopup="dialog" aria-label={g.title}
              className="flex flex-col items-center justify-center gap-2 py-4 px-2 relative"
              style={{ overflow: "hidden", background: "var(--panel)", border: "var(--cardBorder)", borderRadius: 22, boxShadow: "var(--cardShadow)", minHeight: 104 }}>
              <span aria-hidden="true" style={{ position: "absolute", top: 0, insetInline: 22, height: 3, borderRadius: 3, background: tone.fg, opacity: 0.7 }} />
              <span className="flex items-center justify-center" style={{ width: 46, height: 46, borderRadius: 16, background: tone.bg, color: tone.fg }}>
                <Icon size={22} />
              </span>
              <span style={{ color: "var(--text)" }} className="text-sm font-extrabold text-center">{g.title}</span>
              {badges[g.key] > 0 && <span style={{ position: "absolute", top: 10, insetInlineEnd: 10 }}>{badge(badges[g.key])}</span>}
            </button>
          );
        })}
      </div>

      {/* الورقة: ملحقات الزرّ — أوّلها الفعل الأهمّ */}
      {sheet && (
        <ModalShell title={sheet.title} onClose={() => setOpen(null)}>
          <div className="flex flex-col gap-2 pb-2">
            {sheet.rows.map((r, i) => {
              const Icon = r.icon || sheet.icon;
              const lead = r.primary || i === 0;
              const tone = toneOf(sheet.tone);
              return (
                <button key={r.id} onClick={() => run(r)} className="w-full flex items-center gap-3 px-3 py-3 text-right"
                  style={{ borderRadius: 16, background: lead ? tone.bg : "var(--field)", border: `1px solid ${lead ? tone.fg : "var(--line)"}` }}>
                  <span className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                    background: lead ? tone.fg : "var(--panel)", color: lead ? "var(--panel)" : tone.fg }}>
                    <Icon size={18} />
                  </span>
                  <span style={{ color: "var(--text)" }} className={`text-sm flex-1 ${lead ? "font-black" : "font-bold"}`}>{r.label}</span>
                  <ChevronLeft size={15} color="var(--text3)" />
                </button>
              );
            })}
          </div>
        </ModalShell>
      )}
    </div>
  );
}

export { SimpleHome };
