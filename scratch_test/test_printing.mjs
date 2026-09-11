import { chromium } from "playwright";

const OUT = "/home/claude/ounce-frontend/scratch_test";
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (err) => errors.push("PAGEERROR: " + String(err)));
page.on("console", async (msg) => {
  if (msg.type() === "error" && !/CERT_AUTHORITY|fetchGoldPriceSAR|Failed to fetch/.test(msg.text())) {
    const argsText = await Promise.all(msg.args().map((a) => a.jsonValue().catch(() => "<unserializable>")));
    errors.push("CONSOLE: " + msg.text() + " | ARGS: " + JSON.stringify(argsText));
  }
});
page.on("dialog", async (dialog) => { errors.push("DIALOG: " + dialog.message()); await dialog.dismiss().catch(()=>{}); });

await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// Seed an already-printed and an unprinted unit on the same item so we can
// exercise both "إعادة طباعة/رقاقة جديدة" and normal print selection.
await page.evaluate(async () => {
  const item = {
    id: "print-item-1", categoryId: "ring", karat: 21, weight: 5, stonesWeight: 0,
    costPerGram: 250, lotWorkmanshipShare: 0,
    units: [
      { code: "PRT-0001", printed: true, sold: false },
      { code: "PRT-0002", printed: false, sold: false },
    ],
  };
  await window.storage.set("ounce_items_v3", JSON.stringify([item]));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);

// Navigate: hamburger -> المخزون والتكويد -> إعادة الطباعة
await page.locator("button").first().click();
await page.waitForTimeout(400);
await page.locator('button:has-text("المخزون والتكويد")').first().click();
await page.waitForTimeout(400);
await page.locator('button:has-text("إعادة الطباعة")').first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/print_00_page.png` });
console.log("PAGE TEXT:", (await page.locator("body").innerText()).slice(0, 800));

// Select the unprinted unit and print it.
const unprintedRow = page.locator('button:has-text("PRT-0002")').first();
await unprintedRow.click();
await page.waitForTimeout(300);
const printBtn = page.locator('button:has-text("طباعة (")').first();
console.log("PRINT BTN DISABLED:", await printBtn.isDisabled().catch(() => null));

// window.print() will be called — Playwright's Chromium handles print() as
// a no-op by default (no dialog), so this should not hang.
await printBtn.click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/print_01_after_print.png` });
console.log("AFTER PRINT TEXT:", (await page.locator("body").innerText()).slice(0, 500));

const afterPrint = await page.evaluate(async () => {
  const res = await window.storage.get("ounce_items_v3");
  return JSON.parse(res.value);
});
console.log("UNITS AFTER PRINT:", JSON.stringify(afterPrint[0].units));

// Now test "رقاقة جديدة" (replace tag/code) on the already-printed unit.
const replaceTagBtn = page.locator('span:has-text("رقاقة جديدة")').first();
console.log("REPLACE TAG BTN COUNT:", await replaceTagBtn.count());
if (await replaceTagBtn.count()) {
  await replaceTagBtn.click();
  await page.waitForTimeout(600);
}
const afterReplace = await page.evaluate(async () => {
  const res = await window.storage.get("ounce_items_v3");
  return JSON.parse(res.value);
});
console.log("UNITS AFTER REPLACE TAG:", JSON.stringify(afterReplace[0].units));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
