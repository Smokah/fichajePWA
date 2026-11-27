"use server";

import { getSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeEmail } from '@/lib/validators';

export async function solicitarAccesoAdmin(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const admin = getSupabaseAdmin();

  const { data: allowed, error: lookupError } = await admin
    .from('usuarios_admin')
    .select('id, auth_user_id')
    .eq('email', email)
    .eq('activo', true)
    .maybeSingle();

  if (lookupError || !allowed || !allowed.auth_user_id) {
    // Respuesta genérica para no revelar si una cuenta está registrada.
    return { success: true };
  }

  const auth = await getSupabaseServer();
  const redirectTo = new URL('/auth/callback?next=/panel', process.env.NEXT_PUBLIC_SITE_URL || 'https://accesomovil.vercel.app').toString();
  const { error } = await auth.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
  });

  if (error) throw new Error('No se pudo enviar el enlace. Revisá la configuración de correo e intentá nuevamente.');
  return { success: true };
}

export async function cerrarSesionAdmin() {
  const auth = await getSupabaseServer();
  await auth.auth.signOut();
}
