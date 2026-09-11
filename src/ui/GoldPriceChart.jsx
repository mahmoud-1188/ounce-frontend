import React, { useRef, useState } from "react";
import { fmt } from "../core/money.js";

function GoldPriceChart({ data = [], currency = "﷼", height = 200, karat = 24, bare = false }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);

  const pts = data.map((d) => Number(d.price) || 0).filter((v) => v > 0);
  // نقطة واحدة لا تُرسم خطًا. الحركة تتراكم مع كل تحديث سعر، فالرسالة
  // توضّح ذلك بدل ترك مساحة فارغة تبدو كعطل.
  if (pts.length < 2) {
    return (
      <div
        style={{
          height,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(160deg,var(--panel),var(--bg))",
          borderRadius: 14,
          border: "1px solid var(--line)",
          padding: 16,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div className="gc-wait" style={{ width: 34, height: 34, margin: "0 auto 10px", borderRadius: "50%", border: "2px solid var(--edge)", borderTopColor: "var(--accent)" }} />
          {pts.length === 1 && (
            <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--accent)", margin: "0 0 4px" }} className="text-lg font-extrabold">
              {currency}{fmt(pts[0])}
            </p>
          )}
          <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">
            {pts.length === 1 ? "أول قراءة سُجّلت" : "بانتظار أول قراءة سعر"}
          </p>
          <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px]">
            يُحدَّث السعر تلقائيًا كل دقيقتين · يظهر الرسم بعد قراءتين
          </p>
        </div>
      </div>
    );
  }

  const W = 600;
  const H = 220;
  const padT = 26;
  const padB = 30;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const stepX = W / (pts.length - 1);
  const yOf = (v) => padT + (1 - (v - min) / span) * (H - padT - padB);
  const xy = pts.map((v, i) => [i * stepX, yOf(v)]);

  // منحنى ناعم: نقاط تحكّم أفقية بين كل نقطتين — الخط المستقيم يبدو
  // آليًا، والمنحنى المبالغ يكذب على شكل الحركة.
  let path = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 1; i < xy.length; i++) {
    const [px, py] = xy[i - 1];
    const [cx, cy] = xy[i];
    const mx = (px + cx) / 2;
    path += ` C${mx},${py} ${mx},${cy} ${cx},${cy}`;
  }
  const areaPath = `${path} L${W},${H - padB + 10} L0,${H - padB + 10} Z`;

  const first = pts[0];
  const last = pts[pts.length - 1];
  const delta = last - first;
  const pct = first > 0 ? (delta / first) * 100 : 0;
  const up = delta >= 0;
  const flat = Math.abs(delta) < 0.005;
  const accent = flat ? "var(--accentSoft)" : up ? "var(--goodSolid)" : "var(--bad)";
  const glow = flat ? "var(--accent)" : up ? "var(--goodSolid)" : "var(--bad)";
  const uid = up ? "up" : "dn";

  const lastXY = xy[xy.length - 1];
  const hi = pts.indexOf(max);
  const lo = pts.indexOf(min);

  const onMove = (clientX) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rel = 1 - (clientX - r.left) / r.width; // RTL: اليمين = الأقدم
    const i = Math.round(Math.min(1, Math.max(0, 1 - rel)) * (pts.length - 1));
    setHover({ i, v: pts[i], d: data[i] });
  };

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", width: "100%", height, userSelect: "none", touchAction: "pan-y" }}
      onMouseMove={(e) => onMove(e.clientX)}
      onMouseLeave={() => setHover(null)}
      onTouchStart={(e) => onMove(e.touches[0].clientX)}
      onTouchMove={(e) => onMove(e.touches[0].clientX)}
      onTouchEnd={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={`gc-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.42" />
            <stop offset="55%" stopColor={accent} stopOpacity="0.12" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
          {/* ومضة تجري على طول الخط */}
          <linearGradient id={`gc-sheen-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={glow} stopOpacity="0" />
            <stop offset="45%" stopColor={glow} stopOpacity="0" />
            <stop offset="50%" stopColor="#FFF6DC" stopOpacity="1" />
            <stop offset="55%" stopColor={glow} stopOpacity="0" />
            <stop offset="100%" stopColor={glow} stopOpacity="0" />
          </linearGradient>
          <filter id={`gc-glow-${uid}`} x="-30%" y="-60%" width="160%" height="240%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* خطوط إرشادية خفيفة */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1="0"
            x2={W}
            y1={padT + f * (H - padT - padB)}
            y2={padT + f * (H - padT - padB)}
            stroke="var(--line)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
        ))}

        <path d={areaPath} fill={`url(#gc-fill-${uid})`} className="gc-area" />

        {/* الخط مع التوهج */}
        <path
          d={path}
          fill="none"
          stroke={accent}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#gc-glow-${uid})`}
          className="gc-line"
        />
        {/* الومضة الجارية فوقه */}
        <path
          d={path}
          fill="none"
          stroke={`url(#gc-sheen-${uid})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          className="gc-sheen"
        />

        {/* أعلى وأدنى سعر */}
        {[{ i: hi, v: max, up: true }, { i: lo, v: min, up: false }].map((m, k) =>
          m.i >= 0 && pts.length > 3 ? (
            <g key={k}>
              <circle cx={xy[m.i][0]} cy={xy[m.i][1]} r="2.5" fill="var(--text3)" />
              <text
                x={Math.min(W - 40, Math.max(30, xy[m.i][0]))}
                y={m.up ? xy[m.i][1] - 8 : xy[m.i][1] + 16}
                fill="var(--text3)"
                fontSize="10"
                textAnchor="middle"
              >
                {fmt(m.v, 0)}
              </text>
            </g>
          ) : null
        )}

        {/* نقطة آخر سعر — نابضة */}
        <circle cx={lastXY[0]} cy={lastXY[1]} r="9" fill={accent} opacity="0.28" className="gc-pulse" />
        <circle cx={lastXY[0]} cy={lastXY[1]} r="4.5" fill="var(--accent)" stroke="var(--bg)" strokeWidth="1.8" />

        {/* مؤشر اللمس */}
        {hover && (
          <g>
            <line x1={xy[hover.i][0]} x2={xy[hover.i][0]} y1={padT - 12} y2={H - padB + 10} stroke={accent} strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
            <circle cx={xy[hover.i][0]} cy={xy[hover.i][1]} r="5" fill={accent} stroke="var(--bg)" strokeWidth="2" />
          </g>
        )}
      </svg>

      {/* الشارة العلوية — تُخفى في وضع الخلفية لئلا تزدحم مع الرقم */}
      {!bare && (
      <div style={{ position: "absolute", top: 6, right: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--text3)" }} className="text-[10px]">
          عيار {karat}
        </span>
        {!flat && (
          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-bold"
            style={{ background: up ? "var(--goodBg)" : "var(--badBg)", color: accent }}
          >
            {up ? "▲" : "▼"} {fmt(Math.abs(pct), 2)}٪
          </span>
        )}
      </div>

      )}

      {/* القيمة عند اللمس، أو آخر سعر */}
      {!bare && (
      <div style={{ position: "absolute", top: 4, left: 8, textAlign: "left" }}>
        <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)", margin: 0, lineHeight: 1.1 }} className="text-lg font-extrabold">
          {currency}
          {fmt(hover ? hover.v : last)}
        </p>
        {hover?.d?.time && (
          <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px]">
            {hover.d.time}
          </p>
        )}
      </div>

      )}

      {!bare && pts.length > 2 && (
        <p style={{ color: "var(--text3)", position: "absolute", bottom: 2, left: 8 }} className="text-[10px]">
          المدى {fmt(min, 0)} — {fmt(max, 0)}
        </p>
      )}
    </div>
  );
}

/// بطاقة السعر الحديثة: الرسم البياني خلفيةٌ للأرقام لا جدولًا بجانبها.
///
/// القراءة الأولى يجب أن تكون: الرقم، والاتجاه، والمدى — في نظرة. لذلك
/// الرقم في المقدمة، والمنحنى خلفه بشفافية، ولونهما معًا يتبع الاتجاه:
/// أخضر صاعد وأحمر هابط. الأرقام تعدّ تصاعديًا عند التغيّر فيلتقط النظر
/// الحركة قبل أن يقرأ القيمة.

export { GoldPriceChart };
