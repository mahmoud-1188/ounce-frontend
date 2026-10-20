import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Grid, Lock, Package, Scan, Warehouse } from "lucide-react";
import { fine24, fmtW } from "../core/money.js";
import { btSupported, categoryLabel, epcHexToCode, inputStyle, itemLabel } from "../domain/helpers.js";
import { printStocktakeSheet } from "../domain/officialDocs.js";
import { CameraScanner } from "../ui/CameraScanner.jsx";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Hallmark } from "../ui/Hallmark.jsx";

// أطول فجوةٍ بين حرفين يكتبهما القارئ — ما فوقها كتابةٌ باليد
const READER_MAX_GAP_MS = 120;

function StocktakeSubPage({ lock, onToggleLock, sellDuring = false,
  activeItems,
  allItems = [],
  onSoldFound,
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
  onStartFull = null, branchInfo = {}, lots = [], suppliers = [], canPrintSheet = false,
}) {
  // وضع المخزون: لا بيع يُوقَف ولا قيد يُرحَّل، فالنصوص تقول «يُخرَج من المخزون» لا «يُقيَّد عجزًا»
  const inventoryOnly = settings.appMode === "inventory";
  // ── إعداد إظهار الوزن ──
  //
  // بعض المحلات تجرد بالعدد وحده: الوزن يبطئ العدّاد ويجعله يقارن بدل
  // أن يعدّ. وبعضها يريده لأن الفرق بالوزن يكشف ما لا يكشفه العدد.
  // القرار للمدير من الإعدادات.
  const showWeight = settings.stocktakeShowWeight !== false;

  const [scanned, setScanned] = useState({});   // { unitCode: true }
  // قطعٌ مسجّلة مباعة قرأها العدّ على الرفّ (للمراجعة لا زيادة) · ورموزٌ لا يعرفها النظام
  const [soldFound, setSoldFound] = useState([]);  // [code]
  const [unknown, setUnknown] = useState([]);      // [code]
  const [batch, setBatch] = useState("");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [manual, setManual] = useState("");
  const [reader, setReader] = useState(null);   // جهاز القراءة المتصل
  const [btBusy, setBtBusy] = useState(false);
  const [btError, setBtError] = useState("");
  const inputRef = useRef(null);
  // الجرد بالقارئ وحده: فجوةٌ بين الحروف أطول من القارئ تعني كتابةً باليد فتُرفض
  const typeGap = useRef({ last: 0, slow: false });
  const [cam, setCam] = useState(false);
  // رقائق قرأها القارئ من رفوف الجيران أو أقسامٍ غير مختارة — تُتجاهل بصمت وتُعدّ
  const [ignoredN, setIgnoredN] = useState(0);
  const [pickCats, setPickCats] = useState([]);
  // { title, codes } لورقة ما لم يُقرأ في جردٍ محفوظ
  const [savedMissing, setSavedMissing] = useState(null);
  const [undo, setUndo] = useState(null);
  useEffect(() => { if (!undo) return undefined; const t = setTimeout(() => setUndo(null), 8000); return () => clearTimeout(t); }, [undo]);

  const scope = stocktake.scope;
  const cat = stocktake.activeCategory;

  // ── وحدات النطاق الحالي ──
  const catIds = cat ? (Array.isArray(cat) ? cat : [cat]) : [];
  // المعلّقة خارج الرفّ لا تُعدّ ناقصة، وبقايا الأطقم غير المكوَّدة تُعدّ بوزنها لا برمزها
  const unitsIn = (ids) => {
    const out = [];
    activeItems.forEach((it) => {
      if (it.remnant) return;
      if (ids && ids.length && !ids.includes(it.categoryId)) return;
      (it.units || []).forEach((u) => {
        if (!u.sold && !u.held) out.push({ code: u.code, item: it });
      });
    });
    return out;
  };

  const scopeUnits = useMemo(
    () => (scope === "sectional" ? (catIds.length ? unitsIn(catIds) : []) : unitsIn(null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, catIds.join("+"), activeItems]
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

  // قارئ RFID مصدرًا للعدّ (المرجع 5.2.0: StocktakeRfidSource): القارئ بوضع لوحة المفاتيح يكتب EPC لا الرمز.
  //   الوسم المربوط يُعرف بـEPC المحفوظ على القطعة، وغير المربوط بترميز الرمز في EPC نفسه.
  //   ودفعةٌ من القارئ (عدّة أسطر أو فواصل) تُعدّ كلّها بضغطةٍ واحدة.
  const resolveCode = (raw) => {
    const up = String(raw || "").trim().toUpperCase();
    if (!up) return "";
    const all = allItems.length ? allItems : activeItems;
    if (all.some((it) => (it.units || []).some((u) => String(u.code).toUpperCase() === up))) return up;
    for (const it of all) {
      const u = (it.units || []).find((x) => x.epc && String(x.epc).toUpperCase() === up);
      if (u) return String(u.code).toUpperCase();
    }
    if (/^[0-9A-F]{8,}$/.test(up)) {
      const decoded = epcHexToCode(up).toUpperCase();
      if (decoded && all.some((it) => (it.units || []).some((u) => String(u.code).toUpperCase() === decoded))) return decoded;
    }
    return up;
  };
  const feed = (raw) => {
    const parts = String(raw || "").split(/[\s,;]+/).filter(Boolean);
    if (parts.length > 1) { parts.forEach((x) => feedOne(x, { quiet: true })); return; }
    feedOne(raw);
  };
  const feedOne = (raw, { quiet = false } = {}) => {
    const code = resolveCode(raw);
    if (!code) return;
    const hit = scopeUnits.find((u) => String(u.code).toUpperCase() === code);
    if (!hit) {
      // ⚠ قطعةٌ مسجّلة مباعة وُجدت على الرفّ: بند مراجعة لا زيادة (قرار المالك 2026-09-29)
      const sold = allItems.some((it) => (it.units || []).some((u) => u.sold && String(u.code).toUpperCase() === code));
      if (sold) {
        setSoldFound((p) => (p.includes(code) ? p : [...p, code]));
        if (!quiet) flashToast(`«${code}» مسجّلةٌ مباعة — تُوقف للمراجعة، لا تُعدّ زيادة`);
        return;
      }
      const held = allItems.some((it) => (it.units || []).some((u) => u.held && String(u.code).toUpperCase() === code));
      if (held) { if (!quiet) flashToast(`«${code}» معلّقة — خارج العدّ`); return; }
      const known = allItems.some((it) => (it.units || []).some((u) => String(u.code).toUpperCase() === code));
      if (known) { setIgnoredN((n) => n + 1); if (!quiet) flashToast(`«${code}» ليست في هذا النطاق`); return; }
      setUnknown((p) => (p.includes(code) ? p : [...p, code]));
      if (!quiet) flashToast(`«${code}» رمزٌ لا يعرفه النظام`);
      return;
    }
    if (scanned[code]) {
      if (!quiet) flashToast("قُرئت مسبقًا");
      return;
    }
    setScanned((p) => ({ ...p, [hit.code]: true }));
  };

  // تركيز دائم على الحقل: الماسح يكتب فيه كلوحة مفاتيح
  useEffect(() => {
    if (scope && (scope === "general" || cat)) inputRef.current?.focus();
  }, [scope, cat]);

  const reset = () => { setScanned({}); setSoldFound([]); setUnknown([]); setIgnoredN(0); setConfirmFinish(false); setShowMissing(false); setManual(""); setUndo(null); };
  // تصفير القراءة يُتراجع عنه خلال ثوانٍ — ضغطةٌ خاطئة لا تمسح عدّ ساعة
  const resetWithUndo = () => {
    const prev = { scanned, soldFound, unknown };
    reset();
    if (Object.keys(prev.scanned).length || prev.soldFound.length) setUndo(prev);
  };
  const remnants = useMemo(() => (allItems.length ? allItems : activeItems).filter((it) => it.remnant && !it.voided
    && (!catIds.length || scope !== "sectional" || catIds.includes(it.categoryId))), [allItems, activeItems, scope, catIds.join("+")]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⚠ إنهاء العدّ بالمسح يحفظ فروقه الحقيقية (كان يُحفظ «مطابقًا» أيًّا كان المقروء):
  //   الناقص بأعيانه يُسوّى بمعالج الجرد نفسه (عجزٌ بتكلفة القطعة في الدفترين)،
  //   والمبيعة الموجودة بنود مراجعة، والمجهول يُذكر في السجل.
  const finish = () => {
    const payload = {
      kind: "scan",
      scope, categoryId: cat || null,
      expectedCount: summary.total, countedCount: summary.read,
      expectedWeight: summary.weight, countedWeight: summary.readWeight,
      missing: summary.missing.map((u) => ({ code: u.code, itemId: u.item.id })),
      soldFound, unknown,
      diffCount: summary.missingCount,
    };
    if (scope === "general") { onFinishGeneral(payload); if (lock && onToggleLock) onToggleLock(false); }
    else onFinishSection(payload);
    if (soldFound.length) onSoldFound?.(soldFound);
    reset();
  };
  const hasDiffs = summary.missingCount > 0 || soldFound.length > 0 || unknown.length > 0;

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

  // ── ورقة القطع غير المقروءة: صورتها ووصفها ودفعتها ومورّدها لتُبحث على الرفّ ──
  const lotBy = useMemo(() => new Map((lots || []).map((l) => [l.id, l])), [lots]);
  const supBy = useMemo(() => new Map((suppliers || []).map((x) => [x.id, x])), [suppliers]);
  const unitsForCodes = (codes = []) => {
    const want = new Set(codes.map((c) => String(c).toUpperCase()));
    const out = [];
    for (const it of allItems.length ? allItems : activeItems) for (const u of it.units || []) {
      if (want.has(String(u.code).toUpperCase())) out.push({ code: u.code, item: it });
    }
    return out;
  };
  const MissingList = (units, title, onClose) => (
    <div data-missing-sheet>
      <div className="flex items-center justify-between mb-2">
        <span style={{ color: "var(--bad)" }} className="text-xs font-bold">
          {title} ({units.length})
        </span>
        <button onClick={onClose}
          className="text-[11px] px-2.5 py-1 rounded-full"
          style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)", minHeight: 32 }}>
          إخفاء
        </button>
      </div>
      <div className="flex flex-col gap-2 mb-3">
        {units.slice(0, 80).map((u) => {
          const lot = u.item.lotId ? lotBy.get(u.item.lotId) : null;
          const supplier = lot ? (supBy.get(lot.supplierId)?.name || "") : "";
          const photo = u.item.photoUrl || u.item.photoDataUrl || u.item.photo || null;
          return (
            <Card key={u.code} style={{ padding: 10 }}>
              <div className="flex items-center gap-2.5">
                {photo ? (
                  <img src={photo} alt=""
                    style={{ width: 52, height: 52, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 52, height: 52, borderRadius: 9, flexShrink: 0,
                    background: "var(--panel)", border: "1px solid var(--line)",
                    display: "grid", placeItems: "center",
                  }}>
                    <Hallmark karat={u.item.karat} size={30} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p style={{ color: "var(--text)", fontFamily: "monospace", margin: 0 }} className="text-xs font-bold" dir="ltr">
                    {u.code}
                  </p>
                  <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">
                    {itemLabel(u.item)}
                    {showWeight ? ` · ${fmtW(u.item.weight)} جم${Number(u.item.stonesWeight) > 0 ? ` (فصوص ${fmtW(u.item.stonesWeight)})` : ""}` : ""}
                  </p>
                  {(lot || supplier || u.item.sku) && (
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">
                      {[lot?.ref && `دفعة ${lot.ref}`, supplier && `المورّد ${supplier}`, u.item.sku].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {units.length > 80 && (
          <p style={{ color: "var(--text3)" }} className="text-[11px]">
            و{units.length - 80} قطعة أخرى
          </p>
        )}
      </div>
    </div>
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
      {/* الجرد بالقارئ وحده: الكتابة باليد (فجوات بين الحروف) تُرفض، ولا تأكيد يدويًّا لقطعةٍ لم تُقرأ */}
      <input
        ref={inputRef}
        style={{ ...inputStyle, marginBottom: 0 }}
        value={manual}
        onChange={(e) => setManual(e.target.value)}
        onKeyDown={(e) => {
          const now = Date.now();
          const g = typeGap.current;
          if (e.key === "Enter") {
            const slow = g.slow; g.last = 0; g.slow = false;
            const code = manual; setManual("");
            if (slow) { flashToast("⚠ الجرد بالقارئ وحده — الكتابة باليد غير مقبولة. امسح الرقاقة أو الملصق"); return; }
            feed(code);
            return;
          }
          if (e.key.length === 1) { if (g.last && now - g.last > READER_MAX_GAP_MS) g.slow = true; g.last = now; }
          else if (e.key === "Backspace" || e.key === "Delete") g.slow = true;
        }}
        placeholder="امسح الرقاقة بالقارئ"
        autoComplete="off"
        data-reader-only
      />
      <button onClick={() => setCam(true)} data-stock-cam
        className="w-full py-2.5 rounded-xl text-[11px] font-bold mt-2"
        style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
        امسح بالكاميرا
      </button>
      {cam && <CameraScanner onScan={(code) => feed(code)} onClose={() => setCam(false)} />}
      <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
        الجرد بالقارئ وحده: معظم الماسحات تعمل كلوحة مفاتيح — تُدخل الكود هنا مباشرة بلا اتصال. لا إدخال باليد. وقارئ RFID يُقرأ منه EPC الوسم مباشرةً.
      </p>
      <details className="mt-2">
        <summary style={{ color: "var(--accentText)" }} className="text-[11px] cursor-pointer">دفعة من قارئ RFID (لصق عدّة وسوم)</summary>
        <textarea value={batch} onChange={(e) => setBatch(e.target.value)} rows={4} dir="ltr"
          placeholder="وسمٌ في كل سطر (EPC أو رمز)" style={{ ...inputStyle, marginTop: 6, fontFamily: "monospace", fontSize: 11 }} />
        <button onClick={() => { const n = batch.split(/[\s,;]+/).filter(Boolean).length; feed(batch); setBatch(""); flashToast(`عُدّ ${n} وسمًا من الدفعة`); }}
          disabled={!batch.trim()} className="w-full py-2 rounded-xl text-[11px] font-bold mt-1"
          style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)", opacity: batch.trim() ? 1 : 0.5 }}>
          عُدّ الدفعة
        </button>
      </details>
    </Card>
  );

  // ═══ العرض ═══
  return (
    <div className="px-4 pt-6">
      <h1 style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)" }} className="text-2xl font-extrabold mb-4">
        الجرد
      </h1>

      {savedMissing && (
        <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--badLine)" }}>
          {MissingList(unitsForCodes(savedMissing.codes), savedMissing.title, () => setSavedMissing(null))}
        </Card>
      )}
      {/* بقايا أطقم لم تُكوَّد: تُعدّ بوزنها، فلا يظهر رمزها القديم عجزًا ولا زيادة */}
      {remnants.length > 0 && (
        <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)", background: "var(--accentBg)" }}>
          <p data-remnant-warn style={{ color: "var(--accent)", margin: 0 }} className="text-xs font-bold">
            ⚠ {remnants.length} بقايا أطقم لم تُكوَّد ({fmtW(remnants.reduce((x, r) => x + (Number(r.weight) || 0), 0))} جم) — تُعدّ بوزنها، لا عجزًا ولا زيادةً للرمز القديم. كوِّدها من «التكويد».
          </p>
        </Card>
      )}

      {/* قفل المخزون: جرد المحل يقفل البيع، وجرد القسم لا يقفله */}
      {lock && (
        <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--accent)", margin: 0 }} className="text-xs font-bold flex items-center gap-1.5">
            <Lock size={14} /> {inventoryOnly ? "جرد المحل جارٍ" : sellDuring ? "جرد المحل جارٍ — البيع مسموحٌ بالإعداد، والمبيع أثناء العدّ يُطابَق" : "المخزون مقفل للجرد — البيع موقوف"}
          </p>
          <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[11px]">بدأه {lock.startedBy}</p>
          {onToggleLock && !inventoryOnly && (
            <button type="button" onClick={() => onToggleLock(false)} className="w-full mt-2 rounded-xl text-xs font-bold" data-unlock-sales
              style={{ minHeight: 44, background: "var(--panel)", color: "var(--goodSolid)", border: "1px solid var(--goodLine)" }}>افتح البيع دون إنهاء الجرد</button>
          )}
        </Card>
      )}

      {/* اختيار النطاق */}
      {!scope && (
        <>
          {onStartFull && (
            <>
              <button type="button" data-stock-full onClick={() => { reset(); lock ? onChooseScope("general") : onStartFull(); }}
                className="w-full py-3 rounded-xl font-bold"
                style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
                {lock ? "تابع جرد المحل" : inventoryOnly || sellDuring ? "ابدأ جرد المحل" : "ابدأ جرد المحل — يوقف البيع"}
              </button>
              <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1 mb-3">{inventoryOnly ? "كل القطع دفعةً واحدة — والعدّ يبدأ فورًا" : sellDuring ? "يقفل التحويل حتى تُنهي — والبيع مسموح (إعداد) — والعدّ يبدأ فورًا" : "يقفل البيع والتحويل حتى تُنهي — والعدّ يبدأ فورًا"}</p>
            </>
          )}
          {!onStartFull && <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">اختر نوع الجرد</p>}
          <div className="flex flex-col gap-2 mb-4">
            {[
              { id: "sectional", label: onStartFull && !lock && !inventoryOnly ? "جرد قسم — لا يوقف البيع" : "جرد الأقسام", hint: "قسمًا قسمًا — أسهل للتوزيع بين العاملين", icon: Grid },
              !onStartFull && { id: "general", label: "جرد شامل", hint: "المخزون كله دفعة واحدة", icon: Warehouse },
            ].filter(Boolean).map((o) => {
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
            {onStartFull && !lock && !inventoryOnly && (
              <button type="button" data-stock-general-nolock onClick={() => { reset(); onChooseScope("general"); }} className="text-[11px] font-bold"
                style={{ color: "var(--text2)", textDecoration: "underline", minHeight: 44 }}>أو جرد شامل دون إيقاف البيع</button>
            )}
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
                    <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                      {new Date(a.date).toLocaleString("en-GB")} · {a.createdBy || ""}{a.scan ? " · بالقارئ" : ""}
                    </p>
                    {canPrintSheet && (
                      <button type="button" data-audit-sheet={a.id} onClick={() => { if (!printStocktakeSheet(a, { items: allItems.length ? allItems : activeItems, info: branchInfo })) flashToast("اسمح بالنوافذ المنبثقة للطباعة"); }}
                        data-help="يطبع كشف الجرد الرسمي لهذه العملية: النظام والمعدود والفرق لكل صنف، وتواقيع لجنة الجرد."
                        className="w-full rounded-xl text-[11px] font-bold mt-2" style={{ minHeight: 40, background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                        كشف الجرد الرسمي
                      </button>
                    )}
                    {(a.scan?.missing || []).length > 0 && (
                      <button type="button" data-audit-missing={a.scan.missing.length}
                        onClick={() => setSavedMissing({ title: `لم تُقرأ في جرد ${new Date(a.date).toLocaleDateString("en-GB")}`, codes: a.scan.missing })}
                        className="w-full rounded-xl text-[11px] font-bold mt-2"
                        style={{ minHeight: 40, background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}>
                        لم تُقرأ {a.scan.missing.length} — اضغط لترى كل قطعة بصورتها
                      </button>
                    )}
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
                  <button key={c.id} onClick={() => setPickCats((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} className="w-full text-right"
                    role="checkbox" aria-checked={pickCats.includes(c.id)} aria-label={`اختر قسم ${categoryLabel(c.id)}`} data-stock-cat={c.id}>
                    <Card style={{ padding: 12, border: `1px solid ${pickCats.includes(c.id) ? "var(--accent)" : done ? "var(--goodLine)" : "var(--line)"}` }}>
                      <div className="flex items-center gap-2">
                        <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          background: pickCats.includes(c.id) ? "var(--accent)" : "transparent", border: `1px solid ${pickCats.includes(c.id) ? "var(--accent)" : "var(--accentLine)"}` }}>
                          {pickCats.includes(c.id) && <Check size={13} color="var(--panel)" />}
                        </span>
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
              <button disabled={!pickCats.length} onClick={() => { reset(); onSelectCategory(pickCats.length === 1 ? pickCats[0] : pickCats); setPickCats([]); }}
                data-stock-start className="w-full py-3 rounded-xl font-bold"
                style={{ background: pickCats.length ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: pickCats.length ? "var(--panel)" : "var(--text3)" }}>
                {pickCats.length ? `ابدأ جرد ${pickCats.length === 1 ? `قسم ${categoryLabel(pickCats[0])}` : `${pickCats.length} أقسام`}` : "اختر قسمًا أو أكثر"}
              </button>
            </div>
          )}
          {Object.keys(stocktake.sectionalStatus || {}).length > 0 && (
            <button onClick={() => { reset(); onEndSectional(); if (lock && onToggleLock) onToggleLock(false); }}
              className="w-full py-3 rounded-xl font-bold"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
              {lock && onToggleLock && !inventoryOnly ? "إنهاء الجرد وفتح البيع" : "إنهاء الجرد وحفظ النتيجة"}
            </button>
          )}
        </>
      )}

      {/* العدّ — قسم أو شامل */}
      {((scope === "sectional" && cat) || scope === "general") && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
              {scope === "general" ? "جرد شامل" : catIds.map((c) => categoryLabel(c)).join(" · ")}
            </span>
            <button onClick={() => { reset(); scope === "general" ? onCancelScope() : onBackToList(); }}
              className="text-[10px] px-2.5 py-1 rounded-full"
              style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
              رجوع
            </button>
          </div>

          {ReaderBar()}
          {SummaryRow()}

          {ignoredN > 0 && (
            <p style={{ color: "var(--text3)", margin: "0 0 8px" }} className="text-[11px]" data-ignored={ignoredN}>
              تُجوهلت {ignoredN} رقاقة من قسمٍ غير مختار — لا تُعدّ ولا تُحفظ
            </p>
          )}
          {undo && (
            <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-xl" style={{ background: "var(--field)", border: "1px solid var(--line)" }}>
              <span className="text-[11px]" style={{ color: "var(--text2)" }}>صُفّرت القراءة</span>
              <button type="button" data-stock-undo onClick={() => { setScanned((cur) => ({ ...undo.scanned, ...cur })); setSoldFound((cur) => [...new Set([...undo.soldFound, ...cur])]); setUnknown((cur) => [...new Set([...undo.unknown, ...cur])]); setUndo(null); }}
                className="text-[11px] font-bold px-3 rounded-full" style={{ minHeight: 32, color: "var(--accent)", border: "1px solid var(--accentLine)" }}>تراجع</button>
            </div>
          )}
          {showMissing && summary.missingCount > 0 && MissingList(summary.missing, "لم تُقرأ", () => setShowMissing(false))}

          {summary.missingCount === 0 && summary.total > 0 && (
            <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--goodLine)" }}>
              <p style={{ color: "var(--good)" }} className="text-xs font-bold flex items-center gap-1.5">
                <Check size={14} /> كل القطع قُرئت — مطابق
              </p>
            </Card>
          )}

          {(soldFound.length > 0 || unknown.length > 0) && (
            <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--warnLine)" }}>
              {soldFound.length > 0 && (
                <p style={{ color: "var(--text)" }} className="text-xs font-bold">
                  {soldFound.length} قطعة مسجّلة مباعة وُجدت على الرفّ — للمراجعة
                  <span style={{ color: "var(--text3)" }} className="block text-[10px] font-normal mt-0.5">{soldFound.join(" · ")}</span>
                </p>
              )}
              {unknown.length > 0 && (
                <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                  رموزٌ لا يعرفها النظام ({unknown.length}): {unknown.slice(0, 20).join(" · ")}
                </p>
              )}
            </Card>
          )}

          {confirmFinish && (
            <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--text)" }} className="text-xs font-bold mb-1">احفظ الجرد بفروقه؟</p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2 leading-6">
                مطابق {summary.read} · {summary.missingCount > 0 ? (
                  <button type="button" data-finish-missing={summary.missingCount} onClick={() => setShowMissing(true)}
                    className="font-bold underline" style={{ color: "var(--bad)", minHeight: 32 }}>ناقص {summary.missingCount}{showWeight ? ` (${fmtW(summary.missingWeight)} جم)` : ""} — اضغط للتفاصيل</button>
                ) : <b>ناقص 0</b>}
                {unknown.length > 0 ? ` · غير معروف ${unknown.length} (يُحفظ للمراجعة)` : ""}
              </p>
              <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2 leading-6">
                {inventoryOnly
                  ? "الناقص يُخرَج من المخزون بلا قيد — وضع المخزون. والمعلّقة لا تُعدّ ناقصة."
                  : "الناقص يُقيَّد عجزًا بتكلفة القطعة في الدفترين — كالجرد اليدوي. والمعلّقة لا تُعدّ عجزًا."}
                {soldFound.length > 0 ? " والمباعة التي وُجدت لا تُسوّى ولا تُرحَّل — تُوقف لقرار المدير: البيع صحيح · إرجاع البيع · إضافة كقطعة جديدة." : ""}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setConfirmFinish(false)} className="py-2 rounded-xl text-xs font-bold"
                  style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>تابع العدّ</button>
                <button onClick={finish} className="py-2 rounded-xl text-xs font-bold"
                  style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>احفظ الجرد بفروقه</button>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={resetWithUndo}
              className="py-2.5 rounded-xl text-xs font-bold"
              style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
              تصفير القراءة
            </button>
            <button
              onClick={() => (hasDiffs ? setConfirmFinish(true) : finish())}
              className="py-2.5 rounded-xl text-xs font-bold"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
              {scope === "general" ? (lock && onToggleLock && !inventoryOnly ? "إنهاء الجرد وفتح البيع" : "إنهاء الجرد") : "إنهاء القسم"}
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
