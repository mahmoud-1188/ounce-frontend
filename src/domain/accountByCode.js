import { CHART_OF_ACCOUNTS } from "../core/chart.js";

const accountByCode = (code) => CHART_OF_ACCOUNTS.find((a) => a.code === code) || null;

export { accountByCode };
