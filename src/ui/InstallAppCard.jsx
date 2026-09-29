import React, { useEffect, useState } from "react";
import { Card } from "./Card.jsx";

// حدث التثبيت يصل مرّة عند تحميل الصفحة — يُلتقط هنا قبل أن تُفتح الإعدادات
let deferredPrompt = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; });
}

const standalone = () => {
  try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch { return false; }
};

/// تثبيت التطبيق على الجهاز (المرجع 5.2.0: InstallAppCard) — أيقونةٌ تفتحه كتطبيق بلا شريط متصفّح.
/// آيفون وآيباد من زرّ المشاركة، وكروم وإيدج وسامسونج بزرّ، وما لا يدعم التثبيت لا يُعرض له شيء.
function InstallAppCard() {
  const [avail, setAvail] = useState(() => !!deferredPrompt);
  const [done, setDone] = useState(standalone);
  useEffect(() => {
    const on = (e) => { e.preventDefault(); deferredPrompt = e; setAvail(true); };
    const installed = () => setDone(true);
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", installed);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", installed); };
  }, []);
  if (done) return null;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  if (!avail && !ios) return null;
  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const r = await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    setAvail(false);
    if (r?.outcome === "accepted") setDone(true);
  };
  return (
    <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
      <p style={{ color: "var(--text)", margin: 0 }} className="text-xs font-bold">ثبّت التطبيق على هذا الجهاز</p>
      <p style={{ color: "var(--text2)", margin: "4px 0 8px" }} className="text-[11px] leading-5">
        أيقونةٌ على الشاشة تفتحه كتطبيق على فرعك مباشرةً. الفواتير والحركات تُحفظ على الخادم، فيلزمه اتصالٌ بالإنترنت.
      </p>
      {ios ? (
        <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">
          على {/iPad|Macintosh/.test(ua) ? "آيباد" : "آيفون"}: زرّ المشاركة ← «إضافة إلى الشاشة الرئيسية». ثم ادخل من الأيقونة برقمك السري مرّةً أولى.
        </p>
      ) : (
        <button onClick={install} className="w-full py-2 rounded-xl text-[11px] font-bold"
          style={{ background: "linear-gradient(135deg, var(--gradFrom), var(--gradTo))", color: "var(--bg)" }}>تثبيت التطبيق</button>
      )}
    </Card>
  );
}

export { InstallAppCard };
