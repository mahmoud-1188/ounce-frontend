import React, { useState } from "react";
import { Landmark, Plus } from "lucide-react";
import { ASSET_CLASSES } from "../core/erp.js";
import { fmtMoney, fromHalalas, halalas } from "../core/money.js";
import { assetStatus } from "../domain/assetStatus.js";
import { buildDepreciationJournal } from "../domain/buildDepreciationJournal.js";
import { AssetForm } from "../ui/AssetForm.jsx";
import { Card } from "../ui/Card.jsx";
import { DisposeForm } from "../ui/DisposeForm.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/**
 * منقولة عن FixedAssetsPage.js المرجعي حرفيًا في البنية — الفرق الوحيد
 * الحقيقي: onAdd/onRunDepreciation/onDispose أصبحت async (تستدعي الباك
 * إند الفعلي عبر GoldInventoryApp.jsx)، فتعيد Promise<boolean> بدل
 * boolean متزامن — setView("list") لا يحدث إلا بعد نجاح فعلي مؤكَّد من
 * الخادم، لا افتراضًا كما في الحفظ المحلي القديم.
 *
 * ⚠ preview (buildDepreciationJournal) هنا للعرض فقط — "كم أصل، كم
 * مبلغ، هل يستحق تشغيل الإهلاك" — التنفيذ الفعلي والترحيل المحاسبي يتم
 * بالكامل من الخادم (POST /fixed-assets/depreciation/run) الذي يعيد
 * حساب كل شيء بنفسه من depreciation_schedule الحقيقي، لا من هذا الحساب
 * المحلي التقريبي. لو اختلف مبلغ المعاينة عن الفعلي (نادر، مثل تغيّر
 * سجل الإهلاك من متصفح آخر بين فتح الشاشة والضغط على الزر) فالخادم هو
 * المرجع النهائي دومًا.
 */
function FixedAssetsPage({
  assets = [], depreciations = [], currency = "ر.س", canManage,
  onAdd, onRunDepreciation, onDispose, onBack,
}) {
  const [view, setView] = useState("list");       // list | add | dispose
  const [sel, setSel] = useState(null);
  const [running, setRunning] = useState(false);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(thisMonth);

  const live = assets.filter((a) => !a.disposed);
  const gone = assets.filter((a) => a.disposed);
  const rows = live.map((a) => ({ a, st: assetStatus(a, depreciations),
    cls: ASSET_CLASSES.find((c) => c.id === a.classId) || ASSET_CLASSES[0] }));
  const totals = rows.reduce((t, r) => ({
    cost: t.cost + halalas(r.st.cost), accum: t.accum + halalas(r.st.accumulated), book: t.book + halalas(r.st.bookValue),
  }), { cost: 0, accum: 0, book: 0 });
  const preview = buildDepreciationJournal(assets, depreciations, period, "");
  const alreadyRun = depreciations.some((d) => d.period === period);
  const months = Array.from({ length: 4 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); });

  async function runDepreciation() {
    setRunning(true);
    await onRunDepreciation(period);
    setRunning(false);
  }

  return (
    <div>
      <SubPageHeader title={view === "add" ? "أصل جديد" : view === "dispose" ? `استبعاد ${sel?.name || ""}` : "الأصول الثابتة"}
        onBack={() => (view === "list" ? onBack() : (setView("list"), setSel(null)))} />
      <div className="px-4 pt-3">

        {view === "list" && (
          <>
            <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
              <div className="grid grid-cols-3 gap-2">
                {[["التكلفة", totals.cost, "text"], ["مجمّع الإهلاك", totals.accum, "bad"], ["القيمة الدفترية", totals.book, "accent"]].map(([l, v, tone]) => (
                  <div key={l}>
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{l}</p>
                    <p style={{ color: `var(--${tone})`, margin: 0 }} className="text-[13px] font-bold">{currency}{fmtMoney(fromHalalas(v))}</p>
                  </div>
                ))}
              </div>
            </Card>

            {canManage && (
              <Card style={{ padding: 12, marginBottom: 10 }}>
                <p style={{ color: "var(--accent)", margin: 0 }} className="text-[11px] font-bold mb-2">إهلاك الشهر</p>
                <div className="flex gap-1.5 mb-2 overflow-x-auto">
                  {months.map((m) => (
                    <button key={m} onClick={() => setPeriod(m)} className="px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0"
                      style={{ background: period === m ? "var(--accentBg)" : "var(--field)", color: period === m ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
                      {m}{depreciations.some((d) => d.period === m) ? " ✓" : ""}
                    </button>
                  ))}
                </div>
                {alreadyRun ? (
                  <p style={{ color: "var(--good)" }} className="text-[11px]">✓ أُهلك هذا الشهر</p>
                ) : preview.total > 0 ? (
                  <button onClick={runDepreciation} disabled={running} className="w-full py-2.5 rounded-xl text-[12px] font-bold"
                    style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
                    {running ? "جارٍ التسجيل…" : `تسجيل إهلاك ${period} — ${preview.details.length} أصل · ${currency}${fmtMoney(preview.total)}`}
                  </button>
                ) : (
                  <p style={{ color: "var(--text3)" }} className="text-[11px]">لا إهلاك مستحقّ — لا أصول قيد التشغيل أو كلّها مُهلَكة</p>
                )}
              </Card>
            )}

            {canManage && (
              <button onClick={() => setView("add")} className="w-full py-3 rounded-xl text-sm font-bold mb-3 flex items-center justify-center gap-2"
                style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                <Plus size={16} /> أصل جديد
              </button>
            )}

            {rows.length === 0 ? (
              <EmptyState icon={<Landmark size={30} color="var(--accentSoft)" />} title="لا أصول مسجّلة" sub="الفاترينات والخزنة والموازين والأثاث — تُسجَّل هنا وتُهلَك شهريًا" />
            ) : rows.map(({ a, st, cls }) => (
              <Card key={a.id} style={{ padding: 11, marginBottom: 6 }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--text)" }} className="text-[12px] font-bold flex-1 truncate">{a.name}</span>
                  <span style={{ color: "var(--text3)", fontFamily: "monospace" }} className="text-[10px]">{a.ref}</span>
                </div>
                <p style={{ color: "var(--text3)", margin: "2px 0 4px" }} className="text-[10px]">
                  {cls.label} · {a.years || cls.years} سنة · {a.method === "declining" ? "متناقص" : "ثابت"} · منذ {a.purchasedAt}
                </p>
                <div style={{ height: 4, background: "var(--field)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${st.pct}%`, height: "100%", background: st.fullyDepreciated ? "var(--text3)" : "var(--accent)" }} />
                </div>
                <div className="flex items-baseline justify-between mt-1.5">
                  <span style={{ color: "var(--text3)" }} className="text-[10px]">
                    {fmtMoney(st.accumulated)} من {fmtMoney(st.cost - st.salvage)} · {st.monthsRun}/{st.monthsTotal} شهر
                  </span>
                  <span style={{ color: "var(--accent)" }} className="text-[12px] font-bold">{currency}{fmtMoney(st.bookValue)}</span>
                </div>
                {canManage && (
                  <button onClick={() => { setSel(a); setView("dispose"); }} className="mt-2 text-[10px] px-2 py-1 rounded-full"
                    style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                    بيع أو إتلاف
                  </button>
                )}
              </Card>
            ))}

            {gone.length > 0 && (
              <>
                <p style={{ color: "var(--text3)" }} className="text-[10px] font-bold mt-3 mb-1">مستبعَدة — {gone.length}</p>
                {gone.map((a) => (
                  <Card key={a.id} style={{ padding: 9, marginBottom: 4, opacity: 0.7 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "var(--text2)" }} className="text-[11px] flex-1 truncate">{a.name}</span>
                      <span style={{ color: (a.disposalGain || 0) >= 0 ? "var(--good)" : "var(--bad)" }} className="text-[10px] font-bold">
                        {(a.disposalGain || 0) >= 0 ? "ربح " : "خسارة "}{fmtMoney(Math.abs(a.disposalGain || 0))}
                      </span>
                    </div>
                  </Card>
                ))}
              </>
            )}
            <div style={{ height: 24 }} />
          </>
        )}

        {view === "add" && (
          <AssetForm currency={currency} onCancel={() => setView("list")}
            onSave={async (d) => { const ok = await onAdd(d); if (ok) setView("list"); return ok; }} />
        )}

        {view === "dispose" && sel && (
          <DisposeForm asset={sel} status={assetStatus(sel, depreciations)} currency={currency}
            onCancel={() => { setView("list"); setSel(null); }}
            onConfirm={async (d) => {
              const ok = await onDispose({ assetId: sel.id, ...d });
              if (ok) { setView("list"); setSel(null); }
              return ok;
            }} />
        )}
      </div>
    </div>
  );
}

export { FixedAssetsPage };
