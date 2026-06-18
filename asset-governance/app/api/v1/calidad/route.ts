import { NextResponse } from 'next/server';
import { getCalidad } from '@/services';

export async function GET() {
  try {
    const data = getCalidad();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error('[/api/v1/calidad]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
