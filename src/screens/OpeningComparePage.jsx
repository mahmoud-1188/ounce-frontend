import React, { useMemo, useState } from "react";
import { fine24, fmtMoney, fmtW, fromHalalas, halalas, roundW } from "../core/money.js";
import { inputStyle, isLiveScrap } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function OpeningComparePage({
  openingBalance, cashTx = [], safeTx = [], scrapCustodyTx = [],
  items = [], scrapEntries = [], safeGoldTx = [], lots = [], sales = [],
  currency, price24 = 0, onBack,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(today);

  const cmp = useMemo(() => {
    // ⚠ حتى نهاية اليوم المختار لا بدايته: من يختار اليوم يريد ما فيه.
    const cutoff = `${asOf}T23:59:59.999Z`;
    const upto = (x) => String(x?.date || "") <= cutoff;

    // ── النقد ──
    const netCash = (arr) =>
      arr.filter(upto).reduce(
        (a, t) => a + (t.type === "out" ? -halalas(t.amount) : halalas(t.amount)), 0);
    const cashNow = fromHalalas(
      netCash(cashTx) + netCash(safeTx) + netCash(scrapCustodyTx));

    const ob = openingBalance || {};
    const cashOpen = fromHalalas(
      halalas(ob.safeCash || 0) + halalas(ob.safeNetwork || 0) +
      halalas(ob.dailyCash || 0) + halalas(ob.custodyCash || 0));

    // ── الذهب بمعادل 24 ──
    // ⚠ بالمعادل لا بالخام: عيارات مختلفة لا تُجمع، ومقارنة الخام
    // بالخام تُظهر نموًّا وهميًا حين يتحوّل 24 إلى 18.
    const craftedNow = (items || []).reduce((a, it) => {
      const avail = (it.units || []).filter((u) => !u.sold && !u.issued).length;
      return a + fine24((Number(it.weight) || 0) * avail, it.karat);
    }, 0);
    const scrapNow = (scrapEntries || [])
      .filter((e) => isLiveScrap(e) && upto(e))
      .reduce((a, e) => a + fine24(e.weight, e.karat), 0);
    const vaultNow = (safeGoldTx || []).filter(upto).reduce(
      (a, t) => a + (t.type === "out" ? -1 : 1) * fine24(t.weight, t.karat), 0);
    const goldNow = roundW(craftedNow + scrapNow + Math.max(0, vaultNow));

    const goldOpen = roundW(
      Object.entries(ob.goldByKarat || {}).reduce(
        (a, [k, w]) => a + fine24(Number(w) || 0, Number(k)), 0));

    // ── الالتزامات ──
    const owedNow = (lots || []).filter((l) => l.paymentMethod === "deferred" && upto(l))
      .reduce((a, l) => a + fine24(l.weight, l.karat), 0);
    const dueNow = (sales || []).filter((x) => x.paymentMethod === "credit" && upto(x))
      .reduce((a, x) => a + halalas(x.total), 0);

    const d = (now, open) => ({
      now, open,
      diff: Math.round((now - open) * 1000) / 1000,
      pct: open > 0 ? Math.round(((now - open) / open) * 1000) / 10 : null,
    });

    return {
      cash: d(cashNow, cashOpen),
      gold: d(goldNow, goldOpen),
      goldValue: d(
        fromHalalas(Math.round(goldNow * price24 * 100)),
        fromHalalas(Math.round(goldOpen * price24 * 100))),
      owedGold: owedNow,
      dueCash: fromHalalas(dueNow),
      days: Math.max(0, Math.round(
        (Date.parse(cutoff) - Date.parse(ob.date || cutoff)) / 864e5)),
      from: (ob.date || "").slice(0, 10) || "—",
    };
  }, [asOf, openingBalance, cashTx, safeTx, scrapCustodyTx, items,
      scrapEntries, safeGoldTx, lots, sales, price24]);

  const Row = ({ label, open, now, diff, unit, pct, hint }) => {
    const up = diff > 0.0005;
    const flat = Math.abs(diff) <= 0.0005;
    return (
      <Card style={{ padding: 12, marginBottom: 8 }}>
        <p style={{ color: "var(--accent)", margin: 0 }} className="text-[11px] font-bold">
          {label}
        </p>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[["البداية", open], ["الآن", now]].map(([t, v], i) => (
            <div key={i}>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{t}</p>
              <p style={{ color: "var(--text)", margin: 0 }} className="text-[13px] font-bold">
                {unit === "money" ? `${currency}${fmtMoney(v)}` : `${fmtW(v)} جم`}
              </p>
            </div>
          ))}
          <div>
            <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">الفرق</p>
            <p
              style={{ color: flat ? "var(--text2)" : up ? "var(--good)" : "var(--bad)", margin: 0 }}
              className="text-[13px] font-bold"
            >
              {flat ? "—" : `${up ? "↑" : "↓"} ${unit === "money"
                ? `${currency}${fmtMoney(Math.abs(diff))}`
                : `${fmtW(Math.abs(diff))}`}`}
            </p>
            {pct !== null && !flat && (
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">
                {up ? "+" : ""}{pct}٪
              </p>
            )}
          </div>
        </div>
        {hint && (
          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1.5">{hint}</p>
        )}
      </Card>
    );
  };

  return (
    <div>
      <SubPageHeader title="مقارنة بالرصيد الافتتاحي" onBack={onBack} />
      <div className="px-4 pt-3">

        <Card style={{ padding: 12, marginBottom: 10 }}>
          <Field label="حتى تاريخ">
            <input
              type="date"
              style={inputStyle}
              value={asOf}
              max={today}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </Field>
          <p style={{ color: "var(--text3)" }} className="text-[10px]">
            من {cmp.from} إلى {asOf} · {cmp.days} يومًا
          </p>
        </Card>

        <Row label="النقد" unit="money" open={cmp.cash.open} now={cmp.cash.now}
          diff={cmp.cash.diff} pct={cmp.cash.pct}
          hint="الخزنة والصندوق اليومي وعهدة الكسر معًا" />

        <Row label="الذهب — بمعادل عيار 24" unit="weight" open={cmp.gold.open}
          now={cmp.gold.now} diff={cmp.gold.diff} pct={cmp.gold.pct}
          hint="⚖ بالمعادل لا بالخام: مقارنة الخام بالخام تُظهر نموًّا وهميًا حين يتحوّل 24 إلى 18" />

        <Row label="قيمة الذهب بسعر اليوم" unit="money" open={cmp.goldValue.open}
          now={cmp.goldValue.now} diff={cmp.goldValue.diff} pct={cmp.goldValue.pct}
          hint="⚠ الفرق هنا يخلط تغيّر الوزن بتغيّر السعر — انظر الوزن أعلاه لتفصلهما" />

        {/* ── ما ليس ملكك بعد ── */}
        <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--badLine)" }}>
          <p style={{ color: "var(--bad)", margin: 0 }} className="text-[11px] font-bold mb-1">
            ⚠ خارج المقارنة
          </p>
          <div className="flex items-baseline justify-between">
            <span style={{ color: "var(--text2)" }} className="text-[11px]">
              ذهب مستحق للموردين
            </span>
            <span style={{ color: "var(--bad)" }} className="text-[12px] font-bold">
              {fmtW(cmp.owedGold)} جم24
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span style={{ color: "var(--text2)" }} className="text-[11px]">
              مبيعات آجلة لم تُحصَّل
            </span>
            <span style={{ color: "var(--accent)" }} className="text-[12px] font-bold">
              {currency}{fmtMoney(cmp.dueCash)}
            </span>
          </div>
          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1.5">
            ⚖ الأول يُنقص ما تملكه والثاني يزيده — وكلاهما خارج ما بين
            يديك الآن. من يقرأ الفرق أعلاه بلا هذين يظنّ نفسه أغنى أو
            أفقر مما هو.
          </p>
        </Card>

        <p style={{ color: "var(--text3)" }} className="text-[10px] leading-6">
          ⚠ الفرق ليس ربحًا. قد يكون بيعًا لم يُحصَّل، أو ذهبًا تحوّل
          نقدًا، أو نقدًا خرج شراءً. للربح انظر «القوائم المالية».
        </p>
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// الحسابات الجارية — الأمانة
//
// ⚠ المحل هنا كالبنك: يحفظ ويُقيّد ويُسلّم عند الطلب.
//
// والعميل يودع ذهبًا أو نقدًا، ويشتري أو يبيع من رصيده متى شاء —
// بسعر يوم الحركة لا يوم الإيداع.
//
// وأصحاب الحسابات منفصلون عن العملاء: من بينك وبينه رصيدٌ قائم ليس
// زبونًا يشتري ويمضي، وخلطه بمن اشترى مرةً يُضيّعه في قائمةٍ من مئات.
// ============================================================

export { OpeningComparePage };
