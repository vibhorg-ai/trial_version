/**
 * Same-origin guard for state-changing API routes.
 *
 * Browsers always send `Origin` on cross-origin XHR/fetch and on form POSTs;
 * comparing it to the request URL's origin protects POST/PUT/DELETE/PATCH
 * routes against CSRF without requiring a token round-trip.
 *
 * Server-to-server clients can opt-in to bypass via `Authorization: Bearer ...`
 * — those calls don't ride a session cookie so CSRF doesn't apply. We treat
 * any request with an `Authorization` header (e.g. Trigger.dev callbacks,
 * future API tokens) as out-of-scope for this guard.
 */

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface OriginCheck {
  ok: boolean;
  reason?: 'missing-origin' | 'origin-mismatch';
}

export function checkSameOrigin(req: Request): OriginCheck {
  if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
    return { ok: true };
  }
  if (req.headers.get('authorization')) {
    return { ok: true };
  }

  const origin = req.headers.get('origin');
  const requestUrl = new URL(req.url);
  const expected = requestUrl.origin;

  if (!origin) {
    // Some same-origin sub-resource fetches (e.g. user navigating to a POST
    // form) omit `Origin` but always send a same-host `Referer`. Accept that
    // as a fallback.
    const referer = req.headers.get('referer');
    if (!referer) {
      return { ok: false, reason: 'missing-origin' };
    }
    try {
      const refUrl = new URL(referer);
      if (refUrl.origin === expected) return { ok: true };
    } catch {
      return { ok: false, reason: 'missing-origin' };
    }
    return { ok: false, reason: 'origin-mismatch' };
  }

  if (origin !== expected) {
    return { ok: false, reason: 'origin-mismatch' };
  }
  return { ok: true };
}
