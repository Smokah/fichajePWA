"use server";

import { getSupabaseAdmin } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase-server';
import { requireAdmin, assertEmployeeScope, assertBranchScope, type AdminSession } from '@/lib/admin-auth';
import { normalizeEmail, normalizeName } from '@/lib/validators';

export type { AdminSession };

export async function obtenerDatosAdministrativos(
  filtros?: { fechaDesde?: string; fechaHasta?: string; sucursalId?: string }
) {
  const session = await requireAdmin();
  const supabase = getSupabaseAdmin();
  const branchId = session.rol === 'superadmin'
    ? (filtros?.sucursalId && filtros.sucursalId !== 'TODAS' ? Number(filtros.sucursalId) : null)
    : session.sucursal_id;

  let branchQuery = supabase.from('sucursales').select('id, nombre, kiosk_key').order('id');
  let employeesQuery = supabase.from('empleados')
    .select('id, nombre, email, sucursal_id, sucursales(nombre), credenciales_biometricas(id)')
    .order('nombre');
  let punchesQuery = supabase.from('fichajes')
    .select('id, tipo, hora_registro, empleado_id, sucursal_id, sucursales(nombre), empleados(nombre, email, sucursal_id, sucursales(nombre))')
    .order('hora_registro', { ascending: false }).limit(1000);

  if (branchId) {
    branchQuery = branchQuery.eq('id', branchId);
    employeesQuery = employeesQuery.eq('sucursal_id', branchId);
    punchesQuery = punchesQuery.eq('sucursal_id', branchId);
  }
  if (filtros?.fechaDesde) punchesQuery = punchesQuery.gte('hora_registro', `${filtros.fechaDesde}T00:00:00.000-03:00`);
  if (filtros?.fechaHasta) punchesQuery = punchesQuery.lte('hora_registro', `${filtros.fechaHasta}T23:59:59.999-03:00`);

  const [sucursalesRes, empleadosRes, fichajesRes, adminsRes] = await Promise.all([
    branchQuery, employeesQuery, punchesQuery,
    session.rol === 'superadmin'
      ? supabase.from('usuarios_admin').select('id, nombre, email, rol, sucursal_id, activo, auth_user_id, created_at, sucursales(nombre)').order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sucursalesRes.error) throw new Error('Error cargando sucursales.');
  if (empleadosRes.error) throw new Error('Error cargando empleados.');
  if (fichajesRes.error) throw new Error('Error cargando fichajes.');

  return {
    session,
    sucursales: sucursalesRes.data ?? [],
    empleados: empleadosRes.data ?? [],
    fichajes: fichajesRes.data ?? [],
    usuariosAdmin: adminsRes.data ?? [],
  };
}

export async function editarEmpleadoAdmin(
  empleadoId: string,
  datos: { nombre: string; email: string; sucursalId: number | null }
) {
  const session = await requireAdmin();
  await assertEmployeeScope(empleadoId, session);
  const nombre = normalizeName(datos.nombre);
  const email = datos.email ? normalizeEmail(datos.email) : null;
  const sucursalId = datos.sucursalId ? Number(datos.sucursalId) : null;
  await assertBranchScope(sucursalId, session);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('empleados')
    .update({ nombre, email, sucursal_id: sucursalId }).eq('id', empleadoId);
  if (error) {
    if (error.message.includes('duplicate')) throw new Error('Ya existe otro empleado con ese correo.');
    throw new Error('No se pudo actualizar el empleado.');
  }
  return { success: true };
}

export async function eliminarEmpleadoAdmin(empleadoId: string) {
  const session = await requireAdmin();
  await assertEmployeeScope(empleadoId, session);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('empleados').delete().eq('id', empleadoId);
  if (error) throw new Error('No se pudo eliminar el empleado.');
  return { success: true };
}

export async function crearUsuarioAdmin(datos: {
  nombre: string; email: string; rol: string; sucursalId: string;
}) {
  await requireAdmin(true);
  const nombre = normalizeName(datos.nombre);
  const email = normalizeEmail(datos.email);
  const rol = ['superadmin', 'administrativo', 'supervisor'].includes(datos.rol) ? datos.rol : 'administrativo';
  const sucursalId = datos.sucursalId && datos.sucursalId !== 'TODAS' ? Number(datos.sucursalId) : null;
  if (rol !== 'superadmin' && !sucursalId) throw new Error('Asigná una sucursal al operador.');
  const supabase = getSupabaseAdmin();
  const redirectTo = new URL('/auth/callback?next=/panel', process.env.NEXT_PUBLIC_SITE_URL || 'https://accesomovil.vercel.app').toString();
  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (inviteError || !invited.user) throw new Error('No se pudo enviar la invitación. Verificá si el correo ya tiene una cuenta.');
  const { error } = await supabase.from('usuarios_admin').insert({
    nombre, email, rol, sucursal_id: sucursalId, activo: true, auth_user_id: invited.user.id,
    pin_hash: 'DISABLED_BY_SUPABASE_AUTH',
  });
  if (error) {
    await supabase.auth.admin.deleteUser(invited.user.id);
    throw new Error('No se pudo vincular el operador a su cuenta.');
  }
  return { success: true };
}

export async function actualizarUsuarioAdmin(
  id: string,
  datos: { nombre: string; rol: string; sucursalId: string; activo: boolean }
) {
  await requireAdmin(true);
  const nombre = normalizeName(datos.nombre);
  const rol = ['superadmin', 'administrativo', 'supervisor'].includes(datos.rol) ? datos.rol : 'administrativo';
  const sucursalId = datos.sucursalId && datos.sucursalId !== 'TODAS' ? Number(datos.sucursalId) : null;
  if (rol !== 'superadmin' && !sucursalId) throw new Error('Asigná una sucursal al operador.');
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('usuarios_admin')
    .update({ nombre, rol, sucursal_id: sucursalId, activo: Boolean(datos.activo) }).eq('id', id);
  if (error) throw new Error('Error actualizando operador.');
  return { success: true };
}

export async function eliminarUsuarioAdmin(id: string) {
  await requireAdmin(true);
  const supabase = getSupabaseAdmin();
  const { data: row, error: readError } = await supabase.from('usuarios_admin')
    .select('auth_user_id').eq('id', id).maybeSingle();
  if (readError || !row) throw new Error('No se encontró el operador.');
  const { error } = await supabase.from('usuarios_admin').delete().eq('id', id);
  if (error) throw new Error('Error eliminando operador.');
  if (row.auth_user_id) await supabase.auth.admin.deleteUser(row.auth_user_id);
  return { success: true };
}

export async function crearSucursalAdmin(nombre: string) {
  await requireAdmin(true);
  const cleanName = normalizeName(nombre);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('sucursales').insert({ nombre: cleanName });
  if (error) throw new Error('No se pudo crear la sucursal.');
  return { success: true };
}

export async function generarCodigoSucursalAdmin(sucursalId: number, maxUsos = 30, diasValidez = 30) {
  const session = await requireAdmin();
  await assertBranchScope(Number(sucursalId), session);
  if (!sucursalId || !Number.isInteger(maxUsos) || maxUsos < 1 || maxUsos > 500 ||
      !Number.isInteger(diasValidez) || diasValidez < 1 || diasValidez > 90) {
    throw new Error('Parámetros de código inválidos.');
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const codigoPlano = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codigoPlano));
  const codigoHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(Date.now() + diasValidez * 86400000).toISOString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('codigos_alta_sucursal').insert({
    sucursal_id: Number(sucursalId), codigo_hash: codigoHash, expires_at: expiresAt,
    max_usos: maxUsos, usos: 0, activo: true,
  });
  if (error) throw new Error('No se pudo generar el código.');
  return { codigoPlano };
}

export async function resetearPasskeyEmpleado(empleadoId: string) {
  const session = await requireAdmin();
  await assertEmployeeScope(empleadoId, session);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('credenciales_biometricas').delete().eq('empleado_id', empleadoId);
  if (error) throw new Error('No se pudo resetear la Passkey.');
  return { success: true };
}

export async function registrarFichajeManualAdmin(
  empleadoId: string, tipo: 'entrada' | 'salida', fechaHoraLocal: string
) {
  const session = await requireAdmin();
  await assertEmployeeScope(empleadoId, session);
  if (tipo !== 'entrada' && tipo !== 'salida') throw new Error('Tipo de fichaje inválido.');
  const cleanFecha = String(fechaHoraLocal ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(cleanFecha)) throw new Error('Fecha/hora inválida.');
  const date = new Date(`${cleanFecha}:00-03:00`);
  if (Number.isNaN(date.getTime())) throw new Error('Fecha/hora inválida.');
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('fichajes').insert({
    empleado_id: empleadoId, tipo, hora_registro: date.toISOString(),
  });
  if (error) throw new Error('Error registrando fichaje manual.');
  return { success: true };
}

export async function regenerarKioskKeySucursalAdmin(sucursalId: number) {
  const session = await requireAdmin();
  await assertBranchScope(Number(sucursalId), session);
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nuevoToken = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('sucursales').update({ kiosk_key: nuevoToken }).eq('id', sucursalId);
  if (error) throw new Error('No se pudo regenerar la clave de terminal.');
  return { kioskKey: nuevoToken };
}
