import { CATEGORY_TO_ACCOUNT, CHART_OF_ACCOUNTS } from "../core/chart.js";
import { EXPENSE_CATEGORIES } from "../core/constants.js";

// حسابات المصروف المخصّصة للمتجر (migration 096): تُسجَّل في الشجرة وفئات المصروف الحيّتين،
// فيظهر الحساب باسمه في اليومية والأستاذ والميزان وكشف الحساب، ويُختار في نموذج المصروف.
// المخفيّ يبقى في الشجرة (عليه قيود) ويُعلَّم hidden فلا يُعرض للاختيار.
function registerCustomAccounts(list = []) {
  for (let i = CHART_OF_ACCOUNTS.length - 1; i >= 0; i--) if (CHART_OF_ACCOUNTS[i].custom) CHART_OF_ACCOUNTS.splice(i, 1);
  for (let i = EXPENSE_CATEGORIES.length - 1; i >= 0; i--) if (EXPENSE_CATEGORIES[i].custom) EXPENSE_CATEGORIES.splice(i, 1);
  for (const k of Object.keys(CATEGORY_TO_ACCOUNT)) if (k.startsWith("acc_")) delete CATEGORY_TO_ACCOUNT[k];
  for (const c of Array.isArray(list) ? list : []) {
    if (!c?.code || !c?.name || CHART_OF_ACCOUNTS.some((a) => a.code === c.code)) continue;
    CHART_OF_ACCOUNTS.push({ code: String(c.code), name: String(c.name), parent: "6000", unit: "currency", nature: "debit", statement: "income", custom: true, hidden: !!c.hidden });
    EXPENSE_CATEGORIES.push({ id: `acc_${c.code}`, label: String(c.name), custom: true, hidden: !!c.hidden, account: String(c.code) });
    CATEGORY_TO_ACCOUNT[`acc_${c.code}`] = String(c.code);
  }
  return CHART_OF_ACCOUNTS.filter((a) => a.custom).length;
}

// فئات المصروف القابلة للاختيار: القياسية والمخصّصة الظاهرة
const selectableExpenseCategories = () => EXPENSE_CATEGORIES.filter((c) => !c.hidden);

export { registerCustomAccounts, selectableExpenseCategories };
