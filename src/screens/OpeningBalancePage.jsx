import React, { useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { KARATS, PURITY, fmt, fmtW } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { FiscalClosePage } from "./FiscalClosePage.jsx";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function OpeningBalancePage({
  openingBalance,
  onSave,
  currency,
  price24,
  goldEquivalent,
  openingGoldEquivalent,
  fiscalClosures,
  latestClosure,
  cashBalance,
  safeBalance,
  safeGoldBalance,
  scrapCustodyBalance,
  partnersTotals,
  partners,
  sales,
  expenses,
  onCloseYear,
  onBack,
}) {
  const [tab, setTab] = useState("opening"); // 'opening' | 'closing'
  const [confirmSave, setConfirmSave] = useState(false);
  const [form, setForm] = useState({ ...openingBalance, partnersCapitalByPartner: { ...(openingBalance.partnersCapitalByPartner || {}) } });
  const set = (field, val) => setForm((prev) => ({ ...prev, [field]: val }));
  // While editing, numeric fields hold the RAW STRING. Coercing on every
  // keystroke made the inputs unusable: clearing a field snapped it back to
  // "0", and typing "0." for a decimal erased the dot before the digits could
  // be entered. Coercion happens once, on save, instead.
  const addInvLine = () =>
    setForm((p) => ({ ...p, inventoryLines: [...(p.inventoryLines || []), { karat: 21, weight: "", workmanship: "" }] }));
  const removeInvLine = (idx) =>
    setForm((p) => ({ ...p, inventoryLines: (p.inventoryLines || []).filter((_, i) => i !== idx) }));
  const updateInvLine = (idx, field, val) =>
    setForm((p) => ({
      ...p,
      inventoryLines: (p.inventoryLines || []).map((l, i) => (i === idx ? { ...l, [field]: val } : l)),
    }));
  const setPartnerCapital = (partnerId, grams) =>
    setForm((prev) => ({ ...prev, partnersCapitalByPartner: { ...prev.partnersCapitalByPartner, [partnerId]: grams } }));

  const growthGrams = goldEquivalent.goldGrams - openingGoldEquivalent.goldGrams;

  const NUMERIC_FIELDS = [
    "dailyCash",
    "dailyNetwork",
    "safeCash",
    "safeNetwork",
    "safeGoldRaw",
    "safeGoldCrafted",
    "custodyCash",
    "custodyNetwork",
    "scrapWeight",
    "inventoryValue",
    "inventoryWeight",
  ];
  const normalizeForm = (f) => {
    const out = { ...f };
    NUMERIC_FIELDS.forEach((k) => {
      out[k] = Number(out[k]) || 0;
    });
    const caps = {};
    Object.entries(f.partnersCapitalByPartner || {}).forEach(([pid, g]) => {
      caps[pid] = Number(g) || 0;
    });
    out.partnersCapitalByPartner = caps;
    out.scrapKarat = Number(f.scrapKarat) || 21;
    out.inventoryKarat = Number(f.inventoryKarat) || 21;
    out.safeGoldRawKarat = Number(f.safeGoldRawKarat) || 21;
    out.safeGoldCraftedKarat = Number(f.safeGoldCraftedKarat) || 21;
    out.inventoryLines = (f.inventoryLines || [])
      .map((l) => ({ karat: Number(l.karat) || 21, weight: Number(l.weight) || 0, workmanship: Number(l.workmanship) || 0 }))
      .filter((l) => l.weight > 0);
    return out;
  };

  const numField = (label, field, placeholder = "0.00") => (
    <Field label={label}>
      <NumericInput value={form[field]} onChange={(v) => set(field, v)} placeholder={placeholder} />
    </Field>
  );
  const karatField = (label, field) => (
    <Field label={label}>
      <select style={inputStyle} value={form[field]} onChange={(e) => set(field, Number(e.target.value))}>
        {KARATS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <div>
      <SubPageHeader title="الرصيد الافتتاحي" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setTab("opening")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: tab === "opening" ? "var(--accentBg)" : "var(--panel)", color: tab === "opening" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            البداية
          </button>
          <button
            onClick={() => setTab("closing")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: tab === "closing" ? "var(--accentBg)" : "var(--panel)", color: tab === "closing" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            إقفال السنة
          </button>
        </div>
      </div>

      {tab === "closing" ? (
        <FiscalClosePage
          openingBalance={openingBalance}
          fiscalClosures={fiscalClosures}
          latestClosure={latestClosure}
          currency={currency}
          price24={price24}
          goldEquivalent={goldEquivalent}
          cashBalance={cashBalance}
          safeBalance={safeBalance}
          safeGoldBalance={safeGoldBalance}
          scrapCustodyBalance={scrapCustodyBalance}
          partnersTotals={partnersTotals}
          sales={sales}
          expenses={expenses}
          onClose={onCloseYear}
        />
      ) : (
      <div className="px-4">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-4">
          أدخل كل شي كان موجود عندك يوم بدأت العمل بالتطبيق — نقدية، ذهب، مخزون، رأس مال شركاء. من هذه اللحظة، كل التقارير والقوائم المالية تحسب أداءك بالمقارنة مع هذا الرصيد.
        </p>

        {openingBalance.date && (
          <Card style={{ padding: 12, marginBottom: 14, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
              النمو منذ الرصيد الافتتاحي (بعيار 24، بسعر اليوم)
            </p>
            <p style={{ fontFamily: "'Cairo', sans-serif", color: growthGrams >= 0 ? "var(--goodSolid)" : "var(--bad)" }} className="text-2xl font-extrabold">
              {growthGrams >= 0 ? "+" : ""}
              {fmtW(growthGrams)} جم
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
              الافتتاحي: {fmtW(openingGoldEquivalent.goldGrams)} جم · الحالي: {fmtW(goldEquivalent.goldGrams)} جم (ذهب فعلي)
            </p>
          </Card>
        )}

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          صندوق اليومي
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {numField("نقدي", "dailyCash")}
          {numField("شبكة", "dailyNetwork")}
        </div>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          الخزنة
        </p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {numField("نقدي", "safeCash")}
          {numField("شبكة", "safeNetwork")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {numField("ذهب كسر (جم)", "safeGoldRaw")}
          {karatField("عيار الكسر", "safeGoldRawKarat")}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {numField("ذهب مشغول (جم)", "safeGoldCrafted")}
          {karatField("عيار المشغول", "safeGoldCraftedKarat")}
        </div>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          عهدة الكسر
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {numField("نقدي", "custodyCash")}
          {numField("شبكة", "custodyNetwork")}
        </div>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          كسر بالمخزن
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {numField("الوزن (جم)", "scrapWeight")}
          {karatField("العيار التقديري", "scrapKarat")}
        </div>

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          المخزون (القطع الموجودة قبل استخدام التطبيق)
        </p>
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
          بالوزن فقط لكل عيار. الأجور التقريبية اختيارية — اتركها فارغة إن لم تكن معروفة.
        </p>
        <div className="flex flex-col gap-2 mb-2">
          {(form.inventoryLines || []).map((ln, idx) => (
            <Card key={idx} style={{ padding: 10, background: "var(--bg)" }}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ color: "var(--text2)" }} className="text-[11px]">سطر {idx + 1}</span>
                <button onClick={() => removeInvLine(idx)} style={{ color: "var(--bad)" }}>
                  <X size={13} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="العيار">
                  <select style={inputStyle} value={ln.karat} onChange={(e) => updateInvLine(idx, "karat", Number(e.target.value))}>
                    {KARATS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </Field>
                <Field label="الوزن (جم)">
                  <NumericInput value={ln.weight} onChange={(v) => updateInvLine(idx, "weight", v)} />
                </Field>
                <Field label="أجور (اختياري)">
                  <NumericInput value={ln.workmanship} onChange={(v) => updateInvLine(idx, "workmanship", v)} />
                </Field>
              </div>
              {Number(ln.weight) > 0 && (
                <p style={{ color: "var(--text3)" }} className="text-[10px]">
                  يعادل {fmt(Number(ln.weight) * (PURITY[ln.karat] || 1))} جم عيار 24
                </p>
              )}
            </Card>
          ))}
        </div>
        <button
          onClick={addInvLine}
          className="w-full py-2 rounded-xl text-[11px] font-bold mb-2 flex items-center justify-center gap-1"
          style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
        >
          <Plus size={13} /> إضافة عيار
        </button>
        {(form.inventoryLines || []).some((l) => Number(l.weight) > 0) && (
          <Card style={{ padding: 12, marginBottom: 16, border: "1px solid var(--accentLine)" }}>
            <div className="flex items-center justify-between py-1">
              <span style={{ color: "var(--text2)" }} className="text-[11px]">إجمالي الوزن الخام</span>
              <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                {fmt((form.inventoryLines || []).reduce((a, l) => a + (Number(l.weight) || 0), 0))} جم
              </span>
            </div>
            <div className="flex items-center justify-between py-1" style={{ borderTop: "1px solid var(--line)" }}>
              <span style={{ color: "var(--text)" }} className="text-xs font-bold">الإجمالي محوَّلًا لعيار 24</span>
              <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                {fmt((form.inventoryLines || []).reduce((a, l) => a + (Number(l.weight) || 0) * (PURITY[l.karat] || 1), 0))} جم
              </span>
            </div>
            <p style={{ color: "var(--accentText)" }} className="text-[10px] mt-1">
              محوَّل حسب نقاء كل عيار — جمع الأوزان الخام مباشرة يعطي رقمًا خاطئًا.
            </p>
          </Card>
        )}

        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          رأس مال الشركاء (بعيار 24 — لكل شريك)
        </p>
        {partners.length === 0 ? (
          <Card style={{ padding: 12, marginBottom: 16 }}>
            <p style={{ color: "var(--text2)" }} className="text-xs">
              لا يوجد شركاء بعد. أضفهم أولاً من "المزيد &gt; حسابات الشركاء" ثم ارجع هنا لتحدد رأس مال كل واحد منهم.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {partners.map((p) => (
              <Card key={p.id} style={{ padding: 10 }}>
                <Field label={p.name}>
                  <NumericInput value={form.partnersCapitalByPartner[p.id]} onChange={(v) => setPartnerCapital(p.id, v)} placeholder="0.00 جم" />
                </Field>
              </Card>
            ))}
          </div>
        )}

        <Field label="ملاحظات (اختياري)">
          <input style={inputStyle} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>

        {!confirmSave ? (
          <button
            onClick={() => setConfirmSave(true)}
            className="w-full py-3 rounded-xl font-bold mt-2"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
          >
            حفظ الرصيد الافتتاحي
          </button>
        ) : (
          <Card style={{ padding: 14, marginTop: 8, border: "1px solid var(--badLine)" }}>
            <p style={{ color: "var(--bad)" }} className="text-xs font-bold mb-2 flex items-center gap-1">
              <AlertTriangle size={13} /> تأكيد الرصيد الافتتاحي
            </p>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
              هذا الرقم هو نقطة الأساس التي تُقاس عليها كل أرباحك وتقاريرك لاحقًا.
              راجع الأرقام قبل التأكيد — تعديله بعد تسجيل حركات يغيّر كل المقارنات التاريخية.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmSave(false)} className="py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                مراجعة
              </button>
              <button
                onClick={() => {
                  onSave(normalizeForm(form));
                  setConfirmSave(false);
                }}
                className="py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
              >
                تأكيد الحفظ
              </button>
            </div>
          </Card>
        )}
        {openingBalance.date && (
          <p style={{ color: "var(--text3)" }} className="text-[11px] mt-2 text-center">
            آخر حفظ: {new Date(openingBalance.date).toLocaleDateString("en-GB")}
          </p>
        )}
      </div>
      )}
    </div>
  );
}


// ============================================================
// تخصيص القائمة — الشريط بصفّيه وترتيب القائمة الجانبية
// ============================================================

export { OpeningBalancePage };
