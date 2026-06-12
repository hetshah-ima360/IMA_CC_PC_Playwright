import { Page, expect, Locator } from '@playwright/test';

/**
 * Login page for IMA360 Platform.
 * URL: https://dev.ima360.app/login
 * Fields: Email Address *, Password *, [SIGN IN] button
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email address/i).first();
    this.passwordInput = page.getByLabel(/^password/i).first();
    this.signInButton = page.getByRole('button', { name: /^sign in$/i }).first();
  }

  async goto() {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(this.emailInput).toBeVisible({ timeout: 30_000 });
    console.log('[debug] Login page loaded');
  }

  async login(username: string, password: string) {
    await this.emailInput.fill(username);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
    console.log('[debug] Sign in clicked, waiting for redirect...');

    // Wait for login to complete - URL should change away from /login
    await this.page.waitForURL(url => !url.toString().includes('/login'), {
      timeout: 60_000,
    });
    console.log(`[debug] Logged in. Landed on: ${this.page.url()}`);
  }
}
