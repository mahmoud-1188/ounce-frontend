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

// Seed a supplier and a gold price so the sale UI works, but do NOT seed
// the item directly — it must be created via the real add-goods flow.
await page.evaluate(async () => {
  const supplier = {
    id: "test-supplier-1", ref: "SUP-001", name: "مورد تجريبي", phone: "",
    isOfficial: false, createdAt: new Date().toISOString(), createdBy: "test",
  };
  await window.storage.set("ounce_suppliers_v1", JSON.stringify([supplier]));
  await window.storage.set("ounce_price_data_v1", JSON.stringify({ current: 300, currency: "ر.س", history: [] }));
  // Seed enough treasury cash so the lot purchase (default "safe_cash"
  // payment method) doesn't drive the safe negative.
  await window.storage.set("ounce_safe_v1", JSON.stringify([
    { id: "seed-cash", date: new Date().toISOString(), type: "in", method: "cash", amount: 100000, note: "seed", source: "seed", category: "seed" },
  ]));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);

// Go to التكويد and add a "سبيكة" (bar, sale-mode partial) item via the real UI.
const addGoodsBtn = page.locator("button:has-text('التكويد')").first();
await addGoodsBtn.click();
await page.waitForTimeout(500);

const newLotBtn = page.locator("button:has-text('مورد / دفعة جديدة')").first();
await newLotBtn.click();
await page.waitForTimeout(400);

const supplierSelect = page.locator("select").nth(1);
await supplierSelect.selectOption({ label: "مورد تجريبي" });
await page.waitForTimeout(300);

const allInputs = page.locator("input");
await allInputs.nth(0).fill("100");
await allInputs.nth(1).fill("250");
await allInputs.nth(2).fill("0");
await page.waitForTimeout(300);

const createLotBtn = page.locator("button:has-text('إنشاء الدفعة')").first();
await createLotBtn.click();
await page.waitForTimeout(600);

// Select "سبيكة" category for this row.
const categorySelect = page.locator("select").last();
await categorySelect.selectOption({ label: "سبيكة" });
await page.waitForTimeout(300);

const rowInputs = page.locator('input[inputmode="decimal"], input[inputmode="numeric"]');
await rowInputs.nth(0).fill("20");  // وزن الذهب
await rowInputs.nth(1).fill("0");   // وزن الفصوص
await rowInputs.nth(2).fill("1");   // الكمية
await rowInputs.nth(3).fill("0");   // مصنعية القطعة
await page.waitForTimeout(300);

const saveBtn = page.locator("button:has-text('حفظ الصنف')").first();
await saveBtn.click();
await page.waitForTimeout(700);

const stored = await page.evaluate(async () => {
  const res = await window.storage.get("ounce_items_v3");
  return JSON.parse(res.value);
});
console.log("STORED ITEM:", JSON.stringify(stored));
console.log("HAS categoryId:", stored[0]?.categoryId, "HAS legacy category field:", stored[0]?.category);

// Now open the sale flow (same session, no reload) and check whether this
// real item shows up in PartialSaleModal's "بيع بالوزن" picker — this was
// the broken path.
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
    await numberInputs.nth(0).fill("0");
    await numberInputs.nth(1).fill("0");
    await page.waitForTimeout(300);
    const confirmOpenBtn = page.locator("button:text-is('تأكيد الفتح')").first();
    if (!(await confirmOpenBtn.isDisabled().catch(() => true))) {
      await confirmOpenBtn.click();
      await page.waitForTimeout(600);
    } else {
      console.log("WARN: confirm-open button still disabled");
    }
  }
  await salesTabBtn.click();
  await page.waitForTimeout(500);
}

const partialBtn = page.locator("button:has-text('بيع بالوزن')").first();
await partialBtn.click();
await page.waitForTimeout(600);

const itemSelect = page.locator("select").first();
const options = await itemSelect.locator("option").allTextContents();
console.log("PARTIAL-SALE ITEM OPTIONS:", JSON.stringify(options));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
