import React, { useEffect, useState } from "react";
import { AlertTriangle, History, Plus, QrCode as QrIcon, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { fmt } from "../core/money.js";
import { MAIN_TAB_IDS } from "../core/navigation.js";
import { inputStyle, normalizeName, toLatinDigits } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

// ⚠ حُوِّلت للباك إند: كل فعل هنا الآن ينادي نقطة نهايته الخاصة (راجع
// users.routes.js) بدل "onSave(nextUsers)" الذي كان يستبدل مصفوفة
// المستخدمين المحلية كاملة. الباك إند لا يُرجع رقم PIN ولا حتى تجزئته
// إطلاقًا (أمنيًا) — فتحقّق "الرقم مكرر" لم يعد ممكنًا محليًا، ويظهر فقط
// بعد رفض الخادم الفعلي (409 pin_taken). نفس الأمر لعرض الرقم السري في
// بطاقة كل موظف: u.pin لم يعد موجودًا في الحالة المحلية إطلاقًا — كان
// ‌`{"•".repeat(u.pin.length)}` سيرمي خطأ فورًا (u.pin === undefined)، فصار
// عرضًا ثابتًا بلا اعتماد على طول فعلي.
function AccessSettingsPage({ users, navRegistry = [], roles = {}, currentUserId = null, onAddUser, onRenameUser, onToggleAi, onSetPermissions: setPermsRaw, onRemoveUser, onEnroll = null, onFetchLog = null, onBack, staffByHq = false, onFetchActionsMeta = null, onSetActions = null }) {
  // الأفعال التي يفرضها الخادم ومنع كل دورٍ وما أغلقته الإدارة — لاستثناءات الشخص فوق دوره
  const [actMeta, setActMeta] = useState(null);
  useEffect(() => {
    if (!onFetchActionsMeta) return undefined;
    let live = true;
    onFetchActionsMeta().then((m) => { if (live) setActMeta(m); }).catch(() => {});
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ⚠ فرعٌ مرتبطٌ بالإدارة لا يمنح صلاحيات ولا يضيف موظفين ولا يحذفهم — الإدارة تفعل (والخادم يرفض)
  const STAFF_BY_HQ_MSG = "إضافة الموظفين وصلاحياتهم وحذفهم من الإدارة المركزية — اطلبها منها.";
  const onSetPermissions = (...a) => { if (staffByHq) { setGuardMsg(STAFF_BY_HQ_MSG); return; } setPermsRaw(...a); };
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("employee");
  const [salary, setSalary] = useState("");
  const [permUser, setPermUser] = useState(null); // المستخدم قيد تعديل صلاحياته
  const [renaming, setRenaming] = useState(null);
  const [newName, setNewName] = useState("");
  const [guardMsg, setGuardMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const nameTaken = users.some((u) => normalizeName(u.name) === normalizeName(name));
  const valid = name.trim() && /^\d{4,6}$/.test(pin) && !nameTaken;

  const add = async () => {
    setSubmitting(true);
    try {
      const ok = await onAddUser({ name, pin, role, salary });
      if (ok) {
        setName("");
        setPin("");
        setSalary("");
        setShowAdd(false);
      }
    } finally {
      setSubmitting(false);
    }
  };
  /// فتح أدوات الذكاء لمستخدمٍ بعينه أو إغلاقها.
  ///
  /// ⚠ لكل مستخدم لا لكل دور: منحُها للدور يفتحها لكل من يحمله،
  /// ومنحُها للشخص قرارٌ يُتّخذ في كل حالة ويُسجَّل باسمه.
  const toggleAi = (u) => onToggleAi(u.id, !u.canUseAi);

  const remove = (id) => {
    if (staffByHq) { setGuardMsg(STAFF_BY_HQ_MSG); return; }
    if (users.filter((u) => u.role === "manager").length <= 1 && users.find((u) => u.id === id)?.role === "manager") return;
    onRemoveUser(id);
  };
  const rename = async (id) => {
    if (!newName.trim()) return;
    const ok = await onRenameUser(id, newName);
    if (ok) {
      setRenaming(null);
      setNewName("");
    }
  };
  // القائمة الفعلية لمستخدم: المخصّصة إن وُجدت، وإلا افتراضي دوره.
  const currentAllowed = (u) => {
    if (Array.isArray(u.allowedPages)) return u.allowedPages;
    const base = roles[u.role];
    if (!base) return [];
    return [...base.allowedTabs.filter((x) => x !== "more"), ...base.allowedMore];
  };

  // الفعل لهذا الشخص: الإدارة تغلب كل شيء، ثم استثناؤه، ثم دوره
  const actionState = (u, a) => {
    if ((actMeta?.hqDeny?.[u.role] || []).includes(a)) return { on: false, why: "hq" };
    if ((u.actionRevoke || []).includes(a)) return { on: false, why: "revoke" };
    if ((u.actionGrant || []).includes(a)) return { on: true, why: "grant" };
    return { on: !(actMeta?.roleDeny?.[u.role] || []).includes(a), why: "role" };
  };
  const toggleAction = (u, a) => {
    if (staffByHq) { setGuardMsg(STAFF_BY_HQ_MSG); return; }
    const st = actionState(u, a);
    if (st.why === "hq") { setGuardMsg("هذا الفعل مقفل من الإدارة المركزية لهذا الدور — لا يُمنح من الفرع."); return; }
    const byRole = !(actMeta?.roleDeny?.[u.role] || []).includes(a);
    const grant = new Set(u.actionGrant || []), revoke = new Set(u.actionRevoke || []);
    grant.delete(a); revoke.delete(a);
    // القلب يعكس الحالة: ما يسمح به الدور يُغلق استثناءً، وما يمنعه يُمنح استثناءً، والعودة للدور تمحو الاستثناء
    if (st.on && byRole) revoke.add(a);
    if (!st.on && !byRole) grant.add(a);
    setGuardMsg("");
    onSetActions?.(u.id, [...grant], [...revoke]);
  };
  // تنبيهٌ لا منع: من يفحص الكسر ويعتمد فحصه، أو يُدخل البضاعة ويُخرجها، بلا رقيبٍ ثانٍ
  const SOD_PAIRS = [
    { pair: ["assessScrap", "approveScrap"], why: "يفحص الكسر ويعتمد فحصه بنفسه" },
    { pair: ["addGoods", "issueOut"], why: "يُدخل البضاعة ويُخرجها من النظام" },
    { pair: ["purchase", "safeMove"], why: "يشتري ويدفع من الخزنة بنفسه" },
  ];
  const sodOf = (u) => (actMeta && u.role !== "manager" ? SOD_PAIRS.filter((x) => x.pair.every((a) => actionState(u, a).on)) : []);

  const togglePage = (id, pageId) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    const cur = currentAllowed(target);
    const turningOff = cur.includes(pageId);

    // حارس ضد قفل النظام: لا يجوز إزالة صفحة الصلاحيات من آخر من يملكها،
    // وإلا فقد أحد القدرة على تعديل أي صلاحية إلى الأبد. الباك إند يطبّق
    // نفس الحارس فعليًا (wouldLockOutAccess) — هذا فقط لتفادي طلب مرفوض
    // مؤكَّد ولإظهار الرسالة فورًا بلا انتظار الشبكة.
    if (turningOff && pageId === "access") {
      const stillHave = users.filter((u) => u.id !== id && currentAllowed(u).includes("access"));
      if (stillHave.length === 0) {
        setGuardMsg("لا يمكن إزالة «صلاحيات الوصول» من آخر مستخدم يملكها — سيتعذّر تعديل أي صلاحية بعدها.");
        return;
      }
    }
    setGuardMsg("");
    const next = turningOff ? cur.filter((x) => x !== pageId) : [...cur, pageId];
    onSetPermissions(id, next);
  };

  const resetToRole = (id) => {
    setGuardMsg("");
    onSetPermissions(id, null);
  };

  if (permUser) {
    const u = users.find((x) => x.id === permUser);
    if (!u) return null;
    const allowed = currentAllowed(u);
    const customized = Array.isArray(u.allowedPages);
    const pages = navRegistry.filter((n) => n.id !== "more");
    const mainPages = pages.filter((n) => MAIN_TAB_IDS.includes(n.id));
    const morePages = pages.filter((n) => !MAIN_TAB_IDS.includes(n.id));

    const Group = ({ title, list }) => (
      <>
        <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-2 mt-3">
          {title}
        </p>
        <div className="flex flex-col gap-2">
          {list.map((pg) => {
            const on = allowed.includes(pg.id);
            const Icon = pg.icon;
            return (
              <Card key={pg.id} style={{ padding: 10 }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {Icon && <Icon size={15} color={on ? "var(--accent)" : "var(--text3)"} />}
                    <span style={{ color: on ? "var(--text)" : "var(--text2)" }} className="text-sm">
                      {pg.label}
                    </span>
                  </span>
                  <button
                    onClick={() => togglePage(u.id, pg.id)}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: on ? "var(--goodSolid)" : "var(--edge)",
                      position: "relative",
                      transition: "background .2s",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--text)",
                        position: "absolute",
                        top: 3,
                        right: on ? 23 : 3,
                        transition: "right .2s",
                      }}
                    />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </>
    );

    return (
      <div>
        <SubPageHeader title={`صلاحيات ${u.name}`} onBack={() => setPermUser(null)} />
        <div className="px-4 pt-3">
          <Card style={{ padding: 12, marginBottom: 10 }}>
            <p style={{ color: "var(--text)" }} className="text-sm font-bold">
              {u.name}
              {u.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{u.ref}</span>}
            </p>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mt-0.5">
              {roles[u.role]?.label} · {allowed.length} من {pages.length} صفحة مفعّلة
              {customized ? " · مخصّصة" : " · افتراضي الدور"}
            </p>
          </Card>

          <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
            شغّل أو أوقف أي صفحة لهذا الموظف تحديدًا. التغيير يسري فور دخوله برقمه السري.
          </p>

          {guardMsg && (
            <Card style={{ padding: 10, marginBottom: 10, border: "1px solid var(--badLine)" }}>
              <p style={{ color: "var(--bad)" }} className="text-[11px] flex items-start gap-1">
                <AlertTriangle size={12} style={{ marginTop: 1, flexShrink: 0 }} /> {guardMsg}
              </p>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2 mb-1">
            <button
              onClick={() => {
                setGuardMsg("");
                onSetPermissions(u.id, pages.map((pg) => pg.id));
              }}
              className="py-2 rounded-xl text-[11px] font-bold"
              style={{ background: "var(--panel)", color: "var(--good)", border: "1px solid var(--goodLine)" }}
            >
              تفعيل الكل
            </button>
            <button
              onClick={() => resetToRole(u.id)}
              className="py-2 rounded-xl text-[11px] font-bold"
              style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
            >
              إرجاع افتراضي الدور
            </button>
          </div>

          <Group title="الصفحات الأساسية (الشريط السفلي)" list={mainPages} />
          <Group title="صفحات المزيد" list={morePages} />

          {/* ── الأفعال: ما يفعله داخل الشاشات — استثناءٌ لهذا الشخص فوق دوره، والخادم يفرضه ── */}
          {actMeta && onSetActions && (
            <div data-user-actions>
              <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-1 mt-4">الأفعال — ما يفعله داخل الشاشات</p>
              <p style={{ color: "var(--text3)" }} className="text-[11px] mb-2">
                المضاء = يفعلها. «+» مُنح له فوق دوره · «−» أُغلق عنه · 🔒 أغلقته الإدارة المركزية. اضغط الفعل لتقلبه، وضغطةٌ ثانية تعيده لدوره.
              </p>
              {sodOf(u).length > 0 && (
                <p data-sod-warn style={{ color: "var(--bad)" }} className="text-[11px] font-bold mb-2">
                  ⚠ يجمع مهامًّا متعارضة: {sodOf(u).map((x) => x.why).join(" · ")} — تنبيهٌ لا منع، إن اضطررتَ فاعلم ما قبلت.
                </p>
              )}
              {Object.entries(actMeta.groups || {}).map(([g, gl]) => (
                <div key={g} className="mb-2">
                  <p style={{ color: "var(--text2)" }} className="text-[11px] font-bold mb-1">{gl}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(actMeta.actions || []).filter((a) => a.group === g).map((a) => {
                      const st = actionState(u, a.id);
                      return (
                        <button key={a.id} type="button" data-user-action={a.id} aria-pressed={st.on} onClick={() => toggleAction(u, a.id)}
                          className="text-[11px] px-2.5 rounded-full font-bold"
                          style={{ minHeight: 32, opacity: st.why === "hq" ? 0.5 : 1,
                            background: st.on ? "var(--accentBg)" : "var(--field)", color: st.on ? "var(--accent)" : "var(--text3)",
                            border: `1px solid ${st.why === "grant" || st.why === "revoke" ? "var(--accent)" : "var(--line)"}` }}>
                          {st.why === "hq" ? "🔒 " : st.why === "grant" ? "+ " : st.why === "revoke" ? "− " : ""}{a.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ height: 24 }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SubPageHeader title="صلاحيات الوصول" onBack={onBack} />
      <div className="px-4 pt-3">
        <p style={{ color: "var(--text2)" }} className="text-xs mb-3">
          كل موظف برقم سري خاص. كل عملية يقوم بها تُحفظ باسمه — البيع والشراء والصرف والجرد.
        </p>

        {staffByHq ? (
          <Card style={{ padding: 12, marginBottom: 16, border: "1px solid var(--accentLine)" }} data-staff-by-hq>
            <p style={{ color: "var(--accentText)", margin: 0 }} className="text-[12px] font-bold">🔒 {STAFF_BY_HQ_MSG}</p>
          </Card>
        ) : !showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-4"
            style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
          >
            <Plus size={18} /> إضافة موظف
          </button>
        ) : (
          <Card style={{ padding: 14, marginBottom: 16 }}>
            <Field label="الاسم">
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="الرقم السري (4-6 أرقام)">
              <input style={inputStyle} value={pin} onChange={(e) => setPin(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 6))} inputMode="numeric" />
            </Field>
            <Field label="الراتب الشهري (اختياري)">
              <NumericInput value={salary} onChange={setSalary} placeholder="0" />
            </Field>
            <Field label="الصلاحية">
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(roles).map(([id, r]) => (
                  <button
                    key={id}
                    onClick={() => setRole(id)}
                    className="py-2 rounded-xl text-[11px] font-bold"
                    style={{ background: role === id ? "var(--accentBg)" : "var(--panel)", color: role === id ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </Field>
            {nameTaken && name.trim() && (
              <p style={{ color: "var(--bad)" }} className="text-[11px] mb-2">يوجد موظف بهذا الاسم</p>
            )}
            {/* ⚠ لم يعد يمكن التحقق من تكرار الرقم السري محليًا (الباك إند
                لا يُرجع أي رقم سري أو تجزئته إطلاقًا) — يظهر فقط بعد رفض
                الخادم الفعلي عبر flashToast (409 pin_taken). */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowAdd(false)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                إلغاء
              </button>
              <button
                disabled={!valid || submitting}
                onClick={add}
                className="py-2 rounded-xl text-xs font-bold"
                style={{ background: valid ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)", color: valid ? "var(--panel)" : "var(--text3)" }}
              >
                {submitting ? "جارٍ الإضافة..." : "إضافة"}
              </button>
            </div>
          </Card>
        )}

        <div className="flex flex-col gap-2">
          {users.map((u) => {
            const allowedCount = currentAllowed(u).length;
            const customized = Array.isArray(u.allowedPages);
            return (
              <Card key={u.id} style={{ padding: 12 }}>
                {renaming === u.id ? (
                  <>
                    <Field label="الاسم الجديد">
                      <input style={inputStyle} value={newName} onChange={(e) => setNewName(e.target.value)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setRenaming(null)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>
                        إلغاء
                      </button>
                      <button onClick={() => rename(u.id)} className="py-2 rounded-xl text-xs font-bold" style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}>
                        حفظ
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="font-bold text-sm">
                        {u.name}
                        {u.ref && <span style={{ color: "var(--text3)" }} className="text-[10px] mr-1">{u.ref}</span>}
                      </span>
                      <span style={{ color: "var(--text2)" }} className="text-[11px]">{roles[u.role]?.label}</span>
                    </div>
                    <p style={{ color: "var(--text3)" }} className="text-[11px] mt-0.5">
                      •••• · {allowedCount} صفحة
                      {customized ? " (مخصّصة)" : ""}
                      {(u.actionGrant || []).length ? ` · + ${(u.actionGrant || []).length} فعل` : ""}
                      {(u.actionRevoke || []).length ? ` · − ${(u.actionRevoke || []).length} فعل` : ""}
                      {u.salary > 0 ? ` · راتب ${fmt(u.salary, 0)}` : ""}
                    </p>
                    {u.mustChangePin && (
                      <p data-default-pin={u.id} style={{ color: "var(--bad)", margin: "2px 0 0" }} className="text-[11px] font-bold">⚠ رقمه السري ما زال الرقم الجاهز — يُطلب منه تغييره عند أول دخول</p>
                    )}
                    {sodOf(u).length > 0 && (
                      <p style={{ color: "var(--bad)", margin: "2px 0 0" }} className="text-[11px]">⚠ يجمع مهامًّا متعارضة: {sodOf(u).map((x) => x.why).join(" · ")}</p>
                    )}
                    {/* ── أدوات الذكاء ── */}
                    {u.role !== "manager" && (
                      <button
                        onClick={() => toggleAi(u)}
                        className="w-full flex items-center gap-2 mt-2 px-2.5 py-2 rounded-xl"
                        style={{
                          background: u.canUseAi ? "var(--accentBg)" : "var(--field)",
                          border: `1px solid ${u.canUseAi ? "var(--accentLine)" : "var(--line)"}`,
                        }}
                      >
                        <span
                          style={{
                            width: 34, height: 19, borderRadius: 10, flexShrink: 0,
                            background: u.canUseAi ? "var(--accent)" : "var(--edge)",
                            position: "relative", transition: "background .2s",
                          }}
                        >
                          <span style={{
                            position: "absolute", top: 2,
                            [u.canUseAi ? "left" : "right"]: 2,
                            width: 15, height: 15, borderRadius: "50%",
                            background: "var(--panel)", transition: "all .2s",
                          }} />
                        </span>
                        <span
                          style={{ color: u.canUseAi ? "var(--accent)" : "var(--text2)" }}
                          className="text-[11px] font-bold flex-1 text-right"
                        >
                          أدوات الذكاء {u.canUseAi ? "مفتوحة" : "مغلقة"}
                        </span>
                        <Sparkles size={13} color={u.canUseAi ? "var(--accent)" : "var(--text3)"} />
                      </button>
                    )}
                    {u.canUseAi && u.role !== "manager" && (
                      <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                        ⚠ يرى ما تسمح به صفحاته فقط — لكنه يجمعه في إجابةٍ واحدة.
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setPermUser(u.id)}
                        className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1"
                        style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
                      >
                        <ShieldCheck size={11} /> الصلاحيات
                      </button>
                      {onEnroll && (u.role !== "manager" || u.id === currentUserId) && (
                        <button
                          onClick={() => onEnroll(u)}
                          className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1"
                          style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
                        >
                          <QrIcon size={11} /> ربط جهاز
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setRenaming(u.id);
                          setNewName(u.name);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-full"
                        style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}
                      >
                        تغيير الاسم
                      </button>
                      {users.length > 1 && (
                        <button onClick={() => remove(u.id)} style={{ color: "var(--bad)", marginRight: "auto" }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>

        {/* ── سجل الصلاحيات: من منح من ماذا ومتى — الفرق لا الحالة ── */}
        {onFetchLog && (
          <>
            <button onClick={() => setShowLog((v) => !v)}
              className="w-full mt-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              style={{ background: showLog ? "var(--accentBg)" : "var(--panel)", color: "var(--accent)", border: "1px solid var(--line)" }}>
              <History size={14} /> {showLog ? "إخفاء سجل الصلاحيات" : "سجل الصلاحيات"}
            </button>
            {showLog && <PermissionLog onFetch={onFetchLog} registry={navRegistry} roles={roles} />}
          </>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

const PERM_KINDS = {
  create: "أُضيف", delete: "حُذف", role: "تغيّر دوره", pages: "تغيّرت صفحاته", reset: "أُعيد لافتراضي الدور",
  ai: "أدوات الذكاء", rename: "تغيّر اسمه", enroll: "ربط جهاز", actions: "استثناء أفعال",
};

/// سجلّ التدقيق يحفظ **ما فُعل**، وهذا يحفظ **من صار يستطيع فعله** — والسؤال
/// الذي يُسأل بعد كل اختلاس: «من أعطى فلانًا هذه الصلاحية ومتى؟»
function PermissionLog({ onFetch, registry = [], roles = {} }) {
  const [log, setLog] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    onFetch().then((r) => { if (live) setLog(r || []); }).catch(() => { if (live) setErr("تعذّر تحميل السجل"); });
    return () => { live = false; };
  }, []);
  const label = (id) => registry.find((n) => n.id === id)?.label || id;
  if (err) return <p style={{ color: "var(--bad)" }} className="text-[11px] mt-2">⚠ {err}</p>;
  if (!log) return <p style={{ color: "var(--text3)" }} className="text-[11px] mt-2">جارٍ التحميل…</p>;
  if (!log.length) return <p style={{ color: "var(--text3)" }} className="text-[11px] mt-2">لا تغييرات مسجّلة بعد.</p>;
  const detail = (x) => {
    if (x.kind === "ai") return x.after?.canUseAi ? "فُتحت" : "أُغلقت";
    if (x.kind === "rename") return `${x.before?.name || ""} ← ${x.after?.name || ""}`;
    if (x.kind === "create") return roles[x.after?.role]?.label || x.after?.role || "";
    if (x.kind === "enroll") return x.byKind === "self" ? "ربطه الموظّف ووضع رقمه" : "أُصدر رمز ربط";
    if (x.kind === "actions") return [(x.after?.grant || []).length && `مُنح: ${x.after.grant.join("، ")}`, (x.after?.revoke || []).length && `أُغلق: ${x.after.revoke.join("، ")}`].filter(Boolean).join(" · ") || "أُعيد لدوره";
    const parts = [];
    if ((x.added || []).length) parts.push(`مُنح: ${x.added.map(label).join("، ")}`);
    if ((x.removed || []).length) parts.push(`سُحب: ${x.removed.map(label).join("، ")}`);
    return parts.join(" · ");
  };
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {log.map((x) => (
        <Card key={x.id} style={{ padding: 10 }}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--panel)", color: x.kind === "delete" || x.kind === "role" ? "var(--bad)" : "var(--accent)", border: "1px solid var(--line)" }}>
              {PERM_KINDS[x.kind] || x.kind}
            </span>
            <span style={{ color: "var(--text)" }} className="text-xs font-bold flex-1">{x.target || "—"}</span>
          </div>
          {detail(x) && <p style={{ color: "var(--text2)" }} className="text-[11px] mt-1">{detail(x)}</p>}
          <p style={{ color: "var(--text3)" }} className="text-[10px] mt-0.5">{x.by || "—"}{x.byKind === "hq" ? " (الإدارة)" : ""} · {new Date(x.date).toLocaleString("en-GB")}</p>
        </Card>
      ))}
    </div>
  );
}

export { AccessSettingsPage };
