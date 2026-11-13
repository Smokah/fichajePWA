-- Migración requerida para el flujo WebAuthn corregido.
-- Ejecutar una sola vez en Supabase > SQL Editor.

create extension if not exists pgcrypto with schema extensions;

-- Challenges de corta duración, vinculados a empleado y operación, consumibles una sola vez.
create table if not exists public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.empleados(id) on delete cascade,
  purpose text not null check (purpose in ('registration', 'authentication')),
  challenge text not null,
  enrollment_code_hash text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists webauthn_challenges_expiration_idx
  on public.webauthn_challenges (expires_at);
create index if not exists webauthn_challenges_employee_purpose_idx
  on public.webauthn_challenges (employee_id, purpose);

-- Códigos de vinculación de un solo uso. Solo se guarda el hash SHA-256.
create table if not exists public.codigos_alta_webauthn (
  empleado_id uuid primary key references public.empleados(id) on delete cascade,
  codigo_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Las operaciones de la aplicación pasan por Server Actions con service_role.
-- Las tablas no deben ser accesibles desde el navegador con anon/authenticated.
alter table public.webauthn_challenges enable row level security;
alter table public.codigos_alta_webauthn enable row level security;
alter table public.credenciales_biometricas enable row level security;
alter table public.fichajes enable row level security;

revoke all on table public.webauthn_challenges from anon, authenticated;
revoke all on table public.codigos_alta_webauthn from anon, authenticated;
revoke all on table public.credenciales_biometricas from anon, authenticated;
revoke all on table public.fichajes from anon, authenticated;

-- Los Server Actions usan exclusivamente SUPABASE_SERVICE_ROLE_KEY.
grant all on table public.webauthn_challenges to service_role;
grant all on table public.codigos_alta_webauthn to service_role;
grant all on table public.credenciales_biometricas to service_role;
grant all on table public.fichajes to service_role;
grant usage, select on sequence public.fichajes_id_seq to service_role;

-- empleados ya tiene RLS activado y no necesita una política pública.
-- No se desactiva RLS ni se abre lectura de datos personales.
