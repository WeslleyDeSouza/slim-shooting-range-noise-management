/**
 * Message of an HttpErrorResponse / NestJS error body for the UI. Network
 * failures (status 0) are reported as such so the pages can translate them
 * (`error.network` in the common section).
 */
export function apiErrorMessage(error: unknown): string {
  const err = error as {
    status?: number;
    error?: { message?: string | string[] } | string;
    message?: string;
  };
  if (err?.status === 0) return 'error.network';
  const body = err?.error;
  if (typeof body === 'string' && body) return body;
  const message = (body as { message?: string | string[] } | undefined)?.message;
  if (Array.isArray(message)) return message.join(' · ');
  return message || err?.message || 'error.generic';
}
