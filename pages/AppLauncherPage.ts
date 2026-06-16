import { Page, expect, Locator } from '@playwright/test';

/**
 * App Launcher + Top-Nav Navigation for IMA360 Platform.
 *
 * App launcher: dev.ima360.app/applauncher
 * Layout: grid of clickable app tiles (cards), each tile has an icon + label.
 * Each tile is a clickable card containing the text label, e.g. "Contract Compliance".
 */
export class AppLauncherPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async openContractCompliance() {
    console.log(`[debug] URL after login: ${this.page.url()}`);

    // Force-navigate to the launcher in case login redirected elsewhere
    if (!this.page.url().includes('/applauncher')) {
      await this.page.goto('/applauncher', { waitUntil: 'domcontentloaded' });
    }

    // Readiness: the app search box is always present on the launcher.
    const search = this.page.getByPlaceholder(/search apps/i).first();
    await search.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
    console.log(`[debug] App launcher loaded at: ${this.page.url()}`);

    // Click the Contract Compliance tile (exact text so we don't match a longer label).
    let tile = this.page.getByText('Contract Compliance', { exact: true }).first();
    if (!(await tile.isVisible({ timeout: 8_000 }).catch(() => false))) {
      // Fallback: filter the grid via the search box, then click.
      console.log('[debug] Tile not directly visible — filtering via search box');
      if (await search.isVisible().catch(() => false)) {
        await search.click();
        await search.fill('Contract Compliance');
        await this.page.waitForTimeout(800);
      }
      tile = this.page.getByText('Contract Compliance', { exact: true }).first();
    }

    await tile.waitFor({ state: 'visible', timeout: 15_000 });
    await tile.scrollIntoViewIfNeeded();
    await tile.click();
    console.log('[debug] Clicked Contract Compliance tile');

    // After click, URL becomes /dashboard?app=Contract%20Compliance
    await this.page.waitForURL(/dashboard.*Contract.*Compliance/i, { timeout: 30_000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

    console.log(`[debug] Contract Compliance dashboard loaded: ${this.page.url()}`);
  }

  async openPriceComplianceContractSetup() {
    console.log(`[debug] Opening Price Compliance menu from: ${this.page.url()}`);

    // The top-nav "Price Compliance" is a dropdown. Click to open it.
    const priceComplianceMenu = this.page.getByText('Price Compliance', { exact: true }).first();
    await priceComplianceMenu.waitFor({ state: 'visible', timeout: 20_000 });
    await priceComplianceMenu.click();
    await this.page.waitForTimeout(500);

    // Click "Contract Setup" from the opened menu.
    let contractSetupOption = this.page.getByText('Contract Setup', { exact: true }).first();
    let visible = await contractSetupOption.isVisible().catch(() => false);

    // If menu closed (sometimes click toggles), try hover instead
    if (!visible) {
      console.log('[debug] Menu not visible after click, trying hover');
      await priceComplianceMenu.hover();
      await this.page.waitForTimeout(500);
      contractSetupOption = this.page.getByText('Contract Setup', { exact: true }).first();
    }

    await contractSetupOption.waitFor({ state: 'visible', timeout: 10_000 });
    await contractSetupOption.click();

    await this.page.waitForURL(/price-compliance-list/i, { timeout: 30_000 });
    console.log('[debug] Reached Contract Setup list page');
  }

  async openPriceComplianceCalculationSimulation() {
    console.log(`[debug] Opening Price Compliance > Calculation Simulation from: ${this.page.url()}`);

    const priceComplianceMenu = this.page.getByText('Price Compliance', { exact: true }).first();
    await priceComplianceMenu.waitFor({ state: 'visible', timeout: 20_000 });
    await priceComplianceMenu.click();
    await this.page.waitForTimeout(500);

    let option = this.page.getByText('Calculation Simulation', { exact: true }).first();
    let visible = await option.isVisible().catch(() => false);
    if (!visible) {
      console.log('[debug] Menu not visible after click, trying hover');
      await priceComplianceMenu.hover();
      await this.page.waitForTimeout(500);
      option = this.page.getByText('Calculation Simulation', { exact: true }).first();
    }

    await option.waitFor({ state: 'visible', timeout: 10_000 });
    await option.click();

    // The page shows a "Calculation Simulation" heading and a Run button.
    await this.page.waitForURL(/calculation-simulation/i, { timeout: 30_000 }).catch(() => {});
    await expect(this.page.getByRole('button', { name: /^run$/i }).first())
      .toBeVisible({ timeout: 30_000 });
    console.log('[debug] Reached Calculation Simulation page');
  }
}
