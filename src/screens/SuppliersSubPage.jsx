import React, { useState } from "react";
import { AlertTriangle, ChevronLeft, FileSpreadsheet, Handshake, Lock, Paperclip, Plus, Truck } from "lucide-react";
import * as XLSX from "xlsx";
import { PURITY, fmt, fmtW } from "../core/money.js";
import { inputStyle, openAttachment } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { InvoiceAttachField } from "../ui/InvoiceAttachField.jsx";
import { SettleSupplierForm } from "../ui/SettleSupplierForm.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function SuppliersSubPage({ suppliers, lots, items, safeTx, cashTx, taskirEntries, scrapEntries = [], offices = [], safeGoldTx = [], price24 = 0, currency, canManage, onAddSupplier, onAttachInvoice, onAddPurchase, onCloseLot, onSettle, onBack, onOpenEntity }) {
  const [detailId, setDetailId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isOfficial, setIsOfficial] = useState(false);

  const nameTaken = suppliers.some((x) => x.name.trim() === name.trim());
  const valid = name.trim().length > 0 && !nameTaken;

  // كشف حساب المورد: كل حركة تُصنَّف «له» (يستحق) أو «عليه» (سُدِّد له)،
  // مع رصيد تراكمي. هذا ما يجيب سؤال «كم له وكم عليه» بدل تقدير تقريبي.
  // كشف حساب المورد ببعدين: وزن ذهب (بعيار 24) وأجور نقدية.
  // دمجهما في رقم واحد كان يخفي حقيقة ما تدين به — الذهب يُسدَّد ذهبًا
  // والأجور تُسدَّد نقدًا، وسعر الجرام يتغيّر بينهما.
  const accountFor = (supplierId) => {
    const supLots = lots.filter((l) => l.supplierId === supplierId);
    const rows = [];
    const byKarat = {};
    let goldOwed = 0; // جرام عيار 24
    let feesOwed = 0; // نقد

    supLots.forEach((l) => {
      const purity = PURITY[l.karat] || (Number(l.karat) || 0) / 24;
      const fine = (Number(l.weight) || 0) * purity;
      const fees = Number(l.workmanshipTotal) || 0;

      if (!byKarat[l.karat]) byKarat[l.karat] = { weight: 0, fine: 0, fees: 0, count: 0, deferredWeight: 0 };
      byKarat[l.karat].weight += Number(l.weight) || 0;
      byKarat[l.karat].fine += fine;
      byKarat[l.karat].fees += fees;
      byKarat[l.karat].count += 1;

      const deferred = l.paymentMethod === "deferred";
      if (deferred) {
        goldOwed += fine;
        byKarat[l.karat].deferredWeight += Number(l.weight) || 0;
        if (!l.feesPaidNow) feesOwed += fees;
      }

      rows.push({
        date: l.date,
        desc: `شراء عيار ${l.karat} · ${fmtW(l.weight)} جم`,
        karat: l.karat,
        weightIn: Number(l.weight) || 0,
        fineIn: fine,
        feesIn: fees,
        settled: !deferred,
        method:
          l.paymentMethod === "deferred"
            ? l.feesPaidNow
              ? "آجل — سُدّدت الأجور"
              : "آجل"
            : l.paymentMethod === "office"
            ? "تسكير على مكتب"
            : l.paymentMethod === "safe_network"
            ? "سداد شبكة"
            : "سداد نقدي",
      });
    });

    // تسويات بالذهب تُنقص الوزن المستحق
    (taskirEntries || [])
      .filter((t) => t.supplierId === supplierId)
      .forEach((t) => {
        const purity = PURITY[t.karat] || (Number(t.karat) || 0) / 24;
        const fine = (Number(t.weight) || 0) * purity;
        goldOwed -= fine;
        feesOwed -= Number(t.workmanshipAmount) || 0;
        rows.push({
          date: t.date,
          desc: `تسوية بالذهب · ${fmtW(t.weight)} جم عيار ${t.karat}`,
          karat: t.karat,
          weightOut: Number(t.weight) || 0,
          fineOut: fine,
          feesOut: Number(t.workmanshipAmount) || 0,
          settled: true,
          method: "تسوية",
        });
      });

    rows.sort((a, b) => new Date(a.date) - new Date(b.date));
    return { rows, byKarat, goldOwed, feesOwed, lots: supLots };
  };

  if (detailId) {
    const sup = suppliers.find((x) => x.id === detailId);
    const acc = accountFor(detailId);
    const karats = Object.entries(acc.byKarat).sort((a, b) => Number(b[0]) - Number(a[0]));

    const exportStatement = () => {
      const wb = XLSX.utils.book_new();
      const head = [["التاريخ", "البيان", "العيار", "وزن له (جم)", "وزن عليه (جم)", `أجور له (${currency})`, `أجور عليه (${currency})`, "الحالة"]];
      acc.rows.forEach((r) =>
        head.push([
          new Date(r.date).toLocaleDateString("en-GB"),
          r.desc,
          r.karat,
          r.weightIn ? fmt(r.weightIn) : "",
          r.weightOut ? fmt(r.weightOut) : "",
          r.feesIn ? fmt(r.feesIn, 0) : "",
          r.feesOut ? fmt(r.feesOut, 0) : "",
          r.method,
        ])
      );
      head.push([]);
      head.push(["المستحق — ذهب (جم عيار 24)", fmt(acc.goldOwed)]);
      head.push([`المستحق — أجور (${currency})`, fmt(acc.feesOwed, 0)]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(head), "كشف حساب");

      const kr = [["العيار", "الوزن (جم)", "بعيار 24 (جم)", `الأجور (${currency})`, "عدد الدفعات", "آجل (جم)"]];
      karats.forEach(([k, v]) => kr.push([k, fmt(v.weight), fmt(v.fine), fmt(v.fees, 0), v.count, fmt(v.deferredWeight)]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kr), "حسب العيار");
      XLSX.writeFile(wb, `كشف_حساب_${(sup?.name || "مورد").replace(/\s+/g, "_")}.xlsx`);
    };

    return (
      <div>
        <SubPageHeader title={`${sup?.name || "مورد"}${sup?.ref ? " · " + sup.ref : ""}`} onBack={() => setDetailId(null)} />
        <div className="px-4 pt-3">
          {sup?.isOfficial && (
            <span className="text-[10px] px-2 py-0.5 rounded-full inline-block mb-2"
              style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
              مورد رسمي
            </span>
          )}

          <Card style={{ padding: 16, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
              الإجمالي المستحق للمورد
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p style={{ color: "var(--text3)" }} className="text-[11px]">ذهب</p>
                <p style={{ fontFamily: "'Cairo', sans-serif", color: acc.goldOwed > 0.0001 ? "var(--bad)" : "var(--goodSolid)" }} className="text-xl font-extrabold">
                  {fmtW(Math.abs(acc.goldOwed))} جم
                </p>
                <p style={{ color: "var(--text3)" }} className="text-[10px]">بعيار 24</p>
              </div>
              <div>
                <p style={{ color: "var(--text3)" }} className="text-[11px]">أجور</p>
                <p style={{ fontFamily: "'Cairo', sans-serif", color: acc.feesOwed > 0.0001 ? "var(--bad)" : "var(--goodSolid)" }} className="text-xl font-extrabold">
                  {currency}{fmt(Math.abs(acc.feesOwed), 0)}
                </p>
                <p style={{ color: "var(--text3)" }} className="text-[10px]">نقدًا</p>
              </div>
            </div>
            {acc.goldOwed <= 0.0001 && acc.feesOwed <= 0.0001 && (
              <p style={{ color: "var(--good)" }} className="text-[11px] mt-2">الحساب مسدَّد بالكامل</p>
            )}
          </Card>

          {canManage && (acc.goldOwed > 0.0001 || acc.feesOwed > 0.0001) && !showSettle && (
            <button
              onClick={() => setShowSettle(true)}
              className="w-full py-3 rounded-xl font-bold mb-4 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
            >
              <Handshake size={17} /> سداد المورد
            </button>
          )}

          {showSettle && (
            <SettleSupplierForm
              supplier={sup}
              owed={{ goldOwed: acc.goldOwed, feesOwed: acc.feesOwed }}
              scrapEntries={scrapEntries}
              offices={offices}
              currency={currency}
              price24={price24}
              onCancel={() => setShowSettle(false)}
              onSubmit={(entry) => {
                onSettle(entry);
                setShowSettle(false);
              }}
            />
          )}

          <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
            تفصيل المشتريات حسب العيار
          </p>
          {karats.length === 0 ? (
            <EmptyState icon={<Truck size={32} color="var(--accentText)" />} title="لا توجد مشتريات" sub="سجّل أول عملية شراء" />
          ) : (
            <Card style={{ padding: 12, marginBottom: 12 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["العيار", "الوزن", "بعيار 24", "الأجور", "آجل"].map((h) => (
                        <th key={h} style={{ border: "1px solid var(--line)", padding: 5, color: "var(--accent)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {karats.map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ border: "1px solid var(--line)", padding: 5, color: "var(--text)", whiteSpace: "nowrap" }}>عيار {k}</td>
                        <td style={{ border: "1px solid var(--line)", padding: 5, color: "var(--text)", whiteSpace: "nowrap" }}>{fmt(v.weight)}</td>
                        <td style={{ border: "1px solid var(--line)", padding: 5, color: "var(--accentText)", whiteSpace: "nowrap" }}>{fmt(v.fine)}</td>
                        <td style={{ border: "1px solid var(--line)", padding: 5, color: "var(--text)", whiteSpace: "nowrap" }}>{fmt(v.fees, 0)}</td>
                        <td style={{ border: "1px solid var(--line)", padding: 5, color: v.deferredWeight > 0 ? "var(--bad)" : "var(--text3)", whiteSpace: "nowrap" }}>
                          {v.deferredWeight > 0 ? fmt(v.deferredWeight) : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ border: "1px solid var(--line)", padding: 5, color: "var(--accent)", fontWeight: 700 }}>الإجمالي</td>
                      <td style={{ border: "1px solid var(--line)", padding: 5, color: "var(--accent)", fontWeight: 700 }}>
                        {fmt(karats.reduce((a, [, v]) => a + v.weight, 0))}
                      </td>
                      <td style={{ border: "1px solid var(--line)", padding: 5, color: "var(--accent)", fontWeight: 700 }}>
                        {fmt(karats.reduce((a, [, v]) => a + v.fine, 0))}
                      </td>
                      <td style={{ border: "1px solid var(--line)", padding: 5, color: "var(--accent)", fontWeight: 700 }}>
                        {fmt(karats.reduce((a, [, v]) => a + v.fees, 0), 0)}
                      </td>
                      <td style={{ border: "1px solid var(--line)", padding: 5 }}>—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p style={{ color: "var(--accentText)" }} className="text-[11px] mt-2 flex items-start gap-1">
                <AlertTriangle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
                عمود «بعيار 24» محوَّل حسب نقاء كل عيار (الوزن × العيار ÷ 24). جمع الأوزان الخام مباشرة يعطي رقمًا خاطئًا.
              </p>
            </Card>
          )}

          <button
            onClick={exportStatement}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold mb-4"
            style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}
          >
            <FileSpreadsheet size={16} /> تصدير كشف الحساب
          </button>

          <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
            الحركات ({acc.rows.length})
          </p>
          <div className="flex flex-col gap-2 mb-4">
            {acc.rows.map((r, i) => (
              <Card key={i} style={{ padding: 10 }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text)" }} className="text-xs">{r.desc}</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      background: r.settled ? "var(--goodBg)" : "var(--badBg)",
                      color: r.settled ? "var(--goodSolid)" : "var(--bad)",
                    }}
                  >
                    {r.method}
                  </span>
                </div>
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                  {new Date(r.date).toLocaleDateString("en-GB")}
                  {r.fineIn ? ` · ${fmtW(r.fineIn)} جم عيار 24` : ""}
                  {r.fineOut ? ` · سُدِّد ${fmtW(r.fineOut)} جم عيار 24` : ""}
                  {r.feesIn ? ` · أجور ${fmt(r.feesIn, 0)}` : ""}
                </p>
              </Card>
            ))}
          </div>

          <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
            الدفعات ({acc.lots.length})
          </p>
          <div className="flex flex-col gap-2">
            {acc.lots.map((l) => {
              const allocated = Number(l.workmanshipAllocated) || 0;
              const wmVar = (Number(l.workmanshipTotal) || 0) - allocated;
              return (
                <Card key={l.id} style={{ padding: 12 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                      عيار {l.karat} · {fmtW(l.weight)} جم
                      {l.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{l.ref}</span>}
                    </span>
                    <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                      {currency}{fmt(l.totalCost, 0)}
                    </span>
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                    {currency}{fmt(l.costPerGram)}/جم · أجور {fmt(l.workmanshipTotal || 0, 0)} · {new Date(l.date).toLocaleDateString("en-GB")}
                  </p>
                  {(l.workmanshipTotal || 0) > 0 && (
                    <p style={{ color: wmVar > 0 ? "var(--accent)" : wmVar < 0 ? "var(--bad)" : "var(--goodSolid)" }} className="text-[11px] mt-0.5">
                      {wmVar > 0 ? `متبقٍ من الأجور: ${fmt(wmVar, 0)}` : wmVar < 0 ? `فائض موزَّع: ${fmt(Math.abs(wmVar), 0)}` : "وُزِّعت الأجور بالكامل"}
                    </p>
                  )}
                  {(() => {
                    const wIn = Number(l.enteredWeight) || 0;
                    const wVar = (Number(l.weight) || 0) - wIn;
                    if (l.status === "closed") {
                      return (
                        <p style={{ color: (l.wastageWeight || 0) > 0 ? "var(--bad)" : (l.surplusWeight || 0) > 0 ? "var(--goodSolid)" : "var(--goodSolid)" }} className="text-[11px] mt-0.5">
                          مُقفلة ·{" "}
                          {(l.wastageWeight || 0) > 0
                            ? `هالك ${fmtW(l.wastageWeight)} جم`
                            : (l.surplusWeight || 0) > 0
                            ? `فائض ${fmtW(l.surplusWeight)} جم`
                            : "مطابقة تامة"}
                        </p>
                      );
                    }
                    return (
                      <>
                        <p style={{ color: "var(--text2)" }} className="text-[11px] mt-0.5">
                          أُدخل {fmt(wIn)} من {fmtW(l.weight)} جم ·{" "}
                          <span style={{ color: Math.abs(wVar) < 0.001 ? "var(--goodSolid)" : wVar > 0 ? "var(--accent)" : "var(--bad)" }}>
                            {Math.abs(wVar) < 0.001 ? "مطابق" : wVar > 0 ? `متبقٍ ${fmt(wVar)}` : `زائد ${fmt(-wVar)}`}
                          </span>
                        </p>
                        {canManage && wIn > 0 && (
                          <button
                            onClick={() => onCloseLot(l)}
                            className="text-[11px] px-2 py-1 rounded-full flex items-center gap-1 mt-2 w-fit"
                            style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
                          >
                            <Lock size={11} /> إقفال الدفعة وتسجيل الفرق
                          </button>
                        )}
                      </>
                    );
                  })()}
                  {l.invoiceAttachId || l.invoiceFile ? (
                    <button
                      onClick={() => openAttachment(l.invoiceAttachId, l.invoiceFile)}
                      className="text-[11px] px-2 py-1 rounded-full flex items-center gap-1 mt-2 w-fit"
                      style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
                    >
                      <Paperclip size={11} /> عرض الفاتورة
                    </button>
                  ) : (
                    <div className="mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full inline-block mb-1"
                        style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}>
                        بانتظار الفاتورة
                      </span>
                      {canManage && (
                        <InvoiceAttachField value={null} onChange={(f) => f && onAttachInvoice(l.id, f)} label="إرفاق الفاتورة الآن" optional />
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SubPageHeader title="الموردين" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
          أضف المورد أولًا، ثم سجّل عمليات الشراء عليه. لكل مورد كشف حساب يوضّح ما له وما عليه.
        </p>
        {(() => {
          // الفواتير المؤجّلة تُعدّ وتُعرض: السماح بتأجيلها بلا تذكير يعني
          // أنها لن تُرفق أبدًا، ويضيع الأثر المستندي للمشتريات.
          const pending = lots.filter((l) => !l.invoiceAttachId && !l.invoiceFile);
          if (pending.length === 0) return null;
          return (
            <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--badLine)" }}>
              <p style={{ color: "var(--bad)" }} className="text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle size={13} /> {pending.length} دفعة بانتظار الفاتورة
              </p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                افتح المورد وأرفق الفاتورة من بطاقة الدفعة.
              </p>
            </Card>
          );
        })()}

        {canManage &&
          (!showAdd ? (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setShowAdd(true)}
                className="py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
              >
                <Plus size={16} /> إضافة مورد
              </button>
              <button
                disabled={suppliers.length === 0}
                onClick={onAddPurchase}
                className="py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                style={{
                  background: suppliers.length ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                  color: suppliers.length ? "var(--panel)" : "var(--text3)",
                }}
              >
                <Truck size={16} /> تسجيل شراء
              </button>
            </div>
          ) : (
            <Card style={{ padding: 14, marginBottom: 16 }}>
              <Field label="اسم المورد (إجباري)">
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="الجوال (اختياري)">
                <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="نوع المورد">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: false, label: "عادي" },
                    { v: true, label: "رسمي (بفاتورة ضريبية)" },
                  ].map((o) => (
                    <button
                      key={String(o.v)}
                      onClick={() => setIsOfficial(o.v)}
                      className="py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: isOfficial === o.v ? "var(--accentBg)" : "var(--panel)", color: isOfficial === o.v ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </Field>
              {nameTaken && name.trim() && (
                <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">
                  يوجد مورد بهذا الاسم
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowAdd(false)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                  إلغاء
                </button>
                <button
                  disabled={!valid}
                  onClick={() => {
                    onAddSupplier(name.trim(), phone.trim(), isOfficial);
                    setName("");
                    setPhone("");
                    setShowAdd(false);
                  }}
                  className="py-2 rounded-xl text-xs font-bold"
                  style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
                >
                  حفظ المورد
                </button>
              </div>
            </Card>
          ))}

        {suppliers.length === 0 ? (
          <EmptyState icon={<Truck size={36} color="var(--accentText)" />} title="لا يوجد موردون" sub="أضف أول مورد لتتمكن من تسجيل المشتريات" />
        ) : (
          <>
            {[
              { official: true, label: "موردون رسميون" },
              { official: false, label: "موردون عاديون" },
            ].map((grp) => {
              const list = suppliers.filter((sp) => !!sp.isOfficial === grp.official);
              if (list.length === 0) return null;
              return (
                <div key={String(grp.official)} className="mb-4">
                  <p style={{ color: grp.official ? "var(--goodSolid)" : "var(--text2)" }} className="text-xs font-bold mb-2">
                    {grp.label} ({list.length})
                  </p>
                  <div className="flex flex-col gap-2">
                    {list.map((sp) => {
                      const acc = accountFor(sp.id);
                      const clear = acc.goldOwed <= 0.0001 && acc.feesOwed <= 0.0001;
                      return (
                        <div key={sp.id}>
                          <Card style={{ padding: 12 }}>
                            {/* ⚠ زرّان متجاوران لا متداخلان */}
                            <div className="flex items-center gap-2 mb-1.5">
                              <button
                                onClick={() => setDetailId(sp.id)}
                                className="text-[10px] font-bold flex-1 text-right"
                                style={{ color: "var(--text2)" }}
                              >
                                التفاصيل
                              </button>
                              {onOpenEntity && (
                                <button
                                  onClick={() => onOpenEntity("supplier", sp)}
                                  className="flex items-center gap-1"
                                >
                                  <span style={{ color: "var(--accent)" }} className="text-[10px] font-bold">
                                    كل ما يخصّه
                                  </span>
                                  <ChevronLeft size={12} color="var(--accent)"
                                    style={{ transform: "rotate(180deg)" }} />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                                {sp.name}
                                {sp.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{sp.ref}</span>}
                              </span>
                              <span style={{ color: clear ? "var(--goodSolid)" : "var(--bad)" }} className="text-xs font-bold">
                                {clear ? "مسدَّد" : `${fmtW(acc.goldOwed)} جم · ${fmt(acc.feesOwed, 0)}`}
                              </span>
                            </div>
                            <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                              {acc.lots.length} دفعة{sp.phone ? ` · ${sp.phone}` : ""}
                              {!clear ? " · مستحق عليك" : ""}
                            </p>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

export { SuppliersSubPage };
