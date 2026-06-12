import { test } from '@playwright/test';
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
import rawData from '@data/TS-IMA-CC-PC_02_HS_Scaled_DSO.json';

const data = rawData as unknown as PriceComplianceTestData;
const pc = data.priceCompliance;
const { startDate, endDate } = pc.dates;

/**
 * Test: Create a CP&H COGS Audit Price Compliance contract with a multi-axis
 * SCALE (TIER_GCR: GX - FLU x TIER_BPR: BPR -> Outcome) on IMA360 Platform.
 *
 * Flow:
 *   1. Log in
 *   2. Open Contract Compliance app
 *   3. Navigate: Price Compliance > Contract Setup
 *   4. Click Add (+) -> modal opens
 *   5. Fill modal (Compliance Type, Description, Start/End Date) -> confirm
 *   6. General tab: Exclusive Formula, Calc Frequency, Agreement Status,
 *      Group, Subgroup, Origin, Base DSO -> Next
 *   7. Eligibility Rules row -> Validate -> Next
 *   8. Calculation Rules: Formula 1 + Formula 2 (+ calc levels), then open the
 *      Scale popup, fill the scale grid, confirm -> Next
 *   9. Skip Notes -> Next
 *  10. Approval Status -> Save
 */

test.describe('Price Compliance - CP&H COGS Audit (Scaled DSO)', () => {
  test('TS-IMA-CC-PC_02 - Create a scaled multi-axis Price Compliance contract', async ({ page }) => {
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

    // ---- 6. General tab (extras + scaled-DSO fields) ----
    const generalExtras: GeneralTabExtraData = {
      group: pc.generalExtras.group,
      contractSubgroup: pc.generalExtras.contractSubgroup,
      origin: pc.generalExtras.origin,
      sourceDataType: pc.generalExtras.sourceDataType,
      exclusiveFormula: pc.generalExtras.exclusiveFormula,
      calculationFrequency: pc.generalExtras.calculationFrequency,
      agreementStatus: pc.generalExtras.agreementStatus,
      baseDso: pc.generalExtras.baseDso,
    };
    await pcPage.fillGeneralTabExtras(generalExtras);
    console.log('General tab filled');

    await pcPage.clickNext();
    console.log('-> Eligibility Rules tab');

    // ---- 7. Eligibility Rules ----
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

    // ---- 8. Calculation Rules + Scale ----
    for (let i = 0; i < pc.calculationRows.length; i++) {
      const row = pc.calculationRows[i];
      const calculationRow: CalculationRow = {
        formula1: row.formula1,
        calcLevel1: row.calcLevel1,
        startDate: row.startDate ?? startDate,
        endDate: row.endDate ?? endDate,
        formula2: row.formula2,
        calcLevel2: row.calcLevel2,
        formula3: row.formula3,
        calcLevel3: row.calcLevel3,
      };
      await pcPage.fillCalculationRow(calculationRow, i);
      console.log(`Calculation row ${i} filled`);

      if (row.scale) {
        await pcPage.openScaleData(i);
        await pcPage.fillScaleData(row.scale);
        await pcPage.confirmScaleData();
        console.log(`Scale data set for calc row ${i}`);
      }
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
