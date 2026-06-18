import { NextResponse } from 'next/server';
import { getGobierno } from '@/services';

export async function GET() {
  try {
    const data = getGobierno();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error('[/api/v1/gobierno]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
