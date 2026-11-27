-- Migración incremental: vincula usuarios administrativos existentes con Supabase Auth.
-- No elimina pin_hash ni modifica fichajes/empleados/credenciales.
-- Ejecutar en Supabase SQL Editor después de crear las cuentas Auth correspondientes.

alter table public.usuarios_admin
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists usuarios_admin_auth_user_id_uidx
  on public.usuarios_admin(auth_user_id)
  where auth_user_id is not null;

-- Vinculación automática solo cuando el correo coincide exactamente (ignorando mayúsculas).
update public.usuarios_admin ua
set auth_user_id = au.id
from auth.users au
where lower(ua.email) = lower(au.email)
  and ua.auth_user_id is null;

-- Los administradores sin auth_user_id quedan sin acceso a la nueva aplicación.
-- No se borran ni se desactivan para permitir migración y recuperación controladas.
