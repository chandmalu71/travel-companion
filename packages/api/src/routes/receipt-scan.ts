/**
 * Receipt Scanning Route
 *
 * POST /api/expenses/scan - Scan a receipt image and extract expense fields
 *
 * Accepts JPEG, PNG, HEIC images up to 10MB as base64.
 * Returns extracted fields with confidence scores.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { ReceiptScannerService, type ReceiptScanError } from '../services/receipt-scanner.js';

interface ScanReceiptBody {
  image: string; // base64-encoded
  mimeType: string;
}

export async function registerReceiptScanRoute(app: FastifyInstance): Promise<void> {
  const scanner = new ReceiptScannerService();

  app.post(
    '/api/expenses/scan',
    async (request: FastifyRequest<{ Body: ScanReceiptBody }>, reply: FastifyReply) => {
      const { image, mimeType } = request.body;

      if (!image || !mimeType) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Both "image" (base64) and "mimeType" are required',
        });
      }

      // Decode base64
      const imageBuffer = Buffer.from(image, 'base64');

      // Validate
      const validationError = scanner.validateImage(mimeType, imageBuffer.length);
      if (validationError) {
        return reply.status(400).send({
          statusCode: 400,
          error: validationError.code,
          message: validationError.message,
          retryable: validationError.retryable,
        });
      }

      try {
        const result = await scanner.scanReceipt(imageBuffer);

        return reply.send({
          statusCode: 200,
          data: result,
        });
      } catch (error: unknown) {
        const scanError = error as ReceiptScanError;
        if (scanError.code) {
          return reply.status(422).send({
            statusCode: 422,
            error: scanError.code,
            message: scanError.message,
            retryable: scanError.retryable,
          });
        }

        request.log.error(error, 'Receipt scan failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to scan receipt. Please try again.',
        });
      }
    },
  );
}
