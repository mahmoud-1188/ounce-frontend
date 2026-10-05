import { printLabelToDevice } from "./helpers.js";
import { PRINTER_SERVICES } from "../core/constants.js";

/// طابعة الملصقات المضبوطة (بلوتوث أو USB) — غير ذلك «طابعة النظام» عبر نافذة المتصفح
const isLabelPrinter = (cfg) => !!cfg && (cfg.mode === "bluetooth" || cfg.transport === "usb");

// جهاز البلوتوث يُحفظ للجلسة: الاقتران مرةً من «إعدادات الطابعة» ثم يُستعاد بلا مربّع اختيار
const btRef = { current: null };

async function ensureBluetooth(cfg) {
  if (btRef.current && (!cfg.deviceId || btRef.current.id === cfg.deviceId)) return btRef;
  if (!navigator.bluetooth) throw new Error("هذا المتصفح لا يدعم البلوتوث — استعمل كروم على أندرويد أو ويندوز");
  if (cfg.deviceId && navigator.bluetooth.getDevices) {
    const known = await navigator.bluetooth.getDevices();
    const match = known.find((d) => d.id === cfg.deviceId);
    if (match) { btRef.current = match; return btRef; }
  }
  // لم يُعثر على الاقتران المحفوظ — يُطلب اختيار الطابعة (ضغطة الطباعة نفسها تسمح بذلك)
  btRef.current = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
  return btRef;
}

/**
 * يطبع ملصقات القطع على طابعة الملصقات المضبوطة، ملصقًا ملصقًا.
 * units: [{ item, code }] — يُرجع عدد ما أُرسل، أو يرمي خطأً بالعربية عند أوّل فشل (وما قبله طُبع).
 */
async function printLabelsToDevice(units, { cfg, currency, price24, onRemember, onProgress }) {
  const ref = cfg.transport === "usb" ? { current: null } : await ensureBluetooth(cfg);
  let sent = 0;
  for (const u of units) {
    await printLabelToDevice({ item: u.item, code: u.code, cfg, currency, price24, deviceRef: ref, onRemember });
    sent += 1;
    onProgress?.(sent, units.length);
  }
  return sent;
}

/// «إعدادات الطابعة» تسجّل الجهاز عند الاقتران — فتطبع الشاشات الأخرى عليه بلا اختيارٍ جديد
const rememberBluetoothDevice = (device) => { btRef.current = device || null; };

export { isLabelPrinter, printLabelsToDevice, rememberBluetoothDevice };
