import React, { useEffect, useState } from "react";
import { Barcode, Check, Printer, RadioTower, RefreshCw, Search, X } from "lucide-react";
import { fmtW } from "../core/money.js";
import { categoryLabel, itemLabel } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Hallmark } from "../ui/Hallmark.jsx";
import { PseudoBarcode } from "../ui/PseudoBarcode.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function PrintingPage({ activeItems, onSetPrinted, onReplaceCode, onBack }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // 'all' | 'unprinted'
  const [selected, setSelected] = useState(new Set());
  const [printQueue, setPrintQueue] = useState(null); // codes actually sent to the printer

  const q = query.trim().toLowerCase();
  const visibleItems = activeItems
    .map((it) => {
      let units = it.units || [];
      if (filter === "unprinted") units = units.filter((u) => !u.printed);
      if (q) units = units.filter((u) => u.code.toLowerCase().includes(q) || categoryLabel(it.categoryId).includes(query.trim()));
      return { it, units };
    })
    .filter(({ units }) => units.length > 0);

  const allVisibleCodes = visibleItems.flatMap(({ units }) => units.map((u) => u.code));

  const toggle = (code) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };
  const toggleItemAll = (units) => {
    const codes = units.map((u) => u.code);
    const allSelected = codes.every((c) => selected.has(c));
    setSelected((prev) => {
      const next = new Set(prev);
      codes.forEach((c) => (allSelected ? next.delete(c) : next.add(c)));
      return next;
    });
  };
  const selectAllVisible = () => setSelected(new Set(allVisibleCodes));
  const selectNone = () => setSelected(new Set());

  const printMap = {}; // code -> item, for the printable area
  activeItems.forEach((it) => (it.units || []).forEach((u) => (printMap[u.code] = it)));

  // When printQueue is set, the printable area re-renders with those codes first,
  // then this effect fires window.print() once the DOM has actually committed.
  useEffect(() => {
    if (!printQueue || printQueue.length === 0) return;
    const byItem = {};
    printQueue.forEach((code) => {
      const it = printMap[code];
      if (!it) return;
      if (!byItem[it.id]) byItem[it.id] = [];
      byItem[it.id].push(code);
    });
    Object.entries(byItem).forEach(([itemId, codes]) => onSetPrinted(itemId, codes, true));
    window.print();
    setPrintQueue(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printQueue]);

  const handlePrint = () => {
    setPrintQueue(Array.from(selected));
  };

  const handleReplaceSticker = (e, code) => {
    e.stopPropagation();
    setPrintQueue([code]);
  };

  const handleReplaceTag = (e, itemId, oldCode) => {
    e.stopPropagation();
    const newCode = onReplaceCode(itemId, oldCode);
    setPrintQueue([newCode]);
  };

  const handleUndoPrint = (e, itemId, code) => {
    e.stopPropagation();
    onSetPrinted(itemId, [code], false);
  };

  return (
    <div>
      <SubPageHeader title="إعادة الطباعة" onBack={onBack} />
      <p style={{ color: "var(--text2)" }} className="text-xs px-4 pb-1">
        الطباعة الأولى تتم تلقائيًا عند التكويد. هذه الصفحة لإعادة طباعة رقاقة تالفة أو مفقودة أو لاستبدال كودها.
      </p>
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
          <Search size={16} color="var(--text3)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالرمز أو التصنيف"
            style={{ background: "transparent", border: "none", color: "var(--text)", flex: 1, fontFamily: "'Cairo','Tajawal',system-ui,sans-serif" }}
          />
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className="text-xs px-3 py-1 rounded-full font-bold"
              style={{ background: filter === "all" ? "var(--accentBg)" : "var(--panel)", color: filter === "all" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              الكل
            </button>
            <button
              onClick={() => setFilter("unprinted")}
              className="text-xs px-3 py-1 rounded-full font-bold"
              style={{ background: filter === "unprinted" ? "var(--accentBg)" : "var(--panel)", color: filter === "unprinted" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              غير مطبوعة فقط
            </button>
          </div>
          <span style={{ color: "var(--text2)" }} className="text-xs">
            {selected.size} محدد
          </span>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={selectAllVisible} className="flex-1 text-xs font-bold py-1.5 rounded-full" style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>
            تحديد الكل الظاهر
          </button>
          <button onClick={selectNone} className="flex-1 text-xs font-bold py-1.5 rounded-full" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
            إلغاء التحديد
          </button>
        </div>

        {visibleItems.length === 0 ? (
          <EmptyState icon={<Barcode size={36} color="var(--accentText)" />} title="لا توجد قطع" sub="لا يوجد ما يطابق البحث أو الفلتر الحالي" />
        ) : (
          <div className="flex flex-col gap-3 mb-4">
            {visibleItems.map(({ it, units }) => {
              const allSelected = units.every((u) => selected.has(u.code));
              return (
                <Card key={it.id} style={{ padding: 12 }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {it.photoDataUrl ? (
                        <img src={it.photoDataUrl} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
                      ) : (
                        <Hallmark karat={it.karat} size={32} />
                      )}
                      <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                        {itemLabel(it)}
                      </span>
                    </div>
                    <button onClick={() => toggleItemAll(units)} className="text-[11px] px-2 py-1 rounded-full" style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>
                      {allSelected ? "إلغاء الكل" : "تحديد الكل"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {units.map((u, idx) => (
                      <button
                        key={u.code}
                        onClick={() => toggle(u.code)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg text-right"
                        style={{ background: "var(--bg)", border: selected.has(u.code) ? "1px solid var(--accentSoft)" : "1px solid var(--line)" }}
                      >
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 5,
                            border: "1px solid var(--accentSoft)",
                            background: selected.has(u.code) ? "var(--accentSoft)" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {selected.has(u.code) && <Check size={12} color="var(--panel)" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ color: "var(--text)" }} className="text-xs font-mono truncate">
                            {u.code}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end" style={{ maxWidth: 150 }}>
                          {u.printed && (
                            <>
                              <span
                                onClick={(e) => handleReplaceSticker(e, u.code)}
                                className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                                style={{ background: "var(--accentBg)", color: "var(--accent)" }}
                              >
                                <RefreshCw size={9} /> إعادة طباعة
                              </span>
                              <span
                                onClick={(e) => handleReplaceTag(e, it.id, u.code)}
                                className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                                style={{ background: "var(--accentBg)", color: "var(--accentText)" }}
                              >
                                <RadioTower size={9} /> رقاقة جديدة
                              </span>
                            </>
                          )}
                          <span
                            onClick={u.printed ? (e) => handleUndoPrint(e, it.id, u.code) : undefined}
                            className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                            style={{ background: u.printed ? "var(--goodBg)" : "var(--accentBg)", color: u.printed ? "var(--goodSolid)" : "var(--accent)" }}
                          >
                            {u.printed ? (
                              <>
                                <X size={9} /> إلغاء
                              </>
                            ) : (
                              "لم تُطبع"
                            )}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ⚠ إصلاح محلي: كان z-40 هنا مطابقًا لطبقة شريط التنقل السفلي الدائم
          (GoldInventoryApp.jsx)، وبما أن الشريط يُرسم لاحقًا في الشجرة فإنه
          كان يعلو فوق هذا الزر ويمنع الضغط عليه فعليًا. رفعنا الطبقة إلى
          z-50 لضمان بقاء الزر قابلاً للنقر دائمًا. */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2" style={{ background: "linear-gradient(to top, var(--bg) 60%, transparent)" }}>
        <div className="mx-auto">
          <button
            disabled={selected.size === 0}
            onClick={handlePrint}
            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
            style={{ background: selected.size ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: selected.size ? "var(--panel)" : "var(--text3)" }}
          >
            <Printer size={18} /> طباعة ({selected.size})
          </button>
        </div>
      </div>

      {/* Printable area — hidden on screen, shown only via @media print */}
      <div id="print-labels-area" className="print-area" style={{ display: "none" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4mm" }}>
          {(printQueue || []).map((code) => {
            const it = printMap[code];
            if (!it) return null;
            const catLabel = categoryLabel(it.categoryId);
            return (
              <div
                key={code}
                style={{
                  width: "50mm",
                  height: "30mm",
                  border: "1px solid #000",
                  padding: "3mm",
                  fontFamily: "sans-serif",
                  color: "#000",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "2mm" }}>
                  {it.photoDataUrl && (
                    <img src={it.photoDataUrl} alt="" style={{ width: "9mm", height: "9mm", objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "11px" }}>{catLabel}</div>
                    <div style={{ fontSize: "9px" }}>
                      عيار {it.karat} · {fmtW(it.weight)} جم
                      {it.stonesWeight > 0 ? ` +${fmtW(it.stonesWeight)} جم فصوص` : ""}
                    </div>
                  </div>
                </div>
                <PseudoBarcode code={code} />
                <div style={{ fontWeight: 700, fontSize: "11px", letterSpacing: "0.5px" }}>{code}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// المشتريات — مفصولة بين ما يدخل تكلفة الذهب وما لا يدخلها
// ============================================================

export { PrintingPage };
