import React from "react";
import { Banknote } from "lucide-react";
import { fmtMoney } from "../core/money.js";
import { Card } from "./Card.jsx";

/// الإدارة تطلب سحبًا من رأس مال الفرع: المدير يوافق فيخرج النقد من الخزنة إلى الإدارة، أو يرفض بسببه
function HqDrawsBanner({ draws = [], currency = "ر.س", onDecide }) {
  return (
    <div className="px-4 pt-3" data-hq-draws>
      {draws.map((t) => (
        <Card key={t.id} style={{ padding: 12, marginBottom: 8, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--accent)", margin: 0 }} className="text-[13px] font-bold flex items-center gap-1.5">
            <Banknote size={15} /> الإدارة تطلب سحب {fmtMoney(Number(t.amount) || 0)} {currency} من رأس مال الفرع
          </p>
          <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[11px]">
            يخرج المبلغ من نقد الخزنة إلى خزنة الإدارة بقيدٍ على الطرفين{t.note ? ` · ${t.note}` : ""}
            {t.createdAt ? ` · ${new Date(t.createdAt).toLocaleDateString("en-GB")}` : ""}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button type="button" data-hq-draw-approve={t.id} onClick={() => onDecide(t, true)} className="rounded-xl text-[12px] font-bold"
              style={{ minHeight: 44, background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>موافقة — أخرج المبلغ</button>
            <button type="button" data-hq-draw-reject={t.id} onClick={() => onDecide(t, false)} className="rounded-xl text-[12px] font-bold"
              style={{ minHeight: 44, background: "var(--panel)", color: "var(--bad)", border: "1px solid var(--line)" }}>رفض</button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export { HqDrawsBanner };
