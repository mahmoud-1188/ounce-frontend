import React, { useMemo, useState } from "react";
import { Check, Receipt, RotateCcw, Trash2 } from "lucide-react";
import { fmt, fmtMoney, fmtW } from "../core/money.js";
import { EXCHANGE_SETTLE, REFUND_TARGETS, RETURN_REASONS } from "../core/workflow.js";
import { accountByCode } from "../domain/accountByCode.js";
import { buildReturnJournal } from "../domain/buildReturnJournal.js";
import { computeExchangeAmounts } from "../domain/computeExchangeAmounts.js";
import { computeReturnAmounts } from "../domain/computeReturnAmounts.js";
import { findSoldUnit } from "../domain/findSoldUnit.js";
import { inputStyle, itemLabel } from "../domain/helpers.js";
import { suggestedUnitPrice } from "../domain/suggestedUnitPrice.js";
import { validateExchangeRequest } from "../domain/validateExchangeRequest.js";
import { validateReturnRequest } from "../domain/validateReturnRequest.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { ScanField } from "../ui/ScanField.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function SalesReturnPage({
  sales = [], returns = [], items = [], openDay, stocktakeLock,
  currency, taxRate = 0, price24 = 0, appSettings = {}, onProcess, onExchange = null, onBack,
  initialSaleId = null, initialMode = "return",
}) {
  const [mode, setMode] = useState(initialMode === "exchange" ? "exchange" : "return");   // "return" | "exchange"
  const [query, setQuery] = useState("");
  // الباب الرابع: من تفاصيل الفاتورة في سجل المبيعات — الفاتورة محدَّدة سلفًا
  const [hit, setHit] = useState(() => {
    const sale0 = initialSaleId ? sales.find((x) => x.id === initialSaleId) : null;
    return sale0 ? { found: true, sale: sale0, lineIndex: null } : null;
  });
  // ⚠ الزبون قد يعود بلا ملصقٍ وبلا فاتورة، والبائع يعرف اسمه أو يومه —
  //   فالفاتورة تُختار أيضًا من قائمة المبيعات.
  const [browse, setBrowse] = useState("");
  const [showList, setShowList] = useState(false);
  const [picked, setPicked] = useState([]);      // أسطر مختارة
  const [reasonId, setReasonId] = useState("changed_mind");
  const [target, setTarget] = useState("daily_cash");
  const [note, setNote] = useState("");
  const [err, setErr] = useState([]);
  const [busy, setBusy] = useState(false);

  // ── الاستبدال: القطع الجديدة وطريقة تسوية الفرق ──
  const [newLines, setNewLines] = useState([]);   // [{ itemId, unitCode, name, karat, weight, unitPrice, quantity }]
  const [newQuery, setNewQuery] = useState("");
  const [settle, setSettle] = useState("cash");

  // ⚠ لا حاجة لتركيز يدوي بعد: ScanField يستخدم useWedgeScanner
  // (استماعٌ على مستوى الصفحة كلها لدفقات لوحة المفاتيح السريعة من
  // القارئ)، فمسح البطاقة يعمل بصرف النظر عن أي عنصرٍ يحمل التركيز
  // فعليًا — بعكس الحقل الخام السابق الذي كان يفقد المسح بفقدانه.

  // ⚠ بطاقة RFID تحمل EPC حقيقيًا مختلفًا عن الكود المطبوع على الفاتورة
  // (item_units.epc — migration 014) — findSoldUnit يقارن بالكود لا
  // بـEPC، فمسح البطاقة مباشرةً كان يفشل بصمت. هنا: إن كان النص EPC
  // مربوطًا فعليًا بوحدة، نستبدله بكود تلك الوحدة (نفس ما تحمله الفاتورة)
  // قبل البحث — لا تغيير على findSoldUnit نفسه.
  const codeForEpc = (raw) => {
    const upper = String(raw || "").trim().toUpperCase();
    if (!upper) return null;
    for (const it of items) {
      const u = (it.units || []).find((x) => x.epc && x.epc.toUpperCase() === upper);
      if (u) return u.code;
    }
    return null;
  };

  // القطعة الجديدة بالرمز (قطعة بعينها) أو ببطاقة RFID، ثم بمرجع الصنف.
  // ⚠ السعر يبدأ بقيمة القطعة الحالية (نفس اقتراح شاشة البيع) والبائع يقرّر.
  const pickNewItem = (q) => {
    const code = String(codeForEpc(q) || q || "").trim().toUpperCase();
    if (!code) return;
    setErr([]);
    const taken = (it) => newLines.filter((l) => l.itemId === it.id).length;
    const free = (it) => (it.units || []).filter((u) => !u.sold && !u.issued);
    const add = (it, unitCode) => {
      setNewLines((p) => [...p, {
        itemId: it.id, unitCode, name: itemLabel(it), karat: it.karat, weight: it.weight,
        unitPrice: suggestedUnitPrice(it, price24, appSettings).toFixed(2), quantity: 1,
      }]);
      setNewQuery("");
    };
    for (const it of items) {
      const u = (it.units || []).find((x) => String(x.code).toUpperCase() === code);
      if (!u) continue;
      if (u.sold) { setErr([`${code}: قطعةٌ مباعة`]); return; }
      if (u.issued) { setErr([`${code}: غير قابلة للبيع — تُفحص أولًا`]); return; }
      if (newLines.some((l) => l.unitCode === u.code)) { setErr([`${code}: مضافة سلفًا`]); return; }
      if (taken(it) >= free(it).length) { setErr([`${code}: لا قطعة متاحة أخرى في هذا الصنف`]); return; }
      add(it, u.code);
      return;
    }
    const byRef = items.find((it) => String(it.ref || "").toUpperCase() === code);
    if (byRef) {
      const next = free(byRef).find((u) => !newLines.some((l) => l.unitCode === u.code));
      if (!next || taken(byRef) >= free(byRef).length) { setErr([`${code}: لا قطعة متاحة في هذا الصنف`]); return; }
      add(byRef, next.code);
      return;
    }
    setErr([`لا قطعة متاحة بالرمز ${code}`]);
  };

  const search = (q) => {
    setErr([]);
    const resolvedCode = codeForEpc(q);
    const r = findSoldUnit(resolvedCode || q, { sales, items });
    if (!r.found) {
      setHit(null);
      setErr([resolvedCode ? `لم تُباع القطعة ${resolvedCode} (البطاقة مربوطة بها لكن لا فاتورة مطابقة)` : r.why]);
      return;
    }
    setHit(r);
    // البحث بالرمز يختار سطره؛ وبالفاتورة يترك الاختيار للبائع
    setPicked(r.lineIndex != null ? [r.lineIndex] : []);
    setQuery("");
  };

  const sale = hit?.sale || null;
  const amounts = useMemo(
    () => (sale && picked.length ? computeReturnAmounts(sale, picked) : null),
    [sale, picked]
  );
  const reason = RETURN_REASONS.find((r) => r.id === reasonId);
  const already = (i) =>
    (returns || []).some((r) => r.saleId === sale?.id && (r.lineIndexes || []).includes(i));
  const lineName = (l, i) => {
    const it = items.find((x) => x.id === l.itemId);
    return l.itemName || l.name || (it ? itemLabel(it) : `سطر ${i + 1}`);
  };

  // ما يُمكن إرجاعه من الفاتورة (غير المرتجع سلفًا)
  const returnable = useMemo(
    () => (sale ? (sale.lines || []).map((_, i) => i).filter((i) => !already(i)) : []),
    [sale, returns]
  );
  const wholePicked = returnable.length > 0 && returnable.every((i) => picked.includes(i));
  const pickSale = (x) => { setErr([]); setHit({ found: true, sale: x, lineIndex: null }); setPicked([]); setShowList(false); setQuery(""); };
  // آخر المبيعات — أحدثها أوّلًا، بلا المرتجعة كاملةً
  const recentSales = useMemo(() => {
    const q = browse.trim().toLowerCase();
    const retBySale = {};
    (returns || []).forEach((r) => { (r.lineIndexes || []).forEach((i) => { (retBySale[r.saleId] = retBySale[r.saleId] || new Set()).add(i); }); });
    return [...sales]
      .filter((x) => !x.voided && (x.lines || []).length)
      .filter((x) => (x.lines || []).some((_, i) => !(retBySale[x.id] || new Set()).has(i)))
      .filter((x) => !q || [x.ref, x.customerName, x.sellerName, String(x.date).slice(0, 10)]
        .some((f) => String(f || "").toLowerCase().includes(q)))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 40);
  }, [sales, returns, browse]);

  const reset = () => { setHit(null); setPicked([]); setNewLines([]); setNote(""); setErr([]); };

  const submit = async () => {
    const req = { saleId: sale.id, lineIndexes: picked, reasonId, refundTarget: target, note };
    const v = validateReturnRequest(req, { sales, returns, items, openDay, stocktakeLock });
    if (!v.ok) { setErr(v.errors); return; }
    // ⚠ onProcess صار async (يستدعي الباك إند فعليًا) — راجع
    // processSalesReturn في GoldInventoryApp.jsx.
    setBusy(true);
    const res = await onProcess(req);
    setBusy(false);
    if (res?.ok) reset();
    else setErr(res?.errors || ["تعذّر تسجيل المرتجع"]);
  };

  const exchangeLines = newLines.map((l) => ({ ...l, unitPrice: Number(l.unitPrice) || 0 }));
  const exchangeAmounts = useMemo(
    () => (mode === "exchange" && sale && picked.length
      ? computeExchangeAmounts({ sale, lineIndexes: picked, newLines: exchangeLines, taxRate })
      : null),
    [mode, sale, picked, newLines, taxRate]
  );
  const submitExchange = async () => {
    const req = { saleId: sale.id, lineIndexes: picked, reasonId, newLines: exchangeLines, settle, note };
    const v = validateExchangeRequest(req, { sales, returns, items, openDay, stocktakeLock });
    if (!v.ok) { setErr(v.errors); return; }
    if (!onExchange) { setErr(["الاستبدال غير متاح"]); return; }
    setBusy(true);
    const res = await onExchange(req);
    setBusy(false);
    if (res?.ok) reset();
    else setErr(res?.errors || ["تعذّر تسجيل الاستبدال"]);
  };

  const cell = { border: "1px solid var(--line)", padding: "6px 8px", fontSize: 11 };

  return (
    <div>
      <SubPageHeader title="المرتجعات والاستبدال" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
          ⚖ القطعة تعود بالسعر الذي دفعه الزبون يوم اشتراها. سعر اليوم للمقارنة فقط.
        </p>
        {/* ── مرتجع أم استبدال ── */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[["return", "مرتجع", "تعود القطعة ويُردّ المبلغ"], ["exchange", "استبدال", "تعود القطعة وتُؤخذ أخرى — والفرق فقط"]].map(([id, l, h]) => (
            <button key={id} onClick={() => { setMode(id); setErr([]); }}
              className="text-right rounded-xl p-2.5"
              style={{ background: mode === id ? "var(--accentBg)" : "var(--panel)", border: `1px solid ${mode === id ? "var(--accentLine)" : "var(--line)"}` }}>
              <p style={{ color: mode === id ? "var(--accent)" : "var(--text)", margin: 0 }} className="text-xs font-bold">{l}</p>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">{h}</p>
            </button>
          ))}
        </div>

        {/* ── البحث ── */}
        <Card style={{ padding: 12, marginBottom: 10 }}>
          <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">
            امسح القطعة أو اكتب رقم الفاتورة
          </p>
          <div className="flex items-stretch gap-2">
            {/* ScanField يقبل قارئ RFID/باركود (لوحة مفاتيح) أو الكاميرا أو
                الكتابة معًا — نفس مكوّن شاشة البيع بالضبط، بدل حقلٍ خام هنا
                كان يفوّت مسح الكاميرا ولا يطابق EPC الحقيقي إطلاقًا. */}
            <div style={{ flex: 1 }}>
              <ScanField
                value={query}
                onChange={setQuery}
                onSubmit={(code) => search(code)}
                placeholder="الرمز التسلسلي · الباركود · INV-100"
              />
            </div>
            <button
              onClick={() => search(query)}
              disabled={!query.trim()}
              className="px-5 rounded-xl text-xs font-bold self-start"
              style={{
                background: query.trim() ? "var(--accentBg)" : "var(--field)",
                color: query.trim() ? "var(--accent)" : "var(--text3)",
                border: "1px solid var(--edge)",
              }}
            >
              بحث
            </button>
          </div>
          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1.5">
            ⚖ المسح يختار السطر مباشرة · رقم الفاتورة يعرض أسطرها لتختار
          </p>
          <button onClick={() => setShowList((v) => !v)}
            className="w-full mt-2 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: showList ? "var(--accentBg)" : "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
            <Receipt size={14} /> {showList ? "إخفاء قائمة المبيعات" : "أو اختر من قائمة المبيعات"}
          </button>
        </Card>

        {showList && (
          <Card style={{ padding: 12, marginBottom: 10 }}>
            <input style={inputStyle} value={browse} onChange={(e) => setBrowse(e.target.value)}
              placeholder="رقم الفاتورة · اسم الزبون · البائع · التاريخ (2026-09-23)" />
            {recentSales.length === 0 ? (
              <p style={{ color: "var(--text3)" }} className="text-[11px] mt-2">لا فواتير قابلة للإرجاع تطابق</p>
            ) : (
              <div className="flex flex-col gap-1.5 mt-2" style={{ maxHeight: 320, overflowY: "auto" }}>
                {recentSales.map((x) => (
                  <button key={x.id} onClick={() => pickSale(x)} className="w-full text-right rounded-xl p-2.5"
                    style={{ background: sale?.id === x.id ? "var(--accentBg)" : "var(--field)", border: `1px solid ${sale?.id === x.id ? "var(--accentLine)" : "var(--edge)"}` }}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "var(--accentSoft)", fontFamily: "monospace" }} className="text-[11px]">{x.ref}</span>
                      <span style={{ color: "var(--text)" }} className="text-xs flex-1 truncate">{x.customerName || "عميل نقدي"}</span>
                      <span style={{ color: "var(--text2)" }} className="text-[11px]">{currency}{fmtMoney(x.total)}</span>
                    </div>
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">
                      {new Date(x.date).toLocaleDateString("en-GB")} · {(x.lines || []).length} سطر
                      {x.sellerName ? ` · ${x.sellerName}` : ""}{x.paymentMethod === "credit" ? " · آجلة" : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── الأخطاء ── */}
        {err.length > 0 && (
          <Card style={{ padding: 11, marginBottom: 10, border: "1px solid var(--badLine)" }}>
            {err.map((e, i) => (
              <p key={i} style={{ color: "var(--bad)" }} className="text-[11px]">⚠ {e}</p>
            ))}
          </Card>
        )}

        {!sale ? (
          <EmptyState
            icon={<RotateCcw size={30} color="var(--accentSoft)" />}
            title="لا فاتورة محدَّدة"
            sub="امسح الملصق، أو اكتب رقم الفاتورة، أو اخترها من قائمة المبيعات"
          />
        ) : (
          <>
            {/* ── الفاتورة الأصلية ── */}
            <Card style={{ padding: 12, marginBottom: 10 }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: "var(--accentSoft)", fontFamily: "monospace" }}
                  className="text-[11px]">{sale.ref}</span>
                <span style={{ color: "var(--text)" }} className="text-xs flex-1">
                  {sale.customerName || "عميل نقدي"}
                </span>
                <span style={{ color: "var(--text2)" }} className="text-[11px]">
                  {new Date(sale.date).toLocaleDateString("en-GB")}
                </span>
              </div>
              <p style={{ color: "var(--text3)" }} className="text-[10px]">
                {(sale.lines || []).length} سطرًا · {currency}{fmtMoney(sale.total)}
                {sale.paymentMethod === "credit" ? " · آجلة" : ""}
              </p>
              {Number(sale.price24Snapshot) > 0 && (
                <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                  سعر جم24 يوم البيع {currency}{fmt(sale.price24Snapshot, 2)}
                  {price24 > 0 ? ` · اليوم ${currency}${fmt(price24, 2)}` : ""}
                  {" — والردّ بأسعار الفاتورة"}
                </p>
              )}
            </Card>

            {/* ── الأسطر ── */}
            <div className="flex items-center justify-between mb-1">
              <p style={{ color: "var(--accent)", margin: 0 }} className="text-[11px] font-bold">
                {mode === "exchange" ? "اختر ما يُستبدل" : "اختر ما يُرتجع"}
              </p>
              {returnable.length > 1 && (
                <button onClick={() => setPicked(wholePicked ? [] : returnable)}
                  className="text-[11px] px-2.5 py-1 rounded-full font-bold"
                  style={{ background: wholePicked ? "var(--accentBg)" : "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                  {wholePicked ? "إلغاء تحديد الكل" : mode === "exchange" ? "الفاتورة كاملة" : "إرجاع الفاتورة كاملة"}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2 mb-3">
              {(sale.lines || []).map((l, i) => {
                const done = already(i);
                const on = picked.includes(i);
                return (
                  <button
                    key={i}
                    disabled={done}
                    onClick={() =>
                      setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))
                    }
                    className="w-full text-right"
                  >
                    <Card style={{
                      padding: 11,
                      opacity: done ? 0.5 : 1,
                      border: `1px solid ${on ? "var(--accentLine)" : "var(--edge)"}`,
                      background: on ? "var(--accentBg)" : "var(--panel)",
                    }}>
                      <div className="flex items-center gap-2">
                        <span style={{
                          width: 18, height: 18, borderRadius: 5,
                          background: on ? "var(--accent)" : "transparent",
                          border: `1px solid ${on ? "var(--accent)" : "var(--edge)"}`,
                          display: "grid", placeItems: "center", flexShrink: 0,
                        }}>
                          {on && <Check size={12} color="var(--panel)" strokeWidth={3} />}
                        </span>
                        <span style={{ color: "var(--text)" }} className="text-xs flex-1">
                          {lineName(l, i)}
                          {l.unitCode && (
                            <span style={{ color: "var(--text3)", fontFamily: "monospace" }}
                              className="text-[10px]"> {l.unitCode}</span>
                          )}
                        </span>
                        <span style={{ color: "var(--accent)" }} className="text-[11px]">
                          {currency}{fmtMoney((Number(l.unitPrice) || 0) * (Number(l.quantity) || 1))}
                        </span>
                      </div>
                      <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                        {l.karatSnapshot ? `عيار ${l.karatSnapshot} · ` : ""}
                        {l.weightSnapshot ? `${fmtW(l.weightSnapshot)} جم` : ""}
                        {done ? " · مُرتجع سلفًا" : ""}
                      </p>
                    </Card>
                  </button>
                );
              })}
            </div>

            {/* ── السبب ── */}
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
              سبب الإرجاع
            </p>
            <div className="grid grid-cols-2 gap-2 mb-1">
              {RETURN_REASONS.map((r) => {
                const on = r.id === reasonId;
                return (
                  <button key={r.id} onClick={() => setReasonId(r.id)}
                    className="text-right rounded-xl p-2.5"
                    style={{
                      background: on ? "var(--accentBg)" : "var(--field)",
                      border: `1px solid ${on ? "var(--accentLine)" : "var(--edge)"}`,
                    }}>
                    <p style={{ color: on ? "var(--accent)" : "var(--text)", margin: 0 }}
                      className="text-[11px] font-bold">{r.label}</p>
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">
                      {r.hint}
                    </p>
                  </button>
                );
              })}
            </div>
            {reason?.restock === "damaged" && (
              <p style={{ color: "var(--bad)" }} className="text-[10px] mb-3">
                ⚠ لن تعود للعرض — تبقى في المخزون غير قابلة للبيع حتى تُفحص.
              </p>
            )}
            <div style={{ height: 8 }} />

            {mode === "exchange" && (
              <>
                {/* ── القطعة الجديدة ── */}
                <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
                  القطعة الجديدة
                </p>
                <Card style={{ padding: 12, marginBottom: 10 }}>
                  <ScanField
                    value={newQuery}
                    onChange={setNewQuery}
                    onSubmit={(code) => pickNewItem(code)}
                    placeholder="امسح القطعة الجديدة · أو رمز الصنف"
                  />
                  {newLines.length === 0 && (
                    <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1.5">
                      ⚖ السعر يبدأ إرشاديًّا (معدنٌ بسعر اليوم + أجور + هامش العيار) — والبائع يقرّر.
                    </p>
                  )}
                </Card>
                {newLines.map((l, i) => (
                  <Card key={l.unitCode || i} style={{ padding: 11, marginBottom: 8, border: "1px solid var(--accentLine)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: "var(--text)" }} className="text-xs flex-1">
                        {l.name}
                        <span style={{ color: "var(--text3)", fontFamily: "monospace" }} className="text-[11px]"> {l.unitCode}</span>
                      </span>
                      <button onClick={() => setNewLines((p) => p.filter((_, k) => k !== i))} style={{ color: "var(--bad)" }} aria-label="حذف">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[11px] mb-1">
                      عيار {l.karat} · {fmtW(l.weight)} جم
                    </p>
                    <Field label={`سعر البيع (${currency})`}>
                      <NumericInput value={String(l.unitPrice)} onChange={(v) => setNewLines((p) => p.map((x, k) => (k === i ? { ...x, unitPrice: v } : x)))} />
                    </Field>
                  </Card>
                ))}

                {/* ── تسوية الفرق ── */}
                <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
                  تسوية الفرق
                </p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {EXCHANGE_SETTLE.map((t) => {
                    const on = t.id === settle;
                    const blocked = t.id === "credit" && !sale.customerId;
                    return (
                      <button key={t.id} disabled={blocked} onClick={() => setSettle(t.id)}
                        className="rounded-xl py-2.5 text-[11px] font-bold"
                        style={{ opacity: blocked ? 0.4 : 1,
                          background: on ? "var(--accentBg)" : "var(--field)",
                          color: on ? "var(--accent)" : "var(--text2)",
                          border: `1px solid ${on ? "var(--accentLine)" : "var(--edge)"}` }}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <Field label="ملاحظة (اختياري)">
                  <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                {exchangeAmounts && (
                  <Card style={{ padding: 12, marginBottom: 12 }}>
                    {[
                      ["قيمة المرتجع", exchangeAmounts.returnAmounts.gross],
                      ["الفاتورة الجديدة", exchangeAmounts.newTotal],
                    ].map(([l, v], i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span style={{ color: "var(--text2)" }} className="text-[11px]">{l}</span>
                        <span style={{ color: "var(--text)" }} className="text-xs">{currency}{fmtMoney(v)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between mt-1 pt-1" style={{ borderTop: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                        {exchangeAmounts.diff > 0 ? "يدفع العميل" : exchangeAmounts.diff < 0 ? "يُردّ للعميل" : "متعادل"}
                      </span>
                      <span style={{ color: exchangeAmounts.diff < 0 ? "var(--bad)" : "var(--accent)" }} className="text-base font-extrabold">
                        {currency}{fmtMoney(Math.abs(exchangeAmounts.diff))}
                      </span>
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
                      ⚖ مستندان: مرتجع {picked.length} سطر وفاتورة جديدة — والدرج يتحرّك بالفرق وحده.
                    </p>
                  </Card>
                )}
                <button
                  onClick={submitExchange}
                  disabled={busy || !picked.length || !newLines.length}
                  className="w-full py-3 rounded-xl text-sm font-bold mb-6"
                  style={{
                    background: picked.length && newLines.length && !busy
                      ? "linear-gradient(135deg, var(--gradFrom), var(--gradTo))"
                      : "var(--field)",
                    color: picked.length && newLines.length && !busy ? "var(--bg)" : "var(--text3)",
                  }}
                >
                  {busy ? "جارِ التسجيل…" : "تسجيل الاستبدال"}
                </button>
              </>
            )}

            {mode === "return" && (<>
            {/* ── الردّ ── */}
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
              ردّ المبلغ
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {REFUND_TARGETS.map((t) => {
                const on = t.id === target;
                const blocked = sale.paymentMethod === "credit" && t.id !== "credit";
                return (
                  <button key={t.id} disabled={blocked} onClick={() => setTarget(t.id)}
                    className="rounded-xl py-2.5 text-[11px] font-bold"
                    style={{
                      opacity: blocked ? 0.4 : 1,
                      background: on ? "var(--accentBg)" : "var(--field)",
                      color: on ? "var(--accent)" : "var(--text2)",
                      border: `1px solid ${on ? "var(--accentLine)" : "var(--edge)"}`,
                    }}>
                    {t.label}
                  </button>
                );
              })}
            </div>

            <Field label="ملاحظة (اختياري)">
              <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>

            {/* ── القيد المتوقَّع ── */}
            {amounts && (
              <>
                <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
                  قيد اليومية المتوقَّع
                </p>
                <div style={{ overflowX: "auto", marginBottom: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 320 }}>
                    <thead>
                      <tr>
                        {["الحساب", "مدين", "دائن"].map((h) => (
                          <th key={h} style={{ ...cell, background: "var(--field)",
                            color: "var(--accent)", fontWeight: 700, textAlign: "center" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {buildReturnJournal({
                        amounts,
                        target: REFUND_TARGETS.find((t) => t.id === target),
                        ref: "—", saleRef: sale.ref, actor: "",
                      }).entry.lines.map((l, i) => (
                        <tr key={i}>
                          <td style={{ ...cell, color: "var(--text)" }}>
                            <span style={{ color: "var(--text3)", fontFamily: "monospace" }}>
                              {l.account}
                            </span>{" "}
                            {accountByCode(l.account)?.name || ""}
                          </td>
                          <td style={{ ...cell, color: l.debit ? "var(--accent)" : "var(--text3)",
                            textAlign: "center" }}>
                            {l.debit ? fmtMoney(l.debit) : "—"}
                          </td>
                          <td style={{ ...cell, color: l.credit ? "var(--good)" : "var(--text3)",
                            textAlign: "center" }}>
                            {l.credit ? fmtMoney(l.credit) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Card style={{ padding: 12, marginBottom: 12 }}>
                  {[
                    ["قيمة السلعة", amounts.net],
                    ["الضريبة المسترجعة", amounts.tax],
                  ].map(([l, v], i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span style={{ color: "var(--text2)" }} className="text-[11px]">{l}</span>
                      <span style={{ color: "var(--text)" }} className="text-xs">
                        {currency}{fmtMoney(v)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between mt-1 pt-1"
                    style={{ borderTop: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                      يُردّ للعميل
                    </span>
                    <span style={{ color: "var(--accent)" }} className="text-base font-extrabold">
                      {currency}{fmtMoney(amounts.gross)}
                    </span>
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                    ⚖ ويعود {fmtW(amounts.fine)} جم24 للمخزون · التكلفة {currency}{fmtMoney(amounts.cost)}
                  </p>
                </Card>

                <button
                  onClick={submit}
                  disabled={busy || !picked.length}
                  className="w-full py-3 rounded-xl text-sm font-bold mb-6"
                  style={{
                    background: picked.length && !busy
                      ? "linear-gradient(135deg, var(--gradFrom), var(--gradTo))"
                      : "var(--field)",
                    color: picked.length && !busy ? "var(--bg)" : "var(--text3)",
                  }}
                >
                  {busy ? "جارِ التسجيل…" : "تسجيل المرتجع"}
                </button>
              </>
            )}
            </>)}
          </>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// شريط يوم العمل — الحالة والفتح والإقفال في مكان واحد
//
// ⚠ يوم العمل بوابة كل حركة، وكان مدفونًا ثلاث ضغطات في القائمة.
// البائع يصل صباحًا فيبيع ثم يكتشف أن اليوم لم يُفتح — والحركات بلا
// يوم لا تظهر في إقفال أيّ يوم.
//
// فالحالة تظهر دائمًا، والفتح ضغطة، والإقفال يقود خطوةً خطوة.
// ============================================================

export { SalesReturnPage };
