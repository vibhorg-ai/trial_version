import { createHmac } from 'node:crypto';

/** Params object signed and sent to Transloadit (JSON-stringified for signing and in FormData). */
export type TransloaditSignedParams = {
  auth: {
    key: string;
    expires: string;
  };
  /** Set when `TRANSLOADIT_TEMPLATE_ID` is non-empty; omitted otherwise. */
  template_id?: string;
};

/**
 * Transloadit auth expiry format: UTC `YYYY/MM/DD HH:mm:ss+00:00`.
 * @see https://transloadit.com/docs/topics/signature-authentication/
 */
export function formatExpires(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}/${m}/${d} ${h}:${min}:${s}+00:00`;
}

/**
 * Builds auth params for Transloadit uploads. Reads `TRANSLOADIT_AUTH_KEY` and
 * `TRANSLOADIT_TEMPLATE_ID` from `process.env`. Omits `template_id` when the env
 * var is unset or blank (some setups use inline steps; in production you typically
 * set a real template id on the server).
 */
export function buildAuthParams(now: Date, ttlSeconds: number): TransloaditSignedParams {
  const key = process.env.TRANSLOADIT_AUTH_KEY ?? '';
  const expiresAt = new Date(now.getTime() + Math.max(0, ttlSeconds) * 1000);
  const params: TransloaditSignedParams = {
    auth: {
      key,
      expires: formatExpires(expiresAt),
    },
  };
  const templateId = process.env.TRANSLOADIT_TEMPLATE_ID?.trim();
  if (templateId) {
    params.template_id = templateId;
  }
  return params;
}

/** v3+ Transloadit signature: `sha384:` + lowercase hex HMAC-SHA384 of the params JSON. */
export function signParams(paramsJson: string, secret: string): string {
  const hex = createHmac('sha384', secret).update(paramsJson, 'utf8').digest('hex');
  return `sha384:${hex}`;
}
