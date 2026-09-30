import { ArrowLeftRight, Banknote, FileText, Flame, Gem, Handshake, Package, PackageMinus, Printer, Receipt, RotateCcw, Scale, Search, Send, ShoppingCart, Truck, UserRound, Wrench } from "lucide-react";
import { fmtMoney, fmtW } from "../core/money.js";
import { SCRAP_STAGES } from "../core/workflow.js";
import { itemLabel } from "./helpers.js";
import { stageOf } from "./stageOf.js";

const ENTITY_KINDS = {
  item: {
    label: "قطعة",
    icon: Gem,
    title: (r) => itemLabel(r),
    subtitle: (r, ctx) =>
      `${fmtW(r.weight)} جم · ${(r.units || []).filter((u) => !u.sold && !u.issued).length} متاح`,
    tabs: ["info", "moves", "actions"],
  },
  customer: {
    label: "عميل",
    icon: UserRound,
    title: (r) => r.name || "—",
    subtitle: (r, ctx) => r.phone || r.ref || "",
    tabs: ["info", "moves", "statement", "actions"],
  },
  supplier: {
    label: "مورد",
    icon: Truck,
    title: (r) => r.name || "—",
    subtitle: (r) => r.phone || r.ref || "",
    tabs: ["info", "moves", "statement", "actions"],
  },
  sale: {
    label: "فاتورة",
    icon: Receipt,
    title: (r) => r.ref || "—",
    subtitle: (r, ctx) => `${(r.lines || []).length} سطرًا · ${ctx.currency}${fmtMoney(r.total)}`,
    tabs: ["info", "actions"],
  },
  scrap: {
    label: "كسر",
    icon: Flame,
    title: (r) => `${r.ref || ""} · عيار ${r.karat}`,
    subtitle: (r) => `${fmtW(r.weight)} جم · ${SCRAP_STAGES[stageOf(r)]?.label || ""}`,
    tabs: ["info", "actions"],
  },
};

const TAB_LABELS = {
  info: "البيانات",
  moves: "الحركات",
  statement: "كشف حساب",
  actions: "إجراءات",
};

/// شارة صغيرة — تُعاد في كل التبويبات.

/// أفعال الصفّ لكل كيان (المرجع): `page` الشاشة التي يفتحها — أو قائمةٌ يؤخذ أوّل ما يُفتح منها.
/// ⚠ الفعل يظهر فقط إن فُتحت شاشته لمن يجلس الآن: لا زرّ يظهر ثم يُرفض.
///   ويُعطَّل بسببٍ مكتوب لحالة البيانات وحدها (لا يوم مفتوح · لا وحدات · جردٌ جارٍ).
const ENTITY_ACTIONS = {
  item: [
    { id: "sell", label: "بيع هذه القطعة", icon: ShoppingCart, page: "sales", day: true, avail: true, noLock: true },
    { id: "edit", label: "تعديل البيانات", icon: Wrench, page: "itemEdit", mgr: true },
    { id: "print", label: "طباعة الملصق", icon: Printer, page: "printing" },
    { id: "send", label: "إرسال لفرع", icon: Send, page: "branchTransfers", mgr: true, avail: true },
    { id: "issue", label: "إخراج من النظام", icon: PackageMinus, page: "goldOut", mgr: true, avail: true, tone: "bad", hint: "بسبب مُعلَن — لا حذف" },
    { id: "trace", label: "تتبّع للمصدر", icon: Search, page: "search", hint: "الدفعة والمورد وتاريخ الدخول" },
  ],
  customer: [
    { id: "sell", label: "فاتورة له", icon: Receipt, page: "sales", day: true, noLock: true },
    { id: "receipt", label: "تحصيل", icon: Banknote, page: "customers", day: true },
    { id: "statement", label: "كشف حساب", icon: FileText, page: ["anyStatement", "customerReport"] },
    { id: "edit", label: "تعديل البيانات", icon: Wrench, page: "customers", mgr: true },
  ],
  supplier: [
    { id: "purchase", label: "دفعة شراء", icon: Truck, page: "purchases", mgr: true, day: true },
    { id: "settle", label: "سداد", icon: Handshake, page: "supplierLedger", mgr: true },
    { id: "statement", label: "كشف حساب", icon: FileText, page: ["anyStatement", "supplierLedger"] },
    { id: "edit", label: "تعديل البيانات", icon: Wrench, page: "suppliers", mgr: true },
  ],
  sale: [
    { id: "print", label: "طباعة الفاتورة", icon: Printer, page: null },
    { id: "return", label: "مرتجع", icon: RotateCcw, page: "salesReturn", tone: "bad", hint: "بسطرٍ أو بالفاتورة كاملة" },
    { id: "exchange", label: "استبدال", icon: ArrowLeftRight, page: "salesReturn" },
    { id: "customerStatement", label: "كشف العميل", icon: FileText, page: ["anyStatement", "customerReport"], needsCustomer: true },
    { id: "trace", label: "تتبّع الأسطر", icon: Search, page: "search" },
  ],
  scrap: [
    { id: "break", label: "تكسير وتثبيت الوزن", icon: Scale, page: "scrapCustody", mgr: true, stage: "pending_break" },
    { id: "convert", label: "إدخال للمخزون", icon: Package, page: "scrapCustody", mgr: true, stage: "in_safe", stageHint: "يحتاج التصفية أولًا" },
    { id: "trace", label: "تتبّع", icon: Search, page: "search" },
  ],
};

/// أفعال صفٍّ واحد لمن يجلس الآن.
function entityActionsSpec(kind, r, { pageOk = () => false, mgr = false, openDay = null, locked = false } = {}) {
  const out = [];
  for (const a of ENTITY_ACTIONS[kind] || []) {
    const pages = a.page == null ? [null] : [].concat(a.page);
    const target = pages.find((p) => p == null || pageOk(p));
    if (target === undefined) continue;
    if (a.mgr && !mgr) continue;
    if (a.needsCustomer && !r.customerId) continue;
    let why = "";
    if (a.avail && !(r.units || []).some((u) => !u.sold && !u.issued)) why = "لا وحدات متاحة";
    else if (a.day && !openDay) why = "افتح يوم العمل أولًا";
    else if (a.noLock && locked) why = "المخزون مقفل للجرد";
    else if (a.stage && stageOf(r) !== a.stage) why = a.stageHint || "ليست في هذه المرحلة";
    out.push({ id: a.id, label: a.label, icon: a.icon, tone: a.tone, target, disabled: !!why, hint: why || a.hint || null });
  }
  return out;
}

export { ENTITY_ACTIONS, ENTITY_KINDS, TAB_LABELS, entityActionsSpec };
