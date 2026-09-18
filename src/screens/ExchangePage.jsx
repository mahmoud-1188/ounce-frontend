import React, { useMemo, useState } from "react";
import { EXCHANGE_KINDS, EXCHANGE_VERSION } from "../core/constants.js";
import { fmt, fmtMoney } from "../core/money.js";
import { buildExchange } from "../domain/buildExchange.js";
import { exchangeKind, inputStyle, toCsv } from "../domain/helpers.js";
import { parseCsv } from "../domain/parseCsv.js";
import { validateExchange } from "../domain/validateExchange.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function ExchangePage({
  sales = [], returns = [], expenses = [], receipts = [], cashTx = [], safeTx = [],
  journal = [], items = [], customers = [], suppliers = [], accounts = [],
  importedRefs = [], branchCode = "", branchName = "", currency = "ر.س",
  onImport, onBack,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [dir, setDir] = useState("out");
  const [kind, setKind] = useState("sales");
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(today);
  const [raw, setRaw] = useState("");
  const [check, setCheck] = useState(null);
  const [msg, setMsg] = useState("");

  const def = exchangeKind(kind);
  const money = (v) => `${currency}${fmtMoney(v || 0)}`;

  const ex = useMemo(() => (dir === "out" ? buildExchange({
    kind, from, to, sales, returns, expenses, receipts, cashTx, safeTx,
    journal, items, customers, suppliers, accounts, branchCode, branchName,
  }) : null), [dir, kind, from, to, sales, returns, expenses, receipts, cashTx, safeTx, journal, items, customers, suppliers]);

  const download = (fmt) => {
    const name = `oqiyyah-${kind}-${from}_${to}`;
    const blob = fmt === "csv"
      ? new Blob([toCsv(ex.columns, ex.rows)], { type: "text/csv;charset=utf-8" })
      : new Blob([JSON.stringify(ex, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.${fmt}`;
    a.click();
    setMsg(`✓ نُزّل ${ex.count} صفًّا`);
  };

  const doCheck = () => {
    setMsg("");
    const text = raw.trim();
    if (!text) return;
    let cols = [], rws = [], k = kind;
    if (text.startsWith("{")) {
      // ⚠ JSON من أوقية: يحمل نوعه وأعمدته، فلا يُخمَّن
      try {
        const o = JSON.parse(text);
        if (o.v !== EXCHANGE_VERSION) { setCheck({ ok: false, fatal: `إصدار ${o.v} غير مدعوم` }); return; }
        k = o.kind; cols = o.columns || []; rws = o.rows || [];
        setKind(k);
      } catch (e) { setCheck({ ok: false, fatal: "JSON غير صالح" }); return; }
    } else {
      const all = parseCsv(text);
      if (!all.length) { setCheck({ ok: false, fatal: "الملف فارغ" }); return; }
      cols = all[0].map((x) => String(x).trim());
      rws = all.slice(1);
    }
    setCheck(validateExchange({ kind: k, columns: cols, rows: rws,
      existingRefs: new Set(importedRefs), accounts, items }));
  };

  const doImport = () => {
    if (!check?.good?.length) return;
    // ⚠ لا يُرحَّل إلا ما فُحص: الترحيل يأخذ نتيجة الفحص لا النصّ الخام،
    // فلا يتغيّر شيءٌ بين المعاينة والتنفيذ.
    const n = onImport?.({ kind: check.kind, rows: check.good.map((g) => {
      const o = {}; exchangeKind(check.kind).cols.forEach((c) => { o[c] = g.get(c); }); return o;
    }) });
    if (n) { setMsg(`✓ رُحِّل ${check.goodCount} صفًّا`); setRaw(""); setCheck(null); }
  };

  return (
    <div>
      <SubPageHeader title="التبادل مع الأنظمة" onBack={onBack} />
      <div className="px-4 pt-3">
        <Card style={{ padding: 11, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
            ⚠ <b>يُفحص كلّه ثم يُرحَّل كلّه، أو لا شيء.</b> استيرادٌ يُرحّل الصالح ويترك الفاسد
            يُنتج دفترًا نصفه من هنا ونصفه من هناك — ولا أحد يعرف أيّ نصف.
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {[["out", "إرسال لنظامٍ آخر"], ["in", "سحبٌ من نظامٍ آخر"]].map(([v, l]) => (
            <button key={v} onClick={() => { setDir(v); setCheck(null); setMsg(""); }}
              className="py-2.5 rounded-xl text-[11px] font-bold"
              style={{ background: dir === v ? "var(--accentBg)" : "var(--field)",
                color: dir === v ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
          ))}
        </div>

        {msg && <p style={{ color: msg.startsWith("⚠") ? "var(--bad)" : "var(--good)", margin: "0 0 8px" }}
          className="text-[11px]">{msg}</p>}

        <Field label="النوع">
          <select style={inputStyle} value={kind} onChange={(e) => { setKind(e.target.value); setCheck(null); }}>
            {EXCHANGE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </Field>
        {def && <p style={{ color: "var(--text3)", margin: "-4px 0 8px" }} className="text-[10px]">{def.hint}</p>}

        {/* ══ إرسال ══ */}
        {dir === "out" && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Field label="من"><input type="date" style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="إلى"><input type="date" style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            </div>
            <Card style={{ padding: 12, marginBottom: 10 }}>
              <p style={{ color: "var(--text)", margin: 0 }} className="text-[14px] font-black">
                {ex.count} <span className="text-[11px] font-bold" style={{ color: "var(--text3)" }}>صفًّا</span>
              </p>
              <p style={{ color: "var(--text3)", margin: "2px 0 0", direction: "ltr", fontFamily: "monospace" }}
                className="text-[9px]">{ex.columns.join(" · ")}</p>
            </Card>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => download("csv")} disabled={!ex.count}
                className="py-2.5 rounded-xl text-[12px] font-bold"
                style={{ background: ex.count ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                  color: ex.count ? "var(--panel)" : "var(--text3)" }}>CSV</button>
              <button onClick={() => download("json")} disabled={!ex.count}
                className="py-2.5 rounded-xl text-[12px] font-bold"
                style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>JSON</button>
            </div>
            {ex.rows.slice(0, 6).map((r, i) => (
              <Card key={i} style={{ padding: 8, marginBottom: 3 }}>
                <p style={{ color: "var(--text2)", margin: 0, direction: "ltr", fontFamily: "monospace" }}
                  className="text-[9px] truncate">{r.join(" · ")}</p>
              </Card>
            ))}
            {ex.count > 6 && (
              <p style={{ color: "var(--text3)" }} className="text-[10px]">… و{ex.count - 6} صفًّا آخر في الملف</p>
            )}
          </>
        )}

        {/* ══ سحب ══ */}
        {dir === "in" && (
          <>
            <Card style={{ padding: 11, marginBottom: 8 }}>
              <p style={{ color: "var(--accentText)", margin: "0 0 3px" }} className="text-[10px] font-bold">
                الأعمدة المتوقّعة
              </p>
              <p style={{ color: "var(--text3)", margin: 0, direction: "ltr", fontFamily: "monospace" }}
                className="text-[9px]">{def?.cols.join(",")}</p>
              <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px] leading-6">
                الصف الأول عناوين. يُقبل CSV أو JSON من أوقية. <b>ترتيب الأعمدة لا يهمّ</b> —
                تُقرأ بأسمائها.
              </p>
            </Card>
            <Field label="الصق محتوى الملف">
              <textarea style={{ ...inputStyle, minHeight: 120, direction: "ltr", fontFamily: "monospace", fontSize: 10 }}
                value={raw} onChange={(e) => { setRaw(e.target.value); setCheck(null); }}
                placeholder={`${def?.cols.join(",")}\n...`} />
            </Field>
            <button onClick={doCheck} disabled={!raw.trim()}
              className="w-full py-2.5 rounded-xl text-[12px] font-bold mb-3"
              style={{ background: raw.trim() ? "var(--accentBg)" : "var(--field)",
                color: raw.trim() ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>
              افحص قبل الترحيل
            </button>

            {check && (check.fatal ? (
              <Card style={{ padding: 12, border: "1px solid var(--badLine)" }}>
                <p style={{ color: "var(--bad)", margin: 0 }} className="text-[11px] leading-6">⚠ {check.fatal}</p>
              </Card>
            ) : (
              <>
                <Card style={{ padding: 12, marginBottom: 8,
                  border: `1px solid ${check.ok ? "var(--goodLine)" : "var(--badLine)"}` }}>
                  <div className="flex items-baseline justify-between">
                    <span style={{ color: "var(--good)" }} className="text-[12px] font-bold">
                      {check.goodCount} صالح
                    </span>
                    {check.badCount > 0 && (
                      <span style={{ color: "var(--bad)" }} className="text-[12px] font-bold">
                        {check.badCount} فاسد
                      </span>
                    )}
                  </div>
                  {check.summary != null && (
                    <p style={{ color: "var(--text2)", margin: "3px 0 0" }} className="text-[11px]">
                      الإجمالي {money(check.summary)}
                    </p>
                  )}
                  {check.balance && (
                    <p style={{ color: check.balance.balanced ? "var(--good)" : "var(--bad)", margin: "3px 0 0" }}
                      className="text-[10px]">
                      {check.balance.balanced ? "✓ القيود متوازنة" : "⚠ القيود غير متوازنة"} —
                      مدين {money(check.balance.debit)} · دائن {money(check.balance.credit)}
                    </p>
                  )}
                </Card>

                {check.bad.length > 0 && (
                  <>
                    <p style={{ color: "var(--bad)", margin: "0 0 5px" }} className="text-[11px] font-bold">
                      ⚠ صفوفٌ لن تُرحَّل
                    </p>
                    {check.bad.map((b) => (
                      <Card key={b.line} style={{ padding: 8, marginBottom: 3, background: "var(--badBg)" }}>
                        <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px]">
                          سطر {b.line}{b.ref ? ` · ${b.ref}` : ""}
                        </p>
                        <p style={{ color: "var(--bad)", margin: 0 }} className="text-[10px]">{b.errs.join(" · ")}</p>
                      </Card>
                    ))}
                    <p style={{ color: "var(--text3)", margin: "5px 0 8px" }} className="text-[10px] leading-6">
                      ⚠ صحّح الملف وأعد الفحص. <b>الترحيل لا يبدأ وفيه فاسد</b> — نصفُ دفترٍ
                      أسوأ من لا شيء.
                    </p>
                  </>
                )}

                <button onClick={doImport} disabled={!check.ok || !check.goodCount}
                  className="w-full py-3 rounded-xl text-[12px] font-bold"
                  style={{ background: check.ok && check.goodCount ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                    color: check.ok && check.goodCount ? "var(--panel)" : "var(--text3)" }}>
                  {check.ok ? `رحّل ${check.goodCount} صفًّا` : "لا يُرحَّل — صحّح الفاسد أولًا"}
                </button>
              </>
            ))}
          </>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

export { ExchangePage };
