import { NextResponse } from 'next/server';
import { getResumen } from '@/services';

export async function GET() {
  try {
    const data = getResumen();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error('[/api/v1/resumen]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
