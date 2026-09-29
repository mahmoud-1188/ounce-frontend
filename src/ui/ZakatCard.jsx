import React from "react";
import { fmtMoney } from "../core/money.js";
import { useZakat, zakatRows } from "../domain/zakat.js";
import { Card } from "./Card.jsx";

/// بطاقة الزكاة — بالدالّة الواحدة على الخادم (الذهب بوزنه × سعر اليوم، والمصنعيّة داخلة). مطفأةً لا تظهر.
function ZakatCard({ price24 = 0, currency = "ر.س" }) {
  const z = useZakat(price24);
  if (z && z.on === false) return null;
  return (
    <Card style={{ padding: 16, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
      <p style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold mb-2">الزكاة</p>
      {!z ? (
        <p style={{ color: "var(--text3)" }} className="text-[11px]">يُحسب من الدفاتر…</p>
      ) : (
        <>
          {z.noPrice && (
            <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">لا سعر لليوم — الذهب بلا قيمة في الوعاء حتى يُحدَّث السعر.</p>
          )}
          {zakatRows(z, (v) => `${fmtMoney(v)} ${currency}`).map((r) => (
            <div key={r.key} className="flex items-center justify-between py-1"
              style={{ borderTop: r.key === "base" ? "1px solid var(--line)" : "none" }}>
              <span style={{ color: r.strong ? "var(--text)" : "var(--text2)" }} className={`text-[11px] ${r.strong ? "font-bold" : ""}`}>{r.label}</span>
              <span style={{ color: r.key === "due" ? "var(--good)" : "var(--text)", fontFamily: "'Cairo', sans-serif" }}
                className={r.strong ? "text-sm font-extrabold" : "text-[11px]"}>{r.text}</span>
            </div>
          ))}
          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-2">
            الوعاء: النقد والذمم المرجوّة والذهب المملوك بوزنه × سعر اليوم ومصنعيّة القطع وما لنا ذهبًا عند الغير، ناقص الالتزامات المتداولة وما علينا ذهبًا.
          </p>
        </>
      )}
    </Card>
  );
}

export { ZakatCard };
