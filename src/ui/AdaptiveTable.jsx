import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { key } from "../domain/key.js";
import { Card } from "./Card.jsx";
import { EditableCell } from "./EditableCell.jsx";

function AdaptiveTable({
  rows = [],
  columns = [],          // [{ key, label, width, type, editable, render, align }]
  keyOf = (r) => r.id,
  onEdit,                // (row, key, value) => void
  actions = [],          // [{ id, label, icon, tone, disabled }]
  onAction,
  onSelect,              // للعرض المزدوج
  selectedId,
  empty = "لا سجلات",
  vp,
}) {
  const [openId, setOpenId] = useState(null);
  const small = !vp || vp.size === "sm";

  if (!rows.length) {
    return (
      <p style={{ color: "var(--text3)" }} className="text-[11px] text-center py-8">
        {empty}
      </p>
    );
  }

  // ── الصغيرة: بطاقات تتوسّع ──
  if (small) {
    return (
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => {
          const id = keyOf(r);
          const open = openId === id;
          const [first, ...rest] = columns;
          return (
            <Card key={id} style={{ padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => setOpenId(open ? null : id)}
                className="w-full text-right px-3 py-2.5 flex items-center gap-2"
              >
                <span className="flex-1 min-w-0">
                  <span style={{ color: "var(--text)" }} className="text-[12px] font-bold block truncate">
                    {first?.render ? first.render(r) : r[first?.key]}
                  </span>
                  {rest[0] && (
                    <span style={{ color: "var(--text3)" }} className="text-[10px]">
                      {rest[0].label}: {rest[0].render ? rest[0].render(r) : r[rest[0].key] ?? "—"}
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={14}
                  color="var(--text3)"
                  style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
                />
              </button>

              {/* ⚠ التوسّع في مكانه لا في صفحة: المستخدم يرى ما حوله
                  فيعرف أين هو، والرجوع ضغطةٌ على الرأس نفسه. */}
              {open && (
                <div className="px-3 pb-3" style={{ borderTop: "1px solid var(--line)" }}>
                  {columns.map((c) => (
                    <div key={c.key} className="flex items-baseline justify-between py-1.5"
                      style={{ borderBottom: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--text3)" }} className="text-[11px]">{c.label}</span>
                      <span style={{ flex: "0 0 55%", textAlign: "left" }}>
                        {c.render && !c.editable ? (
                          <span style={{ color: "var(--text)" }} className="text-[12px]">{c.render(r)}</span>
                        ) : (
                          <EditableCell
                            value={r[c.key]}
                            type={c.type}
                            editable={!!c.editable && !!onEdit}
                            align="left"
                            onCommit={(v) => onEdit?.(r, c.key, v)}
                          />
                        )}
                      </span>
                    </div>
                  ))}
                  {actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {actions.map((a) => (
                        <button
                          key={a.id}
                          disabled={typeof a.disabled === "function" ? a.disabled(r) : a.disabled}
                          onClick={() => onAction?.(a.id, r)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                          style={{
                            background: "var(--field)",
                            color: `var(--${a.tone || "accent"})`,
                            border: `1px solid var(--${a.tone || "accent"}Line)`,
                          }}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  // ── الكبيرة: جدول بخلايا تُعدَّل ──
  const cell = {
    border: "1px solid var(--line)", padding: "7px 10px",
    fontSize: 12, verticalAlign: "middle",
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{
                ...cell, background: "var(--field)", color: "var(--accent)",
                fontWeight: 700, textAlign: "right", width: c.width,
                position: "sticky", top: 0, zIndex: 1,
              }}>
                {c.label}
              </th>
            ))}
            {actions.length > 0 && (
              <th style={{ ...cell, background: "var(--field)", width: 1 }} />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const id = keyOf(r);
            const on = selectedId === id;
            return (
              <tr
                key={id}
                onClick={() => onSelect?.(r)}
                style={{
                  background: on ? "var(--accentBg)" : "transparent",
                  cursor: onSelect ? "pointer" : "default",
                }}
              >
                {columns.map((c) => (
                  <td key={c.key} style={{ ...cell, textAlign: c.align || "right" }}>
                    {c.render && !c.editable ? c.render(r) : (
                      <EditableCell
                        value={r[c.key]}
                        type={c.type}
                        editable={!!c.editable && !!onEdit}
                        align={c.align || "right"}
                        onCommit={(v) => onEdit?.(r, c.key, v)}
                      />
                    )}
                  </td>
                ))}
                {actions.length > 0 && (
                  <td style={{ ...cell, whiteSpace: "nowrap" }}>
                    <span className="flex gap-1">
                      {actions.map((a) => (
                        <button
                          key={a.id}
                          disabled={typeof a.disabled === "function" ? a.disabled(r) : a.disabled}
                          onClick={(e) => { e.stopPropagation(); onAction?.(a.id, r); }}
                          className="px-2 py-1 rounded text-[11px] font-bold"
                          style={{
                            background: "var(--field)",
                            color: `var(--${a.tone || "accent"})`,
                            border: `1px solid var(--${a.tone || "accent"}Line)`,
                          }}
                        >
                          {a.label}
                        </button>
                      ))}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/// العرض المزدوج — قائمة وتفصيل جنبًا إلى جنب على الكبيرة.
///
/// ⚠ على الصغيرة يعرض القائمة وحدها، والتفصيل يُفتح ورقةً سفلية.
/// عمودان بعرض 195 بكسل لا يُقرأ أحدهما.

export { AdaptiveTable };
