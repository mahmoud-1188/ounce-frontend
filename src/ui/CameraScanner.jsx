import React, { useEffect, useRef, useState } from "react";

function CameraScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("starting");
  const [why, setWhy] = useState("");

  useEffect(() => {
    let stream = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      if (!("BarcodeDetector" in window)) {
        setStatus("unsupported");
        setWhy("متصفّحك لا يقرأ الرموز بالكاميرا — استعمل قارئ RFID أو اكتب الرمز");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch (e) {
        setStatus("denied");
        setWhy(e && e.name === "NotAllowedError"
          ? "رُفض إذن الكاميرا — فعّله من إعدادات المتصفّح"
          : "تعذّر فتح الكاميرا");
        return;
      }
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus("scanning");
      const det = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13"] });
      const tick = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const found = await det.detect(videoRef.current);
          if (found && found.length) {
            onScan(String(found[0].rawValue || "").trim(), "camera");
            return;                     // أول قراءة تكفي — لا نُكرّر
          }
        } catch (e) { /* إطارٌ غير جاهز */ }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      // ⚠ إيقاف المسارات لازم: بلا ذلك تبقى الكاميرا مضاءة بعد إغلاق النافذة
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000" }}>
      <video ref={videoRef} playsInline muted style={{ width: "100%", display: "block", maxHeight: 280, objectFit: "cover" }} />
      {status === "scanning" && (
        <div style={{ position: "absolute", inset: "18% 12%", border: "2px solid var(--accent)", borderRadius: 10 }} />
      )}
      {(status === "unsupported" || status === "denied") && (
        <div style={{ padding: 18 }}>
          <p style={{ color: "var(--bad)", margin: 0 }} className="text-[11px] leading-6">⚠ {why}</p>
        </div>
      )}
      <button onClick={onClose} className="absolute px-2 py-1 rounded-full text-[10px] font-bold"
        style={{ top: 8, left: 8, background: "rgba(0,0,0,.6)", color: "#fff" }}>إغلاق</button>
    </div>
  );
}

export { CameraScanner };
