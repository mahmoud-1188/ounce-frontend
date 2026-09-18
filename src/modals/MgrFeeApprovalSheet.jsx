import React, { useState } from "react";
import { fmt, fmtMoney } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";

function MgrFeeApprovalSheet({ breakdown, rate, currency = "ر.س", dayRef, onApprove, onCancel }) {
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState(null);     // with | without
  const { rows, totalSales, totalReturns, totalNet, totalFee } = breakdown;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,.75)" }}>
      <div style={{ background: "var(--panel)", borderRadius: "18px 18px 0 0", maxHeight: "92vh", overflow: "auto" }}
        className="px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: "var(--accent)" }} className="text-[13px] font-bold">
            اعتماد مبيعات {dayRef || "اليوم"}
          </span>
          <button onClick={onCancel} style={{ color: "var(--text3)" }} className="text-[11px]">إلغاء</button>
        </div>
        <p style={{ color: "var(--text3)", margin: "0 0 10px" }} className="text-[10px] leading-6">
          راجع مبيعات كل بائع، ثم اعتمد اليوم بعمولة المدير ({fmt(rate, 2)}٪) أو بدونها.
        </p>

        {rows.length === 0 ? (
          <Card style={{ padding: 14, marginBottom: 10 }}>
            <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">لا مبيعات اليوم</p>
          </Card>
        ) : (
          <>
            <div className="mb-2">
              {rows.map((r) => (
                <Card key={r.sellerId} style={{ padding: 11, marginBottom: 6 }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--text)" }} className="text-[12px] font-bold flex-1">{r.name}</span>
                    <span style={{ color: "var(--text3)" }} className="text-[10px]">{r.invoices} فاتورة</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 mt-1" style={{ fontSize: 10, color: "var(--text3)" }}>
                    <span>مبيعات {currency}{fmtMoney(r.sales)}</span>
                    {r.returns > 0 && <span style={{ color: "var(--bad)" }}>مرتجع −{fmtMoney(r.returns)}</span>}
                  </div>
                  <div className="flex items-baseline justify-between mt-1.5 pt-1.5"
                    style={{ borderTop: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">
                      الصافي {currency}{fmtMoney(r.net)}
                    </span>
                    <span style={{ color: "var(--accent)" }} className="text-[12px] font-bold">
                      العمولة {currency}{fmtMoney(r.fee)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>

            <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
              {[["إجمالي المبيعات", totalSales, "text"],
                ...(totalReturns > 0 ? [["المرتجعات", -totalReturns, "bad"]] : []),
                ["الصافي", totalNet, "text"],
                [`عمولة المدير ${fmt(rate, 2)}٪`, totalFee, "accent"]].map(([l, v, tone]) => (
                <div key={l} className="flex items-baseline justify-between py-1">
                  <span style={{ color: "var(--text3)" }} className="text-[11px]">{l}</span>
                  <span style={{ color: `var(--${tone})` }} className="text-[12px] font-bold">
                    {currency}{fmtMoney(v)}
                  </span>
                </div>
              ))}
            </Card>
          </>
        )}

        <Field label="ملاحظة الاعتماد (اختياري)">
          <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          {[["without", "اعتمد بلا عمولة", "var(--field)", "var(--text2)"],
            ["with", `اعتمد بالعمولة ${fmtMoney(totalFee)}`, "var(--accentBg)", "var(--accent)"]].map(([id, lbl, bg, fg]) => (
            <button key={id} onClick={() => setChoice(id)} className="py-2.5 rounded-xl text-[11px] font-bold"
              style={{ background: choice === id ? bg : "var(--panel)",
                       color: choice === id ? fg : "var(--text3)",
                       border: `1px solid ${choice === id ? "var(--accentLine)" : "var(--line)"}` }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* ⚠ خطوتان لا واحدة: الاعتماد يُقيَّد ولا يُعكس إلا بقيدٍ مضاد،
            وضغطةٌ واحدة بالخطأ تُنشئ مستحقًّا على المحل. */}
        <button disabled={!choice}
          onClick={() => onApprove(choice === "with", note)}
          className="w-full mt-3 py-3 rounded-xl text-[13px] font-bold"
          style={{ background: choice ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)",
                   color: choice ? "var(--panel)" : "var(--text3)" }}>
          {choice === "with" ? `أكّد الاعتماد مع خصم ${currency}${fmtMoney(totalFee)}`
            : choice === "without" ? "أكّد الاعتماد بلا عمولة"
              : "اختر أولًا"}
        </button>
        <p style={{ color: "var(--text3)", margin: "8px 0 0" }} className="text-[10px] leading-6">
          ⚠ الاعتماد يُقيَّد باسمك ولا يُلغى — يُعكس بقيدٍ مضاد إن أخطأت.
        </p>
      </div>
    </div>
  );
}

export { MgrFeeApprovalSheet };
