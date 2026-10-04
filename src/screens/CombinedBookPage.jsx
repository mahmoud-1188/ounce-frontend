import React, { useMemo, useState } from "react";
import { PURITY, fmtMoney, fmtW } from "../core/money.js";
import { accountByCode } from "../domain/accountByCode.js";
import { buildCombinedBook } from "../domain/combinedBook.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// الدفتر الثالث — الذهب والنقد معًا بما يساوي الذهب بسعر اليوم (المرجع 5.2.0 · للعرض، لا قيد)
function CombinedBookPage({ goldPosition, journal = [], price24 = 0, currency = "ر.س", baseKarat = 21, onBack }) {
  const [period, setPeriod] = useState("month");
  const KB = Number(baseKarat) || 21;
  const toK = (fine) => (Number(fine) || 0) / (PURITY[KB] || KB / 24);
  const now = new Date();
  const from = period === "today" ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : period === "month" ? new Date(now.getFullYear(), now.getMonth(), 1)
    : period === "quarter" ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    : period === "year" ? new Date(now.getFullYear(), 0, 1) : null;
  const b = useMemo(() => buildCombinedBook({ goldPosition, journal, price24, from: from ? from.toISOString() : null, to: now.toISOString() }),
    [goldPosition, journal, price24, period]); // eslint-disable-line react-hooks/exhaustive-deps
  const g = (fine) => `${fmtW(toK(fine))} جم${KB}`;
  const sar = (v) => `${fmtMoney(v)} ${currency}`;
  const sign = (x) => (x > 0 ? "+" : x < 0 ? "−" : "");
  const Row = ({ l, a, bb, strong, color }) => (
    <div className="flex justify-between gap-2 py-1.5 text-[12px]" style={{ borderTop: "1px solid var(--line)", color: color || (strong ? "var(--text)" : "var(--text2)"), fontWeight: strong ? 800 : 500 }}>
      <span>{l}</span><span style={{ textAlign: "left" }}>{a}{bb ? <span style={{ color: "var(--text3)", fontWeight: 500 }}> · {bb}</span> : null}</span>
    </div>
  );
  return (
    <div className="pb-24">
      <SubPageHeader title="الذهب والنقد معًا" onBack={onBack} />
      <div className="px-4 pt-3">
        <Card style={{ padding: 12, marginBottom: 12, background: "var(--accentBg)", border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--accentText)", margin: 0 }} className="text-[11px] leading-6">
            ⚖ الأرباح تُحسب <b>بالذهب</b>، والنقد مبلغٌ لا يُعدّ ربحًا — يُعرض بجانبه بما يساويه ذهبًا. هذا <b>الدفتر الثالث</b> يجمع
            الاثنين بسعر اليوم ({sar(price24)} لجرام 24) ليجيب: لو حوّلنا النقد ذهبًا، كم مخزوننا؟ لا يُكتب منه قيد.
          </p>
        </Card>
        {b.priceMissing && <p style={{ color: "var(--bad)" }} className="text-xs mb-2">⚠ لا سعر ذهبٍ اليوم — أدخِله من «السعر اليومي» ليُحسب المقابل.</p>}
        <div className="flex gap-1 mb-3">
          {[["today", "اليوم"], ["month", "الشهر"], ["quarter", "الربع"], ["year", "السنة"], ["all", "منذ البداية"]].map(([id, l]) => (
            <button key={id} onClick={() => setPeriod(id)} className="flex-1 py-1.5 rounded-lg text-[11px] font-bold"
              style={{ background: period === id ? "var(--accentBg)" : "var(--panel)", color: period === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
          ))}
        </div>

        <Card style={{ padding: 12, marginBottom: 12 }}>
          <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-xs font-bold">① الدفتر الذهبي — ما نملكه ذهبًا الآن</p>
          <Row l="ذهب مشغول (مُكوَّد)" a={g(b.gold.worked)} bb={sar(b.gold.worked * price24)} />
          <Row l="ذهب غير مشغول (كسر · خزنة · مكاتب)" a={g(b.gold.unworked)} bb={sar(b.gold.unworked * price24)} />
          <Row l="ناقص: ما علينا ذهبًا (موردون · مكاتب · أمانات)" a={`−${g(b.gold.owed)}`} bb={sar(-b.gold.owed * price24)} />
          <Row l="الذهب المملوك" a={g(b.gold.owned)} bb={sar(b.gold.owned * price24)} strong />
        </Card>

        <Card style={{ padding: 12, marginBottom: 12 }}>
          <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-xs font-bold">② الدفتر المالي — النقد وما في حكمه (مبلغٌ لا ربح)</p>
          {b.money.rows.map((r) => <Row key={r.code} l={`${r.code} ${accountByCode(r.code)?.name || ""}`} a={sar(r.v)} bb={price24 > 0 ? g(r.v / price24) : ""} />)}
          <Row l="صافي النقد" a={sar(b.money.net)} bb={price24 > 0 ? `يساوي ${g(b.money.grams)}` : ""} strong />
        </Card>

        <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-xs font-bold">③ الدفتر الثالث — معًا بما يساوي الذهب</p>
          <Row l="الذهب المملوك" a={g(b.gold.owned)} />
          <Row l="+ النقد بما يساويه ذهبًا" a={g(b.money.grams)} />
          <Row l="= مخزوننا معًا" a={g(b.total.grams)} bb={sar(b.total.value)} strong color="var(--text)" />
        </Card>

        {b.period && (
          <Card style={{ padding: 12, marginBottom: 12 }}>
            <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-xs font-bold">حركة النقد في الفترة</p>
            <Row l="في أوّلها" a={sar(b.period.moneyStart)} />
            <Row l="في آخرها" a={sar(b.period.moneyEnd)} />
            {Math.abs(b.period.moneyFlows) >= 0.01 && <Row l="مستبعد: رأس مالٍ أُدخل أو سُحب · أرصدة افتتاحية" a={sar(b.period.moneyFlows)} />}
            <Row l="تغيّر النقد (لا يُعدّ ربحًا)" a={sar(b.period.moneyGain)} bb={price24 > 0 ? `يساوي ${sign(b.period.moneyGainGrams)}${g(Math.abs(b.period.moneyGainGrams))}` : ""}
              strong color={b.period.moneyGain >= 0 ? "var(--good)" : "var(--bad)"} />
            <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[10px] leading-5">
              الذهب يُقاس بالوزن فلا يتحرّك بالسعر؛ والنقد يُحوَّل بسعر اليوم فيتحرّك مقابله إذا تحرّك السعر. مكسب الذهب بالجرام في «القوائم المالية والزكاة».
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

export { CombinedBookPage };
