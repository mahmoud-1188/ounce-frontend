import React, { useRef } from "react";

function AiLogoBadge({ width = 56, showDots = true }) {
  // ── شعار أونصة ──
  //
  // الأشرطة تدور عكس عقارب الساعة (يمينًا إلى يسار) والاسم ثابت — كما
  // تدور الأرض تحت خط الطول الثابت. تدوير الاسم معها يجعله غير مقروء
  // نصف الدورة.
  //
  // ⚠ الأشرطة تُقص بقناع دائري: بلا القص تخرج أطرافها عن حدود الكرة
  // فتبدو خطوطًا لا سطحًا كرويًا.
  //
  // والذهب متلألئ: تدرّج يمرّ عبر الأشرطة فيُحاكي انعكاس الضوء على
  // المعدن. لون واحد جامد يبدو طلاءً لا ذهبًا.
  const id = useRef(`oz${Math.random().toString(36).slice(2, 8)}`).current;
  const h = width;

  // نصف أقواس الكرة — كل شريط قوس بعرض متدرّج
  const bands = [
    { y: 26, rx: 46, ry: 9, o: 1 },
    { y: 42, rx: 50, ry: 10, o: 0.95 },
    { y: 58, rx: 52, ry: 10, o: 0.9 },
    { y: 74, rx: 52, ry: 10, o: 0.9 },
    { y: 90, rx: 50, ry: 10, o: 0.95 },
    { y: 106, rx: 46, ry: 9, o: 1 },
  ];

  return (
    <div style={{ position: "relative", width, height: h, flexShrink: 0 }}>
      <svg viewBox="0 0 132 132" width={width} height={h} style={{ display: "block" }}>
        <defs>
          {/* ذهب متلألئ: فاتح في القلب داكن عند الحواف — كالمعدن المصقول */}
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7A5A2E" />
            <stop offset="22%" stopColor="#C9A24E" />
            <stop offset="42%" stopColor="#F4E2A8" />
            <stop offset="52%" stopColor="#FFF6D8" />
            <stop offset="64%" stopColor="var(--gradFrom)" />
            <stop offset="82%" stopColor="var(--gradTo)" />
            <stop offset="100%" stopColor="#6B4E27" />
          </linearGradient>

          {/* شريط ضوء يمرّ — الانعكاس */}
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--panel)" stopOpacity="0" />
            <stop offset="45%" stopColor="var(--panel)" stopOpacity="0.75" />
            <stop offset="55%" stopColor="var(--panel)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--panel)" stopOpacity="0" />
            <animate attributeName="x1" values="-1;1.4" dur="3.4s" repeatCount="indefinite" />
            <animate attributeName="x2" values="-0.4;2" dur="3.4s" repeatCount="indefinite" />
          </linearGradient>

          {/* ⚠ القناع الدائري: بلا القص تخرج الأشرطة عن الكرة */}
          <clipPath id={`${id}c`}>
            <circle cx="66" cy="66" r="56" />
          </clipPath>
        </defs>

        {/* الأشرطة الدوّارة */}
        <g clipPath={`url(#${id}c)`}>
          <g>
            {/* الدوران عكس عقارب الساعة: من 0 إلى −360 */}
            <animateTransform
              attributeName="transform" type="rotate"
              from="0 66 66" to="-360 66 66"
              dur="14s" repeatCount="indefinite"
            />
            {bands.map((b, i) => (
              <ellipse
                key={i} cx="66" cy={b.y} rx={b.rx} ry={b.ry}
                fill={`url(#${id}g)`} opacity={b.o}
                transform={`rotate(-18 66 ${b.y})`}
              />
            ))}
          </g>
        </g>

        {/* الاسم ثابت لا يدور */}
        <g>
          {/* خلفية تفصل الاسم عن الأشرطة خلفه */}
          <rect x="10" y="52" width="112" height="28" rx="6" fill="var(--bg)" opacity="0.55" />
          <text
            x="66" y="72" textAnchor="middle"
            fontFamily="'Cairo', 'Segoe UI', sans-serif"
            fontSize="27" fontWeight="700" letterSpacing="1"
            fill={`url(#${id}g)`}
          >
            ounce
          </text>
          {showDots && (
            <text
              x="66" y="72" textAnchor="middle"
              fontFamily="'Cairo', 'Segoe UI', sans-serif"
              fontSize="27" fontWeight="700" letterSpacing="1"
              fill={`url(#${id}s)`}
            >
              ounce
            </text>
          )}
        </g>

        {/* لمعة على حافة الكرة */}
        {showDots && (
          <circle cx="66" cy="66" r="56" fill="none" stroke={`url(#${id}s)`} strokeWidth="2" opacity="0.6" />
        )}
      </svg>
    </div>
  );
}

export { AiLogoBadge };
