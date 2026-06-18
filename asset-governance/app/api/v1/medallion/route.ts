import { NextResponse } from 'next/server';
import { getMedallion } from '@/services';

export async function GET() {
  try {
    const data = await getMedallion();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error('[/api/v1/medallion]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
