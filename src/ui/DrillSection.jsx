import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "./Card.jsx";

function DrillSection({ title, count, columns, rows, currency, empty }) {
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ padding: 0, marginBottom: 8, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-right px-3 py-2.5 flex items-center gap-2"
      >
        <span style={{ color: "var(--text)" }} className="text-[12px] font-bold flex-1">
          {title}
        </span>
        <span style={{ color: "var(--accent)" }} className="text-[11px] font-bold">
          {count}
        </span>
        <ChevronDown
          size={13} color="var(--text3)"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
        />
      </button>
      {open && (
        rows.length === 0 ? (
          <p style={{ color: "var(--text3)" }} className="text-[11px] text-center py-4">
            {empty || "لا سجلات"}
          </p>
        ) : (
          <div style={{ overflowX: "auto", borderTop: "1px solid var(--line)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} style={{
                      padding: "6px 8px", fontSize: 10, whiteSpace: "nowrap",
                      color: "var(--accent)", background: "var(--field)",
                      textAlign: c.align || "right",
                      borderBottom: "1px solid var(--line)",
                    }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* ⚠ مئة صفٍّ لا كلها: ألف صفٍّ في DOM على جوالٍ متوسط
                    يجعل التمرير يتقطّع. ومن يريد الكل يُصدّر. */}
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} style={{
                        padding: "5px 8px", fontSize: 11, whiteSpace: "nowrap",
                        color: "var(--text2)", textAlign: c.align || "right",
                        borderBottom: "1px solid var(--line)",
                      }}>
                        {c.render ? c.render(r) : (r[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 100 && (
              <p style={{ color: "var(--text3)" }} className="text-[10px] text-center py-2">
                أول 100 من {rows.length} — صدّر للكل
              </p>
            )}
          </div>
        )
      )}
    </Card>
  );
}

/// الشاشة.

export { DrillSection };
