-- ============================================================================
-- ESQUEMA CON FICHAJE POR QR DE SUCURSAL + BIOMETRÍA ÚNICA
-- Ejecutar en Supabase > SQL Editor
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- 1. Sucursales con token QR único por sede
create table if not exists public.sucursales (
  id serial primary key,
  nombre text not null,
  qr_token text unique default encode(extensions.gen_random_bytes(12), 'hex')
);

alter table public.sucursales add column if not exists qr_token text;
update public.sucursales
set qr_token = encode(extensions.gen_random_bytes(12), 'hex')
where qr_token is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sucursales_qr_token_key'
  ) then
    alter table public.sucursales add constraint sucursales_qr_token_key unique (qr_token);
  end if;
exception when others then null;
end $$;

-- 2. Empleados
create table if not exists public.empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text unique,
  sucursal_id integer references public.sucursales(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.empleados alter column id set default gen_random_uuid();
alter table public.empleados add column if not exists email text;
alter table public.empleados add column if not exists created_at timestamptz not null default now();

-- 3. Credenciales Biométricas (WebAuthn)
create table if not exists public.credenciales_biometricas (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Fichajes (ahora registra también en qué sucursal escaneó el QR!)
create table if not exists public.fichajes (
  id serial primary key,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  sucursal_id integer references public.sucursales(id) on delete set null,
  tipo text not null,
  hora_registro timestamptz not null default now()
);

alter table public.fichajes add column if not exists sucursal_id integer references public.sucursales(id) on delete set null;

do $$
declare
  r record;
begin
  for r in (
    select conname from pg_constraint
    where conrelid = 'public.fichajes'::regclass and contype = 'c'
  ) loop
    execute 'alter table public.fichajes drop constraint ' || quote_ident(r.conname);
  end loop;
end $$;

alter table public.fichajes
  add constraint fichajes_tipo_check check (lower(tipo) in ('entrada', 'salida'));

-- 5. Challenges WebAuthn
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

-- 6. Códigos de Alta por Sucursal
create table if not exists public.codigos_alta_sucursal (
  id uuid primary key default gen_random_uuid(),
  sucursal_id integer not null references public.sucursales(id) on delete cascade,
  codigo_hash text not null unique,
  expires_at timestamptz not null,
  max_usos integer not null default 30 check (max_usos > 0),
  usos integer not null default 0 check (usos >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint codigos_alta_sucursal_usos_limite check (usos <= max_usos)
);

-- 7. Usuarios Administrativos
create table if not exists public.usuarios_admin (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  pin_hash text not null,
  rol text not null default 'operador' check (rol in ('superadmin', 'administrativo', 'supervisor')),
  sucursal_id integer references public.sucursales(id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- 8. RPC transaccional de alta única
create or replace function public.registrar_empleado_con_codigo_sucursal(
  p_nombre text,
  p_email text,
  p_codigo_hash text
)
returns table(id uuid, nombre text, sucursal_id integer)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_nombre text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_email text := lower(trim(coalesce(p_email, '')));
  v_codigo public.codigos_alta_sucursal%rowtype;
  v_empleado public.empleados%rowtype;
  v_count integer;
begin
  if length(v_nombre) < 2 or length(v_nombre) > 120 then
    raise exception using message = 'NOMBRE_INVALIDO';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using message = 'EMAIL_INVALIDO';
  end if;
  if coalesce(p_codigo_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception using message = 'CODIGO_SUCURSAL_INVALIDO';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));

  select * into v_codigo
  from public.codigos_alta_sucursal c
  where c.codigo_hash = lower(p_codigo_hash)
  for update;

  if not found or v_codigo.activo is not true or v_codigo.expires_at <= now() then
    raise exception using message = 'CODIGO_SUCURSAL_INVALIDO';
  end if;

  select count(*) into v_count
  from public.empleados e
  where lower(trim(e.email)) = v_email;

  if v_count > 1 then
    raise exception using message = 'EMAIL_DUPLICADO';
  elsif v_count = 1 then
    select * into v_empleado
    from public.empleados e
    where lower(trim(e.email)) = v_email
    limit 1;

    if v_empleado.sucursal_id is distinct from v_codigo.sucursal_id then
      raise exception using message = 'EMAIL_OTRA_SUCURSAL';
    end if;

    update public.empleados e set email = v_email where e.id = v_empleado.id
    returning * into v_empleado;

    return query select v_empleado.id, v_empleado.nombre, v_empleado.sucursal_id;
    return;
  end if;

  if v_codigo.usos >= v_codigo.max_usos then
    raise exception using message = 'CODIGO_SUCURSAL_SIN_CUPOS';
  end if;

  insert into public.empleados (nombre, email, sucursal_id)
  values (v_nombre, v_email, v_codigo.sucursal_id)
  returning * into v_empleado;

  update public.codigos_alta_sucursal c
  set usos = c.usos + 1
  where c.id = v_codigo.id;

  return query select v_empleado.id, v_empleado.nombre, v_empleado.sucursal_id;
end;
$$;

revoke all on function public.registrar_empleado_con_codigo_sucursal(text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_empleado_con_codigo_sucursal(text, text, text) to service_role;

-- 9. RLS y Permisos
alter table public.sucursales enable row level security;
alter table public.empleados enable row level security;
alter table public.webauthn_challenges enable row level security;
alter table public.codigos_alta_sucursal enable row level security;
alter table public.credenciales_biometricas enable row level security;
alter table public.fichajes enable row level security;
alter table public.usuarios_admin enable row level security;

revoke all on table public.sucursales from anon, authenticated;
revoke all on table public.empleados from anon, authenticated;
revoke all on table public.webauthn_challenges from anon, authenticated;
revoke all on table public.codigos_alta_sucursal from anon, authenticated;
revoke all on table public.credenciales_biometricas from anon, authenticated;
revoke all on table public.fichajes from anon, authenticated;
revoke all on table public.usuarios_admin from anon, authenticated;

grant all on table public.sucursales to service_role;
grant all on table public.empleados to service_role;
grant all on table public.webauthn_challenges to service_role;
grant all on table public.codigos_alta_sucursal to service_role;
grant all on table public.credenciales_biometricas to service_role;
grant all on table public.fichajes to service_role;
grant all on table public.usuarios_admin to service_role;
grant usage, select on all sequences in schema public to service_role;

insert into public.sucursales (nombre)
select 'Sucursal Central'
where not exists (select 1 from public.sucursales);

notify pgrst, 'reload schema';
