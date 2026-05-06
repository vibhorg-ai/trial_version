import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { buildAuthParams, signParams } from '../../../../lib/transloadit';

export const runtime = 'nodejs';

const AUTH_TTL_SECONDS = 3600;

export async function POST(_req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authKey = process.env.TRANSLOADIT_AUTH_KEY;
  const secret = process.env.TRANSLOADIT_AUTH_SECRET;
  if (!authKey || !secret) {
    return NextResponse.json({ error: 'Transloadit not configured' }, { status: 500 });
  }

  const paramsObj = buildAuthParams(new Date(), AUTH_TTL_SECONDS);
  const params = JSON.stringify(paramsObj);
  const signature = signParams(params, secret);

  return NextResponse.json({ params, signature });
}
