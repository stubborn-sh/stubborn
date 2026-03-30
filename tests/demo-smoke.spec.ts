import { test, expect } from '@playwright/test';

test.describe('Demo App Smoke Test', () => {

  test('should load the dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 90_000 });
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/Stubborn/i);
    await page.screenshot({ path: 'test-results/01-dashboard.png' });
  });

  test('should show applications list', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 90_000 });
    // Navigate to applications
    await page.getByRole('link', { name: /applications/i }).first().click();
    await page.waitForLoadState('networkidle');
    // Should see seeded applications
    await expect(page.getByText('order-service')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('payment-service')).toBeVisible();
    await page.screenshot({ path: 'test-results/02-applications.png' });
  });

  test('should show contracts for an application', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 90_000 });
    await page.getByRole('link', { name: /contracts/i }).first().click();
    await page.waitForLoadState('networkidle');
    // Select an application from dropdown/combobox
    const appSelector = page.getByRole('combobox').first();
    if (await appSelector.isVisible()) {
      await appSelector.click();
      await page.getByText('order-service').first().click();
      await page.waitForLoadState('networkidle');
    }
    await page.screenshot({ path: 'test-results/03-contracts.png' });
  });

  test('should show git import sources', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 90_000 });
    await page.getByRole('link', { name: /git import/i }).first().click();
    await page.waitForLoadState('networkidle');
    // Should see seeded git import sources
    await expect(page.getByText('github.com/example/order-service').or(page.getByText('order-service'))).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: 'test-results/04-git-import.png' });
  });

  test('should show maven import sources', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 90_000 });
    await page.getByRole('link', { name: /maven import/i }).first().click();
    await page.waitForLoadState('networkidle');
    // Should see seeded maven import sources
    await expect(page.getByText('order-service-stubs').or(page.getByText('com.example'))).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: 'test-results/05-maven-import.png' });
  });

  test('should show dependency graph', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 90_000 });
    await page.getByRole('link', { name: /graph|dependencies/i }).first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/06-graph.png' });
  });

});
