import React from "react";
import { OqiyyahLogo } from "./OqiyyahLogo.jsx";

// شارة الرصيف/الشريط — غلافٌ رقيق حول شعار أوقية الحقيقي، لا شعارٌ منفصل.
//
// ⚠ كان هذا شعارًا مصطنعًا (كرة ذهبية دوارة) لا علاقة له بهوية المحل
// الفعلية. أُبقي الاسم القديم لأن عدة مواضع في التطبيق تستدعيه.
function AiLogoBadge({ width = 56 }) {
  return <OqiyyahLogo size={width} />;
}

export { AiLogoBadge };
