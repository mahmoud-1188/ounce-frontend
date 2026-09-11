import React, { useState } from "react";
import { Check, Printer } from "lucide-react";
import { itemLabel } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { Field } from "./Field.jsx";
import { LabelTag } from "./LabelTag.jsx";
import { SubPageHeader } from "./SubPageHeader.jsx";

function PrintAfterEntry({ newItems, supplierLabel, onSetPrinted, onDone, onExit }) {
  const [mode, setMode] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [printedCodes, setPrintedCodes] = useState(() => new Set());

  // كل وحدة سطر مستقل: الرقاقة تُلصق على القطعة الواحدة لا على الصنف.
  const allUnits = newItems.flatMap((it) =>
    it.units.map((u) => ({ itemId: it.id, code: u.code, item: it }))
  );

  const toPrint =
    mode === "all" ? allUnits : allUnits.filter((u) => selected.has(u.code));

  const toggle = (code) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
  };

  const doPrint = (units) => {
    if (!units.length) return;
    // تُجمَّع الأكواد حسب الصنف ثم تُرسل دفعة واحدة لكل صنف. الإرسال كودًا
    // كودًا كان سيقرأ الحالة نفسها مرارًا فيطمس التحديث السابق.
    const byItem = {};
    units.forEach((u) => (byItem[u.itemId] ??= []).push(u.code));
    Object.entries(byItem).forEach(([itemId, codes]) => onSetPrinted(itemId, codes, true));
    setPrintedCodes((prev) => new Set([...prev, ...units.map((u) => u.code)]));
    // تأخير بسيط ليلتقط المتصفح تحديث الحالة قبل فتح نافذة الطباعة.
    setTimeout(() => window.print(), 80);
  };

  const remaining = allUnits.filter((u) => !printedCodes.has(u.code)).length;

  return (
    <div>
      <SubPageHeader title="طباعة الرقاقات" onBack={onExit} />
      <div className="px-4 pt-3 no-print">
        <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--good)" }} className="text-sm font-bold flex items-center gap-1.5">
            <Check size={15} /> تم إدخال {newItems.length} صنف · {allUnits.length} قطعة
          </p>
          {supplierLabel && (
            <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
              المورد: {supplierLabel}
            </p>
          )}
          <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
            {remaining === 0 ? "طُبعت كل الرقاقات" : `بقي ${remaining} رقاقة بلا طباعة`}
          </p>
        </Card>

        <Field label="طريقة الطباعة">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "all", label: "الكل" },
              { id: "single", label: "فردي" },
              { id: "select", label: "حسب الاختيار" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  setSelected(new Set());
                }}
                className="py-2 rounded-xl text-xs font-bold"
                style={{
                  background: mode === m.id ? "var(--accentBg)" : "var(--panel)",
                  color: mode === m.id ? "var(--accent)" : "var(--text2)",
                  border: "1px solid var(--line)",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Field>

        {mode === "all" && (
          <button
            onClick={() => doPrint(allUnits)}
            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-4"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
          >
            <Printer size={17} /> طباعة كل الرقاقات ({allUnits.length})
          </button>
        )}

        {mode === "select" && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: "var(--text2)" }} className="text-xs">
                محدَّد: {selected.size} من {allUnits.length}
              </span>
              <button
                onClick={() =>
                  setSelected(selected.size === allUnits.length ? new Set() : new Set(allUnits.map((u) => u.code)))
                }
                className="text-[11px] px-2 py-1 rounded-full"
                style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
              >
                {selected.size === allUnits.length ? "إلغاء الكل" : "تحديد الكل"}
              </button>
            </div>
            <button
              disabled={selected.size === 0}
              onClick={() => doPrint(toPrint)}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-4"
              style={{
                background: selected.size ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                color: selected.size ? "var(--panel)" : "var(--text3)",
              }}
            >
              <Printer size={17} /> طباعة المحدَّد ({selected.size})
            </button>
          </>
        )}

        <div className="flex flex-col gap-2 mb-4">
          {allUnits.map((u) => {
            const done = printedCodes.has(u.code);
            const isSel = selected.has(u.code);
            return (
              <Card
                key={u.code}
                style={{ padding: 10, border: isSel ? "1px solid var(--accentLine)" : "1px solid var(--line)" }}
              >
                <div className="flex items-center gap-3">
                  {mode === "select" && (
                    <button
                      onClick={() => toggle(u.code)}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        background: isSel ? "var(--accent)" : "transparent",
                        border: `1px solid ${isSel ? "var(--accent)" : "var(--accentLine)"}`,
                        flexShrink: 0,
                      }}
                    >
                      {isSel && <Check size={13} color="var(--panel)" />}
                    </button>
                  )}
                  <div className="flex-1">
                    <p style={{ color: "var(--text)" }} className="text-xs font-bold">
                      {itemLabel(u.item)}
                    </p>
                    <p style={{ color: "var(--text3)", fontFamily: "monospace" }} className="text-[10px]">
                      {u.code}
                    </p>
                  </div>
                  {done ? (
                    <span style={{ color: "var(--good)" }} className="text-[10px] flex items-center gap-1">
                      <Check size={11} /> طُبعت
                    </span>
                  ) : mode === "single" ? (
                    <button
                      onClick={() => doPrint([u])}
                      className="text-[11px] px-3 py-1.5 rounded-full flex items-center gap-1"
                      style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
                    >
                      <Printer size={11} /> طباعة
                    </button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>

        <button
          onClick={onExit}
          className="w-full py-2.5 rounded-xl text-xs font-bold mb-2"
          style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
        >
          {remaining === 0 ? "إنهاء" : "إنهاء بدون طباعة الباقي"}
        </button>
        <button
          onClick={onDone}
          className="w-full py-2.5 rounded-xl text-xs font-bold"
          style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
        >
          إدخال دفعة أخرى
        </button>
      </div>

      {/* منطقة الطباعة الفعلية */}
      <div className="print-area">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3mm", padding: "5mm", direction: "rtl" }}>
          {toPrint.map((u) => (
            <LabelTag key={u.code} item={u.item} code={u.code} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// يوم العمل — شاشة واحدة تفتح عليها صباحًا وتُغلق منها مساءً
// ============================================================

export { PrintAfterEntry };
