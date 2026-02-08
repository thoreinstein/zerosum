/**
 * Sanitizes error messages by removing potentially sensitive information 
 * like base64 image strings, full prompts, or specific PII patterns.
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  // Remove base64 data URIs
  sanitized = sanitized.replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/g, '[IMAGE_DATA]');

  // Remove potential long base64 strings (heuristic: 100+ chars of base64 chars)
  sanitized = sanitized.replace(/[a-zA-Z0-9+/]{100,}/g, '[SENSITIVE_DATA]');

  return sanitized;
}

/**
 * Standardized scan error codes for client-side mapping
 */
export enum ScanErrorCode {
  TIMEOUT = 'SCAN_TIMEOUT',
  UNSCANNABLE = 'SCAN_FAILED_UNSCANNABLE',
  NOT_A_RECEIPT = 'SCAN_FAILED_NOT_RECEIPT',
  SERVER_ERROR = 'SCAN_SERVER_ERROR',
  IMAGE_NOT_FOUND = 'IMAGE_NOT_FOUND',
}

export interface ScanErrorResponse {
  code: ScanErrorCode;
  message: string;
}

export function createScanError(code: ScanErrorCode, originalError?: unknown): ScanErrorResponse {
  const baseMessage = originalError instanceof Error ? originalError.message : String(originalError || 'Unknown error');
  const sanitized = sanitizeErrorMessage(baseMessage);

  return {
    code,
    message: sanitized
  };
}
