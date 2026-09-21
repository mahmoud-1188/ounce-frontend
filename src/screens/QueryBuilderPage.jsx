import React, { useMemo, useState } from "react";
import { JOURNALS } from "../core/chart.js";
import { QUERY_FIELDS, QUERY_OPS } from "../core/constants.js";
import { fmtMoney, fmtW } from "../core/money.js";
import { describeQuery, fineToKarat, inputStyle, runQuery, toCsv } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/**
 * مُنشئ الاستعلام — نظير QueryBuilderPage.js في المرجع بالمعنى، لكن فوق
 * أشكال البيانات الحقيقية (راجع تعليق runQuery في domain/helpers.js
 * للتفصيل الكامل):
 *   • accounts هنا CHART_OF_ACCOUNTS الحقيقي (code/name) بدل شجرة
 *     حسابات المرجع — نفس الحقلين المستخدَمين في runQuery بالضبط.
 *   • JOURNALS مبنيّة هنا فعليًّا (core/chart.js) لتغطية الـ76 نوع عملية
 *     الحقيقي في POSTING_RULES، لا الستة الأصغر في المرجع — راجع تعليق
 *     JOURNALS نفسه لتبرير كل قرار تصنيف.
 *   • لا مكوّن W منفصل (لم يوجد في منتجنا) — fmtW/fineToKarat مباشرة،
 *     نفس اتفاقية كل شاشة أخرى في هذا المشروع.
 *   • toCsv هنا بتوقيع (headers, rows) الحقيقي في helpers.js (يضيف BOM
 *     داخليًّا) لا شكل المرجع (مصفوفة أسطر واحدة) — نفس اتفاقية
 *     ExchangePage.jsx القائمة.
 *   • الأسئلة المحفوظة محلية بحتة (SAVED_QUERIES_KEY) — تفضيلٌ شخصي لا
 *     بيانات عمل تحتاج مصدر حقيقةٍ خادميًّا (نفس منزلة menuOrder).
 */
function QueryBuilderPage({ journal = [], goldLedger = [], accounts = [],
  currency = "ر.س", displayKarat = 21, saved = [], onSaveQuery, onBack }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [unit, setUnit] = useState("both");
  const [filters, setFilters] = useState({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const setF = (id, patch) => setFilters((p) => ({ ...p, [id]: { op: "eq", ...(p[id] || {}), ...patch } }));
  const clear = (id) => setFilters((p) => { const n = { ...p }; delete n[id]; return n; });

  const res = useMemo(() => runQuery({ journal, goldLedger, accounts, filters, from, to, unit, displayKarat }),
    [journal, goldLedger, accounts, filters, from, to, unit, displayKarat]);
  const desc = useMemo(() => describeQuery({ filters, from, to, unit, accounts, displayKarat }),
    [filters, from, to, unit, accounts, displayKarat]);
  const money = (v) => `${currency}${fmtMoney(v || 0)}`;
  const active = Object.keys(filters).filter((k) => {
    const v = filters[k];
    return v && v.value !== "" && v.value !== undefined && v.value !== false;
  });

  const exportCsv = () => {
    const head = unit === "weight"
      ? ["التاريخ", "المرجع", "اليومية", "الحساب", "الاسم", "العيار", "الوزن", `معادل ${displayKarat}`, "الاتجاه"]
      : ["التاريخ", "المرجع", "اليومية", "الحساب", "الاسم", "مدين", "دائن", "من رحّله", "البيان"];
    const rows = res.rows.map((r) => (r.kind === "weight"
      ? [String(r.at).slice(0, 10), r.ref, r.journal, r.account, r.accountName,
         r.karat, fmtW(r.weight), fmtW(fineToKarat(r.fine, displayKarat)), r.dir === "in" ? "داخل" : "خارج"]
      : [String(r.at).slice(0, 10), r.ref, r.journal, r.account, r.accountName,
         fmtMoney(r.debit), fmtMoney(r.credit), r.by, r.note]));
    // ⚠ الوصف سطرٌ في الملف: جدولُ أرقامٍ بلا سؤاله ورقةٌ لا معنى لها
    // بعد أسبوع، والمراجع الذي يستلمه يحتاج أن يعرف بأي شرطٍ استُخرج.
    const csv = toCsv(["استعلام أوقية"], [[desc], [`${res.count} سطرًا · ${res.entries} عملية`], [], head, ...rows]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `استعلام-${today}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  return (
    <div>
      <SubPageHeader title="مُنشئ الاستعلام" onBack={onBack} />
      <div className="px-4 pt-3">
        <Card style={{ padding: 11, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-6">
            ⚠ <b>كل تقريرٍ جاهز يُجيب سؤالًا صمّمه أحدٌ سلفًا.</b> وهنا تُركّب سؤالك أنت —
            بالمال أو بالوزن أو بهما.
          </p>
        </Card>

        {/* ══ الفترة والدفتر ══ */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field label="من"><input type="date" style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="إلى"><input type="date" style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <div className="flex gap-1.5 mb-3">
          {[["both", "الدفتران"], ["money", "النقدي"], ["weight", "الوزني"]].map(([u, l]) => (
            <button key={u} onClick={() => setUnit(u)} className="flex-1 py-2 rounded-xl text-[11px] font-bold"
              style={{ background: unit === u ? "var(--accentBg)" : "var(--field)",
                color: unit === u ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>{l}</button>
          ))}
        </div>

        {/* ══ النتيجة أولًا ══
            ⚠ فوق المرشّحات لا تحتها: من يُركّب سؤالًا يريد أن يرى أثر كل
            شرطٍ فور إضافته — لا أن ينزل للأسفل في كل مرة. */}
        <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
          <div className="flex items-baseline justify-between">
            <span style={{ color: "var(--text)" }} className="text-[15px] font-black">{res.count}</span>
            <span style={{ color: "var(--text3)" }} className="text-[11px]">
              سطرًا · {res.entries} عملية
            </span>
          </div>
          {unit !== "weight" && (res.totals.debit > 0 || res.totals.credit > 0) && (
            <p style={{ color: "var(--text2)", margin: "3px 0 0" }} className="text-[11px]">
              مدين {money(res.totals.debit)} · دائن {money(res.totals.credit)}
            </p>
          )}
          {unit !== "money" && (res.totals.fineIn > 0 || res.totals.fineOut > 0) && (
            <p style={{ margin: "3px 0 0" }} className="text-[11px]">
              {res.totals.fineIn > 0 && (
                <span style={{ color: "var(--good)" }}>↓ {fmtW(fineToKarat(res.totals.fineIn, displayKarat))} جم{displayKarat}</span>
              )}
              {res.totals.fineOut > 0 && (
                <span style={{ color: "var(--bad)", marginRight: 8 }}>↑ {fmtW(fineToKarat(res.totals.fineOut, displayKarat))} جم{displayKarat}</span>
              )}
            </p>
          )}
          <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[11px] leading-6">{desc}</p>
          {res.count > 0 && (
            <button onClick={exportCsv} className="w-full py-2.5 rounded-xl text-[11px] font-bold mt-2"
              style={{ background: "var(--field)", color: "var(--accent)", border: "1px solid var(--line)" }}>
              صدّر النتيجة
            </button>
          )}
        </Card>

        {/* ══ المرشّحات ══ */}
        <button onClick={() => setOpen((v) => !v)} className="w-full text-right mb-2">
          <Card style={{ padding: 11 }}>
            <div className="flex items-baseline justify-between">
              <span style={{ color: "var(--accentText)" }} className="text-[11px] font-bold">
                الشروط {active.length ? `(${active.length})` : ""}
              </span>
              <span style={{ color: "var(--text3)" }} className="text-[11px]">{open ? "إخفاء" : "إظهار"}</span>
            </div>
          </Card>
        </button>

        {open && QUERY_FIELDS.map((f) => {
          const v = filters[f.id] || {};
          const on = active.includes(f.id);
          return (
            <Card key={f.id} style={{ padding: 10, marginBottom: 4,
              border: on ? "1px solid var(--accentLine)" : "1px solid var(--line)" }}>
              <div className="flex items-baseline justify-between mb-1">
                <span style={{ color: "var(--text2)" }} className="text-[11px] font-bold">{f.label}</span>
                {on && (
                  <button onClick={() => clear(f.id)} style={{ color: "var(--bad)" }} className="text-[11px]">امسح</button>
                )}
              </div>
              {f.kind === "bool" ? (
                <button onClick={() => setF(f.id, { value: !v.value })}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
                  style={{ background: v.value ? "var(--accentBg)" : "var(--field)",
                    color: v.value ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>
                  {v.value ? "مُفعَّل" : "غير مُفعَّل"}
                </button>
              ) : f.id === "journal" ? (
                <select style={inputStyle} value={v.value || ""} onChange={(e) => setF(f.id, { value: e.target.value })}>
                  <option value="">الكل</option>
                  {JOURNALS.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
                </select>
              ) : f.kind === "account" ? (
                <>
                  <select style={inputStyle} value={v.value || ""} onChange={(e) => setF(f.id, { value: e.target.value })}>
                    <option value="">كل الحسابات</option>
                    {accounts.filter((a) => !a.group).map((a) => (
                      <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                  <p style={{ color: "var(--text3)", margin: "3px 0 0" }} className="text-[11px]">{f.hint}</p>
                </>
              ) : (
                <>
                  {f.kind === "number" && (
                    <div className="flex gap-1 flex-wrap mb-1.5">
                      {QUERY_OPS.filter((o) => o.id !== "has" && o.id !== "not").map((o) => (
                        <button key={o.id} onClick={() => setF(f.id, { op: o.id })}
                          className="px-2 py-1 rounded-lg text-[11px]"
                          style={{ background: (v.op || "eq") === o.id ? "var(--accentBg)" : "var(--field)",
                            color: (v.op || "eq") === o.id ? "var(--accent)" : "var(--text3)",
                            border: "1px solid var(--line)" }}>{o.label}</button>
                      ))}
                    </div>
                  )}
                  {f.kind === "text" && (
                    <div className="flex gap-1 mb-1.5">
                      {QUERY_OPS.filter((o) => o.id === "has" || o.id === "not").map((o) => (
                        <button key={o.id} onClick={() => setF(f.id, { op: o.id })}
                          className="px-2 py-1 rounded-lg text-[11px]"
                          style={{ background: (v.op || "has") === o.id ? "var(--accentBg)" : "var(--field)",
                            color: (v.op || "has") === o.id ? "var(--accent)" : "var(--text3)",
                            border: "1px solid var(--line)" }}>{o.label}</button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input style={inputStyle} value={v.value ?? ""}
                      inputMode={f.kind === "number" ? "decimal" : "text"}
                      onChange={(e) => setF(f.id, { value: e.target.value, op: v.op || (f.kind === "text" ? "has" : "eq") })}
                      placeholder={f.unit === "weight" ? `بعيار ${displayKarat}` : ""} />
                    {v.op === "between" && (
                      <input style={inputStyle} value={v.value2 ?? ""} inputMode="decimal"
                        onChange={(e) => setF(f.id, { value2: e.target.value })} placeholder="إلى" />
                    )}
                  </div>
                </>
              )}
            </Card>
          );
        })}

        {/* ══ حفظ السؤال ══
            ⚠ المحاسب يسأل نفس السؤال كل شهر، وإعادةُ تركيبه في كل مرة
            تعني أنه سيتوقّف عن سؤاله. */}
        {active.length > 0 && onSaveQuery && (
          <Card style={{ padding: 11, marginTop: 8 }}>
            <Field label="احفظ هذا السؤال باسم">
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)}
                placeholder="مصروفات فوق 10 آلاف بلا مستند" />
            </Field>
            <button onClick={() => { if (name.trim()) { onSaveQuery({ name: name.trim(), filters, unit }); setName(""); } }}
              disabled={!name.trim()} className="w-full py-2.5 rounded-xl text-[11px] font-bold"
              style={{ background: name.trim() ? "var(--accentBg)" : "var(--field)",
                color: name.trim() ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>
              احفظ
            </button>
          </Card>
        )}
        {saved.length > 0 && (
          <div className="mt-3">
            <p style={{ color: "var(--accentText)", margin: "0 0 5px" }} className="text-[11px] font-bold">
              أسئلةٌ محفوظة
            </p>
            {saved.map((q, i) => (
              <button key={i} onClick={() => { setFilters(q.filters || {}); setUnit(q.unit || "both"); setOpen(true); }}
                className="w-full text-right mb-2">
                <Card style={{ padding: 10 }}>
                  <span style={{ color: "var(--text2)" }} className="text-[11px]">{q.name}</span>
                </Card>
              </button>
            ))}
          </div>
        )}

        {/* ══ النتائج ══ */}
        {res.count > 0 && (
          <div className="mt-3">
            <p style={{ color: "var(--accentText)", margin: "0 0 5px" }} className="text-[11px] font-bold">
              النتائج {res.count > 100 ? "— أول 100" : ""}
            </p>
            {res.rows.slice(0, 100).map((r, i) => (
              <Card key={i} style={{ padding: 9, marginBottom: 3 }}>
                <div className="flex items-baseline gap-2">
                  <span style={{ color: "var(--text3)" }} className="text-[11px]">{String(r.at).slice(0, 10)}</span>
                  <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[11px]">{r.ref}</span>
                  <span style={{ color: "var(--text2)" }} className="text-[11px] flex-1 truncate">{r.accountName}</span>
                  {r.kind === "weight" ? (
                    <span style={{ color: r.dir === "in" ? "var(--good)" : "var(--bad)" }} className="text-[11px] font-bold">
                      {r.dir === "in" ? "↓" : "↑"} {fmtW(fineToKarat(r.fine, displayKarat))} جم{displayKarat}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text)" }} className="text-[11px] font-bold">
                      {fmtMoney(r.debit || r.credit)}
                    </span>
                  )}
                </div>
                {(r.by || r.note) && (
                  <p style={{ color: "var(--text3)", margin: "1px 0 0" }} className="text-[11px] truncate">
                    {[r.journal, r.by, r.note].filter(Boolean).join(" · ")}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

export { QueryBuilderPage };
