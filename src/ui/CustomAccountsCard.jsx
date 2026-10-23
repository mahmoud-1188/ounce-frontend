import React, { useState } from "react";
import { Card } from "./Card.jsx";
import { inputStyle } from "../domain/helpers.js";

/// حسابات المصروف المخصّصة للمتجر: المدير يضيف حسابًا باسمه فيُقيَّد عليه المصروف ويظهر باسمه في الدفاتر،
/// ويُخفيه من الاختيار دون حذفه (عليه قيود). الإدارة تمنع الفعل من سياستها («حسابات المصروف المخصّصة»).
function CustomAccountsCard({ accounts = [], onAdd, onSetHidden }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length >= 2;
  const add = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const ok = await onAdd(name.trim());
    setBusy(false);
    if (ok) setName("");
  };
  return (
    <Card style={{ padding: 12, marginBottom: 12 }} data-custom-accounts>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between text-xs font-bold" style={{ color: "var(--text)" }}
        data-help="حسابات مصروفٍ بأسماء تختارها تحت المصروفات — تظهر في نموذج المصروف وفي اليومية والأستاذ وكشف الحساب باسمها.">
        <span>حسابات المصروف المخصّصة ({accounts.filter((a) => !a.hidden).length})</span>
        <span style={{ color: "var(--text3)" }}>{open ? "إخفاء" : "إدارة"}</span>
      </button>
      {open && (
        <div className="mt-2">
          <div className="flex gap-2 mb-2">
            <input style={{ ...inputStyle, flex: 1 }} value={name} maxLength={60} onChange={(e) => setName(e.target.value)}
              placeholder="اسم الحساب — مثل: اشتراك النظام السحابي" aria-label="اسم حساب المصروف"
              onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
            <button type="button" onClick={add} disabled={busy || !valid} className="px-3 rounded-xl text-xs font-bold"
              style={{ minHeight: 40, background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)", opacity: busy || !valid ? 0.5 : 1 }}>أضف</button>
          </div>
          {!accounts.length && <p style={{ color: "var(--text3)" }} className="text-[11px]">لا حسابات مخصّصة بعد</p>}
          {accounts.map((a) => (
            <div key={a.code} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--line)", opacity: a.hidden ? 0.55 : 1 }}>
              <span style={{ color: "var(--text)" }} className="text-xs">{a.name} <span style={{ color: "var(--text3)" }} className="text-[10px]">({a.code})</span></span>
              <button type="button" onClick={() => onSetHidden(a.code, !a.hidden)} className="text-[11px] px-2 rounded-lg"
                style={{ minHeight: 30, color: "var(--accentText)", background: "var(--panel)", border: "1px solid var(--line)" }}>{a.hidden ? "إظهار" : "إخفاء"}</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export { CustomAccountsCard };
