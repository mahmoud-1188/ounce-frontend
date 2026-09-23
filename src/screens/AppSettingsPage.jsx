import React, { useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { APP_MODES, DEFAULT_APP_MODE, DEFAULT_SETTINGS } from "../core/constants.js";
import { KARATS, fmt, pricePerGram } from "../core/money.js";
import { CARD_NETWORKS, DEFAULT_CARD_FEES, DEFAULT_MARGINS } from "../core/money-rules.js";
import { DEFAULT_THEME, THEMES, applyTheme } from "../core/theme.js";
import { hashPin } from "../domain/hashPin.js";
import { generateRecoveryCode, inputStyle, normalizeRecovery, openWhatsApp, prettyPhone, toIntlPhone } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { verifyToken } from "../domain/verifyToken.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { MgrFeeSettingsCard } from "../ui/MgrFeeSettingsCard.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { RfidSettingsCard } from "../ui/RfidSettingsCard.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function AppSettingsPage({ settings, onSave, branchIdentity, onSaveBranch, hqPermissions, priceData = {}, onBackfill, onBack }) {
  const [newRecovery, setNewRecovery] = useState("");
  const [fees, setFees] = useState(() => ({ ...DEFAULT_CARD_FEES, ...(settings.cardFees || {}) }));
  const [margins, setMargins] = useState(() => ({ ...DEFAULT_MARGINS, ...(settings.marginByKarat || {}) }));
  const [adj, setAdj] = useState(() => ({ ...DEFAULT_SETTINGS.priceAdjust, ...(settings.priceAdjust || {}) }));
  const [taxEnabled, setTaxEnabled] = useState(settings.taxEnabled);
  const [taxRate, setTaxRate] = useState(String(settings.taxRate * 100));
  const [activationCode, setActivationCode] = useState("");
  // The branch can no longer be linked by typing an arbitrary code — it must
  // present an activation code signed by the vendor, which carries the branch
  // code, its name and the owning company.
  const decodedBranch = activationCode.trim() ? verifyToken(activationCode, "BRN") : null;
  const branchValid = !!decodedBranch?.ok;
  const hasOverride = !!hqPermissions?.byBranch?.[branchIdentity?.code];
  const valid = Number(taxRate) >= 0 && Number(taxRate) <= 100;

  return (
    <div>
      <SubPageHeader title="الإعدادات" onBack={onBack} />
      <div className="px-4 pt-3">

        {/* ── وضع التطبيق ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          وضع التطبيق
        </p>
        <div className="grid grid-cols-1 gap-2 mb-2">
          {Object.entries(APP_MODES).map(([id, m]) => {
            const on = (settings.appMode || DEFAULT_APP_MODE) === id;
            return (
              <button
                key={id}
                onClick={() => onSave({ ...settings, appMode: id })}
                aria-pressed={on}
                className="text-right rounded-2xl p-3"
                style={{
                  background: on ? "var(--accentBg)" : "var(--panel)",
                  border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: on ? "var(--accent)" : "var(--text)" }}
                    className="text-xs font-bold flex-1">{m.label}</span>
                  {on && <Check size={15} color="var(--accent)" />}
                </div>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">
                  {m.hint}
                </p>
              </button>
            );
          })}
        </div>
        <p style={{ color: "var(--text3)" }} className="text-[10px] mb-4">
          ⚖ التغيير لا يمسّ البيانات — من بدأ بالمخزون ثم أراد البيع يجد
          كل شيء كما تركه.
        </p>

        {/* ── السمة ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          شكل التطبيق
        </p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {Object.entries(THEMES).map(([id, t]) => {
            const on = (settings.theme || DEFAULT_THEME) === id;
            return (
              <button
                key={id}
                onClick={() => {
                  // ⚠ نُطبّقها فورًا لا عند الحفظ: اختيار شكلٍ بلا رؤيته
                  // اختيارٌ أعمى، والمستخدم يحفظ ثم يندم.
                  // ⚠ نُطبّقها ونحفظها معًا: الإعدادات هنا تُحفظ فورًا
                  // لا بزرّ، فتأجيل الحفظ يجعل الاختيار يضيع بالخروج.
                  applyTheme(id);
                  onSave({ ...settings, theme: id });
                }}
                aria-pressed={on}
                className="text-right rounded-2xl p-3"
                style={{
                  background: on ? "var(--accentBg)" : "var(--panel)",
                  border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`,
                }}
              >
                {/* عيّنة الألوان */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  {t.swatch.map((c, i) => (
                    <span
                      key={i}
                      style={{
                        width: 18, height: 18, borderRadius: 6, background: c,
                        border: "1px solid rgba(128,128,128,.25)", display: "block",
                      }}
                    />
                  ))}
                  {on && <Check size={15} color="var(--accent)" style={{ marginRight: "auto" }} />}
                </div>
                <p
                  style={{ color: on ? "var(--accent)" : "var(--text)", margin: 0 }}
                  className="text-xs font-bold"
                >
                  {t.label}
                </p>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-snug">
                  {t.hint}
                </p>
              </button>
            );
          })}
        </div>
        <p style={{ color: "var(--text3)" }} className="text-[10px] mb-4">
          الذهبي الداكن هو الأصل — لا يبهر العين في إضاءة المحل ساعات العمل الطويلة.
        </p>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          يوم العمل
        </p>
        <Card style={{ padding: 14, marginBottom: 12, border: `1px solid ${settings.workdayMode !== "off" ? "var(--goodLine)" : "var(--edge)"}` }}>
          <div className="flex items-center justify-between mb-1">
            <span style={{ color: "var(--text)" }} className="text-sm font-bold">
              {settings.workdayMode !== "off" ? "مفعّل — يُفتح صباحًا ويُقفل مساءً" : "مطفأ — الحركات تُسجَّل بلا يوم"}
            </span>
            <button
              aria-label="يوم العمل"
              onClick={() => onSave({ ...settings, workdayMode: settings.workdayMode !== "off" ? "off" : "required" })}
              style={{
                width: 46, height: 25, borderRadius: 13, position: "relative", flexShrink: 0,
                background: settings.workdayMode !== "off" ? "var(--goodSolid)" : "var(--edge)", transition: "background .2s",
              }}
            >
              <div style={{ width: 19, height: 19, borderRadius: "50%", background: "var(--text)",
                position: "absolute", top: 3, right: settings.workdayMode !== "off" ? 24 : 3, transition: "right .2s" }} />
            </button>
          </div>
          <p style={{ color: "var(--text2)" }} className="text-[11px]">
            {settings.workdayMode !== "off"
              ? "كل بيعٍ وشراءٍ ومرتجع يحتاج يومًا مفتوحًا، وإقفال اليوم يُورّد الصندوق ويكتب لقطة أرقامه."
              : "لا فتحَ ولا إقفال: البيع والشراء تعمل مباشرة. تفقد تقارير اليوم وتوريد الصندوق المسائي — الجرد والقوائم لا تتأثر."}
          </p>
          {settings.workdayMode === "off" && (
            <p style={{ color: "var(--accentText)" }} className="text-[11px] mt-1.5">
              ⚠ من لا يُقفل يومه لا يكتشف عجز الدرج في يومه — راجع الصندوق دوريًّا من جرد الخزنة.
            </p>
          )}
        </Card>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          الحماية بالرقم السري
        </p>
        <Card style={{ padding: 14, marginBottom: 12, border: `1px solid ${settings.requirePin ? "var(--goodLine)" : "var(--edge)"}` }}>
          <div className="flex items-center justify-between mb-1">
            <span style={{ color: "var(--text)" }} className="text-sm font-bold">
              {settings.requirePin ? "مفعّلة" : "مطفأة"}
            </span>
            <button
              onClick={() => onSave({ ...settings, requirePin: !settings.requirePin })}
              style={{
                width: 46, height: 25, borderRadius: 13, position: "relative",
                background: settings.requirePin ? "var(--goodSolid)" : "var(--edge)", transition: "background .2s",
              }}
            >
              <div style={{ width: 19, height: 19, borderRadius: "50%", background: "var(--text)",
                position: "absolute", top: 3, right: settings.requirePin ? 24 : 3, transition: "right .2s" }} />
            </button>
          </div>
          <p style={{ color: "var(--text2)" }} className="text-[11px]">
            {settings.requirePin
              ? "يُطلب الرقم السري عند كل دخول. لكل مستخدم رقمه من صفحة الصلاحيات."
              : "الدخول باختيار الاسم فقط — أسرع، لكن من يفتح الجهاز يفتح التطبيق."}
          </p>
          {!settings.requirePin && (
            <p style={{ color: "var(--accentText)" }} className="text-[11px] mt-1.5">
              ⚠ فعّلها إن كان أكثر من شخص يستخدم الجهاز، أو إن كان رابط التطبيق قد يصل لغيرك.
            </p>
          )}
        </Card>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          مطابقة البنك
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <div className="flex items-center justify-between mb-1">
            <span style={{ color: "var(--text)" }} className="text-sm font-bold">
              {settings.bankReconEnabled ? "مفعّلة" : "مطفأة"}
            </span>
            <button
              onClick={() => onSave({ ...settings, bankReconEnabled: !settings.bankReconEnabled })}
              style={{ width: 46, height: 25, borderRadius: 13, position: "relative",
                background: settings.bankReconEnabled ? "var(--goodSolid)" : "var(--edge)", transition: "background .2s" }}
            >
              <div style={{ width: 19, height: 19, borderRadius: "50%", background: "var(--text)",
                position: "absolute", top: 3, right: settings.bankReconEnabled ? 24 : 3, transition: "right .2s" }} />
            </button>
          </div>
          <p style={{ color: "var(--text2)" }} className="text-[11px]">
            {settings.bankReconEnabled
              ? "شاشة «مطابقة البنك» متاحة في التقارير — استورد كشف حسابك وطابق إيداعات الشبكة."
              : "المحل الذي لا يبيع بالشبكة لا يحتاجها، وشاشة بلا استخدام تزحم القائمة."}
          </p>
        </Card>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          فحص الكسر واعتماده
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
            الكسر لا يدخل الخزنة إلا بعد نزع فصوصه وتثبيت وزنه الصافي. من يفعل ذلك؟
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[
              { id: "hq", label: "الإدارة المركزية", hint: "الفرع يرسل وينتظر الاعتماد" },
              { id: "branch", label: "الفرع نفسه", hint: "المدير يفحص ويعتمد" },
            ].map((o) => {
              const on = (settings.scrapAssayMode || "hq") === o.id;
              return (
                <button key={o.id}
                  onClick={() => onSave({ ...settings, scrapAssayMode: o.id })}
                  className="py-2.5 rounded-xl text-[11px] font-bold text-right px-2.5"
                  style={{
                    background: on ? "var(--accentBg)" : "var(--panel)",
                    color: on ? "var(--accent)" : "var(--text2)",
                    border: `1px solid ${on ? "var(--accentLine)" : "var(--edge)"}`,
                  }}>
                  {o.label}
                  <span style={{ color: "var(--text3)" }} className="block text-[10px]">{o.hint}</span>
                </button>
              );
            })}
          </div>
          <p style={{ color: "var(--text3)" }} className="text-[11px]">
            {(settings.scrapAssayMode || "hq") === "hq"
              ? "فصل من يشتري عمّن يقيّم يمنع تمرير وزن غير مؤكّد."
              : "أسرع، ومناسب للمحل الواحد. المدير وحده يستطيع الفحص والاعتماد."}
          </p>
          <p style={{ color: "var(--accentText)" }} className="text-[11px] mt-2">
            ⚠ في الحالتين: لا يُسدَّد مورد إلا من كسر بلغ الخزنة.
          </p>
        </Card>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          هوامش السعر العالمي
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
            السعر العالمي مرجع لا سعر تعامل. تُثبَّت الهوامش هنا مرة، فتحسب كل شاشة
            من الأساس الصحيح تلقائيًا.
          </p>

          {[
            {
              key: "sell", sign: "+", label: "احتياطي البيع",
              hint: "يُضاف على السعر العالمي — يغطي ارتفاعه بين شرائك وبيعك",
              color: "var(--good)",
            },
            {
              key: "scrap", sign: "−", label: "خصم شراء الكسر",
              hint: "يُخصم عند الشراء — يغطي التصفية والفاقد وهامشك",
              color: "var(--bad)",
            },
          ].map((row) => {
            const mode = adj[row.key + "Mode"] || "amount";
            const val = adj[row.key + "Value"] ?? 0;
            const base = priceData?.current || 0;
            const out =
              row.key === "sell"
                ? mode === "percent" ? base * (1 + (Number(val) || 0) / 100) : base + (Number(val) || 0)
                : Math.max(0, mode === "percent" ? base * (1 - (Number(val) || 0) / 100) : base - (Number(val) || 0));
            return (
              <div key={row.key} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginBottom: 10 }}>
                <p style={{ color: row.color }} className="text-xs font-bold">
                  {row.sign} {row.label}
                </p>
                <p style={{ color: "var(--text3)" }} className="text-[10px] mb-2">{row.hint}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="القيمة">
                    <NumericInput
                      value={String(val)}
                      onChange={(v) => setAdj((p2) => ({ ...p2, [row.key + "Value"]: Number(v) || 0 }))}
                    />
                  </Field>
                  <Field label="الطريقة">
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "amount", label: "ريال" },
                        { id: "percent", label: "٪" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setAdj((p2) => ({ ...p2, [row.key + "Mode"]: m.id }))}
                          className="py-2.5 rounded-xl text-[11px] font-bold"
                          style={{
                            background: mode === m.id ? "var(--accentBg)" : "var(--panel)",
                            color: mode === m.id ? "var(--accent)" : "var(--text2)",
                            border: "1px solid var(--line)",
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
                {base > 0 && (
                  <p style={{ color: "var(--text2)" }} className="text-[11px]">
                    العالمي {fmt(base)} ← <span style={{ color: row.color, fontWeight: 700 }}>{fmt(out)}</span>
                    {" "}للجرام عيار 24
                  </p>
                )}
              </div>
            );
          })}

          <button
            onClick={() => onSave({ ...settings, priceAdjust: adj })}
            className="w-full py-2.5 rounded-xl text-xs font-bold mt-1"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
          >
            حفظ الهوامش
          </button>
        </Card>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          هامش الربح لكل عيار
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
            يُضاف فوق سعر المعدن العالمي. الجزء الوحيد الذي يُعدّ ربحًا تشغيليًا —
            قيمة المعدن نفسها ليست ربحًا.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ padding: 5, color: "var(--accent)", textAlign: "right" }}>العيار</th>
                  <th style={{ padding: 5, color: "var(--accent)" }}>للجرام</th>
                  <th style={{ padding: 5, color: "var(--accent)" }}>ثابت للقطعة</th>
                  <th style={{ padding: 5, color: "var(--text3)" }}>سعر الجرام النهائي</th>
                </tr>
              </thead>
              <tbody>
                {KARATS.map((k) => {
                  const m = margins[k] || { perGram: 0, fixed: 0 };
                  const base = pricePerGram(k, priceData?.current || 0);
                  return (
                    <tr key={k}>
                      <td style={{ padding: 4, color: "var(--text)", fontWeight: 700 }}>{k}</td>
                      <td style={{ padding: 4 }}>
                        <NumericInput
                          value={String(m.perGram ?? 0)}
                          onChange={(v) => setMargins((p) => ({ ...p, [k]: { ...(p[k] || {}), perGram: v } }))}
                        />
                      </td>
                      <td style={{ padding: 4 }}>
                        <NumericInput
                          value={String(m.fixed ?? 0)}
                          onChange={(v) => setMargins((p) => ({ ...p, [k]: { ...(p[k] || {}), fixed: v } }))}
                        />
                      </td>
                      <td style={{ padding: 4, color: "var(--text2)", whiteSpace: "nowrap" }}>
                        {fmt(base + (Number(m.perGram) || 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => {
              const clean = {};
              KARATS.forEach((k) => {
                const m = margins[k] || {};
                clean[k] = { perGram: Math.max(0, Number(m.perGram) || 0), fixed: Math.max(0, Number(m.fixed) || 0) };
              });
              onSave({ ...settings, marginByKarat: clean });
            }}
            className="w-full py-2.5 rounded-xl text-xs font-bold mt-3"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
          >
            حفظ الهوامش
          </button>
        </Card>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          عمولات شبكات البطاقات
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
            نسبة ما يقتطعه البنك من كل عملية. تُقيَّد مصروفًا مستقلًا لا خصمًا من الإيراد.
          </p>
          {CARD_NETWORKS.map((n) => (
            <Field key={n.id} label={`${n.label} (٪)`}>
              <NumericInput
                value={String(fees[n.id] ?? n.defaultFee)}
                onChange={(v) => setFees((p) => ({ ...p, [n.id]: v }))}
                placeholder="0"
              />
            </Field>
          ))}
          <button
            onClick={() => {
              const clean = {};
              CARD_NETWORKS.forEach((n) => {
                const v = Number(fees[n.id]);
                clean[n.id] = Number.isFinite(v) && v >= 0 ? v : 0;
              });
              onSave({ ...settings, cardFees: clean });
            }}
            className="w-full py-2.5 rounded-xl text-xs font-bold"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
          >
            حفظ العمولات
          </button>
        </Card>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          ربط الفرع بالبرنامج المركزي
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
            الصق كود التفعيل الصادر من مزوّد النظام لهذا الفرع. بعد الربط، يُرسل هذا الفرع ملخصًا دوريًا (أرصدة وأرباح ومبيعات فقط — بدون بيانات تفصيلية أو أرقام سرية) ليظهر بتقارير الإدارة.
          </p>
          <Field label="كود تفعيل الفرع (من مزوّد النظام)">
            <textarea
              style={{ ...inputStyle, minHeight: 80, direction: "ltr", textAlign: "left", fontFamily: "monospace", fontSize: 12 }}
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
              placeholder="KB2A-XXXX-XXXX-..."
            />
          </Field>
          {decodedBranch?.ok && (
            <p style={{ color: "var(--good)" }} className="text-[11px] mb-2 flex items-center gap-1">
              <Check size={12} /> {decodedBranch.payload.n} ({decodedBranch.payload.b}) — شركة {decodedBranch.payload.t}
            </p>
          )}
          {activationCode.trim() && decodedBranch && !decodedBranch.ok && (
            <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">
              {decodedBranch.reason}
            </p>
          )}
          {branchIdentity?.code && (
            <p style={{ color: "var(--good)" }} className="text-[11px] mb-2 flex items-center gap-1">
              <Check size={12} /> مرتبط حاليًا بكود: {branchIdentity.code}
            </p>
          )}
          {hasOverride && (
            <p style={{ color: "var(--accentText)" }} className="text-[11px] mb-2 flex items-center gap-1">
              <ShieldCheck size={12} /> الإدارة المركزية طبّقت قيودًا على صلاحيات هذا الفرع
            </p>
          )}
          <button
            disabled={!branchValid}
            onClick={() => onSaveBranch({ code: decodedBranch.payload.b, name: decodedBranch.payload.n, tenantId: decodedBranch.payload.t })}
            className="w-full py-2.5 rounded-xl text-xs font-bold"
            style={{ background: branchValid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: branchValid ? "var(--panel)" : "var(--text3)" }}
          >
            حفظ ربط الفرع
          </button>
        </Card>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          الضريبة
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ color: "var(--text)" }} className="text-sm font-bold">
              تفعيل الضريبة
            </span>
            <button
              onClick={() => setTaxEnabled((v) => !v)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: taxEnabled ? "var(--goodSolid)" : "var(--edge)",
                position: "relative",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "var(--text)",
                  position: "absolute",
                  top: 3,
                  right: taxEnabled ? 23 : 3,
                  transition: "right 0.2s",
                }}
              />
            </button>
          </div>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
            عند التعطيل، يختفي خيار الضريبة تمامًا من شاشة البيع وتُسجَّل كل الفواتير بدون ضريبة.
          </p>
          {taxEnabled && (
            <Field label="نسبة الضريبة %">
              <input style={inputStyle} type="text" inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(sanitizeNumeric(e.target.value))} placeholder="15" />
            </Field>
          )}
        <button
          disabled={!valid}
          onClick={() => onSave({ taxEnabled, taxRate: Number(taxRate) / 100 })}
          className="w-full py-3 rounded-xl font-bold"
          style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
        >
          حفظ إعدادات الضريبة
        </button>
        </Card>

        {/* ── بثّ سعر الذهب ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-4">
          بثّ سعر الذهب
        </p>
        <Card style={{ padding: 12, marginBottom: 12 }}>
          <Field label="عنوان خادم البثّ (اختياري)">
            <input
              style={inputStyle}
              type="url"
              dir="ltr"
              defaultValue={settings?.priceStreamUrl || ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (settings?.priceStreamUrl || "")) {
                  onSave({ ...settings, priceStreamUrl: v });
                }
              }}
              placeholder="https://ounce-price-stream.onrender.com"
            />
          </Field>
          <p style={{ color: "var(--text3)" }} className="text-[10px] leading-6">
            ⚖ اتركه فارغًا ليسأل التطبيق مصادر السوق مباشرةً. واملأه إن
            نشرتَ خادم البثّ — عندها يسأل الخادمُ مرةً ويبثّ لكل الأجهزة،
            فلا يُستهلك حدّ المصدر المجاني.
          </p>
          <p style={{ color: "var(--text3)" }} className="text-[10px] leading-6">
            ⚠ والسعر للنظر لا للفوترة: الفواتير تُحسب بسعر المحل الذي
            تُثبّته أنت.
          </p>
        </Card>

        {/* ── عمولة المدير ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">عمولة المدير</p>
        <MgrFeeSettingsCard settings={settings} onSave={onSave} />

        {/* ── واتساب المحل ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">واتساب المحل</p>
        <Card style={{ padding: 14, marginBottom: 16 }}>
          <Field label="رقم واتساب">
            <input style={inputStyle} inputMode="tel" value={settings.whatsapp || ""}
              onChange={(e) => onSave({ ...settings, whatsapp: e.target.value })}
              placeholder="05xxxxxxxx" />
          </Field>
          {settings.whatsapp && (
            <p style={{ color: toIntlPhone(settings.whatsapp).length >= 11 ? "var(--good)" : "var(--bad)", margin: 0 }}
              className="text-[11px]">
              {toIntlPhone(settings.whatsapp).length >= 11
                ? `✓ ${prettyPhone(settings.whatsapp)} — يُرسل إليه بصيغة ${toIntlPhone(settings.whatsapp)}`
                : "⚠ رقم غير مكتمل"}
            </p>
          )}
          <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[10px] leading-6">
            يُستعمل لإرسال التقارير والسندات. تُفتح رسالةٌ جاهزة في واتساب
            وتضغط إرسال — التطبيق لا يُرسل بنفسك.
          </p>
          {settings.whatsapp && toIntlPhone(settings.whatsapp).length >= 11 && (
            <button onClick={() => openWhatsApp(settings.whatsapp, "رسالة تجربة من تطبيق أوقية ✓")}
              className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold"
              style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
              جرّب الإرسال
            </button>
          )}
        </Card>

        {/* ── استرجاع الرقم السري ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">استرجاع الرقم السري</p>
        <Card style={{ padding: 14, marginBottom: 16 }}>
          {settings.recoveryCode ? (
            <>
              <p style={{ color: "var(--good)", margin: 0 }} className="text-[11px]">✓ رمز استرجاع مُفعَّل</p>
              <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px] leading-6">
                الرمز عندك ولا يُعرض ثانيةً. ولّد غيره إن فقدته — القديم يُلغى.
              </p>
            </>
          ) : (
            <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
              ولّد رمزًا واطبعه واحفظه خارج الجهاز. من نسي رقمه السري يفتح به.
            </p>
          )}
          {newRecovery && (
            <Card style={{ padding: 12, margin: "8px 0", background: "var(--field)", border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">اكتبه الآن — لن يظهر ثانيةً</p>
              <p style={{ color: "var(--accent)", margin: "4px 0", fontFamily: "monospace", letterSpacing: 2 }}
                className="text-[16px] font-bold">{newRecovery}</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button onClick={() => window.print()} className="py-2 rounded-xl text-[11px] font-bold"
                  style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                  اطبع
                </button>
                <button onClick={() => setNewRecovery("")} className="py-2 rounded-xl text-[11px] font-bold"
                  style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                  حفظته
                </button>
              </div>
            </Card>
          )}
          {!newRecovery && (
            <button
              onClick={() => {
                const code = generateRecoveryCode();
                setNewRecovery(code);
                onSave({ ...settings, recoveryCode: hashPin(normalizeRecovery(code), "recovery"),
                  recoveryAt: new Date().toISOString(), recoveryUsedAt: null });
              }}
              className="w-full mt-2 py-2.5 rounded-xl text-[12px] font-bold"
              style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
              {settings.recoveryCode ? "ولّد رمزًا جديدًا" : "ولّد رمز استرجاع"}
            </button>
          )}
          <p style={{ color: "var(--text3)", margin: "8px 0 0" }} className="text-[10px] leading-6">
            ⚠ وإن فقدت كل شيء: استعادة نسخةٍ احتياطية تُعيد الأرقام السرية
            معها، أو اتصل بالدعم من شاشة الدخول ← «نسيت الرقم السري».
          </p>
        </Card>

        {/* ── قارئ RFID ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">قارئ RFID</p>
        <RfidSettingsCard settings={settings} onSave={onSave} currency={priceData.currency} />

        {/* ── ترحيل القيود ── */}
        {onBackfill && (
          <>
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">دفتر القيود</p>
            <Card style={{ padding: 12, marginBottom: 12 }}>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
                الحركات المسجّلة قبل تحديث الدفتر بلا قيود — الميزان يبدأ من يوم
                التحديث. الترحيل يكتب القيد الغائب لكل حركة بتاريخها هي.
              </p>
              <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px] leading-6">
                ⚠ يُشغَّل مرة واحدة. المُرحَّل سلفًا يُتخطّى فلا يتضاعف الميزان.
              </p>
              <button onClick={onBackfill} className="w-full mt-2 py-2.5 rounded-xl text-[12px] font-bold"
                style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                ترحيل القيود بأثر رجعي
              </button>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export { AppSettingsPage };
