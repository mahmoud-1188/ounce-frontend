import { chromium } from "playwright";

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

// Seed a legacy item with only the OLD `category` field (as if written by
// an older version of the app before this fix), plus a price seed.
await page.evaluate(async () => {
  const legacyItem = {
    id: "legacy-item-1", category: "bar", karat: 21, weight: 15,
    costPerGram: 250, lotWorkmanshipShare: 0,
    units: [{ code: "LEGACY-0001", sold: false }],
  };
  await window.storage.set("ounce_items_v3", JSON.stringify([legacyItem]));
  await window.storage.set("ounce_price_data_v1", JSON.stringify({ current: 300, currency: "ر.س", history: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);

// After the migration-on-load runs, the item in memory/storage should now
// have categoryId backfilled from category.
const after = await page.evaluate(async () => {
  const res = await window.storage.get("ounce_items_v3");
  return JSON.parse(res.value);
});
console.log("ITEM AFTER LOAD (in storage):", JSON.stringify(after));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
