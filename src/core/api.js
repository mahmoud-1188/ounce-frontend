// ═══════════════════════════════════════════════════════════════
//  طبقة الاتصال بالباك إند — بديل window.storage/localStorage
// ═══════════════════════════════════════════════════════════════
//
// ⚠ قرار معماري: بدل الفرونت إند الذي كان يحسب كل شيء محليًا ويحفظه في
// localStorage، الباك إند الآن هو مصدر الحقيقة الوحيد — كل عملية (بيع،
// شراء، كسر، خزنة...) تُرسَل له، وهو من يحسب القيود والتحقّقات ويرجّع
// النتيجة النهائية. هذا الملف هو نقطة الاتصال الوحيدة معه.
//
// ⚠ الأداء/التنقل: لا يُستدعى أي شيء هنا أثناء التنقل بين الشاشات —
// bootstrap() تُستدعى مرة واحدة بعد الدخول فقط، وكل تنقّل بعدها محلي 100%
// من الحالة المحمَّلة في الذاكرة (React state) — بلا أي طلب شبكة. الطلبات
// هنا تحدث فقط عند تنفيذ عملية فعلية (إنشاء فاتورة، تسجيل شراء...).

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const TOKEN_STORAGE_KEY = "ounce_auth_token_v1";

// ── إدارة الجلسة (JWT) ──
//
// خلافًا للمرجع (حيث `currentUser` كان يُفقَد عند أي refresh لأنه كان في
// الذاكرة فقط)، هنا نحتفظ بالتوكن في sessionStorage — الجلسة تنجو من
// تحديث الصفحة (لا تتطلب دخولًا جديدًا في كل مرة)، وتُمحى عند إغلاق التبويب
// (لا "تذكرني" دائم — هذا تطبيق نقطة بيع في محل، لا حساب شخصي).
let authToken = null;
try {
  authToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) || null;
} catch {
  // sessionStorage غير متاح (وضع خصوصية صارم) — الجلسة تبقى في الذاكرة فقط.
}

function setAuthToken(token) {
  authToken = token;
  try {
    if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    else sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // تجاهل — الجلسة تبقى شغّالة في الذاكرة حتى لو فشل الحفظ.
  }
}

function getAuthToken() {
  return authToken;
}

function clearAuthToken() {
  setAuthToken(null);
}

/**
 * خطأ API منظَّم — يحمل status وbody (كائن الخطأ اللي رجّعه الباك إند،
 * مثل `{error: "insufficient_stock", available: 2, requested: 5}`) بدل
 * رسالة نصية عامة، حتى تقدر الشاشات تعرض رسالة دقيقة (تمامًا كما كانت
 * flashToast تعرض تفاصيل الفشل في المرجع).
 */
class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body || {};
  }
}

async function apiFetch(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: "invalid_response", raw: text };
    }
  }

  if (!res.ok) {
    // 401 هنا يعني توكن منتهي/غير صالح — لا يوجد تجديد تلقائي (refresh
    // token) في هذا الباك إند بعد؛ الشاشة المستدعية مسؤولة عن معالجة
    // ApiError.status === 401 بإعادة المستخدم لشاشة الدخول.
    throw new ApiError(res.status, payload);
  }
  return payload;
}

// ── المصادقة ──

/** GET /branches/:branchId/users — قائمة الأسماء لشاشة الدخول (بلا PIN). */
function fetchBranchUsers(branchId) {
  return apiFetch(`/branches/${branchId}/users`);
}

/** POST /auth/login — يرجّع {token, user}. */
async function login({ branchId, userId, pin }) {
  const result = await apiFetch("/auth/login", {
    method: "POST",
    body: { branchId, userId, pin },
  });
  setAuthToken(result.token);
  return result;
}

function logout() {
  clearAuthToken();
}

// ── التحميل الشامل بعد الدخول ──

/** GET /bootstrap — كل بيانات الفرع دفعة واحدة. */
function fetchBootstrap() {
  return apiFetch("/bootstrap");
}

// ── المبيعات ──

function createSale(payload) {
  return apiFetch("/sales", { method: "POST", body: payload });
}

function createPartialSale(payload) {
  return apiFetch("/sales/partial", { method: "POST", body: payload });
}

// ── المشتريات ──

function createPurchase(payload) {
  return apiFetch("/purchases", { method: "POST", body: payload });
}

// ── الكسر ──

const scrap = {
  create: (payload) => apiFetch("/scrap", { method: "POST", body: payload }),
  receiveByOfficer: (id, payload) =>
    apiFetch(`/scrap/${id}/receive-by-officer`, { method: "POST", body: payload }),
  breakStones: (id, payload) =>
    apiFetch(`/scrap/${id}/break-stones`, { method: "POST", body: payload }),
  send: (payload) => apiFetch("/scrap/send", { method: "POST", body: payload }),
  assess: (reqId, payload) => apiFetch(`/scrap/${reqId}/assess`, { method: "POST", body: payload }),
  approve: (reqId, payload) => apiFetch(`/scrap/${reqId}/approve`, { method: "POST", body: payload }),
  receive: (reqId, payload) => apiFetch(`/scrap/${reqId}/receive`, { method: "POST", body: payload }),
  depositToVault: (payload) => apiFetch("/scrap/deposit-to-vault", { method: "POST", body: payload }),
  convertToItem: (id, payload) => apiFetch(`/scrap/${id}/convert-to-item`, { method: "POST", body: payload }),
};

// ── الخزنة ──

const safe = {
  transferToSafe: (payload) => apiFetch("/safe/transfer-to-safe", { method: "POST", body: payload }),
  transferToDaily: (payload) => apiFetch("/safe/transfer-to-daily", { method: "POST", body: payload }),
  fundCustody: (payload) => apiFetch("/safe/fund-custody", { method: "POST", body: payload }),
  cash: (payload) => apiFetch("/safe/cash", { method: "POST", body: payload }),
  gold: (payload) => apiFetch("/safe/gold", { method: "POST", body: payload }),
  audit: (payload) => apiFetch("/safe/audit", { method: "POST", body: payload }),
  closeScrapDay: (payload) => apiFetch("/safe/close-scrap-day", { method: "POST", body: payload }),
};

// ── يوم العمل والعهدة اليومية ──

const day = {
  open: (payload) => apiFetch("/day/open", { method: "POST", body: payload }),
  close: (payload) => apiFetch("/day/close", { method: "POST", body: payload }),
};

const custody = {
  open: (payload) => apiFetch("/custody/open", { method: "POST", body: payload }),
  close: (payload) => apiFetch("/custody/close", { method: "POST", body: payload }),
};

// ── إعدادات الفرع (الضريبة/رسوم الشبكة) وقفل الجرد ──
// كلاهما كان يُفرض فعليًا من السيرفر على المبيعات/الكسر لكن لا يوجد أي
// مسار لكتابته — هذا كان يعني أن تغيير الضريبة أو فتح/قفل الجرد من
// الواجهة لا يصل إطلاقًا للسيرفر الذي يطبّقهما فعلًا.
const settingsApi = {
  updateBranch: (payload) => apiFetch("/settings/branch", { method: "PATCH", body: payload }),
  setStocktakeLock: (locked) => apiFetch("/settings/stocktake-lock", { method: "POST", body: { locked } }),
};

// ── المصروفات ──
// كانت محفوظة محليًا فقط رغم أن /day/close يقرأ فعليًا مجموعها لحساب
// لقطة الإقفال — أي مصروف لا يُرسل هنا يبقى غائبًا عن رقم الإقفال.
const expensesApi = {
  list: () => apiFetch("/expenses"),
  add: (payload) => apiFetch("/expenses", { method: "POST", body: payload }),
  addName: (name, category) => apiFetch("/expense-names", { method: "POST", body: { name, category } }),
  deleteName: (id) => apiFetch(`/expense-names/${id}`, { method: "DELETE" }),
};

// ── التسكير (تسوية مستحقات الموردين) ──
// كانت محفوظة محليًا بالكامل بلا أي ربط حقيقي بمورد في قاعدة البيانات
// (راجع migration 011) — الآن كل تسكير وسداد مكتب يُسجَّل فعليًا ويُخصم
// من دين المورد الحقيقي (supplier_ledger).
const taskirApi = {
  list: () => apiFetch("/taskirat"),
  add: (payload) => apiFetch("/taskirat", { method: "POST", body: payload }),
  offices: {
    list: () => apiFetch("/taskirat/offices"),
    create: (name, phone) => apiFetch("/taskirat/offices", { method: "POST", body: { name, phone } }),
  },
  officeTx: (officeId) => apiFetch(`/taskir-offices/${officeId}/tx`),
  settleOffice: (officeId, payload) =>
    apiFetch(`/taskir-offices/${officeId}/settle`, { method: "POST", body: payload }),
};

// ── إخراج بضاعة من النظام ──

function issueOut(payload) {
  return apiFetch("/inventory/issue-out", { method: "POST", body: payload });
}

// ── المستخدمون (شاشة الصلاحيات) ──

const usersApi = {
  list: () => apiFetch("/users"),
  create: (payload) => apiFetch("/users", { method: "POST", body: payload }),
  rename: (id, name) => apiFetch(`/users/${id}/rename`, { method: "PATCH", body: { name } }),
  toggleAi: (id, canUseAi) => apiFetch(`/users/${id}/ai`, { method: "PATCH", body: { canUseAi } }),
  // allowedPages: string[] لتخصيص صريح، أو null لإرجاع افتراضي الدور —
  // نفس اتفاقية null/[] الموثَّقة في migration 002 وpermissions.js.
  setPermissions: (id, allowedPages) => apiFetch(`/users/${id}/permissions`, { method: "PATCH", body: { allowedPages } }),
  remove: (id) => apiFetch(`/users/${id}`, { method: "DELETE" }),
};

// ── الحجوزات، الإصلاحات، والمرتجعات ──
// كانت الثلاثة محفوظة محليًا فقط بلا أي endpoint — راجع migration 013.
const reservationsApi = {
  list: () => apiFetch("/reservations"),
  add: (payload) => apiFetch("/reservations", { method: "POST", body: payload }),
  cancel: (id, refund) => apiFetch(`/reservations/${id}/cancel`, { method: "POST", body: { refund: !!refund } }),
};

const repairsApi = {
  add: (payload) => apiFetch("/repairs", { method: "POST", body: payload }),
};

const returnsApi = {
  create: (saleId, payload) => apiFetch(`/sales/${saleId}/return`, { method: "POST", body: payload }),
  // POST /sales/:id/return-full — النسخة الكاملة (شاشة "استرجاع مبيعات"
  // المخصَّصة): ضريبة فعلية حقيقية + عكس تكلفة البضاعة المباعة + تمييز
  // تالف/متاح لإعادة التخزين. راجع misc.routes.js.
  createFull: (saleId, payload) => apiFetch(`/sales/${saleId}/return-full`, { method: "POST", body: payload }),
};

// ── سعر الذهب العالمي ──
// ⚠ إصلاح حقيقي: كانت fetchGoldPriceSAR في helpers.js تنادي Anthropic API
// مباشرة من المتصفح بلا مفتاح إطلاقًا — لا يعمل أصلًا (401)، وحتى لو أُضيف
// مفتاح فسيكون مكشوفًا للجميع. السعر الآن يُجلب من الخادم (GET
// /gold-price — يتصل هو بـgold-api.com بأمان ويحوّل لريال سعودي).
const goldPriceApi = {
  fetch: () => apiFetch("/gold-price"),
};

export {
  ApiError,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  fetchBranchUsers,
  login,
  logout,
  fetchBootstrap,
  createSale,
  createPartialSale,
  createPurchase,
  scrap,
  safe,
  day,
  custody,
  settingsApi,
  expensesApi,
  taskirApi,
  issueOut,
  usersApi,
  reservationsApi,
  repairsApi,
  returnsApi,
  goldPriceApi,
};
