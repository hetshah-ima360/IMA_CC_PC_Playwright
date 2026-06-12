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

    // Wait for the grid of tiles to be fully rendered.
    // We can tell the page is loaded when MULTIPLE app tiles are visible
    // (so we know it's not a half-rendered page).
    await expect(this.page.getByText('AI Solutions', { exact: true }).first())
      .toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByText('CPQ', { exact: true }).first())
      .toBeVisible({ timeout: 10_000 });

    console.log(`[debug] App launcher loaded at: ${this.page.url()}`);

    // Click the Contract Compliance tile. Using exact text match to avoid
    // accidentally matching "Contract Compliance Dashboard" or similar.
    const tile = this.page.getByText('Contract Compliance', { exact: true }).first();
    await tile.waitFor({ state: 'visible', timeout: 15_000 });
    await tile.click();

    console.log('[debug] Clicked Contract Compliance tile');

    // After click, URL becomes /dashboard?app=Contract%20Compliance
    await this.page.waitForURL(/dashboard.*Contract.*Compliance/i, { timeout: 30_000 });
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
}
