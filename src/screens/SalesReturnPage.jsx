import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { fmtMoney, fmtW } from "../core/money.js";
import { REFUND_TARGETS, RETURN_REASONS } from "../core/workflow.js";
import { accountByCode } from "../domain/accountByCode.js";
import { buildReturnJournal } from "../domain/buildReturnJournal.js";
import { computeReturnAmounts } from "../domain/computeReturnAmounts.js";
import { findSoldUnit } from "../domain/findSoldUnit.js";
import { inputStyle } from "../domain/helpers.js";
import { validateReturnRequest } from "../domain/validateReturnRequest.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function SalesReturnPage({
  sales = [], returns = [], items = [], openDay, stocktakeLock,
  currency, taxRate = 0, onProcess, onBack,
}) {
  const [query, setQuery] = useState("");
  const [hit, setHit] = useState(null);          // نتيجة البحث
  const [picked, setPicked] = useState([]);      // أسطر مختارة
  const [reasonId, setReasonId] = useState("changed_mind");
  const [target, setTarget] = useState("daily_cash");
  const [note, setNote] = useState("");
  const [err, setErr] = useState([]);

  const scanRef = useRef(null);
  // ⚠ الحقل يبقى مركَّزًا: قارئ الباركود يكتب فيه كلوحة مفاتيح، وفقدان
  // التركيز يجعل المسح يذهب لا مكان — والبائع يمسح مرارًا ولا يفهم.
  useEffect(() => {
    const t = setTimeout(() => scanRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [hit]);

  const search = (q) => {
    setErr([]);
    const r = findSoldUnit(q, { sales, items });
    if (!r.found) {
      setHit(null);
      setErr([r.why]);
      return;
    }
    setHit(r);
    // البحث بالرمز يختار سطره؛ وبالفاتورة يترك الاختيار للبائع
    setPicked(r.lineIndex != null ? [r.lineIndex] : []);
    setQuery("");
  };

  const sale = hit?.sale || null;
  const amounts = useMemo(
    () => (sale && picked.length ? computeReturnAmounts(sale, picked, taxRate) : null),
    [sale, picked, taxRate]
  );
  const reason = RETURN_REASONS.find((r) => r.id === reasonId);
  const already = (i) =>
    (returns || []).some((r) => r.saleId === sale?.id && (r.lineIndexes || []).includes(i));

  const submit = async () => {
    const req = { saleId: sale.id, lineIndexes: picked, reasonId, refundTarget: target, note };
    const v = validateReturnRequest(req, { sales, returns, items, openDay, stocktakeLock });
    if (!v.ok) { setErr(v.errors); return; }
    // ⚠ onProcess صار async (يستدعي الباك إند فعليًا) — راجع
    // processSalesReturn في GoldInventoryApp.jsx.
    const res = await onProcess(req);
    if (res?.ok) {
      setHit(null); setPicked([]); setNote(""); setErr([]);
    } else {
      setErr(res?.errors || ["تعذّر تسجيل المرتجع"]);
    }
  };

  const cell = { border: "1px solid var(--line)", padding: "6px 8px", fontSize: 11 };

  return (
    <div>
      <SubPageHeader title="استرجاع مبيعات" onBack={onBack} />
      <div className="px-4 pt-3">

        {/* ── البحث ── */}
        <Card style={{ padding: 12, marginBottom: 10 }}>
          <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">
            امسح القطعة أو اكتب رقم الفاتورة
          </p>
          <div className="flex items-stretch gap-2">
            <input
              ref={scanRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") search(query); }}
              placeholder="الرمز التسلسلي · الباركود · INV-100"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={() => search(query)}
              disabled={!query.trim()}
              className="px-5 rounded-xl text-xs font-bold"
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
        </Card>

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
            title="لا قطعة محدَّدة"
            sub="امسح الملصق أو اكتب رقم الفاتورة"
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
            </Card>

            {/* ── الأسطر ── */}
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
              اختر ما يُرتجع
            </p>
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
                          {l.itemName || l.name || `سطر ${i + 1}`}
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
                  disabled={!picked.length}
                  className="w-full py-3 rounded-xl text-sm font-bold mb-6"
                  style={{
                    background: picked.length
                      ? "linear-gradient(135deg, var(--gradFrom), var(--gradTo))"
                      : "var(--field)",
                    color: picked.length ? "var(--bg)" : "var(--text3)",
                  }}
                >
                  تسجيل المرتجع
                </button>
              </>
            )}
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
