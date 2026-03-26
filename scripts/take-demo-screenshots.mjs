/**
 * Playwright script to capture screenshots from the live Stubborn demo.
 * Usage: node scripts/take-demo-screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "docs", "screenshots");
mkdirSync(outDir, { recursive: true });

const BASE = "https://demo.stubborn.sh";

async function selectComboBoxOption(page, inputLocator, text) {
  await inputLocator.click();
  await inputLocator.fill(text);
  await page.waitForTimeout(800);
  // Try to select from dropdown
  const option = page.locator(`[role="option"]:has-text("${text}")`).first();
  if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
    await option.click();
  } else {
    // Try pressing Enter if no dropdown option found
    await inputLocator.press("Enter");
  }
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Login via form
  console.log("Logging in ...");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.fill('input[name="username"], input:not([type="password"]):visible', "reader", { timeout: 5000 }).catch(() => {});
  // More specific: find the username input
  const usernameInput = page.locator('input:not([type="password"]):not([type="hidden"]):visible').first();
  await usernameInput.fill("reader");
  await page.fill('input[type="password"]', "reader");
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // 1. Dashboard
  console.log("Capturing /dashboard ...");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(outDir, "demo-dashboard.png"), fullPage: true });

  // 2. Applications
  console.log("Capturing /applications ...");
  await page.goto(`${BASE}/applications`, { waitUntil: "networkidle" });
  await page.waitForSelector("table", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(outDir, "demo-applications.png"), fullPage: true });

  // 3. Contracts
  console.log("Capturing /contracts ...");
  await page.goto(`${BASE}/contracts`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(outDir, "demo-contracts.png"), fullPage: true });

  // 4. Verifications
  console.log("Capturing /verifications ...");
  await page.goto(`${BASE}/verifications`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(outDir, "demo-verifications.png"), fullPage: true });

  // 5. Environments
  console.log("Capturing /environments ...");
  await page.goto(`${BASE}/environments`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Deployment Overview", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(outDir, "demo-environments.png"), fullPage: true });

  // 6. Can I Deploy
  console.log("Capturing /can-i-deploy ...");
  await page.goto(`${BASE}/can-i-deploy`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // The page has combobox inputs: application, version (disabled until app selected), environment
  const comboboxes = page.locator('[role="combobox"]:visible');
  const comboCount = await comboboxes.count();
  console.log(`  Found ${comboCount} comboboxes`);

  try {
    // Select application first
    if (comboCount >= 1) {
      const appCombo = comboboxes.nth(0);
      await selectComboBoxOption(page, appCombo, "order-service");
      await page.waitForTimeout(1000);
    }

    // Now version should be enabled
    if (comboCount >= 2) {
      const versionCombo = comboboxes.nth(1);
      // Wait for it to become enabled
      await page.waitForFunction(() => {
        const inputs = document.querySelectorAll('[role="combobox"]');
        return inputs.length >= 2 && !inputs[1].disabled;
      }, { timeout: 5000 }).catch(() => {});
      await selectComboBoxOption(page, versionCombo, "1.2.0");
      await page.waitForTimeout(500);
    }

    // Select environment
    if (comboCount >= 3) {
      const envCombo = comboboxes.nth(2);
      await selectComboBoxOption(page, envCombo, "production");
      await page.waitForTimeout(500);
    }

    // Click Check button
    const checkBtn = page.locator('button:has-text("Check")').first();
    if (await checkBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await checkBtn.click();
      await page.waitForTimeout(3000);
    }
  } catch (e) {
    console.log(`  Warning: could not fully fill can-i-deploy form: ${e.message}`);
  }

  await page.screenshot({ path: resolve(outDir, "demo-can-i-deploy.png"), fullPage: true });

  // 7. Graph
  console.log("Capturing /graph ...");
  await page.goto(`${BASE}/graph`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: resolve(outDir, "demo-graph.png"), fullPage: true });

  // 8. Webhooks
  console.log("Capturing /webhooks ...");
  await page.goto(`${BASE}/webhooks`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(outDir, "demo-webhooks.png"), fullPage: true });

  // 9. Tags
  console.log("Capturing /tags ...");
  await page.goto(`${BASE}/tags`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  try {
    const tagComboboxes = page.locator('[role="combobox"]:visible');
    const tagComboCount = await tagComboboxes.count();
    console.log(`  Found ${tagComboCount} tag comboboxes`);

    if (tagComboCount >= 1) {
      await selectComboBoxOption(page, tagComboboxes.nth(0), "order-service");
      await page.waitForTimeout(1000);
    }
    if (tagComboCount >= 2) {
      // Wait for version to be enabled
      await page.waitForFunction(() => {
        const inputs = document.querySelectorAll('[role="combobox"]');
        return inputs.length >= 2 && !inputs[1].disabled;
      }, { timeout: 5000 }).catch(() => {});
      await selectComboBoxOption(page, tagComboboxes.nth(1), "1.2.0");
      await page.waitForTimeout(500);
    }

    const lookupBtn = page.locator('button:has-text("Lookup"), button:has-text("Look up"), button:has-text("Search")').first();
    if (await lookupBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lookupBtn.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.log(`  Warning: could not fully fill tags form: ${e.message}`);
  }

  await page.screenshot({ path: resolve(outDir, "demo-tags.png"), fullPage: true });

  await browser.close();
  console.log(`Done! Screenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
