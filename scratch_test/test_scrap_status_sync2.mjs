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

// Part A: directly exercise handleSendScrap via the app's own state setter
// isn't accessible from outside React, so instead we drive it through
// window.storage by simulating what handleSendScrap does NOW (post-fix) vs
// what a piece looks like pre-fix, and confirm ScrapSubPage's rendering
// reacts correctly to the status field it actually reads.
await page.evaluate(async () => {
  const entries = [
    // Piece A: still genuinely in stock (in_box / in_stock) — should show
    // action buttons and count toward "كسر بالمخزن".
    {
      id: "scrap-a", ref: "SCR-A", karat: 21, weight: 10, stonesMargin: 0,
      total: 5000, pricePerGram: 500, paymentMethod: "cash",
      status: "in_stock", stage: "in_box", date: new Date().toISOString(),
      description: "قطعة في الصندوق فعليًا",
    },
    // Piece B: sent for assessment with the FIX applied (status now
    // synced to "sent" by handleSendScrap) — should NOT show action
    // buttons and should NOT count toward "كسر بالمخزن".
    {
      id: "scrap-b", ref: "SCR-B", karat: 21, weight: 7, stonesMargin: 0,
      total: 3500, pricePerGram: 500, paymentMethod: "cash",
      status: "sent", stage: "sent", date: new Date().toISOString(),
      description: "قطعة أُرسلت للفحص (بعد الإصلاح)",
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

// Bottom-nav bundle buttons have a known Playwright click-interception
// quirk from earlier this session (retrying .click() causes the opened
// sheet to flicker/close). Native DOM clicks via evaluate() sidestep it.
const clickByText = (text) => page.evaluate((t) => {
  const els = Array.from(document.querySelectorAll("button, div[role='button'], a"));
  const el = els.find((e) => e.textContent && e.textContent.trim().includes(t));
  if (el) el.click();
  return !!el;
}, text);
const clickByNavId = (id) => page.evaluate((navId) => {
  const el = document.querySelector(`[data-nav-id="${navId}"]`);
  if (el) el.click();
  return !!el;
}, id);

await clickByNavId("grp_scrap_all");
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/scrap_sync2_00_bundle_menu.png` });

// Open "سجل الكسر" (ScrapSubPage) first and read the "كسر بالمخزن" stat.
console.log("CLICKED سجل الكسر:", await clickByText("سجل الكسر"));
await page.waitForTimeout(500);
const scrapPageText = await page.locator("body").innerText();
const statMatch = scrapPageText.match(/كسر بالمخزن[\s\S]{0,20}?([\d.]+)\s*جم/);
console.log("كسر بالمخزن STAT:", statMatch ? statMatch[1] : "(not found)");
console.log("PAGE HAS SCR-A:", scrapPageText.includes("SCR-A"), " SCR-B:", scrapPageText.includes("SCR-B"));
await page.screenshot({ path: `${OUT}/scrap_sync2_01_scrap_page.png` });

// Check action buttons per-card: SCR-A (in_stock) should show them,
// SCR-B (sent, post-fix) should NOT.
const cardAActions = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll("div")).filter((d) =>
    d.textContent.includes("SCR-A") && d.textContent.includes("قطعة في الصندوق"));
  const card = cards.sort((a, b) => a.textContent.length - b.textContent.length)[0];
  return card ? card.textContent : null;
});
const cardBActions = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll("div")).filter((d) =>
    d.textContent.includes("SCR-B") && d.textContent.includes("قطعة أُرسلت"));
  const card = cards.sort((a, b) => a.textContent.length - b.textContent.length)[0];
  return card ? card.textContent : null;
});
console.log("CARD A (in_stock) TEXT:", cardAActions);
console.log("CARD A has 'تحويل لمخزون':", cardAActions?.includes("تحويل لمخزون"));
console.log("CARD B (sent, post-fix) TEXT:", cardBActions);
console.log("CARD B has 'تحويل لمخزون':", cardBActions?.includes("تحويل لمخزون"));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
