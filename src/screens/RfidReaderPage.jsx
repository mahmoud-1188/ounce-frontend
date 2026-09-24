import React, { useCallback, useMemo, useState } from "react";
import { Barcode } from "lucide-react";
import { NHR_POWER_MAX_DBM, RFID_DEFAULTS } from "../core/constants.js";
import { fmtW } from "../core/money.js";
import { inputStyle, nextSessionId, rfidSettingsFor, useNhrReader } from "../domain/helpers.js";
import { buildRfidSession } from "../domain/buildRfidSession.js";
import { ShareMenu } from "../ui/ShareMenu.jsx";
import { matchEpcToUnits } from "../domain/matchEpcToUnits.js";
import { BindEpcSheet } from "../modals/BindEpcSheet.jsx";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

/**
 * شاشة قارئ RFID — منقولة عن نسخة المرجع بقرارك الصريح: NHR-10 عبر
 * البلوتوث، مع فتح BindEpcSheet لربط بطاقة غير معروفة بقطعة (يكتب
 * الربط فعليًا على الباك إند — item_units.epc، migration 014).
 *
 * ⚠ فرقٌ عن المرجع: rfidCfg هنا مخزن مستقل (لا appSettings.rfid) —
 * محلي بحتٌ مثل إعدادات الطابعة (كل جهاز يقترن بقارئه بنفسه)، فالغرض
 * (section) يُمرَّر كـ{rfid: rfidCfg} لأن rfidSettingsFor نفسها منقولة
 * حرفيًا وتتوقع الشكل settings.rfid.
 */
function RfidReaderPage({ items = [], suppliers = [], lots = [], categories = [], branch = {}, userName = "", storeId = 0, rfidCfg, canManage, onBindEpc, onApplyCount, onBack }) {
  const [tab, setTab] = useState("live");        // live | batch | find
  const [tags, setTags] = useState(new Map());   // epc → {rssi, total}
  const [logLines, setLogLines] = useState([]);
  const [batch, setBatch] = useState(null);
  const [findEpc, setFindEpc] = useState("");
  const [power, setPowerInput] = useState("");
  const [bindFor, setBindFor] = useState(null);

  const onTags = useCallback((list) => {
    setTags((prev) => {
      const next = new Map(prev);
      for (const t of list) next.set(t.epc, { rssi: t.rssi, total: t.total });
      return next;
    });
  }, []);
  const onBatchFile = useCallback((out) => setBatch(out), []);
  const onLog = useCallback((line) => setLogLines((l) => [`${new Date().toLocaleTimeString("en-GB")} ${line}`, ...l].slice(0, 40)), []);

  // الجرد غرض هذه الشاشة — تأخذ إعداده، والطاقة تُدفَع للقارئ عند الاتصال
  const readerCfg = useMemo(() => {
    const base = { ...RFID_DEFAULTS, ...(rfidCfg || {}) };
    const eff = rfidSettingsFor("stocktake", { rfid: base });
    return { ...eff, profile: base.profile, q: base.q, session: base.session, target: base.target };
  }, [rfidCfg]);
  const r = useNhrReader({ onTags, onBatch: onBatchFile, onLog, config: readerCfg });
  const live = useMemo(() => matchEpcToUnits([...tags.keys()], items, { suppliers, lots, storeId }), [tags, items, suppliers, lots, storeId]);
  const batchMatch = useMemo(() => (batch?.ok ? matchEpcToUnits(batch.epcs, items, { suppliers, lots, storeId }) : null), [batch, items, suppliers, lots, storeId]);
  // ⚠ جلسة للتصدير والمشاركة — من الدفعة إن وُجدت وإلا من المسح المباشر.
  //   الرقاقة تحمل RSSI من القارئ، فيُلحق بكل سطرٍ مطابق.
  const [archive, setArchive] = useState([]);
  const getSession = () => {
    const src = batchMatch || live;
    if (!src || (!src.found?.length && !src.unknown?.length && !src.otherStore?.length)) return null;
    const found = (src.found || []).map((f) => ({ ...f, rssi: tags.get(f.epc)?.rssi ?? null }));
    const sess = buildRfidSession({ kind: "rfid", sessionId: nextSessionId("RFID", archive), branch, user: userName, categories,
      found, missing: batchMatch ? src.missing || [] : [], unknown: src.unknown || [], otherStore: src.otherStore || [] });
    setArchive((a) => [...a, { session_id: sess.session_id }]);
    return sess;
  };
  const busy = r.state === "live" || r.state === "batch" || r.state === "saving" || r.state === "uploading";

  const STATES = { idle: "غير متصل", connecting: "يتصل…", ready: "جاهز", live: "يمسح مباشرةً",
    batch: "جرد بلا اتصال", saving: "يحفظ على القارئ", uploading: "يرفع الدفعة", error: "خطأ" };

  const Result = ({ m, title }) => (
    <Card style={{ padding: 12, marginBottom: 10 }}>
      <p style={{ color: "var(--accent)", margin: 0 }} className="text-[11px] font-bold mb-2">{title}</p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {[["مطابق", m.found.length, "good"], ["ناقص", m.missing.length, m.missing.length ? "bad" : "text3"],
          ["غير معروف", m.unknown.length + (m.otherStore?.length || 0), m.unknown.length ? "accent" : "text3"]].map(([l, v, tone]) => (
          <div key={l}>
            <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{l}</p>
            <p style={{ color: `var(--${tone})`, margin: 0 }} className="text-[16px] font-bold">{v}</p>
          </div>
        ))}
      </div>
      {m.missing.length > 0 && (
        <div className="mt-1 pt-1" style={{ borderTop: "1px solid var(--line)" }}>
          <p style={{ color: "var(--bad)", margin: 0 }} className="text-[10px] font-bold mb-1">لم تُقرأ — تحقّق منها</p>
          {m.missing.slice(0, 12).map((x) => (
            <p key={x.unit.code} style={{ color: "var(--text2)", margin: 0 }} className="text-[10px]">
              {x.item.description || x.item.ref} · {x.unit.code} · {fmtW(x.item.weight)} جم
            </p>
          ))}
          {m.missing.length > 12 && <p style={{ color: "var(--text3)" }} className="text-[10px]">و{m.missing.length - 12} غيرها</p>}
        </div>
      )}
      {(m.otherStore || []).length > 0 && (
        <div className="mt-2 pt-1" style={{ borderTop: "1px solid var(--line)" }}>
          <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px] font-bold mb-1">
            رقائق محلٍّ آخر ({m.otherStore.length}) — ليست مفقودة، ليست لنا
          </p>
          {m.otherStore.slice(0, 6).map((o) => (
            <p key={o.epc} style={{ color: "var(--text3)", margin: 0, fontFamily: "monospace" }} className="text-[10px]">{o.code} · محل {o.storeId}</p>
          ))}
        </div>
      )}
      {m.unknown.length > 0 && (
        <div className="mt-2 pt-1" style={{ borderTop: "1px solid var(--line)" }}>
          <p style={{ color: "var(--accent)", margin: 0 }} className="text-[10px] font-bold mb-1">
            بطاقات غير مربوطة — اربطها بقطعة
          </p>
          {m.unknown.slice(0, 8).map((e) => (
            <button key={e} onClick={() => setBindFor(e)} className="w-full text-right py-1"
              style={{ color: "var(--text2)", fontFamily: "monospace" }}>
              <span className="text-[10px]">{e}</span>
              <span style={{ color: "var(--accent)" }} className="text-[10px]"> ← اربط</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <div>
      <SubPageHeader title="قارئ RFID" onBack={onBack} right={<ShareMenu compact getSession={getSession} />} />
      <div className="px-4 pt-3">

        <Card style={{ padding: 12, marginBottom: 10, border: `1px solid ${r.state === "idle" ? "var(--line)" : "var(--accentLine)"}` }}>
          <div className="flex items-center gap-2">
            <span style={{ width: 8, height: 8, borderRadius: 4, background: r.state === "idle" ? "var(--text3)" : busy ? "var(--accent)" : "var(--good)" }} />
            <span style={{ color: "var(--text)" }} className="text-[12px] font-bold flex-1">
              {STATES[r.state] || r.state}
            </span>
            {r.info.name && <span style={{ color: "var(--text3)" }} className="text-[10px]">{r.info.name}</span>}
          </div>
          {r.info.battery && (
            <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px]">
              بطارية {r.info.battery.val ?? r.info.battery.voltage ?? "—"}
              {r.info.power != null ? ` · طاقة ${r.info.power} dBm` : ""}
              {r.info.temp != null ? ` · ${r.info.temp}°` : ""}
            </p>
          )}
          {!r.supported && (
            <p style={{ color: "var(--bad)", margin: "6px 0 0" }} className="text-[10px] leading-6">
              ⚠ متصفّحك لا يدعم بلوتوث الويب. يعمل على كروم/إيدج في أندرويد والحاسب،
              ولا يعمل في سفاري على الآيفون.
            </p>
          )}
          <div className="flex gap-2 mt-2">
            {r.state === "idle" ? (
              <button onClick={r.connect} disabled={!r.supported} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold"
                style={{ background: r.supported ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)",
                         color: r.supported ? "var(--panel)" : "var(--text3)" }}>
                اتصل بالقارئ
              </button>
            ) : (
              <button onClick={r.disconnect} className="flex-1 py-2 rounded-xl text-[11px]"
                style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                افصل
              </button>
            )}
          </div>
          {r.err && <p style={{ color: "var(--bad)", margin: "6px 0 0" }} className="text-[11px]">⚠ {r.err}</p>}
        </Card>

        {r.state !== "idle" && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[["live", "جرد مباشر"], ["batch", "جرد بلا اتصال"], ["find", "ابحث عن قطعة"]].map(([id, lbl]) => (
                <button key={id} onClick={() => setTab(id)} className="py-2 rounded-xl text-[11px] font-bold"
                  style={{ background: tab === id ? "var(--accentBg)" : "var(--panel)", color: tab === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}>
                  {lbl}
                </button>
              ))}
            </div>

            {tab === "live" && (
              <>
                <div className="flex gap-2 mb-3">
                  <button onClick={r.state === "live" ? r.stop : r.startLive} className="flex-1 py-3 rounded-xl text-[13px] font-bold"
                    style={{ background: r.state === "live" ? "var(--badBg)" : "linear-gradient(135deg,var(--gradFrom),var(--gradTo))",
                             color: r.state === "live" ? "var(--bad)" : "var(--panel)" }}>
                    {r.state === "live" ? "أوقف المسح" : "ابدأ المسح"}
                  </button>
                  {tags.size > 0 && (
                    <button onClick={() => setTags(new Map())} className="px-4 rounded-xl text-[11px]"
                      style={{ background: "var(--field)", color: "var(--text2)" }}>مسح</button>
                  )}
                </div>
                {tags.size === 0 ? (
                  <EmptyState icon={<Barcode size={30} color="var(--accentSoft)" />} title="وجّه القارئ نحو القطع"
                    sub="اضغط الزناد أو «ابدأ المسح» — القراءات تظهر هنا فورًا" />
                ) : (
                  <>
                    <Result m={live} title={`قُرئت ${tags.size} بطاقة`} />
                    {canManage && live.found.length > 0 && (
                      <button onClick={() => onApplyCount?.(live)} className="w-full py-2.5 rounded-xl text-[12px] font-bold mb-3"
                        style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                        اعتمد هذه القراءة جردًا
                      </button>
                    )}
                    <div className="flex flex-col gap-1">
                      {[...tags.entries()].slice(0, 30).map(([epc, v]) => {
                        const hit = live.found.find((x) => x.epc === epc);
                        return (
                          <Card key={epc} style={{ padding: 8 }}>
                            <div className="flex items-center gap-2">
                              <span style={{ color: hit ? "var(--text)" : "var(--accent)", fontFamily: "monospace" }} className="text-[10px] flex-1 truncate">
                                {hit ? `${hit.item.description || hit.item.ref} · ${hit.unit.code}` : epc}
                              </span>
                              <span style={{ color: "var(--text3)" }} className="text-[10px]">{v.rssi} dBm</span>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            {tab === "batch" && (
              <>
                <Card style={{ padding: 12, marginBottom: 10 }}>
                  <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
                    امسح بلا اتصال ثم ارفع الدفعة. القارئ يحفظ حتى 25,000 بطاقة فريدة.
                  </p>
                  <p style={{ color: "var(--bad)", margin: "4px 0 0" }} className="text-[10px] leading-6">
                    ⚠ لا تبدأ دفعةً جديدة قبل رفع السابقة — البدء يمسح القائمة.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={r.state === "batch" ? r.stopBatch : r.startBatch} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold"
                      style={{ background: r.state === "batch" ? "var(--badBg)" : "var(--accentBg)",
                               color: r.state === "batch" ? "var(--bad)" : "var(--accent)", border: "1px solid var(--accentLine)" }}>
                      {r.state === "batch" ? "أوقف واحفظ" : "ابدأ دفعة"}
                    </button>
                    <button onClick={r.uploadBatch} disabled={r.state !== "ready"} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold"
                      style={{ background: r.state === "ready" ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)",
                               color: r.state === "ready" ? "var(--panel)" : "var(--text3)" }}>
                      ارفع الدفعة
                    </button>
                  </div>
                  {r.info.batchCount != null && (
                    <p style={{ color: "var(--good)", margin: "6px 0 0" }} className="text-[11px]">
                      ✓ حُفظت {r.info.batchCount} بطاقة على القارئ
                    </p>
                  )}
                </Card>
                {batch && !batch.ok && (
                  <Card style={{ padding: 11, marginBottom: 10, border: "1px solid var(--badLine)" }}>
                    <p style={{ color: "var(--bad)", margin: 0 }} className="text-[11px]">⚠ {batch.why}</p>
                  </Card>
                )}
                {batchMatch && (
                  <>
                    <Result m={batchMatch} title={`الدفعة: ${batch.epcs.length} بطاقة`} />
                    {canManage && (
                      <button onClick={() => onApplyCount?.(batchMatch)} className="w-full py-2.5 rounded-xl text-[12px] font-bold mb-3"
                        style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                        اعتمد الدفعة جردًا
                      </button>
                    )}
                  </>
                )}
              </>
            )}

            {tab === "find" && (
              <Card style={{ padding: 12 }}>
                <Field label="رمز البطاقة المطلوبة">
                  <input style={inputStyle} value={findEpc} onChange={(e) => setFindEpc(e.target.value)} placeholder="EPC" />
                </Field>
                <button onClick={() => (r.state === "live" ? r.stop() : r.find(findEpc))} disabled={!findEpc.trim()}
                  className="w-full py-2.5 rounded-xl text-[12px] font-bold"
                  style={{ background: findEpc.trim() ? "var(--accentBg)" : "var(--field)", color: findEpc.trim() ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>
                  {r.state === "live" ? "أوقف البحث" : "ابحث"}
                </button>
                {r.info.findRssi != null && (
                  <div className="mt-3">
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">قوة الإشارة — كلّما اقتربتَ ارتفعت</p>
                    <p style={{ color: "var(--accent)", margin: 0 }} className="text-[22px] font-bold">{r.info.findRssi} dBm</p>
                    <div style={{ height: 6, background: "var(--field)", borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
                      <div style={{ width: `${Math.max(0, Math.min(100, (Number(r.info.findRssi) + 90) * 1.6))}%`, height: "100%", background: "var(--accent)" }} />
                    </div>
                  </div>
                )}
              </Card>
            )}

            {canManage && (
              <Card style={{ padding: 11, marginTop: 10 }}>
                <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">
                  طاقة الإرسال — الأقلّ يكفي للقريب ويمنع قراءة أرفف الجيران
                </p>
                <div className="flex gap-2 mt-1">
                  <NumericInput value={power} onChange={setPowerInput} />
                  <button onClick={() => r.setPower(Number(power))} disabled={busy || !power}
                    className="px-4 rounded-xl text-[11px] font-bold"
                    style={{ background: busy ? "var(--field)" : "var(--accentBg)", color: busy ? "var(--text3)" : "var(--accent)" }}>
                    اضبط
                  </button>
                </div>
                <p style={{ color: "var(--text3)", margin: "4px 0 0" }} className="text-[10px]">
                  الحدّ المسموح {NHR_POWER_MAX_DBM} dBm. لا يُضبط أثناء المسح.
                </p>
              </Card>
            )}

            {logLines.length > 0 && (
              <details className="mt-3">
                <summary style={{ color: "var(--text3)" }} className="text-[10px]">سجل الاتصال</summary>
                <div className="mt-1">
                  {logLines.map((l, i) => (
                    <p key={i} style={{ color: "var(--text3)", fontFamily: "monospace", margin: 0 }} className="text-[9px]">{l}</p>
                  ))}
                </div>
              </details>
            )}
          </>
        )}

        {bindFor && (
          <BindEpcSheet epc={bindFor} items={items} onCancel={() => setBindFor(null)}
            onBind={async (unitId, unitCode) => {
              const ok = await onBindEpc?.(unitId, bindFor);
              if (ok) setBindFor(null);
              return ok;
            }} />
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

export { RfidReaderPage };
