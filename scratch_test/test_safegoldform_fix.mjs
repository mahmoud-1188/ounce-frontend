import { chromium } from "playwright";

const OUT = "/home/claude/ounce-frontend/scratch_test";
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (err) => errors.push("PAGEERROR: " + String(err)));
page.on("console", async (msg) => {
  if (msg.type() === "error" && !/CERT_AUTHORITY|fetchGoldPriceSAR|Failed to fetch/.test(msg.text())) {
    errors.push("CONSOLE: " + msg.text());
  }
});

await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// Seed a supplier and some safe gold so the withdraw-to-supplier path is
// testable end to end, plus enough safe fine weight.
await page.evaluate(async () => {
  const supplier = {
    id: "sup-1", ref: "SUP-001", name: "مورد الاختبار", phone: "",
    isOfficial: false, createdAt: new Date().toISOString(), createdBy: "test",
  };
  await window.storage.set("ounce_suppliers_v1", JSON.stringify([supplier]));
  await window.storage.set("ounce_safe_gold_v1", JSON.stringify([
    { id: "seed-gold", date: new Date().toISOString(), type: "in", kind: "raw", karat: 21, weight: 50, note: "seed", createdBy: "test" },
  ]));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);

// Navigate to "النقد" tab -> "الخزنة" pill. Bottom-nav TAB buttons (not
// bundles) have a known Playwright click-interception quirk from earlier
// this session — use a native DOM click via evaluate() to sidestep it.
const clickByText = (text) => page.evaluate((t) => {
  const els = Array.from(document.querySelectorAll("button, div[role='button'], a"));
  const el = els.find((e) => e.textContent && e.textContent.trim() === t);
  if (el) el.click();
  return !!el;
}, text);

console.log("CLICKED النقد (bundle):", await clickByText("النقد"));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/safegold_00a_after_cash_click.png` });
// The bundle sheet opened with sub-items; click the "النقد" sub-item to
// actually navigate to CashTab (the bundle button and sub-item share text).
const clickSubItemByText = (text) => page.evaluate((t) => {
  const rows = Array.from(document.querySelectorAll("button, div[role='button']"));
  // Prefer the LAST match (the sub-item in the opened sheet, not the
  // bundle trigger itself which may still be in the DOM underneath).
  const matches = rows.filter((e) => e.textContent && e.textContent.trim().includes(t));
  const el = matches[matches.length - 1];
  if (el) el.click();
  return matches.length;
}, text);
console.log("SUB-ITEM النقد MATCHES:", await clickSubItemByText("النقد"));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/safegold_00b_cashtab.png` });
console.log("CLICKED الخزنة:", await clickByText("الخزنة"));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/safegold_00_safe_tab.png` });

// Click "إيداع / سحب ذهب من الخزنة" — this is the exact click that used to
// throw ReferenceError: suppliers is not defined.
const openFormBtn = page.locator('button:has-text("إيداع / سحب ذهب من الخزنة")').first();
console.log("OPEN FORM BTN COUNT:", await openFormBtn.count());
await openFormBtn.click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/safegold_01_form_open.png` });
console.log("FORM VISIBLE TEXT:", (await page.locator("body").innerText()).slice(0, 600));
console.log("ERRORS AFTER OPENING FORM:", JSON.stringify(errors));

// Switch to "سحب" (withdraw) INSIDE the SafeGoldForm specifically — "سحب"
// also appears as the top-level safe cash withdraw button, so scope by
// finding the button that sits right after "نوع الحركة" / "إيداع".
console.log("CLICKED سحب (in SafeGoldForm):", await page.evaluate(() => {
  const labelEl = Array.from(document.querySelectorAll("p, span, label"))
    .find((e) => e.textContent.trim() === "نوع الحركة");
  if (!labelEl) return false;
  const container = labelEl.closest("div")?.parentElement || labelEl.parentElement;
  const btn = Array.from(container.querySelectorAll("button"))
    .find((b) => b.textContent.trim() === "سحب");
  if (btn) { btn.click(); return true; }
  return false;
}));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/safegold_02_withdraw_mode.png` });

// The destination select should now be visible with "سداد مورد" as an
// option, scoped strictly to selects that appear after the "نوع الحركة"
// label (i.e. inside SafeGoldForm), to avoid matching unrelated selects
// elsewhere on the page (e.g. the karat select's option list is numeric-only
// so it won't collide, but scope defensively anyway).
const info = await page.evaluate(() => {
  const labelEl = Array.from(document.querySelectorAll("p, span, label"))
    .find((e) => e.textContent.trim() === "نوع الحركة");
  if (!labelEl) return { found: false };
  const form = labelEl.closest("div").parentElement.closest("div").parentElement;
  const selects = Array.from(form.querySelectorAll("select"));
  const destIdx = selects.findIndex((s) =>
    Array.from(s.options).some((o) => o.textContent.includes("سداد مورد")));
  if (destIdx === -1) return { found: true, destIdx: -1 };
  selects[destIdx].value = Array.from(selects[destIdx].options)
    .find((o) => o.textContent.includes("سداد مورد")).value;
  selects[destIdx].dispatchEvent(new Event("change", { bubbles: true }));
  return { found: true, destIdx };
});
console.log("DEST SELECT INFO:", JSON.stringify(info));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/safegold_03_dest_supplier.png` });

// Now select the supplier the same way.
const supInfo = await page.evaluate(() => {
  const labelEl = Array.from(document.querySelectorAll("p, span, label"))
    .find((e) => e.textContent.trim() === "نوع الحركة");
  if (!labelEl) return { found: false };
  const form = labelEl.closest("div").parentElement.closest("div").parentElement;
  const selects = Array.from(form.querySelectorAll("select"));
  const supIdx = selects.findIndex((s) =>
    Array.from(s.options).some((o) => o.textContent.includes("مورد الاختبار")));
  if (supIdx === -1) return { found: true, supIdx: -1 };
  selects[supIdx].value = Array.from(selects[supIdx].options)
    .find((o) => o.textContent.includes("مورد الاختبار")).value;
  selects[supIdx].dispatchEvent(new Event("change", { bubbles: true }));
  return { found: true, supIdx };
});
console.log("SUPPLIER SELECT INFO:", JSON.stringify(supInfo));
await page.waitForTimeout(300);

// Fill the weight input, scoped to the SafeGoldForm.
const weightSet = await page.evaluate((val) => {
  const labelEl = Array.from(document.querySelectorAll("p, span, label"))
    .find((e) => e.textContent.trim() === "نوع الحركة");
  if (!labelEl) return false;
  const form = labelEl.closest("div").parentElement.closest("div").parentElement;
  const input = form.querySelector('input[inputmode="decimal"]');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, val);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}, "10");
console.log("WEIGHT SET:", weightSet);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/safegold_04_filled.png` });

// Click the "حفظ" (save) button scoped to SafeGoldForm.
const saveClicked = await page.evaluate(() => {
  const labelEl = Array.from(document.querySelectorAll("p, span, label"))
    .find((e) => e.textContent.trim() === "نوع الحركة");
  if (!labelEl) return false;
  const form = labelEl.closest("div").parentElement.closest("div").parentElement;
  const btn = Array.from(form.querySelectorAll("button"))
    .find((b) => b.textContent.trim() === "حفظ");
  if (!btn) return false;
  if (btn.disabled) return "disabled";
  btn.click();
  return true;
});
console.log("SAVE CLICKED:", saveClicked);
await page.waitForTimeout(600);

// Verify: the taskir entry should have been created with the right supplier
// (proving destination + supplierId reached handleAddSafeGoldTx correctly).
const taskirAfter = await page.evaluate(async () => {
  const res = await window.storage.get("ounce_taskirat_v1");
  return res.value ? JSON.parse(res.value) : null;
});
console.log("TASKIR ENTRIES AFTER WITHDRAW:", JSON.stringify(taskirAfter));

const safeGoldAfter = await page.evaluate(async () => {
  const res = await window.storage.get("ounce_safe_gold_v1");
  return JSON.parse(res.value);
});
console.log("SAFE GOLD TX AFTER WITHDRAW:", JSON.stringify(safeGoldAfter));

console.log("FINAL ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
