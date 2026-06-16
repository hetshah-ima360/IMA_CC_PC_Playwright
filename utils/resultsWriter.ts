import * as fs from 'fs';
import * as path from 'path';

export interface SimulationResultRecord {
  contractNumber: string;
  description: string;
  calcPeriodFrom: string;
  calcPeriodTo: string;
  finalCogs: string;
  simulationNumber?: string;
  scenario?: string;
  runAt?: string;
}

const RESULTS_DIR = path.join(process.cwd(), 'results');

/** Make a value safe to use inside a filename. */
function slug(v: string): string {
  return String(v ?? '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')   // spaces / punctuation -> underscore
    .replace(/^_+|_+$/g, '')             // trim leading/trailing underscores
    || 'unknown';
}

/**
 * Store one simulation result as results/simulation-<contractNumber>-<Description>.json.
 * Returns the file path written.
 */
export function appendSimulationResult(rec: SimulationResultRecord): { json: string } {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const runAt = rec.runAt ?? new Date().toISOString();
  const fileName = `simulation-${slug(rec.contractNumber)}-${slug(rec.description)}.json`;
  const json = path.join(RESULTS_DIR, fileName);

  fs.writeFileSync(json, JSON.stringify({ ...rec, runAt }, null, 2));
  console.log(`[debug] Result stored -> ${path.relative(process.cwd(), json)}`);
  return { json };
}
