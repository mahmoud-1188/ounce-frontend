import React, { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { EXT_SAMPLE } from "../core/constants.js";
import { EXT_STATUS } from "../core/workflow.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { Stat } from "../ui/Stat.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function IntegrationPage({ config, log, users, items, onSave, onTest, onBack }) {
  const [cfg, setCfg] = useState(config);
  const [tab, setTab] = useState("settings");
  const [testText, setTestText] = useState(JSON.stringify(EXT_SAMPLE, null, 2));
  const [testResult, setTestResult] = useState(null);

  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  const accepted = log.filter((x) => x.status === "accepted").length;
  const rejected = log.filter((x) => x.status === "rejected").length;
  const dup = log.filter((x) => x.status === "duplicate").length;

  return (
    <div>
      <SubPageHeader title="الربط مع الأنظمة الأخرى" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { id: "settings", label: "الإعدادات" },
            { id: "spec", label: "المواصفة" },
            { id: "log", label: `السجل (${log.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="py-2 rounded-xl text-[11px] font-bold"
              style={{ background: tab === t.id ? "var(--accentBg)" : "var(--panel)", color: tab === t.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "settings" && (
          <>
            <Card style={{ padding: 14, marginBottom: 12 }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                  تفعيل الاستقبال
                </span>
                <button
                  onClick={() => set("enabled", !cfg.enabled)}
                  style={{ width: 46, height: 25, borderRadius: 13, background: cfg.enabled ? "var(--goodSolid)" : "var(--edge)", position: "relative", transition: "background .2s" }}
                >
                  <div style={{ width: 19, height: 19, borderRadius: "50%", background: "var(--text)", position: "absolute", top: 3, right: cfg.enabled ? 24 : 3, transition: "right .2s" }} />
                </button>
              </div>
              <Field label="اسم النظام المرتبط">
                <input style={inputStyle} value={cfg.systemName} onChange={(e) => set("systemName", e.target.value)} placeholder="مثال: نظام نقاط البيع" />
              </Field>
              <Field label="مفتاح الربط (API Key)">
                <input style={inputStyle} value={cfg.apiKey} onChange={(e) => set("apiKey", e.target.value)} placeholder="يولّده الطرف الآخر" />
              </Field>
              <Field label="عنوان الاستقبال (Endpoint)">
                <input style={inputStyle} value={cfg.endpoint} onChange={(e) => set("endpoint", e.target.value)} placeholder="https://..." dir="ltr" />
              </Field>
            </Card>

            <Card style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
                مطابقة الأصناف
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { id: "unitCode", label: "برقم الرقاقة", hint: "الأدق — يحدد القطعة" },
                  { id: "sku", label: "بكود الصنف", hint: "يختار أول متاح" },
                ].map((o) => (
                  <button
                    key={o.id}
                    onClick={() => set("matchBy", o.id)}
                    className="py-2 rounded-xl text-[11px] font-bold text-right px-2.5"
                    style={{ background: cfg.matchBy === o.id ? "var(--accentBg)" : "var(--panel)", color: cfg.matchBy === o.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
                  >
                    {o.label}
                    <span style={{ color: "var(--text3)" }} className="block text-[10px]">{o.hint}</span>
                  </button>
                ))}
              </div>

              <Field label="البائع الافتراضي (حين لا يرسله النظام الآخر)">
                <select style={inputStyle} value={cfg.defaultSellerId || ""} onChange={(e) => set("defaultSellerId", e.target.value || null)}>
                  <option value="">بلا افتراضي — ترفض الفاتورة</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}{u.ref ? ` (${u.ref})` : ""}</option>
                  ))}
                </select>
              </Field>

              {[
                ["autoDeductStock", "خصم القطع من المخزون تلقائيًا", "أطفئه للمراجعة اليدوية"],
                ["requireKnownItems", "رفض الأصناف غير الموجودة", "يمنع بيع ما ليس في مخزونك"],
              ].map(([k, label, hint]) => (
                <div key={k} className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--line)" }}>
                  <span>
                    <span style={{ color: "var(--text)" }} className="text-xs">{label}</span>
                    <span style={{ color: "var(--text3)" }} className="block text-[10px]">{hint}</span>
                  </span>
                  <button
                    onClick={() => set(k, !cfg[k])}
                    style={{ width: 42, height: 23, borderRadius: 12, background: cfg[k] ? "var(--goodSolid)" : "var(--edge)", position: "relative", flexShrink: 0 }}
                  >
                    <div style={{ width: 17, height: 17, borderRadius: "50%", background: "var(--text)", position: "absolute", top: 3, right: cfg[k] ? 22 : 3, transition: "right .2s" }} />
                  </button>
                </div>
              ))}
            </Card>

            <button
              onClick={() => onSave(cfg)}
              className="w-full py-3 rounded-xl font-bold mb-4"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
            >
              حفظ إعدادات الربط
            </button>
          </>
        )}

        {tab === "spec" && (
          <>
            <Card style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
                كيف يرسل النظام الآخر فاتورة
              </p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
                يستدعي الدالة العالمية داخل التطبيق، أو يرسل نفس الحمولة للخادم عند الربط الفعلي:
              </p>
              <pre
                dir="ltr"
                style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 10, color: "var(--accentText)", fontSize: 10, overflowX: "auto", margin: 0 }}
              >
{`window.ounceReceiveInvoice(payload)
// → { ok, status, saleRef, errors }`}
              </pre>
            </Card>

            <Card style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
                شكل الحمولة
              </p>
              <pre
                dir="ltr"
                style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 10, color: "var(--text2)", fontSize: 10, overflowX: "auto", margin: 0, lineHeight: 1.6 }}
              >
{JSON.stringify(EXT_SAMPLE, null, 2)}
              </pre>
            </Card>

            <Card style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
                الحقول
              </p>
              {[
                ["externalId", "إجباري", "معرّف الفاتورة عند النظام الآخر — يمنع التكرار"],
                ["lines[]", "إجباري", "unitCodes أو sku أو itemId · quantity · unitPrice"],
                ["sellerRef", "موصى بشدة", "الرقم الوظيفي للبائع (EMP-001) — به تُنسب العمولة ويُقاس الأداء"],
                ["customerPhone", "اختياري", "لربط الفاتورة بعميل · إجباري للبيع الآجل"],
                ["paymentMethod", "اختياري", "cash · card · credit · split (الافتراضي cash)"],
                ["cardNetwork", "اختياري", "mada · visa · mastercard · amex — لحساب العمولة"],
                ["total", "اختياري", "إن أُرسل يُطابَق بمجموع الأصناف ويُرفض عند الاختلاف"],
                ["taxAmount", "اختياري", "قيمة الضريبة إن كانت الفاتورة خاضعة"],
              ].map(([f, req, desc], i) => (
                <div key={i} className="py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                  <div className="flex items-center gap-2">
                    <code style={{ color: "var(--accent)", fontSize: 11 }} dir="ltr">{f}</code>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background: "var(--panel)", color: req === "إجباري" ? "var(--bad)" : req === "موصى" ? "var(--accent)" : "var(--text3)" }}
                    >
                      {req}
                    </span>
                  </div>
                  <p style={{ color: "var(--text2)" }} className="text-[11px] mt-0.5">{desc}</p>
                </div>
              ))}
            </Card>

            <Card style={{ padding: 14, marginBottom: 16, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
                تجربة فاتورة
              </p>
              <textarea
                dir="ltr"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                style={{ ...inputStyle, minHeight: 150, fontSize: 10, fontFamily: "monospace", lineHeight: 1.5 }}
              />
              <button
                onClick={() => {
                  try {
                    const payload = JSON.parse(testText);
                    setTestResult(onTest(payload));
                  } catch (e) {
                    setTestResult({ ok: false, errors: ["الحمولة ليست JSON صالحًا"] });
                  }
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold mt-2"
                style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
              >
                إرسال تجريبي
              </button>
              {testResult && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "var(--bg)", border: `1px solid ${testResult.ok ? "var(--goodLine)" : "var(--badLine)"}` }}>
                  <p style={{ color: testResult.ok ? "var(--goodSolid)" : "var(--bad)" }} className="text-xs font-bold">
                    {testResult.ok ? `قُبلت — ${testResult.saleRef}` : "رُفضت"}
                  </p>
                  {(testResult.errors || []).map((e, i) => (
                    <p key={i} style={{ color: "var(--text2)" }} className="text-[11px] mt-1">• {e}</p>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {tab === "log" && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Stat label="مقبولة" value={accepted} accent="var(--goodSolid)" />
              <Stat label="مرفوضة" value={rejected} accent={rejected ? "var(--bad)" : undefined} />
              <Stat label="مكررة" value={dup} />
            </div>
            {log.length === 0 ? (
              <EmptyState icon={<ArrowLeftRight size={32} color="var(--accentText)" />} title="لا فواتير واردة" sub="ستظهر هنا فور استقبالها" />
            ) : (
              <div className="flex flex-col gap-2">
                {log.slice(0, 60).map((x) => {
                  const st = EXT_STATUS[x.status] || EXT_STATUS.rejected;
                  return (
                    <Card key={x.id} style={{ padding: 12 }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: "var(--text)", fontFamily: "monospace" }} className="text-xs font-bold" dir="ltr">
                          {x.externalId}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--panel)", color: st.color }}>
                          {st.label}
                        </span>
                      </div>
                      <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                        {x.source} · {new Date(x.receivedAt).toLocaleString("en-GB")}
                        {x.saleId ? " · سُجّلت" : ""}
                      </p>
                      {x.sellerRef && (
                        <p style={{ color: x.sellerMatchedBy === "ref" ? "var(--goodSolid)" : "var(--accent)" }} className="text-[10px] mt-0.5">
                          البائع {x.sellerRef}
                          {x.sellerName ? ` — ${x.sellerName}` : ""}
                          {x.sellerMatchedBy === "default" ? " (افتراضي — لم يُرسل رقم وظيفي)" : ""}
                          {x.sellerMatchedBy === "name" ? " (طوبق بالاسم)" : ""}
                        </p>
                      )}
                      {(x.errors || []).map((e, i) => (
                        <p key={i} style={{ color: "var(--bad)" }} className="text-[11px] mt-0.5">• {e}</p>
                      ))}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// المتجر الإلكتروني
// ============================================================

export { IntegrationPage };
