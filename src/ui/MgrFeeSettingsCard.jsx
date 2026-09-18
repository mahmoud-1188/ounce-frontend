import React from "react";
import { MGR_FEE_DEFAULT } from "../core/constants.js";
import { fmtMoney } from "../core/money.js";
import { mgrFeeEnabled, mgrFeeOn, mgrFeeRate } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

function MgrFeeSettingsCard({ settings, onSave }) {
  const enabled = mgrFeeEnabled(settings);
  const rate = mgrFeeRate(settings);
  // ⚠ حقلا mgrFeeEnabled/mgrFeeRate مستقلّان عن taxEnabled/taxRate عمدًا
  // (ضريبة القيمة المضافة) — راجع الملاحظة في domain/helpers.js.
  const set = (patch) => onSave({ ...settings, ...patch });
  return (
    <Card style={{ padding: 14, marginBottom: 16 }}>
      <div className="flex items-center justify-between mb-1">
        <span style={{ color: "var(--text)" }} className="text-[12px] font-bold">عمولة المدير</span>
        <button onClick={() => set({ mgrFeeEnabled: !enabled })}
          className="px-3 py-1 rounded-full text-[11px] font-bold"
          style={{ background: enabled ? "var(--accentBg)" : "var(--field)",
                   color: enabled ? "var(--accent)" : "var(--text3)",
                   border: `1px solid ${enabled ? "var(--accentLine)" : "var(--line)"}` }}>
          {enabled ? "مفعّلة" : "مطفأة"}
        </button>
      </div>
      <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
        نسبةٌ على صافي مبيعات كل بائع، تُعتمد يوم الإقفال — بخصمها أو بدونه.
      </p>
      {enabled && (
        <>
          <Field label="النسبة ٪">
            <NumericInput value={String(rate)}
              onChange={(v) => set({ mgrFeeRate: v === "" ? MGR_FEE_DEFAULT / 100 : Number(v) / 100 })} />
          </Field>
          <Card style={{ padding: 10, background: "var(--field)" }}>
            <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">مثال</p>
            <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">
              مبيعات 50,000 ← عمولة {fmtMoney(mgrFeeOn(50000, rate))}
            </p>
          </Card>
          <p style={{ color: "var(--text3)", margin: "8px 0 0" }} className="text-[10px] leading-6">
            ⚠ تُحتسب على <b>الصافي بعد المرتجعات</b> — عمولةٌ على بيعٍ رُدّ
            تُحسب على مالٍ لم يبقَ.
          </p>
          <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px] leading-6">
            القيد: مصروف <b>5240</b> مدين · مستحقّ <b>2240</b> دائن. حسابٌ
            مستقلّ لا يمسّ غيره.
          </p>
        </>
      )}
    </Card>
  );
}
export { MgrFeeSettingsCard };
