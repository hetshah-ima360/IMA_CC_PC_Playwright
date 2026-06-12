import { Page, expect, Locator } from '@playwright/test';

export interface CreateModalData {
  complianceType: string;
  description: string;
  startDate: string;
  endDate: string;
}

export interface GeneralTabExtraData {
  group: string;
  contractSubgroup: string;
  origin: string;
  // --- optional extras (e.g. CP&H COGS Audit / scaled-DSO contracts) ---
  sourceDataType?: string;       // often auto-derived & disabled; set only if editable
  exclusiveFormula?: boolean;    // toggle/switch
  calculationFrequency?: string; // e.g. "04 (Quarterly (Mar - May))"
  agreementStatus?: string;      // e.g. "Active (01)"
  baseDso?: string;              // plain text input, e.g. "17.5"
}

export interface EligibilityRow {
  validFrom: string;
  validTo: string;
  salesOrg: string;
  customerNumber: string;
}

export interface CalculationRow {
  formula1: string;
  calcLevel1: string;
  startDate: string;
  endDate: string;
  // --- optional additional formula axes (multi-axis scales) ---
  formula2?: string;
  calcLevel2?: string;
  formula3?: string;
  calcLevel3?: string;
}

// ===================== Scale Data popup =====================
// One operator/value/unit cell per formula axis.
export interface ScaleAxisCell {
  operator?: string; // e.g. "GE" or ">= (GE)" — omit if the grid defaults it
  value: string;     // e.g. "6"
  unit?: string;     // e.g. "%" — omit if the grid defaults it
}

// One scale row: one cell per axis (in column order) + the outcome.
export interface ScaleRow {
  axes: ScaleAxisCell[];
  scaleValue: string;
  scaleUnit?: string;
}

// aria-colindex of each Handsontable column inside the Scale Data popup.
// Confirmed from the live grid: "Operator | Value" is TWO columns (Operator and
// Value), each axis is Operator/Value/Unit, then the outcome is Scale Value /
// Scale Unit. For a 2-axis Outcome scale the layout is:
//   GCR operator=2, value=3, unit=4; BPR operator=5, value=6, unit=7;
//   scaleValue=8, scaleUnit=9.
export interface ScaleColumns {
  axes: Array<{ operator?: number; value: number; unit?: number }>;
  scaleValue: number;
  scaleUnit?: number;
}

export interface ScaleData {
  columns: ScaleColumns;
  rows: ScaleRow[];
}

/**
 * Page Object for Price Compliance contract creation.
 * Grid library identified: Handsontable (uses .colHeader, .htCore, etc.)
 */
export class PriceCompliancePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async clickAddFromList() {
    console.log(`[debug] On list page: ${this.page.url()}`);
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

    const addBtn = this.page.getByRole('button', { name: /^add$/i }).first();
    await addBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await addBtn.click();
    console.log('[debug] Add button clicked');

    await expect(this.page.getByText('Create Price Compliance').first())
      .toBeVisible({ timeout: 15_000 });
    console.log('[debug] Modal opened');
  }

  async fillCreateModal(data: CreateModalData) {
    console.log('[debug] Filling Create Price Compliance modal...');

    await this.selectComboboxByName(/compliance type/i, data.complianceType, 'Compliance Type');
    console.log('[debug] Compliance Type set');

    const descInput = this.page.locator('input').nth(1);
    await descInput.click();
    await descInput.fill(data.description);
    console.log('[debug] Description set');

    await this.fillDateField('Start Date', data.startDate, 0);
    console.log('[debug] Start Date set');

    await this.fillDateField('End Date', data.endDate, 1);
    console.log('[debug] End Date set');

    await this.page.waitForTimeout(1000);

    const confirmStrategies = [
      this.page.getByRole('button', { name: /confirm|ok|create|submit/i }),
      this.page.locator('button[type="submit"]:visible'),
      this.page.locator('button:has(svg):visible').last(),
    ];

    let confirmed = false;
    for (let i = 0; i < confirmStrategies.length; i++) {
      try {
        const btn = confirmStrategies[i].first();
        await btn.waitFor({ state: 'visible', timeout: 3_000 });
        if (await btn.isDisabled().catch(() => false)) continue;
        await btn.click();
        console.log(`[debug] Confirm clicked (strategy ${i + 1})`);
        confirmed = true;
        break;
      } catch {
        continue;
      }
    }

    if (!confirmed) throw new Error('Could not click confirm');

    await this.page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(this.page.getByText('Header Data').first())
      .toBeVisible({ timeout: 20_000 });
    console.log('[debug] Full form opened');
  }

  async fillGeneralTabExtras(data: GeneralTabExtraData) {
    console.log('[debug] Filling General tab fields...');

    // Source Data Type is usually auto-derived from the Compliance Type and
    // rendered disabled; only attempt it if explicitly provided AND editable.
    if (data.sourceDataType !== undefined) {
      const srcCombo = this.page.getByRole('combobox', { name: /source data type/i }).first();
      const disabled = await srcCombo.isDisabled().catch(() => true);
      if (!disabled) {
        await this.selectComboboxByName(/source data type/i, data.sourceDataType, 'Source Data Type');
        console.log('[debug] Source Data Type set');
      } else {
        console.log('[debug] Source Data Type is disabled/auto-set — skipping');
      }
    }

    if (data.exclusiveFormula !== undefined) {
      await this.setToggleByLabel(/exclusive formula/i, data.exclusiveFormula, 'Exclusive Formula');
    }

    if (data.calculationFrequency !== undefined) {
      await this.selectComboboxByName(/calculation frequency/i, data.calculationFrequency, 'Calculation Frequency');
      console.log('[debug] Calculation Frequency set');
    }

    if (data.agreementStatus !== undefined) {
      await this.selectComboboxByName(/agreement status/i, data.agreementStatus, 'Agreement Status');
      console.log('[debug] Agreement Status set');
    }

    await this.selectComboboxByName(/^group$/i, data.group, 'Group');
    console.log('[debug] Group set');
    await this.selectComboboxByName(/contract subgroup/i, data.contractSubgroup, 'Contract Subgroup');
    console.log('[debug] Contract Subgroup set');
    await this.selectComboboxByName(/^origin$/i, data.origin, 'Origin');
    console.log('[debug] Origin set');

    if (data.baseDso !== undefined) {
      await this.fillTextByLabel(/base dso/i, data.baseDso, 'Base DSO');
      console.log('[debug] Base DSO set');
    }
  }

  /**
   * Toggle a MUI-style switch to the desired on/off state, located by its label.
   */
  private async setToggleByLabel(labelRegex: RegExp, desiredOn: boolean, friendlyName: string) {
    console.log(`[debug] Setting "${friendlyName}" toggle -> ${desiredOn ? 'ON' : 'OFF'}`);
    const toggle = this.page.getByRole('switch', { name: labelRegex })
      .or(
        this.page.getByText(labelRegex).first()
          .locator('xpath=following::*[@role="switch" or self::input[@type="checkbox"]][1]')
      )
      .first();
    await toggle.waitFor({ state: 'visible', timeout: 8_000 });
    const isOn = await toggle.isChecked().catch(async () => {
      return (await toggle.getAttribute('aria-checked')) === 'true';
    });
    if (isOn !== desiredOn) {
      await toggle.click({ force: true });
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Fill a plain text input located by its label.
   */
  private async fillTextByLabel(labelRegex: RegExp, value: string, friendlyName: string) {
    console.log(`[debug] Setting "${friendlyName}" = "${value}"`);
    const input = this.page.getByLabel(labelRegex).first()
      .or(
        this.page.getByText(labelRegex).first()
          .locator('xpath=following::input[1]')
      )
      .first();
    await input.waitFor({ state: 'visible', timeout: 8_000 });
    await input.click();
    await input.fill(value);
    await this.page.keyboard.press('Tab');
  }

  private async selectComboboxByName(nameRegex: RegExp, optionText: string, friendlyName: string) {
    console.log(`[debug] Opening "${friendlyName}" dropdown...`);

    const strategies: Locator[] = [
      this.page.getByRole('combobox', { name: nameRegex }),
      this.page.locator(`label:has-text("${friendlyName}")`)
        .locator('xpath=following::*[@role="combobox" or self::input][1]'),
      this.page.locator(`[role="combobox"]`).filter({
        has: this.page.locator(`text=${friendlyName}`)
      }),
      this.page.getByText(friendlyName, { exact: false })
        .locator('xpath=ancestor::*[1]')
        .locator('[role="combobox"], input, [aria-haspopup]')
        .first(),
    ];

    let opened = false;
    for (let i = 0; i < strategies.length; i++) {
      try {
        const el = strategies[i].first();
        await el.waitFor({ state: 'visible', timeout: 4_000 });
        await el.scrollIntoViewIfNeeded().catch(() => {});
        await el.click({ force: true });
        await this.page.waitForTimeout(700);
        const anyOption = this.page.locator('li[role="option"]:visible, [role="option"]:visible').first();
        if (await anyOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
          opened = true;
          console.log(`[debug] "${friendlyName}" opened (strategy ${i + 1})`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!opened) {
      throw new Error(`Could not open "${friendlyName}" dropdown`);
    }

    const option = this.page.locator('li[role="option"], [role="option"]')
      .filter({ hasText: new RegExp(this.escapeRegex(optionText), 'i') })
      .first();

    let optionVisible = await option.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!optionVisible) {
      const shortText = optionText.split('(')[0].trim();
      const looserOption = this.page.locator('li[role="option"], [role="option"]')
        .filter({ hasText: new RegExp(this.escapeRegex(shortText), 'i') })
        .first();
      const visible = await looserOption.isVisible({ timeout: 3_000 }).catch(() => false);
      if (visible) {
        await looserOption.click();
        return;
      }
      const allOptions = await this.page.locator('li[role="option"]:visible, [role="option"]:visible').allTextContents();
      throw new Error(`Option "${optionText}" not found in "${friendlyName}". Available: ${JSON.stringify(allOptions)}`);
    }

    await option.click();
    console.log(`[debug] Selected "${optionText}" in "${friendlyName}"`);
  }

  private async fillDateField(labelText: string, dateValue: string, dateIndex: number) {
    const strategies = [
      this.page.locator('input[placeholder*="mm" i]').nth(dateIndex),
      this.page.getByLabel(labelText, { exact: false }).first(),
      this.page.locator('input').nth(2 + dateIndex),
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const field = strategies[i];
        await field.waitFor({ state: 'visible', timeout: 3_000 });
        await field.click();
        await this.page.waitForTimeout(200);
        await field.click({ clickCount: 3 });
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(100);
        await this.page.keyboard.type(dateValue, { delay: 80 });
        await this.page.waitForTimeout(300);

        const value = await field.inputValue().catch(() => '');
        if (value && value.length >= 8) {
          await this.page.keyboard.press('Tab');
          return;
        }
      } catch {
        continue;
      }
    }
    throw new Error(`Could not fill ${labelText}`);
  }

  async clickNext() {
    const nextBtn = this.page.getByRole('button', { name: /next|forward|→/i })
      .or(this.page.locator('button[aria-label*="next" i]')).last();
    await nextBtn.click();
    await this.page.waitForTimeout(1200);
  }

  async clickSave() {
    const saveBtn = this.page.getByRole('button', { name: /^save$/i })
      .or(this.page.locator('button[aria-label*="save" i]')).first();
    await saveBtn.click();
  }

  // =================================================================
  // HANDSONTABLE GRID - Eligibility Rules & Calculation Rules
  // =================================================================
  //
  // Handsontable uses:
  //   - .colHeader for column header text (in <span class="colHeader">)
  //   - .htCore as the grid container (<table class="htCore">)
  //   - cells are <td> with no specific class; addressed by row/col index
  //   - To edit: click cell to select, then type (no double-click needed)
  //   - To open a dropdown editor: press Enter or Alt+Down

  async fillEligibilityRow(row: EligibilityRow, rowIndex: number = 0) {
    console.log('[debug] Filling Eligibility row...');
    await this.fillHandsontableCell(rowIndex, 'Valid From', row.validFrom);
    await this.fillHandsontableCell(rowIndex, 'Valid To', row.validTo);
    await this.fillHandsontableDropdownCell(rowIndex, 'Sales Org', row.salesOrg);
    await this.fillHandsontableDropdownCell(rowIndex, 'Customer Number', row.customerNumber);
    console.log('[debug] Eligibility row done');
  }

  async validateEligibility() {
    console.log('[debug] Clicking Validate...');
    const validateButton = this.page.getByRole('button', { name: /validate/i })
      .or(this.page.locator('button[aria-label*="validate" i]')).first();
    await validateButton.click();
    await expect(this.page.locator('text=/data validated successfully/i').first())
      .toBeVisible({ timeout: 20_000 });
    console.log('[debug] Validation successful');
  }

  async fillCalculationRow(row: CalculationRow, rowIndex: number = 0) {
    console.log('[debug] Filling Calculation row...');
    await this.fillHandsontableDropdownCell(rowIndex, 'Formula 1', row.formula1);
    await this.fillHandsontableDropdownCell(rowIndex, 'Calc Level 1', row.calcLevel1);

    if (row.formula2 !== undefined) {
      await this.fillHandsontableDropdownCell(rowIndex, 'Formula 2', row.formula2);
    }
    if (row.calcLevel2 !== undefined) {
      await this.fillHandsontableDropdownCell(rowIndex, 'Calc Level 2', row.calcLevel2);
    }
    if (row.formula3 !== undefined) {
      await this.fillHandsontableDropdownCell(rowIndex, 'Formula 3', row.formula3);
    }
    if (row.calcLevel3 !== undefined) {
      await this.fillHandsontableDropdownCell(rowIndex, 'Calc Level 3', row.calcLevel3);
    }

    await this.fillHandsontableCell(rowIndex, 'Start Date', row.startDate);
    await this.fillHandsontableCell(rowIndex, 'End Date', row.endDate);
    console.log('[debug] Calculation row done');
  }

  // =================================================================
  // SCALE DATA popup (multi-axis tiered scales)
  // =================================================================
  //
  // The Scale icon lives in the "Scale" column of a Calculation Rules row.
  // Clicking it opens a "Scale Data" dialog containing its own Handsontable.
  // Because that grid sits on top of the Calculation grid, every locator here
  // is scoped to the dialog so the two grids never collide.

  private scaleDialog(): Locator {
    // The dialog is identified by its "Scale Data" heading.
    return this.page.locator('[role="dialog"]')
      .filter({ has: this.page.getByText('Scale Data', { exact: false }) })
      .first();
  }

  /**
   * Open the Scale Data popup from the Scale column of a Calculation row.
   */
  async openScaleData(rowIndex: number = 0) {
    console.log(`[debug] Opening Scale Data popup for calc row ${rowIndex + 1}...`);
    const scaleCell = await this.locateHandsontableCell(rowIndex, 'Scale');
    await scaleCell.scrollIntoViewIfNeeded();

    const dialog = this.scaleDialog();
    const isOpen = () => dialog.isVisible({ timeout: 2_000 }).catch(() => false);

    // A single click on the Scale icon opens the popup. Do NOT keep clicking the
    // cell afterwards — once the dialog is open it covers the cell and any
    // further click/dblclick is intercepted by the modal overlay.
    await scaleCell.click();
    if (await isOpen()) {
      console.log('[debug] Scale Data popup opened (single click)');
      return;
    }

    // Fallbacks only if the single click didn't open it.
    console.log('[debug] single click did not open popup — trying double-click');
    await scaleCell.dblclick().catch(() => {});
    if (await isOpen()) {
      console.log('[debug] Scale Data popup opened (double click)');
      return;
    }

    console.log('[debug] trying native double-click');
    await this.nativeDoubleClick(scaleCell).catch(() => {});
    await expect(dialog, 'Scale Data popup').toBeVisible({ timeout: 15_000 });
    console.log('[debug] Scale Data popup opened (native)');
  }

  /**
   * Dispatch a full native double-click sequence at the centre of an element.
   * Handsontable binds to native DOM mouse events, so this lands the activation
   * even when a synthetic Playwright dblclick is intercepted by a child node.
   */
  private async nativeDoubleClick(target: Locator) {
    await target.evaluate((el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const opts: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
        button: 0,
      };
      const fire = (type: string) => el.dispatchEvent(new MouseEvent(type, opts));
      fire('mousedown');
      fire('mouseup');
      fire('click');
      fire('mousedown');
      fire('mouseup');
      fire('click');
      fire('dblclick');
    });
    await this.page.waitForTimeout(200);
  }

  /**
   * Fill the Scale Data Handsontable.
   *
   * Per Handsontable behaviour here, a cell must be DOUBLE-CLICKED to edit it.
   * Each axis is a single "Operator | Value" cell (operator dropdown + value)
   * followed by a separate "Unit" cell; the outcome is "Scale Value" (+ optional
   * "Scale Unit"). Cells are addressed by aria-colindex from the JSON so the
   * layout can be corrected without code changes.
   *
   * If a column doesn't fill, dump the live layout once with:
   *   await page.locator('[role="dialog"] table.htCore tbody tr').first()
   *     .locator('td').evaluateAll(t => t.map(td => td.getAttribute('aria-colindex')));
   * and adjust the "columns" block in the JSON.
   */
  async fillScaleData(scale: ScaleData) {
    const { rows } = scale;
    for (let t = 0; t < rows.length; t++) {
      console.log(`[debug] Scale tier ${t + 1}/${rows.length}`);
      await this.fillScaleTier(t, rows[t]);
    }
    // Let HOT commit the last value before the confirm click.
    await this.page.waitForTimeout(600);
    console.log('[debug] Scale Data grid filled');
  }

  /**
   * The Scale popup's data grid: Handsontable's MAIN table lives inside
   * `.ht_master`, within the Scale Data dialog. This selector is stable across
   * tiers and ignores the transient autocomplete-editor tables that HOT adds to
   * the DOM while a dropdown is open (which broke index/cell-count lookups).
   */
  private scaleGrid(): Locator {
    return this.scaleDialog()
      .locator('.ht_master table.htCore, .ht_master .htCore')
      .first();
  }

  /** '<=  (LE)' -> 'LE'; '>=' -> 'GE'; 'GE' -> 'GE'. */
  private operatorCode(raw: string): string {
    const s = (raw || '').trim();
    const paren = s.match(/\(([^)]+)\)/);
    if (paren) return paren[1].trim().toUpperCase();
    const sym: Record<string, string> = { '>=': 'GE', '<=': 'LE', '>': 'GT', '<': 'LT' };
    return sym[s] ?? s.toUpperCase();
  }

  /** 'USD  (USD)' -> 'USD'; '%  (%)' -> '%'; 'USD' -> 'USD'. */
  private unitToken(raw: string): string {
    const s = (raw || '').replace(/\s+/g, ' ').trim();
    return s ? s.split('(')[0].trim() : '';
  }

  /**
   * Fill one scale tier (row) by cell POSITION, mirroring the proven Commitment
   * Metrics approach. Cells are addressed as td.nth(pos) within the tier's row
   * of the Scale grid (anchored via .ht_master, not a global index). Dropdowns
   * (operator/unit): double-click to open, click the matching option. Numbers
   * (value/scaleValue): double-click, type, Tab to commit. Clicking a new cell
   * commits the previous editor, so no row drift. Each axis = 3 positions.
   */
  private async fillScaleTier(tierIndex: number, row: ScaleRow) {
    const grid = this.scaleGrid();
    await grid.waitFor({ state: 'visible', timeout: 10_000 });

    const cellAt = (pos: number) =>
      grid.locator('tbody tr').nth(tierIndex).locator('td').nth(pos);

    const optSel =
      '.handsontable.autocompleteEditor:visible tbody td, ' +
      'li[role="option"]:visible, [role="option"]:visible, td[role="option"]:visible';

    const fillDropdown = async (pos: number, token: string) => {
      if (!token) return;
      const cell = cellAt(pos);
      await cell.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => {});
      await cell.dblclick({ force: true }); // dblclick opens the dropdown
      await this.page.waitForTimeout(350);

      const matcher = new RegExp(this.escapeRegex(token), 'i');
      const opt = this.page.locator(optSel).filter({ hasText: matcher }).first();
      if (await opt.isVisible({ timeout: 2_500 }).catch(() => false)) {
        await opt.click({ force: true });
      } else {
        // Fallback: type the token to filter, then click / keyboard-select.
        await this.page.keyboard.type(token, { delay: 25 });
        await this.page.waitForTimeout(250);
        const filtered = this.page.locator(optSel).filter({ hasText: matcher }).first();
        if (await filtered.isVisible({ timeout: 1_500 }).catch(() => false)) {
          await filtered.click({ force: true });
        } else {
          await this.page.keyboard.press('ArrowDown').catch(() => {});
          await this.page.waitForTimeout(100);
          await this.page.keyboard.press('Enter').catch(() => {});
        }
      }
      await this.page.waitForTimeout(200);
      console.log(`[debug]   tier ${tierIndex + 1} pos ${pos} dropdown="${token}"`);
    };

    const fillNumber = async (pos: number, value: string) => {
      if (value === undefined || value === null || value === '') return;
      const cell = cellAt(pos);
      await cell.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => {});
      await cell.dblclick({ force: true }); // dblclick opens the text editor
      await this.page.waitForTimeout(150);
      await this.page.keyboard.press('Control+A').catch(() => {});
      await this.page.keyboard.press('Backspace').catch(() => {});
      await this.page.keyboard.type(value.trim(), { delay: 25 });
      await this.page.waitForTimeout(100);
      await this.page.keyboard.press('Tab'); // commit value, keep cursor in popup
      await this.page.waitForTimeout(150);
      console.log(`[debug]   tier ${tierIndex + 1} pos ${pos} value="${value}"`);
    };

    // Each axis = [operator (dropdown), value (number), unit (dropdown)].
    let pos = 0;
    for (const axis of row.axes) {
      if (axis.operator !== undefined) await fillDropdown(pos, this.operatorCode(axis.operator));
      pos += 1;
      await fillNumber(pos, String(axis.value));
      pos += 1;
      if (axis.unit !== undefined) await fillDropdown(pos, this.unitToken(String(axis.unit)));
      pos += 1;
    }
    // Outcome: Scale Value (number), Scale Unit (dropdown).
    await fillNumber(pos, String(row.scaleValue));
    pos += 1;
    if (row.scaleUnit !== undefined) await fillDropdown(pos, this.unitToken(String(row.scaleUnit)));

    // Do NOT press Escape here — THIS dialog closes on Escape. The last cell is
    // committed by its option-click / Tab, so nothing is left open; just settle.
    await this.page.waitForTimeout(300);
  }

  /**
   * Click the ✓ Confirm button (aria-label="Confirm") to SAVE the scale.
   * This is the exact, stable selector for the popup's bottom-right check button.
   */
  async confirmScaleData() {
    console.log('[debug] Confirming Scale Data...');
    const confirmBtn = this.page.locator('[role="dialog"] button[aria-label="Confirm"]').last();
    let clicked = false;
    try {
      await confirmBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await confirmBtn.click({ force: true });
      clicked = true;
      console.log('[debug] confirmScaleData: clicked button[aria-label="Confirm"]');
    } catch {
      try {
        const alt = this.page.locator('button[aria-label="Confirm"]').last();
        await alt.click({ force: true });
        clicked = true;
        console.log('[debug] confirmScaleData: clicked button[aria-label="Confirm"] (unscoped)');
      } catch {
        console.log('[debug] confirmScaleData: Confirm button not found');
      }
    }
    if (!clicked) throw new Error('Could not confirm Scale Data popup');
    await this.page.getByText('Scale Data').first()
      .waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
    console.log('[debug] Scale Data popup closed');
  }

  async setApprovalStatus(status: string) {
    await this.selectComboboxByName(/approval status/i, status, 'Approval Status');
  }

  async assertSaveSuccessful() {
    await expect(this.page.locator('text=/successfully|created|saved/i').first())
      .toBeVisible({ timeout: 20_000 });
  }

  // ============ HANDSONTABLE HELPERS ============

  /**
   * Finds the column index (0-based) of a column by its header text.
   * Headers are <span class="colHeader">Valid From</span> inside <th> cells.
   */
  private async getColumnIndex(columnName: string): Promise<number> {
    const headers = this.page.locator('span.colHeader');
    const count = await headers.count();
    console.log(`[debug] Found ${count} colHeader elements`);

    for (let i = 0; i < count; i++) {
      const text = (await headers.nth(i).textContent())?.trim() || '';
      if (text.toLowerCase() === columnName.toLowerCase()) {
        // Handsontable usually has a "row header" column (the row numbers) at index 0,
        // so we need the parent <th>'s actual index. Get it via JS evaluation.
        const cellIndex = await headers.nth(i).evaluate((el) => {
          const th = el.closest('th');
          if (!th) return -1;
          // cellIndex is 1-based in HTML for visible header (0 = the row-number column)
          // We want the data-column index
          return th.cellIndex;
        });
        console.log(`[debug] Column "${columnName}" is at cellIndex ${cellIndex}`);
        return cellIndex;
      }
    }
    throw new Error(`Column "${columnName}" not found among headers`);
  }

  /**
   * Locates a cell in the Handsontable body by row and column index.
   */
  private async locateHandsontableCell(rowIndex: number, columnName: string): Promise<Locator> {
    const colIndex = await this.getColumnIndex(columnName);
    if (colIndex < 0) throw new Error(`Invalid column index for "${columnName}"`);

    // In Handsontable, the body table has <tr> rows and <td> cells.
    // The first <td> in each row is usually the row number, so we offset.
    // But the colIndex from getColumnIndex already accounts for this.
    const cell = this.page.locator('table.htCore tbody tr').nth(rowIndex)
      .locator('td').nth(colIndex - 1); // -1 because tbody td doesn't include the row-number <th>

    return cell;
  }

  /**
   * Click a cell and type a value. Handsontable accepts typing directly
   * after a cell is selected.
   */
  private async fillHandsontableCell(rowIndex: number, columnName: string, value: string) {
    console.log(`[debug] Setting ${columnName} = "${value}" in row ${rowIndex + 1}`);
    const cell = await this.locateHandsontableCell(rowIndex, columnName);
    await cell.scrollIntoViewIfNeeded();
    await cell.click();
    await this.page.waitForTimeout(150);

    // Enter edit mode and type
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(150);
    await this.page.keyboard.type(value, { delay: 30 });
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(200);
  }

  /**
   * Click a dropdown cell, open the picker, and select the matching option.
   */
  private async fillHandsontableDropdownCell(rowIndex: number, columnName: string, value: string) {
    console.log(`[debug] Setting ${columnName} (dropdown) = "${value}" in row ${rowIndex + 1}`);
    const cell = await this.locateHandsontableCell(rowIndex, columnName);
    await cell.scrollIntoViewIfNeeded();
    await cell.click();
    await this.page.waitForTimeout(150);

    // For Handsontable dropdown cells, double-click opens the editor.
    await cell.dblclick();
    await this.page.waitForTimeout(400);

    const optSel = '[role="option"], li, .htAutocompleteArrow ~ * li, .ht_master tr td';
    const matcher = new RegExp(this.escapeRegex(value), 'i');
    const findOption = () => this.page.locator(optSel).filter({ hasText: matcher }).first();

    // Some lists (e.g. Customer Number) load asynchronously after the prior
    // column is set, so the option may not appear immediately. Type to filter,
    // then retry the filter a couple of times while the list populates.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt === 0) {
        await this.page.keyboard.type(value, { delay: 30 });
      } else {
        console.log(`[debug]   "${value}" not visible yet — re-filtering (attempt ${attempt + 1})`);
        await this.page.keyboard.press('Control+A').catch(() => {});
        await this.page.keyboard.press('Backspace').catch(() => {});
        await this.page.waitForTimeout(300);
        await this.page.keyboard.type(value, { delay: 30 });
      }
      try {
        await findOption().waitFor({ state: 'visible', timeout: 6_000 });
        await findOption().click();
        await this.page.waitForTimeout(200);
        return;
      } catch {
        await this.page.waitForTimeout(600);
      }
    }
    throw new Error(
      `Dropdown option "${value}" not found for "${columnName}" (row ${rowIndex + 1}) after 3 attempts — ` +
      `the value may not be a valid option for this contract.`,
    );
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async getComplianceNumber(): Promise<string> {
    const field = this.page.getByLabel('Compliance Number', { exact: false }).first();
    await expect(field).not.toHaveValue('', { timeout: 30_000 });
    return (await field.inputValue()).trim();
  }
}
