import React, { useState } from "react";
import { AlertTriangle, Database, Paperclip } from "lucide-react";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function BackupPage({ onBackup, onRestore, onLoadDemo, onResetAll, onBack }) {
  const [demoConfirm, setDemoConfirm] = useState(false);
  const [pw, setPw] = useState("");
  const [restorePw, setRestorePw] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);
  const [resetStep, setResetStep] = useState(0);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetDone, setResetDone] = useState(0);
  const [resetTotal, setResetTotal] = useState(0);
  const [demoDone, setDemoDone] = useState(0);
  const [demoTotal, setDemoTotal] = useState(0);
  const [payload, setPayload] = useState(null);
  const [fileName, setFileName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");

  const readFile = (file) => {
    setError("");
    setPayload(null);
    setConfirm(false);
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.app !== "ounce-branch") {
          setError("هذا الملف ليس نسخة أونصة");
          return;
        }
        setPayload(parsed);
      } catch (e) {
        setError("تعذّرت قراءة الملف — قد يكون تالفًا");
      }
    };
    reader.onerror = () => setError("تعذّرت قراءة الملف");
    reader.readAsText(file);
  };

  const totalRecords = payload
    ? Object.values(payload.recordCounts || {}).reduce((a, v) => a + (Number(v) || 0), 0)
    : 0;

  return (
    <div>
      <SubPageHeader title="النسخ الاحتياطي" onBack={onBack} />
      <div className="px-4 pt-3">
        {/* النسخة التجريبية */}
        {/* ── تصفير كامل ── */}
        <p style={{ color: "var(--bad)" }} className="text-xs font-bold mb-2">
          تصفير التطبيق
        </p>
        <Card style={{ padding: 14, marginBottom: 16, border: "1px solid var(--badLine)" }}>
          {resetStep === 0 && (
            <>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
                يمسح كل شيء ويعيد التطبيق لأول تشغيل: المخزون والمبيعات والصناديق
                والموردين والعملاء والمستخدمين. تبدأ من صفر.
              </p>
              <button
                onClick={() => setResetStep(1)}
                className="w-full py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
              >
                تصفير التطبيق
              </button>
            </>
          )}

          {resetStep === 1 && (
            <>
              <p style={{ color: "var(--bad)" }} className="text-xs font-bold mb-1 flex items-center gap-1.5">
                <AlertTriangle size={13} /> لا رجعة بعد التصفير
              </p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
                نزّل نسخة احتياطية أولًا إن كانت لديك بيانات تهمّك. بدونها لن تسترجع شيئًا.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setResetStep(0)}
                  className="py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
                >
                  تراجع
                </button>
                <button
                  onClick={() => setResetStep(2)}
                  className="py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
                >
                  فهمت — تابع
                </button>
              </div>
            </>
          )}

          {resetStep === 2 && (
            <>
              <p style={{ color: "var(--bad)" }} className="text-xs font-bold mb-2">
                التأكيد الأخير
              </p>
              {resetBusy && (
                <div style={{ height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ width: `${resetTotal ? (resetDone / resetTotal) * 100 : 0}%`, height: "100%", background: "var(--bad)", transition: "width .2s" }} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setResetStep(0)}
                  disabled={resetBusy}
                  className="py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
                >
                  إلغاء
                </button>
                <button
                  disabled={resetBusy}
                  onClick={async () => {
                    setResetBusy(true);
                    setResetDone(0);
                    await onResetAll((d, t) => {
                      setResetDone(d);
                      setResetTotal(t);
                    });
                    setResetBusy(false);
                    setResetStep(0);
                  }}
                  className="py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: resetBusy ? "var(--accentBg)" : "var(--bad)", color: resetBusy ? "var(--text3)" : "var(--bg)" }}
                >
                  {resetBusy ? `${resetDone}/${resetTotal || "…"}` : "امسح كل شيء"}
                </button>
              </div>
            </>
          )}
        </Card>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          نسخة فرعي تجريبي
        </p>
        <Card style={{ padding: 14, marginBottom: 16, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
            محل كامل ببيانات متوازنة للاختبار: 3 موظفين · 3 موردين · مكتبا تسكير · 3 عملاء · شريكان ·
            3 عمليات شراء (نقدي · آجل · سداد بالكسر) · جلسات إدخال · هالك · شراء كسر · تسكيرات ·
            4 فواتير بيع (نقدي · شبكة بعمولة · آجل · مقسّم) · تحصيل · مصروفات ورواتب وسحبيات ·
            إصلاح · حجز بعربون · ذهب أمانة · جرد · يوم عمل مفتوح.
          </p>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
            الأرقام السرية: 9999 مدير · 2222 نائب · 1111 بائع
          </p>

          {!demoConfirm ? (
            <button
              onClick={() => setDemoConfirm(true)}
              className="w-full py-2.5 rounded-xl text-xs font-bold"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
            >
              تحميل النسخة التجريبية
            </button>
          ) : (
            <>
              <p style={{ color: "var(--bad)" }} className="text-[11px] font-bold mb-1">
                تحذير: ستحلّ محل كل بياناتك الحالية
              </p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
                نزّل نسخة احتياطية أولًا إن كان لديك بيانات فعلية. يمكنك إعادة تحميل النسخة التجريبية في أي وقت للرجوع لنفس نقطة البداية.
              </p>
              {demoBusy && (
                <div style={{ height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ width: `${demoTotal ? (demoDone / demoTotal) * 100 : 0}%`, height: "100%", background: "var(--accent)", transition: "width .2s" }} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDemoConfirm(false)}
                  className="py-2 rounded-xl text-xs font-bold"
                  style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
                >
                  إلغاء
                </button>
                <button
                  disabled={demoBusy}
                  onClick={async () => {
                    setDemoBusy(true);
                    setDemoDone(0);
                    await onLoadDemo((done, total) => {
                      setDemoDone(done);
                      setDemoTotal(total);
                    });
                    setDemoBusy(false);
                    setDemoConfirm(false);
                  }}
                  className="py-2 rounded-xl text-xs font-bold"
                  style={{ background: demoBusy ? "var(--accentBg)" : "var(--badBg)", color: demoBusy ? "var(--text3)" : "var(--bad)", border: "1px solid var(--badLine)" }}
                >
                  {demoBusy ? `${demoDone}/${demoTotal || "…"}` : "تأكيد التحميل"}
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
      <div className="px-4 pt-3">
        <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--badLine)" }}>
          <p style={{ color: "var(--bad)" }} className="text-xs font-bold flex items-center gap-1.5">
            <AlertTriangle size={13} /> خُذ نسخة أسبوعيًا على الأقل
          </p>
          <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
            بياناتك محفوظة على هذا الجهاز فقط. عطل واحد أو مسح للتطبيق يعني ضياع كل الدفاتر بلا استرجاع.
          </p>
        </Card>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">تصدير نسخة</p>
        <Card style={{ padding: 14, marginBottom: 16 }}>
          <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
            يُنزَّل ملف واحد يحوي كل شيء: المخزون والمبيعات والصناديق والموردين والعملاء والشركاء والمصروفات والإعدادات.
          </p>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
            <b>لا تشمل النسخة صور الفواتير المرفقة</b> — حجمها كبير ويتجاوز حدود الملف. احتفظ بها منفصلة إن كنت تحتاجها.
          </p>
          <Field label="كلمة سر التشفير (اختيارية — 6 أحرف فأكثر)">
            <input
              style={inputStyle}
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="اتركها فارغة لنسخة غير مشفّرة"
            />
          </Field>
          <p
            className="text-[11px] mb-3"
            style={{ color: pw.length >= 6 ? "var(--goodSolid)" : pw.length > 0 ? "var(--bad)" : "var(--accentSoft)" }}
          >
            {pw.length >= 6
              ? "✓ ستُشفّر بـAES-256 — احفظ كلمة السر، بلا استرجاع لها"
              : pw.length > 0
              ? "كلمة السر قصيرة — ستة أحرف فأكثر"
              : "⚠ النسخة غير المشفّرة تكشف أرصدتك وعملاءك ورواتبك لمن يجد الملف"}
          </p>
          <button
            onClick={() => onBackup(pw)}
            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
          >
            <Database size={17} /> تنزيل النسخة الآن
          </button>
        </Card>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">استعادة نسخة</p>
        <Card style={{ padding: 14, marginBottom: 20 }}>
          <p style={{ color: "var(--bad)" }} className="text-[11px] mb-3">
            الاستعادة تكتب فوق كل بياناتك الحالية ولا يمكن التراجع عنها. خُذ نسخة قبلها.
          </p>
          <label
            className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
          >
            <Paperclip size={15} /> {fileName || "اختر ملف النسخة"}
            <input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => readFile(e.target.files?.[0])} />
          </label>

          {error && <p style={{ color: "var(--bad)" }} className="text-[11px] mt-2">{error}</p>}

          {payload && (
            <>
              <Card style={{ padding: 10, marginTop: 10, background: "var(--bg)" }}>
                <p style={{ color: "var(--text)" }} className="text-xs font-bold">محتوى النسخة</p>
                <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                  تاريخها: {new Date(payload.exportedAt).toLocaleString("en-GB")}
                  {payload.exportedBy ? ` · بواسطة ${payload.exportedBy}` : ""}
                </p>
                <p style={{ color: "var(--text2)" }} className="text-[11px]">
                  {Object.keys(payload.data || {}).length} مخزن · {totalRecords} سجل
                </p>
              </Card>

              {/* ⚠ إصلاح محلي: الملف المشفّر يحتاج كلمة سر تُمرَّر إلى
                  onRestore(payload, restorePw)، لكن لم يكن يوجد أي حقل
                  إدخال مربوط بـrestorePw في كامل الشاشة — فتُرسَل كلمة
                  سر فارغة دائمًا ويستحيل استعادة أي نسخة مشفّرة نهائيًا. */}
              {payload.encrypted && (
                <Field label="كلمة سر فك التشفير">
                  <input
                    style={inputStyle}
                    type="password"
                    value={restorePw}
                    onChange={(e) => setRestorePw(e.target.value)}
                    placeholder="كلمة السر التي أُدخلت عند التصدير"
                  />
                </Field>
              )}

              {!confirm ? (
                <button
                  onClick={() => setConfirm(true)}
                  className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
                >
                  استعادة هذه النسخة
                </button>
              ) : (
                <Card style={{ padding: 12, marginTop: 10, border: "1px solid var(--badLine)" }}>
                  <p style={{ color: "var(--bad)" }} className="text-xs font-bold mb-2">
                    تأكيد نهائي — لا تراجع
                  </p>
                  <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
                    ستُمحى بياناتك الحالية وتحلّ محلها بيانات {new Date(payload.exportedAt).toLocaleDateString("en-GB")}.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setConfirm(false)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                      إلغاء
                    </button>
                    <button
                      onClick={() => onRestore(payload, restorePw)}
                      className="py-2 rounded-xl text-xs font-bold"
                      style={{ background: "var(--bad)", color: "var(--panel)" }}
                    >
                      نعم، استعد
                    </button>
                  </div>
                </Card>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// جرد الخزنة الفعلي — نقدًا وذهبًا
// ============================================================

export { BackupPage };
