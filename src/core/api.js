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
// ⚠ إصلاح حقيقي: كان التوكن مخزَّنًا في sessionStorage — بعض المتصفحات
// (خصوصًا وضع التصفح الخاص، أو إعدادات خصوصية معيّنة، أو حتى refresh عادي
// في بعض الحالات) تمسحه فتُخرِج المستخدم فورًا رغم أن توكنه لم ينته
// صلاحيته بعد (12 ساعة — راجع JWT_EXPIRES_IN في auth/jwt.js). الآن
// نستخدم localStorage: الجلسة تبقى فعليًا حتى بعد إغلاق المتصفح بالكامل
// وإعادة فتحه، لمدة صلاحية التوكن نفسها (12 ساعة) — لا "تذكرني" أبدي غير
// محدود، فالتوكن نفسه ينتهي ويطلب دخولًا جديدًا بعدها تلقائيًا (401 في
// apiFetch أدناه).
let authToken = null;
try {
  authToken = localStorage.getItem(TOKEN_STORAGE_KEY) || null;
} catch {
  // localStorage غير متاح (وضع خصوصية صارم) — الجلسة تبقى في الذاكرة فقط.
}

function setAuthToken(token) {
  authToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
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
    // ⚠ no-store صراحة: طلبات مصادقة محمية (auth/me, bootstrap) لا يجوز
    // تخزينها إطلاقًا — لا من المتصفح ولا من أي بروكسي/CDN وسيط بينهما.
    // بلا هذا رد 401 قديم مخزّن أو بيانات فارغة مخزّنة من طلب سابق يمكن
    // أن يُعاد عرضه لمستخدم آخر أو في طلب لاحق، رغم صلاحية التوكن الحقيقية.
    cache: "no-store",
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

/**
 * GET /branches/by-ref/:ref — يحل رمز فرعٍ عام (BR-XXXXXXXX، من رابط
 * دخول الفرع الذي عرضته BranchLinkCard.jsx في ounce-central) إلى
 * {branchId, branchRef, branchName}. علنيٌّ بلا توكن — يُستدعى مرة
 * واحدة فقط، أول ما يُفتح رابط الفرع على جهاز جديد، قبل أي تسجيل دخول
 * (راجع effect حل هوية الفرع في GoldInventoryApp.jsx).
 */
function resolveBranchByRef(ref) {
  return apiFetch(`/branches/by-ref/${encodeURIComponent(ref)}`);
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
  clearCachedBootstrap();
}

/**
 * GET /auth/me — يتحقق من توكن محفوظ (localStorage) عند إقلاع التطبيق
 * ويرجّع بيانات المستخدم بنفس شكل login بالضبط، لاستعادة الجلسة تلقائيًا
 * بلا طلب PIN من جديد بعد أي refresh. يرمي ApiError(401) إن كان التوكن
 * غائبًا أو منتهيًا — المستدعي (GoldInventoryApp.jsx) يعامل ذلك كـ"لا
 * جلسة محفوظة صالحة" ويعرض شاشة الدخول العادية.
 */
function fetchCurrentUser() {
  return apiFetch("/auth/me");
}

// ── التحميل الشامل بعد الدخول ──

/** GET /bootstrap — كل بيانات الفرع دفعة واحدة. */
function fetchBootstrap() {
  return apiFetch("/bootstrap");
}

// ── تخزين مؤقّت للـ bootstrap (إحساس محلي عند إعادة الفتح) ──
//
// ⚠ بلا هذا: كل فتح للتطبيق (أو refresh) يعرض شاشة تحميل سوداء 3-5
// ثوانٍ لحين رجوع /auth/me ثم /bootstrap — إحساسٌ بعيد كليًا عن
// تطبيق محلي رغم أن التطبيق نفسه محمَّل فعليًا من أول جزء من الثانية.
//
// الحل: نخزّن آخر نسخة ناجحة من bootstrap في localStorage. عند
// الفتح التالي تُعرض هذه النسخة فورًا (0 ثانية) بينما يجري طلب
// الشبكة الحقيقي في الخلفية بصمت، فيُحدَّث كل شيء بهدوء دون شاشة
// تحميل ثانية إن نجح، أو يبقى المستخدم على آخر نسخة صالحة إن فشل
// (لا اتصال، خطأ خادم مؤقت...).
//
// ⚠ لا يُخزَّن أي شيء حسّاس هنا لم يكن أصلًا سيصل للمتصفح: نفس بيانات
// bootstrap التي كانت ستُعرض للمستخدم فورًا بعد الرد، لا أكثر.
const BOOTSTRAP_CACHE_KEY = "ounce_bootstrap_cache_v1";

function getCachedBootstrap() {
  try {
    const raw = localStorage.getItem(BOOTSTRAP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCachedBootstrap(data, user) {
  try {
    localStorage.setItem(
      BOOTSTRAP_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), data, user: user || null })
    );
  } catch {
    // التخزين ممتلئ أو غير متاح — لا يوقف التطبيق، فقط لا تحسين هذه المرة.
  }
}

function clearCachedBootstrap() {
  try {
    localStorage.removeItem(BOOTSTRAP_CACHE_KEY);
  } catch {
    // تجاهل
  }
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

// ⚠ إصلاح حقيقي: إضافة مورد كانت تُكتب محليًا فقط (persistSuppliers →
// window.storage) بلا أي استدعاء للباك إند — فيُبنى الشراء عليه بمعرّف
// لا وجود له في جدول suppliers الحقيقي، ويختفي المورد والشراء معًا عند
// أي refresh لأن loadBootstrap يستبدل suppliers بالكامل بما يرجعه
// الخادم. هذا يضيف المورد فعليًا في قاعدة البيانات (POST /api/suppliers).
function createSupplier(payload) {
  return apiFetch("/suppliers", { method: "POST", body: payload });
}

// ⚠ إصلاح فجوة حقيقية: التكويد (إضافة أصناف جديدة من دفعة/lot مفتوحة)
// كان لا يزال يكتب محليًا فقط (persistItems → window.storage) بمعرّفات
// عشوائية من المتصفح، بلا أي استدعاء للباك إند — تمامًا كحال المورّدين
// قبل الإصلاح أعلاه. هذا يستدعي POST /api/lots/:id/items فعليًا (راجع
// migration 028_lot_item_coding.sql وitems.routes.js في الباك إند
// للسياق الكامل)، فتُكتب items/item_units حقيقية في Postgres وتظهر في
// bootstrap لكل جهاز/جلسة من الآن فصاعدًا.
function createLotItems(lotId, rows, distributionMode) {
  return apiFetch(`/lots/${lotId}/items`, {
    method: "POST",
    body: { rows, distributionMode },
  });
}

// ── قارئ RFID: ربط/فكّ بطاقة بوحدة (item_units.epc) ──
//
// القراءة الفعلية للبطاقة (بلوتوث NHR-10 أو قارئ HID) تجري بالكامل في
// المتصفح — هذان النداءان فقط يكتبان نتيجة الربط في قاعدة البيانات كي
// تظهر لكل مستخدم بعد تحديث/دخول جديد، لا في متصفح من ربطها فقط.
const rfid = {
  bind: (unitId, epc) => apiFetch("/rfid/bind", { method: "POST", body: { unitId, epc } }),
  unbind: (unitId) => apiFetch("/rfid/unbind", { method: "POST", body: { unitId } }),
};

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

// ── وكيل الذكاء الاصطناعي (Claude) ──
//
// ⚠ إصلاح أمني/وظيفي حقيقي: كل دوال helpers.js الخمس (fetchAiChatReply،
// fetchAiBusinessInsights، fetchAiAuditNarrative، fetchAiReportSpec،
// askReportAi) كانت تنادي https://api.anthropic.com/v1/messages مباشرة من
// المتصفح بلا مفتاح API إطلاقًا — يُرفض دائمًا بـ401 من Anthropic (نفس
// عطل سعر الذهب بالضبط قبل إصلاحه)، وحتى لو أُضيف مفتاح في كود العميل
// فسيكون مكشوفًا لأي زائر. الآن كل هذه الدوال تنادي هذا الـendpoint
// الواحد (POST /ai/chat)، والخادم فقط يحمل المفتاح الحقيقي ويعيد التوجيه
// لـAnthropic بعد التحقق من صلاحية can_use_ai للمستخدم الحالي.
const aiApi = {
  chat: (messages, maxTokens, model) =>
    apiFetch("/ai/chat", { method: "POST", body: { messages, max_tokens: maxTokens, model } }),
};

// ── الأصول الثابتة والإهلاك ──

const fixedAssetsApi = {
  fetchClasses: () => apiFetch("/asset-classes"),
  fetch: () => apiFetch("/fixed-assets"),
  create: (payload) => apiFetch("/fixed-assets", { method: "POST", body: payload }),
  runDepreciation: (period) =>
    apiFetch("/fixed-assets/depreciation/run", { method: "POST", body: { period } }),
  dispose: (assetId, payload) =>
    apiFetch(`/fixed-assets/${assetId}/dispose`, { method: "POST", body: payload }),
};

// ── الرواتب والموارد البشرية ──

const payrollApi = {
  fetchStaff: () => apiFetch("/hr/staff"),
  saveHr: (userId, payload) => apiFetch(`/hr/staff/${userId}`, { method: "PATCH", body: payload }),
  saveCommission: (userId, rule) => apiFetch(`/commissions/${userId}`, { method: "PUT", body: rule }),
  deleteCommission: (userId) => apiFetch(`/commissions/${userId}`, { method: "DELETE" }),
  fetchAttendance: (month) => apiFetch(`/attendance${month ? `?month=${month}` : ""}`),
  markAttendance: (payload) => apiFetch("/attendance", { method: "POST", body: payload }),
  fetchLeaveRequests: () => apiFetch("/leave-requests"),
  requestLeave: (payload) => apiFetch("/leave-requests", { method: "POST", body: payload }),
  decideLeave: (id, decision) => apiFetch(`/leave-requests/${id}/decide`, { method: "POST", body: { decision } }),
  preview: (period) => apiFetch(`/payroll/preview?period=${period}`),
  fetchRuns: () => apiFetch("/payroll/runs"),
  accrue: (period) => apiFetch("/payroll/runs", { method: "POST", body: { period } }),
  pay: (runId, employeeId, fundingSource) =>
    apiFetch(`/payroll/runs/${runId}/pay/${employeeId}`, { method: "POST", body: { fundingSource } }),
  payGosi: (runId, fundingSource) =>
    apiFetch(`/payroll/runs/${runId}/pay-gosi`, { method: "POST", body: { fundingSource } }),
  payEos: (payload) => apiFetch("/payroll/eos", { method: "POST", body: payload }),
};

// ── تقرير الإدارة/متعدد الفروع (migration 017) ──
//
// endpoint واحد فقط — التجميع كله يجري في الخادم (withoutBranch)، فلا
// حاجة الفرونت إند لأكثر من طلب واحد بفترة اختيارية.
const hqApi = {
  fetchReport: (period) => apiFetch(`/hq/report${period ? `?period=${period}` : ""}`),
};

// ── التثبيت — ذهب ↔ نقد (migration 018) ──

const priceFixApi = {
  fetch: () => apiFetch("/price-fix"),
  create: (payload) => apiFetch("/price-fix", { method: "POST", body: payload }),
};

// ── معاملات الإدارة (hqDocs — migration 027) ──
// طلبات/تحويلات حقيقية بين الفرع والمركزي، لا رموزًا تُلصق يدويًّا كما
// في المرجع (راجع تعليق الهجرة). الفرع يبدأ خمسة أنواع، ويستلم اثنين
// فقط (goods_from_hq, send_for_coding) بعد اعتماد الإدارة أو مباشرةً.
const hqTransactionsApi = {
  list: () => apiFetch("/branch/hq-transactions"),
  create: (payload) => apiFetch("/branch/hq-transactions", { method: "POST", body: payload }),
  receive: (id) => apiFetch(`/branch/hq-transactions/${id}/receive`, { method: "POST" }),
};

export {
  ApiError,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  fetchBranchUsers,
  resolveBranchByRef,
  login,
  logout,
  fetchCurrentUser,
  fetchBootstrap,
  getCachedBootstrap,
  setCachedBootstrap,
  clearCachedBootstrap,
  createSale,
  createPartialSale,
  createPurchase,
  createSupplier,
  createLotItems,
  rfid,
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
  aiApi,
  fixedAssetsApi,
  payrollApi,
  hqApi,
  priceFixApi,
  hqTransactionsApi,
};
