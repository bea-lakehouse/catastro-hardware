import { NextResponse } from 'next/server';
import { getSilver } from '@/services';

export async function GET() {
  try {
    const data = await getSilver();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error('[/api/v1/silver]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
