import React, { useEffect, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import * as api from "../core/api.js";
import { fmtMoney } from "../core/money.js";
import { Card } from "./Card.jsx";

/// جردٌ وصل من الإدارة (migration 061): العدّ عدّ الإدارة، والمدير يطبّقه بمعالج الجرد نفسه (العجز والزيادة بقيدهما) أو يرفضه.
function RemoteStocktakeInbox({ items = [], price24 = 0, canDecide = false, onApplied, flashToast }) {
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(null);
  const load = () => api.remoteStocktakeApi.list().then((d) => setList((d.stocktakes || []).filter((x) => x.status === "pending"))).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!list.length) return null;
  const byId = new Map(items.map((i) => [i.id, i]));
  const act = async (r, kind) => {
    setBusy(r.id);
    try {
      if (kind === "apply") {
        const out = await api.remoteStocktakeApi.apply(r.id, price24);
        flashToast?.(`طُبّق جرد الإدارة ${r.ref} — عجز ${fmtMoney(out.missingValue || 0)} · زيادة ${fmtMoney(out.surplusValue || 0)}`);
        onApplied?.();
      } else {
        await api.remoteStocktakeApi.reject(r.id, "");
        flashToast?.(`رُفض جرد الإدارة ${r.ref}`);
      }
      load();
    } catch (e) {
      const code = e?.body?.error;
      flashToast?.(code === "already_decided" || code === "not_pending" ? "قُرّر هذا الجرد من قبل" : code === "period_locked" ? "الفترة مقفلة — لا قيد جرد فيها" : code === "manager_only" ? "المدير وحده يطبّق جرد الإدارة" : "تعذّر التنفيذ");
    } finally { setBusy(null); }
  };
  return (
    <div className="px-4 pt-3">
      {list.map((r) => {
        return (
          <Card key={r.id} style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
            <div className="flex items-center gap-2">
              <ClipboardCheck size={16} color="var(--accent)" />
              <p className="text-sm font-bold flex-1" style={{ color: "var(--text)", margin: 0 }}>جردٌ من الإدارة {r.ref}</p>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text2)", margin: "4px 0 0" }}>
              عدّه {r.requestedBy} · {r.counts.length} صنف{r.note ? ` — ${r.note}` : ""}
            </p>
            <div className="mt-2 flex flex-col gap-1" style={{ maxHeight: 160, overflowY: "auto" }}>
              {r.counts.slice(0, 40).map((c) => {
                const it = byId.get(c.itemId);
                return (
                  <p key={c.itemId} className="text-[11px]" style={{ color: "var(--text3)", margin: 0 }}>
                    {it?.ref || c.itemId.slice(0, 8)} — عدّ الإدارة {c.countedQty}
                  </p>
                );
              })}
            </div>
            {canDecide ? (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button disabled={busy === r.id} onClick={() => act(r, "reject")} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>ارفض</button>
                <button disabled={busy === r.id} onClick={() => act(r, "apply")} className="py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                  style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>{busy === r.id && <Loader2 size={12} className="animate-spin" />} طبّق الجرد</button>
              </div>
            ) : <p className="text-[11px] mt-2" style={{ color: "var(--text3)" }}>ينتظر قرار المدير.</p>}
          </Card>
        );
      })}
    </div>
  );
}

export { RemoteStocktakeInbox };
