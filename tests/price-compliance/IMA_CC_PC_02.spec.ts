import { test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { AppLauncherPage } from '../../pages/AppLauncherPage';
import {
  PriceCompliancePage,
  CreateModalData,
  GeneralTabExtraData,
  EligibilityRow,
  CalculationRow,
} from '../../pages/PriceCompliancePage';
import { CalculationSimulationPage } from '../../pages/CalculationSimulationPage';
import { appendSimulationResult } from '../../utils/resultsWriter';
import { PriceComplianceTestData } from '../../utils/types';

import rawData from '../../data/IMA_CC_PC_02.json';

const data = rawData as unknown as PriceComplianceTestData;
const pc = data.priceCompliance;
const { startDate, endDate } = pc.dates;

/**
 * Regression — IMA_CC_PC_02 (from CC_PC_Testing_Scenarios "Sheet3").
 * Create the contract, then run a Calculation Simulation and store the
 * Final COGS under results/.
 */
test.describe('Price Compliance — IMA_CC_PC_02 (Regression)', () => {
  test('IMA_CC_PC_02 - create contract then run simulation', async ({ page }) => {
    test.setTimeout(0);
    const username = process.env.IMA360_USERNAME;
    const password = process.env.IMA360_PASSWORD;
    if (!username || !password) {
      throw new Error('IMA360_USERNAME and IMA360_PASSWORD must be set in .env');
    }

    const login = new LoginPage(page);
    await login.goto();
    await login.login(username, password);
    console.log('Logged in');

    const launcher = new AppLauncherPage(page);
    await launcher.openContractCompliance();
    await launcher.openPriceComplianceContractSetup();
    console.log('Navigated to Price Compliance > Contract Setup');

    const pcPage = new PriceCompliancePage(page);
    await pcPage.clickAddFromList();

    const modalData: CreateModalData = {
      complianceType: pc.modal.complianceType,
      description: pc.modal.description,
      startDate,
      endDate,
    };
    await pcPage.fillCreateModal(modalData);
    console.log('Modal filled');

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
    await pcPage.clickNext();
    console.log('-> Eligibility Rules tab');

    for (let i = 0; i < pc.eligibilityRows.length; i++) {
      const row = pc.eligibilityRows[i];
      const eligibilityRow: EligibilityRow = {
        validFrom: row.validFrom ?? startDate,
        validTo: row.validTo ?? endDate,
        salesOrg: row.salesOrg,
        customerNumber: row.customerNumber,
        customerChain: row.customerChain,
        nationalGroup: row.nationalGroup,
        subgroup: row.subgroup,
        region: row.region,
        district: row.district,
      };
      await pcPage.fillEligibilityRow(eligibilityRow, i);
      console.log(`Eligibility row ${i} filled`);
    }

    await pcPage.validateEligibility();
    await pcPage.clickNext();
    console.log('-> Calculation Rules tab');

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
    await pcPage.clickNext();
    console.log('-> Approval tab');

    await pcPage.setApprovalStatus(pc.approvalStatus);
    await pcPage.clickSave();
    await pcPage.assertSaveSuccessful();
    console.log('Save successful!');

    await launcher.openPriceComplianceContractSetup();
    const complianceNumber = await pcPage.getComplianceNumberFromList();
    console.log(`\n>>> Compliance Number created: ${complianceNumber}\n`);

    await launcher.openPriceComplianceCalculationSimulation();
    const calcPeriodFrom = pc.simulation?.calcPeriodFrom ?? '07/01/2024';
    const calcPeriodTo = pc.simulation?.calcPeriodTo ?? '07/31/2024';

    const sim = new CalculationSimulationPage(page);
    await sim.runSimulation({ calcPeriodFrom, calcPeriodTo, complianceNumber });

    const { finalCogs, simulationNumber } = await sim.readResults();
    appendSimulationResult({
      scenario: 'IMA_CC_PC_02',
      contractNumber: complianceNumber,
      description: pc.modal.description,
      calcPeriodFrom,
      calcPeriodTo,
      finalCogs,
      simulationNumber,
    });
    console.log(`>>> Final COGS for contract ${complianceNumber}: ${finalCogs} (expected ${pc.simulation?.expectedFinalCogs ?? 'n/a'})`);
  });
});
