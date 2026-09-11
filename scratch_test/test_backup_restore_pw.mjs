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
// Capture downloads (the exported backup file) so we can feed it back in
// as the restore input without going through the OS file picker.
const downloads = [];
page.on("download", async (d) => downloads.push(d));

await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// Seed a little bit of distinguishable data so we can confirm restore
// actually applies (a supplier name that only exists post-restore).
await page.evaluate(async () => {
  await window.storage.set("ounce_suppliers_v1", JSON.stringify([
    { id: "sup-restore-test", ref: "SUP-999", name: "مورد ما قبل النسخة", phone: "", isOfficial: false, createdAt: new Date().toISOString(), createdBy: "test" },
  ]));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);

await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);

const clickByText = (text) => page.evaluate((t) => {
  const els = Array.from(document.querySelectorAll("button, div[role='button'], a"));
  const el = els.find((e) => e.textContent && e.textContent.trim() === t);
  if (el) el.click();
  return !!el;
}, text);

// Navigate: hamburger icon (top-left) opens the "more" menu/drawer with
// links to sub-pages like البنسخ الاحتياطي (BackupPage, via setMorePage).
console.log("CLICKED hamburger:", await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="القائمة"]') ||
    Array.from(document.querySelectorAll("button")).find((b) => b.querySelector("svg") && b.getBoundingClientRect().top < 60 && b.getBoundingClientRect().left < 80);
  if (btn) { btn.click(); return true; }
  return false;
}));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/backup_00_more_menu.png` });
const clickGroupByTitle = (title) => page.evaluate((t) => {
  const all = Array.from(document.querySelectorAll("p, span"));
  const titleEl = all.find((s) => s.textContent.trim() === t);
  if (!titleEl) return false;
  const clickable = titleEl.closest("button, div[role='button'], a");
  if (clickable) { clickable.click(); return true; }
  titleEl.click();
  return true;
}, title);
console.log("CLICKED النظام group:", await clickGroupByTitle("النظام"));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/backup_00b_system_group.png` });
console.log("CLICKED النسخ الاحتياطي:", await clickByText("النسخ الاحتياطي"));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/backup_01_page.png` });
console.log("PAGE TEXT SNIPPET:", (await page.locator("body").innerText()).slice(0, 300));

// Fill the export password (6+ chars) and trigger download.
const pwInput = page.locator('input[type="password"]').first();
console.log("PW INPUT COUNT:", await pwInput.count());
await pwInput.fill("secret123");
await page.waitForTimeout(200);

const [download] = await Promise.all([
  page.waitForEvent("download"),
  clickByText("تنزيل النسخة الآن"),
]);
const dlPath = `${OUT}/backup_export.json`;
await download.saveAs(dlPath);
console.log("DOWNLOADED TO:", dlPath);

const fs = await import("fs");
const backupContent = fs.readFileSync(dlPath, "utf8");
const backupJson = JSON.parse(backupContent);
console.log("BACKUP encrypted FLAG:", backupJson.encrypted);
console.log("BACKUP app FIELD:", backupJson.app);

// Now wipe the supplier to prove restore brings it back.
await page.evaluate(async () => {
  await window.storage.set("ounce_suppliers_v1", JSON.stringify([]));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.click('[aria-label="دخول"]');
await page.waitForTimeout(400);
await page.locator("p:text-is('المدير')").first().click();
await page.waitForTimeout(600);
await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="القائمة"]') ||
    Array.from(document.querySelectorAll("button")).find((b) => b.querySelector("svg") && b.getBoundingClientRect().top < 60 && b.getBoundingClientRect().left < 80);
  if (btn) btn.click();
});
await page.waitForTimeout(400);
await clickGroupByTitle("النظام");
await page.waitForTimeout(400);
await clickByText("النسخ الاحتياطي");
await page.waitForTimeout(400);

// Upload the backup file via the file input.
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles(dlPath);
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/backup_02_file_loaded.png` });

// THE ACTUAL FIX CHECK: does a password field for restore now appear?
const restorePwField = await page.evaluate(() => {
  const labels = Array.from(document.querySelectorAll("p, label, span"))
    .filter((e) => e.textContent && e.textContent.includes("كلمة سر فك التشفير"));
  return labels.length;
});
console.log("RESTORE PW FIELD LABEL COUNT:", restorePwField);

const pwInputsNow = await page.locator('input[type="password"]').count();
console.log("PASSWORD INPUTS ON PAGE NOW:", pwInputsNow);

// Fill the restore password (should be the LAST password input on the
// page - the export one is above it, scoped to a different Card).
const restoreInput = page.locator('input[type="password"]').last();
await restoreInput.fill("secret123");
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/backup_03_pw_filled.png` });

console.log("CLICKED استعادة هذه النسخة:", await clickByText("استعادة هذه النسخة"));
await page.waitForTimeout(400);
console.log("CLICKED نعم، استعد:", await clickByText("نعم، استعد"));
await page.waitForTimeout(1500);

// After a successful restore the app reloads (setTimeout ~1200ms) - wait
// for that and re-login, then check the supplier came back.
await page.waitForTimeout(1000);
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(500);

const supplierRestored = await page.evaluate(async () => {
  const res = await window.storage.get("ounce_suppliers_v1");
  const arr = res.value ? JSON.parse(res.value) : [];
  return arr.some((s) => s.name === "مورد ما قبل النسخة");
});
console.log("SUPPLIER RESTORED (proves decrypt+restore worked end to end):", supplierRestored);

console.log("ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
