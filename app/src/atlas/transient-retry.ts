/** Transient Atlas Sandbox / keychain failures that recover without a second click. */
export const TRANSIENT_ATLAS_CODES = new Set([
  'SERVICE_TEMPORARILY_UNAVAILABLE',
  'SECURE_STORE_UNAVAILABLE',
]);

export const CLIENT_TRANSIENT_ATTEMPTS = 5;
export const CLIENT_TRANSIENT_DELAY_MS = 2500;

export function isTransientAtlasCode(code: string | null | undefined): boolean {
  return Boolean(code && TRANSIENT_ATLAS_CODES.has(code));
}

export function atlasErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  return '';
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
