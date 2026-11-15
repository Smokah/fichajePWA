"use server";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeBranchCode, normalizeEmail, normalizeName, sha256Hex } from '@/lib/validators';
import { CHALLENGE_TTL_MINUTES, RP_NAME, getWebAuthnConfig } from '@/lib/webauthn-config';

type ChallengePurpose = 'registration' | 'authentication';
type ActionResult = { success: true } | { success: false; error: string };

async function getEmpleado(email: string) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from('empleados')
    .select('id, nombre, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) throw new Error('No se pudo consultar el empleado.');
  if (!data) throw new Error('El correo no está registrado. Registrate primero en /registro.');
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

  await supabase.from('webauthn_challenges').delete().lt('expires_at', now.toISOString());

  const { error } = await supabase.from('webauthn_challenges').insert({
    id: challengeId,
    employee_id: args.empleadoId,
    purpose: args.purpose,
    challenge: args.challenge,
    expires_at: expiresAt,
  });

  if (error) throw new Error('No se pudo iniciar la operación biométrica.');
  return challengeId;
}

async function consumirChallenge(
  challengeId: string,
  empleadoId: string,
  purpose: ChallengePurpose,
): Promise<{ challenge: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(String(challengeId ?? ''))) {
    throw new Error('La operación expiró o no es válida.');
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

  if (error || !data) throw new Error('El desafío venció o ya fue utilizado. Volvé a intentarlo.');
  return data;
}

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
    const msg = String(error.message ?? '');
    if (msg.includes('CODIGO_SUCURSAL_INVALIDO')) throw new Error('Código de sucursal incorrecto, vencido o revocado.');
    if (msg.includes('CODIGO_SUCURSAL_SIN_CUPOS')) throw new Error('El código alcanzó el máximo de altas permitido.');
    if (msg.includes('EMAIL_OTRA_SUCURSAL')) throw new Error('Este correo ya está registrado en otra sucursal.');
    if (msg.includes('EMAIL_DUPLICADO')) throw new Error('Correo duplicado. Contactá al administrador.');
    throw new Error('No se pudo completar el alta.');
  }

  const empleado = Array.isArray(data) ? data[0] : data;
  if (!empleado?.id || !empleado?.nombre) throw new Error('Error al crear el registro del empleado.');

  const { data: existingCredentials } = await supabase
    .from('credenciales_biometricas')
    .select('credential_id')
    .eq('empleado_id', empleado.id);

  if (existingCredentials && existingCredentials.length > 0) {
    throw new Error('Este empleado ya tiene un celular vinculado. Solicitá resetearlo al administrador.');
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
      authenticatorAttachment: 'platform',
      residentKey: 'discouraged',
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
      return { success: false, error: 'El sensor biométrico no pudo verificarse.' };
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

    if (insertError) return { success: false, error: 'No se pudo guardar la credencial biométrica.' };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error en registro biométrico.' };
  }
}

export async function generarOpcionesAutenticacion(email: string) {
  const empleado = await getEmpleado(email);
  const supabase = getSupabaseAdmin();
  const { data: credentials, error } = await supabase
    .from('credenciales_biometricas')
    .select('credential_id')
    .eq('empleado_id', empleado.id);

  if (error) throw new Error('Error consultando credenciales.');
  if (!credentials || credentials.length === 0) {
    throw new Error('Este empleado aún no vinculó su celular. Hacelo primero en /registro.');
  }

  const { rpID } = getWebAuthnConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: credentials.map((c) => ({ id: c.credential_id })),
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
      throw new Error('Identificador biométrico inválido.');
    }

    const supabase = getSupabaseAdmin();
    const { data: credentialRow } = await supabase
      .from('credenciales_biometricas')
      .select('credential_id, public_key, counter')
      .eq('credential_id', responseId)
      .eq('empleado_id', empleado.id)
      .maybeSingle();

    if (!credentialRow) throw new Error('Esta huella no corresponde a este empleado.');

    const pending = await consumirChallenge(challengeId, empleado.id, 'authentication');
    const { rpID, origin } = getWebAuthnConfig();
    const publicKeyBytes: number[] = JSON.parse(credentialRow.public_key);

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

    if (!verification.verified) return { success: false, error: 'Firma biométrica inválida.' };

    const tipo = String(tipoFichaje ?? '').trim().toLowerCase();
    if (tipo !== 'entrada' && tipo !== 'salida') throw new Error('Tipo de fichaje inválido.');

    await supabase
      .from('credenciales_biometricas')
      .update({ counter: verification.authenticationInfo.newCounter })
      .eq('credential_id', credentialRow.credential_id)
      .eq('empleado_id', empleado.id);

    const { error: fichajeError } = await supabase.from('fichajes').insert({
      empleado_id: empleado.id,
      tipo,
      hora_registro: new Date().toISOString(),
    });

    if (fichajeError) throw new Error('Error guardando el fichaje.');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'No se pudo completar el fichaje.' };
  }
}
