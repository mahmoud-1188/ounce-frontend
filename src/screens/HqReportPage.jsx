import React, { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { fmtMoney, fmtW } from "../core/money.js";
import * as api from "../core/api.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

const selectStyle = { width: "100%", padding: "10px 12px", borderRadius: 12, background: "var(--field)", border: "1px solid var(--line)", color: "var(--text)" };

/**
 * شاشة جديدة لا مقابل مباشر لها في المرجع — راجع تعليق migration 017 في
 * hq.routes.js: HqTransactionsPage.js المرجعي نظام مزامنة رموز يدوي بين
 * نسخ محلية منفصلة، لا علاقة له بما تحتاجه هذه الشاشة (تجميع مباشر من
 * قاعدة بيانات واحدة حقيقية). لا تُعرض هذه الشاشة أصلًا إلا لمدير في فرع
 * مُعلَّم is_hq (راجع morePage === "hqReports" في GoldInventoryApp.jsx)
 * — التحقق الفعلي والوحيد المعتمَد عليه أمنيًا يجري في hq.routes.js.
 *
 * ملخصات فقط بلا تفاصيل سجلات فردية (قرار المستخدم صراحةً): مبيعات/
 * مشتريات الفترة المختارة، ومخزون/خزنة/ذمم كأرصدة "حتى الآن" لكل فرع
 * ومجمّعة، لا تصفّح لعمليات فرع بعينه من هنا.
 */
function HqReportPage({ currency = "ر.س", onBack, flashToast }) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(thisMonth);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  async function load(p) {
    setLoading(true);
    setForbidden(false);
    try {
      const res = await api.hqApi.fetchReport(p);
      setReport(res);
    } catch (err) {
      if (err instanceof api.ApiError && err.status === 403) {
        setForbidden(true);
      } else {
        flashToast?.("تعذّر جلب تقرير الفروع");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(period); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });

  return (
    <div>
      <SubPageHeader title="تقرير الفروع" onBack={onBack} />
      <div className="px-4 pt-3">
        <Field label="الشهر">
          <select style={selectStyle} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>

        {loading ? (
          <p style={{ color: "var(--text3)" }} className="text-[12px]">جارٍ التحميل…</p>
        ) : forbidden ? (
          <EmptyState icon={<Building2 size={30} color="var(--accentSoft)" />} title="غير متاح"
            sub="هذا التقرير مقصور على فرع الإدارة المركزية" />
        ) : !report?.branches?.length ? (
          <EmptyState icon={<Building2 size={30} color="var(--accentSoft)" />} title="لا فروع" sub="لا بيانات لعرضها" />
        ) : (
          <>
            <Card style={{ padding: 12, marginBottom: 10, background: "var(--field)" }}>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">إجمالي كل الفروع — {period}</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">مبيعات (صافٍ)</p>
                  <p style={{ color: "var(--accent)", margin: 0 }} className="text-[15px] font-bold">{currency}{fmtMoney(report.totals.salesNet)}</p>
                </div>
                <div>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">تكلفة المشتريات</p>
                  <p style={{ color: "var(--text)", margin: 0 }} className="text-[15px] font-bold">{currency}{fmtMoney(report.totals.purchasesCost)}</p>
                </div>
                <div>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">مخزون قائم (عيار24)</p>
                  <p style={{ color: "var(--text)", margin: 0 }} className="text-[15px] font-bold">{fmtW(report.totals.inventoryFineWeight)} جم</p>
                </div>
                <div>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">خزنة (نقدي + شبكة)</p>
                  <p style={{ color: "var(--text)", margin: 0 }} className="text-[15px] font-bold">{currency}{fmtMoney(report.totals.safeCash + report.totals.safeNetwork)}</p>
                </div>
                <div>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">ذمم مدينة (عملاء)</p>
                  <p style={{ color: "var(--good)", margin: 0 }} className="text-[13px] font-bold">{currency}{fmtMoney(report.totals.receivable)}</p>
                </div>
                <div>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">ذمم دائنة (موردون)</p>
                  <p style={{ color: "var(--bad)", margin: 0 }} className="text-[13px] font-bold">{currency}{fmtMoney(report.totals.payable)}</p>
                </div>
              </div>
            </Card>

            {report.branches.map((b) => (
              <Card key={b.branchId} style={{ padding: 12, marginBottom: 8 }}>
                <p style={{ color: "var(--text)", margin: "0 0 6px" }} className="text-[13px] font-bold">{b.branchName}</p>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-2">
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">مبيعات ({b.sales.count})</p>
                  <p style={{ color: "var(--text)", margin: 0 }} className="text-[11px] font-bold text-left">{currency}{fmtMoney(b.sales.net)}</p>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">مشتريات ({b.purchases.count})</p>
                  <p style={{ color: "var(--text)", margin: 0 }} className="text-[11px] font-bold text-left">{currency}{fmtMoney(b.purchases.cost)}</p>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">مخزون قائم</p>
                  <p style={{ color: "var(--text)", margin: 0 }} className="text-[11px] font-bold text-left">{fmtW(b.inventory.fineWeight)} جم24</p>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">خزنة نقدي/شبكة</p>
                  <p style={{ color: "var(--text)", margin: 0 }} className="text-[11px] font-bold text-left">{currency}{fmtMoney(b.safe.cash)} / {currency}{fmtMoney(b.safe.network)}</p>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">ذهب الخزنة</p>
                  <p style={{ color: "var(--text)", margin: 0 }} className="text-[11px] font-bold text-left">{fmtW(b.safe.goldFineWeight)} جم24</p>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">ذمم مدينة/دائنة</p>
                  <p style={{ margin: 0 }} className="text-[11px] font-bold text-left">
                    <span style={{ color: "var(--good)" }}>{currency}{fmtMoney(b.receivable)}</span>
                    {" / "}
                    <span style={{ color: "var(--bad)" }}>{currency}{fmtMoney(b.payable)}</span>
                  </p>
                </div>
              </Card>
            ))}
          </>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

export { HqReportPage };
