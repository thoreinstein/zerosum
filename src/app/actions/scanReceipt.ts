'use server';

import { gemini20Flash } from '@genkit-ai/googleai';
import { z } from 'genkit'; // Import z from genkit to ensure version compatibility
import { ai } from '@/lib/genkit';

const ReceiptSchema = z.object({
  payee: z.string().describe('The merchant or payee name'),
  date: z.string().describe('The date of the transaction in YYYY-MM-DD format. Use current year if missing.'),
  amount: z.number().describe('The total amount of the transaction'),
  category: z.string().optional().describe('The category that best fits the transaction.'),
});

export async function scanReceipt(base64Image: string, categories: string[] = []) {
  try {
    const categoryList = categories.length > 0 ? categories.join(', ') : 'Dining Out, Groceries, Utilities, Rent, Entertainment';

    const response = await ai.generate({
      model: gemini20Flash,
      prompt: [
        { text: `Extract data from this receipt. Classify the category into one of these: ${categoryList}.` },
        { media: { url: `data:image/png;base64,${base64Image}` } }
      ],
      output: { schema: ReceiptSchema },
    });

    const data = response.output;

    if (!data) {
      throw new Error("No data extracted");
    }

    return { success: true, data };
  } catch (error) {
    console.error('Genkit Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to process receipt' };
  }
}
