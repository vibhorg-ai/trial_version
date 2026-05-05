import { auth } from '@clerk/nextjs/server';
import { vi } from 'vitest';

/**
 * Configures the @clerk/nextjs/server `auth()` mock to return a specific
 * userId (or null for unauthenticated). Call this before invoking the route
 * handler under test.
 *
 * Requires that the test file (or vitest.integration.setup.ts) calls
 * `vi.mock('@clerk/nextjs/server')` so the module is mockable.
 */
export function mockClerkAuth(userId: string | null): void {
  vi.mocked(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId,
    sessionId: userId ? `sess_${userId}` : null,
    sessionClaims: null,
    actor: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    has: () => false,
    redirectToSignIn: () => {
      throw new Error('redirectToSignIn called');
    },
    redirectToSignUp: () => {
      throw new Error('redirectToSignUp called');
    },
    getToken: async () => null,
  } as unknown as Awaited<ReturnType<typeof auth>>);
}
