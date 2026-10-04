import React from "react";
import { Send } from "lucide-react";
import { fmtMoney } from "../core/money.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// طال انتظاره: معلّقٌ عند الإدارة أكثر من يوم — راجعها قبل أن تنتهي مهلته (72 ساعة)
const LATE_HOURS = 24;

/// حالة الطلب كما يراها الفرع: بانتظار · طال انتظاره · اعتُمد (ينتظر التنفيذ) · تم · رُفض · أُلغي · انتهت مهلته
function hqRequestState(a, now = Date.now()) {
  if (a.status === "pending") {
    const h = (now - Date.parse(a.requestedAt || 0)) / 3600000;
    return h > LATE_HOURS ? { id: "late", label: "طال انتظاره — راجع الإدارة", tone: "var(--bad)" } : { id: "waiting", label: "بانتظار الإدارة", tone: "var(--accent)" };
  }
  if (a.status === "approved") return { id: "approved", label: "اعتُمد — نفّذه من «الاعتمادات»", tone: "var(--accent)" };
  if (a.status === "executed") return { id: "done", label: "تم", tone: "var(--good)" };
  if (a.status === "rejected") return { id: "rejected", label: "رُفض", tone: "var(--bad)" };
  if (a.status === "expired") return { id: "expired", label: "انتهت مهلته دون قرار — أعد الطلب", tone: "var(--text3)" };
  return { id: "cancelled", label: "أُلغي — لم يُنفَّذ", tone: "var(--text3)" };
}

/// «طلباتي للإدارة»: كل ما رُفع من الفرع لتعتمده الإدارة، بحالته — ما ينتظر أوّلًا
function HqRequestsPage({ approvals = [], currency = "ر.س", meId = null, canManage = false, onCancel, onOpenApprovals, onBack }) {
  const rows = approvals.filter((a) => a.approverKind === "hq")
    .map((a) => ({ a, st: hqRequestState(a) }))
    .sort((x, y) => {
      const rank = (s) => (s.id === "late" ? 0 : s.id === "waiting" ? 1 : s.id === "approved" ? 2 : 3);
      return rank(x.st) - rank(y.st) || String(y.a.requestedAt || "").localeCompare(String(x.a.requestedAt || ""));
    });
  const count = (id) => rows.filter((r) => r.st.id === id).length;
  return (
    <div>
      <SubPageHeader title="طلباتي للإدارة" onBack={onBack} />
      <div className="px-4 pt-3 pb-6">
        <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
          كل ما رفعه الفرع لتعتمده الإدارة وحالته. المعلّق أكثر من يوم «طال انتظاره» — راجع الإدارة قبل أن تنتهي مهلته.
        </p>
        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[["بانتظار", count("waiting") + count("late"), "var(--accent)"], ["طال انتظاره", count("late"), "var(--bad)"], ["تم", count("done"), "var(--good)"]].map(([l, n, c]) => (
              <Card key={l} style={{ padding: 10, textAlign: "center" }}>
                <p style={{ color: c, fontFamily: "'Cairo', sans-serif" }} className="text-xl font-extrabold">{n}</p>
                <p style={{ color: "var(--text3)" }} className="text-[11px]">{l}</p>
              </Card>
            ))}
          </div>
        )}
        {rows.length === 0 ? (
          <EmptyState icon={<Send size={36} color="var(--accentText)" />} title="لا طلبات للإدارة"
            sub="ما تجعله الإدارة لها من الاعتمادات (من «الاعتمادات» ← من يعتمد ماذا) يظهر هنا بحالته." />
        ) : (
          <div className="flex flex-col gap-2" data-hq-requests>
            {rows.map(({ a, st }) => (
              <Card key={a.id} style={{ padding: 12, border: st.id === "late" ? "1px solid var(--badLine)" : "1px solid var(--line)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span style={{ color: "var(--text)" }} className="text-[13px] font-bold truncate">{a.kindLabel || a.kind}</span>
                  <span style={{ color: st.tone }} className="text-[11px] font-bold shrink-0">{st.label}</span>
                </div>
                <p style={{ color: "var(--text2)" }} className="text-[11px] mt-0.5">
                  {a.ref} · {fmtMoney(a.amount || 0)} {currency} · طلبه {a.requester || "—"} · {a.requestedAt ? new Date(a.requestedAt).toLocaleString("en-GB") : ""}
                </p>
                {a.note && <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">{a.note}</p>}
                {a.decidedAt && (
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">قرار {a.approver || "الإدارة"} · {new Date(a.decidedAt).toLocaleString("en-GB")}</p>
                )}
                {(st.id === "waiting" || st.id === "late") && onCancel && (a.requesterId === meId || canManage) && (
                  <button onClick={() => onCancel(a)} className="mt-2 px-3 py-1.5 rounded-xl text-[11px] font-bold"
                    style={{ color: "var(--text2)", border: "1px solid var(--line)" }}>ألغِ الطلب</button>
                )}
                {st.id === "approved" && onOpenApprovals && (
                  <button onClick={onOpenApprovals} className="mt-2 px-3 py-1.5 rounded-xl text-[11px] font-bold"
                    style={{ color: "var(--accent)", border: "1px solid var(--accentLine)" }}>افتح الاعتمادات</button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { HqRequestsPage, hqRequestState };
