"use server";

import { getSupabaseAdmin } from '@/lib/supabase';

const QR_TTL_SECONDS = 60;

export async function emitirQrDinamicoKiosco(kioskKey: string) {
  const cleanKey = String(kioskKey ?? '').trim().toLowerCase();
  if (!cleanKey) throw new Error('Clave de terminal de sucursal requerida.');

  const supabase = getSupabaseAdmin();

  const { data: sucursal, error: sucError } = await supabase
    .from('sucursales')
    .select('id, nombre')
    .eq('kiosk_key', cleanKey)
    .maybeSingle();

  if (sucError || !sucursal) {
    throw new Error('Terminal no autorizada o clave de sucursal inválida.');
  }

  // Limpiar tokens expirados o consumidos hace más de 10 minutos
  const limiteLimpieza = new Date(Date.now() - 10 * 60_000).toISOString();
  await supabase.from('qr_tokens_dinamicos').delete().lt('expires_at', limiteLimpieza);

  // Generar token aleatorio único de 24 bytes (48 hex chars)
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  const token = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');

  const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000).toISOString();

  const { data: inserted, error: insError } = await supabase
    .from('qr_tokens_dinamicos')
    .insert({
      sucursal_id: sucursal.id,
      token,
      expires_at: expiresAt,
    })
    .select('id, token, expires_at')
    .single();

  if (insError || !inserted) {
    throw new Error('No se pudo emitir el código QR dinámico.');
  }

  return {
    qrId: inserted.id,
    token: inserted.token,
    expiresAt: inserted.expires_at,
    ttlSeconds: QR_TTL_SECONDS,
    sucursalId: sucursal.id,
    sucursalNombre: sucursal.nombre,
  };
}

/**
 * Permite que la pantalla del kiosco detecte en tiempo real cuando un empleado escaneó y consumió ese QR
 * para rotarlo inmediatamente al siguiente.
 */
export async function verificarEstadoQrKiosco(qrId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('qr_tokens_dinamicos')
    .select('consumed_at, empleados(nombre)')
    .eq('id', qrId)
    .maybeSingle();

  return {
    consumido: Boolean(data?.consumed_at),
    empleadoNombre: (data?.empleados as any)?.nombre || null,
  };
}
