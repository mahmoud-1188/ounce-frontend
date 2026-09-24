import { EPC_EPOCH, M830 } from "../core/constants.js";

function buildPlateEpc({ code, storeId = 0, date = null }) {
  const b = new Uint8Array(M830.epcBytes);

  // ① الرمز — ثماني بايتات
  //
  // ⚠ يُقصّ عند ثمانية ولا يلتفّ: رمزٌ أطول يُزيح رقم المحل فيصير
  // جزءًا من الرمز — ورقاقةٌ تُنسب لمحلٍّ آخر.
  const c = String(code || "").toUpperCase().slice(0, 8);
  for (let i = 0; i < 8; i++) {
    const ch = i < c.length ? c.charCodeAt(i) : 0;
    b[i] = (ch >= 32 && ch <= 126) ? ch : 0;
  }

  // ② رقم المحل
  const sid = Math.max(0, Math.min(0xffff, Math.round(Number(storeId) || 0)));
  b[8] = (sid >>> 8) & 0xff; b[9] = sid & 0xff;

  // ③ تاريخ الكتابة — أيامٌ منذ 2020
  //
  // ⚠ للتشخيص لا للمحاسبة: «متى كُتبت هذه الرقاقة» يُجيب عن رقاقةٍ
  // أُعيد استعمالها أو قطعةٍ كُوّدت مرتين. والتاريخ المحاسبي في القاعدة.
  const t = new Date(date || Date.now()).getTime();
  const days = Number.isFinite(t)
    ? Math.max(0, Math.min(0xffff, Math.floor((t - EPC_EPOCH) / 86400000))) : 0;
  b[10] = (days >>> 8) & 0xff; b[11] = days & 0xff;

  // ⚠ اثنتا عشرة بايتًا بالضبط — بلا بايتٍ ضائع يُبثّ في كل مسحة.
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/// يفكّ لوحة التعريف.
///
/// ⚠ يقبل الرقائق القديمة التي تحمل البيانات: مخزونٌ كُوّد بالتصميم
/// السابق يبقى سنوات، **ورفضُه يجعل نصف الجرد «مجهولًا»**.

export { buildPlateEpc };
