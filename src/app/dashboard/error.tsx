'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '../../components/ErrorFallback';
import { reportError } from '../../lib/reportError';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);
  return <ErrorFallback error={error} reset={reset} scope="dashboard" />;
}
