import React, { useState } from "react";
import { Camera, FileText, Loader2, Upload, X } from "lucide-react";
import { MAX_ATTACH_BYTES } from "../core/constants.js";
import { attachmentByteSize, compressImage, readFileAsDataUrl } from "../domain/helpers.js";
import { Field } from "./Field.jsx";

function InvoiceAttachField({ value, onChange, label = "فاتورة العملية", optional = false }) {
  const [attaching, setAttaching] = useState(false);
  const [sizeError, setSizeError] = useState("");
  const accept = (payload) => {
    const bytes = attachmentByteSize(payload.dataUrl);
    if (bytes > MAX_ATTACH_BYTES) {
      setSizeError(`حجم الملف كبير (${(bytes / 1024 / 1024).toFixed(1)} ميجا). الحد الأقصى 3.5 ميجا — صوّر الفاتورة بدل رفع الملف، أو اضغط الملف أولاً.`);
      return;
    }
    setSizeError("");
    onChange(payload);
  };
  const handlePhoto = async (file) => {
    if (!file) return;
    setAttaching(true);
    try {
      const dataUrl = await compressImage(file, 900, 0.7);
      accept({ dataUrl, name: file.name || "فاتورة.jpg", isImage: true });
    } catch (e) {
      console.error("invoice photo failed", e);
      setSizeError("تعذّرت معالجة الصورة، حاول مرة أخرى");
    } finally {
      setAttaching(false);
    }
  };
  const handleUpload = async (file) => {
    if (!file) return;
    setAttaching(true);
    try {
      // Images go through compression regardless of how they were picked, so an
      // uploaded photo can't blow past the size cap the way a raw file would.
      const isImg = (file.type || "").startsWith("image/");
      const dataUrl = isImg ? await compressImage(file, 900, 0.7) : await readFileAsDataUrl(file);
      accept({ dataUrl, name: file.name, isImage: isImg });
    } catch (e) {
      console.error("invoice upload failed", e);
      setSizeError("تعذّرت قراءة الملف، حاول مرة أخرى");
    } finally {
      setAttaching(false);
    }
  };
  return (
    <Field label={label}>
      {value ? (
        <div className="flex items-center gap-2 p-2 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
          {value.isImage ? (
            <img src={value.dataUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
          ) : (
            <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg)" }}>
              <FileText size={18} color="var(--accentText)" />
            </div>
          )}
          <span style={{ color: "var(--text)" }} className="text-xs flex-1 truncate">
            {value.name}
          </span>
          <button onClick={() => onChange(null)} style={{ color: "var(--bad)" }}>
            <X size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
              style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
            >
              {attaching ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              تصوير الفاتورة
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handlePhoto(e.target.files?.[0])} />
            </label>
            <label
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
              style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
            >
              {attaching ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              رفع ملف
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => handleUpload(e.target.files?.[0])} />
            </label>
          </div>
          <p style={{ color: sizeError ? "var(--bad)" : "var(--text3)" }} className="text-[11px] mt-1">
            {sizeError || (optional ? "يمكن إرفاقها لاحقًا من تقرير المورد" : "لا يمكن الحفظ بدون إرفاق صورة أو ملف")}
          </p>
        </>
      )}
    </Field>
  );
}

export { InvoiceAttachField };
