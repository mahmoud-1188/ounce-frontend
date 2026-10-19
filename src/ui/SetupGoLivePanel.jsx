import React, { useState } from "react";
import { CheckCircle2, Circle, Rocket } from "lucide-react";
import { Card } from "./Card.jsx";

/// فترة التجهيز: ثلاث خطوات بالترتيب ثم «بدء التشغيل» — في الفرع المرتبط تعتمده الإدارة
/// setup: { ledgerState, codedPieces, noOldStock, openingSaved, linked, request }
function SetupGoLivePanel({ setup, canStart = false, onOpenCoding, onOpenOpening, onGoLive, onExit = null }) {
  const [busy, setBusy] = useState(false);
  if (!setup || setup.ledgerState !== "setup") return null;
  const coded = setup.codedPieces > 0 || setup.noOldStock;
  const pending = setup.request?.status === "pending";
  const approved = setup.request?.status === "approved";
  const steps = [
    { id: "code", done: coded, label: "كوّد بضاعة المحل القديمة", hint: setup.codedPieces > 0 ? `كُوِّدت ${setup.codedPieces} قطعة` : setup.noOldStock ? "محلٌّ جديد بلا بضاعة قديمة" : "أو علّم «لا بضاعة قديمة» في الرصيد الافتتاحي", go: onOpenCoding },
    { id: "opening", done: setup.openingSaved, label: "أدخل الرصيد الافتتاحي واحفظه", hint: setup.openingSaved ? "محفوظ" : "بعد التكويد", go: onOpenOpening },
    { id: "golive", done: false, label: setup.linked ? "اطلب بدء التشغيل من الإدارة" : "ابدأ التشغيل", hint: pending ? `الطلب ${setup.request.ref} عند الإدارة` : approved ? "اعتمدته الإدارة — اضغط لبدء التشغيل" : setup.linked ? "الإدارة تعتمد السنة المالية والرصيد الافتتاحي" : "" },
  ];
  const ready = coded && setup.openingSaved;
  const start = async () => { setBusy(true); try { await onGoLive?.(); } finally { setBusy(false); } };
  return (
    <Card style={{ padding: 14, margin: "12px 16px", border: "1px solid var(--accentLine)" }} data-setup-panel>
      <p style={{ color: "var(--accent)", margin: 0 }} className="text-sm font-bold flex items-center gap-1.5"><Rocket size={15} /> فترة التجهيز</p>
      <p style={{ color: "var(--text2)", margin: "4px 0 10px" }} className="text-[11px] leading-5">
        لا بيعَ ولا يومَ ولا نقدَ ولا قيدَ قبل «بدء التشغيل» — التكويد والجرد والإعدادات تعمل.
      </p>
      {steps.map((s, i) => (
        <button key={s.id} type="button" data-golive-step={s.id} data-done={s.done ? "1" : "0"} onClick={s.go || undefined} disabled={!s.go}
          className="w-full text-right flex items-start gap-2 py-1.5">
          {s.done ? <CheckCircle2 size={16} color="var(--good)" style={{ flexShrink: 0, marginTop: 1 }} /> : <Circle size={16} color="var(--text3)" style={{ flexShrink: 0, marginTop: 1 }} />}
          <span className="min-w-0">
            <span style={{ color: s.done ? "var(--text2)" : "var(--text)" }} className="text-[12px] font-bold block">{i + 1}. {s.label}</span>
            {s.hint && <span style={{ color: "var(--text3)" }} className="text-[11px] block">{s.hint}</span>}
          </span>
        </button>
      ))}
      {canStart && (
        <button type="button" data-golive onClick={start} disabled={busy || !ready || pending}
          className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold"
          style={{ background: ready && !pending ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--panel)", color: ready && !pending ? "var(--panel)" : "var(--text3)", border: "1px solid var(--line)" }}>
          {busy ? "…" : pending ? "الطلب عند الإدارة" : approved || !setup.linked ? "ابدأ التشغيل" : "اطلب بدء التشغيل من الإدارة"}
        </button>
      )}
      {onExit && (
        <button type="button" data-setup-exit-open onClick={onExit} className="w-full mt-2 py-2 rounded-xl text-xs font-bold"
          data-help="في فترة التجهيز: يُخرج قطعًا بيعت من البضاعة القديمة من المخزون بلا فاتورةٍ ولا قيد — ولا تدخل الرصيد الافتتاحي"
          style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
          بيعٌ بلا سعر — إخراج قطعٍ من النظام{setup.exited?.pieces ? ` (${setup.exited.pieces})` : ""}
        </button>
      )}
      {pending && <p data-golive-pending style={{ color: "var(--accentText)", margin: "6px 0 0" }} className="text-[11px]">يصل الإدارة في ورادها — وحين تعتمده يبدأ التشغيل بضغطة.</p>}
    </Card>
  );
}

export { SetupGoLivePanel };
