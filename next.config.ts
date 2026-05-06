import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  images: {
    // Allow next/image to optimize Transloadit-hosted assets. Transloadit
    // serves uploads + assembly outputs from a few different hosts depending
    // on region/template (`*.transloadit.com`, `tlcdn.com`, etc.) so we
    // whitelist the apex domains here. Without this `next/image` rejects the
    // src with "hostname not configured" and we fall back to a slow raw <img>.
    remotePatterns: [
      { protocol: 'https', hostname: '**.transloadit.com' },
      { protocol: 'https', hostname: 'transloadit.com' },
      { protocol: 'https', hostname: '**.tlcdn.com' },
      { protocol: 'https', hostname: 'tlcdn.com' },
    ],
  },
};

const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export default sentryEnabled ? withSentryConfig(nextConfig, { silent: true }) : nextConfig;
