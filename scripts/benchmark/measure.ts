import fs from 'fs';
import path from 'path';
import { scanReceipt } from '../../src/app/actions/scanReceipt';

// Types
interface ReceiptData {
  payee: string;
  date: string;
  amount: number;
  category?: string;
}

interface GoldStandardEntry extends ReceiptData {
  filename: string;
}

interface BenchmarkResult {
  filename: string;
  latency: number;
  actual?: ReceiptData;
  expected?: GoldStandardEntry;
  success: boolean;
  error?: string;
}

// Configuration
const DATASET_DIR = path.join(__dirname, 'dataset');
const IMAGES_DIR = path.join(DATASET_DIR, 'images');
const GOLD_STANDARD_PATH = path.join(DATASET_DIR, 'gold-standard.json');

async function main() {
  if (!fs.existsSync(GOLD_STANDARD_PATH)) {
    console.error('Gold standard file not found at:', GOLD_STANDARD_PATH);
    process.exit(1);
  }

  const goldStandard: GoldStandardEntry[] = JSON.parse(fs.readFileSync(GOLD_STANDARD_PATH, 'utf-8'));
  const results: BenchmarkResult[] = [];

  console.log(`Starting benchmark for ${goldStandard.length} receipts...\n`);

  for (const entry of goldStandard) {
    const imagePath = path.join(IMAGES_DIR, entry.filename);
    if (!fs.existsSync(imagePath)) {
      console.warn(`Warning: Image not found for ${entry.filename}. Skipping.`);
      continue;
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const startTime = Date.now();
    try {
      const response = await scanReceipt(base64Image);
      const endTime = Date.now();
      const latency = endTime - startTime;

      if (response.success && response.data) {
        results.push({
          filename: entry.filename,
          latency,
          actual: response.data as ReceiptData,
          expected: entry,
          success: true
        });
        console.log(`✓ ${entry.filename} processed in ${latency}ms`);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorMsg = typeof (response as any).error === 'string' 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (response as any).error 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : (response as any).error?.message || 'Unknown error';
        results.push({
          filename: entry.filename,
          latency,
          error: errorMsg,
          success: false
        });
        console.error(`✗ ${entry.filename} failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`✗ ${entry.filename} error:`, error);
      results.push({
        filename: entry.filename,
        latency: Date.now() - startTime,
        error: String(error),
        success: false
      });
    }
  }

  printSummary(results);
}

function printSummary(results: BenchmarkResult[]) {
  const successfulResults = results.filter((r): r is BenchmarkResult & { actual: ReceiptData; expected: GoldStandardEntry } => 
    r.success && !!r.actual && !!r.expected
  );

  if (successfulResults.length === 0) {
    console.log('\nNo successful results to summarize.');
    return;
  }

  const latencies = successfulResults.map(r => r.latency).sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];

  const fields: (keyof ReceiptData)[] = ['payee', 'date', 'amount', 'category'];
  const fieldAccuracy: Record<string, number> = {};

  fields.forEach(field => {
    const correctCount = successfulResults.filter(r => {
      const actual = r.actual[field];
      const expected = r.expected[field];
      
      let isCorrect = false;
      if (field === 'amount') {
        isCorrect = Math.abs((actual as number || 0) - (expected as number || 0)) < 0.01;
      } else {
        isCorrect = String(actual || '').toLowerCase() === String(expected || '').toLowerCase();
      }

      if (!isCorrect) {
        console.log(`  [Mismatch] ${r.filename} ${field}: Expected "${expected}", Got "${actual}"`);
      }
      return isCorrect;
    }).length;
    fieldAccuracy[field] = (correctCount / successfulResults.length) * 100;
  });

  const overallAccuracy = Object.values(fieldAccuracy).reduce((a, b) => a + b, 0) / fields.length;

  console.log('\n' + '='.repeat(40));
  console.log('BENCHMARK SUMMARY');
  console.log('='.repeat(40));
  console.log(`Total Samples: ${results.length}`);
  console.log(`Successful:    ${successfulResults.length}`);
  console.log(`Failed:        ${results.length - successfulResults.length}`);
  const p95Value = p95Latency !== undefined ? p95Latency : avgLatency;
  console.log('-'.repeat(40));
  console.log(`Avg Latency:   ${avgLatency.toFixed(2)}ms`);
  console.log(`P95 Latency:   ${p95Value.toFixed(2)}ms`);
  console.log('-'.repeat(40));
  fields.forEach(field => {
    console.log(`${field.padEnd(10)} Accuracy: ${fieldAccuracy[field].toFixed(2)}%`);
  });
  console.log('-'.repeat(40));
  console.log(`OVERALL ACCURACY: ${overallAccuracy.toFixed(2)}%`);
  console.log('='.repeat(40));
}

main().catch(console.error);