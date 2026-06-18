import { NextResponse } from 'next/server';
import { getForecast } from '@/services';

export async function GET() {
  try {
    const data = getForecast();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error('[/api/v1/forecast]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
