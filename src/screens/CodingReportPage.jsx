import React, { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { fmtMoney, fmtW } from "../core/money.js";
import { buildCodingReport } from "../domain/buildCodingReport.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

const GROUP_OPTIONS = [
  ["day", "باليوم"],
  ["employee", "بالموظّف"],
  ["supplier", "بالمورّد"],
  ["lot", "بالدفعة"],
  ["category", "بالتصنيف"],
  ["karat", "بالعيار"],
];

/**
 * تقرير التكويد — نظير CodingReportPage.js في المرجع، لكن فوق بيانات
 * items/lots/categories/suppliers/users الحقيقية القادمة من bootstrap
 * (راجع تعليق buildCodingReport.js للفروق الدقيقة في أسماء الحقول).
 *
 * ⚠ تقرير محلي بحت: لا مسار خلفي جديد هنا — كل البيانات محمَّلة أصلًا
 * في حالة GoldInventoryApp.jsx (نفس مبدأ hqReports/masterReport
 * القائمة). صفحة قراءة فقط، بلا أي تعديل.
 */
function CodingReportPage({ items = [], lots = [], categories = [], suppliers = [], users = [], currency = "ر.س", onBack }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [groupBy, setGroupBy] = useState("day");
  const [open, setOpen] = useState("");

  const rep = useMemo(
    () => buildCodingReport({ items, lots, categories, suppliers, users, from, to, groupBy }),
    [items, lots, categories, suppliers, users, from, to, groupBy]
  );
  const money = (v) => `${currency}${fmtMoney(v || 0)}`;

  const quick = (d) => {
    const n = new Date();
    if (d === "today") { setFrom(today); setTo(today); return; }
    if (d === "week") { const a = new Date(n - 6 * 86400000); setFrom(a.toISOString().slice(0, 10)); setTo(today); return; }
    if (d === "month") { setFrom(`${today.slice(0, 7)}-01`); setTo(today); return; }
    if (d === "year") { setFrom(`${today.slice(0, 4)}-01-01`); setTo(today); }
  };

  return (
    <div>
      <SubPageHeader title="تقرير التكويد" onBack={onBack} />
      <div className="px-4 pt-3 pb-6">
        {/* ══ الفترة ══ */}
        <div className="flex gap-1.5 mb-2">
          {[["today", "اليوم"], ["week", "أسبوع"], ["month", "الشهر"], ["year", "السنة"]].map(([k, l]) => (
            <button
              key={k}
              onClick={() => quick(k)}
              className="flex-1 py-2 rounded-xl text-[11px] font-bold"
              style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Field label="من">
            <input type="date" style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="إلى">
            <input type="date" style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>

        {/* ══ الإجمالي ══ */}
        <Card style={{ padding: 13, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--text)", margin: 0 }} className="text-[18px] font-black">
            {fmtW(rep.totals.fine)} <span className="text-[11px] font-bold" style={{ color: "var(--text3)" }}>جم عيار 24</span>
          </p>
          <p style={{ color: "var(--text2)", margin: "2px 0 0" }} className="text-[11px]">
            {rep.totals.pieces} قطعة · {fmtW(rep.totals.weight)} جم بعياراتها · تكلفة {money(rep.totals.cost)}
          </p>
          {/* ⚠ غير المطبوع يُبرَز: قطعةٌ كُوّدت ولم تُطبع لا تُمسح ولا
              تُباع — وهي في الجرد ورقيًّا لا واقعيًّا. */}
          {rep.totals.unprinted > 0 && (
            <p style={{ color: "var(--bad)", margin: "6px 0 0" }} className="text-[11px] leading-6">
              ⚠ <b>{rep.totals.unprinted} قطعة بلا ملصق</b> — لا تُمسح ولا تُباع، وهي في الجرد
              ورقيًّا لا واقعيًّا. اطبعها من شاشة التكويد.
            </p>
          )}
        </Card>

        {/* ══ التجميع ══ */}
        <div className="flex gap-1 flex-wrap mb-3">
          {GROUP_OPTIONS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => { setGroupBy(k); setOpen(""); }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
              style={{
                background: groupBy === k ? "var(--accentBg)" : "var(--field)",
                color: groupBy === k ? "var(--accent)" : "var(--text3)",
                border: "1px solid var(--line)",
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {rep.groups.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={40} style={{ color: "var(--text3)" }} />}
            title="لا تكويد في هذه الفترة"
            sub="أي صنفٍ يُضاف من شاشة إضافة البضاعة يظهر هنا"
          />
        ) : (
          rep.groups.map((g) => (
            <div key={g.key}>
              <button onClick={() => setOpen(open === g.key ? "" : g.key)} className="w-full text-right">
                <Card
                  style={{
                    padding: 11,
                    marginBottom: 4,
                    border: open === g.key ? "1px solid var(--accentLine)" : "1px solid var(--line)",
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <span style={{ color: "var(--text)" }} className="text-[12px] font-bold">{g.key}</span>
                    <span style={{ color: "var(--accentText)" }} className="text-[12px] font-bold">
                      {fmtW(g.fine)} <span style={{ color: "var(--text3)" }} className="text-[11px]">جم24</span>
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span style={{ color: "var(--text3)" }} className="text-[11px]">{g.pieces} قطعة</span>
                    <span style={{ color: "var(--text3)" }} className="text-[11px]">{money(g.cost)}</span>
                    {g.unprinted > 0 && (
                      <span style={{ color: "var(--bad)", marginRight: "auto" }} className="text-[11px]">
                        ⚠ {g.unprinted} بلا ملصق
                      </span>
                    )}
                  </div>
                </Card>
              </button>
              {open === g.key && g.rows.map((r) => (
                <Card key={r.id} style={{ padding: 8, marginBottom: 3, marginRight: 12, background: "var(--bg)" }}>
                  <div className="flex items-baseline gap-2">
                    <span style={{ color: "var(--text3)" }} className="text-[11px]">{String(r.at).slice(0, 10)}</span>
                    <span style={{ color: "var(--text2)" }} className="text-[11px] flex-1 truncate">
                      {r.by} · {r.supplier} · {r.category}
                    </span>
                    <span style={{ color: "var(--text3)" }} className="text-[11px]">
                      ع{r.karat} · {r.pieces}×{fmtW(r.weight / r.pieces)}
                    </span>
                    {r.printed < r.pieces && (
                      <span style={{ color: "var(--bad)" }} className="text-[11px]">{r.pieces - r.printed}⚠</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ))
        )}

        <Card style={{ padding: 11, marginTop: 10 }}>
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] leading-6">
            ⚠ <b>الوزن قبل العدد.</b> مئة خاتمٍ خفيف غير مئة سوارٍ ثقيل — والمحل يشتري وزنًا
            لا عددًا. ولذلك يُرتَّب بالمعادل 24 لا بعدد القطع.
          </p>
        </Card>
      </div>
    </div>
  );
}

export { CodingReportPage };
