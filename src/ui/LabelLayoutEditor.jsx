import React, { useEffect, useRef, useState } from "react";
import { DEFAULT_PRINTER } from "../core/constants.js";
import { renderLabelCanvas } from "../domain/helpers.js";
import { MmInput } from "./MmInput.jsx";

function LabelLayoutEditor({ cfg, onChange, onChangeCfg, sampleItem, currency, price24 }) {
  const L = { ...DEFAULT_PRINTER.layout, ...(cfg.layout || {}) };
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [sel, setSel] = useState("desc");
  const [logo, setLogo] = useState(null);
  const dragRef = useRef(null);
  const [, force] = useState(0);
  const NAMES = { logo: "الشعار", desc: "الوصف", karat: "K العيار", weight: "W الوزن",
    price: "السعر", barcode: "الباركود", qr: "QR", code: "الرمز" };
  const shownIds = Object.keys(NAMES).filter((k) => (k === "qr" ? cfg.symbology === "qr" : k === "barcode" ? cfg.symbology !== "qr" : true));

  useEffect(() => {
    let alive = true;
    if (!cfg.customLogo) { setLogo(null); return () => { alive = false; }; }
    const im = new Image();
    im.onload = () => { if (alive) setLogo(im); };
    im.onerror = () => { if (alive) setLogo(null); };
    im.src = cfg.customLogo;
    return () => { alive = false; };
  }, [cfg.customLogo]);

  const paint = () => {
    const view = canvasRef.current;
    if (!view) return;
    // ⚠ المعاينة بدقّة الطابعة نفسها: معاينةٌ بـ203 وطباعةٌ بـ300 تُريك
    // ملصقًا وتطبع غيره — والنص يبدو مناسبًا ثم يخرج صغيرًا.
    const item = sampleItem || { description: "خاتم ذهب عيار ٢١", karat: 21, weight: 5.25, ref: "R7K2M9PQ", workmanshipPerUnit: 150 };
    const c = renderLabelCanvas({ item, code: "R7K2M9PQ", cfg: { ...cfg, layout: L }, currency, price24, logoImg: logo });
    view.width = c.width; view.height = c.height;
    view.getContext("2d").drawImage(c, 0, 0);
  };
  // ⚠ `cfg.dpi` في القائمة: بدونها تبقى المعاينة بدقّةٍ قديمة بينما
  // الطباعة بالجديدة — فيضبط المستخدم على معاينةٍ لا تُطبع.
  useEffect(() => { paint(); force((n) => n + 1); },
    [JSON.stringify(L), cfg.labelWidthMm, cfg.labelHeightMm, cfg.symbology, cfg.dpi, logo]);

  // ⚠ التحويل بين المليمتر والبكسل يُحسب من عرض الحاوية لحظةَ اللمس:
  // القياس المحفوظ يفسد عند تدوير الجهاز أو تغيّر العرض.
  const scale = () => {
    const w = wrapRef.current?.clientWidth || 300;
    return w / (cfg.labelWidthMm || 50);
  };
  const start = (id, mode) => (e) => {
    e.preventDefault(); e.stopPropagation();
    setSel(id);
    const el = L[id];
    const pt = e.touches?.[0] || e;
    dragRef.current = { id, mode, px: pt.clientX, py: pt.clientY, x0: el.x, y0: el.y, w0: el.w, h0: el.h, k: scale() };
    const move = (ev) => {
      const d = dragRef.current; if (!d) return;
      const p = ev.touches?.[0] || ev;
      const dx = (p.clientX - d.px) / d.k, dy = (p.clientY - d.py) / d.k;
      const cur = { ...L[d.id] };
      const snap = (v) => Math.round(v * 2) / 2;
      if (d.mode === "move") {
        // ⚠ x من اليمين: السحب يسارًا يزيدها
        cur.x = Math.max(0, Math.min((cfg.labelWidthMm || 50) - (cur.w || 1), snap(d.x0 - dx)));
        cur.y = Math.max(0, Math.min((cfg.labelHeightMm || 20) - (cur.h || 1), snap(d.y0 + dy)));
      } else {
        // التكبير من الزاوية السفلى اليسرى: يزيد العرض والارتفاع
        cur.w = Math.max(3, snap(d.w0 - dx));
        cur.h = Math.max(2, snap(d.h0 + dy));
      }
      onChange({ ...L, [d.id]: cur });
      ev.preventDefault();
    };
    const end = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
  };

  const k = scale();
  const W = cfg.labelWidthMm || 50, H = cfg.labelHeightMm || 20;
  return (
    <div>
      {/* ⚠ المعاينة بنسبة الملصق الحقيقية: 50×20 تظهر عريضةً منخفضة كما
          هي على الورق. مربّعٌ ثابت يجعل المستخدم يضبط على نسبةٍ لا وجود لها. */}
      {/* ⚠ المعاينة محبوسةٌ في صندوقٍ بارتفاعٍ أقصى: ملصقٌ 40×80 بنسبته
          الحقيقية على شاشة عرضها 380 بكسل يصير طوله 190 — يدفع الأزرار
          خارج الشاشة. فتُقصّ بالارتفاع وتُوسَّط، والنسبة تبقى صحيحة. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
      <div ref={wrapRef} style={{ position: "relative",
        width: H / W > 0.62 ? `${Math.round((W / H) * 210)}px` : "100%",
        maxWidth: "100%", aspectRatio: `${W} / ${H}`, maxHeight: 210,
        background: "#fff", borderRadius: 6, overflow: "hidden", touchAction: "none", userSelect: "none" }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        {shownIds.map((id) => {
          const el = L[id];
          if (!el?.show) return null;
          const left = (W - el.x - el.w) * k, top = el.y * k, w = el.w * k, h = el.h * k;
          const on = sel === id;
          return (
            <div key={id} onPointerDown={start(id, "move")} onTouchStart={start(id, "move")}
              style={{ position: "absolute", left, top, width: w, height: h, cursor: "move",
                border: `${on ? 2 : 1}px ${on ? "solid" : "dashed"} rgba(212,175,55,${on ? 0.95 : 0.6})`,
                background: on ? "rgba(212,175,55,.10)" : "transparent", borderRadius: 3 }}>
              <span style={{ position: "absolute", top: -13, right: 0, background: "var(--accent)", color: "#1C1913",
                fontSize: 9, padding: "0 3px", borderRadius: 3, whiteSpace: "nowrap" }}>{NAMES[id]}</span>
              {on && (
                <div onPointerDown={start(id, "size")} onTouchStart={start(id, "size")}
                  style={{ position: "absolute", left: -7, bottom: -7, width: 16, height: 16, borderRadius: 8,
                    background: "var(--accent)", border: "2px solid #fff", cursor: "nwse-resize" }} />
              )}
            </div>
          );
        })}
      </div>
      </div>
      {/* المقاس مذكورٌ تحت المعاينة — يُطمئن أن ما تراه هو ما ضبطتَه */}
      <p style={{ color: "var(--text3)", margin: "-4px 0 8px", textAlign: "center" }} className="text-[10px]">
        {W} × {H} مم · {Math.round(W / 25.4 * (Number(cfg.dpi) || 203))} × {Math.round(H / 25.4 * (Number(cfg.dpi) || 203))} نقطة
      </p>

      <div className="flex gap-1 flex-wrap mb-2">
        {shownIds.map((id) => (
          <button key={id} onClick={() => setSel(id)}
            onDoubleClick={() => onChange({ ...L, [id]: { ...L[id], show: !L[id].show } })}
            className="px-2 py-1 rounded-lg text-[10px] font-bold"
            style={{ background: sel === id ? "var(--accentBg)" : "var(--field)",
              color: L[id]?.show ? (sel === id ? "var(--accent)" : "var(--text2)") : "var(--text3)",
              border: "1px solid var(--line)", opacity: L[id]?.show ? 1 : 0.55 }}>
            {NAMES[id]}{L[id]?.show ? "" : " ✗"}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <button onClick={() => onChange({ ...L, [sel]: { ...L[sel], show: !L[sel].show } })}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
          style={{ background: "var(--field)", color: "var(--text2)", border: "1px solid var(--line)" }}>
          {L[sel]?.show ? "أخفِ" : "أظهِر"} {NAMES[sel]}
        </button>
        {["x", "y", "w", "h"].map((f) => (
          <MmInput key={f} label={{ x: "يمين", y: "أعلى", w: "عرض", h: "طول" }[f]}
            value={L[sel]?.[f] ?? 0} width={46}
            max={f === "x" || f === "w" ? (cfg.labelWidthMm || 50) : (cfg.labelHeightMm || 20)}
            onCommit={(v) => onChange({ ...L, [sel]: { ...L[sel], [f]: v } })} />
        ))}
      </div>
      <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
        اسحب أي عنصر بإصبعك، وكبّره من الدائرة في زاويته. ضغطةٌ مزدوجة على اسمه تُخفيه.
        <br />الأرقام بالمليمتر — <b>يمين</b> من الحافة اليمنى، <b>أعلى</b> من السطر الأول.
      </p>
      <button onClick={() => onChange({ ...DEFAULT_PRINTER.layout })} className="w-full mt-2 py-1.5 rounded-lg text-[10px]"
        style={{ background: "var(--field)", color: "var(--text3)", border: "1px solid var(--line)" }}>
        إعادة الافتراضي — 50×20
      </button>
    </div>
  );
}

export { LabelLayoutEditor };
