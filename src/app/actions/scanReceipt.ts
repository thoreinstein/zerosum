'use server';

import { gemini20Flash } from '@genkit-ai/googleai';
import { z } from 'genkit'; // Import z from genkit to ensure version compatibility
import { ai } from '@/lib/genkit';
import { ScanErrorCode, createScanError } from '@/lib/errorUtils';

const ReceiptSchema = z.object({
  payee: z.string().describe('The name of the merchant or payee. Look for logos or bold text at the top.'),
  date: z.string().describe('The transaction date in YYYY-MM-DD format. Look for "Date", "Time", or purely numeric date strings. Use the current year if the year is missing or ambiguous.'),
  amount: z.number().describe('The FINAL total amount paid. Look for "Total", "Amount Due", "Grand Total", or the largest currency value at the bottom. Ignore subtotals or tax lines unless they represent the final payment.'),
  category: z.string().optional().describe('The best matching category from the provided list based on the items purchased or the merchant type.'),
});

const SCAN_TIMEOUT_MS = 25000; // 25 seconds

export async function scanReceipt(base64Image: string, categories: string[] = []) {
  try {
    const categoryList = categories.length > 0 ? categories.join(', ') : 'Dining Out, Groceries, Utilities, Rent, Entertainment';

    const generatePromise = ai.generate({
      model: gemini20Flash,
      config: {
        temperature: 0,
      },
      prompt: [
        { text: `You are an expert receipt data extractor. Your goal is 99% accuracy.

Analyze the provided receipt image, which may be faded, crumpled, or have a non-standard layout.
Extract the following fields:
1. **Payee**: The merchant name.
2. **Date**: The transaction date (YYYY-MM-DD). If the year is missing, assume the current year.
3. **Amount**: The TOTAL amount paid. Be careful to distinguish between 'Subtotal', 'Tax', and 'Total'. If multiple totals appear (e.g., cash vs card), use the final payment amount.
4. **Category**: Choose the best fit from: ${categoryList}.

If the text is faint (thermal paper), look for high-contrast patterns.
If the receipt is crumpled, use context to reconstruct broken lines.` },
        { media: { url: `data:image/png;base64,${base64Image}` } }
      ],
      output: { schema: ReceiptSchema },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Scan timed out')), SCAN_TIMEOUT_MS);
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const data = response.output;

    if (!data) {
      throw new Error("No data extracted");
    }

    return { success: true, data };
  } catch (error) {
    const isTimeout = error instanceof Error && error.message === 'Scan timed out';
    const scanError = createScanError(
      isTimeout ? ScanErrorCode.TIMEOUT : ScanErrorCode.SERVER_ERROR,
      error
    );

    console.error('Scan Error:', {
      code: scanError.code,
      message: scanError.message
    });

    return { success: false, error: scanError };
  }
}
