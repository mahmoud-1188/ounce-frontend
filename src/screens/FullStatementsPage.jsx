import React, { useMemo, useState } from "react";
import { fmtMoney, fmtW } from "../core/money.js";
import { buildCashFlow } from "../domain/buildCashFlow.js";
import { buildEquityStatement } from "../domain/buildEquityStatement.js";
import { buildFullTrialBalance } from "../domain/buildFullTrialBalance.js";
import { buildIncomeStatement } from "../domain/buildIncomeStatement.js";
import { buildWeightFlow } from "../domain/buildWeightFlow.js";
import { exportLedgerXlsx, inputStyle } from "../domain/helpers.js";
import { suggestAdjustments } from "../domain/suggestAdjustments.js";
import { buildBalanceSheet } from "../domain/buildBalanceSheet.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function FullStatementsPage({
  journal = [], goldLedger = [], accounts = [], assets = [],
  currency = "ر.س", branchName = "", preparedBy = "", onBack,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState("guide");
  const money = (v) => `${currency}${fmtMoney(v || 0)}`;

  const inc = useMemo(() => buildIncomeStatement({ journal, accounts, from, to }), [journal, accounts, from, to]);
  const np = inc.netProfit;
  const tb = useMemo(() => buildFullTrialBalance({ journal, accounts, from, to }), [journal, accounts, from, to]);
  const bs = useMemo(() => buildBalanceSheet({ journal, accounts, to, netProfit: np }), [journal, accounts, to, np]);
  const eq = useMemo(() => buildEquityStatement({ journal, accounts, from, to, netProfit: np }), [journal, accounts, from, to, np]);
  const cf = useMemo(() => buildCashFlow({ journal, accounts, from, to, netProfit: np }), [journal, accounts, from, to, np]);
  const wf = useMemo(() => buildWeightFlow({ goldLedger, from, to }), [goldLedger, from, to]);
  const adj = useMemo(() => suggestAdjustments({ journal, accounts, to, assets }), [journal, accounts, to, assets]);

  const Row = ({ label, value, bold, tone, indent }) => (
    <div className="flex items-baseline justify-between py-0.5" style={{ paddingRight: indent ? 12 : 0 }}>
      <span style={{ color: bold ? "var(--text)" : "var(--text3)" }} className={`text-[${bold ? 11 : 10}px] ${bold ? "font-bold" : ""}`}>{label}</span>
      <span style={{ color: tone || (bold ? "var(--text)" : "var(--text2)"), fontVariantNumeric: "tabular-nums" }}
        className={`text-[11px] ${bold ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
  const Sec = ({ title, children }) => (
    <Card style={{ padding: 12, marginBottom: 8 }}>
      <p style={{ color: "var(--accent)", margin: "0 0 5px" }} className="text-[11px] font-bold">{title}</p>
      {children}
    </Card>
  );

  const TABS = [["guide", "دليل الحسابات"], ["tb", "ميزان المراجعة"], ["income", "الدخل"],
    ["bs", "المركز المالي"], ["equity", "حقوق الملكية"], ["cf", "التدفق النقدي"],
    ["wf", "التدفق الوزني"], ["adj", "التسويات"], ["notes", "الإيضاحات"]];

  return (
    <div>
      <SubPageHeader title="القوائم المالية الكاملة" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field label="من"><input type="date" style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="إلى"><input type="date" style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <div className="flex gap-1 mb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} className="py-2 px-3 rounded-xl text-[11px] font-bold"
              style={{ background: tab === id ? "var(--accentBg)" : "var(--field)", whiteSpace: "nowrap", flexShrink: 0,
                color: tab === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
          ))}
        </div>

        {/* ══ دليل الحسابات ══ */}
        {tab === "guide" && (
          <>
            <Card style={{ padding: 11, marginBottom: 8, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
                {accounts.length} حسابًا في {accounts.filter((a) => a.group).length} مجموعة.
                المجموعات لا تُقيَّد عليها — تُجمّع فروعها فقط.
              </p>
            </Card>
            {["1", "2", "3", "4", "5", "6", "7"].map((p) => {
              const list = accounts.filter((a) => a.code.startsWith(p));
              if (!list.length) return null;
              const head = list.find((a) => a.group && a.code.endsWith("000")) || list[0];
              return (
                <Sec key={p} title={`${p}000 · ${head.name}`}>
                  {list.filter((a) => a.code !== head.code).map((a) => (
                    <div key={a.code} className="flex items-baseline gap-2 py-0.5"
                      style={{ paddingRight: a.group ? 0 : 10 }}>
                      <span style={{ color: "var(--text3)", fontFamily: "monospace" }} className="text-[10px]">{a.code}</span>
                      <span style={{ color: a.group ? "var(--accentText)" : "var(--text2)" }}
                        className={`text-[10px] flex-1 ${a.group ? "font-bold" : ""}`}>{a.name}</span>
                      <span style={{ color: "var(--text3)" }} className="text-[9px]">
                        {a.nature === "credit" ? "دائن" : "مدين"}
                        {a.unit === "gram" ? " · جرام" : a.unit === "both" ? " · ريال+جرام" : ""}
                        {a.statement === "memo" ? " · نظامي" : ""}
                      </span>
                    </div>
                  ))}
                </Sec>
              );
            })}
          </>
        )}

        {/* ══ ميزان المراجعة ══ */}
        {tab === "tb" && (
          <>
            <Card style={{ padding: 11, marginBottom: 8,
              border: `1px solid ${Object.values(tb.balanced).every(Boolean) ? "var(--goodLine)" : "var(--badLine)"}` }}>
              {[["أول المدة", tb.balanced.opening, tb.totals.openDebit, tb.totals.openCredit],
                ["الحركة", tb.balanced.movement, tb.totals.moveDebit, tb.totals.moveCredit],
                ["المجاميع", true, tb.totals.totalDebit, tb.totals.totalCredit],
                ["الأرصدة", tb.balanced.closing, tb.totals.closeDebit, tb.totals.closeCredit]].map(([l, okk, d, c]) => (
                <div key={l} className="flex items-baseline justify-between py-0.5">
                  <span style={{ color: okk ? "var(--text3)" : "var(--bad)" }} className="text-[10px]">
                    {okk ? "✓" : "⚠"} {l}
                  </span>
                  <span style={{ color: "var(--text2)" }} className="text-[10px]">{money(d)} · {money(c)}</span>
                </div>
              ))}
            </Card>
            <button onClick={() => exportLedgerXlsx({
              title: "ميزان المراجعة", meta: { branchName, from, to, preparedBy },
              headers: ["الكود", "الحساب", "افتتاحي مدين", "افتتاحي دائن", "حركة مدين", "حركة دائن",
                "مجموع مدين", "مجموع دائن", "رصيد مدين", "رصيد دائن"],
              rows: tb.rows.map((r) => [r.code, r.name, r.openDebit, r.openCredit, r.moveDebit, r.moveCredit,
                r.totalDebit, r.totalCredit, r.closeDebit, r.closeCredit]),
              totals: ["", "الإجمالي", tb.totals.openDebit, tb.totals.openCredit, tb.totals.moveDebit,
                tb.totals.moveCredit, tb.totals.totalDebit, tb.totals.totalCredit, tb.totals.closeDebit, tb.totals.closeCredit],
              fileBase: "ميزان_المراجعة" })}
              className="w-full py-2 rounded-xl text-[11px] font-bold mb-3"
              style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
              Excel — بالأعمدة العشرة
            </button>
            {tb.rows.map((r) => (
              <Card key={r.code} style={{ padding: 8, marginBottom: 3 }}>
                <div className="flex items-baseline gap-2">
                  <span style={{ color: "var(--text3)", fontFamily: "monospace" }} className="text-[10px]">{r.code}</span>
                  <span style={{ color: "var(--text)" }} className="text-[10px] flex-1 truncate">{r.name}</span>
                </div>
                <div className="flex gap-2 mt-0.5" style={{ fontSize: 9, color: "var(--text3)" }}>
                  <span>افتتاحي {fmtMoney(r.openDebit || -r.openCredit)}</span>
                  <span>حركة {fmtMoney(r.moveDebit)} / {fmtMoney(r.moveCredit)}</span>
                  <span style={{ color: "var(--text2)", marginRight: "auto" }} className="font-bold">
                    رصيد {fmtMoney(r.closeDebit || -r.closeCredit)}
                  </span>
                </div>
              </Card>
            ))}
          </>
        )}

        {/* ══ الدخل ══ */}
        {tab === "income" && (
          <>
            <Sec title="الإيرادات">
              <Row label="المبيعات" value={money(inc.revenue)} />
              {inc.discounts > 0 && <Row label="ناقصًا: الخصومات" value={`(${fmtMoney(inc.discounts)})`} tone="var(--bad)" />}
              <Row label="صافي الإيراد" value={money(inc.netRevenue)} bold />
            </Sec>
            <Sec title="تكلفة المبيعات — النظام الدوري">
              <Row label="مخزون أول المدة" value={money(inc.openStock)} indent />
              <Row label="+ المشتريات" value={money(inc.purchases)} indent />
              <Row label="− مخزون آخر المدة" value={`(${fmtMoney(inc.closeStock)})`} indent />
              <Row label="تكلفة المبيعات" value={money(inc.cogs)} bold />
            </Sec>
            <Sec title="مجمل الربح">
              <Row label="مجمل الربح" value={money(inc.grossProfit)} bold
                tone={inc.grossProfit >= 0 ? "var(--good)" : "var(--bad)"} />
              {inc.grossMarginPct !== null && <Row label="هامش مجمل الربح" value={`${inc.grossMarginPct}٪`} />}
            </Sec>
            <Sec title="المصروفات التشغيلية">
              {inc.opex.slice(0, 14).map((x) => <Row key={x.code} label={x.name} value={money(x.amount)} indent />)}
              <Row label="إجمالي المصروفات" value={money(inc.opexTotal)} bold />
            </Sec>
            <Card style={{ padding: 13, border: "1px solid var(--accentLine)" }}>
              <Row label="صافي الربح" value={money(inc.netProfit)} bold
                tone={inc.netProfit >= 0 ? "var(--good)" : "var(--bad)"} />
              {inc.netMarginPct !== null && <Row label="هامش صافي الربح" value={`${inc.netMarginPct}٪`} />}
              {/* ⚠ الدخل الشامل: لا بنود «دخلٍ شامل آخر» في محلّ ذهب —
                  لا استثماراتٍ متاحة للبيع ولا ترجمة عملات. فالشامل = الصافي. */}
              <Row label="الدخل الشامل" value={money(inc.netProfit)} bold />
              <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px] leading-6">
                لا بنود دخلٍ شامل آخر — لا استثماراتٍ ولا فروق ترجمة عملات.
              </p>
            </Card>
          </>
        )}

        {/* ══ المركز المالي ══ */}
        {tab === "bs" && (
          <>
            <Sec title="الأصول">
              {bs.assets.map((x) => <Row key={x.code} label={x.name} value={money(x.amount)} indent />)}
              <Row label="إجمالي الأصول" value={money(bs.assetsTotal)} bold />
            </Sec>
            <Sec title="الالتزامات">
              {bs.liabilities.map((x) => <Row key={x.code} label={x.name} value={money(x.amount)} indent />)}
              <Row label="إجمالي الالتزامات" value={money(bs.liabilitiesTotal)} bold />
            </Sec>
            <Sec title="حقوق الملكية">
              {bs.equity.map((x) => <Row key={x.code} label={x.name} value={money(x.amount)} indent />)}
              <Row label="ربح الفترة (لم يُقفل بعد)" value={money(bs.netProfit)} indent
                tone={bs.netProfit >= 0 ? "var(--good)" : "var(--bad)"} />
              <Row label="إجمالي حقوق الملكية" value={money(bs.equityTotal)} bold />
            </Sec>
            <Card style={{ padding: 12, border: `1px solid ${bs.balanced ? "var(--goodLine)" : "var(--badLine)"}` }}>
              <Row label={bs.balanced ? "✓ الأصول = الالتزامات + حقوق الملكية" : "⚠ القائمة لا تتوازن"}
                value={bs.balanced ? "" : money(bs.difference)}
                bold tone={bs.balanced ? "var(--good)" : "var(--bad)"} />
              {!bs.balanced && (
                <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px] leading-6">
                  الفرق {money(bs.difference)} — راجع ميزان المراجعة أولًا، فالخلل في الدفتر لا في العرض.
                </p>
              )}
            </Card>
          </>
        )}

        {/* ══ حقوق الملكية ══ */}
        {tab === "equity" && (
          <>
            {eq.rows.map((r) => (
              <Sec key={r.code} title={`${r.code} · ${r.name}`}>
                <Row label="الرصيد أول المدة" value={money(r.opening)} />
                {r.additions > 0 && <Row label="إضافات" value={money(r.additions)} tone="var(--good)" />}
                {r.deductions > 0 && <Row label="مسحوبات" value={`(${fmtMoney(r.deductions)})`} tone="var(--bad)" />}
                <Row label="الرصيد آخر المدة" value={money(r.closing)} bold />
              </Sec>
            ))}
            <Card style={{ padding: 13, border: "1px solid var(--accentLine)" }}>
              <Row label="مجموع أول المدة" value={money(eq.openingTotal)} />
              <Row label="+ إضافات" value={money(eq.additionsTotal)} />
              <Row label="− مسحوبات" value={`(${fmtMoney(eq.deductionsTotal)})`} />
              <Row label="+ ربح الفترة" value={money(eq.netProfit)}
                tone={eq.netProfit >= 0 ? "var(--good)" : "var(--bad)"} />
              <Row label="حقوق الملكية آخر المدة" value={money(eq.closingTotal)} bold />
            </Card>
          </>
        )}

        {/* ══ التدفق النقدي ══ */}
        {tab === "cf" && (
          <>
            <Sec title="التشغيلي — الطريقة غير المباشرة">
              <Row label="صافي الربح" value={money(cf.netProfit)} />
              <Row label="+ الإهلاك (مصروفٌ لا يُدفع)" value={money(cf.depreciation)} indent />
              {cf.receivables.map((x) => <Row key={x.code} label={`التغيّر في ${x.name}`} value={money(x.amount)} indent />)}
              {cf.inventory.map((x) => <Row key={x.code} label={`التغيّر في ${x.name}`} value={money(x.amount)} indent />)}
              {cf.payables.slice(0, 8).map((x) => <Row key={x.code} label={`التغيّر في ${x.name}`} value={money(x.amount)} indent />)}
              <Row label="صافي التدفّق التشغيلي" value={money(cf.operating)} bold
                tone={cf.operating >= 0 ? "var(--good)" : "var(--bad)"} />
            </Sec>
            <Sec title="الاستثماري">
              {cf.investing.map((x) => <Row key={x.code} label={x.name} value={money(x.amount)} indent />)}
              <Row label="صافي الاستثماري" value={money(cf.investingTotal)} bold />
            </Sec>
            <Sec title="التمويلي">
              {cf.financing.map((x) => <Row key={x.code} label={x.name} value={money(x.amount)} indent />)}
              <Row label="صافي التمويلي" value={money(cf.financingTotal)} bold />
            </Sec>
            <Card style={{ padding: 13, border: `1px solid ${cf.reconciles ? "var(--goodLine)" : "var(--badLine)"}` }}>
              <Row label="نقد أول المدة" value={money(cf.openCash)} />
              <Row label="صافي التغيّر" value={money(cf.netChange)} />
              <Row label="نقد آخر المدة" value={money(cf.closeCash)} bold />
              <p style={{ color: cf.reconciles ? "var(--good)" : "var(--bad)", margin: "5px 0 0" }} className="text-[10px] leading-6">
                {cf.reconciles ? "✓ القائمة مُصفَّرة" : `⚠ فرقٌ غير مُفسَّر ${money(cf.unexplained)} — بندٌ لم يُصنَّف. لا تُسلَّم قبل تصفيره.`}
              </p>
            </Card>
          </>
        )}

        {/* ══ التدفق الوزني ══ */}
        {tab === "wf" && (
          <>
            <Card style={{ padding: 11, marginBottom: 8, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
                ⚠ التدفّق النقدي لا يكفي محلّ ذهب: <b>من باع عشرة كيلو واشترى اثني عشر تدفّقه
                النقدي سالب وهو رابح.</b> هذه القائمة تُجيب عمّا لا يُجيبه الريال.
              </p>
            </Card>
            <Sec title="الوارد">
              {wf.ins.map((x) => <Row key={x.op} label={x.label} value={`${fmtW(x.fine24)} جم`} indent />)}
              <Row label="إجمالي الوارد" value={`${fmtW(wf.inTotal)} جم24`} bold tone="var(--good)" />
            </Sec>
            <Sec title="الصادر">
              {wf.outs.map((x) => <Row key={x.op} label={x.label} value={`${fmtW(x.fine24)} جم`} indent />)}
              <Row label="إجمالي الصادر" value={`${fmtW(wf.outTotal)} جم24`} bold tone="var(--bad)" />
            </Sec>
            <Card style={{ padding: 13, border: "1px solid var(--accentLine)" }}>
              <Row label="الرصيد أول المدة" value={`${fmtW(wf.opening)} جم24`} />
              <Row label="صافي التغيّر" value={`${wf.netChange >= 0 ? "+" : ""}${fmtW(wf.netChange)} جم`}
                tone={wf.netChange >= 0 ? "var(--good)" : "var(--bad)"} />
              <Row label="الرصيد آخر المدة" value={`${fmtW(wf.closing)} جم24`} bold />
            </Card>
          </>
        )}

        {/* ══ التسويات ══ */}
        {tab === "adj" && (
          <>
            <Card style={{ padding: 11, marginBottom: 8, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
                ⚠ <b>مقترحاتٌ لا قيود.</b> التسوية قرارٌ محاسبي يوقّعه إنسان — وبرنامجٌ يُرحّلها
                بنفسه يُجمّل الأرقام بلا أن يعلم أحد. رحّلها يدويًّا من «قيد يدوي» بعد مراجعتها.
              </p>
            </Card>
            {adj.length === 0 ? (
              <p style={{ color: "var(--text3)" }} className="text-[11px]">لا تسوياتٍ مقترحة في هذه الفترة.</p>
            ) : adj.map((a) => (
              <Card key={a.id} style={{ padding: 11, marginBottom: 5 }}>
                <p style={{ color: "var(--text)", margin: 0 }} className="text-[11px] font-bold">{a.label}</p>
                <p style={{ color: "var(--text3)", margin: "2px 0 4px" }} className="text-[10px] leading-6">{a.why}</p>
                <div className="flex items-baseline gap-2">
                  <span style={{ color: "var(--good)" }} className="text-[10px]">
                    مدين {a.debit} {accounts.find((x) => x.code === a.debit)?.name || ""}
                  </span>
                  <span style={{ color: "var(--bad)" }} className="text-[10px]">
                    دائن {a.credit} {accounts.find((x) => x.code === a.credit)?.name || ""}
                  </span>
                  <span style={{ color: "var(--text2)", marginRight: "auto" }} className="text-[10px] font-bold">
                    {a.amount != null ? money(a.amount) : "المبلغ بتقديرك"}
                  </span>
                </div>
              </Card>
            ))}
          </>
        )}

        {/* ══ الإيضاحات ══ */}
        {tab === "notes" && (
          <>
            <Sec title="① أساس الإعداد">
              <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px] leading-7">
                أُعدّت هذه القوائم على <b>أساس الاستحقاق</b> من دفتر القيد المزدوج، للفترة من {from} إلى {to}.
                العملة {currency}، والذهب بالجرام عيار 24 معادلًا.
              </p>
            </Sec>
            <Sec title="② تقييم المخزون">
              <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px] leading-7">
                <b>التكلفة المحدّدة</b> لا المتوسّط: كل قطعةٍ بتكلفتها هي، مرتبطةً بدفعة شرائها.
                والنظام <b>دوري</b> — تكلفة المبيعات = مخزون أول المدة + المشتريات − مخزون آخر المدة.
              </p>
            </Sec>
            <Sec title="③ الذهب المُشترى آجلًا">
              <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px] leading-7">
                ⚠ الشراء الآجل <b>ذهبٌ مستعار</b>: وزنٌ في المخزون والتزامٌ وزنيّ على المورّد،
                بلا قيمةٍ نقدية حتى يُباع. فقد يظهر رصيدُ مخزونٍ سالبٌ قيمةً بعد التسوية —
                وهو طبيعيّ يعني ذهبًا بِيع لم تُدفع تكلفته بعد.
              </p>
            </Sec>
            <Sec title="④ الوحدتان">
              <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px] leading-7">
                يُمسك النظام <b>دفترين</b>: نقديًّا بالريال ووزنيًّا بالجرام، ولا يُجمعان.
                والميزان الوزني لا يُشترط توازنه — الخلل فيه أصلٌ وزنيٌّ سالب.
              </p>
            </Sec>
            <Sec title="⑤ الأصول الثابتة">
              <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px] leading-7">
                بالتكلفة ناقصًا مجمّع الإهلاك، بطريقة <b>القسط الثابت</b> على العمر الإنتاجي لكل أصل.
                {assets.length ? ` عدد الأصول القائمة ${assets.filter((a) => !a.disposedAt).length}.` : ""}
              </p>
            </Sec>
            <Sec title="⑥ الالتزامات المحتملة">
              <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px] leading-7">
                الضمانات الصادرة والواردة تُقيَّد في حساباتٍ نظامية (7400 و7500) خارج الميزانية،
                فلا تُدرج في الأصول ولا الالتزامات.
              </p>
            </Sec>
            <Card style={{ padding: 11, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
                {branchName ? `${branchName} · ` : ""}أُعدّت في {today}
                {preparedBy ? ` بواسطة ${preparedBy}` : ""}.
                <br />⚠ هذه قوائمُ إدارية أُعدّت من دفتر المنشأة — وهي غير مُراجَعة من مكتبٍ خارجي.
              </p>
            </Card>
          </>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

export { FullStatementsPage };
