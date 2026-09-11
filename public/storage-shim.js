// ═══════════════════════════════════════════════════════════════════════
//  طبقة التخزين — بديل مستقل يعمل خارج بيئة Claude
//
//  التطبيق كُتب على واجهة `window.storage` الخاصة ببيئة Claude، ولا وجود
//  لها في أي متصفح. هذه الطبقة تقدّم نفس الواجهة فوق localStorage، فيعمل
//  الكود بلا تعديل سطر واحد فيه.
//
//  ثلاثة فروق عالجناها:
//
//  ① localStorage متزامن والواجهة الأصلية غير متزامنة — نغلّف كل عملية
//     بـPromise فيبقى `await` في التطبيق صحيحًا.
//
//  ② الحد ~5 ميجابايت لكل نطاق. المرفقات (صور القطع) تستهلكه بسرعة،
//     فنكشف الامتلاء ونرمي خطأً مفهومًا بدل فشل صامت.
//
//  ③ الواجهة الأصلية ترمي عند غياب المفتاح ولا تُعيد null — نحاكي ذلك
//     بالضبط، لأن التطبيق يعتمد على الرمي في مواضع.
//
//  (منقول حرفيًا من web/storage.js في نسخة العميل السابقة —
//   ounce-branch-ui — لأن ounce-source الحالي يستخدم window.storage في
//   الكود دون أن يتضمن هذا الشيم نفسه ضمن التفكيك الأخير.)
// ═══════════════════════════════════════════════════════════════════════
(function installStorageShim() {
  if (typeof window === "undefined") return;
  // لا نستبدل واجهة موجودة: التطبيق قد يعمل داخل بيئة توفّرها أصلًا
  if (window.storage && typeof window.storage.get === "function") return;

  const PREFIX = "ounce::";
  const memory = new Map(); // احتياط حين يُمنع localStorage (تصفّح خاص)

  const backend = (() => {
    try {
      const probe = "__ounce_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return {
        kind: "localStorage",
        get: (k) => window.localStorage.getItem(k),
        set: (k, v) => window.localStorage.setItem(k, v),
        del: (k) => window.localStorage.removeItem(k),
        keys: () => Object.keys(window.localStorage),
      };
    } catch (e) {
      // التصفّح الخاص في بعض المتصفحات يمنع الكتابة
      console.warn("[أونصة] التخزين الدائم غير متاح — البيانات في الذاكرة فقط وتضيع بالإغلاق");
      return {
        kind: "memory",
        get: (k) => (memory.has(k) ? memory.get(k) : null),
        set: (k, v) => memory.set(k, v),
        del: (k) => memory.delete(k),
        keys: () => [...memory.keys()],
      };
    }
  })();

  const tick = (fn) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(fn());
        } catch (e) {
          reject(e);
        }
      }, 0);
    });

  window.storage = {
    backendKind: backend.kind,

    get(key /*, shared */) {
      return tick(() => {
        const raw = backend.get(PREFIX + key);
        // ⚠ الواجهة الأصلية ترمي عند الغياب — التطبيق يعتمد على ذلك
        if (raw === null || raw === undefined) {
          const err = new Error(`key not found: ${key}`);
          err.code = "NOT_FOUND";
          throw err;
        }
        return { key, value: raw, shared: false };
      });
    },

    set(key, value /*, shared */) {
      return tick(() => {
        try {
          backend.set(PREFIX + key, String(value));
        } catch (e) {
          // QuotaExceededError باسم مختلف بين المتصفحات
          const quota =
            e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22);
          if (quota) {
            const err = new Error("امتلأت مساحة التخزين — احذف المرفقات الكبيرة أو نزّل نسخة احتياطية وصفّر");
            err.code = "QUOTA";
            throw err;
          }
          throw e;
        }
        return { key, value: String(value), shared: false };
      });
    },

    delete(key /*, shared */) {
      return tick(() => {
        backend.del(PREFIX + key);
        return { key, deleted: true, shared: false };
      });
    },

    list(prefix /*, shared */) {
      return tick(() => {
        const p = PREFIX + (prefix || "");
        const keys = backend
          .keys()
          .filter((k) => k.startsWith(p))
          .map((k) => k.slice(PREFIX.length));
        return { keys, prefix: prefix || "", shared: false };
      });
    },

    /// تقدير المساحة المستهلكة — يُعرض في صفحة النسخ الاحتياطي
    usage() {
      let bytes = 0;
      backend.keys().forEach((k) => {
        if (!k.startsWith(PREFIX)) return;
        const v = backend.get(k);
        bytes += k.length + (v ? v.length : 0);
      });
      return { bytes, mb: bytes / (1024 * 1024) };
    },
  };
})();
