import React from "react";
import { ModalShell } from "./ModalShell.jsx";

/// ورقة شرح الزرّ: ما يفعله وكيف يُستخدم — تفتح من «؟» أو الضغط المطوّل أو F1 ولا تنفّذ الزرّ
function ButtonHelpSheet({ topic, onClose, onBadges = null }) {
  if (!topic) return null;
  const head = (t) => <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-xs font-bold">{t}</p>;
  return (
    <div data-no-help="" style={{ position: "relative", zIndex: 9999 }}>
      <ModalShell title={`؟ ${topic.label}`} onClose={onClose}>
        <div data-help-sheet={topic.key || ""} data-help-source={topic.source || undefined} className="flex flex-col gap-3 pb-1">
          <section>{head("ما هذا الزرّ؟")}<p data-help-what style={{ color: "var(--text)", margin: 0 }} className="text-sm leading-7">{topic.what}</p></section>
          <section>{head("كيف تستخدمه؟")}<p data-help-how style={{ color: "var(--text)", margin: 0 }} className="text-sm leading-7">{topic.how}</p></section>
          {topic.dialog && <p style={{ color: "var(--text2)", margin: 0 }} className="text-[12px] leading-6">في نافذة: {topic.dialog}</p>}
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-6">«؟» في زاوية كل زرٍّ تشرحه ولا تنفّذه — وكذلك الضغط المطوّل على الزرّ، أو F1 على الحاسب.</p>
          {onBadges && (
            <button type="button" onClick={onBadges} data-help-badges-setting className="w-full py-2.5 rounded-xl text-xs font-bold"
              style={{ minHeight: 44, background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
              إطفاء علامات «؟» على الأزرار
            </button>
          )}
        </div>
      </ModalShell>
    </div>
  );
}

export { ButtonHelpSheet };
