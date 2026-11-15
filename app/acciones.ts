"use server";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { getSupabaseAdmin } from '../lib/supabase';

const RP_NAME = 'Fichajes PWA';
const CHALLENGE_TTL_MINUTES = 5;

type ChallengePurpose = 'registration' | 'authentication';

type ActionResult = { success: true } | { success: false; error: string };

function getWebAuthnConfig() {
  const rpID = (
    process.env.WEBAUTHN_RP_ID ||
    process.env.NEXT_PUBLIC_RP_ID ||
    'accesomovil.vercel.app'
  ).trim().toLowerCase();

  const configuredOrigin = (
    process.env.WEBAUTHN_ORIGIN ||
    process.env.NEXT_PUBLIC_ORIGIN ||
    `https://${rpID}`
  ).trim();

  let originUrl: URL;
  try {
    originUrl = new URL(configuredOrigin);
  } catch {
    throw new Error('WEBAUTHN_ORIGIN no es una URL válida.');
  }

  if (originUrl.protocol !== 'https:' && originUrl.hostname !== 'localhost') {
    throw new Error('WebAuthn requiere HTTPS en producción.');
  }

  if (originUrl.hostname.toLowerCase() !== rpID) {
    throw new Error(
      `Configuración WebAuthn inconsistente: el host de ORIGIN (${originUrl.hostname}) debe coincidir con RP_ID (${rpID}).`,
    );
  }

  return { rpID, origin: originUrl.origin };
}

function normalizeEmail(email: string): string {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized || normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Ingresá un correo electrónico válido.');
  }
  return normalized;
}

function normalizeBranchCode(code: string): string {
  const normalized = String(code ?? '').trim().toLowerCase();
  if (!/^[a-f0-9]{16}$/.test(normalized)) {
    throw new Error('El código de sucursal debe tener 16 caracteres hexadecimales.');
  }
  return normalized;
}

function normalizeName(name: string): string {
  const normalized = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 120) {
    throw new Error('Ingresá tu nombre y apellido (entre 2 y 120 caracteres).');
  }
  return normalized;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getEmpleado(email: string) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from('empleados')
    .select('id, nombre, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error('Error consultando empleado:', error);
    throw new Error('No se pudo consultar el empleado. Revisá la configuración de Supabase.');
  }
  if (!data) throw new Error('El correo no está registrado en la tabla empleados.');
  return data;
}

async function guardarChallenge(args: {
  empleadoId: string;
  purpose: ChallengePurpose;
  challenge: string;
}): Promise<string> {
  const supabase = getSupabaseAdmin();
  const challengeId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MINUTES * 60_000).toISOString();

  // Limpieza oportunista de challenges vencidos para que la tabla no crezca indefinidamente.
  const { error: cleanupError } = await supabase
    .from('webauthn_challenges')
    .delete()
    .lt('expires_at', now.toISOString());
  if (cleanupError) console.error('No se pudieron limpiar challenges vencidos:', cleanupError);

  const { error } = await supabase.from('webauthn_challenges').insert({
    id: challengeId,
    employee_id: args.empleadoId,
    purpose: args.purpose,
    challenge: args.challenge,
    expires_at: expiresAt,
  });

  if (error) {
    console.error('Error guardando challenge WebAuthn:', error);
    throw new Error('No se pudo iniciar la operación WebAuthn. Aplicá la migración SQL incluida en el ZIP.');
  }

  return challengeId;
}

/** Consume el challenge de forma atómica: no puede reutilizarse ni usarse para otro empleado/operación. */
async function consumirChallenge(
  challengeId: string,
  empleadoId: string,
  purpose: ChallengePurpose,
): Promise<{ challenge: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(String(challengeId ?? ''))) {
    throw new Error('La operación expiró o no es válida. Volvé a intentarlo.');
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('webauthn_challenges')
    .update({ consumed_at: now })
    .eq('id', challengeId)
    .eq('employee_id', empleadoId)
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('challenge')
    .maybeSingle();

  if (error) {
    console.error('Error consumiendo challenge WebAuthn:', error);
    throw new Error('No se pudo validar la operación. Revisá la migración SQL de WebAuthn.');
  }
  if (!data) throw new Error('El challenge venció o ya fue utilizado. Volvé a intentarlo.');
  return data;
}

/**
 * Alta pública controlada: el código identifica la sucursal; el RPC crea el empleado
 * atómicamente y consume un cupo. Si el empleado ya fue creado en esa sucursal y
 * el alta biométrica quedó interrumpida, el RPC permite reintentar sin consumir otro cupo.
 */
export async function iniciarAltaEmpleado(nombre: string, email: string, branchCode: string) {
  const normalizedName = normalizeName(nombre);
  const normalizedEmail = normalizeEmail(email);
  const code = normalizeBranchCode(branchCode);
  const codeHash = await sha256Hex(code);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc('registrar_empleado_con_codigo_sucursal', {
    p_nombre: normalizedName,
    p_email: normalizedEmail,
    p_codigo_hash: codeHash,
  });

  if (error) {
    console.error('Error validando código de sucursal / creando empleado:', error);
    const message = String(error.message ?? '');
    if (message.includes('CODIGO_SUCURSAL_INVALIDO')) {
      throw new Error('El código de sucursal es incorrecto, está vencido o fue revocado.');
    }
    if (message.includes('CODIGO_SUCURSAL_SIN_CUPOS')) {
      throw new Error('El código de esta sucursal alcanzó el máximo de altas permitido.');
    }
    if (message.includes('EMAIL_OTRA_SUCURSAL')) {
      throw new Error('Este correo ya está registrado en otra sucursal.');
    }
    if (message.includes('EMAIL_DUPLICADO')) {
      throw new Error('Hay más de un empleado con ese correo. Contactá al administrador.');
    }
    console.error('Detalle RPC alta:', error.details, error.hint, error.code);
    throw new Error('No se pudo completar el alta. Verificá que hayas aplicado la migración SQL nueva.');
  }

  const empleado = Array.isArray(data) ? data[0] : data;
  if (!empleado?.id || !empleado?.nombre) {
    throw new Error('Supabase no devolvió los datos del empleado creado.');
  }

  const { data: existingCredentials, error: credentialsError } = await supabase
    .from('credenciales_biometricas')
    .select('credential_id')
    .eq('empleado_id', empleado.id);

  if (credentialsError) {
    console.error('Error consultando credenciales existentes:', credentialsError);
    throw new Error('No se pudieron consultar las Passkeys existentes.');
  }
  if (existingCredentials && existingCredentials.length > 0) {
    throw new Error('Este empleado ya tiene una Passkey registrada. Para cambiar de dispositivo, solicitá asistencia al administrador.');
  }

  const { rpID } = getWebAuthnConfig();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new Uint8Array(Buffer.from(empleado.id, 'utf8')),
    userName: normalizedEmail,
    userDisplayName: empleado.nombre || normalizedEmail,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  const challengeId = await guardarChallenge({
    empleadoId: empleado.id,
    purpose: 'registration',
    challenge: options.challenge,
  });

  return { options, challengeId, empleadoNombre: empleado.nombre };
}

export async function verificarRegistro(
  email: string,
  response: unknown,
  challengeId: string,
): Promise<ActionResult> {
  try {
    const empleado = await getEmpleado(email);
    const pending = await consumirChallenge(challengeId, empleado.id, 'registration');


    const { rpID, origin } = getWebAuthnConfig();
    const verification = await verifyRegistrationResponse({
      response: response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return { success: false, error: 'El autenticador no pudo verificarse. Intentá nuevamente.' };
    }


    const { credential } = verification.registrationInfo;
    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase.from('credenciales_biometricas').insert({
      empleado_id: empleado.id,
      credential_id: credential.id,
      public_key: JSON.stringify(Array.from(credential.publicKey)),
      counter: credential.counter,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('Error guardando credencial biométrica:', insertError);
      return { success: false, error: 'La verificación fue correcta, pero no se pudo guardar la Passkey. Solicitá un nuevo código al administrador.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Fallo en verificarRegistro:', error);
    return { success: false, error: error instanceof Error ? error.message : 'No se pudo completar el registro biométrico.' };
  }
}

export async function generarOpcionesAutenticacion(email: string) {
  const empleado = await getEmpleado(email);
  const supabase = getSupabaseAdmin();
  const { data: credentials, error } = await supabase
    .from('credenciales_biometricas')
    .select('credential_id')
    .eq('empleado_id', empleado.id);

  if (error) {
    console.error('Error consultando credenciales para fichar:', error);
    throw new Error('No se pudieron consultar tus Passkeys.');
  }
  if (!credentials || credentials.length === 0) {
    throw new Error('Este empleado todavía no tiene un celular vinculado. Primero debe registrarlo.');
  }

  const { rpID } = getWebAuthnConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: credentials.map((credential) => ({
      id: credential.credential_id,
    })),
  });

  const challengeId = await guardarChallenge({
    empleadoId: empleado.id,
    purpose: 'authentication',
    challenge: options.challenge,
  });

  return { options, challengeId };
}

export async function verificarAutenticacion(
  email: string,
  response: unknown,
  challengeId: string,
  tipoFichaje: string,
): Promise<ActionResult> {
  try {
    const empleado = await getEmpleado(email);
    const responseId = (response as { id?: unknown } | null)?.id;
    if (typeof responseId !== 'string' || !responseId) {
      throw new Error('La respuesta del autenticador no contiene un identificador válido.');
    }

    const supabase = getSupabaseAdmin();
    // La búsqueda está limitada al empleado: una Passkey ajena nunca puede fichar por otra persona.
    const { data: credentialRow, error: credentialError } = await supabase
      .from('credenciales_biometricas')
      .select('credential_id, public_key, counter')
      .eq('credential_id', responseId)
      .eq('empleado_id', empleado.id)
      .maybeSingle();

    if (credentialError) {
      console.error('Error consultando la credencial:', credentialError);
      throw new Error('No se pudo consultar la credencial biométrica.');
    }
    if (!credentialRow) throw new Error('Esta Passkey no está vinculada a este empleado.');

    const pending = await consumirChallenge(challengeId, empleado.id, 'authentication');
    const { rpID, origin } = getWebAuthnConfig();
    let publicKeyBytes: number[];
    try {
      publicKeyBytes = JSON.parse(credentialRow.public_key);
    } catch {
      throw new Error('La clave pública guardada está dañada. Hay que volver a vincular este dispositivo.');
    }
    if (!Array.isArray(publicKeyBytes) || publicKeyBytes.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
      throw new Error('La clave pública guardada tiene un formato inválido.');
    }

    const verification = await verifyAuthenticationResponse({
      response: response as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: credentialRow.credential_id,
        publicKey: new Uint8Array(publicKeyBytes),
        counter: Number(credentialRow.counter ?? 0),
      },
    });

    if (!verification.verified) {
      return { success: false, error: 'La firma biométrica no pudo verificarse.' };
    }

    const tipo = String(tipoFichaje ?? '').trim().toLowerCase();
    if (tipo !== 'entrada' && tipo !== 'salida') {
      throw new Error('Tipo de fichaje inválido.');
    }

    const { error: counterError } = await supabase
      .from('credenciales_biometricas')
      .update({ counter: verification.authenticationInfo.newCounter })
      .eq('credential_id', credentialRow.credential_id)
      .eq('empleado_id', empleado.id);

    if (counterError) {
      console.error('Error actualizando contador WebAuthn:', counterError);
      throw new Error('La autenticación fue correcta, pero no se pudo actualizar la credencial.');
    }

    const { error: fichajeError } = await supabase.from('fichajes').insert({
      empleado_id: empleado.id,
      tipo,
      hora_registro: new Date().toISOString(),
    });

    if (fichajeError) {
      console.error('Error guardando fichaje:', fichajeError);
      throw new Error('La identidad fue verificada, pero no se pudo guardar el fichaje.');
    }

    return { success: true };
  } catch (error) {
    console.error('Fallo en verificarAutenticacion:', error);
    return { success: false, error: error instanceof Error ? error.message : 'No se pudo completar el fichaje.' };
  }
}
