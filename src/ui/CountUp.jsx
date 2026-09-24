import React from "react";
import { useCountUp } from "../domain/helpers.js";

function CountUp({ value, format, decimals = 2, style, className }) {
  const v = useCountUp(value, { decimals });
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }} className={className}>{format ? format(v) : v}</span>;
}

/// خطٌّ صغير — مساحةٌ مظلّلة تحته، ونقطةٌ على آخر قيمة.
///
/// ⚠ بلا محاور ولا أرقام: هو إشارةٌ لا رسمٌ بيانيّ. من أراد الأرقام فتح
///   التقرير. والخطّ يُرسم بحركة (stroke-dashoffset) عند تغيّر الفترة.

export { CountUp };
