import React, { useEffect, useState } from "react";
import { ENROLL_TTL_MIN } from "../core/constants.js";
import { openWhatsApp } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { QrCode } from "../ui/QrCode.jsx";

/// ربط جهاز الموظّف — المدير يعرض رمزًا يمسحه الموظّف على جهازه.
///
/// ⚠ الرمز من الخادم (POST /users/:id/enroll-invite): قصيرٌ يسعه QR، صالحٌ
///   ثلاثين دقيقة ولمرّةٍ واحدة، ويُخزَّن هناك مُجزَّأً فقط. ولا يحمل رقمًا
///   سريًّا — الموظّف يضع رقمه على جهازه ولا يعرفه المدير.
function EnrollQrSheet({ user, onIssue, onClose }) {
  const [state, setState] = useState({ loading: true });
  const [left, setLeft] = useState(ENROLL_TTL_MIN * 60);
  const issue = async () => {
    setState({ loading: true });
    const r = await onIssue(user);
    if (r?.code) {
      setState({ code: r.code, expiresAt: r.expiresAt });
      setLeft(Math.max(0, Math.round((new Date(r.expiresAt).getTime() - Date.now()) / 1000)) || ENROLL_TTL_MIN * 60);
    } else setState({ error: r?.error || "تعذّر إصدار رمز الربط" });
  };
  useEffect(() => { issue(); }, [user?.id]);
  useEffect(() => {
    if (!state.code) return undefined;
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [state.code]);
  const code = state.code || "";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,.72)" }}>
      <div style={{ background: "var(--panel)", borderRadius: "18px 18px 0 0", maxHeight: "92vh", overflow: "auto" }}
        className="px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: "var(--accent)" }} className="text-[13px] font-bold">ربط جهاز — {user.name}</span>
          <button onClick={onClose} style={{ color: "var(--text3)" }} className="text-[11px]">إغلاق</button>
        </div>

        {state.loading && <p style={{ color: "var(--text3)" }} className="text-[11px] py-6 text-center">جارٍ إصدار الرمز…</p>}
        {state.error && (
          <Card style={{ padding: 12, marginTop: 8, border: "1px solid var(--badLine)" }}>
            <p style={{ color: "var(--bad)", margin: 0 }} className="text-[11px]">⚠ {state.error}</p>
          </Card>
        )}
        {code && (
          <>
            <p style={{ color: "var(--text3)", margin: "0 0 10px" }} className="text-[11px] leading-6">
              افتح التطبيق على جهاز الموظّف (برابط دخول الفرع) واضغط «عندي رمز ربط»، ثم امسح
              هذا الرمز. يضع رقمه السري على جهازه — ولا تعرفه أنت.
            </p>
            <div className="flex justify-center py-3" style={{ background: "#fff", borderRadius: 14 }}>
              <QrCode value={code} size={220} />
            </div>
            <p style={{ color: "var(--text2)", margin: "8px 0 0", fontFamily: "monospace",
              direction: "ltr", textAlign: "center", wordBreak: "break-all", letterSpacing: 2 }} className="text-sm font-bold">
              {code}
            </p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => navigator.clipboard?.writeText(code)}
                className="flex-1 py-2 rounded-xl text-[11px]"
                style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                انسخ الرمز
              </button>
              <button onClick={() => openWhatsApp("", `رمز ربط ${user.name} — أوقية\n\n${code}`)}
                className="flex-1 py-2 rounded-xl text-[11px]"
                style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                أرسل بواتساب
              </button>
            </div>
            <p style={{ color: left > 60 ? "var(--text3)" : "var(--bad)", margin: "8px 0 0" }}
              className="text-[11px] text-center">
              {left > 0
                ? `صالح ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} · لمرّةٍ واحدة`
                : "انتهت صلاحيته — "}
              {left <= 0 && <button onClick={issue} style={{ color: "var(--accent)" }} className="font-bold">أصدر رمزًا جديدًا</button>}
            </p>
            <p style={{ color: "var(--text3)", margin: "10px 0 0" }} className="text-[11px] leading-6">
              ⚠ الرمز لا يحمل رقمًا سريًّا — من صوّر الشاشة لا يملك ما يدخل به. وإصدارُ رمزٍ جديد يُبطل السابق.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export { EnrollQrSheet };
