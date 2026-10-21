import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as api from "../core/api.js";
import { fmtMoney, fmtW } from "../core/money.js";
import { Card } from "./Card.jsx";

/// «كم ضاع في التصنيع؟» (المرجع WastageReportView): أوامر الورشة المقفلة في الفترة بنسبة هدرها ومسموحها وزائدها ومصيره،
/// والأوزان المكتوبة باليد، وما يزال قيد الاستلام، والمطالبات المفتوحة — ولكل ورشة ولكل عيار. الحساب على الخادم.
const field = { background: "var(--field)", color: "var(--text)", border: "1px solid var(--line)" };

function WastageReportView({ currency = "ر.س" }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [r, setR] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    setErr("");
    api.workshopApi.report(from, to).then((d) => { if (live) setR(d); }).catch(() => { if (live) setErr("تعذّر تحميل التقرير"); });
    return () => { live = false; };
  }, [from, to]);
  const exportXlsx = () => {
    const rows = [["الأمر", "الورشة", "العيار", "المصروف صافٍ", "المشغول صافٍ", "المردود صافٍ", "الهدر جم", "الهدر ٪", "المسموح ٪", "الزائد جم", `الزائد ${currency}`, "المصير", "أوزانٌ يدوية"],
      ...r.rows.map((x) => [x.ref, x.workshop, x.karat, x.issued, x.out, x.returned, x.loss, x.lossPct, x.allowPct, x.over, x.overValue, x.fate === "claim" ? "على الورشة" : x.fate === "writeoff" ? "شُطب" : "", x.manual])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "الهدر");
    XLSX.writeFile(wb, `الهدر-في-التصنيع-${today}.xlsx`);
  };
  const T = r?.total;
  return (
    <div data-wastage-report>
      <Card style={{ padding: 12, marginBottom: 10 }}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <label className="text-[10px]" style={{ color: "var(--text3)" }}>من
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full px-2 py-1.5 rounded-lg text-[12px]" style={field} /></label>
          <label className="text-[10px]" style={{ color: "var(--text3)" }}>إلى
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-2 py-1.5 rounded-lg text-[12px]" style={field} /></label>
        </div>
        <p style={{ color: "var(--text)", margin: 0 }} className="text-[13px] font-bold">كم ضاع في التصنيع؟</p>
        {err && <p style={{ color: "var(--bad)" }} className="text-[11px]">{err}</p>}
        {T && (
          <>
            <p style={{ color: T.over > 0.0005 ? "var(--bad)" : "var(--text2)", margin: "4px 0 0" }} className="text-[12px]" data-wastage-total>
              {T.jobs ? `صرفنا ${fmtW(T.issued)} جم صافٍ · الهدر ${fmtW(T.loss)} جم = ${Number(T.lossPct).toFixed(2)}٪ · المسموح ${fmtW(T.allowed)} · الزائد ${fmtW(T.over)} جم (${fmtMoney(T.overValue)} ${currency})` : "لا أوامر ورشة مقفلة في هذه الفترة"}
            </p>
            {T.weighed > 0 && (
              <p style={{ color: T.manual ? "var(--accentText)" : "var(--good)", margin: "2px 0 0" }} className="text-[11px] font-bold">
                {T.manual ? `⚠ فيه وزنٌ مكتوب باليد — ${T.manual} من ${T.weighed} (${T.manualPct}٪)` : "✓ كل الأوزان من الميزان"}
              </p>
            )}
            {r.rows.length > 0 && <button type="button" onClick={exportXlsx} className="mt-2 px-3 rounded-xl text-[11px] font-bold" style={{ minHeight: 36, ...field, color: "var(--accent)" }}>تصدير Excel</button>}
          </>
        )}
      </Card>
      {r?.rows.map((x) => (
        <Card key={x.id} style={{ padding: 10, marginBottom: 6 }} data-wastage-row={x.ref}>
          <div className="flex items-center justify-between gap-2">
            <span style={{ color: "var(--text)" }} className="text-[12px] font-bold">{x.ref} · {x.workshop} · ع{x.karat}</span>
            <span style={{ color: x.over > 0.0005 ? "var(--bad)" : "var(--good)" }} className="text-[12px] font-bold">{Number(x.lossPct).toFixed(2)}٪</span>
          </div>
          <p style={{ color: "var(--text2)", margin: "2px 0 0" }} className="text-[11px]">
            المصروف {fmtW(x.issued)} · المشغول {fmtW(x.out)} · المردود {fmtW(x.returned)} · الهدر {fmtW(x.loss)} جم · المسموح {Number(x.allowPct).toFixed(2)}٪ ({fmtW(x.allowed)})
            {x.over > 0.0005 ? ` · الزائد ${fmtW(x.over)} جم / ${fmtMoney(x.overValue)} ${currency} ${x.fate === "writeoff" ? "← شُطب" : "← على الورشة"}` : ""}
          </p>
          <p style={{ color: x.manual ? "var(--accentText)" : "var(--good)", margin: 0 }} className="text-[11px]">{x.manual ? `⚠ فيه وزنٌ مكتوب (${x.manual})` : x.weighed ? "✓ كل الأوزان من الميزان" : ""}</p>
        </Card>
      ))}
      {/* المستلَم جزئيًا ليس هدرًا بعد، فلا نسبة له ويبقى خارج المجاميع */}
      {r?.receiving.length > 0 && (
        <Card style={{ padding: 10, marginBottom: 6 }} data-wastage-receiving>
          <p style={{ color: "var(--text)", margin: 0 }} className="text-[12px] font-bold">قيد الاستلام — لم يُقفل بعد</p>
          {r.receiving.map((x) => (
            <p key={x.id} style={{ color: "var(--text2)", margin: "2px 0 0" }} className="text-[11px]">
              {x.ref} · {x.workshop}: صُرف {fmtW(x.issued)} صافٍ · استُلم حتى الآن {fmtW(x.received)} · الباقي لدى الورشة {fmtW(x.left)}{x.manual ? ` · ⚠ وزنٌ مكتوب (${x.manual})` : ""}
            </p>
          ))}
        </Card>
      )}
      {r?.claims.rows.length > 0 && (
        <Card style={{ padding: 10, marginBottom: 6, border: `1px solid ${r.claims.overdue ? "var(--badLine)" : "var(--line)"}` }} data-wastage-claims>
          <p style={{ color: "var(--text)", margin: 0 }} className="text-[12px] font-bold">مطالبات على الورش — {fmtW(r.claims.fine)} جم24 ({fmtMoney(r.claims.value)} {currency}) في «لدى الورش»</p>
          {r.claims.rows.map((c) => (
            <p key={c.id} style={{ color: c.overdue ? "var(--bad)" : "var(--text2)", margin: "2px 0 0" }} className="text-[11px]">
              {c.ref} · {c.workshop} · {fmtW(c.grams)} جم · منذ {c.age} يومًا{c.overdue ? " — تجاوزت المهلة" : ""}
            </p>
          ))}
        </Card>
      )}
      {r?.byWorkshop.length > 1 && (
        <Card style={{ padding: 10, marginBottom: 6 }}>
          <p style={{ color: "var(--text)", margin: 0 }} className="text-[12px] font-bold">لكل ورشة</p>
          {r.byWorkshop.map((g) => <p key={g.key} style={{ color: "var(--text2)", margin: "2px 0 0" }} className="text-[11px]">{g.label}: {Number(g.lossPct).toFixed(2)}٪ · {g.jobs} أمر · الزائد {fmtW(g.over)} جم</p>)}
        </Card>
      )}
      {r?.byKarat.length > 1 && (
        <Card style={{ padding: 10, marginBottom: 6 }}>
          <p style={{ color: "var(--text)", margin: 0 }} className="text-[12px] font-bold">لكل عيار</p>
          {r.byKarat.map((g) => <p key={g.key} style={{ color: "var(--text2)", margin: "2px 0 0" }} className="text-[11px]">{g.label}: {Number(g.lossPct).toFixed(2)}٪ · الهدر {fmtW(g.loss)} جم</p>)}
        </Card>
      )}
    </div>
  );
}

export { WastageReportView };
