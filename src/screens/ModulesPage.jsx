import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { KARATS } from "../core/money.js";
import * as api from "../core/api.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// الوحدات الاختيارية (المرجع 5.2.0 · migration 050) — كلٌّ مطفأةٌ افتراضًا، ولها إعداداتها.
const INFO = {
  discountLimit: "أقصى خصمٍ بالنسبة لكل دور — ما فوقه يبيعه المدير. القيمة المرجعية: سعر اليوم × النقاء × الوزن + المصنعية.",
  reorderAlerts: "حدٌّ أدنى من القطع لكل تصنيفٍ وعيار — تنبيهٌ حين ينزل المتاح تحته.",
  branchTransfer: "إرسال قطعٍ لفرعٍ آخر في المتجر نفسه — القطعة نفسها برمزها تنتقل، وتكلفتها معها.",
  giftCards: "بيع بطاقةٍ بمبلغ ورمز · الدفع بها في الفاتورة · رصيدها التزامٌ في الدفتر (2260).",
  loyalty: "نقاطٌ للعميل على كل فاتورةٍ مدفوعة · تُستبدل ببطاقة هدية (تكلفتها 6950).",
  zatca: "رمز QR بصيغة TLV (المرحلة الأولى لهيئة الزكاة) على كل فاتورةٍ ضريبية مبسّطة — يحتاج الرقم الضريبي في تجهيز الفرع.",
  thermalReceipt: "طباعة الفاتورة إيصالًا على طابعة الكاشير الحرارية 80مم.",
  bilingualInvoice: "عناوين الفاتورة المطبوعة بالعربية والإنجليزية.",
  customOrders: "طلب عميلٍ بمواصفة وعربون وموعد · مراحل الورشة · التسليم بفاتورةٍ يُخصم منها العربون.",
  purchaseOrders: "أمر شراءٍ للمورد ثم استلامه دفعةً بمعالج الشراء نفسه · مقارنة المطلوب بالمستلم.",
  aml: "هوية المشتري إلزامية لدفعٍ نقدي يبلغ الحدّ، وتُحفظ على الفاتورة · سجلّ العمليات الكبيرة.",
  gemstones: "القيراط واللون والنقاء والقطع والشهادة لكل قطعة — تُكتب عند التكويد وتظهر في الاستعلام والفاتورة.",
  watches: "الماركة والموديل والرقم التسلسلي ومدّة الضمان لكل ساعة.",
};
const ROLE_LABEL = { employee: "الموظف", assistant: "نائب المدير", accountant: "المحاسب" };

function ModulesPage({ categories = [], canEdit = false, onSaved, onBack }) {
  const [data, setData] = useState(null);
  const [mods, setMods] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api.modulesApi.get().then((d) => { setData(d); setMods(d.modules || {}); }).catch(() => setData(false)); }, []);
  if (data === false) return <div><SubPageHeader title="الوحدات" onBack={onBack} /><p className="px-4 text-xs" style={{ color: "var(--bad)" }}>تعذّر التحميل</p></div>;
  if (!data) return <div><SubPageHeader title="الوحدات" onBack={onBack} /><p className="px-4 text-xs" style={{ color: "var(--text3)" }}>جارِ التحميل…</p></div>;
  const cfgOf = (id) => ({ ...(data.catalog[id]?.cfg || {}), ...(mods[id]?.cfg || {}) });
  const setOn = (id, on) => setMods((m) => ({ ...m, [id]: { on, cfg: cfgOf(id) } }));
  const setCfg = (id, patch) => setMods((m) => ({ ...m, [id]: { on: !!m[id]?.on, cfg: { ...cfgOf(id), ...patch } } }));
  const save = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api.modulesApi.save(mods); setMods(r.modules); setMsg({ text: "حُفظت الوحدات" }); onSaved?.(r.modules); }
    catch (e) { setMsg({ bad: true, text: e?.body?.error === "settings_locked_by_hq" ? "الإعدادات مُدارةٌ من الإدارة" : "تعذّر الحفظ" }); }
    finally { setBusy(false); }
  };
  const mins = cfgOf("reorderAlerts").mins || {};
  const cats = categories.filter((c) => c.saleMode !== "partial");
  return (
    <div className="pb-24">
      <SubPageHeader title="الوحدات الاختيارية" onBack={onBack} />
      <div className="px-4 pt-3">
        {Object.entries(data.catalog).map(([id, m]) => {
          const on = !!mods[id]?.on;
          return (
            <Card key={id} style={{ padding: 12, marginBottom: 10 }}>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold flex-1" style={{ color: "var(--text)", margin: 0 }}>{m.label}</p>
                <button disabled={!canEdit} onClick={() => setOn(id, !on)} className="px-3 py-1 rounded-lg text-[11px] font-bold"
                  style={{ background: on ? "var(--goodBg)" : "var(--panel)", color: on ? "var(--good)" : "var(--text2)", border: "1px solid var(--line)" }}>{on ? "مفعّلة" : "مطفأة"}</button>
              </div>
              <p className="text-[11px] leading-5" style={{ color: "var(--text3)", margin: "4px 0 0" }}>{INFO[id]}</p>
              {on && id === "discountLimit" && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {Object.keys(ROLE_LABEL).map((r) => (
                    <label key={r} className="text-[11px]" style={{ color: "var(--text2)" }}>{ROLE_LABEL[r]} ٪
                      <input style={inputStyle} disabled={!canEdit} inputMode="decimal" value={cfgOf(id).maxPct?.[r] ?? 0}
                        onChange={(e) => setCfg(id, { maxPct: { ...cfgOf(id).maxPct, [r]: e.target.value.replace(/[^\d.]/g, "") } })} />
                    </label>
                  ))}
                </div>
              )}
              {on && id === "aml" && (
                <label className="block text-[11px] mt-2" style={{ color: "var(--text2)" }}>الحدّ النقدي
                  <input style={inputStyle} disabled={!canEdit} inputMode="decimal" value={cfgOf(id).cashThreshold} onChange={(e) => setCfg(id, { cashThreshold: e.target.value.replace(/[^\d.]/g, "") })} />
                </label>
              )}
              {on && id === "loyalty" && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <label className="text-[11px]" style={{ color: "var(--text2)" }}>ريال لكل نقطة
                    <input style={inputStyle} disabled={!canEdit} inputMode="decimal" value={cfgOf(id).sarPerPoint} onChange={(e) => setCfg(id, { sarPerPoint: e.target.value.replace(/[^\d.]/g, "") })} />
                  </label>
                  <label className="text-[11px]" style={{ color: "var(--text2)" }}>قيمة النقطة عند الاستبدال
                    <input style={inputStyle} disabled={!canEdit} inputMode="decimal" value={cfgOf(id).pointValue} onChange={(e) => setCfg(id, { pointValue: e.target.value.replace(/[^\d.]/g, "") })} />
                  </label>
                </div>
              )}
              {on && id === "reorderAlerts" && (
                <div className="mt-2 space-y-1">
                  {cats.map((c) => (
                    <div key={c.id} className="flex items-center gap-1 flex-wrap">
                      <span className="text-[11px] flex-1" style={{ color: "var(--text2)", minWidth: 90 }}>{c.label || c.name}</span>
                      {KARATS.filter((k) => k !== 14).map((k) => (
                        <input key={k} style={{ ...inputStyle, width: 52, padding: "6px 4px", textAlign: "center" }} disabled={!canEdit} inputMode="numeric"
                          placeholder={`${k}`} value={mins[`${c.id}:${k}`] || ""}
                          onChange={(e) => setCfg(id, { mins: { ...mins, [`${c.id}:${k}`]: e.target.value.replace(/\D/g, "") } })} />
                      ))}
                    </div>
                  ))}
                  <p className="text-[10px]" style={{ color: "var(--text3)", margin: 0 }}>الحدّ الأدنى من القطع لكل عيار (24 · 22 · 21 · 18) — الفارغ بلا حدّ.</p>
                </div>
              )}
            </Card>
          );
        })}
        {msg && <p className="text-[11px] mb-2" style={{ color: msg.bad ? "var(--bad)" : "var(--good)" }}>{msg.text}</p>}
        {canEdit && (
          <button onClick={save} disabled={busy} className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
            {busy && <Loader2 size={15} className="animate-spin" />} احفظ الوحدات
          </button>
        )}
      </div>
    </div>
  );
}

export { ModulesPage };
