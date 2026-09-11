import React, { useState } from "react";
import { Check, ChevronLeft, Folder } from "lucide-react";
import { ROLES } from "../core/constants.js";
import { MENU_GROUPS, NAV_BUNDLES, NAV_REGISTRY } from "../core/navigation.js";
import { normalizeRoleLayout } from "../core/stores.js";
import { inputStyle, normalizeName } from "../domain/helpers.js";
import { Card } from "../ui/Card.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function NavCustomizePage({ navLayout, menuOrder, customGroups = [], onSave, onSaveOrder, onSaveGroups, onBack, flashToast }) {
  const [activeRole, setActiveRole] = useState("manager");
  const [tab, setTab] = useState("bar");
  const [newGroupName, setNewGroupName] = useState("");
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState("");

  // ⚠ الأدوار تُقرأ من `ROLES` لا تُكتب هنا ثانيةً: القائمتان تتباعدان
  // مع أول دور يُضاف، فيظهر في الصلاحيات ولا يظهر في نموذج الإضافة.
  const roleOptions = [
    { id: "manager", label: "المدير" },
    { id: "assistant", label: "نائب المدير" },
    { id: "scrap_buyer", label: ROLES.scrap_buyer.label, hint: ROLES.scrap_buyer.hint },
    { id: "scrap_officer", label: ROLES.scrap_officer.label, hint: ROLES.scrap_officer.hint },
    { id: "employee", label: "موظف" },
  ];

  const layout = normalizeRoleLayout(navLayout[activeRole]);
  const permittedIds = [
    // المجمّعات متاحة إن سُمح بأي صفحة داخلها
    ...NAV_BUNDLES.filter((b) =>
      b.items.some((x) => ROLES[activeRole].allowedTabs.includes(x) || ROLES[activeRole].allowedMore.includes(x))
    ).map((b) => b.id),
    ...ROLES[activeRole].allowedTabs.filter((id) => id !== "more"),
    ...ROLES[activeRole].allowedMore,
  ];
  const pinned = new Set([...layout.row1, ...layout.row2]);
  const rest = permittedIds.filter((id) => !pinned.has(id) && id !== "navCustomize");
  const itemById = (id) => NAV_REGISTRY.find((n) => n.id === id);

  // ⚠ الحفظ يبقي علامة الترحيل — إسقاطها يُعيد ملء الصف الثاني
  // ويلغي قرارك بإفراغه.
  const write = (next) =>
    onSave({ ...navLayout, _navVersion: 2, [activeRole]: { ...layout, ...next } });

  // ⚠ الصف الأول محدود بخمسة: أكثر منها يجعل الزر أصغر من أن يُلمس
  // بإبهام على جوال.
  const MAX_ROW = 5;

  const moveWithin = (row, id, dir) => {
    const arr = [...layout[row]];
    const i = arr.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    write({ [row]: arr });
  };

  const moveBetween = (id, from, to) => {
    if (to !== "menu" && layout[to].length >= MAX_ROW) return;
    const next = {};
    if (from !== "menu") next[from] = layout[from].filter((x) => x !== id);
    if (to !== "menu") next[to] = [...layout[to], id];
    write(next);
  };

  // ── ترتيب القائمة الجانبية ──
  const ord = menuOrder || { groups: [], items: {} };
  const orderedGroups = (() => {
    const rank = new Map((ord.groups || []).map((id, i) => [id, i]));
    return [...MENU_GROUPS].sort(
      (a, b) => (rank.has(a.id) ? rank.get(a.id) : 999) - (rank.has(b.id) ? rank.get(b.id) : 999)
    );
  })();
  const orderedItems = (g) => {
    const saved = ord.items?.[g.id];
    if (!Array.isArray(saved) || !saved.length) return g.items;
    const rank = new Map(saved.map((id, i) => [id, i]));
    return [...g.items].sort(
      (a, b) => (rank.has(a) ? rank.get(a) : 999) - (rank.has(b) ? rank.get(b) : 999)
    );
  };
  const moveGroup = (gid, dir) => {
    const arr = orderedGroups.map((g) => g.id);
    const i = arr.indexOf(gid);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onSaveOrder({ ...ord, groups: arr });
  };
  const moveItem = (gid, id, dir) => {
    const g = MENU_GROUPS.find((x) => x.id === gid);
    const arr = orderedItems(g).slice();
    const i = arr.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onSaveOrder({ ...ord, items: { ...(ord.items || {}), [gid]: arr } });
  };

  const Row = ({ id, label, children, muted }) => (
    <div
      className="flex items-center gap-2 py-2"
      style={{ borderBottom: "1px solid var(--line)" }}
    >
      <span style={{ color: muted ? "var(--text2)" : "var(--text)" }} className="text-xs flex-1">
        {label}
      </span>
      {children}
    </div>
  );

  const ArrowBtn = ({ dir, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center"
      style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: disabled ? "var(--bg)" : "var(--panel)",
        border: `1px solid ${disabled ? "var(--line)" : "var(--edge)"}`,
        color: disabled ? "var(--line)" : "var(--accentSoft)",
      }}
    >
      <ChevronLeft size={13} style={{ transform: dir < 0 ? "rotate(90deg)" : "rotate(-90deg)" }} />
    </button>
  );

  const Pill = ({ label, onClick, tone }) => (
    <button
      onClick={onClick}
      className="text-[10px] px-2 py-1 rounded-full whitespace-nowrap"
      style={
        tone === "gold"
          ? { background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }
          : { background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }
      }
    >
      {label}
    </button>
  );

  return (
    <div>
      <SubPageHeader title="تخصيص القائمة" onBack={onBack} />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { id: "bar", label: "الشريط السفلي" },
            { id: "menu", label: "القائمة الجانبية" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="py-2 rounded-xl text-xs font-bold"
              style={{
                background: tab === t.id ? "var(--accentBg)" : "var(--panel)",
                color: tab === t.id ? "var(--accent)" : "var(--text2)",
                border: "1px solid var(--line)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Card style={{ padding: 10, marginBottom: 12, border: "1px solid var(--goodLine)" }}>
          <p style={{ color: "var(--good)" }} className="text-[11px] flex items-center gap-1.5">
            <Check size={12} /> كل تغيير يُحفظ فورًا ويبقى في كل تشغيل
          </p>
        </Card>

        {/* ── الشريط السفلي ── */}
        {tab === "bar" && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {roleOptions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActiveRole(r.id)}
                  className="py-2 rounded-xl text-[11px] font-bold"
                  style={{
                    background: activeRole === r.id ? "var(--accentBg)" : "var(--panel)",
                    color: activeRole === r.id ? "var(--accent)" : "var(--text2)",
                    border: "1px solid var(--line)",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-1">
              الصف الأول — ظاهر دائمًا ({layout.row1.length}/{MAX_ROW})
            </p>
            <Card style={{ padding: 12, marginBottom: 12 }}>
              {layout.row1.length === 0 ? (
                <p style={{ color: "var(--text3)" }} className="text-[11px]">فارغ</p>
              ) : (
                layout.row1.map((id, i) => (
                  <Row key={id} label={itemById(id)?.label || id}>
                    <ArrowBtn dir={-1} disabled={i === 0} onClick={() => moveWithin("row1", id, -1)} />
                    <ArrowBtn dir={1} disabled={i === layout.row1.length - 1} onClick={() => moveWithin("row1", id, 1)} />
                    <Pill label="↓ الثاني" onClick={() => moveBetween(id, "row1", "row2")} />
                    <Pill label="للقائمة" onClick={() => moveBetween(id, "row1", "menu")} />
                  </Row>
                ))
              )}
            </Card>

            <p style={{ color: "var(--accent)" }} className="text-xs font-bold mb-1">
              الصف الثاني — يُسحب لأعلى ({layout.row2.length}/{MAX_ROW})
            </p>
            <Card style={{ padding: 12, marginBottom: 12 }}>
              <p style={{ color: "var(--text3)" }} className="text-[10px] mb-2">
                يظهر بسحب الشريط لأعلى أو بضغط المقبض. اتركه فارغًا إن لم ترده.
              </p>
              {layout.row2.length === 0 ? (
                <p style={{ color: "var(--text3)" }} className="text-[11px]">فارغ</p>
              ) : (
                layout.row2.map((id, i) => (
                  <Row key={id} label={itemById(id)?.label || id}>
                    <ArrowBtn dir={-1} disabled={i === 0} onClick={() => moveWithin("row2", id, -1)} />
                    <ArrowBtn dir={1} disabled={i === layout.row2.length - 1} onClick={() => moveWithin("row2", id, 1)} />
                    <Pill label="↑ الأول" onClick={() => moveBetween(id, "row2", "row1")} tone={layout.row1.length < MAX_ROW ? "gold" : undefined} />
                    <Pill label="للقائمة" onClick={() => moveBetween(id, "row2", "menu")} />
                  </Row>
                ))
              )}
            </Card>

            <p style={{ color: "var(--text2)" }} className="text-xs mb-1">
              في القائمة الجانبية ({rest.length})
            </p>
            <Card style={{ padding: 12, marginBottom: 16 }}>
              {rest.length === 0 ? (
                <p style={{ color: "var(--text3)" }} className="text-[11px]">الكل مثبَّت في الشريط</p>
              ) : (
                rest.map((id) => (
                  <Row key={id} label={itemById(id)?.label || id} muted>
                    <Pill
                      label="الصف الأول"
                      tone={layout.row1.length < MAX_ROW ? "gold" : undefined}
                      onClick={() => layout.row1.length < MAX_ROW && moveBetween(id, "menu", "row1")}
                    />
                    <Pill
                      label="الصف الثاني"
                      tone={layout.row2.length < MAX_ROW ? "gold" : undefined}
                      onClick={() => layout.row2.length < MAX_ROW && moveBetween(id, "menu", "row2")}
                    />
                  </Row>
                ))
              )}
            </Card>
          </>
        )}

        {/* ── القائمة الجانبية ── */}
        {tab === "menu" && (
          <>
            <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">
              رتّب المجموعات وما بداخلها، وأنشئ قوائمك الخاصة. الترتيب يسري على كل الأدوار.
            </p>

            {/* قائمة جديدة */}
            <Card style={{ padding: 12, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">إنشاء قائمة</p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <input style={inputStyle} value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="اسم القائمة — مثال: أعمالي اليومية" />
                </div>
                <button
                  disabled={!newGroupName.trim()}
                  onClick={() => {
                    const name = newGroupName.trim();
                    if (customGroups.some((g) => normalizeName(g.label) === normalizeName(name))) {
                      flashToast("الاسم موجود مسبقًا");
                      return;
                    }
                    onSaveGroups([
                      ...customGroups,
                      { id: "grp_" + Math.random().toString(36).slice(2, 8), label: name, hint: "قائمة مخصصة", items: [] },
                    ]);
                    setNewGroupName("");
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap"
                  style={{
                    background: newGroupName.trim() ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
                    color: newGroupName.trim() ? "var(--panel)" : "var(--text3)",
                    marginBottom: 14,
                  }}
                >
                  إنشاء
                </button>
              </div>
              {customGroups.length > 0 && (
                <div className="mt-1">
                  {customGroups.map((g) => (
                    <div key={g.id} className="py-2" style={{ borderTop: "1px solid var(--line)" }}>
                      {renaming === g.id ? (
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <input style={inputStyle} value={renameVal} onChange={(e) => setRenameVal(e.target.value)} />
                          </div>
                          <button
                            onClick={() => {
                              const v = renameVal.trim();
                              if (v) onSaveGroups(customGroups.map((x) => (x.id === g.id ? { ...x, label: v } : x)));
                              setRenaming(null);
                            }}
                            className="px-3 py-2.5 rounded-xl text-[11px] font-bold"
                            style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)", marginBottom: 14 }}
                          >
                            حفظ
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Folder size={14} color="var(--accentText)" />
                          <span style={{ color: "var(--text)" }} className="text-xs font-bold flex-1">{g.label}</span>
                          <span style={{ color: "var(--text3)" }} className="text-[10px]">{(g.items || []).length} صفحة</span>
                          <button onClick={() => { setRenaming(g.id); setRenameVal(g.label); }}
                            className="text-[10px] px-2 py-1 rounded-full"
                            style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>
                            تسمية
                          </button>
                          <button
                            onClick={() => onSaveGroups(customGroups.filter((x) => x.id !== g.id))}
                            className="text-[10px] px-2 py-1 rounded-full"
                            style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
                          >
                            حذف
                          </button>
                        </div>
                      )}
                      {/* الصفحات داخل القائمة المخصصة */}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {NAV_REGISTRY.filter((n) => n.id !== "more" && n.id !== "navCustomize").map((n) => {
                          const on = (g.items || []).includes(n.id);
                          return (
                            <button
                              key={n.id}
                              onClick={() =>
                                onSaveGroups(
                                  customGroups.map((x) =>
                                    x.id === g.id
                                      ? { ...x, items: on ? x.items.filter((i) => i !== n.id) : [...(x.items || []), n.id] }
                                      : x
                                  )
                                )
                              }
                              className="text-[10px] px-2 py-1 rounded-full"
                              style={{
                                background: on ? "var(--accentBg)" : "var(--bg)",
                                color: on ? "var(--accent)" : "var(--text3)",
                                border: `1px solid ${on ? "var(--accentLine)" : "var(--line)"}`,
                              }}
                            >
                              {n.label}
                            </button>
                          );
                        })}
                      </div>
                      <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
                        الصفحة المختارة تنتقل لهذه القائمة وتُزال من مكانها الافتراضي.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            {orderedGroups.map((g, gi) => {
              const GIcon = g.icon;
              return (
                <Card key={g.id} style={{ padding: 12, marginBottom: 10 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <GIcon size={16} color="var(--accentText)" />
                    <span style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold flex-1">
                      {g.label}
                    </span>
                    <ArrowBtn dir={-1} disabled={gi === 0} onClick={() => moveGroup(g.id, -1)} />
                    <ArrowBtn dir={1} disabled={gi === orderedGroups.length - 1} onClick={() => moveGroup(g.id, 1)} />
                  </div>
                  {orderedItems(g).map((id, ii, arr) => (
                    <div
                      key={id}
                      className="flex items-center gap-2 py-1.5"
                      style={{ borderTop: "1px solid var(--line)" }}
                    >
                      <span style={{ color: "var(--text2)" }} className="text-[11px] flex-1">
                        {itemById(id)?.label || id}
                      </span>
                      <ArrowBtn dir={-1} disabled={ii === 0} onClick={() => moveItem(g.id, id, -1)} />
                      <ArrowBtn dir={1} disabled={ii === arr.length - 1} onClick={() => moveItem(g.id, id, 1)} />
                    </div>
                  ))}
                </Card>
              );
            })}

            <button
              onClick={() => onSaveOrder({ groups: [], items: {} })}
              className="w-full py-2.5 rounded-xl text-xs font-bold mb-4"
              style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
            >
              إرجاع الترتيب الافتراضي
            </button>
          </>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// الخدمة الصوتية للمساعد الذكي.
//
// تعتمد على واجهات المتصفح مباشرة (SpeechRecognition و speechSynthesis) بلا
// أي حزمة خارجية. الدعم غير مضمون في كل المتصفحات، ولا في كل الإطارات
// المضمّنة، لذا يكشف الخطّاف التوافر أولًا ويخفي الأزرار عند غيابه بدل أن
// يعرض زرًا لا يعمل.
// ───────────────────────────────────────────────────────────────

export { NavCustomizePage };
