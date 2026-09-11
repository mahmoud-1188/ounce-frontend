import { chromium } from "playwright";

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

// Click through every hamburger-menu group and every item inside it, one by one.
const groupLabels = ["التقارير", "المخزون والتكويد", "الشراء والموردين", "العملاء", "المال والشركاء", "الربط", "النظام"];

for (const g of groupLabels) {
  await page.locator("button").first().click(); // hamburger
  await page.waitForTimeout(300);
  const groupBtn = page.locator(`button:has-text("${g}")`).first();
  if (!(await groupBtn.count())) { console.log(`GROUP MISSING: ${g}`); continue; }
  await groupBtn.click();
  await page.waitForTimeout(300);
  const itemBtns = await page.locator("main button, div button").all();
  const labels = await page.locator("button").allTextContents();
  console.log(`=== GROUP ${g} items ===`, JSON.stringify(labels.slice(0, 20)));

  // Click each item, then go back.
  const itemCount = await page.locator("button").count();
  for (let i = 0; i < Math.min(itemCount, 15); i++) {
    const btnText = await page.locator("button").nth(i).innerText().catch(() => "");
    if (!btnText || btnText.length > 30) continue;
    if (["تسجيل الخروج"].includes(btnText.trim())) continue;
  }
}

// Simpler: directly open every page ID we changed via the menu structure, one at a time.
const targets = [
  ["المخزون والتكويد", "التصنيفات"],
  ["الشراء والموردين", "المشتريات"],
  ["التقارير", "تقارير البائعين"],
  ["التقارير", "ميزان المراجعة"],
  ["التقارير", "مطابقة البنك"],
  ["التقارير", "تقارير المشتريات"],
  ["التقارير", "اليومية"],
  ["الشراء والموردين", "مكاتب التسكير"],
  ["النظام", "تخصيص القائمة"],
  ["المال والشركاء"],
];

for (const [group, item] of targets) {
  await page.locator("button").first().click();
  await page.waitForTimeout(250);
  const groupBtn = page.locator(`button:has-text("${group}")`).first();
  if (!(await groupBtn.count())) { console.log(`MISSING GROUP: ${group}`); continue; }
  await groupBtn.click();
  await page.waitForTimeout(250);
  if (item) {
    const itemBtn = page.locator(`button:has-text("${item}")`).first();
    if (!(await itemBtn.count())) { console.log(`MISSING ITEM: ${group} > ${item}`); continue; }
    await itemBtn.click();
    await page.waitForTimeout(400);
  }
  console.log(`VISITED: ${group}${item ? " > " + item : ""} — errors so far: ${errors.length}`);
}

console.log("FINAL ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
