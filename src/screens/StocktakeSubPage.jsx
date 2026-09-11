import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Grid, Lock, Package, Scan, Warehouse } from "lucide-react";
import { fine24, fmtW } from "../core/money.js";
import { btSupported, categoryLabel, inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Hallmark } from "../ui/Hallmark.jsx";

function StocktakeSubPage({ lock, onToggleLock,
  activeItems,
  priceData,
  audits,
  stocktake,
  settings = {},
  onChooseScope,
  onSelectCategory,
  onBackToList,
  onUpdateEntry,
  onFinishSection,
  onFinishGeneral,
  onEndSectional,
  onCancelScope,
  onSaveSettings,
  flashToast,
}) {
  // ── إعداد إظهار الوزن ──
  //
  // بعض المحلات تجرد بالعدد وحده: الوزن يبطئ العدّاد ويجعله يقارن بدل
  // أن يعدّ. وبعضها يريده لأن الفرق بالوزن يكشف ما لا يكشفه العدد.
  // القرار للمدير من الإعدادات.
  const showWeight = settings.stocktakeShowWeight !== false;

  const [scanned, setScanned] = useState({});   // { unitCode: true }
  const [showMissing, setShowMissing] = useState(false);
  const [manual, setManual] = useState("");
  const [reader, setReader] = useState(null);   // جهاز القراءة المتصل
  const [btBusy, setBtBusy] = useState(false);
  const [btError, setBtError] = useState("");
  const inputRef = useRef(null);

  const scope = stocktake.scope;
  const cat = stocktake.activeCategory;

  // ── وحدات النطاق الحالي ──
  const unitsIn = (categoryId) => {
    const out = [];
    activeItems.forEach((it) => {
      if (categoryId && it.categoryId !== categoryId) return;
      (it.units || []).forEach((u) => {
        if (!u.sold) out.push({ code: u.code, item: it });
      });
    });
    return out;
  };

  const scopeUnits = useMemo(
    () => (scope === "sectional" ? (cat ? unitsIn(cat) : []) : unitsIn(null)),
    [scope, cat, activeItems]
  );

  const summary = useMemo(() => {
    const total = scopeUnits.length;
    const weight = scopeUnits.reduce((a, u) => a + (Number(u.item.weight) || 0), 0);
    const fine = scopeUnits.reduce((a, u) => a + fine24(u.item.weight, u.item.karat), 0);
    const read = scopeUnits.filter((u) => scanned[u.code]).length;
    const readWeight = scopeUnits.filter((u) => scanned[u.code])
      .reduce((a, u) => a + (Number(u.item.weight) || 0), 0);
    const missing = scopeUnits.filter((u) => !scanned[u.code]);
    return {
      total, weight, fine, read, readWeight,
      missing, missingCount: missing.length,
      missingWeight: missing.reduce((a, u) => a + (Number(u.item.weight) || 0), 0),
      pct: total > 0 ? (read / total) * 100 : 0,
    };
  }, [scopeUnits, scanned]);

  // ── الأقسام مع أعدادها ──
  const categories = useMemo(() => {
    const map = {};
    activeItems.forEach((it) => {
      const q = (it.units || []).filter((u) => !u.sold).length;
      if (!q) return;
      if (!map[it.categoryId]) map[it.categoryId] = { id: it.categoryId, count: 0, weight: 0, fine: 0 };
      map[it.categoryId].count += q;
      map[it.categoryId].weight += (Number(it.weight) || 0) * q;
      map[it.categoryId].fine += fine24(it.weight, it.karat) * q;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [activeItems]);

  // ── القارئ عبر البلوتوث ──
  //
  // معظم الماسحات تعمل كلوحة مفاتيح فتُدخل الكود في الحقل مباشرة —
  // وهذا يعمل دائمًا. اتصال البلوتوث لماسحات BLE التي لا تحاكي لوحة
  // مفاتيح. الحقل يبقى بديلًا حاضرًا في الحالتين.
  const connectReader = async () => {
    setBtError("");
    if (!btSupported()) {
      setBtError("هذا المتصفح لا يدعم البلوتوث — استخدم الماسح كلوحة مفاتيح");
      return;
    }
    setBtBusy(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["battery_service", "device_information", "0000ff00-0000-1000-8000-00805f9b34fb"],
      });
      setReader({ id: device.id, name: device.name || "قارئ" });
      // نستمع للفصل فلا يبقى مؤشر اتصال كاذب
      device.addEventListener?.("gattserverdisconnected", () => setReader(null));
    } catch (e) {
      setBtError(e?.name === "NotFoundError" ? "لم يُختَر جهاز" : "تعذّر الاتصال بالقارئ");
    } finally {
      setBtBusy(false);
    }
  };

  const feed = (raw) => {
    const code = String(raw || "").trim().toUpperCase();
    if (!code) return;
    const hit = scopeUnits.find((u) => String(u.code).toUpperCase() === code);
    if (!hit) {
      flashToast(`«${code}» ليست في هذا النطاق`);
      return;
    }
    if (scanned[code]) {
      flashToast("قُرئت مسبقًا");
      return;
    }
    setScanned((p) => ({ ...p, [hit.code]: true }));
  };

  // تركيز دائم على الحقل: الماسح يكتب فيه كلوحة مفاتيح
  useEffect(() => {
    if (scope && (scope === "general" || cat)) inputRef.current?.focus();
  }, [scope, cat]);

  const reset = () => { setScanned({}); setShowMissing(false); setManual(""); };

  // ── صف الملخّص: كل شيء في سطر واحد ──
  const SummaryRow = () => (
    <Card style={{ padding: 0, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {[
          { label: "بالمخزون", value: summary.total, sub: showWeight ? `${fmtW(summary.weight)} جم` : null, color: "var(--text)" },
          { label: "مقروء", value: summary.read, sub: showWeight ? `${fmtW(summary.readWeight)} جم` : null, color: "var(--good)" },
          {
            label: "متبقٍ", value: summary.missingCount,
            sub: showWeight ? `${fmtW(summary.missingWeight)} جم` : null,
            color: summary.missingCount ? "var(--bad)" : "var(--goodSolid)",
            tap: summary.missingCount > 0,
          },
        ].map((c, i) => (
          <button
            key={i}
            onClick={() => c.tap && setShowMissing(true)}
            disabled={!c.tap}
            style={{
              flex: 1, padding: "12px 6px", textAlign: "center",
              borderLeft: i < 2 ? "1px solid var(--line)" : "none",
              background: c.tap && showMissing ? "var(--panel)" : "transparent",
            }}
          >
            <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px]">{c.label}</p>
            <p style={{ color: c.color, fontFamily: "'Cairo', sans-serif", margin: 0 }} className="text-xl font-extrabold">
              {c.value}
            </p>
            {c.sub && <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{c.sub}</p>}
            {c.tap && (
              <p style={{ color: "var(--accentText)", margin: 0 }} className="text-[9px]">اضغط للتفاصيل</p>
            )}
          </button>
        ))}
      </div>
      <div style={{ height: 3, background: "var(--line)" }}>
        <div style={{ width: `${summary.pct}%`, height: "100%", background: "var(--goodSolid)", transition: "width .25s" }} />
      </div>
    </Card>
  );

  // ── القطع المتبقية ──
  const MissingList = () => (
    <>
      <div className="flex items-center justify-between mb-2">
        <span style={{ color: "var(--bad)" }} className="text-xs font-bold">
          لم تُقرأ ({summary.missingCount})
        </span>
        <button onClick={() => setShowMissing(false)}
          className="text-[10px] px-2.5 py-1 rounded-full"
          style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>
          إخفاء
        </button>
      </div>
      <div className="flex flex-col gap-2 mb-3">
        {summary.missing.slice(0, 60).map((u) => (
          <Card key={u.code} style={{ padding: 10 }}>
            <div className="flex items-center gap-2.5">
              {u.item.photo ? (
                <img src={u.item.photo} alt=""
                  style={{ width: 44, height: 44, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 44, height: 44, borderRadius: 9, flexShrink: 0,
                  background: "var(--panel)", border: "1px solid var(--line)",
                  display: "grid", placeItems: "center",
                }}>
                  <Hallmark karat={u.item.karat} size={30} />
                </div>
              )}
              <div className="flex-1">
                <p style={{ color: "var(--text)", fontFamily: "monospace", margin: 0 }} className="text-xs font-bold">
                  {u.code}
                </p>
                <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">
                  {categoryLabel(u.item.categoryId)} · عيار {u.item.karat}
                  {showWeight ? ` · ${fmtW(u.item.weight)} جم` : ""}
                </p>
                {u.item.sku && (
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{u.item.sku}</p>
                )}
              </div>
              <button onClick={() => feed(u.code)}
                className="text-[10px] px-2.5 py-1.5 rounded-full"
                style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                تأكيد يدوي
              </button>
            </div>
          </Card>
        ))}
        {summary.missingCount > 60 && (
          <p style={{ color: "var(--text3)" }} className="text-[10px]">
            و{summary.missingCount - 60} قطعة أخرى
          </p>
        )}
      </div>
    </>
  );

  // ── شريط القارئ ──
  const ReaderBar = () => (
    <Card style={{ padding: 11, marginBottom: 12, border: `1px solid ${reader ? "var(--goodLine)" : "var(--edge)"}` }}>
      <div className="flex items-center gap-2 mb-2">
        <Scan size={15} color={reader ? "var(--goodSolid)" : "var(--accentSoft)"} />
        <span style={{ color: reader ? "var(--goodSolid)" : "var(--text)" }} className="text-xs font-bold flex-1">
          {reader ? `متصل: ${reader.name}` : "القارئ غير متصل"}
        </span>
        {reader ? (
          <button onClick={() => setReader(null)}
            className="text-[10px] px-2.5 py-1 rounded-full"
            style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
            فصل
          </button>
        ) : (
          <button onClick={connectReader} disabled={btBusy}
            className="text-[10px] px-3 py-1.5 rounded-full"
            style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
            {btBusy ? "جارٍ..." : "اتصال بلوتوث"}
          </button>
        )}
      </div>
      {btError && <p style={{ color: "var(--bad)" }} className="text-[10px] mb-2">{btError}</p>}
      <input
        ref={inputRef}
        style={{ ...inputStyle, marginBottom: 0 }}
        value={manual}
        onChange={(e) => setManual(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { feed(manual); setManual(""); }
        }}
        placeholder="امسح الرقاقة أو اكتب الكود ثم Enter"
        autoComplete="off"
      />
      <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
        معظم الماسحات تعمل كلوحة مفاتيح — تُدخل الكود هنا مباشرة بلا اتصال.
      </p>
    </Card>
  );

  // ═══ العرض ═══
  return (
    <div className="px-4 pt-6">
      <h1 style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)" }} className="text-2xl font-extrabold mb-4">
        الجرد
      </h1>

      {/* قفل المخزون */}
      <Card style={{ padding: 14, marginBottom: 16, border: `1px solid ${lock ? "var(--accentLine)" : "var(--line)"}` }}>
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: lock ? "var(--accent)" : "var(--text)" }} className="text-sm font-bold flex items-center gap-1.5">
            <Lock size={14} /> {lock ? "المخزون مقفل" : "قفل المخزون للجرد"}
          </span>
        </div>
        <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
          {lock
            ? `بدأه ${lock.startedBy}. البيع والتحويلات موقوفة حتى فتح القفل.`
            : "يوقف البيع والتحويلات أثناء العدّ — وإلا ظهر البيع عجزًا."}
        </p>
        <button onClick={() => onToggleLock(!lock)}
          className="w-full py-2.5 rounded-xl text-xs font-bold"
          style={lock
            ? { background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }
            : { background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
          {lock ? "فتح القفل واستئناف البيع" : "قفل المخزون وبدء الجرد"}
        </button>
      </Card>

      {/* اختيار النطاق */}
      {!scope && (
        <>
          <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">اختر نوع الجرد</p>
          <div className="flex flex-col gap-2 mb-4">
            {[
              { id: "sectional", label: "جرد الأقسام", hint: "قسمًا قسمًا — أسهل للتوزيع بين العاملين", icon: Grid },
              { id: "general", label: "جرد شامل", hint: "المخزون كله دفعة واحدة", icon: Warehouse },
            ].map((o) => {
              const Icon = o.icon;
              return (
                <button key={o.id} onClick={() => { reset(); onChooseScope(o.id); }} className="w-full text-right">
                  <Card style={{ padding: 14 }}>
                    <div className="flex items-center gap-3">
                      <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: "var(--panel)", border: "1px solid var(--line)", display: "grid", placeItems: "center" }}>
                        <Icon size={19} color="var(--accentText)" />
                      </div>
                      <div className="flex-1">
                        <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif", margin: 0 }} className="text-sm font-bold">
                          {o.label}
                        </p>
                        <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">{o.hint}</p>
                      </div>
                      <ChevronLeft size={15} color="var(--text3)" style={{ transform: "rotate(180deg)" }} />
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>

          {/* إعداد الوزن */}
          {onSaveSettings && (
            <Card style={{ padding: 12, marginBottom: 16 }}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ color: "var(--text)" }} className="text-xs font-bold">إظهار الوزن أثناء الجرد</span>
                <button
                  onClick={() => onSaveSettings({ ...settings, stocktakeShowWeight: !showWeight })}
                  style={{ width: 44, height: 24, borderRadius: 12, position: "relative",
                    background: showWeight ? "var(--goodSolid)" : "var(--edge)", transition: "background .2s" }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--text)",
                    position: "absolute", top: 3, right: showWeight ? 23 : 3, transition: "right .2s" }} />
                </button>
              </div>
              <p style={{ color: "var(--text2)" }} className="text-[11px]">
                {showWeight
                  ? "العدد والوزن معًا — الفرق بالوزن يكشف ما لا يكشفه العدد."
                  : "العدد وحده — أسرع، والعدّاد يعدّ بدل أن يقارن."}
              </p>
            </Card>
          )}

          {audits.length > 0 && (
            <>
              <p style={{ color: "var(--text2)" }} className="text-xs mb-2">آخر عمليات الجرد</p>
              <div className="flex flex-col gap-2">
                {audits.slice(0, 5).map((a) => (
                  <Card key={a.id} style={{ padding: 11 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text)" }} className="text-xs">
                        {a.scope === "sectional" ? "جرد أقسام" : "جرد شامل"}
                      </span>
                      <span style={{ color: (a.diffCount || 0) === 0 ? "var(--goodSolid)" : "var(--bad)" }} className="text-xs font-bold">
                        {(a.diffCount || 0) === 0 ? "مطابق" : `فرق ${a.diffCount}`}
                      </span>
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                      {new Date(a.date).toLocaleString("en-GB")} · {a.createdBy || ""}
                    </p>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* جرد الأقسام — اختيار القسم */}
      {scope === "sectional" && !cat && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span style={{ color: "var(--accent)" }} className="text-xs font-bold">اختر القسم</span>
            <button onClick={() => { reset(); onCancelScope(); }}
              className="text-[10px] px-2.5 py-1 rounded-full"
              style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
              رجوع
            </button>
          </div>
          {categories.length === 0 ? (
            <EmptyState icon={<Package size={30} color="var(--accentText)" />} title="لا أصناف بالمخزون" sub="" />
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {categories.map((c) => {
                const done = stocktake.sectionalStatus?.[c.id] === "done";
                return (
                  <button key={c.id} onClick={() => { reset(); onSelectCategory(c.id); }} className="w-full text-right">
                    <Card style={{ padding: 12, border: `1px solid ${done ? "var(--goodLine)" : "var(--line)"}` }}>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold flex-1">
                          {categoryLabel(c.id)}
                        </span>
                        {done && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
                            تم
                          </span>
                        )}
                        <span style={{ color: "var(--accent)" }} className="text-sm font-bold">{c.count}</span>
                        <span style={{ color: "var(--text3)" }} className="text-[10px]">قطعة</span>
                      </div>
                      {showWeight && (
                        <p style={{ color: "var(--text2)" }} className="text-[10px] mt-0.5">
                          {fmtW(c.weight)} جم · {fmtW(c.fine)} جم عيار 24
                        </p>
                      )}
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
          {Object.keys(stocktake.sectionalStatus || {}).length > 0 && (
            <button onClick={() => { reset(); onEndSectional(); }}
              className="w-full py-3 rounded-xl font-bold"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
              إنهاء الجرد وحفظ النتيجة
            </button>
          )}
        </>
      )}

      {/* العدّ — قسم أو شامل */}
      {((scope === "sectional" && cat) || scope === "general") && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
              {scope === "general" ? "جرد شامل" : categoryLabel(cat)}
            </span>
            <button onClick={() => { reset(); scope === "general" ? onCancelScope() : onBackToList(); }}
              className="text-[10px] px-2.5 py-1 rounded-full"
              style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
              رجوع
            </button>
          </div>

          <ReaderBar />
          <SummaryRow />

          {showMissing && summary.missingCount > 0 && <MissingList />}

          {summary.missingCount === 0 && summary.total > 0 && (
            <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--goodLine)" }}>
              <p style={{ color: "var(--good)" }} className="text-xs font-bold flex items-center gap-1.5">
                <Check size={14} /> كل القطع قُرئت — مطابق
              </p>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={reset}
              className="py-2.5 rounded-xl text-xs font-bold"
              style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
              تصفير القراءة
            </button>
            <button
              onClick={() => {
                const payload = {
                  scope, categoryId: cat || null,
                  expectedCount: summary.total, countedCount: summary.read,
                  expectedWeight: summary.weight, countedWeight: summary.readWeight,
                  missing: summary.missing.map((u) => u.code),
                  diffCount: summary.missingCount,
                };
                if (scope === "general") onFinishGeneral(payload);
                else onFinishSection(payload);
                reset();
              }}
              className="py-2.5 rounded-xl text-xs font-bold"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
              {scope === "general" ? "إنهاء الجرد" : "إنهاء القسم"}
            </button>
          </div>
        </>
      )}
      <div style={{ height: 20 }} />
    </div>
  );
}


// ============================================================
// Scrap gold (الكسر)
// ============================================================

export { StocktakeSubPage };
