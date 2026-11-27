# Alta de empleados por código de sucursal + Passkeys (WebAuthn)

## 1. Variables de entorno en Vercel

En Project Settings > Environment Variables configurar:

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: clave publicable/anon de Supabase para las sesiones Auth.
- `NEXT_PUBLIC_SITE_URL`: URL canónica de producción, por ejemplo `https://accesomovil.vercel.app`.
- `SUPABASE_SERVICE_ROLE_KEY`: clave `service_role` / secret key de Supabase. Es exclusivamente de servidor; nunca debe llevar prefijo `NEXT_PUBLIC_`.
- `WEBAUTHN_RP_ID`: `accesomovil.vercel.app`
- `WEBAUTHN_ORIGIN`: `https://accesomovil.vercel.app`

Después de modificar variables, realizar un nuevo Deploy. No colocar secretos en Git ni en archivos `.env` subidos al repositorio.

## 2. Aplicar el SQL

En Supabase > SQL Editor ejecutar una sola vez el archivo `supabase_webauthn_migration.sql` incluido en el proyecto.

La migración crea:

- `webauthn_challenges`: desafíos WebAuthn de corta duración y un solo uso.
- `codigos_alta_sucursal`: códigos de alta con sucursal, vencimiento, límite de usos y revocación.
- `registrar_empleado_con_codigo_sucursal(...)`: función transaccional que valida el código, crea el empleado y descuenta un uso.

La migración también activa RLS y restringe las operaciones al servidor. No agregues políticas públicas para estas tablas.

**Estructura esperada:** `sucursales(id integer, nombre text)` y `empleados(id uuid, nombre text, sucursal_id integer, email text)`. `empleados.id` debe tener un default UUID, por ejemplo `gen_random_uuid()`. `empleados.email` debe admitir valores y ser único según el esquema existente.

## 3. Emitir un código para una sucursal

Desde Supabase > SQL Editor ejecutar esta consulta. Reemplazar `1` por el `id` real de la sucursal y ajustar cantidad/duración si corresponde:

```sql
with nuevo_codigo as materialized (
  select
    1::integer as sucursal_id,              -- REEMPLAZAR por sucursales.id
    30::integer as max_usos,                -- máximo de altas nuevas
    now() + interval '30 days' as vence,    -- vencimiento
    encode(extensions.gen_random_bytes(8), 'hex') as codigo
), guardado as (
  insert into public.codigos_alta_sucursal
    (sucursal_id, codigo_hash, expires_at, max_usos, usos, activo)
  select
    sucursal_id,
    encode(extensions.digest(convert_to(codigo, 'UTF8'), 'sha256'), 'hex'),
    vence,
    max_usos,
    0,
    true
  from nuevo_codigo
  returning id
)
select n.codigo as codigo_para_entregar, n.sucursal_id, n.max_usos, n.vence
from nuevo_codigo n cross join guardado;
```

La consulta muestra el código en claro una sola vez. Entregarlo por un canal privado a las personas que deban registrarse. No compartir capturas ni guardar el código en documentos públicos. En la base queda guardado únicamente el hash SHA-256.

Cada código tiene por defecto 30 altas nuevas y vence a los 30 días. Se puede emitir más de un código por sucursal.

### Revocar un código

Copiar el `id` del registro (no el código secreto) y ejecutar:

```sql
update public.codigos_alta_sucursal
set activo = false
where id = 'UUID-DEL-CODIGO';
```

### Consultar estado y usos

```sql
select id, sucursal_id, expires_at, max_usos, usos, activo, created_at
from public.codigos_alta_sucursal
order by created_at desc;
```

No es posible recuperar el código original desde la base porque se almacena como hash. Para reemplazarlo, emitir uno nuevo.

## 4. Alta del empleado

El empleado abre `https://accesomovil.vercel.app/registro` y completa:

1. Nombre y apellido.
2. Correo electrónico.
3. Código de su sucursal.

El servidor valida el código y crea el empleado en la sucursal asociada. Luego el navegador solicita registrar una Passkey con huella, Face ID o el PIN/patrón del dispositivo. Al finalizar, el empleado ya puede fichar.

Si el alta del empleado se creó pero el registro biométrico se interrumpió, puede reintentar con el mismo código mientras siga activo y vigente: no se descuenta otro cupo para ese mismo correo/sucursal. Si el correo ya pertenece a otra sucursal, se rechaza el alta.

La implementación permite una Passkey por empleado. Para cambiar de dispositivo o recuperar el acceso, se necesita un procedimiento administrativo seguro para revincularlo; no se debe permitir que cualquier persona con el código compartido reemplace una Passkey existente.

## 5. Fichar

El empleado abre `https://accesomovil.vercel.app`, ingresa el mismo correo y selecciona ENTRADA o SALIDA. La aplicación solicita la Passkey y guarda el fichaje con hora del servidor.

## 6. Seguridad y límites del código compartido

El código de sucursal demuestra que la persona conoce el código, pero **no verifica por sí solo la identidad de la persona ni que sea titular del correo ingresado**. Si necesitás validar la titularidad del email, agregá una verificación OTP por correo o aprobación administrativa antes de habilitar el fichaje.

No exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente. No probar Passkeys de producción desde dominios Preview de Vercel: WebAuthn requiere que RP ID y Origin coincidan con el dominio autorizado.

## 7. Acceso administrativo con Supabase Auth

La nueva rama incorpora acceso al panel por enlace seguro de correo. Antes de desplegar, seguir todos los pasos de `docs/ADMIN_SUPABASE_AUTH.md`: configurar SMTP y Redirect URLs, crear/vincular las cuentas Auth existentes y ejecutar `supabase_admin_auth_migration.sql`. No retirar todavía `pin_hash` ni las credenciales heredadas hasta validar todas las cuentas.
