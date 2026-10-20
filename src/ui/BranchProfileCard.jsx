import React, { useState } from "react";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "./Card.jsx";
import { DocHeader } from "./DocHeader.jsx";
import { Field } from "./Field.jsx";

/// يُصغّر صورة الشعار إلى 256 بكسل (PNG) — كي لا تُثقل كل تحميل
function shrinkLogo(file, max = 256) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("تعذّرت قراءة الصورة"));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("ليست صورةً صالحة"));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/// معلومات الفرع ورأس المستندات: الاسم والسجلّ التجاري والرقم الضريبي والعنوان والشعار — تظهر على الفواتير والسندات والكشوف.
/// المدير يحفظها ما لم تقفلها الإدارة من «تجهيز الفرع».
function BranchProfileCard({ profile = {}, branchCode = "", locked = false, canEdit = false, onSave }) {
  const [bp, setBp] = useState(() => ({ ...profile }));
  const [msg, setMsg] = useState("");
  const setB = (k, v) => setBp((p) => ({ ...p, [k]: v }));
  const vatOk = !bp.vatNumber || /^3\d{13}3$/.test(bp.vatNumber);
  const crOk = !bp.crNumber || /^\d{10}$/.test(bp.crNumber);
  const ro = locked || !canEdit;
  const preview = { name: bp.storeName || "", legalName: bp.legalName, cr: bp.crNumber, vat: bp.vatNumber, no: bp.branchNo || branchCode, address: bp.address, city: bp.city, phone: bp.phone, email: bp.email, logo: bp.logoDataUrl };
  const save = async () => {
    if (!vatOk || !crOk) { setMsg("صحّح الأرقام أوّلًا"); return; }
    const ok = await onSave(bp);
    setMsg(ok ? "✓ حُفظت معلومات الفرع" : "");
  };
  const inp = (k, ph, extra = {}) => (
    <input style={{ ...inputStyle, ...(extra.style || {}) }} value={bp[k] || ""} placeholder={ph} disabled={ro} inputMode={extra.inputMode}
      onChange={(e) => setB(k, extra.clean ? extra.clean(e.target.value) : e.target.value)} />
  );
  return (
    <div data-branch-profile>
      <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">معلومات الفرع</p>
      <Card style={{ padding: 12, marginBottom: 12, border: `1px solid ${preview.vat && preview.cr ? "var(--goodLine)" : "var(--accentLine)"}` }}>
        {locked && <p style={{ color: "var(--accentText)", margin: "0 0 8px" }} className="text-[11px]">🔒 الإدارة ثبّتت معلومات الفرع — تُعدَّل من «تجهيز الفرع» في المركزي.</p>}
        <div className="flex items-center gap-3 mb-3">
          <label style={{ width: 64, height: 64, borderRadius: 12, background: "var(--field)", border: "1px dashed var(--accentLine)", display: "grid", placeItems: "center", cursor: ro ? "default" : "pointer", overflow: "hidden", flexShrink: 0 }}>
            {bp.logoDataUrl ? <img src={bp.logoDataUrl} alt="الشعار" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <span style={{ color: "var(--text3)", fontSize: 10, textAlign: "center" }}>الشعار<br />اضغط</span>}
            {!ro && <input type="file" accept="image/*" style={{ display: "none" }}
              onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setB("logoDataUrl", await shrinkLogo(f)); } catch (er) { setMsg(String(er.message)); } }} />}
          </label>
          <div className="flex-1">
            <p style={{ color: "var(--text2)", margin: 0 }} className="text-[11px] font-bold">الشعار</p>
            <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[10px] leading-5">يظهر على الفواتير والسندات والكشوف. يُصغَّر تلقائيًّا إلى 256 بكسل.</p>
            {bp.logoDataUrl && !ro && <button onClick={() => setB("logoDataUrl", null)} className="text-[10px] mt-1" style={{ color: "var(--bad)" }}>أزل الشعار</button>}
          </div>
        </div>
        <Field label="اسم المحل التجاري">{inp("storeName", "مجوهرات النور")}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="رقم الفرع">{inp("branchNo", branchCode || "01")}</Field>
          <Field label="اسم مدير الفرع">{inp("managerName", "ناصر")}</Field>
        </div>
        <Field label="الاسم النظامي (كما في السجلّ) — اختياري">{inp("legalName", "مؤسسة النور للذهب والمجوهرات")}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="السجلّ التجاري (10 أرقام)">{inp("crNumber", "1010XXXXXX", { inputMode: "numeric", clean: (v) => v.replace(/\D/g, "").slice(0, 10), style: { direction: "ltr", textAlign: "center", borderColor: crOk ? undefined : "var(--bad)" } })}</Field>
          <Field label="الرقم الضريبي (15 رقمًا)">{inp("vatNumber", "3XXXXXXXXXXXXX3", { inputMode: "numeric", clean: (v) => v.replace(/\D/g, "").slice(0, 15), style: { direction: "ltr", textAlign: "center", borderColor: vatOk ? undefined : "var(--bad)" } })}</Field>
        </div>
        {(!vatOk || !crOk) && <p style={{ color: "var(--bad)", margin: "0 0 6px" }} className="text-[10px]">{!vatOk ? "الرقم الضريبي 15 رقمًا يبدأ وينتهي بـ3. " : ""}{!crOk ? "السجلّ التجاري 10 أرقام." : ""}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Field label="الهاتف">{inp("phone", "05XXXXXXXX", { inputMode: "tel" })}</Field>
          <Field label="البريد الإلكتروني">{inp("email", "info@...", { inputMode: "email" })}</Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="المدينة">{inp("city", "مكة المكرمة")}</Field>
          <Field label="العنوان">{inp("address", "سوق الذهب — محل 12")}</Field>
        </div>
        <Field label="سطرٌ أسفل المستندات — اختياري">{inp("footerNote", "شكرًا لتعاملكم معنا")}</Field>
        <p style={{ color: "var(--text3)", margin: "6px 0 4px" }} className="text-[10px]">معاينة رأس المستند:</p>
        <div style={{ background: "#fff", borderRadius: 8, padding: "8px 10px" }} data-doc-preview>
          <DocHeader info={preview} title="فاتورة" sub="معاينة" compact />
        </div>
        {!ro && (
          <button onClick={save} data-branch-profile-save className="w-full mt-3 py-2.5 rounded-xl text-[12px] font-bold"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>احفظ معلومات الفرع</button>
        )}
        {msg && <p style={{ color: msg.startsWith("✓") ? "var(--good)" : "var(--bad)", margin: "6px 0 0" }} className="text-[11px]">{msg}</p>}
        {!(preview.vat && preview.cr) && <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[10px]">⚠ الرقم الضريبي والسجلّ التجاري إلزاميّان على الفاتورة النظاميّة.</p>}
      </Card>
    </div>
  );
}

export { BranchProfileCard, shrinkLogo };
