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

const addGoodsBtn = page.locator("button:has-text('التكويد')").first();
await addGoodsBtn.click();
await page.waitForTimeout(600);

const newLotBtn = page.locator("button:has-text('مورد / دفعة جديدة')").first();
await newLotBtn.click();
await page.waitForTimeout(400);

const supplierSelect = page.locator("select").nth(1);
await supplierSelect.selectOption({ label: "مورد تجريبي" });
await page.waitForTimeout(300);

const allInputs = page.locator("input");
await allInputs.nth(0).fill("100");   // الوزن
await allInputs.nth(1).fill("250");   // سعر/جم
await allInputs.nth(2).fill("500");   // الأجور الإجمالية
await page.waitForTimeout(300);

const createLotBtn = page.locator("button:has-text('إنشاء الدفعة')").first();
await createLotBtn.click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/goods_set_00_lot_created.png` });
console.log("AFTER LOT CREATE TEXT:", (await page.locator("body").innerText()).slice(0, 1200));

// Now select "طقم" (set) as the row's category.
const categorySelect = page.locator("select").last();
const catOptions = await categorySelect.locator("option").allTextContents();
console.log("CATEGORY OPTIONS:", JSON.stringify(catOptions));
await categorySelect.selectOption({ label: "طقم" });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/goods_set_01_category_selected.png` });
console.log("AFTER CATEGORY SELECT TEXT:", (await page.locator("body").innerText()).slice(0, 1500));

// Look for the set-piece preset buttons and click one (e.g. "خاتم").
const pieceBtn = page.locator("button:has-text('خاتم')").last();
console.log("PIECE BTN COUNT:", await pieceBtn.count());
if (await pieceBtn.count()) {
  await pieceBtn.click();
  await page.waitForTimeout(400);
}
await page.screenshot({ path: `${OUT}/goods_set_02_after_piece_click.png` });
console.log("AFTER PIECE CLICK TEXT:", (await page.locator("body").innerText()).slice(0, 1200));

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
