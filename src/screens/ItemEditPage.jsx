import React, { useState } from "react";
import { Lock, Package } from "lucide-react";
import { CATEGORY_STATE } from "../core/constants.js";
import { KARATS, PURITY, fmt, fmtW } from "../core/money.js";
import { categoryLabel, inputStyle, itemLabel } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function ItemEditPage({ items, currency, price24, onChangeCategory, onBack }) {
  const [q, setQ] = useState("");
  const [karatFilter, setKaratFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [sel, setSel] = useState(null);
  const [newCat, setNewCat] = useState("");
  const [note, setNote] = useState("");

  const active = items.filter((it) => (it.units || []).some((u) => !u.sold));
  const list = active
    .filter((it) => (karatFilter === "all" ? true : String(it.karat) === karatFilter))
    .filter((it) => (catFilter === "all" ? true : it.categoryId === catFilter))
    .filter((it) => {
      const s = q.trim().toLowerCase();
      if (!s) return true;
      const codes = (it.units || []).map((u) => u.code).join(" ");
      return (categoryLabel(it.categoryId) + " " + codes + " " + (it.sku || "")).toLowerCase().includes(s);
    });

  const item = sel ? items.find((x) => x.id === sel) : null;
  const changed = item && newCat && newCat !== item.categoryId;
  const edited = active.filter((it) => (it.categoryHistory || []).length > 0);

  // شاشة التعديل
  if (item) {
    const free = (item.units || []).filter((u) => !u.sold);
    return (
      <div>
        <SubPageHeader title="تعديل التصنيف" onBack={() => { setSel(null); setNewCat(""); setNote(""); }} />
        <div className="px-4 pt-3">
          <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold">
              {itemLabel(item)}
            </p>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
              {free.length} قطعة متاحة · دخلت {new Date(item.dateAdded || item.createdAt || Date.now()).toLocaleDateString("en-GB")}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {free.slice(0, 12).map((u) => (
                <span
                  key={u.code}
                  className="text-[10px] px-2 py-0.5 rounded"
                  style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)", fontFamily: "monospace" }}
                >
                  {u.code}
                </span>
              ))}
            </div>
          </Card>

          {/* الحقول المقفلة — تُعرض ولا تُعدَّل */}
          <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
            بيانات مقفلة
          </p>
          <Card style={{ padding: 12, marginBottom: 12 }}>
            {[
              ["العيار", item.karat],
              ["الوزن", `${fmtW(item.weight)} جم`],
              ["الفصوص", `${fmtW(item.stonesWeight || 0)} جم`],
              ["تكلفة الجرام", `${currency}${fmt(item.costPerGram || 0)}`],
              ["حصة الأجور", `${currency}${fmt(item.lotWorkmanshipShare || 0)}`],
              ["القيمة بسعر اليوم", `${currency}${fmt((Number(item.weight) || 0) * (PURITY[item.karat] || item.karat / 24) * (price24 || 0), 0)}`],
            ].map(([l, v], i, arr) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}
              >
                <span style={{ color: "var(--text3)" }} className="text-[11px] flex items-center gap-1.5">
                  <Lock size={10} /> {l}
                </span>
                <span style={{ color: "var(--text2)" }} className="text-xs font-bold">{v}</span>
              </div>
            ))}
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2">
              الوزن والعيار والتكلفة أساس كل حساب لاحق. تغييرها بعد الإدخال يجعل الفواتير القديمة
              تشير لأرقام غير التي بيعت بها — لذلك تُقفل. لتصحيح وزن استخدم الجرد أو تعديل الإصلاح.
            </p>
          </Card>

          {/* التصنيف — الحقل الوحيد القابل للتعديل */}
          <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">
            التصنيف
          </p>
          <Card style={{ padding: 14, marginBottom: 12 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
              الحالي: <span style={{ color: "var(--text)", fontWeight: 700 }}>{categoryLabel(item.categoryId)}</span>
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {CATEGORY_STATE.list.map((c) => {
                const on = (newCat || item.categoryId) === c.id;
                const isCurrent = c.id === item.categoryId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setNewCat(c.id)}
                    className="py-2 rounded-xl text-[11px] font-bold"
                    style={{
                      background: on ? "var(--accentBg)" : "var(--panel)",
                      color: on ? "var(--accent)" : "var(--text2)",
                      border: `1px solid ${on ? "var(--accentLine)" : "var(--edge)"}`,
                    }}
                  >
                    {c.label}
                    {isCurrent && <span style={{ color: "var(--text3)" }} className="block text-[9px]">الحالي</span>}
                  </button>
                );
              })}
            </div>

            {changed && (
              <>
                <p style={{ color: "var(--good)" }} className="text-[11px] mb-2">
                  {categoryLabel(item.categoryId)} ← {categoryLabel(newCat)}
                </p>
                <Field label="سبب التعديل (اختياري)">
                  <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: صُنّف خطأ عند الإدخال" />
                </Field>
              </>
            )}

            <button
              disabled={!changed}
              onClick={() => {
                onChangeCategory(item.id, newCat, note);
                setSel(null);
                setNewCat("");
                setNote("");
              }}
              className="w-full py-3 rounded-xl font-bold"
              style={{
                background: changed ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                color: changed ? "var(--panel)" : "var(--text3)",
              }}
            >
              حفظ التصنيف
            </button>
          </Card>

          {(item.categoryHistory || []).length > 0 && (
            <>
              <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
                سجل التعديلات ({item.categoryHistory.length})
              </p>
              <div className="flex flex-col gap-2 mb-4">
                {item.categoryHistory.map((h, i) => (
                  <Card key={i} style={{ padding: 10 }}>
                    <p style={{ color: "var(--text)" }} className="text-[11px]">
                      {categoryLabel(h.from)} ← {categoryLabel(h.to)}
                    </p>
                    <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                      {new Date(h.at).toLocaleString("en-GB")} · {h.by}
                      {h.note ? ` · ${h.note}` : ""}
                    </p>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // قائمة القطع
  return (
    <div>
      <SubPageHeader title="تعديل القطع" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
          التعديل مقصور على <span style={{ color: "var(--accent)", fontWeight: 700 }}>التصنيف</span> فقط.
          باقي البيانات محاسبية ومقفلة.
        </p>

        <input
          style={{ ...inputStyle, marginBottom: 8 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالتصنيف أو الرقاقة..."
        />
        <div className="grid grid-cols-2 gap-2 mb-3">
          <select style={inputStyle} value={karatFilter} onChange={(e) => setKaratFilter(e.target.value)}>
            <option value="all">كل العيارات</option>
            {KARATS.map((k) => (
              <option key={k} value={String(k)}>عيار {k}</option>
            ))}
          </select>
          <select style={inputStyle} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">كل التصنيفات</option>
            {CATEGORY_STATE.list.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
          {list.length} صنف
          {edited.length > 0 ? ` · ${edited.length} عُدِّل سابقًا` : ""}
        </p>

        {list.length === 0 ? (
          <EmptyState icon={<Package size={32} color="var(--accentText)" />} title="لا أصناف مطابقة" sub="جرّب بحثًا آخر" />
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((it) => {
              const free = (it.units || []).filter((u) => !u.sold).length;
              const wasEdited = (it.categoryHistory || []).length > 0;
              return (
                <button
                  key={it.id}
                  onClick={() => {
                    setSel(it.id);
                    setNewCat(it.categoryId);
                    setNote("");
                  }}
                  className="w-full text-right"
                >
                  <Card style={{ padding: 12 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                        {categoryLabel(it.categoryId)}
                        {wasEdited && (
                          <span style={{ color: "var(--accentText)" }} className="text-[10px] mr-1.5">
                            عُدِّل
                          </span>
                        )}
                      </span>
                      <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
                        عيار {it.karat} · {fmtW(it.weight)} جم
                      </span>
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                      {free} قطعة متاحة
                      {(it.units || []).length ? ` · ${it.units[0].code}` : ""}
                      {it.fromScrap ? " · من كسر" : ""}
                    </p>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// نموذج سداد مورد — الذهب بالذهب والأجور نقدًا
// ============================================================

export { ItemEditPage };
