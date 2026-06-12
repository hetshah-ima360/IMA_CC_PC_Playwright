import { test, expect } from '@playwright/test';
import { LoginPage } from '@pages/LoginPage';
import { AppLauncherPage } from '@pages/AppLauncherPage';
import {
  PriceCompliancePage,
  CreateModalData,
  GeneralTabExtraData,
  EligibilityRow,
  CalculationRow,
} from '@pages/PriceCompliancePage';
import { PriceComplianceTestData } from '@utils/types';

// ---- Data-driven: all values come from the JSON file, not from code ----
import rawData from '@data/TS-IMA-CC-PC_01_Create_Price_Compliance.json';

const data = rawData as unknown as PriceComplianceTestData;
const pc = data.priceCompliance;
const { startDate, endDate } = pc.dates;

/**
 * Test: Create a complete Price Compliance Contract on IMA360 Platform.
 *
 * Flow:
 *   1. Log in
 *   2. Open Contract Compliance app
 *   3. Navigate: Price Compliance > Contract Setup
 *   4. Click Add (+) -> MODAL opens
 *   5. Fill modal (Compliance Type, Description, Start Date, End Date) -> confirm
 *   6. Full form opens - fill General tab extras (Group, Subgroup, Origin) -> Next
 *   7. Fill Eligibility Rules row(s) -> Validate -> Next
 *   8. Fill Calculation Rules row(s) -> Next
 *   9. Skip Notes -> Next
 *  10. Set Approval Status -> Save
 */

test.describe('Price Compliance - Contract Setup', () => {
  test('TS-IMA-CC-PC_01 - Create a complete Price Compliance contract', async ({ page }) => {
    test.setTimeout(0);
    const username = process.env.IMA360_USERNAME;
    const password = process.env.IMA360_PASSWORD;
    if (!username || !password) {
      throw new Error('IMA360_USERNAME and IMA360_PASSWORD must be set in .env');
    }

    // ---- 1. Log in ----
    const login = new LoginPage(page);
    await login.goto();
    await login.login(username, password);
    console.log('Logged in');

    // ---- 2. Open Contract Compliance ----
    const launcher = new AppLauncherPage(page);
    await launcher.openContractCompliance();
    console.log('Opened Contract Compliance app');

    // ---- 3. Navigate to Price Compliance > Contract Setup ----
    await launcher.openPriceComplianceContractSetup();
    console.log('Navigated to Price Compliance > Contract Setup');

    // ---- 4. Click Add ----
    const pcPage = new PriceCompliancePage(page);
    await pcPage.clickAddFromList();
    console.log('Add modal opened');

    // ---- 5. Fill the Create modal ----
    const modalData: CreateModalData = {
      complianceType: pc.modal.complianceType,
      description: pc.modal.description,
      startDate,
      endDate,
    };

    await pcPage.fillCreateModal(modalData);
    console.log('Modal filled and confirmed');

    // ---- 6. Fill remaining General tab fields on the full form ----
    const generalExtras: GeneralTabExtraData = {
      group: pc.generalExtras.group,
      contractSubgroup: pc.generalExtras.contractSubgroup,
      origin: pc.generalExtras.origin,
    };

    await pcPage.fillGeneralTabExtras(generalExtras);
    console.log('General tab extras filled');

    await pcPage.clickNext();
    console.log('-> Eligibility Rules tab');

    // ---- 7. Eligibility Rules (one or more rows from JSON) ----
    for (let i = 0; i < pc.eligibilityRows.length; i++) {
      const row = pc.eligibilityRows[i];
      const eligibilityRow: EligibilityRow = {
        validFrom: row.validFrom ?? startDate,
        validTo: row.validTo ?? endDate,
        salesOrg: row.salesOrg,
        customerNumber: row.customerNumber,
      };
      await pcPage.fillEligibilityRow(eligibilityRow, i);
      console.log(`Eligibility row ${i} filled`);
    }

    await pcPage.validateEligibility();
    console.log('Validated');

    await pcPage.clickNext();
    console.log('-> Calculation Rules tab');

    // ---- 8. Calculation Rules (one or more rows from JSON) ----
    for (let i = 0; i < pc.calculationRows.length; i++) {
      const row = pc.calculationRows[i];
      const calculationRow: CalculationRow = {
        formula1: row.formula1,
        calcLevel1: row.calcLevel1,
        startDate: row.startDate ?? startDate,
        endDate: row.endDate ?? endDate,
      };
      await pcPage.fillCalculationRow(calculationRow, i);
      console.log(`Calculation row ${i} filled`);
    }

    await pcPage.clickNext();
    console.log('-> Notes & Attachments tab');

    // ---- 9. Skip Notes ----
    await pcPage.clickNext();
    console.log('-> Approval tab');

    // ---- 10. Approval ----
    await pcPage.setApprovalStatus(pc.approvalStatus);
    console.log('Approval Status set');

    await pcPage.clickSave();
    console.log('Save clicked');

    await pcPage.assertSaveSuccessful();
    console.log('Save successful!');

    try {
      const complianceNumber = await pcPage.getComplianceNumber();
      console.log(`\n>>> Compliance Number created: ${complianceNumber}\n`);
    } catch {
      // not fatal
    }
  });
});
