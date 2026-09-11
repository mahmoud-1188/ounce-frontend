import React, { useState } from "react";
import { MessageCircle, Package, Search, TrendingUp, Truck, UserRound, X, Zap } from "lucide-react";
import { inputStyle } from "../domain/helpers.js";
import { parseShortcutRequest } from "../domain/parseShortcutRequest.js";
import { AiLogoBadge } from "../ui/AiLogoBadge.jsx";
import { Card } from "../ui/Card.jsx";

function AiActionSheet({ onAsk, onOpenChat, onGoTo, hasDay, onClose,
  shortcuts = [], onMakeShortcut, onRemoveShortcut, scope }) {
  const [want, setWant] = useState("");
  const [editing, setEditing] = useState(false);
  // معاينة حيّة: يرى المستخدم أي صفحة سيصنعها قبل الضغط
  const preview = want.trim() ? parseShortcutRequest(want, scope) : null;
  const QUICK = [
    { q: "كم بعت اليوم وكم ربحي؟", icon: TrendingUp, label: "ملخّص اليوم" },
    { q: "ما حالة المخزون الآن؟ وأي الأصناف قاربت النفاد؟", icon: Package, label: "حالة المخزون" },
    { q: "من أين جاء النقص أو الفرق في حساباتي؟", icon: Search, label: "تتبّع فرق" },
    { q: "من أفضل بائع هذا الشهر بالربح التشغيلي؟", icon: UserRound, label: "أداء البائعين" },
    { q: "ما المستحق على الموردين وما المستحق لي على العملاء؟", icon: Truck, label: "الذمم" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "var(--veil)" }}>
      <button className="flex-1" onClick={onClose} aria-label="إغلاق" />
      <div
        style={{
          background: "var(--panel)",
          borderTop: "1px solid var(--accentLine)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-center py-2.5">
          <span style={{ width: 38, height: 4, borderRadius: 2, background: "var(--edge)", display: "block" }} />
        </div>

        <div className="px-4 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <AiLogoBadge width={38} />
            <div className="flex-1">
              <p style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif", margin: 0 }} className="text-sm font-bold">
                مساعد أونصة
              </p>
              <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">
                اسأل عن حساباتك بالعربية
              </p>
            </div>
            <button onClick={onClose} style={{ color: "var(--text2)" }}>
              <X size={18} />
            </button>
          </div>

          {!hasDay && (
            <Card style={{ padding: 10, marginBottom: 12, border: "1px solid var(--badLine)" }}>
              <p style={{ color: "var(--bad)" }} className="text-[11px]">
                لا يوجد يوم عمل مفتوح — أرقام اليوم قد تكون ناقصة.
              </p>
            </Card>
          )}

          {/* ── اختصاراتي ── */}
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: "var(--text2)" }} className="text-[11px]">
              اختصاراتي {shortcuts.length > 0 && `(${shortcuts.length})`}
            </span>
            {shortcuts.length > 0 && (
              <button onClick={() => setEditing((v) => !v)}
                className="text-[10px] px-2 py-1 rounded-full"
                style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>
                {editing ? "تم" : "تعديل"}
              </button>
            )}
          </div>

          {shortcuts.length === 0 ? (
            <p style={{ color: "var(--text3)" }} className="text-[10px] mb-2">
              اطلب زرًا لأي صفحة فأجهّزه لك هنا.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {shortcuts.map((sc) => (
                <div key={sc.id} className="flex items-center">
                  <button
                    onClick={() => { onGoTo(sc.pageId); onClose(); }}
                    className="flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-full"
                    style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
                  >
                    <Zap size={12} />
                    {sc.label}
                  </button>
                  {editing && (
                    <button onClick={() => onRemoveShortcut(sc.id)}
                      className="mr-1 text-[10px] px-1.5 py-1 rounded-full"
                      style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}>
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* طلب زر جديد */}
          <Card style={{ padding: 11, marginBottom: 14 }}>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
              اطلب زرًا: «أبغى زر لعهدة الكسر»
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <input style={inputStyle} value={want} onChange={(e) => setWant(e.target.value)}
                  placeholder="أي صفحة تريد الوصول لها بسرعة؟" />
              </div>
              <button
                disabled={!preview}
                onClick={() => { onMakeShortcut(want); setWant(""); }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap"
                style={{
                  background: preview ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                  color: preview ? "var(--panel)" : "var(--text3)",
                  marginBottom: 14,
                }}
              >
                جهّز
              </button>
            </div>
            {want.trim() && (
              <p className="text-[10px]" style={{ color: preview ? "var(--goodSolid)" : "var(--bad)" }}>
                {preview
                  ? `سأجهّز زر «${preview.label}»`
                  : "لم أجد صفحة بهذا الاسم ضمن صلاحيتك"}
              </p>
            )}
          </Card>

          <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">أسئلة سريعة</p>
          <div className="flex flex-col gap-2 mb-4">
            {QUICK.map((q, i) => {
              const Icon = q.icon;
              return (
                <button
                  key={i}
                  onClick={() => {
                    onAsk(q.q);
                    onClose();
                  }}
                  className="w-full text-right"
                >
                  <Card style={{ padding: 12 }}>
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                          background: "var(--panel)", border: "1px solid var(--line)",
                          display: "grid", placeItems: "center",
                        }}
                      >
                        <Icon size={16} color="var(--accentText)" />
                      </div>
                      <div className="flex-1">
                        <p style={{ color: "var(--text)", margin: 0 }} className="text-xs font-bold">{q.label}</p>
                        <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{q.q}</p>
                      </div>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onOpenChat();
                onClose();
              }}
              className="py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
            >
              <MessageCircle size={15} /> محادثة
            </button>
            <button
              onClick={() => {
                onGoTo("aiAssistant");
                onClose();
              }}
              className="py-3 rounded-xl text-xs font-bold"
              style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
            >
              التحليل الكامل
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// عهدة الكسر — الإرسال والفحص والاعتماد والاستلام
// ============================================================

export { AiActionSheet };
