import React, { useEffect, useRef, useState } from "react";
import { Check, Coins, Link2, Printer, Puzzle, Settings2, ShieldCheck } from "lucide-react";
import { APP_MODES, DEFAULT_APP_MODE, DEFAULT_SETTINGS } from "../core/constants.js";
import { UI_LANGS, readUiLang, setUiLang } from "../domain/i18n.js";
import { ACCOUNTING_MODES } from "../core/storePackage.js";
import { PayTerminalCard } from "../ui/PayTerminalCard.jsx";
import { BranchProfileCard } from "../ui/BranchProfileCard.jsx";
import { KARATS, fmt, pricePerGram } from "../core/money.js";
import { CARD_NETWORKS, DEFAULT_CARD_FEES, DEFAULT_MARGINS } from "../core/money-rules.js";
import { THEMES, THEME_DESIGNS, applyTheme, designOfTheme, effectiveTheme, isDarkTheme } from "../core/theme.js";
import { hashPin } from "../domain/hashPin.js";
import { generateRecoveryCode, inputStyle, wastageSettingsOf, normalizeRecovery, openWhatsApp, prettyPhone, toIntlPhone } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { verifyToken } from "../domain/verifyToken.js";
import { Card } from "../ui/Card.jsx";
import { ControlsSettingsCard } from "../ui/ControlsSettingsCard.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { RfidSettingsCard } from "../ui/RfidSettingsCard.jsx";
import { ScaleSettingsCard } from "../ui/ScaleSettingsCard.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";
import { InstallAppCard } from "../ui/InstallAppCard.jsx";
import { showStartHere, startHereHidden } from "../ui/StartHereCard.jsx";

/// صفوف الإعدادات الستّة (المرجع م5): الكلمات تعرّف أقسام الصفحة التي تخصّ الصفّ، والشاشات ما يُدار خارجها.
const SETTINGS_ROWS = [
  { id: "basics", label: "الأساسيات", icon: Settings2, keys: ["وضع التطبيق", "شكل التطبيق", "يوم العمل", "واتساب", "عمولة المدير"],
    screens: [], status: (s) => `${APP_MODES[s.appMode || DEFAULT_APP_MODE]?.label || ""} · يوم العمل ${s.workdayMode === "off" ? "مطفأ" : "مفعّل"}` },
  { id: "security", label: "الأمان والصلاحيات", icon: ShieldCheck, keys: ["الرقم السري", "الرقابة", "استرجاع"],
    screens: [["access", "الصلاحيات"]], status: (s) => `الرقم السري ${s.requirePin ? "مفعّل" : "مطفأ"} · الاعتماد ${s.approvalsEnabled ? "مفعّل" : "مطفأ"}` },
  { id: "money", label: "المال والضريبة", icon: Coins, keys: ["الضريبه", "هوامش", "هامش", "عمولات", "مطابقة البنك", "الزكاه", "فحص الكسر", "حد الاجل", "الهدر والفروق", "تسامح", "بعد البيع", "واتساب", "البيع اثناء الجرد", "عرض السعر"],
    screens: [], status: (s) => (s.taxEnabled ? `ضريبة ${Math.round((Number(s.taxRate) || 0) * 1000) / 10}٪` : "بلا ضريبة") + ` · الزكاة ${s.zakatEnabled === false ? "مطفأة" : "مفعّلة"}` },
  { id: "devices", label: "الأجهزة", icon: Printer, keys: ["قارئ rfid", "الطابعه", "الميزان"],
    screens: [["printerSetup", "الطابعة"], ["rfidSettings", "القارئ"]], status: () => "الطابعة وقارئ RFID" },
  { id: "links", label: "الربط", icon: Link2, keys: ["ربط الفرع", "البرنامج المركزي"],
    screens: [["integration", "الأنظمة"]], status: (s, b) => (b?.code ? `مربوطٌ بالإدارة · ${b.code}` : "غير مربوطٍ بالإدارة") },
  { id: "modules", label: "الوحدات والنسخ", icon: Puzzle, keys: ["دفتر القيود", "ترحيل"],
    screens: [["modules", "الوحدات"], ["backup", "النسخ"]], status: () => "الوحدات الاختيارية والنسخ الاحتياطي" },
];

function AppSettingsPage({ onOpen = null, settings, onSave, branchIdentity, onSaveBranch, hqPermissions, priceData = {}, onBackfill, canEditControls = false, onSaveControls = null, hqManaged = null, limitsByHq = false, onBack, provision = null, onSaveProfile = null }) {
  const [newRecovery, setNewRecovery] = useState("");
  const [uiLangSel, setUiLangSel] = useState(readUiLang);
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

  // ── البحث في الإعدادات (المرجع م5): أيّ إعدادٍ بكلمةٍ منه ──
  // ⚠ نُخفي كتل الصفحة التي لا تحوي الكلمة بدل إعادة بنائها من جدول: الصفحة
  //   تتغيّر كثيرًا، وجدولٌ منفصل يتقادم فيُضلّ البحث. عنوان القسم يظهر مع كتلته.
  const [query, setQuery] = useState("");
  const [section, setSection] = useState(null);   // أحد الصفوف الستّة — يعرض أقسامه وحدها
  const [misses, setMisses] = useState(false);
  const bodyRef = useRef(null);
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const norm = (t) => String(t || "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[\u064B-\u0652]/g, "").toLowerCase();
    const words = norm(query).split(/\s+/).filter(Boolean);
    const kids = [...root.children];
    const hit = (el) => { const t = norm(el.textContent); return words.every((w) => t.includes(w)); };
    const isTitle = (el) => el.tagName === "P" && el.classList.contains("font-bold");
    let any = false;
    // صفٌّ مختار: عنوان القسم يجرّ ما تحته حتى العنوان التالي، والبطاقة بلا عنوانٍ تُعرف بكلماتها
    const keys = !words.length && section ? SETTINGS_ROWS.find((r) => r.id === section)?.keys.map(norm) || [] : [];
    const inKeys = (el) => { const t = norm(el.textContent); return keys.some((k) => t.includes(k)); };
    let under = false;
    kids.forEach((el, i) => {
      if (keys.length) {
        if (isTitle(el)) { under = inKeys(el); el.hidden = !under; if (under) any = true; return; }
        const show = under || (!kids.slice(0, i).some(isTitle) ? true : inKeys(el));
        el.hidden = !show; if (show) any = true; return;
      }
      if (!words.length) { el.hidden = false; return; }
      let show = hit(el);
      if (isTitle(el) && !show) { const nx = kids[i + 1]; show = !!nx && !isTitle(nx) && hit(nx); }
      el.hidden = !show;
      if (show && !isTitle(el)) any = true;
    });
    setMisses((words.length > 0 || keys.length > 0) && !any);
  });

  return (
    <div>
      <SubPageHeader title="الإعدادات" onBack={onBack} />
      <div className="px-4 pt-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث في الإعدادات — الضريبة، الرقم السري، الطابعة…"
          aria-label="ابحث في الإعدادات" className="w-full mb-3 px-3 py-2.5 rounded-xl text-[12px]"
          style={{ background: "var(--field)", color: "var(--text)", border: "1px solid var(--line)" }} />
        {misses && (
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
            {query.trim() ? "لا إعداد بهذه الكلمة هنا — جرّب «البحث الشامل» للشاشات." : "إعدادات هذا الصفّ في شاشاتها — افتحها من الزرّ بجانبه."}
          </p>
        )}
        {/* ── ستّة صفوف (المرجع م5): لكلٍّ حالته قبل فتحه، والضغط يعرض أقسامه وحدها ── */}
        {!query.trim() && (
          <div className="grid grid-cols-1 gap-1.5 mb-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {SETTINGS_ROWS.map((r) => {
              const on = section === r.id;
              const Icon = r.icon;
              return (
                <div key={r.id} className="rounded-xl px-3 py-2 flex items-center gap-2"
                  style={{ background: on ? "var(--accentBg)" : "var(--panel)", border: `1px solid ${on ? "var(--accentLine)" : "var(--edge)"}` }}>
                  <button type="button" onClick={() => setSection(on ? null : r.id)} aria-pressed={on}
                    className="flex-1 min-w-0 flex items-center gap-2 text-right">
                    <Icon size={16} color="var(--accent)" />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold" style={{ color: "var(--text)" }}>{r.label}</span>
                      <span className="block text-[10px] truncate" style={{ color: "var(--text3)" }}>{r.status(settings, branchIdentity)}</span>
                    </span>
                  </button>
                  {onOpen && r.screens.map(([id, lbl]) => (
                    <button key={id} type="button" onClick={() => onOpen(id)} className="text-[10px] px-2 py-1 rounded-lg flex-shrink-0"
                      style={{ color: "var(--accent)", border: "1px solid var(--accentLine)" }}>{lbl} ←</button>
                  ))}
                </div>
              );
            })}
            {section && (
              <button type="button" onClick={() => setSection(null)} className="text-[11px] py-1" style={{ color: "var(--text3)" }}>عرض كل الإعدادات</button>
            )}
          </div>
        )}
      </div>
      <div className="px-4" ref={bodyRef}>
        {hqManaged && (
          <div className="rounded-xl px-3 py-2 mb-3 text-[11px] leading-6"
            style={{ background: "var(--accentBg)", color: "var(--accentText)", border: "1px solid var(--accentLine)" }}>
            🔒 فرعٌ مُدار — الضريبة ويوم العمل وحدود الاعتماد وهوامش العيارات وفحص الكسر تضبطها الإدارة المركزية
            {hqManaged.by ? ` (${hqManaged.by}` : ""}{hqManaged.at ? `${hqManaged.by ? " · " : " ("}${new Date(hqManaged.at).toLocaleDateString("en-GB")})` : hqManaged.by ? ")" : ""}.
          </div>
        )}

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
        {/* ① التصميم: البسيط · المُضيء · الحديث · الكلاسيكي — ثم ② الإضاءة داخله */}
        <div className="grid grid-cols-2 gap-2 mb-2" role="radiogroup" aria-label="التصميم">
          {Object.entries(THEME_DESIGNS).map(([d, info]) => {
            const cur = effectiveTheme(settings);
            const on = designOfTheme(cur) === d;
            return (
              <button key={d} role="radio" aria-checked={on}
                onClick={() => {
                  if (on) return;
                  const id = isDarkTheme(cur) ? info.dark : info.light;
                  applyTheme(id);
                  onSave({ ...settings, theme: id, themePicked: true });
                }}
                className={`text-right rounded-2xl p-3${info.isNew ? " col-span-2" : ""}`}
                style={{ background: on ? "var(--accentBg)" : info.isNew ? "linear-gradient(120deg, rgba(255,200,61,.16), rgba(139,61,255,.12), rgba(0,200,220,.12))" : "var(--panel)", border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}` }}>
                <p style={{ color: on ? "var(--accent)" : "var(--text)", margin: 0 }} className="text-sm font-black">
                  {on ? "✓ " : ""}التصميم {info.label}
                  {info.isNew && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ marginInlineStart: 6, background: "linear-gradient(135deg,#FFC83D,#FF8A00)", color: "#141A33" }}>جديد</span>}
                </p>
                <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[11px] leading-snug">{info.hint}</p>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {Object.entries(THEMES).filter(([id]) => designOfTheme(id) === designOfTheme(effectiveTheme(settings))).map(([id, t]) => {
            const on = effectiveTheme(settings) === id;
            return (
              <button
                key={id}
                onClick={() => {
                  // ⚠ نُطبّقها فورًا لا عند الحفظ: اختيار شكلٍ بلا رؤيته
                  // اختيارٌ أعمى، والمستخدم يحفظ ثم يندم.
                  // ⚠ نُطبّقها ونحفظها معًا: الإعدادات هنا تُحفظ فورًا
                  // لا بزرّ، فتأجيل الحفظ يجعل الاختيار يضيع بالخروج.
                  applyTheme(id);
                  onSave({ ...settings, theme: id, themePicked: true });
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
          «البسيط الداكن» هو الشكل الأساسي — ويبقى ما تختاره هنا على هذا الجهاز.
        </p>

        {onSaveControls && (
          <>
            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
              الرقابة — الاعتماد وقفل الفترات
            </p>
            <ControlsSettingsCard settings={settings} canEdit={canEditControls} onSave={onSaveControls} limitsByHq={limitsByHq} />
          </>
        )}

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
                background: settings.workdayMode !== "off" ? "var(--good)" : "var(--edge)", transition: "background .2s",
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
                background: settings.requirePin ? "var(--good)" : "var(--edge)", transition: "background .2s",
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
                background: settings.bankReconEnabled ? "var(--good)" : "var(--edge)", transition: "background .2s" }}
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
                background: taxEnabled ? "var(--good)" : "var(--edge)",
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

        <InstallAppCard />

        {/* ── الزكاة (migration 065): مفتاحٌ واحد وسنة الحساب — تُحفظ فورًا ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-4">
          الزكاة
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: "var(--text)" }} className="text-sm font-bold">حساب الزكاة</span>
            <button
              onClick={() => onSave({ zakatEnabled: settings.zakatEnabled === false })}
              style={{ width: 44, height: 24, borderRadius: 12, position: "relative", transition: "background 0.2s",
                background: settings.zakatEnabled !== false ? "var(--good)" : "var(--edge)" }}
            >
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--text)", position: "absolute", top: 3,
                right: settings.zakatEnabled !== false ? 23 : 3, transition: "right 0.2s" }} />
            </button>
          </div>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
            مطفأةً: لا بطاقة ولا حساب في القوائم ولا في باب التقارير.
          </p>
          {settings.zakatEnabled !== false && (
            <div className="grid grid-cols-2 gap-2">
              {[["gregorian", "ميلادية — 2.5777٪"], ["hijri", "هجرية — 2.5٪"]].map(([id, label]) => {
                const on = (settings.zakatYear || "gregorian") === id;
                return (
                  <button key={id} onClick={() => !on && onSave({ zakatYear: id })} className="py-2 rounded-xl text-[11px] font-bold"
                    style={{ background: on ? "var(--accentBg)" : "var(--field)", color: on ? "var(--accent)" : "var(--text2)",
                      border: `1px solid ${on ? "var(--accentLine)" : "var(--edge)"}` }}>
                    سنة {label}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── الهدر والفروق: افتراضات الورشة وتسامح فرق التكويد — تُحفظ على الخادم ضمن تفضيلات الفرع ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-4">
          الهدر والفروق
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
            فرقٌ داخل تسامح الميزان يُعدّ مطابقة. وفرق التكويد فوق النسبة لا تُقفل الدفعة إلا بسببٍ مكتوب.
          </p>
          {(() => {
            const ws = wastageSettingsOf(settings);
            const fields = [
              { key: "defaultAllowPct", label: "المسموح من الهدر ٪ (إن لم يحدّده عقد الورشة)", max: 20 },
              { key: "codingTolPct", label: "تسامح فرق التكويد ٪", max: 10 },
              { key: "receiveTolG", label: "تسامح الميزان (جم)", max: 5 },
            ];
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" data-wastage-settings>
                {fields.map((f) => (
                  <label key={f.key} className="text-[11px]" style={{ color: "var(--text2)" }}>
                    {f.label}
                    <input type="number" min="0" max={f.max} step="0.01" inputMode="decimal" defaultValue={ws[f.key]} data-wastage-field={f.key}
                      onBlur={(e) => {
                        const v = Math.max(0, Math.min(f.max, Number(e.target.value) || 0));
                        if (v !== ws[f.key]) onSave({ wastage: { ...ws, [f.key]: v } });
                      }}
                      className="w-full mt-1 px-3 py-2 rounded-xl text-[12px]" style={{ background: "var(--field)", color: "var(--text)", border: "1px solid var(--line)" }} />
                  </label>
                ))}
              </div>
            );
          })()}
        </Card>

        {/* ── حدّ الآجل (migration 069): الخادم يفرضه على كل بيعٍ آجل، وما فوقه يحتاج اعتمادًا ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-4">
          حدّ الآجل
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
            صفرٌ = بلا فحص. لكل عميلٍ حدّه الخاص من «العملاء»، وهذا افتراضيٌّ لمن لا حدّ له. ما فوقه يحتاج اعتماد المدير.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px]" style={{ color: "var(--text2)" }}>
              الحدّ الافتراضي ({priceData.currency || "ر.س"})
              <input type="number" min="0" inputMode="decimal" defaultValue={Number(settings.creditLimitDefault) || 0}
                onBlur={(e) => { const v = Math.max(0, Number(e.target.value) || 0); if (v !== (Number(settings.creditLimitDefault) || 0)) onSave({ creditLimitDefault: v }); }}
                className="w-full mt-1 px-3 py-2 rounded-xl text-[12px]" style={{ background: "var(--field)", color: "var(--text)", border: "1px solid var(--line)" }} />
            </label>
            <label className="text-[11px]" style={{ color: "var(--text2)" }}>
              لا آجل لمن تأخّر أكثر من (يوم)
              <input type="number" min="0" inputMode="numeric" defaultValue={Number(settings.creditOverdueDays) || 0}
                onBlur={(e) => { const v = Math.max(0, Math.round(Number(e.target.value) || 0)); if (v !== (Number(settings.creditOverdueDays) || 0)) onSave({ creditOverdueDays: v }); }}
                className="w-full mt-1 px-3 py-2 rounded-xl text-[12px]" style={{ background: "var(--field)", color: "var(--text)", border: "1px solid var(--line)" }} />
            </label>
          </div>
        </Card>

        {/* ── تفضيلات البيع (migration 069): ورقة ما بعد البيع والبيع أثناء الجرد — مطفآن افتراضًا ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-4">
          البيع
        </p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          {[
            { key: "postSaleSheet", title: "بعد البيع: اطبع الفاتورة أو أرسلها بواتساب",
              on: "مفعّل — بعد كل بيع تظهر ورقة: اطبع · أرسل بواتساب · بيع جديد",
              off: "مطفأ — البيع ينتهي برسالته، وتطبع أيّ فاتورة متى شئت من سجلّ المبيعات" },
            { key: "sellDuringStocktake", title: "البيع أثناء الجرد",
              on: "مسموح — ما يُباع والقفل قائم يُطابَق مبيعًا عند اعتماد الجرد (لا يُحسب زيادة)",
              off: "موقوف — قفل الجرد يوقف البيع حتى فتحه" },
          ].map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="min-w-0">
                <p style={{ color: "var(--text)" }} className="text-[12px] font-bold">{t.title}</p>
                <p style={{ color: "var(--text3)" }} className="text-[11px]">{settings[t.key] ? t.on : t.off}</p>
              </div>
              <button type="button" role="switch" aria-checked={!!settings[t.key]} aria-label={t.title}
                onClick={() => onSave({ [t.key]: !settings[t.key] })}
                className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold"
                style={settings[t.key]
                  ? { background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }
                  : { background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                {settings[t.key] ? "مفعّل" : "مطفأ"}
              </button>
            </div>
          ))}
          <label className="block text-[11px] mt-3" style={{ color: "var(--text2)" }}>
            صلاحية عرض السعر (أيام)
            <input type="number" min="1" max="60" inputMode="numeric" defaultValue={Number(settings.quoteDays) || 7}
              onBlur={(e) => { const v = Math.max(1, Math.min(60, Math.round(Number(e.target.value) || 7))); if (v !== (Number(settings.quoteDays) || 7)) onSave({ quoteDays: v }); }}
              className="w-full mt-1 px-3 py-2 rounded-xl text-[12px]" style={{ background: "var(--field)", color: "var(--text)", border: "1px solid var(--line)" }} />
          </label>
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

        {/* عمولة المدير أُلغيت نهائيًّا — والوضع الخفي أُلغي؛ القطع المعلّقة القديمة تُقرأ وتُباع كما كانت */}

        {/* ── معلومات الفرع ورأس المستندات ── */}
        <BranchProfileCard profile={provision?.profile || {}} branchCode={branchIdentity?.code || ""} locked={!!provision?.locked}
          canEdit={!!onSaveProfile} onSave={onSaveProfile || (async () => false)} />

        {/* ── لغة الواجهة (تفضيلٌ لهذا الجهاز) ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">لغة الواجهة</p>
        <Card style={{ padding: 14, marginBottom: 16 }} data-ui-lang>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(UI_LANGS).map((id) => (
              <button key={id} type="button" translate="no" data-ui-lang-opt={id} onClick={() => { setUiLang(id); setUiLangSel(id); }} className="py-2 rounded-xl text-xs font-bold"
                style={{ background: uiLangSel === id ? "var(--accentBg)" : "var(--panel)", color: uiLangSel === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
                {UI_LANGS[id].label}
              </button>
            ))}
          </div>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mt-2">الفواتير والتقارير الرسمية تبقى بالعربية.</p>
        </Card>

        {/* ── علامات «؟» على الأزرار ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">شرح الأزرار</p>
        <Card style={{ padding: 14, marginBottom: 16 }}>
          <label className="flex items-center justify-between gap-2 text-[12px]" style={{ color: "var(--text)" }}>
            <span>علامة «؟» على كل زرّ<span style={{ color: "var(--text3)" }} className="block text-[11px]">اضغط «؟» أو اضغط الزرّ مطوّلًا لترى ماذا يفعل — دون أن يُنفَّذ</span></span>
            <input type="checkbox" data-help-badges-toggle checked={settings.helpBadges !== false} onChange={(e) => onSave({ ...settings, helpBadges: e.target.checked })} style={{ accentColor: "var(--accent)", width: 18, height: 18 }} />
          </label>
          <StartHereAgain />
        </Card>

        {/* ── جهاز الدفع (تفضيلٌ لهذا الجهاز) ── */}
        <PayTerminalCard />

        {/* ── طباعة الفواتير (مطفأة افتراضًا في الفرع) ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">طباعة الفواتير</p>
        <Card style={{ padding: 14, marginBottom: 16 }}>
          <label className="flex items-center justify-between gap-2 text-[12px]" style={{ color: "var(--text)" }}>
            <span>اطبع فاتورة البيع للعميل<span style={{ color: "var(--text3)" }} className="block text-[11px]">مطفأة افتراضًا — الفاتورة تُرسل بواتساب أو تُعرض</span></span>
            <input type="checkbox" data-invoice-print checked={!!settings.invoicePrintOn} onChange={(e) => onSave({ ...settings, invoicePrintOn: e.target.checked })} style={{ accentColor: "var(--accent)", width: 18, height: 18 }} />
          </label>
          <label className="flex items-center justify-between gap-2 text-[12px] mt-3" style={{ color: "var(--text)" }}>
            <span>الصيغة الرسمية للمحاسبين والجهات الرسمية<span style={{ color: "var(--text3)" }} className="block text-[11px]">سندات قبض وصرف بالمبلغ كتابةً وثلاثة توقيعات (أصل وصورة)، وإشعار دائن للمرتجع، وفاتورة ضريبية كاملة لعميلٍ له رقم ضريبي</span></span>
            <input type="checkbox" data-official-print-toggle checked={!!settings.officialPrint} onChange={(e) => onSave({ ...settings, officialPrint: e.target.checked })} style={{ accentColor: "var(--accent)", width: 18, height: 18 }} />
          </label>
        </Card>

        {/* ── المحاسبة: بسيطة أو مفصّلة ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">المحاسبة</p>
        <Card style={{ padding: 14, marginBottom: 16 }} data-accounting-mode>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ACCOUNTING_MODES).map(([id, m]) => {
              const on = (settings.accountingMode === "simple" ? "simple" : "detailed") === id;
              return (
                <button key={id} type="button" data-accounting-mode-opt={id} onClick={() => onSave({ ...settings, accountingMode: id })} className="py-2 px-2 rounded-xl text-xs font-bold text-right"
                  style={{ background: on ? "var(--accentBg)" : "var(--panel)", color: on ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
                  {m.label}<span style={{ color: "var(--text3)" }} className="block text-[10px] font-normal leading-4 mt-0.5">{m.hint}</span>
                </button>
              );
            })}
          </div>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mt-2">الشاشات تُخفى فقط — القيود تُسجَّل كما هي، والعودة إلى «مفصّلة» تُظهر كل شيء.</p>
        </Card>

        {/* ── عيار الاحتساب والمكافئ الذهبي ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">عيار الاحتساب</p>
        <Card style={{ padding: 14, marginBottom: 16 }} data-base-karat>
          <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">أساس البرنامج الربح بالذهب: كل تحويلٍ للذهب ومكافئ كل مبلغ بهذا العيار.</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[21, 24].map((k) => (
              <button key={k} type="button" data-karat={k} onClick={() => onSave({ ...settings, baseKarat: k })} className="py-2 rounded-xl text-xs font-bold"
                style={{ background: (Number(settings.baseKarat) === 24 ? 24 : 21) === k ? "var(--accentBg)" : "var(--panel)", color: (Number(settings.baseKarat) === 24 ? 24 : 21) === k ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
                عيار {k}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text2)" }}>
            <input type="checkbox" data-gold-eq-toggle checked={settings.goldEqOn !== false} onChange={(e) => onSave({ ...settings, goldEqOn: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
            اعرض بجانب كل مبلغ ما يعادله ذهبًا بسعر اليوم (بخطٍّ صغير)
          </label>
        </Card>

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
            <button onClick={() => openWhatsApp(settings.whatsapp, "رسالة تجربة من تطبيق أونصة ✓")}
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

        {/* ── الميزان ── */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">الميزان</p>
        <ScaleSettingsCard />

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


// «ابدأ هنا» أُخفي من الرئيسية؟ زرٌّ يعيده
function StartHereAgain() {
  const [hidden, setHidden] = useState(startHereHidden);
  return (
    <div className="flex items-center justify-between gap-2 text-[12px] mt-3 pt-3" style={{ color: "var(--text)", borderTop: "1px solid var(--line)" }}>
      <span>قائمة «ابدأ هنا» في الرئيسية<span style={{ color: "var(--text3)" }} className="block text-[11px]">{hidden ? "مخفية — تعود حتى تكتمل خطواتها" : "ظاهرة حتى تكتمل خطواتها"}</span></span>
      <button type="button" data-start-here-show disabled={!hidden} onClick={() => { showStartHere(); setHidden(false); }}
        className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold"
        style={{ background: hidden ? "var(--accentBg)" : "var(--field)", color: hidden ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>
        {hidden ? "أظهرها" : "ظاهرة"}
      </button>
    </div>
  );
}

export { AppSettingsPage };
