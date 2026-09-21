import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Banknote, ChevronUp, FileText, Handshake, Loader2, Lock, LogOut, Menu, Mic, Package, PackageMinus, Plus, Printer, Receipt, RotateCcw, Scale, Search, ShoppingCart, Truck, Wrench, X } from "lucide-react";
import { CHART_OF_ACCOUNTS, POSTING_RULES } from "../core/chart.js";
import { APP_MODES, CATEGORY_STATE, DEFAULT_APP_MODE, DEFAULT_CATEGORIES, DEFAULT_INTEGRATION, DEFAULT_OPENING_BALANCE, DEFAULT_PRINTER, DEFAULT_SETTINGS, DEFAULT_STORE, DEFAULT_USERS, EXPENSE_CATEGORIES, ISSUE_REASONS, MIGRATION_FLAG, PARTNER_REQUIRED, PUBLISH_CAP, RFID_DEFAULTS, ROLES, TRUST_MOVES } from "../core/constants.js";
import { DEFAULT_COMMISSION } from "../core/erp.js";
import { AUDIT_KEY, AUDIT_LOG_KEY, BANK_TX_KEY, BRANCH_IDENTITY_KEY, BRANCH_LINK_KEY, BUSINESS_DAYS_KEY, CASH_KEY, CATEGORIES_KEY, COMMISSIONS_KEY, CUSTOMERS_KEY, CUSTOM_GROUPS_KEY, DAILY_CUSTODY_KEY, ENTRY_SESSIONS_KEY, EXPENSES_KEY, EXPENSE_NAMES_KEY, EXT_INVOICES_KEY, FISCAL_CLOSURES_KEY, GOLD_LEDGER_KEY, HQ_PERMISSIONS_KEY, INTEGRATION_KEY, ITEMS_KEY, JOURNAL_KEY, LOTS_KEY, MENU_ORDER_KEY, NAV_LAYOUT_KEY, OPENING_BALANCE_KEY, PARTNERS_KEY, PARTNER_TX_KEY, PRICE_KEY, PRINTER_KEY, RECEIPTS_KEY, REPAIRS_KEY, RESERVATIONS_KEY, RETURNS_KEY, RFID_KEY, SAFE_AUDITS_KEY, SAFE_GOLD_KEY, SAFE_KEY, SALES_KEY, SCRAP_CUSTODY_KEY, SCRAP_KEY, SCRAP_REQUESTS_KEY, SCRAP_SURPLUS_KEY, SETTINGS_KEY, SHORTCUTS_KEY, STOCKTAKE_LOCK_KEY, STORE_KEY, STORE_ORDERS_KEY, SUPPLIERS_KEY, TASKIR_KEY, TASKIR_OFFICES_KEY, TASKIR_OFFICE_TX_KEY, TRUST_ACCOUNTS_KEY, TRUST_GOLD_KEY, TRUST_LEDGER_KEY, USERS_KEY, WEIGHT_ADJ_KEY } from "../core/keys.js";
import { PURITY, fine24, fmt, fmtMoney, fmtW, fromHalalas, halalas, pricePerGram, roundMoney2, roundW, sumMoney, weightTimesPrice } from "../core/money.js";
import { CARD_NETWORKS } from "../core/money-rules.js";
import { DEFAULT_NAV_LAYOUT, MAIN_TAB_IDS, NAV_REGISTRY, TAB_KIND_IDS } from "../core/navigation.js";
import { installStorageGuard, layoutIds, loadAllStores, normalizeOpeningBalance, normalizeRoleLayout, validateStore } from "../core/stores.js";
import * as api from "../core/api.js";
import { normalizeBootstrap, normalizeCashTxRow, normalizeSafeGoldTx, normalizeSafeAudits, normalizeBusinessDays, normalizeDailyCustody, normalizeTaskirEntries, normalizeTaskirOfficeTx, normalizeFixedAssets, normalizeDepreciationSchedule } from "../core/normalize.js";
// ⚠ الحجوزات/الإصلاحات/المرتجعات: normalize.js يُطبِّع القيم فعليًا (راجع
// normalizeReservations/normalizeRepairs/normalizeReturns/normalizeReceipts)
// لكن استدعاءها هنا يمر عبر n.reservations/n.repairs/... من normalizeBootstrap
// نفسها — لا حاجة لاستيراد إضافي، فقط تأكيد أنها مضمّنة أعلاه.

// ⚠ لم يعد الفرع مُعرَّفًا وقت البناء (VITE_DEFAULT_BRANCH_ID سابقًا) —
// كل نسخة تشغيل الآن تتعرّف على فرعها من رابط دخول الفرع (/b/<ref>،
// المعروض من BranchLinkCard.jsx في ounce-central)، تُحلّه مرة واحدة عبر
// GET /branches/by-ref/:ref ثم تحفظه محليًا (BRANCH_LINK_KEY) فلا تحتاج
// فتح الرابط مرة أخرى. راجع resolveBranchLink أدناه وeffect استخدامه.
//
// ⚠ مسار الرابط ثابتٌ هنا (/b/) لأنه يجب أن يطابق بالضبط ما تبنيه
// BranchLinkCard.jsx على الطرف الآخر — أي تغيير هنا يكسر كل رابطٍ سبق
// توزيعه على أجهزة الفروع القائمة فعليًّا.
const BRANCH_LINK_PATH_PREFIX = "/b/";

/** يقرأ رمز الفرع من مسار الرابط الحالي إن وُجد (/b/<ref>...)، وإلا null. */
function branchRefFromUrl() {
  try {
    const path = window.location.pathname || "";
    if (!path.startsWith(BRANCH_LINK_PATH_PREFIX)) return null;
    const rest = path.slice(BRANCH_LINK_PATH_PREFIX.length);
    const ref = rest.split("/")[0];
    return ref ? decodeURIComponent(ref) : null;
  } catch (e) {
    return null;
  }
}

// رسائل أخطاء الباك إند الشائعة بالعربية — أي خطأ غير مذكور هنا يعرض
// fallback عام بدل رمز الخطأ الخام (لا معنى لـ"insufficient_stock" لمستخدم
// عادي، لكن الرسالة المطابقة له مفهومة).
const API_ERROR_MESSAGES = {
  insufficient_stock: "الكمية غير متوفرة",
  insufficient_weight: "الوزن غير متوفر",
  below_min_sale_weight: "أقل من الحد الأدنى للبيع لهذا التصنيف",
  item_not_found: "الصنف غير موجود",
  item_is_not_partial_sale_mode: "هذا الصنف لا يُباع بالوزن",
  item_requires_partial_sale_endpoint: "هذا الصنف يُباع بالوزن فقط",
  no_open_business_day: "لا يوجد يوم عمل مفتوح — افتح يوم العمل أولًا",
  stocktake_locked: "المخزون مقفل للجرد",
  credit_sale_requires_customer: "البيع الآجل يتطلب اختيار عميل",
  split_amounts_do_not_match_total: "مجموع المبلغين لا يطابق الإجمالي",
  trade_in_requires_lines: "بدل الكسر يتطلب سطر كسر واحد على الأقل",
  invalid_trade_line: "بيانات سطر الكسر غير صالحة",
  supplier_not_found: "المورد غير موجود",
  office_not_found: "مكتب التسكير غير موجود",
  scrap_payment_requires_karat_and_weight: "السداد بالكسر يتطلب عيارًا ووزنًا",
  page_not_allowed: "لا تملك صلاحية هذه الشاشة",
  invalid_or_expired_token: "انتهت الجلسة — سجّل الدخول مجددًا",
  name_taken: "يوجد موظف بهذا الاسم",
  pin_taken: "هذا الرقم السري مستخدم",
  pin_must_be_4_to_6_digits: "الرقم السري يجب أن يكون 4-6 أرقام",
  invalid_role: "صلاحية غير معروفة",
  would_remove_last_manager: "لا يمكن حذف آخر مدير في الفرع",
  units_unavailable: "بعض القطع لم تعد متاحة — أعد الفحص",
  invalid_reason: "سبب الإخراج غير صالح",
  no_units_selected: "لم تُحدَّد أي قطعة",
  karat_required: "العيار مطلوب",
  invalid_weight_or_price: "الوزن أو السعر غير صالح",
  insufficient_scrap_custody_balance: "رصيد عهدة الكسر غير كافٍ",
  scrap_item_not_found: "قطعة الكسر غير موجودة",
  scrap_item_not_in_box: "القطعة ليست في الصندوق",
  scrap_item_not_breakable: "القطعة غير قابلة للتكسير في هذه المرحلة",
  net_weight_exceeds_gross: "الوزن الصافي أكبر من القائم",
  actual_net_weight_required: "الوزن الصافي الفعلي مطلوب",
  no_items_selected: "لم تُحدَّد أي قطعة",
  no_eligible_items: "لا توجد قطع مؤهَّلة للإرسال",
  no_lines: "لا توجد أسطر",
  request_not_found: "الطلب غير موجود",
  request_not_pending: "الطلب ليس بانتظار الفحص",
  request_not_assessed: "الطلب لم يُقيَّم بعد",
  request_not_approved: "الطلب لم يُعتمَد بعد",
  unconfirmed_lines: "توجد أسطر غير مؤكَّدة",
  invalid_float_amount: "قيمة العهدة غير صالحة",
  day_already_open: "يوجد يوم عمل مفتوح بالفعل",
  insufficient_safe_cash: "نقدي الخزنة لا يكفي للعهدة المطلوبة",
  custody_already_open: "توجد عهدة صندوق مفتوحة بالفعل",
  no_open_custody: "لا توجد عهدة صندوق مفتوحة",
  cannot_manage_day: "فتح/إقفال يوم العمل بيد المدير — راجعه",
  invalid_tax_rate: "نسبة الضريبة غير صالحة",
  invalid_card_fee: "نسبة رسوم الشبكة غير صالحة",
  manager_only: "هذا الإجراء بيد المدير فقط",
  invalid_amount: "المبلغ غير صالح",
  invalid_category: "التصنيف غير صالح",
  invalid_funding_source: "مصدر الدفع غير صالح",
  employee_required: "اختيار الموظف مطلوب لهذا التصنيف",
  employee_not_found: "الموظف غير موجود",
  supplier_required: "اختيار المورد مطلوب",
  invalid_karat_or_weight: "العيار أو الوزن غير صالح",
  invalid_gold_source: "مصدر الذهب غير صالح",
  office_required: "اختيار مكتب التسكير مطلوب",
  invalid_price_per_gram: "سعر الجرام غير صالح",
  insufficient_scrap_stock: "لا يوجد كسر كافٍ بالمخزون لهذا العيار",
  invalid_mode: "طريقة السداد غير صالحة",
  invalid_source: "مصدر السداد غير صالح",
  name_required: "اسم المورد مطلوب",
  supplier_name_exists: "يوجد مورد بهذا الاسم",
  unit_id_required: "لم تُحدَّد القطعة",
  epc_required: "رمز البطاقة مطلوب",
  invalid_epc_format: "رمز البطاقة غير صالح",
  unit_not_found: "القطعة غير موجودة",
  epc_already_bound: "هذه البطاقة مربوطة بقطعة أخرى",
  invalid_class: "فئة الأصل غير صالحة",
  invalid_years: "عدد سنوات العمر غير صالح",
  invalid_salvage_pct: "نسبة الخردة غير صالحة",
  purchased_at_required: "تاريخ الشراء مطلوب",
  invalid_cost: "التكلفة غير صالحة",
  invalid_period: "الشهر غير صالح",
  already_disposed: "هذا الأصل مُستبعَد بالفعل",
  date_required: "التاريخ مطلوب",
  invalid_leave_type: "نوع الإجازة غير صالح",
  dates_required: "تاريخا البداية والنهاية مطلوبان",
  invalid_date_range: "تاريخ النهاية قبل البداية",
  not_found_or_decided: "الطلب غير موجود أو صدر فيه قرار سلفًا",
  invalid_decision: "القرار غير صالح",
  already_accrued: "رواتب هذا الشهر محتسبة سلفًا",
  no_staff: "لا موظفين برواتب",
  nothing_to_pay: "لا صافي يُصرف",
  already_paid: "صُرف سلفًا",
  nothing_due: "لا مستحقّ",
  already_left: "الموظف منتهي الخدمة بالفعل",
  not_found: "غير موجود",
};

function apiErrorMessage(err, fallback) {
  const code = err?.body?.error;
  return API_ERROR_MESSAGES[code] || fallback || "حدث خطأ غير متوقع";
}
import { DEFAULT_THEME, applyTheme } from "../core/theme.js";
import { FUNDING_SOURCES, SCRAP_STAGES } from "../core/workflow.js";
import { auditHash } from "../domain/auditHash.js";
import { buildAiChatContext } from "../domain/buildAiChatContext.js";
import { buildAuditEntry } from "../domain/buildAuditEntry.js";
import { buildDemoDataset } from "../domain/buildDemoDataset.js";
import { buildJournalLines } from "../domain/buildJournalLines.js";
import { buildReturnJournal } from "../domain/buildReturnJournal.js";
import { buildReversal } from "../domain/buildReversal.js";
import { buildStockFeed } from "../domain/buildStockFeed.js";
import { buildUniversalIndex } from "../domain/buildUniversalIndex.js";
import { buildWeightEntries } from "../domain/buildWeightEntries.js";
import { computeCommission } from "../domain/computeCommission.js";
import { computeReturnAmounts } from "../domain/computeReturnAmounts.js";
import { hashPin } from "../domain/hashPin.js";
import { aiAllowedFor, aiScope, branchDataKey, branchSnapshotKey, bundleById, cardFeeOf, cashAccountFor, categoryLabel, contentWidth, exchangeKind, expenseAccountFor, exportTablesPdf, fetchGoldPriceSAR, generateUnitCode, goldDestLabel, goldProfit, inPeriod, isBundle, isLiveScrap, itemLabel, lotAllocatedWeight, migrateLegacyKeys, modeAllowsAction, modeAllowsPage, modeAllowsTab, nameExists, navPerRow, normalizeFundingSource, normalizeName, r2, r3, remainingQty, saleProfitOf, saveAttachment, setRuntimeCategories, streamBase, trustBalance, unitCostBasis, unitCurrentValue, useViewport, weightTrialBalance } from "../domain/helpers.js";
import { isPeriodClosed } from "../domain/isPeriodClosed.js";
import { key } from "../domain/key.js";
import { nextCashRef } from "../domain/nextCashRef.js";
import { nextRef } from "../domain/nextRef.js";
import { parseShortcutRequest } from "../domain/parseShortcutRequest.js";
import { scopeIndex } from "../domain/scopeIndex.js";
import { settleableScrap } from "../domain/settleableScrap.js";
import { stageOf } from "../domain/stageOf.js";
import { validateExternalInvoice } from "../domain/validateExternalInvoice.js";
import { validateReturnRequest } from "../domain/validateReturnRequest.js";
import { validateStoreOrder } from "../domain/validateStoreOrder.js";
import { verifyPin } from "../domain/verifyPin.js";
import { AddPurchaseModal } from "../modals/AddPurchaseModal.jsx";
import { AddScrapModal } from "../modals/AddScrapModal.jsx";
import { AiActionSheet } from "../modals/AiActionSheet.jsx";
import { BundleSheet } from "../modals/BundleSheet.jsx";
import { CashModal } from "../modals/CashModal.jsx";
import { EntitySheet } from "../modals/EntitySheet.jsx";
import { NewSaleModal } from "../modals/NewSaleModal.jsx";
import { PartialSaleModal } from "../modals/PartialSaleModal.jsx";
import { SaleDetailModal } from "../modals/SaleDetailModal.jsx";
import { SetPriceModal } from "../modals/SetPriceModal.jsx";
import { VoiceSheet } from "../modals/VoiceSheet.jsx";
import { AccessSettingsPage } from "../screens/AccessSettingsPage.jsx";
import { AddGoodsPage } from "../screens/AddGoodsPage.jsx";
import { AiAssistantPage } from "../screens/AiAssistantPage.jsx";
import { AppSettingsPage } from "../screens/AppSettingsPage.jsx";
import { BackupPage } from "../screens/BackupPage.jsx";
import { BankReconPage } from "../screens/BankReconPage.jsx";
import { CashTab } from "../screens/CashTab.jsx";
import { CategoriesPage } from "../screens/CategoriesPage.jsx";
import { ConversionsPage } from "../screens/ConversionsPage.jsx";
import { CustomersPage } from "../screens/CustomersPage.jsx";
import { DailyJournalPage } from "../screens/DailyJournalPage.jsx";
import { ExpensesTab } from "../screens/ExpensesTab.jsx";
import { FinancialStatementsPage } from "../screens/FinancialStatementsPage.jsx";
import { computeGoldPosition } from "../domain/computeGoldPosition.js";
import { IntegrationPage } from "../screens/IntegrationPage.jsx";
import { InventorySummaryTab } from "../screens/InventorySummaryTab.jsx";
import { IssueOutPage } from "../screens/IssueOutPage.jsx";
import { ItemEditPage } from "../screens/ItemEditPage.jsx";
import { NavCustomizePage } from "../screens/NavCustomizePage.jsx";
import { OpeningBalancePage } from "../screens/OpeningBalancePage.jsx";
import { OpeningComparePage } from "../screens/OpeningComparePage.jsx";
import { PartnersPage } from "../screens/PartnersPage.jsx";
import { PriceTab } from "../screens/PriceTab.jsx";
import { PrinterSettingsPage } from "../screens/PrinterSettingsPage.jsx";
import { RfidReaderPage } from "../screens/RfidReaderPage.jsx";
import { FixedAssetsPage } from "../screens/FixedAssetsPage.jsx";
import { PayrollPage } from "../screens/PayrollPage.jsx";
import { AttendanceHrPage } from "../screens/AttendanceHrPage.jsx";
import { HqReportPage } from "../screens/HqReportPage.jsx";
import { FullStatementsPage } from "../screens/FullStatementsPage.jsx";
import { AnyStatementPage } from "../screens/AnyStatementPage.jsx";
import { GeneralLedgerPage } from "../screens/GeneralLedgerPage.jsx";
import { MasterReportPage } from "../screens/MasterReportPage.jsx";
import { CustomerReportPage } from "../screens/CustomerReportPage.jsx";
import { DocCyclePage } from "../screens/DocCyclePage.jsx";
import { ExchangePage } from "../screens/ExchangePage.jsx";
import { PriceFixPage } from "../screens/PriceFixPage.jsx";
import { RfidSettingsCard } from "../ui/RfidSettingsCard.jsx";
import { PrintingPage } from "../screens/PrintingPage.jsx";
import { PurchasesPage } from "../screens/PurchasesPage.jsx";
import { RepairsPage } from "../screens/RepairsPage.jsx";
import { ReportsTab } from "../screens/ReportsTab.jsx";
import { ReservationsPage } from "../screens/ReservationsPage.jsx";
import { SafeAuditPage } from "../screens/SafeAuditPage.jsx";
import { SalesHistoryPage } from "../screens/SalesHistoryPage.jsx";
import { SalesReturnPage } from "../screens/SalesReturnPage.jsx";
import { ScrapCustodyPage } from "../screens/ScrapCustodyPage.jsx";
import { ScrapIntakePage } from "../screens/ScrapIntakePage.jsx";
import { ScrapSubPage } from "../screens/ScrapSubPage.jsx";
import { SellPage } from "../screens/SellPage.jsx";
import { SellerReportsPage } from "../screens/SellerReportsPage.jsx";
import { StocktakeSubPage } from "../screens/StocktakeSubPage.jsx";
import { StoreLinkPage } from "../screens/StoreLinkPage.jsx";
import { SupplierLedgerPage } from "../screens/SupplierLedgerPage.jsx";
import { SuppliersSubPage } from "../screens/SuppliersSubPage.jsx";
import { TaskirOfficesPage } from "../screens/TaskirOfficesPage.jsx";
import { TaskiratPage } from "../screens/TaskiratPage.jsx";
import { TaxReportPage } from "../screens/TaxReportPage.jsx";
import { TrialBalancePage } from "../screens/TrialBalancePage.jsx";
import { TrustAccountsPage } from "../screens/TrustAccountsPage.jsx";
import { UniversalSearchPage } from "../screens/UniversalSearchPage.jsx";
import { WorkDayPage } from "../screens/WorkDayPage.jsx";
import { AiChatPanel } from "../ui/AiChatPanel.jsx";
import { AiLogoBadge } from "../ui/AiLogoBadge.jsx";
import { Card } from "../ui/Card.jsx";
import { DayControl } from "../ui/DayControl.jsx";
import { FloatingDock } from "../ui/FloatingDock.jsx";
import { GoldTicker } from "../ui/GoldTicker.jsx";
import { MoreMenu } from "../ui/MoreMenu.jsx";
import { NavBtn } from "../ui/NavBtn.js";
import { PriceLoginScreen } from "../ui/PriceLoginScreen.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";
import { Toast } from "../ui/Toast.jsx";

export default function GoldInventoryApp() {
  // ⚠ شاشة الهبوط بحسب الدور.
  //
  // «المبيعات» للجميع تعني أن مشتري الكسر يفتح شاشةً لا صلاحية له
  // فيها، فيرى فراغًا ويظنّ التطبيق معطّلًا.
  const [tab, setTab] = useState("sales");
  const [morePage, setMorePage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  // ⚠ true حتى ينتهي التحقق من توكن محفوظ عند الإقلاع (راجع الأثر بعد
  // handleLogout) — يمنع "وميض" شاشة الدخول قبل أن نعرف إن كانت هناك
  // جلسة صالحة أصلًا.
  const [sessionChecking, setSessionChecking] = useState(true);
  // ⚠ من له صفحةٌ واحدة يُفتح عليها مباشرة — لا شريط ولا اختيار.
  const landingFor = (r) => {
    const def = ROLES[r] || {};
    if ((def.allowedTabs || []).length) return { tab: def.allowedTabs[0], more: null };
    const first = (def.allowedMore || [])[0];
    return first ? { tab: null, more: first } : { tab: "sales", more: null };
  }; // null = show combined price+login screen
  const [users, setUsers] = useState(DEFAULT_USERS);
  const role = currentUser?.role || null;

  const [items, setItems] = useState([]);
  const [priceData, setPriceData] = useState({ current: 0, currency: "ر.س", history: [] });
  const [sales, setSales] = useState([]);
  const [cashTx, setCashTx] = useState([]);
  const [scrapEntries, setScrapEntries] = useState([]);
  const [scrapCustodyTx, setScrapCustodyTx] = useState([]);
  const [safeTx, setSafeTx] = useState([]);
  const [taskirEntries, setTaskirEntries] = useState([]);
  const [taskirOffices, setTaskirOffices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [partners, setPartners] = useState([]);
  const [partnerTx, setPartnerTx] = useState([]);
  const [taskirOfficeTx, setTaskirOfficeTx] = useState([]);
  const [safeGoldTx, setSafeGoldTx] = useState([]);
  const [appSettings, setAppSettings] = useState(DEFAULT_SETTINGS);
  const [repairs, setRepairs] = useState([]);
  const [scrapSurplusLog, setScrapSurplusLog] = useState([]);
  const [commissions, setCommissions] = useState({}); // { [sellerId]: rule }
  const [dailyCustody, setDailyCustody] = useState([]); // drawer sessions, newest first
  const [entrySessions, setEntrySessions] = useState([]); // سجل جلسات التكويد
  const [weightAdjustments, setWeightAdjustments] = useState([]); // هالك وفائض الوزن
  const [expenseNames, setExpenseNames] = useState([]); // مسميات المصروفات الثابتة
  const [customers, setCustomers] = useState([]);
  const [trustGold, setTrustGold] = useState([]); // ذهب أمانة للعملاء
  const [returns, setReturns] = useState([]);
  const [receipts, setReceipts] = useState([]); // دفعات العملاء على الآجل
  const [safeAudits, setSafeAudits] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [businessDays, setBusinessDays] = useState([]);
  const [stocktakeLock, setStocktakeLock] = useState(null);
  const [printerCfg, setPrinterCfg] = useState(DEFAULT_PRINTER);
  const [rfidCfg, setRfidCfg] = useState(RFID_DEFAULTS);
  const [menuOrder, setMenuOrder] = useState(null);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [scrapRequests, setScrapRequests] = useState([]);
  const [goldLedger, setGoldLedger] = useState([]);
  const [shortcuts, setShortcuts] = useState([]);
  const [bankTx, setBankTx] = useState([]);
  const [journal, setJournal] = useState([]);
  const [roleTamper, setRoleTamper] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [fixedAssets, setFixedAssets] = useState([]);
  const [depreciations, setDepreciations] = useState([]);
  // ⚠ migration 017: هل فرع هذا المستخدم مُعلَّم HQ؟ يُقرأ من bootstrap
  // (n.isHq) — لا واجهة تُغيّره من هنا، عملية تشغيلية على القاعدة فقط.
  const [isHq, setIsHq] = useState(false);
  const [costCenters, setCostCenters] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [periodCloses, setPeriodCloses] = useState([]);
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [customGroups, setCustomGroups] = useState([]);
  const [row2Open, setRow2Open] = useState(0);
  const [integration, setIntegration] = useState(DEFAULT_INTEGRATION);
  const [storeLink, setStoreLink] = useState(DEFAULT_STORE);
  const [storeOrders, setStoreOrders] = useState([]);
  const [extInvoices, setExtInvoices] = useState([]);
  const [navLayout, setNavLayout] = useState(DEFAULT_NAV_LAYOUT);
  const [openingBalance, setOpeningBalance] = useState(DEFAULT_OPENING_BALANCE);
  const [fiscalClosures, setFiscalClosures] = useState([]);
  const [audits, setAudits] = useState([]);
  // Stocktake-in-progress lives at the App level (not inside the tab component) so
  // switching tabs or going back to the More menu never loses counted progress.
  const [stocktake, setStocktake] = useState({
    scope: null, // null | 'general' | 'sectional'
    activeCategory: null, // which category is currently being counted (sectional mode)
    sectionalStatus: {}, // { [categoryId]: 'ok' | 'missing' }
    sectionalEntries: {}, // { [categoryId]: [...entries] }
    generalEntries: null,
  });
  const [suppliers, setSuppliers] = useState([]);
  const [lots, setLots] = useState([]);

  const [toast, setToast] = useState("");
  const [showPrice, setShowPrice] = useState(false);
  const [showNewSale, setShowNewSale] = useState(false);
  const [quickSaleItemId, setQuickSaleItemId] = useState(null);
  const [viewingSale, setViewingSale] = useState(null);
  const [cashModalType, setCashModalType] = useState(null);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showPartialSale, setShowPartialSale] = useState(false);
  const [openBundle, setOpenBundle] = useState(null);
  const [showAiSheet, setShowAiSheet] = useState(false);
  // ⚠ يُستهلك فورًا في AiChatTab عبر onVoiceConsumed كي لا يُعاد الترحيب
  // الصوتي مع كل فتحٍ لاحق لشاشة المساعد من غير الضغطة المطوّلة.
  const [aiVoiceFirst, setAiVoiceFirst] = useState(false);
  /// الرصيف يبدأ مطويًّا.
  ///
  /// ⚠ أربعة أزرار عائمة تفتح مع كل تشغيل تحجب المحتوى وتُشتّت.
  /// والمستخدم يفتح التطبيق ليرى مخزونه لا ليرى اختصاراتٍ لم يطلبها.
  ///
  /// فيُطوى إلى شعارٍ واحد، ويُفتح بضغطة حين يُراد.
  const [dockClosed, setDockClosed] = useState(true);
  const [showVoice, setShowVoice] = useState(false);
  const [aiSeed, setAiSeed] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [validationError, setValidationError] = useState(null);
  const [storageFull, setStorageFull] = useState(false);
  // ⚠ عَلمٌ يقول إن المخازن حُمّلت — قبله لا يُكتب شيء
  const [trustAccounts, setTrustAccounts] = useState([]);
  const [trustLedger, setTrustLedger] = useState([]);
  const [storesLoaded, setStoresLoaded] = useState(false);
  const vp = useViewport();
  // ⚠ كيانٌ واحد مفتوح في وقتٍ واحد: فتح ورقةٍ فوق ورقة يفقد المستخدم
  // أيّهما يُغلق، ويجعل «رجوع» غامضة.
  const [sheetEntity, setSheetEntity] = useState(null);   // { kind, record }
  // ⚠ «بيع هذه القطعة» يفتح شاشة البيع.
  //
  // ولا يُمرّر القطعة: `SellPage` لا تستقبل اختيارًا مسبقًا، وتمريرُ
  // ما لا يُقرأ يوهم بعملٍ لا يحدث. تمريرها عملُ خطوةٍ تالية.
  const [sellPreselect, setSellPreselect] = useState(null);

  // ── ترقية الأرقام السرية ──
  //
  // ⚠ كانت الترقية داخل `handleLogin` وحده: من لم يدخل بعد يبقى
  // رقمه نصًّا في التخزين، ومن يفتح وحدة التحكم يقرأ أرقام كل من لم
  // يدخل — وهم الأغلب في أول تشغيل.
  //
  // ووضعُها في نداء الدخول يجعلها تعتمد على حدثٍ قد لا يقع.
  // الأثر يضمن أنها تجري مرة واحدة بعد التحميل مهما حدث.
  useEffect(() => {
    if (!storesLoaded || !users.length) return;
    const plain = users.filter((u) => /^\d{4,8}$/.test(String(u.pin || "")));
    if (!plain.length) return;
    persist(
      USERS_KEY,
      users.map((u) =>
        /^\d{4,8}$/.test(String(u.pin || ""))
          ? { ...u, pin: hashPin(String(u.pin), u.id) }
          : u
      ),
      setUsers
    );
    audit("settings", {
      entity: "users",
      note: `تجزئة ${plain.length} رقمًا سريًا كان نصًّا`,
    });
  }, [storesLoaded, users.length]);

  // ── ترحيل ذهب الأمانة إلى الحسابات الجارية ──
  //
  // ⚠ لا نحذف بياناتٍ صامتين.
  //
  // «ذهب الأمانة» و«الحساب الجاري» شيء واحد كما قال صاحب المحل، فيُدمجان.
  // لكن حذف الشاشة وحدها يترك سجلاتٍ لا يراها أحد — وهي ذهبُ ناسٍ
  // بأعينهم يطالبون به.
  //
  // فيُرحَّل: كل قطعة محفوظة تصير صاحبَ حسابٍ وإيداعَ ذهب. ويجري مرة
  // واحدة، وعلامته في الإعدادات فلا يتكرّر مع كل فتح.
  useEffect(() => {
    if (!storesLoaded) return;
    if (appSettings?.trustMerged) return;
    // ⚠ الحارس بالمصدر لا بعَلَمٍ في الإعدادات.
    //
    // العَلم يُكتب بعد الترحيل، وحفظ الإعدادات قد يتأخّر أو يُرفض —
    // فيُعاد الترحيل ويتضاعف الرصيد. والعميل يرى ضعف ما أودع.
    //
    // و`migratedFrom` في السطر نفسه لا يكذب: إن وُجد فقد رُحّل.
    const alreadyMigrated = new Set(
      (trustLedger || []).map((r) => r.migratedFrom).filter(Boolean)
    );
    const held = (trustGold || []).filter(
      (t) => t.status !== "returned" && !alreadyMigrated.has(t.id)
    );
    // ⚠ لا نَسِم شيئًا حين لا شيء.
    //
    // وسمُ تثبيتٍ فارغ يُغلق الباب: من يستعيد نسخةً قديمة فيها أماناتٌ
    // لا يُرحَّل له شيء — العلامة كُتبت يوم كان المخزن خاليًا.
    //
    // والخروج بلا وسمٍ رخيص: شرطٌ واحد يُفحص عند كل تحميل.
    if (!held.length) return;
    const nowIso = new Date().toISOString();
    const holders = [...trustAccounts];
    const rows = [];
    held.forEach((t, i) => {
      const nm = String(t.customerName || t.holderName || "").trim();
      if (!nm) return;
      let h = holders.find((x) => normalizeName(x.name) === normalizeName(nm));
      if (!h) {
        h = {
          id: `${Date.now()}mg${i}`,
          ref: nextRef("trustHolder", holders),
          name: nm, phone: t.phone || "", note: "رُحّل من ذهب الأمانة",
          openedAt: t.date || nowIso, openedBy: "ترحيل",
        };
        holders.push(h);
      }
      rows.push({
        id: `${Date.now()}mr${i}`,
        ref: nextRef("trustMove", [...trustLedger, ...rows]),
        date: t.date || nowIso,
        holderId: h.id, holderName: h.name,
        move: "deposit_gold", moveLabel: "إيداع ذهب", dir: "in", unit: "gram",
        amount: 0, weight: Number(t.weight) || 0, karat: Number(t.karat) || 21,
        goldDir: "in", price24: 0,
        note: `رُحّل من ${t.ref || "ذهب الأمانة"}${t.note ? " — " + t.note : ""}`,
        createdBy: "ترحيل", migratedFrom: t.id,
      });
    });
    if (holders.length > trustAccounts.length) persistTrustAccounts(holders);
    if (rows.length) persistTrustLedger([...rows, ...trustLedger]);
    persistSettings({ ...appSettings, trustMerged: true });
    audit("update", { entity: "trustLedger",
      after: { holders: holders.length - trustAccounts.length, rows: rows.length },
      note: "ترحيل ذهب الأمانة إلى الحسابات الجارية" });
    if (rows.length) {
      flashToast(`رُحّلت ${rows.length} أمانة إلى الحسابات الجارية`);
    }
    // ⚠ `trustGold` في الاعتماديات لا خارجها.
    //
    // بدونه يُلتقط الأثر أول قيمة — وهي المصفوفة الفارغة قبل التحميل —
    // فيرى صفرًا ويَسِم نفسه منتهيًا. والبيانات تبقى ولا يُرحَّل شيء،
    // ولا يعود يُحاول لأن العلامة كُتبت.
  }, [storesLoaded, appSettings?.trustMerged, trustGold.length]);

  // ── كشف العبث بالأدوار ──
  //
  // ⚠ لا يمكن **منعه** في تطبيق يعمل كله على الجهاز: التوقيع ومفتاحه
  // كلاهما في المتصفح، ومن يقرأ الأول يقرأ الثاني.
  //
  // فما يمكن هو **كشفه وتسجيله**: نحفظ بصمة الأدوار، ونقارنها في كل
  // إقلاع. من رفع نفسه مديرًا يُسجَّل اسمه ووقته، ويرى المدير تنبيهًا.
  //
  // هذا حدُّ ما يقدّمه العمل المحلي بصدق. الحماية الكاملة تحتاج خادمًا
  // يحرس الأدوار خارج متناول المستخدم.
  useEffect(() => {
    if (!users.length) return;
    // ⚠ لا نكتب قبل أن تُحمَّل الإعدادات.
    //
    // هذا الأثر يعمل عند أول رسم، و`appSettings` حينها ما زالت
    // الافتراضيات لا المحفوظات. فيكتب `{...الافتراضيات, بصمة}` فوق
    // ما حفظه المستخدم — ويضيع كل إعداد غيّره: الوضع والسمة والهوامش.
    //
    // والعطل صامت: الشاشة تعمل، والإعداد يعود لأصله بعد كل فتح، ولا
    // يفهم المستخدم لماذا لا يثبت اختياره.
    if (!storesLoaded) return;
    const fingerprint = users
      .map((u) => `${u.id}:${u.role}`)
      .sort()
      .join("|");
    const hash = auditHash(fingerprint);
    const stored = appSettings?.roleFingerprint;
    if (!stored) {
      persistSettings({ ...appSettings, roleFingerprint: hash });
      return;
    }
    if (stored !== hash) {
      // ⚠ التغيير المشروع يمرّ عبر شاشة الصلاحيات وتُحدَّث البصمة معه.
      // وصولنا هنا يعني تغييرًا من خارج التطبيق.
      setRoleTamper({ at: new Date().toISOString(), users: users.length });
      audit("permission", {
        entity: "users",
        note: "⚠ بصمة الأدوار تغيّرت خارج التطبيق",
        before: { fingerprint: stored },
        after: { fingerprint: hash },
      });
      persistSettings({ ...appSettings, roleFingerprint: hash });
    }
  }, [users]);

  // ⚠ الحارس يُركَّب قبل أي قراءة أو كتابة.
  //
  // تركيبه في `useEffect` عادي يعني نافذةً بين أول رسم وتركيبه تمرّ
  // فيها الكتابة بلا فحص — قصيرةٌ لكنها كافية لسكربت مُعدّ.
  const guardReady = useRef(false);
  const failedTries = useRef(0);
  const lockUntil = useRef(0);
  // ⚠ عدّاد "جيل الجلسة": كل عملية دخول/خروج/استعادة جلسة تزيد هذا
  // الرقم قبل أن تبدأ عملها غير المتزامن (fetch). أي كود غير متزامن يتأخر
  // (bootstrap بطيء، شبكة ضعيفة) يقارن الرقم الذي بدأ به بالرقم الحالي
  // قبل تطبيق نتيجته على الحالة — فإن تغيّر (بمعنى: حصل logout أو دخول
  // جديد في الأثناء) يتجاهل نتيجته بدل أن يكتب فوق الحالة الحالية بردٍّ
  // متأخر من عملية سابقة انتهت فعليًا.
  const sessionEpoch = useRef(0);
  if (!guardReady.current && typeof window !== "undefined") {
    guardReady.current = installStorageGuard();
  }

  // ⚠ السمة تُطبَّق قبل أول رسم وعند كل تغيير.
  //
  // تطبيقها بعد الرسم يُظهر وميض السمة الافتراضية لحظةً — يراه
  // المستخدم كخلل في كل فتح.
  useEffect(() => {
    applyTheme(appSettings?.theme || DEFAULT_THEME);
  }, [appSettings?.theme]);
  // ⚠ نافذة أخرى تكتب على المخزن نفسه — التبويبان يتنازعان
  const [otherTab, setOtherTab] = useState(false);
  // { branchId, branchRef, branchName } بعد الحل الناجح، null أثناء
  // المحاولة أو عند غياب أي رابط/تخزين سابق (راجع effect الحل أدناه).
  const [branchLink, setBranchLink] = useState(null);
  const [branchLinkStatus, setBranchLinkStatus] = useState("pending"); // pending | ok | missing | error
  const [branchIdentity, setBranchIdentity] = useState({ code: "", name: "" });
  const [hqPermissions, setHqPermissions] = useState(null); // null = HQ hasn't overridden anything
  const [aiButtonPos, setAiButtonPos] = useState(null); // {x,y} top-left, null = default corner
  const [showAddScrap, setShowAddScrap] = useState(false);
  const [showAddPurchase, setShowAddPurchase] = useState(false);

  const [autoUpdating, setAutoUpdating] = useState(false);
  const [autoError, setAutoError] = useState("");
  const [lastAutoFetch, setLastAutoFetch] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // يسبق أي قراءة: ينقل بيانات الاسم القديم إن وُجدت.
        await migrateLegacyKeys([
          ITEMS_KEY, PRICE_KEY, SALES_KEY, CASH_KEY, SCRAP_KEY, AUDIT_KEY,
          SUPPLIERS_KEY, LOTS_KEY, SCRAP_CUSTODY_KEY, SAFE_KEY, TASKIR_KEY,
          TASKIR_OFFICES_KEY, EXPENSES_KEY, PARTNERS_KEY, PARTNER_TX_KEY,
          USERS_KEY, TASKIR_OFFICE_TX_KEY, SAFE_GOLD_KEY, SETTINGS_KEY,
          REPAIRS_KEY, SCRAP_SURPLUS_KEY, COMMISSIONS_KEY, DAILY_CUSTODY_KEY,
          WEIGHT_ADJ_KEY, EXPENSE_NAMES_KEY, CUSTOMERS_KEY, TRUST_GOLD_KEY, RETURNS_KEY, RECEIPTS_KEY, SAFE_AUDITS_KEY, RESERVATIONS_KEY, BUSINESS_DAYS_KEY, STOCKTAKE_LOCK_KEY, PRINTER_KEY, MENU_ORDER_KEY, CATEGORIES_KEY, SCRAP_REQUESTS_KEY, GOLD_LEDGER_KEY, SHORTCUTS_KEY, BANK_TX_KEY, CUSTOM_GROUPS_KEY, INTEGRATION_KEY, EXT_INVOICES_KEY, STORE_KEY, STORE_ORDERS_KEY, NAV_LAYOUT_KEY, OPENING_BALANCE_KEY, FISCAL_CLOSURES_KEY,
          BRANCH_IDENTITY_KEY,
        ]);
        // ── التحميل من السجل ──
        //
        // كانت هنا 49 قراءة تُفكَّك بالترتيب الموضعي إلى 49 متغيّرًا.
        // إضافة مفتاح وإغفال متغيّره تُزيح كل ما بعده فتُقرأ المبيعات
        // في مكان المصروفات — عطل لا يظهر إلا بعد الاستخدام.
        //
        // الآن: المطابقة بالاسم من STORE_REGISTRY، والإزاحة مستحيلة.
        const { data, failed } = await loadAllStores();
        if (failed.length) {
          console.warn("[أونصة] مخازن تالفة:", failed);
        }

        // الرابط بين اسم المخزن ودالة تحديثه — سطر واحد لكل مخزن
        const setters = {
          trustAccounts: setTrustAccounts, trustLedger: setTrustLedger,
          items: setItems, sales: setSales, lots: setLots, suppliers: setSuppliers,
          customers: setCustomers, users: setUsers, cashTx: setCashTx, safeTx: setSafeTx,
          scrapCustodyTx: setScrapCustodyTx, scrapEntries: setScrapEntries,
          scrapRequests: setScrapRequests, goldLedger: setGoldLedger,
          safeGoldTx: setSafeGoldTx, weightAdjustments: setWeightAdjustments,
          entrySessions: setEntrySessions, expenses: setExpenses,
          expenseNames: setExpenseNames, taskirEntries: setTaskirEntries,
          taskirOffices: setTaskirOffices, taskirOfficeTx: setTaskirOfficeTx,
          partners: setPartners, partnerTx: setPartnerTx, commissions: setCommissions,
          repairs: setRepairs, trustGold: setTrustGold, returns: setReturns,
          receipts: setReceipts, reservations: setReservations, audits: setAudits,
          safeAudits: setSafeAudits, dailyCustody: setDailyCustody,
          businessDays: setBusinessDays, fiscalClosures: setFiscalClosures,
          scrapSurplus: setScrapSurplusLog, bankTx: setBankTx, journal: setJournal, auditLog: setAuditLog, fixedAssets: setFixedAssets,
          depreciations: setDepreciations, costCenters: setCostCenters,
          budgets: setBudgets, periodCloses: setPeriodCloses,
          payrollRuns: setPayrollRuns, attendance: setAttendance, leaves: setLeaves,
          approvals: setApprovals, webhooks: setWebhooks, extInvoices: setExtInvoices,
          storeOrders: setStoreOrders, shortcuts: setShortcuts,
          customGroups: setCustomGroups, stocktakeLock: setStocktakeLock,
          branchIdentity: setBranchIdentity, hqPermissions: setHqPermissions,
          appSettings: setAppSettings, printerCfg: setPrinterCfg, rfidCfg: setRfidCfg,
          integration: setIntegration, storeLink: setStoreLink,
          categories: setCategories, menuOrder: setMenuOrder, navLayout: setNavLayout,
          openingBalance: setOpeningBalance,
        };
        // ⚠ إصلاح محلي: أصناف قديمة قد تحمل `category` بلا `categoryId`
        // (خطأ تسمية سابق في handleAddItems). نرحّلها هنا مرة واحدة عند
        // التحميل فلا تختفي من شاشات البيع بالوزن والتصنيفات والجرد، ونكتب
        // النتيجة للتخزين فلا يتكرر الترحيل ولا تراها قراءة مباشرة قديمة.
        if (Array.isArray(data.items)) {
          let itemsMigrated = false;
          data.items = data.items.map((it) => {
            if (it && it.categoryId == null && it.category != null) {
              itemsMigrated = true;
              return { ...it, categoryId: it.category };
            }
            return it;
          });
          if (itemsMigrated) {
            window.storage.set(ITEMS_KEY, JSON.stringify(data.items), false).catch(() => {});
          }
        }

        // ⚠ إصلاح جذري: هذه الأسماء مصدرها الآن الباك إند بالكامل (راجع
        // applyBootstrap أعلاه) لا window.storage المحلي القديم. هذا الأثر كان
        // يكتبها من localStorage فارغًا (لا بيانات محفوظة هناك منذ
        // الانتقال للباك إند) فوق بيانات الباك إند الصحيحة بعد ثانيتين
        // من فتح التطبيق — المخزون المحلي لم يعد يُستخدم لهذه البيانات إطلاقًا،
        // فقراءته الفارغة كانت تمسح بيانات الباك إند بصمت في كل فتح.
        const BACKEND_OWNED_FIELDS = new Set([
          "items", "sales", "lots", "suppliers", "customers", "users",
          "cashTx", "safeTx", "scrapCustodyTx", "scrapEntries", "scrapRequests",
          "safeGoldTx", "expenses", "expenseNames", "taskirEntries",
          "taskirOffices", "taskirOfficeTx", "repairs", "returns", "receipts",
          "reservations", "safeAudits", "dailyCustody", "businessDays",
          "fixedAssets", "depreciations", "categories", "stocktakeLock",
        ]);
        Object.entries(data).forEach(([name, value]) => {
          if (BACKEND_OWNED_FIELDS.has(name)) return;
          const fn = setters[name];
          if (fn) fn(value);
        });

        // معالجات خاصة لا تُؤتمت
        //
        // ⚠ categories من الباك إند الآن (راجع BACKEND_OWNED_FIELDS أعلاه) —
        // استدعاؤها هنا من data.categories (المخزون المحلي) كان يكتب DEFAULT_CATEGORIES
        // فوق الفئات الحقيقية القادمة من applyBootstrap بعد ثوانٍ من فتح التطبيق.
        // الترتيب: نحفظ الترحيل مرة واحدة إن جرى
        if (data.navLayout && data.navLayout._navVersion === 2) {
          window.storage.set(NAV_LAYOUT_KEY, JSON.stringify(data.navLayout), false).catch(() => {});
        }
        // السعر مخزن خاص: لا يُدرج في الأوتوماتيك
        try {
          const pr = await window.storage.get(PRICE_KEY, false);
          if (pr) setPriceData(JSON.parse(pr.value));
        } catch (e) {
          /* أول تشغيل بلا سعر محفوظ */
        }
      } catch (e) {
        console.error("Load error", e);
      } finally {
        setLoading(false);
        // ⚠ العَلم بعد التحميل لا قبله: الآثار التي تكتب إعدادات
        // تنتظره، وإلا كتبت الافتراضيات فوق ما حفظه المستخدم.
        setStoresLoaded(true);
      }
    })();
  }, []);

  // ── حل هوية الفرع: من رابط الدخول (/b/<ref>) أو من التخزين المحلي ──
  //
  // ⚠ يجب أن يسبق effect قائمة الأسماء أدناه فعليًّا (يعتمد على
  // branchLink.branchId) — لذا لا اعتماد بينهما في كود الـeffects نفسه
  // (React لا يضمن ترتيب تنفيذ effects منفصلة بالاعتماد على الترتيب في
  // الملف وحده بأمان كافٍ)، بل branchLinkStatus صريحة يعتمد عليها الثاني.
  useEffect(() => {
    (async () => {
      const refInUrl = branchRefFromUrl();
      if (refInUrl) {
        try {
          const resolved = await api.resolveBranchByRef(refInUrl);
          await window.storage.set(BRANCH_LINK_KEY, JSON.stringify(resolved), false);
          setBranchLink(resolved);
          setBranchLinkStatus("ok");
          // ⚠ تنظيف الرابط من شريط العنوان بعد الحفظ — لا حاجة لإبقاء
          // رمز الفرع ظاهرًا في كل مرة، والتخزين المحلي كافٍ من الآن.
          window.history.replaceState(null, "", "/");
          return;
        } catch (e) {
          console.error("[أونصة] تعذّر التحقق من رابط الفرع", e);
          setBranchLinkStatus("error");
          return;
        }
      }
      try {
        const stored = await window.storage.get(BRANCH_LINK_KEY, false);
        setBranchLink(JSON.parse(stored.value));
        setBranchLinkStatus("ok");
      } catch (e) {
        // لا رابط في العنوان ولا تخزين سابق — جهازٌ لم يُفتح عليه رابط
        // فرعٍ بعد (راجع BranchLinkCard.jsx في ounce-central).
        setBranchLinkStatus("missing");
      }
    })();
  }, []);

  // ── قائمة أسماء شاشة الدخول من الباك إند الحقيقي ──
  //
  // ⚠ لا علاقة لها بـloadAllStores أعلاه (تلك محلية بالكامل، تبقى تعمل
  // لكل ما لم يُحوَّل للباك إند بعد). هذا الاستدعاء علني بلا حاجة توكن
  // (GET /branches/:id/users) — الهدف الوحيد: عرض أسماء حقيقية للنقر
  // عليها قبل تسجيل الدخول، بدل DEFAULT_USERS/التخزين المحلي القديم.
  // فشل هذا الاستدعاء (خادم غير متاح) لا يمنع بقية التطبيق من العمل —
  // فقط شاشة الدخول تعرض رسالة تعذّر الاتصال (راجع PriceLoginScreen).
  useEffect(() => {
    if (!branchLink?.branchId) return;
    api.fetchBranchUsers(branchLink.branchId)
      .then((rows) => {
        setUsers(rows.map((u) => ({ id: u.id, name: u.name, ref: u.ref, role: u.role })));
      })
      .catch((e) => {
        console.error("[أونصة] تعذّر تحميل قائمة المستخدمين", e);
      });
  }, [branchLink?.branchId]);

  // Load this branch's identity (private) and any permission overrides HQ has
  // pushed (shared). Kept separate from the main load so a missing/unreachable
  // HQ config can never block the branch app from starting.
  useEffect(() => {
    (async () => {
      try {
        const idRes = await window.storage.get(BRANCH_IDENTITY_KEY, false);
        if (idRes) setBranchIdentity(JSON.parse(idRes.value));
      } catch (e) {
        /* branch not registered yet — runs standalone */
      }
      try {
        const permRes = await window.storage.get(HQ_PERMISSIONS_KEY, true);
        if (permRes) setHqPermissions(JSON.parse(permRes.value));
      } catch (e) {
        /* no HQ overrides */
      }
    })();
  }, []);

  const flashToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  };

  // ── نافذة أخرى مفتوحة ──
  //
  // ⚠ التخزين مشترك بين تبويبات المتصفح كلها. تبويبان مفتوحان يكتب
  // كلٌّ منهما من حالته في الذاكرة، فآخر من يكتب يمحو الآخر — وقد
  // تضيع فاتورة كاملة بلا أثر.
  //
  // نُنذر ولا نُغلق: قد يكون التبويب الثاني مفتوحًا للقراءة فقط.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e) => {
      if (!e.key || !String(e.key).includes("ounce_")) return;
      setOtherTab(true);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── طابور الكتابة لكل مخزن ──
  //
  // ⚠ كتابتان متزامنتان على المفتاح نفسه: الثانية تمحو الأولى.
  //
  // قِستها: كتابتان في نفس اللحظة تُنتجان سجلًا واحدًا لا اثنين. وفي
  // التطبيق يحدث حين يضغط البائع زرّين سريعًا، أو حين يكتب معالجٌ
  // واحد عدة مخازن ويتداخل مع آخر.
  //
  // الطابور يُسلسل الكتابات على كل مفتاح: الثانية تنتظر الأولى فلا
  // تُبنى على حالة قديمة. والمفاتيح المختلفة تتوازى — لا إبطاء بلا سبب.
  const writeQueue = useRef({});

  const enqueueWrite = (key, fn) => {
    const prev = writeQueue.current[key] || Promise.resolve();
    const next = prev.then(fn, fn);
    // ⚠ التنظيف يقارن بالسلسلة المخزَّنة لا بـ`next`.
    //
    // `next.finally(...)` وعدٌ **آخر**، فمقارنته بـ`next` تفشل دائمًا
    // ولا يُحذف شيء — والسلاسل تتراكم عبر جلسة طويلة حتى تُثقل الذاكرة.
    const chained = next.finally(() => {
      if (writeQueue.current[key] === chained) delete writeQueue.current[key];
    });
    writeQueue.current[key] = chained;
    return next;
  };

  const persist = async (key, value, setter) => {
    // ── التحقق قبل الحفظ ──
    //
    // ⚠ هنا لا في الواجهة: أدوات المطوّر ونسخة مستوردة والربط البرمجي
    // كلها تتجاوز الحقول والأزرار، ولا تتجاوز هذا.
    const check = validateStore(key, value);
    if (!check.ok) {
      const first = check.issues[0];
      console.error("[أونصة] رُفض حفظ", check.label, check.issues.slice(0, 5));
      setValidationError({
        store: check.label,
        count: check.issues.length,
        ref: first.ref,
        why: first.why[0],
      });
      // ⚠ لا يُحفظ ولا تُحدَّث الحالة: بيانات معطوبة في الشاشة أسوأ
      // من عملية فاشلة — المستخدم يظنها نجحت.
      return;
    }
    setValidationError(null);
    setter(value);
    try {
      if (!window.storage) throw new Error("storage unavailable");
      await enqueueWrite(key, () => window.storage.set(key, JSON.stringify(value), false));
      setStorageError("");
      return;
    } catch (firstError) {
      // محاولة ثانية بعد مهلة قصيرة: أغلب حالات الفشل هنا عابرة (حدّ طلبات
      // مؤقت)، والفشل النهائي وحده يستحق تحذيرًا للمستخدم.
      try {
        await new Promise((r) => setTimeout(r, 400));
        await window.storage.set(key, JSON.stringify(value), false);
        setStorageError("");
        return;
      } catch (e) {
        console.error("Save error", key, firstError, e);
        // ⚠ الامتلاء يستحق رسالةً أخرى: إعادة المحاولة لن تُجدي،
        // والمستخدم يحتاج أن يعرف أن الحلّ نسخةٌ احتياطية ثم تفريغ.
        // ⚠ طبقة التخزين تُغلّف الخطأ برسالة عربية وترمز له بـ`code`،
        // فالفحص على `name` وحده يفوته — وقد فاته فعلًا: امتلأت المساحة
        // ولم يُنبَّه المستخدم، فظنّ عمله محفوظًا.
        const isQuota = (x) =>
          !!x && (
            x.code === "QUOTA" ||
            x.code === 22 ||
            /Quota|quota|NS_ERROR_DOM_QUOTA|exceeded|امتلأت/i.test(
              String(x.name || "") + " " + String(x.message || "") + " " + String(x)
            )
          );
        const quota = isQuota(e) || isQuota(firstError);
        if (quota) {
          setStorageError(
            "امتلأت مساحة الجهاز — لم يُحفظ شيء. خذ نسخة احتياطية من " +
            "☰ ← النظام ← النسخ الاحتياطي، ثم أفرغ بيانات قديمة."
          );
          setStorageFull(true);
          return;
        }
      // A failed write means what's on screen is NOT saved — surface this as a
      // persistent banner rather than a toast that disappears, so the user
      // never assumes data is safe when it isn't.
        setStorageError(
          `تعذّر حفظ البيانات (${key}). ما تشوفه على الشاشة غير محفوظ — أعد المحاولة، وإن تكرر فقد تكون المساحة ممتلئة بمرفقات كبيرة.`
        );
      }
    }
  };
  const persistItems = (next) => persist(ITEMS_KEY, next, setItems);
  const persistPrice = (next) => persist(PRICE_KEY, next, setPriceData);
  const persistSales = (next) => persist(SALES_KEY, next, setSales);
  const persistCash = (next) => persist(CASH_KEY, next, setCashTx);
  const persistScrap = (next) => persist(SCRAP_KEY, next, setScrapEntries);

  // ⚠ ثلاث دوال حفظ كانت مستخدمة وغير معرّفة: العملاء وذهب الخزنة
  // والأمانات. الزر يعمل ثم يسقط التطبيق ولا يُحفظ شيء — والمستخدم
  // يظن أن الزر «متجمد».
  const persistCustomers = (v) => persist(CUSTOMERS_KEY, v, setCustomers);
  const persistSafeGold = (v) => persist(SAFE_GOLD_KEY, v, setSafeGoldTx);
  const persistTrustGold = (v) => persist(TRUST_GOLD_KEY, v, setTrustGold);
  const persistScrapCustody = (next) => persist(SCRAP_CUSTODY_KEY, next, setScrapCustodyTx);
  const persistSafe = (next) => persist(SAFE_KEY, next, setSafeTx);
  const persistTaskir = (next) => persist(TASKIR_KEY, next, setTaskirEntries);
  const persistTaskirOffices = (next) => persist(TASKIR_OFFICES_KEY, next, setTaskirOffices);
  const persistExpenses = (next) => persist(EXPENSES_KEY, next, setExpenses);
  const persistPartners = (next) => persist(PARTNERS_KEY, next, setPartners);
  const persistPartnerTx = (next) => persist(PARTNER_TX_KEY, next, setPartnerTx);
  const persistUsers = (next) => persist(USERS_KEY, next, setUsers);
  const persistTaskirOfficeTx = (next) => persist(TASKIR_OFFICE_TX_KEY, next, setTaskirOfficeTx);
  const persistSafeGoldTx = (next) => persist(SAFE_GOLD_KEY, next, setSafeGoldTx);
  const persistSettings = (next) => persist(SETTINGS_KEY, next, setAppSettings);
  const handleSaveBranchIdentity = (next) => {
    persist(BRANCH_IDENTITY_KEY, next, setBranchIdentity);
    flashToast("تم ربط الفرع بالبرنامج المركزي");
  };
  // ⚠ appSettings يحمل حقولًا محلية بحتة (الثيم، وضع التطبيق، هوامش
  // السعر، requirePin...) بجانب taxEnabled/taxRate/cardFees التي يفرضها
  // السيرفر فعليًا على كل عملية بيع. next دائمًا كائن appSettings الكامل
  // القادم من AppSettingsPage (بعض نداءاتها {...settings, x} وبعضها جزئي
  // كـ{taxEnabled, taxRate} من نموذج الضريبة تحديدًا) — لذلك ندمج مع
  // appSettings الحالي هنا قبل الحفظ المحلي، تمامًا كما كان يفعل persist
  // ضمنيًا. الحفظ المحلي فوري كسابقًا (لا ينتظر الشبكة)، والحقول
  // السيرفرية فقط تُرسَل للباك إند بالخلفية؛ فشل الشبكة لا يمنع الحفظ
  // المحلي — فقط يُنبّه ويترك القيمتين مختلفتين حتى نجاح لاحق.
  const handleUpdateSettings = async (next) => {
    const merged = { ...appSettings, ...next };
    audit("settings", { entity: "settings", before: appSettings, after: merged });
    persistSettings(merged);

    const taxOrFeesChanged =
      merged.taxEnabled !== appSettings.taxEnabled ||
      merged.taxRate !== appSettings.taxRate ||
      JSON.stringify(merged.cardFees) !== JSON.stringify(appSettings.cardFees);
    if (!taxOrFeesChanged) {
      flashToast("تم حفظ الإعدادات");
      return true;
    }

    try {
      const res = await api.settingsApi.updateBranch({
        taxEnabled: merged.taxEnabled,
        taxRate: merged.taxRate,
        cardFees: merged.cardFees,
      });
      persistSettings({
        ...merged,
        taxEnabled: !!res.settings.tax_enabled,
        taxRate: Number(res.settings.tax_rate) || 0,
        cardFees: res.settings.card_fees || {},
      });
      flashToast("تم حفظ الإعدادات");
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر حفظ الضريبة/الرسوم على السيرفر"));
      return null;
    }
  };
  const persistRepairs = (next) => persist(REPAIRS_KEY, next, setRepairs);
  const persistScrapSurplus = (next) => persist(SCRAP_SURPLUS_KEY, next, setScrapSurplusLog);
  // ⚠ persistCommissions (COMMISSIONS_KEY محليًا) أُزيلت: قاعدة عمولة
  // البائع صارت بيانًا مُرحَّلًا للخادم (migration 016) — راجع
  // handleSaveCommission الذي يكتب عبر api.payrollApi.saveCommission
  // ثم يحدّث نفس commissions المحلية من استجابة الخادم مباشرة.
  const persistDailyCustody = (next) => persist(DAILY_CUSTODY_KEY, next, setDailyCustody);
  const persistEntrySessions = (next) => persist(ENTRY_SESSIONS_KEY, next, setEntrySessions);
  const persistWeightAdjustments = (next) => persist(WEIGHT_ADJ_KEY, next, setWeightAdjustments);

  // ── تحصيل الآجل ──
  // البيع الآجل لا يُدخل نقدًا وقت البيع (وهذا صحيح)، لكن المستحق كان
  // يختفي بعدها: لا سجل لمن عليه ولا كم. التحصيل يقيّد الدخول النقدي
  // ويُنقص المديونية، فيبقى الطرفان مرئيين.
  // ── جرد الخزنة الفعلي ──
  // المخزون يُجرد والصندوق اليومي يُجرد، والخزنة لا. وهي أكبر مخزن قيمة في المحل.
  // الفرق يُسجَّل كقيد تسوية فيبقى الدفتر مطابقًا للواقع.
  // ⚠ إصلاح حقيقي مع الربط: كان الحساب واختيار حساب اليومية والقيد
  // المحاسبي يتمّان محليًا بالكامل، والباك إند الآن يحسب الفروق بنفسه من
  // أرصدة cash_tx/safe_gold_tx الفعلية على قاعدة البيانات (لا من الحالة
  // المحلية التي قد تكون قديمة) ويُرحّل قيد اليومية الصحيح. النتيجة هنا
  // تُستخدم فقط لعرض سجل الجرد وتحديث حركات الخزنة محليًا.
  const handleSafeAudit = async (countedCash, countedNetwork, countedGoldByKarat, note) => {
    const cc = Number(countedCash) || 0;
    const cn = Number(countedNetwork) || 0;
    const gold = Object.fromEntries(
      Object.entries(countedGoldByKarat || {}).map(([k, w]) => [k, Number(w) || 0])
    );
    try {
      const res = await api.safe.audit({ countedCash: cc, countedNetwork: cn, gold, note: note || null });
      const rec = {
        id: res.audit.id,
        ref: res.audit.ref,
        date: new Date().toISOString(),
        countedCash: cc,
        countedNetwork: cn,
        shownCash: cc - (res.audit.varianceCash || 0),
        shownNetwork: cn - (res.audit.varianceNetwork || 0),
        varianceCash: res.audit.varianceCash,
        varianceNetwork: res.audit.varianceNetwork,
        gold: res.audit.goldLines || [],
        note: note || "",
        createdBy: currentUser?.name || "",
      };
      setSafeAudits((prev) => [rec, ...prev]);
      // لا تُرجّع الاستجابة سطور cash_tx/safe_gold_tx المُنشأة لفروق الجرد
      // (استثناء عمدي — راجع bootstrap.routes.js) — أرصدة الخزنة تبقى
      // صحيحة رغم ذلك لأنها تُعاد قراءتها من الخادم عند الدخول التالي؛
      // العرض الفوري هنا يقتصر على سجل الجرد نفسه.
      const totalVar = (res.audit.varianceCash || 0) + (res.audit.varianceNetwork || 0);
      flashToast(
        Math.abs(totalVar) < 0.01 && (res.audit.goldLines || []).length === 0
          ? "جرد الخزنة — مطابقة تامة"
          : `سُجّل جرد الخزنة (${rec.ref})`
      );
      return rec;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تسجيل جرد الخزنة"));
      return null;
    }
  };

  // ── الحجز والعربون ──
  // العميل يدفع عربونًا ويستلم لاحقًا. تسجيله كبيع كامل خطأ: البضاعة ما
  // زالت عندك والمبلغ ليس إيرادًا بعد — هو التزام عليك حتى التسليم.
  //
  // ⚠ حُوِّلت للباك إند: POST /reservations يكتب فعليًا reservations +
  // cash_tx (إن وُجد عربون) + قيد يومية (2210 عربون عميل) على الخادم، ويمنع
  // فعليًا بيع القطعة المحجوزة (items.reserved_for — migration 013) — لا
  // تعليم محلي فقط كان يختفي بعد إعادة التحميل ولا يمنع شيئًا فعليًا.
  const handleAddReservation = async (entry) => {
    try {
      const res = await api.reservationsApi.add({
        customerId: entry.customerId,
        itemId: entry.itemId || null,
        description: entry.description || null,
        total: Number(entry.total) || 0,
        deposit: Number(entry.deposit) || 0,
        method: entry.method === "network" ? "network" : "cash",
      });
      const r = res.reservation;
      const rec = {
        id: r.id, ref: r.ref, customerId: r.customer_id, customerName: r.customerName || "",
        itemId: r.item_id, description: r.description || "", total: Number(r.total) || 0,
        deposit: Number(r.deposit) || 0, remaining: Number(r.remaining) || 0,
        status: r.status, method: r.method, date: r.created_at, createdBy: currentUser?.name || "",
      };
      setReservations((prev) => [rec, ...prev]);
      // عربون الحجز دائمًا من صندوق اليومي (daily_cash/daily_network) في
      // هذا المسار تحديدًا — لا يُطلب من الخزنة، فلا حاجة لفحص pool هنا.
      if (res.cashTx) setCashTx((prev) => [normalizeCashTxRow(res.cashTx), ...prev]);
      if (entry.itemId) {
        setItems((prev) => prev.map((it) => (it.id === entry.itemId ? { ...it, reservedFor: rec.id } : it)));
      }
      flashToast(`سُجّل الحجز ${rec.ref}`);
      return rec;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تسجيل الحجز"));
      return null;
    }
  };

  // ⚠ حُوِّلت للباك إند: POST /reservations/:id/cancel — نفس تحفّظ
  // handleAddReservation أعلاه (المبلغ المُرجَع يُحسب من الحجز نفسه على
  // الخادم، لا رقم مُرسَل من العميل).
  const handleCancelReservation = async (id, refund) => {
    const r = reservations.find((x) => x.id === id);
    if (!r) return null;
    try {
      const res = await api.reservationsApi.cancel(id, refund);
      setReservations((prev) => prev.map((x) => (x.id === id ? { ...x, status: "cancelled", cancelledAt: new Date().toISOString(), refunded: !!refund } : x)));
      if (res.cashTx) setCashTx((prev) => [normalizeCashTxRow(res.cashTx), ...prev]);
      if (r.itemId) setItems((prev) => prev.map((it) => (it.id === r.itemId ? { ...it, reservedFor: null } : it)));
      flashToast(refund ? "أُلغي الحجز وأُرجع العربون" : "أُلغي الحجز — العربون محتجز");
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر إلغاء الحجز"));
      return null;
    }
  };

  const handleCollectReceivable = (customerId, saleId, amount, method) => {
    const amt = Number(amount) || 0;
    if (!(amt > 0)) return;
    const cust = customers.find((c) => c.id === customerId);
    const rec = {
      id: Date.now().toString() + "rc",
      ref: nextRef("receipt", receipts),
      ...dayStamp(),
      date: new Date().toISOString(),
      customerId,
      customerName: cust?.name || "",
      saleId: saleId || null,
      amount: amt,
      method: method === "network" ? "network" : "cash",
      createdBy: currentUser?.name || "",
    };
    persist(RECEIPTS_KEY, [rec, ...receipts], setReceipts);
    persistCash([
      {
        id: Date.now().toString() + "rcx",
        date: rec.date,
        type: "in",
        method: rec.method,
        amount: amt,
        note: `تحصيل آجل — ${rec.customerName}`.trim(),
        source: "receipt",
        refId: rec.id,
        category: "sales_revenue",
        createdBy: currentUser?.name || "",
      },
      ...cashTx,
    ]);
    flashToast(`حُصّل ${fmt(amt, 0)} من ${rec.customerName}`);
  };

  // ── يوم العمل ──
  const openDay = useMemo(() => businessDays.find((d) => d.status === "open") || null, [businessDays]);
  /// معرّف اليوم المفتوح — يُختم على كل حركة تُسجَّل الآن.
  const currentDayId = openDay?.id || null;
  /// ختم موحّد يُدمج في كل سجل جديد. تمريره من مكان واحد يمنع نسيانه
  /// في عملية، وحركة بلا يوم لا تظهر في إقفال أي يوم.
  const dayStamp = () => ({ businessDayId: currentDayId, businessDayRef: openDay?.ref || null });

  // ⚠ حُوِّلت للباك إند: POST /day/open يفتح اليوم + عهدة الصندوق اليومي +
  // عهدة الكسر في معاملة واحدة (نفس فلسفة الجمع في المرجع)، ويتحقق فعليًا
  // من رصيد الخزنة النقدي حيًّا (409 insufficient_safe_cash) بدل الفحص
  // المحلي المتفائل هنا.
  const handleOpenBusinessDay = async (note, tillFloat, scrapFloat) => {
    if (!can("openDay") || !ROLES[role]?.canManageDay) {
      flashToast("فتح يوم العمل بيد المدير — راجعه");
      return null;
    }
    const till = Number(tillFloat) || 0;
    const scrapAmt = Number(scrapFloat) || 0;
    if (till < 0 || scrapAmt < 0) {
      flashToast("العهدة لا تكون بالسالب");
      return null;
    }
    try {
      const res = await api.day.open({ tillFloat: till, scrapFloat: scrapAmt, note: note || null });
      setBusinessDays((prev) => [normalizeBusinessDays([res.day])[0], ...prev]);
      if (res.custody) {
        setDailyCustody((prev) => [normalizeDailyCustody([res.custody])[0], ...prev]);
      }
      const parts = [];
      if (till > 0) parts.push(`درج ${fmt(till, 0)}`);
      if (scrapAmt > 0) parts.push(`كسر ${fmt(scrapAmt, 0)}`);
      flashToast(`فُتح يوم العمل ${res.day.ref}${parts.length ? " · " + parts.join(" · ") : ""}`);
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر فتح يوم العمل"));
      return null;
    }
  };

  // ⚠ حُوِّلت للباك إند: POST /day/close يبني لقطة الإقفال من دفاتر الحركة
  // مباشرة على الخادم (عدّ/مجموع المبيعات والمصاريف والمشتريات، رصيد
  // الصندوق/الخزنة/العهدة اللحظي، الكسر المعلَّق) بدل حسابها من الحالة
  // المحلية. "الربح" وحده يبقى محسوبًا محليًا (يحتاج تكلفة كل صنف —
  // بيانات bootstrap لا الخادم — راجع تعليق normalizeBusinessDays).
  const handleCloseBusinessDay = async (note) => {
    if (!openDay) {
      flashToast("لا يوجد يوم مفتوح");
      return null;
    }
    try {
      const res = await api.day.close({ note: note || null });
      const normalized = normalizeBusinessDays([res.day])[0];
      // الربح يُحسب محليًا من نفس بيانات bootstrap (sales+items) — لا
      // يأتي من الخادم (راجع تعليق normalizeBusinessDays).
      const mine = (arr) => arr.filter((x) => x.businessDayId === openDay.id);
      const profit = mine(sales).reduce((a, x) => a + saleProfitOf(x), 0);
      if (normalized.snapshot) normalized.snapshot.profit = profit;
      setBusinessDays((prev) => prev.map((d) => (d.id === openDay.id ? normalized : d)));
      const sus = normalized.snapshot?.suspendedScrap;
      flashToast(
        `أُقفل يوم العمل ${openDay.ref}` +
        (sus ? ` · ⚠ ${sus.count} قطعة كسر معلّقة (${fmtW(sus.weight)} جم)` : "")
      );
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر إقفال يوم العمل"));
      return null;
    }
  };

  const handleAddCustomer = (name, phone, note) => {
    if (nameExists(customers, name)) {
      flashToast("يوجد عميل بهذا الاسم");
      return null;
    }
    const c = {
      id: Date.now().toString() + "c",
      ref: nextRef("customer", customers),
      name: name.trim(),
      phone: (phone || "").trim(),
      note: (note || "").trim(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || "",
    };
    persistCustomers([c, ...customers]);
    flashToast(`تمت إضافة العميل ${c.ref}`);
    return c;
  };

  // ── الذهب الأمانة ──
  // ذهب العميل ليس ملكك: لا يدخل المخزون ولا يُقيَّم ضمن أصولك، لكن ضياعه
  // مسؤوليتك — فيُتتبَّع في سجل مستقل بحالة استلام/تسليم.
  const handleAddTrustGold = (entry) => {
    const rec = {
      id: Date.now().toString() + "tg",
      ref: nextRef("trust", trustGold),
      date: new Date().toISOString(),
      customerId: entry.customerId,
      customerName: customers.find((c) => c.id === entry.customerId)?.name || "",
      description: entry.description || "",
      karat: Number(entry.karat) || 21,
      weight: Number(entry.weight) || 0,
      pieces: Number(entry.pieces) || 1,
      purpose: entry.purpose || "repair", // repair | cleaning | safekeeping
      status: "held",
      note: entry.note || "",
      createdBy: currentUser?.name || "",
    };
    persistTrustGold([rec, ...trustGold]);
    flashToast("سُجّل ذهب الأمانة");
    return rec;
  };
  const handleReturnTrustGold = (id, note) => {
    persistTrustGold(
      trustGold.map((t) =>
        t.id === id
          ? { ...t, status: "returned", returnedAt: new Date().toISOString(), returnedBy: currentUser?.name || "", returnNote: note || "" }
          : t
      )
    );
    flashToast("سُلّم للعميل");
  };

  // ── المرتجعات ──
  // الإرجاع يعكس البيع بالكامل: القطعة تعود للمخزون بتكلفتها الأصلية،
  // والمبلغ يخرج من الصندوق. تسجيله كمصروف كان سيشوّه المبيعات والأرباح.
  // ── خدمة استرجاع المبيعات ──
  //
  // ⚠ العملية ذرّية: نحسب كل التغييرات أولًا، ونتحقق منها، ثم نكتب.
  //
  // الكتابة على مراحل مع تحقّق بينها تعني أن فشل المرحلة الثالثة يترك
  // الأولى والثانية مكتوبتين: قطعةٌ عادت للمخزون بلا قيد يُفسّرها، أو
  // نقدٌ خرج بلا مرتجع.
  //
  // وما دامت الكتابة محلية بلا معاملة قاعدة بيانات، نُحاكيها: نُجهّز
  // اللقطات كاملة، ونتراجع عمّا كُتب إن فشل ما بعده.
  // ⚠ حُوِّلت للباك إند بالكامل: POST /sales/:id/return-full يخدم شاشة
  // "استرجاع مبيعات" المخصَّصة تحديدًا (خلافًا لـhandleReturnSale الأبسط
  // أعلاه). يحسب معدّل ضريبة فعليًا من الفاتورة، يعكس تكلفة البضاعة
  // المباعة فعليًا (كانت دومًا صفرًا محليًا — l.unitCost/costSnapshot لم
  // يُكتبا في أي مكان بالكود، فثغرة صامتة قديمة في المرجع)، ويمنع إرجاع
  // نفس السطر مرتين بالاستعلام من returns الحقيقية بدل مصفوفة محلية.
  //
  // ⚠ الدالة صارت async — SalesReturnPage.jsx يستخدم await عند النداء.
  const processSalesReturn = async (req) => {
    try {
      const res = await api.returnsApi.createFull(req.saleId, {
        lineIndexes: req.lineIndexes,
        reasonId: req.reasonId,
        refundTarget: req.refundTarget,
        note: req.note || null,
      });
      const r = res.return;
      const sale = sales.find((x) => x.id === req.saleId);
      const record = {
        id: r.id, ref: r.ref, saleId: r.sale_id, saleRef: sale?.ref || null,
        date: r.created_at,
        lineIndexes: r.line_indexes || [],
        lines: r.lines || [],
        fullReturn: !!r.full_return,
        restockAs: r.restock,
        refundTarget: r.refund_source,
        net: res.amounts.net, tax: res.amounts.tax, refund: res.amounts.gross, cost: res.amounts.cost,
        note: r.reason || "",
        customerId: r.customer_id || null,
        customerName: r.customer_name || "",
        createdBy: currentUser?.name || "",
      };
      setReturns((prev) => [record, ...prev]);

      // تحديث تفاؤلي للوحدات — الخادم حدّث item_units فعليًا (تالفة
      // تصير issued=true فلا تُعرض ثانية، متاحة تعود sold=false فقط).
      const restockedIds = new Set();
      for (const l of record.lines) {
        // نحتاج N وحدة مباعة من نفس الصنف — بلا ربط id محفوظ هنا، نأخذ
        // بالترتيب تمامًا كما يفعل الخادم (سيُستبدل بدقة كاملة عند
        // إعادة تحميل bootstrap القادمة).
        let need = Number(l.quantity) || 0;
        setItems((prev) => prev.map((it) => {
          if (it.id !== l.item_id || need <= 0) return it;
          const units = (it.units || []).map((u) => {
            if (need > 0 && u.sold && !restockedIds.has(u.code)) {
              need -= 1;
              restockedIds.add(u.code);
              return {
                ...u,
                sold: false,
                status: record.restockAs,
                returnedAt: record.date,
                returnedRef: record.ref,
                sellable: record.restockAs === "available",
              };
            }
            return u;
          });
          return { ...it, units };
        }));
      }

      if (res.receipt) {
        setReceipts((prev) => [
          { id: res.receipt.id, ref: res.receipt.ref, date: res.receipt.created_at,
            customerId: res.receipt.customer_id, customerName: res.receipt.customer_name || "",
            amount: Number(res.receipt.amount) || 0, method: res.receipt.method,
            category: res.receipt.category, note: res.receipt.note || "", createdBy: currentUser?.name || "" },
          ...prev,
        ]);
      } else if (res.cashTx) {
        const entryTx = normalizeCashTxRow(res.cashTx);
        if (res.cashTx.pool === "safe") setSafeTx((prev) => [entryTx, ...prev]);
        else setCashTx((prev) => [entryTx, ...prev]);
      }

      flashToast(
        `مرتجع ${record.ref} · ${fmtMoney(record.refund)} · ` +
        (record.restockAs === "available" ? "عادت للعرض" : "تالفة — لا تُباع")
      );
      return { ok: true, ref: record.ref, record, amounts: res.amounts };
    } catch (err) {
      const msg = apiErrorMessage(err, "تعذّر تسجيل المرتجع");
      flashToast(msg);
      return { ok: false, errors: [msg] };
    }
  };

  // ⚠ حُوِّلت للباك إند بالكامل: POST /sales/:id/return يتحقق فعليًا من
  // sale_lines على الخادم (لا مصفوفة محلية فقط)، يُعيد وحدات item_units
  // الحقيقية لغير مباعة، يُرحّل دفتر الوزن (سطر posting_rules.sale_return
  // كان مزروعًا أصلًا بلا أي endpoint يستهلكه)، ويكتب إما receipts (آجل)
  // أو cash_tx+قيد يومية فعليين (نقد/شبكة) — لا حفظ محلي بحت كان يختفي
  // بعد إعادة التحميل تمامًا كسبب البلاغ الأصلي عن الخزنة.
  //
  // ⚠ فهارس الأسطر (lineIndexes) الآن تطابق فعليًا نفس الترتيب على
  // الخادم (migration 013 أضافت sale_lines.line_no — قبلها لم يكن ترتيب
  // القراءة مضمونًا بلا ORDER BY، فقد يشير الفهرس لسطر مختلف فعليًا).
  const handleReturnSale = async (saleId, lineIndexes, refundSource, note) => {
    const sale = sales.find((x) => x.id === saleId);
    if (!sale) return null;
    try {
      const res = await api.returnsApi.create(saleId, { lineIndexes, refundSource, note: note || null });
      const r = res.return;
      const rec = {
        id: r.id, ref: r.ref, date: r.created_at, saleId, saleRef: sale.ref || null,
        customerId: r.customer_id, customerName: r.customer_name || "",
        lines: r.lines || [], lineIndexes: r.line_indexes || [],
        fullReturn: !!r.full_return, refund: Number(r.amount) || 0,
        refundSource: r.refund_source, note: r.reason || "", createdBy: currentUser?.name || "",
      };
      setReturns((prev) => [rec, ...prev]);

      // أعِد الوحدات للمخزون محليًا (الخادم فعليًا حدّث item_units، وهنا
      // تحديث تفاؤلي مطابق بلا إعادة تحميل bootstrap كاملة).
      setItems((prev) => prev.map((it) => {
        const line = rec.lines.find((l) => l.item_id === it.id);
        if (!line) return it;
        let toRestore = Number(line.quantity);
        const units = it.units.map((u) => {
          if (toRestore > 0 && u.sold) {
            toRestore -= 1;
            return { ...u, sold: false };
          }
          return u;
        });
        return { ...it, units };
      }));

      if (res.receipt) {
        setReceipts((prev) => [
          { id: res.receipt.id, ref: res.receipt.ref, date: res.receipt.created_at,
            customerId: res.receipt.customer_id, customerName: res.receipt.customer_name || "",
            amount: Number(res.receipt.amount) || 0, method: res.receipt.method,
            category: res.receipt.category, note: res.receipt.note || "", createdBy: currentUser?.name || "" },
          ...prev,
        ]);
      } else if (res.cashTx) {
        const entryTx = normalizeCashTxRow(res.cashTx);
        if (res.cashTx.pool === "safe") setSafeTx((prev) => [entryTx, ...prev]);
        else setCashTx((prev) => [entryTx, ...prev]);
      }

      flashToast(`تم الإرجاع — ${priceData.currency}${fmt(rec.refund, 0)}`);
      return rec;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تنفيذ الإرجاع"));
      return null;
    }
  };
  // ⚠ صارا نداءي شبكة حقيقيين — expense_names أصبح جدولًا حقيقيًا
  // (migration 010) بدل مصفوفة محلية فقط.
  const handleAddExpenseName = async (name, category) => {
    const clean = (name || "").trim();
    if (!clean) return null;
    if (expenseNames.some((x) => normalizeName(x.name) === normalizeName(clean))) {
      flashToast("هذا المسمى موجود مسبقًا");
      return null;
    }
    try {
      const res = await api.expensesApi.addName(clean, category || "other");
      const rec = { id: res.expenseName.id, name: res.expenseName.name, category: res.expenseName.category || "other" };
      setExpenseNames((prev) => [rec, ...prev]);
      flashToast("تمت إضافة المسمى");
      return rec;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّرت إضافة المسمى"));
      return null;
    }
  };
  const handleDeleteExpenseName = async (id) => {
    try {
      await api.expensesApi.deleteName(id);
      setExpenseNames((prev) => prev.filter((x) => x.id !== id));
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر حذف المسمى"));
      return null;
    }
  };
  // ⚠ صار نداء شبكة حقيقي (migration 016) — قاعدة عمولة البائع بيانات
  // عمل حقيقية يجب أن تظهر لكل مستخدم بعد أي تحديث، لا إعداد جهاز محلي.
  // commissions تبقى بنفس شكل {sellerId: rule} محليًا (تستهلكه
  // SellerReportsPage.jsx مباشرة) — فقط مصدر الكتابة تغيّر.
  const handleSaveCommission = async (sellerId, rule) => {
    try {
      const res = await api.payrollApi.saveCommission(sellerId, rule);
      setCommissions((prev) => ({
        ...prev,
        [sellerId]: { basis: res.rule.basis, rate: Number(res.rule.rate), target: Number(res.rule.target), perInvoice: Number(res.rule.per_invoice) },
      }));
      flashToast("تم حفظ إعداد العمولة");
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر حفظ إعداد العمولة"));
      return false;
    }
  };
  const persistNavLayout = (next) => persist(NAV_LAYOUT_KEY, next, setNavLayout);
  // الترتيب يُحفظ مع كل تغيير بلا زر ولا تأكيد، ويُستعاد عند كل فتح.
  // التنبيه أُزيل عمدًا: كان يظهر مع كل نقلة سهم فيُغرق الشاشة.
  const handleSaveNavLayout = (next) => persistNavLayout(next);
  const handleSaveMenuOrder = (next) => persist(MENU_ORDER_KEY, next, setMenuOrder);

  const handleSaveCategories = (next) => {
    setRuntimeCategories(next);
    persist(CATEGORIES_KEY, next, setCategories);
    flashToast("حُفظت التصنيفات");
  };

  // ⚠ لا يُحذف تصنيف مستخدم في المخزون: القطع تصير بلا اسم تصنيف
  // وتختفي من الفلاتر والتقارير.
  const categoryInUse = (id) =>
    items.some((it) => it.categoryId === id) || sales.some((s) => (s.lines || []).some((l) => {
      const it = items.find((x) => x.id === l.itemId);
      return it && it.categoryId === id;
    }));

  const handleSaveCustomGroups = (next) => {
    persist(CUSTOM_GROUPS_KEY, next, setCustomGroups);
    flashToast("حُفظت القوائم");
  };

  // ── النسخ الاحتياطي والاستعادة ──
  // كل بيانات المحل في تخزين المتصفح. عطل جهاز أو مسح بيانات المتصفح
  // يمحوها بلا رجعة، ولا خادم يحتفظ بنسخة — فالتنزيل الدوري هو الأمان
  // الوحيد.
  const ALL_DATA_KEYS = [
    ITEMS_KEY, PRICE_KEY, SALES_KEY, CASH_KEY, SCRAP_KEY, AUDIT_KEY, SUPPLIERS_KEY,
    LOTS_KEY, SCRAP_CUSTODY_KEY, SAFE_KEY, TASKIR_KEY, TASKIR_OFFICES_KEY,
    EXPENSES_KEY, PARTNERS_KEY, PARTNER_TX_KEY, USERS_KEY, TASKIR_OFFICE_TX_KEY,
    SAFE_GOLD_KEY, SETTINGS_KEY, REPAIRS_KEY, SCRAP_SURPLUS_KEY, COMMISSIONS_KEY,
    DAILY_CUSTODY_KEY, ENTRY_SESSIONS_KEY, WEIGHT_ADJ_KEY, EXPENSE_NAMES_KEY,
    CUSTOMERS_KEY, TRUST_GOLD_KEY, RETURNS_KEY, RECEIPTS_KEY, SAFE_AUDITS_KEY,
    RESERVATIONS_KEY, BUSINESS_DAYS_KEY, STOCKTAKE_LOCK_KEY, PRINTER_KEY, RFID_KEY, MENU_ORDER_KEY, CATEGORIES_KEY, SCRAP_REQUESTS_KEY, GOLD_LEDGER_KEY, SHORTCUTS_KEY, BANK_TX_KEY, CUSTOM_GROUPS_KEY, INTEGRATION_KEY, EXT_INVOICES_KEY, STORE_KEY, STORE_ORDERS_KEY, NAV_LAYOUT_KEY, OPENING_BALANCE_KEY,
    FISCAL_CLOSURES_KEY, BRANCH_IDENTITY_KEY,
  ];

  // ── النسخة التجريبية ──
  // تُكتب مباشرة للتخزين ثم يُعاد التحميل: الكتابة مع تحديث الحالة قطعة
  // قطعة تترك التطبيق نصف محمّل لو انقطعت.
  // ── استقبال فاتورة خارجية ──
  const handleExternalInvoice = (payload) => txn("handleExternalInvoice", () => {
    const res = validateExternalInvoice(payload, {
      config: integration,
      users,
      customers,
      items,
      received: extInvoices,
    });
    const now = new Date().toISOString();
    const logEntry = {
      id: Date.now().toString() + "ex",
      receivedAt: now,
      externalId: res.externalId || "—",
      source: payload?.system || integration.systemName || "نظام خارجي",
      status: res.duplicate ? "duplicate" : res.ok ? "accepted" : "rejected",
      errors: res.errors || [],
      total: res.draft?.total || Number(payload?.total) || 0,
      sellerRef: res.draft?.sellerRef || payload?.sellerRef || null,
      sellerName: res.draft?.sellerName || null,
      sellerMatchedBy: res.draft?.sellerMatchedBy || null,
      saleId: null,
      ...dayStamp(),
    };

    if (!res.ok) {
      persist(EXT_INVOICES_KEY, [logEntry, ...extInvoices], setExtInvoices);
      flashToast(res.duplicate ? "فاتورة مكررة — تُجوهلت" : `رُفضت: ${res.errors[0]}`);
      return { ok: false, status: logEntry.status, errors: res.errors };
    }

    const d = res.draft;
    const saleId = Date.now().toString() + "xs";
    const sale = {
      id: saleId,
      ref: nextRef("sale", sales),
      date: d.issuedAt,
      sellerId: d.sellerId,
      sellerRef: d.sellerRef,
      sellerName: d.sellerName,
      sellerMatchedBy: d.sellerMatchedBy,
      customerId: d.customerId,
      customerName: d.customerName,
      paymentMethod: d.paymentMethod,
      cardNetwork: d.cardNetwork,
      cashPart: d.cashPart,
      networkPart: d.networkPart,
      subtotal: d.total,
      total: d.total,
      taxApplicable: d.taxApplicable,
      taxAmount: d.taxAmount,
      lines: d.lines,
      // أثر المصدر: يميّز الفاتورة الواردة ويسمح بمطابقتها بالنظام الآخر.
      externalId: d.externalId,
      externalSource: d.source,
      createdBy: d.sellerName,
      createdById: d.sellerId,
      ...dayStamp(),
    };

    // خصم القطع
    const soldCodes = new Set(d.lines.flatMap((l) => l.unitCodes));
    const updatedItems = integration.autoDeductStock
      ? items.map((it) => ({
          ...it,
          units: (it.units || []).map((u) => (soldCodes.has(u.code) ? { ...u, sold: true } : u)),
        }))
      : items;

    // القيود النقدية — نفس منطق البيع الداخلي
    const entries = [];
    const mkTx = (method, amount, note, category, sfx) => ({
      id: Date.now().toString() + sfx,
      date: d.issuedAt,
      type: category === "network_fees" ? "out" : "in",
      method,
      amount,
      note,
      source: "external_sale",
      refId: saleId,
      category,
      createdBy: d.sellerName,
      ...dayStamp(),
    });
    let cashIn = 0;
    let netIn = 0;
    if (d.paymentMethod === "split") {
      cashIn = d.cashPart;
      netIn = Math.max(0, d.total - d.cashPart);
    } else if (d.paymentMethod === "cash") cashIn = d.total;
    else if (d.paymentMethod === "card") netIn = d.total;

    if (cashIn > 0) entries.push(mkTx("cash", cashIn, `بيع خارجي ${d.externalId} — نقدي`, "sales_revenue", "xc"));
    if (netIn > 0) {
      entries.push(mkTx("network", netIn, `بيع خارجي ${d.externalId} — شبكة`, "sales_revenue", "xn"));
      const feePct = cardFeeOf(appSettings, d.cardNetwork);
      if (feePct > 0) {
        entries.push(mkTx("network", netIn * (feePct / 100), `عمولة ${fmt(feePct, 2)}٪`, "network_fees", "xf"));
      }
    }

    // كتابة واحدة لكل مخزن
    // قيد وزني: الذهب يخرج من المخزون
    postWeight(
      sale.paymentMethod === "credit" ? "sale_credit"
        : sale.paymentMethod === "card" ? "sale_card" : "sale_cash",
      (sale.lines || []).map((l) => ({
        karat: l.karatSnapshot,
        weight: (Number(l.weightSnapshot) || 0) * (Number(l.quantity) || 1),
        refId: sale.id, note: `بيع ${sale.ref}`,
      }))
    );
    // ── ② البدل: مستند شراء كسر مربوط بالفاتورة ──
    //
    // ⚠ مستندان لا واحد. الصافي في قيد واحد يُخفي الإيراد ويُخفي
    // الشراء: الضريبة تُحسب على قيمة البيع لا على الفرق، وربح المحل
    // يختفي من التقارير، والكسر يدخل الصندوق بلا مصدر.
    //
    // والنقد يتحرّك بالفرق وحده — لا مرتين.
    const tLines = draft.tradeLines || [];
    if (tLines.length) {
      const now2 = new Date().toISOString();
      const scrapDocs = tLines.map((l, i) => {
        const stonesEst2 = roundW(Number(l.stones) || 0);
        return {
          id: Date.now().toString() + "ts" + i,
          ref: nextRef("scrap", [...scrapEntries]),
          date: now2,
          createdBy: currentUser?.name || "",
          createdById: currentUser?.id || null,
          ...dayStamp(),
          weight: roundW(l.weight),
          grossWeight: roundW(l.gross),
          stonesMarginEstimate: stonesEst2,
          karat: l.karat,
          pricePerGram: Number(l.pricePerGram) || 0,
          total: Math.round((Number(l.total) || 0) * 100) / 100,
          pricedBy: l.pricedBy || "gram",
          // ⚖ مصدره ظاهر: بدلٌ في فاتورة بعينها
          source: "trade_in",
          saleId: sale.id,
          saleRef: sale.ref,
          customerId: sale.customerId || null,
          customerName: sale.customerName || "",
          description: `بدل بكسر — فاتورة ${sale.ref}`,
          paymentMethod: "trade_in",
          stage: stonesEst2 > 0.0005 ? "pending_break" : "in_box",
          refined: stonesEst2 <= 0.0005,
          actualStonesWeight: null,
          breakVariance: 0,
        };
      });
      persistScrap([...scrapDocs, ...scrapEntries]);

      // قيد وزني: الذهب يدخل — عكس اتجاه البيع
      postWeight("purchase_scrap", scrapDocs.map((d) => ({
        karat: d.karat, weight: d.weight, refId: d.id,
        note: `بدل ${sale.ref}`,
      })));

      // ⚠ الكسر هنا لا يُدفع من عهدة الكسر: قيمته تُقاصّ بالفاتورة.
      // خصمها من العهدة يعني خروج نقد لم يحدث، فتظهر العهدة ناقصة.
      const tradeVal = scrapDocs.reduce((a, d) => a + d.total, 0);
      const diff = Math.round((((Number(sale.total) || 0)) - tradeVal) * 100) / 100;
      // ⚠ الردّ للعميل يخرج من الصندوق اليومي: تجاوز رصيده نقدٌ خرج من مكان
      // غير مسجّل، ويظهر لاحقًا رصيدًا سالبًا لا يُفسَّر.
      if (diff < -0.005 && Math.abs(diff) > cashBalance.cash + 0.01) {
        flashToast(
          `الصندوق اليومي ${fmtMoney(cashBalance.cash)} لا يكفي لردّ ${fmtMoney(Math.abs(diff))} — موّله أولًا`
        );
      }
      if (Math.abs(diff) > 0.005) {
        const entry = {
          id: Date.now().toString() + "td",
          date: now2,
          type: diff > 0 ? "in" : "out",
          method: "cash",
          amount: Math.abs(diff),
          note: `فرق بدل — فاتورة ${sale.ref}`,
          source: "sale_trade",
          refId: sale.id,
          category: diff > 0 ? "sales_revenue" : "gold_purchase_scrap",
          createdBy: currentUser?.name || "",
          ...dayStamp(),
        };
        persistCash([entry, ...cashTx]);
      }
      flashToast(
        `فاتورة ${sale.ref} · كسر ${fmtW(scrapDocs.reduce((a, d) => a + d.weight, 0))} جم · ` +
        (diff > 0 ? `يدفع ${fmtMoney(diff)}` : diff < 0 ? `يُستلم ${fmtMoney(-diff)}` : "متعادل")
      );
    }

    // قيد مزدوج: نقد/ذمم مدين وإيراد دائن، والضريبة طرفٌ ثالث
    postJournal(
      sale.paymentMethod === "credit" ? "sale_credit"
        : sale.paymentMethod === "card" ? "sale_card"
        : sale.paymentMethod === "scrap" ? "sale_cash" : "sale_cash",
      Number(sale.netAmount) || Number(sale.total) || 0,
      {
        refId: sale.id, refDoc: sale.ref, note: `فاتورة ${sale.ref}`,
        splits: (Number(sale.taxAmount) || 0) > 0
          ? [{ account: "2220", side: "credit", amount: sale.taxAmount },
             { account: "1130", side: "debit", amount: sale.taxAmount }]
          : [],
      }
    );
    persistSales([sale, ...sales]);
    audit("create", { entity: "sale", entityId: sale.id, entityRef: sale.ref,
      after: { total: sale.total, method: sale.paymentMethod, lines: (sale.lines||[]).length } });
    if (integration.autoDeductStock) persistItems(updatedItems);
    if (entries.length) persistCash([...entries, ...cashTx]);
    persist(EXT_INVOICES_KEY, [{ ...logEntry, saleId, total: d.total }, ...extInvoices], setExtInvoices);

    flashToast(`قُبلت الفاتورة ${d.externalId} — ${sale.ref}`);
    return { ok: true, status: "accepted", saleRef: sale.ref, saleId };
  
  });

  // ── طلبات المتجر الإلكتروني ──
  const handleStoreOrder = (payload) => txn("handleStoreOrder", () => {
    const res = validateStoreOrder(payload, { config: storeLink, items, orders: storeOrders });
    const now = new Date().toISOString();
    const base = {
      id: Date.now().toString() + "so",
      receivedAt: now,
      orderId: res.orderId || "—",
      store: payload?.store || storeLink.storeName || "المتجر",
      status: res.duplicate ? "duplicate" : res.ok ? res.state : "rejected",
      errors: res.errors || [],
      outOfStock: res.outOfStock || [],
      total: res.draft?.total || 0,
      customerName: payload?.customerName || null,
      saleId: null,
      ...dayStamp(),
    };

    if (!res.ok) {
      persist(STORE_ORDERS_KEY, [base, ...storeOrders], setStoreOrders);
      if ((res.outOfStock || []).length) {
        flashToast(`نفدت ${res.outOfStock.length} قطعة — أُبلغ المتجر`);
      } else {
        flashToast(res.duplicate ? "طلب مكرر — تُجوهل" : `رُفض: ${res.errors[0]}`);
      }
      // يُرد للمتجر ما نفد ليُخفيه فورًا بدل بيع ما ليس عندنا.
      return { ok: false, status: base.status, errors: res.errors, outOfStock: res.outOfStock, stock: buildStockFeed(items, storeLink) };
    }

    const d = res.draft;
    const codes = new Set(d.lines.flatMap((l) => l.unitCodes));

    // ① إلغاء: يُفكّ الحجز وتعود القطع للعرض
    if (d.state === "cancelled") {
      persistItems(
        items.map((it) => ({
          ...it,
          units: (it.units || []).map((u) =>
            u.onlineOrderId === d.orderId && u.onlineStatus === "reserved"
              ? { ...u, onlineStatus: null, onlineOrderId: null, onlineOrderRef: null }
              : u
          ),
        }))
      );
      persist(STORE_ORDERS_KEY, [base, ...storeOrders], setStoreOrders);
      flashToast(`أُلغي الطلب ${d.orderId} — فُكّ الحجز`);
      return { ok: true, status: "cancelled", stock: buildStockFeed(items, storeLink) };
    }

    // ② حجز عند الطلب — قبل الدفع
    if (d.state === "pending") {
      persistItems(
        items.map((it) => ({
          ...it,
          units: (it.units || []).map((u) =>
            codes.has(u.code) && !u.sold
              ? { ...u, onlineStatus: "reserved", onlineOrderId: d.orderId, onlineOrderRef: d.orderId }
              : u
          ),
        }))
      );
      persist(STORE_ORDERS_KEY, [base, ...storeOrders], setStoreOrders);
      flashToast(`حُجزت ${codes.size} قطعة لطلب ${d.orderId}`);
      return { ok: true, status: "reserved", held: [...codes] };
    }

    // ③ دفع: تُعلَّم مباعة وتُسجَّل فاتورة
    const saleId = Date.now().toString() + "ws";
    let customer = customers.find((c) => c.phone && c.phone === d.customerPhone);
    if (!customer && d.customerName) {
      customer = customers.find((c) => normalizeName(c.name) === normalizeName(d.customerName));
    }
    const sale = {
      id: saleId,
      ref: nextRef("sale", sales),
      date: d.placedAt,
      sellerId: null,
      sellerName: `${storeLink.storeName || "المتجر الإلكتروني"}`,
      customerId: customer?.id || null,
      customerName: customer?.name || d.customerName || null,
      paymentMethod: d.paymentMethod,
      cardNetwork: d.cardNetwork,
      subtotal: d.total,
      total: d.total,
      taxApplicable: false,
      taxAmount: 0,
      lines: d.lines,
      channel: "online",
      externalId: d.orderId,
      externalSource: base.store,
      createdBy: base.store,
      ...dayStamp(),
    };

    persistItems(
      items.map((it) => ({
        ...it,
        units: (it.units || []).map((u) =>
          codes.has(u.code)
            ? { ...u, sold: true, onlineStatus: "sold", onlineOrderId: d.orderId, onlineOrderRef: d.orderId }
            : u
        ),
      }))
    );

    const entries = [];
    const mkTx = (method, amount, note, category, sfx) => ({
      id: Date.now().toString() + sfx,
      date: d.placedAt,
      type: category === "network_fees" ? "out" : "in",
      method,
      amount,
      note,
      source: "store_order",
      refId: saleId,
      category,
      createdBy: base.store,
      ...dayStamp(),
    });
    if (d.paymentMethod === "card") {
      entries.push(mkTx("network", d.total, `بيع متجر ${d.orderId}`, "sales_revenue", "wn"));
      const feePct = cardFeeOf(appSettings, d.cardNetwork);
      if (feePct > 0) entries.push(mkTx("network", d.total * (feePct / 100), `عمولة ${fmt(feePct, 2)}٪`, "network_fees", "wf"));
    } else {
      entries.push(mkTx("cash", d.total, `بيع متجر ${d.orderId}`, "sales_revenue", "wc"));
    }

    persistSales([sale, ...sales]);
    if (entries.length) persistCash([...entries, ...cashTx]);
    persist(STORE_ORDERS_KEY, [{ ...base, saleId }, ...storeOrders], setStoreOrders);
    flashToast(`بيع متجر ${d.orderId} — ${sale.ref}`);
    return { ok: true, status: "paid", saleRef: sale.ref, stock: buildStockFeed(items, storeLink) };
  
  });

  const handleSaveStore = (next) => {
    persist(STORE_KEY, next, setStoreLink);
    flashToast("حُفظت إعدادات المتجر");
  };

  const handleSaveIntegration = (next) => {
    persist(INTEGRATION_KEY, next, setIntegration);
    flashToast("حُفظت إعدادات الربط");
  };

  // نافذة عالمية للنظام الخارجي: يستدعيها مباشرة أو عبر جسر التطبيق.
  useEffect(() => {
    window.ounceReceiveInvoice = (payload) => handleExternalInvoice(payload);
    window.ounceStoreOrder = (payload) => handleStoreOrder(payload);
    window.ounceStock = () => buildStockFeed(items, storeLink);
    return () => {
      delete window.ounceReceiveInvoice;
      delete window.ounceStoreOrder;
      delete window.ounceStock;
    };
  });

  // ── تصفير كامل ──
  // يمسح كل شيء ويعيد التطبيق لأول تشغيل. المفاتيح تُمسح واحدًا واحدًا
  // بتباعد: المسح الجماعي المتسارع يستنفد حدّ الطلبات فيبقى نصف البيانات
  // ويظهر التطبيق سليمًا وهو ليس كذلك.
  const handleResetAll = async (onProgress) => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const keys = [...ALL_DATA_KEYS, MIGRATION_FLAG, STOCKTAKE_LOCK_KEY, PRINTER_KEY, MENU_ORDER_KEY, CATEGORIES_KEY, SCRAP_REQUESTS_KEY, GOLD_LEDGER_KEY, SHORTCUTS_KEY, BANK_TX_KEY, CUSTOM_GROUPS_KEY,
      INTEGRATION_KEY, EXT_INVOICES_KEY, STORE_KEY, STORE_ORDERS_KEY, BUSINESS_DAYS_KEY];
    const failed = [];
    for (let i = 0; i < keys.length; i++) {
      let done = false;
      for (let attempt = 0; attempt < 3 && !done; attempt++) {
        try {
          await window.storage.delete(keys[i], false);
          done = true;
        } catch (e) {
          // المفتاح غير موجود أصلًا ليس فشلًا
          if (String(e?.message || "").includes("not found")) done = true;
          else await pause(250 * (attempt + 1));
        }
      }
      if (!done) failed.push(keys[i]);
      if (onProgress) onProgress(i + 1, keys.length);
      await pause(60);
    }
    if (failed.length) {
      flashToast(`تعذّر مسح ${failed.length} مخزنًا — أعد المحاولة`);
      return;
    }
    flashToast("صُفّر التطبيق — يُعاد التحميل");
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleLoadDemo = async (onProgress) => {
    // 29 كتابة متتابعة تستنفد حدّ الطلبات فتفشل الأخيرة بصمت. لذلك:
    // مهلة قصيرة بين الكتابات، وإعادة محاولة عند الفشل، وتقرير بما لم
    // يُكتب — تحميل نصف بيانات أسوأ من عدم التحميل.
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    let data;
    try {
      data = buildDemoDataset();
    } catch (e) {
      console.error("demo build failed", e);
      flashToast("تعذّر تجهيز البيانات التجريبية");
      return;
    }
    const entries = Object.entries(data);
    const failed = [];
    for (let i = 0; i < entries.length; i++) {
      const [k, v] = entries[i];
      const payload = JSON.stringify(v);
      let done = false;
      for (let attempt = 0; attempt < 3 && !done; attempt++) {
        try {
          await window.storage.set(k, payload, false);
          done = true;
        } catch (e) {
          await pause(300 * (attempt + 1));
        }
      }
      if (!done) failed.push(k);
      if (onProgress) onProgress(i + 1, entries.length);
      await pause(70); // تباعد يمنع استنفاد الحد
    }
    try {
      await window.storage.set(MIGRATION_FLAG, "1", false);
    } catch (e) {
      /* غير حرج */
    }
    if (failed.length) {
      console.error("demo keys failed", failed);
      flashToast(`تعذّر كتابة ${failed.length} مخزنًا — أعد المحاولة`);
      return;
    }
    flashToast(`حُمّلت النسخة التجريبية — ${entries.length} مخزنًا`);
    setTimeout(() => window.location.reload(), 1000);
  };

  // ── تشفير النسخة الاحتياطية ──
  // النسخة تحوي كل شيء: أرصدة وأسعار وعملاء ورواتب. ملف بلا تشفير على
  // هاتف أو بريد يعني أن من يجده يعرف محلك كاملًا. التشفير بكلمة سر
  // يجعل الملف بلا قيمة لمن لا يملكها.
  //
  // AES-GCM بمفتاح مشتق من كلمة السر بـPBKDF2 (200 ألف تكرار). العدد
  // الكبير يُبطئ التخمين: كل محاولة تكلّف المهاجم زمنًا حقيقيًا.
  const deriveKey = async (password, salt) => {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  };

  const encryptPayload = async (plainText, password) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plainText)
    );
    const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
    return { enc: "AES-GCM", kdf: "PBKDF2-200k", salt: b64(salt), iv: b64(iv), data: b64(cipher) };
  };

  const decryptPayload = async (pack, password) => {
    const bin = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const key = await deriveKey(password, bin(pack.salt));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bin(pack.iv) },
      key,
      bin(pack.data)
    );
    return new TextDecoder().decode(plain);
  };

  const handleBackup = async (password) => {
    try {
      const data = {};
      const recordCounts = {};
      for (const k of ALL_DATA_KEYS) {
        try {
          const res = await window.storage.get(k, false);
          if (!res) continue;
          data[k] = res.value;
          const parsed = JSON.parse(res.value);
          recordCounts[k] = Array.isArray(parsed) ? parsed.length : 1;
        } catch (e) {
          /* مفتاح غير موجود — طبيعي */
        }
      }
      const pack = {
        app: "ounce-branch",
        version: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser?.name || "",
        branch: branchIdentity?.name || "",
        recordCounts,
        data,
      };
      // كلمة سر → ملف مشفّر · بلا كلمة سر → نص صريح مع تنبيه
      let out = pack;
      if (password && password.length >= 6) {
        const secured = await encryptPayload(JSON.stringify(pack), password);
        out = {
          app: "ounce-branch",
          version: 1,
          encrypted: true,
          exportedAt: pack.exportedAt,
          exportedBy: pack.exportedBy,
          branch: pack.branch,
          keyCount: Object.keys(pack.data).length,
          payload: secured,
        };
      }
      const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `نسخة_أوقية${password ? "_مشفّرة" : ""}_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      flashToast(`نُزّلت النسخة${password ? " مشفّرة" : ""} — ${Object.keys(data).length} مخزن`);
    } catch (e) {
      console.error("backup failed", e);
      flashToast("تعذّر إنشاء النسخة");
    }
  };

  const handleRestore = async (pack, password) => {
    // فكّ التشفير قبل التحقق: الملف المشفّر لا تُقرأ بنيته إلا بعده
    if (pack && pack.encrypted) {
      if (!password) {
        flashToast("الملف مشفّر — أدخل كلمة السر");
        return;
      }
      try {
        pack = JSON.parse(await decryptPayload(pack.payload, password));
      } catch (e) {
        flashToast("كلمة السر غير صحيحة أو الملف تالف");
        return;
      }
    }
    // التحقق قبل أي كتابة: استعادة ملف تالف أسوأ من عدم الاستعادة.
    if (!pack || pack.app !== "ounce-branch" || !pack.data) {
      flashToast("الملف ليس نسخة صالحة من تطبيق الفرع");
      return;
    }
    try {
      const entries = Object.entries(pack.data);
      for (const [k, v] of entries) {
        JSON.parse(v); // يفشل مبكرًا لو تلف أي مخزن
      }
      for (const [k, v] of entries) {
        await window.storage.set(k, v, false);
      }
      flashToast(`استُعيد ${entries.length} مخزن — يُعاد التحميل`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      console.error("restore failed", e);
      flashToast("تعذّرت الاستعادة — الملف تالف أو المساحة ممتلئة");
    }
  };
  const persistOpeningBalance = (next) => persist(OPENING_BALANCE_KEY, next, setOpeningBalance);
  const handleSaveOpeningBalance = (next) => {
    // ⚠ يُجمَّد المركز الذهبي هنا أيضًا: أول سنةٍ لا إقفال سابقًا لها،
    // فبلا هذا لا افتتاحي يُقاس منه ربح أول سنة بالجرام.
    persistOpeningBalance(normalizeOpeningBalance({
      ...next, date: openingBalance.date || new Date().toISOString(),
      goldPosition: { ...goldPosition, frozenAt: new Date().toISOString() },
    }));
    flashToast("تم حفظ الرصيد الافتتاحي");
  };
  const persistFiscalClosures = (next) => persist(FISCAL_CLOSURES_KEY, next, setFiscalClosures);
  // Closes the current fiscal period: computes this period's net profit
  // (sales realized profit minus expenses, both scoped to since-last-cutoff),
  // snapshots the ending balances as the new flow base, and archives an
  // immutable record. Nothing in the transaction history is deleted — only
  // the reference point future balances are measured from moves forward,
  // which is exactly what keeps this from ever double-counting old entries.
  const handleCloseFiscalYear = (notes) => {
    const periodStart = latestClosure ? latestClosure.closedAt : openingBalance.date || null;
    const now = new Date().toISOString();
    const periodSales = sales.filter((s) => periodStart === null || new Date(s.date) > new Date(periodStart));
    const periodExpenses = expenses.filter((e) => periodStart === null || new Date(e.date) > new Date(periodStart));
    const periodRealizedProfit = periodSales.reduce((acc, s) => {
      const saleProfit = (s.lines || []).reduce((lacc, l) => {
        const basis = (l.costPerGramSnapshot * l.weightSnapshot + (l.workmanshipSnapshot || 0)) * l.quantity;
        return lacc + (l.unitPrice * l.quantity - basis);
      }, 0);
      return acc + saleProfit;
    }, 0);
    const periodExpensesTotal = periodExpenses.reduce((a, e) => a + e.amount, 0);
    const netProfit = periodRealizedProfit - periodExpensesTotal;
    const price24 = priceData.current || 0;
    const netProfitGrams = price24 > 0 ? netProfit / price24 : 0;

    // ⚠ ربح السنة بالجرام — الافتتاحي: مركز آخر إقفالٍ سابق، أو المركز
    // المحفوظ في الرصيد الافتتاحي إن كانت أول سنة. والختامي: المركز الآن.
    const openingPos = latestClosure?.goldPosition || openingBalance?.goldPosition || null;
    const closingPos = goldPosition;
    const gp = openingPos ? goldProfit(openingPos, closingPos) : null;

    const closure = {
      id: Date.now().toString(),
      ref: nextRef("closure", fiscalClosures),
      closedAt: now,
      periodStart,
      periodSalesCount: periodSales.length,
      periodExpensesTotal,
      periodRealizedProfit,
      netProfit,
      netProfitGrams,
      goldGramsAtClose: goldEquivalent.goldGrams,
      cashGramsAtClose: goldEquivalent.cashGrams,
      // المركز الذهبي — يُجمَّد هنا ليكون افتتاحي السنة التالية
      goldPosition: closingPos,
      goldProfit: gp,
      closingBalances: {
        dailyCash: cashBalance.cash,
        dailyNetwork: cashBalance.network,
        safeCash: safeBalance.cash,
        safeNetwork: safeBalance.network,
        safeGoldRaw: safeGoldBalance.raw,
        safeGoldCrafted: safeGoldBalance.crafted,
        safeGoldByKarat: safeGoldBalance.byKarat,
        safeGoldFineWeight: safeGoldBalance.fineWeight,
        custodyCash: scrapCustodyBalance.cash,
        custodyNetwork: scrapCustodyBalance.network,
        partnersCapital: partnersTotals.totalCapital,
        partnersCapitalGrams: partnersTotals.totalCapitalGrams,
      },
      notes: notes || "",
    };
    persistFiscalClosures([closure, ...fiscalClosures]);
    flashToast("تم إقفال السنة المالية");
  };
  // Single entry point for opening ANY page, regardless of whether it's a
  // "tab" page or a "morePage" page under the hood, and regardless of whether
  // it's launched from the main bar or from "المزيد".
  // Effective permissions for a role = the app's built-in ROLES definition,
  // narrowed (never widened) by whatever HQ has pushed for this branch. HQ can
  // only take pages away, so a compromised/incorrect HQ config can't hand a
  // clerk access to pages the branch app never intended them to have.
  const effectivePerms = (r, user) => {
    // ⚠ قبل الدخول لا دور. استدعاؤها في useMemo على مستوى الجذر يعني
    // أنها تعمل والشاشة شاشة دخول — فترجع صلاحية فارغة بدل الانهيار.
    const base = ROLES[r] || { allowedTabs: [], allowedMore: [] };
    const u = user || currentUser;

    // قائمة السماح الصريحة للمستخدم لها الأسبقية على افتراضي الدور.
    // `null` تعني «لم تُخصَّص بعد» فيُستخدم الدور — وهذا يختلف عن مصفوفة
    // فارغة تعني «مُنع من كل شيء» عمدًا.
    const custom = Array.isArray(u?.allowedPages) ? u.allowedPages : null;

    let tabs = custom
      ? NAV_REGISTRY.filter((n) => n.id !== "more" && custom.includes(n.id) && MAIN_TAB_IDS.includes(n.id)).map((n) => n.id)
      : base.allowedTabs.filter((id) => id !== "more");
    let more = custom
      ? custom.filter((id) => !MAIN_TAB_IDS.includes(id))
      : base.allowedMore;

    // قيود الإدارة المركزية تبقى فوق الجميع وتُضيّق فقط — المدير المحلي
    // لا يستطيع منح ما منعته الإدارة.
    const override = hqPermissions?.byBranch?.[branchIdentity.code]?.[r];
    if (override) {
      tabs = tabs.filter((id) => override.allowedTabs?.includes(id));
      more = more.filter((id) => override.allowedMore?.includes(id));
    }

    // ⚠ migration 017: hqReports مسموح صلاحيةً (allowed_more/ROLES) لأي
    // مدير، لكن الخادم يرفضها فعليًا (403 not_hq_branch) لغير فرع HQ —
    // نخفيها هنا من القائمة أصلًا لغير ذلك الفرع بدل إظهار زر يفشل دومًا.
    if (!isHq) {
      more = more.filter((id) => id !== "hqReports");
    }

    return { ...base, allowedTabs: [...tabs, "more"], allowedMore: more };
  };

  const openPage = (id) => {
    // ⚠ نعدّ من أين جئت لا ما فتحت وحده: «اليومية» تُفتح من التقارير
    // ومن البحث، وخلطهما يجعل ضغطة المخزون المطوّلة تفتح اليومية.
    notePageOpen(morePage || tab, id);
    if (TAB_KIND_IDS.includes(id)) {
      setMorePage(null);
      setTab(id);
    } else {
      setMorePage(id);
    }
  };

  // -------- handlers: repairs (إصلاحات) --------
  // ── تعديل وزن قطعة عند الإصلاح ──
  // الإصلاح قد يضيف ذهبًا للقطعة (لحام، تكبير) أو ينقص منها (تقصير).
  // المُضاف يخرج من مخزون الكسر، والمُستخرَج يعود إليه — وإلا اختل ميزان
  // الذهب: وزن يظهر في المخزون بلا مصدر، أو يختفي بلا وجهة.
  // ── بيع قطعة من طقم ──
  // الطقم يدخل المخزون بوزنه الكامل. عند بيع قطعة منه يزن البائع الباقي،
  // فيُحسب وزن المباع = الكامل − الباقي. أي فرق بين ما وزنه البائع وما
  // يتوقعه النظام هالك حقيقي (برادة اللحام والتلميع) ويُسجَّل باسمه.
  const handleSellFromSet = (entry) => txn("handleSellFromSet", () => {
    const item = items.find((it) => it.id === entry.itemId);
    if (!item) return null;
    const setWeight = Number(item.weight) || 0;
    const soldWeight = Number(entry.soldWeight) || 0;
    const remaining = (entry.remainingPieces || []).map((r) => ({
      label: (r.label || "").trim() || "قطعة",
      weight: Number(r.weight) || 0,
    }));
    const remainingSum = remaining.reduce((a, r) => a + r.weight, 0);
    const variance = setWeight - soldWeight - remainingSum; // موجب = هالك
    const now = new Date().toISOString();

    // ١. القطع المتبقية تصير أصنافًا مستقلة جاهزة للطباعة
    const newItems = remaining
      .filter((r) => r.weight > 0)
      .map((r, i) => ({
        id: Date.now().toString() + "sp" + i,
        lotId: item.lotId || null,
        categoryId: item.categoryId,
        karat: item.karat,
        weight: r.weight,
        stonesWeight: 0,
        costPerGram: item.costPerGram,
        workmanship: 0,
        // حصة الأجور تُوزَّع بنسبة الوزن — القطعة الأثقل تحمل نصيبًا أكبر
        lotWorkmanshipShare:
          remainingSum > 0 ? ((Number(item.lotWorkmanshipShare) || 0) * r.weight) / setWeight : 0,
        units: [{ code: generateUnitCode(), printed: false, sold: false }],
        photoDataUrl: item.photoDataUrl || null,
        dateAdded: now,
        fromSetId: item.id,
        setPieceLabel: r.label,
        createdBy: currentUser?.name || "",
        ...dayStamp(),
      }));

    // ٢. الطقم الأصلي يُستهلك — وحدته تُعلَّم مباعة
    const updated = items.map((it) =>
      it.id === item.id
        ? { ...it, units: it.units.map((u) => (u.code === entry.unitCode ? { ...u, sold: true } : u)) }
        : it
    );
    persistItems([...newItems, ...updated]);

    // ٣. الفرق هالك
    if (Math.abs(variance) > 0.0005) {
      const adj = {
        id: Date.now().toString() + "sw",
        ref: nextRef("scrap", weightAdjustments).replace("SCR", "SET"),
        date: now,
        lotId: item.lotId || null,
        supplierId: null,
        kind: variance > 0 ? "wastage" : "surplus",
        karat: item.karat,
        weight: Math.abs(variance),
        fineWeight: Math.abs(variance) * (PURITY[item.karat] || item.karat / 24),
        costPerGram: Number(item.costPerGram) || 0,
        value: Math.abs(variance) * (Number(item.costPerGram) || 0),
        itemId: item.id,
        note: `تفكيك طقم — الكامل ${fmt(setWeight)} · مباع ${fmt(soldWeight)} · متبقٍ ${fmt(remainingSum)}`,
        createdBy: currentUser?.name || "",
        category: variance > 0 ? "gold_wastage" : "gold_weight_surplus",
        ...dayStamp(),
      };
      persistWeightAdjustments([adj, ...weightAdjustments]);
    }

    flashToast(
      Math.abs(variance) <= 0.0005
        ? `فُكّ الطقم — ${newItems.length} قطعة جاهزة للطباعة`
        : `فُكّ الطقم — ${newItems.length} قطعة · ${variance > 0 ? "هالك" : "فائض"} ${fmtW(Math.abs(variance))} جم`
    );
    return { newItems, variance };
  
  });

  // ── تحويل كسر إلى منتج جاهز ──
  // الوزن ينتقل من مخزون الكسر إلى المخزون، بتكلفة الكسر نفسها. المصنعية
  // المدفوعة للصائغ تكلفة جديدة تُضاف للقطعة — لا تُهمل، وإلا ظهرت
  // القطعة أرخص مما كلّفت فبدا ربحها أكبر.
  // ── تعديل تصنيف قطعة ──
  // التصنيف وصفي لا محاسبي، فتغييره آمن. أما الوزن والعيار والتكلفة فهي
  // أساس كل حساب لاحق — تغييرها بعد الإدخال يجعل الفواتير القديمة تشير
  // لأرقام غير التي بيعت بها، فتُقفل عمدًا.
  // ── سداد مورد ──
  // الالتزام ذو بُعدين لا يُخلطان: الذهب يُسدَّد ذهبًا والأجور نقدًا.
  // خلطهما يعني تحويلًا ضمنيًا بسعر لحظة السداد، فيظهر ربح أو خسارة
  // وهميان من فرق السعر لا من التجارة.
  //
  // مصادر الذهب ثلاثة: الكسر بأي عيار (يُحوَّل لعيار 24 قبل الخصم)،
  // أو ذهب الخزنة، أو تسكير على مكتب (التزام ينتقل للمكتب).
  // ── فرق إعادة تقييم المخزون ──
  // المخزون مُقيَّد بتكلفته، وقيمته السوقية تتحرك مع سعر الذهب. الفرق ربح
  // أو خسارة غير محققة — تُعرض ولا تُقيَّد إيرادًا حتى البيع، لأن ربحًا
  // دفتريًا لم يُقبض ليس ربحًا.
  // الفهرس الشامل — يُبنى مرة ويُستخدم في البحث والمساعد
  const appMode = appSettings?.appMode || DEFAULT_APP_MODE;

  // ⚠ الصلاحيات تُصفّى بالوضع بعد الدور.
  //
  // الدور يقول ما يستطيعه الشخص، والوضع يقول ما يفعله المحل. ومن
  // ملك صلاحية البيع في محلٍّ لا يبيع لا يجد ما يبيعه.
  const permsNow = useMemo(() => {
    const base = effectivePerms(role, currentUser);
    if (appMode === "full") return base;
    return {
      ...base,
      allowedTabs: (base.allowedTabs || []).filter((t) => modeAllowsTab(appMode, t)),
      allowedMore: (base.allowedMore || []).filter((p2) => modeAllowsPage(appMode, p2)),
    };
  }, [role, currentUser, users, hqPermissions, appMode]);

  // ── الفهرس يُبنى عند الحاجة ──
  //
  // ⚠ كان يُبنى مع كل حفظ: كل فاتورة تُعيد مسح تسعة عشر مخزنًا وبناء
  // الفهرس كاملًا، ولا أحد ينظر إليه.
  //
  // بألف قطعة يكلّف ثانيةً ونصفًا تُدفع في كل بيعة — والبائع يرى
  // الشاشة تتجمّد لحظةً بعد كل ضغطة حفظ.
  //
  // الآن يُبنى حين تُفتح شاشةٌ تحتاجه، ويُعاد بناؤه إن تغيّرت البيانات
  // وهي مفتوحة.
  const needsIndex =
    morePage === "search" || showAiSheet || showAiChat || morePage === "aiAssistant";

  const universalIndex = useMemo(
    () => (!needsIndex ? [] : buildUniversalIndex({
      sales, lots, items, scrapEntries, scrapRequests, cashTx, safeTx,
      scrapCustodyTx, goldLedger, suppliers, customers, users, receipts,
      repairs, trustGold, weightAdjustments, businessDays, taskirEntries, partners,
    })),
    [needsIndex, sales, lots, items, scrapEntries, scrapRequests, cashTx, safeTx, scrapCustodyTx,
     goldLedger, suppliers, customers, users, receipts, repairs, trustGold,
     weightAdjustments, businessDays, taskirEntries, partners]
  );

  // ⚠ الفهرس المصفّى على صلاحية المستخدم — هو وحده ما يراه المساعد.
  // تمرير الفهرس كاملًا يجعله يستشهد بسجل من صفحة مغلقة.
  const aiIndex = useMemo(
    () => scopeIndex(universalIndex, aiScope(permsNow)),
    [universalIndex, permsNow]
  );

  const revaluation = useMemo(() => {
    const price24 = priceData.current || 0;
    let costBasis = 0;
    let marketValue = 0;
    let fineWeight = 0;
    const byKarat = {};
    items.forEach((it) => {
      const q = (it.units || []).filter((u) => !u.sold).length;
      if (!q) return;
      const w = (Number(it.weight) || 0) * q;
      const purity = PURITY[it.karat] || it.karat / 24;
      const fw = w * purity;
      const cost = (Number(it.costPerGram) || 0) * w + (Number(it.lotWorkmanshipShare) || 0) * q;
      const market = fw * price24;
      costBasis += cost;
      marketValue += market;
      fineWeight += fw;
      if (!byKarat[it.karat]) byKarat[it.karat] = { weight: 0, fine: 0, cost: 0, market: 0 };
      byKarat[it.karat].weight += w;
      byKarat[it.karat].fine += fw;
      byKarat[it.karat].cost += cost;
      byKarat[it.karat].market += market;
    });
    const diff = marketValue - costBasis;
    return {
      costBasis, marketValue, fineWeight, byKarat, diff,
      diffPct: costBasis > 0 ? (diff / costBasis) * 100 : 0,
      diffGrams: price24 > 0 ? diff / price24 : 0,
      // متوسط سعر التكلفة المستنتج — يقارن بسعر السوق
      avgCostPrice24: fineWeight > 0 ? costBasis / fineWeight : 0,
      price24,
    };
  }, [items, priceData.current]);

  // ── سداد مكتب التسكير ──
  //
  // ⚖ ذهبًا بذهب أو نقدًا بسعر اليوم — والاثنان يُنقصان الالتزام
  // بمعادلهما بعيار 24. النقد يُحوَّل بسعر اليوم لأن دَينك ذهبٌ لا ريال:
  // تثبيته بالريال يجعل ارتفاع السعر يُبرئك مما لم تُبرأ منه.
  //
  // ⚠ صار نداء شبكة حقيقي — /taskir-offices/:officeId/settle (migration
  // 011) يكتب فعليًا taskir_office_tx + خروج الذهب من الخزنة (وضع gold)
  // أو cash_tx + قيد يومية settle_office_cash (وضع cash)، بمعاملة واحدة
  // على السيرفر، مقيَّد بصلاحية المدير (requireManager) لا الفرونت إند
  // وحده.
  const handleSettleOffice = async (officeId, form) => {
    const off = (taskirOffices || []).find((o) => o.id === officeId);
    if (!off) return null;

    if (form.mode === "gold") {
      const w = Number(form.weight) || 0;
      if (w <= 0) { flashToast("أدخل وزنًا"); return null; }
      try {
        await api.taskirApi.settleOffice(officeId, { mode: "gold", karat: form.karat, weight: w });
        const officeTxRes = await api.taskirApi.officeTx(officeId);
        setTaskirOfficeTx((prev) => [
          ...normalizeTaskirOfficeTx(officeTxRes.officeTx || []),
          ...prev.filter((t) => t.officeId !== officeId),
        ]);
        flashToast(`سُدّد ${fmtW(fine24(w, form.karat))} جم24 لـ${off.name}`);
        return true;
      } catch (err) {
        flashToast(apiErrorMessage(err, "تعذّر سداد المكتب"));
        return null;
      }
    }

    const amt = Number(form.amount) || 0;
    const p24 = Number(priceData.current) || 0;
    if (amt <= 0 || p24 <= 0) { flashToast("أدخل مبلغًا وسعرًا صالحًا"); return null; }
    try {
      await api.taskirApi.settleOffice(officeId, {
        mode: "cash", amount: amt, source: form.source || "safe_cash", priceAtSettle: p24,
      });
      const officeTxRes = await api.taskirApi.officeTx(officeId);
      setTaskirOfficeTx((prev) => [
        ...normalizeTaskirOfficeTx(officeTxRes.officeTx || []),
        ...prev.filter((t) => t.officeId !== officeId),
      ]);
      flashToast(`سُدّد ${fmtMoney(amt)} — يعادل ${fmtW(roundW(amt / p24))} جم24`);
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر سداد المكتب"));
      return null;
    }
  };

  const handleSettleSupplier = (entry) => txn("handleSettleSupplier", () => {
    const sup = suppliers.find((x) => x.id === entry.supplierId);
    if (!sup) return null;
    const now = new Date().toISOString();
    const actor = currentUser?.name || "";
    const goldLines = (entry.goldLines || []).filter((l) => (Number(l.weight) || 0) > 0);
    const feeAmount = Number(entry.feeAmount) || 0;
    const feeSource = entry.feeSource || "safe_cash";
    const source = entry.goldSource || "scrap"; // scrap | safe | office

    if (goldLines.length === 0 && feeAmount <= 0) {
      flashToast("حدّد ذهبًا أو أجورًا للسداد");
      return null;
    }

    const totalFine = goldLines.reduce(
      (a, l) => a + (Number(l.weight) || 0) * (PURITY[l.karat] || Number(l.karat) / 24),
      0
    );

    // ① خصم الذهب من مصدره
    const scrapAdds = [];
    const goldAdds = [];
    if (goldLines.length) {
      if (source === "scrap") {
        goldLines.forEach((l, i) => {
          scrapAdds.push({
            id: Date.now().toString() + "ss" + i,
            ref: nextRef("scrap", [...scrapEntries, ...scrapAdds]),
            date: now,
            description: `سداد ${sup.name} — كسر`,
            karat: Number(l.karat),
            weight: -(Number(l.weight) || 0),
            pricePerGram: pricePerGram(Number(l.karat), priceData.current),
            total: 0,
            status: "used_for_taskir",
            createdBy: actor,
            ...dayStamp(),
          });
        });
      } else if (source === "safe") {
        goldLines.forEach((l, i) => {
          goldAdds.push({
            id: Date.now().toString() + "sg" + i,
      ref: nextCashRef("cash", [...cashTx, ...safeTx, ...scrapCustodyTx]),
            date: now,
            type: "out",
            kind: "raw",
            karat: Number(l.karat),
            weight: Number(l.weight) || 0,
            destination: "supplier",
            destinationLabel: "سداد مورد",
            supplierId: sup.id,
            supplierName: sup.name,
            note: `سداد ${sup.name}`,
            createdBy: actor,
            ...dayStamp(),
          });
        });
      }
      // ⚠ سداد عبر مكتب: لا ذهب يخرج من خزنتك، لكن التزامك ينتقل
      // من المورد إلى المكتب — يُقيَّد في ④ أدناه بعيار 24.
    }

    // ② التسوية تُنقص التزام المورد
    const settlements = goldLines.map((l, i) => ({
      id: Date.now().toString() + "st" + i,
      ref: nextRef("taskir", [...taskirEntries]),
      date: now,
      supplierId: sup.id,
      officeId: source === "office" ? entry.officeId || null : null,
      goldSource: source === "scrap" ? "scrap" : source === "safe" ? "safe_raw" : "office",
      karat: Number(l.karat),
      weight: Number(l.weight) || 0,
      goldCost: 0,
      // الأجور تُقيَّد على أول سطر فقط حتى لا تُخصم مرة لكل عيار
      workmanshipAmount: i === 0 ? feeAmount : 0,
      totalCashPaid: 0,
      note: `سداد ${sup.name} — ${source === "scrap" ? "كسر" : source === "safe" ? "ذهب الخزنة" : "تسكير مكتب"}`,
      createdBy: actor,
      ...dayStamp(),
    }));
    // سداد أجور فقط بلا ذهب
    if (!settlements.length && feeAmount > 0) {
      settlements.push({
        id: Date.now().toString() + "stf",
        ref: nextRef("taskir", taskirEntries),
        date: now,
        supplierId: sup.id,
        officeId: null,
        goldSource: "fees_only",
        karat: 24,
        weight: 0,
        goldCost: 0,
        workmanshipAmount: feeAmount,
        totalCashPaid: 0,
        note: `سداد أجور ${sup.name}`,
        createdBy: actor,
        ...dayStamp(),
      });
    }

    // ③ الأجور نقدًا دائمًا
    if (feeAmount > 0) {
      deductFromSource(feeSource, feeAmount, `سداد أجور ${sup.name}`, "supplier_settle", sup.id, "gold_workmanship");
    }

    // ④ التزام المكتب حين يسلّم نيابةً
    if (source === "office" && entry.officeId && totalFine > 0) {
      persistTaskirOfficeTx([
        {
          id: Date.now().toString() + "ot",
          ref: nextRef("officeSettle", taskirOfficeTx),
          date: now,
          officeId: entry.officeId,
          type: "debit",
          // ⚖ الالتزام للمكتب بعيار 24 دائمًا: المكاتب تتعامل بالصافي
          // لا بالعيار. تركه بعياره يعني رصيدًا لا يُقارن برصيد المكتب
          // وخلافًا عند التصفية.
          weight: roundW(totalFine),
          karat: 24,
          amount: roundMoney2(totalFine * (priceData.current || 0)),
          // العيارات الأصلية محفوظة للمراجعة
          rawLines: goldLines.map((l) => ({
            karat: Number(l.karat),
            weight: Number(l.weight) || 0,
            fine: fine24(l.weight, l.karat),
          })),
          supplierId: sup.id,
          supplierName: sup.name,
          note: `تسكير لصالح ${sup.name} — ${fmtW(totalFine)} جم24`,
          createdBy: actor,
          ...dayStamp(),
        },
        ...taskirOfficeTx,
      ]);
    }

    // قيد وزني بحسب مصدر الذهب
    if (goldLines.length && source !== "office") {
      postWeight(source === "scrap" ? "settle_scrap" : "settle_safe_gold",
        goldLines.map((l) => ({ karat: Number(l.karat), weight: Number(l.weight) || 0,
          refId: sup.id, note: `سداد ${sup.name}` })));
    }

    // كتابة واحدة لكل مخزن
    if (scrapAdds.length) persistScrap([...scrapAdds, ...scrapEntries]);
    if (goldAdds.length) persistSafeGoldTx([...goldAdds, ...safeGoldTx]);
    if (settlements.length) persistTaskir([...settlements, ...taskirEntries]);

    const parts = [];
    if (totalFine > 0) parts.push(`${fmtW(totalFine)} جم عيار 24`);
    if (feeAmount > 0) parts.push(`${fmt(feeAmount, 0)} أجور`);
    flashToast(`سُدّد لـ${sup.name}: ${parts.join(" · ")}`);
    return { totalFine, feeAmount };
  
  });

  // ── قفل الجرد ──
  const handleSavePrinter = (next) => {
    persist(PRINTER_KEY, next, setPrinterCfg);
    flashToast("حُفظت إعدادات الطابعة");
  };

  // ⚠ محلي بحتٌ مثل الطابعة تمامًا: كل متصفح/جهاز يقترن بقارئه الفعلي
  // بنفسه (deviceId من bluetooth.requestDevice لا ينتقل بين الأجهزة)،
  // فلا معنى لمزامنة "جهاز مقترن" أو طاقة الإرسال عبر السيرفر — الفرق
  // عن appSettings (الضريبة/الرسوم) أن تلك تُفرض فعليًا على كل عملية
  // بيع من الباك إند، وهذه إعداد تشغيل جهاز لا قاعدة عمل.
  const handleSaveRfid = (next) => {
    persist(RFID_KEY, next, setRfidCfg);
    flashToast("حُفظت إعدادات القارئ");
  };

  // ⚠ الربط نفسه (item_units.epc) بيانات مخزون حقيقية مشتركة بين كل
  // المستخدمين — بعكس رفيدCfg. لهذا يُكتب على السيرفر (api.rfid.bind)
  // لا محليًا فقط، فيظهر لأي مستخدم آخر بعد أي تحديث/دخول جديد.
  const handleBindEpc = async (unitId, epc) => {
    try {
      const res = await api.rfid.bind(unitId, epc);
      persistItems(items.map((it) => ({
        ...it,
        units: (it.units || []).map((u) =>
          u.id === unitId ? { ...u, epc: res.unit.epc, epcBoundAt: res.unit.epc_bound_at } : u
        ),
      })));
      flashToast(`رُبطت البطاقة بـ${res.unit.code}`);
      return res.unit;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر ربط البطاقة"));
      return null;
    }
  };

  const handleUnbindEpc = async (unitId) => {
    try {
      const res = await api.rfid.unbind(unitId);
      persistItems(items.map((it) => ({
        ...it,
        units: (it.units || []).map((u) =>
          u.id === unitId ? { ...u, epc: null, epcBoundAt: null } : u
        ),
      })));
      flashToast(`فُكّت البطاقة عن ${res.unit.code}`);
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر فكّ البطاقة"));
      return null;
    }
  };

  // ── الأصول الثابتة والإهلاك (migration 015) ──
  //
  // fixedAssets/depreciations هما نفس الحالة المحلية المُحمَّلة الآن من
  // الباك إند الفعلي (loadBootstrap) — كل الثلاثة تُحدَّث بنمط optimistic
  // من استجابة كل نداء مباشرةً، بلا إعادة تحميل bootstrap كاملةً، تمامًا
  // كـhandleAddExpense/handleBindEpc.

  const handleAddFixedAsset = async (payload) => {
    try {
      const res = await api.fixedAssetsApi.create(payload);
      const asset = normalizeFixedAssets([res.asset])[0];
      setFixedAssets((prev) => [asset, ...prev]);
      flashToast(`سُجِّل الأصل — ${asset.ref}`);
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تسجيل الأصل"));
      return false;
    }
  };

  const handleRunDepreciation = async (period) => {
    try {
      const res = await api.fixedAssetsApi.runDepreciation(period);
      if (!res.details?.length) {
        flashToast("لا إهلاك مستحقّ لهذا الشهر");
        return true;
      }
      const rows = res.details.map((d) => ({
        id: `${d.assetId}-${period}`, asset_id: d.assetId, period: `${period}-01`,
        amount: d.amount, posted: true, journal_entry_id: res.entry?.id || null,
      }));
      setDepreciations((prev) => [...prev, ...normalizeDepreciationSchedule(rows)]);
      flashToast(`سُجِّل إهلاك ${period} — ${res.details.length} أصل`);
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تسجيل الإهلاك"));
      return false;
    }
  };

  const handleDisposeFixedAsset = async ({ assetId, ...payload }) => {
    try {
      const res = await api.fixedAssetsApi.dispose(assetId, payload);
      const updated = normalizeFixedAssets([res.asset])[0];
      setFixedAssets((prev) => prev.map((a) => (a.id === assetId ? updated : a)));
      flashToast(`اُستُبعِد الأصل — ${updated.name}`);
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر استبعاد الأصل"));
      return false;
    }
  };

  // ⚠ صار نداء شبكة حقيقي — القفل يُفرض فعليًا في sales.routes.js/
  // scrap.routes.js على كل عملية بيع/كسر، فتغييره محليًا فقط (كسابقًا)
  // كان يعني أن القفل من الشاشة لا يوقف شيئًا فعليًا على السيرفر. الحقل
  // scope محلي بحت (لا يقرؤه أي guard سيرفري ولا حتى stocktakeLock نفسه
  // لاحقًا — يظهر فقط في تسمية سجل جرد مكتمل)، فيبقى محفوظًا محليًا كما
  // كان دون إرساله للباك إند.
  const handleToggleStocktakeLock = async (on, scope) => {
    try {
      const res = await api.settingsApi.setStocktakeLock(on);
      if (res.stocktakeLock.locked) {
        setStocktakeLock({
          id: Date.now().toString() + "lk",
          startedAt: res.stocktakeLock.locked_at,
          startedBy: currentUser?.name || "",
          startedById: res.stocktakeLock.locked_by,
          scope: scope || "all",
          ...dayStamp(),
        });
        flashToast("قُفل المخزون — البيع والتحويل موقوفان أثناء الجرد");
      } else {
        setStocktakeLock(null);
        flashToast("فُتح القفل — استُؤنف البيع");
      }
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, on ? "تعذّر قفل الجرد" : "تعذّر فتح القفل"));
      return null;
    }
  };

  const handleChangeItemCategory = (itemId, newCategoryId, note) => {
    const item = items.find((it) => it.id === itemId);
    if (!item || !newCategoryId || newCategoryId === item.categoryId) return null;
    const now = new Date().toISOString();
    const entry = {
      at: now,
      by: currentUser?.name || "",
      byId: currentUser?.id || null,
      from: item.categoryId,
      to: newCategoryId,
      note: (note || "").trim(),
    };
    persistItems(
      items.map((it) =>
        it.id === itemId
          ? { ...it, categoryId: newCategoryId, categoryHistory: [entry, ...(it.categoryHistory || [])] }
          : it
      )
    );
    flashToast(`غُيّر التصنيف: ${categoryLabel(item.categoryId)} ← ${categoryLabel(newCategoryId)}`);
    return entry;
  };

  // ── ① الفرع يرسل الكسر للإدارة ──
  // ── القيد الوزني ──
  //
  // كل عملية تحرّك ذهبًا تستدعي هذه. الدفتر يُبنى من القيود لا يُشتق من
  // المستندات، فيصير للوزن سجل مستقل يُراجَع كدفتر النقد تمامًا.
  //
  // الكتابة دفعة واحدة: قيد الخروج والدخول معًا أو لا شيء. كتابتهما
  // بنداءين تترك طرفًا يتيمًا إن انقطع بينهما.
  // ── إنشاء اختصار بالطلب ──
  const handleMakeShortcut = (text) => {
    const hit = parseShortcutRequest(text, aiScope(permsNow));
    if (!hit) {
      flashToast("لم أفهم أي صفحة تريد — سمّها بوضوح");
      return null;
    }
    if (shortcuts.some((x) => x.pageId === hit.pageId)) {
      flashToast(`«${hit.label}» موجود في اختصاراتك`);
      return hit;
    }
    const next = [
      { id: Date.now().toString() + "sc", pageId: hit.pageId, label: hit.label,
        askedFor: String(text).slice(0, 60), createdAt: new Date().toISOString() },
      ...shortcuts,
    ].slice(0, 12); // ⚠ سقف: اثنا عشر اختصارًا يُمسح بنظرة، وأكثر يصير قائمة أخرى
    persist(SHORTCUTS_KEY, next, setShortcuts);
    flashToast(`جُهّز زر «${hit.label}»`);
    return hit;
  };

  const handleRemoveShortcut = (id) =>
    persist(SHORTCUTS_KEY, shortcuts.filter((x) => x.id !== id), setShortcuts);

  // ── ترحيل قيد مزدوج ──
  //
  // ⚠ القيد المُرحَّل لا يُعدَّل ولا يُحذف: `postJournal` تُضيف فقط،
  // و`reverseJournal` تُلغي بقيدٍ مقابل. لا دالة تُعدّل قيدًا قائمًا —
  // وغيابها مقصود لا نسيان.
  // ── كتابة السجل ──
  //
  // ⚠ تُضيف فقط: لا دالة تُعدّل سجلًا ولا تحذفه، وغيابها مقصود.
  // ونمرّر آخر قيد لتُبنى البصمة عليه — السلسلة تنكسر إن كُتب سجلٌ
  // على غير سابقه.
  const audit = (event, info = {}) => {
    try {
      const prev = auditLog[0] || null;
      const entry = buildAuditEntry(
        {
          ...info,
          event,
          actor: currentUser?.name || info.actor || "",
          actorId: currentUser?.id || null,
          role: role || null,
        },
        prev
      );
      persist(AUDIT_LOG_KEY, [entry, ...auditLog], setAuditLog);
      return entry;
    } catch (e) {
      // ⚠ فشل السجل لا يُوقف العملية: تعطيل البيع لأن سجله لم يُكتب
      // يوقف المحل. نُسجّل الفشل في السجل التقني ونمضي.
      console.error("[أونصة] تعذّرت كتابة السجل:", event, e);
      return null;
    }
  };

  // ══════════════════════════════════════════════════════════════
  //  معاملة ذرّية
  //
  //  ⚠ سبعةٌ وعشرون معالجًا يكتب في مخزنين أو أكثر. وأي كسرٍ بينها
  //  يترك **نصف عملية**: مالٌ خرج بلا مستند، أو مستندٌ بلا مال.
  //
  //  ولا معاملة في التخزين المحلي، فنُحاكيها: نلتقط ما سنمسّه، ثم
  //  نكتب، ثم نستعيد اللقطة إن انكسر شيء.
  //
  //  والاستعادة تشمل الحالة في الذاكرة والمخزن معًا — إعادة أحدهما
  //  دون الآخر تُبقي الشاشة تعرض ما لا يوجد.
  // ══════════════════════════════════════════════════════════════
  const txn = (label, fn) => {
    const snap = {
      [CASH_KEY]: [cashTx, setCashTx],
      [SAFE_KEY]: [safeTx, setSafeTx],
      [SALES_KEY]: [sales, setSales],
      [SCRAP_KEY]: [scrapEntries, setScrapEntries],
      [LOTS_KEY]: [lots, setLots],
      [ITEMS_KEY]: [items, setItems],
      [JOURNAL_KEY]: [journal, setJournal],
      [EXPENSES_KEY]: [expenses, setExpenses],
      [RETURNS_KEY]: [returns, setReturns],
      [SAFE_GOLD_KEY]: [safeGoldTx, setSafeGoldTx],
      [SCRAP_CUSTODY_KEY]: [scrapCustodyTx, setScrapCustodyTx],
      [WEIGHT_ADJ_KEY]: [weightAdjustments, setWeightAdjustments],
    };
    const before = Object.fromEntries(
      Object.entries(snap).map(([k, [v]]) => [k, v])
    );
    try {
      return fn();
    } catch (e) {
      console.error("[أونصة] تراجع عن", label, e);
      Object.entries(snap).forEach(([k, [, setter]]) => {
        persist(k, before[k], setter);
      });
      audit("update", {
        entity: "transaction", entityRef: label,
        note: `تراجع: ${String(e?.message || e).slice(0, 80)}`,
      });
      flashToast(`تعذّرت العملية — أُعيد كل شيء كما كان`);
      return null;
    }
  };

  // ── أفعال الكيانات ──
  //
  // ⚠ مُعلَنة في مكان واحد: تكرارها في كل شاشة يجعل «طباعة» تعمل هنا
  // ولا تعمل هناك، ولا أحد يعرف لماذا.
  //
  // وكلٌّ يفحص صلاحيته بنفسه: إخفاء الزرّ في الشاشة لا يمنع من يصل
  // إليه بطريق آخر.


  /// نعدّ ما يُفتح من كل تبويب.
  ///
  /// ⚠ العدّ في الإعدادات لا في مخزن جديد: مخزنٌ لكل عدّاد يُضاعف
  /// المخازن بلا فائدة، والإعدادات تُنسخ مع النسخة الاحتياطية.
  const notePageOpen = (fromTab, pageId) => {
    if (!fromTab || !pageId || fromTab === pageId) return;
    const stats = { ...(appSettings.pageOpens || {}) };
    const scope = { ...(stats[fromTab] || {}) };
    scope[pageId] = (scope[pageId] || 0) + 1;
    stats[fromTab] = scope;
    persistSettings({ ...appSettings, pageOpens: stats });
  };

  /// ترتيب أزرار الشريط بالسحب.
  ///
  /// ⚠ اضغط زرًّا مطوّلًا ستّ أعشار الثانية ثم اسحبه فوق آخر — يتبادلان.
  ///
  /// وستّ أعشار لا أربع: الشريط يُلمس عشرات المرات يوميًا، ومدةٌ قصيرة
  /// تُطلق الترتيب بالخطأ فيجد المستخدم أزراره تبدّلت بلا سبب.
  const [dragNav, setDragNav] = useState(null);   // { id, row }

  const startNavDrag = (id, row) => setDragNav({ id, row });

  const overNavDrag = (overId, row) => {
    if (!dragNav || dragNav.id === overId || dragNav.row !== row) return;
    const layout = normalizeRoleLayout(navLayout?.[role], navPerRow(vp.size)) || DEFAULT_NAV_LAYOUT[role];
    const list = [...(layout?.[row] || [])];
    const from = list.indexOf(dragNav.id);
    const to = list.indexOf(overId);
    if (from < 0 || to < 0) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    // ⚠ يُحفظ فورًا لا عند الإفلات: من يسحب ثم يُغلق التطبيق قبل أن
    // يرفع إصبعه يجد ترتيبه القديم — ولا يفهم لماذا ضاع.
    persist(NAV_LAYOUT_KEY,
      { ...navLayout, [role]: { ...layout, [row]: list }, _navVersion: 2 },
      setNavLayout);
  };

  const endNavDrag = () => {
    if (!dragNav) return;
    setDragNav(null);
    flashToast("حُفظ الترتيب");
    audit("settings", { entity: "navLayout",
      note: `ترتيب شريط ${ROLES[role]?.label || role}` });
  };



  /// تعديل مباشر لحقل واحد في سجل.
  ///
  /// ⚠ يُسجَّل في سجل التدقيق كأي تعديل: التعديل المباشر أسرع، وسرعته
  /// تجعله أكثر وقوعًا — فيحتاج الأثر أكثر لا أقلّ.
  const canEditRecords = role === "manager" || role === "assistant";

  const editRecord = (storeKey, setter, list, id, field, value) => {
    if (!canEditRecords) { flashToast("خارج صلاحيتك"); return; }
    const before = list.find((r) => r.id === id);
    if (!before) return;
    const clean = typeof value === "string" ? value.trim() : value;
    if (String(before[field] ?? "") === String(clean ?? "")) return;
    persist(storeKey, list.map((r) => (r.id === id ? { ...r, [field]: clean } : r)), setter);
    audit("update", {
      entity: storeKey, entityId: id, entityRef: before.ref || before.name,
      before: { [field]: before[field] }, after: { [field]: clean },
      note: "تعديل مباشر",
    });
  };

  /// سند استلام أو تسليم — PDF يُشارَك.
  ///
  /// ⚠ الأمانة بلا سند كلامٌ بين اثنين.
  ///
  /// من أودع عشرين جرامًا يريد ورقةً تُثبت ما أودع ومتى وبأيّ عيار.
  /// وحين يعود بعد شهر ويقول «كانت خمسة وعشرين» فالسند هو الفصل —
  /// لا الذاكرة ولا حسن الظن.
  ///
  /// ويُصدَّر PDF لا صورة: الصورة تُقصّ وتُعدَّل، والـPDF يحمل ترويسة
  /// المحل ومرجعه وتاريخه في نصّ يُقرأ ويُبحث فيه.
  const trustReceiptPdf = (holder, row, bal) => {
    if (!holder || !row) return false;
    const C = priceData.currency;
    const isIn = row.cashDir === "in" || row.goldDir === "in";
    const lines = [];
    if (row.weight > 0) {
      lines.push([
        "ذهب", `${fmtW(row.weight)} جم`, `عيار ${row.karat}`,
        `${fmtW(fine24(row.weight, row.karat))} جم24`,
      ]);
    }
    if (row.amount > 0) {
      lines.push(["نقد", `${C}${fmtMoney(row.amount)}`, "—", "—"]);
    }
    const ok = exportTablesPdf({
      title: `سند ${row.moveLabel}`,
      subtitle: `${holder.name} · ${holder.ref}${holder.phone ? " · " + holder.phone : ""}`,
      branchName: branchIdentity?.name || appSettings?.storeName || "",
      sign: true,
      onBlocked: flashToast,
      sections: [
        {
          title: "الحركة",
          head: ["البند", "المقدار", "العيار", "المعادل"],
          rows: lines,
        },
        {
          title: "الرصيد بعد الحركة",
          head: ["البند", "الرصيد"],
          rows: [
            ["نقد", `${C}${fmtMoney(bal?.cash || 0)}`],
            ["ذهب بمعادل 24", `${fmtW(bal?.fine || 0)} جم`],
            ...Object.entries(bal?.byKarat || {})
              .filter(([, w]) => Math.abs(w) > 0.0005)
              .map(([k, w]) => [`عيار ${k}`, `${fmtW(w)} جم`]),
          ],
        },
        {
          title: "بيانات السند",
          head: ["البند", "القيمة"],
          rows: [
            ["المرجع", row.ref || "—"],
            ["التاريخ", new Date(row.date).toLocaleString("en-GB")],
            ["النوع", isIn ? "استلام من العميل" : "تسليم للعميل"],
            ["سعر الجرام 24", `${C}${fmtMoney(row.price24 || 0)}`],
            ["حرّره", row.createdBy || "—"],
            ["ملاحظة", row.note || "—"],
          ],
        },
      ],
    });
    if (ok) {
      audit("print", { entity: "trustLedger", entityId: row.id, entityRef: row.ref,
        note: `سند ${row.moveLabel} — ${holder.name}` });
    }
    return ok;
  };

  /// مشاركة السند عبر واتساب.
  ///
  /// ⚠ لا يُرسل الملف نفسه — المتصفح لا يملك ذلك.
  ///
  /// يفتح المحادثة برسالةٍ فيها المرجع والمقدار والرصيد، ويُطبع الـPDF
  /// ليُرفق يدويًا. وادّعاء إرسالٍ لا يقع أسوأ من عدم عرضه.
  const shareTrustReceipt = (holder, row, bal) => {
    const C = priceData.currency;
    const parts = [
      `*${branchIdentity?.name || "أوقية"}*`,
      `سند ${row.moveLabel}`,
      `المرجع: ${row.ref}`,
      `التاريخ: ${new Date(row.date).toLocaleString("en-GB")}`,
      "",
      row.weight > 0 ? `الذهب: ${fmtW(row.weight)} جم عيار ${row.karat}` : null,
      row.amount > 0 ? `المبلغ: ${C}${fmtMoney(row.amount)}` : null,
      "",
      "*الرصيد بعد الحركة*",
      `نقد: ${C}${fmtMoney(bal?.cash || 0)}`,
      `ذهب: ${fmtW(bal?.fine || 0)} جم بمعادل 24`,
    ].filter(Boolean);
    const text = encodeURIComponent(parts.join("\n"));
    // ⚠ الرقم بلا صفرٍ ولا رموز: واتساب يريده بصيغة دولية خالصة
    const raw = String(holder.phone || "").replace(/\D/g, "");
    const intl = raw.startsWith("966") ? raw
      : raw.startsWith("0") ? "966" + raw.slice(1)
      : raw.length === 9 ? "966" + raw : raw;
    const url = intl
      ? `https://wa.me/${intl}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
    audit("print", { entity: "trustLedger", entityId: row.id, entityRef: row.ref,
      note: `مشاركة سند — ${holder.name}` });
  };

  const persistTrustAccounts = (next) => persist(TRUST_ACCOUNTS_KEY, next, setTrustAccounts);
  const persistTrustLedger = (next) => persist(TRUST_LEDGER_KEY, next, setTrustLedger);

  /// فتح حسابٍ جارٍ لعميل.
  ///
  /// ⚠ منفصل عن قائمة العملاء العادية.
  ///
  /// من له حسابٌ جارٍ ليس زبونًا يشتري ويمضي — بينكما رصيدٌ قائم
  /// وميزان. وخلطه بمن اشترى مرةً يُضيّعه في قائمةٍ من مئات، ويجعل
  /// كشف حسابه يختلط بفواتير غيره.
  const handleAddTrustHolder = ({ name, phone, note }) => txn("addTrustHolder", () => {
    const clean = String(name || "").trim();
    if (!clean) { flashToast("اكتب الاسم"); return null; }
    // ⚠ اسمٌ مكرر يعني حسابين لشخصٍ واحد.
    //
    // يودع في أحدهما ويسحب من الآخر فيجد رصيده صفرًا، أو يسحب مرتين
    // مما أودعه مرة. والمقارنة بالمُطبَّع لا بالنصّ: «أحمد» و«احمد»
    // شخصٌ واحد وإن اختلف الحرف.
    const dup = trustAccounts.find(
      (h) => normalizeName(h.name) === normalizeName(clean));
    if (dup) {
      flashToast(`«${dup.name}» له حساب سلفًا — ${dup.ref}`);
      return null;
    }
    const rec = {
      id: Date.now().toString() + "th",
      ref: nextRef("trustHolder", trustAccounts),
      name: clean, phone: String(phone || "").trim(), note: String(note || "").trim(),
      openedAt: new Date().toISOString(),
      openedBy: currentUser?.name || "",
    };
    persistTrustAccounts([rec, ...trustAccounts]);
    audit("create", { entity: "trustAccounts", entityId: rec.id, entityRef: rec.ref,
      after: { name: clean }, note: "فتح حساب جارٍ" });
    flashToast(`فُتح حساب ${clean}`);
    return rec;
  });

  /// حركة على حسابٍ جارٍ.
  ///
  /// ⚠ التزامٌ لا إيراد.
  ///
  /// ما يودعه العميل ليس مالك ولا ذهبك. قيدُه إيرادًا يُظهر ربحًا لم
  /// يقع، ويُدفع عليه زكاةً ليست عليك، وحين يسحبه تظهر خسارةٌ لم
  /// تخسرها.
  const handleTrustMove = ({ holderId, move, amount, weight, karat, note }) =>
    txn("trustMove", () => {
      const def = TRUST_MOVES.find((m) => m.id === move);
      const holder = trustAccounts.find((h) => h.id === holderId);
      if (!def || !holder) { flashToast("بيانات ناقصة"); return null; }
      if (!openDay) { flashToast("افتح يوم العمل أولًا"); return null; }

      const amt = Number(amount) || 0;
      const w = roundW(Number(weight) || 0);
      const k = Number(karat) || 21;
      const price = Number(priceData.current) || 0;
      const bal = trustBalance(trustLedger, holderId);

      // ⚠ لا سحب فوق الرصيد: البنك لا يُقرض من حسابٍ فارغ، وأنت كذلك.
      if (def.id === "withdraw_cash" && amt > bal.cash + 0.005) {
        flashToast(`رصيده ${priceData.currency}${fmtMoney(bal.cash)} — لا يكفي`);
        return null;
      }
      if (def.id === "withdraw_gold" && fine24(w, k) > bal.fine + 0.0005) {
        flashToast(`رصيده ${fmtW(bal.fine)} جم24 — لا يكفي`);
        return null;
      }

      const now = new Date().toISOString();
      const row = {
        id: Date.now().toString() + "tl",
        ref: nextRef("trustMove", trustLedger),
        date: now, holderId, holderName: holder.name,
        move: def.id, moveLabel: def.label, dir: def.dir, unit: def.unit,
        amount: 0, weight: 0, karat: k,
        price24: price, note: String(note || "").trim(),
        createdBy: currentUser?.name || "", ...dayStamp(),
      };

      if (def.id === "deposit_cash") { row.amount = amt; row.cashDir = "in"; }
      if (def.id === "withdraw_cash") { row.amount = amt; row.cashDir = "out"; }
      if (def.id === "deposit_gold") { row.weight = w; row.goldDir = "in"; }
      if (def.id === "withdraw_gold") { row.weight = w; row.goldDir = "out"; }

      // ⚠ الشراء والبيع بسعر اليوم المُثبَّت في السطر.
      //
      // بلا تثبيته يُعاد حساب الكشف بسعر الغد، فيتغيّر ما جرى أمس —
      // والعميل يرى رصيدًا غير الذي أُبلغ به.
      if (def.id === "buy_gold") {
        const cost = fromHalalas(Math.round(fine24(w, k) * price * 100));
        if (cost > bal.cash + 0.005) {
          flashToast(`رصيده ${priceData.currency}${fmtMoney(bal.cash)} — لا يكفي لـ${fmtW(w)} جم`);
          return null;
        }
        row.amount = cost; row.cashDir = "out";
        row.weight = w; row.goldDir = "in";
      }
      if (def.id === "sell_gold") {
        if (fine24(w, k) > bal.fine + 0.0005) {
          flashToast(`رصيده ${fmtW(bal.fine)} جم24 — لا يكفي`);
          return null;
        }
        row.amount = fromHalalas(Math.round(fine24(w, k) * price * 100));
        row.cashDir = "in";
        row.weight = w; row.goldDir = "out";
      }

      persistTrustLedger([row, ...trustLedger]);

      // ── الأثر على خزنتك ──
      //
      // ⚠ الإيداع يزيد ما بين يديك **والتزامك معًا**: المال في خزنتك
      // والدَّين عليك. من ينظر للخزنة وحدها يظنّ نفسه أغنى.
      if (row.cashDir === "in") {
        addToSource("daily_cash", row.amount,
          `أمانة نقدية — ${holder.name}`, "trust", row.id, "customer_deposit");
      }
      if (row.cashDir === "out") {
        deductFromSource("daily_cash", row.amount,
          `سحب أمانة — ${holder.name}`, "trust", row.id, "customer_deposit_refund");
      }
      if (row.goldDir) {
        postWeight(row.goldDir === "in" ? "trust_in" : "trust_out",
          [{ karat: k, weight: w, refId: row.id, note: `أمانة — ${holder.name}` }]);
      }

      audit("create", { entity: "trustLedger", entityId: row.id, entityRef: row.ref,
        after: { holder: holder.name, move: def.label, amount: row.amount, weight: row.weight },
        note: `حساب جارٍ — ${def.label}` });
      flashToast(`${def.label} · ${holder.name}`);
      return row;
    });

  const entityActionsFor = (kind, r) => {
    const mgr = role === "manager" || role === "assistant";
    if (kind === "item") {
      const avail = (r.units || []).filter((u) => !u.sold && !u.issued).length;
      return [
        { id: "sell", label: "بيع هذه القطعة", icon: ShoppingCart,
          hint: avail ? `${avail} متاح` : "لا وحدات متاحة",
          disabled: !avail || !openDay },
        { id: "edit", label: "تعديل البيانات", icon: Wrench, disabled: !mgr },
        { id: "print", label: "طباعة الملصق", icon: Printer },
        { id: "issue", label: "إخراج من النظام", icon: PackageMinus,
          tone: "bad", hint: "بسبب مُعلَن — لا حذف", disabled: !mgr || !avail },
        { id: "trace", label: "تتبّع للمصدر", icon: Search,
          hint: "الدفعة والمورد وتاريخ الدخول" },
      ];
    }
    if (kind === "customer") {
      return [
        { id: "sell", label: "فاتورة له", icon: Receipt, disabled: !openDay },
        { id: "receipt", label: "سند قبض", icon: Banknote, disabled: !openDay },
        { id: "statement", label: "كشف حساب PDF", icon: FileText },
        { id: "edit", label: "تعديل البيانات", icon: Wrench, disabled: !mgr },
      ];
    }
    if (kind === "supplier") {
      return [
        { id: "purchase", label: "شراء منه", icon: Truck, disabled: !mgr || !openDay },
        { id: "settle", label: "سداد", icon: Handshake, disabled: !mgr },
        { id: "statement", label: "كشف حساب PDF", icon: FileText },
        { id: "edit", label: "تعديل البيانات", icon: Wrench, disabled: !mgr },
      ];
    }
    if (kind === "sale") {
      return [
        { id: "print", label: "إعادة الطباعة", icon: Printer },
        { id: "return", label: "استرجاع", icon: RotateCcw, tone: "bad",
          hint: "بسطر أو بالفاتورة كاملة" },
        { id: "trace", label: "تتبّع الأسطر", icon: Search },
      ];
    }
    if (kind === "scrap") {
      const st = stageOf(r);
      return [
        { id: "break", label: "تكسير وتثبيت الوزن", icon: Scale,
          disabled: !mgr || st !== "pending_break" },
        { id: "convert", label: "إدخال للمخزون", icon: Package,
          disabled: !mgr || st !== "in_safe",
          hint: st !== "in_safe" ? "يحتاج التصفية أولًا" : null },
        { id: "trace", label: "تتبّع", icon: Search },
      ];
    }
    return [];
  };

  /// صفوف العرض لكل تبويب.
  const entityRowsFor = (kind, r, tab) => {
    const C = priceData.currency;
    if (kind === "item" && tab === "info") {
      const units = r.units || [];
      return [
        { label: "المرجع", value: r.ref || "—" },
        { label: "التصنيف", value: categoryLabel(r.categoryId ?? r.category) },
        { label: "العيار", value: r.karat },
        { label: "الوزن", value: `${fmtW(r.weight)} جم` },
        { label: "بعيار 24", value: `${fmtW(fine24(r.weight, r.karat))} جم` },
        { label: "الوحدات", value: `${units.filter((u) => !u.sold && !u.issued).length} من ${units.length}` },
        { label: "التكلفة/جم", value: `${C}${fmtMoney(r.costPerGram || 0)}` },
        { label: "قيمة اليوم", value: `${C}${fmtMoney(fine24(r.weight, r.karat) * (priceData.current || 0))}`,
          tone: "accent" },
      ];
    }
    if (kind === "item" && tab === "moves") {
      const sold = (r.units || []).filter((u) => u.sold).length;
      const issued = (r.units || []).filter((u) => u.issued).length;
      return [
        { label: "أُدخلت", value: r.dateAdded ? new Date(r.dateAdded).toLocaleDateString("en-GB") : "—" },
        { label: "مبيعة", value: sold || "—" },
        { label: "مُخرجة", value: issued || "—" },
        { label: "من كسر", value: r.fromScrap ? "نعم" : "لا" },
        { label: "أضافها", value: r.createdBy || "—" },
      ];
    }
    if ((kind === "customer" || kind === "supplier") && tab === "info") {
      return [
        { label: "المرجع", value: r.ref || "—" },
        { label: "الجوال", value: r.phone || "—" },
        { label: "ملاحظة", value: r.note || "—" },
      ];
    }
    if (kind === "sale" && tab === "info") {
      return [
        { label: "التاريخ", value: new Date(r.date).toLocaleString("en-GB") },
        { label: "العميل", value: r.customerName || "نقدي" },
        { label: "الأسطر", value: (r.lines || []).length },
        { label: "الصافي", value: `${C}${fmtMoney((r.total || 0) - (r.taxAmount || 0))}` },
        { label: "الضريبة", value: `${C}${fmtMoney(r.taxAmount || 0)}` },
        { label: "الإجمالي", value: `${C}${fmtMoney(r.total)}`, tone: "accent" },
        { label: "الدفع", value: METHOD_LABELS?.[r.paymentMethod] || r.paymentMethod || "—" },
        { label: "البائع", value: r.sellerName || r.createdBy || "—" },
      ];
    }
    if (kind === "scrap" && tab === "info") {
      return [
        { label: "المرجع", value: r.ref || "—" },
        { label: "العيار", value: r.karat },
        { label: "القائم", value: `${fmtW(r.grossWeight || r.weight)} جم` },
        { label: "المعتمد", value: `${fmtW(r.weight)} جم` },
        { label: "المرحلة", value: SCRAP_STAGES[stageOf(r)]?.label || "—" },
        { label: "القيمة", value: `${C}${fmtMoney(r.total || 0)}` },
      ];
    }
    return [];
  };

  /// تنفيذ الفعل — نقطةٌ واحدة لكل الكيانات.
  const runEntityAction = (actionId, r, kind) => {
    const go = (page) => { setSheetEntity(null); openPage(page); };
    if (actionId === "edit") return go(kind === "item" ? "itemEdit"
      : kind === "customer" ? "customers" : "suppliers");
    if (actionId === "issue") return go("goldOut");
    if (actionId === "trace") return go("search");
    if (actionId === "statement") return go(kind === "supplier" ? "supplierLedger" : "customers");
    if (actionId === "return") return go("salesReturn");
    if (actionId === "print") return go(kind === "sale" ? "printing" : "printerSetup");
    if (actionId === "break" || actionId === "convert") return go("scrapCustody");
    if (actionId === "purchase") return go("purchases");
    if (actionId === "settle") return go("supplierLedger");
    if (actionId === "receipt") return go("customers");
    if (actionId === "sell") {
      setSheetEntity(null);
      setTab("sales");
      return;
    }
    setSheetEntity(null);
  };

  const postJournal = (opType, amount, opts = {}) => {
    const built = buildJournalLines(opType, amount, opts);
    if (built.error) {
      console.warn("[أونصة] قيد مرفوض:", opType, built.error);
      return null;
    }
    if (!built.lines.length) return null;
    if (!built.balanced) {
      // ⚠ لا يُرحَّل غير المتوازن أبدًا — نُسجّله في السجل ولا نُفسد الدفتر
      console.error("[أونصة] قيد غير متوازن رُفض:", opType, built.totals);
      flashToast("قيد غير متوازن — لم يُرحَّل");
      return null;
    }
    // ⚠ الفترة المقفلة لا تُقبل قيدًا.
    //
    // `isPeriodClosed` كانت مُعرَّفة ولا تُستدعى: الفترة تُقفل ويبقى
    // القيد يدخلها. فيعود أحدهم بعد شهرين ويُصلح قيدًا، وتقرير الشهر
    // المُصدَّر يختلف عمّا في النظام — ولا أحد يعرف أيّهما الصحيح.
    const when = new Date().toISOString();
    if (isPeriodClosed(periodCloses, when)) {
      flashToast(`فترة ${when.slice(0, 7)} مقفلة — لا يُقبل قيد فيها`);
      audit("post", {
        entity: "journal", entityRef: opType,
        note: `رُفض: الفترة ${when.slice(0, 7)} مقفلة`,
      });
      return null;
    }

    const entry = {
      id: Date.now().toString() + "je",
      ref: nextRef("journalEntry", journal),
      date: new Date().toISOString(),
      opType,
      label: POSTING_RULES[opType]?.label || opType,
      lines: built.lines,
      refId: opts.refId || null,
      refDoc: opts.refDoc || null,
      note: opts.note || "",
      createdBy: currentUser?.name || "",
      createdById: currentUser?.id || null,
      posted: true,
      isReversal: false,
      reversed: false,
      ...dayStamp(),
    };
    persist(JOURNAL_KEY, [entry, ...journal], setJournal);
    audit("post", { entity: "journal", entityId: entry.id, entityRef: entry.ref,
      after: { opType, amount, lines: entry.lines.length } });
    return entry;
  };

  /// التصحيح الوحيد المسموح: قيدٌ عكسي يبقى الأصل بجواره.
  const reverseJournal = (entryId, reason) => {
    // ⚠ والعكس قيدٌ جديد: يخضع للإقفال كغيره.
    const nowIso = new Date().toISOString();
    if (isPeriodClosed(periodCloses, nowIso)) {
      flashToast(`فترة ${nowIso.slice(0, 7)} مقفلة — لا يُقبل قيد عكسي`);
      return null;
    }
    const orig = journal.find((e) => e.id === entryId);
    const built = buildReversal(orig, reason, currentUser?.name || "", new Date().toISOString());
    if (built.error) {
      flashToast(built.error);
      return null;
    }
    const rev = { ...built.entry, ref: nextRef("journalEntry", journal), ...dayStamp() };
    persist(
      JOURNAL_KEY,
      [rev, ...journal.map((e) => (e.id === entryId ? { ...e, reversed: true, reversedBy: rev.id } : e))],
      setJournal
    );
    flashToast(`أُلغي ${orig.ref} بقيد عكسي ${rev.ref}`);
    audit("reverse", { entity: "journal", entityId: orig.id, entityRef: orig.ref,
      before: { lines: orig.lines }, after: { reversalRef: rev.ref }, note: reason || "" });
    return rev;
  };

  // ── حارس الأفعال ──
  //
  // ⚠ الشاشة تُخفي الزرّ، وهذا يمنع العملية.
  //
  // إخفاء الزرّ حماية بصرية لا أكثر: من يفتح وحدة التحكم، أو يستورد
  // نسخة، أو يصل لشاشة عبر رابط، يتجاوزه. والمنع هنا — عند الفعل —
  // لا يُتجاوَز.
  const can = (action) => {
    // ⚠ الوضع أولًا: ما يمنعه وضعُ المحل لا يفتحه دورُ الشخص.
    if (!modeAllowsAction(appMode, action)) {
      flashToast(`التطبيق في وضع «${APP_MODES[appMode]?.label}» — هذه العملية معطَّلة`);
      return false;
    }
    const deny = ROLES[role]?.denyActions;
    if (Array.isArray(deny) && deny.includes(action)) {
      flashToast("هذه العملية خارج صلاحيتك");
      audit("permission", {
        entity: "action", entityId: action,
        note: `محاولة ${action} من دور ${ROLES[role]?.label || role}`,
      });
      return false;
    }
    return true;
  };

  const postWeight = (opType, lines) => {
    const arr = Array.isArray(lines) ? lines : [lines];
    const entries = arr.flatMap((l) =>
      buildWeightEntries(opType, {
        karat: l.karat, weight: l.weight, refId: l.refId,
        note: l.note, createdBy: currentUser?.name || "", day: dayStamp(),
      })
    );
    if (!entries.length) return [];
    // معرّفات فريدة — buildWeightEntries تعتمد الطابع الزمني وحده
    const stamped = entries.map((e, i) => ({ ...e, id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}` }));
    persist(GOLD_LEDGER_KEY, [...stamped, ...goldLedger], setGoldLedger);
    return stamped;
  };

  const handleImportExchange = ({ kind, rows }) => txn("handleImportExchange", () => {
    if (!rows?.length) return null;
    const now = new Date().toISOString();
    const stamp = `IMP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const num = (v) => Number(String(v ?? "").replace(/[^\d.\-]/g, "")) || 0;
    let posted = 0;

    if (kind === "journal") {
      // ⚠ تُجمَّع بالمرجع: كل مرجعٍ قيدٌ واحد بأسطره، لا قيدٌ لكل سطر —
      // وإلا صار كل طرفٍ قيدًا غير متوازن بذاته.
      const byRef = {};
      for (const r of rows) (byRef[r.ref || stamp] ??= []).push(r);
      const entries = Object.entries(byRef).map(([ref, ls]) => ({
        id: `${stamp}_${ref}`, at: new Date(ls[0].date).toISOString(),
        refDoc: ref, extRef: ref, opType: "imported", createdBy: currentUser?.name || "",
        note: ls[0].note || `مستورد — ${stamp}`,
        lines: ls.map((l) => ({ account: l.account, debit: num(l.debit), credit: num(l.credit) })),
      }));
      persist(JOURNAL_KEY, [...entries, ...journal], setJournal);
      posted = entries.length;
    } else if (kind === "expenses") {
      const made = rows.map((r) => ({
        id: `${stamp}_${r.ref}`, ref: r.ref, extRef: r.ref,
        date: new Date(r.date).toISOString(),
        category: EXPENSE_CATEGORIES.find((c) => c.label === r.category)?.id || "other",
        amount: num(r.amount), fundingSource: r.fundedBy || "safe_cash",
        note: r.note || `مستورد — ${stamp}`, createdBy: currentUser?.name || "", imported: true,
      }));
      persistExpenses([...made, ...expenses]);
      posted = made.length;
    } else if (kind === "customers") {
      const known = new Set(customers.map((c) => c.name));
      const made = rows.filter((r) => !known.has(r.name)).map((r) => ({
        id: `${stamp}_${r.ref}`, ref: r.ref, extRef: r.ref,
        name: r.name, phone: r.phone || "", note: r.note || "", createdAt: now, imported: true,
      }));
      persistCustomers([...customers, ...made]);
      posted = made.length;
    } else if (kind === "suppliers") {
      const known = new Set(suppliers.map((x) => x.name));
      const made = rows.filter((r) => !known.has(r.name)).map((r) => ({
        id: `${stamp}_${r.ref}`, ref: r.ref, extRef: r.ref,
        name: r.name, phone: r.phone || "", note: r.note || "", createdAt: now, imported: true,
      }));
      persistSuppliers([...suppliers, ...made]);
      posted = made.length;
    } else if (kind === "sales") {
      // ⚠ فاتورةٌ كاملة لا سطرٌ في دفتر: البيع يُخرج وزنًا ويُنشئ ذمّةً
      // ويُعلّم القطع مباعة. ترحيله قيدًا نقديًّا وحده يترك الذهب في الجرد.
      const byCode = new Map();
      for (const it of items) for (const u of it.units || []) if (u.code) byCode.set(u.code, it);
      const soldCodes = new Set();
      const made = [];
      for (const r of rows) {
        const cs = String(r.codes || "").split(/[;,|]/).map((x) => x.trim()).filter(Boolean);
        const lines = cs.map((c) => {
          const it = byCode.get(c);
          if (!it) return null;
          soldCodes.add(c);
          return {
            itemId: it.id, unitCode: c, quantity: 1,
            // ⚠ اللقطة من القطعة لا من الملف: نظامٌ آخر قد يُرسل عيارًا
            // مخالفًا لما في مخزوننا، والمخزون هو المرجع.
            karatSnapshot: it.karat, weightSnapshot: it.weight,
            unitPrice: 0, description: it.description,
          };
        }).filter(Boolean);
        if (!lines.length) continue;
        const total = num(r.total);
        // السعر يُوزَّع بالوزن — لا بالتساوي، فالقطع تختلف
        const totW = lines.reduce((a, l) => a + (l.weightSnapshot || 0) * (l.karatSnapshot || 21), 0) || 1;
        lines.forEach((l) => {
          l.unitPrice = fromHalalas(Math.round(halalas(total) * ((l.weightSnapshot || 0) * (l.karatSnapshot || 21)) / totW));
        });
        const cust = customers.find((c) => c.name === String(r.customer || "").trim());
        made.push({
          id: `${stamp}_${r.ref}`, ref: r.ref, extRef: r.ref, imported: true,
          date: new Date(r.date).toISOString(),
          customerId: cust?.id || null, customerName: r.customer || "",
          lines, total, subtotal: total,
          paidAmount: num(r.paid), paymentMethod: r.method || "cash",
          note: r.note || `مستورد — ${stamp}`, createdBy: currentUser?.name || "",
        });
      }
      if (!made.length) { flashToast("لا فاتورةَ صالحة"); return null; }
      persistSales([...made, ...sales]);
      // القطع تُعلَّم مباعة
      persistItems(items.map((it) => ({
        ...it,
        units: (it.units || []).map((u) => (soldCodes.has(u.code) ? { ...u, sold: true, soldAt: now } : u)),
      })));
      // والوزن يخرج من المخزون بعياره
      postWeight("sale_cash", made.flatMap((sale) => sale.lines.map((l) => ({
        karat: l.karatSnapshot, weight: l.weightSnapshot, refId: sale.ref,
        note: `${l.unitCode} · مستورد`,
      }))));
      posted = made.length;
    } else {
      // ⚠ الأنواع التي تمسّ المخزون أو تُنشئ فواتير لا تُستورد بعد:
      // فاتورةٌ بلا قطعةٍ في المخزون تُنتج بيعًا لوزنٍ لا وجود له.
      // أُعلنها صراحةً بدل أن أُرحّل نصفها.
      flashToast(`استيراد «${exchangeKind(kind)?.label}» لم يُفعَّل بعد — صدّره وراجعه يدويًّا`);
      return null;
    }

    audit("create", { entity: "exchange", entityRef: stamp,
      note: `استيراد ${exchangeKind(kind)?.label} — ${posted} سجلًّا` });
    flashToast(`رُحّل ${posted} سجلًّا`);
    return posted;
  });

  // ⚠ handleBackfillJournal حُذفت عمدًا (2026-09): كانت تبني قيودًا تلقائية
  // محليًا فقط لتعويض قيود لم تُكتب قط (مفهوم من مرجع محلي بحت). هذا الباك
  // إند يكتب قيدًا متوازنًا حقيقيًا لكل عملية مالية لحظة حدوثها عبر postJournalEntry
  // (مشغّل check_journal_balance يمنع أي قيد غير متوازن على مستوى القاعدة نفسها) —
  // فلا وجود لمفهوم قيد مفقود هنا أصلًا يحتاج ترحيلًا. إبقاؤها كان سيبني قيودًا
  // وهمية فقط في window.storage المحلي — تختفي عند أول إعادة bootstrap حقيقية.

  // ── ② التكسير الفعلي ──
  //
  // يُدخل الوزن الصافي بعد نزع الفصوص. الفرق عن التقدير يُقيَّد:
  // أقلّ ← هالك، وأكثر ← فائض. وكلاهما ينضمّ لوزن الخزنة فيبقى
  // الدفتر مطابقًا للميزان.
  // ⚠ حُوِّلت للباك إند: POST /scrap/:id/break-stones يتحقق من stage
  // (pending_break/received) ومن net<=gross*1.1 على الخادم، ويرحّل فرق
  // الوزن (scrap_break_gain/loss ضد 1230) وقيد دخول خزنة الكسر (1225)
  // في نفس المعاملة — لا حاجة لبنائهما محليًا بعد الآن.
  const handleBreakStones = async (scrapId, actualNetWeight, note) => {
    if (!ROLES[role]?.canBreak) {
      flashToast("التكسير بيد مسؤول الكسر — راجعه");
      return null;
    }
    if (!can("breakStones")) return null;
    const net = Number(actualNetWeight);
    if (!Number.isFinite(net) || net <= 0) {
      flashToast("أدخل الوزن الصافي بعد التكسير");
      return null;
    }
    try {
      const res = await api.scrap.breakStones(scrapId, { actualNetWeight: net });
      const now = new Date().toISOString();
      setScrapEntries((prev) => prev.map((x) =>
        x.id !== scrapId ? x : {
          ...x,
          weight: res.scrapItem.weightFinal,
          breakVariance: res.scrapItem.variance,
          refined: true,
          stage: "in_safe",
          status: "in_safe",
          settledAt: now,
          brokenAt: now,
          brokenBy: currentUser?.name || "",
          breakNote: note || "",
        }
      ));
      flashToast(
        `دخل الخزنة — ${fmtW(res.scrapItem.weightFinal)} جم` +
        (Math.abs(res.scrapItem.variance) > 0.0005
          ? ` · ${res.scrapItem.variance < 0 ? "هالك" : "فائض"} ${fmtW(Math.abs(res.scrapItem.variance))} جم`
          : "")
      );
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر التكسير"));
      return null;
    }
  };

  // ⚠ حُوِّلت للباك إند: POST /scrap/send يقتصر فعليًا على القطع بحالة
  // in_box (409 no_eligible_items إن لم يبقَ شيء منها)، ويبني sentLines
  // وsentFine على الخادم من نفس الصفوف.
  const handleSendScrap = async (scrapIds, note) => {
    try {
      const res = await api.scrap.send({ scrapItemIds: scrapIds, note: (note || "").trim() || null });
      const now = new Date().toISOString();
      setScrapEntries((prev) => prev.map((e) =>
        scrapIds.includes(e.id) ? { ...e, stage: "sent", status: "sent", requestId: res.request.id } : e));
      setScrapRequests((prev) => [
        {
          id: res.request.id,
          ref: res.request.ref,
          status: "pending",
          itemCount: res.request.itemCount,
          sentFine: res.request.sentFine,
          sentLines: [],
          assessedLines: [],
          confirmedLines: [],
          note: (note || "").trim(),
          createdAt: now,
          createdBy: currentUser?.id || null,
          createdByName: currentUser?.name || "",
        },
        ...prev,
      ]);
      flashToast(`أُرسل ${res.request.itemCount} قطعة للإدارة — ${res.request.ref}`);
      return res.request;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر الإرسال"));
      return null;
    }
  };

  // ── ② الإدارة تفحص وتثبّت الوزن النهائي ──
  // ⚠ حُوِّلت للباك إند: POST /scrap/:reqId/assess يتحقق من status='pending'
  // على الخادم ويحسب assessedFine/variance بنفسه من الأسطر المُرسَلة.
  const handleAssessScrap = async (reqId, lines, note) => {
    const clean = (lines || []).map((l) => ({
      scrapItemId: l.scrapId, karat: Number(l.karat) || 21,
      netWeight: Number(l.netWeight) || 0,
      stonesRemoved: Number(l.stonesRemoved) || 0,
    }));
    try {
      const res = await api.scrap.assess(reqId, { lines: clean, note: (note || "").trim() || null });
      const now = new Date().toISOString();
      setScrapRequests((prev) => prev.map((r) =>
        r.id === reqId
          ? {
              ...r, status: "assessed",
              assessedAt: now, assessedBy: currentUser?.name || "",
              assessedLines: clean.map((l) => ({ ...l, scrapId: l.scrapItemId })),
              assessedFine: res.request.assessedFine,
              variance: res.request.variance,
              assessNote: (note || "").trim(),
            }
          : r
      ));
      setScrapEntries((prev) => prev.map((e) => (e.requestId === reqId ? { ...e, stage: "assessed" } : e)));
      flashToast("ثُبّت الوزن — بانتظار الاعتماد");
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تثبيت الوزن"));
      return null;
    }
  };

  // ── ③ الاعتماد ──
  // ⚠ حُوِّلت للباك إند: POST /scrap/:reqId/approve يتحقق من status='assessed'
  // على الخادم (409 request_not_assessed).
  const handleApproveScrap = async (reqId) => {
    try {
      await api.scrap.approve(reqId);
      const now = new Date().toISOString();
      setScrapRequests((prev) => prev.map((r) =>
        r.id === reqId
          ? { ...r, status: "approved", approvedAt: now, approvedBy: currentUser?.name || "" }
          : r
      ));
      setScrapEntries((prev) => prev.map((e) => (e.requestId === reqId ? { ...e, stage: "approved" } : e)));
      flashToast("اعتُمد — يمكن للفرع إدخاله الخزنة");
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر الاعتماد"));
      return null;
    }
  };

  // ── ④ الفرع يُدخله الخزنة بالوزن المعتمد ──
  // ── ④ الفرع يُدخله الخزنة بالوزن المؤكَّد بعد التكسير ──
  //
  // ⚠ التأكيد إجباري ولا يُشتق من التقييم.
  //
  // التقييم تقدير الإدارة قبل التكسير الفعلي؛ والوزن بعد التكسير قد
  // يختلف: فصّ لم يُرَ، أو لحام أثقل مما بدا. إدخاله بوزن التقييم يُدخل
  // الخزنة وزنًا لم يُوزن، فيظهر الفرق عند جرد الخزنة بلا مصدر.
  //
  // `confirmed` مصفوفة { scrapId, weight } — من يستلم يزن ويكتب.
  //
  // ⚠ حُوِّلت للباك إند: POST /scrap/:reqId/receive يتحقق من status='approved'
  // ومن اكتمال كل الأسطر (409 unconfirmed_lines) على الخادم، ويرحّل فرق
  // التقييم (scrap_assay_gain/loss) وقيد دخول خزنة الكسر (1225، سطر لكل
  // عيار) في نفس المعاملة — القطعة تصبح "في الخزنة" دائمًا بأثر حقيقي، لا
  // بالاسم فقط (راجع تعليق scrap.routes.js).
  const handleReceiveScrap = async (reqId, confirmed) => {
    const conf = (confirmed || [])
      .map((c) => ({ scrapItemId: c.scrapId, weight: Number(c.weight) }))
      .filter((c) => Number.isFinite(c.weight) && c.weight > 0);
    try {
      const res = await api.scrap.receive(reqId, { confirmed: conf });
      const now = new Date().toISOString();
      const confById = {};
      conf.forEach((c) => (confById[c.scrapItemId] = c.weight));
      setScrapEntries((prev) => prev.map((e) => {
        if (e.requestId !== reqId) return e;
        const w = confById[e.id];
        return w != null
          ? { ...e, stage: "in_safe", originalWeight: Number(e.weight) || 0,
              weight: w, confirmedWeight: w, confirmedBy: currentUser?.name || "", confirmedAt: now }
          : { ...e, stage: "in_safe" };
      }));
      setScrapRequests((prev) => prev.map((r) =>
        r.id === reqId
          ? {
              ...r, status: "received", receivedAt: now,
              receivedBy: currentUser?.name || "",
              confirmedFine: res.request.confirmedFine, variance: res.request.variance,
            }
          : r
      ));
      flashToast(
        `أُدخل ${fmtW(res.request.confirmedFine)} جم24 للخزنة` +
          (Math.abs(res.request.variance) > 0.0005
            ? ` · ${res.request.variance > 0 ? "فائض" : "هالك"} ${fmtW(Math.abs(res.request.variance))} جم`
            : "")
      );
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر الاستلام"));
      return null;
    }
  };

  const handleScrapToProduct = (entry) => txn("handleScrapToProduct", () => {
    if (stocktakeLock) {
      flashToast("المخزون مقفل للجرد — لا تحويل الآن");
      return null;
    }
    const w = Number(entry.weight) || 0;
    const karat = Number(entry.karat) || 21;
    const qty = Math.max(1, Number(entry.quantity) || 1);
    const wmTotal = Number(entry.workmanship) || 0;
    const scrapCPG = Number(entry.scrapCostPerGram) || pricePerGram(karat, priceData.current);
    if (w <= 0) {
      flashToast("حدّد الوزن");
      return null;
    }
    const now = new Date().toISOString();
    const perPiece = w / qty;

    // ① يخرج من مخزون الكسر
    persistScrap([
      {
        id: Date.now().toString() + "s2p",
        ref: nextRef("scrap", scrapEntries),
        date: now,
        description: `تحويل إلى منتج — ${categoryLabel(entry.categoryId)}`,
        karat,
        weight: -w,
        pricePerGram: scrapCPG,
        total: 0,
        status: "converted",
        createdBy: currentUser?.name || "",
        ...dayStamp(),
      },
      ...scrapEntries,
    ]);

    // ② يدخل المخزون كصنف جديد
    const units = Array.from({ length: qty }, () => ({ code: generateUnitCode(), printed: false, sold: false }));
    const newItem = {
      id: Date.now().toString() + "ip",
      lotId: null,
      categoryId: entry.categoryId || "other",
      karat,
      weight: perPiece,
      stonesWeight: Number(entry.stonesWeight) || 0,
      costPerGram: scrapCPG,
      workmanship: 0,
      lotWorkmanshipShare: qty > 0 ? wmTotal / qty : 0,
      units,
      dateAdded: now,
      fromScrap: true,
      createdBy: currentUser?.name || "",
      ...dayStamp(),
    };
    persistItems([newItem, ...items]);
    postWeight("scrap_to_product", { karat, weight: w, refId: newItem.id, note: "تصنيع من كسر" });

    // ③ مصنعية التصنيع تُدفع نقدًا وتُقيَّد تكلفة ذهب
    if (wmTotal > 0) {
      deductFromSource(
        entry.fundingSource || "safe_cash",
        wmTotal,
        `مصنعية تحويل كسر إلى ${categoryLabel(entry.categoryId)}`,
        "scrap_convert",
        newItem.id,
        "scrap_to_product_wm"
      );
    }

    flashToast(`صُنع ${qty} قطعة من ${fmtW(w)} جم كسر`);
    return newItem;
  
  });

  // ── تحويل قطعة جاهزة إلى كسر ──
  // الذهب يبقى والمصنعية تضيع. صهر القطعة يُعدم الأجور التي دُفعت لصنعها،
  // فتُقيَّد إعدامًا لا تُنقل مع الوزن.
  const handleProductToScrap = (entry) => txn("handleProductToScrap", () => {
    if (stocktakeLock) {
      flashToast("المخزون مقفل للجرد — لا تحويل الآن");
      return null;
    }
    const item = items.find((it) => it.id === entry.itemId);
    if (!item) return null;
    const codes = Array.isArray(entry.unitCodes) && entry.unitCodes.length
      ? entry.unitCodes
      : (item.units || []).filter((u) => !u.sold).slice(0, 1).map((u) => u.code);
    if (!codes.length) {
      flashToast("لا توجد قطع متاحة للتحويل");
      return null;
    }
    const qty = codes.length;
    const grossW = (Number(item.weight) || 0) * qty;
    // الفصوص لا تُصهر — تُطرح من الوزن الداخل للكسر
    const stones = (Number(item.stonesWeight) || 0) * qty;
    const goldW = Math.max(0, grossW - stones);
    const wmLost = (Number(item.lotWorkmanshipShare) || 0) * qty + (Number(item.workmanship) || 0) * qty;
    const now = new Date().toISOString();

    // ① القطع تخرج من المخزون
    persistItems(
      items.map((it) =>
        it.id === item.id
          ? {
              ...it,
              units: (it.units || []).map((u) =>
                codes.includes(u.code) ? { ...u, sold: true, convertedToScrap: true, convertedAt: now } : u
              ),
            }
          : it
      )
    );

    // ② الوزن يدخل مخزون الكسر
    persistScrap([
      {
        id: Date.now().toString() + "p2s",
        ref: nextRef("scrap", scrapEntries),
        date: now,
        description: `تحويل من المخزون — ${categoryLabel(item.categoryId)} (${qty})`,
        karat: item.karat,
        weight: goldW,
        pricePerGram: Number(item.costPerGram) || 0,
        total: 0, // لا نقد يتحرك — تحويل شكل لا شراء
        status: "in_box",
        fromItemId: item.id,
        createdBy: currentUser?.name || "",
        ...dayStamp(),
      },
      ...scrapEntries,
    ]);

    postWeight("product_to_scrap", { karat: item.karat, weight: goldW, refId: item.id, note: "صهر قطعة" });

    // ③ المصنعية تُعدم
    if (wmLost > 0) {
      persistWeightAdjustments([
        {
          id: Date.now().toString() + "wmw",
          ref: nextRef("scrap", weightAdjustments).replace("SCR", "WMW"),
          date: now,
          lotId: item.lotId || null,
          itemId: item.id,
          kind: "workmanship_writeoff",
          karat: item.karat,
          weight: 0,
          fineWeight: 0,
          costPerGram: Number(item.costPerGram) || 0,
          value: wmLost,
          note: `إعدام مصنعية عند صهر ${qty} قطعة`,
          category: "workmanship_writeoff",
          createdBy: currentUser?.name || "",
          ...dayStamp(),
        },
        ...weightAdjustments,
      ]);
    }

    flashToast(
      `حُوّلت ${qty} قطعة لكسر — ${fmtW(goldW)} جم` + (wmLost > 0 ? ` · أُعدمت مصنعية ${fmt(wmLost, 0)}` : "")
    );
    return { goldW, stones, wmLost, qty };
  
  });

  const handleRepairWeight = (entry) => txn("handleRepairWeight", () => {
    const itemId = entry.itemId;
    const unitCode = entry.unitCode || null;
    const w = Number(entry.weight) || 0;
    const kind = entry.kind === "reduce" ? "reduce" : "add";
    const item = items.find((it) => it.id === itemId);
    if (!item || w <= 0) {
      flashToast("حدّد القطعة والوزن");
      return null;
    }
    if (kind === "reduce" && w >= (Number(item.weight) || 0)) {
      flashToast("لا يمكن خصم وزن يساوي وزن القطعة أو يتجاوزه");
      return null;
    }
    const karat = Number(entry.karat) || item.karat;
    const now = new Date().toISOString();

    // ١. عدّل وزن القطعة
    const newWeight = kind === "add" ? (Number(item.weight) || 0) + w : (Number(item.weight) || 0) - w;
    persistItems(items.map((it) => (it.id === itemId ? { ...it, weight: newWeight } : it)));

    // ٢. حرّك مخزون الكسر بالاتجاه المعاكس
    const scrapRec = {
      id: Date.now().toString() + "rw",
      ref: nextRef("scrap", scrapEntries),
      date: now,
      description: kind === "add" ? `صرف للإصلاح — ${itemLabel(item)}` : `عائد من إصلاح — ${itemLabel(item)}`,
      karat,
      weight: kind === "add" ? -w : w, // سالب = خرج من الكسر
      pricePerGram: pricePerGram(karat, priceData.current),
      total: 0, // حركة وزن لا شراء — لا نقد يتحرك
      status: "in_box",
      repairAdjust: true,
      createdBy: currentUser?.name || "",
      ...dayStamp(),
    };
    persistScrap([scrapRec, ...scrapEntries]);

    // ٣. سجل الحركة لتظهر في التقارير
    const adj = {
      id: Date.now().toString() + "rwa",
      ref: nextRef("scrap", weightAdjustments).replace("SCR", "RPW"),
      date: now,
      lotId: item.lotId || null,
      supplierId: null,
      kind: kind === "add" ? "repair_add" : "repair_reduce",
      karat,
      weight: w,
      fineWeight: w * (PURITY[karat] || karat / 24),
      costPerGram: pricePerGram(karat, priceData.current),
      value: w * pricePerGram(karat, priceData.current),
      itemId,
      unitCode,
      note: entry.note || "",
      createdBy: currentUser?.name || "",
      category: kind === "add" ? "repair_gold_added" : "repair_gold_removed",
      ...dayStamp(),
    };
    persistWeightAdjustments([adj, ...weightAdjustments]);

    flashToast(
      kind === "add"
        ? `أُضيف ${fmtW(w)} جم للقطعة من مخزون الكسر`
        : `خُصم ${fmtW(w)} جم وأُعيد لمخزون الكسر`
    );
    return adj;
  
  });

  // ⚠ حُوِّلت للباك إند: POST /repairs يكتب فعليًا repairs + cash_tx (إن
  // وُجد مكسب) + قيد يومية (4130 إيراد إصلاح) على الخادم — لا حفظ محلي
  // بحت كان يختفي بعد إعادة التحميل (سبب البلاغ الأصلي عن الخزنة، بنفس
  // الشكل بالضبط).
  const handleAddRepair = async (entry) => {
    const profitAmt = Number(entry.profit) || 0;
    try {
      const res = await api.repairsApi.add({
        customerName: entry.customerName || null,
        description: entry.description || null,
        cost: Number(entry.cost) || 0,
        profit: profitAmt,
        fundingSource: entry.fundingSource,
        notes: entry.notes || null,
      });
      const r = res.repair;
      const record = {
        id: r.id, ref: r.ref, date: r.created_at,
        customerName: r.customer_name || "", description: r.description || "",
        cost: Number(r.cost) || 0, profit: Number(r.profit) || 0,
        profitGrams: priceData.current > 0 ? Number(r.profit) / pricePerGram(24, priceData.current) : 0,
        fundingSource: r.funding_source, notes: r.notes || "",
        createdBy: currentUser?.name || "",
      };
      setRepairs((prev) => [record, ...prev]);
      // ⚠ المصدر قد يكون الخزنة (safe) أو اليومي (daily) — pool من السطر
      // الخام نفسه، لا افتراض ثابت، وإلا حُدِّثت الحالة الخطأ.
      if (res.cashTx) {
        const entryTx = normalizeCashTxRow(res.cashTx);
        if (res.cashTx.pool === "safe") setSafeTx((prev) => [entryTx, ...prev]);
        else setCashTx((prev) => [entryTx, ...prev]);
      }
      flashToast("تم تسجيل الإصلاح");
      return record;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تسجيل الإصلاح"));
      return null;
    }
  };

  // -------- handlers: scrap stones settlement (تصفية هامش الفصوص) --------
  // ⚠ حُوِّلت للباك إند: POST /scrap/:id/break-stones يثبّت الوزن الصافي
  // فعليًا على الخادم (weight_final/karat_final) ويُرحّل الفرق (إن وُجد)
  // لدفتر الوزن (1230) وخزنة الكسر مباشرة — لا حساب/حفظ محلي بعد الآن.
  const handleRefineScrap = async (entryId, actualStonesWeight) => {
    const entry = scrapEntries.find((s) => s.id === entryId);
    if (!entry) return null;
    try {
      const res = await api.scrap.breakStones(entryId, { actualNetWeight: Number(actualStonesWeight) });
      const sr = res.scrapItem;
      setScrapEntries((prev) => prev.map((s) =>
        s.id === entryId
          ? { ...s, refined: true, stage: "in_safe", actualStonesWeight: Number(actualStonesWeight),
              weight: sr.weightFinal, breakVariance: sr.variance }
          : s
      ));
      if (sr.variance > 0.0001) {
        setScrapSurplusLog((prev) => [
          { id: sr.id || entryId, date: new Date().toISOString(), scrapEntryId: entryId,
            description: entry.description, weight: sr.variance, createdBy: currentUser?.name || "" },
          ...prev,
        ]);
        flashToast(`تمت التصفية — فائض ذهب ${fmtW(sr.variance)} جم أُضيف لرصيد الكسر`);
      } else {
        flashToast("تمت التصفية");
      }
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّرت التصفية"));
      return null;
    }
  };

  /**
   * تحميل كل بيانات الفرع دفعة واحدة بعد نجاح الدخول (bootstrap)، وتوزيعها
   * على نفس setters الحالة الموجودة أصلًا — هذا ما يضمن أن التنقل بين
   * الشاشات بعدها محلي 100% بلا أي طلب شبكة إضافي (بطلبك الصريح).
   *
   * ⚠ نطاق متعمَّد: يغطي فقط ما حُوِّل فعليًا للباك إند (راجع تعليق
   * normalizeBootstrap في core/normalize.js). كل شيء آخر (رواتب، الكسر
   * بتفاصيله...) يبقى على حالته المحلية القديمة حتى تُحوَّل في دفعات
   * لاحقة. الأصول الثابتة/الإهلاك (migration 015) صارت من هذا التحميل
   * أيضًا الآن — setFixedAssets/setDepreciations كانا موجودين أصلًا
   * (سلكٌ ميت من مخزون STORE_REGISTRY المحلي القديم لم يُستخدَم قط)،
   * فأُعيد استخدامهما هنا بدل تكرارهما.
   */
  // الفرق بين applyBootstrap (تطبيق بيانات موجودة على الحالة فقط بلا شبكة)
  // وloadBootstrap (جلب حقيقي من الشبكة + تطبيق + تحديث النسخة المخزّنة): هذا
  // يسمح بعرض نسخة bootstrap مخزّنة محليًا فورًا عند إقلاع التطبيق
  // (بلا انتظار شبكة)، ثم تحديثها بهدوء بعد رجوع الطلب الحقيقي.
  const applyBootstrap = (boot) => {
    const n = normalizeBootstrap(boot);
    setItems(n.items);
    setSales(n.sales);
    setCashTx(n.cashTx);
    setSafeTx(n.safeTx);
    setScrapCustodyTx(n.scrapCustodyTx);
    setSafeGoldTx(n.safeGoldTx);
    setSafeAudits(n.safeAudits);
    setScrapEntries(n.scrapEntries);
    setScrapRequests(n.scrapRequests);
    setBusinessDays(n.businessDays);
    setDailyCustody(n.dailyCustody);
    setExpenses(n.expenses);
    setExpenseNames(n.expenseNames);
    setTaskirEntries(n.taskirEntries);
    setTaskirOffices(n.taskirOffices);
    setTaskirOfficeTx(n.taskirOfficeTx);
    setCustomers(n.customers);
    setSuppliers(n.suppliers);
    setLots(n.lots);
    setUsers(n.users);
    setCategories(n.categories);
    setRuntimeCategories(n.categories);
    setStocktakeLock(n.stocktakeLock);
    setReservations(n.reservations);
    setRepairs(n.repairs);
    setReturns(n.returns);
    setReceipts(n.receipts);
    setFixedAssets(n.fixedAssets);
    setDepreciations(n.depreciationSchedule);
    // ⚠ إصلاح فجوة حقيقية (2026-09): journal/goldLedger كانتا محليتين
    // بحتة (لا مصدر لهما هنا قبل اليوم) منفصلتين تمامًا عن القيود الحقيقية
    // التي يكتبها الباك إند فعليًا لكل عملية (بيع/شراء/مصروف/كسر...) عبر
    // postJournalEntry — الآن مصدر الحقيقة الوحيد لهما هو bootstrap، لا window.storage
    // (لا setter محلي يكتب إليهما بعد اليوم سوى هذا التحميل ذاته عند إعادة الدخول).
    setJournal(n.journal);
    setGoldLedger(n.goldLedger);
    setIsHq(n.isHq);
    if (n.appSettings) {
      // ⚠ دمج لا استبدال: appSettings يحمل أيضًا تفضيلات محلية بحتة
      // (الثيم، طباعة، requirePin...) لا وجود لها في الباك إند بعد —
      // استبدال الكائن كاملًا كان سيمحوها.
      setAppSettings((prev) => ({ ...prev, taxEnabled: n.appSettings.taxEnabled, taxRate: n.appSettings.taxRate, cardFees: n.appSettings.cardFees }));
    }
  };

  // جلب فعلي من الشبكة + تطبيق + تحديث النسخة المخزّنة محليًا.
  const loadBootstrap = async (user) => {
    const boot = await api.fetchBootstrap();
    applyBootstrap(boot);
    api.setCachedBootstrap(boot, user);
  };

  /// الدخول باختيار المستخدم مباشرة — حين تكون الحماية مطفأة.
  //
  // ⚠ فجوة حقيقية موثَّقة: الباك إند لا يوفّر أي مسار دخول بلا رقم سري
  // (auth.routes.js يتطلب pin دائمًا) — "الحماية مطفأة" كانت تعني في
  // المرجع دخولًا محليًا بلا أي تحقق على الإطلاق، وهذا لا يعطي توكن JWT
  // صالحًا فتفشل كل الطلبات التالية بـ401. لا نتظاهر بدخول ناجح هنا؛
  // نطلب الرقم السري دائمًا حتى تُبنى نقطة دخول آمنة بلا رقم سري (إن
  // كانت مطلوبة فعلًا) كقرار منفصل.
  const handleDirectLogin = () => {
    flashToast("الدخول بلا رقم سري غير مدعوم حاليًا — أدخل الرقم السري");
    return false;
  };

  const handleLogin = async (enteredPin, userId) => {
    // ⚠ قصر المحاولات: رقمٌ من أربع خانات يُخمَّن في عشرة آلاف محاولة،
    // وآلة تُجرّبها في ثوانٍ. القفل بعد خمس يجعلها سنوات. هذا حارس
    // إضافي في الفرونت إند فقط — الباك إند مسؤول عن الحماية الفعلية.
    const now = Date.now();
    if (lockUntil.current > now) {
      flashToast(`محاولات كثيرة — انتظر ${Math.ceil((lockUntil.current - now) / 1000)} ثانية`);
      return false;
    }
    if (!userId) return false;
    if (!branchLink?.branchId) {
      flashToast("لم يُحدَّد فرعٌ لهذا الجهاز بعد — افتح رابط دخول الفرع أولًا");
      return false;
    }
    // ⚠ جيل الجلسة الحالي — لو حدث logout (أو دخول آخر) أثناء انتظارنا لـ
    // bootstrap هنا (قد يأخذ 5-6 ثوانٍ من السيرفر)، نتجاهل الرد المتأخر بدل
    // من كتابته فوق حالة الخروج/الدخول الجديد اللي حدثت في الأثناء.
    const myEpoch = ++sessionEpoch.current;
    try {
      const { user } = await api.login({ branchId: branchLink.branchId, userId, pin: enteredPin });
      failedTries.current = 0;
      lockUntil.current = 0;
      // ⚠ تحميل كل بيانات الفرع قبل الدخول الفعلي للتطبيق — نفس لحظة
      // "اللود" الوحيدة المقبولة في كل هذا التطبيق (شاشة البداية، لا
      // تنقّل بين شاشات). setLoading الموجود أصلًا لعرض دوّار التحميل.
      setLoading(true);
      try {
        await loadBootstrap(user);
      } finally {
        if (myEpoch === sessionEpoch.current) setLoading(false);
      }
      // ⚠ لو حدث logout أثناء انتظار bootstrap فالجيل تغيّر وهذا الرد أصبح
      // متأخرًا — لا نطبّقه إطلاقًا، وإلا رجعنا المستخدم للدخول بعد ضغطه logout بدون رقم سري.
      if (myEpoch !== sessionEpoch.current) return true;
      setCurrentUser(user);
      // ⚠ `allowedTabs[0]` يكون undefined لمن لا تبويب له.
      //
      // مشتري الكسر صلاحيته صفحةٌ في القائمة لا تبويبٌ في الشريط،
      // فيُفتح على شاشة فارغة ويظنّ التطبيق معطّلًا.
      const land = landingFor(user.role);
      setMorePage(land.more);
      setTab(land.tab);
      return true;
    } catch (e) {
      failedTries.current += 1;
      if (failedTries.current >= 5) {
        const wait = Math.min(600, 30 * 2 ** (failedTries.current - 5)) * 1000;
        lockUntil.current = now + wait;
        flashToast(`خمس محاولات فاشلة — قُفل ${Math.round(wait / 1000)} ثانية`);
      } else if (e instanceof api.ApiError && e.status === 401) {
        // رقم سري خاطئ — الرسالة الافتراضية في PriceLoginScreen تكفي.
      } else {
        flashToast("تعذّر الاتصال بالخادم — تحقّق من الشبكة وحاول مجددًا");
      }
      return false;
    }
  };
  const handleLogout = () => {
    // ⚠ يزيد الجيل أولًا: أي عملية دخول/استعادة جلسة لا تزال قيد
    // التنفيذ (fetch معلق) ستلاحظ عند انتهائها أن جيلها تغيّر، فتتجاهل
    // نتيجتها بدل أن تكتب فوق الخروج الذي نفذّذه الآن برد متأخّر من loadBootstrap/
    // fetchCurrentUser القديمة — هذا هو الإصلاح الحقيقي لمشكلة شاشة الدخول تظهر
    // ثوانٍ ثم ترجع تلقائيًا للتطبيق بعد logout.
    sessionEpoch.current += 1;
    api.logout();
    setCurrentUser(null);
    setMorePage(null);
    setTab("sales");
  };

  // ⚠ إصلاح حقيقي: التوكن كان يُحفظ فعليًا (sessionStorage ثم localStorage)
  // لكن لا شيء في التطبيق كان يتحقق منه عند أي تحميل جديد للصفحة —
  // currentUser هو React state فقط ويبدأ null دائمًا، فكل refresh كان
  // يُظهر شاشة الدخول من جديد رغم أن الجلسة (12 ساعة) لم تنتهِ فعليًا.
  // هذا الأثر يعمل مرة واحدة عند إقلاع التطبيق: يتحقق من توكن محفوظ عبر
  // GET /auth/me، ولو صالحًا يُكمل بالضبط نفس تسلسل handleLogin (تحميل
  // bootstrap ثم تفعيل الجلسة) بلا طلب PIN من جديد.
  useEffect(() => {
    if (!api.getAuthToken()) {
      setSessionChecking(false);
      return;
    }

    // ⚠ جيل هذه المحاولة المحدد عند بداية تشغيلها. لو حدث logout (أو دخول
    // يدويًا) أثناء انتظارنا لـ fetchCurrentUser/loadBootstrap أدناه، سيتغيّر
    // sessionEpoch.current وهذا يجعل الرد المتأخّر هنا يتجاهل نفسه بدل
    // أن يكتب فوق حالة أحدث (مثل لوجن جديد دخله المستخدم بيدويًا).
    const myEpoch = sessionEpoch.current;

    // الإحساس المحلي: لو عندنا نسخة bootstrap + مستخدم مخزّنين من
    // جلسة سابقة نعرضهما فورًا (0 ثانية انتظار) — بيانات ودخول معًا،
    // فتظهر شاشة التطبيق نفسها لا شاشة تحميل ولا شاشة دخول — ثم
    // نتحقق من الجلسة في الخلفية ونحدّث البيانات بصمت إن نجح التحقق.
    //
    // ⚠ إطفاء loading وحده لا يكفي: شرط عرض شاشة التحميل في الأسفل هو
    // `loading || sessionChecking` معًا، فإن بقي sessionChecking صحيحًا
    // حتى انتهاء التحقق من الشبكة فالشاشة السوداء تبقى ظاهرة كاملة
    // مدة ذلك التحقق رغم أن البيانات معروضة بالفعل تقنيًا — وهذا بالضبط
    // ما كان يجعل الفتح يبدو بلا أي تحسّن رغم النسخة المخزّنة.
    let shownFromCache = false;
    try {
      const cached = api.getCachedBootstrap();
      if (cached && cached.data && cached.user) {
        applyBootstrap(cached.data);
        setCurrentUser(cached.user);
        const land = landingFor(cached.user.role);
        setMorePage(land.more);
        setTab(land.tab);
        shownFromCache = true;
        setLoading(false);
        setSessionChecking(false);
      }
    } catch (e) {
      // نسخة مخزّنة تالفة/بشكل غير متوقع — لا توقف التطبيق، نتجاهل الكاش ونكمل
      // المسار العادي (التحقق الحقيقي من الشبكة أدناه) كأنه لا كاش أصلًا.
      console.warn("[أوقية] تجاهل نسخة bootstrap المخزّنة:", e);
      shownFromCache = false;
    }

    (async () => {
      try {
        const { user } = await api.fetchCurrentUser();
        if (myEpoch !== sessionEpoch.current) return;
        if (!shownFromCache) setLoading(true);
        try {
          await loadBootstrap(user);
        } finally {
          if (myEpoch === sessionEpoch.current) setLoading(false);
        }
        if (myEpoch !== sessionEpoch.current) return;
        setCurrentUser(user);
        const land = landingFor(user.role);
        setMorePage(land.more);
        setTab(land.tab);
      } catch (e) {
        // ⚠ التمييز مهم: فشل شبكة/خادم (مهما كان مؤقتًا) ليس كتوكن
        // غير صالح — 401/403 فقط يعني ذلك فعليًا. قبل هذا التمييز، أي
        // فشل مؤقت (انقطاع نت، خطأ 5xx عابر) كان يمسح الجلسة ويطرد
        // المستخدم لشاشة الدخول رغم أن توكنه لا يزال صالحًا.
        if (myEpoch !== sessionEpoch.current) return;
        const isAuthFailure = e instanceof api.ApiError && (e.status === 401 || e.status === 403);
        if (isAuthFailure) {
          // توكن غائب/منتهِ/غير صالح فعليًا — نمسحه ونعرض شاشة الدخول
          // العادية. إن كنا عرضنا نسخة مخزّنة بالفعل، نفرّغ الشاشة.
          if (shownFromCache) {
            setCurrentUser(null);
            setLoading(true);
          }
          api.logout();
        }
        // غير ذلك (شبكة/خادم): التوكن يبقى كما هو ولا نلمس النسخة
        // المعروضة من الكاش إن وجدت — محاولة لاحقة (refresh) تعيد التحقق
        // بالتوكن نفسه بدل طرد مستخدم لمشكلة شبكة عابرة.
      } finally {
        if (myEpoch === sessionEpoch.current) setSessionChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ⚠ حُوِّلت للباك إند بالكامل: كانت onSave(nextUsers) تستبدل مصفوفة
  // المستخدمين كاملةً محليًا (تصميم "استبدل الكل" لشاشة تعرض فعلًا زرًا
  // مستقلًا لكل فعل: إضافة/حذف/تسمية/تبديل AI/صلاحيات). الباك إند له نقطة
  // نهاية صارمة الصلاحيات مستقلة لكل فعل من هذي (users.routes.js) — فحُوِّلت
  // AccessSettingsPage.jsx نفسها لتنادي فعلها الخاص لا "حفظ الكل"، وتحقق
  // التكرار بالاسم/الرقم السري الذي كان محليًا هنا صار على الخادم (اسم
  // مكرر → 409 name_taken، رقم سري مكرر → 409 pin_taken) لأن الرقم السري
  // لم يعد موجودًا في الحالة المحلية إطلاقًا (bootstrap لا يُرجعه أبدًا،
  // ولا حتى مُجزّأً — أمن، لا سهو).
  const handleAddUser = async ({ name, pin, role, salary }) => {
    try {
      const user = await api.usersApi.create({ name: name.trim(), pin, role, salary: Number(salary) || 0 });
      setUsers((prev) => [
        ...prev,
        // ⚠ user.ref حقيقي الآن (يولّده الباك إند عند الإنشاء — راجع
        // generateUniqueEmployeeRef في branchUsers.js) لا null دائمًا
        // كما كان قبل تفعيل الأرقام: كان هذا يُخفي الرمز عن المدير حتى
        // يُعاد تحميل القائمة من الخادم رغم وصوله فعليًا في نفس الرد.
        {
          id: user.id, name: user.name, ref: user.ref ?? null, role: user.role,
          canUseAi: false, allowedPages: null, active: true,
          allowedTabs: [], allowedMore: [], createdAt: user.created_at,
        },
      ]);
      flashToast("تمت إضافة الموظف");
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّرت إضافة الموظف"));
      return false;
    }
  };

  const handleRenameUser = async (id, name) => {
    try {
      const res = await api.usersApi.rename(id, name.trim());
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, name: res.name } : u)));
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّرت إعادة تسمية الموظف"));
      return false;
    }
  };

  const handleToggleUserAi = async (id, nextCanUseAi) => {
    try {
      const res = await api.usersApi.toggleAi(id, nextCanUseAi);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, canUseAi: res.can_use_ai } : u)));
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تعديل صلاحية الذكاء"));
      return false;
    }
  };

  const handleSetUserPermissions = async (id, allowedPages) => {
    try {
      const res = await api.usersApi.setPermissions(id, allowedPages);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, allowedPages: res.allowed_pages } : u)));
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, err?.body?.message || "تعذّر تعديل الصلاحيات"));
      return false;
    }
  };

  const handleRemoveUser = async (id) => {
    try {
      await api.usersApi.remove(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      flashToast("تم حذف الموظف");
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر حذف الموظف"));
      return false;
    }
  };
  const persistAudits = (next) => persist(AUDIT_KEY, next, setAudits);
  const persistSuppliers = (next) => persist(SUPPLIERS_KEY, next, setSuppliers);
  const persistLots = (next) => persist(LOTS_KEY, next, setLots);

  const runAutoFetch = async () => {
    setAutoUpdating(true);
    setAutoError("");
    try {
      const result = await fetchGoldPriceSAR();
      const price = Number(result.perGram.toFixed(2));
      setPriceData((prev) => {
        const history = [...prev.history, { date: new Date().toISOString(), price }].slice(-120);
        const next = { ...prev, current: price, currency: "ر.س", history };
        window.storage.set(PRICE_KEY, JSON.stringify(next), false).catch((e) => console.error(e));
        return next;
      });
      setLastAutoFetch(new Date().toISOString());
    } catch (e) {
      console.error("Auto fetch failed", e);
      setAutoError("تعذر الاتصال بالسعر العالمي، سيُعاد المحاولة تلقائيًا");
    } finally {
      setAutoUpdating(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    runAutoFetch();
    // كل دقيقتين: الرسم يمتلئ أسرع، وسعر الذهب يتحرك فعلًا خلالها.
    const interval = setInterval(runAutoFetch, 2 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const activeItems = useMemo(() => items.filter((i) => remainingQty(i) > 0), [items]);

  const totals = useMemo(() => {
    // الأسطر الجديدة لها الأولوية؛ الحقول المفردة تبقى للتوافق مع بيانات سابقة.
    const obLines = (openingBalance.inventoryLines || []).filter((l) => (Number(l.weight) || 0) > 0);
    const obWeight = obLines.length
      ? obLines.reduce((a, l) => a + (Number(l.weight) || 0), 0)
      : openingBalance.inventoryWeight || 0;
    const obFine = obLines.length
      ? obLines.reduce((a, l) => a + (Number(l.weight) || 0) * (PURITY[l.karat] || (Number(l.karat) || 0) / 24), 0)
      : (openingBalance.inventoryWeight || 0) * (PURITY[openingBalance.inventoryKarat] || 1);
    const obCost = obLines.length
      ? obLines.reduce(
          (a, l) =>
            a +
            (Number(l.weight) || 0) * pricePerGram(l.karat, priceData.current) +
            (Number(l.workmanship) || 0),
          0
        )
      : openingBalance.inventoryValue || 0;

    let weight = obWeight,
      cost = obCost,
      value = obCost,
      pieces = 0,
      fineWeight = obFine;
    const byKarat = {};
    const byCategory = {};
    if (obLines.length) {
      obLines.forEach((l) => {
        byKarat[l.karat] = (byKarat[l.karat] || 0) + (Number(l.weight) || 0);
      });
    } else if (openingBalance.inventoryWeight > 0) {
      byKarat[openingBalance.inventoryKarat] = (byKarat[openingBalance.inventoryKarat] || 0) + openingBalance.inventoryWeight;
    }
    activeItems.forEach((it) => {
      const qty = remainingQty(it);
      const w = it.weight * qty;
      const fw = w * (PURITY[it.karat] || 0);
      weight += w;
      fineWeight += fw;
      cost += unitCostBasis(it) * qty;
      value += unitCurrentValue(it, priceData.current) * qty;
      pieces += qty;
      byKarat[it.karat] = (byKarat[it.karat] || 0) + w;
      if (!byCategory[it.categoryId]) byCategory[it.categoryId] = { count: 0, weight: 0, fineWeight: 0 };
      byCategory[it.categoryId].count += qty;
      byCategory[it.categoryId].weight += w;
      byCategory[it.categoryId].fineWeight += fw;
    });
    const realizedProfit = sales.reduce((acc, s) => {
      const saleProfit = (s.lines || []).reduce((lacc, l) => {
        const basis = (l.costPerGramSnapshot * l.weightSnapshot + (l.workmanshipSnapshot || 0)) * l.quantity;
        return lacc + (l.unitPrice * l.quantity - basis);
      }, 0);
      return acc + saleProfit;
    }, 0);
    const unrealizedProfit = value - cost;
    // Gains are always reported primarily in 24k grams — a stable unit that
    // isn't distorted by the gold price moving day to day — converted here at
    // TODAY's price. The SAR figures above remain the ledger's source of truth
    // for bookkeeping/zakat; grams are the headline figure shown to the user.
    const price24 = priceData.current || 0;
    const realizedProfitGrams = price24 > 0 ? realizedProfit / price24 : 0;
    const unrealizedProfitGrams = price24 > 0 ? unrealizedProfit / price24 : 0;
    return { weight, fineWeight, cost, value, pieces, byKarat, byCategory, realizedProfit, realizedProfitGrams, unrealizedProfit, unrealizedProfitGrams };
  }, [activeItems, sales, priceData.current, openingBalance]);

  // ⚠ موضعها بعد activeItems وtotals: تعتمد عليهما، ووضعها قبلهما يُسقط
  // التطبيق بـ«Cannot access before initialization» — useMemo يُنفَّذ
  // لحظة الرسم لا عند الحاجة.
  // ── سياق النوايا: أرقام جاهزة تُجيب بلا شبكة ──
  const aiFacts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const isToday = (d) => String(d || "").slice(0, 10) === today;
    const sum = (a, f) => a.reduce((x, y) => x + (Number(f(y)) || 0), 0);
    const cash = (a) => a.reduce((x, t) => x + (t.type === "out" ? -(Number(t.amount) || 0) : Number(t.amount) || 0), 0);

    const daySales = sales.filter((x) => isToday(x.date));
    const byName = {};
    sales.forEach((x) => {
      const n = x.sellerName || "—";
      byName[n] = byName[n] || { name: n, total: 0, count: 0 };
      byName[n].total += Number(x.total) || 0;
      byName[n].count += 1;
    });

    const stockByK = {};
    activeItems.forEach((it) => {
      const q = (it.units || []).filter((u) => !u.sold).length;
      if (!q) return;
      stockByK[it.karat] = stockByK[it.karat] || { karat: it.karat, weight: 0, units: 0 };
      stockByK[it.karat].weight += (Number(it.weight) || 0) * q;
      stockByK[it.karat].units += q;
    });

    const scrapBy = (stage) =>
      scrapEntries.filter((e) => stageOf(e) === stage && (Number(e.weight) || 0) > 0)
        .reduce((a, e) => a + fine24(e.weight, e.karat), 0);

    return {
      cur: priceData.currency,
      price24: priceData.current,
      openDay: openDay ? { ref: openDay.ref, by: openDay.openedBy || "" } : null,
      pools: {
        safe: cash(safeTx), daily: cash(cashTx), custody: cash(scrapCustodyTx),
      },
      today: {
        sales: {
          count: daySales.length,
          total: sum(daySales, (x) => x.total),
          fine: daySales.reduce(
            (a, x) => a + (x.lines || []).reduce(
              (y, l) => y + fine24((Number(l.weightSnapshot) || 0) * (Number(l.quantity) || 1), l.karatSnapshot), 0), 0),
          topSeller: Object.values(byName).sort((a, b) => b.total - a.total)[0]?.name || "",
        },
        profit: totals?.profitSplit
          ? { operating: totals.profitSplit.operating || 0, metal: totals.profitSplit.metal || 0 }
          : null,
      },
      stock: {
        units: Object.values(stockByK).reduce((a, r) => a + r.units, 0),
        fine: Object.values(stockByK).reduce((a, r) => a + fine24(r.weight, r.karat), 0),
        byKarat: Object.values(stockByK).sort((a, b) => b.karat - a.karat),
      },
      scrap: {
        inBox: scrapBy("in_box"), inSafe: scrapBy("in_safe"),
        total: scrapBy("in_box") + scrapBy("in_safe"),
      },
      payable: {
        gold: lots.filter((l) => l.paymentMethod === "deferred")
          .reduce((a, l) => a + fine24(l.weight, l.karat), 0),
        fees: sum(lots.filter((l) => l.paymentMethod === "deferred"), (l) => l.workmanship),
      },
      receivable: sum(sales.filter((x) => x.paymentMethod === "credit"), (x) => x.total)
        - sum(receipts, (r) => r.amount),
      sellers: Object.values(byName).sort((a, b) => b.total - a.total),
    };
  }, [sales, activeItems, scrapEntries, lots, receipts, cashTx, safeTx,
      scrapCustodyTx, priceData, openDay, totals]);


  // Fiscal closing infrastructure: once a year is "closed", its ending
  // balances become the new base for everything going forward, and only
  // transactions dated AFTER that closure count toward current balances —
  // this is what prevents double-counting the same historic transactions
  // once they've already been folded into a closed year's ending snapshot.
  const latestClosure = fiscalClosures.length > 0 ? fiscalClosures[0] : null;
  // Partners' opening capital is entered per-partner in grams (24k) — convert
  // to a currency figure here so the rest of the accounting engine (which is
  // currency-based) can treat it exactly like any other flow-base field.
  const openingPartnersCapitalSar =
    Object.values(openingBalance.partnersCapitalByPartner || {}).reduce((a, g) => a + (Number(g) || 0), 0) * pricePerGram(24, priceData.current);
  const flowBase = latestClosure ? latestClosure.closingBalances : { ...openingBalance, partnersCapital: openingPartnersCapitalSar };
  const activeCutoffMs = latestClosure ? new Date(latestClosure.closedAt).getTime() : openingBalance.date ? new Date(openingBalance.date).getTime() : null;
  const afterCutoff = (tx) => activeCutoffMs === null || new Date(tx.date).getTime() > activeCutoffMs;

  const cashBalance = useMemo(() => {
    const byMethod = { cash: flowBase.dailyCash || 0, network: flowBase.dailyNetwork || 0 };
    cashTx.filter(afterCutoff).forEach((t) => {
      const m = t.method === "network" ? "network" : "cash";
      byMethod[m] = (byMethod[m] || 0) + (t.type === "in" ? t.amount : -t.amount);
    });
    return { cash: byMethod.cash, network: byMethod.network, total: byMethod.cash + byMethod.network };
  }, [cashTx, flowBase, activeCutoffMs]);
  const scrapCustodyBalance = useMemo(() => {
    const byMethod = { cash: flowBase.custodyCash || 0, network: flowBase.custodyNetwork || 0 };
    scrapCustodyTx.filter(afterCutoff).forEach((t) => {
      const m = t.method || "cash";
      byMethod[m] = (byMethod[m] || 0) + (t.type === "fund" ? t.amount : -t.amount);
    });
    return { cash: byMethod.cash, network: byMethod.network, total: byMethod.cash + byMethod.network };
  }, [scrapCustodyTx, flowBase, activeCutoffMs]);
  const safeBalance = useMemo(() => {
    const byMethod = { cash: flowBase.safeCash || 0, network: flowBase.safeNetwork || 0 };
    safeTx.filter(afterCutoff).forEach((t) => {
      const m = t.method || "cash";
      byMethod[m] = (byMethod[m] || 0) + (t.type === "in" ? t.amount : -t.amount);
    });
    return { cash: byMethod.cash, network: byMethod.network, total: byMethod.cash + byMethod.network };
  }, [safeTx, flowBase, activeCutoffMs]);
  const safeGoldBalance = useMemo(() => {
    // Gold in the safe sits at different purities, so a bare gram total is
    // meaningless for valuation — 10g of 18k is not worth 10g of 24k. We track
    // the ACTUAL weight per karat, and derive a 24k-equivalent (fine weight)
    // for anything that needs a single comparable number.
    const byKarat = {};
    const bump = (karat, kind, w) => {
      const k = Number(karat) || 21;
      if (!byKarat[k]) byKarat[k] = { raw: 0, crafted: 0, total: 0 };
      byKarat[k][kind] += w;
      byKarat[k].total += w;
    };
    if (flowBase.safeGoldByKarat) {
      Object.entries(flowBase.safeGoldByKarat).forEach(([k, v]) => {
        if (v.raw) bump(k, "raw", v.raw);
        if (v.crafted) bump(k, "crafted", v.crafted);
      });
    } else {
      if (flowBase.safeGoldRaw) bump(flowBase.safeGoldRawKarat || 21, "raw", flowBase.safeGoldRaw);
      if (flowBase.safeGoldCrafted) bump(flowBase.safeGoldCraftedKarat || 21, "crafted", flowBase.safeGoldCrafted);
    }
    safeGoldTx.filter(afterCutoff).forEach((t) => {
      const delta = t.type === "in" ? t.weight : -t.weight;
      bump(t.karat || 21, t.kind === "raw" ? "raw" : "crafted", delta);
    });
    let raw = 0,
      crafted = 0,
      fineWeight = 0;
    Object.entries(byKarat).forEach(([k, v]) => {
      raw += v.raw;
      crafted += v.crafted;
      fineWeight += v.total * (PURITY[k] || (Number(k) || 0) / 24);
    });
    return { byKarat, raw, crafted, total: raw + crafted, fineWeight };
  }, [safeGoldTx, flowBase, activeCutoffMs]);
  const taskirOfficeStats = useMemo(() => {
    const byOffice = {};
    taskirOfficeTx.forEach((t) => {
      if (!byOffice[t.officeId]) byOffice[t.officeId] = { weight: 0, amount: 0, count: 0 };
      byOffice[t.officeId].weight += t.weight;
      byOffice[t.officeId].amount += t.amount;
      byOffice[t.officeId].count += 1;
    });
    return byOffice;
  }, [taskirOfficeTx]);
  const scrapTotals = useMemo(() => {
    // ⚠ `status === "in_stock"` كان حقلًا محليًا لا تُنتجه normalizeScrapItems
    // إطلاقًا — فهذا الإحصاء كان يعرض صفرًا دائمًا لأي كسر مُحمَّل من
    // الخادم (لا يظهر إلا للقطعة المضافة للتو بالجلسة قبل أي إعادة تحميل).
    // المكافئ الحقيقي: أي مرحلة قبل "used" (لم تُستهلك بعد بتحويل أو غيره).
    const inStock = scrapEntries.filter((s) => stageOf(s) !== "used");
    const inStockValue = inStock.reduce((a, s) => a + s.total, 0);
    // Prefer actual physical weight × purity for known karats (accurate regardless of
    // purchase price history); fall back to cost-basis ÷ today's price only for entries
    // with an unknown karat, since purity can't be applied there.
    const price24 = priceData.current || 0;
    const fineWeightInStock = inStock.reduce((a, s) => {
      if (s.karat !== "unknown" && PURITY[s.karat]) return a + s.weight * PURITY[s.karat];
      return a + (price24 > 0 ? s.total / price24 : 0);
    }, 0);
    const openingWeight = openingBalance.scrapWeight || 0;
    const openingFine = openingWeight * (PURITY[openingBalance.scrapKarat] || 1);
    const openingValue = weightTimesPrice(
      openingWeight, pricePerGram(openingBalance.scrapKarat, price24));
    return {
      weightInStock: inStock.reduce((a, s) => a + s.weight, 0) + openingWeight,
      fineWeightInStock: fineWeightInStock + openingFine,
      spentTotal: scrapEntries.filter(isLiveScrap).reduce((a, s) => a + s.total, 0),
      inStockValue: inStockValue + openingValue,
    };
  }, [scrapEntries, priceData.current, openingBalance]);
  const salesTotals = useMemo(
    () => ({ count: sales.length, sum: sales.reduce((a, s) => a + s.total, 0) }),
    [sales]
  );
  const taxTotals = useMemo(() => {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const monthKey = now.toISOString().slice(0, 7);
    let todayTax = 0,
      monthTax = 0,
      todayTaxable = 0,
      monthTaxable = 0,
      todayExempt = 0,
      monthExempt = 0;
    const byDay = {};
    sales.forEach((s) => {
      const dayKey = s.date.slice(0, 10);
      const mKey = s.date.slice(0, 7);
      if (!byDay[dayKey]) byDay[dayKey] = { tax: 0, taxable: 0, exempt: 0 };
      byDay[dayKey].tax += s.taxAmount || 0;
      if (s.taxApplicable) byDay[dayKey].taxable += s.total;
      else byDay[dayKey].exempt += s.total;
      if (dayKey === todayKey) {
        todayTax += s.taxAmount || 0;
        if (s.taxApplicable) todayTaxable += s.total;
        else todayExempt += s.total;
      }
      if (mKey === monthKey) {
        monthTax += s.taxAmount || 0;
        if (s.taxApplicable) monthTaxable += s.total;
        else monthExempt += s.total;
      }
    });
    return { todayTax, monthTax, todayTaxable, monthTaxable, todayExempt, monthExempt, byDay };
  }, [sales]);
  const taskirTotals = useMemo(
    () => ({
      count: taskirEntries.length,
      weight: taskirEntries.reduce((a, t) => a + t.weight, 0),
      workmanship: taskirEntries.reduce((a, t) => a + (t.workmanshipAmount || 0), 0),
    }),
    [taskirEntries]
  );
  const expensesTotals = useMemo(() => {
    const byCategory = {};
    expenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });
    return {
      total: expenses.reduce((a, e) => a + e.amount, 0),
      fixedTotal: expenses.filter((e) => e.recurring).reduce((a, e) => a + e.amount, 0),
      byCategory,
    };
  }, [expenses]);
  const partnersTotals = useMemo(() => {
    // Per-partner breakdown stays purely transaction-derived (same as the SAR
    // version) so each partner's individual running balance is a clean history
    // view — the opening/closing lump only ever enters the AGGREGATE total,
    // exactly mirroring how the SAR totalCapital already works. Mixing the lump
    // into byPartnerGrams would let sum(byPartnerGrams) drift away from
    // totalCapitalGrams the moment a fiscal year closes — keeping them
    // structurally identical avoids that.
    const byPartner = {};
    const byPartnerGrams = {};
    partnerTx.forEach((t) => {
      if (!byPartner[t.partnerId]) byPartner[t.partnerId] = 0;
      if (!byPartnerGrams[t.partnerId]) byPartnerGrams[t.partnerId] = 0;
      const sign = t.type === "contribution" ? 1 : -1;
      byPartner[t.partnerId] += sign * t.amount;
      byPartnerGrams[t.partnerId] += sign * (t.weightGrams || 0);
    });
    const openingCapitalGrams = Object.values(openingBalance.partnersCapitalByPartner || {}).reduce((a, g) => a + (Number(g) || 0), 0);
    const price24 = priceData.current || 0;
    // Grams-equivalent flow base: use the closure's stored grams figure when
    // present; fall back to converting its SAR figure at today's price for any
    // closure recorded before this field existed, so nothing breaks on old data.
    const flowBaseGrams = latestClosure
      ? latestClosure.closingBalances.partnersCapitalGrams ?? (price24 > 0 ? (latestClosure.closingBalances.partnersCapital || 0) / price24 : 0)
      : openingCapitalGrams;
    const fromTxSinceCutoff = partnerTx.filter(afterCutoff).reduce((a, t) => a + (t.type === "contribution" ? t.amount : -t.amount), 0);
    const gramsFromTxSinceCutoff = partnerTx.filter(afterCutoff).reduce((a, t) => a + (t.type === "contribution" ? 1 : -1) * (t.weightGrams || 0), 0);
    // رأس مال كل شريك = ما أدخله ابتداءً + رصيده الافتتاحي + صافي حركاته.
    // النسبة تُشتق من هذا الرقم لا تُدخَل يدويًا: من دخل بـ100 جرام من أصل
    // 250 تكون حصته 40٪ — وتتغيّر تلقائيًا مع كل مساهمة أو سحب.
    const capitalByPartner = {};
    partners.forEach((p) => {
      const opening = Number(p.openingGrams) || 0;
      const fromOB = Number((openingBalance.partnersCapitalByPartner || {})[p.id]) || 0;
      capitalByPartner[p.id] = opening + fromOB + (byPartnerGrams[p.id] || 0);
    });
    const sumCapital = Object.values(capitalByPartner).reduce((a, g) => a + Math.max(0, g), 0);
    const shareByPartner = {};
    partners.forEach((p) => {
      const own = Math.max(0, capitalByPartner[p.id] || 0);
      shareByPartner[p.id] = sumCapital > 0 ? (own / sumCapital) * 100 : 0;
    });

    return {
      byPartner,
      byPartnerGrams,
      capitalByPartner,
      shareByPartner,
      sumCapitalGrams: sumCapital,
      totalCapital: fromTxSinceCutoff + (flowBase.partnersCapital || 0),
      totalCapitalGrams: gramsFromTxSinceCutoff + flowBaseGrams,
    };
  }, [partnerTx, flowBase, activeCutoffMs, partners, openingBalance, latestClosure, priceData.current]);
  // Unified "everything expressed as 24k-gold-equivalent grams" figure, combining
  // physical inventory, all liquidity (daily + safe + scrap custody), gold held in
  // the safe (raw + crafted), and in-stock scrap gold.
  // ═══ المركز الذهبي الصافي — الرقم الذي يحكم السنة ═══
  //
  // ⚠ يُحسب من الدفتر الوزني لا من الشاشات: الشاشات تجمع من مستنداتٍ
  // متفرّقة، والدفتر مصدرٌ واحد كل حركةٍ فيه بمرجعها.
  const goldPosition = useMemo(() => {
    const wb = weightTrialBalance({ scrapEntries, safeGoldTx, items, sales, lots, weightAdjustments, goldLedger });
    // الذمم: مبيعات آجلة لم تُسدَّد
    const receivables = sales
      .filter((x) => x.paymentMethod === "credit" && !x.settled)
      .reduce((a, x) => a + (Number(x.total) || 0) - (Number(x.paidAmount) || 0), 0);
    // ما عليك بالريال: أجور مورّدين مؤجَّلة
    const cashPayables = lots
      .filter((l) => l.paymentMethod === "deferred" && !l.feesPaid)
      .reduce((a, l) => a + (Number(l.workmanshipTotal) || 0), 0);
    return computeGoldPosition({
      weightBalance: wb,
      cashTotal: cashBalance.total + safeBalance.total + scrapCustodyBalance.total,
      receivables, cashPayables,
      price24: priceData.current || 0,
    });
  }, [scrapEntries, safeGoldTx, items, sales, lots, weightAdjustments, goldLedger,
      cashBalance, safeBalance, scrapCustodyBalance, priceData.current]);

  const goldEquivalent = useMemo(() => {
    const price24 = priceData.current || 0;
    const liquidity = cashBalance.total + safeBalance.total + scrapCustodyBalance.total;
    const cashGrams = price24 > 0 ? liquidity / price24 : 0;
    // ⚠ الذهب والنقد لا يُجمعان في رقم واحد.
    //
    // goldGrams ذهب حقيقي في يدك. cashGrams مبلغ يُعرض بمقابله بالجرام
    // لتقارنه، لا ليُضاف. جمعهما يجعل الرصيد يقفز بارتفاع سعر الذهب
    // ويهبط بانخفاضه دون أن تبيع أو تشتري شيئًا — فتظن أنك ربحت وأنت لم
    // تفعل. الرقمان يُعرضان متجاورين ومنفصلين دائمًا.
    return {
      inventoryGrams: totals.fineWeight,
      safeGoldGrams: safeGoldBalance.fineWeight,
      scrapGrams: scrapTotals.fineWeightInStock,
      // إجمالي الذهب الفعلي
      goldGrams: totals.fineWeight + safeGoldBalance.fineWeight + scrapTotals.fineWeightInStock,
      // النقد ومقابله بالجرام — للمقارنة لا للجمع
      cashAmount: liquidity,
      cashGrams,
      price24,
    };
  }, [totals.fineWeight, cashBalance.total, safeBalance.total, scrapCustodyBalance.total, safeGoldBalance.fineWeight, scrapTotals.fineWeightInStock, priceData.current]);

  // What the opening balance alone would be worth in 24k grams at TODAY's
  // price — isolates "everything that happened since opening" when compared
  // يقابل goldEquivalent.goldGrams أعلاه.
  // ملخّص المشتريات، مفصولًا بين ما يدخل تكلفة الذهب وما لا يدخلها.
  // الفصل هو ما يجعل «ربح الذهب» رقمًا ذا معنى: شراء تغليف أو أثاث مصروف
  // تشغيلي، وخصمه من هامش الذهب يجعل الهامش يبدو أسوأ مما هو.
  const purchasesTotals = useMemo(() => {
    const price24 = priceData.current || 0;
    const weightAdjustmentsRef = weightAdjustments;

    // ١. ذهب مشغول من الموردين (الدفعات)
    const supplierGold = lots.reduce((a, l) => a + (Number(l.goldCost) || 0), 0);
    const supplierWorkmanship = lots.reduce((a, l) => a + (Number(l.workmanshipTotal) || 0), 0);
    const supplierWeight = lots.reduce((a, l) => a + (Number(l.weight) || 0), 0);
    const supplierFine = lots.reduce(
      (a, l) => a + (Number(l.weight) || 0) * (PURITY[l.karat] || (Number(l.karat) || 0) / 24),
      0
    );

    // ٢. الكسر
    const scrapCost = scrapEntries.reduce((a, e) => a + (Number(e.total) || 0), 0);
    const scrapWeight = scrapEntries.filter(isLiveScrap)
      .reduce((a, e) => a + (Number(e.weight) || 0), 0);
    const scrapFine = scrapEntries.reduce((a, e) => {
      const k = e.karat;
      const purity = k !== "unknown" && PURITY[k] ? PURITY[k] : price24 > 0 ? null : 0;
      if (purity !== null) return a + (Number(e.weight) || 0) * purity;
      return a + (price24 > 0 ? (Number(e.total) || 0) / price24 : 0);
    }, 0);

    // ٣. ذهب خام مُشترى للتسكير + أجور التسكير
    const bullionCost = taskirEntries.reduce(
      (a, t) => a + (t.goldSource === "purchased" ? Number(t.goldCost) || 0 : 0),
      0
    );
    const bullionWeight = taskirEntries.reduce(
      (a, t) => a + (t.goldSource === "purchased" ? Number(t.weight) || 0 : 0),
      0
    );
    const taskirWorkmanship = taskirEntries.reduce((a, t) => a + (Number(t.workmanshipAmount) || 0), 0);

    // ⚠ خمسة مبالغ تُجمع عائمةً: كلٌّ منها مقرَّبٌ لهللتين، ومجموعها
    // ينحرف بهللةٍ أو اثنتين تظهران في الميزان بلا مصدر.
    const goldTotal = sumMoney([supplierGold, supplierWorkmanship,
      scrapCost, bullionCost, taskirWorkmanship]);
    const goldFineWeight = supplierFine + scrapFine + bullionWeight;

    // فروقات الوزن: الهالك تكلفة ذهب فُقد، والفائض إيراد.
    const wastageValue = (weightAdjustmentsRef || []).filter((a) => a.kind === "wastage").reduce((a, x) => a + (Number(x.value) || 0), 0);
    const surplusValue = (weightAdjustmentsRef || []).filter((a) => a.kind === "surplus").reduce((a, x) => a + (Number(x.value) || 0), 0);

    // ٤. مشتريات غير ذهبية (من المصروفات المصنّفة "مشتريات")
    const nonGold = expenses
      .filter((e) => e.category === "purchases")
      .reduce((a, e) => a + (Number(e.amount) || 0), 0);

    return {
      supplierGold,
      supplierWorkmanship,
      supplierWeight,
      supplierFine,
      supplierCount: lots.length,
      scrapCost,
      scrapWeight,
      scrapFine,
      scrapCount: scrapEntries.length,
      bullionCost,
      bullionWeight,
      taskirWorkmanship,
      taskirCount: taskirEntries.length,
      goldTotal,
      goldFineWeight,
      nonGold,
      nonGoldCount: expenses.filter((e) => e.category === "purchases").length,
      wastageValue,
      surplusValue,
      grandTotal: goldTotal + nonGold,
      avgCostPerFineGram: goldFineWeight > 0 ? goldTotal / goldFineWeight : 0,
    };
  }, [lots, scrapEntries, taskirEntries, expenses, weightAdjustments, priceData.current]);

  const openingGoldEquivalent = useMemo(() => {
    const price24 = priceData.current || 0;
    const liquidity =
      (openingBalance.dailyCash || 0) +
      (openingBalance.dailyNetwork || 0) +
      (openingBalance.safeCash || 0) +
      (openingBalance.safeNetwork || 0) +
      (openingBalance.custodyCash || 0) +
      (openingBalance.custodyNetwork || 0);
    const cashGrams = price24 > 0 ? liquidity / price24 : 0;
    const obL = (openingBalance.inventoryLines || []).filter((l) => (Number(l.weight) || 0) > 0);
    const inventoryGrams = obL.length
      ? obL.reduce((a, l) => a + (Number(l.weight) || 0) * (PURITY[l.karat] || (Number(l.karat) || 0) / 24), 0)
      : (openingBalance.inventoryWeight || 0) * (PURITY[openingBalance.inventoryKarat] || 1);
    const scrapGrams = (openingBalance.scrapWeight || 0) * (PURITY[openingBalance.scrapKarat] || 1);
    const safeGoldGrams =
      (openingBalance.safeGoldRaw || 0) * (PURITY[openingBalance.safeGoldRawKarat] || 1) +
      (openingBalance.safeGoldCrafted || 0) * (PURITY[openingBalance.safeGoldCraftedKarat] || 1);
    return { inventoryGrams, cashGrams, safeGoldGrams, scrapGrams, goldGrams: inventoryGrams + safeGoldGrams + scrapGrams };
  }, [openingBalance, priceData.current]);

  // Publish a compact, read-only snapshot of this branch to a SHARED key so the
  // central program can consolidate all branches. Only aggregates are shared —
  // never customer data, individual ledger entries, PINs or attachments.
  useEffect(() => {
    if (loading || !branchIdentity.code) return;
    const snapshot = {
      code: branchIdentity.code,
      name: branchIdentity.name,
      updatedAt: new Date().toISOString(),
      price24: priceData.current,
      currency: priceData.currency,
      // تفصيل المخزون حسب العيار — الإدارة تحتاجه لتوزيع البضاعة بين الفروع
      // بمعرفة أي فرع لديه فائض من عيار وأي فرع ينقصه.
      inventory: {
        pieces: totals.pieces,
        weight: totals.weight,
        fineWeight: totals.fineWeight,
        cost: totals.cost,
        value: totals.value,
        byKarat: totals.byKarat || {},
        byCategory: totals.byCategory || {},
      },
      profit: {
        realized: totals.realizedProfit,
        realizedGrams: totals.realizedProfitGrams,
        unrealized: totals.unrealizedProfit,
        unrealizedGrams: totals.unrealizedProfitGrams,
      },
      sales: { count: salesTotals.count, sum: salesTotals.sum },
      tax: { today: taxTotals.todayTax, month: taxTotals.monthTax },
      expenses: { total: expensesTotals.total, fixed: expensesTotals.fixedTotal },
      // المشتريات مفصولة: ما يدخل تكلفة الذهب وما لا يدخلها. الإدارة تحتاج
      // الفصل لتقيس ربح الذهب لكل فرع على أساس واحد.
      purchases: {
        goldTotal: purchasesTotals.goldTotal,
        goldFineWeight: purchasesTotals.goldFineWeight,
        avgCostPerFineGram: purchasesTotals.avgCostPerFineGram,
        supplierGold: purchasesTotals.supplierGold,
        supplierWorkmanship: purchasesTotals.supplierWorkmanship,
        scrapCost: purchasesTotals.scrapCost,
        bullionCost: purchasesTotals.bullionCost,
        taskirWorkmanship: purchasesTotals.taskirWorkmanship,
        nonGold: purchasesTotals.nonGold,
        grandTotal: purchasesTotals.grandTotal,
      },
      cash: { daily: cashBalance.total, dailyCash: cashBalance.cash, dailyNetwork: cashBalance.network },
      safe: {
        cash: safeBalance.cash,
        network: safeBalance.network,
        total: safeBalance.total,
        goldRaw: safeGoldBalance.raw,
        goldCrafted: safeGoldBalance.crafted,
        goldFineWeight: safeGoldBalance.fineWeight,
        goldByKarat: safeGoldBalance.byKarat,
      },
      custody: { total: scrapCustodyBalance.total },
      scrap: { weightInStock: scrapTotals.weightInStock },
      goldEquivalent: { goldGrams: goldEquivalent.goldGrams, cashGrams: goldEquivalent.cashGrams, cashAmount: goldEquivalent.cashAmount },
      partners: { count: partners.length, capitalGrams: partnersTotals.totalCapitalGrams },
      staff: users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
      // Seller performance and commissions, broken down by period so HQ can
      // answer "what did this seller sell today / this month" without needing
      // the branch's raw invoices.
      sellers: (() => {
        const periods = ["today", "month", "all"];
        const by = {};
        sales.forEach((sale) => {
          const key = sale.sellerId || `name:${sale.sellerName || "غير معروف"}`;
          if (!by[key]) by[key] = { id: sale.sellerId || null, name: sale.sellerName || "غير معروف", sales: [] };
          by[key].sales.push(sale);
        });
        return Object.values(by).map((g) => {
          const out = { id: g.id, name: g.name };
          periods.forEach((per) => {
            const filtered = g.sales.filter((x) => inPeriod(x.date, per));
            const c = computeCommission(commissions?.[g.id], filtered, priceData.current);
            out[per] = {
              count: c.count,
              sales: c.salesTotal,
              profit: c.profitTotal,
              commission: c.commission,
              commissionGrams: c.commissionGrams,
            };
          });
          const rule = { ...DEFAULT_COMMISSION, ...(commissions?.[g.id] || {}) };
          out.rule = { basis: rule.basis, rate: rule.rate, target: rule.target, perInvoice: rule.perInvoice };
          return out;
        });
      })(),
    };
    const t = setTimeout(() => {
      window.storage.set(branchSnapshotKey(branchIdentity.code), JSON.stringify(snapshot), true).catch((e) => console.error("snapshot publish failed", e));

      // الحزمة الكاملة: سجلات لا إجماليات. المرفقات مستثناة (مراجع فقط)
      // والأرقام السرية لا تُنشر إطلاقًا.
      const pack = {
        code: branchIdentity.code,
        name: branchIdentity.name,
        updatedAt: snapshot.updatedAt,
        price24: priceData.current,
        currency: priceData.currency,
        cap: PUBLISH_CAP,
        items: items.slice(0, PUBLISH_CAP),
        sales: sales.slice(0, PUBLISH_CAP),
        expenses: expenses.slice(0, PUBLISH_CAP),
        lots: lots.slice(0, PUBLISH_CAP),
        suppliers,
        customers: customers.map((c) => ({ id: c.id, ref: c.ref, name: c.name, phone: c.phone })),
        partners,
        partnerTx: partnerTx.slice(0, PUBLISH_CAP),
        cashTx: cashTx.slice(0, PUBLISH_CAP),
        safeTx: safeTx.slice(0, PUBLISH_CAP),
        scrapEntries: scrapEntries.slice(0, PUBLISH_CAP),
        taskirEntries: taskirEntries.slice(0, PUBLISH_CAP),
        weightAdjustments: weightAdjustments.slice(0, PUBLISH_CAP),
        audits: audits.slice(0, 50),
        safeAudits: safeAudits.slice(0, 50),
        receipts: receipts.slice(0, PUBLISH_CAP),
        reservations: reservations.slice(0, PUBLISH_CAP),
        // المستخدمون بلا أرقام سرية — الإدارة تحتاج الأسماء لا المفاتيح.
        users: users.map((u) => ({ id: u.id, ref: u.ref, name: u.name, role: u.role, salary: u.salary })),
        openingBalance,
        totals: {
          inventory: snapshot.inventory,
          cash: cashBalance,
          safe: safeBalance,
          safeGold: safeGoldBalance,
          custody: scrapCustodyBalance,
          goldEquivalent,
        },
      };
      window.storage
        .set(branchDataKey(branchIdentity.code), JSON.stringify(pack), true)
        .catch((e) => console.error("branch data publish failed", e));
    }, 800); // تأخير بسيط حتى لا تُغرق التعديلات المتتابعة المفتاح المشترك
    return () => clearTimeout(t);
  }, [
    loading,
    branchIdentity,
    totals,
    salesTotals,
    taxTotals,
    expensesTotals,
    purchasesTotals,
    cashBalance,
    safeBalance,
    safeGoldBalance,
    scrapCustodyBalance,
    scrapTotals,
    goldEquivalent,
    partnersTotals,
    partners.length,
    users,
    sales,
    priceData,
    commissions,
  ]);

  // -------- handlers: inventory --------
  const handleAddItems = (lotId, rows, distributionMode) => txn("handleAddItems", () => {
    const now = new Date().toISOString();
    const lot = lots.find((l) => l.id === lotId);
    // Spread the lot's total labour charge across the pieces being entered,
    // using the mode chosen at purchase time. Each row gets a per-unit share
    // folded into its workmanship, so cost basis (and therefore profit) is
    // accurate per piece rather than leaving the charge unallocated.
    // ميزانية الأجور المتبقية من الدفعة، لا إجماليها: الإدخال قد يتم على
    // دفعات، فتوزيع الإجمالي كل مرة كان سيحمّل القطع أجورًا مكررة.
    const lotWorkmanship = Math.max(0, (Number(lot?.workmanshipTotal) || 0) - (Number(lot?.workmanshipAllocated) || 0));
    const mode = distributionMode || "per_gram";
    const rowWeightQty = (r) => (Number(r.weight) || 0) * Math.max(1, Number(r.quantity) || 1);
    const rowQty = (r) => Math.max(1, Number(r.quantity) || 1);
    const rowFine = (r) => rowWeightQty(r) * (PURITY[r.karat] || (Number(r.karat) || 0) / 24);
    let denom = 0;
    if (lotWorkmanship > 0) {
      if (mode === "per_item") denom = rows.reduce((a, r) => a + rowQty(r), 0);
      else if (mode === "by_karat") denom = rows.reduce((a, r) => a + rowFine(r), 0);
      else denom = rows.reduce((a, r) => a + rowWeightQty(r), 0);
    }
    const shareForRow = (r) => {
      if (lotWorkmanship <= 0 || denom <= 0) return 0;
      const numer = mode === "per_item" ? rowQty(r) : mode === "by_karat" ? rowFine(r) : rowWeightQty(r);
      return (lotWorkmanship * numer) / denom / rowQty(r); // per single unit
    };

    const newItems = rows.map((row) => {
      const quantity = Math.max(1, Number(row.quantity) || 1);
      const units = [];
      for (let i = 0; i < quantity; i++) units.push({ code: generateUnitCode(), printed: false, sold: false });
      const allocatedWorkmanship = shareForRow(row);
      return {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        // ⚠ إصلاح محلي: كان الحقل هنا `category`، بينما كل شاشات القراءة
        // (بيع بالوزن، تعديل القطع، التصنيفات، الجرد بتصنيف...) تقرأ
        // `categoryId` — فلا تجد له قيمة أبدًا لأي صنف حقيقي مُضاف عبر
        // التكويد. وحّدنا الاسم إلى categoryId، مع ترحيل تلقائي عند
        // التحميل للأصناف القديمة المحفوظة بحقل category فقط.
        categoryId: row.category,
        karat: row.karat,
        weight: row.weight,
        stonesWeight: row.stonesWeight || 0,
        quantity,
        costPerGram: row.costPerGram,
        workmanshipPerUnit: (Number(row.workmanshipPerUnit) || 0) + allocatedWorkmanship,
        lotWorkmanshipShare: allocatedWorkmanship,
        photoDataUrl: row.photoDataUrl || null,
        lotId,
        units,
        // ⚠ الوسيط اسمه row لا r — كان يُسقط التكويد كليًا عند الحفظ.
        isSet: row.category === "set",
        setPieces: row.category === "set" ? (row.setPieces || []).filter((x) => (x || "").trim()) : [],
        dateAdded: now,
      };
    });
    persistItems([...newItems, ...items]);

    // راكم ما وُزِّع فعلًا على الدفعة، ليظهر المتبقي أو الفائض في الإدخال التالي.
    const allocatedNow = newItems.reduce((a, it) => a + (Number(it.lotWorkmanshipShare) || 0) * it.units.length, 0);
    // الوزن المُدخل يُراكم كذلك. الفرق بينه وبين وزن الدفعة المشتراة هو
    // الهالك أو الفائض — ذهب حقيقي يجب أن يُحاسَب، وإلا لن يتطابق الجرد
    // مع المشتريات أبدًا.
    const weightNow = newItems.reduce((a, it) => a + (Number(it.weight) || 0) * it.units.length, 0);
    if (lot) {
      persistLots(
        lots.map((l) =>
          l.id === lotId
            ? {
                ...l,
                workmanshipAllocated: (Number(l.workmanshipAllocated) || 0) + allocatedNow,
                enteredWeight: (Number(l.enteredWeight) || 0) + weightNow,
                enteredPieces: (Number(l.enteredPieces) || 0) + newItems.reduce((a, it) => a + it.units.length, 0),
              }
            : l
        )
      );
    }

    // كل عملية إدخال تُسجَّل كجلسة مستقلة: تربط ما أُدخل بالمورد وبالدفعة
    // وبمن أدخله. بدونها يصعب تتبّع «من أدخل ماذا ومتى» عند تدقيق فرق جرد.
    const lotRef = lots.find((l) => l.id === lotId);
    const session = {
      id: Date.now().toString() + "es",
      ref: nextRef("entry", entrySessions),
      ...dayStamp(),
      date: now,
      lotId,
      supplierId: lotRef?.supplierId || null,
      karat: lotRef?.karat ?? null,
      itemCount: newItems.length,
      unitCount: newItems.reduce((a, it) => a + it.units.length, 0),
      totalWeight: newItems.reduce((a, it) => a + (Number(it.weight) || 0) * it.units.length, 0),
      createdBy: currentUser?.name || "",
    };
    persistEntrySessions([session, ...entrySessions]);

    flashToast(newItems.length > 1 ? `تمت إضافة ${newItems.length} أصناف` : "تمت إضافة الصنف");
    return newItems; // يعيدها ليتيح للمستدعي طباعة رقاقاتها فورًا
  
  });
  const handleDeleteItem = (id) => {
    persistItems(items.filter((i) => i.id !== id));
    flashToast("تم الحذف");
  };
  const handleSetPrice = (val, currency) => {
    const history = [...priceData.history, { date: new Date().toISOString(), price: val }].slice(-30);
    persistPrice({ current: val, currency, history });
    setShowPrice(false);
    flashToast("تم تحديث السعر");
  };

  // -------- handlers: sales --------
  // ── بيع جزئي بالوزن ──
  //
  // سبيكة 1000 جم يُشترى منها جرام: تبقى القطعة برقاقتها وينقص وزنها
  // إلى 999. لا تُعلَّم مباعة ولا يُنشأ صنف جديد.
  //
  // التكلفة تُقتطع بالتناسب: سعر الجرام ثابت، فتكلفة الجزء = وزنه ×
  // سعر جرامه. المصنعية تُقتطع بنسبة الوزن المباع — سبيكة بلا مصنعية
  // فلا أثر، وسلسلة تُباع بالمتر تُقتطع مصنعيتها بنسبتها.
  /**
   * ⚠ تحويل حقيقي: كانت هذه الدالة تحسب كل شيء محليًا (الوزن المتبقي،
   * القيود، الحسابات) وتحفظه مباشرة. الآن الباك إند (POST /sales/partial)
   * هو من يتحقق ويحسب فعليًا — بما في ذلك الإعفاء الضريبي الدائم لهذا
   * النوع من البيع (راجع تعليق الـendpoint نفسه)؛ الفحوصات المحلية أدناه
   * بقيت فقط كتغذية راجعة فورية قبل إرسال الطلب (لا تُغني عن تحقق
   * السيرفر ولا تُكرَّر بعده). لا تحديث لأي حالة محلية إلا بعد نجاح
   * الطلب فعليًا — لا حاجة لآلية txn/rollback القديمة هنا لأن التحديث
   * المحلي يحدث دفعة واحدة بعد التأكد من نجاح العملية على السيرفر، لا
   * قبله.
   */
  const handlePartialSale = async (draft) => {
    if (stocktakeLock) {
      flashToast(`المخزون مقفل للجرد`);
      return null;
    }
    const item = items.find((it) => it.id === draft.itemId);
    if (!item) return null;
    const sellW = Number(draft.weight) || 0;
    const unitPrice = Number(draft.unitPrice) || 0;
    const available = Number(item.weight) || 0;
    const cat = categories.find((c) => c.id === item.categoryId);
    const minW = Number(cat?.minSaleWeight) || 0;

    if (sellW <= 0) { flashToast("حدّد الوزن المباع"); return null; }
    if (sellW > available + 0.0005) {
      flashToast(`المتاح ${fmtW(available)} جم فقط`);
      return null;
    }
    if (minW > 0 && sellW < minW && Math.abs(sellW - available) > 0.0005) {
      flashToast(`أقل بيع من هذا التصنيف ${fmtW(minW)} جم`);
      return null;
    }
    if (unitPrice <= 0) { flashToast("حدّد السعر"); return null; }

    let res;
    try {
      res = await api.createPartialSale({
        itemId: item.id,
        paymentMethod: draft.paymentMethod || "cash",
        cardNetwork: draft.cardNetwork || null,
        customerId: draft.customerId || null,
        sellWeight: sellW,
        unitPrice,
        price24Snapshot: draft.frozenPrice != null ? Number(draft.frozenPrice) : priceData.current,
      });
    } catch (e) {
      flashToast(apiErrorMessage(e, "تعذّر إتمام البيع الجزئي"));
      return null;
    }

    const { sale: srvSale, soldOut, remainingWeight } = res;
    const now = new Date().toISOString();
    const ratio = available > 0 ? sellW / available : 0;
    const wmShare = (Number(item.lotWorkmanshipShare) || 0) * ratio;

    const sale = {
      id: srvSale.id,
      ref: srvSale.ref,
      date: now,
      sellerId: currentUser?.id || null,
      sellerName: currentUser?.name || "",
      customerId: draft.customerId || null,
      customerName: draft.customerName || null,
      paymentMethod: srvSale.paymentMethod,
      cardNetwork: draft.cardNetwork || null,
      subtotal: srvSale.total,
      total: srvSale.total,
      taxApplicable: false,
      taxAmount: srvSale.taxAmount,
      netAmount: srvSale.netAmount,
      price24Snapshot: draft.frozenPrice != null ? Number(draft.frozenPrice) : priceData.current,
      saleKind: "partial",
      lines: [{
        itemId: item.id,
        quantity: 1,
        unitPrice: srvSale.total,
        weightSnapshot: sellW,
        costPerGramSnapshot: Number(item.costPerGram) || 0,
        workmanshipSnapshot: r2(wmShare),
        karatSnapshot: item.karat,
        partial: true,
        remainingAfter: remainingWeight,
      }],
      createdBy: currentUser?.name || "",
      ...dayStamp(),
    };

    setItems(items.map((it) =>
      it.id === item.id
        ? {
            ...it,
            weight: remainingWeight,
            lotWorkmanshipShare: r2((Number(it.lotWorkmanshipShare) || 0) - wmShare),
            units: soldOut ? (it.units || []).map((u) => ({ ...u, sold: true })) : it.units,
          }
        : it
    ));
    setSales([sale, ...sales]);
    if (srvSale.paymentMethod === "cash" || srvSale.paymentMethod === "card") {
      setCashTx([{
        id: sale.id + "_cash",
        date: now,
        type: "in",
        method: srvSale.paymentMethod === "cash" ? "cash" : "network",
        amount: srvSale.total,
        note: `بيع جزئي ${sale.ref}`,
        source: "sales",
        refId: sale.id,
        category: "sales_revenue",
        createdBy: currentUser?.id || null,
      }, ...cashTx]);
    }
    flashToast(
      soldOut
        ? `بيع ${fmtW(sellW)} جم — نفدت القطعة`
        : `بيع ${fmtW(sellW)} جم · المتبقي ${fmtW(remainingWeight)} جم`
    );
    return sale;
  };

  /**
   * ⚠ تحويل حقيقي: هذه الدالة كانت تحسب الفاتورة والقيود بالكامل محليًا
   * (وفيها إصلاحات محلية عدة مذكورة أعلاه في السجل — karatSnapshot،
   * تفعيل بدل الكسر، تعارض postWeight المزدوج). كل هذا المنطق مبني الآن
   * في POST /api/sales على السيرفر (بما فيها بدل الكسر كطريقة دفع
   * "trade_in" ضمن نفس الـendpoint، تمامًا كبنية هذه الدالة نفسها) —
   * راجع sales.routes.js. الدالة هنا صارت مسؤولة فقط عن: تحقق فوري بسيط
   * قبل الإرسال، بناء جسم الطلب، وتحديث الحالة المحلية دفعة واحدة بعد
   * نجاح الطلب فعليًا (لا قبله ولا تخمينًا).
   */
  const handleCreateSale = async (draft) => {
    if (stocktakeLock) {
      flashToast(`المخزون مقفل للجرد`);
      return;
    }
    const tLines = draft.tradeLines || [];
    const payload = {
      paymentMethod: tLines.length ? "trade_in" : draft.paymentMethod,
      cardNetwork: draft.cardNetwork || null,
      customerId: draft.customerId || null,
      lines: draft.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitPrice: l.unitPrice })),
      taxApplicable: !!draft.taxApplicable,
      cashPart: Number(draft.cashPart) || 0,
      networkPart: Number(draft.networkPart) || 0,
      price24Snapshot: draft.frozenPrice != null ? Number(draft.frozenPrice) : priceData.current,
      tradeLines: tLines.map((l) => ({
        karat: l.karat, netWeight: l.weight, grossWeight: l.gross,
        pricePerGram: l.pricePerGram, total: l.total,
      })),
    };

    let res;
    try {
      res = await api.createSale(payload);
    } catch (e) {
      flashToast(apiErrorMessage(e, "تعذّر إنشاء الفاتورة"));
      return;
    }

    const srvSale = res.sale;
    const now = new Date().toISOString();
    const lines = draft.lines.map((l) => {
      const item = items.find((i) => i.id === l.itemId);
      return {
        itemId: l.itemId,
        category: item?.category || "other",
        karatSnapshot: item?.karat,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        weightSnapshot: item?.weight || 0,
        costPerGramSnapshot: item?.costPerGram || 0,
        workmanshipSnapshot: item?.workmanshipPerUnit || 0,
      };
    });
    const sale = {
      id: srvSale.id,
      ref: srvSale.ref,
      date: now,
      createdBy: currentUser?.name || "",
      createdById: currentUser?.id || null,
      ...dayStamp(),
      customerId: draft.customerId || null,
      customerName: draft.customerId ? customers.find((c) => c.id === draft.customerId)?.name || "" : "",
      paymentMethod: srvSale.paymentMethod,
      price24Snapshot: payload.price24Snapshot,
      priceFrozenAt: draft.frozenAt || null,
      cardNetwork: draft.cardNetwork || null,
      cashPart: Number(draft.cashPart) || 0,
      networkPart: Number(draft.networkPart) || 0,
      networkFeePct: draft.cardNetwork ? cardFeeOf(appSettings, draft.cardNetwork) : 0,
      subtotal: srvSale.total,
      total: srvSale.total,
      taxApplicable: !!draft.taxApplicable,
      taxAmount: srvSale.taxAmount,
      netAmount: srvSale.netAmount,
      tradeInValue: res.tradeInValue || 0,
      lines,
      sellerId: currentUser?.id || null,
      sellerName: currentUser?.name || "غير معروف",
    };
    setSales([sale, ...sales]);

    // ⚠ الأصناف المباعة تُعلَّم مباعة محليًا فورًا — السيرفر فعل هذا فعليًا
    // في قاعدة البيانات، هذا فقط يعكس نفس الأثر في الحالة المحلية.
    setItems(items.map((it) => {
      const line = lines.find((l) => l.itemId === it.id);
      if (!line) return it;
      let remaining = line.quantity;
      const units = (it.units || []).map((u) => {
        if (remaining > 0 && !u.sold) { remaining -= 1; return { ...u, sold: true }; }
        return u;
      });
      return { ...it, units };
    }));

    // ── الصندوق ──
    const entries = [];
    const mk = (method, amount, note, category) => ({
      id: sale.id + "_" + category + "_" + method,
      date: now, type: category === "network_fees" ? "out" : "in",
      method, amount, note, source: "sales", refId: sale.id, category,
      createdBy: currentUser?.id || null, ...dayStamp(),
    });
    if (srvSale.paymentMethod === "trade_in") {
      const diff = res.tradeInDiff || 0;
      if (diff > 0.005) entries.push(mk("cash", diff, `فرق بدل بكسر — فاتورة ${sale.ref}`, "sales_revenue"));
      else if (diff < -0.005) entries.push({ ...mk("cash", Math.abs(diff), `فرق بدل بكسر (إرجاع) — فاتورة ${sale.ref}`, "gold_purchase_scrap"), type: "out" });
    } else if (srvSale.paymentMethod === "cash") {
      entries.push(mk("cash", srvSale.total, "بيع — نقدي", "sales_revenue"));
    } else if (srvSale.paymentMethod === "card") {
      entries.push(mk("network", srvSale.total, "بيع — شبكة", "sales_revenue"));
      const feePct = cardFeeOf(appSettings, draft.cardNetwork);
      if (feePct > 0) {
        const label = CARD_NETWORKS.find((n) => n.id === draft.cardNetwork)?.label || "";
        entries.push(mk("network", srvSale.total * (feePct / 100), `عمولة ${label} ${fmt(feePct, 2)}٪`, "network_fees"));
      }
    } else if (draft.paymentMethod === "split") {
      const cashIn = Number(draft.cashPart) || 0;
      const netIn = Number(draft.networkPart) || 0;
      if (cashIn > 0) entries.push(mk("cash", cashIn, "بيع — نقدي", "sales_revenue"));
      if (netIn > 0) {
        entries.push(mk("network", netIn, "بيع — شبكة", "sales_revenue"));
        const feePct = cardFeeOf(appSettings, draft.cardNetwork);
        if (feePct > 0) {
          const label = CARD_NETWORKS.find((n) => n.id === draft.cardNetwork)?.label || "";
          entries.push(mk("network", netIn * (feePct / 100), `عمولة ${label} ${fmt(feePct, 2)}٪`, "network_fees"));
        }
      }
    }
    // "credit" لا يُدخل شيئًا — يُحصَّل لاحقًا من كشف العميل.
    if (entries.length) setCashTx([...entries, ...cashTx]);

    setShowNewSale(false);
    setQuickSaleItemId(null);
    flashToast("تم إنشاء الفاتورة");
  };

  // -------- handlers: cash --------
  const handleAddCash = (type, amount, note, method, category, partnerId = null) => txn("handleAddCash", () => {
    if (!can("cashMove")) return;
    // ⚠ الحارس هنا لا في النموذج وحده.
    //
    // النموذج يمنع الضغط، وهذا يمنع المرور من أي طريق آخر — استيراد
    // نسخة، أو نداء من وحدة التحكم، أو شاشة تُضاف لاحقًا وتنسى الشرط.
    if (PARTNER_REQUIRED.has(category)) {
      const p = (partners || []).find((x) => x.id === partnerId);
      if (!p) {
        flashToast("هذه الحركة تخصّ شريكًا — اختر الشريك أولًا");
        return;
      }
    }
    const partner = partnerId
      ? (partners || []).find((x) => x.id === partnerId)
      : null;
    const tx = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      createdBy: currentUser?.name || "",
      ...dayStamp(),
      type,
      method: method || "cash",
      amount: Number(amount),
      note: note || (type === "in" ? "إيداع يدوي" : "مصروف يدوي"),
      source: partner ? "partner" : "manual",
      category: category || null,
      partnerId: partner?.id || null,
      partnerName: partner?.name || null,
    };
    persistCash([tx, ...cashTx]);
    // ⚠ حركة الشريك تُقيَّد في حسابه كذلك، وإلا ظهر المال في الصندوق
    // ولم يظهر في كشفه — فيسأل عن مساهمته ولا يجدها.
    if (partner) {
      persistPartnerTx([
        {
          id: Date.now().toString() + "pt",
          ref: nextRef("partner", partnerTx),
          date: tx.date,
          partnerId: partner.id,
          partnerName: partner.name,
          type: type === "in" ? "contribution" : "withdrawal",
          amount: Number(amount),
          method: tx.method,
          note: tx.note,
          fundingSource: "daily_cash",
          cashRef: tx.ref || null,
          createdBy: currentUser?.name || "",
          ...dayStamp(),
        },
        ...partnerTx,
      ]);
    }
    setCashModalType(null);
    flashToast(type === "in" ? "تم تسجيل الإيداع" : "تم تسجيل المصروف");
  
  });

  // -------- handlers: scrap custody --------
  // ⚠ حُوِّلت للباك إند: POST /safe/fund-custody يكتب سطري cash_tx فعليًا
  // (خروج من daily أو safe، دخول لـcustody) ويرجّعهما — لا حساب محلي بعد
  // الآن. category التي كانت تُمرَّر محليًا لم تعد مستخدمة (الباك إند
  // يثبّت التصنيف الصحيح حسب source دائمًا — راجع تعليق safe.routes.js).
  const handleFundCustody = async (amount, method, note, source) => {
    const amt = Number(amount);
    if (!(amt > 0)) return null;
    try {
      const res = await api.safe.fundCustody({ amount: amt, method: method || "cash", note: note || null, source: source === "safe" ? "safe" : "daily" });
      const custodyEntry = normalizeCashTxRow(res.custodyTx);
      setScrapCustodyTx((prev) => [custodyEntry, ...prev]);
      if (res.source === "safe") {
        setSafeTx((prev) => [normalizeCashTxRow(res.sourceTx), ...prev]);
      } else {
        setCashTx((prev) => [normalizeCashTxRow(res.sourceTx), ...prev]);
      }
      flashToast("تم تمويل عهدة الكسر");
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تمويل عهدة الكسر"));
      return null;
    }
  };

  // -------- handlers: safe (الخزنة) --------
  // ⚠ حُوِّلت للباك إند: POST /safe/transfer-to-safe يكتب سطري cash_tx
  // فعليًا (خروج daily، دخول safe) ويرجّعهما معًا.
  const handleTransferToSafe = async (amount, method, note) => {
    const amt = Number(amount);
    if (!(amt > 0)) return null;
    try {
      const res = await api.safe.transferToSafe({ amount: amt, method: method || "cash", note: note || null });
      setCashTx((prev) => [normalizeCashTxRow(res.dailyTx), ...prev]);
      setSafeTx((prev) => [normalizeCashTxRow(res.safeTx), ...prev]);
      flashToast("تم التحويل إلى الخزنة");
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر التحويل إلى الخزنة"));
      return null;
    }
  };
  // End-of-day close: sweeps the ENTIRE daily till (cash + network) into the
  // safe in one action, per-method, in a single tap.
  // ⚠ حُوِّلت للباك إند: كانت تكتب سطري cashTx/safeTx محليين بلا id حقيقي
  // ولا مزامنة (لا endpoint خاص بها في الباك إند لأنها فعليًا نفس فعل
  // /safe/transfer-to-safe مكرَّرًا لكل طريقة دفع) — الآن تستدعي
  // api.safe.transferToSafe (المُحوَّلة أصلًا) مرة لكل طريقة دفع بها
  // رصيد، بالتتابع لا بالتوازي (كلاهما يعتمد على قراءة/كتابة نفس دفتر
  // cash_tx فتُنفَّذ بأمان تسلسليًا).
  const handleCloseDay = async () => {
    if (!can("closeDay") || !ROLES[role]?.canManageDay) {
      flashToast("إقفال اليوم بيد المدير — راجعه");
      return null;
    }
    const moves = [
      { method: "cash", amount: cashBalance.cash },
      { method: "network", amount: cashBalance.network },
    ].filter((m) => m.amount > 0.0001);
    if (moves.length === 0) {
      flashToast("لا يوجد رصيد بصندوق اليومي لتوريده");
      return null;
    }
    try {
      for (const m of moves) {
        const res = await api.safe.transferToSafe({ amount: m.amount, method: m.method, note: "توريد نهاية اليوم للخزنة" });
        setCashTx((prev) => [normalizeCashTxRow(res.dailyTx), ...prev]);
        setSafeTx((prev) => [normalizeCashTxRow(res.safeTx), ...prev]);
      }
      flashToast("تم توريد رصيد اليوم كاملًا للخزنة");
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر توريد رصيد اليوم"));
      return null;
    }
  };
  // Closes today's scrap box (عهدة الكسر اليومي) into the safe: any unspent cash
  // in the custody moves to the safe's cash, and any scrap gold that has cleared
  // review (stage='approved') is banked into the safe's scrap (كسر) gold reserve.
  //
  // ⚠ حُوِّلت للباك إند بالكامل — كانت هذي آخر عملية تكتب محليًا فقط
  // (persistScrapCustody/persistSafe/persistScrap عبر window.storage)، فتختفي
  // فعليًا عند إعادة تحميل bootstrap من الخادم. هذا سبب البلاغ الأصلي عن
  // «الإضافة للخزنة لا تُحفظ بعد إعادة تحميل الصفحة».
  //
  // شقّان حقيقيان لا واحد: POST /safe/close-scrap-day يورّد رصيد العهدة
  // (يُحسب من cash_tx على الخادم نفسه، لا رقم من العميل)، وapi.scrap.
  // depositToVault (موجودة أصلًا ومربوطة) تودع كل قطعة كسر بمرحلة
  // 'approved' فعليًا — لا "in_stock" وهمية لم تكن تطابق أي مرحلة حقيقية
  // في scrap_items.stage أصلًا.
  const handleCloseScrapDay = async () => {
    if (!ROLES[role]?.canManageDay) {
      flashToast("إقفال صندوق الكسر بيد المدير — راجعه");
      return null;
    }
    const hasCash = scrapCustodyBalance.cash > 0.0001 || scrapCustodyBalance.network > 0.0001;
    const hasApprovedGold = scrapEntries.some((s) => stageOf(s) === "approved");
    if (!hasCash && !hasApprovedGold) {
      flashToast("لا يوجد رصيد أو كسر جاهز للتوريد");
      return null;
    }
    try {
      let movedCash = false;
      let movedGold = 0;
      if (hasCash) {
        const res = await api.safe.closeScrapDay();
        for (const m of res.moves) {
          setScrapCustodyTx((prev) => [normalizeCashTxRow(m.custodyTx), ...prev]);
          setSafeTx((prev) => [normalizeCashTxRow(m.safeTx), ...prev]);
        }
        movedCash = res.moves.length > 0;
      }
      if (hasApprovedGold) {
        const res = await api.scrap.depositToVault();
        if (res.count) {
          const now = new Date().toISOString();
          const actor = currentUser?.name || "";
          setScrapEntries((prev) => prev.map((e) =>
            stageOf(e) === "approved"
              ? { ...e, stage: "in_safe", status: "in_safe", vault: "scrap", depositedAt: now, depositedBy: actor }
              : e));
          movedGold = res.deposited.reduce((a, d) => a + (Number(d.weight) || 0), 0);
        }
      }
      if (!movedCash && !movedGold) {
        flashToast("لا يوجد رصيد أو كسر جاهز للتوريد");
        return null;
      }
      flashToast("تم إقفال صندوق الكسر اليومي وتوريده للخزنة");
      return { movedGold };
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر إقفال صندوق الكسر"));
      return null;
    }
  };
  // ---------------------------------------------------------------
  // Daily till custody (عهدة الصندوق اليومي).
  // A float is handed from the safe to whoever runs the register, and at the
  // end of the shift the drawer is physically counted. Expected = whatever the
  // ledger says the till holds; variance = counted - expected. Recording the
  // variance as its own booking is what makes the drawer auditable: a shortage
  // is never silently absorbed, and the books still reconcile to reality.
  // ---------------------------------------------------------------
  const openCustodySession = dailyCustody.find((c) => c.status === "open") || null;

  // ⚠ حُوِّلت للباك إند: POST /custody/open يتحقق من عدم وجود عهدة مفتوحة
  // ومن يوم عمل مفتوح أصلًا (409 no_open_business_day/custody_already_open)
  // على الخادم، ويكتب تحويل الخزنة→الصندوق اليومي فعليًا.
  const handleOpenDailyCustody = async (floatCash, floatNetwork, note) => {
    if (openCustodySession) {
      flashToast("توجد عهدة مفتوحة — أقفلها أولًا");
      return null;
    }
    try {
      const res = await api.custody.open({
        floatCash: Number(floatCash) || 0,
        floatNetwork: Number(floatNetwork) || 0,
        note: note || null,
      });
      setDailyCustody((prev) => [normalizeDailyCustody([res.custody])[0], ...prev]);
      flashToast("تم فتح العهدة");
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر فتح العهدة"));
      return null;
    }
  };

  // ⚠ حُوِّلت للباك إند: POST /custody/close يحسب المتوقَّع من دفتر cash_tx
  // (pool='daily') حيًّا على الخادم، ويُرحّل فرق العدّ (زيادة/عجز) قيد
  // يومية فعليًا (نفس حسابات cash_surplus/cash_shortage المستخدَمة أصلًا
  // في /safe/audit) بدل سطر cashTx محلي بلا أثر محاسبي حقيقي.
  const handleCloseDailyCustody = async (countedCash, countedNetwork, note) => {
    if (!openCustodySession) return null;
    try {
      const res = await api.custody.close({
        countedCash: Number(countedCash) || 0,
        countedNetwork: Number(countedNetwork) || 0,
        note: note || null,
      });
      const normalized = normalizeDailyCustody([res.custody])[0];
      setDailyCustody((prev) => prev.map((c) => (c.id === normalized.id ? normalized : c)));
      const totalVar = (normalized.varianceCash || 0) + (normalized.varianceNetwork || 0);
      if (Math.abs(totalVar) < 0.0001) flashToast("تم إقفال العهدة — مطابقة تامة");
      else flashToast(totalVar > 0 ? `تم الإقفال — زيادة ${fmt(totalVar, 0)}` : `تم الإقفال — عجز ${fmt(Math.abs(totalVar), 0)}`);
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر إقفال العهدة"));
      return null;
    }
  };

  // Safe -> daily till. The reverse direction (daily -> safe) already exists as
  // the end-of-day sweep and the partial transfer; this completes the pair so
  // topping the till up from the safe is a real two-sided movement rather than
  // a manual entry that only touches one pool.
  // ⚠ حُوِّلت للباك إند: POST /safe/transfer-to-daily.
  const handleTransferSafeToDaily = async (amount, method, note) => {
    const amt = Number(amount);
    if (!(amt > 0)) return null;
    try {
      const res = await api.safe.transferToDaily({ amount: amt, method: method || "cash", note: note || null });
      setSafeTx((prev) => [normalizeCashTxRow(res.safeTx), ...prev]);
      setCashTx((prev) => [normalizeCashTxRow(res.dailyTx), ...prev]);
      flashToast("تم التحويل إلى صندوق اليومي");
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر التحويل إلى صندوق اليومي"));
      return null;
    }
  };
  // ⚠ حُوِّلت للباك إند: POST /safe/cash (حركة نقد يدوية مباشرة بالخزنة).
  const handleAddSafeTx = async (type, amount, note, method, category) => {
    const amt = Number(amount);
    if (!(amt > 0)) return null;
    try {
      const res = await api.safe.cash({
        type: type === "out" ? "out" : "in",
        amount: amt,
        method: method || "cash",
        category: category || "manual",
        note: note || null,
      });
      setSafeTx((prev) => [normalizeCashTxRow(res.safeTx), ...prev]);
      flashToast(type === "in" ? "تم الإيداع بالخزنة" : "تم السحب من الخزنة");
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تنفيذ حركة الخزنة"));
      return null;
    }
  };
  // ⚠ حُوِّلت للباك إند: POST /safe/gold. فجوة حقيقية موثَّقة (لا إصلاح
  // صامت): سداد مورد بذهب خام من الخزنة (destination='supplier') يُنشئ
  // في الباك إند سطر supplier_ledger فعليًا (تخفيض التزامه) — لكن
  // supplier_ledger ليس ضمن bootstrap بعد، وشاشات "التسكيرات" المحلية
  // تعرض التزام المورد من مصفوفة taskirEntries وحدها (جدول مختلف
  // بنيويًا). إضافة سطر taskirEntries محلي هنا (كما في المرجع القديم)
  // كانت ستُنتج بيانات شبحية تختفي عند أي إعادة دخول قادمة — بدل ذلك لا
  // نضيف شيئًا محليًا لالتزام المورد، ونكتفي بتنبيه صريح؛ التسوية
  // المحاسبية الفعلية صحيحة وموجودة على الخادم (supplier_ledger +
  // gold_ledger_entries) بصرف النظر عن هذا العرض. يحتاج جسر bootstrap +
  // شاشة التسكيرات تحويلًا مخصَّصًا لاحقًا، لا افتراضًا هنا.
  const handleAddSafeGoldTx = async (type, kind, weight, note, karat, destination, supplierId) => {
    const w = Number(weight) || 0;
    const k = Number(karat) || 21;
    const isRaw = kind === "raw";
    const dest = type === "out" ? destination || (isRaw ? "supplier" : "display") : null;
    const sup = dest === "supplier" ? suppliers.find((x) => x.id === supplierId) : null;
    if (!(w > 0)) return null;
    try {
      const res = await api.safe.gold({
        type, kind, karat: k, weight: w, note: note || null,
        destination: dest, supplierId: dest === "supplier" ? supplierId : null,
      });
      setSafeGoldTx((prev) => [
        {
          id: res.safeGoldTx.id,
          date: new Date().toISOString(),
          type, kind, karat: k, weight: w,
          destination: dest,
          destinationLabel: dest ? goldDestLabel(kind, dest) : null,
          supplierId: sup?.id || null,
          supplierName: sup?.name || null,
          note: note || "",
          createdBy: currentUser?.name || "",
        },
        ...prev,
      ]);
      if (type === "out" && dest === "supplier" && sup && res.supplierLedgerId) {
        flashToast(`سُحب ${fmtW(w)} جم → سداد ${sup.name} (سُجِّل في كشف حسابه على الخادم)`);
      } else {
        const where = type === "out" ? ` → ${goldDestLabel(kind, dest)}${sup ? " · " + sup.name : ""}` : "";
        flashToast(type === "in" ? "أُودع الذهب بالخزنة" : `سُحب ${fmtW(w)} جم${where}`);
      }
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تنفيذ حركة الذهب بالخزنة"));
      return null;
    }
  };

  // -------- handlers: taskirat (تسكيرات) --------
  // Deducts `amount` from a chosen funding source (safe / daily till in one of
  // three methods). Used by supplier settlements (taskirat), expenses, repairs
  // and partner payouts so the logic stays in one place. `category` tags the
  // entry against the chart of accounts so every auto-generated movement is
  // classified, not just manual ones.
  // Note: the safe has no separate cash/network funding option in
  // FUNDING_SOURCES, so safe-funded movements are booked explicitly against the
  // safe's CASH bucket rather than relying on a silent default.
  const deductFromSource = (sourceId, amount, note, refType, refId, category = "other_expense") => {
    if (amount <= 0) return;
    const src = normalizeFundingSource(sourceId);
    const method = src.endsWith("_network") ? "network" : "cash";
    // الختم هنا يغطي معظم شجرة الحسابات: كل مصروف وشراء وتسوية وتحويل
    // يمرّ من هذين المُساعدَين، فلا يفلت قيد بلا يوم عمل.
    const entry = { id: Date.now().toString() + "d",
      ref: nextCashRef("cash", [...cashTx, ...safeTx, ...scrapCustodyTx]), date: new Date().toISOString(), type: "out", method, amount, note, source: refType, refId, category, createdBy: currentUser?.name || "", ...dayStamp() };
    if (src.startsWith("safe_")) persistSafe([entry, ...safeTx]);
    else if (src.startsWith("daily_")) persistCash([entry, ...cashTx]);
  };
  // Same idea but for money coming IN (e.g. repair job profit) — deposits into
  // the chosen till/safe instead of withdrawing from it.
  const addToSource = (sourceId, amount, note, refType, refId, category = "other_income") => {
    if (amount <= 0) return;
    const src = normalizeFundingSource(sourceId);
    const method = src.endsWith("_network") ? "network" : "cash";
    const entry = { id: Date.now().toString() + "a",
      ref: nextCashRef("cash", [...cashTx, ...safeTx, ...scrapCustodyTx]), date: new Date().toISOString(), type: "in", method, amount, note, source: refType, refId, category, createdBy: currentUser?.name || "", ...dayStamp() };
    if (src.startsWith("safe_")) persistSafe([entry, ...safeTx]);
    else if (src.startsWith("daily_")) persistCash([entry, ...cashTx]);
  };

  // ⚠ صار نداء شبكة حقيقي — /taskirat (migration 011) يكتب فعليًا
  // taskir_entries + دفتر الوزن + استهلاك الكسر (أو التزام المكتب) +
  // تخفيض دين المورد الحقيقي (supplier_ledger) + قيد الأجور، في معاملة
  // واحدة على السيرفر. أُزيل البناء المحلي بالكامل (كان لا يربط التسكير
  // بمورد حقيقي إطلاقًا — راجع تعليق migration 011) والاستهلاك المحلي
  // "الأفضل جهدًا" لمخزون الكسر (استُبدل بتحقق كفاية صارم على السيرفر،
  // يرفض الطلب بـinsufficient_scrap_stock بدل الاستهلاك الجزئي الصامت).
  const handleAddTaskir = async (entry) => {
    if (!entry.supplierId) {
      flashToast("اختر المورد أولًا");
      return null;
    }
    try {
      const res = await api.taskirApi.add({
        supplierId: entry.supplierId,
        karat: entry.karat,
        weight: entry.weight,
        goldSource: entry.goldSource,
        pricePerGram: entry.goldSource === "purchased" ? entry.pricePerGram : null,
        officeId: entry.goldSource === "purchased" ? entry.officeId : null,
        workmanshipAmount: Number(entry.workmanshipAmount) || 0,
        fundingSource: entry.fundingSource,
        notes: entry.notes || "",
      });
      // إعادة تحميل قائمة التسكيرات وحركات مكاتب التسكير من السيرفر —
      // أبسط وأضمن من محاولة دمج الاستجابة المختصرة محليًا بشكل يطابق
      // شكل GET بالضبط (خصوصًا supplier_name/office_name المُلحَقين
      // هناك بـJOIN لا تملكهما استجابة POST المختصرة).
      const [entriesRes, officeTxRes] = await Promise.all([
        api.taskirApi.list(),
        entry.goldSource === "purchased" && entry.officeId
          ? api.taskirApi.officeTx(entry.officeId)
          : Promise.resolve(null),
      ]);
      setTaskirEntries(normalizeTaskirEntries(entriesRes.taskirEntries || []));
      if (officeTxRes) {
        setTaskirOfficeTx((prev) => {
          const others = prev.filter((t) => t.officeId !== entry.officeId);
          return [...normalizeTaskirOfficeTx(officeTxRes.officeTx || []), ...others];
        });
      }
      flashToast("تم تسجيل التسكير");
      return res.taskirEntry;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تسجيل التسكير"));
      return null;
    }
  };

  const handleAddTaskirOffice = async (name, phone) => {
    try {
      const res = await api.taskirApi.offices.create(name.trim(), phone || "");
      const office = {
        id: res.office.id, ref: res.office.ref, name: res.office.name,
        phone: res.office.phone || "", createdAt: res.office.created_at,
        createdBy: currentUser?.name || "",
      };
      setTaskirOffices((prev) => [office, ...prev]);
      flashToast(`تمت إضافة المكتب ${office.ref}`);
      return office;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر إضافة المكتب"));
      return null;
    }
  };

  // -------- handlers: expenses --------
  // ⚠ صار نداء شبكة حقيقي — /expenses (migration 010) يكتب فعليًا expenses
  // + cash_tx + قيد يومية متوازن في معاملة واحدة على السيرفر. أزيل
  // postJournal/deductFromSource المحليان بالكامل: كانا سيكتبان نسخة
  // ثانية متعارضة من نفس الأثر المحاسبي (بالضبط نمط "مصدرين للحقيقة"
  // الموثَّق في taskir/scrap) — السيرفر الآن هو المصدر الوحيد لكل من
  // expenses وcash_tx وjournal، والحالة المحلية تُحدَّث من استجابته حصرًا.
  const handleAddExpense = async (entry) => {
    if (!can("expense")) return null;
    const catLabel = EXPENSE_CATEGORIES.find((c) => c.id === entry.category)?.label || entry.category;
    const isPayroll = entry.category === "salaries" || entry.category === "advance";
    const emp = isPayroll ? users.find((u) => u.id === entry.employeeId) : null;
    if (isPayroll && !emp) {
      flashToast("اختر الموظف صاحب الراتب/السلفة");
      return null;
    }
    // الاسم يُحفظ دائمًا، لا للمتكرر فقط. تركُه فارغًا للمصروف اليومي هو
    // سبب ظهور مبلغ بلا بيان في التقارير — لا يمكن تتبّعه لاحقًا.
    const name = (entry.name || "").trim() || (emp ? `${catLabel} — ${emp.name}` : catLabel);
    try {
      const res = await api.expensesApi.add({
        category: entry.category,
        amount: Number(entry.amount),
        name,
        recurring: !!entry.recurring,
        fundingSource: entry.fundingSource,
        note: entry.note || "",
        employeeId: emp?.id || null,
        periodMonth: isPayroll ? entry.periodMonth || new Date().toISOString().slice(0, 7) : null,
        nameId: entry.nameId || null,
      });
      const record = {
        id: res.expense.id, ref: res.expense.ref, date: res.expense.created_at,
        category: res.expense.category, name: res.expense.name, amount: Number(res.expense.amount) || 0,
        recurring: !!res.expense.recurring, fundingSource: res.expense.funding_source,
        employeeId: res.expense.employee_id, employeeName: emp?.name || null, employeeRef: emp?.ref || null,
        periodMonth: res.expense.period_month, note: res.expense.note || "",
        createdBy: currentUser?.name || "", createdById: res.expense.created_by,
        businessDayId: res.expense.business_day_id,
      };
      setExpenses((prev) => [record, ...prev]);
      if (res.cashTx) {
        const cashEntry = normalizeCashTxRow(res.cashTx);
        if (res.cashTx.pool === "safe") setSafeTx((prev) => [cashEntry, ...prev]);
        else setCashTx((prev) => [cashEntry, ...prev]);
      }
      flashToast("تم تسجيل المصروف");
      return record;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تسجيل المصروف"));
      return null;
    }
  };

  // -------- handlers: partners --------
  const handleAddPartner = (name, openingGrams, phone) => {
    if (nameExists(partners, name)) {
      flashToast("يوجد شريك بهذا الاسم");
      return null;
    }
    const partner = {
      id: Date.now().toString() + "p",
      ref: nextRef("partner", partners),
      name: name.trim(),
      // رأس المال الابتدائي بالجرام. النسبة لا تُدخَل يدويًا — تُحسب من
      // حصة الشريك في إجمالي رأس المال، فتتغيّر تلقائيًا مع كل مساهمة أو
      // سحب. تثبيتها يدويًا يجعلها تكذب على أول حركة.
      openingGrams: Number(openingGrams) || 0,
      phone: phone || "",
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || "",
    };
    persistPartners([partner, ...partners]);
    return partner;
  };
  // Partner movements can be settled in cash (ريال) or in physical gold (جرام).
  // Whichever unit is entered, the other is derived at today's 24k price so the
  // partner's capital stays comparable — but the SETTLEMENT is routed to the
  // matching pool: cash goes through a till, gold goes through the safe's gold
  // holdings. Booking a gold payment into a cash till would overstate liquidity
  // and understate metal on hand.
  const handleAddPartnerTx = (partnerId, type, entry) => {
    const unit = entry.unit === "gram" ? "gram" : "sar";
    const perGram = pricePerGram(24, priceData.current);
    const raw = Number(entry.amount) || 0;
    const amt = unit === "gram" ? raw * perGram : raw;
    const grams = unit === "gram" ? raw : perGram > 0 ? raw / perGram : 0;
    const note = entry.note || "";
    const record = {
      id: Date.now().toString(),
      ref: nextRef("partner", partnerTx),
      date: new Date().toISOString(),
      createdBy: currentUser?.name || "",
      createdById: currentUser?.id || null,
      ...dayStamp(),
      partnerId,
      type, // 'contribution' | 'withdrawal' | 'profit_share'
      unit,
      amount: amt,
      weightGrams: grams,
      goldKind: unit === "gram" ? entry.goldKind || "raw" : null,
      note,
    };
    persistPartnerTx([record, ...partnerTx]);

    const isIn = type === "contribution";
    const label = isIn ? "مساهمة شريك" : type === "withdrawal" ? "سحب شريك" : "توزيع أرباح";
    if (unit === "gram") {
      // Physical gold in/out of the safe's metal holdings.
      persistSafeGoldTx([
        {
          id: Date.now().toString() + "pg",
          date: new Date().toISOString(),
          type: isIn ? "in" : "out",
          kind: record.goldKind,
          weight: grams,
          note: `${label}${note ? " - " + note : ""}`,
        },
        ...safeGoldTx,
      ]);
    } else if (entry.fundingSource) {
      if (isIn) addToSource(entry.fundingSource, amt, `${label}${note ? " - " + note : ""}`, "partner", record.id, "capital_injection");
      else deductFromSource(entry.fundingSource, amt, `${label}${note ? " - " + note : ""}`, "partner", record.id, "owner_withdrawal");
    }
    flashToast("تم تسجيل الحركة");
  };

  // -------- handlers: scrap --------
  // ⚠ حُوِّلت للباك إند: POST /scrap يتحقق فعليًا من رصيد عهدة الكسر حيًّا
  // (بلا شرط سباق بين قراءة الرصيد محليًا وكتابة القيد)، ويشتق هامش
  // الفصوص التقديري بنفسه من grossWeight (لا من stonesMarginEstimate
  // المُرسَل — الخادم لا يقرأه إطلاقًا). قفل الجرد يُتحقق منه أيضًا على
  // الخادم (409 stocktake_locked)، فلا حاجة لفحصه هنا مسبقًا.
  const handleAddScrap = async (entry) => {
    try {
      const res = await api.scrap.create({
        karat: entry.karat,
        weight: Number(entry.weight),
        pricePerGram: Number(entry.pricePerGram),
        grossWeight: entry.grossWeight != null ? Number(entry.grossWeight) : null,
        totalOverride: entry.totalOverride != null ? Number(entry.totalOverride) : null,
        paymentMethod: entry.paymentMethod || "cash",
        customerName: entry.customerName || entry.customerId || null,
        description: entry.description || null,
      });
      const item = res.scrapItem;
      setScrapEntries((prev) => [
        {
          id: item.id,
          ref: item.ref,
          karat: item.karat,
          weight: Number(item.weight) || 0,
          originalWeight: Number(item.weight) || 0,
          grossWeight: entry.grossWeight != null ? Number(entry.grossWeight) : null,
          stonesMarginEstimate: Number(entry.stonesMarginEstimate) || Number(entry.stonesMargin) || 0,
          stonesMargin: Number(entry.stonesMarginEstimate) || Number(entry.stonesMargin) || 0,
          total: item.total,
          paymentMethod: entry.paymentMethod || "cash",
          customerName: entry.customerName || null,
          description: entry.description || null,
          date: new Date().toISOString(),
          stage: item.stage,
          createdBy: currentUser?.name || "",
        },
        ...prev,
      ]);
      setShowAddScrap(false);
      flashToast("تم تسجيل الكسر");
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر تسجيل الكسر"));
      return null;
    }
  };
  /// إخراج قطع من النظام.
  ///
  /// ⚠ لا تُحذف بل تُوسَم خارجةً: يبقى سجلها وتكلفتها وتاريخها.
  /// الحذف يجعل المخزون يطابق الواقع ويُخفي لماذا اختلفا.
  // ⚠ حُوِّلت للباك إند: POST /inventory/issue-out يتحقق فعليًا من توفر
  // الوحدات (غير مباعة/غير مُخرجة سلفًا) على قاعدة البيانات، ويُرحّل دفتر
  // الوزن وقيد اليومية بنفسه (راجع تعليق inventory.routes.js — إصلاح
  // حقيقي هناك: المرجع كان لا يُرحّل أي قيد فعليًا رغم استدعاء الشكل).
  // ⚠ فجوة موثَّقة: gold_issues (سجل الإخراج) ليس ضمن bootstrap بعد، فسجل
  // weightAdjustments هنا صدى محلي لهذه الجلسة فقط — يختفي بعد الدخول
  // التالي حتى تُضاف. لا يؤثر هذا على صحة العملية نفسها (مُنفَّذة ومحفوظة
  // فعليًا على الخادم)، فقط على استمرار ظهورها في هذه القائمة تحديدًا.
  const handleIssueOut = async ({ units, reasonId, note, totals }) => {
    if (!can("issueOut")) return { ok: false, errors: ["خارج صلاحيتك"] };
    if (role !== "manager" && role !== "assistant") {
      return { ok: false, errors: ["الإخراج يحتاج صلاحية المدير"] };
    }
    const reason = ISSUE_REASONS.find((r) => r.id === reasonId);
    if (!reason || !units?.length) return { ok: false, errors: ["بيانات ناقصة"] };
    const unitIds = units.map((u) => u.id).filter(Boolean);
    if (unitIds.length !== units.length) {
      return { ok: false, errors: ["تعذّر تحديد بعض القطع — أعد الفحص"] };
    }

    try {
      const res = await api.issueOut({ reasonId, unitIds, note: note || null });
      const now = new Date().toISOString();
      const actor = currentUser?.name || "";
      const codes = new Set(units.map((u) => u.code));

      setItems((prev) => prev.map((it) => {
        const us = it.units || [];
        if (!us.some((u) => codes.has(u.code))) return it;
        return {
          ...it,
          units: us.map((u) => codes.has(u.code)
            ? { ...u, issued: true, issuedAt: now, issuedRef: res.issue.ref,
                issuedReason: reason.id, issuedBy: actor }
            : u),
        };
      }));

      setWeightAdjustments((prev) => [{
        id: res.issue.id,
        ref: res.issue.ref, date: now, kind: "issue_out",
        reasonId: reason.id, reasonLabel: reason.label,
        account: reason.account,
        units: units.map((u) => ({ code: u.code, karat: u.karat, weight: u.weight })),
        weight: totals.weight, fine: totals.fine, cost: totals.cost,
        byKarat: totals.byKarat, note: note || "",
        createdBy: actor,
      }, ...prev]);

      flashToast(`أُخرجت ${units.length} قطعة · ${fmtW(totals.weight)} جم — ${reason.label}`);
      return { ok: true, ref: res.issue.ref };
    } catch (err) {
      return { ok: false, errors: [apiErrorMessage(err, "تعذّر إخراج القطع")] };
    }
  };

  // ⚠ حُوِّلت للباك إند: POST /scrap/:id/convert-to-item يتحقق فعليًا من
  // stage='in_safe' على الخادم (409 scrap_item_not_ready) بدل الفحوصات
  // المحلية المتفائلة هنا، ويكتب items+item_units حقيقيين — أول مسار
  // يكتب فيهما في المشروع كله (لم يكن هناك أي endpoint لإنشاء items قبل
  // هذا، لا هنا ولا في المشتريات). هذا كان آخر جزء من دورة الكسر لا يزال
  // محليًا بالكامل (window.storage) — سبب اختفاء التحويل بعد إعادة التحميل.
  const handleConvertScrap = async (entry) => {
    if (!can("convertScrap")) return null;
    try {
      const res = await api.scrap.convertToItem(entry.id, {
        categoryId: entry.categoryId || null,
      });
      const it = res.item;
      const newItem = {
        id: it.id,
        ref: it.ref,
        categoryId: it.categoryId,
        karat: it.karat,
        weight: it.weight,
        stonesWeight: 0,
        costPerGram: Number(entry.pricePerGram) || 0,
        workmanship: 0,
        lotWorkmanshipShare: 0,
        lotId: null,
        photoDataUrl: null,
        units: it.units,
        dateAdded: it.dateAdded,
        fromScrap: true,
        scrapId: it.scrapId,
        scrapRef: it.scrapRef,
        createdBy: currentUser?.name || "",
      };
      setItems((prev) => [newItem, ...prev]);
      setScrapEntries((prev) => prev.map((x) =>
        x.id === entry.id
          ? { ...x, status: "converted", consumed: true, stage: "used", convertedTo: newItem.id }
          : x));
      flashToast(`أُدخلت للمخزون · ${fmtW(it.weight)} جم عيار ${it.karat}`);
      return newItem;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر إدخال القطعة للمخزون"));
      return null;
    }
  };
  /// إرسال الكسر للفحص.
  ///
  /// ⚠ كان يكتب `status: "sent_to_refinery"` — حالةٌ من نظامٍ قديم
  /// موازٍ لا يعرفها `SCRAP_STAGES`.
  ///
  /// فالقطعة تختفي من عهدة الكسر: لا تظهر في «لدى الإدارة» ولا في
  /// «مُقيَّم»، ولا يجدها من يبحث عنها — ويظنّها ضاعت.
  ///
  /// ونظامان لحالةٍ واحدة أسوأ من نظامٍ ناقص: كلٌّ يرى نصف الحقيقة
  /// ولا أحد يرى الكلّ.
  /// استلام مسؤول الكسر من المشتري.
  ///
  /// ⚠ بختمِ اسمه ووقته: من هنا يصير الوزن في عهدته، فإن نقص عُرف
  /// بين يدَي من نقص. وبلا هذه الخطوة يبقى الكسر «في الصندوق» بلا
  /// مسؤولٍ باسمه.
  // ⚠ حُوِّلت للباك إند: POST /scrap/:id/receive-by-officer يتحقق فعليًا
  // من stage = 'in_box' على الخادم (409 scrap_item_not_in_box) بدل الفحص
  // المحلي المتفائل هنا.
  const handleReceiveScrapOfficer = async (entry) => {
    if (!ROLES[role]?.canBreak) {
      flashToast("الاستلام بيد مسؤول الكسر");
      return null;
    }
    try {
      await api.scrap.receiveByOfficer(entry.id);
      const now = new Date().toISOString();
      setScrapEntries((prev) => prev.map((x) =>
        x.id === entry.id
          ? { ...x, stage: "received", status: "received", receivedAt: now,
              receivedBy: currentUser?.name || "", receivedById: currentUser?.id || null }
          : x));
      flashToast(`استلمتها · ${fmtW(entry.weight)} جم عيار ${entry.karat}`);
      return true;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر الاستلام"));
      return null;
    }
  };

  /// إيداع كسر اليوم في خزنة الكسر — آخر الدوام.
  ///
  /// ⚠ خزنة الكسر لا خزنة المشغول: الذهب هنا خامٌ مُصفّى ينتظر
  /// التصنيع أو السداد. خلطه بالبضاعة الجاهزة يجعل الجرد يعدّ ما لم
  /// يُصفَّ مع ما هو جاهز — ويُسدَّد مورد من رصيدٍ نصفه لم يُوزن.
  // ⚠ حُوِّلت للباك إند: POST /scrap/deposit-to-vault يقتصر فعليًا على
  // stage='approved' فقط (لا received حتى لو refined) — تحفّظ صريح
  // موثَّق في تعليق scrap.routes.js (يقرأ weight_est لا أي وزن مُقيَّم،
  // فتجميع طلبات متعددة عبره معقَّد بلا داعٍ لأداة احتياطية نادرة
  // الاستخدام بعد تصحيح handleReceiveScrap أعلاه). النطاق هنا يطابق
  // الخادم بدل التوسّع محليًا.
  const handleDepositScrapToVault = async () => {
    if (!ROLES[role]?.canManageDay) {
      flashToast("الإيداع بيد المدير — راجعه");
      return null;
    }
    try {
      const res = await api.scrap.depositToVault();
      if (!res.count) {
        flashToast("لا كسر جاهز للإيداع — يُكسَّر ويُثبَّت وزنه أولًا");
        return null;
      }
      const now = new Date().toISOString();
      const actor = currentUser?.name || "";
      setScrapEntries((prev) => prev.map((e) =>
        stageOf(e) === "approved"
          ? { ...e, stage: "in_safe", status: "in_safe", vault: "scrap", depositedAt: now, depositedBy: actor }
          : e));
      const total = res.deposited.reduce((a, d) => a + (Number(d.weight) || 0), 0);
      flashToast(`أُودعت ${res.count} قطعة · ${fmtW(total)} جم في خزنة الكسر`);
      return { count: res.count, weight: total };
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر الإيداع"));
      return null;
    }
  };

  // ⚠ حُوِّلت للباك إند: POST /scrap/send يتحقق فعليًا من stage='in_box'
  // على الخادم (409 no_eligible_items) وينشئ scrap_requests حقيقيًا —
  // بدل تعليم محلي (`status: "sent"`) كان يختفي بعد إعادة التحميل ولا
  // يظهر في أي طلب تقييم فعلي.
  const handleSendRefinery = async (entry) => {
    if (!can("sendScrap")) return null;
    const st = stageOf(entry);
    if (st === "pending_break") {
      flashToast("كسّر القطعة وثبّت وزنها قبل الإرسال");
      return null;
    }
    if (st !== "in_box") {
      flashToast(`القطعة ${SCRAP_STAGES[st]?.label || st} — لا تُرسل الآن`);
      return null;
    }
    try {
      const res = await api.scrap.send({ scrapItemIds: [entry.id] });
      const now = new Date().toISOString();
      setScrapEntries((prev) => prev.map((x) =>
        x.id === entry.id
          ? { ...x, stage: "sent", status: "sent", sentAt: now,
              sentBy: currentUser?.name || "", requestId: res.request.id, requestRef: res.request.ref }
          : x));
      flashToast(`أُرسلت للفحص · ${fmtW(entry.weight)} جم عيار ${entry.karat}`);
      return res;
    } catch (err) {
      flashToast(apiErrorMessage(err, "تعذّر الإرسال للفحص"));
      return null;
    }
  };

  // -------- handlers: stocktake --------
  const handleSaveAudit = (entries, applyReconcile) => {
    const audit = { id: Date.now().toString(), date: new Date().toISOString(), entries, applied: applyReconcile, createdBy: currentUser?.name || "", ...dayStamp() };
    persistAudits([audit, ...audits]);
    if (applyReconcile) {
      const updated = items.map((it) => {
        const e = entries.find((en) => en.itemId === it.id);
        if (!e) return it;
        const currentRemaining = remainingQty(it);
        const diff = e.countedQty - currentRemaining;
        let units = [...(it.units || [])];
        if (diff > 0) {
          for (let i = 0; i < diff; i++) units.push({ code: generateUnitCode(), printed: false, sold: false });
        } else if (diff < 0) {
          let toRemove = -diff;
          units = units.map((u) => {
            if (toRemove > 0 && !u.sold) {
              toRemove -= 1;
              return { ...u, sold: true };
            }
            return u;
          });
        }
        return { ...it, weight: e.countedWeight, units };
      });
      persistItems(updated);
    }
  };

  // -------- handlers: stocktake session (لا تُفقد عند التنقل) --------
  const buildEntriesFor = (items) =>
    items.map((it) => ({
      itemId: it.id,
      category: it.categoryId,
      karat: it.karat,
      systemQty: remainingQty(it),
      systemWeight: it.weight,
      countedQty: remainingQty(it),
      countedWeight: it.weight,
    }));

  const handleStocktakeChooseScope = (scope) => {
    setStocktake((prev) => ({ ...prev, scope, generalEntries: scope === "general" ? buildEntriesFor(activeItems) : prev.generalEntries }));
  };
  const handleStocktakeSelectCategory = (catId) => {
    setStocktake((prev) => {
      const existing = prev.sectionalEntries[catId];
      const entries = existing || buildEntriesFor(activeItems.filter((it) => it.categoryId === catId));
      return { ...prev, activeCategory: catId, sectionalEntries: { ...prev.sectionalEntries, [catId]: entries } };
    });
  };
  const handleStocktakeBackToList = () => {
    setStocktake((prev) => ({ ...prev, activeCategory: null }));
  };
  const handleStocktakeUpdateEntry = (bucket, itemId, field, val) => {
    setStocktake((prev) => {
      if (bucket === "general") {
        return { ...prev, generalEntries: prev.generalEntries.map((e) => (e.itemId === itemId ? { ...e, [field]: val } : e)) };
      }
      const catId = prev.activeCategory;
      return {
        ...prev,
        sectionalEntries: {
          ...prev.sectionalEntries,
          [catId]: prev.sectionalEntries[catId].map((e) => (e.itemId === itemId ? { ...e, [field]: val } : e)),
        },
      };
    });
  };
  const entryHasVariance = (e) => e.countedQty !== e.systemQty || e.countedWeight !== e.systemWeight;
  const handleStocktakeFinishSection = (applyReconcile) => {
    setStocktake((prev) => {
      const catId = prev.activeCategory;
      const entries = prev.sectionalEntries[catId];
      const hasMissing = entries.some(entryHasVariance);
      handleSaveAudit(entries, applyReconcile);
      return {
        ...prev,
        activeCategory: null,
        sectionalStatus: { ...prev.sectionalStatus, [catId]: hasMissing ? "missing" : "ok" },
      };
    });
    flashToast("تم حفظ جرد القسم");
  };
  const handleStocktakeFinishGeneral = (applyReconcile) => {
    handleSaveAudit(stocktake.generalEntries, applyReconcile);
    flashToast("تم حفظ الجرد العام");
    setStocktake({ scope: null, activeCategory: null, sectionalStatus: {}, sectionalEntries: {}, generalEntries: null });
  };
  const handleStocktakeEndSectional = () => {
    setStocktake({ scope: null, activeCategory: null, sectionalStatus: {}, sectionalEntries: {}, generalEntries: null });
    flashToast("تم إنهاء الجرد");
  };
  const handleStocktakeCancelScope = () => {
    setStocktake({ scope: null, activeCategory: null, sectionalStatus: {}, sectionalEntries: {}, generalEntries: null });
  };

  // -------- handlers: suppliers & lots --------
  // شراء واحد قد يضم عدة عيارات. كل عيار يصبح دفعة (lot) مستقلة لأن
  // التخصيص والهالك وتكلفة القطعة تُحسب لكل عيار على حدة — لكن الدفعات
  // تتشارك purchaseId ورقم فاتورة واحد لأنها عملية شراء وسداد واحدة.
  // إرفاق فاتورة لدفعة سُجّلت بدونها. يُطبَّق على كل دفعات الشراء نفسه،
  // لأن الفاتورة الواحدة تغطي عملية الشراء كاملة بكل عياراتها.
  const handleAttachLotInvoice = async (lotId, file) => {
    const lot = lots.find((l) => l.id === lotId);
    if (!lot || !file) return;
    try {
      const attachId = await saveAttachment(file);
      persistLots(
        lots.map((l) =>
          l.purchaseId && l.purchaseId === lot.purchaseId
            ? { ...l, invoiceAttachId: attachId, invoiceName: file.name, invoiceIsImage: file.isImage, invoicePending: false }
            : l.id === lotId
            ? { ...l, invoiceAttachId: attachId, invoiceName: file.name, invoiceIsImage: file.isImage, invoicePending: false }
            : l
        )
      );
      flashToast("تم إرفاق الفاتورة");
    } catch (e) {
      console.error("attach failed", e);
      flashToast("تعذّر حفظ الفاتورة");
    }
  };


  /**
   * ⚠ إصلاح حقيقي: كانت هذه الدالة تكتب المورد محليًا فقط
   * (persistSuppliers → window.storage) بمعرّف مُولَّد بالتاريخ
   * (Date.now()) بلا أي استدعاء للباك إند. النتيجة: المورد يظهر فورًا
   * في الشاشة، لكن أي شراء يُسجَّل عليه (createLotCore → POST
   * /api/purchases) يُبنى بـsupplierId لا وجود له في جدول suppliers
   * الحقيقي — والخادم فعليًا يرفضه (supplier_not_found) أو، إن نجح
   * الشراء بمصادفة توقيت، فإن أول refresh/دخول جديد يستدعي
   * loadBootstrap() الذي يستبدل suppliers بالكامل بما يرجعه الخادم
   * فيختفي المورد المحلي ومعه أي شيء بُني عليه. الآن تُرسَل الإضافة
   * فعليًا للخادم (POST /api/suppliers) والمورد المحفوظ محليًا هو نفس
   * الكائن الذي يرجعه — بمعرّف حقيقي من قاعدة البيانات.
   */
  const handleAddSupplier = async (name, phone, isOfficial) => {
    // منع التكرار على مستوى الواجهة أولًا (تجربة أسرع)؛ الخادم يتحقق
    // منه ثانيةً على مستوى الفرع (race بين جلستين متزامنتين).
    if (nameExists(suppliers, name)) {
      flashToast("يوجد مورد بهذا الاسم");
      return null;
    }
    let res;
    try {
      res = await api.createSupplier({ name: name.trim(), phone: phone || "", isOfficial: !!isOfficial });
    } catch (e) {
      flashToast(apiErrorMessage(e, "تعذّر إضافة المورد"));
      return null;
    }
    const sup = res.supplier;
    persistSuppliers([sup, ...suppliers]);
    flashToast(`تمت إضافة المورد ${sup.ref}`);
    return sup;
  };

  /**
   * ⚠ تحويل حقيقي: كانت createLotCore تحسب كل شيء محليًا وتتفرّع على
   * طريقة الدفع الأربع (آجل/كسر/تسكير/نقد) بمنطق منفصل لكل واحدة. الباك
   * إند (POST /api/purchases) يطبّق الآن الطرق الخمس كلها فعليًا
   * (safe_cash/safe_network/scrap/office/deferred) بما فيها استهلاك
   * FIFO لوعاء الكسر الحقيقي في الخزنة (scrap_items.stage='in_safe') —
   * راجع purchases.routes.js. الدالة هنا تبني الطلب فقط وتحدّث lots/
   * cashTx محليًا بعد نجاح السيرفر، بلا حساب مالي محلي.
   *
   * ⚠ لم يُنقَل هنا: رفع مرفق الفاتورة (invoiceFile) — الباك إند لا يدعم
   * تخزين مرفقات بعد؛ يبقى invoicePending كما كان دون رفع فعلي حتى تُبنى
   * هذه القدرة سيرفريًا.
   */
  const createLotCore = async (draft) => {
    const supplierId = draft.supplierId;
    const paymentMethod = draft.paymentMethod || "safe_cash";
    const linesIn =
      Array.isArray(draft.lines) && draft.lines.length
        ? draft.lines
        : [{ karat: draft.karat, weight: draft.weight, costPerGram: draft.costPerGram, workmanshipTotal: draft.workmanshipTotal }];

    let res;
    try {
      res = await api.createPurchase({
        supplierId,
        paymentMethod,
        officeId: paymentMethod === "office" ? draft.officeId || null : null,
        notes: draft.notes || null,
        payFeesNow: paymentMethod === "deferred" ? !!draft.payFeesNow : undefined,
        scrapKarat: paymentMethod === "scrap" ? Number(draft.scrapKarat) || null : undefined,
        scrapWeight: paymentMethod === "scrap" ? Number(draft.scrapWeight) || 0 : undefined,
        invoicePending: !draft.invoiceFile,
        lines: linesIn.map((ln) => ({
          karat: Number(ln.karat), weight: Number(ln.weight) || 0,
          costPerGram: Number(ln.costPerGram) || 0, workmanshipTotal: Number(ln.workmanshipTotal) || 0,
        })),
      });
    } catch (e) {
      flashToast(apiErrorMessage(e, "تعذّر تسجيل الشراء"));
      return null;
    }

    const purchase = res.purchase;
    const now = new Date().toISOString();
    const built = linesIn.map((ln, idx) => ({
      id: purchase.id + "_l" + idx,
      purchaseId: purchase.id,
      ref: purchase.ref,
      createdBy: currentUser?.name || "",
      createdById: currentUser?.id || null,
      ...dayStamp(),
      supplierId,
      date: now,
      karat: Number(ln.karat),
      weight: Number(ln.weight) || 0,
      costPerGram: Number(ln.costPerGram) || 0,
      goldCost: weightTimesPrice(Number(ln.weight) || 0, Number(ln.costPerGram) || 0),
      workmanshipTotal: Number(ln.workmanshipTotal) || 0,
      workmanshipMode: draft.workmanshipMode || "per_gram",
      totalCost: sumMoney([weightTimesPrice(Number(ln.weight) || 0, Number(ln.costPerGram) || 0), Number(ln.workmanshipTotal) || 0]),
      status: "open",
      wastageWeight: 0,
      notes: draft.notes || "",
      paymentMethod,
      officeId: paymentMethod === "office" ? draft.officeId || null : null,
      feesPaidNow: paymentMethod === "deferred" ? !!draft.payFeesNow : true,
      invoicePending: !draft.invoiceFile,
    }));
    // ⚠ إصلاح حقيقي: كانت setLots تُحدِّث الحالة في الذاكرة فقط بلا أي
    // كتابة لـwindow.storage — الشراء نفسه محفوظ فعليًا على الخادم
    // (api.createPurchase أعلاه نجح)، لكن العرض المحلي هنا لم يكن
    // يستقر إلا بعد loadBootstrap التالي. persistLots (كبقية المعالجات
    // الناجحة في هذا الملف) يحفظها محليًا فورًا أيضًا لثبات العرض بين
    // لحظة الحفظ ولحظة أي إعادة تحميل لاحقة.
    persistLots([...built, ...lots]);

    const label = `شراء من مورد ${suppliers.find((x) => x.id === supplierId)?.name || ""}`.trim();
    if (paymentMethod === "safe_cash" || paymentMethod === "safe_network") {
      setSafeTx([{
        id: purchase.id + "_pay", date: now,
        type: "out", method: paymentMethod === "safe_cash" ? "cash" : "network",
        amount: purchase.grandTotal, note: `${label} — ${purchase.ref}`,
        source: "purchases", refId: purchase.id, category: "gold_purchase_supplier",
        createdBy: currentUser?.id || null,
      }, ...safeTx]);
      flashToast("تم تسجيل الشراء");
    } else if (paymentMethod === "deferred") {
      flashToast("سُجّل الشراء آجلًا على المورد");
    } else if (paymentMethod === "scrap") {
      flashToast(`سُجّل الشراء — سُدّد بـ${fmtW(Number(draft.scrapWeight) || 0)} جم كسر`);
    } else if (paymentMethod === "office") {
      flashToast("سُجّل الشراء كتسكير على المكتب");
    }
    return built[0];
  };

  const handleAddPurchase = async (draft) => {
    // createLotCore يعرض رسالة النجاح المناسبة لكل طريقة دفع بنفسه.
    await createLotCore(draft);
    setShowAddPurchase(false);
  };
  const handleQuickCreateLot = async (draft) => {
    const lot = await createLotCore(draft);
    if (lot) flashToast("تم إنشاء دفعة جديدة");
    return lot;
  };
  const handleCloseLot = (lot, note) => txn("handleCloseLot", () => {
    // الفرق بين وزن الدفعة المشتراة وما دخل المخزون فعلًا ذهب حقيقي:
    // إمّا فُقد في التصنيع والتداول (هالك) أو زاد عن المتوقع (فائض).
    // تسجيله بقيمته يجعل تكلفة البضاعة صحيحة ويُبقي الجرد متطابقًا؛
    // تركُه بلا تسجيل يعني فرقًا دائمًا لا يُفسَّر.
    const entered = Number(lot.enteredWeight) || lotAllocatedWeight(lot.id, items);
    const variance = (Number(lot.weight) || 0) - entered; // موجب = هالك، سالب = فائض
    const purity = PURITY[lot.karat] || (Number(lot.karat) || 0) / 24;
    const fine = Math.abs(variance) * purity;
    const value = Math.abs(variance) * (Number(lot.costPerGram) || 0);
    const now = new Date().toISOString();

    persistLots(
      lots.map((l) =>
        l.id === lot.id
          ? { ...l, status: "closed", closedAt: now, enteredWeight: entered, wastageWeight: variance > 0 ? variance : 0, surplusWeight: variance < 0 ? -variance : 0 }
          : l
      )
    );

    if (Math.abs(variance) > 0.0005) {
      const adj = {
        id: Date.now().toString() + "wa",
        ref: nextRef("scrap", weightAdjustments).replace("SCR", "WGT"),
        ...dayStamp(),
        date: now,
        lotId: lot.id,
        lotRef: lot.ref || null,
        supplierId: lot.supplierId,
        karat: lot.karat,
        kind: variance > 0 ? "wastage" : "surplus",
        weight: Math.abs(variance),
        fineWeight: fine,
        costPerGram: Number(lot.costPerGram) || 0,
        value,
        purchasedWeight: Number(lot.weight) || 0,
        enteredWeight: entered,
        note: note || "",
        createdBy: currentUser?.name || "",
        category: variance > 0 ? "gold_wastage" : "gold_weight_surplus",
      };
      persistWeightAdjustments([adj, ...weightAdjustments]);
      flashToast(
        variance > 0
          ? `أُقفلت الدفعة — هالك ${fmtW(Math.abs(variance))} جم`
          : `أُقفلت الدفعة — فائض ${fmtW(Math.abs(variance))} جم`
      );
    } else {
      flashToast("أُقفلت الدفعة — مطابقة تامة");
    }
  
  });

  const handleSetPrinted = (itemId, codes, printedValue) => {
    const next = items.map((it) => {
      if (it.id !== itemId) return it;
      const units = it.units.map((u) => (codes.includes(u.code) ? { ...u, printed: printedValue } : u));
      return { ...it, units };
    });
    persistItems(next);
  };

  // Replaces a damaged tag's identifier with a brand-new unique code (used when the
  // physical RFID chip itself, not just the paper label, needs to be swapped).
  // Returns the new code synchronously so the caller can queue it for printing.
  const handleReplaceUnitCode = (itemId, oldCode) => {
    const newCode = generateUnitCode();
    const next = items.map((it) => {
      if (it.id !== itemId) return it;
      const units = it.units.map((u) => (u.code === oldCode ? { ...u, code: newCode, printed: false } : u));
      return { ...it, units };
    });
    persistItems(next);
    return newCode;
  };

  const goTab = (t) => {
    setTab(t);
    setMorePage(null);
  };

  // ⚠ sessionChecking هنا أيضًا: بلاها كانت شاشة الدخول (PriceLoginScreen)
  // تومض للحظة قبل أن يُعرف إن كان هناك توكن محفوظ صالح أصلًا — "ريفرش
  // يعمل تسجيل خروج" كان يبدو صحيحًا بصريًا حتى بعد أن تصير الجلسة تُستعاد
  // فعليًا في الخلفية.
  if (loading || sessionChecking || branchLinkStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <Loader2 className="animate-spin" size={28} color="var(--accentText)" />
      </div>
    );
  }

  // ⚠ لا معنى لعرض شاشة دخول (حتى فارغة) بلا فرعٍ معروف — لا رقم فرع
  // نرسله مع أي محاولة دخول أصلًا. هذا الجهاز يحتاج فتح رابط دخول الفرع
  // مرة واحدة (BranchLinkCard.jsx في لوحة التحكم المركزية) قبل أي شيء.
  if (!role && (branchLinkStatus === "missing" || branchLinkStatus === "error")) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-center px-6"
        style={{ background: "var(--bg)" }}
      >
        <div>
          <p style={{ color: "var(--text)" }} className="text-base font-bold mb-2">
            هذا الجهاز غير مرتبط بأي فرع بعد
          </p>
          <p style={{ color: "var(--text3)" }} className="text-[13px]">
            {branchLinkStatus === "error"
              ? "تعذّر التحقق من رابط الفرع — تأكّد من الاتصال بالإنترنت وأعد فتح الرابط."
              : "افتح رابط دخول هذا الفرع مرة واحدة (من لوحة التحكم المركزية، تفاصيل الفرع) على هذا الجهاز."}
          </p>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <PriceLoginScreen
        priceData={priceData}
        autoUpdating={autoUpdating}
        autoError={autoError}
        lastAutoFetch={lastAutoFetch}
        onRefreshNow={runAutoFetch}
        onLogin={handleLogin}
        requirePin={appSettings.requirePin !== false}
        users={users}
        onDirectLogin={handleDirectLogin}
      />
    );
  }

  return (
    <div dir="rtl" style={{ background: "var(--bg)", minHeight: "100vh", fontFamily: "'Cairo','Tajawal',system-ui,sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { outline: none; }
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; top: 0; left: 0; width: 100%; }
        }
        @keyframes chartPulseRing { 0% { r: 4; opacity: 0.55; } 100% { r: 15; opacity: 0; } }
        .chart-pulse-ring { animation: chartPulseRing 1.8s ease-out infinite; }
        @keyframes gcWait { to { transform: rotate(360deg); } }
        .gc-wait { animation: gcWait 1s linear infinite; }

        /* ── رسم سعر الذهب ── */

        /* المنحنى يُرسم عند كل تحديث. */
        @keyframes gcDraw {
          from { stroke-dashoffset: 2200; }
          to   { stroke-dashoffset: 0; }
        }
        .gc-line {
          stroke-dasharray: 2200;
          animation: gcDraw 1.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        /* التعبئة تظهر بعد الخط بقليل. */
        @keyframes gcArea { from { opacity: 0; } to { opacity: 1; } }
        .gc-area { animation: gcArea 2s ease-out 0.3s backwards; }

        /* ومضة ضوء تجري على طول الخط باستمرار. */
        @keyframes gcSheen {
          0%   { stroke-dashoffset: 2200; opacity: 0; }
          10%  { opacity: 1; }
          70%  { stroke-dashoffset: 0; opacity: 1; }
          85%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }
        .gc-sheen {
          stroke-dasharray: 140 2200;
          animation: gcSheen 3.6s linear infinite 1.4s;
        }

        /* نبض حول نقطة آخر سعر — يدل أن الرقم حيّ لا صورة. */
        @keyframes gcPulse {
          0%   { r: 5;  opacity: 0.45; }
          70%  { r: 15; opacity: 0; }
          100% { r: 15; opacity: 0; }
        }
        .gc-pulse { animation: gcPulse 2.4s ease-out infinite; }

        /* رسم المنحنى المصغّر خلف الأرقام. */
        @keyframes phDraw {
          from { stroke-dashoffset: 1000; }
          to   { stroke-dashoffset: 0; }
        }
        .ph-line {
          stroke-dasharray: 1000;
          animation: phDraw 1.5s ease-out forwards;
        }
        @keyframes phFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .ph-area { animation: phFade 1.6s ease-out forwards; }

        /* ── حركة الشعار ── بلا دوران إطلاقًا */

        /* قفزات غير منتظمة: ارتفاعات مختلفة ولحظات سكون بينها، فتبدو
           عفوية لا آلية. */
        /* يكبر ويصغر بدورة مختلفة الطول عن القفز — عدم التزامن هو ما يمنح
           الإحساس بالحياة. */
        /* التفاف الكرة: شريط ضوء عريض يجري أفقيًا داخل قناع الشعار،
           فيقرأه العين كسطح كروي يدور. */
        /* تلألؤ: ومضة حادّة تعبر الشعار كل بضع ثوانٍ. */
        /* الظل يتبع القفزات: يضيق ويبهت كلما ارتفعت الكرة. */
        `}</style>

      {/* ⚠ العرض يتبع المقاس لا رقمًا ثابتًا.
          كنتُ ثبّتُّه عند 448 حين طُلب الشكل الأصلي — وذلك خطأ:
          الشكل الأصلي هو ما يراه صاحب الجوال، لا سقفٌ يُفرض على من
          يفتح على حاسبه فيرى عمودًا وسط شاشة فارغة. */}
      <div
        className="mx-auto"
        style={{
          maxWidth: contentWidth(vp.size),
          minHeight: "100dvh",
          paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
          paddingInline: vp.size === "sm" ? 0 : 12,
        }}
      >
        <div className="flex items-center justify-between px-4 pt-2 pb-1 relative">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: "var(--panel)" }}
            >
              <span style={{ fontFamily: "'Cairo', sans-serif" }} className="text-xs font-extrabold">
                {(currentUser?.name || "?").trim().charAt(0)}
              </span>
            </div>
            <div className="flex flex-col leading-tight">
              <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                {currentUser?.name}
              </span>
              <span style={{ color: "var(--text3)" }} className="text-[10px]">
                {ROLES[role].label}
              </span>
            </div>
          </div>
          {/* ⚠ اسم الفرع في المنتصف (طلب المستخدم صراحةً): مفيدٌ تحديدًا
              لصاحب أكثر من فرع يتنقّل بين أجهزتها فيلتبس عليه أي فرعٍ
              يفتحه الآن — position: absolute + تمركز أفقي كامل العرض،
              لا flex-1 عادي، حتى لا يزاحم عمودي الطرفين عند اسمٍ طويل
              (كلاهما محتوىً حقيقي ثابت العرض تقريبًا، فالتمركز المطلق
              أضمن من توزيع مساحة قد يضيق أحد الطرفين). */}
          {branchLink?.branchName && (
            <span
              className="absolute left-1/2 -translate-x-1/2 text-xs font-bold truncate px-2"
              style={{ color: "var(--text2)", maxWidth: "40%", fontFamily: "'Cairo', sans-serif" }}
            >
              {branchLink.branchName}
            </span>
          )}
          <div className="flex items-center gap-2">
            {/* القائمة الكاملة انتقلت للأعلى: الشريط السفلي للأدوات اليومية
                وحدها، فلا يزاحمها زر لا يُستخدم كثيرًا. */}
            <button
              onClick={() => {
                setMorePage(null);
                setTab("more");
              }}
              aria-label="القائمة"
              className="flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: tab === "more" ? "var(--accentBg)" : "var(--panel)",
                border: `1px solid ${tab === "more" ? "var(--accentLine)" : "var(--edge)"}`,
                color: tab === "more" ? "var(--accent)" : "var(--accentSoft)",
              }}
            >
              <Menu size={17} />
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center justify-center"
              style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--bad)" }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
        {/* ── شريط السعر الحيّ ── */}
        {appSettings?.showLiveTicker !== false && (
          <GoldTicker
            shopPrice={priceData.current}
            currency={priceData.currency}
            canUse={role === "manager" || role === "assistant"}
            streamUrl={streamBase(appSettings)}
            /* ⚠ العملة تُمرَّر: `handleSetPrice(val, currency)` بوسيطين،
                وتركُ الثاني يجعل العملة undefined فتختفي «ر.س» من كل شاشة. */
            onUseLive={(g) => handleSetPrice(g, priceData.currency)}
          />
        )}

        {stocktakeLock && (
        <button
          onClick={() => setTab("stocktake")}
          className="w-full flex items-center justify-center gap-2 py-2"
          style={{ background: "var(--accentBg)", borderBottom: "1px solid var(--accentLine)" }}
        >
          <Lock size={13} color="var(--accent)" />
          <span style={{ color: "var(--accent)" }} className="text-[11px] font-bold">
            المخزون مقفل للجرد — بدأه {stocktakeLock.startedBy}
          </span>
        </button>
      )}
      {/* ⚠ الشريط يظهر في الحالتين لا في حالة الغياب وحدها.
          إظهاره حين لا يوجد يومٌ فقط يعني أن البائع لا يرى متى فُتح
          ولا كم مضى عليه — ويكتشف عند الإقفال أنه يعمل على يوم أمس. */}
      <DayControl
        compact
        openDay={openDay}
        businessDays={businessDays}
        cashBalance={cashBalance}
        safeBalance={safeBalance}
        custodyBalance={scrapCustodyBalance}
        scrapEntries={scrapEntries}
        sales={sales}
        expenses={expenses}
        currency={priceData.currency}
        role={role}
        onOpen={(cash, custody, note) => handleOpenBusinessDay(note, cash, custody)}
        /* ⚠ خطوتان لا واحدة.

           `handleCloseDay` يُورّد النقد للخزنة، و`handleCloseBusinessDay`
           يَسِم اليوم مقفلًا ويكتب لقطته.

           وكان يُستدعى الأول وحده، فيُورَّد الصندوق **ويبقى اليوم
           مفتوحًا** — يظنّ صاحبه أنه أقفل، ثم يجد يومه مفتوحًا غدًا
           فتختلط حركة يومين. */
        onClose={async (note) => {
          // ⚠ كلاهما نداء شبكة الآن — يُنتظر الأول (توريد الصندوق) قبل
          // الثاني (إقفال اليوم وكتابة لقطته)، فلا يُقفَل اليوم قبل أن
          // يُورَّد صندوقه فعليًا للخزنة.
          await handleCloseDay();
          return await handleCloseBusinessDay(note || "");
        }}
        onGoTo={(page) => openPage(page)}
      />
      {roleTamper && role === "manager" && (
        <div className="fixed left-0 right-0 z-50 px-4 py-2.5"
          style={{ top: 0, background: "var(--badBg)", borderBottom: "1px solid var(--badLine)" }}>
          <div className="flex items-center gap-2">
            <p style={{ color: "var(--bad)", margin: 0 }} className="text-[11px] font-bold flex-1">
              ⚠ صلاحيات المستخدمين تغيّرت خارج التطبيق
            </p>
            <button onClick={() => setRoleTamper(null)} style={{ color: "var(--text2)" }}>
              <X size={14} />
            </button>
          </div>
          <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px]">
            راجع صلاحيات الوصول والسجل — {new Date(roleTamper.at).toLocaleString("en-GB")}
          </p>
        </div>
      )}
      {/* ── ورقة الكيان ── */}
      {sheetEntity && (
        <EntitySheet
          kind={sheetEntity.kind}
          record={sheetEntity.record}
          ctx={{
            currency: priceData.currency,
            actionsFor: entityActionsFor,
            rowsFor: entityRowsFor,
          }}
          onAction={runEntityAction}
          onClose={() => setSheetEntity(null)}
        />
      )}
      {storageFull && (
        <div
          className="fixed left-0 right-0 z-50 px-4 py-2.5"
          style={{ top: 0, background: "var(--badBg)", borderBottom: "1px solid var(--badLine2)" }}
        >
          <p style={{ color: "var(--bad)", margin: 0 }} className="text-[11px] font-bold">
            ⚠ امتلأت مساحة الجهاز — لم يُحفظ شيء
          </p>
          <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px]">
            خذ نسخة احتياطية ثم أفرغ بيانات قديمة · إعادة المحاولة لن تُجدي
          </p>
        </div>
      )}
      {otherTab && (
        <div
          className="fixed left-0 right-0 z-50 px-4 py-2"
          style={{ top: 0, background: "var(--accentBg)", borderBottom: "1px solid var(--accentLine)" }}
        >
          <div className="flex items-center gap-2">
            <p style={{ color: "var(--accent)", margin: 0 }} className="text-[11px] font-bold flex-1">
              ⚠ نافذة أخرى تكتب على البيانات نفسها
            </p>
            <button
              onClick={() => { setOtherTab(false); window.location.reload(); }}
              className="text-[10px] px-2.5 py-1 rounded-full"
              style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
            >
              تحديث
            </button>
            <button onClick={() => setOtherTab(false)} style={{ color: "var(--text2)" }}>
              <X size={14} />
            </button>
          </div>
          <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px]">
            أغلق النوافذ الأخرى — آخر من يكتب يمحو الآخر
          </p>
        </div>
      )}
      {validationError && (
        <div
          className="fixed left-0 right-0 z-50 px-4 py-2.5"
          style={{ top: 0, background: "var(--badBg)", borderBottom: "1px solid var(--badLine)" }}
        >
          <p style={{ color: "var(--bad)", margin: 0 }} className="text-[11px] font-bold">
            ⚠ رُفض حفظ {validationError.store} — {validationError.why}
          </p>
          <p style={{ color: "var(--text2)", margin: 0 }} className="text-[10px]">
            {validationError.ref}
            {validationError.count > 1 ? ` و${validationError.count - 1} غيره` : ""}
            {" · "}لم يُحفظ شيء — راجع البيانات
          </p>
        </div>
      )}
      {storageError && (
          <div className="mx-4 mb-2 p-3 rounded-xl" style={{ background: "var(--badBg)", border: "1px solid var(--badLine2)" }}>
            <p style={{ color: "var(--bad)" }} className="text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle size={14} /> تحذير: لم يتم الحفظ
            </p>
            <p style={{ color: "#B91C1C" }} className="text-[11px] mt-1">
              {storageError}
            </p>
          </div>
        )}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-8" style={{ background: "var(--veil)" }}>
            <Card style={{ padding: 20, width: "100%", maxWidth: 300 }}>
              <p style={{ color: "var(--text)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-bold mb-1 text-center">
                تأكيد تسجيل الخروج
              </p>
              <p style={{ color: "var(--text2)" }} className="text-xs mb-4 text-center">
                سيتم إنهاء الجلسة الحالية والعودة إلى شاشة الدخول، وستحتاج إلى إدخال الرقم السري مرة أخرى لمتابعة الاستخدام
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
                >
                  إلغاء
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                  className="py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: "var(--badBg)", color: "var(--bad)", border: "1px solid var(--badLine)" }}
                >
                  تسجيل الخروج
                </button>
              </div>
            </Card>
          </div>
        )}
        {morePage === null && tab === "inventory" && (
          <InventorySummaryTab
            onOpenEntity={(kind, record) => setSheetEntity({ kind, record })}
            totals={totals}
            items={activeItems}
            scrapEntries={scrapEntries}
            safeGoldTx={safeGoldTx}
            trustGold={trustGold}
            price24={priceData.current}
            currency={priceData.currency}
          />
        )}

        {/* ── حاجز البيع ── */}
        {morePage === null && tab === "sales" && !openDay && (
          <div className="px-4 pt-10">
            <Card style={{ padding: 18, border: "1px solid var(--badLine)",
                           background: "var(--badBg)" }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} color="var(--bad)" />
                <p style={{ color: "var(--bad)", margin: 0 }} className="text-sm font-bold">
                  لا يوجد يوم عمل مفتوح
                </p>
              </div>
              <p style={{ color: "var(--text2)", margin: 0 }} className="text-[12px] leading-7">
                ⚠ البيع قبل فتح اليوم يُنشئ فاتورةً لا تُنسب ليوم، فلا تظهر في
                إقفال أيّ يوم ولا في حصيلته — والصندوق يمتلئ بمالٍ لا يعرف
                أحدٌ من أين جاء.
              </p>
              {ROLES[role]?.canManageDay ? (
                <button
                  onClick={() => setMorePage("workday")}
                  className="w-full mt-3 py-3 rounded-xl text-sm font-bold"
                  style={{ background: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))",
                           color: "var(--panel)" }}
                >
                  افتح اليوم الآن
                </button>
              ) : (
                <p style={{ color: "var(--accent)", margin: "12px 0 0" }}
                   className="text-[12px] font-bold">
                  راجع المدير ليفتح اليوم — فتحُه ليس بيدك.
                </p>
              )}
            </Card>
          </div>
        )}

        {morePage === null && tab === "sales" && openDay && (
          <SellPage
            onPartialSale={
              // الزر يظهر فقط إن وُجد صنف قابل للتجزئة — زر لا يفعل
              // شيئًا يربك أكثر من غيابه.
              activeItems.some((it) => {
                const c = categories.find((x) => x.id === it.categoryId);
                return c?.saleMode === "partial" && (Number(it.weight) || 0) > 0.0005;
              })
                ? () => setShowPartialSale(true)
                : null
            }
            onNew={() => {
              setQuickSaleItemId(null);
              setShowNewSale(true);
            }}
          />
        )}

        {morePage === null && tab === "cash" && (
          <CashTab
            dailyBalance={cashBalance}
            safeBalance={safeBalance}
            safeGoldBalance={safeGoldBalance}
            custodyBalance={scrapCustodyBalance}
            currency={priceData.currency}
            dailyTx={cashTx}
            safeTx={safeTx}
            safeGoldTx={safeGoldTx}
            custodyTx={scrapCustodyTx}
            goldEquivalent={goldEquivalent}
            onCashIn={() => setCashModalType("in")}
            onCashOut={() => setCashModalType("out")}
            onTransferToSafe={handleTransferToSafe}
            onTransferSafeToDaily={handleTransferSafeToDaily}
            dailyCustody={dailyCustody}
            openCustodySession={openCustodySession}
            onOpenCustody={handleOpenDailyCustody}
            onCloseCustody={handleCloseDailyCustody}
            onCloseDay={handleCloseDay}
            onSafeIn={(amount, note, method, category) => handleAddSafeTx("in", amount, note, method, category)}
            onSafeOut={(amount, note, method, category) => handleAddSafeTx("out", amount, note, method, category)}
            onAddSafeGold={handleAddSafeGoldTx}
            onFundCustody={handleFundCustody}
            onCloseScrapDay={handleCloseScrapDay}
            suppliers={suppliers}
          />
        )}

        {morePage === null && tab === "expenses" && (
          <ExpensesTab
            expenseNames={expenseNames}
            users={users}
            onAddExpenseName={handleAddExpenseName}
            onDeleteExpenseName={handleDeleteExpenseName} expenses={expenses} totals={expensesTotals} currency={priceData.currency} onAdd={handleAddExpense} flashToast={flashToast} />
        )}

        {morePage === null && tab === "stocktake" && (
          <StocktakeSubPage
            lock={stocktakeLock}
            onToggleLock={handleToggleStocktakeLock}
            settings={appSettings}
            onSaveSettings={role === "manager" ? handleUpdateSettings : null}
            activeItems={activeItems}
            priceData={priceData}
            audits={audits}
            stocktake={stocktake}
            onChooseScope={handleStocktakeChooseScope}
            onSelectCategory={handleStocktakeSelectCategory}
            onBackToList={handleStocktakeBackToList}
            onUpdateEntry={handleStocktakeUpdateEntry}
            onFinishSection={handleStocktakeFinishSection}
            onFinishGeneral={handleStocktakeFinishGeneral}
            onEndSectional={handleStocktakeEndSectional}
            onCancelScope={handleStocktakeCancelScope}
            flashToast={flashToast}
          />
        )}

        {morePage === null && tab === "more" && (
          <MoreMenu
            onSelect={openPage}
            permitted={new Set([
              ...effectivePerms(role, currentUser).allowedTabs.filter((id) => id !== "more"),
              ...effectivePerms(role, currentUser).allowedMore,
            ])}
            mainIds={layoutIds(navLayout[role])}
            userName={currentUser?.name}
            roleLabel={ROLES[role]?.label}
            order={menuOrder}
            custom={customGroups}
            disabled={appSettings.bankReconEnabled ? [] : ["bankRecon"]}
            onLogout={() => setShowLogoutConfirm(true)}
          />
        )}

        {morePage === "addGoods" && (
          <AddGoodsPage
            items={items}
            lots={lots}
            suppliers={suppliers}
            entrySessions={entrySessions}
            onSave={handleAddItems}
            onSetPrinted={handleSetPrinted}
            onCreateSupplierLot={handleQuickCreateLot}
            onDeleteItem={handleDeleteItem}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "printing" && (
          <PrintingPage
            activeItems={activeItems}
            onSetPrinted={handleSetPrinted}
            onReplaceCode={handleReplaceUnitCode}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "price" && (
          <PriceTab
            priceData={priceData}
            onEdit={() => setShowPrice(true)}
            autoUpdating={autoUpdating}
            autoError={autoError}
            lastAutoFetch={lastAutoFetch}
            onRefreshNow={runAutoFetch}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "reports" && (
          <ReportsTab
            totals={totals}
            priceData={priceData}
            salesTotals={salesTotals}
            cashBalance={cashBalance}
            safeBalance={safeBalance}
            safeGoldBalance={safeGoldBalance}
            scrapCustodyBalance={scrapCustodyBalance}
            scrapTotals={scrapTotals}
            goldEquivalent={goldEquivalent}
            purchasesTotals={purchasesTotals}
            sales={sales}
            expenses={expenses}
            expensesTotals={expensesTotals}
            cashTx={cashTx}
            safeTx={safeTx}
            activeItems={activeItems}
            items={items}
            lots={lots}
            suppliers={suppliers}
            scrapEntries={scrapEntries}
            taskirEntries={taskirEntries}
            weightAdjustments={weightAdjustments}
            revaluation={revaluation}
            safeGoldTx={safeGoldTx}
            dailyCustody={dailyCustody}
            safeAudits={safeAudits}
            audits={audits}
            users={users}
            openingBalance={openingBalance}
            openDay={openDay}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "scrap" && (
          <ScrapSubPage
            scrapEntries={scrapEntries}
            totals={scrapTotals}
            currency={priceData.currency}
            priceData={priceData}
            custodyBalance={scrapCustodyBalance}
            surplusLog={scrapSurplusLog}
            onAdd={() => setShowAddScrap(true)}
            onFundCustody={handleFundCustody}
            onConvert={handleConvertScrap}
            onSendRefinery={handleSendRefinery}
            onRefine={handleRefineScrap}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "suppliers" && (
          <SuppliersSubPage
            onOpenEntity={(k, r) => setSheetEntity({ kind: k, record: r })}
            scrapEntries={scrapEntries}
            offices={taskirOffices}
            safeGoldTx={safeGoldTx}
            price24={priceData.current}
            onSettle={handleSettleSupplier}
            suppliers={suppliers}
            lots={lots}
            items={items}
            safeTx={safeTx}
            cashTx={cashTx}
            taskirEntries={taskirEntries}
            currency={priceData.currency}
            canManage={role === "manager"}
            onAddSupplier={handleAddSupplier}
            onAttachInvoice={handleAttachLotInvoice}
            onAddPurchase={() => setShowAddPurchase(true)}
            onCloseLot={handleCloseLot}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "salesHistory" && (
          <SalesHistoryPage
            onOpenEntity={(k, r) => setSheetEntity({ kind: k, record: r })}
            customers={customers}
            returns={returns}
            canReturn={role !== "employee"}
            onReturnSale={handleReturnSale}
            sales={sales}
            currency={priceData.currency}
            totals={salesTotals}
            onView={(s) => setViewingSale(s)}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "sellerReports" && (
          <SellerReportsPage
            sales={sales}
            users={users}
            expenses={expenses}
            commissions={commissions}
            currency={priceData.currency}
            price24={priceData.current}
            canManage={role === "manager"}
            onSaveCommission={handleSaveCommission}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "taskirat" && (
          <TaskiratPage
            taskirEntries={taskirEntries}
            totals={taskirTotals}
            suppliers={suppliers}
            offices={taskirOffices}
            officeStats={taskirOfficeStats}
            currency={priceData.currency}
            priceData={priceData}
            onAdd={handleAddTaskir}
            onAddOffice={handleAddTaskirOffice}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "partners" && (
          <PartnersPage
            partners={partners}
            partnerTx={partnerTx}
            totals={partnersTotals}
            currency={priceData.currency}
            price24={priceData.current}
            onAddPartner={handleAddPartner}
            onAddTx={handleAddPartnerTx}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "access" && (
          <AccessSettingsPage
            users={users}
            navRegistry={NAV_REGISTRY}
            roles={ROLES}
            onAddUser={handleAddUser}
            onRenameUser={handleRenameUser}
            onToggleAi={handleToggleUserAi}
            onSetPermissions={handleSetUserPermissions}
            onRemoveUser={handleRemoveUser}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "taxReport" && (
          <TaxReportPage taxTotals={taxTotals} currency={priceData.currency} onBack={() => setMorePage(null)} />
        )}
        {morePage === "settings" && (
          <AppSettingsPage
            priceData={priceData}
            settings={appSettings} onSave={handleUpdateSettings} branchIdentity={branchIdentity} onSaveBranch={handleSaveBranchIdentity} hqPermissions={hqPermissions} onBack={() => setMorePage(null)} />
        )}
        {morePage === "openingCompare" && (
          <OpeningComparePage
            openingBalance={openingBalance}
            cashTx={cashTx}
            safeTx={safeTx}
            scrapCustodyTx={scrapCustodyTx}
            items={items}
            scrapEntries={scrapEntries}
            safeGoldTx={safeGoldTx}
            lots={lots}
            sales={sales}
            currency={priceData.currency}
            price24={priceData.current}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "financials" && (
          <FinancialStatementsPage
            totals={totals}
            priceData={priceData}
            cashBalance={cashBalance}
            safeBalance={safeBalance}
            safeGoldBalance={safeGoldBalance}
            scrapCustodyBalance={scrapCustodyBalance}
            scrapTotals={scrapTotals}
            expensesTotals={expensesTotals}
            partnersTotals={partnersTotals}
            salesTotals={salesTotals}
            taxTotals={taxTotals}
            goldEquivalent={goldEquivalent}
            openingGoldEquivalent={openingGoldEquivalent}
            openingBalance={openingBalance}
            goldPosition={goldPosition}
            openingGoldPosition={latestClosure?.goldPosition || openingBalance?.goldPosition || null}
            sales={sales}
            returns={returns}
            users={users}
            appSettings={appSettings}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "repairs" && (
          <RepairsPage repairs={repairs} currency={priceData.currency} price24={priceData.current} onAdd={handleAddRepair} onBack={() => setMorePage(null)} />
        )}
        {/* ⚠ الحارس على الصفحة لا على الزرّ.
            إخفاء الزرّ يمنع الضغط ولا يمنع الوصول: من يعرف اسم
            الصفحة يفتحها من أي مكان يضبط `morePage`. */}
        {morePage === "aiAssistant" && !aiAllowedFor(role, currentUser) && (
          <div className="px-4 pt-10">
            <Card style={{ padding: 18, border: "1px solid var(--badLine)",
                           background: "var(--badBg)" }}>
              <p style={{ color: "var(--bad)", margin: 0 }} className="text-sm font-bold">
                ⚠ أدوات الذكاء خارج صلاحيتك
              </p>
              <p style={{ color: "var(--text2)", margin: "8px 0 0" }}
                 className="text-[12px] leading-7">
                المساعد يجمع في إجابةٍ واحدة ما تفرّق في عشر شاشات، فيُعطي
                صورةً كاملة لمن أُعطي أجزاءها. راجع المدير ليفتحها لك.
              </p>
            </Card>
          </div>
        )}
        {morePage === "aiAssistant" && aiAllowedFor(role, currentUser) && (
          <AiAssistantPage
            voiceFirst={aiVoiceFirst}
            onVoiceConsumed={() => setAiVoiceFirst(false)}
            onOpenScreen={openPage}
            auditCtx={{
              items,
              sales,
              cashBalance,
              safeBalance,
              custodyBalance: scrapCustodyBalance,
              safeGoldBalance,
              lots,
              scrapEntries,
              expenses,
              repairs,
              totals,
              cashTx,
              safeTx,
              custodyTx: scrapCustodyTx,
              // ⚠ الحقول التالية لمحادثة أوقية (buildAiSnapshot) وحدها —
              // تدقيق الحسابات (runAuditChecks) لا يقرأها، فإضافتها هنا
              // آمنة ولا تُغيّر سلوك تبويب التدقيق.
              priceData,
              returns,
              safeGoldTx,
              scrapCustodyTx,
              customers,
              suppliers,
              users,
              trustAccounts,
              trustLedger,
              businessDays,
              openDay,
              journal,
              openingBalance,
              appSettings,
              role,
              payrollRuns,
              fixedAssets,
              depreciations,
              reservations,
              partners,
              approvals,
            }}
            reportSnapshot={{
              sales: sales.slice(0, 300).map((s) => ({ date: s.date, total: s.total, tax: s.taxAmount, taxApplicable: s.taxApplicable, seller: s.sellerName, paymentMethod: s.paymentMethod })),
              expenses: expenses.slice(0, 300).map((e) => ({ date: e.date, category: e.category, amount: e.amount, recurring: e.recurring, name: e.name })),
              cashTx: cashTx.slice(0, 300).map((t) => ({ date: t.date, type: t.type, method: t.method, amount: t.amount, note: t.note, source: t.source })),
              repairs: repairs.slice(0, 200).map((r) => ({ date: r.date, customer: r.customerName, cost: r.cost, profit: r.profit })),
              scrapPurchases: scrapEntries.slice(0, 200).map((s) => ({ date: s.date, weight: s.weight, pricePerGram: s.pricePerGram, total: s.total, status: s.status })),
              taskirEntries: taskirEntries.slice(0, 200).map((t) => ({ date: t.date, weight: t.weight, workmanshipAmount: t.workmanshipAmount, totalCashPaid: t.totalCashPaid })),
              inventorySummaryByCategory: totals.byCategory,
            }}
            currency={priceData.currency}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "navCustomize" && (
          <NavCustomizePage
            navLayout={navLayout}
            menuOrder={menuOrder}
            onSave={handleSaveNavLayout}
            onSaveOrder={handleSaveMenuOrder}
            customGroups={customGroups}
            onSaveGroups={handleSaveCustomGroups}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "search" && (
          <UniversalSearchPage
            index={universalIndex}
            currency={priceData.currency}
            onAsk={(q) => { setAiSeed(q); setShowAiChat(true); }}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "salesReturn" && (
          <SalesReturnPage
            sales={sales}
            returns={returns}
            items={items}
            openDay={openDay}
            stocktakeLock={stocktakeLock?.locked || stocktakeLock}
            currency={priceData.currency}
            taxRate={appSettings.taxRate || 0}
            onProcess={processSalesReturn}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "officeLedger" && (
          <TaskirOfficesPage
            offices={taskirOffices}
            officeTx={taskirOfficeTx}
            suppliers={suppliers}
            currency={priceData.currency}
            price24={priceData.current}
            branchName={branchIdentity?.name}
            canManage={role === "manager"}
            onSettle={handleSettleOffice}
            onAddOffice={handleAddTaskirOffice}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "supplierLedger" && (
          <SupplierLedgerPage
            suppliers={suppliers}
            lots={lots}
            cashTx={cashTx}
            safeTx={safeTx}
            scrapEntries={scrapEntries}
            taskirOfficeTx={taskirOfficeTx}
            currency={priceData.currency}
            price24={priceData.current}
            branchName={branchIdentity?.name}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "bankRecon" && appSettings.bankReconEnabled && (
          <BankReconPage
            sales={sales}
            cashTx={cashTx}
            safeTx={safeTx}
            bankTx={bankTx}
            settings={appSettings}
            currency={priceData.currency}
            onSaveBank={(next) => persist(BANK_TX_KEY, next, setBankTx)}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "trialBalance" && (
          <TrialBalancePage
            journal={journal}
            cashTx={cashTx}
            safeTx={safeTx}
            scrapCustodyTx={scrapCustodyTx}
            scrapEntries={scrapEntries}
            safeGoldTx={safeGoldTx}
            items={items}
            sales={sales}
            lots={lots}
            weightAdjustments={weightAdjustments}
            goldLedger={goldLedger}
            currency={priceData.currency}
            price24={priceData.current}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "fullStatements" && (
          <FullStatementsPage
            journal={journal}
            goldLedger={goldLedger}
            accounts={CHART_OF_ACCOUNTS}
            assets={fixedAssets}
            currency={priceData.currency}
            branchName={appSettings?.storeName || ""}
            preparedBy={currentUser?.name || ""}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "anyStatement" && (
          <AnyStatementPage
            suppliers={suppliers}
            customers={customers}
            users={users}
            taskirOffices={taskirOffices}
            partners={partners}
            items={items}
            lots={lots}
            accounts={CHART_OF_ACCOUNTS}
            businessDays={businessDays}
            expenseNames={expenseNames}
            sales={sales}
            returns={returns}
            expenses={expenses}
            receipts={receipts}
            cashTx={cashTx}
            safeTx={safeTx}
            scrapEntries={scrapEntries}
            taskirat={taskirEntries}
            officeTx={taskirOfficeTx}
            partnerTx={partnerTx}
            journal={journal}
            goldLedger={goldLedger}
            reservations={reservations}
            repairs={repairs}
            currency={priceData.currency}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "generalLedger" && (
          <GeneralLedgerPage
            journal={journal}
            goldLedger={goldLedger}
            accounts={CHART_OF_ACCOUNTS}
            currency={priceData.currency}
            branchName={appSettings?.storeName || ""}
            preparedBy={currentUser?.name || ""}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "customerReport" && (
          <CustomerReportPage
            customers={customers}
            sales={sales}
            returns={returns}
            receipts={receipts}
            repairs={repairs}
            reservations={reservations}
            trustAccounts={trustAccounts}
            trustLedger={trustLedger}
            currency={priceData.currency}
            branchName={branchIdentity?.name || appSettings?.storeName || ""}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "docCycle" && (
          <DocCyclePage
            branchName={branchIdentity?.name || appSettings?.storeName || ""}
            preparedBy={currentUser?.name || ""}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "exchange" && (
          <ExchangePage
            sales={sales} returns={returns} expenses={expenses} receipts={receipts}
            cashTx={cashTx} safeTx={safeTx} journal={journal} items={items}
            customers={customers} suppliers={suppliers} accounts={CHART_OF_ACCOUNTS}
            importedRefs={[...journal, ...expenses, ...customers, ...suppliers]
              .map((x) => x.extRef).filter(Boolean)}
            branchCode={branchIdentity?.code || ""}
            branchName={branchIdentity?.name || appSettings?.storeName || ""}
            currency={priceData.currency}
            onImport={handleImportExchange}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "masterReport" && (
          <MasterReportPage
            sales={sales}
            returns={returns}
            expenses={expenses}
            cashTx={cashTx}
            safeTx={safeTx}
            items={items}
            lots={lots}
            scrapEntries={scrapEntries}
            journal={journal}
            scrapCustodyTx={scrapCustodyTx}
            safeGoldTx={safeGoldTx}
            priceData={priceData}
            currency={priceData.currency}
            branchName={appSettings?.storeName || ""}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "journal" && (
          <DailyJournalPage
            sales={sales}
            expenses={expenses}
            cashTx={cashTx}
            safeTx={safeTx}
            scrapCustodyTx={scrapCustodyTx}
            scrapEntries={scrapEntries}
            lots={lots}
            businessDays={businessDays}
            receipts={receipts}
            safeGoldTx={safeGoldTx}
            weightAdjustments={weightAdjustments}
            index={universalIndex}
            suppliers={suppliers}
            customers={customers}
            users={users}
            settings={appSettings}
            entrySessions={entrySessions}
            currency={priceData.currency}
            price24={priceData.current}
            branchName={branchIdentity?.name}
            onEditFees={() => setMorePage("settings")}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "workday" && (
          <WorkDayPage
            openDay={openDay}
            businessDays={businessDays}
            lots={lots}
            onOpenDay={handleOpenBusinessDay}
            onCloseDay2={handleCloseBusinessDay}
            priceData={priceData}
            cashBalance={cashBalance}
            safeBalance={safeBalance}
            openCustodySession={openCustodySession}
            sales={sales}
            expenses={expenses}
            items={items}
            currency={priceData.currency}
            onOpenCustody={handleOpenDailyCustody}
            onCloseCustody={handleCloseDailyCustody}
            onCloseDay={handleCloseDay}
            onGo={(id) => setMorePage(id)}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "reservations" && (
          <ReservationsPage
            reservations={reservations}
            customers={customers}
            activeItems={activeItems}
            currency={priceData.currency}
            canManage={role !== "employee"}
            onAdd={handleAddReservation}
            onCancel={handleCancelReservation}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "safeAudit" && (
          <SafeAuditPage
            audits={safeAudits}
            safeBalance={safeBalance}
            currency={priceData.currency}
            canManage={role === "manager"}
            onSave={handleSafeAudit}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "trustAccounts" && (
          <TrustAccountsPage
            trustItems={trustGold}
            onReturnItem={handleReturnTrustGold}
            onReceipt={(h, r) => trustReceiptPdf(h, r, trustBalance(trustLedger, h.id))}
            onShare={(h, r) => shareTrustReceipt(h, r, trustBalance(trustLedger, h.id))}
            holders={trustAccounts}
            ledger={trustLedger}
            currency={priceData.currency}
            price24={priceData.current}
            openDay={openDay}
            canManage={role === "manager" || role === "assistant"}
            onAddHolder={handleAddTrustHolder}
            onMove={handleTrustMove}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "customers" && (
          <CustomersPage
            onEditCustomer={(id, f, v) => editRecord(CUSTOMERS_KEY, setCustomers, customers, id, f, v)}
            onOpenEntity={(k, r) => setSheetEntity({ kind: k, record: r })}
            customers={customers}
            sales={sales}
            returns={returns}
            repairs={repairs}
            trustGold={trustGold}
            receipts={receipts}
            currency={priceData.currency}
            canManage={role !== "employee"}
            onAdd={handleAddCustomer}
            onCollect={handleCollectReceivable}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "printerSetup" && (
          <PrinterSettingsPage
            config={printerCfg}
            onSave={handleSavePrinter}
            sampleItem={activeItems[0]}
            currency={priceData.currency}
            price24={priceData.current}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "rfidReader" && (
          // ⚠ onApplyCount غير مُمرَّر بعد: شاشة الجرد الحالية
          // (StocktakeSubPage) نموذجها إدخال يدوي لكل صنف
          // (onUpdateEntry(bucket, itemId, field, val)) لا استيراد دفعة
          // قراءات — ربط "اعتمد هذه القراءة جردًا" بها عمل منفصل يحتاج
          // نقل m.found/m.missing إلى generalEntries/sectionalEntries،
          // لم يُطلب بعد. الشاشة تعمل بالكامل بدونه: اتصال، مسح حي/دفعي،
          // بحث عن قطعة، وربط بطاقة غير معروفة (حقيقي — يكتب على الخادم).
          <RfidReaderPage
            items={activeItems}
            rfidCfg={rfidCfg}
            canManage={role !== "employee"}
            onBindEpc={handleBindEpc}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "rfidSettings" && (
          <div>
            <SubPageHeader title="إعدادات القارئ" onBack={() => setMorePage(null)} />
            <div className="px-4 pt-3">
              <RfidSettingsCard settings={rfidCfg} onSave={handleSaveRfid} />
            </div>
          </div>
        )}
        {morePage === "fixedAssets" && (
          <FixedAssetsPage
            assets={fixedAssets}
            depreciations={depreciations}
            currency={priceData.currency}
            canManage={role === "manager"}
            onAdd={handleAddFixedAsset}
            onRunDepreciation={handleRunDepreciation}
            onDispose={handleDisposeFixedAsset}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "payroll" && (
          <PayrollPage
            currency={priceData.currency}
            safeBalance={safeBalance}
            canManage={role === "manager"}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "attendanceHr" && (
          <AttendanceHrPage
            users={users}
            canManage={role !== "employee"}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "hqReports" && (
          <HqReportPage
            currency={priceData.currency}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "priceFix" && (
          <PriceFixPage
            priceData={priceData}
            openDay={openDay}
            canManage={role === "manager"}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "scrapCustody" && (
          <ScrapCustodyPage
            onReceiveOfficer={handleReceiveScrapOfficer}
            onDepositVault={handleDepositScrapToVault}
            scrapEntries={scrapEntries}
            scrapRequests={scrapRequests}
            settings={appSettings}
            currency={priceData.currency}
            price24={priceData.current}
            role={role}
            onSend={handleSendScrap}
            onAssess={handleAssessScrap}
            onApprove={handleApproveScrap}
            onReceive={handleReceiveScrap}
            onBreak={handleBreakStones}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "scrapIntake" && (
          <ScrapIntakePage
            scrapEntries={scrapEntries}
            customers={customers}
            currency={priceData.currency}
            price24={priceData.current}
            settings={appSettings}
            custodyBalance={scrapCustodyBalance.total}
            onConfirm={handleAddScrap}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "categories" && (
          <CategoriesPage
            categories={categories}
            items={items}
            inUse={categoryInUse}
            onSave={handleSaveCategories}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "goldOut" && (
          <IssueOutPage
            items={items}
            categories={CATEGORY_STATE.list}
            currency={priceData.currency}
            price24={priceData.current}
            role={role}
            appMode={appMode}
            onIssue={handleIssueOut}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "itemEdit" && (
          <ItemEditPage
            items={items}
            currency={priceData.currency}
            price24={priceData.current}
            onChangeCategory={handleChangeItemCategory}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "conversions" && (
          <ConversionsPage
            items={items}
            scrapEntries={scrapEntries}
            weightAdjustments={weightAdjustments}
            currency={priceData.currency}
            price24={priceData.current}
            onScrapToProduct={handleScrapToProduct}
            onProductToScrap={handleProductToScrap}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "integration" && (
          <IntegrationPage
            config={integration}
            log={extInvoices}
            users={users}
            items={items}
            onSave={handleSaveIntegration}
            onTest={handleExternalInvoice}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "storeLink" && (
          <StoreLinkPage
            config={storeLink}
            orders={storeOrders}
            items={items}
            onSave={handleSaveStore}
            onTest={handleStoreOrder}
            onBack={() => setMorePage(null)}
          />
        )}
        {morePage === "backup" && (
          <BackupPage onBackup={handleBackup} onRestore={handleRestore} onLoadDemo={handleLoadDemo} onResetAll={handleResetAll} onBack={() => setMorePage(null)} />
        )}
        {morePage === "purchases" && (
          <PurchasesPage
            weightAdjustments={weightAdjustments}
            totals={purchasesTotals}
            lots={lots}
            suppliers={suppliers}
            scrapEntries={scrapEntries}
            taskirEntries={taskirEntries}
            expenses={expenses}
            currency={priceData.currency}
            onBack={() => setMorePage(null)}
            flashToast={flashToast}
          />
        )}
        {morePage === "openingBalance" && (
          <OpeningBalancePage
            openingBalance={openingBalance}
            onSave={handleSaveOpeningBalance}
            currency={priceData.currency}
            price24={priceData.current}
            goldEquivalent={goldEquivalent}
            openingGoldEquivalent={openingGoldEquivalent}
            fiscalClosures={fiscalClosures}
            latestClosure={latestClosure}
            cashBalance={cashBalance}
            safeBalance={safeBalance}
            safeGoldBalance={safeGoldBalance}
            scrapCustodyBalance={scrapCustodyBalance}
            partnersTotals={partnersTotals}
            partners={partners}
            sales={sales}
            expenses={expenses}
            onCloseYear={handleCloseFiscalYear}
            onBack={() => setMorePage(null)}
          />
        )}
      </div>

      {/* bottom nav — fully customizable per role via "تخصيص القائمة" */}
      {(() => {
        // ⚠ `permsNow` لا `effectivePerms` مباشرةً.
        //
        // الثانية تُعيد صلاحية الدور خامًا بلا تصفية الوضع، فيظهر
        // تبويب المبيعات في محلٍّ ضبطه صاحبه على المخزون وحده — ويضغطه
        // البائع فيجد شاشةً لا تعمل.
        const permittedSet = new Set([
          ...permsNow.allowedTabs.filter((id) => id !== "more"),
          ...permsNow.allowedMore,
        ]);
        // ⚠ الحدّ بالمقاس: شاشة ويندوز تعرض عشرًا في الصفّ والجوال خمسًا.
        const layout = normalizeRoleLayout(navLayout[role], navPerRow(vp.size));
        // المجمّع مسموح إن سُمح بأي صفحة داخله
        const allow = (ids) =>
          ids.filter((id) =>
            isBundle(id)
              ? (bundleById(id)?.items || []).some((x) => permittedSet.has(x))
              : permittedSet.has(id) && id !== "navCustomize"
          );
        // المجمّع يُعرض كزر عادي، والصفحة تُقرأ من السجل
        const pick = (ids) =>
          allow(ids)
            .map((id) => (isBundle(id) ? bundleById(id) : NAV_REGISTRY.find((n) => n.id === id)))
            .filter(Boolean);
        const row1 = pick(layout.row1);
        const row2 = pick(layout.row2);
        const isActive = (id) => (TAB_KIND_IDS.includes(id) ? tab === id && morePage === null : morePage === id);
        const hasRow2 = row2.length > 0;
        const cols = (n) => `repeat(${Math.max(1, n)}, minmax(0, 1fr))`;

        return (
          <div
            className="fixed bottom-0 left-0 right-0 z-40"
            // ⚠ على الشاشة الكبيرة رصيفٌ جانبي لا شريط سفلي.
            //
            // الشريط السفلي مصمَّم للإبهام: يُصاب بلا نظر لأن اليد
            // ممسكة بالجهاز. على الآيباد والحاسب اليد على الفأرة أو
            // بعيدة عن الحافة، وشريطٌ بعرض الشاشة يعني مسافةً طويلة
            // لكل ضغطة — والرصيف الجانبي أقرب وأثبت.
            // ظلّ علويّ خفيف يفصله عن المحتوى
            style={{
              background: "var(--panel)",
              borderTop: "1px solid var(--edge)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
            // السحب لأعلى يفتح الصف الثاني، ولأسفل يطويه — أسرع من
            // إصابة مقبض صغير بالإبهام.
            onTouchStart={(e) => {
              if (!hasRow2) return;
              e.currentTarget.dataset.y = String(e.touches[0].clientY);
            }}
            onTouchEnd={(e) => {
              if (!hasRow2) return;
              const start = Number(e.currentTarget.dataset.y || 0);
              const dy = start - (e.changedTouches[0]?.clientY || start);
              if (dy > 28) setRow2Open(1);
              else if (dy < -28) setRow2Open(0);
            }}
          >
            {hasRow2 && (
              // ⚠ إصلاح واجهة حقيقي بعد طلبك: الخط الرفيع لم يكن يدل بوضوح
              // على وجود قائمة ثانية قابلة للضغط — بعض المستخدمين ظنّوه
              // زخرفةً لا زرًّا. سهمٌ يتقلّب اتجاهه (لأعلى وهي مطويّة، لأسفل
              // وهي مفتوحة) أوضح دلالةً على "اضغط لترى المزيد" من خط مجرَّد.
              <button
                onClick={() => setRow2Open((v) => (v ? 0 : 1))}
                aria-label={row2Open ? "طيّ الصف الثاني" : "إظهار الصف الثاني"}
                className="w-full flex items-center justify-center"
                style={{ padding: "6px 0 4px" }}
              >
                <div
                  style={{
                    width: 30, height: 20, borderRadius: 999,
                    background: "var(--line)", border: "1px solid var(--edge)",
                    display: "grid", placeItems: "center",
                  }}
                >
                  <ChevronUp
                    size={16}
                    color={row2Open ? "var(--accent)" : "var(--text3)"}
                    style={{
                      transform: row2Open ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform .2s, color .2s",
                    }}
                  />
                </div>
              </button>
            )}

            {hasRow2 && (
              <div
                className="mx-auto grid"
                style={{
                  maxWidth: 448,
                  gridTemplateColumns: cols(row2.length),
                  maxHeight: row2Open ? 72 : 0,
                  opacity: row2Open ? 1 : 0,
                  overflow: "hidden",
                  transition: "max-height .22s ease, opacity .18s ease",
                  borderBottom: row2Open ? "1px solid var(--line)" : "none",
                }}
              >
                {row2.map((n) => {
                  const Icon = n.icon;
                  return (
                    <NavBtn
                      key={n.id}
                    onReorderStart={() => startNavDrag(n.id, "row2")}
                    navId={n.id}
                    onReorderOver={(id) => overNavDrag(id, "row2")}
                    onReorderEnd={endNavDrag}
                    reordering={dragNav?.id === n.id}
                      active={isBundle(n.id) ? (n.items || []).some((x) => isActive(x)) : isActive(n.id)}
                      onClick={() => {
                        if (isBundle(n.id)) setOpenBundle(n.id);
                        else openPage(n.id);
                        setRow2Open(0);
                      }}
                      icon={<Icon size={17} />}
                      label={n.label}
                    />
                  );
                })}
              </div>
            )}

            <div
                className="mx-auto grid"
                style={{
                  maxWidth: 448,
                  gridTemplateColumns: cols(row1.length),
                }}
              >
              {row1.map((n) => {
                const Icon = n.icon;
                return (
                  <NavBtn
                    key={n.id}
                    onReorderStart={() => startNavDrag(n.id, "row1")}
                    navId={n.id}
                    onReorderOver={(id) => overNavDrag(id, "row1")}
                    onReorderEnd={endNavDrag}
                    reordering={dragNav?.id === n.id}
                    active={isBundle(n.id) ? (n.items || []).some((x) => isActive(x)) : isActive(n.id)}
                    onClick={() => (isBundle(n.id) ? setOpenBundle(n.id) : openPage(n.id))}
                    icon={<Icon size={17} />}
                    label={n.label}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Floating AI assistant — draggable, reachable from anywhere in the app */}
      {/* ⚠ المساعد للمدير وحده: البائع الممنوع من التقارير كان سيسأله
          «كم ربح المحل؟» فيجيب — باب خلفي حول الصلاحيات. */}
      {(() => {
        // ══════════════════════════════════════════════════════════
        //  الرصيف العائم
        //
        //  ⚠ للمدير وحده. البائع يرى أدوات الذكاء فقط.
        //
        //  الرصيف يطفو فوق كل شاشة ويحمل اختصارات تتجاوز التنقّل
        //  المعتاد — والاختصار الذي يتجاوز الشاشات يتجاوز معها
        //  حرّاسها. فمن قُيِّد بشاشتين لا يُعطى بابًا يفتح غيرهما.
        //
        //  والذكاء يبقى: هو يقرأ ولا يكتب، ونطاقه مُقيَّد بصلاحية
        //  من يسأل — فلا يُخبر البائع بما لا يراه في شاشاته.
        // ══════════════════════════════════════════════════════════
        const fullDock = !!ROLES[role]?.canManageDay;
        const acts = [];
        if (aiAllowedFor(role, currentUser))
          acts.push({
            id: "ai", label: "مساعد أوقية — اضغط مطوّلًا للأسئلة السريعة",
            node: <AiLogoBadge width={30} />,
            // ⚠ نقرة = فتح شاشة المساعد صوتيًّا مباشرة، وضغطة مطوّلة =
            // ورقة الأوامر السريعة. كانت النقرة العادية تفتح الورقة فقط
            // وتترك «مساعد أوقية» بابًا لا يُصل إليه بلمسةٍ واحدة.
            onPress: () => { setAiVoiceFirst(true); openPage("aiAssistant"); },
            onLongPress: () => setShowAiSheet(true),
          });
        // ── البحث الشامل ──
        //
        // ⚠ هذا بديل `Ctrl+K` على جهازٍ بلا لوحة مفاتيح.
        //
        // كان في القائمة بثلاث نقرات، وهو أكثر ما يُستعمل حين تُنسى
        // فاتورة أو يُسأل عن قطعة. رفعُه للرصيف يجعله **نقرة واحدة من
        // أي شاشة** — وهو ما تفعله لوحة الأوامر في المكتبي.
        if (permsNow.allowedMore.includes("search"))
          acts.push({
            id: "search", label: "البحث الشامل",
            node: <Search size={21} color="var(--accent)" />,
            onPress: () => openPage("search"),
          });
        // الصوت لمن يملك أي صلاحية — يداه مشغولتان بالميزان والقطعة
        acts.push({
          id: "voice", label: "الأوامر الصوتية",
          node: <Mic size={22} color="var(--accent)" />,
          onPress: () => setShowVoice(true),
        });
        // ⚠ البيع السريع للمدير وحده: البائع يبيع من شاشته حيث
        // يراه حاجز اليوم وقفل الجرد قبل أن يضغط.
        if (fullDock && permsNow.allowedTabs.includes("sales"))
          acts.push({
            id: "sell", label: "فاتورة بيع سريعة",
            accent: "linear-gradient(135deg,var(--gradFrom),var(--gradTo))",
            border: "var(--gradTo)",
            node: <Plus size={22} color="var(--panel)" />,
            onPress: () => {
              // ⚠ لا بيع بلا يوم مفتوح — نوجّه بدل أن نفتح نموذجًا يُرفض
              if (!openDay) {
                flashToast("افتح يوم العمل أولًا");
                openPage("workday");
                return;
              }
              if (stocktakeLock) {
                flashToast("المخزون مقفل للجرد");
                return;
              }
              setTab("sales");
              setMorePage(null);
              setShowNewSale(true);
            },
          });
        if (!acts.length) return null;
        return (
          <FloatingDock
            pos={aiButtonPos}
            onPosChange={setAiButtonPos}
            collapsed={dockClosed}
            onToggle={() => setDockClosed((v) => !v)}
            actions={acts}
          />
        );
      })()}
      {showAiChat && (
        <AiChatPanel
          seed={aiSeed}
          index={aiIndex}
          facts={aiFacts}
          role={role}
          contextText={buildAiChatContext(role, {
            totals,
            currency: priceData.currency,
            salesTotals,
            cashBalance,
            safeBalance,
            safeGoldBalance,
            custodyBalance: scrapCustodyBalance,
            scrapTotals,
            expensesTotals,
            suppliers,
            lots,
            partners,
            partnersTotals,
            goldEquivalent,
            priceData,
          })}
          onClose={() => setShowAiChat(false)}
        />
      )}

      {showPrice && <SetPriceModal current={priceData} onClose={() => setShowPrice(false)} onSave={handleSetPrice} />}
      {showNewSale && (
        <NewSaleModal
            settings={appSettings}
            role={role}
          customers={customers}
          activeItems={activeItems}
          priceData={priceData}
          initialItemId={quickSaleItemId}
          taxEnabled={appSettings.taxEnabled}
          taxRate={appSettings.taxRate}
          currency={priceData.currency}
          dailyCash={cashBalance.cash}
          onClose={() => {
            setShowNewSale(false);
            setQuickSaleItemId(null);
          }}
          onConfirm={handleCreateSale}
        />
      )}
      {viewingSale && (
        <SaleDetailModal
          sale={viewingSale}
          currency={priceData.currency}
          returns={returns}
          canReturn={effectivePerms(role, currentUser).allowedMore.includes("salesHistory") || role === "manager"}
          onReturn={handleReturnSale}
          onClose={() => setViewingSale(null)}
        />
      )}
      {showVoice && (
        <VoiceSheet
          scope={aiScope(permsNow)}
          onNav={(pageId) => openPage(pageId)}
          onAsk={(q) => { setAiSeed(q); setShowAiChat(true); }}
          onAction={(cmd) => {
            // ⚠ التنفيذ بعد التأكيد فقط — راجع VoiceSheet
            switch (cmd.action) {
              case "newSale":
                if (!openDay) { flashToast("افتح يوم العمل أولًا"); openPage("workday"); return; }
                if (stocktakeLock) { flashToast("المخزون مقفل للجرد"); return; }
                setTab("sales"); setMorePage(null); setShowNewSale(true);
                break;
              case "expense":
                setTab("expenses"); setMorePage(null);
                if (cmd.params?.amount) flashToast(`مصروف ${fmt(cmd.params.amount, 2)} — أكمل البيانات`);
                break;
              case "openDay":
                openPage("workday");
                break;
              case "scrapIntake":
                openPage("scrapIntake");
                if (cmd.params?.karat) flashToast(`عيار ${cmd.params.karat} — أكمل الوزن`);
                break;
              case "lockStock":
                if (!stocktakeLock) handleToggleStocktakeLock(true);
                openPage("stocktake");
                break;
              default:
                flashToast("أمر غير مدعوم بعد");
            }
          }}
          onClose={() => setShowVoice(false)}
        />
      )}
      {showAiSheet && (
        <AiActionSheet
          hasDay={!!openDay}
          shortcuts={shortcuts}
          scope={aiScope(permsNow)}
          onMakeShortcut={handleMakeShortcut}
          onRemoveShortcut={handleRemoveShortcut}
          onAsk={(q) => {
            setAiSeed(q);
            setShowAiChat(true);
          }}
          onOpenChat={() => {
            setAiSeed("");
            setShowAiChat(true);
          }}
          onGoTo={openPage}
          onClose={() => setShowAiSheet(false)}
        />
      )}
      {openBundle && (() => {
        const b = bundleById(openBundle);
        // ⚠ `permsNow` لا `effectivePerms` خامًا: الثانية تتجاهل وضع
        // التطبيق، فتظهر في الورقة شاشةٌ أغلقها صاحب المحل.
        const permitted = new Set([...permsNow.allowedTabs, ...permsNow.allowedMore]);
        const avail = (b?.items || []).filter((x) => permitted.has(x));
        // ⚠ لا نُغيّر الحالة أثناء الرسم.
        //
        // `openPage()` هنا أثرٌ جانبي في جسم الرسم: React قد تُعيد
        // الرسم قبل أن يُثبَّت، فتدور الورقة بين فتحٍ وإغلاق ولا تظهر
        // أبدًا — وهو ما حدث فعلًا: الضغط لا يفعل شيئًا.
        //
        // والتحويل المباشر لخيارٍ وحيد يبقى، لكن في أثرٍ بعد الرسم.
        return (
          <BundleSheet
            bundle={b}
            permitted={permitted}
            single={avail.length === 1 ? avail[0] : null}
            onSelect={openPage}
            onClose={() => setOpenBundle(null)}
          />
        );
      })()}
      {showPartialSale && (
        <PartialSaleModal
          items={activeItems}
          categories={categories}
          customers={customers}
          currency={priceData.currency}
          price24={priceData.current}
          settings={appSettings}
          onClose={() => setShowPartialSale(false)}
          onConfirm={handlePartialSale}
        />
      )}
      {cashModalType && (
        <CashModal
          type={cashModalType}
          partners={partners}
          onAddPartner={() => openPage("partners")}
          onClose={() => setCashModalType(null)}
          onConfirm={handleAddCash}
        />
      )}
      {showAddScrap && (
        <AddScrapModal priceData={priceData} onClose={() => setShowAddScrap(false)} onSave={handleAddScrap} />
      )}
      {showAddPurchase && (
        <AddPurchaseModal suppliers={suppliers} offices={taskirOffices} onClose={() => setShowAddPurchase(false)} onSave={handleAddPurchase} />
      )}

      <Toast message={toast} />
    </div>
  );
}

/// زرّ الشريط — ضغطةٌ قصيرة تفتح، ومطوّلةٌ ترتّب.
///
/// ⚠ كانت المطوّلة تفتح وجهةً مختصرة **والترتيب معًا**.
///
/// وفعلان لضغطةٍ واحدة يتزاحمان: من يضغط ليُرتّب تُفتح له شاشة، ومن
/// يضغط ليختصر يجد أزراره تتحرّك. فلا الاختصار يعمل ولا الترتيب.
///
/// أُلغي الاختصار وبقي الترتيب. والوجهة تُفتح من القائمة كما كانت —
/// نقرةٌ زائدة أهون من إيماءةٍ لا يُعرف ما تفعل.

export { GoldInventoryApp };
