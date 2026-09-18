import React, { useMemo } from "react";
import { buildQrMatrix } from "../domain/buildQrMatrix.js";

function QrCode({ value, size = 96, quiet = 2 }) {
  const matrix = useMemo(() => buildQrMatrix(value), [value]);
  if (!matrix) return null;
  const n = matrix.length;
  const total = n + quiet * 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${total} ${total}`} shapeRendering="crispEdges"
      role="img" aria-label={`رمز ${value}`}>
      <rect width={total} height={total} fill="#fff" />
      {matrix.flatMap((row, r) => row.map((on, c) => (on
        ? <rect key={`${r}_${c}`} x={c + quiet} y={r + quiet} width={1} height={1} fill="#000" />
        : null)))}
    </svg>
  );
}


// ═══════════════════════════════════════════════════════════════════════
//  الماسح — كاميرا + قارئ RFID/باركود
//
//  ⚠ ثلاثة مصادر لمدخلٍ واحد:
//   ① قارئ RFID/باركود يعمل كلوحة مفاتيح (HID) — الأشيع والأرخص.
//     يكتب الرمز ثم Enter. نلتقطه من `keydown` على المستند لأنه لا
//     يستهدف حقلًا بعينه.
//   ② كاميرا الجهاز عبر BarcodeDetector — متاحة في كروم أندرويد، وغائبة
//     في سفاري iOS. الغياب يُقال صراحةً لا يُترك زرًّا لا يفعل شيئًا.
//   ③ الكتابة اليدوية — تبقى دائمًا، فالقارئ يتعطّل والكاميرا تُمنع.
// ═══════════════════════════════════════════════════════════════════════

/// يلتقط ما يكتبه قارئ HID: دفقةُ محارف سريعة تنتهي بـEnter.
///
/// ⚠ الفرق بين القارئ والإنسان هو السرعة لا المحتوى: القارئ يكتب الرمز
/// في أقلّ من 50 مللي للمحرف، والإنسان أبطأ. بلا هذا الشرط يلتقط الماسح
/// ما يكتبه البائع في أي حقل.

// ═══════════════════════════════════════════════════════════════════════
//  بروتوكول قارئ NHR-10 (UHF RFID عبر BLE)
//
//  المرجع: Nextwaves NHR-10 REV-A · User Guide Rev. A1.1
//
//  ⚠ قناة 0xFF01 تحمل نوعين مختلفين: ردود JSON نصّية، وإطارات EPC
//  ثنائية. الدليل صريح: افحص أول بايتين قبل أي تحويل لنصّ. من يُحوّل
//  أولًا يحصل على محارف تالفة ويظنّ الجهاز معطوبًا.
// ═══════════════════════════════════════════════════════════════════════

export { QrCode };
