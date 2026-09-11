import React, { useMemo, useState } from "react";
import { KARATS, PURITY, fmtMoney, fmtW } from "../core/money.js";
import { FUNDING_SOURCES } from "../core/workflow.js";
import { inputStyle } from "../domain/helpers.js";
import { settleableScrap } from "../domain/settleableScrap.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { NumericInput } from "./NumericInput.jsx";

function SettleSupplierForm({ supplier, owed, scrapEntries, offices, currency, price24, onCancel, onSubmit }) {
  const [source, setSource] = useState("scrap");
  const [officeId, setOfficeId] = useState("");
  const [lines, setLines] = useState([{ key: Math.random().toString(36).slice(2), karat: 21, weight: "" }]);
  const [feeAmount, setFeeAmount] = useState("");
  const [feeSource, setFeeSource] = useState("safe_cash");

  // ⚠ رصيد الكسر القابل للسداد: ما بلغ الخزنة فقط.
  // الكسر في الصندوق لم يُفحص، ودفعه للمورد تسليم وزن غير مؤكّد.
  const scrapStock = useMemo(() => {
    const byK = {};
    settleableScrap(scrapEntries).forEach((e) => {
      byK[e.karat] = (byK[e.karat] || 0) + (Number(e.weight) || 0);
    });
    return byK;
  }, [scrapEntries]);

  const addLine = () =>
    setLines((p) => [...p, { key: Math.random().toString(36).slice(2), karat: 21, weight: "" }]);
  const rmLine = (k) => setLines((p) => (p.length > 1 ? p.filter((x) => x.key !== k) : p));
  const upd = (k, field, v) => setLines((p) => p.map((x) => (x.key === k ? { ...x, [field]: v } : x)));

  const totalFine = lines.reduce(
    (a, l) => a + (Number(l.weight) || 0) * (PURITY[l.karat] || Number(l.karat) / 24),
    0
  );
  const fee = Number(feeAmount) || 0;

  // التحقق: لا يُخصم من الكسر أكثر من رصيده
  const overdrawn = source === "scrap"
    ? lines.filter((l) => (Number(l.weight) || 0) > (Number(scrapStock[l.karat]) || 0) + 0.0001)
    : [];
  const needsOffice = source === "office";
  const valid =
    (totalFine > 0 || fee > 0) &&
    overdrawn.length === 0 &&
    (!needsOffice || !!officeId) &&
    (totalFine === 0 || lines.some((l) => Number(l.weight) > 0));

  const remainingGold = (owed?.goldOwed || 0) - totalFine;
  const remainingFees = (owed?.feesOwed || 0) - fee;

  return (
    <Card style={{ padding: 14, marginBottom: 16, border: "1px solid var(--accentLine)" }}>
      <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-1">
        سداد {supplier?.name}
      </p>
      <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
        الذهب يُسدَّد ذهبًا والأجور نقدًا. خلطهما يُنتج ربحًا أو خسارة وهميين من فرق السعر.
      </p>

      {/* المستحق */}
      <Card style={{ padding: 10, marginBottom: 12, background: "var(--bg)" }}>
        <div className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ color: "var(--text2)" }} className="text-[11px]">ذهب مستحق</span>
          <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
            {fmtW(owed?.goldOwed || 0)} جم عيار 24
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span style={{ color: "var(--text2)" }} className="text-[11px]">أجور مستحقة</span>
          <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
            {currency}{fmtMoney(owed?.feesOwed || 0)}
          </span>
        </div>
      </Card>

      {/* ① الذهب */}
      <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
        ① سداد الذهب
      </p>
      <Field label="مصدر الذهب">
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "scrap", label: "من الكسر", hint: "بأي عيار" },
            { id: "safe", label: "من الخزنة", hint: "ذهب خام" },
            { id: "office", label: "تسكير مكتب", hint: "التزام ينتقل" },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setSource(o.id);
                if (o.id !== "office") setOfficeId("");
              }}
              className="py-2 rounded-xl text-[11px] font-bold text-right px-2"
              style={{
                background: source === o.id ? "var(--accentBg)" : "var(--panel)",
                color: source === o.id ? "var(--accent)" : "var(--text2)",
                border: `1px solid ${source === o.id ? "var(--accentLine)" : "var(--edge)"}`,
              }}
            >
              {o.label}
              <span style={{ color: "var(--text3)" }} className="block text-[9px]">{o.hint}</span>
            </button>
          ))}
        </div>
      </Field>

      {needsOffice && (
        <Field label="المكتب (إجباري)">
          <select style={inputStyle} value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
            <option value="">اختر المكتب...</option>
            {(offices || []).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </Field>
      )}

      {source === "scrap" && Object.keys(scrapStock).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(scrapStock)
            .filter(([, v]) => v > 0.001)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([k, v]) => (
              <span
                key={k}
                className="text-[10px] px-2 py-1 rounded-full"
                style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
              >
                عيار {k}: {fmtW(v)} جم
              </span>
            ))}
        </div>
      )}

      {lines.map((l, i) => {
        const over = source === "scrap" && (Number(l.weight) || 0) > (Number(scrapStock[l.karat]) || 0) + 0.0001;
        return (
          <div key={l.key} style={{ marginBottom: 8 }}>
            <div className="grid grid-cols-3 gap-2" style={{ alignItems: "end" }}>
              <Field label={i === 0 ? "العيار" : ""}>
                <select style={inputStyle} value={l.karat} onChange={(e) => upd(l.key, "karat", Number(e.target.value))}>
                  {KARATS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </Field>
              <Field label={i === 0 ? "الوزن (جم)" : ""}>
                <NumericInput value={l.weight} onChange={(v) => upd(l.key, "weight", v)} placeholder="0.00" />
              </Field>
              <div style={{ marginBottom: 14 }}>
                {lines.length > 1 && (
                  <button
                    onClick={() => rmLine(l.key)}
                    className="w-full py-2.5 rounded-xl text-[11px]"
                    style={{ background: "var(--panel)", color: "var(--bad)", border: "1px solid var(--line)" }}
                  >
                    حذف
                  </button>
                )}
              </div>
            </div>
            {Number(l.weight) > 0 && (
              <p className="text-[11px]" style={{ marginTop: -8, marginBottom: 6, color: over ? "var(--bad)" : "var(--text3)" }}>
                {over
                  ? `المتاح من عيار ${l.karat} هو ${fmtW(scrapStock[l.karat] || 0)} جم`
                  : `يعادل ${fmtW((Number(l.weight) || 0) * (PURITY[l.karat] || l.karat / 24))} جم عيار 24`}
              </p>
            )}
          </div>
        );
      })}

      <button
        onClick={addLine}
        className="w-full py-2 rounded-xl text-[11px] font-bold mb-3"
        style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
      >
        + إضافة عيار آخر
      </button>

      {/* ② الأجور */}
      <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
        ② سداد الأجور — نقدًا دائمًا
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label={`المبلغ (${currency})`}>
          <NumericInput value={feeAmount} onChange={setFeeAmount} placeholder="0" />
        </Field>
        <Field label="يُدفع من">
          <select style={inputStyle} value={feeSource} onChange={(e) => setFeeSource(e.target.value)}>
            {FUNDING_SOURCES.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* الملخص */}
      {(totalFine > 0 || fee > 0) && (
        <Card style={{ padding: 10, marginBottom: 12, background: "var(--bg)" }}>
          {totalFine > 0 && (
            <div className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--line)" }}>
              <span style={{ color: "var(--text2)" }} className="text-[11px]">إجمالي الذهب المسدَّد</span>
              <span style={{ color: "var(--good)" }} className="text-xs font-bold">{fmtW(totalFine)} جم عيار 24</span>
            </div>
          )}
          <div className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--line)" }}>
            <span style={{ color: "var(--text2)" }} className="text-[11px]">المتبقي من الذهب</span>
            <span style={{ color: Math.abs(remainingGold) < 0.001 ? "var(--goodSolid)" : remainingGold > 0 ? "var(--accent)" : "var(--bad)" }} className="text-xs font-bold">
              {Math.abs(remainingGold) < 0.001 ? "مسدَّد" : `${fmtW(Math.abs(remainingGold))} جم${remainingGold < 0 ? " زائد" : ""}`}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span style={{ color: "var(--text2)" }} className="text-[11px]">المتبقي من الأجور</span>
            <span style={{ color: Math.abs(remainingFees) < 0.01 ? "var(--goodSolid)" : remainingFees > 0 ? "var(--accent)" : "var(--bad)" }} className="text-xs font-bold">
              {Math.abs(remainingFees) < 0.01 ? "مسدَّدة" : `${currency}${fmtMoney(Math.abs(remainingFees))}${remainingFees < 0 ? " زائد" : ""}`}
            </span>
          </div>
        </Card>
      )}

      {overdrawn.length > 0 && (
        <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">
          لا يمكن خصم أكثر من رصيد الكسر المتاح.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onCancel}
          className="py-2.5 rounded-xl text-xs font-bold"
          style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
        >
          إلغاء
        </button>
        <button
          disabled={!valid}
          onClick={() =>
            onSubmit({
              supplierId: supplier.id,
              goldSource: source,
              officeId: officeId || null,
              goldLines: lines.map((l) => ({ karat: l.karat, weight: Number(l.weight) || 0 })),
              feeAmount: fee,
              feeSource,
            })
          }
          className="py-2.5 rounded-xl text-xs font-bold"
          style={{
            background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
            color: valid ? "var(--panel)" : "var(--text3)",
          }}
        >
          تأكيد السداد
        </button>
      </div>
    </Card>
  );
}

// ============================================================
// استلام الكسر — فحص وتثبيت قبل الإدخال
//
// شراء الكسر ليس إدخال رقم. الوزن القائم يشمل فصوصًا ولحامًا وأوساخًا،
// والعيار يُقدَّر بالمحك أو الجهاز. الإدخال المباشر بلا فحص يُدخل وزنًا
// ليس ذهبًا فيتضخّم المخزون بما لا تملكه.
//
// المسار: قياس ← فحص ← تسعير ← تثبيت.
// ============================================================

export { SettleSupplierForm };
