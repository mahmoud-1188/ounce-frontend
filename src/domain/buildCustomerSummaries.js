import { buildCustomerTimeline } from "./buildCustomerTimeline.js";

function buildCustomerSummaries(stores) {
  const { customers = [] } = stores;
  return customers.map((c) => {
    const t = buildCustomerTimeline({ ...stores, customerId: c.id });
    return { customer: c, ...t.stats };
  }).sort((a, b) => b.spend - a.spend);
}

/// تقرير العملاء الموحّد.

export { buildCustomerSummaries };
