import React, { useState } from "react";
import { fmtW } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";

/**
 * يربط بطاقة RFID/باركود بقطعة (item_units) — يُفتح من ثلاث شاشات
 * (التكويد/الجرد/المبيعات) حين تظهر بطاقة غير معروفة أثناء المسح.
 *
 * ⚠ onBind هنا غير متزامن (async) بعكس المرجع: الربط يُكتب فعليًا على
 * الباك إند (item_units.epc)، فقد يفشل (بطاقة مربوطة بقطعة أخرى، خطأ
 * شبكة) — الزر يعرض حالة الحفظ ولا يُغلق النافذة إلا بعد نجاح فعلي.
 */
function BindEpcSheet({ epc, items, onCancel, onBind }) {
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(null); // unitId قيد الحفظ
  const [error, setError] = useState("");
  const rows = items.flatMap((it) => (it.units || [])
    .filter((u) => !u.sold && !u.epc)
    .map((u) => ({ it, u })))
    .filter(({ it, u }) => !q || `${it.description || ""} ${it.ref || ""} ${u.code}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 40);

  const bind = async (unitId, unitCode) => {
    setSaving(unitId);
    setError("");
    const ok = await onBind(unitId, unitCode);
    setSaving(null);
    if (!ok) setError("تعذّر الربط — قد تكون البطاقة مربوطة بقطعة أخرى");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,.6)" }}>
      <div style={{ background: "var(--panel)", borderRadius: "18px 18px 0 0", maxHeight: "78vh", overflow: "auto" }} className="px-4 pt-4 pb-6">
        <p style={{ color: "var(--accent)", margin: 0 }} className="text-[12px] font-bold">اربط البطاقة بقطعة</p>
        <p style={{ color: "var(--text3)", margin: "2px 0 8px", fontFamily: "monospace" }} className="text-[10px]">{epc}</p>
        <input style={inputStyle} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالوصف أو الكود" />
        {error && <p style={{ color: "var(--bad)", margin: "6px 0 0" }} className="text-[11px]">⚠ {error}</p>}
        <div className="flex flex-col gap-1 mt-2">
          {rows.map(({ it, u }) => (
            <button key={u.id} onClick={() => bind(u.id, u.code)} disabled={!!saving}
              className="w-full text-right p-2 rounded-xl"
              style={{ background: "var(--field)", border: "1px solid var(--line)", opacity: saving && saving !== u.id ? 0.5 : 1 }}>
              <span style={{ color: "var(--text)" }} className="text-[11px] font-bold">{it.description || it.ref}</span>
              <span style={{ color: "var(--text3)" }} className="text-[10px]"> · {u.code} · عيار {it.karat} · {fmtW(it.weight)} جم</span>
              {saving === u.id && <span style={{ color: "var(--accent)" }} className="text-[10px]"> — جارٍ الربط…</span>}
            </button>
          ))}
          {rows.length === 0 && <p style={{ color: "var(--text3)" }} className="text-[11px]">لا قطع بلا بطاقة</p>}
        </div>
        <button onClick={onCancel} disabled={!!saving} className="w-full py-2.5 rounded-xl text-[12px] mt-3"
          style={{ background: "var(--field)", color: "var(--text2)" }}>إلغاء</button>
      </div>
    </div>
  );
}

export { BindEpcSheet };
