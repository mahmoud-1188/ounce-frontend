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

// Seed an unprinted unit so the print button is enabled.
await page.evaluate(async () => {
  const item = {
    id: "print-item-1", categoryId: "ring", karat: 21, weight: 5, stonesWeight: 0,
    costPerGram: 250, lotWorkmanshipShare: 0,
    units: [{ code: "PRT-0002", printed: false, sold: false }],
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

// Select the unit.
await page.locator('button:has-text("PRT-0002")').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/print_fix_00_selected.png` });

// Measure boxes and confirm elementFromPoint now hits the print button.
const printBtn = page.locator('button:has-text("طباعة (")').first();
const printBox = await printBtn.boundingBox();
console.log("PRINT BUTTON BOX:", JSON.stringify(printBox));

const centerCheck = await page.evaluate(({ x, y }) => {
  const el = document.elementFromPoint(x, y);
  return el ? el.outerHTML.slice(0, 200) : null;
}, { x: printBox.x + printBox.width / 2, y: printBox.y + printBox.height / 2 });
console.log("ELEMENT AT PRINT BUTTON CENTER:", centerCheck);

// Now actually click it (no force) and confirm the click lands and the
// print flow proceeds (unit becomes printed in storage).
await printBtn.click({ timeout: 5000 });
await page.waitForTimeout(600);

const afterPrint = await page.evaluate(async () => {
  const res = await window.storage.get("ounce_items_v3");
  return JSON.parse(res.value);
});
console.log("UNITS AFTER REAL CLICK:", JSON.stringify(afterPrint[0].units));
await page.screenshot({ path: `${OUT}/print_fix_01_after_click.png` });

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
