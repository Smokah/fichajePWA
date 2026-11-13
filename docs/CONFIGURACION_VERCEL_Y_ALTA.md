# Configuración de producción y alta biométrica

## 1. Variables de entorno en Vercel

Configurar en Project Settings > Environment Variables y aplicar un nuevo Deploy:

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: clave `service_role` / secret key del proyecto. Solo servidor; nunca usar prefijo `NEXT_PUBLIC_`.
- `WEBAUTHN_RP_ID`: `accesomovil.vercel.app`
- `WEBAUTHN_ORIGIN`: `https://accesomovil.vercel.app`

El código mantiene compatibilidad con `NEXT_PUBLIC_RP_ID` y `NEXT_PUBLIC_ORIGIN` como alternativas, pero se recomienda usar las variables `WEBAUTHN_*` privadas.

No colocar secretos en `NEXT_PUBLIC_*`, Git o archivos `.env` que se suban al repositorio.

## 2. Aplicar la migración

En Supabase > SQL Editor, ejecutar el archivo `supabase_webauthn_migration.sql` una sola vez.

La migración crea dos tablas nuevas (`webauthn_challenges` y `codigos_alta_webauthn`) y activa RLS en las tablas de credenciales y fichajes. La aplicación las administra desde el servidor mediante `SUPABASE_SERVICE_ROLE_KEY`.

## 3. Crear un código de vinculación para un empleado

Cada empleado debe recibir un código individual de 16 caracteres hexadecimales, válido por 24 horas y de un solo uso. En SQL Editor, reemplazar el correo del ejemplo y ejecutar esta consulta:

```sql
with nuevo_codigo as materialized (
  select
    e.id as empleado_id,
    encode(extensions.gen_random_bytes(8), 'hex') as codigo
  from public.empleados e
  where lower(e.email) = lower('empleado@empresa.com')
), guardado as (
  insert into public.codigos_alta_webauthn (empleado_id, codigo_hash, expires_at, used_at)
  select
    empleado_id,
    encode(extensions.digest(convert_to(codigo, 'UTF8'), 'sha256'), 'hex'),
    now() + interval '24 hours',
    null
  from nuevo_codigo
  on conflict (empleado_id) do update
    set codigo_hash = excluded.codigo_hash,
        expires_at = excluded.expires_at,
        used_at = null,
        created_at = now()
  returning empleado_id
)
select n.codigo
from nuevo_codigo n
join guardado g on g.empleado_id = n.empleado_id;
```

La consulta devuelve el código en claro una sola vez. Entregarlo al empleado por un canal privado. No compartir capturas del resultado ni guardarlo en una hoja pública. Si se pierde o vence, generar otro código: el anterior queda invalidado.

El empleado entra a `https://accesomovil.vercel.app/registro`, completa su correo y código, y registra la Passkey con el método de desbloqueo del dispositivo (huella, Face ID o PIN/patrón del sistema, según el equipo).

## 4. Fichar

El empleado entra a `https://accesomovil.vercel.app`, escribe el mismo correo y elige ENTRADA o SALIDA. La app solicita la Passkey registrada y guarda el fichaje con hora del servidor.

## 5. Consideraciones

- Las Passkeys existentes no se pueden recuperar si fueron creadas con una implementación incompatible o si no llegaron a guardarse correctamente. En ese caso, volver a vincular el dispositivo con un código nuevo.
- Para cada dominio de producción distinto hay que configurar un RP ID y un Origin coincidentes. No probar la Passkey de producción desde dominios Preview de Vercel.
- El proyecto no implementa todavía un panel administrativo para emitir códigos; la emisión se realiza desde SQL Editor como operación administrativa.
- El uso de service_role evita el bloqueo de RLS en las operaciones server-side, pero exige mantenerla secreta y no exponer las Server Actions a funciones administrativas adicionales sin controles.
