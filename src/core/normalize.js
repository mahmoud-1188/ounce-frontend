// ═══════════════════════════════════════════════════════════════
//  تطبيع استجابة /api/bootstrap إلى نفس أشكال الحالة المحلية القديمة
// ═══════════════════════════════════════════════════════════════
//
// ⚠ نطاق متعمَّد: يغطي فقط الموارد التي حُوِّلت فعليًا لتستدعي الباك إند
// (المبيعات بأنواعها، المشتريات) + بيانات مرجعية بسيطة (عملاء/موردين/
// أصناف/فئات/مستخدمين/يوم العمل). عناصر أخرى (الكسر تحديدًا) ليست جزءًا
// من هذا التطبيع بعد — راجع التحذير أسفل normalizeBootstrap.

function toMoney(v) {
  return v == null ? 0 : Number(v);
}
function toWeight(v) {
  return v == null ? 0 : Number(v);
}

/** items + item_units (DB) → items[] بشكل units[] متداخل، مطابق للمرجع القديم. */
function normalizeItems(itemRows, itemUnitRows) {
  const unitsByItem = new Map();
  for (const u of itemUnitRows) {
    const list = unitsByItem.get(u.item_id) || [];
    list.push({
      id: u.id,
      code: u.code,
      printed: !!u.printed,
      sold: !!u.sold,
      issued: !!u.issued,
      epc: u.epc || null,
      epcBoundAt: u.epc_bound_at || null,
    });
    unitsByItem.set(u.item_id, list);
  }
  return itemRows.map((it) => ({
    id: it.id,
    ref: it.ref,
    lotId: it.lot_id,
    categoryId: it.category_id,
    karat: it.karat,
    weight: toWeight(it.weight),
    stonesWeight: toWeight(it.stones_weight),
    costPerGram: it.cost_per_gram == null ? null : Number(it.cost_per_gram),
    workmanship: toMoney(it.workmanship),
    // ⚠ القرّاء كلهم (unitCurrentValue · unitCostBasis · السعر المقترح · لقطة
    //   البيع) يقرؤون workmanshipPerUnit — بدونه تسقط الأجرة بعد كل تحميل.
    workmanshipPerUnit: toMoney(it.workmanship),
    lotWorkmanshipShare: toMoney(it.lot_workmanship_share),
    fromScrap: !!it.from_scrap,
    photoUrl: it.photo_url,
    dateAdded: it.date_added,
    businessDayId: it.business_day_id,
    createdBy: it.created_by,
    // ⚠ migration 013 — لم يكن هناك عمود لهذا قبلها؛ الحجز كان يُعلَّم
    // محليًا فقط (reservedFor) فلا يمنع أي شيء فعليًا بعد إعادة التحميل.
    reservedFor: it.reserved_for || null,
    units: unitsByItem.get(it.id) || [],
  }));
}

/** sales + sale_lines (DB) → sales[]، بنفس حقول sale المبنية في handleCreateSale. */
function normalizeSales(saleRows, saleLineRows) {
  const linesBySale = new Map();
  for (const l of saleLineRows) {
    const list = linesBySale.get(l.sale_id) || [];
    list.push({
      itemId: l.item_id,
      category: l.category,
      karatSnapshot: l.karat,
      quantity: Number(l.quantity),
      unitPrice: toMoney(l.unit_price),
      weightSnapshot: toWeight(l.weight_snapshot),
      costPerGramSnapshot: l.cost_per_gram_snapshot == null ? null : Number(l.cost_per_gram_snapshot),
      workmanshipSnapshot: toMoney(l.workmanship_snapshot),
    });
    linesBySale.set(l.sale_id, list);
  }
  return saleRows.map((s) => ({
    id: s.id,
    ref: s.ref,
    date: s.date,
    businessDayId: s.business_day_id,
    customerId: s.customer_id,
    customerName: s.customer_name,
    paymentMethod: s.payment_method,
    price24Snapshot: s.price24_snapshot == null ? null : Number(s.price24_snapshot),
    priceFrozenAt: s.price_frozen_at,
    cardNetwork: s.card_network,
    cashPart: toMoney(s.cash_part),
    networkPart: toMoney(s.network_part),
    networkFeePct: s.network_fee_pct == null ? 0 : Number(s.network_fee_pct),
    subtotal: toMoney(s.subtotal),
    total: toMoney(s.total),
    taxApplicable: !!s.tax_applicable,
    taxRate: s.tax_rate == null ? 0 : Number(s.tax_rate),
    taxAmount: toMoney(s.tax_amount),
    netAmount: toMoney(s.net_amount),
    tradeInValue: toMoney(s.trade_in_value),
    exchangeOfSaleId: s.exchange_of_sale_id || null,
    sellerId: s.seller_id,
    sellerName: s.seller_name,
    createdBy: s.created_by,
    lines: linesBySale.get(s.id) || [],
  }));
}

/**
 * cash_tx (DB، جدول موحّد بعمود pool) → ثلاث مصفوفات منفصلة (cashTx/
 * safeTx/scrapCustodyTx) — مطابقة لبنية المرجع القديم حيث كانت هذي
 * الصناديق الثلاثة معزولة عن بعضها في التخزين والشاشات (CashTab يقرأ
 * cashTx فقط، شاشة الخزنة تقرأ safeTx، وعهدة الكسر تقرأ scrapCustodyTx).
 */
/**
 * سطر cash_tx واحد (DB) → شكل حركة الكاش المحلي المستخدم في الشاشات.
 * مُصدَّرة (لا داخلية فقط) لأن الشاشات المحوَّلة لاحقًا (عمليات الخزنة)
 * تستقبل سطر cash_tx واحدًا من رد الباك إند مباشرة (لا bootstrap كامل)
 * وتحتاج نفس التطبيع بالضبط ليطابق شكل الحالة المحلية.
 */
function normalizeCashTxRow(r) {
  return {
    id: r.id,
    date: r.created_at,
    type: r.direction,
    method: r.method,
    amount: toMoney(r.amount),
    note: r.note,
    source: r.ref_table,
    refId: r.ref_id,
    category: r.category,
    createdBy: r.created_by,
    businessDayId: r.business_day_id,
  };
}

function normalizeCashPools(cashTxRows) {
  const cashTx = [];
  const safeTx = [];
  const scrapCustodyTx = [];
  for (const r of cashTxRows) {
    const entry = normalizeCashTxRow(r);
    if (r.pool === "safe") safeTx.push(entry);
    else if (r.pool === "custody") scrapCustodyTx.push(entry);
    else cashTx.push(entry);
  }
  return { cashTx, safeTx, scrapCustodyTx };
}

/** safe_gold_tx (DB) → حركة ذهب الخزنة المحلية — handleAddSafeGoldTx/الجرد. */
function normalizeSafeGoldTx(rows) {
  return rows.map((r) => ({
    id: r.id,
    date: r.created_at,
    type: r.direction,
    kind: r.kind,
    karat: r.karat,
    weight: toWeight(r.weight),
    destination: r.destination,
    // ⚠ destinationLabel/supplierName غير محفوظين في safe_gold_tx نفسه —
    // يُشتقّان في المرجع وقت الإنشاء فقط من نصوص محلية (goldDestLabel)
    // ومن قائمة الموردين. للحركات المحمَّلة من bootstrap (جلسات سابقة)
    // تبقى null — تُعرَض القيم الخام (destination/supplierId) بدلًا من
    // ذلك حيث تظهر؛ لا يمنع هذا حساب الأرصدة (safeGoldBalance) الذي لا
    // يقرأ إلا type/kind/karat/weight/date.
    destinationLabel: null,
    supplierId: r.supplier_id,
    supplierName: null,
    officeId: r.office_id,
    note: r.note,
    createdBy: r.created_by,
    businessDayId: r.business_day_id,
  }));
}

/** safe_audits (DB) → سجل جرد الخزنة المحلي — SafeAuditPage. */
function normalizeSafeAudits(rows) {
  return rows.map((r) => ({
    id: r.id,
    ref: r.ref,
    date: r.created_at,
    countedCash: toMoney(r.counted_cash),
    countedNetwork: toMoney(r.counted_network),
    varianceCash: toMoney(r.diff_cash),
    varianceNetwork: toMoney(r.diff_network),
    gold: Array.isArray(r.gold_lines) ? r.gold_lines : [],
    note: r.note,
    createdBy: r.created_by,
    businessDayId: r.business_day_id,
  }));
}

function normalizeCustomers(rows) {
  return rows.map((c) => ({ id: c.id, ref: c.ref, name: c.name, phone: c.phone, createdBy: c.created_by, createdAt: c.created_at }));
}

function normalizeSuppliers(rows) {
  return rows.map((s) => ({
    id: s.id, ref: s.ref, name: s.name, phone: s.phone,
    isOfficial: !!s.is_official, createdBy: s.created_by, createdAt: s.created_at,
  }));
}

/**
 * expenses/expenseNames — الفجوة الأخطر عمليًا بين كل الفجوات المحلية
 * السابقة: /day/close (migration 008) يقرأ فعليًا sum(amount) from
 * expenses لحساب expenses_sum عند إقفال اليوم، وكانت المصروفات محفوظة
 * محليًا فقط، فالرقم كان صفرًا زائفًا صامتًا في كل إقفال. usersFull
 * (اختياري): Map من users.id إلى {name, ref}، لإعادة بناء
 * employeeName/employeeRef كما كانت في الشكل المحلي القديم (الباك إند
 * يخزّن employee_id فقط لا اسمًا مكررًا).
 */
function normalizeExpenses(rows, usersFull) {
  const empOf = (id) => (usersFull && id ? usersFull.get(id) || null : null);
  return rows.map((e) => {
    const emp = empOf(e.employee_id);
    return {
      id: e.id, ref: e.ref, date: e.created_at,
      category: e.category, name: e.name, amount: Number(e.amount) || 0,
      recurring: !!e.recurring, fundingSource: e.funding_source,
      employeeId: e.employee_id, employeeName: emp?.name || null, employeeRef: emp?.ref || null,
      periodMonth: e.period_month, note: e.note || "",
      createdBy: null, createdById: e.created_by,
      businessDayId: e.business_day_id,
    };
  });
}

function normalizeAssetClasses(rows) {
  return rows.map((c) => ({
    id: c.id, label: c.label, account: c.account_code,
    years: c.years, salvagePct: Number(c.salvage_pct) * 100 || 0,
  }));
}

/**
 * fixed_assets (DB) → assets[] بشكل المرجع (FixedAssetsPage/AssetForm):
 * classId/years/salvagePct/method قد تكون NULL في القاعدة (يتّبع الأصل
 * فئته حينها) — لا نُسقِط null هنا فتبقى الشاشة تعرف الفرق بين "خصّصها
 * المستخدم" و"موروثة من الفئة"؛ assetStatus/monthlyDepreciation
 * المحليان (helpers.js) هما من يدمجان مع قيم الفئة عند الحاجة، تمامًا
 * كـ`Number(f.years) || cls.years` في AssetForm الأصلي.
 */
function normalizeFixedAssets(rows) {
  return rows.map((a) => ({
    id: a.id, ref: a.ref, classId: a.class_id, name: a.name,
    cost: toMoney(a.cost), purchasedAt: a.purchased_at,
    years: a.years == null ? null : Number(a.years),
    salvagePct: a.salvage_pct == null ? null : Number(a.salvage_pct) * 100,
    method: a.method || "straight",
    disposed: !!a.disposed_at, disposedAt: a.disposed_at,
    disposalReason: a.disposal_reason || null,
    disposalProceeds: a.disposal_proceeds == null ? null : toMoney(a.disposal_proceeds),
    disposalGain: a.disposal_gain == null ? null : toMoney(a.disposal_gain),
    createdBy: a.created_by,
  }));
}

function normalizeDepreciationSchedule(rows) {
  return rows.map((d) => ({
    id: d.id, assetId: d.asset_id,
    period: typeof d.period === "string" ? d.period.slice(0, 7) : String(d.period).slice(0, 7),
    amount: toMoney(d.amount), posted: !!d.posted, journalEntryId: d.journal_entry_id,
  }));
}

function normalizeExpenseNames(rows) {
  return rows.map((n) => ({ id: n.id, name: n.name, category: n.category || "other" }));
}

/** taskir_entries (DB) → taskirEntries[] بشكل المرجع القديم (camelCase). */
function normalizeTaskirEntries(rows) {
  return rows.map((t) => ({
    id: t.id, ref: t.ref, date: t.created_at,
    supplierId: t.supplier_id, karat: t.karat, weight: toWeight(t.weight),
    pricePerGram: t.price_per_gram == null ? 0 : Number(t.price_per_gram),
    goldSource: t.gold_source, goldCost: toMoney(t.gold_cost),
    officeId: t.office_id, workmanshipAmount: toMoney(t.workmanship_amount),
    fundingSource: t.funding_source, totalCashPaid: toMoney(t.total_cash_paid),
    notes: t.notes || "", invoiceAttachId: t.invoice_attach_id || null,
    createdBy: null, createdById: t.created_by, businessDayId: t.business_day_id,
    supplierName: t.supplier_name || null, officeName: t.office_name || null,
  }));
}

function normalizeTaskirOffices(rows) {
  return rows.map((o) => ({
    id: o.id, ref: o.ref, name: o.name, phone: o.phone || "",
    createdAt: o.created_at, createdBy: null,
  }));
}

/** taskir_office_tx (DB, direction 'in'|'out') → taskirOfficeTx[] بشكل
 * المرجع القديم (type 'debit'|'credit' — راجع تعليق migration 004). */
function normalizeTaskirOfficeTx(rows) {
  return rows.map((t) => ({
    id: t.id, ref: t.ref || null, date: t.created_at,
    officeId: t.office_id, officeName: null,
    type: t.direction === "in" ? "debit" : "credit", kind: t.kind || "gold",
    karat: t.karat, weight: toWeight(t.weight), amount: toMoney(t.amount),
    note: t.note || "", createdBy: null, businessDayId: t.business_day_id,
  }));
}

function normalizeCategories(rows) {
  return rows.map((c) => ({
    id: c.id,
    // ⚠ إصلاح حقيقي: كل شاشات القراءة (AddGoodsPage.jsx، CategoriesPage.jsx،
    // ConversionsPage.jsx، ItemEditPage.jsx، StocktakeSubPage.jsx...) تقرأ
    // `label` — نفس شكل DEFAULT_CATEGORIES الثابت في constants.js الذي
    // تستبدله setRuntimeCategories بهذه القائمة عند كل bootstrap. `name`
    // وحدها (شكل عمود القاعدة) كانت تُعرض حرفيًّا كـ`undefined` في كل
    // قائمة اختيار تصنيف حقيقي قادم من الباك إند — الاختيار نفسه كان
    // يعمل (القيمة id صحيحة)، لكن نص كل خيار كان فارغًا.
    label: c.name,
    name: c.name,
    saleMode: c.sale_mode,
    minSaleWeight: c.min_sale_weight == null ? null : Number(c.min_sale_weight),
    sortOrder: c.sort_order == null ? 0 : Number(c.sort_order),
  }));
}

/**
 * ⚠ إصلاح حقيقي خطير: كانت هذه الدالة تُبقي 5 حقول فقط (id/ref/
 * supplierId/date/createdBy) وتُسقط الباقي بالكامل — karat/weight/
 * costPerGram/workmanshipTotal/totalCost/status وغيرها. كل شاشات
 * المشتريات (SuppliersSubPage.jsx تحديدًا، عبر accountFor) تقرأ هذه
 * الحقول مباشرة من كل lot؛ سقوطها يعني أن كل دفعة تظهر بلا عيار ولا
 * وزن ولا تكلفة بعد أي refresh (loadBootstrap يستبدل lots بالكامل) —
 * وهو بالضبط ما أبلغ عنه المستخدم: "بعد إضافة مورد وعملية شراء
 * وتحديث الصفحة كل شيء اختفى". طريقة الدفع/المكتب/حالة الفاتورة تأتي
 * من صفّ purchases المرتبط (bootstrap.routes.js يربطها الآن بـLEFT
 * JOIN) لأنها تعيش على رأس الشراء لا على كل سطر lot بداخله.
 */
function normalizeLots(rows) {
  return rows.map((l) => ({
    id: l.id,
    ref: l.ref,
    // ⚠ migration 035: 'opening' = دفعة افتتاحية بلا مورد (وضع الافتتاح)
    source: l.source === "opening" ? "opening" : "purchase",
    costRef: l.cost_ref || null,
    purchaseId: l.purchase_id,
    supplierId: l.supplier_id,
    date: l.date,
    karat: l.karat,
    weight: toWeight(l.weight),
    costPerGram: l.cost_per_gram == null ? 0 : Number(l.cost_per_gram),
    goldCost: toMoney(l.gold_cost),
    workmanshipTotal: toMoney(l.workmanship_total),
    // ⚠ عمود حقيقي منذ migration 028_lot_item_coding.sql — بدونه كانت
    // شاشة AddGoodsPage.jsx تقرأ selectedLot.workmanshipAllocated دائمًا
    // undefined (NaN→0)، فيُعاد توزيع كامل workmanshipTotal من الصفر عند
    // كل تحميل صفحة جديد حتى لو كُوِّدت الدفعة جزئيًّا من قبل.
    workmanshipAllocated: toMoney(l.workmanship_allocated),
    totalCost: toMoney(l.total_cost),
    status: l.status || "open",
    enteredWeight: l.entered_weight == null ? null : toWeight(l.entered_weight),
    wastageWeight: toWeight(l.wastage_weight),
    surplusWeight: toWeight(l.surplus_weight),
    closedBy: l.closed_by || null,
    closedAt: l.closed_at || null,
    createdBy: l.created_by,
    // ⚠ من purchases عبر LEFT JOIN — راجع تعليق bootstrap.routes.js.
    paymentMethod: l.payment_method || null,
    officeId: l.office_id || null,
    invoicePending: l.invoice_pending == null ? null : !!l.invoice_pending,
    feesPaidNow: l.pay_fees_now == null ? null : !!l.pay_fees_now,
    notes: l.purchase_notes || "",
    // ⚠ لم يُبنَ بعد سيرفريًا (راجع تعليق createLotCore في
    // GoldInventoryApp.jsx) — تبقى null فلا يُظهر الفرونت إند فاتورة
    // مرفقة وهميًا؛ شارة "بانتظار الفاتورة" تعتمد على invoicePending
    // أعلاه بدلًا من ذلك.
    invoiceAttachId: null,
    invoiceFile: null,
  }));
}

/**
 * scrap_items (DB) → عنصر كسر محلي بشكل weight/karat واحد ظاهري، مطابق
 * لِما تقرأه شاشات الكسر القديمة (ScrapCustodyPage.jsx وغيرها) — رغم أن
 * الباك إند يفصل karat_est/weight_est (وقت الشراء، ثابت) عن karat_final/
 * weight_final (يُثبَّت مرة واحدة عند التكسير أو الاستلام). القيمة
 * الظاهرة هنا هي "الأحدث المعروف": final إن وُجد، وإلا est.
 *
 * requestsById (اختياري): Map من scrap_requests.id إلى صفٍّ خام، تُستخدَم
 * لاشتقاق requestRef (المرجع النصي) بدل تسريب UUID للواجهة.
 */
function normalizeScrapItems(rows, requestsById) {
  return rows.map((r) => {
    const hasFinal = r.weight_final != null;
    const weight = toWeight(hasFinal ? r.weight_final : r.weight_est);
    const karat = hasFinal ? r.karat_final : r.karat_est;
    const req = requestsById && r.request_id ? requestsById.get(r.request_id) : null;
    return {
      id: r.id,
      ref: r.ref,
      karat,
      weight,
      // ⚠ الوزن الأصلي وقت الشراء يبقى متاحًا (مثلًا لعرض فرق التكسير في
      // الواجهة) حتى بعد تثبيت final — لا يُستبدَل به.
      originalWeight: toWeight(r.weight_est),
      grossWeight: r.gross_weight == null ? null : toWeight(r.gross_weight),
      // ⚠ اسمان مختلفان لنفس القيمة (stones_margin_est) لأن
      // ScrapCustodyPage.jsx يقرأ أحيانًا stonesMarginEstimate وأحيانًا
      // stonesMargin (تسمية غير متسقة في الشاشة القديمة نفسها) — يُطابَق
      // كلاهما بدل تعديل الشاشة.
      stonesMarginEstimate: toWeight(r.stones_margin_est),
      stonesMargin: toWeight(r.stones_margin_est),
      pricePerGram: r.price_per_gram == null ? null : Number(r.price_per_gram),
      total: toMoney(r.total_paid),
      paymentMethod: r.payment_method,
      customerName: r.customer_name,
      description: r.description,
      date: r.created_at,
      stage: r.stage,
      breakVariance: r.break_variance == null ? null : toWeight(r.break_variance),
      weightRemaining: r.weight_remaining == null ? null : toWeight(r.weight_remaining),
      requestId: r.request_id,
      requestRef: req ? req.ref : null,
      businessDayId: r.business_day_id,
      createdBy: r.created_by,
    };
  });
}

/** يعيد تسمية مفتاح scrapItemId → scrapId في مصفوفة أسطر (سواء مُرسَلة/مُقيَّمة/مؤكَّدة). */
function renameScrapLineKeys(lines) {
  return (Array.isArray(lines) ? lines : []).map((l) => {
    const { scrapItemId, ...rest } = l;
    return { scrapId: scrapItemId, ...rest };
  });
}

/**
 * scrap_requests (DB، payload بشكل JSONB) → طلب كسر محلي بحقول مسطَّحة
 * على المستوى الأعلى (sentLines/assessedLines/confirmedLines)، مطابقًا
 * لِما تقرأه ScrapCustodyPage.jsx مباشرة من كائن الطلب (لا من payload
 * متداخل) — وبإعادة تسمية scrapItemId إلى scrapId داخل كل سطر (الاتفاقية
 * التي تقرأها هذه الشاشة تحديدًا: l.scrapId).
 *
 * usersById (اختياري): Map من users.id إلى الاسم، لعرض created_by/
 * approved_by كاسم بدل UUID خام.
 */
function normalizeScrapRequests(rows, usersById) {
  const nameOf = (id) => (usersById && id ? usersById.get(id) || null : null);
  return rows.map((r) => {
    const payload = r.payload || {};
    return {
      id: r.id,
      ref: r.ref,
      status: r.status,
      itemCount: Array.isArray(payload.sentLines) ? payload.sentLines.length : 0,
      sentLines: renameScrapLineKeys(payload.sentLines),
      assessedLines: renameScrapLineKeys(payload.assessedLines),
      confirmedLines: renameScrapLineKeys(payload.confirmedLines),
      sentFine: toWeight(r.sent_fine),
      assessedFine: r.assessed_fine == null ? null : toWeight(r.assessed_fine),
      confirmedFine: r.confirmed_fine == null ? null : toWeight(r.confirmed_fine),
      variance: r.variance == null ? null : toWeight(r.variance),
      note: r.note,
      assessNote: r.assess_note,
      createdAt: r.created_at,
      createdBy: r.created_by,
      createdByName: nameOf(r.created_by),
      assessedBy: r.assessed_by,
      approvedBy: r.approved_by,
      approvedByName: nameOf(r.approved_by),
      receivedBy: r.received_by,
      businessDayId: r.business_day_id,
    };
  });
}

/**
 * business_days (DB) → يوم عمل محلي، بشكل `snapshot` متداخل مُصطنَع من
 * أعمدة اللقطة المسطَّحة (sales_sum/expenses_sum/...) — مطابقًا لِما
 * تقرأه WorkDayPage.jsx/DayControl.jsx (`d.snapshot?.salesSum` إلخ)، رغم
 * أن الباك إند يخزّنها أعمدة مباشرة على business_days نفسه لا JSON متداخل.
 *
 * ⚠ نطاق متعمَّد: `profit` (الربح) ليس ضمن اللقطة الآتية من الخادم —
 * حسابه يحتاج تكلفة كل صنف + نصيبه من مصنعية الدفعة (saleProfitOf)، وهي
 * بيانات تعيش أصلًا في bootstrap المحمَّل لدى الفرونت إند (sales+items).
 * يبقى الربح محسوبًا محليًا كما كان (WorkDayPage يحسبه بنفسه من
 * todaySales)، لا مُعادًا بناؤه هنا. `snapshot.profit` لذلك يبقى `null`
 * لليوم المُقفَل (لا يظهر إلا في سجل "الأيام السابقة" الذي لا يملك
 * أصلًا وصولًا لبيانات الأصناف التاريخية لحساب ربح دقيق لكل يوم ماضٍ —
 * فجوة موثَّقة، لا صفرًا مضلِّلًا).
 */
function normalizeBusinessDays(rows, usersById) {
  const nameOf = (id) => (usersById && id ? usersById.get(id) || null : null);
  return rows.map((d) => ({
    id: d.id,
    ref: d.ref,
    status: d.status,
    tillFloat: toMoney(d.till_float),
    scrapFloat: toMoney(d.scrap_float),
    openedAt: d.opened_at,
    // ⚠ الشاشات القديمة (WorkDayPage/DayControl) تقرأ openedBy/closedBy
    // كاسمٍ للعرض مباشرة ("فتحه {openDay.openedBy}") لا كمعرّف — نحلّه هنا
    // بدل تسريب UUID خام للواجهة.
    openedBy: nameOf(d.opened_by),
    openedById: d.opened_by,
    closedAt: d.closed_at,
    closedBy: nameOf(d.closed_by),
    closedById: d.closed_by,
    note: d.note,
    closeNote: d.close_note,
    snapshot:
      d.status === "closed"
        ? {
            salesCount: d.sales_count == null ? 0 : Number(d.sales_count),
            salesSum: toMoney(d.sales_sum),
            profit: null,
            expenses: toMoney(d.expenses_sum),
            purchases: toMoney(d.purchases_sum),
            cashAtClose: toMoney(d.cash_at_close),
            safeAtClose: toMoney(d.safe_at_close),
            custodyAtClose: toMoney(d.custody_at_close),
            suspendedScrap:
              d.suspended_scrap_count > 0
                ? { count: Number(d.suspended_scrap_count), weight: toWeight(d.suspended_scrap_weight) }
                : null,
          }
        : null,
  }));
}

/** daily_custody (DB) → عهدة صندوق يومي محلية — WorkDayPage/DayControl. */
function normalizeDailyCustody(rows, usersById) {
  const nameOf = (id) => (usersById && id ? usersById.get(id) || null : null);
  return rows.map((c) => ({
    id: c.id,
    ref: c.ref,
    businessDayId: c.business_day_id,
    status: c.status,
    floatCash: toMoney(c.float_cash),
    floatNetwork: toMoney(c.float_network),
    countedCash: c.counted_cash == null ? null : toMoney(c.counted_cash),
    countedNetwork: c.counted_network == null ? null : toMoney(c.counted_network),
    expectedCash: c.expected_cash == null ? null : toMoney(c.expected_cash),
    expectedNetwork: c.expected_network == null ? null : toMoney(c.expected_network),
    varianceCash: c.variance_cash == null ? null : toMoney(c.variance_cash),
    varianceNetwork: c.variance_network == null ? null : toMoney(c.variance_network),
    note: c.note,
    closeNote: c.close_note,
    openedAt: c.opened_at,
    openedBy: nameOf(c.opened_by),
    openedById: c.opened_by,
    closedAt: c.closed_at,
    closedBy: nameOf(c.closed_by),
    closedById: c.closed_by,
  }));
}

function normalizeUsers(rows) {
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    ref: u.ref,
    role: u.role,
    canUseAi: !!u.can_use_ai,
    allowedPages: u.allowed_pages,
    active: !!u.active,
    allowedTabs: u.allowed_tabs,
    allowedMore: u.allowed_more,
    createdAt: u.created_at,
  }));
}

// ── الحجوزات، الإصلاحات، والمرتجعات (migration 013) ──

function normalizeReservations(rows) {
  return rows.map((r) => ({
    id: r.id,
    ref: r.ref,
    customerId: r.customer_id,
    customerName: r.customer_name || "",
    itemId: r.item_id,
    total: toMoney(r.total),
    deposit: toMoney(r.deposit),
    remaining: r.remaining == null ? null : toMoney(r.remaining),
    description: r.description || "",
    status: r.status,
    method: r.method,
    date: r.created_at,
    cancelledAt: r.cancelled_at,
    refunded: !!r.refunded,
    createdBy: r.created_by,
  }));
}

function normalizeRepairs(rows) {
  return rows.map((r) => ({
    id: r.id,
    ref: r.ref,
    customerName: r.customer_name || "",
    description: r.description || "",
    cost: toMoney(r.cost),
    profit: toMoney(r.profit),
    fundingSource: r.funding_source,
    notes: r.notes || "",
    date: r.created_at,
    createdBy: r.created_by,
  }));
}

function normalizeReturns(rows) {
  return rows.map((r) => ({
    id: r.id,
    ref: r.ref,
    saleId: r.sale_id,
    customerId: r.customer_id,
    customerName: r.customer_name || "",
    refund: toMoney(r.amount),
    weight: toWeight(r.weight),
    note: r.reason || "",
    lineIndexes: r.line_indexes || [],
    lines: r.lines || [],
    fullReturn: !!r.full_return,
    refundSource: r.refund_source,
    exchangeSaleId: r.exchange_sale_id || null,
    exchangeSettle: r.exchange_settle || null,
    exchangeDiff: r.exchange_diff == null ? null : toMoney(r.exchange_diff),
    date: r.created_at,
    createdBy: r.created_by,
  }));
}

function normalizeReceipts(rows) {
  return rows.map((r) => ({
    id: r.id,
    ref: r.ref,
    customerId: r.customer_id,
    customerName: r.customer_name || "",
    saleId: r.sale_id,
    amount: toMoney(r.amount),
    method: r.method,
    category: r.category,
    note: r.note || "",
    date: r.created_at,
    createdBy: r.created_by,
  }));
}

/// أحكام المراجعة المحاسبية (migration 037) — تُضاف ولا تُعدَّل.
function normalizeReviews(rows) {
  return rows.map((r) => ({
    id: r.id, key: r.key, kind: r.kind, targetId: r.target_id ?? r.targetId, targetRef: r.target_ref ?? r.targetRef,
    targetDate: r.target_date ?? r.targetDate ?? null, label: r.label, why: r.why, amount: toMoney(r.amount),
    verdict: r.verdict, note: r.note || "", fingerprint: r.fingerprint || "",
    reviewer: r.reviewer_name ?? r.reviewer ?? "", reviewerId: r.reviewer_id ?? r.reviewerId, reviewerRole: r.reviewer_role ?? r.reviewerRole,
    date: r.created_at ?? r.date,
  }));
}

/**
 * نقطة الدخول الرئيسية — تُستدعى مرة واحدة بعد الدخول بنتيجة
 * fetchBootstrap()، وتُرجع كائنًا جاهزًا للتوزيع مباشرة على setters
 * الحالة الموجودة أصلًا في GoldInventoryApp.jsx.
 *
 * ⚠ الكسر (scrapEntries/scrapRequests) الآن جزء من هذا التطبيع: يُشتق
 * weight/karat ظاهري واحد (final إن وُجد، وإلا est) ليطابق شكل الشاشات
 * القديمة، ويُسطَّح payload الطلبات لحقول أعلى المستوى مع إعادة تسمية
 * scrapItemId إلى scrapId (اتفاقية ScrapCustodyPage.jsx).
 */
function normalizeBootstrap(boot) {
  const { cashTx, safeTx, scrapCustodyTx } = normalizeCashPools(boot.cashTx || []);
  const users = normalizeUsers(boot.users || []);
  const usersById = new Map(users.map((u) => [u.id, u.name]));
  const usersFullById = new Map(users.map((u) => [u.id, { name: u.name, ref: u.ref }]));
  const requestsById = new Map((boot.scrapRequests || []).map((r) => [r.id, r]));
  return {
    items: normalizeItems(boot.items || [], boot.itemUnits || []),
    sales: normalizeSales(boot.sales || [], boot.saleLines || []),
    cashTx,
    safeTx,
    scrapCustodyTx,
    safeGoldTx: normalizeSafeGoldTx(boot.safeGoldTx || []),
    safeAudits: normalizeSafeAudits(boot.safeAudits || []),
    scrapEntries: normalizeScrapItems(boot.scrapItems || [], requestsById),
    scrapRequests: normalizeScrapRequests(boot.scrapRequests || [], usersById),
    customers: normalizeCustomers(boot.customers || []),
    suppliers: normalizeSuppliers(boot.suppliers || []),
    categories: normalizeCategories(boot.categories || []),
    lots: normalizeLots(boot.lots || []),
    users,
    // ⚠ فجوة حقيقية أُغلقت هنا: loadBootstrap لم يكن يستهلك businessDay
    // إطلاقًا (لا setBusinessDays في كل الملف) — يوم العمل نفسه لم يكن
    // موصولًا بالباك إند بعد. businessDays (جمع، من boot.businessDays —
    // القائمة الكاملة) هو ما تقرأه فعليًا WorkDayPage/DayControl (سجل
    // "الأيام السابقة" + اليوم المفتوح عبر .find(status==='open')).
    businessDays: normalizeBusinessDays(boot.businessDays || [], usersById),
    dailyCustody: normalizeDailyCustody(boot.dailyCustody || [], usersById),
    // ⚠ يطابق تمامًا اتفاقية المرجع القديمة: null = غير مقفل، كائن = مقفل
    // (راجع handleToggleStocktakeLock) — لا {locked:false} ثابت، لأن أي
    // كائن (حتى {locked:false}) صادق (truthy) في JS، وأغلب الشاشات تتحقق
    // بـ`if (stocktakeLock)` مباشرة لا `.locked`.
    stocktakeLock:
      boot.stocktakeLock && boot.stocktakeLock.locked
        ? { startedAt: boot.stocktakeLock.locked_at, startedBy: null, startedById: boot.stocktakeLock.locked_by }
        : null,
    appSettings: boot.settings
      ? {
          taxEnabled: !!boot.settings.tax_enabled,
          taxRate: Number(boot.settings.tax_rate) || 0,
          cardFees: boot.settings.card_fees || {},
          workdayMode: boot.settings.workday_mode === "off" ? "off" : "required",
          openingMode: !!boot.settings.opening_mode,
          openingFinishedAt: boot.settings.opening_finished_at || null,
          approvalsEnabled: boot.settings.approvals_enabled !== false,
          approvalThresholds: boot.settings.approval_thresholds || {},
          periodLocks: { lockAll: boot.settings.lock_all || null, lockPosted: boot.settings.lock_posted || null },
        }
      : null,
    expenses: normalizeExpenses(boot.expenses || [], usersFullById),
    expenseNames: normalizeExpenseNames(boot.expenseNames || []),
    taskirEntries: normalizeTaskirEntries(boot.taskirEntries || []),
    taskirOffices: normalizeTaskirOffices(boot.taskirOffices || []),
    taskirOfficeTx: normalizeTaskirOfficeTx(boot.taskirOfficeTx || []),
    reservations: normalizeReservations(boot.reservations || []),
    repairs: normalizeRepairs(boot.repairs || []),
    returns: normalizeReturns(boot.returns || []),
    receipts: normalizeReceipts(boot.receipts || []),
    // الاعتمادات تصل مُشكَّلةً من الخادم (shapeApproval) — مرورٌ مباشر
    approvals: Array.isArray(boot.approvals) ? boot.approvals : [],
    reviews: normalizeReviews(boot.reviews || []),
    assetClasses: normalizeAssetClasses(boot.assetClasses || []),
    fixedAssets: normalizeFixedAssets(boot.fixedAssets || []),
    depreciationSchedule: normalizeDepreciationSchedule(boot.depreciationSchedule || []),
    // ⚠ إصلاح فجوة حقيقية (2026-09): journal/goldLedger كانتا تُبنيان
    // محليًا بحتة (persist إلى window.storage) منفصلتين عن القيود الحقيقية
    // التي يكتبها الباك إند فعليًا عبر postJournalEntry لكل عملية مالية، منفصلة
    // تمامًا عن القيود الحقيقية نفسها. bootstrap.routes.js يُرجع الآن journal/goldLedger
    // بنفس الشكل الذي تتوقّعه الشاشات بالضبط (id/ref/date/opType/label/lines[{account,debit,credit}]/
    // note/createdBy/posted/isReversal/reversed/refTable/refId لـjournal، id/at/ref/opType/karat/weight/
    // accountCode/type/note/createdBy لـgoldLedger) — مرور مباشر بلا تحويل، خلاف
    // كل الجداول الأخرى هنا (الباك إند يستخدم snake_case).
    journal: Array.isArray(boot.journal) ? boot.journal : [],
    goldLedger: Array.isArray(boot.goldLedger) ? boot.goldLedger : [],
    // ⚠ migration 017: boot.branch (كائن الفرع) كان موجودًا في الاستجابة
    // منذ البداية لكن بلا أي مستهلك في كل الفرونت إند — أول استخدام له
    // هنا فقط: isHq يقرّر ظهور تبويب "تقرير الفروع" من عدمه.
    isHq: !!boot.branch?.is_hq,
  };
}

export {
  normalizeBootstrap,
  normalizeReviews,
  normalizeItems,
  normalizeSales,
  normalizeCashPools,
  normalizeCashTxRow,
  normalizeSafeGoldTx,
  normalizeSafeAudits,
  normalizeScrapItems,
  normalizeScrapRequests,
  normalizeBusinessDays,
  normalizeDailyCustody,
  normalizeCustomers,
  normalizeSuppliers,
  normalizeCategories,
  normalizeLots,
  normalizeUsers,
  normalizeExpenses,
  normalizeExpenseNames,
  normalizeTaskirEntries,
  normalizeTaskirOffices,
  normalizeTaskirOfficeTx,
  normalizeReservations,
  normalizeRepairs,
  normalizeReturns,
  normalizeReceipts,
  normalizeAssetClasses,
  normalizeFixedAssets,
  normalizeDepreciationSchedule,
};
