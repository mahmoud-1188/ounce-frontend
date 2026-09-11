import React, { useEffect } from "react";
import { ChevronLeft, X } from "lucide-react";
import { NAV_REGISTRY } from "../core/navigation.js";
import { Card } from "../ui/Card.jsx";

function BundleSheet({ bundle, permitted, onSelect, onClose, single }) {
  /* ⚠ الخيار الوحيد يُفتح في أثرٍ لا في الرسم.
     تغيير الحالة أثناء الرسم يجعل الورقة تدور بين فتحٍ وإغلاق. */
  useEffect(() => {
    if (single) onSelect?.(single);
  }, [single]);
  if (!bundle) return null;
  const items = (bundle.items || [])
    .filter((id) => permitted.has(id))
    .map((id) => NAV_REGISTRY.find((n) => n.id === id))
    .filter(Boolean);

  const BIcon = bundle.icon;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "var(--veil)" }}>
      <button className="flex-1" onClick={onClose} aria-label="إغلاق" />
      {/* ⚠ الورقة تُمرَّر: مجمّع التقارير فيه عشرة خيارات لا تُرى كلها
          على شاشة جوال — بلا تمرير تبقى الأخيرة خارج المتناول.

          والرأس يبقى ثابتًا فوق القائمة، فيعرف المستخدم أين هو أثناء
          التمرير ويصل لزر الإغلاق دائمًا. */}
      <div
        style={{
          background: "var(--panel)",
          borderTop: "1px solid var(--edge)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: 8,
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div className="flex items-center justify-center py-2.5">
          <span style={{ width: 38, height: 4, borderRadius: 2, background: "var(--edge)", display: "block" }} />
        </div>

        <div className="px-4" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div
              style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: "var(--panel)", border: "1px solid var(--line)",
                display: "grid", placeItems: "center",
              }}
            >
              <BIcon size={18} color="var(--accent)" />
            </div>
            <div className="flex-1">
              <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif", margin: 0 }} className="text-sm font-bold">
                {bundle.label}
              </p>
              {bundle.hint && (
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">{bundle.hint}</p>
              )}
            </div>
            <button onClick={onClose} style={{ color: "var(--text2)" }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div
          className="px-4 pb-4"
          style={{ overflowY: "auto", overscrollBehavior: "contain", minHeight: 0, flex: 1 }}
        >
          {items.length === 0 ? (
            <p style={{ color: "var(--text3)" }} className="text-[11px] py-3 text-center">
              لا صفحات متاحة بصلاحيتك
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      onSelect(n.id);
                      onClose();
                    }}
                    className="w-full text-right"
                  >
                    <Card style={{ padding: 13 }}>
                      <div className="flex items-center gap-3">
                        <div
                          style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: "var(--panel)", border: "1px solid var(--line)",
                            display: "grid", placeItems: "center",
                          }}
                        >
                          <Icon size={17} color="var(--accentText)" />
                        </div>
                        <span
                          style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }}
                          className="text-sm font-bold flex-1"
                        >
                          {n.label}
                        </span>
                        <ChevronLeft size={15} color="var(--text3)" style={{ transform: "rotate(180deg)" }} />
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ورقة المساعد — الزر العائم
//
// الضغط يفتح إجراءات جاهزة لا حقل كتابة فارغ. الحقل الفارغ يطلب من
// البائع أن يعرف ماذا يسأل، وأكثر الأسئلة تتكرر: كم بعت اليوم؟ من أين
// جاء النقص؟ ما حالة المخزون؟
// ============================================================

export { BundleSheet };
