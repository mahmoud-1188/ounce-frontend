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

// Seed one supplier so the lot form can actually be used.
await page.evaluate(async () => {
  const supplier = {
    id: "test-supplier-1",
    ref: "SUP-001",
    name: "مورد تجريبي",
    phone: "",
    isOfficial: false,
    createdAt: new Date().toISOString(),
    createdBy: "test",
  };
  await window.storage.set("ounce_suppliers_v1", JSON.stringify([supplier]));
});

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);

// "التكويد" is pinned directly in bottom nav row1 for manager.
const addGoodsBtn = page.locator("button:has-text('التكويد')").first();
console.log("ADD GOODS BTN COUNT:", await addGoodsBtn.count());
await addGoodsBtn.click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/goods_00_page.png` });
console.log("PAGE TEXT:", (await page.locator("body").innerText()).slice(0, 800));

// Select the seeded supplier lot placeholder — first need to create a lot via "مورد / دفعة جديدة".
const newLotBtn = page.locator("button:has-text('مورد / دفعة جديدة')").first();
console.log("NEW LOT BTN COUNT:", await newLotBtn.count());
await newLotBtn.click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/goods_01_lot_form.png` });
console.log("LOT FORM TEXT:", (await page.locator("body").innerText()).slice(0, 800));

// Select the supplier, fill karat/weight/cost/workmanship, create the lot.
// There are two <select>s now: [0] the lot picker (still empty), [1] the
// QuickLotForm's supplier picker.
const supplierSelect = page.locator("select").nth(1);
const options = await supplierSelect.locator("option").allTextContents();
console.log("SUPPLIER OPTIONS:", JSON.stringify(options));
await supplierSelect.selectOption({ label: "مورد تجريبي" });
await page.waitForTimeout(300);

const allInputs = page.locator("input");
const cnt = await allInputs.count();
for (let i = 0; i < cnt; i++) {
  console.log(`input[${i}] placeholder=`, await allInputs.nth(i).getAttribute("placeholder"));
}

// Fill weight and cost/gram (karat defaults to 21).
await allInputs.nth(0).fill("100");   // الوزن
await allInputs.nth(1).fill("250");   // سعر/جم
await allInputs.nth(2).fill("500");   // الأجور الإجمالية
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/goods_02_lot_filled.png` });

const createLotBtn = page.locator("button:has-text('إنشاء الدفعة')").first();
console.log("CREATE LOT DISABLED?", await createLotBtn.isDisabled().catch(() => null));
await createLotBtn.click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/goods_03_lot_created.png` });
console.log("AFTER LOT CREATE TEXT:", (await page.locator("body").innerText()).slice(0, 1200));

// Fill the item row: default category "خاتم", weight 5g, quantity 1,
// workmanship per unit 30.
const rowInputs = page.locator('input[inputmode="decimal"], input[inputmode="numeric"]');
const rowCnt = await rowInputs.count();
console.log("ROW INPUT COUNT:", rowCnt);
for (let i = 0; i < rowCnt; i++) {
  console.log(`rowInput[${i}] placeholder=`, await rowInputs.nth(i).getAttribute("placeholder"));
}
// Order per JSX: وزن الذهب, وزن الفصوص, الكمية, مصنعية القطعة
await rowInputs.nth(0).fill("5");
await rowInputs.nth(1).fill("0");
await rowInputs.nth(2).fill("1");
await rowInputs.nth(3).fill("30");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/goods_04_row_filled.png` });

const saveBtn = page.locator("button:has-text('حفظ الصنف')").first();
console.log("SAVE DISABLED?", await saveBtn.isDisabled().catch(() => null));
await saveBtn.click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/goods_05_after_save.png` });
console.log("AFTER SAVE TEXT:", (await page.locator("body").innerText()).slice(0, 1000));

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
    lots: await safeGet("ounce_lots_v1"),
  };
});
console.log("AFTER:", JSON.stringify(after));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
