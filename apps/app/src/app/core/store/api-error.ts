/**
 * Message of an HttpErrorResponse / NestJS error body for the UI. Network
 * failures (status 0) are reported as such so the pages can translate them
 * (`error.network` in the common section).
 */
export function apiErrorMessage(error: unknown): string {
  const err = error as { status?: number; message?: string };
  if (err?.status === 0) return 'error.network';
  const body = apiErrorBody(error);
  if (typeof body === 'string' && body) return body;
  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message.join(' · ');
  return message || err?.message || 'error.generic';
}

/**
 * The NestJS error body of an HttpErrorResponse as an object. Requests the
 * generated client reads as text (204 endpoints such as the deletes) hand
 * the JSON body back as a string — parse it so `statusCode`, `message` and
 * the extra fields (e.g. `inUse`) are reachable either way.
 */
export function apiErrorBody(error: unknown): Record<string, unknown> | string | null {
  const body = (error as { error?: unknown })?.error;
  if (body == null) return null;
  if (typeof body === 'string') {
    const text = body.trim();
    if (text.startsWith('{')) {
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return body;
      }
    }
    return body;
  }
  return typeof body === 'object' ? (body as Record<string, unknown>) : null;
}
