"use server";

import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeEmail, normalizeName, sha256Hex } from '@/lib/validators';

export interface AdminSession {
  id: string;
  nombre: string;
  email: string;
  rol: 'superadmin' | 'administrativo' | 'supervisor';
  sucursal_id: number | null;
}

export async function autenticarAdmin(identificador: string, pin: string): Promise<AdminSession> {
  const cleanPin = String(pin ?? '').trim();
  const cleanId = String(identificador ?? '').trim().toLowerCase();
  if (!cleanPin) throw new Error('Ingresá tu PIN de acceso.');

  const masterPin = (process.env.ADMIN_PIN || '1234').trim();
  if ((!cleanId || cleanId === 'admin' || cleanId === 'dueno') && cleanPin === masterPin) {
    return {
      id: 'master-owner',
      nombre: 'Dirección General',
      email: 'admin@sistema.local',
      rol: 'superadmin',
      sucursal_id: null,
    };
  }

  if (!cleanId) throw new Error('Ingresá tu correo corporativo o usá la clave maestra.');

  const supabase = getSupabaseAdmin();
  const pinHash = await sha256Hex(cleanPin);

  const { data: user, error } = await supabase
    .from('usuarios_admin')
    .select('id, nombre, email, rol, sucursal_id, activo, pin_hash')
    .eq('email', cleanId)
    .maybeSingle();

  if (error) throw new Error('Error verificando credenciales.');
  if (!user || !user.activo) throw new Error('Usuario inexistente o suspendido.');
  if (user.pin_hash !== pinHash) throw new Error('PIN incorrecto.');

  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol as AdminSession['rol'],
    sucursal_id: user.sucursal_id,
  };
}

async function verificarAutorizacion(credenciales: { identificador: string; pin: string }, requiereSuperadmin = false) {
  const session = await autenticarAdmin(credenciales.identificador, credenciales.pin);
  if (requiereSuperadmin && session.rol !== 'superadmin') {
    throw new Error('Operación restringida a Superadmin.');
  }
  return session;
}

export async function obtenerDatosAdministrativos(
  credenciales: { identificador: string; pin: string },
  filtros?: { fechaDesde?: string; fechaHasta?: string; sucursalId?: string }
) {
  const session = await verificarAutorizacion(credenciales);
  const supabase = getSupabaseAdmin();

  let queryFichajes = supabase
    .from('fichajes')
    .select('id, tipo, hora_registro, empleado_id, empleados(nombre, email, sucursal_id, sucursales(nombre))')
    .order('hora_registro', { ascending: false })
    .limit(1000);

  if (filtros?.fechaDesde) {
    queryFichajes = queryFichajes.gte('hora_registro', `${filtros.fechaDesde}T00:00:00.000Z`);
  }
  if (filtros?.fechaHasta) {
    queryFichajes = queryFichajes.lte('hora_registro', `${filtros.fechaHasta}T23:59:59.999Z`);
  }

  const [sucursalesRes, empleadosRes, fichajesRes, adminsRes] = await Promise.all([
    supabase.from('sucursales').select('id, nombre, qr_token').order('id', { ascending: true }),
    supabase
      .from('empleados')
      .select('id, nombre, email, sucursal_id, sucursales(nombre), credenciales_biometricas(id)')
      .order('nombre', { ascending: true }),
    queryFichajes,
    session.rol === 'superadmin'
      ? supabase
          .from('usuarios_admin')
          .select('id, nombre, email, rol, sucursal_id, activo, created_at, sucursales(nombre)')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (sucursalesRes.error) throw new Error(sucursalesRes.error.message);
  if (empleadosRes.error) throw new Error(empleadosRes.error.message);
  if (fichajesRes.error) throw new Error(fichajesRes.error.message);

  const sucursalForzada = session.sucursal_id ? String(session.sucursal_id) : filtros?.sucursalId;

  let fichajes = fichajesRes.data ?? [];
  let empleados = empleadosRes.data ?? [];

  if (sucursalForzada && sucursalForzada !== 'TODAS') {
    fichajes = fichajes.filter((f: any) => String(f.empleados?.sucursal_id) === sucursalForzada);
    empleados = empleados.filter((e: any) => String(e.sucursal_id) === sucursalForzada);
  }

  return {
    session,
    sucursales: sucursalesRes.data ?? [],
    empleados,
    fichajes,
    usuariosAdmin: adminsRes.data ?? [],
  };
}

// --- CRUD EMPLEADOS ---

export async function editarEmpleadoAdmin(
  credenciales: { identificador: string; pin: string },
  empleadoId: string,
  datos: { nombre: string; email: string; sucursalId: number | null }
) {
  await verificarAutorizacion(credenciales);
  const nombre = normalizeName(datos.nombre);
  const email = normalizeEmail(datos.email);
  const sucursalId = datos.sucursalId ? Number(datos.sucursalId) : null;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('empleados')
    .update({ nombre, email, sucursal_id: sucursalId })
    .eq('id', empleadoId);

  if (error) {
    if (error.message.includes('duplicate')) throw new Error('Ya existe otro empleado con ese correo.');
    throw new Error('No se pudo actualizar el empleado: ' + error.message);
  }
  return { success: true };
}

export async function eliminarEmpleadoAdmin(
  credenciales: { identificador: string; pin: string },
  empleadoId: string
) {
  await verificarAutorizacion(credenciales);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('empleados').delete().eq('id', empleadoId);
  if (error) throw new Error('No se pudo eliminar el empleado: ' + error.message);
  return { success: true };
}

// --- CRUD USUARIOS ADMINISTRATIVOS ---

export async function crearUsuarioAdmin(
  credenciales: { identificador: string; pin: string },
  datos: { nombre: string; email: string; pinNuevo: string; rol: string; sucursalId: string }
) {
  await verificarAutorizacion(credenciales, true);
  const nombre = normalizeName(datos.nombre);
  const email = normalizeEmail(datos.email);
  const pinNuevo = String(datos.pinNuevo ?? '').trim();

  if (!/^\d{4,8}$/.test(pinNuevo)) {
    throw new Error('El PIN debe tener entre 4 y 8 dígitos.');
  }

  const rolValido = ['superadmin', 'administrativo', 'supervisor'].includes(datos.rol)
    ? datos.rol
    : 'administrativo';

  const pinHash = await sha256Hex(pinNuevo);
  const sucursalId = datos.sucursalId && datos.sucursalId !== 'TODAS' ? Number(datos.sucursalId) : null;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('usuarios_admin').insert({
    nombre,
    email,
    pin_hash: pinHash,
    rol: rolValido,
    sucursal_id: sucursalId,
    activo: true,
  });

  if (error) {
    if (error.message.includes('duplicate')) throw new Error('Ya existe un usuario con ese correo.');
    throw new Error('Error creando usuario: ' + error.message);
  }
  return { success: true };
}

export async function actualizarUsuarioAdmin(
  credenciales: { identificador: string; pin: string },
  id: string,
  datos: { nombre: string; rol: string; sucursalId: string; activo: boolean; pinNuevo?: string }
) {
  await verificarAutorizacion(credenciales, true);
  const nombre = normalizeName(datos.nombre);
  const rolValido = ['superadmin', 'administrativo', 'supervisor'].includes(datos.rol)
    ? datos.rol
    : 'administrativo';
  const sucursalId = datos.sucursalId && datos.sucursalId !== 'TODAS' ? Number(datos.sucursalId) : null;

  const updatePayload: Record<string, unknown> = {
    nombre,
    rol: rolValido,
    sucursal_id: sucursalId,
    activo: Boolean(datos.activo),
  };

  if (datos.pinNuevo && datos.pinNuevo.trim()) {
    const cleanPin = datos.pinNuevo.trim();
    if (!/^\d{4,8}$/.test(cleanPin)) throw new Error('El nuevo PIN debe tener entre 4 y 8 dígitos.');
    updatePayload.pin_hash = await sha256Hex(cleanPin);
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('usuarios_admin').update(updatePayload).eq('id', id);
  if (error) throw new Error('Error actualizando usuario: ' + error.message);
  return { success: true };
}

export async function eliminarUsuarioAdmin(credenciales: { identificador: string; pin: string }, id: string) {
  await verificarAutorizacion(credenciales, true);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('usuarios_admin').delete().eq('id', id);
  if (error) throw new Error('Error eliminando usuario: ' + error.message);
  return { success: true };
}

// --- SUCURSALES, CÓDIGOS Y PASSKEYS ---

export async function crearSucursalAdmin(credenciales: { identificador: string; pin: string }, nombre: string) {
  await verificarAutorizacion(credenciales);
  const cleanName = normalizeName(nombre);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('sucursales').insert({ nombre: cleanName });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function generarCodigoSucursalAdmin(
  credenciales: { identificador: string; pin: string },
  sucursalId: number,
  maxUsos = 30,
  diasValidez = 30
) {
  await verificarAutorizacion(credenciales);
  if (!sucursalId) throw new Error('Seleccioná una sucursal.');

  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  const codigoPlano = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const codigoHash = await sha256Hex(codigoPlano);
  const expiresAt = new Date(Date.now() + diasValidez * 24 * 60 * 60 * 1000).toISOString();

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('codigos_alta_sucursal').insert({
    sucursal_id: Number(sucursalId),
    codigo_hash: codigoHash,
    expires_at: expiresAt,
    max_usos: Number(maxUsos) || 30,
    usos: 0,
    activo: true,
  });

  if (error) throw new Error(error.message);
  return { codigoPlano };
}

export async function resetearPasskeyEmpleado(credenciales: { identificador: string; pin: string }, empleadoId: string) {
  await verificarAutorizacion(credenciales);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('credenciales_biometricas').delete().eq('empleado_id', empleadoId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function registrarFichajeManualAdmin(
  credenciales: { identificador: string; pin: string },
  empleadoId: string,
  tipo: 'entrada' | 'salida',
  fechaHoraIso: string
) {
  await verificarAutorizacion(credenciales);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('fichajes').insert({
    empleado_id: empleadoId,
    tipo,
    hora_registro: new Date(fechaHoraIso).toISOString(),
  });
  if (error) throw new Error('Error registrando fichaje manual: ' + error.message);
  return { success: true };
}

export async function regenerarQrSucursalAdmin(
  credenciales: { identificador: string; pin: string },
  sucursalId: number
) {
  await verificarAutorizacion(credenciales);
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);
  const nuevoToken = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('sucursales')
    .update({ qr_token: nuevoToken })
    .eq('id', sucursalId);

  if (error) throw new Error('No se pudo regenerar el QR: ' + error.message);
  return { qrToken: nuevoToken };
}
