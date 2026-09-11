import React, { useMemo, useState } from "react";
import { Check, Coins, Lock, Send } from "lucide-react";
import { fine24, fmt, fmtMoney, fmtW, roundW } from "../core/money.js";
import { REQ_STATUS, SCRAP_STAGES } from "../core/workflow.js";
import { inputStyle, r3 } from "../domain/helpers.js";
import { stageOf } from "../domain/stageOf.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function ScrapCustodyPage({
  scrapEntries, scrapRequests, settings, currency, price24, role,
  onSend, onAssess, onApprove, onReceive, onBreak, onBack,
  onReceiveOfficer, onDepositVault,
}) {
  // ⚠ وزن التكسير لكل قطعة — { scrapId: "12.345" }
  const [breakW, setBreakW] = useState({});
  // ⚠ كل الأزرار أدناه صارت تنادي الباك إند (غير متزامنة) — بلا حالة
  // "قيد التنفيذ" لكل عملية على حدة، كان النقر المتكرر يُرسل نفس الطلب
  // مرارًا قبل عودة الأول، وكانت الحالة المحلية (breakW/picked/confirmW)
  // تُمسح فورًا بصرف النظر عن نجاح الطلب من عدمه.
  const [submittingIds, setSubmittingIds] = useState({});
  const runOnce = async (key, fn) => {
    if (submittingIds[key]) return;
    setSubmittingIds((p) => ({ ...p, [key]: true }));
    try {
      return await fn();
    } finally {
      setSubmittingIds((p) => {
        const { [key]: _drop, ...rest } = p;
        return rest;
      });
    }
  };
  /* ⚠ القسم يعرض ما ينتظر مسؤول الكسر: الوارد من المشتري (`in_box`)
     وما استلمه ولم يُكسّره (`received`) وما له فصوص (`pending_break`).

     قصرُه على `pending_break` وحده يُخفي القطعة الواردة، فلا يجد
     مسؤول الكسر ما يستلمه — ويظنّ أن المشتري لم يُسجّل شيئًا. */
  const waiting = useMemo(
    () => (scrapEntries || []).filter((e) =>
      ["pending_break", "in_box", "received"].includes(stageOf(e))),
    [scrapEntries]
  );
  const [tab, setTab] = useState("box");
  const [picked, setPicked] = useState([]);
  const [note, setNote] = useState("");
  const [assessing, setAssessing] = useState(null);
  const [assessLines, setAssessLines] = useState([]);
  const [assessNote, setAssessNote] = useState("");
  // ⚠ الوزن المؤكَّد بعد التكسير — { reqId: { scrapId: "12.345" } }
  const [confirmW, setConfirmW] = useState({});

  const selfMode = settings?.scrapAssayMode === "branch";
  const canAssay = selfMode || role === "manager";

  const byStage = (st) => scrapEntries.filter((e) => stageOf(e) === st && (Number(e.weight) || 0) > 0);
  const inBox = byStage("in_box");
  const inSafe = byStage("in_safe");
  const boxFine = inBox.reduce((a, e) => a + fine24(e.weight, e.karat), 0);
  const safeFine = inSafe.reduce((a, e) => a + fine24(e.weight, e.karat), 0);

  const openReqs = scrapRequests.filter((r) => r.status !== "received" && r.status !== "rejected");
  const doneReqs = scrapRequests.filter((r) => r.status === "received");

  const pickedFine = inBox
    .filter((e) => picked.includes(e.id))
    .reduce((a, e) => a + fine24(e.weight, e.karat), 0);

  const startAssess = (req) => {
    setAssessing(req.id);
    setAssessLines(
      (req.sentLines || []).map((l) => ({
        scrapId: l.scrapId, ref: l.ref, karat: l.karat,
        sentWeight: l.weight,
        // الافتراضي: الوزن المُرسل ناقص الفصوص المقدّرة
        netWeight: String(r3(Math.max(0, l.weight - (l.stonesMargin || 0)))),
        stonesRemoved: String(l.stonesMargin || 0),
      }))
    );
    setAssessNote("");
  };

  const assessFine = assessLines.reduce(
    (a, l) => a + fine24(Number(l.netWeight) || 0, l.karat), 0
  );
  const assessSentFine = assessLines.reduce((a, l) => a + fine24(l.sentWeight, l.karat), 0);
  const assessVar = assessFine - assessSentFine;

  const StageChip = ({ stage }) => {
    const st = SCRAP_STAGES[stage] || SCRAP_STAGES.in_box;
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: "var(--panel)", color: st.color, border: "1px solid var(--line)" }}>
        {st.label}
      </span>
    );
  };

  return (
    <div>
      <SubPageHeader title="عهدة الكسر" onBack={onBack} />
      <div className="px-4 pt-3">

        {/* ── بانتظار التكسير ── */}
        {waiting.length > 0 && (
          <>
            <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--badLine)" }}>
              <p style={{ color: "var(--bad)" }} className="text-[11px] font-bold mb-1">
                ⚠ {waiting.length} قطعة معلّقة — وزنها غير معتمد
              </p>
              <p style={{ color: "var(--text2)" }} className="text-[11px]">
                تبقى معلّقة حتى يستلمها مسؤول الكسر ويُثبّت وزنها. اليوم
                يُقفل وهي معلّقة، وثمنها المدفوع يظهر في حركة النقد —
                لكن وزنها لا يدخل الخزنة قبل الاعتماد.
              </p>
              {/* ⚠ نُظهر ما دُفع رغم أن الوزن غير معتمد.
                  إخفاؤه يجعل نقدًا خرج بلا مقابلٍ ظاهر، فيبحث المحاسب
                  عن فرقٍ لا يجده. */}
              <div className="flex items-baseline justify-between mt-2 pt-2"
                style={{ borderTop: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text3)" }} className="text-[10px]">
                  المدفوع فيها
                </span>
                <span style={{ color: "var(--bad)" }} className="text-[12px] font-bold">
                  {currency}{fmtMoney(waiting.reduce((a, x) => a + (Number(x.total) || 0), 0))}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span style={{ color: "var(--text3)" }} className="text-[10px]">
                  وزن معلّق غير معتمد
                </span>
                <span style={{ color: "var(--accent)" }} className="text-[12px] font-bold">
                  {fmtW(waiting.reduce((a, x) => a + (Number(x.weight) || 0), 0))} جم
                </span>
              </div>
            </Card>

            <div className="flex flex-col gap-2 mb-4">
              {waiting.map((e) => {
                const gross = Number(e.grossWeight) || Number(e.weight) || 0;
                const est = Number(e.stonesMarginEstimate) || 0;
                const paidOn = Number(e.weight) || 0;
                const cur = breakW[e.id] ?? "";
                const net = Number(cur);
                // ⚠ يقبل الفائض: القائم وزنٌ تقريبيّ أُخذ عند الاستلام، وميزان
                    // التكسير أدقّ. حدُّنا عشرة بالمئة فوقه — ما زاد يستحق مراجعة.
                    const okNet = Number.isFinite(net) && net > 0 && net <= gross * 1.1 + 0.0005;
                const varc = okNet ? roundW(net - paidOn) : 0;
                return (
                  <Card key={e.id} style={{ padding: 12, border: "1px solid var(--badLine)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[10px]">
                        {e.ref}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: "var(--field)",
                          color: SCRAP_STAGES[stageOf(e)]?.color || "var(--text2)",
                          border: "1px solid var(--line)",
                        }}>
                        {SCRAP_STAGES[stageOf(e)]?.label || "—"}
                      </span>
                    </div>

                    {/* ⚠ الاستلام قبل التكسير.
                        الوزن يصير في عهدة مسؤول الكسر باسمه ووقته، فإن
                        نقص عُرف بين يدَي من نقص. وبلا هذه الخطوة يبقى
                        الكسر معلّقًا بلا مسؤول. */}
                    {stageOf(e) === "in_box" && onReceiveOfficer && (
                      <button
                        disabled={!!submittingIds[`ro:${e.id}`]}
                        onClick={() => runOnce(`ro:${e.id}`, () => onReceiveOfficer(e))}
                        className="w-full mb-2 py-2.5 rounded-xl text-[12px] font-bold"
                        style={{ background: "var(--accentBg)", color: "var(--accent)",
                                 border: "1px solid var(--accentLine)" }}
                      >
                        {submittingIds[`ro:${e.id}`] ? "جارٍ الاستلام..." : "استلمها بعهدتي"}
                      </button>
                    )}
                    <div style={{ display: "none" }}>
                      <span style={{ color: "var(--text)" }} className="text-xs flex-1">
                        عيار {e.karat}
                      </span>
                      <span style={{ color: "var(--text2)" }} className="text-[11px]">
                        {currency}{fmtMoney(e.total)}
                      </span>
                    </div>

                    {/* الأوزان الثلاثة */}
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      {[
                        ["القائم", gross, "var(--text)"],
                        ["فصوص تقديرية", est, "var(--bad)"],
                        ["حُوسب عليه", paidOn, "var(--accent)"],
                      ].map(([l, v, c], i) => (
                        <div key={i} style={{
                          background: "var(--bg)", borderRadius: 9, padding: "6px 4px",
                          textAlign: "center", border: "1px solid var(--line)",
                        }}>
                          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px]">{l}</p>
                          <p style={{ color: c, margin: 0 }} className="text-xs font-bold">{fmtW(v)}</p>
                        </div>
                      ))}
                    </div>

                    <Field label="الوزن الصافي بعد نزع الفصوص">
                      <NumericInput
                        value={String(cur)}
                        placeholder={`ما على الميزان — ${fmtW(gross)} تقريبًا`}
                        onChange={(v) => setBreakW((p2) => ({ ...p2, [e.id]: v }))}
                      />
                    </Field>
                    <p style={{ color: "var(--text3)" }} className="text-[10px] mb-2">
                      ⚖ اكتب ما على الميزان لا ما تتوقّعه. الأثقل من القائم فائضٌ
                      مقبول — القائم نفسه وزنٌ أُخذ على عجل.
                    </p>

                    {okNet && (
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ color: "var(--text2)" }} className="text-[11px]">
                          الفصوص الفعلية {fmtW(gross - net)} جم
                        </span>
                        {Math.abs(varc) > 0.0005 ? (
                          <span style={{ color: varc > 0 ? "var(--good)" : "var(--bad)" }} className="text-[11px] font-bold">
                            {varc > 0 ? "↑ فائض" : "↓ هالك"} {fmtW(Math.abs(varc))} جم
                          </span>
                        ) : (
                          <span style={{ color: "var(--good)" }} className="text-[11px]">مطابق للتقدير</span>
                        )}
                      </div>
                    )}

                    {/* ── وجهة الفرق ── */}
                    {okNet && Math.abs(varc) > 0.0005 && (
                      <div
                        className="rounded-xl p-2.5 mb-2"
                        style={{
                          background: varc > 0 ? "var(--goodBg)" : "var(--badBg)",
                          border: `1px solid ${varc > 0 ? "var(--goodLine)" : "var(--badLine)"}`,
                        }}
                      >
                        <p
                          style={{ color: varc > 0 ? "var(--good)" : "var(--bad)", margin: 0 }}
                          className="text-[11px] font-bold"
                        >
                          {varc > 0
                            ? `يُقيَّد فائضًا — ${fmtW(varc)} جم عيار ${e.karat}`
                            : `يُقيَّد هالكًا — ${fmtW(-varc)} جم عيار ${e.karat}`}
                        </p>
                        <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px]">
                          {varc > 0
                            ? "ذهبٌ زائد عمّا حُوسب عليه العميل — يدخل مخزونك إيرادًا."
                            : "ذهبٌ ناقص عمّا دُفع ثمنه — يُحمَّل تكلفةً على الشهر."}
                          {" "}
                          {currency}{fmtMoney(fine24(Math.abs(varc), e.karat) * (price24 || 0))}
                        </p>
                      </div>
                    )}

                    {okNet && net > gross + 0.0005 && (
                      <p style={{ color: "var(--accent)" }} className="text-[10px] mb-2">
                        ⚠ الصافي أثقل من القائم المسجَّل — فرقُ موازين مقبول، لكن
                        راجعه إن تكرّر.
                      </p>
                    )}

                    <button
                      disabled={!okNet || !!submittingIds[`brk:${e.id}`]}
                      onClick={async () => {
                        const ok = await runOnce(`brk:${e.id}`, () => onBreak(e.id, net, ""));
                        if (ok) setBreakW((p2) => ({ ...p2, [e.id]: "" }));
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold"
                      style={{
                        background: okNet ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                        color: okNet ? "var(--panel)" : "var(--text3)",
                      }}
                    >
                      {submittingIds[`brk:${e.id}`] ? "جارٍ التثبيت..." : okNet ? `تثبيت ${fmtW(net)} جم` : "أدخل الوزن الصافي"}
                    </button>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* الأرصدة */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Card style={{ padding: 12 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-1">في الصندوق</p>
            <p style={{ color: "var(--accentText)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold">
              {fmtW(boxFine)} جم
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[10px]">
              {inBox.length} قطعة · لم تُفحص
            </p>
          </Card>
          <Card style={{ padding: 12 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-1">في الخزنة</p>
            <p style={{ color: "var(--good)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold">
              {fmtW(safeFine)} جم
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[10px]">
              متاح للسداد والتصنيع
            </p>
          </Card>
        </div>

        {boxFine > 0 && (
          <Card style={{ padding: 10, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--accent)" }} className="text-[11px]">
              ⚠ الكسر في الصندوق لا يُسدَّد به مورد ولا يُصنَّع منه حتى يُفحص ويُعتمد.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { id: "box", label: `الصندوق (${inBox.length})` },
            { id: "reqs", label: `الطلبات (${openReqs.length})` },
            { id: "safe", label: `الخزنة (${inSafe.length})` },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="py-2 rounded-xl text-[11px] font-bold"
              style={{
                background: tab === t.id ? "var(--accentBg)" : "var(--panel)",
                color: tab === t.id ? "var(--accent)" : "var(--text2)",
                border: "1px solid var(--line)",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── الصندوق: اختيار وإرسال ── */}
        {tab === "box" && (
          inBox.length === 0 ? (
            <EmptyState icon={<Coins size={30} color="var(--accentText)" />} title="لا كسر في الصندوق"
              sub="استلم كسرًا من صفحة استلام الكسر" />
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: "var(--text2)" }} className="text-[11px]">
                  اختر ما تُرسله للفحص
                </span>
                <button
                  onClick={() => setPicked(picked.length === inBox.length ? [] : inBox.map((e) => e.id))}
                  className="text-[10px] px-2.5 py-1 rounded-full"
                  style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
                >
                  {picked.length === inBox.length ? "إلغاء الكل" : "اختيار الكل"}
                </button>
              </div>

              <div className="flex flex-col gap-2 mb-3">
                {inBox.map((e) => {
                  const on = picked.includes(e.id);
                  return (
                    <button key={e.id}
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== e.id) : [...p, e.id]))}
                      className="w-full text-right">
                      <Card style={{ padding: 11, border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}` }}>
                        <div className="flex items-center gap-2">
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            background: on ? "var(--accent)" : "transparent",
                            border: `1px solid ${on ? "var(--accent)" : "var(--edge)"}`,
                            display: "grid", placeItems: "center",
                          }}>
                            {on && <Check size={12} color="var(--bg)" />}
                          </div>
                          <span style={{ color: "var(--text)" }} className="text-xs flex-1">
                            عيار {e.karat} · {fmtW(e.weight)} جم
                            {e.stonesMargin > 0 && (
                              <span style={{ color: "var(--text3)" }} className="text-[10px]">
                                {" "}(فصوص مقدّرة {fmt(e.stonesMargin)})
                              </span>
                            )}
                          </span>
                          <span style={{ color: "var(--text2)" }} className="text-[10px] whitespace-nowrap">
                            {e.ref}
                          </span>
                        </div>
                        <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                          {e.description || "كسر"} · {new Date(e.date).toLocaleDateString("en-GB")}
                        </p>
                      </Card>
                    </button>
                  );
                })}
              </div>

              {picked.length > 0 && (
                <Card style={{ padding: 12, marginBottom: 16, border: "1px solid var(--accentLine)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">
                      {picked.length} قطعة مختارة
                    </span>
                    <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
                      {fmtW(pickedFine)} جم عيار 24
                    </span>
                  </div>
                  <Field label="ملاحظة للإدارة (اختياري)">
                    <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="مثال: فصوص كثيرة في القطعة الثانية" />
                  </Field>
                  <button
                    disabled={!!submittingIds.send}
                    onClick={async () => {
                      const ok = await runOnce("send", () => onSend(picked, note));
                      if (ok) {
                        setPicked([]);
                        setNote("");
                        setTab("reqs");
                      }
                    }}
                    className="w-full py-3 rounded-xl font-bold"
                    style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
                  >
                    {submittingIds.send ? "جارٍ الإرسال..." : selfMode ? "إرسال للفحص الداخلي" : "إرسال للإدارة المركزية"}
                  </button>
                </Card>
              )}
            </>
          )
        )}

        {/* ── الطلبات ── */}
        {tab === "reqs" && (
          openReqs.length === 0 ? (
            <EmptyState icon={<Send size={30} color="var(--accentText)" />} title="لا طلبات مفتوحة"
              sub="أرسل كسرًا من تبويب الصندوق" />
          ) : (
            <div className="flex flex-col gap-2">
              {openReqs.map((r) => {
                const st = REQ_STATUS[r.status] || REQ_STATUS.pending;
                const isAssessing = assessing === r.id;
                return (
                  <Card key={r.id} style={{ padding: 12, border: `1px solid ${isAssessing ? "var(--accentLine)" : "var(--line)"}` }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text)", fontFamily: "monospace" }} className="text-xs font-bold">
                        {r.ref}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "var(--panel)", color: st.color, border: "1px solid var(--line)" }}>
                        {st.label}
                      </span>
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                      {(r.sentLines || []).length} قطعة · {fmtW(r.sentFine)} جم24 مُرسل ·{" "}
                      {r.createdBy} · {new Date(r.createdAt).toLocaleDateString("en-GB")}
                    </p>
                    {r.note && (
                      <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">{r.note}</p>
                    )}

                    {/* نتيجة التقييم */}
                    {r.status !== "pending" && (
                      <Card style={{ padding: 10, marginTop: 8, background: "var(--bg)" }}>
                        {[
                          ["المُرسل", `${fmtW(r.sentFine)} جم24`, "var(--text2)"],
                          ["المعتمَد بعد الفحص", `${fmtW(r.assessedFine)} جم24`, "var(--text)"],
                          [
                            (r.variance || 0) >= 0 ? "فائض" : "هالك",
                            `${fmtW(Math.abs(r.variance || 0))} جم24`,
                            (r.variance || 0) >= 0 ? "var(--goodSolid)" : "var(--bad)",
                          ],
                        ].map(([l, v, c], i) => (
                          <div key={i} className="flex items-center justify-between py-0.5">
                            <span style={{ color: "var(--text2)" }} className="text-[11px]">{l}</span>
                            <span style={{ color: c }} className="text-xs font-bold">{v}</span>
                          </div>
                        ))}
                        {r.assessNote && (
                          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">{r.assessNote}</p>
                        )}
                      </Card>
                    )}

                    {/* الفحص */}
                    {r.status === "pending" && canAssay && !isAssessing && (
                      <button onClick={() => startAssess(r)}
                        className="w-full py-2.5 rounded-xl text-xs font-bold mt-2"
                        style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                        فحص وتثبيت الوزن
                      </button>
                    )}
                    {r.status === "pending" && !canAssay && (
                      <p style={{ color: "var(--text3)" }} className="text-[11px] mt-2">
                        بانتظار الإدارة المركزية — الفحص ليس من صلاحيتك.
                      </p>
                    )}

                    {isAssessing && (
                      <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                        <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">
                          الوزن الصافي بعد نزع الفصوص
                        </p>
                        {assessLines.map((l, i) => (
                          <div key={l.scrapId} className="mb-2">
                            <p style={{ color: "var(--text2)" }} className="text-[10px] mb-1">
                              {l.ref} · عيار {l.karat} · مُرسل {fmtW(l.sentWeight)} جم
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="الصافي (جم)">
                                <NumericInput value={l.netWeight}
                                  onChange={(v) => setAssessLines((arr) =>
                                    arr.map((x, k) => (k === i ? { ...x, netWeight: v } : x)))} />
                              </Field>
                              <Field label="الفصوص المنزوعة (جم)">
                                <NumericInput value={l.stonesRemoved}
                                  onChange={(v) => setAssessLines((arr) =>
                                    arr.map((x, k) => (k === i ? { ...x, stonesRemoved: v } : x)))} />
                              </Field>
                            </div>
                          </div>
                        ))}
                        <Card style={{ padding: 10, marginBottom: 10, background: "var(--bg)" }}>
                          <div className="flex items-center justify-between py-0.5">
                            <span style={{ color: "var(--text2)" }} className="text-[11px]">الفرق عن المُرسل</span>
                            <span style={{ color: assessVar >= 0 ? "var(--goodSolid)" : "var(--bad)" }} className="text-sm font-bold">
                              {assessVar >= 0 ? "+" : "−"}{fmtW(Math.abs(assessVar))} جم24
                            </span>
                          </div>
                          <p style={{ color: "var(--text3)" }} className="text-[10px]">
                            {Math.abs(assessVar) < 0.0005
                              ? "مطابق للمُرسل"
                              : assessVar > 0
                              ? "فائض — يُقيَّد إيرادًا"
                              : "هالك — يُقيَّد تكلفة"}
                          </p>
                        </Card>
                        <Field label="ملاحظة الفحص">
                          <input style={inputStyle} value={assessNote}
                            onChange={(e) => setAssessNote(e.target.value)} placeholder="اختياري" />
                        </Field>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setAssessing(null)}
                            className="py-2.5 rounded-xl text-xs font-bold"
                            style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                            إلغاء
                          </button>
                          <button
                            disabled={!!submittingIds[`assess:${r.id}`]}
                            onClick={async () => {
                              const ok = await runOnce(`assess:${r.id}`, () => onAssess(r.id, assessLines.map((l) => ({
                                scrapId: l.scrapId, karat: l.karat,
                                netWeight: Number(l.netWeight) || 0,
                                stonesRemoved: Number(l.stonesRemoved) || 0,
                              })), assessNote));
                              if (ok) setAssessing(null);
                            }}
                            className="py-2.5 rounded-xl text-xs font-bold"
                            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
                            {submittingIds[`assess:${r.id}`] ? "جارٍ التثبيت..." : "تثبيت الوزن"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* الاعتماد */}
                    {r.status === "assessed" && canAssay && (
                      <button
                        disabled={!!submittingIds[`appr:${r.id}`]}
                        onClick={() => runOnce(`appr:${r.id}`, () => onApprove(r.id))}
                        className="w-full py-2.5 rounded-xl text-xs font-bold mt-2"
                        style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
                        {submittingIds[`appr:${r.id}`] ? "جارٍ الاعتماد..." : "اعتماد النتيجة"}
                      </button>
                    )}

                    {/* ── الاستلام: وزن مؤكَّد بعد التكسير ── */}
                    {r.status === "approved" && (
                      <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                        <p style={{ color: "var(--good)" }} className="text-[11px] mb-2">
                          اعتُمد بواسطة {r.approvedBy}.
                        </p>
                        <Card style={{ padding: 10, marginBottom: 10, border: "1px solid var(--badLine)" }}>
                          <p style={{ color: "var(--bad)" }} className="text-[11px]">
                            ⚠ زِن كل قطعة بعد التكسير وأكّد وزنها. التقييم تقدير قبل
                            التكسير، وقد يختلف: فصّ لم يُرَ أو لحام أثقل مما بدا.
                          </p>
                        </Card>

                        {(r.assessedLines || []).map((l) => {
                          const cur = confirmW[r.id]?.[l.scrapId] ?? "";
                          const num = Number(cur);
                          const gap = Number.isFinite(num) && num > 0 ? num - l.netWeight : 0;
                          return (
                            <div key={l.scrapId} className="mb-2">
                              <div className="flex items-baseline justify-between mb-1">
                                <span style={{ color: "var(--text2)" }} className="text-[10px]">
                                  عيار {l.karat} · مُقيَّم {fmtW(l.netWeight)} جم
                                </span>
                                {Math.abs(gap) > 0.0005 && (
                                  <span style={{ color: gap > 0 ? "var(--goodSolid)" : "var(--bad)" }} className="text-[10px]">
                                    {gap > 0 ? "+" : "−"}{fmtW(Math.abs(gap))} جم
                                  </span>
                                )}
                              </div>
                              <NumericInput
                                value={String(cur)}
                                placeholder={`الوزن بعد التكسير — ${fmtW(l.netWeight)}`}
                                onChange={(v) =>
                                  setConfirmW((p2) => ({
                                    ...p2,
                                    [r.id]: { ...(p2[r.id] || {}), [l.scrapId]: v },
                                  }))
                                }
                              />
                            </div>
                          );
                        })}

                        {(() => {
                          const lines = r.assessedLines || [];
                          const vals = lines.map((l) => Number(confirmW[r.id]?.[l.scrapId]));
                          const ready = vals.every((v) => Number.isFinite(v) && v > 0);
                          const fine = ready
                            ? lines.reduce((a, l, i) => a + fine24(vals[i], l.karat), 0)
                            : 0;
                          const diff = ready ? fine - (Number(r.sentFine) || 0) : 0;
                          return (
                            <>
                              {ready && (
                                <Card style={{ padding: 10, marginBottom: 8, background: "var(--bg)" }}>
                                  <div className="flex items-center justify-between">
                                    <span style={{ color: "var(--text2)" }} className="text-[11px]">المؤكَّد</span>
                                    <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                                      {fmtW(fine)} جم24
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span style={{ color: "var(--text2)" }} className="text-[11px]">
                                      {diff >= 0 ? "فائض" : "هالك"} عن المُرسل
                                    </span>
                                    <span style={{ color: diff >= 0 ? "var(--goodSolid)" : "var(--bad)" }} className="text-xs font-bold">
                                      {fmtW(Math.abs(diff))} جم24
                                    </span>
                                  </div>
                                </Card>
                              )}
                              <button
                                disabled={!ready || !!submittingIds[`recv:${r.id}`]}
                                onClick={async () => {
                                  const ok = await runOnce(`recv:${r.id}`, () => onReceive(
                                    r.id,
                                    lines.map((l, i) => ({ scrapId: l.scrapId, weight: vals[i] }))
                                  ));
                                  if (ok) setConfirmW((p2) => ({ ...p2, [r.id]: {} }));
                                }}
                                className="w-full py-3 rounded-xl font-bold"
                                style={{
                                  background: ready ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                                  color: ready ? "var(--panel)" : "var(--text3)",
                                }}
                              >
                                {submittingIds[`recv:${r.id}`] ? "جارٍ الإدخال..." : ready ? `إدخال ${fmtW(fine)} جم للخزنة` : "أكّد وزن كل قطعة أولًا"}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )
        )}

        {/* ── الخزنة ── */}
        {tab === "safe" && (
          inSafe.length === 0 ? (
            <EmptyState icon={<Lock size={30} color="var(--accentText)" />} title="لا كسر بالخزنة"
              sub="أرسل الكسر للفحص ثم أدخله بعد الاعتماد" />
          ) : (
            <div className="flex flex-col gap-2">
              {inSafe.map((e) => (
                <Card key={e.id} style={{ padding: 11 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                      عيار {e.karat} · {fmtW(e.weight)} جم
                    </span>
                    <StageChip stage="in_safe" />
                  </div>
                  <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                    {e.ref}
                    {e.originalWeight && e.originalWeight !== e.weight && (
                      <span> · كان {fmtW(e.originalWeight)} جم قبل الفحص</span>
                    )}
                    {e.requestRef && <span> · {e.requestRef}</span>}
                    {e.approvedBy && <span> · اعتمده {e.approvedBy}</span>}
                  </p>
                </Card>
              ))}
            </div>
          )
        )}

        {doneReqs.length > 0 && tab === "reqs" && (
          <>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-2 mt-4">
              طلبات مكتملة ({doneReqs.length})
            </p>
            <div className="flex flex-col gap-2">
              {doneReqs.slice(0, 10).map((r) => (
                <Card key={r.id} style={{ padding: 10 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text2)", fontFamily: "monospace" }} className="text-[11px]">{r.ref}</span>
                    <span style={{ color: "var(--text3)" }} className="text-[10px]">
                      {fmtW(r.assessedFine)} جم24
                      {Math.abs(r.variance || 0) > 0.0005 && (
                        <span style={{ color: (r.variance || 0) > 0 ? "var(--goodSolid)" : "var(--bad)" }}>
                          {" "}({(r.variance || 0) > 0 ? "+" : "−"}{fmt(Math.abs(r.variance))})
                        </span>
                      )}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
        <div style={{ height: 20 }} />
      {/* ── إيداع كسر اليوم ── */}
      {onDepositVault && (
        <div className="px-4 pb-4">
          <button
            disabled={!!submittingIds.deposit}
            onClick={() => runOnce("deposit", onDepositVault)}
            className="w-full py-3 rounded-xl text-sm font-bold"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))",
                     color: "var(--panel)" }}
          >
            {submittingIds.deposit ? "جارٍ الإيداع..." : "أودِع كسر اليوم في خزنة الكسر"}
          </button>
          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1.5 text-center">
            ⚖ خزنة الكسر غير خزنة المشغول — الذهب هنا خامٌ مُصفّى ينتظر
            التصنيع أو السداد.
          </p>
        </div>
      )}

      </div>
    </div>
  );
}

// ============================================================
// ميزان المراجعة المزدوج
//
// دفتران مستقلان لا يُجمعان: الوزن بالجرام الصافي، والنقد بالعملة.
// عرضهما في شاشة واحدة لا يعني دمجهما — كلٌّ بمجاميعه وقاعدة توازنه.
// ============================================================

export { ScrapCustodyPage };
