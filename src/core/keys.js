import { key } from "../domain/key.js";

const ITEMS_KEY = "ounce_items_v3";

const PRICE_KEY = "ounce_price_data_v1";

const SALES_KEY = "ounce_sales_v1";

const CASH_KEY = "ounce_cash_v1";

const SCRAP_KEY = "ounce_scrap_v1";

const SCRAP_CUSTODY_KEY = "ounce_scrap_custody_v1";

const SAFE_KEY = "ounce_safe_v1";

const TASKIR_KEY = "ounce_taskirat_v1";

const TASKIR_OFFICES_KEY = "ounce_taskir_offices_v1";

const AUDIT_KEY = "ounce_audits_v1";

const SUPPLIERS_KEY = "ounce_suppliers_v1";

const LOTS_KEY = "ounce_lots_v1";

const EXPENSES_KEY = "ounce_expenses_v1";

const PARTNERS_KEY = "ounce_partners_v1";

const PARTNER_TX_KEY = "ounce_partner_tx_v1";

const USERS_KEY = "ounce_users_v1";

const TASKIR_OFFICE_TX_KEY = "ounce_taskir_office_tx_v1";

const SAFE_GOLD_KEY = "ounce_safe_gold_v1";

const SETTINGS_KEY = "ounce_app_settings_v1";

const EXPENSE_NAMES_KEY = "ounce_expense_names_v1";

const CUSTOMERS_KEY = "ounce_customers_v1";

const TRUST_GOLD_KEY = "ounce_trust_gold_v1";

const RETURNS_KEY = "ounce_returns_v1";

const RECEIPTS_KEY = "ounce_receipts_v1"; // سداد المبيعات الآجلة

const SAFE_AUDITS_KEY = "ounce_safe_audits_v1"; // جرد الخزنة الفعلي

const RESERVATIONS_KEY = "ounce_reservations_v1"; // الحجز والعربون
// ═══════════════════════════════════════════════════════════════
//  يوم العمل (جلسة)
//
//  المحل قد يُقفل بعد منتصف الليل، فبيعة الساعة 1:30 فجرًا تخصّ يوم أمس
//  لا اليوم الجديد. الاعتماد على تاريخ التقويم يوزّع حركة الليلة الواحدة
//  على يومين، فلا يطابق الصندوق اليومي أي تقرير.
//
//  الحل: كل حركة تحمل معرّف يوم العمل المفتوح وقت تسجيلها. اليوم لا
//  ينتهي بمنتصف الليل بل بإقفاله يدويًا.
// ═══════════════════════════════════════════════════════════════

const BUSINESS_DAYS_KEY = "ounce_business_days_v1";
// ⚠ قفل الجرد: أثناء العدّ يُمنع البيع والتحويل من المخزون. بيع قطعة
// بينما يُعدّ الرف يجعل الفرق يظهر عجزًا وهو بيع مسجّل — وتضيع ساعات في
// تتبّع فرق لا وجود له.

const STOCKTAKE_LOCK_KEY = "ounce_stocktake_lock_v1";
// ترتيب المجموعات وعناصرها في القائمة — يتحكم به المستخدم

const MENU_ORDER_KEY = "ounce_menu_order_v1";

const CATEGORIES_KEY = "ounce_categories_v1";

const SCRAP_REQUESTS_KEY = "ounce_scrap_requests_v1";
// ⚠ دفتر الوزن — كيان مستقل عن دفتر النقد، لا يحمل مبالغ إطلاقًا

const GOLD_LEDGER_KEY = "ounce_gold_ledger_v1";
// اختصارات يصنعها المساعد بالطلب

const SHORTCUTS_KEY = "ounce_shortcuts_v1";

const CUSTOM_GROUPS_KEY = "ounce_custom_groups_v1";

const COMMISSIONS_KEY = "ounce_commissions_v1";

const DAILY_CUSTODY_KEY = "ounce_daily_custody_v1";
// ───────────────────────────────────────────────────────────────
// الأرقام المرجعية.
// كل كيان ومعاملة يحمل رقمًا مرجعيًا قصيرًا يُقرأ ويُنطق ويُكتب على الفاتورة.
// المعرّفات الداخلية طويلة وغير صالحة للتخاطب اليومي («أعطني كشف المورد
// SUP-014» أوضح من مقارنة معرّف من 16 خانة).
// ───────────────────────────────────────────────────────────────

const ENTRY_SESSIONS_KEY = "ounce_entry_sessions_v1";

const TRUST_ACCOUNTS_KEY = "ounce_trust_accounts_v1";

const TRUST_LEDGER_KEY = "ounce_trust_ledger_v1";

const WEIGHT_ADJ_KEY = "ounce_weight_adjustments_v1";

// ---------------------------------------------------------------
// Commission engine.
// A rule belongs to one seller. `basis` decides whether the percentage is
// taken on turnover or on realised profit — profit-based is the safer default
// for a gold shop, because a seller can otherwise hit a turnover target by
// discounting away the margin. `target` is a floor: no percentage is earned
// until the seller passes it. `perInvoice` is a flat amount per completed
// invoice and is paid regardless of the target.
// ---------------------------------------------------------------

const REPAIRS_KEY = "ounce_repairs_v1";

const SCRAP_SURPLUS_KEY = "ounce_scrap_surplus_v1";

const NAV_LAYOUT_KEY = "ounce_nav_layout_v1";

// ---------------------------------------------------------------
// Central (HQ) integration.
// This is the BRANCH app. It publishes a read-only summary of itself to a
// SHARED storage key so the central program can consolidate branches without
// ever touching the branch's private ledgers. It also reads a shared config
// key where HQ can register the branch and push permission overrides.
// ---------------------------------------------------------------
// ============================================================
// نواة ترخيص «أونصة» — shared verbatim across the vendor console,
// the central app and the branch app so all three agree on the format.
//
// HONEST SECURITY NOTE (read this):
// This is CLIENT-SIDE validation. It reliably prevents casual/accidental
// misuse — a customer can't just type a branch code and self-expand, and
// expired subscriptions stop working. It does NOT stop a determined
// technical attacker who edits the app's code, because the secret ships
// inside the app. Real enforcement requires a server that holds the secret
// and validates activations online. The token format below is deliberately
// designed so that swapping to a server later needs no data migration.
// ============================================================

const BRANCH_IDENTITY_KEY = "ounce_branch_identity_v1"; // private: which branch am I

const HQ_BRANCH_REGISTRY_KEY = "ounce_hq_branches_v1"; // shared: HQ's branch list

const HQ_PERMISSIONS_KEY = "ounce_hq_permissions_v1"; // shared: HQ permission overrides

const OPENING_BALANCE_KEY = "ounce_opening_balance_v1";

const FISCAL_CLOSURES_KEY = "ounce_fiscal_closures_v1";

// Role-based access control: each role unlocks a fixed set of tabs and
// More-menu pages. Anything not listed is never rendered for that role — not
// just blocked, but hidden entirely from navigation. Each PIN belongs to a
// named person (not just a role), so every action taken can be attributed.

const BANK_TX_KEY = "ounce_bank_tx_v1";

/// نافذة التسوية: البنك يودع خلال يوم إلى ثلاثة عادةً.

const JOURNAL_KEY = "ounce_journal_v1";

/// يبني أسطر القيد من قاعدة العملية.
///
/// يُعيد `{ lines, balanced, error }`. الأسطر بالعملة فقط — الوزن دفترٌ
/// مستقل لا يدخل هنا.

const AUDIT_LOG_KEY = "ounce_audit_log_v1";

/// أنواع الأحداث — مُعلَنة لا حرّة.
///
/// ⚠ النصّ الحرّ يجعل الفرز مستحيلًا بعد شهر: «حذف» و«حُذف» و«إلغاء»
/// أحداثٌ واحدة بثلاثة أسماء.

const FIXED_ASSETS_KEY = "ounce_fixed_assets_v1";

const DEPRECIATION_KEY = "ounce_depreciation_v1";

const COST_CENTERS_KEY = "ounce_cost_centers_v1";

const BUDGET_KEY = "ounce_budget_v1";

const PERIOD_CLOSE_KEY = "ounce_period_close_v1";

/// فئات الأصول بأعمارها الافتراضية.
///
/// ⚠ العمر ليس اختيارًا حرًّا: تقصيره يُضخّم المصروف ويُخفّض الضريبة،
/// وتطويله يُجمّل الربح. الفئات المعلَنة تمنع الاجتهاد في كل قطعة.

const PAYROLL_KEY = "ounce_payroll_v1";

const ATTENDANCE_KEY = "ounce_attendance_v1";

const LEAVE_KEY = "ounce_leave_v1";

/// نسب التأمينات الاجتماعية — قابلة للتعديل من الإعدادات.
///
/// ⚠ النسب تختلف بجنسية الموظف: السعودي عليه معاش وساند، وغير السعودي
/// أخطار مهنية على المنشأة وحدها. تطبيق نسبة واحدة يُخطئ في الحالتين.

const APPROVALS_KEY = "ounce_approvals_v1";

const WEBHOOKS_KEY = "ounce_webhooks_v1";

/// ما يحتاج اعتمادًا وبأي حدّ.

const STORE_KEY = "ounce_store_link_v1";

const STORE_ORDERS_KEY = "ounce_store_orders_v1";

const INTEGRATION_KEY = "ounce_integration_v1";

const EXT_INVOICES_KEY = "ounce_ext_invoices_v1";

const PRINTER_KEY = "ounce_printer_v1";

const RFID_KEY = "ounce_rfid_v1";

export { APPROVALS_KEY, ATTENDANCE_KEY, AUDIT_KEY, AUDIT_LOG_KEY, BANK_TX_KEY, BRANCH_IDENTITY_KEY, BUDGET_KEY, BUSINESS_DAYS_KEY, CASH_KEY, CATEGORIES_KEY, COMMISSIONS_KEY, COST_CENTERS_KEY, CUSTOMERS_KEY, CUSTOM_GROUPS_KEY, DAILY_CUSTODY_KEY, DEPRECIATION_KEY, ENTRY_SESSIONS_KEY, EXPENSES_KEY, EXPENSE_NAMES_KEY, EXT_INVOICES_KEY, FISCAL_CLOSURES_KEY, FIXED_ASSETS_KEY, GOLD_LEDGER_KEY, HQ_BRANCH_REGISTRY_KEY, HQ_PERMISSIONS_KEY, INTEGRATION_KEY, ITEMS_KEY, JOURNAL_KEY, LEAVE_KEY, LOTS_KEY, MENU_ORDER_KEY, NAV_LAYOUT_KEY, OPENING_BALANCE_KEY, PARTNERS_KEY, PARTNER_TX_KEY, PAYROLL_KEY, PERIOD_CLOSE_KEY, PRICE_KEY, PRINTER_KEY, RECEIPTS_KEY, REPAIRS_KEY, RESERVATIONS_KEY, RETURNS_KEY, RFID_KEY, SAFE_AUDITS_KEY, SAFE_GOLD_KEY, SAFE_KEY, SALES_KEY, SCRAP_CUSTODY_KEY, SCRAP_KEY, SCRAP_REQUESTS_KEY, SCRAP_SURPLUS_KEY, SETTINGS_KEY, SHORTCUTS_KEY, STOCKTAKE_LOCK_KEY, STORE_KEY, STORE_ORDERS_KEY, SUPPLIERS_KEY, TASKIR_KEY, TASKIR_OFFICES_KEY, TASKIR_OFFICE_TX_KEY, TRUST_ACCOUNTS_KEY, TRUST_GOLD_KEY, TRUST_LEDGER_KEY, USERS_KEY, WEBHOOKS_KEY, WEIGHT_ADJ_KEY };
