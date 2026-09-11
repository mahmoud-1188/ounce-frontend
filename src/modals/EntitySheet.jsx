import React, { useState } from "react";
import { ENTITY_KINDS, TAB_LABELS } from "../domain/entities.js";
import { ActionButton } from "../ui/ActionButton.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";
import { SheetRow } from "../ui/SheetRow.jsx";

function EntitySheet({ kind, record, ctx = {}, onClose, onAction }) {
  const def = ENTITY_KINDS[kind];
  const [tab, setTab] = useState(def?.tabs?.[0] || "info");
  if (!def || !record) return null;

  const Icon = def.icon;
  const acts = (ctx.actionsFor ? ctx.actionsFor(kind, record) : []) || [];
  const rows = (ctx.rowsFor ? ctx.rowsFor(kind, record, tab) : []) || [];

  return (
    <ModalShell title={null} onClose={onClose}>
      {/* ── الترويسة ── */}
      <div className="flex items-center gap-2.5 mb-3">
        <span style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: "var(--accentBg)", border: "1px solid var(--accentLine)",
          display: "grid", placeItems: "center",
        }}>
          <Icon size={19} color="var(--accent)" />
        </span>
        <div className="flex-1 min-w-0">
          <p style={{ color: "var(--text)", margin: 0 }} className="text-sm font-bold truncate">
            {def.title(record)}
          </p>
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px] truncate">
            {def.label} · {def.subtitle ? def.subtitle(record, ctx) : ""}
          </p>
        </div>
      </div>

      {/* ── التبويبات ── */}
      {def.tabs.length > 1 && (
        <div className="flex gap-1.5 mb-3" style={{ overflowX: "auto" }}>
          {def.tabs.map((t) => {
            const on = t === tab;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold"
                style={{
                  flexShrink: 0,
                  background: on ? "var(--accentBg)" : "var(--field)",
                  color: on ? "var(--accent)" : "var(--text2)",
                  border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`,
                }}
              >
                {TAB_LABELS[t] || t}
              </button>
            );
          })}
        </div>
      )}

      {/* ── المحتوى ── */}
      <div style={{ minHeight: 90, maxHeight: "44vh", overflowY: "auto" }}>
        {tab === "actions" ? (
          acts.length ? (
            <div className="flex flex-col gap-2">
              {acts.map((a) => (
                <ActionButton
                  key={a.id}
                  icon={a.icon}
                  label={a.label}
                  hint={a.hint}
                  tone={a.tone}
                  disabled={a.disabled}
                  onClick={() => { onAction?.(a.id, record, kind); if (a.closes !== false) onClose(); }}
                />
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text3)" }} className="text-[11px] text-center py-6">
              لا إجراءات متاحة بصلاحيتك
            </p>
          )
        ) : rows.length ? (
          <div>
            {rows.map((r, i) => (
              <SheetRow key={i} label={r.label} value={r.value} tone={r.tone} />
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--text3)" }} className="text-[11px] text-center py-6">
            لا بيانات في هذا التبويب
          </p>
        )}
      </div>
    </ModalShell>
  );
}

// ============================================================
// مقارنة الرصيد الافتتاحي بتاريخٍ محدَّد
//
// ⚠ السؤال الذي لا يجيبه أيّ تقرير آخر: **ماذا صار لما بدأتُ به؟**
//
// الميزان يقول ما عندك اليوم، واليومية تقول ما جرى أمس. ولا واحد
// منهما يقول: بدأتُ بمئتَي ألفٍ وثلاثين جرامًا — أين هي الآن؟
//
// والفرق ليس ربحًا: قد يكون بيعًا لم يُحصَّل، أو ذهبًا تحوّل نقدًا،
// أو نقدًا خرج شراءً. فنعرضه بُعدين لا رقمًا واحدًا.
// ============================================================

export { EntitySheet };
