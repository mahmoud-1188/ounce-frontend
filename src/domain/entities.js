import { Flame, Gem, Receipt, Truck, UserRound } from "lucide-react";
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

export { ENTITY_KINDS, TAB_LABELS };
