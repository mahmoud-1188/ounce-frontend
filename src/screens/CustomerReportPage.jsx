import React, { useMemo, useState } from "react";
import { Clock, Users } from "lucide-react";
import * as XLSX from "xlsx";
import { CUST_EVENTS } from "../core/constants.js";
import { fine24, fmtMoney, fmtW, roundW, sumMoney } from "../core/money.js";
import { buildCustomerSummaries } from "../domain/buildCustomerSummaries.js";
import { buildCustomerTimeline } from "../domain/buildCustomerTimeline.js";
import { exportTablesPdf, inputStyle, normalizeName, resolveRange } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { DualHeader } from "../ui/DualHeader.jsx";
import { DualRow } from "../ui/DualRow.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function CustomerReportPage({
  customers = [], sales = [], returns = [], receipts = [], repairs = [],
  reservations = [], trustAccounts = [], trustLedger = [],
  currency = "ر.س", branchName = "", onBack,
}) {
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [rangeId, setRangeId] = useState("all");
  const [custom, setCustom] = useState({ from: "", to: "" });

  const stores = { customers, sales, returns, receipts, repairs,
    reservations, trustAccounts, trustLedger };

  const range = useMemo(() => {
    if (rangeId === "all") return { from: -Infinity, to: Infinity, label: "كل التاريخ" };
    const r = resolveRange(rangeId, custom);
    return { from: r.from, to: r.to, label: r.label };
  }, [rangeId, custom]);

  // ⚠ الملخّصات في ذاكرة: بناؤها لمئة عميل يعني مئة تمرٍّ على كل
  // مخزن. وإعادتها مع كل حرف بحثٍ تُجمّد الكتابة.
  const summaries = useMemo(() => buildCustomerSummaries(stores),
    [customers, sales, returns, receipts, repairs, reservations, trustLedger]);

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return summaries;
    const k = normalizeName(t);
    return summaries.filter((s) =>
      normalizeName(s.customer.name).includes(k)
      || String(s.customer.phone || "").includes(t)
      || String(s.customer.ref || "").includes(t));
  }, [q, summaries]);

  const detail = useMemo(
    () => (sel ? buildCustomerTimeline({ ...stores, customerId: sel,
      from: range.from, to: range.to }) : null),
    [sel, range, customers, sales, returns, receipts, repairs, reservations, trustLedger]);

  const who = sel ? customers.find((c) => c.id === sel) : null;

  const totals = useMemo(() => ({
    customers: summaries.length,
    active: summaries.filter((s) => s.count > 1).length,
    owed: sumMoney(summaries, (s) => s.owedCash),
    trustCash: sumMoney(summaries, (s) => s.trustCash),
    trustFine: roundW(summaries.reduce((a, s) => a + s.trustFine, 0)),
    held: summaries.reduce((a, s) => a + s.heldItems, 0),
  }), [summaries]);

  const fmtD = (d) => new Date(d).toLocaleDateString("en-GB");

  const exportPdf = () => {
    if (sel && detail) {
      exportTablesPdf({
        title: `سجل العميل — ${who?.name || ""}`,
        subtitle: `${who?.ref || ""}${who?.phone ? " · " + who.phone : ""} · ${range.label}`,
        branchName,
        sections: [
          {
            title: "الأرصدة",
            head: ["البند", "القيمة"],
            rows: [
              ["عليه نقدًا", `${currency}${fmtMoney(detail.stats.owedCash)}`],
              ["أمانة نقدية له", `${currency}${fmtMoney(detail.stats.trustCash)}`],
              ["ذهب أمانة له", `${fmtW(detail.stats.trustFine)} جم24`],
              ["قطع في عهدتك", String(detail.stats.heldItems)],
              ["إجمالي مشترياته", `${currency}${fmtMoney(detail.stats.spend)}`],
            ],
          },
          {
            title: "الحركات",
            head: ["التاريخ", "الحدث", "المرجع", "المبلغ", "الوزن", "ملاحظة"],
            rows: detail.events.map((e) => [
              fmtD(e.date), CUST_EVENTS[e.kind]?.label || e.kind, e.ref || "—",
              e.amount ? `${currency}${fmtMoney(e.amount)}` : "—",
              e.weight ? `${fmtW(e.weight)} جم` : "—",
              e.note || "—",
            ]),
          },
        ],
      });
      return;
    }
    exportTablesPdf({
      title: "تقرير العملاء",
      subtitle: range.label,
      branchName, landscape: true,
      sections: [{
        title: `${filtered.length} عميلًا`,
        head: ["العميل", "المرجع", "حركات", "مشتريات", "عليه", "أمانة نقد",
          "أمانة ذهب", "بعهدتك"],
        rows: filtered.map((s) => [
          s.customer.name, s.customer.ref || "—", String(s.count),
          `${currency}${fmtMoney(s.spend)}`, `${currency}${fmtMoney(s.owedCash)}`,
          `${currency}${fmtMoney(s.trustCash)}`, `${fmtW(s.trustFine)} جم24`,
          String(s.heldItems),
        ]),
      }],
    });
  };

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    if (sel && detail) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["التاريخ", "الحدث", "المرجع", "المبلغ", "الوزن", "ملاحظة"],
        ...detail.events.map((e) => [fmtD(e.date),
          CUST_EVENTS[e.kind]?.label || e.kind, e.ref || "",
          e.amount || 0, e.weight || 0, e.note || ""]),
      ]), "الحركات");
    } else {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["العميل", "المرجع", "الجوال", "حركات", "مشتريات", "عليه",
          "أمانة نقد", "أمانة ذهب جم24", "بعهدتك"],
        ...filtered.map((s) => [s.customer.name, s.customer.ref || "",
          s.customer.phone || "", s.count, s.spend, s.owedCash,
          s.trustCash, s.trustFine, s.heldItems]),
      ]), "العملاء");
    }
    XLSX.writeFile(wb, `عملاء-${Date.now()}.xlsx`);
  };

  return (
    <div>
      <SubPageHeader title={sel ? `سجل ${who?.name || ""}` : "تقرير العملاء"}
        onBack={() => (sel ? setSel(null) : onBack())} />
      <div className="px-4 pt-3">

        {/* ── المدى ── */}
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {[["all", "الكل"], ["this_month", "الشهر"], ["last_month", "الماضي"],
            ["custom", "مدى"]].map(([id, lbl]) => {
            const on = rangeId === id;
            return (
              <button key={id} onClick={() => setRangeId(id)}
                className="py-2 rounded-lg text-[10px] font-bold"
                style={{
                  background: on ? "var(--accentBg)" : "var(--field)",
                  color: on ? "var(--accent)" : "var(--text2)",
                  border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`,
                }}>{lbl}</button>
            );
          })}
        </div>
        {rangeId === "custom" && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Field label="من">
              <input type="date" style={inputStyle} value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </Field>
            <Field label="إلى">
              <input type="date" style={inputStyle} value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </Field>
          </div>
        )}

        {!sel ? (
          <>
            {/* ── الإجمالي ── */}
            <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["العملاء", totals.customers, ""],
                  ["عليهم لك", `${currency}${fmtMoney(totals.owed)}`, "accent"],
                  ["بعهدتك", totals.held, "bad"],
                ].map(([l, v, tone], i) => (
                  <div key={i}>
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{l}</p>
                    <p style={{ color: tone ? `var(--${tone})` : "var(--text)", margin: 0 }}
                      className="text-[14px] font-bold">{v}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2"
                style={{ borderTop: "1px solid var(--line)" }}>
                <div>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">
                    أمانة نقدية لهم
                  </p>
                  <p style={{ color: "var(--bad)", margin: 0 }} className="text-[13px] font-bold">
                    {currency}{fmtMoney(totals.trustCash)}
                  </p>
                </div>
                <div>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">
                    ذهب أمانة لهم
                  </p>
                  <p style={{ color: "var(--bad)", margin: 0 }} className="text-[13px] font-bold">
                    {fmtW(totals.trustFine)} جم24
                  </p>
                </div>
              </div>
              <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2 leading-6">
                ⚠ ثلاثة أرصدة لا رقم: ما عليهم دَينٌ لك، والأمانة التزامٌ
                عليك، والقطع عهدةٌ تُردّ عينًا. جمعُها يُخفي كلًّا منها.
              </p>
            </Card>

            <input style={inputStyle} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم أو الجوال أو المرجع" className="mb-2" />

            {filtered.length === 0 ? (
              <EmptyState icon={<Users size={32} color="var(--accentSoft)" />}
                title="لا عملاء" sub="أضِف عميلًا من شاشة العملاء" />
            ) : (
              <div className="flex flex-col gap-1.5">
                {filtered.map((s) => (
                  <button key={s.customer.id} onClick={() => setSel(s.customer.id)}
                    className="w-full text-right">
                    <Card style={{ padding: 11 }}>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--text)" }}
                          className="text-[12px] font-bold flex-1 truncate">
                          {s.customer.name}
                        </span>
                        <span style={{ color: "var(--text3)" }} className="text-[10px]">
                          {s.count} حركة
                        </span>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-3 mt-1">
                        <span style={{ color: "var(--accent)" }} className="text-[11px] font-bold">
                          {currency}{fmtMoney(s.spend)}
                        </span>
                        {Math.abs(s.owedCash) > 0.004 && (
                          <span style={{ color: s.owedCash > 0 ? "var(--bad)" : "var(--good)" }}
                            className="text-[10px]">
                            {s.owedCash > 0 ? "عليه " : "له "}
                            {currency}{fmtMoney(Math.abs(s.owedCash))}
                          </span>
                        )}
                        {s.trustFine > 0.0005 && (
                          <span style={{ color: "var(--accentSoft)" }} className="text-[10px]">
                            أمانة {fmtW(s.trustFine)} جم24
                          </span>
                        )}
                        {s.heldItems > 0 && (
                          <span style={{ color: "var(--bad)" }} className="text-[10px]">
                            {s.heldItems} بعهدتك
                          </span>
                        )}
                      </div>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── الأرصدة — عمودان ── */}
            {/* ⚠ الوزن والنقد جنبًا إلى جنب ولا سطر يجمعهما:
                «عليه» نقدٌ، و«أمانة» وزنٌ ونقد، و«مشترياته» نقدٌ ووزن. */}
            <Card style={{ padding: 12, marginBottom: 10 }}>
              <DualHeader currency={currency} />
              <DualRow label="عليه (دَين)" weight_24k={0}
                cash_amount={detail.stats.owedCash} currency={currency}
                tone={detail.stats.owedCash > 0.004 ? "bad" : undefined} />
              <DualRow label="أمانة له" weight_24k={detail.stats.trustFine}
                cash_amount={detail.stats.trustCash} currency={currency} tone="accent" />
              <DualRow label="مشترياته" weight_24k={detail.events
                .filter((e) => e.kind === "sale" || e.kind === "sale_cred")
                .reduce((a, e) => a + fine24(e.weight, e.karat || 21), 0)}
                cash_amount={detail.stats.spend} currency={currency} tone="good" />
              <div className="flex items-baseline justify-between pt-1.5">
                <span style={{ color: "var(--text3)" }} className="text-[10px]">قطع في عهدتك</span>
                <span style={{ color: detail.stats.heldItems ? "var(--bad)" : "var(--text3)" }}
                  className="text-[11px] font-bold">{detail.stats.heldItems}</span>
              </div>
            </Card>

            {/* ── الخطّ الزمني ── */}
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">
              كل ما جرى — {detail.events.length} حدثًا
            </p>
            {detail.events.length === 0 ? (
              <EmptyState icon={<Clock size={30} color="var(--accentSoft)" />}
                title="لا حركات في هذا المدى" sub="غيّر الفترة أو اختر «الكل»" />
            ) : (
              <div className="flex flex-col gap-1">
                {detail.events.map((e, i) => {
                  const d = CUST_EVENTS[e.kind] || { label: e.kind, tone: "text2" };
                  return (
                    <Card key={i} style={{ padding: 10 }}>
                      <div className="flex items-center gap-2">
                        <span style={{
                          width: 6, height: 6, borderRadius: 3,
                          background: `var(--${d.tone})`, flexShrink: 0,
                        }} />
                        <span style={{ color: `var(--${d.tone})` }}
                          className="text-[11px] font-bold flex-1">
                          {d.label}
                        </span>
                        <span style={{ color: "var(--text3)" }} className="text-[10px]">
                          {fmtD(e.date)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-2.5 mt-1 pr-3">
                        {e.ref && (
                          <span style={{ color: "var(--text3)", fontFamily: "monospace" }}
                            className="text-[10px]">{e.ref}</span>
                        )}
                        {e.amount > 0.004 && (
                          <span style={{ color: "var(--text)" }} className="text-[11px] font-bold">
                            {currency}{fmtMoney(e.amount)}
                          </span>
                        )}
                        {e.weight > 0.0005 && (
                          <span style={{ color: "var(--accent)" }} className="text-[11px]">
                            {fmtW(e.weight)} جم{e.karat ? ` ع${e.karat}` : ""}
                          </span>
                        )}
                        {e.note && (
                          <span style={{ color: "var(--text3)" }} className="text-[10px]">
                            {e.note}
                          </span>
                        )}
                        {e.held && (
                          <span className="text-[9px] px-1.5 rounded-full"
                            style={{ background: "var(--badBg)", color: "var(--bad)" }}>
                            ما زالت عندك
                          </span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-2 mt-3 mb-6">
          <button onClick={exportPdf}
            className="py-2.5 rounded-xl text-[12px] font-bold"
            style={{ background: "var(--panel)", color: "var(--accent)",
                     border: "1px solid var(--accentLine)" }}>PDF</button>
          <button onClick={exportXlsx}
            className="py-2.5 rounded-xl text-[12px] font-bold"
            style={{ background: "var(--panel)", color: "var(--good)",
                     border: "1px solid var(--goodLine)" }}>Excel</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  لقطة النظام للذكاء
//
//  ⚠ أرقامٌ محسوبة لا مصادر خام.
//
//  تمرير ألف فاتورة للنموذج يُحرق السياق ويُبطئ الردّ ويُغري بالجمع —
//  وهو أسوأ ما يفعله: **نموذجٌ يجمع أرقامًا يُخطئ**، ولا يُكشف خطؤه
//  لأنه يبدو معقولًا.
//
//  فنحسب نحن بالهللات، ونُمرّر النتيجة. والقاعدة الأولى في `REPORT_AI_RULES`
//  تمنعه من الحساب أصلًا.
//
//  ⚠ ولا بيانات شخصية إلا ما يلزم: أسماء العملاء تُمرَّر لأن السؤال قد
//  يكون عنهم، لكن الجوّالات لا. رقمُ هاتفٍ في سياقٍ يُرسل لخادم لا
//  يخدم إجابةً محاسبية.
// ═══════════════════════════════════════════════════════════════════════

export { CustomerReportPage };
