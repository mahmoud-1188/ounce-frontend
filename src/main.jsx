import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import GoldInventoryApp from "./index.js";
import { applyUiLang, readUiLang } from "./domain/i18n.js";
import { installErrorReporting, reportError } from "./domain/errorReport.js";

// لغة الواجهة المحفوظة على هذا الجهاز
applyUiLang(readUiLang());
// الأعطال تصل الإدارة تلقائيًّا
installErrorReporting();

// عطلٌ في الرسم: يُبلَّغ ويظهر للمستخدم زرّ إعادة التحميل بدل شاشةٍ بيضاء
class CrashGuard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err, info) { reportError(err, { stack: info?.componentStack }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#1B1A17", color: "#eee", fontFamily: "'Cairo',sans-serif", padding: 24, textAlign: "center" }}>
        <div>
          <p style={{ fontWeight: 800, fontSize: 16 }}>حدث خطأ غير متوقّع</p>
          <p style={{ fontSize: 12, opacity: 0.7, margin: "8px 0 16px" }}>أُبلغت الإدارة تلقائيًّا — بياناتك محفوظة على الخادم.</p>
          <button type="button" onClick={() => location.reload()} style={{ padding: "10px 22px", borderRadius: 12, fontWeight: 700, background: "#C9A14A", color: "#1B1A17" }}>أعد التحميل</button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CrashGuard><GoldInventoryApp /></CrashGuard>
  </React.StrictMode>
);
