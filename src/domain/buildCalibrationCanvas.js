function buildCalibrationCanvas({ widthMm, heightMm, dpi = 203 }) {
  const mm = (v) => Math.round((Number(v) || 0) / 25.4 * dpi);
  const W = mm(widthMm), H = mm(heightMm);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#000"; g.lineWidth = 3;
  g.strokeRect(2, 2, W - 4, H - 4);
  g.fillStyle = "#000";
  // علاماتٌ على منتصف كل ضلع
  g.fillRect(W / 2 - 1, 0, 3, mm(3));
  g.fillRect(W / 2 - 1, H - mm(3), 3, mm(3));
  g.fillRect(0, H / 2 - 1, mm(3), 3);
  g.fillRect(W - mm(3), H / 2 - 1, mm(3), 3);
  // زاويةٌ مصمتة تُحدّد جهة اليمين
  g.fillRect(W - mm(6), mm(1), mm(5), mm(5));

  // ⚠ مسطرةٌ داخل الإطار تُشخّص الدقّة بنفسها.
  //
  // إطارٌ وحده يقول «أصغر من الورقة» ولا يقول **كم** أصغر — والفرق هو
  // الجواب: ⅔ يعني أن الطابعة 300 نقطة ونحن نحسب بـ203. فنرسم علاماتٍ
  // كل 10 مم مرقّمة؛ يقيسها المستخدم بمسطرة فيعرف الحقيقة فورًا.
  const tickY = H - mm(7);
  g.lineWidth = 2;
  for (let x = 0; x <= widthMm; x += 10) {
    const px = mm(x);
    g.fillRect(Math.min(px, W - 2), tickY, 2, mm(4));
    if (x > 0 && x < widthMm) {
      g.font = `${mm(2.6)}px monospace`;
      g.textAlign = "center"; g.textBaseline = "top";
      g.fillText(String(x), px, tickY + mm(4.2));
    }
  }
  g.font = `bold ${mm(3.4)}px monospace`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(`${widthMm}x${heightMm} @${dpi}dpi`, W / 2, H / 2 - mm(2));
  return c;
}

export { buildCalibrationCanvas };
