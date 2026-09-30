import React, { useMemo, useState } from "react";
import { fmtMoney } from "../core/money.js";
import { buildIfrsStatements, ifrsChecks } from "../domain/buildIfrsStatements.js";
import { Card } from "../ui/Card.jsx";
import { IfrsBridgeCard } from "../ui/IfrsBridgeCard.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// المعايير الدولية (IFRS) — الامتثال · القوائم بتصنيف IAS 1 · السياسات (المرجع 5.2.0 · قراءةٌ من الدفتر)
function IfrsPage({ journal = [], fixedAssets = [], currency = "ر.س", periodStart = null, price24 = 0, onBack }) {
  const [tab, setTab] = useState("status");
  const m = (v) => `${currency}${fmtMoney(v)}`;
  const nowIso = useMemo(() => new Date().toISOString(), [journal]);
  const st = useMemo(() => buildIfrsStatements({ journal, from: periodStart, to: nowIso }), [journal, periodStart, nowIso]);
  const checks = useMemo(() => ifrsChecks({ journal, statements: st, fixedAssets }), [journal, st, fixedAssets]);
  const TONE = { ok: "var(--good)", todo: "var(--accent)", fail: "var(--bad)", na: "var(--text3)" };
  const MARK = { ok: "✓", todo: "⚠", fail: "✗", na: "ℹ" };
  const Sec = ({ title, children }) => (
    <Card style={{ padding: 12, marginBottom: 10 }}>
      {title && <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-xs font-bold">{title}</p>}
      {children}
    </Card>
  );
  const Row = ({ l, v, strong, sub }) => (
    <div className="flex justify-between py-1 text-[12px]" style={{ borderTop: "1px solid var(--line)", color: strong ? "var(--text)" : sub ? "var(--text3)" : "var(--text2)", fontWeight: strong ? 800 : 500 }}>
      <span style={{ paddingInlineStart: sub ? 10 : 0 }}>{l}</span><span>{m(v)}</span>
    </div>
  );
  const Group = ({ k, label }) => (
    <>
      <Row l={label} v={st.sofp.totals[k]} strong />
      {st.sofp[k].map((r) => <Row key={r.code} l={`${r.code} ${r.name}`} v={r.amount} sub />)}
    </>
  );
  return (
    <div className="pb-24">
      <SubPageHeader title="المعايير الدولية — IFRS" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="flex gap-1.5 flex-wrap mb-3">
          {[["status", "الامتثال"], ["statements", "القوائم"], ["bridge", "الجسر والقياس"], ["policies", "السياسات"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} className="px-3 py-1.5 rounded-xl text-[11px] font-bold"
              style={{ background: tab === id ? "var(--accentBg)" : "var(--panel)", color: tab === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{lbl}</button>
          ))}
        </div>
        {tab === "status" && (
          <Sec title="هل الدفتر المالي مقيسٌ بالمعايير الدولية؟">
            {checks.map((c) => (
              <div key={c.id} className="flex gap-2 py-1.5" style={{ borderTop: "1px solid var(--line)" }}>
                <span style={{ color: TONE[c.status], fontWeight: 800, width: 16 }}>{MARK[c.status]}</span>
                <div className="flex-1">
                  <p className="text-[12px] font-bold" style={{ color: "var(--text)", margin: 0 }}>{c.label} <span style={{ color: "var(--text3)", fontWeight: 500 }}>· {c.std}</span></p>
                  <p className="text-[11px]" style={{ color: "var(--text3)", margin: 0 }}>{c.why}</p>
                </div>
              </div>
            ))}
          </Sec>
        )}
        {tab === "bridge" && <IfrsBridgeCard price24={price24} currency={currency} />}
        {tab === "statements" && (
          <>
            <Sec title={`قائمة المركز المالي (IAS 1) ${st.sofp.balanced ? "✓ متوازنة" : "✗ غير متوازنة"}`}>
              <Group k="currentAssets" label="الأصول المتداولة" />
              <Group k="nonCurrentAssets" label="الأصول غير المتداولة" />
              <Row l="مجموع الأصول" v={st.sofp.assetsTotal} strong />
              <Group k="currentLiabilities" label="الالتزامات المتداولة" />
              <Group k="nonCurrentLiabilities" label="الالتزامات غير المتداولة" />
              <Group k="equity" label="حقوق الملكية" />
              <Row l="ربح الفترة غير المُقفل" v={st.sofp.unclosedProfit} sub />
              <Row l="مجموع الالتزامات وحقوق الملكية" v={st.sofp.liabilitiesTotal + st.sofp.equityTotal} strong />
            </Sec>
            <Sec title={`قائمة الربح أو الخسارة${periodStart ? ` منذ ${String(periodStart).slice(0, 10)}` : ""}`}>
              <Row l="الإيراد" v={st.pl.revenue} />
              <Row l="تكلفة المبيعات" v={-st.pl.costOfSales} />
              <Row l="مجمل الربح" v={st.pl.grossProfit} strong />
              <Row l="إيرادات أخرى" v={st.pl.otherIncome} />
              {Math.abs(st.pl.goldRemeasurement) >= 0.01 && <Row l="فروق إعادة قياس أرصدة الذهب" v={st.pl.goldRemeasurement} />}
              <Row l="مصروفات التشغيل" v={-st.pl.operatingExpenses} />
              <Row l="الربح التشغيلي" v={st.pl.operatingProfit} strong />
              <Row l="تكاليف التمويل" v={-st.pl.financeCosts} />
              <Row l="الربح قبل الزكاة" v={st.pl.profitBeforeZakat} />
              <Row l="الزكاة" v={-st.pl.zakat} />
              <Row l="صافي الربح" v={st.pl.netProfit} strong />
            </Sec>
          </>
        )}
        {tab === "policies" && (
          <Sec title="السياسات المحاسبية المتّبعة">
            {[
              ["IAS 2 — المخزون", "الذهب المشغول بتكلفته (سعر الجرام + المصنعية)، والكسر بتكلفة شرائه. القياس بالأقل من التكلفة وصافي القيمة القابلة للتحقق يُراجَع في نهاية الفترة."],
              ["IFRS 15 — الإيراد", "يُثبت عند التسليم صافيًا من ضريبة القيمة المضافة. العربون التزامٌ (2210) حتى البيع، ويُخصم من الفاتورة."],
              ["IAS 16 — الأصول الثابتة", "بالتكلفة ناقص مجمّع الإهلاك، بالقسط الثابت أو المتناقص على عمر الفئة، والاستبعاد يُثبت مكسبه أو خسارته."],
              ["IAS 19 — منافع الموظفين", "مخصّص نهاية الخدمة يُكوَّن شهريًّا مع الرواتب (2330)، والتأمينات مستحقة حتى السداد (2320)."],
              ["IAS 1 — العرض", "متداولٌ وغير متداول، والدخل بالوظيفة. الذهب يُعرض بالوزن بجانب قيمته في دفترٍ مستقل (الدفتر الوزني)."],
            ].map(([t, d]) => (
              <div key={t} className="py-1.5" style={{ borderTop: "1px solid var(--line)" }}>
                <p className="text-[12px] font-bold" style={{ color: "var(--text)", margin: 0 }}>{t}</p>
                <p className="text-[11px] leading-5" style={{ color: "var(--text2)", margin: 0 }}>{d}</p>
              </div>
            ))}
          </Sec>
        )}
      </div>
    </div>
  );
}

export { IfrsPage };
