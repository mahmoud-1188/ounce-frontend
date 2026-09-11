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

await page.evaluate(async () => {
  const item = {
    id: "test-bar-2",
    categoryId: "bar",
    karat: 24,
    weight: 10,
    costPerGram: 250,
    lotWorkmanshipShare: 0,
    units: [{ code: "BAR-0002", sold: false }],
  };
  await window.storage.set("ounce_items_v3", JSON.stringify([item]));
  await window.storage.set("ounce_price_data_v1", JSON.stringify({ current: 300, currency: "ر.س", history: [] }));
});

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);

const salesTabBtn = page.locator('button:has-text("المبيعات")').first();
await salesTabBtn.click();
await page.waitForTimeout(500);

const openDayBtn = page.locator("text=افتح اليوم الآن").first();
if (await openDayBtn.count()) {
  await openDayBtn.click();
  await page.waitForTimeout(500);
  const openNewDayBtn = page.locator("button:has-text('فتح يوم عمل جديد')").first();
  if (await openNewDayBtn.count()) {
    await openNewDayBtn.click();
    await page.waitForTimeout(500);
    const numberInputs = page.locator('input');
    const inputCount = await numberInputs.count();
    if (inputCount >= 1) await numberInputs.nth(0).fill("0");
    if (inputCount >= 2) await numberInputs.nth(1).fill("0");
    const confirmOpenBtn = page.locator("button:text-is('تأكيد الفتح')").first();
    if (await confirmOpenBtn.count()) {
      await confirmOpenBtn.click();
      await page.waitForTimeout(600);
    }
  }
  await salesTabBtn.click();
  await page.waitForTimeout(500);
}

const partialBtn = page.locator("button:has-text('بيع بالوزن')").first();
await partialBtn.click();
await page.waitForTimeout(600);

const itemSelect = page.locator("select").first();
await itemSelect.selectOption({ index: 1 });
await page.waitForTimeout(400);

// Sell the whole 10g via the "الكل" chip.
const allBtn = page.locator("button:has-text('الكل')").first();
await allBtn.click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/partial_full_01_all_selected.png` });
console.log("AFTER ALL SELECT:", (await page.locator("body").innerText()).slice(0, 900));

const suggestedBtn = page.locator("button:has-text('المقترح')").first();
if (await suggestedBtn.count()) {
  await suggestedBtn.click();
  await page.waitForTimeout(300);
}

const confirmBtn = page.locator("button:has-text('بيع القطعة كاملة'), button:has-text('بيع 10.000 جم')").first();
console.log("CONFIRM TEXT PRESENT:", await confirmBtn.count());
console.log("CONFIRM DISABLED?", await confirmBtn.isDisabled().catch(() => null));
if (!(await confirmBtn.isDisabled().catch(() => true))) {
  await confirmBtn.click();
  await page.waitForTimeout(700);
}
await page.screenshot({ path: `${OUT}/partial_full_02_after_confirm.png` });

const after = await page.evaluate(async () => {
  async function safeGet(key) {
    try {
      const res = await window.storage.get(key);
      return JSON.parse(res.value);
    } catch (e) {
      return null;
    }
  }
  return {
    items: await safeGet("ounce_items_v3"),
    sales: await safeGet("ounce_sales_v1"),
  };
});
console.log("AFTER:", JSON.stringify(after));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
