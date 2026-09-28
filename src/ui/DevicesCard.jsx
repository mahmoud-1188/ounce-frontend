import React, { useEffect, useState } from "react";
import { MonitorSmartphone, Tablet, X } from "lucide-react";
import * as api from "../core/api.js";
import { Card } from "./Card.jsx";

const POLICY = { off: "غير مفعّلة — الدخول من أي جهاز", managers: "المدير ونائبه والمحاسب من أجهزتهم المربوطة فقط", all: "كل الموظفين من أجهزة مربوطة فقط" };

/// أجهزة الدخول المربوطة (migration 062) — للمدير: من ربط أيّ جهاز، وإلغاء جهازٍ ضاع، ورمز «جهاز الفرع» المشترك.
///   السياسة نفسها تضبطها الإدارة من المركزي.
function DevicesCard({ onSharedInvite, flashToast }) {
  const [data, setData] = useState(null);
  const load = () => api.controlApi.devices().then(setData).catch(() => setData({ devices: [], staff: [], lock: "off" }));
  useEffect(() => { load(); }, []);
  const revoke = async (d) => {
    try { await api.controlApi.revokeDevice(d.id); flashToast?.(`أُلغي ${d.shared ? "جهاز الفرع" : `جهاز ${d.userName}`}`); load(); }
    catch { flashToast?.("تعذّر إلغاء الجهاز"); }
  };
  if (!data) return null;
  const active = data.devices.filter((d) => !d.revokedAt);
  const missing = data.staff.filter((s) => s.required && !s.hasDevice);
  return (
    <div className="px-4 pb-6">
      <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-4">أجهزة الدخول</p>
      <Card style={{ padding: 12, marginBottom: 8 }}>
        <p className="text-[11px]" style={{ color: "var(--text2)", margin: 0 }}>السياسة (من الإدارة): <b style={{ color: "var(--text)" }}>{POLICY[data.lock] || data.lock}</b></p>
        {missing.length > 0 && (
          <p className="text-[11px]" style={{ color: "var(--bad)", margin: "4px 0 0" }}>لم يربطوا جهازًا بعد: {missing.map((s) => s.name).join("، ")}</p>
        )}
        <button onClick={onSharedInvite} className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5"
          style={{ background: "var(--field)", color: "var(--accentText)", border: "1px solid var(--line)" }}>
          <Tablet size={13} /> رمز ربط «جهاز الفرع» (تابلت مشترك)
        </button>
      </Card>
      {active.length === 0 && <p className="text-[11px]" style={{ color: "var(--text3)" }}>لا أجهزة مربوطة بعد — «ربط جهاز» بجانب كل موظف.</p>}
      {active.map((d) => (
        <Card key={d.id} style={{ padding: 10, marginBottom: 6 }}>
          <div className="flex items-center gap-2">
            {d.shared ? <Tablet size={15} color="var(--accent)" /> : <MonitorSmartphone size={15} color="var(--accent)" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: "var(--text)", margin: 0 }}>{d.shared ? "جهاز الفرع" : d.userName}</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text3)", margin: 0 }}>
                {d.label} · رُبط {new Date(d.createdAt).toLocaleDateString("en-GB")}{d.lastSeenAt ? ` · آخر دخول ${new Date(d.lastSeenAt).toLocaleDateString("en-GB")}` : ""}
              </p>
            </div>
            <button onClick={() => revoke(d)} className="text-[11px] px-2 py-1 rounded-lg flex items-center gap-1" style={{ color: "var(--bad)", border: "1px solid var(--badLine)" }}>
              <X size={11} /> إلغاء
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export { DevicesCard };
