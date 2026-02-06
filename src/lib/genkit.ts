import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Initialize Genkit
export const ai = genkit({
  plugins: [googleAI()],
});
