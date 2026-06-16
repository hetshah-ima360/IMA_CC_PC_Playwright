import { GeneralTabExtraData, ScaleData } from '../pages/PriceCompliancePage';

/**
 * Shape of a Price Compliance "create contract" JSON data file.
 *
 * Convention: one JSON file per test script, living in /data with the SAME
 * base name as the .spec.ts that consumes it. Eligibility/Calculation rows
 * carry only the fields unique to each row; the shared start/end dates come
 * from `dates`, but any row may override them by supplying its own.
 *
 * `generalExtras` is a GeneralTabExtraData, so the optional fields
 * (sourceDataType, exclusiveFormula, calculationFrequency, agreementStatus,
 * baseDso) are available for richer contracts like CP&H COGS Audit.
 *
 * A calculation row may carry a `scale` block to drive the Scale Data popup.
 */
export interface PriceComplianceTestData {
  priceCompliance: {
    dates: { startDate: string; endDate: string };
    modal: { complianceType: string; description: string };
    generalExtras: GeneralTabExtraData;
    eligibilityRows: Array<{
      salesOrg: string;
      customerNumber?: string;
      customerChain?: string;
      nationalGroup?: string;
      subgroup?: string;
      region?: string;
      district?: string;
      validFrom?: string;
      validTo?: string;
    }>;
    calculationRows: Array<{
      formula1: string;
      calcLevel1: string;
      startDate?: string;
      endDate?: string;
      formula2?: string;
      calcLevel2?: string;
      formula3?: string;
      calcLevel3?: string;
      scale?: ScaleData;
    }>;
    approvalStatus: string;
    simulation?: {
      calcPeriodFrom: string;
      calcPeriodTo: string;
      expectedFinalCogs?: string;
    };
  };
}
