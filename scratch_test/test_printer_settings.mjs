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
page.on("dialog", async (dialog) => { errors.push("DIALOG: " + dialog.message()); await dialog.dismiss().catch(()=>{}); });

await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);

// Navigate: hamburger -> المخزون والتكويد -> إعدادات الطابعة
await page.locator("button").first().click();
await page.waitForTimeout(400);
await page.locator('button:has-text("المخزون والتكويد")').first().click();
await page.waitForTimeout(400);
console.log("MENU TEXT:", (await page.locator("body").innerText()).slice(0, 1000));

const printerSettingsBtn = page.locator('button:has-text("إعدادات الطابعة")').first();
console.log("PRINTER SETTINGS BTN COUNT:", await printerSettingsBtn.count());
await printerSettingsBtn.click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/printer_settings_00_page.png` });
console.log("PAGE TEXT:", (await page.locator("body").innerText()).slice(0, 600));

// Toggle "العيار" (showKarat) switch and confirm no errors.
const toggles = page.locator('button[style*="border-radius: 12px"]');
console.log("TOGGLE COUNT:", await toggles.count());
if (await toggles.count()) {
  await toggles.first().click();
  await page.waitForTimeout(300);
}

// Exercise the system-print branch of testPrint() (mode defaults to "system").
// window.print() is a no-op in headless Chromium by default.
const testPrintBtn = page.locator('button:has-text("طباعة تجريبية")').first();
await testPrintBtn.click();
await page.waitForTimeout(500);
console.log("STATUS/ERROR TEXT AFTER TEST PRINT:", (await page.locator("body").innerText()).match(/فُتحت طباعة النظام|تعذّرت الطباعة/)?.[0] || "(none found)");
await page.screenshot({ path: `${OUT}/printer_settings_01_after_testprint.png` });

// Save settings.
const saveBtn = page.locator('button:has-text("حفظ")').last();
await saveBtn.click();
await page.waitForTimeout(300);
console.log("AFTER SAVE:", (await page.locator("body").innerText()).match(/حُفظت الإعدادات/)?.[0] || "(none found)");

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
