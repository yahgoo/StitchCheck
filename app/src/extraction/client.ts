/* ── Itinerary extraction browser client ── */

import type { ExtractionResult } from '../../../core/domain';
import type { ProviderStatusResult } from '../../../core/provenance';

export interface ExtractionRequest {
  image: string;
  mediaType?: 'image/png' | 'image/jpeg';
  instruction?: string;
}

export interface ExtractionResponse {
  extraction: ExtractionResult & {
    evidenceSource: string;
    provider: string;
    executed: boolean;
    fallbackUsed: boolean;
    validationOutcome: string;
  };
  providerStatus: ProviderStatusResult;
  timestamp: string;
}

export interface ExtractionStatusResponse {
  dataMode: string;
  extractionConfigured: boolean;
  transport: string;
  model: string;
  timestamp: string;
}

export interface ExtractionError {
  error: string;
  message: string;
}

export async function extractItinerary(
  params: ExtractionRequest,
): Promise<ExtractionResponse> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errBody: ExtractionError = await res.json().catch(() => ({
      error: 'unknown',
      message: `Extraction returned HTTP ${res.status}`,
    }));
    throw new ExtractionClientError(errBody.error, errBody.message, res.status);
  }

  return res.json() as Promise<ExtractionResponse>;
}

export async function extractionStatus(): Promise<ExtractionStatusResponse> {
  const res = await fetch('/api/extract/status', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new ExtractionClientError(
      'status_failed',
      `Extraction status returned HTTP ${res.status}`,
      res.status,
    );
  }

  return res.json() as Promise<ExtractionStatusResponse>;
}

export class ExtractionClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'ExtractionClientError';
  }
}
