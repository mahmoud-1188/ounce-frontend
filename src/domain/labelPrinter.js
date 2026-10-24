import { C128, DEFAULT_PRINTER, M830, PRINTER_SERVICES, QR_EXP } from "../core/constants.js";
import { fmtMoney, fmtW } from "../core/money.js";
import { buildPlateEpc } from "./buildPlateEpc.js";
import { key } from "./key.js";

// ═══════════════════════════════════════════════════════════════
//  طابعة الملصقات كما في المصدر الأخير: بلوتوث وحده، والرقاقة تُكتب مع كل
//  ملصق بأمر Zebra الموثّق، والفجوة ثابتة. منقولةٌ من المصدر كما هي —
//  والفرق الوحيد epcHex: رقم الرقاقة المحفوظ على القطعة لرمزٍ أطول من لوحة التعريف.
// ═══════════════════════════════════════════════════════════════

// الفجوة بين الملصقات ثابتة 3 مم ولا تُعدَّل من أي شاشة
const LABEL_GAP_MM = 3;

// النسخ حتى 10 لرمز الفاتورة الضريبي (ISO 18004 الجداول 1 و9 وE.1):
// [الحجم، سعة البايتات، كلمات البيانات، تصحيح كل بلوك، [[عدد البلوكات، بيانات البلوك]]]
const QR_VER_BIG = {
  1: [21, 17, 19, 7, [[1, 19]]], 2: [25, 32, 34, 10, [[1, 34]]], 3: [29, 53, 55, 15, [[1, 55]]], 4: [33, 78, 80, 20, [[1, 80]]],
  5: [37, 106, 108, 26, [[1, 108]]], 6: [41, 134, 136, 18, [[2, 68]]], 7: [45, 154, 156, 20, [[2, 78]]],
  8: [49, 192, 194, 24, [[2, 97]]], 9: [53, 230, 232, 30, [[2, 116]]], 10: [57, 271, 274, 18, [[2, 68], [2, 69]]],
};

const QR_ALIGN = { 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

const QR_VERSION_INFO = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3 };

// صيغ المعايرة تختلف بين الطابعات والأمر غير المفهوم يُبتلع بصمت، فالمستخدم يجرّب وتُحفظ الناجحة
const CALIBRATE_MODES = [
  { id: "autodetect", label: "① AUTODETECT", hint: "✓ مُجرَّبة على Gainscha GA-3406T",
    cmd: ["AUTODETECT"] },
  { id: "gapdetect", label: "② GAPDETECT", hint: "المعياريّة في TSPL — لم تعمل على GA-3406T",
    cmd: ["GAPDETECT"] },
  { id: "setgap", label: "③ SET GAP AUTO", hint: "صيغةٌ أقدم",
    cmd: ["SET GAP AUTO"] },
  { id: "formfeed", label: "④ تغذيةٌ واحدة", hint: "تختبر أن الطابعة تستقبل أصلًا",
    cmd: ["FORMFEED"] },
];

function codeToEpcHex(code) {
  const bytes = new Uint8Array(12);
  const src = String(code || "").toUpperCase();
  for (let i = 0; i < 12; i++) bytes[i] = i < src.length ? src.charCodeAt(i) & 0xff : 0;
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// الإعداد الفعلي للطباعة: الافتراضي ثم المحفوظ ثم الثوابت (الفجوة والرقاقة والبلوتوث)
// الملصقات مباشرة على الطابعة بلا نافذة طباعة ولا PDF، والفواتير عبر printSaleInvoice
function labelPrinterCfg(cfg) {
  return { ...DEFAULT_PRINTER, ...(cfg || {}), gapMm: LABEL_GAP_MM, rfid: true, rfidVerified: true, mode: "bluetooth", transport: "bluetooth" };
}

// يُبقي كل عنصر داخل الملصق بالقصّ لا بالتصغير، والرسّام والمحرّر يشتركان فيه فيتطابقان
function fitLayout(L, W, H) {
  const out = {};
  for (const [k, e] of Object.entries(L || {})) {
    if (!e || typeof e !== "object") { out[k] = e; continue; }
    const w = Math.min(Number(e.w) || 0, W), h = Math.min(Number(e.h) || 0, H);
    out[k] = { ...e, w, h,
      x: Math.max(0, Math.min(Number(e.x) || 0, W - w)),
      y: Math.max(0, Math.min(Number(e.y) || 0, H - h)) };
  }
  return out;
}

function renderLabelCanvas({ item, code, cfg, currency, price24, logoImg }) {
  // الدقة تُعاير بـ«اطبع مسطرة»، فبعض الطرازات 300 لا 203 والفرق يغيّر مقاس الملصق
  const dpi = Number(cfg.dpi) || 203;
  const mm = (v) => Math.round((Number(v) || 0) / 25.4 * dpi);
  const W = mm(cfg.labelWidthMm || 50);
  const H = mm(cfg.labelHeightMm || 20);
  const L = { ...DEFAULT_PRINTER.layout, ...(cfg.layout || {}) };
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#000";
  // x من الحافة اليمنى، فإحداثي الكانفس = العرض - x - عرض العنصر
  const lw = Number(cfg.labelWidthMm) || 50, lh = Number(cfg.labelHeightMm) || 20;
  const FL = fitLayout(L, lw, lh);
  for (const key of Object.keys(FL)) L[key] = FL[key];
  const k = 1;
  const rect = (el) => ({
    x: W - mm((el.x || 0) * k) - mm((el.w || 0) * k), y: mm((el.y || 0) * k),
    w: mm((el.w || 0) * k), h: mm((el.h || 0) * k),
  });

  const fitText = (text, el, align) => {
    if (!el?.show || !text) return;
    const r = rect(el);
    let px = Math.floor(r.h * 0.82);
    g.textBaseline = "middle";
    for (let k = 0; k < 24; k++) {
      g.font = `bold ${px}px Cairo, Tajawal, "Noto Sans Arabic", sans-serif`;
      if (g.measureText(String(text)).width <= r.w || px <= 6) break;
      px -= 1;
    }
    g.direction = /[\u0600-\u06FF]/.test(String(text)) ? "rtl" : "ltr";
    if (align === "center") { g.textAlign = "center"; g.fillText(String(text), r.x + r.w / 2, r.y + r.h / 2); }
    else { g.textAlign = "right"; g.fillText(String(text), r.x + r.w, r.y + r.h / 2); }
  };

  if (L.logo?.show && logoImg) {
    const r = rect(L.logo);
    const ratio = logoImg.width / logoImg.height;
    let w = r.w, h = Math.round(r.w / ratio);
    if (h > r.h) { h = r.h; w = Math.round(r.h * ratio); }
    g.drawImage(logoImg, r.x + Math.round((r.w - w) / 2), r.y + Math.round((r.h - h) / 2), w, h);
  }
  fitText(String(item?.description || "").slice(0, 30), L.desc);
  if (item?.karat) fitText(`K ${item.karat}`, L.karat);
  // ملصق الصنف بالعدد يحمل عدد قطعه: «W 1.250 x20» عشرون قطعة كلٌّ بوزنه
  if (item?.weight) fitText(`W ${fmtW(item.weight)}${Number(item.labelCount) > 1 ? ` x${Number(item.labelCount)}` : ""}`, L.weight);
  if (price24 && item?.weight && item?.karat) {
    const p = item.weight * item.karat / 24 * price24 + (Number(item.workmanshipPerUnit) || 0);
    fitText(`${currency}${fmtMoney(Math.round(p))}`, L.price);
  }
  const theCode = String(code || item?.ref || "");
  const useQr = cfg.symbology === "qr";
  if (useQr && L.qr?.show) {
    const r = rect(L.qr);
    // QR يُزاح للداخل عند الحافة، فرمز ناقص زاوية لا يُقرأ
    const size = Math.min(r.w, r.h, W, H);
    drawQr(g, theCode, Math.max(0, Math.min(r.x, W - size)), Math.max(0, Math.min(r.y, H - size)), size);
  }
  if (!useQr && L.barcode?.show) {
    const r = rect(L.barcode);
    g.fillStyle = "#000";
    drawCode128(g, theCode, r.x, r.y, r.w, r.h);
  }
  g.fillStyle = "#000";
  if (L.code?.show) {
    const r = rect(L.code);
    let px = Math.floor(r.h * 0.9);
    for (let k = 0; k < 20; k++) { g.font = `${px}px monospace`; if (g.measureText(theCode).width <= r.w || px <= 6) break; px -= 1; }
    g.textAlign = "center"; g.direction = "ltr"; g.textBaseline = "middle";
    g.fillText(theCode, r.x + r.w / 2, r.y + r.h / 2);
  }
  return c;
}

const qrMul = (a, b) => (a === 0 || b === 0 ? 0 : QR_EXP.e[QR_EXP.l[a] + QR_EXP.l[b]]);

function qrRS(data, ecLen) {
  let poly = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) { next[j] ^= qrMul(poly[j], QR_EXP.e[i]); next[j + 1] ^= poly[j]; }
    poly = next;
  }
  // المولّد يُبنى من الدرجة الدنيا (poly[k] معامل x^k) والقسمة تقرؤه من العليا، لذلك يُقلب
  poly.reverse();
  const res = new Array(ecLen).fill(0);
  for (const d of data) {
    const f = d ^ res[0];
    res.shift(); res.push(0);
    if (f !== 0) for (let j = 0; j < ecLen; j++) res[j] ^= qrMul(poly[j + 1], f);
  }
  return res;
}

function qrMatrix(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text || "")));
  let ver = 1;
  while (ver < 10 && bytes.length > QR_VER_BIG[ver][1]) ver += 1;
  const [size, , dataWords, ecLen, blocks] = QR_VER_BIG[ver];
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
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const on = r >= 0 && r <= 6 && c >= 0 && c <= 6
        && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      put(r0 + r, c0 + c, on ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { put(6, i, i % 2 === 0 ? 1 : 0); put(i, 6, i % 2 === 0 ? 1 : 0); }
  put(size - 8, 8, 1);                                  // الوحدة الداكنة
  if (ver >= 2) {
    const pos = QR_ALIGN[ver], last = pos.length - 1;
    pos.forEach((pr, i) => pos.forEach((pc, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++)
        put(pr + r, pc + c, Math.max(Math.abs(r), Math.abs(c)) !== 1 ? 1 : 0);
    }));
  }
  if (ver >= 7) {
    const vi = QR_VERSION_INFO[ver];
    for (let i = 0; i < 18; i++) {
      const bit = (vi >> i) & 1, a = size - 11 + (i % 3), b = Math.floor(i / 3);
      put(b, a, bit); put(a, b, bit);
    }
  }
  for (let i = 0; i < 9; i++) { if (m[8][i] === null) put(8, i, 0); if (m[i][8] === null) put(i, 8, 0); }
  for (let i = 0; i < 8; i++) { if (m[8][size - 1 - i] === null) put(8, size - 1 - i, 0); if (m[size - 1 - i][8] === null) put(size - 1 - i, 8, 0); }
  let bitI = 0;
  const dataBits = [];
  for (const w of all) for (let i = 7; i >= 0; i--) dataBits.push((w >> i) & 1);
  const dataCells = [];
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
  // القناع يُختار من ثمانية بعقوبات ISO 18004 (7.8.3)، فالقناع الثابت قد يُنتج رمزًا لا يُفكّ
  const MASKS = [
    (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];
  // معلومات الصيغة: L = 01 ثم رقم القناع، ثم BCH(15,5) وXOR مع 0x5412 بمواضع المعيار
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
      // جزاء الأقنعة الأوّل: خمس وحداتٍ متتالية فأكثر من لونٍ واحد
      let run = 1;
      for (let k = 1; k <= size; k++) {
        if (k < size && ln[k] === ln[k - 1]) run += 1;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      // الثالث: نمطٌ يشبه الكاشف 1011101 بجانبه أربع وحداتٍ بيضاء
      const str = ln.join("");
      for (const pat of ["10111010000", "00001011101"]) {
        let at = str.indexOf(pat);
        while (at !== -1) { p += 40; at = str.indexOf(pat, at + 1); }
      }
    }
    // الثاني: كتل 2×2 من لونٍ واحد
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
      const v = g[r][c];
      if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) p += 3;
    }
    // الرابع: نسبة الداكن
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

function drawQr(g, text, x, y, size) {
  const m = qrMatrix(text);
  const n = m.length;
  const quiet = 2;
  const unit = Math.max(1, Math.floor(size / (n + quiet * 2)));
  const total = unit * (n + quiet * 2);
  const ox = x + Math.floor((size - total) / 2), oy = y + Math.floor((size - total) / 2);
  g.fillStyle = "#fff"; g.fillRect(ox, oy, total, total);
  g.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (m[r][c]) g.fillRect(ox + (c + quiet) * unit, oy + (r + quiet) * unit, unit, unit);
}

function drawCode128(g, text, x, y, w, h) {
  const t = String(text || "").replace(/[^\x20-\x7e]/g, "");
  if (!t) return;
  // رمز البدء للمجموعة B هو 104
  const codes = [104];
  let sum = 104;
  for (let i = 0; i < t.length; i++) {
    const v = t.charCodeAt(i) - 32;
    codes.push(v); sum += v * (i + 1);
  }
  codes.push(sum % 103);
  codes.push(106);                                   // رمز الإيقاف
  const pattern = codes.map((c) => C128[c]).join("");
  const modules = pattern.split("").reduce((a, ch) => a + Number(ch), 0);
  const unit = Math.max(1, Math.floor(w / modules));
  const total = unit * modules;
  let cx = x + Math.floor((w - total) / 2);
  let dark = true;
  g.fillStyle = "#000";
  for (const ch of pattern) {
    const n = Number(ch) * unit;
    if (dark) g.fillRect(cx, y, n, h);
    cx += n; dark = !dark;
  }
}

// استعلامات TSPL: ~!@ النسخة والطراز، ~!I صفحة الترميز، ~!F الذاكرة الحرة، ~!T نوع الرأس
// الجواب يصل على خاصية notify إن وُجدت
async function askPrinter(cfg, deviceRef, { timeoutMs = 2500 } = {}) {
  if (!deviceRef?.current) throw new Error("لا طابعة مقترنة");
  const server = await deviceRef.current.gatt.connect();
  const services = await server.getPrimaryServices();
  let writeChar = null, notifyChar = null;
  for (const svc of services) {
    for (const c of await svc.getCharacteristics()) {
      if (!writeChar && (c.properties.write || c.properties.writeWithoutResponse)) writeChar = c;
      // خاصية الإشعار قد تكون غير خاصية الكتابة، فبعض الطابعات تفصلهما
      if (!notifyChar && (c.properties.notify || c.properties.indicate)) notifyChar = c;
    }
  }
  if (!writeChar) throw new Error("الطابعة لا تعرض خاصية كتابة");
  if (!notifyChar) {
    return { supported: false,
      reason: "هذه الطابعة لا تُرجع جوابًا عبر البلوتوث — تكتب ولا تقرأ. جرّب USB أو اقرأ الطراز من ملصق الجهاز." };
  }
  const chunks = [];
  const onData = (e) => {
    const v = e.target.value;
    chunks.push(new Uint8Array(v.buffer ? v.buffer : v));
  };
  await notifyChar.startNotifications();
  notifyChar.addEventListener("characteristicvaluechanged", onData);
  try {
    await bleWriteChunked(writeChar, new TextEncoder().encode("~!@\r\n~!I\r\n~!F\r\n~!T\r\n"));
    await new Promise((r) => setTimeout(r, timeoutMs));
  } finally {
    notifyChar.removeEventListener("characteristicvaluechanged", onData);
    try { await notifyChar.stopNotifications(); } catch (e) { /* فشل الإيقاف لا يهمّ */ }
  }
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const all = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(all).replace(/\0+/g, "").trim();
  // MODEL: هو الحقل الموثوق، فبقية الأرقام ذاكرة حرة تتغيّر بين قراءة وأخرى
  const modelLine = (text.match(/MODEL\s*:\s*([^\s\r\n]+)/i) || [])[1] || null;
  const model = modelLine || (text.match(/[A-Z]{2,}[-_]?[A-Z]?\d{3,4}[A-Z]{0,3}/) || [])[0] || null;
  return {
    supported: true, bytes: total, text, model,
    mentionsRfid: /rfid/i.test(text),
    oem: /gainscha/i.test(text) ? "Gainscha" : /tsc/i.test(text) ? "TSC" : null,
  };
}

// الافتراضي autodetect كما في الإعدادات، وإلا أرسلت الدالة غير ما تعرضه الشاشة
// GAP خاطئ (صفر أو أكبر من الفجوة الحقيقية) يجعل الطابعة تسحب الورق بلا توقف
function tsplCalibrateBytes({ widthMm, heightMm, gapMm, offsetMm = 0, shiftDots = 0, mode = "autodetect" }) {
  // كل رقم يُحصر في مداه: قيمة نصية أو سالبة تعلّق الطابعة، والمعايرة تحرّك الورق بلا صورة توقفه
  const num = (v, def, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
  };
  const w = num(widthMm, 50, 5, 200);
  const h = num(heightMm, 20, 5, 200);
  // الفجوة 1 مم على الأقل: GAP 0 تعني ورقًا متصلًا فتسحب المعايرة بلا نهاية
  const g = num(gapMm, 2, 1, 20);
  const lines = [
    `SIZE ${w} mm, ${h} mm`,
    `GAP ${g} mm, 0 mm`,
    // الإزاحة قبل أمر القياس، وبعده تُنسى مع إعادة الضبط
    `OFFSET ${num(offsetMm, 0, -10, 10)} mm`,
    `SHIFT ${Math.round(num(shiftDots, 0, -120, 120))}`,
    `SET TEAR ON`,
    // بلا HOME بعدها، فهو يسحب الورق قبل انتهاء القياس
    ...((CALIBRATE_MODES.find((m) => m.id === mode) || CALIBRATE_MODES[0]).cmd),
  ];
  return new TextEncoder().encode(lines.join("\r\n") + "\r\n");
}

// منفصلة عن المعايرة عمدًا: ضبط الإزاحة يُعاد مرارًا، والمعايرة تسحب ورقتين كل مرة
function tsplOffsetBytes({ widthMm, heightMm, gapMm, offsetMm = 0, shiftDots = 0 }) {
  const num = (v, def, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
  };
  const lines = [
    `SIZE ${num(widthMm, 50, 5, 200)} mm, ${num(heightMm, 20, 5, 200)} mm`,
    `GAP ${num(gapMm, 2, 0, 20)} mm, 0 mm`,
    // OFFSET بالمليمتر: الموجب يُخرج الورقة أكثر بعد الطباعة والسالب يُرجعها
    `OFFSET ${num(offsetMm, 0, -10, 10)} mm`,
    `SHIFT ${Math.round(num(shiftDots, 0, -120, 120))}`,
  ];
  return new TextEncoder().encode(lines.join("\r\n") + "\r\n");
}

// ZPL للملصق لأن أوامر RFID بـTSPL غير موثّقة لهذه الطابعة، والمعايرة TSPL AUTODETECT منفصلة
// الصورة والرقاقة في ^XA…^XZ واحدة، فـ^XZ تعني اطبع هذا الملصق
const mmToDots = (mm, dpi) => Math.round((Number(mm) || 0) * (Number(dpi) || 300) / 25.4);

// رسم ZPL ^GFA: البت 1 = أسود. يُبنى من البكسلات مباشرة لا من صورة TSPL التي قد تُعكس قطبيتها
function canvasToZplGraphic(c, threshold = 160) {
  const W = c.width, H = c.height;
  const d = c.getContext("2d").getImageData(0, 0, W, H).data;
  const rowBytes = Math.ceil(W / 8);
  const hex = [];
  for (let y = 0; y < H; y++) {
    for (let bx = 0; bx < rowBytes; bx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = bx * 8 + bit;
        if (x >= W) continue;
        const i = (y * W + x) * 4;
        // الشفاف أبيض، وإلا طُبع ما لم يُرسم عليه كتلة سوداء
        const a = d[i + 3];
        const lum = a < 128 ? 255 : (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        if (lum < threshold) byte |= (0x80 >> bit);
      }
      hex.push(byte.toString(16).padStart(2, "0").toUpperCase());
    }
  }
  const total = rowBytes * H;
  return { total, rowBytes, data: hex.join(""), W, H };
}

// أوامر دليل Zebra فقط: السرعة والكثافة وإزاحة التوقف تبقى من ضبط الطابعة نفسها
function labelJobBytes({ canvas, cfg, code = "", copies = 1, epcHex = null }) {
  const dpi = Number(cfg.dpi) || 300;
  const w = mmToDots(cfg.labelWidthMm || 50, dpi);
  const h = mmToDots(cfg.labelHeightMm || 20, dpi);
  const g = canvasToZplGraphic(canvas);

  // الرقاقة فقط بعد تأكيد كتابتها، ففشلها يُبطل الملصق وتحاول الطابعة على التالي
  // epcHex: رقم القطعة المحفوظ عليها (رمزٌ لا يتّسع للوحة) — وإلا لوحة التعريف
  const hex = cfg.rfid && cfg.rfidVerified && code
    ? (epcHex || buildPlateEpc({ code, storeId: cfg.storeId || 0 })) : null;

  const shift = Math.max(-120, Math.min(120, Math.round(Number(cfg.labelShiftDots) || 0)));

  const L = [
    "^XA",
    `^PW${w}`,                      // عرض الطباعة بالنقاط
    `^LL${h}`,                      // طول الملصق بالنقاط
    "^LH0,0",
    // direction 1 يقابل ^POI (قلب 180 درجة)، فـZPL بلا ^PO تطبع مقلوبة عن الاتجاه المعتاد
    Number(cfg.direction ?? 1) === 1 ? "^POI" : "^PON",
    ...(shift ? [`^LT${shift}`] : []),
  ];
  if (hex) {
    L.push(
      "^RS8",                                   // نوع الرقاقة Gen2، كمثال Zebra الرسمي
      // كلمة PC صراحةً في البلوك 1 من بنك EPC (3000 = ست كلمات = 96 بت)
      // بدونها قد يبقى طول المصنع فيقرأ القارئ بايتات من خارج الرمز
      `^RFW,H,1,2,1^FD${M830.pcWord}^FS`,
      // الرمز في البلوك 2 من بنك EPC، 12 بايتًا بصيغة مثال Zebra ^RFW,H,3,4,1
      `^RFW,H,2,${M830.epcBytes},1^FD${hex}^FS`,
    );
  }
  L.push(
    `^FO0,0^GFA,${g.total},${g.total},${g.rowBytes},${g.data}^FS`,
    // نسخة واحدة مع الرقاقة، فنسختان ملصقان بالرمز نفسه
    `^PQ${hex ? 1 : Math.max(1, Math.min(99, Number(copies) || 1))}`,
    "^XZ",
  );
  return new TextEncoder().encode(L.join("\r\n") + "\r\n");
}

// يُخرج ملصقًا فارغًا برقاقته، فلا صيغة ZPL موثّقة تكتب الرقاقة بلا تقديم ورقة
function rfidTestBytes({ cfg, code = "TESTRFID" }) {
  const dpi = Number(cfg.dpi) || 300;
  const hex = buildPlateEpc({ code, storeId: cfg.storeId || 0 });
  const L = [
    "^XA",
    `^PW${mmToDots(cfg.labelWidthMm || 50, dpi)}`,
    `^LL${mmToDots(cfg.labelHeightMm || 20, dpi)}`,
    "^RS8",
    `^RFW,H,1,2,1^FD${M830.pcWord}^FS`,
    `^RFW,H,2,${M830.epcBytes},1^FD${hex}^FS`,
    "^PQ1",
    "^XZ",
  ];
  return new TextEncoder().encode(L.join("\r\n") + "\r\n");
}

// حزمة BLE تختلف بالجهاز (من 512 إلى 20)، وفشلها GATT operation failed لا يذكر الحجم
// فنبدأ بـ180 وننزل عند الفشل إلى 100 ثم 20
async function bleWriteChunked(characteristic, bytes, chunk = 180) {
  // الكتابة بردّ أولًا: بلا ردّ يعني النجاح أن البايتات خرجت من الجهاز لا أنها وصلت الطابعة
  const useAck = !!characteristic.properties.write;
  const write = async (part) => (useAck
    ? characteristic.writeValue(part)
    : characteristic.writeValueWithoutResponse(part));

  const sizes = [chunk, 100, 20].filter((v, i, a) => v > 0 && a.indexOf(v) === i);
  let lastErr = null;
  for (const size of sizes) {
    // sent يمنع الإعادة بعد إرسال جزئي، فالطابعة تنفّذ ما وصل وتُخرج ملصقات زائدة
    // الإعادة بحزمة أصغر آمنة فقط إن فشلت الحزمة الأولى
    let sent = 0;
    try {
      for (let i = 0; i < bytes.length; i += size) {
        await write(bytes.slice(i, i + size));
        sent += 1;
        // الطابعة تُهمل ما يصل وهي تكتب الذاكرة، والحزمة الأصغر تحتاج مهلة أقل
        if (i + size < bytes.length) {
          await new Promise((r) => setTimeout(r, size > 100 ? 12 : 8));
        }
      }
      return { chunk: size };
    } catch (e) {
      lastErr = e;
      if (/NotAllowed|SecurityError|disconnect|منقطع/i.test(String(e?.message || e))) throw e;
      if (sent > 0) {
        throw new Error(`${String(e?.message || e)} — وصل ${sent} جزءًا من المهمّة، `
          + "فلم تُعَد لئلّا تتكرّر الملصقات. أعد الطباعة يدويًّا.");
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw lastErr || new Error("تعذّر الإرسال للطابعة");
}

async function usbPrint(bytes, cfg, remember) {
  if (!navigator.usb) throw new Error("WebUSB غير مدعوم — استعمل كروم على الحاسب أو أندرويد");
  let dev = (await navigator.usb.getDevices()).find((d) => !cfg.usbSerial || d.serialNumber === cfg.usbSerial);
  if (!dev) {
    // بلا فلتر مورّد لأن Urovo تُصدر طرازاتها بمعرّفات مختلفة
    dev = await navigator.usb.requestDevice({ filters: [{ classCode: 7 }, {}] });
    remember?.(dev.serialNumber || "");
  }
  await dev.open();
  if (dev.configuration === null) await dev.selectConfiguration(1);
  let ifaceNum = null, epOut = null;
  for (const iface of dev.configuration.interfaces) {
    const alt = iface.alternates[0];
    const out = alt.endpoints.find((e) => e.direction === "out");
    if (out && (alt.interfaceClass === 7 || epOut === null)) { ifaceNum = iface.interfaceNumber; epOut = out.endpointNumber; if (alt.interfaceClass === 7) break; }
  }
  if (epOut === null) throw new Error("لا منفذ إخراج في الطابعة");
  await dev.claimInterface(ifaceNum);
  try {
    const chunk = 4096;
    for (let i = 0; i < bytes.length; i += chunk) await dev.transferOut(epOut, bytes.slice(i, i + chunk));
  } finally {
    try { await dev.releaseInterface(ifaceNum); await dev.close(); } catch (e) { /* مغلقة أصلًا */ }
  }
}

const btSupported = () =>
  typeof navigator !== "undefined" && !!navigator.bluetooth && typeof navigator.bluetooth.requestDevice === "function";

// مسار الإرسال الوحيد للطباعة والمعايرة والصيانة، بإعادة عند الانقطاع اللحظي
// يُعاد خطأ الاتصال فقط، لا غياب خاصية الكتابة ولا الإرسال الجزئي
async function sendRawToPrinter(bytes, cfg, deviceRef, onRemember, { retries = 2 } = {}) {
  if (cfg.transport === "usb") {
    await usbPrint(bytes, cfg, onRemember);
    return { transport: "usb", bytes: bytes.length };
  }
  if (!deviceRef?.current) throw new Error("لا طابعة بلوتوث مقترنة — اضغط «اقتران»");

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // gatt.connect في كل محاولة: رخيص على اتصال قائم ويُصلح المنقطع
      const server = await deviceRef.current.gatt.connect();
      const services = await server.getPrimaryServices();

      // خدمات الطابعات المعروفة أولًا: البطارية ومعلومات الجهاز تقبل الكتابة وتبتلع البايتات بصمت
      const known = new Set(PRINTER_SERVICES.map((u) => u.toLowerCase()));
      const ordered = [
        ...services.filter((s2) => known.has(String(s2.uuid).toLowerCase())),
        ...services.filter((s2) => !known.has(String(s2.uuid).toLowerCase())),
      ];
      let target = null, usedSvc = "";
      for (const svc of ordered) {
        const chars = await svc.getCharacteristics();
        const withAck = chars.find((c) => c.properties.write);
        const noAck = chars.find((c) => c.properties.writeWithoutResponse);
        target = withAck || noAck;
        if (target) { usedSvc = String(svc.uuid); break; }
      }
      if (!target) throw new Error("الطابعة لا تعرض خاصية كتابة");
      const w = await bleWriteChunked(target, bytes);
      return { transport: "bluetooth", bytes: bytes.length, attempts: attempt + 1,
        service: usedSvc, ack: !!target.properties.write, chunk: w?.chunk };
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (/لا تعرض خاصية كتابة|NotAllowed|SecurityError/i.test(msg)) throw e;
      // نص الخطأ «وصل N جزءًا» من bleWriteChunked يعني إرسالًا جزئيًا، وإعادته تُخرج ملصقات فارغة
      if (/وصل \d+ جزءًا/.test(msg)) throw e;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw new Error(`${String(lastErr?.message || lastErr)} — بعد ${retries + 1} محاولات`);
}

async function printLabelToDevice({ item, code, cfg: cfgIn, currency, price24, deviceRef, onRemember, epcHex = null }) {
  const cfg = labelPrinterCfg(cfgIn);
  const lang = "tspl";
  let bytes;
  {
    let logoImg = null;
    if (cfg.showLogo && cfg.customLogo) {
      logoImg = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = cfg.customLogo; });
    }
    // ننتظر الخطوط العربية قبل الرسم وإلا رُسم النص بخط بديل
    try { await document.fonts?.ready; } catch (e) { /* نرسم بالخط المتاح */ }
    const canvas = renderLabelCanvas({ item, code, cfg, currency, price24, logoImg });
    bytes = labelJobBytes({ canvas, cfg, copies: cfg.copies || 1, code, epcHex });
  }
  const r = await sendRawToPrinter(bytes, cfg, deviceRef, onRemember);
  // رقاقة مصنعية تُقرأ في البيع برقم لا يعرفه النظام، فلا يمرّ ملصق بلا رقاقة بصمت
  const rfidSkipped = !!(cfg.rfid && !cfg.rfidVerified && code);
  return { lang, ...r, rfidSkipped, rfidWritten: !!(cfg.rfid && cfg.rfidVerified && code) };

}

export { fitLayout, CALIBRATE_MODES, LABEL_GAP_MM, QR_ALIGN, QR_VERSION_INFO, QR_VER_BIG, askPrinter, bleWriteChunked, btSupported, canvasToZplGraphic, codeToEpcHex, labelJobBytes, labelPrinterCfg, mmToDots, printLabelToDevice, renderLabelCanvas, rfidTestBytes, sendRawToPrinter, tsplCalibrateBytes, tsplOffsetBytes, usbPrint };
