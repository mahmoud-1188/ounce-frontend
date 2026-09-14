import React, { useState } from "react";
import { AlertTriangle, Package } from "lucide-react";
import { STORE_SAMPLE } from "../core/constants.js";
import { fmt, fmtW } from "../core/money.js";
import { buildStockFeed } from "../domain/buildStockFeed.js";
import { categoryLabel, inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { Stat } from "../ui/Stat.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function StoreLinkPage({ config, orders, items, onSave, onTest, onBack }) {
  const [cfg, setCfg] = useState(config);
  const [tab, setTab] = useState("settings");
  const [testText, setTestText] = useState(JSON.stringify(STORE_SAMPLE, null, 2));
  const [testResult, setTestResult] = useState(null);
  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));

  const feed = buildStockFeed(items, cfg);
  const held = items.flatMap((it) => (it.units || []).filter((u) => u.onlineStatus === "reserved"));
  const soldOnline = items.flatMap((it) => (it.units || []).filter((u) => u.onlineStatus === "sold"));

  return (
    <div>
      <SubPageHeader title="المتجر الإلكتروني" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { id: "settings", label: "الإعدادات" },
            { id: "stock", label: "المخزون" },
            { id: "orders", label: `الطلبات (${orders.length})` },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="py-2 rounded-xl text-[11px] font-bold"
              style={{ background: tab === t.id ? "var(--accentBg)" : "var(--panel)", color: tab === t.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "settings" && (
          <>
            <Card style={{ padding: 14, marginBottom: 12 }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ color: "var(--text)" }} className="text-sm font-bold">تفعيل المتجر</span>
                <button onClick={() => set("enabled", !cfg.enabled)}
                  style={{ width: 46, height: 25, borderRadius: 13, background: cfg.enabled ? "var(--goodSolid)" : "var(--edge)", position: "relative" }}>
                  <div style={{ width: 19, height: 19, borderRadius: "50%", background: "var(--text)", position: "absolute", top: 3, right: cfg.enabled ? 24 : 3, transition: "right .2s" }} />
                </button>
              </div>
              <Field label="اسم المتجر">
                <input style={inputStyle} value={cfg.storeName} onChange={(e) => set("storeName", e.target.value)} placeholder="مثال: متجر أوقية" />
              </Field>
              <Field label="مفتاح الربط">
                <input style={inputStyle} value={cfg.apiKey} onChange={(e) => set("apiKey", e.target.value)} dir="ltr" />
              </Field>
              <Field label="عنوان إشعارات المتجر (Webhook)">
                <input style={inputStyle} value={cfg.webhookUrl} onChange={(e) => set("webhookUrl", e.target.value)} placeholder="https://..." dir="ltr" />
                <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                  يُرسل عليه تنبيه النفاد وتحديث المخزون.
                </p>
              </Field>
            </Card>

            <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-1">الحجز عند الطلب</p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
                تُحجز القطعة فور وصول الطلب قبل الدفع، فلا يبيعها البائع في المحل خلال الفجوة بين الطلب والدفع — وهي الفجوة التي يقع فيها التصادم عادةً.
              </p>
              <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text)" }} className="text-xs">تفعيل الحجز</span>
                <button onClick={() => set("holdOnOrder", !cfg.holdOnOrder)}
                  style={{ width: 42, height: 23, borderRadius: 12, background: cfg.holdOnOrder ? "var(--goodSolid)" : "var(--edge)", position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 17, height: 17, borderRadius: "50%", background: "var(--text)", position: "absolute", top: 3, right: cfg.holdOnOrder ? 22 : 3, transition: "right .2s" }} />
                </button>
              </div>
              <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--line)" }}>
                <span>
                  <span style={{ color: "var(--text)" }} className="text-xs">نشر المخزون تلقائيًا</span>
                  <span style={{ color: "var(--text3)" }} className="block text-[10px]">يُخفي المتجر ما نفد فورًا</span>
                </span>
                <button onClick={() => set("autoPublishStock", !cfg.autoPublishStock)}
                  style={{ width: 42, height: 23, borderRadius: 12, background: cfg.autoPublishStock ? "var(--goodSolid)" : "var(--edge)", position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 17, height: 17, borderRadius: "50%", background: "var(--text)", position: "absolute", top: 3, right: cfg.autoPublishStock ? 22 : 3, transition: "right .2s" }} />
                </button>
              </div>
              <Field label="تنبيه قرب النفاد عند (قطعة أو أقل)">
                <NumericInput value={String(cfg.lowStockAlert ?? 1)} onChange={(v) => set("lowStockAlert", Number(v) || 0)} />
              </Field>
            </Card>

            <button onClick={() => onSave(cfg)} className="w-full py-3 rounded-xl font-bold mb-4"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
              حفظ إعدادات المتجر
            </button>
          </>
        )}

        {tab === "stock" && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Stat label="معروض للمتجر" value={feed.totalItems} accent="var(--goodSolid)" />
              <Stat label="محجوز" value={held.length} accent={held.length ? "var(--accent)" : undefined} />
              <Stat label="مباع أونلاين" value={soldOnline.length} accent={soldOnline.length ? "var(--bad)" : undefined} />
            </div>

            {feed.lowStock.length > 0 && (
              <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
                <p style={{ color: "var(--accent)" }} className="text-xs font-bold flex items-center gap-1.5">
                  <AlertTriangle size={13} /> {feed.lowStock.length} صنف قارب النفاد
                </p>
              </Card>
            )}

            <p style={{ color: "var(--text2)" }} className="text-xs mb-2">ما يراه المتجر الآن</p>
            {feed.items.length === 0 ? (
              <EmptyState icon={<Package size={32} color="var(--accentText)" />} title="لا مخزون متاح للنشر" sub="كل القطع مباعة أو محجوزة" />
            ) : (
              <div className="flex flex-col gap-2">
                {feed.items.slice(0, 60).map((r) => (
                  <Card key={r.itemId} style={{ padding: 10 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                        {categoryLabel(r.category)} · عيار {r.karat} · {fmtW(r.weight)} جم
                      </span>
                      <span style={{ color: r.lowStock ? "var(--accent)" : "var(--goodSolid)" }} className="text-xs font-bold">
                        {r.available} متاح
                      </span>
                    </div>
                    {r.sku && <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5" dir="ltr">{r.sku}</p>}
                  </Card>
                ))}
              </div>
            )}

            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-4">تجربة طلب</p>
            <Card style={{ padding: 14, marginBottom: 16 }}>
              <textarea dir="ltr" value={testText} onChange={(e) => setTestText(e.target.value)}
                style={{ ...inputStyle, minHeight: 140, fontSize: 10, fontFamily: "monospace", lineHeight: 1.5 }} />
              <button
                onClick={() => {
                  try {
                    setTestResult(onTest(JSON.parse(testText)));
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
                    {testResult.ok ? `${testResult.status === "reserved" ? "حُجزت" : testResult.status === "cancelled" ? "أُلغي" : "بيع"} — ${testResult.saleRef || ""}` : "رُفض"}
                  </p>
                  {(testResult.outOfStock || []).length > 0 && (
                    <p style={{ color: "var(--accent)" }} className="text-[11px] mt-1">
                      نفد ويُخفى من المتجر: {testResult.outOfStock.join("، ")}
                    </p>
                  )}
                  {(testResult.errors || []).map((e, i) => (
                    <p key={i} style={{ color: "var(--text2)" }} className="text-[11px] mt-1">• {e}</p>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {tab === "orders" && (
          <>
            {orders.length === 0 ? (
              <EmptyState icon={<Package size={32} color="var(--accentText)" />} title="لا طلبات" sub="ستظهر هنا فور وصولها" />
            ) : (
              <div className="flex flex-col gap-2">
                {orders.slice(0, 60).map((o) => {
                  const color =
                    o.status === "paid" ? "var(--goodSolid)" : o.status === "pending" ? "var(--accent)" :
                    o.status === "cancelled" ? "var(--text2)" : "var(--bad)";
                  const label =
                    o.status === "paid" ? "مدفوع" : o.status === "pending" ? "محجوز" :
                    o.status === "cancelled" ? "ملغى" : o.status === "duplicate" ? "مكرر" : "مرفوض";
                  return (
                    <Card key={o.id} style={{ padding: 12 }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: "var(--text)", fontFamily: "monospace" }} className="text-xs font-bold" dir="ltr">
                          {o.orderId}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--panel)", color }}>
                          {label}
                        </span>
                      </div>
                      <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                        {o.store} · {new Date(o.receivedAt).toLocaleString("en-GB")}
                        {o.customerName ? ` · ${o.customerName}` : ""}
                        {o.total > 0 ? ` · ${fmt(o.total, 0)}` : ""}
                      </p>
                      {(o.outOfStock || []).length > 0 && (
                        <p style={{ color: "var(--accent)" }} className="text-[11px] mt-0.5">
                          نفد: {o.outOfStock.join("، ")}
                        </p>
                      )}
                      {(o.errors || []).map((e, i) => (
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
// التحويلات — بين الكسر والمخزون
// ============================================================

export { StoreLinkPage };
