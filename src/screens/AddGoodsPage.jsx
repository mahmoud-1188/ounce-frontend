import React, { useState } from "react";
import { Barcode, Camera, Check, Loader2, Plus, Trash2, Truck } from "lucide-react";
import { CATEGORY_STATE } from "../core/constants.js";
import { fmt, fmtW, roundW } from "../core/money.js";
import { SET_PIECE_PRESETS } from "../core/workflow.js";
import { compressImage, emptyRow, inputStyle, itemLabel, remainingQty } from "../domain/helpers.js";
import { key } from "../domain/key.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { ItemDetailModal } from "../modals/ItemDetailModal.jsx";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { Hallmark } from "../ui/Hallmark.jsx";
import { PrintAfterEntry } from "../ui/PrintAfterEntry.jsx";
import { QuickLotForm } from "../ui/QuickLotForm.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function AddGoodsPage({ items, onSave, lots = [], suppliers = [], entrySessions = [], onSetPrinted, onCreateSupplierLot, onDeleteItem, onBack, flashToast }) {
  const [detailItem, setDetailItem] = useState(null);
  const [justEntered, setJustEntered] = useState(null); // الأصناف المُدخلة للتو، بانتظار الطباعة
  const [showSessions, setShowSessions] = useState(false);
  const [distMode, setDistMode] = useState("per_gram");
  const [lotId, setLotId] = useState("");
  const [localLots, setLocalLots] = useState([]);
  const [showQuickLot, setShowQuickLot] = useState(false);
  const [rows, setRows] = useState([emptyRow()]);
  const [savingPhotoKey, setSavingPhotoKey] = useState(null);

  const allLots = [...localLots, ...lots];
  const openLots = allLots.filter((l) => l.status === "open");
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name || "مورد";
  const selectedLot = allLots.find((l) => l.id === lotId);
  const activeItems = items.filter((i) => remainingQty(i) > 0);

  const updateRow = (key, field, val) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: val } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (key) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));

  const handlePhotoSelect = async (key, file) => {
    if (!file) return;
    setSavingPhotoKey(key);
    try {
      const dataUrl = await compressImage(file);
      updateRow(key, "photoDataUrl", dataUrl);
    } catch (e) {
      console.error("photo compress failed", e);
    } finally {
      setSavingPhotoKey(null);
    }
  };

  const handleQuickLotCreated = async (draft) => {
    // ⚠ onCreateSupplierLot صار غير متزامن (يستدعي الباك إند فعليًا) —
    // لازم انتظار النتيجة قبل استخدامها، وإلا كان lot كائن Promise لا
    // الدفعة الفعلية.
    const lot = await onCreateSupplierLot(draft);
    if (lot) {
      setLocalLots((prev) => [lot, ...prev]);
      setLotId(lot.id);
    }
    setShowQuickLot(false);
  };

  const rowValid = (r) => Number(r.weight) > 0 && Number(r.quantity) > 0;
  const allRowsValid = rows.every(rowValid);
  const canSave = !!lotId && allRowsValid;

  const [saving, setSaving] = useState(false);

  // ⚠ onSave صار غير متزامن (يستدعي الباك إند فعليًا عبر
  // api.createLotItems — راجع تعليق handleAddItems في GoldInventoryApp.jsx)
  // — لازم انتظار النتيجة قبل الطباعة، وإلا كانت created كائن Promise لا
  // مصفوفة الأصناف الفعلية، فتُفتح شاشة الطباعة فارغة أو تفشل بصمت.
  const handleSubmit = async () => {
    // ⚠ categoryId لا category: الباك إند يتحقق من category_id حقيقي في
    // جدول categories — إرسال المفتاح القديم (category) كان سيُرفض
    // برسالة category غير موجود مهما كانت القيمة صحيحة.
    const cleanRows = rows.map((r) => ({
      categoryId: r.category,
      stonesWeight: Number(r.stonesWeight) || 0,
      weight: Number(r.weight),
      quantity: Math.max(1, Number(r.quantity) || 1),
      costPerGram: selectedLot.costPerGram,
      workmanshipPerUnit: Number(r.workmanshipPerUnit) || 0,
      photoDataUrl: r.photoDataUrl,
      isSet: r.category === "set",
      setPieces: r.category === "set" ? (r.setPieces || []).filter((x) => (x || "").trim()) : [],
    }));
    setSaving(true);
    try {
      const created = await onSave(lotId, cleanRows, distMode);
      // الطباعة جزء من الإدخال لا صفحة منفصلة: الرقاقة تُلصق على القطعة
      // فور إدخالها، وتأجيلها يعني قطعًا بلا رقاقة في الصندوق اليومي.
      if (created && created.length) {
        setJustEntered(created);
        setRows([emptyRow()]);
      }
    } finally {
      setSaving(false);
    }
  };

  if (justEntered) {
    return (
      <PrintAfterEntry
        newItems={justEntered}
        supplierLabel={selectedLot ? supplierName(selectedLot.supplierId) : ""}
        onSetPrinted={onSetPrinted}
        onDone={() => setJustEntered(null)}
        onExit={() => {
          setJustEntered(null);
          onBack();
        }}
      />
    );
  }

  // ميزانية أجور الدفعة: الإجمالي المتفق عليه وقت الشراء، وما وُزِّع منه،
  // وما تبقّى. الفارق بعد اكتمال الإدخال هو فائض أو نقص يجب أن يظهر صراحة
  // بدل أن يذوب في تكلفة القطع.
  const wmTotal = Number(selectedLot?.workmanshipTotal) || 0;
  const wmAllocated = Number(selectedLot?.workmanshipAllocated) || 0;
  const wmRemaining = wmTotal - wmAllocated;

  // ميزانية الوزن: ما اشتُري من المورد مقابل ما أُدخل فعلًا.
  const lotWeight = Number(selectedLot?.weight) || 0;
  const wEntered = Number(selectedLot?.enteredWeight) || 0;
  // ما يُكتب في الصفوف الحالية قبل الحفظ، ليرى المستخدم أثره فورًا.
  const wDraft = rows.reduce((a, r) => a + (Number(r.weight) || 0) * Math.max(1, Number(r.quantity) || 1), 0);
  const wRemaining = lotWeight - wEntered - wDraft;

  return (
    <div>
      <SubPageHeader title="التكويد" onBack={onBack} />
      <div className="px-4 pt-3">
        {entrySessions.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: "var(--text2)" }} className="text-xs">
                جلسات التكويد ({entrySessions.length})
              </span>
              <button
                onClick={() => setShowSessions((v) => !v)}
                className="text-[11px] px-2 py-1 rounded-full"
                style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
              >
                {showSessions ? "إخفاء" : "عرض"}
              </button>
            </div>
            {showSessions && (
              <div className="flex flex-col gap-2 mb-4">
                {entrySessions.slice(0, 12).map((se) => (
                  <Card key={se.id} style={{ padding: 10 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-xs font-bold">
                        {supplierName(se.supplierId)}
                        {se.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{se.ref}</span>}
                      </span>
                      <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
                        {se.itemCount} صنف · {se.unitCount} قطعة
                      </span>
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                      {se.karat ? `عيار ${se.karat} · ` : ""}
                      {fmt(se.totalWeight)} جم · {new Date(se.date).toLocaleString("en-GB")}
                      {se.createdBy ? ` · ${se.createdBy}` : ""}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
        <Field label="المورد / الدفعة (إجباري)">
          <select style={inputStyle} value={lotId} onChange={(e) => setLotId(e.target.value)}>
            <option value="">اختر دفعة...</option>
            {openLots.map((l) => (
              <option key={l.id} value={l.id}>
                {supplierName(l.supplierId)} · عيار {l.karat} · {new Date(l.date).toLocaleDateString("en-GB")}
              </option>
            ))}
          </select>
        </Field>
        {selectedLot && (
          <>
            <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
                وزن الدفعة (المورد: {selectedLot ? supplierName(selectedLot.supplierId) : "—"})
              </p>
              <div className="flex items-center justify-between py-1">
                <span style={{ color: "var(--text2)" }} className="text-[11px]">الوزن المشترى</span>
                <span style={{ color: "var(--text)" }} className="text-xs font-bold">{fmt(lotWeight)} جم</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span style={{ color: "var(--text2)" }} className="text-[11px]">أُدخل سابقًا</span>
                <span style={{ color: "var(--text)" }} className="text-xs font-bold">{fmt(wEntered)} جم</span>
              </div>
              {wDraft > 0 && (
                <div className="flex items-center justify-between py-1">
                  <span style={{ color: "var(--text2)" }} className="text-[11px]">في الصفوف الحالية</span>
                  <span style={{ color: "var(--accentText)" }} className="text-xs font-bold">{fmt(wDraft)} جم</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1" style={{ borderTop: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                  {wRemaining >= 0 ? "المتبقي للإدخال" : "تجاوز وزن الدفعة"}
                </span>
                <span
                  style={{ color: Math.abs(wRemaining) < 0.001 ? "var(--goodSolid)" : wRemaining > 0 ? "var(--accent)" : "var(--bad)" }}
                  className="text-sm font-bold"
                >
                  {fmt(Math.abs(wRemaining))} جم
                </span>
              </div>
              {Math.abs(wRemaining) < 0.001 && lotWeight > 0 && (
                <p style={{ color: "var(--good)" }} className="text-[11px] mt-1">مطابق تمامًا لوزن الدفعة</p>
              )}
              {wRemaining < -0.001 && (
                <p style={{ color: "var(--bad)" }} className="text-[11px] mt-1">
                  الوزن المُدخل يتجاوز المشترى — سيُسجَّل كفائض وزن على الدفعة.
                </p>
              )}
              {wRemaining > 0.001 && wEntered > 0 && (
                <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                  إن انتهيت من الإدخال ولم يتبقَّ ما يُدخل، أقفل الدفعة ليُسجَّل الفرق كهالك.
                </p>
              )}
            </Card>

            <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
                أجور الدفعة
              </p>
              <div className="flex items-center justify-between py-1">
                <span style={{ color: "var(--text2)" }} className="text-[11px]">إجمالي الأجور المتفق عليها</span>
                <span style={{ color: "var(--text)" }} className="text-xs font-bold">{fmt(wmTotal, 0)}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span style={{ color: "var(--text2)" }} className="text-[11px]">وُزِّع على قطع سابقة</span>
                <span style={{ color: "var(--text)" }} className="text-xs font-bold">{fmt(wmAllocated, 0)}</span>
              </div>
              <div className="flex items-center justify-between py-1" style={{ borderTop: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                  {wmRemaining >= 0 ? "المتبقي للتوزيع" : "فائض موزَّع زيادة"}
                </span>
                <span style={{ color: wmRemaining > 0 ? "var(--accent)" : wmRemaining === 0 ? "var(--goodSolid)" : "var(--bad)" }} className="text-sm font-bold">
                  {fmt(Math.abs(wmRemaining), 0)}
                </span>
              </div>
              {wmRemaining === 0 && wmTotal > 0 && (
                <p style={{ color: "var(--good)" }} className="text-[11px] mt-1">وُزِّعت كل الأجور بالكامل</p>
              )}
              {wmRemaining < 0 && (
                <p style={{ color: "var(--bad)" }} className="text-[11px] mt-1">
                  وُزِّع أكثر من الأجور المتفق عليها — راجع الأوزان المدخلة.
                </p>
              )}
            </Card>
            {wmRemaining > 0 && (
              <Field label="طريقة توزيع الأجور المتبقية على هذه الدفعة">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "per_gram", label: "حسب الوزن" },
                    { id: "per_item", label: "حسب القطعة" },
                    { id: "by_karat", label: "حسب العيار" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setDistMode(m.id)}
                      className="py-2 rounded-xl text-[11px] font-bold"
                      style={{ background: distMode === m.id ? "var(--accentBg)" : "var(--panel)", color: distMode === m.id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </>
        )}

        {!showQuickLot ? (
          <button
            onClick={() => setShowQuickLot(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 w-fit mb-4"
            style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
          >
            <Truck size={13} /> مورد / دفعة جديدة
          </button>
        ) : (
          <QuickLotForm onCancel={() => setShowQuickLot(false)} onCreate={handleQuickLotCreated} suppliers={suppliers} />
        )}

        {!lotId && (
          <p style={{ color: "var(--bad)" }} className="text-xs mb-4">
            لازم تختار أو تنشئ دفعة مورد قبل إضافة أي صنف — كل قطعة يجب أن تكون مرتبطة بمصدرها.
          </p>
        )}

        {lotId && selectedLot && (
          <div className="flex flex-col gap-4 mb-4">
            {rows.map((r, idx) => (
              <Card key={r.key} style={{ padding: 12 }}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: "var(--text2)" }} className="text-xs font-bold">
                    صنف {idx + 1}
                  </span>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(r.key)} style={{ color: "var(--bad)" }}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <label className="flex items-center justify-center rounded-xl cursor-pointer flex-shrink-0" style={{ width: 56, height: 56, background: "var(--bg)", border: "1px dashed var(--edge)", overflow: "hidden" }}>
                    {savingPhotoKey === r.key ? (
                      <Loader2 size={18} className="animate-spin" color="var(--accentText)" />
                    ) : r.photoDataUrl ? (
                      <img src={r.photoDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Camera size={18} color="var(--accentText)" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: "none" }}
                      onChange={(e) => handlePhotoSelect(r.key, e.target.files?.[0])}
                    />
                  </label>
                  <div className="flex-1">
                    <Field label="التصنيف">
                      <select style={inputStyle} value={r.category} onChange={(e) => updateRow(r.key, "category", e.target.value)}>
                        {CATEGORY_STATE.list.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </Field>
              {r.category === "set" && (
                <div className="mb-3">
                  <p style={{ color: "var(--text2)" }} className="text-[11px] mb-1">
                    قطع الطقم — يعرفها النظام وقت بيع قطعة منه
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {SET_PIECE_PRESETS.map((label) => {
                      const on = (r.setPieces || []).includes(label);
                      return (
                        <button
                          key={label}
                          onClick={() =>
                            // ⚠ إصلاح محلي: الدالة الصحيحة هي updateRow، وليست update (غير معرّفة).
                            updateRow(r.key, "setPieces", on
                              ? (r.setPieces || []).filter((x) => x !== label)
                              : [...(r.setPieces || []), label])
                          }
                          className="text-[11px] px-2.5 py-1 rounded-full"
                          style={{
                            background: on ? "var(--accentBg)" : "var(--panel)",
                            color: on ? "var(--accent)" : "var(--text2)",
                            border: `1px solid ${on ? "var(--accentLine)" : "var(--edge)"}`,
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[10px]">
                    الوزن المُدخل هو وزن الطقم كاملًا. عند بيع قطعة يزن البائع الباقي ويُوزَّع الوزن.
                  </p>
                </div>
              )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="وزن الذهب (جرام)">
                    <input style={inputStyle} type="text" inputMode="decimal" value={r.weight} onChange={(e) => updateRow(r.key, "weight", sanitizeNumeric(e.target.value))} placeholder="0.00" />
                  </Field>
                  <Field label="وزن الفصوص (اختياري)">
                    <input style={inputStyle} type="text" inputMode="decimal" value={r.stonesWeight} onChange={(e) => updateRow(r.key, "stonesWeight", sanitizeNumeric(e.target.value))} placeholder="0.00" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="الكمية">
                    <input style={inputStyle} type="text" inputMode="numeric" value={r.quantity} onChange={(e) => updateRow(r.key, "quantity", sanitizeNumeric(e.target.value))} />
                  </Field>
                  <Field label="مصنعية القطعة الواحدة">
                    <input style={inputStyle} type="text" inputMode="decimal" value={r.workmanshipPerUnit} onChange={(e) => updateRow(r.key, "workmanshipPerUnit", sanitizeNumeric(e.target.value))} placeholder="0.00" />
                  </Field>
                </div>
                <p style={{ color: "var(--text3)" }} className="text-[11px] flex items-center gap-1">
                  <Barcode size={12} /> سيُولَّد رمز فريد تلقائيًا لكل قطعة — اطبع ملصقاتها من صفحة الطباعة بعد الحفظ
                </p>
              </Card>
            ))}

            <button
              onClick={addRow}
              className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px dashed var(--edge)" }}
            >
              <Plus size={16} /> إضافة صنف آخر لنفس الدفعة
            </button>
          </div>
        )}

        <button
          disabled={!canSave}
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl font-bold mt-2 flex items-center justify-center gap-2"
          style={{ background: canSave ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: canSave ? "var(--panel)" : "var(--text3)" }}
        >
          <Check size={18} /> حفظ {rows.length > 1 ? `الأصناف (${rows.length})` : "الصنف"}
        </button>

        {/* ── ما كُوّد من هذه الدفعة ──
            كانت هنا «الأصناف الحالية بالمخزون» كلها — عشرات القطع لا علاقة
            لها بما تُكوّده. التكويد عمل على دفعة بعينها، وعرض المخزون كله
            يُطيل الصفحة ويُخفي ما يهم: كم بقي من وزن الدفعة. */}
        {selectedLot && (() => {
          const mine = activeItems.filter((it) => it.lotId === selectedLot.id);
          const codedW = mine.reduce(
            (a, it) => a + (Number(it.weight) || 0) * ((it.units || []).length || 1), 0
          );
          const remain = roundW((Number(selectedLot.weight) || 0) - codedW);
          return (
            <div>
              <div className="flex items-baseline justify-between mt-8 mb-2">
                <span style={{ color: "var(--text2)" }} className="text-xs">
                  كُوّد من هذه الدفعة ({mine.length})
                </span>
                <span
                  style={{ color: remain > 0.0005 ? "var(--accent)" : "var(--goodSolid)" }}
                  className="text-xs font-bold"
                >
                  بقي {fmtW(Math.max(0, remain))} جم
                </span>
              </div>
              {mine.length === 0 ? (
                <p style={{ color: "var(--text3)" }} className="text-xs">لم يُكوَّد شيء بعد</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {mine.map((it) => (
                    <Card key={it.id} style={{ padding: 10 }}>
                      <button onClick={() => setDetailItem(it)} className="w-full text-right">
                        <div className="flex items-center gap-2">
                          <Hallmark karat={it.karat} size={30} />
                          <span style={{ color: "var(--text)" }} className="text-xs flex-1">
                            {itemLabel(it)}
                          </span>
                          <span style={{ color: "var(--text2)" }} className="text-[11px]">
                            {remainingQty(it)} × {fmtW(it.weight)} جم
                          </span>
                        </div>
                      </button>
                    </Card>
                  ))}
                </div>
              )}
              {remain < -0.0005 && (
                <Card style={{ padding: 10, marginTop: 8, border: "1px solid var(--badLine)" }}>
                  <p style={{ color: "var(--bad)" }} className="text-[11px]">
                    ⚠ المُكوَّد يتجاوز وزن الدفعة بـ{fmtW(-remain)} جم — راجع الأوزان.
                  </p>
                </Card>
              )}
            </div>
          );
        })()}
      </div>
      {detailItem && (
        <ItemDetailModal item={detailItem} lots={lots} suppliers={suppliers} onClose={() => setDetailItem(null)} />
      )}
    </div>
  );
}

export { AddGoodsPage };
