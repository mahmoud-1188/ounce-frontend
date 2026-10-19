import { useEffect, useState } from "react";
import { roundW } from "../core/money.js";

// ═══ الميزان: اتصالٌ واحد للتطبيق (بلوتوث BLE أو منفذ USB/COM) يبقى بين الشاشات ═══
// البروتوكول من ورقة الميزان: 9600 baud، 8N1، ASCII؛ R يقرأ · T يطرح الوعاء · Z يصفّر،
// والقراءة سطرٌ مثل «   1.000kg\r\n» = 1000 جم.

const SCALE_UNITS = { g: 1, gr: 1, gram: 1, grams: 1, kg: 1000, mg: 0.001, ct: 0.2, dwt: 1.55517384, ozt: 31.1034768, tl: 11.6638038, tola: 11.6638038 };

const SCALE_PROTOCOLS = {
  tzr: { label: "يُطلب الوزن بـR (طرح T · تصفير Z)", cmd: "R", tare: "T", zero: "Z", fixed: true },
  and: { label: "A&D", cmd: "Q\r\n", tare: "T\r\n", zero: "R\r\n" },
  sics: { label: "Mettler Toledo", cmd: "S\r\n", tare: "T\r\n", zero: "Z\r\n" },
  ohaus: { label: "Ohaus", cmd: "P\r\n", tare: "T\r\n", zero: "Z\r\n" },
  stream: { label: "يرسل الوزن وحده باستمرار", cmd: "" },
};

const SCALE_BLE_UARTS = [
  { label: "FFE0", service: "0000ffe0-0000-1000-8000-00805f9b34fb", notify: "0000ffe1-0000-1000-8000-00805f9b34fb", write: "0000ffe1-0000-1000-8000-00805f9b34fb" },
  { label: "FFF0", service: "0000fff0-0000-1000-8000-00805f9b34fb", notify: "0000fff1-0000-1000-8000-00805f9b34fb", write: "0000fff2-0000-1000-8000-00805f9b34fb" },
  { label: "Nordic UART", service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", notify: "6e400003-b5a3-f393-e0a9-e50e24dcca9e", write: "6e400002-b5a3-f393-e0a9-e50e24dcca9e" },
  { label: "ISSC", service: "49535343-fe7d-4ae5-8fa9-9fafd205e455", notify: "49535343-1e4d-4bd9-ba61-23c647249616", write: "49535343-8841-43f4-a8d4-ecbe34729bb3" },
];

const SCALE_TRANSPORTS = {
  auto: "تلقائي — البلوتوث إن توفّر وإلا المنفذ التسلسلي",
  ble: "بلوتوث (BLE)",
  serial: "منفذ تسلسلي — USB أو بلوتوث مقترن من النظام (COM)",
};

const SCALE_POLL_MS = 400;
const LS_NS = "";
const SCALE_DEVICE_PREF = "ounce_scale_device_v1";
const SCALE_AUTO_PREF = "ounce_scale_auto_v1";
const SCALE_CFG_PREF = "ounce_scale_cfg_v1";
const SCALE_DEFAULTS = { enabled: false, protocol: "tzr", baud: 9600, resolution: 0.01, transport: "auto" };

// ميزانٌ وهمي للاختبار بدل البلوتوث والمنفذ
const SCALE_TEST_FEED = { on: false, lines: [], sent: [], weight: null, tare: 0, unit: "g" };

// ver يزيد مع كل تغيّرٍ فتُعيد الشاشات رسمها
const SCALE_LINK = { state: "off", transport: "", name: "", port: "", error: "", errorAt: 0, note: "", last: null, stable: null, history: [], junk: 0, lines: 0,
  at: 0, ver: 0, gen: 0, userOff: false, cfg: { protocol: "tzr", baud: 9600, resolution: 0.01, transport: "auto" },
  io: null, buf: "", synced: false, timer: null, polls: new Set(), subs: new Set(), waiters: [] };

const btSupported = () => typeof navigator !== "undefined" && !!navigator.bluetooth;

// إعداد الميزان محلّيٌّ للجهاز (كالطابعة): كل جهازٍ يقترن بميزانه
const scaleSettings = () => {
  try { return { ...SCALE_DEFAULTS, ...(JSON.parse(localStorage.getItem(SCALE_CFG_PREF) || "null") || {}) }; } catch (e) { return { ...SCALE_DEFAULTS }; }
};
const saveScaleSettings = (cfg) => { try { localStorage.setItem(SCALE_CFG_PREF, JSON.stringify({ ...SCALE_DEFAULTS, ...(cfg || {}) })); } catch (e) { /* تخزينٌ محجوب */ } };
// الدوالّ تأخذ { scale: … } كالمرجع
const scaleSettingsWrap = () => ({ scale: scaleSettings() });

// صيغ A&D "ST,GS,+  12.345g" وMettler "S S     12.345 g" و"W: 0.012kg": الرقم بعد رأس الحالة لا أوّل رقم.
// الفاصلة فاصل آلافٍ إن تلتها نقطة وإلا عشرية. غير المستقرّ ووضع QT والوحدة المجهولة تُرفض، والسالب يطلب التصفير.
function parseScaleWeight(text) {
  const s = String(text || "").replace(/[\u0000-\u0008\u000B-\u001F]/g, " ").trim();
  const raw = s.slice(0, 64);
  if (!s) return { ok: false, why: "لا قراءة", raw };
  const up = s.toUpperCase();
  const unstable = /(^|[^A-Z])US([^A-Z]|$)/.test(up) || /(^|\s)S\s+D(\s|$)/.test(up) || /(^|[^A-Z])SD([^A-Z]|$)/.test(up) || s.includes("?");
  const stable = unstable ? false : (/(^|[^A-Z])ST([^A-Z]|$)/.test(up) || /(^|\s)S\s+S(\s|$)/.test(up) ? true : null);
  const mode = /(^|[^A-Z])NT([^A-Z]|$)/.test(up) ? "NT" : "GS";
  if (/(^|[^A-Z])QT([^A-Z]|$)/.test(up)) return { ok: false, counting: true, why: "الميزان على وضع العدّ — حوّله إلى الوزن", raw, mode };
  const re = /([-+])?\s*(\d{1,3}(?:,\d{3})+\.\d+|\d+(?:[.,]\d+)?)\s*([A-Za-z]+)?/g;
  const cands = [];
  let m;
  while ((m = re.exec(s))) {
    const num = m[2].includes(",") && m[2].includes(".") ? m[2].replace(/,/g, "") : m[2].replace(",", ".");
    const unitRaw = (m[3] || "").toLowerCase();
    cands.push({ sign: m[1] || "", value: Number(num), unit: unitRaw, known: unitRaw === "" ? null : SCALE_UNITS[unitRaw] != null });
  }
  if (!cands.length) return { ok: false, why: "لا رقم في القراءة", raw, mode, stable };
  const pick = [...cands].reverse().find((c) => c.known === true) || [...cands].reverse().find((c) => c.known === null) || cands[cands.length - 1];
  if (pick.known === false) return { ok: false, why: `وحدةٌ غير معروفة «${pick.unit}» — اضبط الميزان على الجرام`, raw, mode, stable };
  const unit = pick.unit || "g";
  let grams = roundW((Number(pick.value) || 0) * SCALE_UNITS[unit]);
  if (pick.sign === "-") grams = -grams;
  if (unstable) return { ok: false, unstable: true, grams, unit, mode, stable: false, raw, why: "الميزان لم يستقرّ — انتظر لحظة واقرأ ثانيةً" };
  if (grams < 0) return { ok: false, negative: true, grams, unit, mode, stable, raw, why: "وزنٌ سالب — صفّر الميزان (Tare) وضع القطعة" };
  if (!(grams > 0)) return { ok: false, grams, unit, mode, stable, raw, why: "الميزان يقرأ صفرًا — ضع القطعة" };
  return { ok: true, grams, unit, mode, stable, raw };
}

function stableReading(lines = [], resolution = 0.01) {
  const res = Math.max(0.0005, Number(resolution) || 0.01);
  let run = [], last = null;
  for (const ln of lines || []) {
    const p = typeof ln === "number" ? (ln > 0 ? { ok: true, grams: roundW(ln), unit: "g", mode: "GS", stable: null, raw: String(ln) } : parseScaleWeight(String(ln))) : parseScaleWeight(ln);
    last = p;
    if (!p.ok) { run = []; continue; }
    if (p.stable === true) return { ...p };
    run.push(p);
    if (run.length > 3) run.shift();
    if (run.length === 3) {
      const ws = run.map((x) => x.grams);
      if (Math.max(...ws) - Math.min(...ws) <= res + 1e-9) return { ...run[2], stable: true };
    }
  }
  return { ok: false, why: last && !last.ok ? last.why : "الوزن يتذبذب ولم يستقرّ — ثبّت الميزان وأعد القراءة", raw: last?.raw || "" };
}

const scaleAvailable = (settings) => !!settings?.scale?.enabled && typeof navigator !== "undefined"
  && (!!navigator.serial || !!SCALE_TEST_FEED.on || SCALE_LINK.state === "on" || btSupported());


const scaleProtocolOf = (settings = {}) => (SCALE_PROTOCOLS[settings?.scale?.protocol] ? settings.scale.protocol : "tzr");

function scaleLinkCfgOf(settings = {}) {
  const sc = settings?.scale || {};
  const baud = Number(sc.baud);
  return { protocol: scaleProtocolOf(settings), baud: [2400, 4800, 9600, 19200, 38400].includes(baud) ? baud : 9600,
    resolution: Number(sc.resolution) === 0.001 ? 0.001 : 0.01, transport: ["ble", "serial"].includes(sc.transport) ? sc.transport : "auto" };
}

function scaleCommandBytes(protocol, kind = "read") {
  const p = SCALE_PROTOCOLS[protocol] || {};
  const cmd = kind === "tare" ? p.tare : kind === "zero" ? p.zero : p.cmd;
  return Uint8Array.from(String(cmd || ""), (c) => c.charCodeAt(0) & 0x7f);
}

// ما قبل أوّل نهاية سطرٍ بعد الاتصال بدايةٌ مقطوعة تُسقط، وكذلك المخزن الطويل بلا نهاية سطر
function scaleChunkLines(buf = "", chunk = "", { synced = true, maxLen = 96 } = {}) {
  let s = String(buf || "") + String(chunk || "");
  let ok = synced !== false;
  const lines = [];
  for (let m = /\r\n|\r|\n/.exec(s); m; m = /\r\n|\r|\n/.exec(s)) {
    const ln = s.slice(0, m.index);
    s = s.slice(m.index + m[0].length);
    if (!ok) { ok = true; continue; }
    if (ln.trim()) lines.push(ln);
  }
  if (s.length > maxLen) return { lines, buf: "", synced: false };
  return { lines, buf: s, synced: ok };
}

// سطر ميزان الأوامر رقمٌ ووحدته وحدهما ("   1.000kg" يعني 1000 جم)، وغيره junk يُتجاهل
function scaleLineReading(line, protocol = "") {
  const s = String(line ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if ((SCALE_PROTOCOLS[protocol] || {}).fixed && !/^[+-]?\s*\d+(?:\.\d+)?\s*[A-Za-z]{1,5}$/.test(s)) {
    return { ok: false, junk: true, raw: s.slice(0, 64), why: "سطرٌ ناقص أو مشوَّش من الميزان" };
  }
  return parseScaleWeight(s);
}

function scaleStability(history = [], { resolution = 0.01, minCount = 3, minMs = 500 } = {}) {
  const h = (history || []).filter(Boolean);
  const last = h[h.length - 1];
  if (!last || !last.ok || last.flag === false) return { stable: false, n: 0, span: 0 };
  const tol = Math.max(0.0005, Number(resolution) || 0.01) + 1e-9;
  let lo = Number(last.grams), hi = lo, n = 0, since = Number(last.at) || 0;
  for (let i = h.length - 1; i >= 0; i--) {
    const x = h[i];
    if (!x.ok || x.flag === false) break;
    const g = Number(x.grams);
    if (Math.max(hi, g) - Math.min(lo, g) > tol) break;
    lo = Math.min(lo, g); hi = Math.max(hi, g); n += 1; since = Number(x.at) || 0;
  }
  const span = (Number(last.at) || 0) - since;
  const stable = last.flag === true || (n >= minCount && span >= minMs);
  return stable ? { stable: true, grams: roundW(last.grams), since, n, span } : { stable: false, n, span };
}

function scaleTransportFor({ choice = "auto", remembered = "", ble = false, serial = false } = {}) {
  if (choice === "ble") return ble ? { transport: "ble" } : { transport: null, why: "البلوتوث غير مدعوم في هذا المتصفّح — افتح التطبيق في كروم على أندرويد أو الحاسوب من رابط https، أو اختر «منفذ تسلسلي» في إعداد الميزان" };
  if (choice === "serial") return serial ? { transport: "serial" } : { transport: null, why: "المنفذ التسلسلي غير مدعوم في هذا المتصفّح (يعمل في كروم وإيدج على الحاسوب) — اختر «بلوتوث» في إعداد الميزان" };
  if (remembered === "ble" && ble) return { transport: "ble" };
  if (remembered === "serial" && serial) return { transport: "serial" };
  if (ble) return { transport: "ble" };
  if (serial) return { transport: "serial" };
  return { transport: null, why: "هذا المتصفّح لا يتّصل بالموازين (لا بلوتوث ولا منفذ تسلسلي) — افتح التطبيق في كروم أو إيدج على أندرويد أو الحاسوب، أو اكتب الوزن بيدك في الخانة" };
}

function scaleErrorText(e, transport = "") {
  if (e && typeof e.scaleWhy === "string") return e.scaleWhy;
  const name = String(e?.name || ""), msg = String(e?.message || e || "");
  if (/cancel|chooser|no port selected|no device selected/i.test(msg)) return "لم يُختر ميزان — اضغط «اتصل بالميزان» واختره من القائمة (شغّله وقرّبه من الجهاز)";
  if (/adapter|bluetooth (is )?(turned )?off/i.test(msg)) return "البلوتوث مطفأ أو غير متاح في هذا الجهاز — شغّله من إعدادات الجهاز ثم اضغط «اتصل بالميزان»";
  if (/user gesture|activation/i.test(msg)) return "اضغط «اتصل بالميزان» بنفسك — المتصفّح لا يفتح قائمة الأجهزة إلا بضغطة";
  if (name === "NotAllowedError" || name === "SecurityError" || /permission|denied|not allowed/i.test(msg)) {
    return "رُفض إذن الوصول إلى الميزان — اسمح للموقع بالبلوتوث والمنافذ من إعدادات المتصفّح (رمز القفل بجانب العنوان) ثم اضغط «اتصل بالميزان»";
  }
  if (name === "InvalidStateError" || /already open|in use|busy/i.test(msg) || (transport === "serial" && /failed to open/i.test(msg))) {
    return "منفذ الميزان مشغولٌ أو لم يُفتح — أغلق أيّ برنامجٍ أو نافذةٍ أخرى تستعمله وتأكّد أنه موصول، ثم اضغط «اتصل بالميزان»";
  }
  if (name === "NetworkError" || /gatt|disconnected|connection/i.test(msg)) return "تعذّر الاتصال بالميزان — تأكّد أنه مشغّل وقريب وغير متّصلٍ بجهازٍ آخر، ثم أعد المحاولة";
  if (name === "NotFoundError") return transport === "serial" ? "لم يُعثر على منفذ الميزان — وصّله أو اقرنه من إعدادات النظام ثم أعد المحاولة" : "لم يُعثر على الميزان — شغّله وقرّبه ثم أعد المحاولة";
  return `تعذّر الاتصال بالميزان — ${msg.slice(0, 80) || "خطأٌ غير معروف"}`;
}

const scaleTzrLine = (grams, unit = "g") => `${((unit === "kg" ? 0.001 : 1) * (Number(grams) || 0)).toFixed(3).padStart(8, " ")}${unit}\r\n`;

const scaleBytesText = (u8) => { let s = ""; for (const b of u8 || []) s += String.fromCharCode(b); return s; };

const scaleWhy = (text) => Object.assign(new Error(text || "—"), { scaleWhy: text || "" });

const scaleRememberedDevice = () => { try { return JSON.parse(localStorage.getItem(LS_NS + SCALE_DEVICE_PREF) || "null"); } catch (e) { return null; } };

const scaleRemember = (dev) => {
  try { if (dev) localStorage.setItem(LS_NS + SCALE_DEVICE_PREF, JSON.stringify(dev)); else localStorage.removeItem(LS_NS + SCALE_DEVICE_PREF); } catch (e) {}
};

const scaleAutoPref = () => { try { return localStorage.getItem(LS_NS + SCALE_AUTO_PREF) === "1"; } catch (e) { return false; } };

const setScaleAutoPref = (on) => { try { localStorage.setItem(LS_NS + SCALE_AUTO_PREF, on ? "1" : "0"); } catch (e) {} };

// نقيّة: هل يكتب الوزن التلقائي القراءة المستقرّة في الصنف الحالي؟ ولِمَ لا:
// typed وزنه مكتوبٌ باليد فلا يُمسّ · stale قراءةٌ بدأت قبل الانتقال إليه (القطعة السابقة ما زالت على الميزان) · same مكتوبةٌ فعلًا
function scaleAutoWrite({ row = null, stable = null, auto = false, on = false, ok = true, fresh = 0 } = {}) {
  if (!auto || !on || !row || !stable) return { write: false, why: "off" };
  if (!ok) return { write: false, why: "check" };
  const typed = String(row.weight ?? "") !== "" && row.weightEv?.source !== "scale";
  if (typed) return { write: false, why: "typed" };
  if ((Number(stable.since) || 0) < (Number(fresh) || 0)) return { write: false, why: "stale" };
  if (row.weightEv?.source === "scale" && Math.abs((Number(row.weight) || 0) - Number(stable.grams)) < 0.0005) return { write: false, why: "same" };
  return { write: true, why: "" };
}

const scaleSerialId = (port) => {
  try { const i = port.getInfo ? port.getInfo() : {}; return i.usbVendorId != null ? `${i.usbVendorId}:${i.usbProductId}` : i.bluetoothServiceClassId != null ? `bt:${i.bluetoothServiceClassId}` : ""; } catch (e) { return ""; }
};

const scaleSerialName = (port) => {
  try { const i = port.getInfo ? port.getInfo() : {}; return i.bluetoothServiceClassId != null ? "ميزان بلوتوث (منفذ COM)" : i.usbVendorId != null ? "ميزان USB" : "ميزان على منفذ تسلسلي"; } catch (e) { return "ميزان على منفذ تسلسلي"; }
};

function scaleLinkEmit(patch = {}) {
  Object.assign(SCALE_LINK, patch);
  SCALE_LINK.ver += 1;
  for (const f of [...SCALE_LINK.subs]) { try { f(); } catch (e) {} }
}

const scaleLinkSubscribe = (fn) => { SCALE_LINK.subs.add(fn); return () => { SCALE_LINK.subs.delete(fn); }; };

const scaleLinkConfigure = (settings) => { SCALE_LINK.cfg = scaleLinkCfgOf(settings || {}); };

const scaleLinkReading = () => {
  const st = SCALE_LINK.stable;
  return st ? { ok: true, stable: true, grams: st.grams, unit: st.unit, mode: st.mode, raw: st.raw, port: SCALE_LINK.port } : null;
};

function scaleLinkWhyNot() {
  const L = SCALE_LINK;
  if (L.state !== "on") return "الميزان غير متّصل — اضغط «اتصل بالميزان»";
  if (!L.lines) return "لا تصل قراءاتٌ من الميزان — تأكّد من «نوع الميزان» و«سرعة المنفذ» في إعداد الميزان";
  if (!L.last) return "تصل بياناتٌ غير مفهومة — تأكّد من «سرعة المنفذ» و«نوع الميزان» في إعداد الميزان";
  if (!L.last.ok) return L.last.why || "قراءةٌ غير صالحة من الميزان";
  return "الوزن يتذبذب ولم يستقرّ — ثبّت القطعة وانتظر لحظة";
}

function scaleLinkFeed(text) {
  const L = SCALE_LINK;
  const out = scaleChunkLines(L.buf, text, { synced: L.synced });
  L.buf = out.buf;
  L.synced = out.synced;
  if (!out.lines.length) return 0;
  const now = Date.now();
  let history = L.history, last = L.last, junk = L.junk;
  for (const ln of out.lines) {
    const r = scaleLineReading(ln, L.cfg.protocol);
    if (r.junk) { junk += 1; continue; }
    last = { ...r, at: now };
    history = [...history.slice(-29), { ok: !!r.ok, grams: r.ok ? r.grams : 0, at: now, flag: r.stable ?? null }];
  }
  const st = scaleStability(history, { resolution: L.cfg.resolution });
  const stable = st.stable ? { grams: st.grams, since: st.since, at: now, raw: last?.raw || "", unit: last?.unit || "g", mode: last?.mode || "GS" } : null;
  scaleLinkEmit({ history, last, junk, stable, lines: L.lines + out.lines.length });
  if (stable && L.waiters.length) { const ws = L.waiters; L.waiters = []; ws.forEach((w) => w.resolve(scaleLinkReading())); }
  return out.lines.length;
}

// الأوامر بالتتابع، وطلب الوزن يُترك إن سبقه أمرٌ لم يُكتب. الطرح والتصفير يبدآن الاستقرار من جديد
function scaleLinkSend(kind = "read") {
  const L = SCALE_LINK, io = L.io;
  const bytes = scaleCommandBytes(L.cfg.protocol, kind);
  if (L.state !== "on" || !io || typeof io.write !== "function" || !bytes.length) return Promise.resolve(false);
  if (kind === "read" && io.pending > 0) return Promise.resolve(false);
  if (kind !== "read") scaleLinkEmit({ history: [], stable: null });
  io.pending = (io.pending || 0) + 1;
  const run = (io.queue || Promise.resolve()).then(() => io.write(bytes));
  io.queue = run.then(() => undefined, () => undefined);
  return run.then(() => true, (e) => { if (kind !== "read") scaleLinkEmit({ note: `لم يصل الأمر إلى الميزان — ${scaleErrorText(e, L.transport)}` }); return false; })
    .finally(() => { io.pending = Math.max(0, (io.pending || 1) - 1); });
}

function scaleLinkPoll(owner, on) {
  const L = SCALE_LINK;
  if (owner) { if (on) L.polls.add(owner); else L.polls.delete(owner); }
  const want = L.polls.size > 0 && L.state === "on" && scaleCommandBytes(L.cfg.protocol, "read").length > 0;
  if (want && !L.timer) { L.timer = setInterval(() => { scaleLinkSend("read"); }, SCALE_POLL_MS); scaleLinkSend("read"); }
  else if (!want && L.timer) { clearInterval(L.timer); L.timer = null; }
  return want;
}

function scaleLinkWait(timeoutMs = 4000) {
  if (SCALE_LINK.state !== "on") return Promise.reject(new Error(scaleLinkWhyNot()));
  const now = scaleLinkReading();
  if (now) return Promise.resolve(now);
  return new Promise((resolve, reject) => {
    const owner = `wait-${SCALE_LINK.ver}-${Math.random().toString(36).slice(2, 7)}`;
    let timer = null;
    let w = null;
    const finish = (fn) => { clearTimeout(timer); scaleLinkPoll(owner, false); SCALE_LINK.waiters = SCALE_LINK.waiters.filter((x) => x !== w); fn(); };
    w = { resolve: (r) => finish(() => resolve(r)), reject: (e) => finish(() => reject(e)) };
    timer = setTimeout(() => w.reject(new Error(scaleLinkWhyNot())), Math.max(500, Number(timeoutMs) || 4000));
    SCALE_LINK.waiters = [...SCALE_LINK.waiters, w];
    scaleLinkPoll(owner, true);
  });
}

function scaleLinkOpen({ transport, name = "", port = "", io, synced = false }) {
  scaleLinkEmit({ state: "on", transport, name, port, io, error: "", note: "", buf: "", synced, history: [], last: null, stable: null, junk: 0, lines: 0, at: Date.now(), userOff: false });
  scaleLinkPoll(null, true);
}

async function scaleDisconnect(why = "", { user = false } = {}) {
  const L = SCALE_LINK, io = L.io;
  L.gen += 1;
  if (L.timer) { clearInterval(L.timer); L.timer = null; }
  const ws = L.waiters;
  L.waiters = [];
  ws.forEach((w) => w.reject(new Error(why || "قُطع الاتصال بالميزان")));
  scaleLinkEmit({ state: "off", io: null, stable: null, error: user ? "" : why, errorAt: !user && why ? Date.now() : L.errorAt, note: user ? "قُطع الاتصال بالميزان" : "", userOff: user || L.userOff });
  if (io && typeof io.close === "function") { try { await io.close(); } catch (e) {} }
}

async function scaleBleOpen(device, { onText, onDrop, timeoutMs = 12000 }) {
  let timer = null;
  const late = new Promise((_, rej) => { timer = setTimeout(() => rej(scaleWhy("انتهت مهلة الاتصال بالميزان — شغّله وقرّبه ثم اضغط «اتصل بالميزان»")), timeoutMs); });
  let server = null;
  try { server = await Promise.race([device.gatt.connect(), late]); } catch (e) { try { device.gatt.disconnect(); } catch (x) {} throw e; } finally { clearTimeout(timer); }
  let svc = null, uart = null;
  for (const u of SCALE_BLE_UARTS) {
    try { svc = await server.getPrimaryService(u.service); uart = u; break; } catch (e) {}
  }
  const has = (c, ks) => ks.some((k) => !!c?.properties?.[k]);
  const chars = svc ? await svc.getCharacteristics() : [];
  const notifyC = svc ? chars.find((c) => c.uuid === uart.notify && has(c, ["notify", "indicate"])) || chars.find((c) => has(c, ["notify", "indicate"])) : null;
  const writeC = svc ? chars.find((c) => c.uuid === uart.write && has(c, ["write", "writeWithoutResponse"])) || chars.find((c) => has(c, ["write", "writeWithoutResponse"])) : null;
  if (!notifyC) {
    try { device.gatt.disconnect(); } catch (e) {}
    throw scaleWhy("الجهاز المختار لا يعرض منفذًا تسلسليًّا بالبلوتوث — إن كان الميزان بلوتوث كلاسيكيًّا فاقرنه من إعدادات النظام واختر «منفذ تسلسلي» في إعداد الميزان");
  }
  const onValue = (e) => { const v = e?.target?.value; if (v) onText(scaleBytesText(new Uint8Array(v.buffer, v.byteOffset || 0, v.byteLength))); };
  const onGone = () => onDrop();
  notifyC.addEventListener("characteristicvaluechanged", onValue);
  await notifyC.startNotifications();
  device.addEventListener("gattserverdisconnected", onGone);
  const detach = () => {
    device.removeEventListener("gattserverdisconnected", onGone);
    notifyC.removeEventListener("characteristicvaluechanged", onValue);
  };
  return {
    uart: uart.label, detach,
    write: async (bytes) => {
      if (!writeC) throw scaleWhy("هذا الميزان لا يقبل أوامر عبر البلوتوث — استعمل أزرار الميزان نفسه");
      if (writeC.properties.writeWithoutResponse && typeof writeC.writeValueWithoutResponse === "function") return writeC.writeValueWithoutResponse(bytes);
      return typeof writeC.writeValueWithResponse === "function" ? writeC.writeValueWithResponse(bytes) : writeC.writeValue(bytes);
    },
    close: async () => {
      detach();
      try { await notifyC.stopNotifications(); } catch (e) {}
      try { device.gatt.disconnect(); } catch (e) {}
    },
  };
}

async function scaleBleRetry(device, gen, handlers) {
  const old = SCALE_LINK.io;
  if (old && typeof old.detach === "function") old.detach();
  scaleLinkEmit({ state: "connecting", io: null, stable: null, note: "انقطع الاتصال بالميزان — نعيد المحاولة…" });
  scaleLinkPoll(null, false);
  for (const ms of [800, 2000, 4000]) {
    await new Promise((r) => setTimeout(r, ms));
    if (SCALE_LINK.gen !== gen) return;
    try {
      const io = await scaleBleOpen(device, handlers);
      if (SCALE_LINK.gen !== gen) { await io.close(); return; }
      scaleLinkOpen({ transport: "ble", name: device.name || "ميزان بلوتوث", port: SCALE_LINK.port, io });
      return;
    } catch (e) {}
  }
  if (SCALE_LINK.gen === gen) await scaleDisconnect("انقطع الاتصال بالميزان — تأكّد أنه مشغّل وقريب ثم اضغط «اتصل بالميزان»");
}

async function scaleBleConnect(mem, quiet) {
  let device = null;
  if (mem?.transport === "ble" && mem.id && typeof navigator.bluetooth.getDevices === "function") {
    try { device = (await navigator.bluetooth.getDevices()).find((d) => d.id === mem.id) || null; } catch (e) { device = null; }
  }
  const fromMemory = !!device;
  if (!device) {
    if (quiet) throw scaleWhy("");
    device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SCALE_BLE_UARTS.map((u) => u.service) });
  }
  const gen = SCALE_LINK.gen;
  const handlers = {
    onText: (t) => { if (SCALE_LINK.gen === gen && SCALE_LINK.state === "on") scaleLinkFeed(t); },
    onDrop: () => { if (SCALE_LINK.gen === gen && SCALE_LINK.state === "on") scaleBleRetry(device, gen, handlers); },
  };
  try {
    const io = await scaleBleOpen(device, { ...handlers, timeoutMs: quiet ? 6000 : 12000 });
    if (SCALE_LINK.gen !== gen) { await io.close(); throw scaleWhy(""); }
    scaleRemember({ transport: "ble", id: device.id, name: device.name || "" });
    scaleLinkOpen({ transport: "ble", name: device.name || "ميزان بلوتوث", port: `ble:${String(device.name || device.id || "").slice(0, 16)}`, io });
  } catch (e) {
    if (fromMemory && !quiet) {
      scaleRemember(null);
      throw scaleWhy(`تعذّر الوصول إلى الميزان المحفوظ «${mem.name || "ميزان"}» — شغّله وقرّبه، ثم اضغط «اتصل بالميزان» لتختاره من القائمة`);
    }
    throw e;
  }
}

async function scaleSerialOpen(port, { baud = 9600, onText, onDrop }) {
  await port.open({ baudRate: baud, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none" });
  const reader = port.readable.getReader();
  let alive = true;
  const loop = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.length) onText(scaleBytesText(value));
      }
    } catch (e) {} finally { try { reader.releaseLock(); } catch (e) {} }
    if (alive) onDrop();
  })();
  return {
    write: async (bytes) => {
      if (!port.writable) throw scaleWhy("منفذ الميزان لا يقبل الكتابة");
      const w = port.writable.getWriter();
      try { await w.write(bytes); } finally { try { w.releaseLock(); } catch (e) {} }
    },
    close: async () => {
      alive = false;
      try { await reader.cancel(); } catch (e) {}
      await loop;
      try { await port.close(); } catch (e) {}
    },
  };
}

async function scaleSerialConnect(mem, cfg, quiet) {
  const ports = await navigator.serial.getPorts();
  let port = (mem?.transport === "serial" && mem.port && ports.find((p) => scaleSerialId(p) === mem.port)) || null;
  if (!port) {
    if (quiet) throw scaleWhy("");
    port = await navigator.serial.requestPort();
  }
  const gen = SCALE_LINK.gen;
  const io = await scaleSerialOpen(port, { baud: cfg.baud,
    onText: (t) => { if (SCALE_LINK.gen === gen && SCALE_LINK.state === "on") scaleLinkFeed(t); },
    onDrop: () => { if (SCALE_LINK.gen === gen && SCALE_LINK.state === "on") scaleDisconnect("انقطع منفذ الميزان — تأكّد من السلك أو اقتران البلوتوث ثم اضغط «اتصل بالميزان»"); } });
  if (SCALE_LINK.gen !== gen) { await io.close(); throw scaleWhy(""); }
  const id = scaleSerialId(port);
  scaleRemember({ transport: "serial", port: id, name: scaleSerialName(port) });
  scaleLinkOpen({ transport: "serial", name: scaleSerialName(port), port: id || "serial", io });
}

// يُستدعى من ضغطة المستخدم، فقائمة الأجهزة لا تُفتح إلا داخلها. quiet: المحفوظ وحده بلا قائمةٍ ولا رسالة
async function scaleConnect(settings, { transport = null, quiet = false } = {}) {
  const L = SCALE_LINK;
  if (L.state === "on") return { ok: true };
  if (L.state === "connecting") return { ok: false, why: "الاتصال بالميزان جارٍ — لحظة" };
  const cfg = scaleLinkCfgOf(settings);
  L.cfg = cfg;
  const mem = scaleRememberedDevice();
  const pick = scaleTransportFor({ choice: transport || cfg.transport, remembered: mem?.transport || "",
    ble: btSupported(), serial: typeof navigator !== "undefined" && !!navigator.serial });
  if (!pick.transport) { if (!quiet) scaleLinkEmit({ error: pick.why, errorAt: Date.now(), note: "" }); return { ok: false, why: pick.why }; }
  scaleLinkEmit({ state: "connecting", transport: pick.transport, error: "", note: "" });
  try {
    if (pick.transport === "ble") await scaleBleConnect(mem, quiet);
    else await scaleSerialConnect(mem, cfg, quiet);
    return { ok: true };
  } catch (e) {
    const why = scaleErrorText(e, pick.transport);
    if (SCALE_LINK.state === "connecting") scaleLinkEmit({ state: "off", error: quiet ? "" : why, errorAt: quiet || !why ? SCALE_LINK.errorAt : Date.now() });
    return { ok: false, why };
  }
}

const scaleLinkSnapshot = () => {
  const L = SCALE_LINK;
  return { state: L.state, transport: L.transport, name: L.name, port: L.port, error: L.error, note: L.note, last: L.last, stable: L.stable,
    lines: L.lines, junk: L.junk, polling: !!L.timer, sent: [...(SCALE_TEST_FEED.sent || [])] };
};

function useScaleLink() {
  const [, setVer] = useState(SCALE_LINK.ver);
  useEffect(() => {
    const off = scaleLinkSubscribe(() => setVer(SCALE_LINK.ver));
    setVer(SCALE_LINK.ver);
    return off;
  }, []);
  return SCALE_LINK;
}

// يُعيد الرسم حين يتغيّر الاتصال وحده، لا مع كل قراءة
function useScaleLinkOn() {
  const [on, setOn] = useState(SCALE_LINK.state === "on");
  useEffect(() => {
    const off = scaleLinkSubscribe(() => setOn(SCALE_LINK.state === "on"));
    setOn(SCALE_LINK.state === "on");
    return off;
  }, []);
  return on;
}

// قراءةٌ واحدة مستقرّة: من الاتصال الحيّ، وإلا يتّصل (بضغطة المستخدم) ثم ينتظر
async function readScaleOnce(settings, timeoutMs = 4000) {
  if (!scaleAvailable(settings)) throw new Error("الميزان غير مفعّل أو المتصفّح لا يدعمه");
  if (SCALE_LINK.state === "on") return scaleLinkWait(timeoutMs);
  const c = await scaleConnect(settings);
  if (!c.ok) throw new Error(c.why || "لم يتّصل الميزان");
  return scaleLinkWait(timeoutMs + 2000);
}

// ميزانٌ تجريبي للاختبار: يردّ على R بالوزن المضبوط في SCALE_TEST_FEED.weight
function scaleConnectFake(name = "ميزان تجريبي") {
  const F = SCALE_TEST_FEED;
  F.on = true; F.sent = []; F.tare = 0;
  SCALE_LINK.gen += 1;
  const gen = SCALE_LINK.gen;
  const io = {
    write: async (bytes) => {
      const cmd = scaleBytesText(bytes);
      F.sent.push(cmd);
      if (/^[TZ]/.test(cmd)) F.tare = F.weight == null ? 0 : Number(F.weight) || 0;
      if (/^R/.test(cmd) && F.weight != null) {
        setTimeout(() => { if (SCALE_LINK.gen === gen && SCALE_LINK.state === "on") scaleLinkFeed(scaleTzrLine((Number(F.weight) || 0) - (Number(F.tare) || 0), F.unit || "g")); }, 15);
      }
    },
    close: async () => {},
  };
  scaleLinkOpen({ transport: "test", name, port: "test", io, synced: true });
}
if (typeof window !== "undefined") window.__ounceScaleTest = { feed: SCALE_TEST_FEED, connect: scaleConnectFake, link: SCALE_LINK };

export {
  SCALE_DEFAULTS, SCALE_LINK, SCALE_PROTOCOLS, SCALE_TEST_FEED, SCALE_TRANSPORTS,
  btSupported, parseScaleWeight, readScaleOnce, saveScaleSettings, scaleAutoPref, scaleAutoWrite, scaleAvailable,
  scaleCommandBytes, scaleConnect, scaleConnectFake, scaleDisconnect, scaleLinkCfgOf, scaleLinkConfigure, scaleLinkPoll,
  scaleLinkSend, scaleLinkWait, scaleRemember, scaleRememberedDevice, scaleSettings, scaleSettingsWrap, scaleTransportFor,
  setScaleAutoPref, stableReading, useScaleLink, useScaleLinkOn,
};
