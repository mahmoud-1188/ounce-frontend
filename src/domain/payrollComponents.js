import { GOSI_CEILING } from "../core/erp.js";
import { fromHalalas, halalas } from "../core/money.js";

function payrollComponents(emp, settings = {}) {
  const basic = halalas(emp.basicSalary || emp.salary || 0);
  const housing = halalas(emp.housing ?? Math.round(fromHalalas(basic) * 0.25));
  const transport = halalas(emp.transport || 0);
  const other = halalas(emp.otherAllowance || 0);
  const gross = basic + housing + transport + other;
  // وعاء التأمينات
  const subject = Math.min(halalas(GOSI_CEILING), basic + housing);
  return {
    basic: fromHalalas(basic),
    housing: fromHalalas(housing),
    transport: fromHalalas(transport),
    other: fromHalalas(other),
    gross: fromHalalas(gross),
    gosiSubject: fromHalalas(subject),
  };
}

/// حساب راتب شهر واحد.

export { payrollComponents };
