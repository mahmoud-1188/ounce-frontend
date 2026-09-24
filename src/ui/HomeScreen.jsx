import React from "react";
import { ClipboardCheck, Flame, Plus, Receipt, RotateCcw } from "lucide-react";
import { PURITY, fmtMoney, fmtW } from "../core/money.js";
import { markupLabel } from "../domain/helpers.js";

/// الرئيسية بعد الرقم السري — ما يحتاجه صاحب المحل صباحًا في نظرة:
/// الذهب كلّه بمكافئ عيار 21، والنقد الآن، وثلاثة أفعال (بيع · كسر · جرد).
///
/// ⚠ ثلاثة أفعال لا أكثر — والأوّل منها هو ما يفتح المحل لأجله. والأزرار
///   تتبع الصلاحية: ما لا يملكه الدور لا يظهر.
function HomeScreen({ userName = "", totals = {}, scrapTotals = {}, safeGoldBalance = {},
  cashBalance = {}, safeBalance = {}, custodyBalance = {}, priceData = {}, openDay = null,
  permitted = [], onSell, onScrap = null, onGo, notices = [] }) {
  const currency = priceData.currency || "ر.س";
  const p21 = PURITY[21];
  const to21 = (fine) => (Number(fine) || 0) / p21;
  const invFine = Number(totals.fineWeight) || 0;
  const scrapFine = Number(scrapTotals.fineWeightInStock) || 0;
  const safeFine = Number(safeGoldBalance.fineWeight) || 0;
  const allFine = invFine + scrapFine + safeFine;
  const cashNow = (Number(cashBalance.cash) || 0) + (Number(safeBalance.cash) || 0) + (Number(custodyBalance.cash) || 0);
  const networkNow = (Number(cashBalance.network) || 0) + (Number(safeBalance.network) || 0);
  const has = (id) => permitted.includes(id);
  const scrapTarget = has("scrapIntake") ? "scrapIntake" : has("scrapCustody") ? "scrapCustody" : has("scrap") ? "scrap" : null;
  const primary = [
    has("sales") && { id: "sell", label: "بيع", hint: openDay ? "فاتورة جديدة" : "افتح اليوم أولًا", icon: Receipt, onClick: onSell, hero: true },
    // ⚠ زرّ الكسر يفتح كل خيارات الكسر (استلام · عهدة · سجل) لا شاشةً واحدة
    scrapTarget && { id: "scrap", label: "كسر", hint: "كل خيارات الكسر", icon: Flame, onClick: () => (onScrap ? onScrap() : onGo(scrapTarget)) },
    has("stocktake") && { id: "stocktake", label: "جرد", hint: "عدّ الرفّ", icon: ClipboardCheck, onClick: () => onGo("stocktake") },
  ].filter(Boolean);
  // وصلتان لا ستّ: التكويد والمرتجع — الباقي في القائمة
  const quick = [["addGoods", "التكويد", Plus], ["salesReturn", "مرتجع / استبدال", RotateCcw]]
    .filter(([id]) => has(id));
  const hour = new Date().getHours();
  const greet = hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء النور";
  const num = { fontFamily: "'Cairo', sans-serif", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" };
  const soft = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 20 };
  const Mini = ({ label, fine, w }) => (
    <div style={{ background: "var(--field)", borderRadius: 14, padding: "10px 8px", textAlign: "center" }}>
      <p style={{ color: "var(--text)", margin: 0, ...num }} className="text-sm font-extrabold">{fmtW(to21(fine))}</p>
      <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">{label}</p>
      <p style={{ color: "var(--text3)", margin: 0, opacity: 0.8 }} className="text-[10px]">{fmtW(w)} جم خام</p>
    </div>
  );
  return (
    <div className="px-4 pt-3 pb-28">
      {/* ── التحيّة ── */}
      <div className="flex items-baseline justify-between mb-3">
        <p style={{ color: "var(--text)", margin: 0 }} className="text-base font-bold">{greet}{userName ? `، ${userName}` : ""}</p>
        <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">
          جم24 {currency}{fmtMoney(priceData.current || 0)}{priceData.markup?.value > 0 ? ` (عالمي + ${markupLabel(priceData.markup)})` : priceData.source === "hq" ? " · من الإدارة" : ""}
        </p>
      </div>

      {/* ── إعلانات الإدارة — تظهر حتى تاريخ انتهائها ── */}
      {(notices || []).filter((n) => n.until > new Date().toISOString()).slice(0, 3).map((n) => (
        <div key={n.id} className="py-2 px-3 rounded-2xl text-[11px] mb-2" style={{ background: "var(--accentBg)", color: "var(--accentText)", border: "1px solid var(--accentLine)" }}>
          📣 {n.text} <span style={{ color: "var(--text3)" }}>— {n.by || "الإدارة"} · {new Date(n.at).toLocaleDateString("en-GB")}</span>
        </div>
      ))}

      {/* ── الذهب ── */}
      <div style={{ ...soft, padding: "16px 16px 12px", marginBottom: 12 }}>
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text2)" }} className="text-xs">الذهب الآن · مكافئ عيار 21</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--field)", color: "var(--text3)" }}>{totals.pieces || 0} قطعة</span>
        </div>
        <p style={{ color: "var(--text)", margin: "4px 0 0", ...num }} className="text-4xl font-extrabold">
          {fmtW(to21(allFine))}<span style={{ color: "var(--text3)", fontSize: 13, marginRight: 6, letterSpacing: 0 }}>جم</span>
        </p>
        <p style={{ color: "var(--text3)", margin: "0 0 12px" }} className="text-[11px]">
          ≈ {currency}{fmtMoney((Number(priceData.current) || 0) * allFine)} بسعر اليوم · صافي 24: {fmtW(allFine)} جم
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Mini label="مشغول" fine={invFine} w={totals.weight || 0} />
          <Mini label="كسر" fine={scrapFine} w={scrapTotals.weightInStock || 0} />
          <Mini label="الخزنة" fine={safeFine} w={safeGoldBalance.total || 0} />
        </div>
      </div>

      {/* ── النقد ── */}
      <div style={{ ...soft, padding: "14px 16px", marginBottom: 16 }} className="flex items-center justify-between">
        <div>
          <p style={{ color: "var(--text2)", margin: 0 }} className="text-xs">النقد الآن</p>
          <p style={{ color: "var(--goodSolid)", margin: "2px 0 0", ...num }} className="text-2xl font-extrabold">{currency}{fmtMoney(cashNow)}</p>
        </div>
        <div className="text-left" style={{ direction: "rtl" }}>
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">صندوق {fmtMoney(cashBalance.cash || 0)}</p>
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">خزنة {fmtMoney(safeBalance.cash || 0)}</p>
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[11px]">شبكة {fmtMoney(networkNow)}</p>
        </div>
      </div>

      {/* ── الأفعال ── */}
      {primary.length > 0 && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: `repeat(${primary.length}, minmax(0, 1fr))` }}>
          {primary.map((b) => {
            const Icon = b.icon;
            return (
              <button key={b.id} onClick={b.onClick} className="flex flex-col items-center gap-2 py-4"
                style={b.hero
                  ? { background: "linear-gradient(135deg, var(--gradFrom), var(--gradTo))", color: "var(--bg)", borderRadius: 20, boxShadow: "0 8px 22px -10px var(--gradFrom)" }
                  : { ...soft, color: "var(--text)" }}>
                <span className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14,
                  background: b.hero ? "rgba(0,0,0,.12)" : "var(--accentBg)", color: b.hero ? "var(--bg)" : "var(--accent)" }}>
                  <Icon size={22} />
                </span>
                <span className="text-sm font-extrabold">{b.label}</span>
                <span className="text-[11px]" style={{ opacity: 0.75 }}>{b.hint}</span>
              </button>
            );
          })}
        </div>
      )}
      {quick.length > 0 && (
        <div className="flex gap-2 mb-3">
          {quick.map(([id, label, Icon]) => (
            <button key={id} onClick={() => onGo(id)} className="flex-1 py-2.5 rounded-full text-[11px] font-bold flex items-center justify-center gap-1.5"
              style={{ background: "var(--field)", color: "var(--text2)" }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      )}
      {!openDay && has("sales") && (
        <p style={{ color: "var(--text3)" }} className="text-[11px] mt-3 text-center">لا يوم عمل مفتوح — البيع يفتحه لك.</p>
      )}
    </div>
  );
}

export { HomeScreen };
