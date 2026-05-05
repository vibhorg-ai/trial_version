'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function AttributionLog() {
  const pathname = usePathname();

  useEffect(() => {
    console.log('[NextFlow] Candidate LinkedIn: https://www.linkedin.com/in/harshuldhar');
  }, [pathname]);

  return null;
}
