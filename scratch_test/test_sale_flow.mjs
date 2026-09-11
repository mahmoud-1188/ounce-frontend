import { chromium } from "playwright";

const OUT = "/home/claude/ounce-frontend/scratch_test";
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (err) => errors.push("PAGEERROR: " + String(err)));
page.on("console", async (msg) => {
  if (msg.type() === "error" && !/CERT_AUTHORITY|fetchGoldPriceSAR|Failed to fetch/.test(msg.text())) {
    const argsText = await Promise.all(
      msg.args().map((a) => a.jsonValue().catch(() => "<unserializable>"))
    );
    errors.push("CONSOLE: " + msg.text() + " | ARGS: " + JSON.stringify(argsText));
  }
});

await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Seed one inventory item directly through the app's own window.storage shim
// (mirrors what "add goods" would eventually write), so the sale flow has
// something real to sell.
const seedResult = await page.evaluate(async () => {
  const item = {
    id: "test-item-1",
    categoryId: "ring",
    karat: 21,
    weight: 5.5,
    costPerGram: 200,
    workmanshipPerUnit: 50,
    lotWorkmanshipShare: 50,
    units: [{ code: "TST-0001", sold: false }],
  };
  await window.storage.set("ounce_items_v3", JSON.stringify([item]));
  const readBack = await window.storage.get("ounce_items_v3");
  const parsed = JSON.parse(readBack.value);
  return { ok: true, count: Array.isArray(parsed) ? parsed.length : -1 };
});
console.log("SEED:", JSON.stringify(seedResult));

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Login as manager
await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(700);

// Navigate to sales tab first (the "open day" prompt lives there)
const salesTabBtn = page.locator('button:has-text("المبيعات")').first();
if (await salesTabBtn.count()) {
  await salesTabBtn.click();
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${OUT}/s0_sales_tab_initial.png` });

// Open business day if needed
const openDayBtn = page.locator("text=افتح اليوم الآن").first();
if (await openDayBtn.count()) {
  await openDayBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/s1_open_day_modal.png` });
  console.log("OPEN DAY MODAL TEXT:", (await page.locator("body > div").last().innerText().catch(() => "N/A")));
  // The real button label is "فتح يوم عمل جديد"
  const openNewDayBtn = page.locator("button:has-text('فتح يوم عمل جديد')").first();
  if (await openNewDayBtn.count()) {
    await openNewDayBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/s1b_after_open_new_day_click.png` });
    console.log("AFTER OPEN-NEW-DAY CLICK:", (await page.locator("body").innerText()).slice(0, 600));
    // Fill the two custody fields (عهدة الصندوق / عهدة الكسر) — required
    // before "تأكيد الفتح" will actually open the day.
    const numberInputs = page.locator('input[inputmode="decimal"], input[type="number"], input[type="text"]');
    const inputCount = await numberInputs.count();
    console.log("CUSTODY FORM INPUT COUNT:", inputCount);
    // Treasury cash available is 0 in this fresh seed, so custody must be 0
    // too or the confirm button stays disabled (a real, correct safeguard).
    if (inputCount >= 1) await numberInputs.nth(0).fill("0");
    if (inputCount >= 2) await numberInputs.nth(1).fill("0");
    await page.screenshot({ path: `${OUT}/s1c_custody_filled.png` });

    const confirmOpenBtn = page.locator("button:text-is('تأكيد الفتح')").first();
    console.log("CONFIRM-OPEN BUTTON FOUND:", await confirmOpenBtn.count());
    if (await confirmOpenBtn.count()) {
      await confirmOpenBtn.click();
      await page.waitForTimeout(700);
    }
    await page.screenshot({ path: `${OUT}/s1d_after_confirm_open.png` });
    console.log("AFTER CONFIRM-OPEN:", (await page.locator("body").innerText()).slice(0, 500));
  }
  // Navigate back to the sales tab now that the day should be open
  if (await salesTabBtn.count()) {
    await salesTabBtn.click();
    await page.waitForTimeout(500);
  }
}
await page.screenshot({ path: `${OUT}/s2_after_open_day.png` });
await page.screenshot({ path: `${OUT}/s3_sell_page.png` });
console.log("SELL PAGE TEXT:", (await page.locator("body").innerText()).slice(0, 400));

// Click "فاتورة بيع جديدة"
const newSaleBtn = page.locator("button:has-text('فاتورة بيع جديدة')").first();
if (await newSaleBtn.count()) {
  await newSaleBtn.click();
  await page.waitForTimeout(600);
}
await page.screenshot({ path: `${OUT}/s4_new_sale_modal.png` });
console.log("NEW SALE MODAL TEXT:", (await page.locator("body").innerText()).slice(0, 800));

// Select the seeded item (toggle it)
const itemCard = page.locator("text=خاتم").first();
if (await itemCard.count()) {
  await itemCard.click();
  await page.waitForTimeout(400);
}
await page.screenshot({ path: `${OUT}/s5_item_selected.png` });

// Click the "المقترح" suggested-price chip to auto-fill a valid price
const suggestedBtn = page.locator("button:has-text('المقترح')").first();
if (await suggestedBtn.count()) {
  await suggestedBtn.click();
  await page.waitForTimeout(300);
}
await page.screenshot({ path: `${OUT}/s6_price_set.png` });

// Confirm the sale
const confirmSaleBtn = page.locator("button:has-text('تأكيد البيع')").first();
const isDisabled = confirmSaleBtn.count() ? await confirmSaleBtn.isDisabled().catch(() => null) : null;
console.log("CONFIRM BUTTON DISABLED?", isDisabled);
if (await confirmSaleBtn.count() && !isDisabled) {
  await confirmSaleBtn.click();
  await page.waitForTimeout(700);
}
await page.screenshot({ path: `${OUT}/s7_after_confirm.png` });
console.log("AFTER CONFIRM TEXT:", (await page.locator("body").innerText()).slice(0, 500));

// Inspect the persisted sale record to verify karatSnapshot is a real number
const salesCheck = await page.evaluate(async () => {
  try {
    const res = await window.storage.get("ounce_sales_v1");
    return JSON.parse(res.value);
  } catch (e) {
    return { error: String(e) };
  }
});
console.log("SALES RECORD (raw):", JSON.stringify(salesCheck).slice(0, 2000));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
