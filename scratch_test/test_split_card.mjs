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

// Seed one inventory item.
await page.evaluate(async () => {
  const item = {
    id: "test-item-3",
    categoryId: "ring",
    karat: 21,
    weight: 5.5,
    costPerGram: 200,
    workmanshipPerUnit: 50,
    lotWorkmanshipShare: 200, // bigger workmanship so total is a round, easy-to-check number
    units: [{ code: "TST-0003", sold: false }],
  };
  await window.storage.set("ounce_items_v3", JSON.stringify([item]));
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

const newSaleBtn = page.locator("button:has-text('فاتورة بيع جديدة')").first();
await newSaleBtn.click();
await page.waitForTimeout(600);

const itemCard = page.locator("text=خاتم").first();
await itemCard.click();
await page.waitForTimeout(400);

// Set price manually to a clean 200.00 (workmanship only, since gold price = 0 in this seed).
const priceInput = page.locator('input[placeholder="السعر"]').first();
await priceInput.fill("200");
await page.waitForTimeout(300);

// Turn OFF tax to keep the math simple for this payment-split test
// (tax math already verified in the earlier cash-sale test).
const noTaxBtn = page.locator("button:has-text('بدون ضريبة')").first();
if (await noTaxBtn.count()) {
  await noTaxBtn.click();
  await page.waitForTimeout(300);
}

// Enable split payment.
const splitBtn = page.locator("button:has-text('دفع مقسّم')").first();
await splitBtn.click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/split_01_enabled.png` });

// Fill cash part = 80 (leaving 120 on the network).
const allInputs = page.locator("input");
const cnt = await allInputs.count();
let cashPartIdx = -1;
for (let i = 0; i < cnt; i++) {
  const ph = await allInputs.nth(i).getAttribute("placeholder");
  if (ph === "0") cashPartIdx = i; // the split cash-part NumericInput uses placeholder "0"
  console.log(`input[${i}] placeholder=`, ph);
}
console.log("CASH PART INDEX:", cashPartIdx);
if (cashPartIdx >= 0) {
  await allInputs.nth(cashPartIdx).fill("80");
  await page.waitForTimeout(400);
}
await page.screenshot({ path: `${OUT}/split_02_cash_filled.png` });

// Select Visa network (2.5% fee).
const visaBtn = page.locator("button:has-text('فيزا')").first();
await visaBtn.click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/split_03_visa_selected.png` });
console.log("BODY TEXT AFTER VISA SELECT:", (await page.locator("body").innerText()).slice(-1200));

// Confirm.
const confirmSaleBtn = page.locator("button:has-text('تأكيد البيع')").first();
console.log("CONFIRM DISABLED?", await confirmSaleBtn.isDisabled().catch(() => null));
if (!(await confirmSaleBtn.isDisabled().catch(() => true))) {
  await confirmSaleBtn.click();
  await page.waitForTimeout(700);
}
await page.screenshot({ path: `${OUT}/split_04_after_confirm.png` });

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
    cash: await safeGet("ounce_cash_v1"),
    goldLedger: await safeGet("ounce_gold_ledger_v1"),
    sales: await safeGet("ounce_sales_v1"),
  };
});
console.log("AFTER:", JSON.stringify(after));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
