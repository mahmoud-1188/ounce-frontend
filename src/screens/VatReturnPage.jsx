import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { fmtMoney } from "../core/money.js";
import * as api from "../core/api.js";
import { exportTablesPdf, inputStyle, shareOrDownload, toCsv } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// إقرار ضريبة القيمة المضافة (migration 060) — بنود الإقرار من الفواتير وقيود المردودات، مع مطابقة حساب 2220،
/// وتسويته وسداده من الخزنة بقيدٍ واحد (migration 086) يُلغى بقيدٍ عكسي وسببٍ مكتوب.
const iso = (d) => d.toISOString().slice(0, 10);
const monthOf = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return [iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))];
};
const quarterOf = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const q0 = Math.floor((m - 1) / 3) * 3;
  return [iso(new Date(Date.UTC(y, q0, 1))), iso(new Date(Date.UTC(y, q0 + 3, 0)))];
};

const ERR = {
  vat_period_settled: "هذه الفترة (أو جزءٌ منها) سُوّيت من قبل",
  vat_nothing_to_settle: "لا ضريبة مستحقّة في هذه الفترة",
  insufficient_safe_balance: "رصيد الخزنة لا يكفي للسداد",
  not_latest_settlement: "تُلغى آخر تسويةٍ وحدها",
  reason_required: "اكتب سبب الإلغاء",
  settle_via_group_vat: "الإقرار موحّد — يُسدَّد من التطبيق المركزي",
  vat_received_by_hq: "استلمت الإدارة التحويل — لا يُلغى من الفرع",
  group_vat_settled: "سُدِّد الإقرار الموحّد لهذه الفترة — لا يُلغى",
};
const errText = (e, fallback) => ERR[e?.body?.error] || e?.body?.why || fallback;

function VatReturnPage({ currency = "ر.س", info = {}, canSettle = false, flashToast = () => {}, onChanged = null, onBack }) {
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [quarter, setQuarter] = useState(true);
  // فترةٌ مخصّصة بأي تاريخين للاطّلاع والتصدير؛ التسوية بشهرٍ أو ربعٍ كامل
  const [custom, setCustom] = useState(null);
  const [from, to] = useMemo(() => {
    if (custom && custom.from && custom.to && custom.from <= custom.to) return [custom.from, custom.to];
    return quarter ? quarterOf(period) : monthOf(period);
  }, [period, quarter, custom]);
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [tick, setTick] = useState(0);
  const [source, setSource] = useState("safe_cash");
  const [busy, setBusy] = useState(false);
  const [undoWhy, setUndoWhy] = useState("");
  useEffect(() => {
    setD(null); setErr(null);
    api.budgetsApi.vatReturn(from, to).then(setD).catch(() => setErr("تعذّر إعداد الإقرار"));
  }, [from, to, tick]);
  const m = (v) => `${fmtMoney(v)} ${currency}`;
  const Line = ({ n, l, base, vat, strong, tone }) => (
    <div className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--line)" }}>
      <span className="text-[11px] font-bold w-5 text-center" style={{ color: "var(--text3)" }}>{n}</span>
      <span className="flex-1 text-xs" style={{ color: "var(--text)", fontWeight: strong ? 700 : 400 }}>{l}</span>
      <span className="text-[11px] w-24 text-left" style={{ color: "var(--text2)" }}>{base == null ? "" : m(base)}</span>
      <span className="text-[11px] w-20 text-left font-bold" style={{ color: tone || "var(--text)" }}>{vat == null ? "" : m(vat)}</span>
    </div>
  );
  const net = d ? d.sales.standard.base - d.sales.returns.base : 0;
  const outVat = d ? d.sales.standard.vat - d.sales.returns.vat : 0;
  // سطور الإقرار نفسها في CSV وPDF — ما يُسلَّم للمحاسب أو للهيئة
  const returnRows = () => (d ? [
    ["المنشأة", info.name || ""], ["الرقم الضريبي", info.vat || ""], ["من", from], ["إلى", to],
    ["المبيعات الخاضعة (قبل المرتجعات)", fmtMoney(d.sales.standard.base)], [`المرتجعات — إشعارات دائنة (${d.sales.returns.count})`, fmtMoney(-d.sales.returns.base)],
    ["المبيعات الخاضعة (صافي)", fmtMoney(net)], ["ضريبة المبيعات (المخرجات)", fmtMoney(outVat)],
    ["المبيعات المعفاة / بلا ضريبة", fmtMoney(d.sales.exempt.base)],
    ["ضريبة المشتريات (المدخلات)", fmtMoney(d.purchases.vat)], ["صافي الضريبة المستحقة", fmtMoney(d.netDue)],
  ] : []);
  const exportCsv = async () => {
    const blob = new Blob(["﻿" + toCsv(["البند", "المبلغ"], returnRows())], { type: "text/csv;charset=utf-8" });
    await shareOrDownload({ blob, filename: `الإقرار-الضريبي-${from}-${to}.csv`, title: "الإقرار الضريبي" });
  };
  const exportPdf = () => exportTablesPdf({ title: "الإقرار الضريبي — ضريبة القيمة المضافة",
    subtitle: `${info.name || ""}${info.vat ? ` · الرقم الضريبي ${info.vat}` : ""} · من ${from} إلى ${to}`,
    branchName: info.name || "", sign: false, onBlocked: flashToast, sections: [{ title: "بنود الإقرار", headers: ["البند", "المبلغ"], rows: returnRows().map((x) => x.map(String)) }] });

  const settle = async () => {
    setBusy(true);
    try {
      await api.budgetsApi.vatSettle(from, to, source);
      flashToast("سُجّلت تسوية الإقرار وسداده من الخزنة");
      setTick((t) => t + 1); onChanged?.();
    } catch (e) {
      flashToast(errText(e, "تعذّر تسجيل التسوية"));
    } finally { setBusy(false); }
  };
  const undo = async () => {
    setBusy(true);
    try {
      await api.budgetsApi.vatUndo(d.settlement.id, undoWhy);
      flashToast("أُلغيت التسوية بقيدٍ عكسي — عاد المدفوع إلى الخزنة");
      setUndoWhy(""); setTick((t) => t + 1); onChanged?.();
    } catch (e) {
      flashToast(errText(e, "تعذّر إلغاء التسوية"));
    } finally { setBusy(false); }
  };

  return (
    <div className="pb-24">
      <SubPageHeader title="إقرار ضريبة القيمة المضافة" onBack={onBack} />
      <div className="px-4 pt-3">
        <Card style={{ padding: 12, marginBottom: 10 }}>
          <div className="flex gap-2 items-end">
            {custom ? (<>
              <Field label="من"><input type="date" style={inputStyle} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /></Field>
              <Field label="إلى"><input type="date" style={inputStyle} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></Field>
            </>) : (
              <Field label="الشهر"><input type="month" style={inputStyle} value={period} onChange={(e) => setPeriod(e.target.value || period)} /></Field>
            )}
            {!custom && (
              <button onClick={() => setQuarter((q) => !q)} data-vat-quarter className="px-3 py-2 rounded-xl text-[11px] font-bold mb-3"
                style={{ background: quarter ? "var(--accentBg)" : "var(--field)", color: quarter ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                {quarter ? "✓ ربع سنوي" : "ربع سنوي"}
              </button>
            )}
            <button data-vat-custom onClick={() => setCustom((c) => (c ? null : { from, to }))} className="px-3 py-2 rounded-xl text-[11px] font-bold mb-3"
              data-help="فترةٌ بأي تاريخين تختارهما — للاطّلاع والتصدير لمحاسبٍ أو للهيئة؛ التسوية بشهرٍ أو ربعٍ كامل. اضغطه للتبديل."
              style={{ background: custom ? "var(--accentBg)" : "var(--field)", color: custom ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)", whiteSpace: "nowrap" }}>
              {custom ? "✓ فترة مخصّصة" : "فترة مخصّصة"}
            </button>
          </div>
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">الفترة {from} ← {to}{d ? ` · ${d.sales.standard.count + d.sales.exempt.count} فاتورة (${d.sales.standard.count} خاضعة)` : ""}</p>
        </Card>
        {err && <p className="text-xs font-bold" style={{ color: "var(--bad)" }}>{err}</p>}
        {!d && !err && <div className="flex justify-center py-8"><Loader2 className="animate-spin" size={20} color="var(--accent)" /></div>}
        {d && (
          <>
            <Card style={{ padding: 12, marginBottom: 10 }}>
              <div className="flex gap-2 pb-1 text-[11px] font-bold" style={{ color: "var(--text3)" }}>
                <span className="w-5" /><span className="flex-1">البند</span><span className="w-24 text-left">المبلغ</span><span className="w-20 text-left">الضريبة</span>
              </div>
              <Line n="1" l={`المبيعات الخاضعة للنسبة الأساسية (${d.sales.standard.count} فاتورة)`} base={d.sales.standard.base} vat={d.sales.standard.vat} />
              <Line n="—" l={`المرتجعات — إشعارات دائنة (${d.sales.returns.count})`} base={-d.sales.returns.base} vat={-d.sales.returns.vat} tone="var(--bad)" />
              <Line n="—" l="المبيعات الخاضعة بعد المرتجعات" base={net} vat={outVat} strong />
              <Line n="4" l={`مبيعات بلا ضريبة / معفاة (${d.sales.exempt.count})`} base={d.sales.exempt.base} vat={0} />
              <Line n="6" l="إجمالي المبيعات" base={net + d.sales.exempt.base} vat={outVat} strong />
              <Line n="7" l="ضريبة المشتريات والمصروفات (المدخلات)" base={null} vat={-d.purchases.vat} tone="var(--good)" />
              {d.purchases.carried > 0.005 && <Line n="—" l="مدخلاتٌ مرحَّلة من إقرارٍ سابق (تُخصم عند التسوية)" base={null} vat={-d.purchases.carried} tone="var(--good)" />}
              <Line n="13" l={d.netDue >= 0 ? "صافي الضريبة المستحقة للهيئة" : "ضريبة مستردّة من الهيئة"} base={null} vat={Math.abs(d.netDue)} strong tone={d.netDue >= 0 ? "var(--bad)" : "var(--good)"} />
              <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[11px] leading-6">
                {info.vat ? `الرقم الضريبي ${info.vat}` : "⚠ أدخل الرقم الضريبي في الإعدادات ← معلومات الفرع والترويسة."}
              </p>
            </Card>
            <Card style={{ padding: 12, marginBottom: 10, border: `1px solid ${Math.abs(d.diff) > 0.01 ? "var(--badLine)" : "var(--line)"}` }}>
              <p className="text-xs font-bold" style={{ color: "var(--text)", margin: 0 }}>مطابقة حساب 2220 (ضريبة القيمة المضافة المستحقة)</p>
              <p className="text-[11px]" style={{ color: "var(--text2)", margin: "4px 0 0" }}>حركة الحساب في الفترة {m(d.ledgerNet)} — {Math.abs(d.diff) > 0.01 ? <b style={{ color: "var(--bad)" }}>فرق {m(d.diff)} يحتاج مراجعة — راجع «مطابقة الدفاتر»</b> : <b style={{ color: "var(--good)" }}>مطابق للإقرار</b>}</p>
            </Card>

            {/* ── تسوية الإقرار وسداده: شهرٌ أو ربعٌ كامل، قيدٌ واحد يُقفل 2220 ويسدّد من الخزنة ── */}
            {canSettle && custom && (
              <Card style={{ padding: 12, marginBottom: 10 }}>
                <p data-vat-custom-note style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-6">الفترة المخصّصة للاطّلاع والتصدير — التسوية بشهرٍ أو ربعٍ كامل؛ أطفئ «فترة مخصّصة» لتسوّي.</p>
              </Card>
            )}
            {canSettle && !custom && (
              <Card style={{ padding: 12, marginBottom: 10 }}>
                <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-xs font-bold">{d.filing?.group ? "الإقرار الموحّد للمنشأة" : "تسوية الإقرار وسداده"}</p>
                {d.filing?.group && (
                  <p data-vat-group-note style={{ color: "var(--text2)", margin: "0 0 6px" }} className="text-[11px] leading-6">
                    {d.filing.isHq
                      ? "هذا دفتر الإدارة: الإقرار الموحّد يُسدَّد من التطبيق المركزي (الضريبة ← الإقرار الموحّد) بعد أن تحوّل الفروع ضرائبها."
                      : "الإدارة تُقِرّ عن المنشأة كلّها: سوِّ فترتك هنا فيُحوَّل صافي ضريبتك للإدارة لا للهيئة، وتسدّد الإدارة الإقرار الموحّد."}
                  </p>
                )}
                {d.filing?.group && d.filing.isHq && !d.settlement ? null : d.settlement ? (
                  <>
                    <p style={{ color: "var(--good)", margin: 0 }} className="text-[11px] leading-6" data-vat-settled>
                      ✓ سُوّيت الفترة {d.settlement.from} ← {d.settlement.to}{d.settlement.inputVat > 0 ? ` · خُصمت مدخلات ${m(d.settlement.inputVat)}` : ""} · {d.settlement.toHq ? "حُوِّل للإدارة" : "سُدّد"} {m(d.settlement.paid)}{d.settlement.paid > 0 ? ` من ${d.settlement.source === "safe_network" ? "شبكة الخزنة" : d.settlement.source === "bank" ? "البنك" : "نقد الخزنة"}` : ""} · {new Date(d.settlement.at).toLocaleDateString("en-GB")}
                      {d.settlement.groupId ? " · ضمن الإقرار الموحّد المسدَّد" : ""}
                    </p>
                    <div className="mt-2">
                      <Field label="سبب إلغاء التسوية">
                        <input style={inputStyle} value={undoWhy} onChange={(e) => setUndoWhy(e.target.value)} placeholder="مثلًا: مصدر السداد خطأ" />
                      </Field>
                      <button disabled={!undoWhy.trim() || busy} onClick={undo} data-vat-undo
                        className="w-full py-2 rounded-xl text-[11px] font-bold"
                        style={{ minHeight: 44, background: "var(--field)", color: undoWhy.trim() ? "var(--bad)" : "var(--text3)", border: "1px solid var(--line)" }}>
                        ألغِ التسوية (قيدٌ عكسي ويعود المدفوع إلى الخزنة)
                      </button>
                    </div>
                  </>
                ) : d.ledgerNet > 0.005 ? (
                  <>
                    {(() => {
                      const inAvail = d.purchases.vat + d.purchases.carried;
                      const offset = Math.min(d.ledgerNet, Math.max(0, inAvail));
                      const pay = Math.max(0, d.ledgerNet - offset);
                      return (
                        <>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-[12px]" style={{ color: "var(--text2)" }}>ضريبة المبيعات (المخرجات) في الدفتر</span>
                            <b className="text-[12px]" style={{ color: "var(--bad)" }}>{m(d.ledgerNet)}</b>
                          </div>
                          {offset > 0.005 && (
                            <div className="flex items-center justify-between py-1">
                              <span className="text-[12px]" style={{ color: "var(--text2)" }}>تُخصم المدخلات</span>
                              <b className="text-[12px]" style={{ color: "var(--good)" }}>−{m(offset)}</b>
                            </div>
                          )}
                          <div className="flex items-center justify-between py-1" style={{ borderTop: "1px solid var(--line)" }} data-vat-pay>
                            <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{d.filing?.group ? "يُحوَّل للإدارة" : "يُسدَّد للهيئة"}</span>
                            <b className="text-[13px]" style={{ color: "var(--bad)" }}>{m(pay)}</b>
                          </div>
                          {inAvail - offset > 0.005 && <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">ويُرحَّل {m(inAvail - offset)} مدخلاتٍ للإقرار القادم</p>}
                        </>
                      );
                    })()}
                    <Field label="يُدفع من">
                      <select style={inputStyle} value={source} onChange={(e) => setSource(e.target.value)} aria-label="مصدر سداد الضريبة">
                        <option value="safe_cash">نقد الخزنة</option>
                        <option value="safe_network">شبكة الخزنة (البنك)</option>
                      </select>
                    </Field>
                    <p style={{ color: "var(--text3)", margin: "0 0 6px" }} className="text-[11px] leading-6">قيدٌ واحد: يُقفل ضريبة الفترة (2220)، ويخصم المدخلات (1360)، ويُسجّل المدفوع من الخزنة.</p>
                    <button onClick={settle} disabled={busy} data-vat-settle-go className="w-full py-2.5 rounded-xl text-[12px] font-bold"
                      style={{ minHeight: 44, background: "var(--accent)", color: "var(--panel)", border: "none" }}>{busy ? "جارٍ التسجيل…" : d.filing?.group ? "سوِّ الفترة وحوّل الضريبة للإدارة" : "سجّل التسوية والسداد"}</button>
                  </>
                ) : (
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">لا ضريبة مستحقّة في الدفتر لهذه الفترة.</p>
                )}
              </Card>
            )}

            <div className="flex gap-2 mb-3">
              <button onClick={exportPdf} data-vat-pdf className="flex-1 py-2.5 rounded-xl text-[12px] font-bold"
                data-help="يصدّر إقرار الفترة المعروضة ورقةً (PDF) باسم المنشأة ورقمها الضريبي — للمحاسب أو للهيئة."
                style={{ minHeight: 44, background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>صدّر الإقرار (PDF)</button>
              <button onClick={exportCsv} data-vat-csv className="flex-1 py-2.5 rounded-xl text-[12px] font-bold"
                style={{ minHeight: 44, background: "var(--field)", color: "var(--accent)", border: "1px solid var(--line)" }}>CSV</button>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text3)" }}>
              ضريبة المدخلات تُسجَّل من «منها ضريبة القيمة المضافة» في المصروف، و«ضريبة القيمة المضافة على الفاتورة» في الشراء. الأرقام بتوقيت الرياض.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export { VatReturnPage };
