import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { fmt, fmtW } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function SafeAuditPage({ audits, safeBalance, currency, canManage, onSave, onBack }) {
  const [cash, setCash] = useState("");
  const [network, setNetwork] = useState("");
  const [gold, setGold] = useState({});
  const [note, setNote] = useState("");
  const [showForm, setShowForm] = useState(false);
  // ⚠ إصلاح حقيقي: onSave صار غير متزامن (ينادي الباك إند الذي يحسب
  // الفروق فعليًا من قاعدة البيانات). كانت الشاشة تُغلق نموذج الجرد فورًا
  // بصرف النظر عن النتيجة — نفس نمط الخلل المُصلَح سابقًا في مودال البيع
  // الجزئي، هنا في تسجيل جرد الخزنة تحديدًا.
  const [submitting, setSubmitting] = useState(false);

  const karats = Object.keys(safeBalance.byKarat || {}).sort((a, b) => Number(b) - Number(a));
  const touched = cash !== "" || network !== "" || Object.values(gold).some((v) => v !== "");
  const varCash = (Number(cash) || 0) - safeBalance.cash;
  const varNet = (Number(network) || 0) - safeBalance.network;
  const totalVar = varCash + varNet;

  return (
    <div>
      <SubPageHeader title="جرد الخزنة" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
          الخزنة أكبر مخزن قيمة في المحل. اعدّ ما بداخلها فعليًا وقارنه بالمسجَّل — الفرق يُقيَّد تسوية فيبقى الدفتر مطابقًا للواقع.
        </p>

        <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
            المسجَّل حاليًا
          </p>
          {[
            ["نقدي", `${currency}${fmt(safeBalance.cash, 0)}`],
            ["شبكة", `${currency}${fmt(safeBalance.network, 0)}`],
            ["ذهب بعيار 24", `${fmtW(safeBalance.fineWeight)} جم`],
          ].map(([l, v], i) => (
            <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
              <span style={{ color: "var(--text2)" }} className="text-xs">{l}</span>
              <span style={{ color: "var(--text)" }} className="text-xs font-bold">{v}</span>
            </div>
          ))}
        </Card>

        {canManage &&
          (!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-4"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
            >
              <ShieldCheck size={17} /> بدء جرد جديد
            </button>
          ) : (
            <Card style={{ padding: 14, marginBottom: 16 }}>
              <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">النقد المعدود</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`نقدي (${currency})`}>
                  <NumericInput value={cash} onChange={setCash} />
                </Field>
                <Field label={`شبكة (${currency})`}>
                  <NumericInput value={network} onChange={setNetwork} />
                </Field>
              </div>

              {karats.length > 0 && (
                <>
                  <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">الذهب المعدود (جم لكل عيار)</p>
                  {karats.map((k) => (
                    <Field key={k} label={`عيار ${k} — المسجَّل ${fmtW(safeBalance.byKarat[k].total)} جم`}>
                      <NumericInput value={gold[k] ?? ""} onChange={(v) => setGold((p) => ({ ...p, [k]: v }))} />
                    </Field>
                  ))}
                </>
              )}

              {touched && (
                <Card style={{ padding: 10, marginBottom: 10, background: "var(--bg)" }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">فرق النقد</span>
                    <span
                      style={{ color: Math.abs(totalVar) < 0.01 ? "var(--goodSolid)" : totalVar > 0 ? "var(--accent)" : "var(--bad)" }}
                      className="text-sm font-bold"
                    >
                      {Math.abs(totalVar) < 0.01 ? "مطابق" : `${totalVar > 0 ? "زيادة" : "عجز"} ${currency}${fmt(Math.abs(totalVar), 0)}`}
                    </span>
                  </div>
                </Card>
              )}

              <Field label="ملاحظة (اختياري)">
                <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowForm(false)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                  إلغاء
                </button>
                <button
                  disabled={!touched || submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      const res = await onSave(cash, network, gold, note);
                      if (res) {
                        setCash(""); setNetwork(""); setGold({}); setNote(""); setShowForm(false);
                      }
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="py-2 rounded-xl text-xs font-bold"
                  style={{ background: touched ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: touched ? "var(--panel)" : "var(--text3)" }}
                >
                  {submitting ? "جارٍ التنفيذ..." : "تأكيد الجرد"}
                </button>
              </div>
            </Card>
          ))}

        <p style={{ color: "var(--text2)" }} className="text-xs mb-2">سجل الجرود ({audits.length})</p>
        {audits.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={32} color="var(--accentText)" />} title="لا جرود بعد" sub="ابدأ أول جرد للخزنة" />
        ) : (
          <div className="flex flex-col gap-2">
            {audits.map((a) => {
              const v = (a.varianceCash || 0) + (a.varianceNetwork || 0);
              const goldVar = (a.gold || []).filter((g) => Math.abs(g.variance) > 0.0005);
              return (
                <Card key={a.id} style={{ padding: 12 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                      {a.ref}
                      <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">
                        {new Date(a.date).toLocaleString("en-GB")}
                      </span>
                    </span>
                    <span style={{ color: Math.abs(v) < 0.01 && goldVar.length === 0 ? "var(--goodSolid)" : "var(--bad)" }} className="text-xs font-bold">
                      {Math.abs(v) < 0.01 && goldVar.length === 0 ? "مطابق" : `${v > 0 ? "زيادة" : "عجز"} ${currency}${fmt(Math.abs(v), 0)}`}
                    </span>
                  </div>
                  {goldVar.map((g, i) => (
                    <p key={i} style={{ color: "var(--bad)" }} className="text-[11px] mt-0.5">
                      عيار {g.karat}: {g.variance > 0 ? "زيادة" : "نقص"} {fmtW(Math.abs(g.variance))} جم
                    </p>
                  ))}
                  <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                    {a.createdBy}{a.note ? ` · ${a.note}` : ""}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// الحجوزات والعربون — البضاعة عندك والمبلغ التزام حتى التسليم
// ============================================================

export { SafeAuditPage };
