import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/panel';

  if (code) {
    const auth = await getSupabaseServer();
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }

  return NextResponse.redirect(new URL('/panel?error=auth_callback', url.origin));
}
