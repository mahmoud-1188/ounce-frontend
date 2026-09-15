import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { AI_APP_GUIDE, ARABIC_INDIC, EASTERN_INDIC, TRACE_TOPICS } from "../core/assistant.js";
import { CATEGORY_TO_ACCOUNT, CHART_OF_ACCOUNTS } from "../core/chart.js";
import { ACCOUNT_TREE, ALL_ACCOUNT_NODES, APP_MODES, ATTACH_PREFIX, B32, BREAKPOINTS, CATEGORY_STATE, DEFAULT_CATEGORIES, EXPENSE_CATEGORIES, MIGRATION_FLAG, NHR, NHR_POWER_MAX_DBM, OUNCE_SECRET, RFID_DEFAULTS, RFID_SECTIONS } from "../core/constants.js";
import { GRAMS_PER_OUNCE, PURITY, WEIGHT_UNITS, fine24, fmt, fmtW, fromHalalas, halalas, pricePerGram, roundW, weightTimesPrice } from "../core/money.js";
import { BANK_COLUMN_HINTS, DEFAULT_CARD_FEES, DEFAULT_MARGINS, USD_TO_SAR_PEG } from "../core/money-rules.js";
import { NAV_BUNDLES, NAV_MAX_PER_ROW } from "../core/navigation.js";
import { FUNDING_SOURCES, GOLD_OUT_DESTINATIONS, ONLINE_STATUS } from "../core/workflow.js";
import { aiApi, goldPriceApi } from "../core/api.js";
import { accountByCode } from "./accountByCode.js";
import { journalBalanced } from "./journalBalanced.js";
import { key } from "./key.js";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

const fineAt = (w, fromKarat, toKarat) => {
  const fw = Number(w) || 0;
  const fp = PURITY[fromKarat] || (Number(fromKarat) || 0) / 24;
  const tp = PURITY[toKarat] || (Number(toKarat) || 0) / 24;
  return tp > 0 ? (fw * fp) / tp : 0;
};

const goldDestLabel = (kind, id) =>
  (GOLD_OUT_DESTINATIONS[kind === "raw" ? "raw" : "crafted"].find((d) => d.id === id) || {}).label || "—";

const setRuntimeCategories = (list) => {
  CATEGORY_STATE.list = Array.isArray(list) && list.length ? list : DEFAULT_CATEGORIES;
};

const categoryById = (id) => CATEGORY_STATE.list.find((c) => c.id === id) || null;

const saleModeOf = (id) => categoryById(id)?.saleMode || "whole";

const isPartial = (id) => saleModeOf(id) === "partial";

// ═══════════════════════════════════════════════════════════════════════
//  سلسلة عهدة الكسر
//
//  الكسر المشترى ليس ذهبًا جاهزًا. وزنه القائم يشمل فصوصًا ولحامًا،
//  وعياره تقدير حتى يُفحص. إدخاله الخزنة مباشرة يُدخل وزنًا ليس ذهبًا،
//  فيتضخّم المخزون بما لا تملكه ويُسدَّد به مورد فيُكشف النقص عنده.
//
//  المسار: مستلَم ← مُرسَل للإدارة ← مُقيَّم ← معتمَد ← في الخزنة
//
//  ولا يُسدَّد مورد إلا مما بلغ «في الخزنة». الكسر في الصندوق اليومي
//  لم يُفحص بعد — دفعه للمورد دفعٌ لوزن غير مؤكّد.
// ═══════════════════════════════════════════════════════════════════════

const trustBalance = (ledger, holderId) => {
  const rows = (ledger || []).filter((r) => r.holderId === holderId);
  let cash = 0;      // بالهللات
  let fine = 0;      // جرام24
  const byKarat = {};
  rows.forEach((r) => {
    const sign = r.dir === "in" ? 1 : -1;
    if (r.unit === "currency" || r.unit === "both") {
      cash += sign * halalas(r.amount || 0) * (r.cashDir === "out" ? -1 : 1);
    }
    if (r.unit === "gram" || r.unit === "both") {
      const w = Number(r.weight) || 0;
      const k = Number(r.karat) || 24;
      const gs = r.goldDir === "out" ? -1 : r.goldDir === "in" ? 1 : sign;
      fine += gs * fine24(w, k);
      byKarat[k] = roundW((byKarat[k] || 0) + gs * w);
    }
  });
  return {
    cash: fromHalalas(Math.round(cash)),
    fine: roundW(fine),
    byKarat,
    rows: rows.length,
  };
};

/// هل القطعة ما زالت كسرًا في ملكك؟
///
/// ⚠ المستهلَك خرج من الكسر: إمّا دخل المخزون قطعةً، أو سُدّد به
/// مورد، أو أُلغي. عدُّه بعدها يُضاعف الرصيد — تسعة جرامات تظهر
/// ثمانية عشر، والمالك يظنّ عنده ضِعف ما عنده.

const isLiveScrap = (e) =>
  !!e &&
  !e.consumed &&
  e.status !== "converted" &&
  e.status !== "rejected" &&
  e.status !== "cancelled" &&
  e.status !== "settled" &&
  (e.stage || "") !== "used";

const cardFeeOf = (settings, networkId) => {
  const fees = settings?.cardFees || DEFAULT_CARD_FEES;
  const v = Number(fees[networkId]);
  return Number.isFinite(v) && v >= 0 ? v : 0;
};

const normalizeFundingSource = (id) => {
  if (id === "safe") return "safe_cash";
  // ⚠ «daily» المجرّدة لم تكن مُعرّفة، فكان المبلغ لا يخرج من أي صندوق:
  // المرتجع يُسجَّل والقطعة تعود والنقد يبقى — ربح وهمي بقيمة كل مرتجع.
  if (id === "daily") return "daily_cash";
  if (id === "custody") return "custody_cash";
  if (id === "daily_transfer") return "daily_cash";
  return id;
};

const fundingSourceLabel = (id) => FUNDING_SOURCES.find((f) => f.id === normalizeFundingSource(id))?.label || "—";

// Chart-of-accounts categories for manual cash movements (Safe / Daily till /
// Scrap custody deposits & withdrawals). Every manual entry is tagged with
// one of these so money movements are classified consistently, the same way
// expenses already are — not just a free-text note.
// ═══════════════════════════════════════════════════════════════════════
//  شجرة الحسابات
//
//  كل عقدة تنتمي إلى مجموعة (group). المجموعة هي ما يسمح بفصل تكلفة الذهب
//  عن المصروفات التشغيلية — وبدون هذا الفصل يستحيل معرفة ربح الذهب وحده:
//  شراء أكياس تغليف أو أثاث كان سيُخصم من هامش الذهب ويشوّه الرقم.
//
//  gold_cogs        → تدخل في تكلفة البضاعة المباعة (ربح الذهب)
//  operating        → مصروفات تشغيل، خارج تكلفة الذهب
//  owner            → سحوبات الملّاك والشركاء
//  variance         → فروقات الجرد
//  transfer         → تحويلات داخلية (لا إيراد ولا مصروف)
//  revenue / other  → الإيرادات
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
//  شجرة الحسابات — هيكلة محاسبية للذهب
//
//  ثلاثة أشياء تميّز شجرة محل ذهب عن أي شجرة أخرى:
//
//  ① الوحدة المزدوجة: حسابات تُمسك بالجرام (مخزون الذهب، التزام المورد
//     بالذهب)، وحسابات بالعملة، وحسابات بكليهما. خلطها يجعل ارتفاع السعر
//     يبدو ربحًا.
//
//  ② فصل قيمة المعدن عن الربح: بيع بـ8000 ليس إيرادًا بـ8000 — منه 7000
//     قيمة معدن كنت تملكه، و1000 ربحك. الشجرة تفصلهما في حسابين.
//
//  ③ فصل الربح الرأسمالي عن التشغيلي: الأول من السوق ولا يتكرر، الثاني
//     من عملك ويتكرر. دمجهما يعطي رقمًا لا يُبنى عليه قرار.
//
//  الأكواد رقمية هرمية على النمط المحاسبي المعتاد، جاهزة للترحيل إلى
//  جدول ONSAH_ACCOUNTS في أوراكل بعمود PARENT_CODE.
// ═══════════════════════════════════════════════════════════════════════

/// وحدة القياس التي يُمسك بها الحساب.

const accountForCategory = (cat) => accountByCode(CATEGORY_TO_ACCOUNT[cat] || "") || null;

const childrenOf = (code) => CHART_OF_ACCOUNTS.filter((a) => a.parent === code);
/// سلسلة الآباء من الجذر للورقة — تُستخدم في تجميع القوائم.

const accountPath = (code) => {
  const path = [];
  let cur = accountByCode(code);
  while (cur) {
    path.unshift(cur);
    cur = cur.parent ? accountByCode(cur.parent) : null;
  }
  return path;
};
/// هل الحساب أو أحد آبائه هو الكود المطلوب؟ أساس تجميع القوائم.

const isUnder = (code, ancestorCode) => accountPath(code).some((a) => a.code === ancestorCode);

const accountLabel = (id) => ALL_ACCOUNT_NODES.find((a) => a.id === id)?.label || "—";

const accountGroup = (id) => ALL_ACCOUNT_NODES.find((a) => a.id === id)?.group || null;
/// هل هذا التصنيف جزء من تكلفة الذهب؟ يحدد ما يُخصم من ربح الذهب.

const isGoldCogs = (id) => accountGroup(id) === "gold_cogs";


// شعار «أونصة»: حلقة متحدة المركز بنقطة وسطى، بخلفية شفافة ولون ذهبي
// يطابق لوحة ألوان التطبيق.
// ⚠ حُذفت صورة الشعار (base64 بحجم 101 كيلوبايت): الشعار صار SVG
// أصيلًا — أخفّ، ويتلوّن بالتدرّج، ويدور بلا صورة خارجية.

function normalizeName(v) {
  return String(v || "")
    .trim()
    // ⚠ التشكيل أولًا: يقع بين الحروف فيُفسد كل استبدالٍ بعده
    .replace(/[\u064B-\u065F\u0670]/g, "")
    // والتطويل: «أحـمد» و«أحمد» واحد
    .replace(/\u0640/g, "")
    // ومحارف الاتجاه والمسافات الصفرية — تُلصق خفيةً بالنسخ واللصق
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    // الأرقام العربية والهندية سواء
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .toLowerCase();
}

const nameExists = (list, name, exceptId) =>
  (list || []).some((x) => x.id !== exceptId && normalizeName(x.name) === normalizeName(name));

function saleProfitSplit(sale, currentPrice24) {
  const lines = sale.lines || [];
  let metalAtCost = 0;   // قيمة المعدن بسعر الشراء
  let metalAtSale = 0;   // قيمة المعدن بسعر البيع
  let workmanshipCost = 0;
  let revenue = 0;

  lines.forEach((l) => {
    const q = Number(l.quantity) || 1;
    const w = Number(l.weightSnapshot) || 0;
    const k = Number(l.karatSnapshot) || 21;
    const purity = PURITY[k] || k / 24;
    const fineW = w * purity * q;
    // سعر المعدن وقت الشراء مستنتج من تكلفة الجرام المحفوظة
    const buyPrice24 = purity > 0 ? (Number(l.costPerGramSnapshot) || 0) / purity : 0;
    // سعر المعدن وقت البيع: المحفوظ على السطر، أو سعر الفاتورة، أو الحالي
    const sellPrice24 =
      Number(l.price24Snapshot) || Number(sale.price24Snapshot) || Number(currentPrice24) || buyPrice24;

    // ⚖ عبر الطبقة الدقيقة: الضرب العائم يُراكم انحرافًا عبر الأسطر
    metalAtCost += weightTimesPrice(fineW, buyPrice24);
    metalAtSale += weightTimesPrice(fineW, sellPrice24);
    workmanshipCost += (Number(l.workmanshipSnapshot) || 0) * q;
    revenue += (Number(l.unitPrice) || 0) * q;
  });

  const capitalGain = metalAtSale - metalAtCost;
  // ما فوق قيمة المعدن وقت البيع هو ما حصّلته لقاء عملك
  const grossOperating = revenue - metalAtSale;
  const operatingProfit = grossOperating - workmanshipCost;
  const totalProfit = revenue - (metalAtCost + workmanshipCost);

  return {
    revenue,
    metalAtCost,
    metalAtSale,
    workmanshipCost,
    capitalGain,
    operatingProfit,
    totalProfit,
    // ⚖ الثابت: رأسمالي + تشغيلي = الإجمالي
    checksum: Math.abs(capitalGain + operatingProfit - totalProfit),
  };
}

function saleProfitOf(sale) {
  return (sale.lines || []).reduce((acc, l) => {
    const basis = (l.costPerGramSnapshot * l.weightSnapshot + (l.workmanshipSnapshot || 0)) * l.quantity;
    return acc + (l.unitPrice * l.quantity - basis);
  }, 0);
}

// Aggregates one seller's sales for a period and applies their rule.

function inPeriod(iso, period) {
  if (period === "all") return true;
  const d = new Date(iso);
  const now = new Date();
  if (period === "today") return d.toDateString() === now.toDateString();
  if (period === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return true;
}

function ounceHash(str) {
  let h = 0x811c9dc5;
  const s = str + "|" + OUNCE_SECRET;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36).toUpperCase().padStart(7, "0");
}

// Base32 (RFC4648 alphabet, no padding). Chosen over base64 deliberately: the
// alphabet is single-case, so a customer can read a key over the phone and
// type it in any case without corrupting the payload.

function b32Encode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function b32Decode(str) {
  let bits = 0, value = 0;
  const bytes = [];
  for (const ch of str) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes)));
}

// Groups a long token into readable 6-char blocks so it can be dictated or typed.

const prettyToken = (raw) => (raw.match(/.{1,6}/g) || []).join("-");

const cleanToken = (pretty) => (pretty || "").replace(/[\s-]/g, "").toUpperCase();

function issueLicense({ tenantId, company, plan, maxBranches, months }) {
  const now = new Date();
  const exp = new Date(now);
  exp.setMonth(exp.getMonth() + Number(months || 12));
  const payload = {
    k: "LIC",
    t: tenantId,
    c: company,
    p: plan,
    b: Number(maxBranches),
    i: now.toISOString().slice(0, 10),
    e: exp.toISOString().slice(0, 10),
  };
  const body = b32Encode(payload);
  return { token: `KL${body}${ounceHash(body)}`, payload };
}

function issueBranchCode({ tenantId, branchCode, branchName }) {
  const payload = { k: "BRN", t: tenantId, b: branchCode, n: branchName, i: new Date().toISOString().slice(0, 10) };
  const body = b32Encode(payload);
  return { token: `KB${body}${ounceHash(body)}`, payload };
}

// Returns { ok, payload, reason }. Never throws on malformed input.

const branchSnapshotKey = (code) => `ounce_branch_snapshot_${code}`; // shared, one per branch
// حزمة البيانات الكاملة للفرع — تتيح للإدارة تصفّح سجلات الفرع لا ملخّصه.
// منفصلة عن الملخّص عمدًا: الملخّص صغير ويُقرأ دائمًا، والحزمة كبيرة
// وتُقرأ عند الدخول على فرع بعينه فقط.

const branchDataKey = (code) => `ounce_branch_data_${code}`;
// سقف السجلات المنشورة. النشر بلا حد يُنتج حزمة تتجاوز حدود التخزين
// فتفشل بصمت — والحد يبقي أحدث ما يهم الإدارة.

const marginFor = (settings, karat) => {
  const m = (settings?.marginByKarat || DEFAULT_MARGINS)[karat] || { perGram: 0, fixed: 0 };
  return { perGram: Number(m.perGram) || 0, fixed: Number(m.fixed) || 0 };
};

/// يفكّك سعر البيع لمكوّناته الثلاثة. الأساس لكل تسعير وتقرير.

function priceBreakdown({ weight, karat, price24, settings, workmanshipShare = 0, overridePrice = null }) {
  const w = Number(weight) || 0;
  const purity = PURITY[karat] || Number(karat) / 24;
  // الأساس هو سعر البيع (العالمي + الاحتياطي) لا العالمي المجرّد
  const base = sellPrice24(settings, price24);
  const goldValue = w * purity * base;
  const m = marginFor(settings, karat);
  const marginValue = w * m.perGram + m.fixed;
  const wm = Number(workmanshipShare) || 0;
  const suggested = goldValue + marginValue + wm;
  const total = overridePrice != null ? Number(overridePrice) || 0 : suggested;
  // الفارق بين المُدخل والمقترح يُنسب للهامش — الذهب لا يُساوم عليه.
  const actualMargin = total - goldValue - wm;
  return {
    weight: w, karat, purity, price24: Number(price24) || 0,
    goldValue,            // قيمة المعدن — ليست ربحًا
    workmanship: wm,      // مصنعية القطعة
    marginSuggested: marginValue,
    marginActual: actualMargin,
    suggested, total,
  };
}

const sellPrice24 = (settings, price24) => {
  const p = Number(price24) || 0;
  const a = settings?.priceAdjust || {};
  const v = Number(a.sellValue) || 0;
  if (v <= 0) return p;
  return a.sellMode === "percent" ? p * (1 + v / 100) : p + v;
};

/// السعر المرجعي لشراء الكسر: العالمي − هامش الشراء.
/// لا ينزل تحت الصفر مهما كانت النسبة — سعر سالب لا معنى له.

const scrapPrice24 = (settings, price24) => {
  const p = Number(price24) || 0;
  const a = settings?.priceAdjust || {};
  const v = Number(a.scrapValue) || 0;
  if (v <= 0) return p;
  const out = a.scrapMode === "percent" ? p * (1 - v / 100) : p - v;
  return Math.max(0, out);
};

const isBundle = (id) => String(id || "").startsWith("grp_");

// ═══════════════════════════════════════════════════════════════
//  نطاق المساعد
//
//  المساعد يقرأ حسابات المحل كلها ويشرحها. إتاحته لمن مُنع من صفحة
//  تفتحها له من الباب الخلفي: البائع الممنوع من التقارير يسأل المساعد
//  «كم ربح المحل؟» فيجيب.
//
//  فالقاعدة: المدير وحده، وفي حدود ما هو مفتوح له فعلًا. صلاحية
//  أغلقتها الإدارة المركزية على المدير تبقى مغلقة أمام المساعد أيضًا.
// ═══════════════════════════════════════════════════════════════

const aiAllowedFor = (role, user) => {
  if (role === "manager") return true;
  return user?.canUseAi === true;
};

/// للتوافق مع النداءات القديمة التي تمرّر الدور وحده.

const aiAllowedForRole = (role) => role === "manager";

/// الصفحات التي يُسمح للمساعد بالحديث عن بياناتها.
/// تُشتق من صلاحية المستخدم الفعلية لا من دوره الاسمي.

const aiScope = (perms) => {
  const allowed = new Set([...(perms?.allowedTabs || []), ...(perms?.allowedMore || [])]);
  allowed.delete("more");
  return allowed;
};

/// خريطة: أي صفحة يخصّها كل نوع سجل. تُستخدم لتصفية الفهرس بحسب
/// صلاحية المستخدم — سجل من صفحة مغلقة لا يُمرَّر للمساعد.

const bundleById = (id) => NAV_BUNDLES.find((b) => b.id === id) || null;
/// الصفحات المضمومة داخل مجمّعات — تُستبعد من القائمة الجانبية فلا تظهر مرتين

const bundledPages = new Set(NAV_BUNDLES.flatMap((b) => b.items));

/// يقبل الشكلين: مصفوفة قديمة أو كائن بصفّين.
/// أقصى أيقونات في الصفّ — يتبع المقاس.
///
/// ⚠ خمسٌ ثابتة كانت للجوال، وعلى شاشة ويندوز تُصبح خمس أيقونات وسط
/// فراغٍ عريض — يبدو التطبيق كأنه هاتفٌ مُكبَّر لا برنامج حاسب.
///
/// والزيادة ليست حشوًا: الشاشة العريضة تحتمل، والمستخدم بالفأرة يُصيب
/// هدفًا أصغر. فيرى أكثر ويضغط أقلّ.

const navPerRow = (size) =>
  size === "xl" ? 10 : size === "lg" ? 8 : size === "md" ? 6 : NAV_MAX_PER_ROW;

/// ⚠ يُعيد التوزيع دائمًا بدل الوثوق بالمحفوظ.
///
/// ترتيب محفوظ من نسخة أقدم قد يضع سبعة أزرار في الصف الأول، فتُسحق
/// الأزرار ولا يظهر صف ثانٍ أبدًا. الفيض التلقائي يمنع ذلك مهما كان
/// مصدر الترتيب: مصفوفة قديمة، أو كائن بصفّين، أو صف أول متضخّم.
/// يُطبّع تخطيط الشريط.
///
/// ⚠ `perRow` وسيطٌ صريح لا `arguments`: الأخيرة لا تعمل في دوال
/// الأسهم — تُعيد `undefined` بهدوء، فيعود الحدّ خمسًا على كل شاشة.

function exportTablesPdf({ title, subtitle, sections, branchName, landscape = false, sign = true, onBlocked }) {
  // ⚠ إصلاح محلي: كانت الدالة تستدعي flashToast مباشرةً رغم أنها دالة
  // مستقلة خارج GoldInventoryApp — لا وصول لها إلى تلك الدالة، فيسقط
  // الاستدعاء بخطأ "flashToast is not defined" عند حظر المتصفح للنافذة
  // المنبثقة. الحل: معامل onBlocked اختياري يمرره المستدعي.
  const esc = (x) =>
    String(x == null ? "" : x).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const tbl = (h, rows) =>
    `<table><thead><tr>${h.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>` +
    rows.map((r) =>
      `<tr>${r.map((c, i) => `<td class="${i === 0 ? "r" : "c"}">${esc(c)}</td>`).join("")}</tr>`
    ).join("") + `</tbody></table>`;

  const body = (sections || []).filter((x) => x && x.rows).map((x) =>
    `<h2>${esc(x.title)}</h2>` +
    (x.rows.length ? tbl(x.headers || [], x.rows) : `<p class="none">لا بيانات</p>`) +
    (x.note ? `<div class="note">${esc(x.note)}</div>` : "")
  ).join("");

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>${esc(title)}</title><style>
  @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm; }
  body { font-family:"Tajawal","Segoe UI",sans-serif; color:#111; margin:0; font-size:11px; }
  h1 { font-size:17px; margin:0 0 2px; }
  h2 { font-size:12.5px; margin:15px 0 5px; padding-bottom:3px; border-bottom:1.5px solid #333; }
  .sub { color:#555; font-size:10px; margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; margin-bottom:6px; }
  th,td { border:1px solid #bbb; padding:3px 5px; font-size:10px; }
  th { background:#eee; font-weight:700; text-align:center; }
  td.c { text-align:center; } td.r { text-align:right; }
  tbody tr:last-child td { font-weight:700; background:var(--bg); }
  .none { color:#888; font-size:10px; }
  .note { color:#666; font-size:9px; margin:2px 0 8px; }
  .sign { margin-top:20px; display:flex; gap:28px; }
  .sign div { flex:1; border-top:1px solid #333; padding-top:3px; text-align:center; font-size:10px; }
  .foot { margin-top:12px; padding-top:5px; border-top:1px solid #999; color:#555; font-size:9px;
          display:flex; justify-content:space-between; }
</style></head><body>
<h1>${esc(title)}</h1>
<div class="sub">${esc(branchName || "")}${subtitle ? " · " + esc(subtitle) : ""}
  · طُبع ${esc(new Date().toLocaleString("en-GB"))}</div>
${body}
${sign ? `<div class="sign"><div>أعدّه</div><div>راجعه</div><div>اعتمده</div></div>` : ""}
<div class="foot"><span>${esc(branchName || "")}</span><span>أونصة</span></div>
<script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    if (typeof onBlocked === "function") onBlocked("امنع حظر النوافذ المنبثقة للطباعة");
    return false;
  }
  w.document.write(html);
  w.document.close();
  return true;
}


// ═══════════════════════════════════════════════════════════════════════
//  السمات
//
//  الذهبي الداكن هو الأصل: الشاشة تُقرأ في محل إضاءته قوية، والداكن
//  لا يبهر العين ساعات العمل الطويلة. والفاتح خيارٌ لمن يفضّله.
//
//  ⚠ الأسماء بالدور لا بالمظهر: «panel» لا «darkBrown» — تسميته بمظهره
//  تجعل السمة الفاتحة تحمل أسماء داكنة، فيقرأ من يُعدّل اسمًا يناقض
//  ما يراه.
// ═══════════════════════════════════════════════════════════════════════

const modeAllowsPage = (mode, pageId) => {
  const def = APP_MODES[mode];
  if (!def || !def.allowPages) return true;
  return def.allowPages.includes(pageId);
};

/// وهل التبويب؟

const modeAllowsTab = (mode, tabId) => {
  const def = APP_MODES[mode];
  if (!def || !def.allowTabs) return true;
  return def.allowTabs.includes(tabId);
};

/// وهل الفعل؟

const modeAllowsAction = (mode, action) => {
  const deny = APP_MODES[mode]?.denyActions;
  return !(Array.isArray(deny) && deny.includes(action));
};

/// يكتب متغيّرات السمة على جذر الصفحة.
///
/// ⚠ على `documentElement` لا على حاوية التطبيق: النوافذ المنبثقة
/// تُرسم خارج الشجرة أحيانًا، فتفقد المتغيّرات وتظهر بلا ألوان.

function remainingQty(item) {
  if (Array.isArray(item.units)) return item.units.filter((u) => !u.sold).length;
  return Math.max(0, (item.quantity || 0) - (item.quantitySold || 0));
}

function unitCostBasis(item) {
  return item.costPerGram * item.weight + (item.workmanshipPerUnit || 0);
}

function unitCurrentValue(item, price24) {
  return pricePerGram(item.karat, price24) * item.weight + (item.workmanshipPerUnit || 0);
}

function printedCount(item) {
  return (item.units || []).filter((u) => u.printed).length;
}

let codeCounter = 0;

function generateUnitCode() {
  codeCounter += 1;
  const base = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `G-${base}-${codeCounter.toString().padStart(2, "0")}${rand}`;
}

function lotAllocatedWeight(lotId, items) {
  return items.filter((i) => i.lotId === lotId).reduce((a, i) => a + i.weight * i.quantity, 0);
}

function categoryLabel(id) {
  // ⚠ لا نُعيد المعرّف حين لا نجده: `id` قد يكون undefined، فتظهر
  // كلمة «undefined» في تسمية القطعة أمام البائع.
  if (!id) return "غير مصنَّف";
  return CATEGORY_STATE.list.find((c) => c.id === id)?.label || String(id);
}

function itemLabel(item) {
  // ⚠ `categoryId` لا `category`.
  //
  // الحقل في نموذج الصنف اسمه `categoryId`، وقراءة `category` تُعيد
  // undefined دائمًا — فتُعرض القطعة «undefined · عيار 21».
  //
  // ونقبل الاسمين: نسخٌ قديمة كتبت `category`، ورفضها يُفقد تصنيفها.
  const cat = item?.categoryId ?? item?.category;
  return `${categoryLabel(cat)} · عيار ${item?.karat ?? "؟"}`;
}

function compressImage(file, maxDim = 360, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image load failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Reads any file (PDF, image, etc.) as a base64 data URL without resizing —
// used for attaching supplier invoices/receipts that aren't necessarily photos.

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------
// Attachment storage.
// Each storage key is capped (~5MB), so attachments are NEVER stored inline
// inside the lots/taskirat arrays — a single large PDF would push that array
// over the cap and silently destroy every record in it. Instead each file
// lives in its own key and the record keeps only a light reference.
// ---------------------------------------------------------------
// ---------------------------------------------------------------
// ترحيل المفاتيح القديمة (يعمل مرة واحدة فقط).
//
// أُعيدت تسمية المنتج، وأُعيدت تسمية مفاتيح التخزين معه. بدون هذا الترحيل
// كان التطبيق سيبحث عن مفاتيح جديدة فارغة، فتختفي كل السجلات الموجودة —
// موجودة على القرص لكن غير مرئية. القراءة من المفتاح القديم ونسخه للجديد
// مرة واحدة تجعل إعادة التسمية بلا كلفة على البيانات.
// ---------------------------------------------------------------

async function readKeyOrNull(key) {
  try {
    const res = await window.storage.get(key, false);
    return res ? res.value : null;
  } catch (e) {
    return null; // المفتاح غير موجود
  }
}

async function migrateLegacyKeys(newKeys) {
  if (!window.storage) return;
  if (await readKeyOrNull(MIGRATION_FLAG)) return; // رُحِّل سابقًا

  // جرد واحد للمفاتيح الموجودة بدل فحص كل مفتاح على حدة.
  // الفحص المتسلسل كان يطلق ~80 طلب قراءة عند كل إقلاع، وهو ما يستنفد
  // حدّ الطلبات فتفشل عمليات الحفظ بعده — وهذا سبب رسالة «لم يتم الحفظ».
  let present = new Set();
  try {
    const listed = await window.storage.list("", false);
    present = new Set(listed?.keys || []);
  } catch (e) {
    console.error("legacy scan failed", e);
    return; // بلا جرد لا نخاطر بإطلاق عشرات الطلبات
  }

  // أجيال التسمية السابقة، من الأحدث للأقدم.
  // أجيال التسمية السابقة من الأحدث للأقدم. الجيل الحالي "ounce_"، وما
  // قبله أسماء استُخدمت في نسخ سابقة — بلا هذه السلسلة تختفي بيانات تلك
  // النسخ رغم بقائها على القرص.
  const generations = ["kaki_", "ouncen_", "gold_"];
  let moved = 0;
  for (const newKey of newKeys) {
    if (present.has(newKey)) continue; // الجديد مكتوب أصلًا — لا نطمسه
    for (const prefix of generations) {
      const legacy = newKey.replace(/^ounce_/, prefix);
      if (legacy === newKey || !present.has(legacy)) continue;
      try {
        const old = await readKeyOrNull(legacy);
        if (old === null) continue;
        await window.storage.set(newKey, old, false);
        moved += 1;
      } catch (e) {
        console.error("migration failed for", newKey, e);
      }
      break; // أول جيل موجود هو الأحدث
    }
  }
  try {
    await window.storage.set(MIGRATION_FLAG, JSON.stringify({ at: new Date().toISOString(), moved }), false);
  } catch (e) {
    console.error("migration flag write failed", e);
  }
}

function attachmentByteSize(dataUrl) {
  // base64 payload length -> approximate decoded byte size
  const b64 = (dataUrl || "").split(",")[1] || "";
  return Math.ceil((b64.length * 3) / 4);
}

async function saveAttachment(payload) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await window.storage.set(ATTACH_PREFIX + id, JSON.stringify(payload), false);
  return id;
}

async function loadAttachment(id) {
  if (!id) return null;
  try {
    const res = await window.storage.get(ATTACH_PREFIX + id, false);
    return res ? JSON.parse(res.value) : null;
  } catch (e) {
    console.error("attachment load failed", id, e);
    return null;
  }
}

// Opens a stored attachment in a new tab, fetching it on demand.

async function openAttachment(id, inlineFallback) {
  const payload = inlineFallback || (await loadAttachment(id));
  if (!payload?.dataUrl) return false;
  const win = window.open();
  if (win) {
    if (payload.isImage) win.document.write(`<img src="${payload.dataUrl}" style="max-width:100%" />`);
    else win.document.write(`<iframe src="${payload.dataUrl}" style="border:0;width:100%;height:100%"></iframe>`);
  }
  return true;
}

const normHeader = (h) =>
  String(h || "").trim().toLowerCase()
    .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[_\-]/g, " ").replace(/\s+/g, " ");

function detectColumns(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const n = normHeader(h);
    Object.entries(BANK_COLUMN_HINTS).forEach(([field, hints]) => {
      if (map[field] != null) return;
      if (hints.some((x) => n === normHeader(x) || n.includes(normHeader(x)))) map[field] = i;
    });
  });
  return map;
}

/// يقسم سطر CSV مع احترام الاقتباس — الوصف قد يحوي فاصلة.

function splitCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if ((c === "," || c === ";" || c === "\t") && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

function journalTrialBalance(journal) {
  const by = {};
  (journal || []).forEach((e) => {
    (e.lines || []).forEach((l) => {
      const c = l.account;
      by[c] = by[c] || { code: c, name: accountByCode(c)?.name || c, debit: 0, credit: 0 };
      by[c].debit += Number(l.debit) || 0;
      by[c].credit += Number(l.credit) || 0;
    });
  });
  const rows = Object.values(by)
    .map((r) => ({
      ...r,
      debit: fromHalalas(halalas(r.debit)),
      credit: fromHalalas(halalas(r.credit)),
      balance: fromHalalas(halalas(r.debit) - halalas(r.credit)),
    }))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const totals = rows.reduce(
    (a, r) => ({ debit: a.debit + r.debit, credit: a.credit + r.credit }),
    { debit: 0, credit: 0 }
  );
  // ⚖ المجاميع بالهللات: الجمع العائم عبر مئات القيود ينحرف، فيظهر
  // الميزان غير متوازن وهو متوازن — ويبحث المحاسب عن قيدٍ سليم.
  totals.debit = fromHalalas(halalas(totals.debit));
  totals.credit = fromHalalas(halalas(totals.credit));
  return {
    rows,
    totals,
    diff: fromHalalas(halalas(totals.debit) - halalas(totals.credit)),
    // ⚖ التوازن هنا مطلق لا تقريبي: كل قيد بطرفين متساويين
    balanced: Math.abs(totals.debit - totals.credit) < 0.005,
    entries: (journal || []).length,
    reversals: (journal || []).filter((e) => e.isReversal).length,
    unbalanced: (journal || []).filter((e) => !journalBalanced(e)),
  };
}

/// تدقيق الدفتر: قيود غير متوازنة أو مُعدَّلة بعد الترحيل.

function useViewport() {
  const read = () => {
    if (typeof window === "undefined") {
      return { w: 390, h: 844, size: "sm", touch: true, keyboard: false,
               landscape: false, cols: 1 };
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    // ⚠ الضلع الأقصر لا العرض: جهازٌ عرضه 844 وارتفاعه 390 جوالٌ
    // مستلقٍ لا لوح. اليد ما زالت ممسكة به.
    const shortSide = Math.min(w, h);
    const size =
      shortSide < 520 ? "sm"
      : w >= BREAKPOINTS.xl ? "xl"
      : w >= BREAKPOINTS.lg ? "lg"
      : w >= BREAKPOINTS.md ? "md"
      : "sm";
    return {
      w, h, size, touch,
      // ⚠ لوحة المفاتيح تُستنتج من غياب اللمس لا من العرض: لوحٌ
      // بلوحة خارجية يستحقّ الاختصارات، وحاسبٌ بشاشة لمس لا يضرّه وجودها.
      keyboard: !touch || w >= BREAKPOINTS.lg,
      landscape: w > h,
      cols: size === "xl" ? 3 : size === "lg" ? 2 : 1,
    };
  };
  const [vp, setVp] = useState(read);
  useEffect(() => {
    let raf = 0;
    const onChange = () => {
      cancelAnimationFrame(raf);
      // ⚠ التأجيل بإطار: iOS يُبلّغ المقاس القديم لحظة الدوران، فقياسه
      // فورًا يُعطي عرض الوضع السابق ويقفز التخطيط مرتين.
      raf = requestAnimationFrame(() => setVp(read()));
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);
  return vp;
}

/// عرض المحتوى بحسب المقاس.

const contentWidth = (size) =>
  size === "xl" ? 1360 : size === "lg" ? 1120 : size === "md" ? 760 : 448;

// ═══════════════════════════════════════════════════════════════════════
//  الجدول المتكيّف
//
//  مكوّنٌ واحد يعرض نفس البيانات بشكلين:
//    الصغيرة  →  بطاقات تتوسّع بالضغط، والتعديل داخلها
//    الكبيرة  →  جدول بخلايا تُعدَّل مباشرةً، وتفصيلٌ جانبي
//
//  ⚠ المنطق لا يتكرّر: `columns` و`onEdit` و`actions` تُكتب مرة،
//  والمكوّن يقرر كيف يعرضها. تكرارُها شكلين يجعل عمودًا يُضاف هنا
//  ولا يُضاف هناك.
// ═══════════════════════════════════════════════════════════════════════

/// خلية قابلة للتعديل — تعمل في البطاقة والجدول معًا.

function cashTrialBalance(ledger, chart) {
  const rows = {};
  (ledger || []).forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (amt === 0) return;
    const cat = t.category || "غير مصنّف";
    const code = CATEGORY_TO_ACCOUNT[cat] || null;
    const acc = code ? accountByCode(code) : null;
    // ⚠ الحساب الوزني الصرف لا يدخل الميزان النقدي
    if (acc && acc.unit === "gram") return;
    const key = code || cat;
    if (!rows[key]) {
      rows[key] = {
        code, category: cat,
        name: acc ? acc.name : accountLabel(cat) !== "—" ? accountLabel(cat) : cat,
        nature: acc?.nature || "debit",
        statement: acc?.statement || "income",
        debit: 0, credit: 0, count: 0,
      };
    }
    // الخروج مدين والدخول دائن — اصطلاح الدفتر النقدي
    if (t.type === "out") rows[key].debit += amt;
    else rows[key].credit += amt;
    rows[key].count += 1;
  });
  const list = Object.values(rows).sort((a, b) => String(a.code || "z").localeCompare(String(b.code || "z")));
  const totals = list.reduce(
    (a, r) => ({ debit: a.debit + r.debit, credit: a.credit + r.credit }),
    { debit: 0, credit: 0 }
  );
  // ⚠ دفتر النقد هنا أحادي الطرف: كل حركة لها تصنيف واحد لا طرفان.
  //
  // فالفحص ليس «مدين = دائن» — هذا لا يتحقق إلا في القيد المزدوج
  // الكامل. الفحص الصحيح: مجموع الحركات المصنّفة يساوي التغيّر في
  // أرصدة الصناديق. اختلافهما يعني حركة لم تُصنَّف أو صندوقًا لم يُحدَّث.
  const net = totals.credit - totals.debit;
  const poolNet = (ledger || []).reduce(
    (a, t) => a + (t.type === "out" ? -(Number(t.amount) || 0) : Number(t.amount) || 0), 0
  );
  return {
    unit: "currency",
    rows: list,
    totals,
    net,
    poolNet,
    diff: net - poolNet,
    // مطابق حين يساوي صافي المصنّف صافي الصناديق
    balanced: Math.abs(net - poolNet) < 0.01,
    unclassified: list.filter((r) => !r.code),
  };
}

/// ── ميزان المراجعة الوزني ──
///
/// دفتر مستقل بالجرام الصافي. لا مبالغ فيه إطلاقًا، ولا يُقارن بالنقدي.
/// يُبنى من حركات الذهب الفعلية لا من القيود النقدية.

function weightTrialBalance(sources) {
  const { scrapEntries = [], safeGoldTx = [], items = [], sales = [],
          lots = [], weightAdjustments = [], goldLedger = [] } = sources || {};
  const rows = {};

  // ⚠ الدفتر الفعلي أولًا. السجلات السابقة لتفعيله ليس لها قيود، فتُشتق
  // من المستندات — وإلا ظهر المخزون القديم صفرًا.
  if (goldLedger.length) {
    goldLedger.forEach((e) => {
      const acc = accountByCode(e.accountCode);
      const key = e.accountCode + "|" + e.karat;
      if (!rows[key]) {
        rows[key] = {
          code: e.accountCode, name: acc?.name || e.accountCode,
          karat: e.karat, in: 0, out: 0, count: 0, fromLedger: true,
        };
      }
      const w = Number(e.weight) || 0;
      if (e.type === "in") rows[key].in += w;
      else rows[key].out += w;
      rows[key].count += 1;
    });
  }
  const put = (code, name, karat, inG, outG) => {
    const key = code + "|" + karat;
    if (!rows[key]) rows[key] = { code, name, karat, in: 0, out: 0, count: 0 };
    rows[key].in += inG;
    rows[key].out += outG;
    rows[key].count += 1;
  };

  // ── الاشتقاق من المستندات — للسجلات السابقة للدفتر ──
  const derived = goldLedger.length === 0;

  // 1210 ذهب مشغول — المتاح بالمخزون
  if (derived) items.forEach((it) => {
    const q = (it.units || []).filter((u) => !u.sold).length;
    if (q > 0) put("1210", "ذهب مشغول", it.karat, (Number(it.weight) || 0) * q, 0);
  });
  // 1220 ذهب خام بالخزنة
  if (derived) safeGoldTx.forEach((t) => {
    const w = Number(t.weight) || 0;
    put("1220", "ذهب خام بالخزنة", t.karat, t.type === "in" ? w : 0, t.type === "in" ? 0 : w);
  });
  // 1230 الكسر
  //
  // ⚠ الحيّ منه فقط: ما دخل المخزون قطعةً أو سُدّد به مورد خرج من
  // حساب الكسر. عدُّه بعدها يُضاعف الرصيد الوزني في الميزان.
  if (derived) scrapEntries.filter(isLiveScrap).forEach((e) => {
    const w = Number(e.weight) || 0;
    put("1230", "كسر", e.karat, w > 0 ? w : 0, w < 0 ? -w : 0);
  });
  // 2110 التزام ذهب للموردين — الآجل
  if (derived) lots.filter((l) => l.paymentMethod === "deferred").forEach((l) => {
    put("2110", "موردون — ذهب مستحق", l.karat, 0, Number(l.weight) || 0);
  });
  // 5310 الهالك و4320 الفائض
  if (derived) weightAdjustments.forEach((a) => {
    const w = Number(a.weight) || 0;
    if (w <= 0) return;
    if (a.kind === "wastage" || a.kind === "repair_add") put("5310", "هالك وفاقد", a.karat, 0, w);
    else if (a.kind === "surplus" || a.kind === "repair_reduce") put("4320", "فائض وزن", a.karat, w, 0);
  });
  // مبيعات: خروج من المخزون
  if (derived) sales.forEach((sale) => {
    (sale.lines || []).forEach((l) => {
      put("1210", "ذهب مشغول", l.karatSnapshot,
        0, (Number(l.weightSnapshot) || 0) * (Number(l.quantity) || 1));
    });
  });

  const list = Object.values(rows)
    .map((r) => ({
      ...r,
      net: r.in - r.out,
      fineIn: fine24(r.in, r.karat),
      fineOut: fine24(r.out, r.karat),
      fineNet: fine24(r.in - r.out, r.karat),
    }))
    .sort((a, b) => a.code.localeCompare(b.code) || b.karat - a.karat);

  const totals = list.reduce(
    (a, r) => ({ fineIn: a.fineIn + r.fineIn, fineOut: a.fineOut + r.fineOut }),
    { fineIn: 0, fineOut: 0 }
  );

  // تجميع بالعيار — كل عيار رصيده المستقل
  const byKarat = {};
  list.forEach((r) => {
    if (!byKarat[r.karat]) byKarat[r.karat] = { in: 0, out: 0 };
    byKarat[r.karat].in += r.in;
    byKarat[r.karat].out += r.out;
  });

  return {
    unit: "gram",
    rows: list,
    byKarat,
    totals,
    netFine: totals.fineIn - totals.fineOut,
    // ⚠ الميزان الوزني لا «يتوازن» كالنقدي: أصوله والتزاماته بوحدة
    // واحدة فلا يتقابلان.
    //
    // والالتزام سالب بطبيعته — «موردون ذهب مستحق» رصيده سالب لأنه
    // عليك لا لك. الخلل هو الأصل السالب: صرف ما لا تملك.
    // الأصل السالب خلل: صُرف ما لا يُملك
    negatives: list.filter((r) => r.net < -0.0005 && String(r.code).startsWith("1")),
    // الالتزام سالب بطبيعته — عليك لا لك
    liabilities: list.filter((r) => r.net < -0.0005 && String(r.code).startsWith("2")),
    // ⚠ التدفّقات (4xxx إيراد · 5xxx تكلفة) ليست أرصدة: الهالك «سالب»
    // لأنه خروج، وتصنيفه التزامًا خطأ يربك المحاسب.
    flows: list.filter((r) => /^[45]/.test(String(r.code))),
  };
}

/// وحدات الوزن المتداولة في السوق. الجرام أساس، والباقي يُحوَّل إليه.

const unitById = (id) => WEIGHT_UNITS.find((u) => u.id === id) || WEIGHT_UNITS[0];
/// من أي وحدة إلى الجرام

const toGram = (value, unitId) => (Number(value) || 0) * unitById(unitId).perGram;
/// من الجرام إلى أي وحدة

const fromGram = (grams, unitId) => (Number(grams) || 0) / unitById(unitId).perGram;
/// عرض الوزن بوحدته: 31.1035 جم → «1.0000 أونصة»

const fmtWeight = (grams, unitId = "g") => {
  const u = unitById(unitId);
  return `${fmt(fromGram(grams, unitId), u.decimals)} ${u.short}`;
};

// ⚠ إصلاح أمني/وظيفي حقيقي: كانت هذي الدالة تنادي
// https://api.anthropic.com/v1/messages مباشرة من المتصفح بلا أي مفتاح
// API (x-api-key) — هذا يُرفض دائمًا بـ401 من Anthropic (سبب ظهور صفر في
// شاشة سعر الذهب على الدوام)، وحتى لو أُضيف مفتاح فسيكون مكشوفًا لأي
// زائر لأنه في كود العميل. الآن تُنادى GET /api/gold-price (الخادم فقط
// يتصل بمصدر السعر الخارجي — gold-api.com — ويحوّل الناتج لريال سعودي).
async function fetchGoldPriceSAR() {
  const res = await goldPriceApi.fetch();
  const perGramSar = Number(res.perGram);
  if (!Number.isFinite(perGramSar) || perGramSar <= 0) throw new Error("invalid_price");
  return { perGram: perGramSar, asOf: res.asOf || "" };
}

// Sends a snapshot of the shop's current figures to Claude and asks for a
// short written business analysis in Arabic — no web search needed here,
// purely reasoning over the numbers already in the app.

async function fetchAiBusinessInsights(summary) {
  const data = await aiApi.chat(
    [
      {
        role: "user",
        content:
          "أنت مستشار مالي لمحل ذهب. بناءً على الأرقام التالية، اكتب تحليلًا موجزًا بالعربية (٤-٦ جمل قصيرة، بدون مقدمات) يغطي: أهم ملاحظة إيجابية، أهم نقطة تحتاج انتباه، واقتراح عملي واحد قابل للتنفيذ. لا تستخدم عناوين أو نقاط مرقّمة، فقرة واحدة سلسة.\n\nالأرقام:\n" +
          summary,
      },
    ],
    900
  );
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("empty");
  return text;
}

// ------------------------------------------------------------------
// Deterministic audit checks. All arithmetic happens here in plain JS
// against the app's own data — the AI is only used afterward to explain
// and prioritize the findings in natural language, never to do the math.
// ------------------------------------------------------------------

function runAuditChecks(ctx) {
  const findings = [];
  const add = (severity, title, detail) => findings.push({ severity, title, detail });

  if (ctx.cashBalance.total < -0.01) add("error", "رصيد صندوق اليومي سالب", `الرصيد الحالي ${fmt(ctx.cashBalance.total, 0)} — تحقق من حركات لم تُسجَّل أو خصم زائد.`);
  if (ctx.safeBalance.total < -0.01) add("error", "رصيد الخزنة (النقدي) سالب", `الرصيد الحالي ${fmt(ctx.safeBalance.total, 0)}.`);
  if (ctx.custodyBalance.total < -0.01) add("error", "رصيد عهدة الكسر سالب", `الرصيد الحالي ${fmt(ctx.custodyBalance.total, 0)} — قد يكون هناك شراء كسر بدون تمويل كافٍ.`);
  if (ctx.safeGoldBalance.total < -0.01) add("error", "رصيد ذهب الخزنة سالب", `الوزن الحالي ${fmtW(ctx.safeGoldBalance.total)} جم.`);

  // Lots over-allocated beyond what was actually purchased
  ctx.lots.forEach((lot) => {
    if (lot.status !== "open") return;
    const allocated = lotAllocatedWeight(lot.id, ctx.items);
    if (allocated > lot.weight + 0.01) {
      add("error", "دفعة مورد موزَّعة أكثر من وزنها", `دفعة بتاريخ ${new Date(lot.date).toLocaleDateString("en-GB")}: مُوزَّع ${fmtW(allocated)} جم مقابل ${fmtW(lot.weight)} جم مشتراة.`);
    }
  });

  // Duplicate unit codes across all items (data integrity)
  const codeSeen = new Map();
  ctx.items.forEach((it) => {
    (it.units || []).forEach((u) => {
      if (codeSeen.has(u.code)) add("warning", "رمز قطعة مكرر", `الرمز ${u.code} مستخدم أكثر من مرة — قد يسبب التباس عند البيع أو الطباعة.`);
      codeSeen.set(u.code, true);
    });
  });

  // Sales tax math consistency
  ctx.sales.forEach((s) => {
    if (!s.taxApplicable) return;
    const expected = s.total - s.total / (1 + (s.taxRate || 0));
    if (Math.abs(expected - (s.taxAmount || 0)) > 0.5) {
      add("warning", "فرق في حساب ضريبة فاتورة", `فاتورة ${new Date(s.date).toLocaleDateString("en-GB")}: الضريبة المسجَّلة ${fmt(s.taxAmount, 0)} بينما المتوقع ${fmt(expected, 0)}.`);
    }
  });

  // Scrap refine sanity: actual stones weight can't exceed the piece's total weight
  ctx.scrapEntries.forEach((s) => {
    if (s.refined && s.actualStonesWeight > s.weight + (s.stonesMarginEstimate || 0) + 0.01) {
      add("warning", "تصفية كسر غير منطقية", `${s.description || "قطعة كسر"}: الوزن الفعلي للفصوص أكبر من وزن القطعة المسجَّل.`);
    }
  });

  // Expenses / repairs with non-positive amounts
  ctx.expenses.forEach((e) => {
    if (e.amount <= 0) add("warning", "مصروف بمبلغ غير صالح", `${new Date(e.date).toLocaleDateString("en-GB")}: مبلغ ${fmt(e.amount, 0)}.`);
  });
  ctx.repairs.forEach((r) => {
    if (r.profit < 0) add("warning", "إصلاح بمكسب سالب", `${r.customerName || "بدون اسم"}: مكسب ${fmt(r.profit, 0)}.`);
  });

  // Overall profitability signal (informational, not necessarily an error)
  const unrealizedProfit = ctx.totals.value - ctx.totals.cost;
  if (ctx.totals.cost > 0 && unrealizedProfit < -ctx.totals.cost * 0.1) {
    add("info", "انخفاض ملحوظ بقيمة المخزون الحالية", `القيمة الحالية أقل من التكلفة بنسبة تتجاوز 10٪ — قد يعكس تراجع سعر السوق مؤقتًا.`);
  }

  // Chart-of-accounts integrity: every money movement should be classified
  // against a known node in the tree, and inflows/outflows must use the
  // correct side of it. Untagged or mis-sided entries mean reports that group
  // by account will silently under-report.
  const IN_IDS = new Set(ACCOUNT_TREE.in.map((a) => a.id));
  const OUT_IDS = new Set(ACCOUNT_TREE.out.map((a) => a.id));
  const ALL_IDS = new Set([...IN_IDS, ...OUT_IDS]);
  const checkTree = (txs, label, inTypes) => {
    let untagged = 0,
      unknown = 0,
      misSided = 0;
    (txs || []).forEach((t) => {
      if (!t.category) {
        untagged += 1;
        return;
      }
      if (!ALL_IDS.has(t.category)) {
        unknown += 1;
        return;
      }
      const isIn = inTypes.includes(t.type);
      if (isIn && !IN_IDS.has(t.category)) misSided += 1;
      if (!isIn && !OUT_IDS.has(t.category)) misSided += 1;
    });
    if (untagged > 0) add("warning", `حركات بدون تصنيف محاسبي — ${label}`, `${untagged} حركة غير مصنّفة على شجرة الحسابات، لن تظهر ضمن التقارير المجمّعة حسب الحساب.`);
    if (unknown > 0) add("warning", `تصنيف غير معروف — ${label}`, `${unknown} حركة تحمل تصنيفًا غير موجود بشجرة الحسابات.`);
    if (misSided > 0) add("error", `تصنيف بالاتجاه الخاطئ — ${label}`, `${misSided} حركة مصنّفة كإيراد بينما هي مصروف أو العكس.`);
  };
  checkTree(ctx.cashTx, "صندوق اليومي", ["in"]);
  checkTree(ctx.safeTx, "الخزنة", ["in"]);
  checkTree(ctx.custodyTx, "عهدة الكسر", ["fund"]);

  return findings;
}

async function fetchAiAuditNarrative(findingsSummary) {
  const data = await aiApi.chat(
    [
      {
        role: "user",
        content:
          "أنت مدقق حسابات لمحل ذهب. تلقيت قائمة ملاحظات تم استخراجها آليًا (وليس منك) من فحص دقيق للبيانات. رتّبها حسب الأهمية واشرحها بالعربية بإيجاز شديد، جملة أو جملتين لكل ملاحظة، بلا مقدمات ولا خاتمة. إذا كانت القائمة فارغة، اكتب جملة واحدة تفيد بعدم وجود ملاحظات. لا تخترع أرقامًا أو ملاحظات غير موجودة بالقائمة.\n\nالملاحظات:\n" +
          findingsSummary,
      },
    ],
    900
  );
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("empty");
  return text;
}

// Sends the user's free-text report request plus a compact data snapshot and
// asks Claude to return STRICT JSON describing a table — which the app then
// renders as a real downloadable Excel file or a printable PDF. The AI never
// touches money directly; it only organizes data we already computed.

async function fetchAiReportSpec(userRequest, dataSnapshot) {
  const data = await aiApi.chat(
    [
      {
        role: "user",
        content:
          'أنت تُعِدّ تقريرًا جدوليًا من بيانات محل ذهب حسب طلب المستخدم. أعد فقط كائن JSON خام بدون أي نص إضافي أو علامات كود، بهذا الشكل بالضبط: {"title": "عنوان التقرير بالعربية", "columns": ["عمود1","عمود2",...], "rows": [["قيمة","قيمة",...], ...]}. استخدم فقط البيانات المرفقة أدناه، لا تخترع أرقامًا غير موجودة فيها. إذا كان الطلب غامضًا اجتهد لأقرب تفسير معقول.\n\nطلب المستخدم: ' +
          userRequest +
          "\n\nالبيانات المتاحة (JSON):\n" +
          dataSnapshot,
      },
    ],
    2000
  );
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : cleaned);
  if (!parsed.columns || !parsed.rows) throw new Error("bad shape");
  return parsed;
}

// Static, accurate description of every section of the app, kept in code
// (not guessed by the model) so the chat assistant explains "how do I do X"
// correctly instead of hallucinating features that don't exist.

async function fetchAiChatReply(conversation, contextText) {
  const intro = {
    role: "user",
    content:
      "أنت «أونصة»، المساعد الذكي المدمج داخل تطبيق إدارة محل ذهب. مهمتك مزدوجة: (١) شرح كيفية استخدام أي ميزة بالتطبيق بدقة اعتمادًا على دليل الاستخدام أدناه فقط، بدون اختراع صفحات أو أزرار غير موجودة، (٢) الإجابة عن أسئلة المستخدم بخصوص أرقام محله الفعلية المرفقة أدناه. إذا لاحظت رقمًا غريبًا صراحة اذكره كملاحظة، لكن لا تجزم بوجود خطأ إلا إذا كان واضحًا من الأرقام نفسها. أجب بالعربية، مختصر ومباشر، بأسلوب محادثة طبيعي بدون عناوين أو نقاط مرقّمة إلا إذا الرد يحتاجها فعلاً. إذا كان السؤال خارج نطاق التطبيق تمامًا، وضّح بأدب أنك مخصص لمساعدته بالتطبيق وبياناته فقط.\n\nدليل استخدام التطبيق:\n" +
      AI_APP_GUIDE +
      "\n\nبيانات محل المستخدم الحالية:\n" +
      contextText,
  };
  const ack = { role: "assistant", content: "تمام، جاهز أساعدك بالتطبيق أو ببياناتك. تفضل." };
  // ⚠ تنظيف الرسائل قبل الإرسال: عناصر conversation قادمة من AiChatPanel
  // وقد تحمل خصائص إضافية مثل local/suggestions (تُستخدم للعرض في الواجهة
  // فقط) — Anthropic API يرفض أي حقل غير role/content بخطأ 400
  // ("Extra inputs are not permitted")، فأي رسالة برد محلي سابق ضمن نفس
  // المحادثة كانت تُسقط كل الطلب بعدها.
  const cleanConversation = conversation.map(({ role, content }) => ({ role, content }));
  const data = await aiApi.chat([intro, ack, ...cleanConversation], 800);
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("empty");
  return text;
}


// يرسم شعار «أونصة» with every network node twinkling independently —
// each dot gets its own color variant, delay and duration so the glow never
// looks synchronized across the graphic. showDots=false shows just the ball
// (used for compact icon spots); showDots=true includes the wordmark below.

function toLatinDigits(str) {
  return String(str ?? "")
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(EASTERN_INDIC.indexOf(d)))
    .replace(/[٫،]/g, "."); // Arabic decimal separator and comma
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  background: "var(--panel)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  fontFamily: "'Cairo','Tajawal',system-ui,sans-serif",
};

function emptyRow() {
  return {
    key: Math.random().toString(36).slice(2),
    category: CATEGORY_STATE.list[0].id,
    weight: "",
    stonesWeight: "",
    quantity: "1",
    workmanshipPerUnit: "",
    photoDataUrl: null,
    // قطع الطقم: تُحدَّد عند الإدخال ليعرف النظام وقت البيع ماذا يحوي.
    setPieces: [],
  };
}

function reportFindings(M, MB, ctx) {
  const f = [];
  const add = (severity, title, detail) => f.push({ severity, title, detail });
  const cur = ctx.currency;

  // ── الربحية ──
  if (M.salesSum > 0 && M.salesProfit <= 0) {
    add("error", "بيع بلا ربح", `مبيعات ${cur}${fmt(M.salesSum, 0)} بربح ${fmt(M.salesProfit, 0)} — القطع تُباع عند التكلفة أو دونها.`);
  } else if (M.salesSum > 0 && M.margin < 8) {
    add("warning", "هامش ربح منخفض", `الهامش ${fmt(M.margin, 1)}٪ فقط. راجع التسعير أو تكلفة الشراء.`);
  }

  // ── المصروفات مقابل الدخل ──
  if (M.expSum > M.salesSum && M.salesSum > 0) {
    add("error", "المصروفات تتجاوز المبيعات", `صُرف ${cur}${fmt(M.expSum, 0)} مقابل مبيعات ${cur}${fmt(M.salesSum, 0)}.`);
  }
  if (M.net < 0) {
    add("warning", "صافي الحركة سالب", `الفرق ${cur}${fmt(Math.abs(M.net), 0)} — الخارج أكثر من الداخل في هذه الفترة.`);
  }

  // ── الهالك ──
  if (M.purchWeight > 0) {
    const rate = (M.wastage / M.purchWeight) * 100;
    if (rate > 3) {
      add("error", "هالك مرتفع", `${fmtW(M.wastage)} جم من ${fmtW(M.purchWeight)} جم مشتراة (${fmt(rate, 1)}٪). النسبة المعتادة أقل من 2٪.`);
    } else if (rate > 1.5) {
      add("warning", "هالك يستحق المتابعة", `${fmt(rate, 1)}٪ من الوزن المشترى.`);
    }
  }

  // ── مقارنة بالفترة الأخرى ──
  if (MB) {
    const drop = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    const salesΔ = drop(M.salesSum, MB.salesSum);
    if (salesΔ !== null && salesΔ <= -25) {
      add("warning", "انخفاض المبيعات", `أقل بـ${fmt(Math.abs(salesΔ), 0)}٪ عن ${ctx.labelB} (${cur}${fmt(M.salesSum, 0)} مقابل ${cur}${fmt(MB.salesSum, 0)}).`);
    }
    const expΔ = drop(M.expSum, MB.expSum);
    if (expΔ !== null && expΔ >= 30) {
      add("warning", "ارتفاع المصروفات", `أعلى بـ${fmt(expΔ, 0)}٪ عن ${ctx.labelB}.`);
    }
    const marginΔ = M.margin - MB.margin;
    if (marginΔ <= -5) {
      add("warning", "تراجع هامش الربح", `من ${fmt(MB.margin, 1)}٪ إلى ${fmt(M.margin, 1)}٪.`);
    }
    // تصنيف مصروف قفز
    const byA = {}, byB = {};
    M.fExpenses.forEach((e) => (byA[e.category] = (byA[e.category] || 0) + e.amount));
    MB.fExpenses.forEach((e) => (byB[e.category] = (byB[e.category] || 0) + e.amount));
    Object.keys(byA).forEach((k) => {
      const a = byA[k], b = byB[k] || 0;
      if (b > 0 && a > b * 1.8 && a - b > 500) {
        const label = EXPENSE_CATEGORIES.find((c) => c.id === k)?.label || k;
        add("info", `قفزة في «${label}»`, `${cur}${fmt(a, 0)} مقابل ${cur}${fmt(b, 0)} في ${ctx.labelB}.`);
      }
    });
  }

  // ── سلامة البيانات ──
  const openLots = (ctx.lots || []).filter((l) => l.status !== "closed" && (Number(l.enteredWeight) || 0) > 0);
  if (openLots.length > 0) {
    add("info", "دفعات لم تُقفل", `${openLots.length} دفعة أُدخلت بضاعتها ولم تُقفل — الهالك فيها غير محتسب بعد.`);
  }
  const noInvoice = (ctx.lots || []).filter((l) => !l.invoiceAttachId && !l.invoiceFile);
  if (noInvoice.length > 0) {
    add("info", "فواتير مفقودة", `${noInvoice.length} دفعة شراء بلا فاتورة مرفقة.`);
  }
  if ((ctx.cashBalance?.total ?? 0) < -0.01) add("error", "صندوق يومي سالب", `الرصيد ${cur}${fmt(ctx.cashBalance.total, 0)} — حركة لم تُسجّل.`);
  if ((ctx.safeBalance?.total ?? 0) < -0.01) add("error", "خزنة سالبة", `الرصيد ${cur}${fmt(ctx.safeBalance.total, 0)}.`);

  // ── الرواتب ──
  (ctx.users || []).forEach((u) => {
    const salary = Number(u.salary) || 0;
    if (salary <= 0) return;
    const month = new Date().toISOString().slice(0, 7);
    const taken = (ctx.expenses || [])
      .filter((e) => e.employeeId === u.id && (e.periodMonth || e.date.slice(0, 7)) === month)
      .reduce((a, e) => a + e.amount, 0);
    if (taken > salary + 0.01) {
      add("warning", `صرف زائد — ${u.name}`, `استلم ${cur}${fmt(taken, 0)} مقابل راتب ${cur}${fmt(salary, 0)}.`);
    }
  });

  // ── ركود المخزون ──
  // البضاعة الراكدة: ما مضى على إدخاله سنة كاملة ولم يُبع. رأس مال محبوس
  // في قطع لا تتحرك — يستحق قرار تخفيض أو إعادة تصنيع.
  const stale = (ctx.activeItems || []).filter((it) => {
    const src = it.dateAdded || it.createdAt || it.date;
    if (!src) return false;
    const age = (Date.now() - new Date(src).getTime()) / 86400000;
    return age > 365;
  });
  if (stale.length > 0) {
    const w = stale.reduce((a, it) => a + (Number(it.weight) || 0) * (it.units || []).filter((u) => !u.sold).length, 0);
    add(
      "info",
      "بضاعة راكدة",
      `${stale.length} صنف (${fmtW(w)} جم) مضى على إدخاله أكثر من سنة ولم يُبع — رأس مال محبوس.`
    );
  }

  return f;
}

/// كشف «الأرقام المخفية»: فروقات لا تظهر في التقارير العادية لأنها ليست
/// بندًا في أي جدول — بل فجوة بين جدولين. مطابقة القيود بأرصدة الصناديق
/// وبالمخزون هي ما يكشف العملية التي لم تُسجَّل أو سُجّلت مرتين.

function hiddenNumbersScan(ctx) {
  const out = [];
  const cur = ctx.currency;
  const add = (severity, title, detail, gap) => out.push({ severity, title, detail, gap: gap || 0 });
  const near = (a, b) => Math.abs(a - b) < 0.01;

  // ١. مطابقة دفتر الصندوق برصيده المعروض
  const ledgerCash = (ctx.cashTx || []).reduce((a, t) => a + (t.type === "in" ? t.amount : -t.amount), 0);
  const shownCash = ctx.cashBalance?.total ?? 0;
  const baseCash = (ctx.openingBalance?.dailyCash || 0) + (ctx.openingBalance?.dailyNetwork || 0);
  if (!near(ledgerCash + baseCash, shownCash)) {
    const gap = shownCash - (ledgerCash + baseCash);
    add("error", "فرق غير مفسَّر في صندوق اليومي",
      `مجموع القيود ${cur}${fmt(ledgerCash + baseCash, 2)} والرصيد المعروض ${cur}${fmt(shownCash, 2)}.`, gap);
  }

  // ٢. مطابقة دفتر الخزنة
  const ledgerSafe = (ctx.safeTx || []).reduce((a, t) => a + (t.type === "in" ? t.amount : -t.amount), 0);
  const shownSafe = ctx.safeBalance?.total ?? 0;
  const baseSafe = (ctx.openingBalance?.safeCash || 0) + (ctx.openingBalance?.safeNetwork || 0);
  if (!near(ledgerSafe + baseSafe, shownSafe)) {
    add("error", "فرق غير مفسَّر في الخزنة",
      `مجموع القيود ${cur}${fmt(ledgerSafe + baseSafe, 2)} والرصيد المعروض ${cur}${fmt(shownSafe, 2)}.`,
      shownSafe - (ledgerSafe + baseSafe));
  }

  // ٣. مبيعات بلا قيد نقدي مقابل
  const saleIds = new Set((ctx.sales || []).map((x) => x.id));
  const bookedSaleIds = new Set(
    (ctx.cashTx || []).filter((t) => t.source === "sale" && t.refId).map((t) => t.refId)
  );
  const unbooked = [...saleIds].filter((id) => !bookedSaleIds.has(id));
  if (unbooked.length > 0) {
    const amt = (ctx.sales || []).filter((x) => unbooked.includes(x.id)).reduce((a, x) => a + x.total, 0);
    add("error", "فواتير بلا قيد في الصندوق",
      `${unbooked.length} فاتورة بقيمة ${cur}${fmt(amt, 0)} لم يقابلها دخول نقدي.`, amt);
  }

  // ٤. قيود بلا تصنيف محاسبي — لا تظهر في أي تقرير حسب التصنيف
  const untagged = [...(ctx.cashTx || []), ...(ctx.safeTx || [])].filter((t) => !t.category);
  if (untagged.length > 0) {
    const amt = untagged.reduce((a, t) => a + Math.abs(t.amount), 0);
    add("warning", "قيود بلا تصنيف",
      `${untagged.length} قيد بقيمة ${cur}${fmt(amt, 0)} لا يظهر في التقارير المصنّفة.`, amt);
  }

  // ٥. مشتريات بلا قيد خروج نقدي (وليست آجلة ولا تسكيرًا)
  const cashPaidLots = (ctx.lots || []).filter((l) => l.paymentMethod !== "deferred" && l.paymentMethod !== "office");
  const purchaseRefs = new Set(
    [...(ctx.cashTx || []), ...(ctx.safeTx || [])].filter((t) => t.source === "purchase" && t.refId).map((t) => t.refId)
  );
  const unpaid = cashPaidLots.filter((l) => l.purchaseId && !purchaseRefs.has(l.purchaseId));
  const uniqUnpaid = [...new Set(unpaid.map((l) => l.purchaseId))];
  if (uniqUnpaid.length > 0) {
    const amt = unpaid.reduce((a, l) => a + (Number(l.totalCost) || 0), 0);
    add("error", "مشتريات بلا قيد سداد",
      `${uniqUnpaid.length} عملية شراء بقيمة ${cur}${fmt(amt, 0)} لم يُسجَّل خروج مقابلها.`, amt);
  }

  // ٦. وزن مشترى لم يدخل المخزون ولم يُسجَّل هالكًا
  let ghostWeight = 0;
  (ctx.lots || []).forEach((l) => {
    if (l.status === "closed") return;
    const gap = (Number(l.weight) || 0) - (Number(l.enteredWeight) || 0);
    if (gap > 0.001 && (Number(l.enteredWeight) || 0) > 0) ghostWeight += gap;
  });
  if (ghostWeight > 0.01) {
    add("warning", "وزن ذهب غير محسوب",
      `${fmtW(ghostWeight)} جم مشتراة لم تدخل المخزون ولم تُسجَّل هالكًا — دفعات لم تُقفل.`,
      ghostWeight * (ctx.price24 || 0));
  }

  // ٧. أكواد قطع مكررة — بيع القطعة الخطأ
  const codeSeen = new Map();
  const dupCodes = [];
  (ctx.items || []).forEach((it) =>
    (it.units || []).forEach((u) => {
      if (codeSeen.has(u.code)) dupCodes.push(u.code);
      else codeSeen.set(u.code, it.id);
    })
  );
  if (dupCodes.length > 0) {
    add("error", "أكواد رقاقات مكررة",
      `${dupCodes.length} كود مستخدم لأكثر من قطعة — قراءة الماسح قد تبيع القطعة الخطأ.`);
  }

  // ٨. أصناف بلا دفعة مصدر — تكلفتها غير قابلة للتتبّع
  const lotIds = new Set((ctx.lots || []).map((l) => l.id));
  const orphanItems = (ctx.items || []).filter((it) => it.lotId && !lotIds.has(it.lotId));
  if (orphanItems.length > 0) {
    add("warning", "أصناف بلا دفعة شراء",
      `${orphanItems.length} صنف مرتبط بدفعة غير موجودة — تكلفته غير قابلة للتحقق.`);
  }

  // ٩. مصروفات بلا مصدر صرف — لا تُخصم من أي صندوق
  const noSource = (ctx.expenses || []).filter((e) => !e.fundingSource);
  if (noSource.length > 0) {
    const amt = noSource.reduce((a, e) => a + e.amount, 0);
    add("error", "مصروفات لم تُخصم من صندوق",
      `${noSource.length} مصروف بقيمة ${cur}${fmt(amt, 0)} بلا مصدر صرف.`, amt);
  }

  // ١٠. قطع مباعة ما زالت تُحسب في المخزون
  const soldButCounted = (ctx.items || []).filter((it) => {
    const sold = (it.units || []).filter((u) => u.sold).length;
    const total = (it.units || []).length;
    return sold > total;
  });
  if (soldButCounted.length > 0) {
    add("error", "قطع مباعة أكثر من المتوفر", `${soldButCounted.length} صنف بيعت منه قطع تفوق كميته.`);
  }

  // ١١. سلف لموظفين بلا راتب مسجّل
  const noSalary = (ctx.expenses || []).filter((e) => {
    if (e.category !== "advance" && e.category !== "salaries") return false;
    const u = (ctx.users || []).find((x) => x.id === e.employeeId);
    return u && (Number(u.salary) || 0) <= 0;
  });
  if (noSalary.length > 0) {
    add("info", "رواتب بلا مرجع",
      `${noSalary.length} حركة راتب أو سلفة لموظفين بلا راتب مسجّل — لا يمكن معرفة المتبقي لهم.`);
  }

  return out;
}

/// يبني ملخصًا نصيًا للأرقام يُمرَّر للنموذج. أرقام فقط، بلا استنتاجات.

function reportFactsText(M, MB, ctx) {
  const cur = ctx.currency;
  const lines = [
    `الفترة: ${ctx.label}`,
    `المبيعات: ${cur}${fmt(M.salesSum, 0)} من ${M.salesCount} فاتورة · متوسط الفاتورة ${cur}${fmt(M.avgSale, 0)}`,
    `الأرباح المحققة: ${cur}${fmt(M.salesProfit, 0)} · هامش ${fmt(M.margin, 1)}٪`,
    `  منها ربح تشغيلي (من المصنعية والهامش): ${cur}${fmt(M.operatingProfit, 0)} · هامش تشغيلي ${fmt(M.operatingMargin, 1)}٪`,
    `  منها ربح رأسمالي (من تغيّر سعر المعدن): ${cur}${fmt(M.capitalGain, 0)}`,
    `  قيمة المعدن المباع: ${cur}${fmt(M.metalValueSold, 0)} — ليست ربحًا`,
    `مشتريات الذهب: ${cur}${fmt(M.purchGold, 0)} (موردون ${fmt(M.supplierGold, 0)} · أجور ${fmt(M.supplierFees, 0)} · كسر ${fmt(M.scrapCost, 0)} · تسكير ${fmt(M.taskirCost, 0)})`,
    `الوزن المشترى: ${fmtW(M.purchWeight)} جم · هالك ${fmtW(M.wastage)} جم · فائض ${fmtW(M.surplus)} جم`,
    `المصروفات: ${cur}${fmt(M.expSum, 0)} (ثابتة ${fmt(M.expFixed, 0)} · يومية ${fmt(M.expDaily, 0)} · مشتريات غير ذهبية ${fmt(M.purchNonGold, 0)})`,
    `صافي الحركة: ${cur}${fmt(M.net, 0)}`,
  ];
  const byCat = {};
  M.fExpenses.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));
  const catStr = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${EXPENSE_CATEGORIES.find((c) => c.id === k)?.label || k}: ${fmt(v, 0)}`)
    .join(" · ");
  if (catStr) lines.push(`تفصيل المصروفات: ${catStr}`);

  lines.push(
    `الأرصدة الحالية: صندوق يومي ${cur}${fmt(ctx.cashBalance?.total || 0, 0)} · خزنة ${cur}${fmt(ctx.safeBalance?.total || 0, 0)} · عهدة ${cur}${fmt(ctx.custodyTotal || 0, 0)}`
  );
  lines.push(
    `المخزون: ${ctx.totals?.pieces || 0} قطعة · ${fmtW(ctx.totals?.fineWeight || 0)} جم عيار 24 · تكلفة ${cur}${fmt(ctx.totals?.cost || 0, 0)} · قيمة ${cur}${fmt(ctx.totals?.value || 0, 0)}`
  );
  lines.push(`الرصيد الإجمالي بعيار 24: ${fmtW(ctx.goldEquivalentGrams || 0)} جم · سعر الجرام ${cur}${fmt(ctx.price24 || 0)}`);

  if (MB) {
    lines.push("");
    lines.push(`— للمقارنة، ${ctx.labelB} —`);
    lines.push(`المبيعات: ${cur}${fmt(MB.salesSum, 0)} من ${MB.salesCount} فاتورة · هامش ${fmt(MB.margin, 1)}٪`);
    lines.push(`مشتريات الذهب: ${cur}${fmt(MB.purchGold, 0)} · المصروفات: ${cur}${fmt(MB.expSum, 0)}`);
    lines.push(`صافي الحركة: ${cur}${fmt(MB.net, 0)}`);
  }
  return lines.join("\n");
}

/// تتبّع مصدر فرق أو نقص.
///
/// السؤال «من وين جاي هذا النقص؟» لا يُجاب من ملخّص — يُجاب من السجلات
/// نفسها. لذلك يُصنَّف السؤال إلى موضوع، ثم تُجمع الأدلة الفعلية لذلك
/// الموضوع بالكود، ويُطلب من النموذج ترتيبها وشرحها لا استنتاجها.

function detectTraceTopic(q) {
  const t = String(q || "").toLowerCase();
  let best = null;
  let score = 0;
  TRACE_TOPICS.forEach((topic) => {
    const n = topic.words.filter((w) => t.includes(w)).length;
    if (n > score) {
      score = n;
      best = topic;
    }
  });
  return best;
}

/// يجمع الأدلة الفعلية للموضوع. كل عنصر يحمل قيمته ومرجعه وتاريخه ومنفّذه
/// — فالإجابة تُشير إلى سجل يمكن فتحه لا إلى تخمين.

async function askReportAi(messages, maxTokens = 900) {
  const data = await aiApi.chat(messages, maxTokens);
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  if (!text) throw new Error("empty");
  return text;
}

function periodRange(period, from, to, openDayId) {
  // يوم العمل يُميَّز بمعرّفه لا بنطاق زمني — قد يمتد عبر منتصف الليل.
  if (period === "businessDay") return { start: new Date(0), end: new Date(8640000000000), dayId: openDayId || "__none__" };
  const now = new Date();
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  if (period === "today") return { start: startOf(now), end: endOf(now) };
  if (period === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { start: startOf(y), end: endOf(y) };
  }
  if (period === "week") {
    // الأسبوع يبدأ السبت في التقويم المحلي — لا الأحد كما هو الافتراضي.
    const d = new Date(now);
    const back = (d.getDay() + 1) % 7; // السبت = 6 في getDay
    d.setDate(d.getDate() - back);
    return { start: startOf(d), end: endOf(now) };
  }
  if (period === "month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOf(now) };
  }
  // مخصص: تاريخ ناقص يعني حدًّا مفتوحًا من تلك الجهة، لا نطاقًا فارغًا.
  return {
    start: from ? startOf(new Date(from)) : new Date(0),
    end: to ? endOf(new Date(to)) : endOf(now),
  };
}

function useVoice(locale = "ar-SA") {
  const [listening, setListening] = useState(false);
  // ⚠ معرّف الرسالة الجارٍ نطقها حاليًا (لا boolean عام) — كان speaking
  // مشتركًا بين كل زرّ "استماع" في كل الرسائل، فالضغط على زرّ رسالة وأخرى
  // تُقرأ تلقائيًا (autoSpeak) كان يُطفئ تلك القراءة بدل بدء قراءة جديدة،
  // ويُظهر كل الأزرار "إيقاف" معًا رغم أن رسالة واحدة فقط تتكلم فعلًا.
  const [speakingId, setSpeakingId] = useState(null);
  const speaking = speakingId != null;
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef(null);

  const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const sttSupported = !!SR;
  const ttsSupported = typeof window !== "undefined" && !!window.speechSynthesis;

  // إيقاف كل شيء عند إغلاق الشاشة — ترك التعرّف يعمل بالخلفية يُبقي
  // الميكروفون مفتوحًا وهو ما لا يتوقعه المستخدم.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch (e) {
        /* المتصفح أغلقه سلفًا */
      }
      try {
        window.speechSynthesis?.cancel();
      } catch (e) {
        /* لا شيء قيد النطق */
      }
    };
  }, []);

  const startListening = (onResult) => {
    if (!sttSupported) {
      setVoiceError("الإدخال الصوتي غير مدعوم في هذا المتصفح");
      return;
    }
    setVoiceError("");
    try {
      window.speechSynthesis?.cancel(); // لا نستمع ونتحدث معًا
      setSpeakingId(null);

      const rec = new SR();
      rec.lang = locale;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      let finalText = "";
      rec.onresult = (ev) => {
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finalText += t;
          else interim += t;
        }
        onResult(finalText + interim, !!finalText);
      };
      rec.onerror = (ev) => {
        setListening(false);
        const map = {
          "not-allowed": "لم يُسمح بالوصول للميكروفون — فعّل الإذن من إعدادات المتصفح",
          "service-not-allowed": "خدمة التعرّف الصوتي محجوبة في هذا السياق",
          "no-speech": "لم يُلتقط صوت — حاول مرة أخرى",
          "audio-capture": "لا يوجد ميكروفون متاح",
          network: "تعذّر الاتصال بخدمة التعرّف الصوتي",
        };
        setVoiceError(map[ev.error] || "تعذّر التعرّف على الصوت");
      };
      rec.onend = () => setListening(false);

      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch (e) {
      console.error("speech start failed", e);
      setListening(false);
      setVoiceError("تعذّر تشغيل الميكروفون");
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch (e) {
      /* توقف سلفًا */
    }
    setListening(false);
  };

  // ⚠ id يميّز أي رسالة تُقرأ الآن؛ افتراضيًا نص الرسالة نفسه (فريد بما
  // يكفي عمليًا بين رسائل محادثة واحدة). AiChatPanel يقارن speakingId
  // بمعرّف رسالته هو فقط، فزرّ رسالة لا يتأثر بقراءة رسالة أخرى.
  const speak = (text, id = text) => {
    if (!ttsSupported || !text) return;
    try {
      window.speechSynthesis.cancel();
      // ⚠ تنظيف رموز Markdown قبل النطق: ردود الذكاء الاصطناعي قد تحوي
      // **تعريض** أو *تمييل* أو `كود` أو # عناوين — بعض محركات النطق
      // العربية (خصوصًا في Chrome) تتعثر بهذه الرموز فتنطق الأرقام فقط
      // وتتجاهل الكلام العادي المحيط بها بدل تجاهل الرمز ببساطة.
      const spoken = text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/^#{1,6}\s*/gm, "")
        .replace(/[*_`#]/g, "");
      const u = new SpeechSynthesisUtterance(spoken);
      u.lang = locale;
      u.rate = 0.95; // أبطأ قليلًا: النطق الافتراضي للعربية سريع ويصعب متابعته
      u.pitch = 1;
      // اختر صوتًا عربيًا إن وُجد، وإلا اترك الافتراضي للمتصفح
      const arVoice = window.speechSynthesis.getVoices().find((v) => (v.lang || "").toLowerCase().startsWith("ar"));
      if (arVoice) u.voice = arVoice;
      u.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
      u.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
      setSpeakingId(id);
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.error("tts failed", e);
      setSpeakingId(null);
    }
  };

  const stopSpeaking = () => {
    try {
      window.speechSynthesis?.cancel();
    } catch (e) {
      /* لا شيء */
    }
    setSpeakingId(null);
  };

  return { listening, speaking, speakingId, voiceError, sttSupported, ttsSupported, startListening, stopListening, speak, stopSpeaking };
}

function onlineBlockReason(item, unitCode) {
  if (!item) return null;
  const u = (item.units || []).find((x) => x.code === unitCode);
  const st = u?.onlineStatus || item.onlineStatus;
  if (!st) return null;
  const info = ONLINE_STATUS[st];
  if (!info?.blocks) return null;
  const orderRef = u?.onlineOrderRef || item.onlineOrderRef;
  return `${info.label}${orderRef ? ` — طلب ${orderRef}` : ""}`;
}

/// يبني ردّ المخزون للمتجر: ما هو متاح فعلًا للبيع أونلاين.
/// المحجوز والمباع مستثنيان — نشرهما يعني بيع ما ليس عندك.

const btSupported = () =>
  typeof navigator !== "undefined" && !!navigator.bluetooth && typeof navigator.bluetooth.requestDevice === "function";

function useDebounced(value, ms = 220) {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
//  قارئ RFID — بروتوكول NHR-10 (بلوتوث) + قارئ HID (لوحة مفاتيح)
//
//  منقول حرفيًا عن بروتوكول المصنّع في نسخة المرجع (نفس الثوابت في
//  core/constants.js: NHR/NHR_POWER_MAX_DBM/RFID_SECTIONS/RFID_DEFAULTS)
//  بقرارك الصريح: NHR-10 + HID + الكاميرا/الإدخال اليدوي كبدائل.
//
//  ⚠ فرقٌ جوهري عن المرجع: هناك matchEpcToUnits تعمل على بيانات محلية
//  بحتة (لا سيرفر). هنا item_units.epc عمود حقيقي في قاعدة البيانات
//  (migration 014) — الربط يُكتب بـapi.rfid.bind فيظهر لكل مستخدم بعد
//  أي تحديث، لا في متصفح من ربطها فقط.
// ═══════════════════════════════════════════════════════════════════════

/// هل هذه الحمولة إطار EPC حيّ أم ردّ JSON؟
function nhrIsLiveFrame(bytes) {
  return !!bytes && bytes.length >= 9
    && bytes[0] === NHR.MAGIC_LIVE[0] && bytes[1] === NHR.MAGIC_LIVE[1];
}

const nhrHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join("");

/// يفكّ إطار الجرد الحيّ.
///
/// البنية: 4E 48 | نسخة | نوع | تسلسل u32le | عدد | ثم لكل عنصر:
/// طول EPC u8 · بايتات EPC · rssi i8 · delta u16le · total u32le
function nhrParseLiveFrame(bytes) {
  if (!nhrIsLiveFrame(bytes)) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const seq = dv.getUint32(4, true);
  const count = bytes[8];
  const tags = [];
  let p = 9;
  for (let i = 0; i < count; i++) {
    // ⚠ نتحقّق من الطول قبل كل قراءة: حزمةٌ مبتورة تُنتج قراءةً خارج
    // الحدود، وDataView يرمي — فيسقط الإشعار كلّه بدل ما وصل منه.
    if (p >= bytes.length) break;
    const epcLen = bytes[p]; p += 1;
    if (epcLen === 0 || epcLen > NHR.MAX_EPC_BYTES || p + epcLen + 7 > bytes.length) break;
    const epc = nhrHex(bytes.subarray(p, p + epcLen)); p += epcLen;
    const rssi = dv.getInt8(p); p += 1;
    const delta = dv.getUint16(p, true); p += 2;
    const total = dv.getUint32(p, true); p += 4;
    tags.push({ epc, rssi, delta, total });
  }
  return { seq, count, tags, truncated: tags.length < count };
}

function nhrParseJson(bytes) {
  try {
    const text = new TextDecoder("utf-8").decode(bytes).trim();
    if (!text || text[0] !== "{") return null;
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

/// يصنّف أي إشعار من 0xFF01.
function nhrClassify(bytes) {
  if (nhrIsLiveFrame(bytes)) return { kind: "live", frame: nhrParseLiveFrame(bytes) };
  const json = nhrParseJson(bytes);
  if (!json) return { kind: "unknown" };
  if (json.status === "err" && json.msg === "busy") return { kind: "busy", json };
  if (json.cmd === "SAVE") return { kind: "save", json };
  return { kind: "json", json };
}

const nhrCrc32 = (() => {
  let table = null;
  return (bytes) => {
    if (!table) {
      table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (const b of bytes) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
})();

/// يفكّ ملف الدفعة NHRB ويتحقّق من سلامته.
///
/// ⚠ التحقّق قبل الاستعمال: ملفٌ مبتور يُنتج قائمة EPC ناقصة تبدو
/// سليمة — والجرد يُعلن عجزًا لم يقع.
function nhrParseBatchFile(bytes) {
  if (!bytes || bytes.length < NHR.HEADER_LEN) return { ok: false, why: "ملف أقصر من الترويسة" };
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== NHR.MAGIC_FILE) return { ok: false, why: `توقيع غير معروف: ${magic}` };
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = bytes[4];
  const headerLen = bytes[5] || NHR.HEADER_LEN;
  const recLen = bytes[7] || NHR.REC_LEN;
  const recordCount = dv.getUint32(8, true);
  const payloadBytes = dv.getUint32(12, true);
  const crcStated = dv.getUint32(16, true);
  const stamp = dv.getUint32(20, true);
  const payload = bytes.subarray(headerLen, headerLen + payloadBytes);
  if (payload.length < payloadBytes) {
    return { ok: false, why: `الحمولة مبتورة: ${payload.length} من ${payloadBytes}` };
  }
  const crcActual = nhrCrc32(payload);
  if (crcStated !== 0 && crcActual !== crcStated) {
    return { ok: false, why: "CRC لا يطابق — الملف تالف" };
  }
  const epcs = [];
  for (let p = 0; p + recLen <= payload.length; p += recLen) {
    const len = payload[p];
    if (len === 0 || len > NHR.MAX_EPC_BYTES) continue;   // سجلّ محشوّ بأصفار
    epcs.push(nhrHex(payload.subarray(p + 1, p + 1 + len)));
  }
  return {
    ok: true, version, recordCount, payloadBytes,
    crc: crcActual, readerStamp: stamp,
    epcs,
    // العدد المُعلَن قد يخالف المقروء إن حُشيت سجلات — يُقال ولا يُخفى
    countMatches: epcs.length === recordCount,
  };
}

/// يجمّع حزم 0xFF03 في ملفٍ واحد.
///
/// ⚠ البايتان الأولان ترويسة تسلسل لا بيانات. الدليل يُحذّر صراحةً:
/// من يُمرّرهما للمُفكّك يحصل على توقيعٍ خاطئ ويظنّ الملف تالفًا.
function createNhrFileAssembler() {
  const chunks = new Map();
  let meta = null;
  let done = false;
  let error = null;
  return {
    /// يُعيد: "start" | "data" | "eof" | "error" | "late"
    feed(bytes) {
      if (!bytes || bytes.length < 2) return "late";
      const seq = (bytes[0] << 8) | bytes[1];
      const body = bytes.subarray(2);
      if (seq === NHR.PKT_START) { meta = nhrParseJson(body) || {}; return "start"; }
      if (seq === NHR.PKT_EOF) { done = true; return "eof"; }
      // ⚠ التسلسل 0 يحمل معنيين في الدليل: حزمة خطأ، وأول حزمة بيانات.
      // نُفرّق بالمحتوى: الخطأ حمولته JSON تحمل `error`، والبيانات
      // بايتات خام. الاعتماد على الرقم وحده يُسقط أول 20 بايت من كل
      // ملف — والتوقيع يصير NHRB ناقصًا.
      if (seq === NHR.PKT_ERR) {
        const j = nhrParseJson(body);
        if (!j || (j.error === undefined && j.state === undefined)) {
          chunks.set(seq, body);
          return "data";
        }
        error = j.error === 1 ? "لا ملف محفوظ على القارئ"
          : j.state === "busy" ? "القارئ يحفظ أو يرفع — أعد المحاولة"
            : "خطأ في نقل الملف";
        return "error";
      }
      if (done) return "late";
      chunks.set(seq, body);
      return "data";
    },
    get meta() { return meta; },
    get error() { return error; },
    get received() { return chunks.size; },
    get complete() { return done; },
    /// يجمع الحزم بترتيب تسلسلها — لا بترتيب وصولها
    assemble() {
      if (error) return { ok: false, why: error };
      const keys = [...chunks.keys()].sort((a, b) => a - b);
      const missing = keys.length ? keys.filter((k, i) => i > 0 && k !== keys[i - 1] + 1) : [];
      if (missing.length) return { ok: false, why: `حزم مفقودة عند ${missing[0]}` };
      const total = keys.reduce((a, k) => a + chunks.get(k).length, 0);
      const out = new Uint8Array(total);
      let p = 0;
      for (const k of keys) { out.set(chunks.get(k), p); p += chunks.get(k).length; }
      return nhrParseBatchFile(out);
    },
  };
}

/// يبني أمرًا نصيًّا لقناة 0xFF01.
///
/// ⚠ المفتاح `val` لا `value`: الدليل ينصّ عليه، والفرق صامت — الجهاز
/// يقبل الأمر ويتجاهل المعامل.
function nhrCommand(cmd, params = {}) {
  const body = JSON.stringify({ cmd, ...params });
  if (body.length > 500) throw new Error("أمر أطول من حدّ 512 بايت");
  return new TextEncoder().encode(body);
}

const nhrCommands = () => ({
  identify: () => nhrCommand("DI"),
  battery: () => nhrCommand("GB"),
  readerInfo: () => nhrCommand("GRI"),
  temperature: () => nhrCommand("GT"),
  getPower: () => nhrCommand("GP"),
  setPower: (dbm) => nhrCommand("SP", { val: Math.max(0, Math.min(30, Math.round(dbm))) }),
  getProfile: () => nhrCommand("GRP"),
  setProfile: (profile, q, session, target) => nhrCommand("SRP", { val: `${profile},${q},${session},${target}` }),
  getQuery: () => nhrCommand("GQP"),
  startLive: () => nhrCommand("S"),
  stop: () => nhrCommand("X"),
  startBatch: () => nhrCommand("SB"),
  stopBatch: () => nhrCommand("XB"),
  find: (epc) => nhrCommand("F", { val: String(epc || "").toUpperCase() }),
  popup: (content, beep = true) => nhrCommand("POPUP", { content: String(content).slice(0, 60), beep }),
});

/// خطاف الاتصال بقارئ NHR-10 عبر بلوتوث الويب — يتصل، يزامن الحالة،
/// يبدأ/يوقف المسح الحي أو الدفعي، يبحث عن بطاقة بعينها، يضبط الطاقة،
/// ويرفع ملف دفعة محفوظ على القارئ.
function useNhrReader({ onTags, onBatch, onLog, config } = {}) {
  const [state, setState] = useState("idle");     // idle | connecting | ready | live | batch | saving | uploading | error
  const [device, setDevice] = useState(null);
  const [info, setInfo] = useState({});           // اسم · بطارية · طاقة · ملف RF
  const [err, setErr] = useState("");
  const refs = useRef({ cmd: null, ctrl: null, data: null, asm: null, lastScanAt: 0 });
  // ⚠ المعالجات في مرجع لا في اعتمادية: إعادة الاشتراك مع كل رسم تُسقط
  // إشعاراتٍ وصلت بين الإلغاء والاشتراك — ووسطها قراءات ضاعت.
  const cbs = useRef({});
  cbs.current = { onTags, onBatch, onLog };
  // ⚠ الإعداد في مرجع لا في اعتمادية: وضعُه اعتماديةً يُعيد بناء `connect`
  // مع كل تغيير إعداد، فتُلغى الاشتراكات وتُعاد — ووسطها قراءات تضيع.
  const cfgRef = useRef(null);
  cfgRef.current = config || null;

  const supported = typeof navigator !== "undefined" && !!navigator.bluetooth;

  const log = useCallback((line) => { cbs.current.onLog?.(line); }, []);

  const handleCmdNotify = useCallback((ev) => {
    const bytes = new Uint8Array(ev.target.value.buffer);
    const c = nhrClassify(bytes);
    if (c.kind === "live" && c.frame) {
      if (c.frame.truncated) log("⚠ إطار مبتور — قراءات جزئية");
      cbs.current.onTags?.(c.frame.tags);
      return;
    }
    if (c.kind === "busy") { setErr("القارئ مشغول — أوقف المسح ثم أعد المحاولة"); log("busy"); return; }
    if (c.kind === "save") {
      setState(c.json.state === "saved" ? "ready" : "saving");
      log(`حفظ: ${c.json.state}${c.json.progress != null ? ` ${c.json.progress}٪` : ""}`);
      if (c.json.state === "save_failed") setErr("فشل حفظ الدفعة على القارئ");
      return;
    }
    if (c.kind === "json") {
      const j = c.json;
      setInfo((prev) => ({
        ...prev,
        ...(j.cmd === "DI" ? { name: j.val } : {}),
        ...(j.cmd === "GB" ? { battery: j } : {}),
        ...(j.cmd === "GP" ? { power: j.val } : {}),
        ...(j.cmd === "GRP" ? { profile: j.val } : {}),
        ...(j.cmd === "GT" ? { temp: j.val } : {}),
        ...(j.cmd === "F" ? { findRssi: j.rssi ?? j.val } : {}),
        ...(j.cmd === "XB" ? { batchCount: j.count } : {}),
      }));
      log(`${j.cmd}: ${JSON.stringify(j).slice(0, 90)}`);
    }
  }, [log]);

  const handleFileNotify = useCallback((ev) => {
    const bytes = new Uint8Array(ev.target.value.buffer);
    const asm = refs.current.asm;
    if (!asm) return;
    const kind = asm.feed(bytes);
    if (kind === "error") { setErr(asm.error || "فشل نقل الملف"); setState("ready"); return; }
    if (kind === "eof") {
      const out = asm.assemble();
      refs.current.asm = null;
      setState("ready");
      if (!out.ok) { setErr(out.why); return; }
      if (!out.countMatches) log(`⚠ العدد المُعلَن ${out.recordCount} والمقروء ${out.epcs.length}`);
      cbs.current.onBatch?.(out);
    }
  }, [log]);

  const write = useCallback(async (bytes) => {
    const ch = refs.current.cmd;
    if (!ch) throw new Error("غير متصل");
    // writeValueWithResponse يُبلّغ بالفشل؛ بلا استجابة يبتلع الخطأ
    await (ch.writeValueWithResponse ? ch.writeValueWithResponse(bytes) : ch.writeValue(bytes));
  }, []);

  const connect = useCallback(async () => {
    if (!supported) { setErr("متصفّحك لا يدعم البلوتوث — استعمل كروم على أندرويد أو الحاسب"); return false; }
    setErr(""); setState("connecting");
    try {
      const dev = await navigator.bluetooth.requestDevice({
        filters: [{ name: NHR.DEVICE_NAME }, { services: [NHR.SERVICE] }],
        optionalServices: [NHR.SERVICE],
      });
      const server = await dev.gatt.connect();
      const svc = await server.getPrimaryService(NHR.SERVICE);
      const cmd = await svc.getCharacteristic(NHR.CMD);
      const ctrl = await svc.getCharacteristic(NHR.FILE_CTRL).catch(() => null);
      const data = await svc.getCharacteristic(NHR.FILE_DATA).catch(() => null);
      refs.current = { ...refs.current, cmd, ctrl, data };
      // ⚠ الاشتراك قبل أي أمر: الدليل ينصّ عليه، وإلا ضاع أول ردّ
      await cmd.startNotifications();
      cmd.addEventListener("characteristicvaluechanged", handleCmdNotify);
      if (data) {
        await data.startNotifications();
        data.addEventListener("characteristicvaluechanged", handleFileNotify);
      }
      dev.addEventListener("gattserverdisconnected", () => {
        setState("idle"); setDevice(null);
        setErr("انقطع الاتصال بالقارئ");
      });
      setDevice(dev); setState("ready");
      // مزامنة الحالة كما يوصي الدليل
      for (const c of [nhrCommands().identify(), nhrCommands().battery(), nhrCommands().getPower(), nhrCommands().getProfile()]) {
        await write(c);
        await new Promise((r) => setTimeout(r, 120));
      }
      // ⚠ الإعدادات بعد المزامنة لا قبلها: الدليل يمنع أوامر الراديو أثناء
      // أي نشاط، والقارئ لحظةَ الاتصال قد يُنهي جلسةً سابقة. وبعد ردّ
      // GRP نكون واثقين أنه خامل.
      const wanted = cfgRef.current;
      if (wanted && wanted.enabled !== false) {
        if (wanted.power != null) {
          await write(nhrCommands().setPower(Math.min(wanted.power, NHR_POWER_MAX_DBM)));
          await new Promise((r) => setTimeout(r, 140));
        }
        if (wanted.profile != null) {
          await write(nhrCommands().setProfile(wanted.profile, wanted.q ?? 6, wanted.session ?? 1, wanted.target ?? 0));
          await new Promise((r) => setTimeout(r, 140));
          await write(nhrCommands().getPower());
        }
      }
      return true;
    } catch (e) {
      setState("idle");
      setErr(e && e.name === "NotFoundError" ? "لم تختر جهازًا" : `تعذّر الاتصال: ${e && e.message}`);
      return false;
    }
  }, [supported, handleCmdNotify, handleFileNotify, write]);

  const disconnect = useCallback(() => {
    try { device?.gatt?.disconnect(); } catch (e) { /* مقطوع سلفًا */ }
    setDevice(null); setState("idle");
  }, [device]);

  /// يحترم مهلة 300 مللي بين أوامر بدء/إيقاف المسح
  const scanCommand = useCallback(async (bytes, next) => {
    const gap = Date.now() - refs.current.lastScanAt;
    if (gap < NHR.SCAN_GAP_MS) await new Promise((r) => setTimeout(r, NHR.SCAN_GAP_MS - gap));
    refs.current.lastScanAt = Date.now();
    await write(bytes);
    setState(next);
  }, [write]);

  const startLive = useCallback(() => scanCommand(nhrCommands().startLive(), "live"), [scanCommand]);
  const stop = useCallback(() => scanCommand(nhrCommands().stop(), "ready"), [scanCommand]);
  const startBatch = useCallback(() => scanCommand(nhrCommands().startBatch(), "batch"), [scanCommand]);
  const stopBatch = useCallback(() => scanCommand(nhrCommands().stopBatch(), "saving"), [scanCommand]);
  const find = useCallback((epc) => write(nhrCommands().find(epc)).then(() => setState("live")), [write]);

  const setPower = useCallback(async (dbm) => {
    if (state === "live" || state === "batch" || state === "saving") {
      setErr("أوقف المسح قبل تغيير الطاقة");
      return false;
    }
    if (dbm > NHR_POWER_MAX_DBM) {
      setErr(`الحدّ المسموح ${NHR_POWER_MAX_DBM} dBm في هذه المنطقة`);
      return false;
    }
    await write(nhrCommands().setPower(dbm));
    await write(nhrCommands().getPower());
    return true;
  }, [state, write]);

  /// يسحب ملف الدفعة المحفوظ.
  ///
  /// ⚠ بعد `saved` فقط: الدليل يُحذّر من الرفع أثناء الحفظ، والجهاز يردّ
  /// بـ`busy` فيُظنّ الملف مفقودًا.
  const uploadBatch = useCallback(async () => {
    const { ctrl, data } = refs.current;
    if (!ctrl || !data) { setErr("قناة الملفات غير متاحة"); return false; }
    if (state === "saving") { setErr("انتظر اكتمال الحفظ"); return false; }
    refs.current.asm = createNhrFileAssembler();
    setState("uploading"); setErr("");
    try {
      await ctrl.writeValueWithResponse(new TextEncoder().encode("send_file"));
      return true;
    } catch (e) {
      setState("ready"); setErr(`تعذّر طلب الملف: ${e && e.message}`);
      refs.current.asm = null;
      return false;
    }
  }, [state]);

  useEffect(() => () => { try { device?.gatt?.disconnect(); } catch (e) { /* */ } }, [device]);

  return { supported, state, device, info, err, setErr,
    connect, disconnect, startLive, stop, startBatch, stopBatch, find, setPower, uploadBatch,
    write, battery: info.battery };
}

/// خطاف قارئ HID (لوحة مفاتيح) — يعمل مع أي قارئ باركود/RFID يُهيَّأ
/// ليحاكي لوحة مفاتيح، بلا حاجة لبلوتوث الويب، ويعمل على كل المنصّات.
function useWedgeScanner(onScan, { enabled = true, maxGapMs = 50, minLength = 4 } = {}) {
  const buf = useRef("");
  const lastAt = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      const t = e.target;
      // حقلٌ مركَّز عليه؟ ندعه له — إلا إن كانت الدفقة سريعة أصلًا
      const typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
      const now = Date.now();
      const gap = now - lastAt.current;
      lastAt.current = now;
      if (gap > maxGapMs) buf.current = "";
      if (e.key === "Enter") {
        const code = buf.current;
        buf.current = "";
        if (code.length >= minLength) {
          if (typing) e.preventDefault();
          onScan(code, "wedge");
        }
        return;
      }
      if (e.key.length === 1) buf.current += e.key;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, onScan, maxGapMs, minLength]);
}

/// يُعطي الإعداد الفعّال لقسمٍ بعينه (الجرد/المبيعات/التكويد/…).
function rfidSettingsFor(sectionId, settings) {
  const cfg = { ...RFID_DEFAULTS, ...(settings?.rfid || {}) };
  const section = RFID_SECTIONS.find((s) => s.id === sectionId);
  if (!cfg.enabled) return { enabled: false };
  // «خيار للكل» يتجاوز التخصيص: صاحب المحل يضبط رقمًا واحدًا وينتهي
  if (cfg.applyToAll) {
    return {
      enabled: true,
      power: Math.min(cfg.globalPower, NHR_POWER_MAX_DBM),
      mode: section?.def.mode || "single",
      autoStart: false,
      beep: true,
      source: "عام",
    };
  }
  const own = cfg.perSection?.[sectionId];
  const base = section?.def || RFID_SECTIONS[1].def;
  if (own && own.enabled === false) return { enabled: false };
  return {
    enabled: true,
    power: Math.min(own?.power ?? base.power, NHR_POWER_MAX_DBM),
    mode: own?.mode ?? base.mode,
    autoStart: own?.autoStart ?? base.autoStart,
    beep: own?.beep ?? base.beep,
    source: own ? "مخصّص" : "افتراضي القسم",
  };
}

export { accountForCategory, accountGroup, accountLabel, accountPath, aiAllowedFor, aiAllowedForRole, aiScope, askReportAi, attachmentByteSize, b32Decode, b32Encode, branchDataKey, branchSnapshotKey, btSupported, bundleById, bundledPages, cardFeeOf, cashTrialBalance, categoryById, categoryLabel, childrenOf, cleanToken, codeCounter, compressImage, contentWidth, createNhrFileAssembler, detectColumns, detectTraceTopic, emptyRow, exportTablesPdf, fetchAiAuditNarrative, fetchAiBusinessInsights, fetchAiChatReply, fetchAiReportSpec, fetchGoldPriceSAR, fineAt, fmtWeight, fromGram, fundingSourceLabel, generateUnitCode, goldDestLabel, hiddenNumbersScan, inPeriod, inputStyle, isBundle, isGoldCogs, isLiveScrap, isPartial, isUnder, issueBranchCode, issueLicense, itemLabel, journalTrialBalance, loadAttachment, lotAllocatedWeight, marginFor, migrateLegacyKeys, modeAllowsAction, modeAllowsPage, modeAllowsTab, nameExists, navPerRow, nhrClassify, nhrCommand, nhrCommands, nhrCrc32, nhrHex, nhrIsLiveFrame, nhrParseBatchFile, nhrParseJson, nhrParseLiveFrame, normHeader, normalizeFundingSource, normalizeName, onlineBlockReason, openAttachment, ounceHash, periodRange, prettyToken, priceBreakdown, printedCount, r2, r3, readFileAsDataUrl, readKeyOrNull, remainingQty, reportFactsText, reportFindings, rfidSettingsFor, runAuditChecks, saleModeOf, saleProfitOf, saleProfitSplit, saveAttachment, scrapPrice24, sellPrice24, setRuntimeCategories, splitCsvLine, toGram, toLatinDigits, trustBalance, unitById, unitCostBasis, unitCurrentValue, useDebounced, useNhrReader, useViewport, useVoice, useWedgeScanner, weightTrialBalance };
