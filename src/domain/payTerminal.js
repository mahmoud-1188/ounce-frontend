
import { fmtMoney } from "../core/money.js";

/// جهاز الدفع (مدى · جيديا · نيرباي) عبر جسرٍ محلّي على جهاز نقطة البيع (http://127.0.0.1:<منفذ>) بعقدٍ واحد:
/// GET /health · POST /purchase { amountMinor بالهللة، ref يمنع التكرار } ← { status/ok, approvalCode, last4, scheme, rrn, terminalId }.
/// الإعداد لهذا الجهاز وحده (localStorage) — الجسر يكتبه المزوّد فوق حزمته.
const PAY_TERMINAL_KEY = "ounce_pay_terminal_v1";
const deviceStoreSync = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

const PAY_TERMINAL_BRANDS = [
  { id: "mada", label: "مدى — جهاز البنك" }, { id: "geidea", label: "جيديا" }, { id: "nearpay", label: "نيرباي" }, { id: "other", label: "جهازٌ آخر" },
];

const PAY_TERMINAL_DEFAULTS = { enabled: false, brand: "mada", url: "http://127.0.0.1:9777", token: "", timeoutSec: 90, require: false };

const payTerminalUrlOk = (u) => { try { const x = new URL(String(u || "")); return /^https?:$/.test(x.protocol); } catch { return false; } };

const payTerminalBrandLabel = (id) => PAY_TERMINAL_BRANDS.find((b) => b.id === id)?.label || "جهاز الدفع";

// الإعداد كما حُفظ (ولو كان مطفأً) لبطاقة الإعدادات
function payTerminalRaw(raw) {
  if (raw === undefined) raw = deviceStoreSync(PAY_TERMINAL_KEY);
  try { const c = raw ? JSON.parse(raw) : null; return { ...PAY_TERMINAL_DEFAULTS, ...(c && typeof c === "object" ? c : {}) }; } catch { return { ...PAY_TERMINAL_DEFAULTS }; }
}

// الإعداد الفعّال لشاشة البيع: null إن كان مطفأً أو عنوانه غير صالح
function payTerminalCfg(raw) {
  const c = payTerminalRaw(raw);
  return c.enabled && payTerminalUrlOk(c.url) ? c : null;
}

const payTerminalSave = (cfg) => { try { localStorage.setItem(PAY_TERMINAL_KEY, JSON.stringify({ ...PAY_TERMINAL_DEFAULTS, ...(cfg || {}), url: String(cfg?.url || "").trim().replace(/\/+$/, ""), token: String(cfg?.token || "").trim() })); } catch { /* تخزينٌ محجوب */ } };

// طلب الشراء للجسر: المبلغ بالهللة (عددٌ صحيح) ومرجعٌ يمنع التكرار إن أُعيد الإرسال
const payTerminalRequest = (cfg, { amount, ref, invoice = "", currency = "SAR" }) =>
  ({ amountMinor: Math.round((Number(amount) || 0) * 100), currency, ref: String(ref || Date.now().toString(36)), invoice: String(invoice || ""), brand: cfg?.brand || "mada" });

function cardNetworkOfScheme(scheme) {
  const t = String(scheme || "").toLowerCase();
  if (/mada|مدى/.test(t)) return "mada";
  if (/visa|فيزا/.test(t)) return "visa";
  if (/master|\bmc\b|ماستر/.test(t)) return "mastercard";
  if (/amex|american/.test(t)) return "amex";
  return null;
}

// يوحّد ردّ الجسر (أسماء الحقول تختلف بين المزوّدين) ويرفض اعتمادًا بمبلغٍ يخالف المطلوب
function payTerminalResult(j, want) {
  const ok = !!j && (j.ok === true || /^(approved|ok|success|captured)$/i.test(String(j.status || "")));
  if (!ok) return { ok: false, why: String(j?.message || j?.error || j?.status || "رفض الجهاز العملية").slice(0, 120) };
  const got = Number(j.amountMinor ?? j.amount_minor ?? j.amount);
  if (Number.isFinite(got) && want?.amountMinor != null && got !== want.amountMinor) return { ok: false, why: `المبلغ المعتمد ${fmtMoney(got / 100)} يخالف المطلوب ${fmtMoney(want.amountMinor / 100)}` };
  const scheme = String(j.scheme || j.cardScheme || j.cardBrand || j.network || "").slice(0, 20);
  return {
    ok: true, approvalCode: String(j.approvalCode || j.authCode || j.auth_code || "").slice(0, 12),
    last4: String(j.last4 || j.maskedPan || j.pan || "").replace(/\D/g, "").slice(-4), scheme, network: cardNetworkOfScheme(scheme),
    rrn: String(j.rrn || j.retrievalReference || "").slice(0, 24), terminalId: String(j.terminalId || j.tid || "").slice(0, 16),
    intentId: String(j.intentId || j.transactionId || j.id || "").slice(0, 64), amountMinor: want?.amountMinor ?? (Number.isFinite(got) ? got : 0),
    provider: want?.brand || "", at: new Date().toISOString(),
  };
}

// ما يُحفظ على الفاتورة من الاعتماد: الحقول المعروفة وحدها، ولا رقم بطاقةٍ غير آخر أربعة
function sanitizeCardAuth(a) {
  if (!a || typeof a !== "object") return null;
  const o = { approvalCode: String(a.approvalCode || "").slice(0, 12), last4: String(a.last4 || "").replace(/\D/g, "").slice(-4), scheme: String(a.scheme || "").slice(0, 20),
    rrn: String(a.rrn || "").slice(0, 24), terminalId: String(a.terminalId || "").slice(0, 16), intentId: String(a.intentId || "").slice(0, 64),
    amountMinor: Number(a.amountMinor) || 0, provider: String(a.provider || "").slice(0, 20), manual: !!a.manual, at: String(a.at || new Date().toISOString()).slice(0, 30) };
  return o.approvalCode || o.intentId ? o : null;
}

async function payTerminalCharge(cfg, req, { fetchFn = (typeof fetch === "function" ? fetch : null), signal = null } = {}) {
  if (!cfg || !payTerminalUrlOk(cfg.url)) return { ok: false, why: "جهاز الدفع غير مضبوط" };
  if (!fetchFn) return { ok: false, why: "بلا شبكة" };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), (Number(cfg.timeoutSec) || 90) * 1000);
  if (signal) signal.addEventListener("abort", () => ctl.abort(), { once: true });
  try {
    const r = await fetchFn(`${String(cfg.url).replace(/\/+$/, "")}/purchase`, { method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}) }, body: JSON.stringify(req) });
    if (r.status === 401 || r.status === 403) return { ok: false, why: "الجسر رفض الرمز المشترك — طابقه في إعدادات الجسر والتطبيق" };
    if (!r.ok) return { ok: false, why: `الجسر ردّ ${r.status}` };
    return payTerminalResult(await r.json(), req);
  } catch (e) {
    if (e?.name === "AbortError") return { ok: false, why: signal?.aborted ? "أُلغي الطلب" : "انتهى الوقت بلا ردٍّ من الجهاز" };
    return { ok: false, why: "تعذّر الوصول للجسر — هل يعمل على هذا الجهاز وعنوانه صحيح؟" };
  } finally { clearTimeout(t); }
}

async function payTerminalPing(cfg, fetchFn = (typeof fetch === "function" ? fetch : null)) {
  if (!cfg || !payTerminalUrlOk(cfg.url)) return { ok: false, why: "العنوان غير صالح (http://… أو https://…)" };
  if (!fetchFn) return { ok: false, why: "بلا شبكة" };
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetchFn(`${String(cfg.url).replace(/\/+$/, "")}/health`, { signal: ctl.signal, cache: "no-store", headers: cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {} });
    clearTimeout(t);
    if (r.status === 401 || r.status === 403) return { ok: false, why: "الجسر رفض الرمز المشترك" };
    if (!r.ok) return { ok: false, why: `الجسر ردّ ${r.status}` };
    const j = await r.json().catch(() => ({}));
    return { ok: true, info: [j?.terminal || j?.brand, j?.version ? `v${j.version}` : "", j?.terminalId ? `TID ${j.terminalId}` : ""].filter(Boolean).join(" · ") || "الجسر يردّ" };
  } catch { return { ok: false, why: "تعذّر الوصول للجسر — شغّله على هذا الجهاز وتأكّد من المنفذ" }; }
}

export { PAY_TERMINAL_BRANDS, PAY_TERMINAL_DEFAULTS, cardNetworkOfScheme, payTerminalBrandLabel, payTerminalCfg, payTerminalCharge, payTerminalPing, payTerminalRaw, payTerminalRequest, payTerminalResult, payTerminalSave, payTerminalUrlOk, sanitizeCardAuth };
