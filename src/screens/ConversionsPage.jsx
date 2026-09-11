import React, { useMemo, useState } from "react";
import { AlertTriangle, Coins } from "lucide-react";
import { CATEGORY_STATE } from "../core/constants.js";
import { KARATS, fmt, fmtW, pricePerGram } from "../core/money.js";
import { FUNDING_SOURCES } from "../core/workflow.js";
import { inputStyle, itemLabel } from "../domain/helpers.js";
import { settleableScrap } from "../domain/settleableScrap.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function ConversionsPage({
  items, scrapEntries, weightAdjustments, currency, price24,
  onScrapToProduct, onProductToScrap, onBack,
}) {
  const [tab, setTab] = useState("s2p");
  const [w, setW] = useState("");
  const [karat, setKarat] = useState(21);
  const [qty, setQty] = useState("1");
  const [cat, setCat] = useState(CATEGORY_STATE.list[0].id);
  const [wm, setWm] = useState("");
  const [cpg, setCpg] = useState("");
  const [src, setSrc] = useState("safe_cash");
  const [itemId, setItemId] = useState("");
  const [pickCodes, setPickCodes] = useState([]);

  // ⚠ التصنيع من الكسر المفحوص فقط — كما السداد
  const scrapStock = useMemo(() => {
    const byK = {};
    settleableScrap(scrapEntries).forEach((e) => {
      byK[e.karat] = (byK[e.karat] || 0) + (Number(e.weight) || 0);
    });
    return byK;
  }, [scrapEntries]);
  const availAt = Number(scrapStock[karat] || 0);

  const active = items.filter((it) => (it.units || []).some((u) => !u.sold));
  const sel = active.find((it) => it.id === itemId);
  const freeUnits = sel ? (sel.units || []).filter((u) => !u.sold) : [];
  const chosen = pickCodes.length ? pickCodes : freeUnits.slice(0, 1).map((u) => u.code);
  const cQty = chosen.length;
  const cGross = sel ? (Number(sel.weight) || 0) * cQty : 0;
  const cStones = sel ? (Number(sel.stonesWeight) || 0) * cQty : 0;
  const cGold = Math.max(0, cGross - cStones);
  const cWm = sel ? ((Number(sel.lotWorkmanshipShare) || 0) + (Number(sel.workmanship) || 0)) * cQty : 0;

  const s2pValid = Number(w) > 0 && Number(w) <= availAt + 0.0001 && Number(qty) >= 1;
  const history = (weightAdjustments || []).filter((a) => a.kind === "workmanship_writeoff");
  const converted = (scrapEntries || []).filter((e) => e.status === "converted" || e.fromItemId);

  return (
    <div>
      <SubPageHeader title="التحويلات" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { id: "s2p", label: "كسر ← منتج" },
            { id: "p2s", label: "منتج ← كسر" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="py-2 rounded-xl text-xs font-bold"
              style={{
                background: tab === t.id ? "var(--accentBg)" : "var(--panel)",
                color: tab === t.id ? "var(--accent)" : "var(--text2)",
                border: "1px solid var(--line)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "s2p" && (
          <>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
              الوزن ينتقل من مخزون الكسر إلى المخزون بتكلفة الكسر نفسها، ومصنعية الصائغ تُضاف تكلفةً على القطعة.
            </p>

            <Card style={{ padding: 12, marginBottom: 12 }}>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mb-1">مخزون الكسر المتاح</p>
              {Object.entries(scrapStock).filter(([, v]) => v > 0.001).length === 0 ? (
                <p style={{ color: "var(--text3)" }} className="text-[11px]">لا كسر متاح</p>
              ) : (
                Object.entries(scrapStock)
                  .filter(([, v]) => v > 0.001)
                  .sort((a, b) => Number(b[0]) - Number(a[0]))
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--text2)" }} className="text-[11px]">عيار {k}</span>
                      <span style={{ color: Number(k) === karat ? "var(--accent)" : "var(--text)" }} className="text-xs font-bold">
                        {fmtW(v)} جم
                      </span>
                    </div>
                  ))
              )}
            </Card>

            <Card style={{ padding: 14, marginBottom: 16 }}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="العيار">
                  <select style={inputStyle} value={karat} onChange={(e) => setKarat(Number(e.target.value))}>
                    {KARATS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                        {scrapStock[k] > 0 ? ` — ${fmtW(scrapStock[k])} جم` : " — لا رصيد"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="الوزن المُحوَّل (جم)">
                  <NumericInput value={w} onChange={setW} placeholder="0.00" />
                </Field>
              </div>

              {Number(w) > availAt + 0.0001 && (
                <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">
                  المتاح من عيار {karat} هو {fmtW(availAt)} جم فقط.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Field label="التصنيف">
                  <select style={inputStyle} value={cat} onChange={(e) => setCat(e.target.value)}>
                    {CATEGORY_STATE.list.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="عدد القطع">
                  <NumericInput value={qty} onChange={setQty} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label={`مصنعية الصائغ (${currency})`}>
                  <NumericInput value={wm} onChange={setWm} placeholder="0" />
                </Field>
                <Field label={`تكلفة جرام الكسر (${currency})`}>
                  <NumericInput value={cpg} onChange={setCpg} placeholder={fmt(pricePerGram(karat, price24))} />
                </Field>
              </div>

              {Number(wm) > 0 && (
                <Field label="تُدفع المصنعية من">
                  <select style={inputStyle} value={src} onChange={(e) => setSrc(e.target.value)}>
                    {FUNDING_SOURCES.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </Field>
              )}

              {s2pValid && (
                <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
                  {qty} قطعة · {fmt(Number(w) / Number(qty))} جم للقطعة · تكلفة القطعة {currency}
                  {fmt(
                    (Number(w) / Number(qty)) * (Number(cpg) || pricePerGram(karat, price24)) +
                      (Number(wm) || 0) / Number(qty),
                    0
                  )}
                </p>
              )}

              <button
                disabled={!s2pValid}
                onClick={() => {
                  onScrapToProduct({
                    weight: Number(w),
                    karat,
                    quantity: Number(qty),
                    categoryId: cat,
                    workmanship: Number(wm) || 0,
                    scrapCostPerGram: Number(cpg) || pricePerGram(karat, price24),
                    fundingSource: src,
                  });
                  setW("");
                  setWm("");
                  setCpg("");
                  setQty("1");
                }}
                className="w-full py-3 rounded-xl font-bold"
                style={{
                  background: s2pValid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                  color: s2pValid ? "var(--panel)" : "var(--text3)",
                }}
              >
                تحويل إلى منتج
              </button>
            </Card>
          </>
        )}

        {tab === "p2s" && (
          <>
            <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--badLine)" }}>
              <p style={{ color: "var(--bad)" }} className="text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle size={13} /> المصنعية تضيع عند الصهر
              </p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                الذهب يبقى بوزنه، والأجور التي دُفعت لصنع القطعة تُعدم وتُقيَّد خسارة. الفصوص لا تُصهر وتُطرح من الوزن.
              </p>
            </Card>

            <Card style={{ padding: 14, marginBottom: 12 }}>
              <Field label="القطعة">
                <select
                  style={inputStyle}
                  value={itemId}
                  onChange={(e) => {
                    setItemId(e.target.value);
                    setPickCodes([]);
                  }}
                >
                  <option value="">اختر من المخزون...</option>
                  {active.map((it) => (
                    <option key={it.id} value={it.id}>
                      {itemLabel(it)} — متاح {(it.units || []).filter((u) => !u.sold).length}
                    </option>
                  ))}
                </select>
              </Field>

              {sel && freeUnits.length > 1 && (
                <Field label="اختر القطع (الافتراضي واحدة)">
                  <div className="flex flex-wrap gap-1.5">
                    {freeUnits.map((u) => {
                      const on = chosen.includes(u.code);
                      return (
                        <button
                          key={u.code}
                          onClick={() =>
                            setPickCodes((p) =>
                              p.includes(u.code) ? p.filter((x) => x !== u.code) : [...p, u.code]
                            )
                          }
                          className="text-[10px] px-2 py-1 rounded-full"
                          style={{
                            background: on ? "var(--accentBg)" : "var(--panel)",
                            color: on ? "var(--accent)" : "var(--text2)",
                            border: "1px solid var(--line)",
                            fontFamily: "monospace",
                          }}
                        >
                          {u.code}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}

              {sel && (
                <Card style={{ padding: 10, marginBottom: 12, background: "var(--bg)" }}>
                  {[
                    ["الوزن الإجمالي", `${fmtW(cGross)} جم`, false],
                    ...(cStones > 0 ? [["الفصوص (لا تُصهر)", `−${fmtW(cStones)} جم`, false]] : []),
                    ["الداخل لمخزون الكسر", `${fmtW(cGold)} جم عيار ${sel.karat}`, false],
                    ["المصنعية المُعدمة", `${currency}${fmt(cWm, 0)}`, true],
                  ].map(([l, v, red], i, arr) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1"
                      style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}
                    >
                      <span style={{ color: "var(--text2)" }} className="text-[11px]">{l}</span>
                      <span style={{ color: red ? "var(--bad)" : "var(--text)" }} className="text-xs font-bold">{v}</span>
                    </div>
                  ))}
                </Card>
              )}

              <button
                disabled={!sel || cQty === 0}
                onClick={() => {
                  onProductToScrap({ itemId, unitCodes: chosen });
                  setItemId("");
                  setPickCodes([]);
                }}
                className="w-full py-3 rounded-xl font-bold"
                style={{
                  background: sel && cQty ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                  color: sel && cQty ? "var(--panel)" : "var(--text3)",
                }}
              >
                تحويل إلى كسر
              </button>
            </Card>
          </>
        )}

        <p style={{ color: "var(--text2)" }} className="text-xs mb-2 mt-2">
          سجل التحويلات ({converted.length})
        </p>
        {converted.length === 0 ? (
          <EmptyState icon={<Coins size={30} color="var(--accentText)" />} title="لا تحويلات بعد" sub="" />
        ) : (
          <div className="flex flex-col gap-2">
            {converted.slice(0, 30).map((e) => (
              <Card key={e.id} style={{ padding: 10 }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text)" }} className="text-xs">{e.description}</span>
                  <span
                    style={{ color: (Number(e.weight) || 0) > 0 ? "var(--goodSolid)" : "var(--bad)" }}
                    className="text-xs font-bold"
                  >
                    {(Number(e.weight) || 0) > 0 ? "+" : "−"}
                    {fmt(Math.abs(Number(e.weight) || 0))} جم
                  </span>
                </div>
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                  {e.ref} · عيار {e.karat} · {new Date(e.date).toLocaleDateString("en-GB")}
                  {e.createdBy ? ` · ${e.createdBy}` : ""}
                </p>
              </Card>
            ))}
          </div>
        )}

        {history.length > 0 && (
          <>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-2 mt-4">
              المصنعية المُعدمة ({currency}
              {fmt(history.reduce((a, x) => a + (Number(x.value) || 0), 0), 0)})
            </p>
            <div className="flex flex-col gap-2">
              {history.slice(0, 20).map((x) => (
                <Card key={x.id} style={{ padding: 10 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">{x.note}</span>
                    <span style={{ color: "var(--bad)" }} className="text-xs font-bold">
                      −{currency}{fmt(x.value, 0)}
                    </span>
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                    {x.ref} · {new Date(x.date).toLocaleDateString("en-GB")} · {x.createdBy}
                  </p>
                </Card>
              ))}
            </div>
          </>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// تعديل القطع — التصنيف فقط
// ============================================================

export { ConversionsPage };
