import React, { useState } from "react";
import { ChevronLeft, Folder, LogOut } from "lucide-react";
import { MENU_GROUPS, NAV_REGISTRY } from "../core/navigation.js";
import { bundleById, isBundle } from "../domain/helpers.js";
import { AiLogoBadge } from "./AiLogoBadge.jsx";
import { Card } from "./Card.jsx";

function MoreMenu({ onSelect, permitted, mainIds, onLogout, userName, roleLabel, order, custom = [], disabled = [] }) {
  const [group, setGroup] = useState(null);

  // ترتيب المستخدم يسبق الافتراضي. مجموعة أو عنصر أُضيف بعد حفظ ترتيبه
  // يُلحق بالآخر بدل أن يختفي.
  const applyOrder = (list, savedIds, keyOf) => {
    if (!Array.isArray(savedIds) || !savedIds.length) return list;
    const rank = new Map(savedIds.map((id, i) => [id, i]));
    return [...list].sort((a, b) => {
      const ra = rank.has(keyOf(a)) ? rank.get(keyOf(a)) : 9999;
      const rb = rank.has(keyOf(b)) ? rank.get(keyOf(b)) : 9999;
      return ra - rb;
    });
  };

  // المتاح: ما تسمح به الصلاحية ولم يُثبَّت في الشريط السفلي
  // ⚠ الصفحة داخل زر مجمّع مثبَّت لا تظهر في القائمة أيضًا — ظهورها
  // مرتين يجعل المستخدم يشك أيهما الصحيح.
  const pinnedBundles = mainIds.filter(isBundle);
  const viaBundle = new Set(pinnedBundles.flatMap((b) => bundleById(b)?.items || []));
  const isVisible = (id) =>
    permitted.has(id) && !mainIds.includes(id) && !viaBundle.has(id) &&
    !(disabled || []).includes(id);
  const itemById = (id) => NAV_REGISTRY.find((o) => o.id === id);

  // مجموعة بلا عناصر متاحة لا تُعرض — زر يفتح على فراغ يربك
  // مجموعات المستخدم تُدمج مع الافتراضية. العنصر الذي نُقل لمجموعة
  // مخصصة يُزال من الافتراضية فلا يظهر مرتين.
  const claimed = new Set(custom.flatMap((g) => g.items || []));
  const allGroups = [
    ...MENU_GROUPS.map((g) => ({ ...g, items: g.items.filter((id) => !claimed.has(id)) })),
    ...custom.map((g) => ({ ...g, icon: g.icon || Folder, custom: true })),
  ];

  const groups = applyOrder(
    allGroups.map((g) => ({
      ...g,
      available: applyOrder(g.items.filter(isVisible), order?.items?.[g.id], (x) => x),
    })).filter((g) => g.available.length > 0),
    order?.groups,
    (g) => g.id
  );

  // ما لم يُصنَّف يظهر مستقلًا — إضافة صفحة جديدة لا تُخفيها
  const grouped = new Set(MENU_GROUPS.flatMap((g) => g.items));
  const ungrouped = NAV_REGISTRY.filter((o) => isVisible(o.id) && !grouped.has(o.id) && o.id !== "aiAssistant");
  const ai = isVisible("aiAssistant") ? itemById("aiAssistant") : null;

  const active = group ? groups.find((g) => g.id === group) : null;

  // ── داخل مجموعة ──
  if (active) {
    const GIcon = active.icon;
    return (
      <div className="px-4 pt-4">
        <button
          onClick={() => setGroup(null)}
          className="flex items-center gap-2 mb-4"
          style={{ color: "var(--accentText)" }}
        >
          <div
            style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "var(--panel)", border: "1px solid var(--line)",
              display: "grid", placeItems: "center", flexShrink: 0,
            }}
          >
            <ChevronLeft size={17} />
          </div>
          <span className="text-sm font-bold" style={{ fontFamily: "'Cairo', sans-serif" }}>
            {active.label}
          </span>
        </button>

        <div className="flex flex-col gap-2">
          {active.available.map((id) => {
            const o = itemById(id);
            if (!o) return null;
            const Icon = o.icon;
            return (
              <button key={id} onClick={() => onSelect(id)} className="w-full text-right">
                <Card style={{ padding: 14 }}>
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                        background: "var(--panel)", border: "1px solid var(--line)",
                        display: "grid", placeItems: "center",
                      }}
                    >
                      <Icon size={18} color="var(--accentText)" />
                    </div>
                    <span
                      style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }}
                      className="text-sm font-bold flex-1"
                    >
                      {o.label}
                    </span>
                    <ChevronLeft size={15} color="var(--text3)" style={{ transform: "rotate(180deg)" }} />
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
        <div style={{ height: 24 }} />
      </div>
    );
  }

  // ── المجموعات ──
  return (
    <div className="px-4 pt-4">
      {/* المستخدم */}
      <div className="flex items-center gap-3 mb-4">
        <div
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))",
            display: "grid", placeItems: "center", flexShrink: 0,
          }}
        >
          <span style={{ color: "var(--panel)", fontWeight: 800, fontSize: 17 }}>
            {(userName || "؟").charAt(0)}
          </span>
        </div>
        <div>
          <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif", margin: 0 }} className="text-base font-extrabold">
            {userName || "—"}
          </p>
          <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px]">
            {roleLabel || ""}
          </p>
        </div>
      </div>

      {/* المساعد الذكي — مميّز */}
      {ai && (
        <button onClick={() => onSelect("aiAssistant")} className="w-full text-right mb-3">
          <Card style={{ padding: 14, border: "1px solid var(--accentLine)" }}>
            <div className="flex items-center gap-3">
              <AiLogoBadge width={30} />
              <div className="flex-1">
                <p style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif", margin: 0 }} className="text-sm font-bold">
                  {ai.label}
                </p>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">
                  اسأل عن حساباتك بالعربية
                </p>
              </div>
              <ChevronLeft size={15} color="var(--text3)" style={{ transform: "rotate(180deg)" }} />
            </div>
          </Card>
        </button>
      )}

      {/* ⚠ قائمة فارغة تمامًا تعني شاشة بلا معنى: بطاقة المستخدم وزر
          الخروج فقط. تحدث حين تكون كل صفحات المستخدم مثبَّتة في الشريط
          أو داخل مجمّعاته. نوضّح السبب بدل تركه فراغًا. */}
      {groups.length === 0 && ungrouped.length === 0 && !ai && (
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <p style={{ color: "var(--text)" }} className="text-xs font-bold mb-1">
            كل صفحاتك في الشريط السفلي
          </p>
          <p style={{ color: "var(--text2)" }} className="text-[11px]">
            لا شيء إضافي هنا — ما تملك صلاحيته مثبَّت أسفل الشاشة.
            {permitted.has("navCustomize") ? " غيّر ذلك من تخصيص القائمة." : ""}
          </p>
          {permitted.has("navCustomize") && (
            <button
              onClick={() => onSelect("navCustomize")}
              className="w-full py-2.5 rounded-xl text-xs font-bold mt-3"
              style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
            >
              تخصيص القائمة
            </button>
          )}
        </Card>
      )}

      {/* المجموعات */}
      <div className="flex flex-col gap-2">
        {groups.map((g) => {
          const GIcon = g.icon;
          return (
            <button key={g.id} onClick={() => setGroup(g.id)} className="w-full text-right">
              <Card style={{ padding: 14 }}>
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: "var(--panel)", border: "1px solid var(--line)",
                      display: "grid", placeItems: "center",
                    }}
                  >
                    <GIcon size={19} color="var(--accentText)" />
                  </div>
                  <div className="flex-1">
                    <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif", margin: 0 }} className="text-sm font-bold">
                      {g.label}
                    </p>
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">
                      {g.hint}
                    </p>
                  </div>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
                  >
                    {g.available.length}
                  </span>
                  <ChevronLeft size={15} color="var(--text3)" style={{ transform: "rotate(180deg)" }} />
                </div>
              </Card>
            </button>
          );
        })}

        {/* صفحات بلا مجموعة */}
        {ungrouped.map((o) => {
          const Icon = o.icon;
          return (
            <button key={o.id} onClick={() => onSelect(o.id)} className="w-full text-right">
              <Card style={{ padding: 14 }}>
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: "var(--panel)", border: "1px solid var(--line)",
                      display: "grid", placeItems: "center",
                    }}
                  >
                    <Icon size={19} color="var(--accentText)" />
                  </div>
                  <span
                    style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }}
                    className="text-sm font-bold flex-1"
                  >
                    {o.label}
                  </span>
                  <ChevronLeft size={15} color="var(--text3)" style={{ transform: "rotate(180deg)" }} />
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      {/* الخروج — في المنتصف */}
      {onLogout && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 22, marginBottom: 10 }}>
          <button
            onClick={onLogout}
            className="flex items-center justify-center gap-2 px-8 py-3 rounded-2xl"
            style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)", minWidth: 180 }}
          >
            <LogOut size={16} />
            <span className="text-sm font-bold" style={{ fontFamily: "'Cairo', sans-serif" }}>
              تسجيل الخروج
            </span>
          </button>
        </div>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}

// ============================================================
// Stocktake (الجرد)
// ============================================================

export { MoreMenu };
