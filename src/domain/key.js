import { normAr } from "./normAr.js";
import { stemAr } from "./stemAr.js";

const key = (w) => stemAr(normAr(w));

/// ── النوايا ──
///
/// كل نية: كلماتها المميّزة، وسؤالها النموذجي، ودالة تُجيب من البيانات.
/// `answer` تُعيد نصًا أو null إن تعذّر (فنسقط للشبكة).

export { key };
