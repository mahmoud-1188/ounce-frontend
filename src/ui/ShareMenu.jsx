import React, { useState } from "react";
import { rfidSessionCsv, rfidSessionJson, rfidSessionText, shareOrDownload } from "../domain/helpers.js";

/// زرّ المشاركة الموحّد لجلسة RFID — JSON · CSV · ملخّص نصّي.
///
/// ⚠ `getSession()` تُستدعى عند الضغط لا عند الرسم — الجلسة تكبر مع كل رقاقةٍ تُقرأ.
function ShareMenu({ getSession, csvSep = ",", compact = false }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const say = (t) => { setMsg(t); setTimeout(() => setMsg(""), 2200); };
  const run = async (what) => {
    setOpen(false);
    const sess = getSession(); if (!sess) { say("لا جلسةَ بعد — امسح شيئًا أوّلًا"); return; }
    try {
      if (what === "json") { const r = await shareOrDownload({ blob: new Blob([rfidSessionJson(sess)], { type: "application/json" }), filename: `${sess.session_id}.json`, title: sess.session_id }); say(r === "shared" ? "شُورك JSON" : "نُزّل JSON"); }
      else if (what === "csv") { const r = await shareOrDownload({ blob: new Blob([rfidSessionCsv(sess, csvSep)], { type: "text/csv;charset=utf-8" }), filename: `${sess.session_id}.csv`, title: sess.session_id }); say(r === "shared" ? "شُورك CSV" : "نُزّل CSV"); }
      else if (what === "text") { const t = rfidSessionText(sess);
        if (navigator.share) { try { await navigator.share({ text: t, title: sess.session_id }); say("شُورك الملخّص"); return; } catch (e) { if (e?.name === "AbortError") return; } }
        await navigator.clipboard?.writeText(t); say("نُسخ الملخّص — الصقه في واتساب"); }
    } catch (e) { say(`تعذّر: ${String(e?.message || e).slice(0, 60)}`); }
  };
  const items = [["json", "تصدير JSON", "للربط البرمجيّ وقواعد البيانات"], ["csv", "تصدير CSV", "يفتح في Excel بالعربية"],
    ["text", "نسخ كملخّص نصّيّ", "واتساب والبريد — بلا مرفق"]];
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen((v) => !v)} aria-label="مشاركة" aria-expanded={open}
        className={compact ? "px-3 py-1.5 rounded-lg text-[11px] font-bold" : "px-3 py-2 rounded-xl text-[11px] font-bold"}
        style={{ background: open ? "var(--accentBg)" : "var(--field)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
        ⤴ مشاركة
      </button>
      {open && (
        <>
          <button onClick={() => setOpen(false)} aria-label="إغلاق" style={{ position: "fixed", inset: 0, background: "transparent", zIndex: 40 }} />
          <div style={{ position: "absolute", insetInlineEnd: 0, top: "calc(100% + 6px)", zIndex: 41, minWidth: 250, background: "var(--panel)",
            border: "1px solid var(--accentLine)", borderRadius: 12, boxShadow: "0 12px 30px rgba(0,0,0,.45)", overflow: "hidden" }}>
            {items.map(([id, label, hint]) => (
              <button key={id} onClick={() => run(id)} className="w-full text-right px-3 py-2.5"
                style={{ borderBottom: "1px solid var(--line)", background: "transparent" }}>
                <p style={{ color: "var(--text)", margin: 0 }} className="text-[12px] font-bold">{label}</p>
                <p style={{ color: "var(--text3)", margin: "1px 0 0" }} className="text-[10px]">{hint}</p>
              </button>
            ))}
          </div>
        </>
      )}
      {msg && <span style={{ position: "absolute", insetInlineEnd: 0, top: "calc(100% + 6px)", zIndex: 42, background: "var(--panel)", color: "var(--text2)",
        border: "1px solid var(--line)", borderRadius: 8, padding: "4px 8px", fontSize: 10, whiteSpace: "nowrap" }}>{msg}</span>}
    </div>
  );
}

export { ShareMenu };
