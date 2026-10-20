import React, { useEffect, useMemo, useState } from "react";
import * as api from "../core/api.js";
import { fmtMoney, fmtW } from "../core/money.js";
import { toCsv } from "../domain/helpers.js";
import { buildIfrsStatements, ifrsChecks } from "../domain/buildIfrsStatements.js";
import { Card } from "../ui/Card.jsx";
import { IfrsBridgeCard } from "../ui/IfrsBridgeCard.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// المعايير الدولية (IFRS) — الامتثال · القوائم بتصنيف IAS 1 · السياسات (المرجع 5.2.0 · قراءةٌ من الدفتر)
function IfrsPage({ journal = [], fixedAssets = [], currency = "ر.س", periodStart = null, price24 = 0, onBack }) {
  const [tab, setTab] = useState("status");
  const m = (v) => `${fmtMoney(v)} ${currency}`;
  const nowIso = useMemo(() => new Date().toISOString(), [journal]);
  const st = useMemo(() => buildIfrsStatements({ journal, from: periodStart, to: nowIso }), [journal, periodStart, nowIso]);
  const checks = useMemo(() => ifrsChecks({ journal, statements: st, fixedAssets }), [journal, st, fixedAssets]);
  // الدفتران في سطر: المكسب بالوزن (مقياس الإدارة) والنتيجة الدولية والجسر بينهما — من الخادم بالدفاتر كاملة
  const [bridge, setBridge] = useState(null);
  const fromDay = (periodStart ? String(periodStart) : `${nowIso.slice(0, 4)}-01-01`).slice(0, 10);
  useEffect(() => {
    let live = true;
    const pc = Number(price24) || 0;
    api.fetchIfrsBridge({ from: fromDay, to: nowIso.slice(0, 10), priceOpen: pc, priceClose: pc })
      .then((b) => { if (live) setBridge(b); }).catch(() => { if (live) setBridge(null); });
    return () => { live = false; };
  }, [fromDay, price24]);
  const lastMeasureAt = useMemo(() => (journal || []).filter((e) => (e.opType || e.op_type) === "ifrs_measure" && !e.reversed)
    .map((e) => e.date || e.createdAt).sort().pop() || null, [journal]);
  const counts = checks.reduce((a, c) => ({ ...a, [c.status]: (a[c.status] || 0) + 1 }), {});
  const exportCsv = () => {
    const rows = [
      ["المركز المالي", "", ""],
      ...[["currentAssets", "الأصول المتداولة"], ["nonCurrentAssets", "الأصول غير المتداولة"], ["currentLiabilities", "الالتزامات المتداولة"], ["nonCurrentLiabilities", "الالتزامات غير المتداولة"], ["equity", "حقوق الملكية"]]
        .flatMap(([k, lbl]) => [[lbl, "", fmtMoney(st.sofp.totals[k])], ...st.sofp[k].map((r) => ["", `${r.code} ${r.name}`, fmtMoney(r.amount)])]),
      ["ربح الفترة غير المُقفل", "", fmtMoney(st.sofp.unclosedProfit)],
      ["الربح أو الخسارة", "", ""],
      ["الإيراد", "", fmtMoney(st.pl.revenue)], ["تكلفة المبيعات", "", fmtMoney(st.pl.costOfSales)], ["مجمل الربح", "", fmtMoney(st.pl.grossProfit)],
      ["إيرادات أخرى", "", fmtMoney(st.pl.otherIncome)], ["فروق إعادة قياس أرصدة الذهب", "", fmtMoney(st.pl.goldRemeasurement)],
      ["مصروفات التشغيل", "", fmtMoney(st.pl.operatingExpenses)], ["الربح التشغيلي", "", fmtMoney(st.pl.operatingProfit)],
      ["تكاليف التمويل", "", fmtMoney(st.pl.financeCosts)], ["الربح قبل الزكاة", "", fmtMoney(st.pl.profitBeforeZakat)], ["الزكاة", "", fmtMoney(st.pl.zakat)],
      ["صافي الربح", "", fmtMoney(st.pl.netProfit)],
      ...(bridge ? [["مطابقة المكسب بالوزن بالنتيجة الدولية", "", ""], ...(bridge.lines || []).map((l) => [l.label, l.hint || "", fmtMoney(l.amount)]),
        ["النتيجة وفق IFRS", "", fmtMoney(bridge.ifrsProfit)], ["فرق غير مفسَّر", "", fmtMoney(bridge.difference)]] : []),
    ];
    const blob = new Blob(["\ufeff" + toCsv(["البند", "التفصيل", "المبلغ"], rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `IFRS-${nowIso.slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
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
          {[["status", "حالة التطبيق"], ["statements", "القوائم"], ["bridge", "مطابقة الدفترين وقياس نهاية الفترة"], ["policies", "السياسات"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} className="px-3 py-1.5 rounded-xl text-[11px] font-bold"
              style={{ background: tab === id ? "var(--accentBg)" : "var(--panel)", color: tab === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{lbl}</button>
          ))}
        </div>
        {!(Number(price24) > 0) && <Sec><p style={{ color: "var(--bad)", margin: 0 }} className="text-xs font-bold">⚠ أدخل سعر اليوم — القياس بسعر الإقفال يحتاجه.</p></Sec>}
        {tab === "status" && (<>
          <Sec title="الدفتران">
            <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px] leading-6">
              <b>الدفتر المالي</b> بالريال هو الدفتر النظامي، مقيسٌ بالمعايير الدولية. و<b>الدفتر الوزني</b> مقياس الإدارة:
              المكسب = تغيّر الذهب المملوك. والجسر بينهما في «مطابقة الدفترين» — كل ريالٍ من الفرق مفسَّر.
            </p>
            <div data-ifrs-books>
              {[
                ["المكسب بالوزن للفترة", bridge ? `${bridge.gainFine >= 0 ? "+" : "−"}${fmtW(Math.abs(bridge.gainFine))} جم24` : "…"],
                ["النتيجة وفق IFRS للفترة", bridge ? m(bridge.ifrsProfit) : "…", bridge && (bridge.ifrsProfit >= 0 ? "var(--good)" : "var(--bad)")],
                ["الجسر بينهما", bridge ? (bridge.reconciles ? "✓ يتصالح" : `✗ فرق ${m(bridge.difference)}`) : "…", bridge && (bridge.reconciles ? "var(--good)" : "var(--bad)")],
                ["آخر قياس نهاية فترة", lastMeasureAt ? new Date(lastMeasureAt).toLocaleDateString("en-GB") : "لم يُرحَّل"],
              ].map(([l, v, tone]) => (
                <div key={l} className="flex justify-between py-1 text-[12px]" style={{ borderTop: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--text2)" }}>{l}</span><span style={{ color: tone || "var(--text)", fontWeight: 800 }}>{v}</span>
                </div>
              ))}
            </div>
          </Sec>
          <Sec title={`فحص الامتثال — ${counts.ok || 0} مطبَّق · ${(counts.todo || 0) + (counts.fail || 0)} يحتاج فعلًا`}>
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
          <button type="button" data-ifrs-csv onClick={exportCsv} className="w-full py-2.5 rounded-xl text-[12px] font-bold mb-2"
            style={{ background: "var(--field)", color: "var(--accent)", border: "1px solid var(--line)" }}>صدّر القوائم والمطابقة (CSV)</button>
        </>)}
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
          <Sec title="السياسات المحاسبية الجوهرية — إيضاحٌ للقوائم">
            <p className="text-[11px] leading-5 mb-1" style={{ color: "var(--text2)" }}>
              المعايير الدولية للتقرير المالي المعتمدة في المملكة، بالريال السعودي عملةً وظيفية وعملة عرض. الذهب ليس عملة: وزنه يُمسك في دفترٍ وزنيٍّ مساعد يُطابَق بالدفتر المالي.
            </p>
            {[
              ["IAS 2 — المخزون", "الذهب المشغول بتكلفته (سعر الجرام + المصنعية)، والكسر بتكلفة شرائه. القياس بالأقل من التكلفة وصافي القيمة القابلة للتحقق يُراجَع في نهاية الفترة."],
              ["IFRS 15 — الإيراد", "يُثبت عند التسليم صافيًا من ضريبة القيمة المضافة. العربون التزامٌ (2210) حتى البيع، ويُخصم من الفاتورة."],
              ["IAS 16 — الأصول الثابتة", "بالتكلفة ناقص مجمّع الإهلاك، بالقسط الثابت أو المتناقص على عمر الفئة، والاستبعاد يُثبت مكسبه أو خسارته."],
              ["IAS 19 — منافع الموظفين", "مخصّص نهاية الخدمة يُكوَّن شهريًّا مع الرواتب (2330)، والتأمينات مستحقة حتى السداد (2320)."],
              ["IAS 1 — العرض", "متداولٌ وغير متداول، والدخل بالوظيفة. الذهب يُعرض بالوزن بجانب قيمته في دفترٍ مستقل (الدفتر الوزني)."],
              ["أرصدة الذهب المستحقة", "ما علينا ذهبًا للموردين والمكاتب وأمانات العملاء غير المخصّصة: يُقيَّد بقيمته يوم نشوئه ويُعاد قياسه بسعر الإقفال في كل تقرير، والفرق في «فروق إعادة قياس أرصدة الذهب»."],
              ["الزكاة", "وفق هيئة الزكاة والضريبة والجمارك: مصروفٌ (6550) مقابل التزام (2227). التقدير بطريقة صافي الأصول الزكوية: النقد والبنك والذمم المرجوّة والذهب المملوك بسعر يوم الحول، ناقص الالتزامات."],
              ["IFRS 18 — مقياس الإدارة", "«المكسب بالوزن» = تغيّر الذهب المملوك (مشغول + غير مشغول − المستحق ذهبًا) بعد تدفّقات الملكية. ليس بديلًا عن صافي الربح، ويُطابَق به في «مطابقة الدفترين»."],
              ["IFRS 16 — الإيجار", "يُعامل الإيجار مصروفًا حين يكون العقد قصيرًا (سنة فأقل) أو منخفض القيمة؛ العقود الأطول تُقيَّد بأصل حق الاستخدام والتزامه بقيد يومية."],
              ["IAS 8 — التصحيحات", "لا يُحذف قيد؛ يُصحَّح بقيدٍ عكسي. وما يخصّ فتراتٍ سابقة يُقيَّد في الأرباح المحتجزة."],
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
