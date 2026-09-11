import React, { useEffect, useMemo, useRef, useState } from "react";
import { PackageMinus, X } from "lucide-react";
import { ISSUE_REASONS } from "../core/constants.js";
import { fine24, fmtMoney, fmtW, roundW, sumMoney } from "../core/money.js";
import { accountByCode } from "../domain/accountByCode.js";
import { inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function IssueOutPage({
  items = [], categories = [], currency, price24 = 0, role, appMode,
  onIssue, onBack,
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState([]);      // [{itemId, code}]
  const [reasonId, setReasonId] = useState("damaged");
  const [note, setNote] = useState("");
  const [err, setErr] = useState([]);
  // ⚠ إصلاح حقيقي مع الربط: onIssue صار غير متزامن (ينادي الباك إند
  // فعليًا). نفس نمط الإصلاح المطبَّق في مودال البيع الجزئي وجرد الخزنة.
  const [submitting, setSubmitting] = useState(false);

  const scanRef = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => scanRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [picked.length]);

  const canIssue = role === "manager" || role === "assistant";
  const reason = ISSUE_REASONS.find((r) => r.id === reasonId);

  // كل وحدة غير مباعة
  //
  // ⚠ إضافة حقيقية مع الربط: id (معرّف item_unit في قاعدة البيانات) لم
  // يكن يُمرَّر هنا سابقًا لأن الشاشة كانت محلية بالكامل ولا تحتاجه —
  // الباك إند الآن يتطلّب unitIds فعلية (POST /inventory/issue-out)، لا
  // مجرد code، فأصبح تمريره ضروريًا لإتمام الطلب.
  const units = useMemo(() => {
    const out = [];
    (items || []).forEach((it) => {
      (it.units || []).forEach((u) => {
        if (u.sold || u.issued) return;
        out.push({
          id: u.id, itemId: it.id, code: u.code,
          karat: it.karat, weight: Number(it.weight) || 0,
          categoryId: it.categoryId,
          cost: (Number(it.costPerGram) || 0) * (Number(it.weight) || 0)
                + (Number(it.lotWorkmanshipShare) || 0),
        });
      });
    });
    return out;
  }, [items]);

  const found = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return units.filter((u) => String(u.code || "").toUpperCase().includes(q)).slice(0, 8);
  }, [query, units]);

  const add = (u) => {
    if (picked.some((p) => p.code === u.code)) {
      setErr([`${u.code} مُضافة سلفًا`]);
      return;
    }
    setPicked((p) => [...p, u]);
    setQuery("");
    setErr([]);
  };

  const totals = useMemo(() => {
    const w = picked.reduce((a, u) => a + u.weight, 0);
    return {
      count: picked.length,
      weight: roundW(w),
      fine: picked.reduce((a, u) => a + fine24(u.weight, u.karat), 0),
      cost: sumMoney(picked, (u) => u.cost),
      byKarat: picked.reduce((m, u) => {
        m[u.karat] = roundW((m[u.karat] || 0) + u.weight);
        return m;
      }, {}),
    };
  }, [picked]);

  const submit = async () => {
    if (!canIssue) { setErr(["الإخراج يحتاج صلاحية المدير"]); return; }
    if (!picked.length) { setErr(["اختر قطعة واحدة على الأقل"]); return; }
    if (!reason) { setErr(["اختر السبب"]); return; }
    setSubmitting(true);
    try {
      const res = await onIssue({ units: picked, reasonId, note, totals });
      if (res?.ok) { setPicked([]); setNote(""); setErr([]); }
      else setErr(res?.errors || ["تعذّر الإخراج"]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <SubPageHeader title="إخراج قطع من النظام" onBack={onBack} />
      <div className="px-4 pt-3">

        <Card style={{ padding: 12, marginBottom: 10 }}>
          <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">
            امسح الملصق أو اكتب الرمز
          </p>
          <input
            ref={scanRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && found[0]) add(found[0]); }}
            placeholder="رمز القطعة"
            style={inputStyle}
          />
          {found.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-2">
              {found.map((u) => (
                <button key={u.code} onClick={() => add(u)}
                  className="w-full text-right rounded-xl px-3 py-2"
                  style={{ background: "var(--field)", border: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--text)", fontFamily: "monospace" }}
                    className="text-[11px]">{u.code}</span>
                  <span style={{ color: "var(--text2)" }} className="text-[11px]">
                    {" "}· عيار {u.karat} · {fmtW(u.weight)} جم
                  </span>
                </button>
              ))}
            </div>
          )}
          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1.5">
            ⚖ غير المباع فقط — القطعة المباعة تُرجَع بمرتجع لا بإخراج.
          </p>
        </Card>

        {err.length > 0 && (
          <Card style={{ padding: 11, marginBottom: 10, border: "1px solid var(--badLine)" }}>
            {err.map((e, i) => (
              <p key={i} style={{ color: "var(--bad)" }} className="text-[11px]">⚠ {e}</p>
            ))}
          </Card>
        )}

        {picked.length > 0 && (
          <>
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
              المختارة ({picked.length})
            </p>
            <div className="flex flex-col gap-1.5 mb-3">
              {picked.map((u) => (
                <Card key={u.code} style={{ padding: 10 }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--text)", fontFamily: "monospace" }}
                      className="text-[11px] flex-1">{u.code}</span>
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">
                      عيار {u.karat} · {fmtW(u.weight)} جم
                    </span>
                    <button onClick={() => setPicked((p) => p.filter((x) => x.code !== u.code))}>
                      <X size={14} color="var(--text3)" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>

            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
              سبب الإخراج
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {ISSUE_REASONS.map((r) => {
                const on = r.id === reasonId;
                return (
                  <button key={r.id} onClick={() => setReasonId(r.id)}
                    className="text-right rounded-xl p-2.5"
                    style={{
                      background: on ? "var(--accentBg)" : "var(--field)",
                      border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`,
                    }}>
                    <p style={{ color: on ? "var(--accent)" : "var(--text)", margin: 0 }}
                      className="text-[11px] font-bold">{r.label}</p>
                    <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px]">
                      {r.hint}
                    </p>
                  </button>
                );
              })}
            </div>

            <Field label="ملاحظة (اختياري)">
              <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>

            <Card style={{ padding: 12, marginBottom: 12 }}>
              <div className="flex items-baseline justify-between">
                <span style={{ color: "var(--text2)" }} className="text-[11px]">
                  الوزن الخارج
                </span>
                <span style={{ color: "var(--accent)" }} className="text-base font-extrabold">
                  {fmtW(totals.weight)} جم
                </span>
              </div>
              <p style={{ color: "var(--text3)" }} className="text-[10px]">
                {Object.entries(totals.byKarat)
                  .map(([k, w]) => `${fmtW(w)} ع${k}`).join(" · ")}
                {" · "}معادل {fmtW(totals.fine)} جم24
              </p>
              <div className="flex items-baseline justify-between mt-1 pt-1"
                style={{ borderTop: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text2)" }} className="text-[11px]">
                  التكلفة الدفترية
                </span>
                <span style={{ color: "var(--bad)" }} className="text-xs font-bold">
                  {currency}{fmtMoney(totals.cost)}
                </span>
              </div>
              {reason && (
                <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                  ⚖ تُقيَّد على {reason.account} — {accountByCode(reason.account)?.name || ""}
                </p>
              )}
            </Card>

            <button
              onClick={submit}
              disabled={!canIssue || submitting}
              className="w-full py-3 rounded-xl text-sm font-bold mb-6"
              style={{
                background: canIssue
                  ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--field)",
                color: canIssue ? "var(--panel)" : "var(--text3)",
              }}
            >
              {submitting ? "جارٍ التنفيذ..." : canIssue ? `أخرِج ${picked.length} قطعة` : "الإخراج يحتاج صلاحية المدير"}
            </button>
          </>
        )}

        {picked.length === 0 && (
          <EmptyState
            icon={<PackageMinus size={30} color="var(--accentSoft)" />}
            title="لا قطع مختارة"
            sub="امسح الملصق أو اكتب الرمز"
          />
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  ورقة الكيان
//
//  ⚠ كل كيان جذرُ شجرته: القطعة والعميل والمورد والفاتورة. وما يخصّه
//  يُفتح من مكانه لا من شاشةٍ أخرى.
//
//  قِستُ التدفّق القديم: القطعة ← رجوع ← «تعديل القطع» ← ابحث عنها ←
//  اخترها = خمس نقرات، ويفقد البائع سياقه مرتين. والزبونة تنتظر.
//
//  والورقة تُبقيه حيث هو: يضغط القطعة فتنفتح بكل ما يخصّها.
//
//  ومكوّنٌ واحد لكل الكيانات: `ENTITY_KINDS` تصف ماذا يُعرض ولمن،
//  والورقة تقرأها. إضافة كيان جديد سطرٌ في الوصف لا شاشةٌ جديدة.
// ═══════════════════════════════════════════════════════════════════════

/// وصف كل كيان: تبويباته وأفعاله ومن يراها.
///
/// ⚠ الأفعال تُعلَن هنا لا تُكتب في كل شاشة: تكرارها يجعل «طباعة»
/// تعمل في شاشة ولا تعمل في أخرى، ولا أحد يعرف لماذا.

export { IssueOutPage };
