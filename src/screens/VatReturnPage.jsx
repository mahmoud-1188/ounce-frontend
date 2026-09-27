import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fmtMoney } from "../core/money.js";
import * as api from "../core/api.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// إقرار ضريبة القيمة المضافة (migration 060) — بنود الإقرار من الفواتير وقيود المردودات، مع مطابقة حساب 2220
const iso = (d) => d.toISOString().slice(0, 10);
function quarter(offset = 0) {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + offset;
  const from = new Date(Date.UTC(now.getFullYear(), q * 3, 1));
  const to = new Date(Date.UTC(now.getFullYear(), q * 3 + 3, 0));
  return [iso(from), iso(to)];
}

function VatReturnPage({ currency = "ر.س", onBack }) {
  const [[from, to], setRange] = useState(quarter(0));
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setD(null); setErr(null);
    api.budgetsApi.vatReturn(from, to).then(setD).catch(() => setErr("تعذّر إعداد الإقرار"));
  }, [from, to]);
  const m = (v) => `${currency}${fmtMoney(v)}`;
  const Line = ({ n, l, base, vat, strong, tone }) => (
    <div className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--line)" }}>
      <span className="text-[10px] font-bold w-5 text-center" style={{ color: "var(--text3)" }}>{n}</span>
      <span className="flex-1 text-xs" style={{ color: "var(--text)", fontWeight: strong ? 700 : 400 }}>{l}</span>
      <span className="text-[11px] w-24 text-left" style={{ color: "var(--text2)" }}>{base == null ? "" : m(base)}</span>
      <span className="text-[11px] w-20 text-left font-bold" style={{ color: tone || "var(--text)" }}>{vat == null ? "" : m(vat)}</span>
    </div>
  );
  return (
    <div className="pb-24">
      <SubPageHeader title="إقرار ضريبة القيمة المضافة" onBack={onBack} />
      <div className="px-4 pt-3">
        <Card style={{ padding: 12, marginBottom: 10 }}>
          <div className="flex gap-2 mb-2">
            {[[0, "الربع الحالي"], [-1, "الربع السابق"]].map(([o, l]) => (
              <button key={o} onClick={() => setRange(quarter(o))} className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                style={{ background: from === quarter(o)[0] ? "var(--accentBg)" : "var(--field)", color: "var(--accent)", border: "1px solid var(--line)" }}>{l}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="date" style={{ ...inputStyle, marginBottom: 0 }} value={from} onChange={(e) => e.target.value && setRange([e.target.value, to])} />
            <input type="date" style={{ ...inputStyle, marginBottom: 0 }} value={to} onChange={(e) => e.target.value && setRange([from, e.target.value])} />
          </div>
        </Card>
        {err && <p className="text-xs font-bold" style={{ color: "var(--bad)" }}>{err}</p>}
        {!d && !err && <div className="flex justify-center py-8"><Loader2 className="animate-spin" size={20} color="var(--accent)" /></div>}
        {d && (
          <>
            <Card style={{ padding: 12, marginBottom: 10 }}>
              <div className="flex gap-2 pb-1 text-[10px] font-bold" style={{ color: "var(--text3)" }}>
                <span className="w-5" /><span className="flex-1">البند</span><span className="w-24 text-left">المبلغ</span><span className="w-20 text-left">الضريبة</span>
              </div>
              <Line n="1" l={`المبيعات الخاضعة للنسبة الأساسية (${d.sales.standard.count} فاتورة)`} base={d.sales.standard.base} vat={d.sales.standard.vat} />
              <Line n="—" l={`المردودات والتعديلات (${d.sales.returns.count})`} base={-d.sales.returns.base} vat={-d.sales.returns.vat} tone="var(--bad)" />
              <Line n="4" l={`مبيعات بلا ضريبة / معفاة (${d.sales.exempt.count})`} base={d.sales.exempt.base} vat={0} />
              <Line n="6" l="إجمالي المبيعات" base={d.sales.standard.base - d.sales.returns.base + d.sales.exempt.base} vat={d.sales.standard.vat - d.sales.returns.vat} strong />
              <Line n="7" l="المشتريات الخاضعة (ضريبة المدخلات)" base={null} vat={d.purchases.vat} />
              <Line n="13" l="صافي الضريبة المستحقة" base={null} vat={d.netDue} strong tone="var(--accent)" />
            </Card>
            <Card style={{ padding: 12, marginBottom: 10, border: `1px solid ${Math.abs(d.diff) > 0.01 ? "var(--badLine)" : "var(--line)"}` }}>
              <p className="text-xs font-bold" style={{ color: "var(--text)", margin: 0 }}>مطابقة حساب 2220 (ضريبة القيمة المضافة المستحقة)</p>
              <p className="text-[11px]" style={{ color: "var(--text2)", margin: "4px 0 0" }}>حركة الحساب في الفترة {m(d.ledgerNet)} — {Math.abs(d.diff) > 0.01 ? <b style={{ color: "var(--bad)" }}>فرق {m(d.diff)} يحتاج مراجعة</b> : <b style={{ color: "var(--good)" }}>مطابق للإقرار</b>}</p>
            </Card>
            <p className="text-[11px]" style={{ color: "var(--text3)" }}>
              ⚠ ضريبة المدخلات على المشتريات والمصروفات لا تُسجَّل في النظام بعد — أضِفها من فواتير مورديك عند تقديم الإقرار في بوابة هيئة الزكاة والضريبة والجمارك. الأرقام بتوقيت الرياض.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export { VatReturnPage };
