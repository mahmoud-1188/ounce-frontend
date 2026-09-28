import React from "react";
import { AwnsahLogo } from "./AwnsahLogo.jsx";

// شارة الرصيف/الشريط — غلافٌ رقيق حول شعار أونصة الحقيقي، لا شعارٌ منفصل.
//
// ⚠ كان هذا شعارًا مصطنعًا (كرة ذهبية دوارة) لا علاقة له بهوية المحل
// الفعلية. أُبقي الاسم القديم لأن عدة مواضع في التطبيق تستدعيه.
function AiLogoBadge({ width = 56 }) {
  return <AwnsahLogo size={width} />;
}

export { AiLogoBadge };
