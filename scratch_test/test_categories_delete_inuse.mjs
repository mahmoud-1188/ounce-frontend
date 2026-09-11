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

await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
await page.waitForTimeout(600);

// Seed an item using the "ring" category so it becomes "in use".
await page.evaluate(async () => {
  const item = {
    id: "test-ring-1",
    categoryId: "ring",
    karat: 21,
    weight: 5,
    costPerGram: 250,
    lotWorkmanshipShare: 0,
    units: [{ code: "RING-0001", sold: false }],
  };
  await window.storage.set("ounce_items_v3", JSON.stringify([item]));
});

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);

await page.locator("button").first().click(); // hamburger
await page.waitForTimeout(500);
await page.locator('button:has-text("المخزون والتكويد")').first().click();
await page.waitForTimeout(500);
await page.locator('button:has-text("التصنيفات")').first().click();
await page.waitForTimeout(500);

const editBtn = page.locator('button:has-text("تعديل")').first();
await editBtn.click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/cat_inuse_00_editing.png` });
console.log("EDITING TEXT:", (await page.locator("body").innerText()).slice(0, 1000));

const deleteBtn = page.locator('button:has-text("لا يُحذف"), button:has-text("حذف")').first();
console.log("DELETE BTN TEXT/DISABLED:", await deleteBtn.innerText().catch(() => null), await deleteBtn.isDisabled().catch(() => null));
await deleteBtn.click({ force: true });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/cat_inuse_01_after_delete_attempt.png` });
console.log("AFTER DELETE ATTEMPT TEXT:", (await page.locator("body").innerText()).slice(0, 1000));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
