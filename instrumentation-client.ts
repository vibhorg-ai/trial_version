// Conditionally initialise Sentry on the client. We use a dynamic import inside
// an IIFE so that, when NEXT_PUBLIC_SENTRY_DSN is empty, the @sentry/nextjs
// bundle is not pulled into the client at all. This keeps the JS payload smaller
// for a typical local-dev session where Sentry is disabled.
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
    });
  });
}
