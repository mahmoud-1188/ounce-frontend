import * as api from "../core/api.js";

/// مراقبة الأعطال: كل عطلٍ غير معالَج يُرسَل للإدارة تلقائيًّا (رسالته ومكدّسه وصفحته) — نفس العطل مرّةً كل دقيقة،
/// وعشرة بلاغاتٍ في الدقيقة على الأكثر، فعطلٌ في حلقةٍ لا يُغرق الخادم. لا يمسّ البيانات ولا يُظهر شيئًا للمستخدم.
const VERSION = typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_VERSION ? import.meta.env.VITE_APP_VERSION : "web";
const recent = new Map();
let windowStart = 0, sentInWindow = 0;

function reportError(err, extra = {}) {
  try {
    const message = String(err?.message || err || "").slice(0, 500);
    if (!message || /ResizeObserver loop|Script error\.?$/i.test(message)) return;
    const now = Date.now();
    if (now - windowStart > 60000) { windowStart = now; sentInWindow = 0; }
    if (sentInWindow >= 10) return;
    const last = recent.get(message);
    if (last && now - last < 60000) return;
    recent.set(message, now);
    sentInWindow += 1;
    api.reportClientError({ message, stack: String(err?.stack || extra.stack || "").slice(0, 4000), url: location.pathname + location.hash, version: VERSION });
  } catch { /* البلاغ نفسه لا يكسر شيئًا */ }
}

let installed = false;
function installErrorReporting() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => reportError(e.error || e.message, { stack: e.error?.stack }));
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    // رفض الخادم المعالَج (ApiError) ليس عطلًا في التطبيق
    if (r && r.name === "ApiError") return;
    reportError(r);
  });
}

export { installErrorReporting, reportError };
