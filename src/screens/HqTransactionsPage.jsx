import React, { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Plus, X } from "lucide-react";
import { fmtMoney, fmtW } from "../core/money.js";
import * as api from "../core/api.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 12, background: "var(--field)", border: "1px solid var(--line)", color: "var(--text)" };

/**
 * "معاملات الإدارة" (hqDocs) — نظير HqTransactionsPage.js في المرجع
 * بالمعنى لا بالتنفيذ: المرجع رموزٌ موقَّعة تُلصق يدويًّا بين نسخٍ
 * منفصلة (راجع تعليق migration 027_hq_transactions.sql في الباك إند)،
 * وهذه شاشة API حيّة كاملة — الفرع يطلب، يرى قرار الإدارة، ويستلم.
 *
 * ⚠ الفرع يبدأ خمسة أنواع فقط (لا goods_from_hq — تلك تبدؤها الإدارة
 * حصرًا وتظهر هنا فور إنشائها لتُستلَم). القوائم أدناه للعرض فقط؛
 * الفحص الحقيقي في hqTransactions.routes.js/hqTransactions.js بالباك
 * إند دائمًا.
 */
const BRANCH_INITIATED_FLOWS = {
  purchase_request: { label: "طلب شراء", needs: ["weight", "karat"] },
  goods_to_hq: { label: "تسليم بضاعة للإدارة", needs: ["weight", "karat", "pieces"] },
  send_for_coding: { label: "إرسال للتكويد في الإدارة", needs: ["weight", "karat", "pieces"] },
  taskir_to_hq: { label: "تسكير عبر الإدارة", needs: ["weight", "karat"] },
  cash_transfer: { label: "تحويل نقدي للإدارة", needs: ["amount"] },
};

// نفس RECEIVER_SIDE في الباك إند (hqTransactions.js) — للعرض فقط، لا
// فحصًا أمنيًّا (الخادم يرفض أي استلام لا يخصّ الفرع بغضّ النظر عمّا
// تعرضه هذه الشاشة).
const BRANCH_RECEIVES = new Set(["goods_from_hq", "send_for_coding"]);

const STATUS_LABEL = {
  pending: { label: "بانتظار الإدارة", color: "var(--accent)" },
  approved: { label: "معتمد — بانتظار الاستلام", color: "var(--good)" },
  rejected: { label: "مرفوض", color: "var(--bad)" },
  received: { label: "منفَّذ", color: "var(--text2)" },
};

function HqTransactionsPage({ currency = "ر.س", onBack, flashToast }) {
  const [txns, setTxns] = useState(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError("");
    try {
      const rows = await api.hqTransactionsApi.list();
      setTxns(rows);
    } catch {
      setError("تعذّر تحميل معاملات الإدارة");
    }
  }

  useEffect(() => { load(); }, []);

  async function handleReceive(id) {
    setBusyId(id);
    try {
      await api.hqTransactionsApi.receive(id);
      flashToast?.("تم تسجيل الاستلام");
      await load();
    } catch (err) {
      flashToast?.(receiveErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <SubPageHeader title="معاملات الإدارة" onBack={onBack} />
      <div className="px-4 pt-3 pb-2 flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full"
          style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
        >
          <Plus size={15} /> طلب جديد
        </button>
      </div>

      <div className="px-4 pb-6 space-y-2.5">
        {error && (
          <p style={{ color: "var(--bad)" }} className="text-xs">{error}</p>
        )}

        {txns === null && !error ? (
          <p style={{ color: "var(--text3)" }} className="text-xs text-center py-8">جارِ التحميل…</p>
        ) : txns?.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={40} style={{ color: "var(--text3)" }} />}
            title="لا معاملات بعد"
            sub="أي طلبٍ أو تحويل بينك وبين الإدارة يظهر هنا"
          />
        ) : (
          txns?.map((t) => (
            <Card key={t.id} style={{ padding: 12 }}>
              <div className="flex items-baseline justify-between gap-2">
                <span style={{ color: "var(--text)" }} className="text-[13px] font-bold">{t.flowLabel}</span>
                <span style={{ color: STATUS_LABEL[t.status]?.color || "var(--text3)" }} className="text-[11px] font-bold shrink-0">
                  {STATUS_LABEL[t.status]?.label || t.status}
                </span>
              </div>
              <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1 leading-6">
                {t.weight ? `${fmtW(t.weight)} جم عيار ${t.karat}` : ""}
                {t.pieces ? ` · ${t.pieces} قطعة` : ""}
                {t.amount ? `${t.weight ? " · " : ""}${currency}${fmtMoney(t.amount)}` : ""}
              </p>
              {t.note && (
                <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">{t.note}</p>
              )}
              {t.status === "rejected" && t.decisionNote && (
                <p style={{ color: "var(--bad)" }} className="text-[11px] mt-1">سبب الرفض: {t.decisionNote}</p>
              )}
              {BRANCH_RECEIVES.has(t.flow) && (t.status === "approved" || (t.flow === "goods_from_hq" && t.status === "pending")) && (
                <button
                  onClick={() => handleReceive(t.id)}
                  disabled={busyId === t.id}
                  className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold"
                  style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}
                >
                  <CheckCircle2 size={14} /> {busyId === t.id ? "جارِ التسجيل…" : "تأكيد الاستلام"}
                </button>
              )}
            </Card>
          ))
        )}
      </div>

      {showCreate && (
        <CreateTransactionModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

function receiveErrorMessage(err) {
  switch (err?.body?.error) {
    case "not_approved_yet": return "لم تعتمد الإدارة هذا الطلب بعد";
    case "not_branch_receivable": return "هذا النوع لا يُستلم من الفرع";
    default: return "تعذّر تسجيل الاستلام";
  }
}

function CreateTransactionModal({ onClose, onCreated }) {
  const [flow, setFlow] = useState("purchase_request");
  const [weight, setWeight] = useState("");
  const [karat, setKarat] = useState("21");
  const [pieces, setPieces] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const needs = BRANCH_INITIATED_FLOWS[flow].needs;

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.hqTransactionsApi.create({
        flow,
        weight: needs.includes("weight") ? Number(weight) : undefined,
        karat: needs.includes("karat") ? Number(karat) : undefined,
        pieces: needs.includes("pieces") ? Number(pieces) : undefined,
        amount: needs.includes("amount") ? Number(amount) : undefined,
        note,
      });
      onCreated();
    } catch (err) {
      setError(createErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,.5)" }}>
      <form onSubmit={submit} className="w-full max-w-md rounded-t-2xl p-5 space-y-1" style={{ background: "var(--panel)" }}>
        <div className="flex items-center justify-between mb-2">
          <h3 style={{ color: "var(--text)" }} className="font-bold">طلب جديد للإدارة</h3>
          <button type="button" onClick={onClose} style={{ color: "var(--text3)" }}><X size={18} /></button>
        </div>

        <Field label="نوع الطلب">
          <select style={fieldStyle} value={flow} onChange={(e) => setFlow(e.target.value)}>
            {Object.entries(BRANCH_INITIATED_FLOWS).map(([id, f]) => (
              <option key={id} value={id}>{f.label}</option>
            ))}
          </select>
        </Field>

        {needs.includes("weight") && (
          <Field label="الوزن (جم)">
            <input style={fieldStyle} type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
        )}
        {needs.includes("karat") && (
          <Field label="العيار">
            <select style={fieldStyle} value={karat} onChange={(e) => setKarat(e.target.value)}>
              {[24, 22, 21, 18, 14].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
        )}
        {needs.includes("pieces") && (
          <Field label="عدد القطع">
            <input style={fieldStyle} type="number" value={pieces} onChange={(e) => setPieces(e.target.value)} />
          </Field>
        )}
        {needs.includes("amount") && (
          <Field label="المبلغ">
            <input style={fieldStyle} type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        )}
        <Field label="ملاحظة (اختياري)">
          <input style={fieldStyle} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {error && <p style={{ color: "var(--bad)" }} className="text-xs">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-xl text-[13px] font-bold mt-2"
          style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)", opacity: busy ? 0.7 : 1 }}
        >
          {busy ? "جارِ الإرسال…" : "إرسال للإدارة"}
        </button>
      </form>
    </div>
  );
}

function createErrorMessage(err) {
  const field = err?.body?.fieldLabel;
  if (err?.body?.error === "missing_field" && field) return `أدخل ${field}`;
  return "تعذّر إرسال الطلب";
}

export { HqTransactionsPage };
