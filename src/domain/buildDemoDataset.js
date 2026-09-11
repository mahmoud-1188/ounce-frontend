import { AUDIT_KEY, BUSINESS_DAYS_KEY, CASH_KEY, CUSTOMERS_KEY, DAILY_CUSTODY_KEY, ENTRY_SESSIONS_KEY, EXPENSES_KEY, EXPENSE_NAMES_KEY, ITEMS_KEY, LOTS_KEY, OPENING_BALANCE_KEY, PARTNERS_KEY, PARTNER_TX_KEY, PRICE_KEY, RECEIPTS_KEY, REPAIRS_KEY, RESERVATIONS_KEY, SAFE_GOLD_KEY, SAFE_KEY, SALES_KEY, SCRAP_CUSTODY_KEY, SCRAP_KEY, SETTINGS_KEY, SUPPLIERS_KEY, TASKIR_KEY, TASKIR_OFFICES_KEY, TRUST_GOLD_KEY, USERS_KEY, WEIGHT_ADJ_KEY } from "../core/keys.js";
import { PURITY } from "../core/money.js";
import { hashPin } from "./hashPin.js";
import { r2 } from "./helpers.js";

function buildDemoDataset(now = Date.now()) {
  const H = (h) => new Date(now - h * 3600e3).toISOString();
  const day = (d) => new Date(now - d * 86400e3).toISOString();
  const P24 = 402.5;
  const fine = (w, k) => (Number(w) || 0) * (PURITY[k] || Number(k) / 24);
  const r2 = (v) => Math.round(v * 100) / 100;

  const ledgerCash = [];
  const ledgerSafe = [];
  const ledgerCustody = [];
  let seq = 0;
  const mk = (type, method, amount, note, category, source, refId, when) => ({
    id: `d${++seq}`,
    date: when,
    type,
    method,
    amount: r2(amount),
    note,
    category,
    source: source || null,
    refId: refId || null,
    createdBy: "نورة",
    businessDayId: "bd1",
    businessDayRef: "DAY-002",
  });
  const toSafe = (...a) => ledgerSafe.push(mk(...a));
  const toCash = (...a) => ledgerCash.push(mk(...a));
  const toCust = (...a) => ledgerCustody.push(mk(...a));

  // ── المستخدمون ──
  const users = [
    { id: "u1", ref: "EMP-001", name: "سالم القحطاني", pin: hashPin("1111", null), role: "employee", salary: 3500, allowedPages: null, createdAt: day(120) },
    { id: "u2", ref: "EMP-002", name: "نورة العتيبي", pin: hashPin("9999", null), role: "manager", salary: 7000, allowedPages: null, createdAt: day(120) },
    { id: "u3", ref: "EMP-003", name: "فهد الدوسري", pin: hashPin("2222", null), role: "assistant", salary: 4500, allowedPages: null, createdAt: day(90) },
  ];

  const suppliers = [
    { id: "s1", ref: "SUP-001", name: "مصنع النور للمجوهرات", phone: "0551112233", isOfficial: true, createdAt: day(110), createdBy: "نورة العتيبي" },
    { id: "s2", ref: "SUP-002", name: "مشغل الأصالة", phone: "0554445566", isOfficial: false, createdAt: day(80), createdBy: "نورة العتيبي" },
    { id: "s3", ref: "SUP-003", name: "مؤسسة الخليج للذهب", phone: "0557778899", isOfficial: true, createdAt: day(45), createdBy: "نورة العتيبي" },
  ];
  const offices = [
    { id: "o1", ref: "OFF-001", name: "مكتب الراجحي للخام", phone: "0561234567", address: "سوق الذهب - الدور الأول", createdAt: day(100) },
    { id: "o2", ref: "OFF-002", name: "مكتب التسكير المركزي", phone: "0569876543", address: "شارع الملك عبدالعزيز", createdAt: day(60) },
  ];
  const customers = [
    { id: "c1", ref: "CUS-001", name: "أم عبدالله", phone: "0501112222", note: "تفضّل عيار 21", createdAt: day(70) },
    { id: "c2", ref: "CUS-002", name: "خالد الشمري", phone: "0503334444", note: "", createdAt: day(50) },
    { id: "c3", ref: "CUS-003", name: "سارة المطيري", phone: "0505556666", note: "زبونة دائمة", createdAt: day(30) },
  ];
  // النسبة تُحسب من رأس المال: 150 و100 → 60٪ و40٪
  const partners = [
    { id: "p1", ref: "PRT-001", name: "عبدالرحمن (شريك مؤسس)", openingGrams: 150, phone: "0571112222", createdAt: day(150) },
    { id: "p2", ref: "PRT-002", name: "ماجد (شريك)", openingGrams: 100, phone: "0573334444", createdAt: day(150) },
  ];

  // ── الرصيد الافتتاحي ──
  toSafe("in", "cash", 300000, "رصيد افتتاحي", "capital_injection", "opening", null, day(150));
  toSafe("in", "network", 50000, "رصيد افتتاحي", "capital_injection", "opening", null, day(150));
  toSafe("in", "cash", 40000, "مساهمة نقدية — عبدالرحمن", "capital_injection", "partner", "p1", day(140));

  const partnerTx = [
    { id: "pt1", ref: "PRT-001", partnerId: "p1", date: day(140), type: "contribution", unit: "sar", amount: 40000, weightGrams: r2(40000 / P24), goldKind: null, fundingSource: "safe_cash", createdBy: "نورة العتيبي" },
    { id: "pt2", ref: "PRT-002", partnerId: "p2", date: day(60), type: "contribution", unit: "gram", amount: r2(25 * P24), weightGrams: 25, goldKind: "raw", createdBy: "نورة العتيبي" },
    { id: "pt3", ref: "PRT-003", partnerId: "p1", date: day(10), type: "withdrawal", unit: "sar", amount: 15000, weightGrams: r2(15000 / P24), goldKind: null, fundingSource: "safe_cash", createdBy: "نورة العتيبي" },
  ];
  toSafe("out", "cash", 15000, "سحب شريك — عبدالرحمن", "owner_withdrawal", "partner", "p1", day(10));

  // ── المشتريات ──
  const lots = [];
  // PUR-001 نقدي: عيار 21 و22
  const p1Cost = 180 * 248 + 3200 + 60 * 260 + 1200;
  lots.push(
    { id: "l1", ref: "PUR-001", purchaseId: "P1", supplierId: "s1", date: day(30), karat: 21, weight: 180, costPerGram: 248, goldCost: 180 * 248, workmanshipTotal: 3200, totalCost: 180 * 248 + 3200, workmanshipAllocated: 3200, enteredWeight: 176, enteredPieces: 22, status: "closed", closedAt: day(28), wastageWeight: 4, surplusWeight: 0, paymentMethod: "safe_cash", invoiceAttachId: "att1", invoicePending: false, createdBy: "نورة العتيبي" },
    { id: "l2", ref: "PUR-001", purchaseId: "P1", supplierId: "s1", date: day(30), karat: 22, weight: 60, costPerGram: 260, goldCost: 60 * 260, workmanshipTotal: 1200, totalCost: 60 * 260 + 1200, workmanshipAllocated: 1200, enteredWeight: 60, enteredPieces: 6, status: "closed", closedAt: day(28), wastageWeight: 0, surplusWeight: 0, paymentMethod: "safe_cash", invoiceAttachId: "att1", invoicePending: false, createdBy: "نورة العتيبي" }
  );
  toSafe("out", "cash", p1Cost, "شراء PUR-001 — مصنع النور", "gold_purchase_supplier", "purchase", "P1", day(30));

  // PUR-002 آجل: الأجور نقدًا
  lots.push({ id: "l3", ref: "PUR-002", purchaseId: "P2", supplierId: "s2", date: day(14), karat: 18, weight: 95, costPerGram: 214, goldCost: 95 * 214, workmanshipTotal: 1800, totalCost: 95 * 214 + 1800, workmanshipAllocated: 1800, enteredWeight: 95, enteredPieces: 11, status: "open", paymentMethod: "deferred", feesPaidNow: true, invoicePending: true, createdBy: "نورة العتيبي" });
  toSafe("out", "cash", 1800, "أجور PUR-002 (آجل على المورد)", "gold_workmanship", "purchase", "P2", day(14));

  // PUR-003 سداد بالكسر
  lots.push({ id: "l4", ref: "PUR-003", purchaseId: "P3", supplierId: "s3", date: day(6), karat: 21, weight: 50, costPerGram: 250, goldCost: 50 * 250, workmanshipTotal: 900, totalCost: 50 * 250 + 900, workmanshipAllocated: 0, enteredWeight: 0, status: "open", paymentMethod: "scrap", invoicePending: true, createdBy: "نورة العتيبي" });
  toSafe("out", "cash", 900, "أجور PUR-003 (سُدّد الذهب بالكسر)", "gold_workmanship", "purchase", "P3", day(6));

  // ── الكسر ──
  toSafe("out", "cash", 30000, "تمويل عهدة الكسر", "transfer_to_custody", "transfer", null, day(20));
  toCust("in", "cash", 30000, "تمويل من الخزنة", "transfer_from_safe", "transfer", null, day(20));

  const scrapEntries = [
    { id: "sc1", ref: "SCR-001", date: day(18), description: "كسر من عميل", karat: 21, weight: 85, pricePerGram: 230, total: 85 * 230, status: "in_box", stonesMargin: 0, createdBy: "سالم القحطاني" },
    { id: "sc2", ref: "SCR-002", date: day(9), description: "كسر متنوع", karat: 18, weight: 40, pricePerGram: 196, total: 40 * 196, status: "in_box", stonesMargin: 0.6, createdBy: "سالم القحطاني" },
    { id: "sc3", ref: "SCR-003", date: day(6), description: "سداد PUR-003 — مصرف للمورد", karat: 21, weight: -60, pricePerGram: 0, total: 0, status: "used_for_taskir", createdBy: "نورة العتيبي" },
  ];
  toCust("out", "cash", 85 * 230, "شراء كسر SCR-001", "gold_purchase_scrap", "scrap", "sc1", day(18));
  toCust("out", "cash", 40 * 196, "شراء كسر SCR-002", "gold_purchase_scrap", "scrap", "sc2", day(9));

  // ── التسكيرات ──
  const taskirEntries = [
    { id: "t1", ref: "TSK-001", date: day(6), supplierId: "s3", officeId: null, goldSource: "scrap", karat: 21, weight: 60, goldCost: 0, workmanshipAmount: 0, totalCashPaid: 0, note: "سداد PUR-003 بالكسر", createdBy: "نورة العتيبي" },
    { id: "t2", ref: "TSK-002", date: day(4), supplierId: "s1", officeId: "o1", goldSource: "purchased", karat: 24, weight: 35, goldCost: 35 * 520, workmanshipAmount: 0, totalCashPaid: 0, note: "بيع خام للمكتب", createdBy: "نورة العتيبي" },
  ];
  toSafe("in", "cash", 35 * 520, "تسكير — بيع خام لمكتب الراجحي", "gold_purchase_bullion", "taskir", "t2", day(4));

  // ── ذهب الخزنة ──
  const safeGoldTx = [
    { id: "g1", ref: "CSH-001", date: day(150), type: "in", kind: "raw", karat: 24, weight: 200, note: "رصيد افتتاحي", createdBy: "نورة العتيبي" },
    { id: "g2", ref: "CSH-002", date: day(60), type: "in", kind: "raw", karat: 24, weight: 25, note: "مساهمة شريك ماجد", createdBy: "نورة العتيبي" },
    { id: "g3", ref: "CSH-003", date: day(4), type: "out", kind: "raw", karat: 24, weight: 35, destination: "taskir", destinationLabel: "تسكير بمكتب", note: "بيع خام", createdBy: "نورة العتيبي" },
    // ⚠ الإخراج يستلزم إدخالًا سابقًا: سحب عيار 21 بلا إيداع كان يترك
    // «ذهب خام بالخزنة» برصيد سالب في ميزان المراجعة — وهو خلل حقيقي
    // كان سيظهر للعميل في أول عرض للنظام.
    { id: "g3b", date: day(30), type: "in", kind: "crafted", karat: 21, weight: 40, note: "استلام مشغول للخزنة", createdBy: "نورة العتيبي" },
    { id: "g4", ref: "CSH-004", date: day(2), type: "out", kind: "crafted", karat: 21, weight: 18, destination: "display", destinationLabel: "للعرض في المحل", note: "نقل للعرض", createdBy: "نورة العتيبي" },
  ];

  // ── المخزون ──
  const unit = (c, sold = false, printed = true) => ({ code: c, printed, sold });
  const items = [
    { id: "i1", lotId: "l1", categoryId: "chain", karat: 21, weight: 12.4, stonesWeight: 0, costPerGram: 248, workmanship: 0, lotWorkmanshipShare: 225, units: [unit("A1001"), unit("A1002"), unit("A1003", true)], dateAdded: day(28), createdBy: "فهد الدوسري" },
    { id: "i2", lotId: "l1", categoryId: "bracelet", karat: 21, weight: 21.8, stonesWeight: 1.2, costPerGram: 248, workmanship: 0, lotWorkmanshipShare: 396, units: [unit("A1004"), unit("A1005", true)], dateAdded: day(28), createdBy: "فهد الدوسري" },
    { id: "i3", lotId: "l1", categoryId: "ring", karat: 21, weight: 5.6, stonesWeight: 0.4, costPerGram: 248, workmanship: 0, lotWorkmanshipShare: 102, units: [unit("A1006"), unit("A1007"), unit("A1008"), unit("A1009")], dateAdded: day(28), createdBy: "فهد الدوسري" },
    { id: "i4", lotId: "l2", categoryId: "set", karat: 22, weight: 48.2, stonesWeight: 2.1, costPerGram: 260, workmanship: 0, lotWorkmanshipShare: 964, units: [unit("B2001")], isSet: true, setPieces: ["خاتم", "سلسلة", "أقراط"], dateAdded: day(28), createdBy: "فهد الدوسري" },
    { id: "i5", lotId: "l2", categoryId: "earrings", karat: 22, weight: 5.9, stonesWeight: 0, costPerGram: 260, workmanship: 0, lotWorkmanshipShare: 118, units: [unit("B2002"), unit("B2003")], dateAdded: day(28), createdBy: "فهد الدوسري" },
    { id: "i6", lotId: "l3", categoryId: "chain", karat: 18, weight: 8.6, stonesWeight: 0, costPerGram: 214, workmanship: 0, lotWorkmanshipShare: 150, units: [unit("C3001"), unit("C3002", true), unit("C3003")], dateAdded: day(12), createdBy: "فهد الدوسري" },
    { id: "i7", lotId: "l3", categoryId: "bracelet", karat: 18, weight: 16.4, stonesWeight: 0.8, costPerGram: 214, workmanship: 0, lotWorkmanshipShare: 287, units: [unit("C3004"), unit("C3005")], dateAdded: day(12), createdBy: "فهد الدوسري" },
    { id: "i8", lotId: null, categoryId: "bar", karat: 24, weight: 31.1, stonesWeight: 0, costPerGram: 398, workmanship: 0, lotWorkmanshipShare: 0, units: [unit("D4001", true), unit("D4002", false, false)], dateAdded: day(40), createdBy: "نورة العتيبي" },
  ];

  const entrySessions = [
    { id: "es1", ref: "ENT-001", date: day(28), lotId: "l1", supplierId: "s1", karat: 21, itemCount: 3, unitCount: 9, totalWeight: 106.4, createdBy: "فهد الدوسري" },
    { id: "es2", ref: "ENT-002", date: day(28), lotId: "l2", supplierId: "s1", karat: 22, itemCount: 2, unitCount: 3, totalWeight: 60, createdBy: "فهد الدوسري" },
    { id: "es3", ref: "ENT-003", date: day(12), lotId: "l3", supplierId: "s2", karat: 18, itemCount: 2, unitCount: 5, totalWeight: 58.6, createdBy: "فهد الدوسري" },
  ];

  const weightAdjustments = [
    { id: "wa1", ref: "WGT-001", date: day(28), lotId: "l1", supplierId: "s1", kind: "wastage", karat: 21, weight: 4, fineWeight: fine(4, 21), costPerGram: 248, value: 4 * 248, purchasedWeight: 180, enteredWeight: 176, category: "gold_wastage", note: "هالك تصنيع", createdBy: "نورة العتيبي" },
  ];

  // ── العهدة اليومية ──
  toSafe("out", "cash", 5000, "عهدة الصندوق — DAY-002", "transfer_to_daily", "day_open", "bd1", H(9));
  toCash("in", "cash", 5000, "عهدة الصندوق — DAY-002", "transfer_from_safe", "day_open", "bd1", H(9));
  const dailyCustody = [
    { id: "dc1", ref: "CST-001", openedAt: H(9), openedBy: "سالم القحطاني", openedById: "u1", floatCash: 5000, floatNetwork: 0, status: "open", businessDayId: "bd1", businessDayRef: "DAY-002" },
  ];

  // ── المبيعات ──
  const line = (it, price, qty = 1) => ({
    itemId: it.id, quantity: qty, unitPrice: r2(price),
    costPerGramSnapshot: it.costPerGram, weightSnapshot: it.weight,
    workmanshipSnapshot: it.lotWorkmanshipShare, karatSnapshot: it.karat,
  });
  const priceOf = (it, margin) => r2(fine(it.weight, it.karat) * P24 + it.lotWorkmanshipShare + margin);
  const s1p = priceOf(items[0], 180);
  const s2p = priceOf(items[1], 320);
  const s3p = priceOf(items[5], 140);
  const s4p = priceOf(items[7], 900);

  const sales = [
    { id: "sa1", ref: "INV-001", date: H(7), sellerId: "u1", sellerName: "سالم القحطاني", customerId: "c1", customerName: "أم عبدالله", paymentMethod: "cash", subtotal: s1p, total: s1p, taxApplicable: false, taxRate: 0.15, taxAmount: 0, lines: [line(items[0], s1p)], createdBy: "سالم القحطاني", businessDayId: "bd1", businessDayRef: "DAY-002" },
    { id: "sa2", ref: "INV-002", date: H(6), sellerId: "u2", sellerName: "نورة العتيبي", customerId: null, customerName: null, paymentMethod: "card", cardNetwork: "visa", networkFeePct: 2.5, subtotal: s2p, total: s2p, taxApplicable: false, taxAmount: 0, lines: [line(items[1], s2p)], createdBy: "نورة العتيبي", businessDayId: "bd1", businessDayRef: "DAY-002" },
    { id: "sa3", ref: "INV-003", date: H(5), sellerId: "u1", sellerName: "سالم القحطاني", customerId: "c2", customerName: "خالد الشمري", paymentMethod: "credit", subtotal: s3p, total: s3p, taxApplicable: false, taxAmount: 0, lines: [line(items[5], s3p)], createdBy: "سالم القحطاني", businessDayId: "bd1", businessDayRef: "DAY-002" },
    { id: "sa4", ref: "INV-004", date: H(3), sellerId: "u2", sellerName: "نورة العتيبي", customerId: "c3", customerName: "سارة المطيري", paymentMethod: "split", cardNetwork: "visa", networkFeePct: 2.5, cashPart: 4000, networkPart: r2(s4p - 4000), subtotal: s4p, total: s4p, taxApplicable: false, taxAmount: 0, lines: [line(items[7], s4p)], createdBy: "نورة العتيبي", businessDayId: "bd1", businessDayRef: "DAY-002" },
  ];
  toCash("in", "cash", s1p, "بيع INV-001 — نقدي", "sales_revenue", "sale", "sa1", H(7));
  toCash("in", "network", s2p, "بيع INV-002 — شبكة", "sales_revenue", "sale", "sa2", H(6));
  toCash("out", "network", s2p * 0.025, "عمولة فيزا 2.50٪", "network_fees", "sale", "sa2", H(6));
  toCash("in", "cash", 4000, "بيع INV-004 — نقدي", "sales_revenue", "sale", "sa4", H(3));
  toCash("in", "network", s4p - 4000, "بيع INV-004 — شبكة", "sales_revenue", "sale", "sa4", H(3));
  toCash("out", "network", (s4p - 4000) * 0.025, "عمولة فيزا 2.50٪", "network_fees", "sale", "sa4", H(3));

  // ── تحصيل آجل ──
  const receipts = [
    { id: "rc1", ref: "RCP-001", date: H(2), customerId: "c2", customerName: "خالد الشمري", saleId: null, amount: 1500, method: "cash", createdBy: "نورة العتيبي", businessDayId: "bd1", businessDayRef: "DAY-002" },
  ];
  toCash("in", "cash", 1500, "تحصيل آجل — خالد الشمري", "sales_revenue", "receipt", "rc1", H(2));

  // ── المصروفات ──
  const expenses = [
    { id: "e1", ref: "EXP-001", date: day(12), name: "إيجار المحل", category: "rent", amount: 9000, recurring: true, fundingSource: "safe_cash", employeeId: null, createdBy: "نورة العتيبي" },
    { id: "e2", ref: "EXP-002", date: day(11), name: "راتب بائع/موظف — سالم القحطاني", category: "salaries", amount: 3500, recurring: false, fundingSource: "safe_cash", employeeId: "u1", employeeName: "سالم القحطاني", employeeRef: "EMP-001", periodMonth: new Date(now).toISOString().slice(0, 7), createdBy: "نورة العتيبي" },
    { id: "e3", ref: "EXP-003", date: day(5), name: "سحبية بائع/موظف — سالم القحطاني", category: "advance", amount: 800, recurring: false, fundingSource: "safe_cash", employeeId: "u1", employeeName: "سالم القحطاني", employeeRef: "EMP-001", periodMonth: new Date(now).toISOString().slice(0, 7), createdBy: "نورة العتيبي" },
    { id: "e4", ref: "EXP-004", date: H(8), name: "أكياس وتغليف", category: "purchases", amount: 420, recurring: false, fundingSource: "daily_cash", employeeId: null, createdBy: "سالم القحطاني", businessDayId: "bd1", businessDayRef: "DAY-002" },
    { id: "e5", ref: "EXP-005", date: day(3), name: "فاتورة الكهرباء", category: "bills", amount: 1240, recurring: true, fundingSource: "safe_cash", employeeId: null, createdBy: "نورة العتيبي" },
  ];
  toSafe("out", "cash", 9000, "إيجار المحل", "operating_expense", "expense", "e1", day(12));
  toSafe("out", "cash", 3500, "راتب — سالم القحطاني", "operating_expense", "expense", "e2", day(11));
  toSafe("out", "cash", 800, "سحبية — سالم القحطاني", "operating_expense", "expense", "e3", day(5));
  toCash("out", "cash", 420, "أكياس وتغليف", "non_gold_purchase", "expense", "e4", H(8));
  toSafe("out", "cash", 1240, "فاتورة الكهرباء", "operating_expense", "expense", "e5", day(3));

  // ── الإصلاحات والحجوزات ──
  const repairs = [
    { id: "rp1", ref: "REP-001", date: H(4), customerId: "c1", customerName: "أم عبدالله", description: "لحام سلسلة", cost: 0, chargedAmount: 350, profit: 350, profitGrams: r2(350 / P24), fundingSource: "daily_cash", createdBy: "سالم القحطاني" },
  ];
  toCash("in", "cash", 350, "مكسب إصلاح — أم عبدالله", "repair_income", "repair", "rp1", H(4));

  const reservations = [
    { id: "rs1", ref: "RSV-001", date: H(4), customerId: "c3", customerName: "سارة المطيري", itemId: "i4", description: "حجز طقم عيار 22", total: 22000, deposit: 2000, remaining: 20000, method: "cash", status: "open", createdBy: "نورة العتيبي", businessDayId: "bd1", businessDayRef: "DAY-002" },
  ];
  toCash("in", "cash", 2000, "عربون حجز — سارة المطيري", "customer_deposit", "reservation", "rs1", H(4));

  const trustGold = [
    { id: "tg1", date: day(2), customerId: "c1", customerName: "أم عبدالله", karat: 21, weight: 14.2, description: "سوار للتنظيف", status: "held", createdBy: "سالم القحطاني" },
  ];

  const businessDays = [
    { id: "bd0", ref: "DAY-001", openedAt: day(1), openedBy: "نورة العتيبي", status: "closed", closedAt: H(20), closedBy: "نورة العتيبي", snapshot: { salesCount: 3, salesSum: 14200, profit: 2100, expenses: 640, purchases: 0, cashAtClose: 8400, safeAtClose: 235000, price24AtClose: 400 } },
    { id: "bd1", ref: "DAY-002", openedAt: H(9), openedBy: "نورة العتيبي", openedById: "u2", status: "open", note: "يوم عمل تجريبي" },
  ];

  const audits = [
    { id: "au1", date: day(7), createdBy: "فهد الدوسري", applied: true, entries: [
      { itemId: "i1", status: "found" }, { itemId: "i2", status: "found" },
      { itemId: "i3", status: "found" }, { itemId: "i6", status: "missing" },
    ] },
  ];

  const priceHistory = Array.from({ length: 24 }, (_, i) => ({
    date: new Date(now - (23 - i) * 2 * 60000).toISOString(),
    price: r2(P24 + Math.sin(i / 2.6) * 3.4 + (i > 16 ? 2.1 : 0)),
  }));

  const openingBalance = {
    safeCash: 300000, safeNetwork: 50000, dailyCash: 0, dailyNetwork: 0,
    safeGoldRaw: 200, safeGoldRawKarat: 24, safeGoldCrafted: 0, safeGoldCraftedKarat: 21,
    inventoryLines: [], partnersCapitalByPartner: {}, suppliersDue: 0,
    confirmedAt: day(150),
  };

  return {
    [ITEMS_KEY]: items,
    [SALES_KEY]: sales,
    [CASH_KEY]: ledgerCash,
    [SAFE_KEY]: ledgerSafe,
    [SCRAP_CUSTODY_KEY]: ledgerCustody,
    [SCRAP_KEY]: scrapEntries,
    [SUPPLIERS_KEY]: suppliers,
    [LOTS_KEY]: lots,
    [TASKIR_KEY]: taskirEntries,
    [TASKIR_OFFICES_KEY]: offices,
    [EXPENSES_KEY]: expenses,
    [PARTNERS_KEY]: partners,
    [PARTNER_TX_KEY]: partnerTx,
    [USERS_KEY]: users,
    [SAFE_GOLD_KEY]: safeGoldTx,
    [REPAIRS_KEY]: repairs,
    [DAILY_CUSTODY_KEY]: dailyCustody,
    [ENTRY_SESSIONS_KEY]: entrySessions,
    [WEIGHT_ADJ_KEY]: weightAdjustments,
    [CUSTOMERS_KEY]: customers,
    [TRUST_GOLD_KEY]: trustGold,
    [RECEIPTS_KEY]: receipts,
    [RESERVATIONS_KEY]: reservations,
    [BUSINESS_DAYS_KEY]: businessDays,
    [AUDIT_KEY]: audits,
    [OPENING_BALANCE_KEY]: openingBalance,
    [PRICE_KEY]: { current: P24, currency: "ر.س", history: priceHistory },
    [SETTINGS_KEY]: { taxEnabled: true, taxRate: 0.15, cardFees: { mada: 0, visa: 2.5, mastercard: 2.5, amex: 3.5 } },
    [EXPENSE_NAMES_KEY]: [
      { id: "en1", name: "إيجار المحل", category: "rent" },
      { id: "en2", name: "فاتورة الكهرباء", category: "bills" },
      { id: "en3", name: "أكياس وتغليف", category: "purchases" },
    ],
  };
}

// ============================================================
// النسخ الاحتياطي — أول ما يجب تفعيله قبل التشغيل الفعلي
// ============================================================

export { buildDemoDataset };
