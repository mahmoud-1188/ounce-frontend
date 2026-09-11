import React, { useState } from "react";
import { Handshake, Paperclip, Plus } from "lucide-react";
import { fmt, fmtW } from "../core/money.js";
import { FUNDING_SOURCES } from "../core/workflow.js";
import { inputStyle, openAttachment } from "../domain/helpers.js";
import { AddTaskirForm } from "../ui/AddTaskirForm.jsx";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { Stat } from "../ui/Stat.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function TaskiratPage({ taskirEntries, totals, suppliers, offices, officeStats, currency, priceData, onAdd, onAddOffice, onBack }) {
  const [showOfficeForm, setShowOfficeForm] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState("");
  const [newOfficePhone, setNewOfficePhone] = useState("");
  const [newOfficeAddress, setNewOfficeAddress] = useState("");
  const [showForm, setShowForm] = useState(false);
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name || "مورد محذوف";
  const officeName = (id) => offices.find((o) => o.id === id)?.name || "—";
  const sourceLabel = (t) => FUNDING_SOURCES.find((f) => f.id === t.fundingSource)?.label || "—";

  return (
    <div>
      <SubPageHeader title="تسكيرات" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
          تسوية مستحقات الموردين: الذهب بالذهب من الكسر، أو بشراء ذهب خام من مكتب متخصص عند عدم توفر كسر — والأجور (المصنعية) نقدًا
        </p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat label="عدد العمليات" value={totals.count} />
          <Stat label="إجمالي الذهب" value={`${fmtW(totals.weight)} جم`} />
          <Stat label="إجمالي الأجور" value={`${currency}${fmt(totals.workmanship, 0)}`} />
        </div>

        {offices.length > 0 && (
          <>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
              مكاتب الذهب الخام — مشترياتك منها لسدّ نقص الكسر
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {offices.map((o) => {
                const stat = officeStats[o.id] || { weight: 0, amount: 0, count: 0 };
                return (
                  <Card key={o.id} style={{ padding: 12 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                        {o.name}
                      </span>
                      <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                        {currency}
                        {fmt(stat.amount, 0)}
                      </span>
                    </div>
                    <p style={{ color: "var(--text2)" }} className="text-xs mt-1">
                      {stat.count} عملية شراء · {fmtW(stat.weight)} جم إجمالاً
                    </p>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-6"
          style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
        >
          <Handshake size={18} /> تسكير جديد
        </button>

        {/* إدارة المكاتب مستقلة عن نموذج التسكير: المكتب يُسجَّل مرة ويُستخدم
            في عدة عمليات، وإخفاؤه داخل النموذج كان يجعل تسجيله غير واضح. */}
        {!showOfficeForm ? (
          <button
            onClick={() => setShowOfficeForm(true)}
            className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mb-4"
            style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
          >
            <Plus size={14} /> إضافة مكتب ذهب خام ({offices.length})
          </button>
        ) : (
          <Card style={{ padding: 14, marginBottom: 16 }}>
            <Field label="اسم المكتب">
              <input style={inputStyle} value={newOfficeName} onChange={(e) => setNewOfficeName(e.target.value)} placeholder="مثال: مكتب النور للذهب الخام" />
            </Field>
            <Field label="الجوال (اختياري)">
              <input style={inputStyle} value={newOfficePhone} onChange={(e) => setNewOfficePhone(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="العنوان">
              <input style={inputStyle} value={newOfficeAddress} onChange={(e) => setNewOfficeAddress(e.target.value)} placeholder="مثال: سوق الذهب — الدور الأول، محل 12" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowOfficeForm(false)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                إلغاء
              </button>
              <button
                disabled={!newOfficeName.trim()}
                onClick={() => {
                  onAddOffice(newOfficeName.trim(), newOfficePhone.trim(), newOfficeAddress.trim());
                  setNewOfficeName("");
                  setNewOfficePhone("");
                  setNewOfficeAddress("");
                  setShowOfficeForm(false);
                }}
                className="py-2 rounded-xl text-xs font-bold"
                style={{ background: newOfficeName.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: newOfficeName.trim() ? "var(--panel)" : "var(--text3)" }}
              >
                حفظ المكتب
              </button>
            </div>
          </Card>
        )}

        {offices.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {offices.map((o) => {
              const st = officeStats?.[o.id];
              return (
                <Card key={o.id} style={{ padding: 10 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                      {o.name}
                      {o.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{o.ref}</span>}
                    </span>
                    <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
                      {st ? `${fmtW(st.weight)} جم · ${currency}${fmt(st.amount, 0)}` : "لا حركات"}
                    </span>
                  </div>
                  {(o.phone || o.address) && (
                    <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                      {[o.phone, o.address].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {showForm && (
          <AddTaskirForm
            suppliers={suppliers}
            offices={offices}
            priceData={priceData}
            onAddOffice={onAddOffice}
            onCancel={() => setShowForm(false)}
            onSave={(entry) => {
              onAdd(entry);
              setShowForm(false);
            }}
          />
        )}

        {taskirEntries.length === 0 ? (
          <EmptyState icon={<Handshake size={36} color="var(--accentText)" />} title="لا يوجد تسكيرات مسجلة" sub="سجّل أول تسوية ذهب مع أحد الموردين" />
        ) : (
          <div className="flex flex-col gap-3">
            {taskirEntries.map((t) => (
              <Card key={t.id} style={{ padding: 12 }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                    {supplierName(t.supplierId)}
                  </span>
                  <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                    {currency}
                    {fmt(t.totalCashPaid, 0)}
                  </span>
                </div>
                <p style={{ color: "var(--text2)" }} className="text-xs mt-1">
                  عيار {t.karat} · {fmtW(t.weight)} جم · {t.goldSource === "purchased" ? `شراء من: ${officeName(t.officeId)}` : "من الكسر"}
                  {t.goldCost > 0 ? ` (${currency}${fmt(t.goldCost, 0)})` : ""}
                </p>
                <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                  أجور/مصنعية: {currency}
                  {fmt(t.workmanshipAmount, 0)} · دفع من: {sourceLabel(t)} · {new Date(t.date).toLocaleDateString("en-GB")}
                </p>
                {t.notes && (
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                    {t.notes}
                  </p>
                )}
                {(t.invoiceAttachId || t.invoiceFile) && (
                  <button
                    onClick={() => openAttachment(t.invoiceAttachId, t.invoiceFile)}
                    className="text-[11px] px-2 py-1 rounded-full flex items-center gap-1 mt-2 w-fit"
                    style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
                  >
                    <Paperclip size={11} /> عرض المستند
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { TaskiratPage };
