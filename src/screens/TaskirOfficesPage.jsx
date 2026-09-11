import React, { useMemo, useState } from "react";
import { Building2, ChevronLeft, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { KARATS, fine24, fmt, fmtMoney, fmtW, roundW } from "../core/money.js";
import { exportTablesPdf, inputStyle } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function TaskirOfficesPage({
  offices = [], officeTx = [], suppliers = [], currency, price24 = 0,
  branchName, canManage, onSettle, onAddOffice, onBack, flashToast,
}) {
  const [pick, setPick] = useState(null);
  const [form, setForm] = useState(null);   // { officeId, mode, weight, karat, amount, source }
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);

  // ── حساب كل مكتب ──
  const build = (o) => {
    const tx = officeTx.filter((t) => t.officeId === o.id);
    // debit = علينا للمكتب · credit = سدّدناه
    const owed = tx.reduce((a, t) => {
      const w = fine24(t.weight, t.karat || 24);
      return a + (t.type === "debit" ? w : -w);
    }, 0);
    const cashPaid = tx.filter((t) => t.kind === "cash")
      .reduce((a, t) => a + (Number(t.amount) || 0), 0);
    return {
      office: o, tx: [...tx].sort((a, b) => String(b.date).localeCompare(String(a.date))),
      owed: roundW(owed), cashPaid,
      count: tx.length,
    };
  };

  const all = useMemo(() => offices.map(build).sort((a, b) => b.owed - a.owed),
    [offices, officeTx]);
  const A = pick ? all.find((x) => x.office.id === pick) : null;
  const totalOwed = all.reduce((a, x) => a + x.owed, 0);

  const cell = { border: "1px solid var(--line)", padding: "5px 6px", fontSize: 11 };
  const head = { ...cell, background: "var(--panel)", color: "var(--accent)", fontWeight: 700, textAlign: "center" };

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const sum = [["دفتر مكاتب التسكير"], [], ["المكتب", "علينا (جم24)", "حركات"]];
    all.forEach((x) => sum.push([x.office.name, fmtW(x.owed), x.count]));
    sum.push([], ["الإجمالي", fmtW(totalOwed), ""]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), "الملخّص");
    all.forEach((x) => {
      if (!x.tx.length) return;
      const r = [[x.office.name], [],
        ["المرجع", "التاريخ", "النوع", "الوزن (جم24)", `النقد (${currency})`, "لصالح", "ملاحظة"]];
      x.tx.forEach((t) =>
        r.push([t.ref || "", String(t.date).slice(0, 10),
          t.type === "debit" ? "علينا" : "سدّدنا",
          t.weight ? fmtW(fine24(t.weight, t.karat || 24)) : "",
          t.amount ? fmtMoney(t.amount) : "", t.supplierName || "", t.note || ""]));
      r.push([], ["الرصيد", "", "", fmtW(x.owed), "", "", ""]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r), x.office.name.slice(0, 28));
    });
    XLSX.writeFile(wb, `مكاتب_التسكير_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPdf = () =>
    exportTablesPdf({
      title: "دفتر مكاتب التسكير",
      subtitle: `علينا ${fmtW(totalOwed)} جم عيار 24`,
      branchName,
      onBlocked: flashToast,
      sections: (A ? [A] : all).map((x) => ({
        title: `${x.office.name} — الرصيد ${fmtW(x.owed)} جم24`,
        headers: ["المرجع", "التاريخ", "النوع", "الوزن (جم24)", `النقد (${currency})`, "لصالح"],
        rows: x.tx.map((t) => [
          t.ref || "", String(t.date).slice(0, 10),
          t.type === "debit" ? "علينا" : "سدّدنا",
          t.weight ? fmtW(fine24(t.weight, t.karat || 24)) : "",
          t.amount ? fmtMoney(t.amount) : "", t.supplierName || "",
        ]),
        note: "⚖ الالتزام بعيار 24 — المكاتب تتعامل بالصافي لا بالعيار.",
      })),
    });

  return (
    <div>
      <SubPageHeader
        title={A ? A.office.name : "مكاتب التسكير"}
        onBack={A ? () => setPick(null) : onBack}
      />
      <div className="px-4 pt-3">
        {!A ? (
          <>
            <Card style={{ padding: 12, marginBottom: 12 }}>
              <div className="flex items-baseline justify-between">
                <span style={{ color: "var(--text2)" }} className="text-xs">علينا للمكاتب</span>
                <span style={{ color: totalOwed > 0.0005 ? "var(--accent)" : "var(--goodSolid)" }}
                  className="text-xl font-extrabold">
                  {fmtW(totalOwed)} جم
                </span>
              </div>
              <p style={{ color: "var(--text3)" }} className="text-[10px]">
                بعيار 24 · {price24 > 0 ? `يعادل ${currency}${fmt(totalOwed * price24, 0)}` : ""}
              </p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">
                ⚖ المكتب يسلّم الذهب للمورد نيابةً عنك، فينتقل التزامك إليه — لا يزول.
              </p>
            </Card>

            {canManage && (
              showNew ? (
                <Card style={{ padding: 12, marginBottom: 12 }}>
                  <Field label="اسم المكتب">
                    <input style={inputStyle} value={newName}
                      onChange={(e) => setNewName(e.target.value)} placeholder="مكتب…" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setShowNew(false); setNewName(""); }}
                      className="py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                      إلغاء
                    </button>
                    <button disabled={!newName.trim()}
                      onClick={() => { onAddOffice(newName.trim()); setShowNew(false); setNewName(""); }}
                      className="py-2.5 rounded-xl text-xs font-bold"
                      style={{
                        background: newName.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                        color: newName.trim() ? "var(--panel)" : "var(--text3)",
                      }}>
                      حفظ
                    </button>
                  </div>
                </Card>
              ) : (
                <button onClick={() => setShowNew(true)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold mb-3"
                  style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                  + مكتب جديد
                </button>
              )
            )}

            {all.length === 0 ? (
              <EmptyState icon={<Building2 size={30} color="var(--accentText)" />} title="لا مكاتب" sub="" />
            ) : (
              <div className="flex flex-col gap-2">
                {all.map((x) => (
                  <button key={x.office.id} onClick={() => setPick(x.office.id)} className="w-full text-right">
                    <Card style={{ padding: 12, border: `1px solid ${x.owed > 0.0005 ? "var(--accentLine)" : "var(--line)"}` }}>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }}
                          className="text-sm font-bold flex-1">{x.office.name}</span>
                        <span style={{ color: x.owed > 0.0005 ? "var(--accent)" : "var(--accentLine)" }} className="text-xs">
                          {fmtW(x.owed)} جم24
                        </span>
                        <ChevronLeft size={15} color="var(--text3)" style={{ transform: "rotate(180deg)" }} />
                      </div>
                      <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                        {x.count} حركة{x.office.ref ? ` · ${x.office.ref}` : ""}
                      </p>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Card style={{ padding: 12, marginBottom: 12 }}>
              <div className="flex items-baseline justify-between">
                <span style={{ color: "var(--text2)" }} className="text-xs">الرصيد علينا</span>
                <span style={{ color: A.owed > 0.0005 ? "var(--accent)" : "var(--goodSolid)" }}
                  className="text-xl font-extrabold">{fmtW(A.owed)} جم24</span>
              </div>
              {A.owed > 0.0005 && price24 > 0 && (
                <p style={{ color: "var(--text3)" }} className="text-[10px]">
                  يعادل {currency}{fmt(A.owed * price24, 2)} بسعر اليوم
                </p>
              )}
            </Card>

            {/* السداد */}
            {canManage && A.owed > 0.0005 && (
              form?.officeId === A.office.id ? (
                <Card style={{ padding: 13, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
                  <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">
                    سداد المكتب
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {[
                      { id: "gold", label: "ذهبًا", hint: "من الخزنة" },
                      { id: "cash", label: "نقدًا", hint: "بسعر اليوم" },
                    ].map((o) => (
                      <button key={o.id} onClick={() => setForm((f) => ({ ...f, mode: o.id }))}
                        className="py-2.5 rounded-xl text-xs font-bold"
                        style={{
                          background: form.mode === o.id ? "var(--accentBg)" : "var(--panel)",
                          color: form.mode === o.id ? "var(--accent)" : "var(--text2)",
                          border: "1px solid var(--line)",
                        }}>
                        {o.label}
                        <span style={{ color: "var(--text3)" }} className="block text-[9px]">{o.hint}</span>
                      </button>
                    ))}
                  </div>

                  {form.mode === "gold" ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="العيار">
                          <select style={inputStyle} value={form.karat}
                            onChange={(e) => setForm((f) => ({ ...f, karat: Number(e.target.value) }))}>
                            {KARATS.map((k) => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </Field>
                        <Field label="الوزن (جم)">
                          <NumericInput value={form.weight}
                            onChange={(v) => setForm((f) => ({ ...f, weight: v }))} placeholder="0.000" />
                        </Field>
                      </div>
                      <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
                        يعادل {fmtW(fine24(Number(form.weight) || 0, form.karat))} جم24
                        {" · "}يبقى {fmtW(Math.max(0, A.owed - fine24(Number(form.weight) || 0, form.karat)))} جم24
                      </p>
                    </>
                  ) : (
                    <>
                      <Field label={`المبلغ (${currency})`}>
                        <NumericInput value={form.amount}
                          onChange={(v) => setForm((f) => ({ ...f, amount: v }))}
                          placeholder={fmtMoney(A.owed * price24)} />
                      </Field>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {[
                          { id: "safe_cash", label: "الخزنة نقدي" },
                          { id: "safe_network", label: "الخزنة شبكة" },
                        ].map((o) => (
                          <button key={o.id} onClick={() => setForm((f) => ({ ...f, source: o.id }))}
                            className="py-2 rounded-xl text-[11px] font-bold"
                            style={{
                              background: form.source === o.id ? "var(--accentBg)" : "var(--panel)",
                              color: form.source === o.id ? "var(--accent)" : "var(--text2)",
                              border: "1px solid var(--line)",
                            }}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                      <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
                        ⚖ يُخصم بما يعادله ذهبًا بسعر اليوم:
                        {" "}{fmtW(price24 > 0 ? (Number(form.amount) || 0) / price24 : 0)} جم24
                      </p>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setForm(null)}
                      className="py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                      إلغاء
                    </button>
                    <button
                      disabled={
                        form.mode === "gold"
                          ? !(Number(form.weight) > 0)
                          : !(Number(form.amount) > 0 && price24 > 0)
                      }
                      onClick={() => { onSettle(A.office.id, form); setForm(null); }}
                      className="py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
                      تثبيت السداد
                    </button>
                  </div>
                </Card>
              ) : (
                <button
                  onClick={() => setForm({
                    officeId: A.office.id, mode: "gold", karat: 21,
                    weight: "", amount: "", source: "safe_cash",
                  })}
                  className="w-full py-2.5 rounded-xl text-xs font-bold mb-3"
                  style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
                  سداد المكتب
                </button>
              )
            )}

            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
              الحركات ({A.tx.length})
            </p>
            {A.tx.length === 0 ? (
              <Card style={{ padding: 11 }}>
                <p style={{ color: "var(--text3)" }} className="text-[11px]">لا حركات</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {A.tx.map((t) => (
                  <Card key={t.id} style={{ padding: 10 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "var(--accentText)", fontFamily: "monospace" }} className="text-[10px]">
                        {t.ref || "—"}
                      </span>
                      <span style={{ color: "var(--text)" }} className="text-xs flex-1">
                        {t.type === "debit" ? "علينا" : "سدّدنا"}
                        {t.supplierName ? ` · ${t.supplierName}` : ""}
                      </span>
                      {t.weight > 0 && (
                        <span style={{ color: t.type === "debit" ? "var(--bad)" : "var(--goodSolid)" }}
                          className="text-[11px] font-bold">
                          {t.type === "debit" ? "+" : "−"}{fmtW(fine24(t.weight, t.karat || 24))} جم
                        </span>
                      )}
                      {t.amount > 0 && t.kind === "cash" && (
                        <span style={{ color: "var(--text2)" }} className="text-[11px]">
                          {currency}{fmtMoney(t.amount)}
                        </span>
                      )}
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">
                      {new Date(t.date).toLocaleDateString("en-GB")}
                      {t.note ? ` · ${t.note}` : ""}
                      {t.createdBy ? ` · ${t.createdBy}` : ""}
                    </p>
                    {t.rawLines?.length > 1 && (
                      <p style={{ color: "var(--text3)" }} className="text-[10px]">
                        ⚖ محوَّل من {t.rawLines.map((r) => `${fmtW(r.weight)} ع${r.karat}`).join(" · ")}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={exportXlsx}
            className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: "var(--goodBg)", color: "var(--good)", border: "1px solid var(--goodLine)" }}>
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button onClick={exportPdf}
            className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
            <FileText size={14} /> PDF
          </button>
        </div>
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ============================================================
// شاشة استرجاع المبيعات
//
// الشاشة لا تحسب شيئًا: تستدعي `findSoldUnit` و`computeReturnAmounts`
// و`validateReturnRequest`، وتعرض ما يُعيدنه. المنطق مُختبَرٌ بلا متصفح.
// ============================================================

export { TaskirOfficesPage };
