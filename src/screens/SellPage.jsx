import React from "react";
import { Plus, Receipt, Scale } from "lucide-react";

function SellPage({ onNew, onPartialSale }) {
  return (
    <div className="px-4 pt-6 flex flex-col items-center justify-center" style={{ minHeight: "70vh" }}>
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: "radial-gradient(circle at 32% 28%, var(--gradFrom) 0%, var(--accentSoft) 45%, #7A5A2E 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Receipt size={36} color="var(--panel)" />
      </div>
      <h1 style={{ fontFamily: "'Cairo', sans-serif", color: "var(--text)" }} className="text-xl font-extrabold mb-2">
        بيع
      </h1>
      <p style={{ color: "var(--text2)" }} className="text-sm text-center mb-8 px-6">
        ابدأ فاتورة بيع جديدة واختر الأصناف من المخزون
      </p>
      <button
        onClick={onNew}
        className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-base"
        style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
      >
        <Plus size={20} /> فاتورة بيع جديدة
      </button>
      {onPartialSale && (
        <button
          onClick={onPartialSale}
          className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm mt-3"
          style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
        >
          <Scale size={18} /> بيع بالوزن
          <span style={{ color: "var(--text3)" }} className="text-[11px] font-normal">
            سبائك وأصناف تُقتطع
          </span>
        </button>
      )}
    </div>
  );
}

export { SellPage };
