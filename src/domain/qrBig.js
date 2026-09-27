// رمز QR حتى النسخة 10 (مستوى L · ISO 18004) — لرمز الفاتورة الضريبية (المرجع 5.2.0).
// الترميز القديم في helpers.js يقف عند النسخة 4 (78 بايتًا) ولا يسع رمز الهيئة.
const QR_EXP = (() => { const e = new Uint8Array(512), l = new Uint8Array(256); let x = 1;
  for (let i = 0; i < 255; i++) { e[i] = x; l[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) e[i] = e[i - 255];
  return { e, l }; })();

const QR_VER_BIG = {
  1: [21, 17, 19, 7, [[1, 19]]], 2: [25, 32, 34, 10, [[1, 34]]], 3: [29, 53, 55, 15, [[1, 55]]], 4: [33, 78, 80, 20, [[1, 80]]],
  5: [37, 106, 108, 26, [[1, 108]]], 6: [41, 134, 136, 18, [[2, 68]]], 7: [45, 154, 156, 20, [[2, 78]]],
  8: [49, 192, 194, 24, [[2, 97]]], 9: [53, 230, 232, 30, [[2, 116]]], 10: [57, 271, 274, 18, [[2, 68], [2, 69]]],
};

const QR_ALIGN = { 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

const QR_VERSION_INFO = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3 };

const qrMul = (a, b) => (a === 0 || b === 0 ? 0 : QR_EXP.e[QR_EXP.l[a] + QR_EXP.l[b]]);

function qrRS(data, ecLen) {
  let poly = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) { next[j] ^= qrMul(poly[j], QR_EXP.e[i]); next[j + 1] ^= poly[j]; }
    poly = next;
  }
  // تنبيه: المولِّد يُبنى من الدرجة الدنيا صعودًا (poly[k] معاملُ x^k)،
  //   والقسمة أدناه تقرؤه من العليا (poly[0] = 1). فكانت كلمات التصحيح
  //   خاطئةً كلّها — والقارئ يرى رمزًا تالفًا لا يُصلَح. قُلب ليطابق القسمة؛
  //   وقورن بمرجع Reed–Solomon على GF(256)/0x11D.
  poly.reverse();
  const res = new Array(ecLen).fill(0);
  for (const d of data) {
    const f = d ^ res[0];
    res.shift(); res.push(0);
    if (f !== 0) for (let j = 0; j < ecLen; j++) res[j] ^= qrMul(poly[j + 1], f);
  }
  return res;
}

function qrMatrixBig(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text || "")));
  let ver = 1;
  while (ver < 10 && bytes.length > QR_VER_BIG[ver][1]) ver += 1;
  const [size, , dataWords, ecLen, blocks] = QR_VER_BIG[ver];
  // البتات: وضع 0100، الطول (8 بت حتى النسخة 9، و16 من العاشرة)، البيانات، ثم 0000 والحشو
  const bits = [];
  const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  push(4, 4); push(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const totalData = dataWords;
  push(0, Math.min(4, totalData * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const words = [];
  for (let i = 0; i < bits.length; i += 8) words.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  const PAD = [0xec, 0x11];
  let pi = 0;
  while (words.length < totalData) { words.push(PAD[pi % 2]); pi += 1; }
  // البلوكات: كلٌّ بتصحيحه، ثم تُشبَّك كلمات البيانات عمودًا عمودًا ثم كلمات التصحيح
  const dataBlocks = [];
  let at = 0;
  for (const [count, len] of blocks) for (let b = 0; b < count; b++) { dataBlocks.push(words.slice(at, at + len)); at += len; }
  const ecBlocks = dataBlocks.map((d) => qrRS(d, ecLen));
  const all = [];
  const maxLen = Math.max(...dataBlocks.map((d) => d.length));
  for (let i = 0; i < maxLen; i++) for (const d of dataBlocks) if (i < d.length) all.push(d[i]);
  for (let i = 0; i < ecLen; i++) for (const e of ecBlocks) all.push(e[i]);

  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const put = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) m[r][c] = v; };
  // كواشف الموضع
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const on = r >= 0 && r <= 6 && c >= 0 && c <= 6
        && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      put(r0 + r, c0 + c, on ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  // التوقيت
  for (let i = 8; i < size - 8; i++) { put(6, i, i % 2 === 0 ? 1 : 0); put(i, 6, i % 2 === 0 ? 1 : 0); }
  put(size - 8, 8, 1);                                  // وحدة داكنة
  // أنماط المحاذاة للنسخ 2+ — كل تقاطعٍ في جدولها عدا زوايا الكواشف الثلاث
  if (ver >= 2) {
    const pos = QR_ALIGN[ver], last = pos.length - 1;
    pos.forEach((pr, i) => pos.forEach((pc, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++)
        put(pr + r, pc + c, Math.max(Math.abs(r), Math.abs(c)) !== 1 ? 1 : 0);
    }));
  }
  // معلومات النسخة (7+): 18 بتًّا في كتلتين 6×3 قرب الكاشفين العلوي الأيمن والسفلي الأيسر
  if (ver >= 7) {
    const vi = QR_VERSION_INFO[ver];
    for (let i = 0; i < 18; i++) {
      const bit = (vi >> i) & 1, a = size - 11 + (i % 3), b = Math.floor(i / 3);
      put(b, a, bit); put(a, b, bit);
    }
  }
  // حجز معلومات الشكل
  for (let i = 0; i < 9; i++) { if (m[8][i] === null) put(8, i, 0); if (m[i][8] === null) put(i, 8, 0); }
  for (let i = 0; i < 8; i++) { if (m[8][size - 1 - i] === null) put(8, size - 1 - i, 0); if (m[size - 1 - i][8] === null) put(size - 1 - i, 8, 0); }
  // البيانات بنمط الأفعى + قناع 0
  let bitI = 0;
  const dataBits = [];
  for (const w of all) for (let i = 7; i >= 0; i--) dataBits.push((w >> i) & 1);
  const dataCells = [];                                  // مواضع البيانات — للقناع
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let k = 0; k < size; k++) {
      const row = up ? size - 1 - k : k;
      for (const c of [col, col - 1]) {
        if (m[row][c] !== null) continue;
        m[row][c] = bitI < dataBits.length ? dataBits[bitI] : 0;
        bitI += 1;
        dataCells.push([row, c]);
      }
    }
    up = !up;
  }
  // تنبيه: القناع يُختار من ثمانية بعقوبات المعيار (ISO 18004 §7.8.3).
  //   كان القناع 0 ثابتًا — وبعض البيانات تُنتج معه أنماطًا تُشبه كواشف
  //   الموضع أو كتلًا متصلة، فيعجز القارئ: 5 من 300 رمزٍ عشوائيّ لم
  //   تُفكّ. والقناع الأفضل لكل رمزٍ يُزيل ذلك.
  const MASKS = [
    (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];
  // معلومات الصيغة: L = 01 + رقم القناع، ثم BCH(15,5) و`0x5412` — بمواضع المعيار
  const writeFormat = (g, mask) => {
    const fd = (1 << 3) | mask;
    let rem = fd;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
    const f = ((fd << 10) | rem) ^ 0x5412;
    const fb = (i) => (f >> i) & 1;
    for (let i = 0; i <= 5; i++) g[i][8] = fb(i);
    g[7][8] = fb(6); g[8][8] = fb(7); g[8][7] = fb(8);
    for (let i = 9; i < 15; i++) g[8][14 - i] = fb(i);
    for (let i = 0; i < 8; i++) g[8][size - 1 - i] = fb(i);
    for (let i = 8; i < 15; i++) g[size - 15 + i][8] = fb(i);
    g[size - 8][8] = 1;                                  // الوحدة الداكنة
  };
  const penalty = (g) => {
    let p = 0;
    const lines = [];
    for (let r = 0; r < size; r++) lines.push(g[r]);
    for (let c = 0; c < size; c++) lines.push(g.map((row) => row[c]));
    for (const ln of lines) {
      // N1: خمسٌ فأكثر متتالية
      let run = 1;
      for (let k = 1; k <= size; k++) {
        if (k < size && ln[k] === ln[k - 1]) run += 1;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      // N3: نمطٌ يشبه الكاشف 1011101 بجانبه أربعة بيض
      const str = ln.join("");
      for (const pat of ["10111010000", "00001011101"]) {
        let at = str.indexOf(pat);
        while (at !== -1) { p += 40; at = str.indexOf(pat, at + 1); }
      }
    }
    // N2: كتلٌ 2×2 من لونٍ واحد
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
      const v = g[r][c];
      if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) p += 3;
    }
    // N4: نسبة الداكن
    let dark = 0;
    for (const row of g) for (const v of row) dark += v;
    const total = size * size;
    p += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
  };
  const base = m.map((row) => row.map((v) => (v === null ? 0 : v)));
  let best = null, bestP = Infinity;
  for (let mk = 0; mk < 8; mk++) {
    const g = base.map((row) => row.slice());
    for (const [r, c] of dataCells) if (MASKS[mk](r, c)) g[r][c] ^= 1;
    writeFormat(g, mk);
    const pp = penalty(g);
    if (pp < bestP) { bestP = pp; best = g; }
  }
  return best;
}

function qrSvg(text, px = 132) {
  const m = qrMatrixBig(text), n = m.length, q = 2, u = px / (n + q * 2);
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) d += `M${((c + q) * u).toFixed(2)} ${((r + q) * u).toFixed(2)}h${u.toFixed(2)}v${u.toFixed(2)}h-${u.toFixed(2)}z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

export { qrMatrixBig, qrSvg };
