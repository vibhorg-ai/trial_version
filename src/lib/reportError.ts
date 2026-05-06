/**
 * Lightweight error reporter that lazy-imports @sentry/nextjs only when the DSN
 * is configured. When Sentry is disabled (the default in local dev) this is a
 * complete no-op, and importing this file does NOT pull Sentry into the bundle.
 */
export function reportError(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.captureException(error);
  });
}
