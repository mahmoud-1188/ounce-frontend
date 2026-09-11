import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { fmtW } from "../core/money.js";
import { SALE_MODES } from "../core/workflow.js";
import { inputStyle, normalizeName } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function CategoriesPage({ categories, items, inUse, onSave, onBack, flashToast }) {
  const [list, setList] = useState(categories);
  const [editing, setEditing] = useState(null);
  const [newLabel, setNewLabel] = useState("");
  const [newMode, setNewMode] = useState("whole");
  const [newMin, setNewMin] = useState("");

  const countOf = (id) => items.filter((it) => it.categoryId === id && (it.units || []).some((u) => !u.sold)).length;
  const dirty = JSON.stringify(list) !== JSON.stringify(categories);

  const slug = (label) =>
    "cat_" + String(label).trim().replace(/\s+/g, "_").slice(0, 20) + "_" + Math.random().toString(36).slice(2, 5);

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    // ⚠ الاسم المكرر يجعل البائع يختار الخطأ ويُفسد التقارير
    if (list.some((c) => normalizeName(c.label) === normalizeName(label))) {
      flashToast("التصنيف موجود مسبقًا");
      return;
    }
    setList([
      ...list,
      {
        id: slug(label),
        label,
        saleMode: newMode,
        ...(newMode === "partial" && Number(newMin) > 0 ? { minSaleWeight: Number(newMin) } : {}),
        ...(newMode === "set" ? { isSet: true } : {}),
      },
    ]);
    setNewLabel("");
    setNewMin("");
    setNewMode("whole");
  };

  const update = (id, patch) => setList(list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id) => {
    if (inUse(id)) {
      flashToast("لا يُحذف تصنيف مستخدم في المخزون");
      return;
    }
    setList(list.filter((c) => c.id !== id));
  };
  const move = (id, dir) => {
    const arr = [...list];
    const i = arr.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setList(arr);
  };

  const ModeChip = ({ mode }) => {
    const m = SALE_MODES.find((x) => x.id === mode) || SALE_MODES[0];
    const color = mode === "partial" ? "var(--accent)" : mode === "set" ? "var(--accentSoft)" : "var(--text2)";
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: "var(--panel)", color, border: "1px solid var(--line)" }}>
        {m.label}
      </span>
    );
  };

  return (
    <div>
      <SubPageHeader title="التصنيفات وطرق البيع" onBack={onBack} />
      <div className="px-4 pt-3">
        {/* شرح الطرق */}
        <Card style={{ padding: 12, marginBottom: 12 }}>
          <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">ثلاث طرق بيع</p>
          {SALE_MODES.map((m, i) => (
            <div key={m.id} className="py-1.5" style={{ borderBottom: i < SALE_MODES.length - 1 ? "1px solid var(--line)" : "none" }}>
              <p style={{ color: "var(--text)", margin: 0 }} className="text-xs font-bold">{m.label}</p>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">
                {m.id === "whole" && "خاتم أو سوار — إما يُباع أو لا. لا يُقتطع منه."}
                {m.id === "partial" && "سبيكة 1000 جم يُباع منها جرام فيبقى 999. القطعة تبقى وينقص وزنها."}
                {m.id === "set" && "يدخل بوزنه الكامل، وبيع قطعة منه يفكّ الباقي أصنافًا مستقلة."}
              </p>
            </div>
          ))}
        </Card>

        {/* إضافة */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">إضافة تصنيف</p>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <Field label="الاسم">
            <input style={inputStyle} value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              placeholder="مثال: تعليقة · دبلة · نصف ليرة" />
          </Field>
          <Field label="طريقة البيع">
            <div className="grid grid-cols-3 gap-2">
              {SALE_MODES.map((m) => (
                <button key={m.id} onClick={() => setNewMode(m.id)}
                  className="py-2 rounded-xl text-[11px] font-bold text-right px-2"
                  style={{
                    background: newMode === m.id ? "var(--accentBg)" : "var(--panel)",
                    color: newMode === m.id ? "var(--accent)" : "var(--text2)",
                    border: `1px solid ${newMode === m.id ? "var(--accentLine)" : "var(--edge)"}`,
                  }}>
                  {m.label}
                  <span style={{ color: "var(--text3)" }} className="block text-[9px]">{m.hint}</span>
                </button>
              ))}
            </div>
          </Field>
          {newMode === "partial" && (
            <Field label="أقل وزن يُباع (جم) — اختياري">
              <NumericInput value={newMin} onChange={setNewMin} placeholder="0.5" />
              <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                يمنع بيع قصاصات صغيرة. الباقي الأخير يُباع كاملًا مهما صغر.
              </p>
            </Field>
          )}
          <button onClick={add} disabled={!newLabel.trim()}
            className="w-full py-2.5 rounded-xl text-xs font-bold"
            style={{
              background: newLabel.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
              color: newLabel.trim() ? "var(--panel)" : "var(--text3)",
            }}>
            إضافة
          </button>
        </Card>

        {/* القائمة */}
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
          التصنيفات ({list.length})
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {list.map((c, i) => {
            const used = inUse(c.id);
            const qty = countOf(c.id);
            const isEditing = editing === c.id;
            return (
              <Card key={c.id} style={{ padding: 12 }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold flex-1">
                    {c.label}
                  </span>
                  <ModeChip mode={c.saleMode || "whole"} />
                  <button onClick={() => move(c.id, -1)} disabled={i === 0}
                    style={{ width: 26, height: 26, borderRadius: 7, background: "var(--panel)",
                      border: "1px solid var(--line)", color: i === 0 ? "var(--line)" : "var(--accentSoft)" }}>
                    <ChevronLeft size={12} style={{ transform: "rotate(90deg)", margin: "0 auto" }} />
                  </button>
                  <button onClick={() => move(c.id, 1)} disabled={i === list.length - 1}
                    style={{ width: 26, height: 26, borderRadius: 7, background: "var(--panel)",
                      border: "1px solid var(--line)", color: i === list.length - 1 ? "var(--line)" : "var(--accentSoft)" }}>
                    <ChevronLeft size={12} style={{ transform: "rotate(-90deg)", margin: "0 auto" }} />
                  </button>
                </div>
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                  {qty > 0 ? `${qty} قطعة في المخزون` : "لا قطع"}
                  {c.minSaleWeight ? ` · أقل بيع ${fmtW(c.minSaleWeight)} جم` : ""}
                </p>

                {isEditing ? (
                  <div className="mt-2">
                    <Field label="الاسم">
                      <input style={inputStyle} value={c.label}
                        onChange={(e) => update(c.id, { label: e.target.value })} />
                    </Field>
                    <Field label="طريقة البيع">
                      <div className="grid grid-cols-3 gap-2">
                        {SALE_MODES.map((m) => (
                          <button key={m.id} onClick={() => update(c.id, { saleMode: m.id })}
                            className="py-1.5 rounded-xl text-[11px] font-bold"
                            style={{
                              background: (c.saleMode || "whole") === m.id ? "var(--accentBg)" : "var(--panel)",
                              color: (c.saleMode || "whole") === m.id ? "var(--accent)" : "var(--text2)",
                              border: "1px solid var(--line)",
                            }}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                    {(c.saleMode || "whole") === "partial" && (
                      <Field label="أقل وزن يُباع (جم)">
                        <NumericInput value={String(c.minSaleWeight ?? "")}
                          onChange={(v) => update(c.id, { minSaleWeight: Number(v) || 0 })} />
                      </Field>
                    )}
                    {used && (
                      <p style={{ color: "var(--accentText)" }} className="text-[10px] mb-2">
                        ⚠ مستخدم في المخزون — تغيير طريقة البيع يسري على القطع الحالية.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setEditing(null)} className="py-2 rounded-xl text-[11px] font-bold"
                        style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                        تم
                      </button>
                      <button onClick={() => remove(c.id)} disabled={used}
                        className="py-2 rounded-xl text-[11px] font-bold"
                        style={{
                          background: used ? "var(--accentBg)" : "var(--badBg)",
                          color: used ? "var(--accentLine)" : "var(--bad)",
                          border: "1px solid var(--badLine)",
                        }}>
                        {used ? "لا يُحذف — مستخدم" : "حذف"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setEditing(c.id)}
                    className="w-full py-1.5 rounded-xl text-[11px] font-bold mt-2"
                    style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>
                    تعديل
                  </button>
                )}
              </Card>
            );
          })}
        </div>

        {dirty && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => { setList(categories); setEditing(null); }}
              className="py-3 rounded-xl text-xs font-bold"
              style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
              تراجع
            </button>
            <button onClick={() => { onSave(list); setEditing(null); }}
              className="py-3 rounded-xl text-xs font-bold"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
              حفظ التغييرات
            </button>
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// بيع بالوزن — سبيكة أو أي صنف قابل للتجزئة
// ============================================================

export { CategoriesPage };
