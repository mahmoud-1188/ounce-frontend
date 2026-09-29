import React, { useEffect, useRef, useState } from "react";
import * as api from "../core/api.js";

/// شريط الاتصال (المرجع 5.2.0): بلا إنترنت أو خادمٍ لا يردّ — يقولها صريحةً قبل أن يفشل البيع.
/// ⚠ لا طابور هنا: كل عمليةٍ تُحفظ على الخادم لحظتها، فبلا اتصالٍ لا يُسجَّل شيء حتى يعود.
function ConnectivityBar() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const [server, setServer] = useState(true);
  const [back, setBack] = useState(false);
  const down = useRef(false);
  useEffect(() => {
    const onNet = () => setOnline(navigator.onLine !== false);
    const onServer = (e) => setServer(!!e.detail?.ok);
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    window.addEventListener("ounce:server", onServer);
    return () => {
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
      window.removeEventListener("ounce:server", onServer);
    };
  }, []);
  const ok = online && server;
  // الخادم لا يردّ: يُعاد السؤال كل 10 ثوانٍ فيختفي الشريط وحده حين يعود
  useEffect(() => {
    if (server || !online) return undefined;
    const t = setInterval(() => { api.fetchCurrentUser().catch(() => {}); }, 10000);
    return () => clearInterval(t);
  }, [server, online]);
  useEffect(() => {
    if (!ok) { down.current = true; setBack(false); return undefined; }
    if (!down.current) return undefined;
    down.current = false;
    setBack(true);
    const t = setTimeout(() => setBack(false), 4000);
    return () => clearTimeout(t);
  }, [ok]);
  if (ok && !back) return null;
  return (
    <div role="status" aria-live="polite" className="mx-4 my-2 py-2 px-3 rounded-xl text-[11px] font-bold"
      style={{ background: ok ? "var(--goodBg)" : "var(--badBg)", color: ok ? "var(--good)" : "var(--bad)", border: `1px solid ${ok ? "var(--goodLine)" : "var(--badLine)"}` }}>
      {ok ? "✓ عاد الاتصال بالخادم"
        : !online ? "بلا إنترنت — لا تُسجَّل فاتورةٌ ولا حركة حتى يعود الاتصال"
        : "الخادم لا يردّ الآن — لا تُسجَّل فاتورةٌ ولا حركة حتى يعود. أعد المحاولة بعد قليل"}
    </div>
  );
}

export { ConnectivityBar };
