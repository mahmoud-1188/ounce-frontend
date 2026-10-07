import { codeToEpcHex, printLabelToDevice } from "./helpers.js";
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

/// لوحة التعريف (الرمز + رقم المحل + التاريخ) تتّسع لرمزٍ من 8 خانات [A-Z2-9] فقط —
/// والرموز الأطول (ITM-000002) كانت تُقصّ إلى «ITM-0000» فتتطابق رقائق القطع كلّها ولا تُفكّ.
const fitsPlate = (code) => /^[A-Z2-9]{4,8}$/.test(String(code || "").toUpperCase());

/// رقم الرقاقة للقطعة: المحفوظ عليها إن وُجد، وإلا (لرمزٍ لا يتّسع للوحة) أوّل 96 بت من معرّفها الفريد
function unitEpcFor(unit, code) {
  if (unit?.epc) return { epc: String(unit.epc).toUpperCase(), bind: false };
  if (fitsPlate(code)) return { epc: null, bind: false };
  // رمزٌ حتى 12 حرفًا يُكتب نصًّا كما هو — والقارئ يطابقه بالرمز مباشرةً بلا حفظٍ على الخادم
  if (/^[\x20-\x7E]{1,12}$/.test(String(code || ""))) return { epc: codeToEpcHex(code), bind: false };
  const hex = String(unit?.id || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (hex.length < 24) throw new Error(`لا معرّف للقطعة ${code} — حدّث الصفحة ثم أعد`);
  return { epc: hex.slice(0, 24), bind: true };
}

/**
 * يطبع ملصقات القطع على طابعة الملصقات المضبوطة، ملصقًا ملصقًا.
 * units: [{ item, code }] — يُرجع عدد ما أُرسل، أو يرمي خطأً بالعربية عند أوّل فشل (وما قبله طُبع).
 */
async function printLabelsToDevice(units, { cfg, currency, price24, onRemember, onProgress, onBindEpc }) {
  const ref = cfg.transport === "usb" ? { current: null } : await ensureBluetooth(cfg);
  let sent = 0;
  for (const u of units) {
    let epcHex = null;
    if (cfg.rfid) {
      const unit = u.unit || (u.item?.units || []).find((x) => x.code === u.code);
      const r = unitEpcFor(unit, u.code);
      // ⚠ يُحفظ رقم الرقاقة على القطعة قبل الكتابة — وإلا قُرئت رقاقةٌ لا يعرفها التطبيق
      if (r.bind) {
        if (!onBindEpc) throw new Error("لا يمكن حفظ رقم الرقاقة على القطعة");
        const ok = await onBindEpc(unit.id, r.epc);
        if (!ok) throw new Error(`تعذّر حفظ رقم الرقاقة للقطعة ${u.code}`);
      }
      epcHex = r.epc;
    }
    await printLabelToDevice({ item: u.item, code: u.code, cfg, currency, price24, deviceRef: ref, onRemember, epcHex });
    sent += 1;
    onProgress?.(sent, units.length);
  }
  return sent;
}

/// «إعدادات الطابعة» تسجّل الجهاز عند الاقتران — فتطبع الشاشات الأخرى عليه بلا اختيارٍ جديد
const rememberBluetoothDevice = (device) => { btRef.current = device || null; };

export { fitsPlate, isLabelPrinter, printLabelsToDevice, rememberBluetoothDevice, unitEpcFor };
