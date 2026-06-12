# IMA360 Platform - Price Compliance Playwright Suite

Data-driven Playwright automation for Price Compliance contract setup on the
IMA360 Platform. Every test script reads its inputs from a JSON file - no test
data lives in code.

## Folder structure

```
ima360-pc-playwright/
├── pages/                       # Page Objects (shared, reusable UI layer)
│   ├── LoginPage.ts
│   ├── AppLauncherPage.ts
│   └── PriceCompliancePage.ts
├── data/                        # ONE JSON per script - same base name as its .spec.ts
│   └── TS-IMA-CC-PC_01_Create_Price_Compliance.json
├── tests/                       # specs, grouped by area
│   └── price-compliance/
│       └── TS-IMA-CC-PC_01_Create_Price_Compliance.spec.ts
├── utils/
│   └── types.ts                 # shared test-data interfaces
├── playwright.config.ts
├── tsconfig.json                # path aliases live here
├── package.json
└── .env                         # IMA360_USERNAME / IMA360_PASSWORD (not committed)
```

## Path aliases

`tsconfig.json` maps three aliases so a spec's imports never depend on how deep
it sits under `tests/`:

| Alias       | Resolves to |
| ----------- | ----------- |
| `@pages/*`  | `pages/*`   |
| `@data/*`   | `data/*`    |
| `@utils/*`  | `utils/*`   |

Playwright honours these automatically (it reads `paths` from the nearest
tsconfig). So every spec, at any depth, imports the same way:

```ts
import { PriceCompliancePage } from '@pages/PriceCompliancePage';
import { PriceComplianceTestData } from '@utils/types';
import rawData from '@data/TS-IMA-CC-PC_01_Create_Price_Compliance.json';
```

## The naming convention

A script and its data are a matched pair with the SAME base name:

```
tests/price-compliance/TS-IMA-CC-PC_01_Create_Price_Compliance.spec.ts
data/TS-IMA-CC-PC_01_Create_Price_Compliance.json
```

This is what makes "pick a script and run it" unambiguous - the data file is
always findable from the spec name and vice versa.

## Adding a new script

1. Copy the JSON in `data/`, rename it to your new `TS-...` id, edit the values.
2. Copy the spec in `tests/price-compliance/`, rename it to match, and point its
   `@data/...` import at the new JSON.
3. Run it (see below). No config changes needed.

## Running

Set credentials first (one time):

```bash
cp .env.example .env        # then fill in IMA360_USERNAME / IMA360_PASSWORD
npm install
npx playwright install chromium
```

Run ALL scripts:

```bash
npm test
```

Run ONE script - three ways to "select and run":

```bash
# a) by path
npx playwright test tests/price-compliance/TS-IMA-CC-PC_01_Create_Price_Compliance.spec.ts --headed

# b) by name fragment (matches the test title)
npx playwright test -g "TS-IMA-CC-PC_01" --headed

# c) interactive picker - click any script to run/re-run
npm run test:ui
```

The VS Code "Playwright Test" extension also puts a green play button next to
every test if you prefer clicking from the editor.

Other useful scripts: `npm run test:headed`, `npm run test:debug`,
`npm run report` (open last HTML report), `npm run codegen` (record selectors).

## Notes

- Re-running against the same environment with an identical `description` may hit
  a duplicate. To force uniqueness, append a timestamp in the spec:
  `description: pc.modal.description + '_' + Date.now()`.
- `eligibilityRows` and `calculationRows` are arrays - add a row object to drive
  a multi-row contract without editing the spec.
