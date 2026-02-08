# Zerosum AI Benchmark

This tool measures the accuracy and latency of the receipt scanning pipeline (currently using Gemini 2.0 Flash).

## Prerequisites

1.  Set `GOOGLE_GENAI_API_KEY` or `GEMINI_API_KEY` in your environment.
2.  Install dependencies: `npm install`

## Running the Benchmark

```bash
npx tsx scripts/benchmark/measure.ts
```

## Dataset

-   Images are stored in `scripts/benchmark/dataset/images/`.
-   Ground truth data is in `scripts/benchmark/dataset/gold-standard.json`.

## Results

Results are documented in `working/benchmarks/`.
