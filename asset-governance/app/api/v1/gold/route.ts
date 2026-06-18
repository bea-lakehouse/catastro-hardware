import { NextResponse } from 'next/server';
import { getGold } from '@/services';

export async function GET() {
  try {
    const data = getGold();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error('[/api/v1/gold]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
