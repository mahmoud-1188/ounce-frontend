import React, { useMemo } from "react";
import { Gem } from "lucide-react";
import { fine24, fmt, fmtMoney, fmtW, weightTimesPrice } from "../core/money.js";
import { categoryLabel, itemLabel } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";

function InventorySummaryTab({ totals, currency, items = [], scrapEntries = [],
  safeGoldTx = [], trustGold = [], price24 = 0, onOpenEntity }) {
  // ── الذهب بالعيار وبمعادله عيار 24 ──
  //
  // العيارات لا تُجمع خامًا: 10 جم عيار 18 ليست كـ10 جم عيار 24. عرض
  // مجموع خام يعطي رقمًا لا معنى له، فنعرض كل عيار على حدة ثم معادله.
  //
  // ⚠ والكسر يُفصل: ليس بضاعة جاهزة للبيع بل خامٌ ينتظر الفحص، وضمّه
  // للمشغول يجعل المخزون يبدو أكبر مما يُعرض على الزبون.
  const gold = useMemo(() => {
    const mk = () => ({ crafted: 0, scrap: 0, safe: 0, trust: 0 });
    const byK = {};
    const at = (k) => (byK[k] ||= mk());

    items.forEach((it) => {
      const q = (it.units || []).filter((u) => !u.sold).length;
      if (q > 0) at(it.karat).crafted += (Number(it.weight) || 0) * q;
    });
    scrapEntries.forEach((e) => {
      // ⚠ المستهلَك لا يُعدّ كسرًا.
      //
      // الكسر الذي دخل المخزون صار قطعةً مشغولة، وعدّه في العمودين
      // يُظهر تسعة جرامات ثمانيةَ عشر — والمالك يظنّ عنده ضِعف ما
      // عنده، والجرد يكشف عجزًا لا وجود له.
      if (e.consumed || e.status === "converted" || e.stage === "used") return;
      // وما رُفض أو أُلغي كذلك
      if (e.status === "rejected" || e.status === "cancelled") return;
      const w = Number(e.weight) || 0;
      if (w > 0) at(e.karat).scrap += w;
    });
    safeGoldTx.forEach((t) => {
      const w = Number(t.weight) || 0;
      at(t.karat).safe += t.type === "in" ? w : -w;
    });
    trustGold.filter((t) => t.status !== "returned").forEach((t) => {
      at(t.karat).trust += Number(t.weight) || 0;
    });

    const rows = Object.entries(byK)
      .map(([k, v]) => {
        const karat = Number(k);
        const owned = v.crafted + v.scrap + Math.max(0, v.safe);
        return {
          karat, ...v, owned,
          fineCrafted: fine24(v.crafted, karat),
          fineScrap: fine24(v.scrap, karat),
          fineSafe: fine24(Math.max(0, v.safe), karat),
          fineTrust: fine24(v.trust, karat),
          fineOwned: fine24(owned, karat),
        };
      })
      .filter((r) => r.owned > 0.0005 || r.trust > 0.0005)
      .sort((a, b) => b.karat - a.karat);

    const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
    return {
      rows,
      totalFine: sum((r) => r.fineOwned),
      craftedFine: sum((r) => r.fineCrafted),
      scrapFine: sum((r) => r.fineScrap),
      safeFine: sum((r) => r.fineSafe),
      trustFine: sum((r) => r.fineTrust),
      rawSum: sum((r) => r.owned),
    };
  }, [items, scrapEntries, safeGoldTx, trustGold]);

  const cell = { border: "1px solid var(--line)", padding: "5px 6px", fontSize: 11, whiteSpace: "nowrap", textAlign: "center" };
  const head = { ...cell, background: "var(--panel)", color: "var(--accent)", fontWeight: 700 };

  const categories = Object.entries(totals.byCategory || {}).sort((a, b) => b[1].weight - a[1].weight);

  return (
    <div className="px-4 pt-6">
      <div className="flex items-baseline justify-between mb-4">
        <h1 style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)" }} className="text-2xl font-extrabold">
          المخزون
        </h1>
      </div>

      {/* ── الذهب بالعيار ── */}
      {gold.rows.length > 0 && (
        <>
          <Card style={{ padding: 14, marginBottom: 12 }}>
            <div className="flex items-baseline justify-between">
              <span style={{ color: "var(--text2)" }} className="text-xs">إجمالي الذهب المملوك</span>
              <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-xl font-extrabold">
                {fmtW(gold.totalFine)} جم
              </span>
            </div>
            <p style={{ color: "var(--text3)" }} className="text-[10px]">
              بمعادل عيار 24 · الخام {fmtW(gold.rawSum)} جم بعياراته
            </p>
            <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
              ⚖ العيارات لا تُجمع خامًا — 10 جم عيار 18 ليست كـ10 جم عيار 24.
            </p>
            {price24 > 0 && (
              <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1.5">
                قيمته بسعر اليوم {currency}{fmt(weightTimesPrice(gold.totalFine, price24), 0)}
              </p>
            )}
          </Card>

          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 400 }}>
              <thead>
                <tr>
                  <th style={{ ...head, width: 52 }}>العيار</th>
                  <th style={head}>مشغول</th>
                  <th style={head}>كسر</th>
                  <th style={head}>خزنة</th>
                  <th style={head}>المجموع</th>
                  <th style={head}>عيار 24</th>
                </tr>
              </thead>
              <tbody>
                {gold.rows.map((r) => (
                  <tr key={r.karat}>
                    <td style={{ ...cell, color: "var(--accent)", fontWeight: 700 }}>{r.karat}</td>
                    <td style={{ ...cell, color: r.crafted ? "var(--text)" : "var(--accentLine)" }}>
                      {r.crafted ? fmtW(r.crafted) : "—"}
                    </td>
                    <td style={{ ...cell, color: r.scrap ? "var(--accentSoft)" : "var(--accentLine)" }}>
                      {r.scrap ? fmtW(r.scrap) : "—"}
                    </td>
                    <td style={{ ...cell, color: r.safe > 0 ? "var(--text2)" : "var(--accentLine)" }}>
                      {r.safe > 0 ? fmtW(r.safe) : "—"}
                    </td>
                    <td style={{ ...cell, color: "var(--text)", fontWeight: 700 }}>{fmtW(r.owned)}</td>
                    <td style={{ ...cell, color: "var(--accent)" }}>{fmtW(r.fineOwned)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={head}>الكل</td>
                  <td style={head}>{fmtW(gold.rows.reduce((a, r) => a + r.crafted, 0))}</td>
                  <td style={head}>{fmtW(gold.rows.reduce((a, r) => a + r.scrap, 0))}</td>
                  <td style={head}>{fmtW(gold.rows.reduce((a, r) => a + Math.max(0, r.safe), 0))}</td>
                  <td style={{ ...head, color: "var(--text3)" }}>—</td>
                  <td style={head}>{fmtW(gold.totalFine)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* تفصيل النوع */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "مشغول", v: gold.craftedFine, c: "var(--text)", hint: "جاهز للبيع" },
              { label: "كسر", v: gold.scrapFine, c: "var(--accentSoft)", hint: "خام ينتظر الفحص" },
              { label: "خزنة", v: gold.safeFine, c: "var(--text2)", hint: "خام مخزّن" },
            ].map((x, i) => (
              <Card key={i} style={{ padding: 10 }}>
                <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px]">{x.label}</p>
                <p style={{ color: x.c, margin: 0 }} className="text-sm font-bold">{fmtW(x.v)}</p>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[9px]">{x.hint}</p>
              </Card>
            ))}
          </div>

          {gold.trustFine > 0.0005 && (
            <Card style={{ padding: 10, marginBottom: 12 }}>
              <p style={{ color: "var(--text2)" }} className="text-[11px]">
                ⚖ ومعك <span style={{ color: "var(--accentText)", fontWeight: 700 }}>{fmtW(gold.trustFine)} جم</span> ذهب
                أمانة — ملك العملاء، خارج مخزونك ولا يُباع.
              </p>
            </Card>
          )}
        </>
      )}

      <Card style={{ padding: 18 }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
              عدد القطع
            </p>
            <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)" }} className="text-2xl font-extrabold">
              {totals.pieces}
            </p>
          </div>
          <div>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
              الوزن الإجمالي (بعيار 24)
            </p>
            <p style={{ fontFamily: "'Cairo', sans-serif", color: "var(--accent)" }} className="text-2xl font-extrabold">
              {fmtW(totals.fineWeight)} جم
            </p>
          </div>
        </div>
        <p style={{ color: "var(--text3)" }} className="text-[11px] mt-2">
          الوزن الفعلي: {fmtW(totals.weight)} جم · القيمة الحالية {currency}
          {fmt(totals.value, 0)}
        </p>
      </Card>

      <p style={{ color: "var(--text2)" }} className="text-xs mt-6 mb-2">
        تفصيل حسب نوع القطعة
      </p>
      {categories.length === 0 ? (
        <EmptyState icon={<Gem size={40} color="var(--accentText)" />} title="لا يوجد أصناف بعد" sub="اضغط على “التكويد” لتسجيل أول دفعة في المخزون" />
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map(([catId, data]) => (
            <Card key={catId} style={{ padding: 12 }}>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                  {categoryLabel(catId)}
                </span>
                <span style={{ color: "var(--text2)" }} className="text-xs">
                  {data.count} قطعة
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span style={{ color: "var(--text3)" }} className="text-[11px]">
                  الوزن الفعلي: {fmtW(data.weight)} جم
                </span>
                <span style={{ color: "var(--accentText)" }} className="text-[11px]">
                  بعيار 24: {fmtW(data.fineWeight)} جم
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {/* ── القطع واحدةً واحدة ── */}
      {onOpenEntity && items.length > 0 && (
        <>
          <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mt-4 mb-1">
            القطع — اضغط أيًّا منها
          </p>
          <p style={{ color: "var(--text3)" }} className="text-[10px] mb-2">
            ⚖ بياناتها وحركاتها وإجراءاتها في ورقة واحدة — بلا مغادرة الشاشة.
          </p>
          <div className="flex flex-col gap-1.5">
            {items.slice(0, 40).map((it) => {
              const avail = (it.units || []).filter((u) => !u.sold && !u.issued).length;
              return (
                <button
                  key={it.id}
                  onClick={() => onOpenEntity("item", it)}
                  className="w-full text-right rounded-xl px-3 py-2.5 flex items-center gap-2"
                  style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}
                >
                  <span className="flex-1 min-w-0">
                    <span style={{ color: "var(--text)" }} className="text-[12px] font-bold block truncate">
                      {itemLabel(it)}
                    </span>
                    <span style={{ color: "var(--text3)" }} className="text-[10px]">
                      {fmtW(it.weight)} جم · {avail} متاح{it.ref ? ` · ${it.ref}` : ""}
                    </span>
                  </span>
                  <span style={{ color: "var(--accent)" }} className="text-[11px]">
                    {currency}{fmtMoney(fine24(it.weight, it.karat) * (price24 || 0))}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}

export { InventorySummaryTab };
