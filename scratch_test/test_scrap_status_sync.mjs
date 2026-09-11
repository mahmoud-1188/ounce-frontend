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

// Seed two scrap entries "in stock" (status: in_stock, stage: in_box), plus a
// price so fine-weight math works.
await page.evaluate(async () => {
  const entries = [
    {
      id: "scrap-1", ref: "SCR-0001", karat: 21, weight: 10, stonesMargin: 0,
      total: 5000, pricePerGram: 500, paymentMethod: "cash",
      status: "in_stock", stage: "in_box", date: new Date().toISOString(),
      description: "قطعة اختبار 1",
    },
    {
      id: "scrap-2", ref: "SCR-0002", karat: 21, weight: 5, stonesMargin: 0,
      total: 2500, pricePerGram: 500, paymentMethod: "cash",
      status: "in_stock", stage: "in_box", date: new Date().toISOString(),
      description: "قطعة اختبار 2",
    },
  ];
  await window.storage.set("ounce_scrap_v1", JSON.stringify(entries));
  await window.storage.set("ounce_price_data_v1", JSON.stringify({ current: 300, currency: "ر.س", history: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);

// "الكسر" (ScrapSubPage) lives inside the grp_scrap_all bottom-nav bundle,
// not the hamburger menu. That bundle button has a known click-interception
// quirk from an earlier finding this session — use force:true as was done
// successfully before for other bottom-nav-bundle interactions, then pick
// "سجل الكسر" (scrap, i.e. ScrapSubPage) from its sub-menu.
await page.locator('[data-nav-id="grp_scrap_all"]').first().click({ force: true });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/scrap_sync_00a_bundle_menu.png` });
await page.locator('button:has-text("سجل الكسر")').first().click({ force: true });
await page.waitForTimeout(500);
const beforeText = await page.locator("body").innerText();
const beforeMatch = beforeText.match(/كسر بالمخزن[\s\S]{0,20}?([\d.]+)\s*جم/);
console.log("BEFORE SEND - كسر بالمخزن:", beforeMatch ? beforeMatch[1] : "(not found)");
await page.screenshot({ path: `${OUT}/scrap_sync_00_before.png` });

// Go back (SubPageHeader's chevron is the first button on the sub-page),
// then reopen the same bundle and pick "عهدة الكسر" (scrapCustody) to send
// SCR-0001 for assessment via the real UI.
await page.locator("button").first().click();
await page.waitForTimeout(300);
await page.locator('[data-nav-id="grp_scrap_all"]').first().click({ force: true });
await page.waitForTimeout(500);
const custodyBtn = page.locator('button:has-text("عهدة الكسر")').first();
console.log("CUSTODY BTN COUNT:", await custodyBtn.count());
await custodyBtn.click({ force: true });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/scrap_sync_01_custody_page.png` });

// Should default to "box" tab; select both pieces and send.
const boxTabBtn = page.locator('button:has-text("الصندوق")').first();
if (await boxTabBtn.count()) { await boxTabBtn.click(); await page.waitForTimeout(300); }

const firstPieceBtn = page.locator('button:has-text("SCR-0001")').first();
console.log("FIRST PIECE BTN COUNT:", await firstPieceBtn.count());
await firstPieceBtn.click();
await page.waitForTimeout(300);

const sendBtn = page.locator('button:has-text("إرسال")').first();
console.log("SEND BTN COUNT:", await sendBtn.count(), "TEXT:", await sendBtn.textContent().catch(() => null));
await sendBtn.click();
await page.waitForTimeout(600);

// Verify storage: SCR-0001 should now have BOTH stage and status = "sent".
const afterSend = await page.evaluate(async () => {
  const res = await window.storage.get("ounce_scrap_v1");
  return JSON.parse(res.value);
});
console.log("SCR-0001 AFTER SEND:", JSON.stringify(afterSend.find((e) => e.id === "scrap-1")));

// Now go back to ScrapSubPage and check the stat + action buttons again.
await page.locator("button").first().click();
await page.waitForTimeout(300);
await page.locator('[data-nav-id="grp_scrap_all"]').first().click({ force: true });
await page.waitForTimeout(500);
await page.locator('button:has-text("سجل الكسر")').first().click({ force: true });
await page.waitForTimeout(500);

const afterText = await page.locator("body").innerText();
const afterMatch = afterText.match(/كسر بالمخزن[\s\S]{0,20}?([\d.]+)\s*جم/);
console.log("AFTER SEND - كسر بالمخزن:", afterMatch ? afterMatch[1] : "(not found)");
await page.screenshot({ path: `${OUT}/scrap_sync_02_after.png` });

// Confirm SCR-0001's card no longer shows the action buttons (تصفية/إرسال للفحص/تحويل لمخزون).
const sentCard = page.locator('div:has-text("SCR-0001")').first();
console.log("SENT CARD TEXT SNIPPET:", (await sentCard.innerText().catch(() => "")).slice(0, 300));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
