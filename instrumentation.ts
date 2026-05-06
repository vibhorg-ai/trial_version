export async function register(): Promise<void> {
  // Skip Sentry entirely when no DSN is configured. Importing the Sentry init
  // file pulls in @opentelemetry/instrumentation as a side effect, which
  // collides with Next.js's own OTEL bundle and produces dozens of warnings on
  // every request. Returning early keeps the dev server log clean.
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
