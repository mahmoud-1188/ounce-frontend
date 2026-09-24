import React, { useMemo, useState } from "react";
import { fmtMoney } from "../core/money.js";
import { buildReportHub } from "../domain/buildReportHub.js";
import { inputStyle, reportPeriod, toCsv } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Collapse } from "../ui/Collapse.jsx";
import { CountUp } from "../ui/CountUp.jsx";
import { DeltaChip } from "../ui/DeltaChip.jsx";
import { DocHeader } from "../ui/DocHeader.jsx";
import { SegBar } from "../ui/SegBar.jsx";
import { Sparkline } from "../ui/Sparkline.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function ReportsHubPage({ data, currency = "ر.س", onOpen, onBack }) {
  const [periodKey, setPeriodKey] = useState("month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [openCard, setOpenCard] = useState(null);
  const [pressed, setPressed] = useState(null);
  // ⚠ **الطباعة تفتح كل البطاقات أولًا:** ما يُطبع ورقةٌ للمراجع، لا شاشةٌ تُطوى بالضغط.
  //   وتُطفأ الحركة كي لا يُلتقط الرقم في منتصف عدّه.
  const [printing, setPrinting] = useState(false);
  const printAll = () => {
    setPrinting(true);
    setTimeout(() => { try { window.print(); } finally { setTimeout(() => setPrinting(false), 300); } }, 120);
  };
  // ⚠ تصدير Excel: كل الأقسام والبطاقات والصفوف في ملفٍّ واحد — بترتيب الشاشة نفسه،
  //   والفترة في أوّله (جدولٌ بلا فترته ورقةٌ لا معنى لها بعد أسبوع).
  const exportCsv = () => {
    const rows = [["مركز التقارير — أوقية"], [`الفترة: ${period.label}`, period.from.slice(0, 10), period.to.slice(0, 10)], [],
      ["القسم", "التقرير", "الرقم الرئيسي", "البند", "القيمة", "ملاحظة"]];
    for (const g of hub.glance) rows.push(["نظرة سريعة", g.label, g.value, "", "", g.pct != null ? `${g.pct > 0 ? "▲" : "▼"} ${Math.abs(g.pct)}٪` : ""]);
    for (const sec of hub.sections) for (const cd of sec.cards) {
      rows.push([sec.title, cd.label, cd.headline, "", "", cd.hint || ""]);
      for (const r of cd.rows || []) rows.push([sec.title, cd.label, "", r.label, r.amount, r.sub || ""]);
    }
    const csv = toCsv([], rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `تقارير-${period.from.slice(0, 10)}-${period.to.slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const period = useMemo(() => reportPeriod(periodKey, custom), [periodKey, custom.from, custom.to]);
  const hub = useMemo(() => buildReportHub({ ...data, from: period.from, to: period.to, currency }),
    [data, period.from, period.to, currency]);
  // ⚠ الفترة تُورَث للتقرير الكامل: من اختار «الربع» هنا لا يُعيد اختياره هناك
  const open = (o) => onOpen({ ...o, from: period.from.slice(0, 10), to: period.to.slice(0, 10) });
  const toneColor = (t) => t === "good" ? "var(--good)" : t === "bad" ? "var(--bad)" : t === "warn" ? "var(--accent)" : "var(--text)";
  const PERIODS = [["today", "اليوم"], ["week", "٧ أيام"], ["month", "الشهر"], ["quarter", "الربع"], ["year", "السنة"], ["custom", "مخصّص"]];
  // ⚠ مفتاح الفترة على القسم كلّه: يُعيد تركيب البطاقات فتنبض بحركة الدخول
  //   مرّةً واحدة عند التبديل — إشارةٌ أن الأرقام تغيّرت، لا زينة.
  const fadeKey = `${period.from}|${period.to}`;
  const press = (id) => ({
    onPointerDown: () => setPressed(id), onPointerUp: () => setPressed(null), onPointerLeave: () => setPressed(null), onPointerCancel: () => setPressed(null),
    style: { transform: pressed === id ? "scale(.985)" : "scale(1)", transition: "transform .12s ease" },
  });
  const fmtNum = (v) => `${fmtMoney(v)} ${currency}`;

  return (
    <div className={`pb-6 ons-hub-print`} style={printing ? { animation: "none" } : undefined}>
      <style>{`@keyframes onsRise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .ons-rise{animation:onsRise .32s cubic-bezier(.2,.8,.2,1) both}
        @media (prefers-reduced-motion: reduce){.ons-rise{animation:none}}
        @media print{
          body *{visibility:hidden}
          .ons-hub-print,.ons-hub-print *{visibility:visible}
          .ons-hub-print{position:absolute;inset:0 auto auto 0;width:100%;background:#fff;color:#000;padding:8mm}
          .ons-hub-print *{color:#000!important;background:transparent!important;border-color:#bbb!important;box-shadow:none!important;animation:none!important;transition:none!important}
          .ons-hub-print .ons-noprint{display:none!important}
          .ons-hub-print .ons-sec{break-inside:avoid;page-break-inside:avoid}
          .ons-hub-print svg{display:none!important}
        }`}</style>
      <SubPageHeader title="التقارير" onBack={onBack} right={
        <div className="flex gap-1.5 ons-noprint">
          <button onClick={exportCsv} className="text-[11px] px-3 py-1.5 rounded-lg"
            style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>Excel</button>
          <button onClick={printAll} className="text-[11px] px-3 py-1.5 rounded-lg"
            style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>طباعة</button>
        </div>
      } />
      <div className="px-4 pt-2">

      {printing && (
        <DocHeader info={data?.branchDoc} title="مركز التقارير" sub={`${period.label} · ${period.from.slice(0, 10)} ← ${period.to.slice(0, 10)} · طُبع ${new Date().toLocaleString("en-GB")}`} />
      )}
      {/* ══ الفترة — واحدةٌ للجميع ══ */}
      <div className="flex gap-1 mb-2 ons-noprint" style={{ overflowX: "auto", paddingBottom: 2 }}>
        {PERIODS.map(([k, l]) => (
          <button key={k} onClick={() => setPeriodKey(k)} {...press("p" + k)}
            className="px-3 py-2 rounded-xl text-[11px] font-bold flex-shrink-0"
            style={{ ...press("p" + k).style, background: periodKey === k ? "var(--accentBg)" : "var(--field)",
              color: periodKey === k ? "var(--accent)" : "var(--text3)",
              border: `1px solid ${periodKey === k ? "var(--accentLine)" : "var(--line)"}` }}>{l}</button>
        ))}
      </div>
      {periodKey === "custom" && (
        <div className="flex gap-2 mb-2 ons-rise ons-noprint">
          <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
          <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
        </div>
      )}
      <p style={{ color: "var(--text3)", margin: "0 0 10px" }} className="text-[10px]">
        كل الأرقام أدناه عن <b style={{ color: "var(--text2)" }}>{period.label}</b> — والأرصدة (الذمم، النقد، الذهب) حتى نهايتها.
        <span style={{ color: "var(--text3)" }}> والشارات ▲▼ مقارنةً بالفترة السابقة.</span>
      </p>
      {hub.activity === 0 && (
        <Card style={{ padding: "10px 12px", marginBottom: 12, border: "1px solid var(--accentLine)", background: "var(--accentBg)" }} className="ons-rise">
          <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px] font-bold">
            لا حركةَ في {period.label}{hub.lastEntryDate ? ` — آخر قيدٍ في ${hub.lastEntryDate.slice(0, 10)}` : ""}
          </p>
          <div className="flex gap-2 mt-2">
            {periodKey !== "year" && <button onClick={() => setPeriodKey("year")} className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
              style={{ background: "var(--field)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>اعرض السنة</button>}
            {hub.lastEntryDate && <button onClick={() => { setCustom({ from: hub.lastEntryDate.slice(0, 7) + "-01", to: hub.lastEntryDate.slice(0, 10) }); setPeriodKey("custom"); }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: "var(--field)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>شهر آخر قيد</button>}
          </div>
        </Card>
      )}

      {/* ══ نظرةٌ سريعة — أربعة أرقام تعدّ، وتحت كلٍّ خطُّه ══ */}
      {/* ⚠ بلا مفتاح فترةٍ هنا: إعادة التركيب تُصفّر العدّاد فيقفز الرقم بدل أن
          يعدّ. الحركة هنا هي العدّ نفسه والخطّ الذي يُعاد رسمه. */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {hub.glance.map((g) => (
          <Card key={g.label} style={{ padding: "10px 12px" }}>
            <div className="flex items-center justify-between gap-1">
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{g.label}</p>
              <DeltaChip pct={g.pct} up={g.up} />
            </div>
            <p style={{ color: toneColor(g.tone), margin: "2px 0 4px" }} className="text-[15px] font-bold">
              {g.unit ? <><CountUp value={g.raw} decimals={3} format={(v) => v.toFixed(3)} /> {g.unit}</> : <CountUp value={g.raw} format={fmtNum} />}
            </p>
            {g.series && <Sparkline values={g.series} tone={g.tone || ""} width={140} height={26} />}
            {g.segments && <SegBar parts={g.segments} height={6} show={false} />}
          </Card>
        ))}
      </div>

      {/* ══ الأقسام ══ */}
      {hub.sections.map((sec, si) => (
        <div key={sec.id} className="mb-4 ons-sec">
          <p style={{ color: "var(--accentText)", margin: "0 0 6px" }} className="text-[12px] font-bold">
            {["①", "②", "③", "④", "⑤", "⑥", "⑦"][si]} {sec.title}
          </p>
          <div className="flex flex-col gap-1.5" key={sec.id + fadeKey}>
            {sec.cards.map((cd, ci) => {
              const on = printing || openCard === cd.id;
              return (
                <Card key={cd.id} className="ons-rise" style={{ padding: 0, overflow: "hidden", animationDelay: `${Math.min(ci, 6) * 40}ms`,
                  border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`, ...press(cd.id).style }}>
                  <button onClick={() => setOpenCard(on ? null : cd.id)} {...press(cd.id)} className="w-full text-right px-3 py-2.5"
                    style={{ background: on ? "var(--accentBg)" : "transparent" }}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px] font-bold">{cd.label}</p>
                          <DeltaChip pct={cd.pct} up={cd.up} />
                        </div>
                        <p style={{ color: "var(--text3)", margin: "1px 0 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} className="text-[10px]">{cd.hint}</p>
                      </div>
                      {cd.series && <Sparkline values={cd.series} tone={cd.tone || ""} width={64} height={22} />}
                      <p style={{ color: toneColor(cd.tone), margin: 0, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
                        className="text-[13px] font-bold">{cd.headline}</p>
                      <span style={{ color: "var(--text3)", transform: on ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform .2s" }}>‹</span>
                    </div>
                    {/* ⚠ الشريط المجزّأ في وجه البطاقة: «ممّ يتكوّن؟» بلا فتح */}
                    {cd.segments && cd.segments.length > 1 && <div className="mt-2"><SegBar parts={cd.segments} height={5} show={on} /></div>}
                  </button>
                  <Collapse open={on}>
                    <div style={{ borderTop: "1px solid var(--line)", background: "var(--bg)" }} className="px-3 py-2">
                      {cd.rows.length === 0 ? (
                        <p style={{ color: "var(--text3)", margin: "4px 0 8px" }} className="text-[10px]">التفاصيل في التقرير الكامل.</p>
                      ) : cd.rows.map((r, i) => (
                        <button key={i} onClick={() => r.open && open(r.open)} disabled={!r.open} {...(r.open ? press(cd.id + i) : {})}
                          className="w-full text-right flex items-center gap-2 py-1.5"
                          style={{ ...(r.open ? press(cd.id + i).style : {}), borderBottom: i < cd.rows.length - 1 ? "1px solid var(--line)" : "none", cursor: r.open ? "pointer" : "default" }}>
                          <span className="flex-1 min-w-0 truncate" style={{ color: r.strong ? "var(--text)" : "var(--text2)", fontWeight: r.strong ? 800 : 500, fontSize: 11 }}>
                            {r.label}{r.sub ? <span style={{ color: "var(--text3)", fontWeight: 400 }}> · {r.sub}</span> : null}
                          </span>
                          <span style={{ color: r.strong ? "var(--text)" : "var(--text2)", fontVariantNumeric: "tabular-nums", fontSize: 11, fontWeight: r.strong ? 800 : 600, whiteSpace: "nowrap" }}>{r.amount}</span>
                          {r.open && <span style={{ color: "var(--text3)", fontSize: 11 }}>›</span>}
                        </button>
                      ))}
                      <button onClick={() => open(cd.open)} {...press(cd.id + "full")} className="w-full py-2 rounded-xl text-[11px] font-bold mt-2 ons-noprint"
                        style={{ ...press(cd.id + "full").style, background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                        التقرير الكامل ›
                      </button>
                    </div>
                  </Collapse>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

export { ReportsHubPage };
