import { Page, expect, Locator } from '@playwright/test';

export interface SimulationParams {
  calcPeriodFrom: string;     // MM/DD/YYYY
  calcPeriodTo: string;       // MM/DD/YYYY
  complianceNumber?: string;  // raw value from the contract setup, e.g. "145" or "IMA_CC_PC_11 (145)"
  contractType?: string;      // optional, e.g. "CP&H COGS Audit (CP&H COGS Audit)"
}

/**
 * Price Compliance > Calculation Simulation screen.
 *
 * Layout (from IMA360):
 *   Calculation Data
 *     Calculation Period *  [ Equal ]  [ from date ]  [ to date ]
 *   Contract Selection
 *     Compliance Number     [ Equal ]  [ text input ]  -> option list with checkboxes
 *     Contract Type         [ Equal ]  [ combobox ]
 *     Group / Subgroup      ...
 *   [ Clear ]  [ Run ]  [ Schedule Batch Job ]
 */
export class CalculationSimulationPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForLoaded() {
    await expect(this.page.getByRole('button', { name: /^run$/i }).first())
      .toBeVisible({ timeout: 30_000 });
    console.log('[debug] Calculation Simulation page loaded');
  }

  /** Run the full simulation: period + compliance number (+ optional type) + Run. */
  async runSimulation(p: SimulationParams) {
    await this.waitForLoaded();
    await this.setCalculationPeriod(p.calcPeriodFrom, p.calcPeriodTo);
    if (p.complianceNumber) await this.setComplianceNumber(p.complianceNumber);
    if (p.contractType) await this.setContractType(p.contractType);
    await this.run();
  }

  /** Fill the Calculation Period date range (the two MM/DD/YYYY date inputs). */
  async setCalculationPeriod(from: string, to: string) {
    console.log(`[debug] Calculation Period: ${from} -> ${to}`);
    await this.fillDateInput(0, from);
    await this.fillDateInput(1, to);
  }

  private async fillDateInput(index: number, value: string) {
    const field = this.page
      .locator('input[placeholder*="mm" i], input[placeholder*="dd" i], input[placeholder*="yyyy" i]')
      .nth(index);
    await field.waitFor({ state: 'visible', timeout: 10_000 });
    await field.click();
    await field.click({ clickCount: 3 });
    await this.page.keyboard.press('Backspace');
    await this.page.waitForTimeout(100);
    await this.page.keyboard.type(value, { delay: 80 });
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(200);
  }

  /**
   * Type the compliance number into the Contract Selection > Compliance Number
   * combobox and tick the matching option (e.g. "HS_Scaled_DSO_Test3 (148)").
   * The field is a multi-select: clicking opens a checkbox list; after ticking,
   * the selection shows as a chip (e.g. "148") and the dropdown is closed so
   * Run becomes clickable.
   */
  async setComplianceNumber(raw: string) {
    const num = this.normalizeNumber(raw);
    console.log(`[debug] Compliance Number filter = "${num}" (from "${raw}")`);

    const input = await this.valueFieldForLabel('Compliance Number');
    await input.scrollIntoViewIfNeeded();
    await input.click();
    await this.page.waitForTimeout(500);
    await input.fill('').catch(() => {});
    await this.page.keyboard.type(num, { delay: 60 });
    await this.page.waitForTimeout(900);

    // Options are checkbox rows "<description> (<num>)". Tick the exact match.
    const option = this.page
      .locator('li, [role="option"], label, .MuiMenuItem-root')
      .filter({ hasText: new RegExp(`\\(\\s*${this.escapeRegex(num)}\\s*\\)`) })
      .first();
    await option.waitFor({ state: 'visible', timeout: 10_000 });

    const checkbox = option.locator('input[type="checkbox"]').first();
    if (await checkbox.count() > 0) {
      await checkbox.click({ force: true });
    } else {
      await option.click();
    }
    await this.page.waitForTimeout(300);

    // Close the dropdown so the Run button is reachable (selection persists as a chip).
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.waitForTimeout(300);
    console.log('[debug] Compliance Number option selected');
  }

  /** Optional: set the Contract Type filter. Best-effort (won't fail the run). */
  async setContractType(type: string) {
    try {
      console.log(`[debug] Contract Type filter = ${type}`);
      const combo = await this.valueFieldForLabel('Contract Type');
      await combo.click();
      await this.page.waitForTimeout(400);
      await this.page.keyboard.type(type, { delay: 30 });
      await this.page.waitForTimeout(600);
      const head = type.split('(')[0].trim();
      const opt = this.page.locator('[role="option"], li, .MuiMenuItem-root')
        .filter({ hasText: new RegExp(this.escapeRegex(head), 'i') })
        .first();
      if (await opt.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await opt.click();
      }
      await this.page.waitForTimeout(200);
    } catch {
      console.log('[debug] Contract Type: could not set (left empty)');
    }
  }

  /** Click Run and wait for the simulation to process. */
  async run() {
    console.log('[debug] Clicking Run...');
    const runBtn = this.page.getByRole('button', { name: /^run$/i }).first();
    await runBtn.scrollIntoViewIfNeeded();
    await runBtn.click();
    await this.page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
    await this.page.waitForTimeout(1_500);
    console.log('[debug] Run clicked — simulation submitted');
  }

  /**
   * Read the Calculation Simulation > Results grid after a run.
   * The Final COGS is the only decimal value in the row (dates use "/" or "-",
   * not decimals), so it's targeted directly; the simulation number is read as
   * a best-effort extra.
   */
  async readResults(): Promise<{ finalCogs: string; simulationNumber: string; rowText: string; status: string }> {
    // After Run, the simulation computes server-side and then navigates to the
    // Results grid — this can be slow (a minute or more). A returned value of
    // "0.00" is a REAL result, not "no result". Wait generously for the grid.
    const cogsHeader = this.page.getByText('Final COGS', { exact: false }).first();
    const onResults = await cogsHeader.isVisible({ timeout: 180_000 }).catch(() => false);

    if (!onResults) {
      const url = this.page.url();
      const onResultsCrumb = await this.page.getByText(/Results/i).first().isVisible().catch(() => false);
      let noData = '';
      for (const re of [/no\s*(records|results|data)/i, /nothing to display/i]) {
        const m = this.page.getByText(re).first();
        if (await m.isVisible({ timeout: 1_000 }).catch(() => false)) {
          noData = (await m.textContent())?.trim() || '';
          break;
        }
      }
      console.log(`[debug] No "Final COGS" detected after 180s. url=${url} resultsBreadcrumb=${onResultsCrumb} message="${noData}"`);
      return { finalCogs: '', simulationNumber: '', rowText: noData, status: 'NO_RESULT' };
    }

    await this.page.waitForTimeout(1_000);

    // The Final COGS column is at the far right and the grid may only render
    // columns that are scrolled into view — nudge every horizontal scroller to
    // the end and bring the header into view so its cell is rendered.
    await this.page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll('*')) as HTMLElement[]) {
        if (el.scrollWidth > el.clientWidth + 40) el.scrollLeft = el.scrollWidth;
      }
    }).catch(() => {});
    await cogsHeader.scrollIntoViewIfNeeded().catch(() => {});
    await this.page.waitForTimeout(600);

    // Final COGS — the lone decimal on the results row (e.g. "0.00", "-3.00").
    let finalCogs = '';
    const cogsCell = this.page.getByText(/^-?\d[\d,]*\.\d+$/).first();
    if (await cogsCell.isVisible({ timeout: 30_000 }).catch(() => false)) {
      await cogsCell.scrollIntoViewIfNeeded().catch(() => {});
      finalCogs = (await cogsCell.textContent())?.trim() || '';
    }

    // Fallback: parse the row text and take the last number.
    let rowText = '';
    const row = this.page.locator('tr, [role="row"]').filter({ hasText: /-?\d[\d,]*\.\d+/ }).first();
    if (await row.isVisible({ timeout: 3_000 }).catch(() => false)) {
      rowText = (await row.textContent())?.trim().replace(/\s+/g, ' ') || '';
      if (!finalCogs) {
        const nums = rowText.match(/-?\d[\d,]*\.\d+/g) || [];
        finalCogs = nums.length ? nums[nums.length - 1] : '';
      }
    }

    // Simulation Number — best effort (first integer-only link/cell).
    let simulationNumber = '';
    const simCell = this.page.getByRole('link', { name: /^\d+$/ }).first();
    if (await simCell.isVisible({ timeout: 2_000 }).catch(() => false)) {
      simulationNumber = (await simCell.textContent())?.trim() || '';
    }

    // "0.00" is a valid result, so status is OK whenever the grid rendered a value.
    const status = finalCogs !== '' ? 'OK' : 'EMPTY';
    console.log(`[debug] Results — Final COGS: "${finalCogs}", Simulation #: "${simulationNumber}", status: ${status}`);
    return { finalCogs, simulationNumber, rowText, status };
  }

  /**
   * Find the editable input belonging to a labelled filter row. Each row is
   * "Label | Equal | input"; we want the rightmost editable input (not the
   * "Equal" operator combobox).
   */
  /**
   * Find the value control in a labelled filter row.
   * Layout: "Label | [Equal ▾] | value ▾". The "Equal" operator is a MUI Select
   * whose only <input> is hidden (aria-hidden, tabindex=-1) — we must NOT grab
   * that. The value field's input is the first *focusable, non-hidden* input
   * after the label; if the value is itself a Select, fall back to the first
   * combobox after the label that isn't the "Equal" operator.
   */
  private async valueFieldForLabel(label: string): Promise<Locator> {
    const lit = this.xpathLiteral(label);
    const strategies: Locator[] = [
      // 1) First real (focusable, visible) input after the label = the value field's input.
      this.page.locator(
        `xpath=//*[normalize-space(text())=${lit}]/following::input[not(@aria-hidden="true") and not(@tabindex="-1")][1]`,
      ),
      // 2) First combobox after the label that is NOT the "Equal" operator.
      this.page.locator(
        `xpath=//*[normalize-space(text())=${lit}]/following::*[@role="combobox"][normalize-space(.)!="Equal"][1]`,
      ),
      // 3) Any combobox after the label (last resort).
      this.page.locator(`xpath=//*[normalize-space(text())=${lit}]/following::*[@role="combobox"][1]`),
    ];

    for (let i = 0; i < strategies.length; i++) {
      const loc = strategies[i].first();
      if (await loc.isVisible({ timeout: 3_000 }).catch(() => false)) {
        console.log(`[debug] "${label}" value field located via strategy ${i + 1}`);
        return loc;
      }
    }
    console.log(`[debug] "${label}" value field: no strategy matched, defaulting to strategy 2`);
    return strategies[1].first();
  }

  /** Build a safe XPath string literal (handles embedded quotes). */
  private xpathLiteral(s: string): string {
    if (!s.includes('"')) return `"${s}"`;
    if (!s.includes("'")) return `'${s}'`;
    return 'concat(' + s.split('"').map((p) => `"${p}"`).join(`, '"', `) + ')';
  }

  /** "IMA_CC_PC_11 (145)" -> "145"; "145" -> "145". */
  private normalizeNumber(raw: string): string {
    const paren = raw.match(/\((\d+)\)/);
    if (paren) return paren[1];
    const trailing = raw.match(/(\d+)\s*$/);
    if (trailing) return trailing[1];
    return raw.trim();
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
