# Migración de acceso administrativo a Supabase Auth

## Qué cambia

El panel deja de aceptar PIN maestro o PIN individual. El acceso se solicita mediante enlace de un solo uso enviado por Supabase Auth. Las operaciones del panel verifican la sesión con `auth.getUser()` en el servidor y consultan `usuarios_admin.auth_user_id` + `activo` para resolver rol y sucursal.

## Variables de entorno

Mantener:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)

Agregar:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: clave publicable/anon de Supabase.
- `NEXT_PUBLIC_SITE_URL`: URL canónica, por ejemplo `https://accesomovil.vercel.app`.

En Supabase Authentication:
1. Configurar SMTP de producción.
2. Agregar `https://accesomovil.vercel.app/auth/callback` a Redirect URLs.
3. Desactivar el registro público de usuarios si no se utiliza para otros flujos.
4. Configurar expiración corta y plantillas de correo adecuadas.

## Migración segura

1. Crear/invitar primero las cuentas de Auth para los administradores que deban conservar acceso.
2. Ejecutar `supabase_admin_auth_migration.sql`.
3. Verificar que cada usuario activo de `usuarios_admin` tenga `auth_user_id` y que corresponda al correo esperado.
4. Probar un superadmin y un usuario de sucursal en una ventana privada.
5. Recién después del período de validación, planificar la retirada de `pin_hash` y de las funciones antiguas.

La migración no borra `pin_hash`, no elimina usuarios y no altera datos de empleados ni fichajes.

## Alta de operadores

El alta de nuevos operadores debe realizarse desde el panel por un superadmin. Se envía una invitación de Auth y se crea el vínculo con el rol/sucursal asignados. No crear usuarios Auth manualmente sin registrar también su fila en `usuarios_admin`.

## Importante

Los usuarios sin `auth_user_id` no pueden entrar al panel nuevo. El PIN antiguo no se acepta como alternativa. Si se necesita recuperar una cuenta, hacerlo desde Supabase Auth y volver a verificar el vínculo.
