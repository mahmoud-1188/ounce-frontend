import { QR_ALNUM } from "../core/constants.js";
import { qrEccBytes } from "./helpers.js";

function buildQrMatrix(text) {
  const data = String(text || "").toUpperCase();
  if (!data || [...data].some((c) => QR_ALNUM.indexOf(c) < 0)) return null;
  if (data.length > 53) return null;

  const SIZE = 29, TOTAL = 70, ECC = 15;          // النسخة 3-L
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0010, 4);                                 // الوضع: أبجدي-رقمي
  push(data.length, 9);                            // العدّاد للنسخ 1–9
  for (let i = 0; i < data.length; i += 2) {
    if (i + 1 < data.length) push(QR_ALNUM.indexOf(data[i]) * 45 + QR_ALNUM.indexOf(data[i + 1]), 11);
    else push(QR_ALNUM.indexOf(data[i]), 6);
  }
  const cap = (TOTAL - ECC) * 8;
  push(0, Math.min(4, cap - bits.length));          // الإنهاء
  while (bits.length % 8) bits.push(0);
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    bytes.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  }
  const PAD = [0xec, 0x11];
  for (let i = 0; bytes.length < TOTAL - ECC; i++) bytes.push(PAD[i % 2]);
  const full = [...bytes, ...qrEccBytes(bytes, ECC)];

  // الشبكة
  const m = Array.from({ length: SIZE }, () => new Array(SIZE).fill(null));
  const setF = (r, c, v) => { if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) m[r][c] = v; };
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const on = r >= 0 && r <= 6 && c >= 0 && c <= 6
        && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      setF(r0 + r, c0 + c, on ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, SIZE - 7); finder(SIZE - 7, 0);
  for (let i = 8; i < SIZE - 8; i++) {              // التوقيت
    const v = i % 2 === 0 ? 1 : 0;
    if (m[6][i] === null) m[6][i] = v;
    if (m[i][6] === null) m[i][6] = v;
  }
  for (let r = 20; r <= 24; r++) for (let c = 20; c <= 24; c++) {   // المحاذاة (النسخة 3)
    m[r][c] = (r === 20 || r === 24 || c === 20 || c === 24 || (r === 22 && c === 22)) ? 1 : 0;
  }
  m[SIZE - 8][8] = 1;                               // وحدة داكنة ثابتة

  // معلومات النسق: L + نمط 0 → 111011111000100
  // النسخة الأولى حول المحدّد العلوي الأيسر، والثانية موزَّعة على محدّدَي
  // الأعلى-اليمين والأسفل-اليسار. ترتيب البتّات مقلوب بين النسختين.
  const FMT = [1,1,1,0,1,1,1,1,1,0,0,0,1,0,0];
  for (let i = 0; i <= 5; i++) { m[8][i] = FMT[i]; m[i][8] = FMT[14 - i]; }
  m[8][7] = FMT[6]; m[8][8] = FMT[7]; m[7][8] = FMT[8];
  for (let i = 9; i < 15; i++) m[14 - i][8] = FMT[i];
  for (let i = 0; i < 8; i++) m[8][SIZE - 1 - i] = FMT[i];
  for (let i = 8; i < 15; i++) m[SIZE - 15 + i][8] = FMT[i];

  // البيانات زِقزاقًا من أسفل اليمين
  let bi = 0, up = true;
  const dataBits = full.flatMap((b) => [7,6,5,4,3,2,1,0].map((i) => (b >> i) & 1));
  for (let col = SIZE - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;                        // عمود التوقيت يُتخطّى
    for (let k = 0; k < SIZE; k++) {
      const row = up ? SIZE - 1 - k : k;
      for (const c of [col, col - 1]) {
        if (m[row][c] !== null) continue;
        const bit = bi < dataBits.length ? dataBits[bi] : 0;
        bi += 1;
        m[row][c] = ((row + c) % 2 === 0) ? bit ^ 1 : bit;   // النمط 0
      }
    }
    up = !up;
  }
  return m;
}

export { buildQrMatrix };
