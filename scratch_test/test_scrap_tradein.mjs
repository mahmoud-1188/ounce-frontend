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

// Seed one inventory item, ready to sell.
await page.evaluate(async () => {
  const item = {
    id: "test-item-2",
    categoryId: "ring",
    karat: 21,
    weight: 5.5,
    costPerGram: 200,
    workmanshipPerUnit: 50,
    lotWorkmanshipShare: 50,
    units: [{ code: "TST-0002", sold: false }],
  };
  await window.storage.set("ounce_items_v3", JSON.stringify([item]));
});

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

// Login as manager, open sales tab, open the business day.
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
    const numberInputs = page.locator('input[inputmode="decimal"], input[type="number"], input[type="text"]');
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

// Snapshot scrap entries + weight ledger BEFORE the sale, for comparison.
const before = await page.evaluate(async () => {
  async function safeGet(key) {
    try {
      const res = await window.storage.get(key);
      return JSON.parse(res.value);
    } catch (e) {
      return null;
    }
  }
  return {
    scrap: await safeGet("ounce_scrap_v1"),
    goldLedger: await safeGet("ounce_gold_ledger_v1"),
    cash: await safeGet("ounce_cash_v1"),
  };
});
console.log("BEFORE:", JSON.stringify(before));

// Open new sale, select the item.
const newSaleBtn = page.locator("button:has-text('فاتورة بيع جديدة')").first();
await newSaleBtn.click();
await page.waitForTimeout(600);

const itemCard = page.locator("text=خاتم").first();
await itemCard.click();
await page.waitForTimeout(400);

// Set a price via the suggested chip.
const suggestedBtn = page.locator("button:has-text('المقترح')").first();
if (await suggestedBtn.count()) {
  await suggestedBtn.click();
  await page.waitForTimeout(300);
}

// Switch payment method to "بدل بكسر" (scrap trade-in).
const scrapMethodBtn = page.locator("button:has-text('بدل بكسر')").first();
await scrapMethodBtn.click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/scrap_01_method_selected.png` });

// Fill the trade-in gross weight and price, then add the trade line.
const grossInput = page.locator('input[inputmode="decimal"], input[type="text"]').first();
console.log("INPUT COUNT AFTER SCRAP SELECT:", await page.locator('input[inputmode="decimal"], input[type="text"]').count());

// Use the labeled fields directly by their placeholder/context via Field wrapper text.
// From NewSaleModal.jsx: "الوزن القائم" field, first NumericInput.
const allInputs = page.locator('input');
const cnt = await allInputs.count();
console.log("ALL INPUT COUNT:", cnt);
for (let i = 0; i < cnt; i++) {
  const ph = await allInputs.nth(i).getAttribute("placeholder");
  console.log(`  input[${i}] placeholder=`, ph);
}

await page.screenshot({ path: `${OUT}/scrap_02_before_fill.png` });

// input[2] = الوزن القائم (gross weight), input[4] = سعر الجرام
await allInputs.nth(2).fill("3");
await page.waitForTimeout(300);
await allInputs.nth(4).fill("100");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/scrap_03_filled.png` });

const addLineBtn = page.locator("button:has-text('إضافة سطر كسر')").first();
console.log("ADD LINE BTN DISABLED?", await addLineBtn.isDisabled().catch(() => null));
await addLineBtn.click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/scrap_04_line_added.png` });
console.log("AFTER ADD LINE TEXT:", (await page.locator("body").innerText()).slice(0, 1500));

// Confirm the sale.
const confirmSaleBtn = page.locator("button:has-text('تأكيد البيع')").first();
console.log("CONFIRM DISABLED?", await confirmSaleBtn.isDisabled().catch(() => null));
if (!(await confirmSaleBtn.isDisabled().catch(() => true))) {
  await confirmSaleBtn.click();
  await page.waitForTimeout(700);
}
await page.screenshot({ path: `${OUT}/scrap_05_after_confirm.png` });
console.log("AFTER CONFIRM TEXT:", (await page.locator("body").innerText()).slice(0, 500));

// Check what actually got persisted.
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
    scrap: await safeGet("ounce_scrap_v1"),
    goldLedger: await safeGet("ounce_gold_ledger_v1"),
    cash: await safeGet("ounce_cash_v1"),
    sales: await safeGet("ounce_sales_v1"),
  };
});
console.log("AFTER:", JSON.stringify(after));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
