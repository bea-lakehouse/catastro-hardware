import { NextResponse } from 'next/server';
import { getBronze } from '@/services';

export async function GET() {
  try {
    const data = getBronze();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error('[/api/v1/bronze]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
