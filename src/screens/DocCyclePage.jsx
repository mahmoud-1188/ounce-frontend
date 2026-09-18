import React, { useMemo, useState } from "react";
import { DOC_CYCLE, DOC_REFS } from "../core/constants.js";
import { exportTablesPdf, inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function DocCyclePage({ branchName = "", preparedBy = "", onBack }) {
  const [open, setOpen] = useState("principles");
  const [q, setQ] = useState("");

  // ⚠ البحث في المحتوى كلّه: من يبحث عن «عربون» لا يعرف أنه في فصل
  // المقبوضات، ويبحث بالكلمة لا بالفصل.
  const shown = useMemo(() => {
    const nq = q.trim();
    if (!nq) return DOC_CYCLE;
    return DOC_CYCLE.filter((c) => JSON.stringify(c).includes(nq));
  }, [q]);

  const exportPdf = () => exportTablesPdf({
    title: "الدورة المستندية — نظام أوقية",
    subtitle: `${branchName ? branchName + " · " : ""}${new Date().toISOString().slice(0, 10)}${preparedBy ? " · " + preparedBy : ""}`,
    branchName, landscape: false,
    sections: [
      ...DOC_CYCLE.map((c) => ({
        title: `${c.n} ${c.title}`,
        headers: ["البند", "التفصيل"],
        rows: [
          ...(c.when ? [["متى", c.when]] : []),
          ...(c.who ? [["من", c.who]] : []),
          ...(c.screen ? [["الشاشة", c.screen]] : []),
          ...(c.intro ? [["المبدأ", c.intro]] : []),
          ...(c.rules || []).map((r, i) => [`قاعدة ${i + 1}`, r]),
          ...(c.steps || []).map((x, i) => [`خطوة ${i + 1}`, x]),
          ...(c.entries || []).map((e) => [e.t, `مدين: ${e.d.join(" · ")} / دائن: ${e.c.join(" · ")}`]),
          ...(c.warn ? [["⚠ تنبيه", c.warn]] : []),
          ...(c.report ? [["الكشف", c.report]] : []),
        ],
      })),
      { title: "جدول المستندات والمراجع", headers: ["المستند", "المرجع", "الكشف"], rows: DOC_REFS },
    ],
  });

  return (
    <div>
      <SubPageHeader title="الدورة المستندية" onBack={onBack} />
      <div className="px-4 pt-3">
        <Card style={{ padding: 11, marginBottom: 8, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
            ⚠ كل حركةٍ تُنتج ثلاثة أشياء: <b>مستندًا بمرجعٍ فريد، وقيدًا نقديًّا، وقيدًا وزنيًّا</b>
            حين يتحرّك ذهب. من نقص أحدها فالحركة ناقصة — ولن يُطابق الميزان.
          </p>
        </Card>
        <button onClick={exportPdf} className="w-full py-2.5 rounded-xl text-[12px] font-bold mb-3"
          style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
          صدّر الدليل كاملًا — PDF
        </button>
        <input style={{ ...inputStyle, marginBottom: 10 }} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث في الدليل — عربون · جرد · إقفال · عهدة" />
        {q && <p style={{ color: "var(--text3)", margin: "-6px 0 8px" }} className="text-[10px]">{shown.length} فصلًا</p>}

        {shown.map((c) => {
          const isOpen = open === c.id;
          return (
            <div key={c.id}>
              <button onClick={() => setOpen(isOpen ? null : c.id)} className="w-full text-right">
                <Card style={{ padding: 11, marginBottom: 4,
                  border: isOpen ? "1px solid var(--accentLine)" : "1px solid var(--line)" }}>
                  <div className="flex items-baseline gap-2">
                    <span style={{ color: "var(--accent)" }} className="text-[13px] font-black">{c.n}</span>
                    <span style={{ color: "var(--text)" }} className="text-[12px] font-bold flex-1">{c.title}</span>
                    <span style={{ color: "var(--text3)" }} className="text-[10px]">{isOpen ? "▲" : "▼"}</span>
                  </div>
                  {!isOpen && c.screen && (
                    <p style={{ color: "var(--text3)", margin: "2px 0 0" }} className="text-[10px]">{c.screen}</p>
                  )}
                </Card>
              </button>
              {isOpen && (
                <Card style={{ padding: 12, marginBottom: 8, background: "var(--bg)" }}>
                  {c.intro && (
                    <p style={{ color: "var(--text2)", margin: "0 0 8px" }} className="text-[10px] leading-7">{c.intro}</p>
                  )}
                  {(c.when || c.who || c.screen) && (
                    <div className="mb-2">
                      {[["متى", c.when], ["من", c.who], ["الشاشة", c.screen]].filter(([, v]) => v).map(([l, v]) => (
                        <div key={l} className="flex items-baseline gap-2 py-0.5">
                          <span style={{ color: "var(--text3)", minWidth: 40 }} className="text-[10px]">{l}</span>
                          <span style={{ color: "var(--text2)" }} className="text-[10px]">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {c.rules && (
                    <>
                      <p style={{ color: "var(--accentText)", margin: "0 0 3px" }} className="text-[10px] font-bold">القواعد</p>
                      {c.rules.map((r, i) => (
                        <p key={i} style={{ color: "var(--text2)", margin: "0 0 5px" }} className="text-[10px] leading-7">
                          <b style={{ color: "var(--accent)" }}>{i + 1}.</b> {r}
                        </p>
                      ))}
                    </>
                  )}
                  {c.steps && (
                    <>
                      <p style={{ color: "var(--accentText)", margin: "6px 0 3px" }} className="text-[10px] font-bold">الخطوات</p>
                      {c.steps.map((x, i) => (
                        <div key={i} className="flex items-baseline gap-2 py-0.5">
                          <span style={{ background: "var(--accentBg)", color: "var(--accent)", minWidth: 16, height: 16,
                            borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                            className="text-[9px] font-black">{i + 1}</span>
                          <span style={{ color: "var(--text2)" }} className="text-[10px] flex-1 leading-6">{x}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {c.entries && (
                    <>
                      <p style={{ color: "var(--accentText)", margin: "8px 0 3px" }} className="text-[10px] font-bold">القيود</p>
                      {c.entries.map((e, i) => (
                        <div key={i} style={{ borderTop: "1px solid var(--line)", paddingTop: 4, marginBottom: 4 }}>
                          <p style={{ color: "var(--text)", margin: "0 0 2px" }} className="text-[10px] font-bold">{e.t}</p>
                          {e.d.map((x) => (
                            <p key={x} style={{ color: "var(--good)", margin: 0 }} className="text-[10px]">مدين &nbsp; {x}</p>
                          ))}
                          {e.c.map((x) => (
                            <p key={x} style={{ color: "var(--bad)", margin: 0, paddingRight: 14 }} className="text-[10px]">دائن &nbsp; {x}</p>
                          ))}
                        </div>
                      ))}
                    </>
                  )}
                  {c.warn && (
                    <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10,
                      background: "var(--badBg)", border: "1px solid var(--badLine)" }}>
                      <p style={{ color: "var(--bad)", margin: 0 }} className="text-[10px] leading-7">⚠ {c.warn}</p>
                    </div>
                  )}
                  {c.report && (
                    <p style={{ color: "var(--text3)", margin: "6px 0 0" }} className="text-[10px]">
                      الكشف: {c.report}
                    </p>
                  )}
                </Card>
              )}
            </div>
          );
        })}

        <p style={{ color: "var(--accentText)", margin: "14px 0 6px" }} className="text-[11px] font-bold">
          جدول المستندات والمراجع
        </p>
        {DOC_REFS.map(([doc, ref, rep]) => (
          <Card key={ref} style={{ padding: 8, marginBottom: 3 }}>
            <div className="flex items-baseline gap-2">
              <span style={{ color: "var(--text)" }} className="text-[10px] font-bold" >{doc}</span>
              <span style={{ color: "var(--accentText)", fontFamily: "monospace", direction: "ltr" }} className="text-[10px]">{ref}</span>
              <span style={{ color: "var(--text3)", marginRight: "auto" }} className="text-[9px]">{rep}</span>
            </div>
          </Card>
        ))}
        <Card style={{ padding: 11, marginTop: 10 }}>
          <p style={{ color: "var(--text3)", margin: 0 }} className="text-[10px] leading-6">
            ⚠ هذا الدليل يصف النظام كما بُني. وأي اختلافٍ بينه وبين ما يفعله البرنامج
            <b> عطلٌ في أحدهما</b> — أبلغ به.
          </p>
        </Card>
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}


/// التبادل مع الأنظمة الأخرى.

export { DocCyclePage };
