import React, { useEffect, useState } from "react";
import { APPROVAL_RULES } from "../core/erp.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

/// الرقابة — حدود الاعتماد وقفل الفترات.
///
/// ⚠ في المرجع تُضبط من الإدارة عند تجهيز الفرع؛ وهنا بيد مدير الفرع،
///   والخادم يفرضها على كل عملية (لا الشاشة): ما فوق الحدّ يُحفظ طلبًا،
///   والقيد في فترةٍ مقفلة يُرفض.
///   · قفلٌ نهائيّ: لا قيود حتى هذا التاريخ — للجميع.
///   · قفلٌ جزئيّ: المدير وحده يعدّل حتى هذا التاريخ.
const KINDS = ["expense", "refund", "supplier_settle"];

function ControlsSettingsCard({ settings = {}, canEdit = false, onSave }) {
  const rules = APPROVAL_RULES.filter((r) => KINDS.includes(r.id));
  const init = () => ({
    enabled: settings.approvalsEnabled !== false,
    th: Object.fromEntries(rules.map((r) => [r.id, String(settings.approvalThresholds?.[r.id] ?? r.threshold)])),
    lockAll: settings.periodLocks?.lockAll || "",
    lockPosted: settings.periodLocks?.lockPosted || "",
  });
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(init()); }, [settings.approvalsEnabled, JSON.stringify(settings.approvalThresholds || {}), settings.periodLocks?.lockAll, settings.periodLocks?.lockPosted]);
  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        approvalsEnabled: f.enabled,
        approvalThresholds: Object.fromEntries(rules.map((r) => [r.id, Number(f.th[r.id]) || 0])),
        lockAll: f.lockAll || null,
        lockPosted: f.lockPosted || null,
      });
    } finally { setBusy(false); }
  };
  const dis = !canEdit;
  return (
    <Card style={{ padding: 14, marginBottom: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ color: "var(--text)" }} className="text-sm font-bold">
          الاعتماد {f.enabled ? "مفعّل" : "مطفأ"}
        </span>
        <button aria-label="الاعتماد" disabled={dis} onClick={() => setF((x) => ({ ...x, enabled: !x.enabled }))}
          style={{ width: 46, height: 25, borderRadius: 13, position: "relative", flexShrink: 0,
            background: f.enabled ? "var(--goodSolid)" : "var(--edge)", transition: "background .2s", opacity: dis ? 0.5 : 1 }}>
          <div style={{ width: 19, height: 19, borderRadius: "50%", background: "var(--text)",
            position: "absolute", top: 3, right: f.enabled ? 24 : 3, transition: "right .2s" }} />
        </button>
      </div>
      <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">ما بلغ الحدّ لا يُنفَّذ بل يُحفظ طلبًا للمدير، ويُنفَّذ مرّةً واحدة عند اعتماده.</p>
      <div className="grid grid-cols-3 gap-2">
        {rules.map((r) => (
          <Field key={r.id} label={`${r.label} — من`}>
            <NumericInput value={f.th[r.id]} onChange={(v) => !dis && setF((x) => ({ ...x, th: { ...x.th, [r.id]: v } }))} placeholder="0" />
          </Field>
        ))}
      </div>
      <p style={{ color: "var(--accent)" }} className="text-xs font-bold mt-2 mb-1">قفل الفترات</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="قفل نهائي حتى (للجميع)">
          <input type="date" style={inputStyle} disabled={dis} value={f.lockAll} onChange={(e) => setF((x) => ({ ...x, lockAll: e.target.value }))} />
        </Field>
        <Field label="قفل جزئي حتى (عدا المدير)">
          <input type="date" style={inputStyle} disabled={dis} value={f.lockPosted} onChange={(e) => setF((x) => ({ ...x, lockPosted: e.target.value }))} />
        </Field>
      </div>
      <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
        ⚖ من سلّم قوائم الربع يُقفل حتى آخر يومٍ فيه ولو كان في منتصف الشهر التالي — فلا يُصلَح قيدٌ بعد شهرين ويختلف التقرير المُسلَّم عمّا في النظام.
      </p>
      {canEdit ? (
        <button onClick={save} disabled={busy} className="w-full py-2.5 rounded-xl text-xs font-bold"
          style={{ background: "linear-gradient(135deg, var(--gradFrom), var(--gradTo))", color: "var(--bg)", opacity: busy ? 0.6 : 1 }}>
          {busy ? "جارٍ الحفظ…" : "حفظ الرقابة"}
        </button>
      ) : (
        <p style={{ color: "var(--text3)" }} className="text-[11px]">الضبط بيد المدير.</p>
      )}
    </Card>
  );
}

export { ControlsSettingsCard };
