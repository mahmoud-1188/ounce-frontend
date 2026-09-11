import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, Search } from "lucide-react";
import { INDEX_KINDS } from "../core/assistant.js";
import { fmt, fmtW } from "../core/money.js";
import { auditProvenance } from "../domain/auditProvenance.js";
import { inputStyle, useDebounced } from "../domain/helpers.js";
import { searchIndex } from "../domain/searchIndex.js";
import { traceRecord } from "../domain/traceRecord.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function UniversalSearchPage({ index, currency, onAsk, onBack }) {
  const [q, setQ] = useState("");
  const [kinds, setKinds] = useState([]);
  const [traced, setTraced] = useState(null);

  // ⚠ البحث على القيمة المؤخَّرة لا على كل ضغطة
  const qd = useDebounced(q, 220);
  const results = useMemo(
    () => (qd.trim() ? searchIndex(index, qd, { kinds, limit: 60 }) : []),
    [index, qd, kinds]
  );
  const searching = q.trim() !== qd.trim();
  // ⚠ تدقيق المصادر يمرّ على الفهرس كاملًا — يُبنى مرة لا مع كل حرف
  const audit = useMemo(() => auditProvenance(index), [index]);
  const trace = useMemo(() => (traced ? traceRecord(index, traced, 2) : null), [index, traced]);

  const counts = useMemo(() => {
    const c = {};
    index.forEach((r) => (c[r.kind] = (c[r.kind] || 0) + 1));
    return c;
  }, [index]);

  const KindChip = ({ kind }) => {
    const k = INDEX_KINDS[kind] || { label: kind, color: "var(--text2)" };
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap"
        style={{ background: "var(--panel)", color: k.color, border: "1px solid var(--line)" }}>
        {k.label}
      </span>
    );
  };

  const Row = ({ r, onTap }) => (
    <button onClick={onTap} className="w-full text-right">
      <Card style={{ padding: 11 }}>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--text)", fontFamily: "monospace" }} className="text-[11px] font-bold">
            {r.ref}
          </span>
          <KindChip kind={r.kind} />
          <span className="flex-1" />
          {r.amount > 0 && (
            <span style={{ color: "var(--text2)" }} className="text-[11px] whitespace-nowrap">
              {currency}{fmt(r.amount, 0)}
            </span>
          )}
          {r.fine > 0 && (
            <span style={{ color: "var(--accent)" }} className="text-[11px] whitespace-nowrap">
              {fmtW(r.fine)} جم
            </span>
          )}
        </div>
        <p style={{ color: "var(--text2)" }} className="text-[11px] mt-0.5">{r.summary}</p>
        <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
          {r.date ? new Date(r.date).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "—"}
          {r.who ? ` · ${r.who}` : ""}
          {r.day ? ` · ${r.day}` : ""}
          {r.account ? ` · حساب ${r.account}` : ""}
        </p>
      </Card>
    </button>
  );

  return (
    <div>
      <SubPageHeader title="البحث الشامل" onBack={onBack} />
      <div className="px-4 pt-3">
        {/* التتبّع */}
        {trace ? (
          <>
            <button onClick={() => setTraced(null)} className="flex items-center gap-2 mb-3"
              style={{ color: "var(--accentText)" }}>
              <ChevronLeft size={16} />
              <span className="text-xs font-bold">رجوع للبحث</span>
            </button>

            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2">السجل</p>
            <Card style={{ padding: 13, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: "var(--text)", fontFamily: "monospace" }} className="text-sm font-bold">
                  {trace.root.ref}
                </span>
                <KindChip kind={trace.root.kind} />
              </div>
              <p style={{ color: "var(--text)" }} className="text-xs">{trace.root.summary}</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  ["التاريخ", trace.root.date ? new Date(trace.root.date).toLocaleString("en-GB") : "—"],
                  ["بواسطة", trace.root.who || "—"],
                  ["المبلغ", trace.root.amount ? `${currency}${fmt(trace.root.amount, 2)}` : "—"],
                  ["الوزن", trace.root.fine ? `${fmtW(trace.root.fine)} جم24` : "—"],
                  ["الحساب", trace.root.account || "—"],
                  ["يوم العمل", trace.root.day || "—"],
                ].map(([l, v], i) => (
                  <div key={i}>
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">{l}</p>
                    <p style={{ color: "var(--text)", margin: 0 }} className="text-[11px]">{v}</p>
                  </div>
                ))}
              </div>
            </Card>

            {trace.parents.length > 0 && (
              <>
                <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
                  جاء من ({trace.parents.length})
                </p>
                <div className="flex flex-col gap-2 mb-3">
                  {trace.parents.map((r) => <Row key={r.id} r={r} onTap={() => setTraced(r.ref || r.id)} />)}
                </div>
              </>
            )}

            {trace.children.length > 0 && (
              <>
                <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
                  تفرّع عنه ({trace.children.length})
                </p>
                <div className="flex flex-col gap-2 mb-3">
                  {trace.children.map((r) => <Row key={r.id} r={r} onTap={() => setTraced(r.ref || r.id)} />)}
                </div>
              </>
            )}

            {trace.parents.length === 0 && trace.children.length === 0 && (
              <Card style={{ padding: 12, marginBottom: 12 }}>
                <p style={{ color: "var(--text2)" }} className="text-[11px]">
                  سجل مستقل — لا روابط له في الاتجاهين.
                </p>
              </Card>
            )}

            {!trace.weightOk && (
              <Card style={{ padding: 10, marginBottom: 12, border: "1px solid var(--badLine)" }}>
                <p style={{ color: "var(--bad)" }} className="text-[11px]">
                  ⚠ مجموع أوزان ما تفرّع يتجاوز وزن الأصل — راجع السلسلة.
                </p>
              </Card>
            )}

            {onAsk && (
              <button
                onClick={() => onAsk(`اشرح لي سلسلة السجل ${trace.root.ref}: ${trace.root.summary}`)}
                className="w-full py-2.5 rounded-xl text-xs font-bold mb-4"
                style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
              >
                اسأل المساعد عن هذه السلسلة
              </button>
            )}
          </>
        ) : (
          <>
            <Field label="ابحث بأي شيء">
              <input
                style={inputStyle}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="مرجع · اسم · مبلغ · وزن · تاريخ · عيار"
                autoFocus
              />
            </Field>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {Object.entries(INDEX_KINDS)
                .filter(([k]) => counts[k])
                .map(([k, v]) => {
                  const on = kinds.includes(k);
                  return (
                    <button key={k}
                      onClick={() => setKinds((p) => (on ? p.filter((x) => x !== k) : [...p, k]))}
                      className="text-[10px] px-2 py-1 rounded-full"
                      style={{
                        background: on ? "var(--accentBg)" : "var(--panel)",
                        color: on ? "var(--accent)" : "var(--text2)",
                        border: `1px solid ${on ? "var(--accentLine)" : "var(--edge)"}`,
                      }}>
                      {v.label} {counts[k]}
                    </button>
                  );
                })}
            </div>

            {!q.trim() ? (
              <>
                <Card style={{ padding: 12, marginBottom: 12 }}>
                  <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
                    {index.length} سجلًا مفهرسًا
                  </p>
                  <p style={{ color: "var(--text2)" }} className="text-[11px]">
                    اكتب أي حرف: رقم فاتورة · اسم عميل · مبلغ · وزن · تاريخ.
                    وكل نتيجة تفتح سلسلتها كاملة.
                  </p>
                </Card>

                <p style={{ color: "var(--text2)" }} className="text-xs mb-2">سلامة الروابط</p>
                <Card style={{ padding: 12, marginBottom: 12,
                  border: `1px solid ${audit.broken.length ? "var(--badLine)" : "var(--goodLine)"}` }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: audit.broken.length ? "var(--bad)" : "var(--goodSolid)" }}
                      className="text-xs font-bold flex items-center gap-1.5">
                      {audit.broken.length ? <AlertTriangle size={13} /> : <Check size={13} />}
                      {audit.broken.length ? `${audit.broken.length} رابط مكسور` : "كل الروابط سليمة"}
                    </span>
                  </div>
                  {audit.broken.slice(0, 5).map((b, i) => (
                    <p key={i} style={{ color: "var(--text2)" }} className="text-[10px] mt-1">
                      {b.ref} يشير إلى سجل مفقود
                    </p>
                  ))}
                  {audit.noSource.length > 0 && (
                    <p style={{ color: "var(--accentText)" }} className="text-[10px] mt-1">
                      {audit.noSource.length} حركة نقدية بلا تصنيف ولا مستند
                    </p>
                  )}
                </Card>

                <p style={{ color: "var(--text2)" }} className="text-xs mb-2">آخر الحركات</p>
                <div className="flex flex-col gap-2">
                  {index.slice(0, 12).map((r) => (
                    <Row key={r.id} r={r} onTap={() => setTraced(r.ref || r.id)} />
                  ))}
                </div>
              </>
            ) : results.length === 0 ? (
              <EmptyState icon={<Search size={30} color="var(--accentText)" />} title="لا نتائج"
                sub="جرّب مرجعًا أو اسمًا أو مبلغًا" />
            ) : (
              <>
                <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
                  {results.length} نتيجة
                </p>
                <div className="flex flex-col gap-2">
                  {results.map((r) => (
                    <Row key={r.id + r.kind} r={r} onTap={() => setTraced(r.ref || r.id)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// مطابقة إيداعات الشبكة مع البنك
// ============================================================

export { UniversalSearchPage };
