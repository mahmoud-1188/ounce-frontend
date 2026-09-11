import React, { useState } from "react";
import { AlertTriangle, FileSpreadsheet, FileText, Scale, ShoppingCart, Truck } from "lucide-react";
import * as XLSX from "xlsx";
import { fine24, fmt, fmtMoney, fmtW } from "../core/money.js";
import { exportTablesPdf, fundingSourceLabel } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Stat } from "../ui/Stat.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function PurchasesPage({ totals, lots, suppliers, scrapEntries, taskirEntries, expenses, weightAdjustments = [], currency, onBack, flashToast }) {
  const [tab, setTab] = useState("gold");
  const t = totals;
  const supplierName = (id) => suppliers.find((x) => x.id === id)?.name || "—";
  const nonGoldRows = expenses.filter((e) => e.category === "purchases");

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();

    const summary = [
      ["تقرير المشتريات", new Date().toLocaleDateString("en-GB")],
      [],
      ["— مشتريات الذهب (تدخل في تكلفة البضاعة) —"],
      [`ذهب من الموردين (${currency})`, fmt(t.supplierGold, 0)],
      [`أجور ومصنعية الموردين (${currency})`, fmt(t.supplierWorkmanship, 0)],
      [`شراء كسر (${currency})`, fmt(t.scrapCost, 0)],
      [`شراء ذهب خام للتسكير (${currency})`, fmt(t.bullionCost, 0)],
      [`أجور التسكير (${currency})`, fmt(t.taskirWorkmanship, 0)],
      [`إجمالي مشتريات الذهب (${currency})`, fmt(t.goldTotal, 0)],
      ["الوزن المشترى بعيار 24 (جم)", fmt(t.goldFineWeight)],
      [`متوسط تكلفة الجرام عيار 24 (${currency})`, fmt(t.avgCostPerFineGram)],
      [],
      ["— مشتريات غير ذهبية (خارج تكلفة الذهب) —"],
      [`الإجمالي (${currency})`, fmt(t.nonGold, 0)],
      ["عدد العمليات", t.nonGoldCount],
      [],
      [`إجمالي كل المشتريات (${currency})`, fmt(t.grandTotal, 0)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "ملخص المشتريات");

    const lotRows = [["التاريخ", "المورد", "العيار", "الوزن (جم)", `سعر الجرام (${currency})`, `قيمة الذهب (${currency})`, `الأجور (${currency})`, `الإجمالي (${currency})`]];
    lots.forEach((l) =>
      lotRows.push([
        new Date(l.date).toLocaleDateString("en-GB"),
        supplierName(l.supplierId),
        l.karat,
        fmt(l.weight),
        fmt(l.costPerGram),
        fmt(l.goldCost ?? l.weight * l.costPerGram, 0),
        fmt(l.workmanshipTotal || 0, 0),
        fmt(l.totalCost, 0),
      ])
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lotRows), "مشتريات الموردين");

    const scrapRows = [["التاريخ", "الوصف", "العيار", "الوزن (جم)", `سعر الجرام (${currency})`, `الإجمالي (${currency})`, "الحالة"]];
    scrapEntries.forEach((e) =>
      scrapRows.push([
        new Date(e.date).toLocaleDateString("en-GB"),
        e.description || "",
        e.karat,
        fmt(e.weight),
        fmt(e.pricePerGram),
        fmt(e.total, 0),
        e.status,
      ])
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(scrapRows), "مشتريات الكسر");

    const ngRows = [["التاريخ", "البيان", `المبلغ (${currency})`, "المصدر"]];
    nonGoldRows.forEach((e) =>
      ngRows.push([new Date(e.date).toLocaleDateString("en-GB"), e.name || "", fmt(e.amount, 0), fundingSourceLabel(e.fundingSource)])
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ngRows), "مشتريات غير ذهبية");

    XLSX.writeFile(wb, `المشتريات_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const Row = ({ label, value, accent, indent }) => (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)", paddingRight: indent ? 12 : 0 }}>
      <span style={{ color: "var(--text2)" }} className="text-xs">
        {label}
      </span>
      <span style={{ color: accent || "var(--text)" }} className="text-xs font-bold">
        {value}
      </span>
    </div>
  );

  return (
    <div>
      <SubPageHeader title="المشتريات" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-4">
          مشتريات الذهب تدخل في تكلفة البضاعة ويُحسب عليها ربح الذهب. المشتريات غير الذهبية (تغليف، عدد، أثاث) تبقى خارجها حتى لا تشوّه الهامش.
        </p>

        <Card style={{ padding: 16, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
            إجمالي مشتريات الذهب
          </p>
          <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--accent)" }} className="text-2xl font-extrabold">
            {currency}
            {fmt(t.goldTotal, 0)}
          </p>
          <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
            {fmtW(t.goldFineWeight)} جم بعيار 24 · متوسط التكلفة {currency}
            {fmt(t.avgCostPerFineGram)}/جم
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label="مشتريات غير ذهبية" value={`${currency}${fmt(t.nonGold, 0)}`} accent="var(--bad)" />
          <Stat label="إجمالي كل المشتريات" value={`${currency}${fmt(t.grandTotal, 0)}`} />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { id: "gold", label: "مشتريات الذهب" },
            { id: "nonGold", label: "غير ذهبية" },
            { id: "variance", label: "هالك وفائض" },
          ].map((x) => (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className="py-2 rounded-xl text-xs font-bold"
              style={{ background: tab === x.id ? "var(--accentBg)" : "var(--panel)", color: tab === x.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() =>
            exportTablesPdf({
              title: "تقرير المشتريات",
              landscape: true,
              onBlocked: flashToast,
              sections: [{
                title: "دفعات الشراء",
                headers: ["المرجع", "التاريخ", "المورد", "العيار", "الوزن", "بعيار 24",
                  `التكلفة (${currency})`, "الأجور", "السداد"],
                rows: (lots || []).map((l) => [
                  l.ref, String(l.date || "").slice(0, 10),
                  (suppliers || []).find((x) => x.id === l.supplierId)?.name || "",
                  l.karat, fmtW(l.weight), fmtW(fine24(l.weight, l.karat)),
                  fmtMoney(l.goldCost), fmtMoney(l.workmanship),
                  l.paymentMethod === "deferred" ? "آجل" : "مسدَّد",
                ]),
                note: "⚖ الآجل التزام لا نقد: الذهب يُسدَّد ذهبًا والأجور بالعملة.",
              }],
            })
          }
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
        >
          <FileText size={16} /> PDF
        </button>
        <button
          onClick={exportXlsx}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}
        >
          <FileSpreadsheet size={16} /> Excel
        </button>
        </div>

        {tab === "variance" ? (
          (() => {
            const wast = weightAdjustments.filter((a) => a.kind === "wastage");
            const surp = weightAdjustments.filter((a) => a.kind === "surplus");
            const wW = wast.reduce((a, x) => a + x.weight, 0);
            const wF = wast.reduce((a, x) => a + x.fineWeight, 0);
            const wV = wast.reduce((a, x) => a + x.value, 0);
            const sW = surp.reduce((a, x) => a + x.weight, 0);
            const sF = surp.reduce((a, x) => a + x.fineWeight, 0);
            const sV = surp.reduce((a, x) => a + x.value, 0);
            const openLots = lots.filter((l) => l.status !== "closed");
            return (
              <>
                <Card style={{ padding: 14, marginBottom: 12 }}>
                  <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
                    الفرق بين وزن الدفعات المشتراة وما دخل المخزون فعلًا. يُسجَّل عند إقفال الدفعة.
                  </p>
                  <Row label="هالك — الوزن" value={`${fmtW(wW)} جم (${fmt(wF)} بعيار 24)`} accent="var(--bad)" />
                  <Row label="هالك — القيمة" value={`${currency}${fmt(wV, 0)}`} accent="var(--bad)" />
                  <Row label="فائض — الوزن" value={`${fmtW(sW)} جم (${fmt(sF)} بعيار 24)`} accent="var(--goodSolid)" />
                  <Row label="فائض — القيمة" value={`${currency}${fmt(sV, 0)}`} accent="var(--goodSolid)" />
                  <Row label="الصافي" value={`${fmtW(wW - sW)} جم`} accent={wW - sW > 0 ? "var(--bad)" : "var(--goodSolid)"} />
                </Card>

                {openLots.length > 0 && (
                  <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--badLine)" }}>
                    <p style={{ color: "var(--bad)" }} className="text-xs font-bold flex items-center gap-1.5">
                      <AlertTriangle size={13} /> {openLots.length} دفعة لم تُقفل بعد
                    </p>
                    <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                      الهالك لا يُحتسب إلا بعد إقفال الدفعة من صفحة الموردين.
                    </p>
                  </Card>
                )}

                {weightAdjustments.length === 0 ? (
                  <EmptyState icon={<Scale size={32} color="var(--accentText)" />} title="لا توجد فروقات وزن" sub="تظهر هنا عند إقفال الدفعات" />
                ) : (
                  <div className="flex flex-col gap-2">
                    {weightAdjustments.map((a) => (
                      <Card key={a.id} style={{ padding: 12 }}>
                        <div className="flex items-center justify-between">
                          <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                            {a.kind === "wastage" ? "هالك" : "فائض"} · عيار {a.karat}
                          </span>
                          <span style={{ color: a.kind === "wastage" ? "var(--bad)" : "var(--goodSolid)" }} className="text-sm font-bold">
                            {fmtW(a.weight)} جم
                          </span>
                        </div>
                        <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                          {supplierName(a.supplierId)}
                          {a.lotRef ? ` · ${a.lotRef}` : ""} · مشترى {fmt(a.purchasedWeight)} / مُدخل {fmt(a.enteredWeight)}
                        </p>
                        <p style={{ color: "var(--text2)" }} className="text-[11px] mt-0.5">
                          {currency}{fmt(a.value, 0)} · {fmtW(a.fineWeight)} جم عيار 24 · {new Date(a.date).toLocaleDateString("en-GB")}
                          {a.createdBy ? ` · ${a.createdBy}` : ""}
                        </p>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            );
          })()
        ) : tab === "gold" ? (
          <>
            <Card style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
                تفصيل تكلفة الذهب
              </p>
              <Row label={`ذهب من الموردين (${t.supplierCount} دفعة)`} value={`${currency}${fmt(t.supplierGold, 0)}`} indent />
              <Row label="أجور ومصنعية الموردين" value={`${currency}${fmt(t.supplierWorkmanship, 0)}`} indent />
              <Row label={`شراء كسر (${t.scrapCount} عملية)`} value={`${currency}${fmt(t.scrapCost, 0)}`} indent />
              <Row label="شراء ذهب خام للتسكير" value={`${currency}${fmt(t.bullionCost, 0)}`} indent />
              <Row label="أجور التسكير" value={`${currency}${fmt(t.taskirWorkmanship, 0)}`} indent />
              <Row label="الإجمالي" value={`${currency}${fmt(t.goldTotal, 0)}`} accent="var(--accent)" />
            </Card>

            <Card style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
                الأوزان المشتراة
              </p>
              <Row label="من الموردين" value={`${fmtW(t.supplierWeight)} جم (${fmt(t.supplierFine)} بعيار 24)`} indent />
              <Row label="كسر" value={`${fmtW(t.scrapWeight)} جم (${fmt(t.scrapFine)} بعيار 24)`} indent />
              <Row label="ذهب خام" value={`${fmtW(t.bullionWeight)} جم`} indent />
              <Row label="الإجمالي بعيار 24" value={`${fmtW(t.goldFineWeight)} جم`} accent="var(--accent)" />
            </Card>

            <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
              دفعات الموردين ({lots.length})
            </p>
            {lots.length === 0 ? (
              <EmptyState icon={<Truck size={32} color="var(--accentText)" />} title="لا توجد مشتريات من موردين" sub="سجّل أول دفعة من صفحة الموردين" />
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {lots.slice(0, 30).map((l) => (
                  <Card key={l.id} style={{ padding: 12 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                        {supplierName(l.supplierId)}
                      </span>
                      <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                        {currency}
                        {fmt(l.totalCost, 0)}
                      </span>
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                      عيار {l.karat} · {fmtW(l.weight)} جم · {currency}
                      {fmt(l.costPerGram)}/جم
                      {l.workmanshipTotal > 0 ? ` · أجور ${fmt(l.workmanshipTotal, 0)}` : ""} · {new Date(l.date).toLocaleDateString("en-GB")}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Card style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
                هذه المشتريات <b>لا تدخل</b> في تكلفة الذهب ولا تُخصم من هامشه. تُعامل كمصروف تشغيلي.
              </p>
              <Row label={`عدد العمليات`} value={t.nonGoldCount} indent />
              <Row label="الإجمالي" value={`${currency}${fmt(t.nonGold, 0)}`} accent="var(--bad)" />
            </Card>
            {nonGoldRows.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart size={32} color="var(--accentText)" />}
                title="لا توجد مشتريات غير ذهبية"
                sub='سجّلها من صفحة المصروفات واختر التصنيف "مشتريات"'
              />
            ) : (
              <div className="flex flex-col gap-2">
                {nonGoldRows.map((e) => (
                  <Card key={e.id} style={{ padding: 12 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text)" }} className="text-sm">
                        {e.name || "مشتريات"}
                      </span>
                      <span style={{ color: "var(--bad)" }} className="text-sm font-bold">
                        {currency}
                        {fmt(e.amount, 0)}
                      </span>
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                      {new Date(e.date).toLocaleDateString("en-GB")} · {fundingSourceLabel(e.fundingSource)}
                      {e.createdBy ? ` · ${e.createdBy}` : ""}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// الطباعة ضمن الإدخال — الكل / فردي / حسب الاختيار
// ============================================================
// ملصق الرقاقة. تعريف واحد يستخدمه الإدخال وإعادة الطباعة، حتى لا يفترق
// شكل الملصق بين المسارين مع الوقت.

export { PurchasesPage };
