import { chromium } from "playwright";

const OUT = "/home/claude/ounce-frontend/scratch_test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.evaluate(async () => {
  await window.storage.set("ounce_scrap_v1", JSON.stringify([]));
  await window.storage.set("ounce_price_data_v1", JSON.stringify({ current: 300, currency: "ر.س", history: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);

await page.locator("button").first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/debug_nav_00_hamburger.png` });
console.log("AFTER HAMBURGER TEXT:", (await page.locator("body").innerText()).slice(0, 1200));

await page.locator('button:has-text("المخزون والتكويد")').first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/debug_nav_01_inventory_group.png` });
console.log("AFTER GROUP CLICK TEXT:", (await page.locator("body").innerText()).slice(0, 1200));

const scrapBtns = page.locator('button:has-text("الكسر")');
console.log("ALL 'الكسر' COUNT:", await scrapBtns.count());
for (let i = 0; i < await scrapBtns.count(); i++) {
  const el = scrapBtns.nth(i);
  console.log(`  [${i}] data-nav-id=`, await el.getAttribute("data-nav-id"), "text=", (await el.innerText()).slice(0,40));
}

await browser.close();
