import { chromium } from "playwright";

const errors = [];
const browser = await chromium.launch();

async function visit(group, item) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push("PAGEERROR: " + String(err)));
  page.on("console", async (msg) => {
    if (msg.type() === "error" && !/CERT_AUTHORITY|fetchGoldPriceSAR|Failed to fetch/.test(msg.text())) {
      const argsText = await Promise.all(msg.args().map((a) => a.jsonValue().catch(() => "<unserializable>")));
      pageErrors.push("CONSOLE: " + msg.text() + " | ARGS: " + JSON.stringify(argsText));
    }
  });
  await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.click('[aria-label="دخول"]');
  await page.waitForTimeout(300);
  await page.locator("p:text-is('المدير')").first().click();
  await page.waitForTimeout(500);

  // Open the hamburger menu grid — its group buttons live inside a modal/overlay,
  // distinct from the bottom nav bar. Scope to the last-opened overlay container.
  await page.locator("button").first().click();
  await page.waitForTimeout(400);

  // The menu grid groups are buttons containing both the group label and a hint line.
  const groupBtn = page.locator(`button:has-text("${group}")`).last();
  await groupBtn.click({ timeout: 5000 }).catch((e) => pageErrors.push("GROUP CLICK FAIL: " + e.message));
  await page.waitForTimeout(400);

  if (item) {
    const itemBtn = page.locator(`button:has-text("${item}")`).last();
    await itemBtn.click({ timeout: 5000 }).catch((e) => pageErrors.push("ITEM CLICK FAIL: " + e.message));
    await page.waitForTimeout(500);
  }

  const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 120).replace(/\n/g, " | ");
  console.log(`${group}${item ? " > " + item : ""} :: errors=${pageErrors.length} :: "${bodyText}"`);
  if (pageErrors.length) console.log("  " + pageErrors.join("\n  "));
  errors.push(...pageErrors.map((e) => `[${group}>${item}] ${e}`));
  await page.close();
}

await visit("المخزون والتكويد", "التصنيفات");
await visit("الشراء والموردين", "المشتريات");
await visit("التقارير", "تقارير البائعين");
await visit("التقارير", "ميزان المراجعة");
await visit("التقارير", "مطابقة البنك");
await visit("التقارير", "تقارير المشتريات");
await visit("التقارير", "اليومية");
await visit("الشراء والموردين", "مكاتب التسكير");
await visit("النظام", "تخصيص القائمة");

console.log("=== TOTAL ERRORS:", errors.length, "===");
console.log(JSON.stringify(errors, null, 2));
await browser.close();
