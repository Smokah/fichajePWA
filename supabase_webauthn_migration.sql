-- Migración para PWA de fichajes: WebAuthn + alta automática por código de sucursal.
-- Ejecutar una sola vez en Supabase > SQL Editor.

create extension if not exists pgcrypto with schema extensions;

-- Challenges de corta duración, vinculados a empleado y operación, consumibles una sola vez.
create table if not exists public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.empleados(id) on delete cascade,
  purpose text not null check (purpose in ('registration', 'authentication')),
  challenge text not null,
  -- Se conserva por compatibilidad con la migración anterior; el nuevo flujo no lo utiliza.
  enrollment_code_hash text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists webauthn_challenges_expiration_idx
  on public.webauthn_challenges (expires_at);
create index if not exists webauthn_challenges_employee_purpose_idx
  on public.webauthn_challenges (employee_id, purpose);

-- Códigos reutilizables de sucursal, limitados por cantidad, vencimiento y revocación.
-- Nunca se almacena el código en claro: solo SHA-256.
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

create index if not exists codigos_alta_sucursal_sucursal_idx
  on public.codigos_alta_sucursal (sucursal_id);

-- Tabla heredada: queda disponible para compatibilidad, pero el alta nueva no la utiliza.
create table if not exists public.codigos_alta_webauthn (
  empleado_id uuid primary key references public.empleados(id) on delete cascade,
  codigo_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Alta transaccional: valida el código, evita duplicar correos y consume un cupo solo al crear.
-- El bloqueo por correo evita dos altas simultáneas del mismo correo usando códigos distintos.
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

    -- Normaliza también registros históricos que pudieran tener el correo en mayúsculas.
    update public.empleados e set email = v_email where e.id = v_empleado.id
    returning * into v_empleado;

    -- Reintento idempotente: si se creó el empleado pero se interrumpió WebAuthn,
    -- se devuelve el mismo registro sin consumir otro uso del código.
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

-- Solo el servidor con SUPABASE_SERVICE_ROLE_KEY puede ejecutar el alta.
revoke all on function public.registrar_empleado_con_codigo_sucursal(text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_empleado_con_codigo_sucursal(text, text, text) to service_role;

-- RLS y permisos: las operaciones pasan exclusivamente por Server Actions server-side.
alter table public.webauthn_challenges enable row level security;
alter table public.codigos_alta_sucursal enable row level security;
alter table public.codigos_alta_webauthn enable row level security;
alter table public.credenciales_biometricas enable row level security;
alter table public.fichajes enable row level security;

revoke all on table public.webauthn_challenges from anon, authenticated;
revoke all on table public.codigos_alta_sucursal from anon, authenticated;
revoke all on table public.codigos_alta_webauthn from anon, authenticated;
revoke all on table public.credenciales_biometricas from anon, authenticated;
revoke all on table public.fichajes from anon, authenticated;

grant all on table public.webauthn_challenges to service_role;
grant all on table public.codigos_alta_sucursal to service_role;
grant all on table public.codigos_alta_webauthn to service_role;
grant all on table public.credenciales_biometricas to service_role;
grant all on table public.fichajes to service_role;
grant usage, select on sequence public.fichajes_id_seq to service_role;

-- empleados mantiene RLS activado y sin políticas públicas.
-- La service_role puede operar desde el servidor sin exponer la clave al navegador.
