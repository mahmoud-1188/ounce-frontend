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

await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);

// Navigate via the hamburger (☰) menu grid -> "المخزون والتكويد" group -> "التصنيفات".
const hamburgerBtn = page.locator('[aria-label="القائمة"], button:has(svg)').first();
// The hamburger icon is the second icon-button in the top bar (first is back arrow).
const topIconButtons = page.locator("header button, div button").filter({ has: page.locator("svg") });
console.log("ICON BTN COUNT:", await topIconButtons.count());
// Try clicking by known structure: it's usually the very first small icon button on the page.
const menuBtn = page.locator("button").first();
await menuBtn.click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/cat_00_menu_grid.png` });
console.log("MENU GRID TEXT:", (await page.locator("body").innerText()).slice(0, 2000));

const invGroupBtn = page.locator('button:has-text("المخزون والتكويد")').first();
console.log("INV GROUP BTN COUNT:", await invGroupBtn.count());
if (await invGroupBtn.count()) {
  await invGroupBtn.click();
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${OUT}/cat_00b_inv_group.png` });
console.log("INV GROUP TEXT:", (await page.locator("body").innerText()).slice(0, 1500));

const catBtn = page.locator('button:has-text("التصنيفات")').first();
console.log("CAT BTN COUNT:", await catBtn.count());
if (await catBtn.count()) {
  await catBtn.click();
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${OUT}/cat_01_page.png` });
console.log("CATEGORIES PAGE TEXT:", (await page.locator("body").innerText()).slice(0, 1500));

// Try adding a category with a name that already exists to trigger the
// duplicate-name flashToast path.
const countBefore = await page.locator('p:has-text("التصنيفات (")').innerText().catch(() => "?");
console.log("COUNT BEFORE:", countBefore);

const nameInput = page.locator('input[placeholder*="تعليقة"]').first();
console.log("NAME INPUT COUNT:", await nameInput.count());
if (await nameInput.count()) {
  // "خاتم" is a known pre-existing default category — this should hit the
  // duplicate-name guard and call flashToast.
  await nameInput.fill("خاتم");
  await page.waitForTimeout(200);
  const addBtn = page.locator('button:has-text("إضافة")').last();
  await addBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/cat_02_after_duplicate_attempt.png` });
}
const countAfterDup = await page.locator('p:has-text("التصنيفات (")').innerText().catch(() => "?");
console.log("COUNT AFTER DUPLICATE ATTEMPT (should be unchanged):", countAfterDup);
console.log("AFTER DUP ATTEMPT TEXT:", (await page.locator("body").innerText()).slice(0, 1500));
console.log("ERRORS AFTER DUP ATTEMPT:", JSON.stringify(errors, null, 2));

// Now test the "delete a category currently in use" path — "خاتم" is the
// default category, seeded items use it, so it should be in use. Open its
// edit panel and try to delete it.
const ringCard = page.locator("div").filter({ hasText: /^خاتم/ }).first();
const editBtn = page.locator('button:has-text("تعديل")').first();
console.log("EDIT BTN COUNT:", await editBtn.count());
if (await editBtn.count()) {
  await editBtn.click();
  await page.waitForTimeout(300);
  const deleteBtn = page.locator('button:has-text("حذف"), button:has-text("لا يُحذف")').first();
  console.log("DELETE BTN COUNT:", await deleteBtn.count(), "DISABLED:", await deleteBtn.isDisabled().catch(() => null));
  await deleteBtn.click({ force: true });
  await page.waitForTimeout(300);
}
await page.screenshot({ path: `${OUT}/cat_03_after_delete_attempt.png` });
console.log("AFTER DELETE ATTEMPT TEXT:", (await page.locator("body").innerText()).slice(0, 1500));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
