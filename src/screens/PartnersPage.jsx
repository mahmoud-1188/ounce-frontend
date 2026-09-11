import React, { useState } from "react";
import { Plus, Users } from "lucide-react";
import { fmt, fmtW } from "../core/money.js";
import { AddPartnerForm } from "../ui/AddPartnerForm.jsx";
import { AddPartnerTxForm } from "../ui/AddPartnerTxForm.jsx";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Stat } from "../ui/Stat.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function PartnersPage({ partners, partnerTx, totals, currency, price24, onAddPartner, onAddTx, onBack }) {
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [txPartnerId, setTxPartnerId] = useState(null); // partner id currently getting a tx logged
  const [detailPartnerId, setDetailPartnerId] = useState(null);

  if (detailPartnerId) {
    const partner = partners.find((p) => p.id === detailPartnerId);
    const balance = totals.byPartner[detailPartnerId] || 0;
    const balanceGrams = totals.byPartnerGrams[detailPartnerId] || 0;
    const txs = partnerTx.filter((t) => t.partnerId === detailPartnerId);
    const typeLabel = { contribution: "مساهمة", withdrawal: "سحب", profit_share: "توزيع أرباح" };
    return (
      <div>
        <SubPageHeader title={partner?.name || "شريك"} onBack={() => setDetailPartnerId(null)} />
        <div className="px-4 pt-3">
          <Card style={{ padding: 16, marginBottom: 12 }}>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
              الرصيد الحالي (بعيار 24)
            </p>
            <p style={{ fontFamily: "'Cairo', sans-serif", color: balanceGrams >= 0 ? "var(--accent)" : "var(--bad)" }} className="text-2xl font-extrabold">
              {fmtW(balanceGrams)} جم
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
              يعادل تقريبًا {currency}
              {fmt(balance, 0)}
            </p>
            <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
              <span style={{ color: "var(--text2)" }} className="text-[11px]">
                نسبة الشراكة (محسوبة من رأس المال)
              </span>
              <span style={{ color: "var(--good)" }} className="text-sm font-bold">
                {fmt(totals.shareByPartner?.[detailPartnerId] || 0, 1)}٪
              </span>
            </div>
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
              رأس ماله {fmtW(totals.capitalByPartner?.[detailPartnerId] || 0)} جم من إجمالي {fmtW(totals.sumCapitalGrams || 0)} جم
            </p>
          </Card>
          <button
            onClick={() => setTxPartnerId(detailPartnerId)}
            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-4"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
          >
            <Plus size={18} /> تسجيل حركة
          </button>
          {txPartnerId === detailPartnerId && (
            <AddPartnerTxForm
              currency={currency}
              price24={price24}
              onCancel={() => setTxPartnerId(null)}
              onSubmit={(type, entry) => {
                onAddTx(detailPartnerId, type, entry);
                setTxPartnerId(null);
              }}
            />
          )}
          <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
            الحركات
          </p>
          {txs.length === 0 ? (
            <EmptyState icon={<Users size={36} color="var(--accentText)" />} title="لا توجد حركات" sub="سجّل أول مساهمة أو سحب لهذا الشريك" />
          ) : (
            <div className="flex flex-col gap-2">
              {txs.map((t) => (
                <Card key={t.id} style={{ padding: 12 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }} className="text-sm">
                      {typeLabel[t.type]}
                      <span style={{ color: "var(--text3)" }} className="text-[11px] mr-1">
                        {t.unit === "gram" ? "· ذهب" : "· نقدًا"}
                      </span>
                    </span>
                    <span style={{ color: t.type === "contribution" ? "var(--goodSolid)" : "var(--bad)" }} className="text-sm font-bold">
                      {t.type === "contribution" ? "+" : "-"}
                      {fmtW(t.weightGrams || 0)} جم
                    </span>
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                    {currency}
                    {fmt(t.amount, 0)} · {new Date(t.date).toLocaleDateString("en-GB")}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SubPageHeader title="حسابات الشركاء" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label="عدد الشركاء" value={partners.length} />
          <Stat label="إجمالي رأس المال (بعيار 24)" value={`${fmtW(totals.totalCapitalGrams)} جم`} />
        </div>
        {!showAddPartner ? (
          <button
            onClick={() => setShowAddPartner(true)}
            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-6"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
          >
            <Users size={18} /> إضافة شريك
          </button>
        ) : (
          <AddPartnerForm
            onCancel={() => setShowAddPartner(false)}
            onSubmit={(name, share, phone) => {
              onAddPartner(name, share, phone);
              setShowAddPartner(false);
            }}
          />
        )}

        {partners.length === 0 ? (
          <EmptyState icon={<Users size={36} color="var(--accentText)" />} title="لا يوجد شركاء بعد" sub="أضف الشركاء لتتبع مساهماتهم وسحوباتهم" />
        ) : (
          <div className="flex flex-col gap-2">
            {partners.map((p) => {
              const capital = totals.capitalByPartner?.[p.id] ?? (totals.byPartnerGrams[p.id] || 0);
              const share = totals.shareByPartner?.[p.id] || 0;
              return (
                <button key={p.id} onClick={() => setDetailPartnerId(p.id)} className="w-full text-right">
                  <Card style={{ padding: 12 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                        {p.name}
                        {p.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{p.ref}</span>}
                      </span>
                      <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                        {fmtW(capital)} جم
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span style={{ color: "var(--text2)" }} className="text-[11px]">
                        النسبة المحسوبة من رأس ماله
                      </span>
                      <span style={{ color: "var(--good)" }} className="text-xs font-bold">
                        {fmt(share, 1)}٪
                      </span>
                    </div>
                    <div className="mt-1" style={{ height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, share)}%`, height: "100%", background: "var(--goodSolid)" }} />
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export { PartnersPage };
