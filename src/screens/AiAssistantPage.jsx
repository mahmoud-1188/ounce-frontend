import React, { useState } from "react";
import { Check, FileSpreadsheet, FileText, Loader2, Sparkles } from "lucide-react";
import * as XLSX from "xlsx";
import { fetchAiAuditNarrative, fetchAiReportSpec, inputStyle, runAuditChecks } from "../domain/helpers.js";
import { AiChatTab } from "./AiChatTab.jsx";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function AiAssistantPage({ auditCtx, reportSnapshot, currency, onBack, onOpenScreen, voiceFirst = false, onVoiceConsumed }) {
  const [tab, setTab] = useState("chat"); // 'chat' | 'audit' | 'report'

  // ---- Smart audit state ----
  const [findings, setFindings] = useState(null);
  const [narrative, setNarrative] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");

  const handleRunAudit = async () => {
    setAuditLoading(true);
    setAuditError("");
    setNarrative("");
    const results = runAuditChecks(auditCtx);
    setFindings(results);
    if (results.length === 0) {
      setAuditLoading(false);
      return;
    }
    const summary = results.map((f, i) => `${i + 1}. [${f.severity}] ${f.title}: ${f.detail}`).join("\n");
    try {
      const text = await fetchAiAuditNarrative(summary);
      setNarrative(text);
    } catch (e) {
      console.error("audit narrative failed", e);
      setAuditError("تعذر جلب الشرح من الذكاء الاصطناعي — الملاحظات أدناه ما زالت دقيقة (مستخرجة آليًا وليس بالذكاء الاصطناعي)");
    } finally {
      setAuditLoading(false);
    }
  };

  // ---- Custom AI report state ----
  const [reportRequest, setReportRequest] = useState("");
  const [reportSpec, setReportSpec] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  const handleGenerateReport = async () => {
    if (!reportRequest.trim()) return;
    setReportLoading(true);
    setReportError("");
    setReportSpec(null);
    try {
      const spec = await fetchAiReportSpec(reportRequest, JSON.stringify(reportSnapshot));
      setReportSpec(spec);
    } catch (e) {
      console.error("report generation failed", e);
      setReportError("تعذر توليد التقرير، جرّب صياغة الطلب بشكل مختلف");
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportReportExcel = () => {
    if (!reportSpec) return;
    const wb = XLSX.utils.book_new();
    const rows = [reportSpec.columns, ...reportSpec.rows];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), (reportSpec.title || "تقرير").slice(0, 30));
    XLSX.writeFile(wb, `${(reportSpec.title || "تقرير").replace(/\s+/g, "_")}.xlsx`);
  };
  const handlePrintReportPdf = () => window.print();

  const severityColor = { error: "var(--bad)", warning: "var(--accent)", info: "var(--text2)" };
  const severityLabel = { error: "خطأ", warning: "تنبيه", info: "معلومة" };

  return (
    <div>
      <SubPageHeader title="أوقية — المساعد الذكي" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            onClick={() => setTab("chat")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: tab === "chat" ? "var(--accentBg)" : "var(--panel)", color: tab === "chat" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            محادثة
          </button>
          <button
            onClick={() => setTab("audit")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: tab === "audit" ? "var(--accentBg)" : "var(--panel)", color: tab === "audit" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            تدقيق ذكي
          </button>
          <button
            onClick={() => setTab("report")}
            className="py-2 rounded-xl text-xs font-bold"
            style={{ background: tab === "report" ? "var(--accentBg)" : "var(--panel)", color: tab === "report" ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
          >
            تقرير مخصص
          </button>
        </div>

        {tab === "chat" && (
          <AiChatTab
            ctx={auditCtx}
            currency={currency}
            onOpenScreen={onOpenScreen}
            voiceFirst={voiceFirst}
            onVoiceConsumed={onVoiceConsumed}
          />
        )}

        {tab === "audit" && (
          <>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-4">
              يفحص البيانات فعليًا (أرصدة سالبة، دفعات موزَّعة أكثر من وزنها، أرقام قطع مكررة، أخطاء بحساب الضريبة...) ثم يشرح الذكاء الاصطناعي النتائج بلغة مبسّطة — الفحص نفسه رياضي دقيق، والذكاء الاصطناعي يُستخدم فقط للشرح والترتيب.
            </p>
            <button
              onClick={handleRunAudit}
              disabled={auditLoading}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-4"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
            >
              {auditLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {auditLoading ? "جاري الفحص..." : "افحص الحسابات الآن"}
            </button>

            {findings && findings.length === 0 && !auditLoading && (
              <Card style={{ padding: 14, border: "1px solid var(--goodLine)" }}>
                <p style={{ color: "var(--good)" }} className="text-sm font-bold flex items-center gap-2">
                  <Check size={16} /> لا توجد ملاحظات — الحسابات متسقة
                </p>
              </Card>
            )}

            {narrative && (
              <Card style={{ padding: 14, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
                <p style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} /> ملخص الذكاء الاصطناعي
                </p>
                <p style={{ color: "var(--text)" }} className="text-xs leading-relaxed">
                  {narrative}
                </p>
              </Card>
            )}
            {auditError && (
              <p style={{ color: "var(--bad)" }} className="text-xs mb-3">
                {auditError}
              </p>
            )}

            {findings && findings.length > 0 && (
              <>
                <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
                  الملاحظات الخام ({findings.length})
                </p>
                <div className="flex flex-col gap-2">
                  {findings.map((f, idx) => (
                    <Card key={idx} style={{ padding: 12 }}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: "var(--text)" }} className="text-sm font-bold">
                          {f.title}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--panel)", color: severityColor[f.severity] }}>
                          {severityLabel[f.severity]}
                        </span>
                      </div>
                      <p style={{ color: "var(--text2)" }} className="text-xs">
                        {f.detail}
                      </p>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "report" && (
          <>
            <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
              اكتب وصفًا لأي تقرير تحتاجه (مثال: "مبيعات كل بائع هذا الشهر" أو "مقارنة المصروفات الثابتة والمتغيرة") وسيبنيه الذكاء الاصطناعي من بياناتك الفعلية — بدون اختراع أرقام.
            </p>
            <Field label="وصف التقرير المطلوب">
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                value={reportRequest}
                onChange={(e) => setReportRequest(e.target.value)}
                placeholder="مثال: تقرير يومي بإجمالي المبيعات والمصروفات لآخر ٣٠ يوم"
              />
            </Field>
            <button
              onClick={handleGenerateReport}
              disabled={reportLoading || !reportRequest.trim()}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-4"
              style={{ background: reportRequest.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: reportRequest.trim() ? "var(--panel)" : "var(--text3)" }}
            >
              {reportLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {reportLoading ? "جاري إعداد التقرير..." : "أنشئ التقرير"}
            </button>
            {reportError && (
              <p style={{ color: "var(--bad)" }} className="text-xs mb-3">
                {reportError}
              </p>
            )}

            {reportSpec && (
              <>
                <p style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold mb-2">
                  {reportSpec.title}
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    onClick={handleExportReportExcel}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}
                  >
                    <FileSpreadsheet size={16} /> تصدير Excel
                  </button>
                  <button
                    onClick={handlePrintReportPdf}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
                  >
                    <FileText size={16} /> طباعة PDF
                  </button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {reportSpec.columns.map((c, i) => (
                          <th key={i} style={{ border: "1px solid var(--line)", padding: "6px", color: "var(--accent)", textAlign: "right", whiteSpace: "nowrap" }}>
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportSpec.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{ border: "1px solid var(--line)", padding: "6px", color: "var(--text)", whiteSpace: "nowrap" }}>
                              {String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Printable version of this custom report */}
                <div className="print-area" style={{ display: "none" }}>
                  <div style={{ fontFamily: "sans-serif", color: "#000", padding: "10mm", direction: "rtl" }}>
                    <h1 style={{ fontSize: "16px", marginBottom: "5mm" }}>{reportSpec.title}</h1>
                    <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {reportSpec.columns.map((c, i) => (
                            <th key={i} style={{ border: "1px solid #999", padding: "1.5mm", textAlign: "right" }}>
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportSpec.rows.map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td key={ci} style={{ border: "1px solid #999", padding: "1.5mm" }}>
                                {String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { AiAssistantPage };
