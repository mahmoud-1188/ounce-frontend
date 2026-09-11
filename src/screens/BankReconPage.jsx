import React, { useMemo, useState } from "react";
import { Check, Upload } from "lucide-react";
import { fmt } from "../core/money.js";
import { inputStyle } from "../domain/helpers.js";
import { key } from "../domain/key.js";
import { parseBankStatement } from "../domain/parseBankStatement.js";
import { reconcileBank } from "../domain/reconcileBank.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function BankReconPage({ sales, cashTx, safeTx, bankTx, settings, currency, onSaveBank, onBack, flashToast }) {
  const [tab, setTab] = useState("matched");
  const [pasted, setPasted] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [parseErr, setParseErr] = useState("");
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  // ── حركات الشبكة المحلية ──
  //
  // المصدر: مبيعات الشبكة وكل قيد نقدي بوسيلة «شبكة». الفواتير المقسّمة
  // يُؤخذ جزؤها الشبكي فقط — أخذ الإجمالي يجعل المطابقة تفشل دائمًا.
  const localTx = useMemo(() => {
    const inRange = (d) => {
      const x = String(d || "").slice(0, 10);
      return x >= from && x <= to;
    };
    const out = [];
    (sales || []).forEach((s) => {
      const net = s.paymentMethod === "card"
        ? Number(s.total) || 0
        : s.paymentMethod === "split" ? Number(s.networkPart) || 0 : 0;
      if (net <= 0 || !inRange(s.date)) return;
      out.push({
        id: s.id, ref: s.ref, date: s.date, amount: net,
        authCode: s.authCode || s.cardAuth || "",
        network: s.cardNetwork || "", who: s.sellerName || "", kind: "sale",
      });
    });
    // إيداعات شبكة غير مرتبطة بفاتورة
    [...(cashTx || []), ...(safeTx || [])].forEach((t) => {
      if (t.method !== "network" || t.type !== "in" || !inRange(t.date)) return;
      if ((sales || []).some((s) => s.id === t.refId)) return; // لا نكرّر
      out.push({
        id: t.id, ref: t.ref || t.id, date: t.date, amount: Number(t.amount) || 0,
        authCode: t.authCode || "", network: t.cardNetwork || "", who: t.createdBy || "", kind: "cash",
      });
    });
    return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [sales, cashTx, safeTx, from, to]);

  const bankRows = useMemo(
    () => (bankTx || []).filter((b) => b.date >= from && b.date <= to),
    [bankTx, from, to]
  );

  const R = useMemo(() => reconcileBank(localTx, bankRows), [localTx, bankRows]);

  const doImport = (text) => {
    const res = parseBankStatement(text);
    if (res.error) { setParseErr(res.error); return; }
    setParseErr("");
    // ⚠ لا نكرّر: نفس التاريخ والمبلغ والمرجع يعني نفس الحركة
    const key = (b) => `${b.date}|${b.amount}|${b.type}|${b.ref}`;
    const have = new Set((bankTx || []).map(key));
    const fresh = res.rows.filter((b) => !have.has(key(b)));
    onSaveBank([...(bankTx || []), ...fresh]);
    setShowImport(false);
    setPasted("");
    flashToast(
      fresh.length
        ? `أُضيفت ${fresh.length} حركة${res.rows.length - fresh.length ? ` · ${res.rows.length - fresh.length} مكررة تُجوهلت` : ""}`
        : "كل الحركات موجودة مسبقًا"
    );
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => doImport(String(r.result || ""));
    r.onerror = () => setParseErr("تعذّرت قراءة الملف");
    r.readAsText(f, "utf-8");
  };

  const Row = ({ children, tone }) => (
    <Card style={{ padding: 11, border: tone ? `1px solid ${tone}` : undefined }}>{children}</Card>
  );

  return (
    <div>
      <SubPageHeader title="مطابقة البنك" onBack={onBack} />
      <div className="px-4 pt-3">
        <Card style={{ padding: 12, marginBottom: 12 }}>
          <p style={{ color: "var(--text2)" }} className="text-[11px]">
            البنك لا يودع كل عملية على حدة — يجمع عمليات اليوم في إيداع واحد بعد خصم
            عمولته. المطابقة هنا واحد-إلى-عدة.
          </p>
        </Card>

        {/* المدى */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Field label="من">
            <input style={inputStyle} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="إلى">
            <input style={inputStyle} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>

        {/* الاستيراد */}
        {!showImport ? (
          <button onClick={() => setShowImport(true)}
            className="w-full py-2.5 rounded-xl text-xs font-bold mb-3 flex items-center justify-center gap-2"
            style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
            <Upload size={14} /> استيراد كشف الحساب
          </button>
        ) : (
          <Card style={{ padding: 13, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">استيراد كشف الحساب</p>
            <p style={{ color: "var(--text3)" }} className="text-[10px] mb-2">
              ملف CSV من بنكك. ترتيب الأعمدة لا يهم — يُتعرَّف عليها بأسمائها.
              الأعمدة المطلوبة: التاريخ والمبلغ (أو دائن/مدين)، والمرجع إن وُجد.
            </p>
            <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile}
              style={{ ...inputStyle, padding: "9px 10px" }} />
            <Field label="أو الصق المحتوى">
              <textarea style={{ ...inputStyle, minHeight: 90, fontFamily: "monospace", fontSize: 11 }}
                value={pasted} onChange={(e) => setPasted(e.target.value)}
                placeholder="التاريخ,البيان,دائن,مدين,المرجع" />
            </Field>
            {parseErr && <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">{parseErr}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setShowImport(false); setParseErr(""); }}
                className="py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                إلغاء
              </button>
              <button onClick={() => doImport(pasted)} disabled={!pasted.trim()}
                className="py-2.5 rounded-xl text-xs font-bold"
                style={{
                  background: pasted.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                  color: pasted.trim() ? "var(--panel)" : "var(--text3)",
                }}>
                استيراد
              </button>
            </div>
          </Card>
        )}

        {/* الملخّص */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Card style={{ padding: 11 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px]">عمليات النظام</p>
            <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold">
              {localTx.length}
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[10px]">
              {currency}{fmt(localTx.reduce((a, t) => a + t.amount, 0), 0)}
            </p>
          </Card>
          <Card style={{ padding: 11 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px]">حركات البنك</p>
            <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-lg font-extrabold">
              {bankRows.length}
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[10px]">
              {bankRows.length === 0 ? "استورد الكشف أولًا" : `${bankRows.filter(b => b.type === "credit").length} إيداع`}
            </p>
          </Card>
        </div>

        {R.weak > 0 && (
          <Card style={{ padding: 10, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
            <p style={{ color: "var(--accent)" }} className="text-[11px]">
              ⚠ {R.weak} مطابقة بدليل ضعيف (المبلغ والتاريخ فقط) — راجعها قبل الاعتماد.
            </p>
          </Card>
        )}

        {/* الحالات الثلاث */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { id: "matched", label: "مطابق", n: R.matched.length, v: R.totals.matched, color: "var(--good)" },
            { id: "transit", label: "في الطريق", n: R.inTransit.length, v: R.totals.inTransit, color: "var(--accent)" },
            { id: "unrecorded", label: "غير مسجّل", n: R.unrecorded.length,
              v: R.totals.unrecordedIn + R.totals.unrecordedOut, color: "var(--bad)" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="py-2.5 rounded-xl"
              style={{
                background: tab === t.id ? "var(--accentBg)" : "var(--panel)",
                border: `1px solid ${tab === t.id ? "var(--accentLine)" : "var(--edge)"}`,
              }}>
              <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px]">{t.label}</p>
              <p style={{ color: t.color, margin: 0 }} className="text-base font-extrabold">{t.n}</p>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px]">{fmt(t.v, 0)}</p>
            </button>
          ))}
        </div>

        {/* ① مطابق */}
        {tab === "matched" && (
          R.matched.length === 0 ? (
            <EmptyState icon={<Check size={28} color="var(--accentText)" />} title="لا مطابقات بعد"
              sub={bankRows.length ? "لم أجد تطابقًا في هذا المدى" : "استورد كشف الحساب أولًا"} />
          ) : (
            <div className="flex flex-col gap-2">
              {R.matched.map((m, i) => (
                <Row key={i} tone={m.confidence === "ضعيف" ? "var(--accentLine)" : "var(--goodLine)"}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: "var(--good)" }} className="text-xs font-bold">
                      {currency}{fmt(m.amount, 2)}
                    </span>
                    <span style={{ color: "var(--text3)" }} className="text-[10px]">
                      {m.bank.date}
                    </span>
                    <span className="flex-1" />
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "var(--panel)",
                        color: m.confidence === "قوي" ? "var(--goodSolid)" : "var(--accent)",
                        border: "1px solid var(--line)" }}>
                      {m.how === "ref" ? "بالمرجع" : m.how === "batch_day" ? "دفعة يوم"
                        : m.how === "batch_subset" ? "دفعة جزئية" : "مبلغ وتاريخ"}
                    </span>
                  </div>
                  {m.bank.desc && (
                    <p style={{ color: "var(--text3)" }} className="text-[10px] mb-1">{m.bank.desc}</p>
                  )}
                  {m.locals.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 py-0.5"
                      style={{ borderTop: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[10px]">
                        {l.ref}
                      </span>
                      <span style={{ color: "var(--text2)" }} className="text-[10px] flex-1">
                        {String(l.date).slice(0, 10)}{l.who ? ` · ${l.who}` : ""}
                      </span>
                      <span style={{ color: "var(--text2)" }} className="text-[10px]">
                        {fmt(l.amount, 2)}
                      </span>
                    </div>
                  ))}
                  {m.locals.length > 1 && (
                    <p style={{ color: "var(--text3)" }} className="text-[9px] mt-1">
                      ⚖ {m.locals.length} عملية في إيداع واحد
                    </p>
                  )}
                </Row>
              ))}
            </div>
          )
        )}

        {/* ② في الطريق */}
        {tab === "transit" && (
          R.inTransit.length === 0 ? (
            <EmptyState icon={<Check size={28} color="var(--good)" />} title="لا شيء معلّق"
              sub="كل عمليات النظام وصلت البنك" />
          ) : (
            <>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
                سُجّلت عندك ولم تظهر في كشف البنك بعد.
              </p>
              <div className="flex flex-col gap-2">
                {R.inTransit.map((t) => (
                  <Row key={t.id}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[11px]">
                        {t.ref}
                      </span>
                      <span style={{ color: "var(--text2)" }} className="text-[10px] flex-1">
                        {String(t.date).slice(0, 10)}{t.who ? ` · ${t.who}` : ""}
                      </span>
                      <span style={{ color: "var(--accent)" }} className="text-xs font-bold">
                        {currency}{fmt(t.amount, 2)}
                      </span>
                    </div>
                    {t.authCode && (
                      <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                        رقم التفويض {t.authCode}
                      </p>
                    )}
                  </Row>
                ))}
              </div>
            </>
          )
        )}

        {/* ③ غير مسجّل */}
        {tab === "unrecorded" && (
          R.unrecorded.length === 0 ? (
            <EmptyState icon={<Check size={28} color="var(--good)" />} title="لا حركات مجهولة"
              sub="كل ما في البنك له مقابل عندك" />
          ) : (
            <>
              <Card style={{ padding: 10, marginBottom: 10, border: "1px solid var(--badLine)" }}>
                <p style={{ color: "var(--bad)" }} className="text-[11px]">
                  ⚠ ظهرت في البنك ولا مقابل لها عندك — غالبًا عمولات خُصمت ولم تُقيَّد،
                  أو إيداعات من غير الشبكة. تركها بلا فحص يجعل رصيدك الدفتري يخالف البنك.
                </p>
              </Card>
              <div className="flex flex-col gap-2">
                {R.unrecorded.map((b) => (
                  <Row key={b.id} tone={b.type === "debit" ? "var(--badLine)" : undefined}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "var(--panel)",
                          color: b.type === "debit" ? "var(--bad)" : "var(--goodSolid)",
                          border: "1px solid var(--line)" }}>
                        {b.type === "debit" ? "خصم" : "إيداع"}
                      </span>
                      <span style={{ color: "var(--text2)" }} className="text-[10px] flex-1">
                        {b.date}
                      </span>
                      <span style={{ color: b.type === "debit" ? "var(--bad)" : "var(--goodSolid)" }}
                        className="text-xs font-bold">
                        {currency}{fmt(b.amount, 2)}
                      </span>
                    </div>
                    {(b.desc || b.ref) && (
                      <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                        {b.desc}{b.ref ? ` · ${b.ref}` : ""}
                      </p>
                    )}
                  </Row>
                ))}
              </div>
            </>
          )
        )}

        {bankTx?.length > 0 && (
          <button onClick={() => { if (confirm("حذف كل حركات البنك المستوردة؟")) onSaveBank([]); }}
            className="w-full py-2.5 rounded-xl text-xs font-bold mt-4"
            style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}>
            مسح كشف البنك المستورد
          </button>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// الرصيف العائم — زرّان متحركان يُطويان بضغطة
//
// الزر العائم يفيد لأنه في متناول الإبهام أينما كنت، ويزعج لأنه يحجب
// جزءًا من الشاشة. الطيّ يحلّ الاثنين: يبقى مقبض صغير على الحافة،
// وضغطة واحدة تُظهر الزرّين وأخرى تُخفيهما.
//
// وموضعه يُحفظ: من يعمل بيده اليسرى يسحبه لليسار مرة واحدة.
// ============================================================

export { BankReconPage };
