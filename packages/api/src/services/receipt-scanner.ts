/**
 * Receipt Scanning Service with AWS Textract
 *
 * Accepts JPEG, PNG, HEIC images up to 10MB.
 * Extracts: merchant name, total amount, currency, date.
 * Suggests expense category based on merchant.
 * Returns confidence score and flags missing fields.
 * Processes within 10 seconds.
 *
 * Implements Requirements: 18.3, 18.4, 18.5, 18.15, 18.16
 */

import { TextractClient, AnalyzeExpenseCommand } from '@aws-sdk/client-textract';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReceiptScanResult {
  merchantName: string | null;
  totalAmount: number | null;
  currency: string | null;
  date: string | null;
  suggestedCategory: string | null;
  confidence: number; // 0-1
  missingFields: string[];
  rawFields: Record<string, { value: string; confidence: number }>;
}

export interface ReceiptScanError {
  code: 'INVALID_IMAGE' | 'TOO_LARGE' | 'UNSUPPORTED_FORMAT' | 'EXTRACTION_FAILED' | 'LOW_QUALITY';
  message: string;
  retryable: boolean;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Merchant → category mapping for suggestion
const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  uber: 'transport',
  lyft: 'transport',
  taxi: 'transport',
  gas: 'transport',
  shell: 'transport',
  bp: 'transport',
  chevron: 'transport',
  hotel: 'accommodation',
  hilton: 'accommodation',
  marriott: 'accommodation',
  airbnb: 'accommodation',
  hyatt: 'accommodation',
  restaurant: 'food_drink',
  cafe: 'food_drink',
  starbucks: 'food_drink',
  mcdonalds: 'food_drink',
  pizza: 'food_drink',
  bar: 'food_drink',
  pub: 'food_drink',
  pharmacy: 'health',
  cvs: 'health',
  walgreens: 'health',
  hospital: 'health',
  museum: 'activities',
  cinema: 'activities',
  theater: 'activities',
  tour: 'activities',
  mall: 'shopping',
  store: 'shopping',
  shop: 'shopping',
  market: 'shopping',
  amazon: 'shopping',
};

// ─── Service ─────────────────────────────────────────────────────────────────

export class ReceiptScannerService {
  private client: TextractClient;

  constructor(region?: string) {
    this.client = new TextractClient({
      region: region ?? process.env['AWS_REGION'] ?? 'us-east-1',
    });
  }

  /**
   * Validate the input image before processing.
   */
  validateImage(
    mimeType: string,
    sizeBytes: number,
  ): ReceiptScanError | null {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return {
        code: 'UNSUPPORTED_FORMAT',
        message: `Unsupported image format. Allowed: JPEG, PNG, HEIC.`,
        retryable: false,
      };
    }

    if (sizeBytes > MAX_FILE_SIZE) {
      return {
        code: 'TOO_LARGE',
        message: `Image too large (${Math.round(sizeBytes / 1024 / 1024)}MB). Maximum: 10MB.`,
        retryable: false,
      };
    }

    return null;
  }

  /**
   * Scan a receipt image and extract expense fields.
   *
   * @param imageBytes - Raw image bytes (Buffer)
   * @returns ReceiptScanResult with extracted fields and confidence
   */
  async scanReceipt(imageBytes: Buffer): Promise<ReceiptScanResult> {
    try {
      const command = new AnalyzeExpenseCommand({
        Document: {
          Bytes: imageBytes,
        },
      });

      const response = await this.client.send(command);

      // Parse Textract expense response
      const result = this.parseTextractResponse(response);
      return result;
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string };

      if (err.name === 'InvalidParameterException') {
        throw {
          code: 'LOW_QUALITY',
          message: 'Image quality too poor to process. Please take a clearer photo.',
          retryable: true,
        } as ReceiptScanError;
      }

      if (err.name === 'UnsupportedDocumentException') {
        throw {
          code: 'INVALID_IMAGE',
          message: 'Unable to process this image. Please try a different photo.',
          retryable: true,
        } as ReceiptScanError;
      }

      throw {
        code: 'EXTRACTION_FAILED',
        message: 'Failed to extract receipt data. Please try again.',
        retryable: true,
      } as ReceiptScanError;
    }
  }

  /**
   * Parse the AWS Textract AnalyzeExpense response into our domain model.
   */
  private parseTextractResponse(response: any): ReceiptScanResult {
    const rawFields: Record<string, { value: string; confidence: number }> = {};
    let merchantName: string | null = null;
    let totalAmount: number | null = null;
    let currency: string | null = null;
    let date: string | null = null;
    let totalConfidence = 0;
    let fieldCount = 0;

    const documents = response.ExpenseDocuments ?? [];

    for (const doc of documents) {
      // Extract summary fields (merchant, total, date)
      const summaryFields = doc.SummaryFields ?? [];

      for (const field of summaryFields) {
        const type = field.Type?.Text?.toUpperCase() ?? '';
        const value = field.ValueDetection?.Text ?? '';
        const confidence = (field.ValueDetection?.Confidence ?? 0) / 100;

        if (value) {
          rawFields[type] = { value, confidence };
          totalConfidence += confidence;
          fieldCount++;
        }

        switch (type) {
          case 'VENDOR_NAME':
          case 'NAME':
            if (!merchantName) {
              merchantName = value;
            }
            break;

          case 'TOTAL':
          case 'AMOUNT_PAID':
          case 'SUBTOTAL':
            if (totalAmount === null) {
              const parsed = parseAmount(value);
              if (parsed !== null) {
                totalAmount = parsed.amount;
                if (parsed.currency) {
                  currency = parsed.currency;
                }
              }
            }
            break;

          case 'INVOICE_RECEIPT_DATE':
          case 'DATE':
          case 'ORDER_DATE':
            if (!date) {
              date = normalizeDate(value);
            }
            break;
        }
      }

      // Check line items for additional context
      const lineItems = doc.LineItemGroups ?? [];
      for (const group of lineItems) {
        for (const item of group.LineItems ?? []) {
          for (const field of item.LineItemExpenseFields ?? []) {
            const type = field.Type?.Text?.toUpperCase() ?? '';
            const value = field.ValueDetection?.Text ?? '';
            const confidence = (field.ValueDetection?.Confidence ?? 0) / 100;

            if (value && !rawFields[type]) {
              rawFields[type] = { value, confidence };
            }
          }
        }
      }
    }

    // Determine missing fields
    const missingFields: string[] = [];
    if (!merchantName) missingFields.push('merchantName');
    if (totalAmount === null) missingFields.push('totalAmount');
    if (!currency) missingFields.push('currency');
    if (!date) missingFields.push('date');

    // Calculate overall confidence
    const overallConfidence = fieldCount > 0
      ? Math.round((totalConfidence / fieldCount) * 100) / 100
      : 0;

    // Suggest category based on merchant name
    const suggestedCategory = merchantName
      ? suggestCategory(merchantName)
      : null;

    return {
      merchantName,
      totalAmount,
      currency,
      date,
      suggestedCategory,
      confidence: overallConfidence,
      missingFields,
      rawFields,
    };
  }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Parse an amount string, extracting the numeric value and optional currency symbol.
 */
export function parseAmount(text: string): { amount: number; currency: string | null } | null {
  if (!text) return null;

  // Remove whitespace
  const cleaned = text.trim();

  // Extract currency symbol
  let currency: string | null = null;
  const currencySymbols: Record<string, string> = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₹': 'INR',
    'CHF': 'CHF',
    'AUD': 'AUD',
    'CAD': 'CAD',
  };

  for (const [symbol, code] of Object.entries(currencySymbols)) {
    if (cleaned.includes(symbol)) {
      currency = code;
      break;
    }
  }

  // Extract numeric value (handles formats like "1,234.56" or "1.234,56")
  const numericMatch = /[\d,.]+/.exec(cleaned);
  if (!numericMatch) return null;

  let numStr = numericMatch[0];

  // Determine decimal separator
  const lastComma = numStr.lastIndexOf(',');
  const lastDot = numStr.lastIndexOf('.');

  if (lastComma > lastDot) {
    // European format: 1.234,56
    numStr = numStr.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: 1,234.56
    numStr = numStr.replace(/,/g, '');
  }

  const amount = parseFloat(numStr);
  if (isNaN(amount)) return null;

  return { amount: Math.round(amount * 100) / 100, currency };
}

/**
 * Normalize a date string to YYYY-MM-DD format.
 */
export function normalizeDate(text: string): string | null {
  if (!text) return null;

  const cleaned = text.trim();

  // ISO format: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // US format: MM/DD/YYYY or M/D/YYYY
  const usMatch = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(cleaned);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
  }

  // European format: DD/MM/YYYY or DD.MM.YYYY
  const euMatch = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(cleaned);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    const dayNum = parseInt(day!, 10);
    const monthNum = parseInt(month!, 10);
    // Disambiguate: if first number > 12, it's likely day
    if (dayNum > 12) {
      return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
    }
  }

  // Named month: "Jan 15, 2024" or "15 Jan 2024"
  const monthNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04',
    june: '06', july: '07', august: '08', september: '09',
    october: '10', november: '11', december: '12',
  };

  const namedMatch = /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})/i.exec(cleaned);
  if (namedMatch) {
    const [, day, monthStr, year] = namedMatch;
    const month = monthNames[monthStr!.toLowerCase()];
    if (month) {
      return `${year}-${month}-${day!.padStart(2, '0')}`;
    }
  }

  const namedMatch2 = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i.exec(cleaned);
  if (namedMatch2) {
    const [, monthStr, day, year] = namedMatch2;
    const month = monthNames[monthStr!.toLowerCase()];
    if (month) {
      return `${year}-${month}-${day!.padStart(2, '0')}`;
    }
  }

  // Try native Date parsing as last resort
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Suggest an expense category based on merchant name.
 */
export function suggestCategory(merchantName: string): string | null {
  const lower = merchantName.toLowerCase();

  for (const [keyword, category] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (lower.includes(keyword)) {
      return category;
    }
  }

  return 'other';
}
