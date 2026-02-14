'use server';

import { gemini20Flash } from '@genkit-ai/googleai';
import { z } from 'genkit'; // Import z from genkit to ensure version compatibility
import { ai } from '@/lib/genkit';
import { ScanErrorCode, createScanError } from '@/lib/errorUtils';

const CategorySchema = z.string().min(1).max(50).regex(/^[a-zA-Z0-9 &'().,\-/:]+$/);
const DEFAULT_CATEGORIES = ['Dining Out', 'Groceries', 'Utilities', 'Rent', 'Entertainment'] as const;

// Maximum number of categories to prevent prompt token overflow and cost issues
const MAX_CATEGORIES = 100;

// Maximum base64 image size: ~10MB (base64 is ~1.37x original size, so ~7.3MB image)
const MAX_BASE64_SIZE = 10 * 1024 * 1024;

// Base64 validation regex (allows data URL prefix or raw base64)
const BASE64_REGEX = /^(?:data:image\/[a-z]+;base64,)?[A-Za-z0-9+/]+={0,2}$/;

const SCAN_TIMEOUT_MS = 25000; // 25 seconds

export async function scanReceipt(base64Image: string, categories: string[] = []) {
  try {
    // Validate base64 image format and size
    if (typeof base64Image !== 'string' || !base64Image) {
      throw new Error('Invalid image data');
    }
    if (base64Image.length > MAX_BASE64_SIZE) {
      throw new Error('Image size exceeds maximum allowed size');
    }
    if (!BASE64_REGEX.test(base64Image)) {
      throw new Error(
        'Invalid base64 image format: must be a base64-encoded string with optional data URL prefix (data:image/[type];base64,)'
      );
    }

    // Normalize data URL: extract base64 payload only (strip any existing prefix)
    let base64Payload = base64Image;
    const dataUrlPrefixMatch = base64Payload.match(/^data:image\/[a-z]+;base64,/);
    if (dataUrlPrefixMatch) {
      base64Payload = base64Payload.slice(dataUrlPrefixMatch[0].length);
    }

    // Additional base64 length validation and normalization
    // Base64 strings must have a length divisible by 4.
    // If the remainder is 2 or 3, we can safely normalize by padding with '=' characters.
    const remainder = base64Payload.length % 4;
    if (remainder === 1) {
      // This cannot be corrected by padding and indicates malformed base64
      throw new Error('Invalid base64 image format');
    } else if (remainder > 1) {
      // Normalize by adding the required padding so the length becomes divisible by 4
      base64Payload = base64Payload.padEnd(base64Payload.length + (4 - remainder), '=');
    }
    // Sanitize and validate categories to prevent prompt injection
    // Limit to MAX_CATEGORIES to prevent token overflow and cost issues
    const safeCategories = (Array.isArray(categories) ? categories : [])
      .slice(0, MAX_CATEGORIES)
      .map(cat => typeof cat === 'string' ? cat.trim() : '')
      .filter(cat => CategorySchema.safeParse(cat).success);

    // Deduplicate categories to prevent z.enum errors
    const uniqueCategories = Array.from(new Set(safeCategories));

    const finalCategories = uniqueCategories.length > 0
      ? uniqueCategories
      : [...DEFAULT_CATEGORIES];

    // Create a dynamic schema to enforce the category list
    const ReceiptSchema = z.object({
      payee: z.string().describe('The name of the merchant or payee. Look for logos or bold text at the top.'),
      date: z.string().describe('The transaction date in YYYY-MM-DD format. Look for "Date", "Time", or purely numeric date strings. Use the current year if the year is missing or ambiguous.'),
      amount: z.number().describe('The FINAL total amount paid. Look for "Total", "Amount Due", "Grand Total", or the largest currency value at the bottom. Ignore subtotals or tax lines unless they represent the final payment.'),
      category: z.enum(finalCategories as [string, ...string[]])
        .optional()
        .describe('The best matching category from the provided list based on the items purchased or the merchant type.'),
    });

    const categoryListString = finalCategories.join(', ');

    // Detect if the image is PNG or JPEG to maintain backward compatibility
    // PNG starts with 'iVBORw' (base64 for \x89PNG)
    const isPng = base64Image.startsWith('iVBORw');
    const mimeType = isPng ? 'image/png' : 'image/jpeg';

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
4. **Category**: Choose the best fit from: ${categoryListString}.

If the text is faint (thermal paper), look for high-contrast patterns.
If the receipt is crumpled, use context to reconstruct broken lines.` },
        { media: { url: `data:image/png;base64,${base64Payload}` } }
      ],
      output: { schema: ReceiptSchema },
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Scan timed out')), SCAN_TIMEOUT_MS);
    });

    try {
      const response = await Promise.race([generatePromise, timeoutPromise]);
      const data = response.output;

      if (!data) {
        throw new Error("No data extracted");
      }

      return { success: true, data };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
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
