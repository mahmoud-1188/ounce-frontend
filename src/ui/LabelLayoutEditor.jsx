import React, { useEffect, useRef, useState } from "react";
import { DEFAULT_PRINTER } from "../core/constants.js";
import { fitLayout, renderLabelCanvas } from "../domain/labelPrinter.js";

function LabelLayoutEditor({ cfg, onChange, onChangeCfg, sampleItem, currency, price24 }) {
  const W = Number(cfg.labelWidthMm) || 50, H = Number(cfg.labelHeightMm) || 20;
  const saved = fitLayout({ ...DEFAULT_PRINTER.layout, ...(cfg.layout || {}) }, W, H);
  // أثناء السحب يُرسم من المسودّة ويُحفظ مرّةً عند رفع الإصبع، فالحفظ مع كل حركة يقطّع السحب
  const [draft, setDraft] = useState(null);
  const L = draft || saved;
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [sel, setSel] = useState("qr");
  const [logo, setLogo] = useState(null);
  const dragRef = useRef(null);
  const NAMES = { qr: "QR", code: "الرمز", weight: "الوزن", karat: "العيار", logo: "الشعار",
    desc: "الوصف", price: "السعر", barcode: "الباركود" };
  const ids = Object.keys(NAMES).filter((k2) =>
    (k2 === "qr" ? cfg.symbology === "qr" : k2 === "barcode" ? cfg.symbology !== "qr" : true));
  const commit = (next) => onChange(fitLayout(next, W, H));

  useEffect(() => {
    let alive = true;
    if (!cfg.customLogo) { setLogo(null); return () => { alive = false; }; }
    const im = new Image();
    im.onload = () => { if (alive) setLogo(im); };
    im.onerror = () => { if (alive) setLogo(null); };
    im.src = cfg.customLogo;
    return () => { alive = false; };
  }, [cfg.customLogo]);

  useEffect(() => {
    const view = canvasRef.current;
    if (!view) return;
    const item = sampleItem || { description: "خاتم ذهب", karat: 21, weight: 5.25, ref: "R7K2M9PQ" };
    const c = renderLabelCanvas({ item, code: "R7K2M9PQ", cfg: { ...cfg, layout: L }, currency, price24, logoImg: logo });
    view.width = c.width; view.height = c.height;
    view.getContext("2d").drawImage(c, 0, 0);
  }, [JSON.stringify(L), W, H, cfg.symbology, cfg.dpi, logo]);

  // عرض الحاوية يُراقَب لا يُقرأ مرّة، فهي غير موجودة في الرسم الأول فتنزاح مربّعات السحب
  const [wrapW, setWrapW] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const upd = () => setWrapW(el.clientWidth || 0);
    upd();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", upd);
      return () => window.removeEventListener("resize", upd);
    }
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pxPerMm = () => (wrapW || wrapRef.current?.clientWidth || 300) / W;
  const snap = (v) => Math.round(v * 2) / 2;

  // أحداث pointer وحدها، فالجوّال يُطلق pointer وtouch معًا فيتحرّك العنصر ضعف الإصبع
  const start = (id, mode) => (e) => {
    e.preventDefault(); e.stopPropagation();
    setSel(id);
    const el = L[id];
    dragRef.current = { id, mode, px: e.clientX, py: e.clientY, x0: el.x, y0: el.y, w0: el.w, h0: el.h, k: pxPerMm(), base: L };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (er) {}
  };
  const move = (e) => {
    const d = dragRef.current; if (!d) return;
    const dx = (e.clientX - d.px) / d.k, dy = (e.clientY - d.py) / d.k;
    const cur = { ...d.base[d.id] };
    if (d.mode === "move") {
      cur.x = snap(d.x0 - dx);            // x من اليمين، فالسحب يسارًا يزيدها
      cur.y = snap(d.y0 + dy);
    } else {
      cur.w = Math.max(2, snap(d.w0 - dx));
      cur.h = Math.max(2, snap(d.h0 + dy));
    }
    setDraft(fitLayout({ ...d.base, [d.id]: cur }, W, H));
  };
  const end = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (draft) commit(draft);
    setDraft(null);
  };

  const nudge = (f, dv) => {
    const cur = { ...L[sel] };
    cur[f] = Math.max(f === "w" || f === "h" ? 2 : 0, snap((Number(cur[f]) || 0) + dv));
    commit({ ...L, [sel]: cur });
  };

  const k = pxPerMm();
  const el = L[sel] || {};
  const btn = { background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
        <div ref={wrapRef} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
          style={{ position: "relative", width: "100%", aspectRatio: `${W} / ${H}`,
            background: "#fff", borderRadius: 6, overflow: "hidden",
            touchAction: "none", userSelect: "none" }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
          {ids.map((id) => {
            const e2 = L[id];
            if (!e2?.show) return null;
            const on = sel === id;
            return (
              <div key={id} onPointerDown={start(id, "move")}
                style={{ position: "absolute", left: (W - e2.x - e2.w) * k, top: e2.y * k,
                  width: e2.w * k, height: e2.h * k, cursor: "move",
                  border: `${on ? 2 : 1}px ${on ? "solid" : "dashed"} rgba(212,175,55,${on ? 0.95 : 0.5})`,
                  background: on ? "rgba(212,175,55,.12)" : "transparent", borderRadius: 3 }}>
                {on && (
                  <div onPointerDown={start(id, "size")}
                    style={{ position: "absolute", left: -10, bottom: -10, width: 22, height: 22, borderRadius: 11,
                      background: "var(--accent)", border: "2px solid #fff", cursor: "nwse-resize" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p style={{ color: "var(--text3)", margin: "0 0 8px", textAlign: "center" }} className="text-[11px]">
        {W} × {H} مم — <b>ما تراه هو ما يُطبع</b>
      </p>

      <div className="flex gap-1.5 flex-wrap mb-2">
        {ids.map((id) => (
          <button key={id} onClick={() => setSel(id)}
            data-help={`عنصر «${NAMES[id]}» في تخطيط الملصق${L[id]?.show ? "" : " (مخفيّ)"} — اضغطه لتحدّده ثم حرّكه أو غيّر مقاسه أو أخفه بالأزرار تحته.`}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
            style={{ background: sel === id ? "var(--accentBg)" : "var(--field)",
              color: sel === id ? "var(--accent)" : L[id]?.show ? "var(--text2)" : "var(--text3)",
              border: `1px solid ${sel === id ? "var(--accentLine)" : "var(--line)"}`,
              textDecoration: L[id]?.show ? "none" : "line-through" }}>
            {NAMES[id]}
          </button>
        ))}
      </div>

      <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12, padding: 10 }}>
        <div className="flex items-center justify-between mb-2">
          <b style={{ color: "var(--accent)" }} className="text-[12px]">{NAMES[sel]}</b>
          <button onClick={() => commit({ ...L, [sel]: { ...el, show: !el.show } })}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold" style={btn}>
            {el.show ? "أخفِه" : "أظهِره"}
          </button>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <p style={{ color: "var(--text3)", margin: "0 0 4px" }} className="text-[10px]">تحريك — نصف مليمتر</p>
            <div className="grid grid-cols-3 gap-1" style={{ direction: "ltr" }}>
              <span />
              <button onClick={() => nudge("y", -0.5)} aria-label="حرّك لأعلى نصف مليمتر" className="py-2 rounded-lg text-[14px]" style={btn}>▲</button>
              <span />
              <button onClick={() => nudge("x", 0.5)} aria-label="حرّك لليسار نصف مليمتر" className="py-2 rounded-lg text-[14px]" style={btn}>◀</button>
              <span className="text-[9px] text-center self-center" style={{ color: "var(--text3)" }}>
                {el.x}·{el.y}
              </span>
              <button onClick={() => nudge("x", -0.5)} aria-label="حرّك لليمين نصف مليمتر" className="py-2 rounded-lg text-[14px]" style={btn}>▶</button>
              <span />
              <button onClick={() => nudge("y", 0.5)} aria-label="حرّك لأسفل نصف مليمتر" className="py-2 rounded-lg text-[14px]" style={btn}>▼</button>
              <span />
            </div>
          </div>
          <div>
            <p style={{ color: "var(--text3)", margin: "0 0 4px" }} className="text-[10px]">الحجم</p>
            {[["w", "العرض"], ["h", "الطول"]].map(([f, lab]) => (
              <div key={f} className="flex items-center gap-1 mb-1">
                <button onClick={() => nudge(f, -0.5)} aria-label={`أنقص ${lab} نصف مليمتر`} className="w-9 py-2 rounded-lg text-[14px] font-bold" style={btn}>−</button>
                <span className="flex-1 text-center text-[11px]" style={{ color: "var(--text2)" }}>
                  {lab} {el[f]} مم
                </span>
                <button onClick={() => nudge(f, 0.5)} aria-label={`زد ${lab} نصف مليمتر`} className="w-9 py-2 rounded-lg text-[14px] font-bold" style={btn}>+</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p style={{ color: "var(--text3)", margin: "8px 0 0" }} className="text-[10px] leading-6">
        اختر عنصرًا ثم حرّكه <b>بالأسهم</b> أو اسحبه بإصبعك، وكبّره من الدائرة الذهبية في زاويته.
        العنصر لا يخرج عن الملصق.
      </p>
      <button onClick={() => { setDraft(null); onChange({ ...DEFAULT_PRINTER.layout }); }}
        className="w-full mt-2 py-2 rounded-lg text-[11px]" style={btn}>
        إعادة التخطيط الافتراضي — 50×20
      </button>
    </div>
  );
}

export { LabelLayoutEditor };
