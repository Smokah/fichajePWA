import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase-server';

export interface AdminSession {
  id: string;
  authUserId: string;
  nombre: string;
  email: string;
  rol: 'superadmin' | 'administrativo' | 'supervisor';
  sucursal_id: number | null;
}

export async function requireAdmin(requiresSuperadmin = false): Promise<AdminSession> {
  const auth = await getSupabaseServer();
  const { data: { user }, error: authError } = await auth.auth.getUser();

  if (authError || !user) throw new Error('Tu sesión expiró. Volvé a ingresar.');

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('usuarios_admin')
    .select('id, auth_user_id, nombre, email, rol, sucursal_id, activo')
    .eq('auth_user_id', user.id)
    .eq('activo', true)
    .maybeSingle();

  if (error || !data) throw new Error('No tenés autorización administrativa activa.');

  const session: AdminSession = {
    id: data.id,
    authUserId: user.id,
    nombre: data.nombre,
    email: data.email,
    rol: data.rol,
    sucursal_id: data.sucursal_id,
  };

  if (session.rol !== 'superadmin' && !session.sucursal_id) {
    throw new Error('El usuario administrativo no tiene una sucursal asignada.');
  }
  if (requiresSuperadmin && session.rol !== 'superadmin') {
    throw new Error('Operación restringida a Superadmin.');
  }
  return session;
}

export async function assertEmployeeScope(employeeId: string, session: AdminSession) {
  if (session.rol === 'superadmin') return;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('empleados').select('id').eq('id', employeeId)
    .eq('sucursal_id', session.sucursal_id).maybeSingle();
  if (error || !data) throw new Error('El empleado no pertenece a tu sucursal.');
}

export async function assertBranchScope(branchId: number | null, session: AdminSession) {
  if (session.rol === 'superadmin') return;
  if (!branchId || branchId !== session.sucursal_id) {
    throw new Error('No tenés permisos para operar sobre esa sucursal.');
  }
}
