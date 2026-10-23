import React, { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { fmtMoney, fmtW } from "../core/money.js";
import { netWeightPosition } from "../domain/netWeight.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/// بداية الأساس: السنة · الربع · الشهر (بتوقيت الرياض كيوم العمل)
function baseStart(key) {
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const start = key === "month" ? Date.UTC(y, m, 1) : key === "quarter" ? Date.UTC(y, Math.floor(m / 3) * 3, 1) : Date.UTC(y, 0, 1);
  return start - 3 * 3600 * 1000;
}
const at = (x) => Date.parse(x?.date || x?.created_at || x?.createdAt || "") || 0;

/// الذهب المملوك (صافي 24) الذي دخل أو خرج بعد لحظةٍ من الدفتر الوزني: أصول الذهب (1xxx) تزيده، وما علينا ذهبًا (2xxx) يُنقصه
function goldDeltaSince(goldLedger, since) {
  let d = 0;
  for (const e of goldLedger || []) {
    if (at(e) < since) continue;
    const w = Number(e.fine_weight ?? e.fineWeight) || 0;
    const to = String(e.to_account ?? e.toAccount ?? ""), from = String(e.from_account ?? e.fromAccount ?? "");
    if (to.startsWith("1")) d += w;
    if (from.startsWith("1")) d -= w;
    if (to.startsWith("2")) d -= w;
    if (from.startsWith("2")) d += w;
  }
  return d;
}

/// رأس المال وتمويل الإدارة بعد لحظة (3xxx · 1170): يدخل النقد بلا ربح، فيُستبعد من التغيّر
function capitalFlowsSince(journal, since) {
  let v = 0;
  for (const e of journal || []) {
    if (at(e) < since) continue;
    for (const l of e.lines || []) {
      const c = String(l.account || "");
      if (c.startsWith("3") || c === "1170") v += (Number(l.credit) || 0) - (Number(l.debit) || 0);
    }
  }
  return v;
}

/**
 * صافي الفرع بالوزن بعد الالتزامات (المرجع NetWeightPage): الصافي كبيرًا، والتغيّر منذ بداية السنة أو الربع أو الشهر
 * (ربح الفرع بعد الالتزامات بالوزن، بلا رأس المال وتمويل الإدارة)، ثم بنوده ① الذهب ② النقد ③ الالتزامات ④ الصافي
 * ⑤ الذمم — وكل بندٍ يُضغط فيفتح شاشته. للعرض والقرار — لا يُكتب منه قيد.
 */
function NetWeightPage({ journal = [], goldLedger = [], price24 = 0, goldOwned24 = 0, fixedDue = [], baseKarat = 21, accountName, currency = "ر.س", onOpen, onBack }) {
  const [base, setBase] = useState("year");
  const now = useMemo(() => netWeightPosition({ journal, price24, goldOwned24, fixedDue, baseKarat, accountName }),
    [journal, price24, goldOwned24, fixedDue, baseKarat, accountName]);
  const change = useMemo(() => {
    const since = baseStart(base);
    const before = netWeightPosition({ journal: (journal || []).filter((e) => at(e) < since), price24, baseKarat, accountName,
      goldOwned24: (Number(goldOwned24) || 0) - goldDeltaSince(goldLedger, since) });
    const perGram = now.price24 > 0 ? now.price24 * (now.karat === 24 ? 1 : 0.875) : 0;
    const flows = capitalFlowsSince(journal, since);
    const flowsGrams = perGram > 0 ? flows / perGram : 0;
    return { grams: now.net.grams - before.net.grams - flowsGrams, flows, from: new Date(since + 3 * 3600 * 1000).toISOString().slice(0, 10) };
  }, [base, journal, goldLedger, price24, goldOwned24, baseKarat, accountName, now]);

  const num = { fontFamily: "'Cairo', sans-serif", fontVariantNumeric: "tabular-nums" };
  const sar = (v) => `${fmtMoney(v)} ${currency}`;
  const g = (v) => `${fmtW(v)} جم`;
  const toG = (v) => (now.price24 > 0 ? g(v / (now.price24 * (now.karat === 24 ? 1 : 0.875))) : "");
  const sign = (x) => (x > 0 ? "+" : x < 0 ? "−" : "");
  const go = (page) => (onOpen ? () => onOpen(page) : undefined);
  const pageOfLiab = (code) => (code === "vat" ? "vatReturn" : code.startsWith("fx:") ? "expenses" : code === "2110" || code === "2120" ? "suppliers" : "anyStatement");
  const Row = ({ l, a, b = "", strong = false, color = null, page = null }) => (
    <button type="button" onClick={page ? go(page) : undefined} disabled={!page} data-net-row
      className="w-full text-right flex justify-between items-center gap-2 py-2 text-[12px]"
      style={{ borderTop: "1px solid var(--line)", color: color || (strong ? "var(--text)" : "var(--text2)"), fontWeight: strong ? 800 : 500, minHeight: 40, background: "transparent" }}>
      <span style={{ textAlign: "start" }}>{l}</span>
      <span style={{ textAlign: "end", flexShrink: 0, ...num }}>{a}{b ? <span style={{ color: "var(--text3)", fontWeight: 500 }}> · {b}</span> : null}
        {page && <ChevronLeft size={12} style={{ display: "inline", verticalAlign: "middle", marginInlineStart: 4 }} />}</span>
    </button>
  );
  const K = now.karat;
  return (
    <div className="px-4 pt-4 pb-24" data-net-weight-page>
      <SubPageHeader title="صافي الفرع بالوزن — بعد الالتزامات" onBack={onBack} />
      <div className="w-full text-right mb-3 px-4 py-4"
        style={{ background: "linear-gradient(135deg, var(--accentBg), var(--panel) 70%)", border: "1px solid var(--accentLine)", borderRadius: 20 }}>
        <p style={{ color: "var(--text2)", margin: 0 }} className="text-xs font-bold">الصافي الآن · عيار {K}{now.price24 > 0 ? ` · سعر جرام 24: ${sar(now.price24)}` : ""}</p>
        <p data-net-grams={now.net.grams} style={{ color: now.net.grams < 0 ? "var(--bad)" : "var(--text)", margin: "2px 0 4px", ...num }} className="text-3xl font-black">
          {g(now.net.grams)}<span className="text-sm" style={{ color: "var(--text3)", fontWeight: 600 }}> ≈ {sar(now.net.value)}</span>
        </p>
        <p style={{ color: "var(--text3)", margin: 0, ...num }} className="text-[11px]">ذهب {g(now.gold.grams)} + نقد {g(now.cash.grams)} − التزامات {g(now.liabilities.grams)}</p>
      </div>

      <div className="w-full text-right mb-2 px-4 py-3" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16 }}>
        <div className="flex items-center justify-between gap-2">
          <span style={{ color: "var(--text2)" }} className="text-xs font-bold">تغيّر الصافي منذ {change.from} — ربح الفرع بعد الالتزامات</span>
          <span style={{ color: change.grams >= 0 ? "var(--good)" : "var(--bad)", flexShrink: 0, ...num }} className="text-lg font-extrabold">{sign(change.grams)}{g(Math.abs(change.grams))}</span>
        </div>
        {Math.abs(change.flows) >= 0.01 && <p style={{ color: "var(--text3)", margin: "2px 0 0", ...num }} className="text-[10px]">مستبعد: رأس مالٍ وتمويل {sar(change.flows)}</p>}
      </div>
      <div className="flex gap-1 mb-3" data-net-base={base}>
        {[["year", "منذ بداية السنة"], ["quarter", "هذا الربع"], ["month", "هذا الشهر"]].map(([id, l]) => (
          <button key={id} type="button" onClick={() => setBase(id)} aria-pressed={base === id} className="flex-1 py-1.5 rounded-lg text-[11px] font-bold"
            style={{ background: base === id ? "var(--accentBg)" : "var(--panel)", color: base === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>{l}</button>
        ))}
      </div>
      {now.priceMissing && <p style={{ color: "var(--bad)" }} className="text-xs mb-2">⚠ لا سعر ذهبٍ اليوم — أدخِله من «السعر اليومي» ليُحوَّل النقد والالتزامات ذهبًا.</p>}

      <Card style={{ padding: 12, marginBottom: 12 }}>
        <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-xs font-bold">① الذهب الفعلي — المملوك</p>
        <Row l="الذهب المملوك (مشغول وكسر وخزنة، بعد ما علينا ذهبًا للموردين)" a={g(now.gold.grams)} page="inventory" strong />
      </Card>

      <Card style={{ padding: 12, marginBottom: 12 }}>
        <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-xs font-bold">② النقد كلّه ذهبًا — كاش وشبكة وبنك بسعر اليوم</p>
        {now.cash.rows.length === 0 && <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">لا نقد في الدفتر.</p>}
        {now.cash.rows.map((x) => <Row key={x.code} l={`${x.code} ${x.name}`} a={sar(x.amount)} b={toG(x.amount)} page="cash" />)}
        <Row l="النقد معًا" a={sar(now.cash.total)} b={now.price24 > 0 ? `يساوي ${g(now.cash.grams)}` : ""} strong page="cash" />
      </Card>

      <Card style={{ padding: 12, marginBottom: 12 }}>
        <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-xs font-bold">③ الالتزامات حتى اليوم — تُخصم ذهبًا بسعر اليوم</p>
        {now.liabilities.rows.length === 0 && <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">لا التزامات.</p>}
        {now.liabilities.rows.map((x) => <Row key={x.code} l={x.code === "vat" || String(x.code).startsWith("fx:") ? x.name : `${x.code} ${x.name}`} a={sar(x.amount)} b={toG(x.amount)} page={pageOfLiab(String(x.code))} />)}
        <Row l="الالتزامات معًا" a={sar(now.liabilities.total)} b={now.price24 > 0 ? `تخصم ${g(now.liabilities.grams)}` : ""} strong color="var(--bad)" />
      </Card>

      <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
        <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-xs font-bold">④ الصافي بالوزن</p>
        <Row l="الذهب المملوك" a={g(now.gold.grams)} />
        <Row l="+ النقد ذهبًا" a={g(now.cash.grams)} />
        <Row l="− الالتزامات ذهبًا" a={`−${g(now.liabilities.grams)}`} />
        <Row l="= صافي الفرع بالوزن" a={g(now.net.grams)} b={sar(now.net.value)} strong color={now.net.grams >= 0 ? "var(--text)" : "var(--bad)"} />
      </Card>

      <Card style={{ padding: 12, marginBottom: 12 }}>
        <p style={{ color: "var(--accent)", margin: "0 0 4px" }} className="text-xs font-bold">⑤ الذمم المدينة — لا تدخل الصافي حتى تُحصَّل</p>
        {now.receivables.rows.length === 0 && <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">لا ذمم مدينة.</p>}
        {now.receivables.rows.map((x) => <Row key={x.code} l={`${x.code} ${x.name}`} a={sar(x.amount)} b={toG(x.amount)} page="customers" />)}
        {now.receivables.rows.length > 0 && <Row l="لو حُصّلت كلّها يصير الصافي" a={g(now.net.withReceivables)} strong />}
      </Card>

      <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[10px] leading-5">
        للعرض والقرار كالدفتر الثالث — لا يُكتب منه قيد. الذهب بالجرام الصافي لا يتحرّك بالسعر؛ والنقد والالتزامات تُحوَّل بسعر اليوم.
        المصروفات الثابتة التي حلّ موعدها ولم تُسجَّل تدخل الالتزامات.
      </p>
    </div>
  );
}

export { NetWeightPage };
