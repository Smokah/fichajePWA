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

const TZ_ARGENTINA = 'America/Argentina/Buenos_Aires';

type ChallengePurpose = 'registration' | 'authentication';
type ActionResult =
  | { success: true; tipo: 'entrada' | 'salida'; sucursal: string; hora: string }
  | { success: false; error: string };

function getInicioDiaArgentinaISO(): string {
  const fechaAr = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_ARGENTINA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${fechaAr}T00:00:00.000-03:00`).toISOString();
}

async function getEmpleadoByEmail(email: string) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from('empleados')
    .select('id, nombre, email, sucursal_id, sucursales(nombre)')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) throw new Error('No se pudo consultar el empleado.');
  if (!data) throw new Error('El correo no está registrado.');
  return data;
}

async function getEmpleadoById(empleadoId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('empleados')
    .select('id, nombre, email, sucursal_id, sucursales(nombre)')
    .eq('id', empleadoId)
    .maybeSingle();

  if (error || !data) throw new Error('Dispositivo no vinculado. Realizá el alta por única vez.');
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

  if (error) throw new Error('No se pudo iniciar la validación biométrica.');
  return challengeId;
}

async function consumirChallenge(
  challengeId: string,
  empleadoId: string,
  purpose: ChallengePurpose,
): Promise<{ challenge: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(String(challengeId ?? ''))) {
    throw new Error('La sesión biométrica expiró.');
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

  if (error || !data) throw new Error('El desafío expiró. Volvé a escanear el QR.');
  return data;
}

export async function obtenerSugerenciaTurno(empleadoId: string): Promise<{
  sugerencia: 'entrada' | 'salida';
  ultimaMarca: { tipo: string; hora: string; sucursal: string } | null;
}> {
  try {
    const supabase = getSupabaseAdmin();
    const inicioDiaIso = getInicioDiaArgentinaISO();

    const { data: ultimo } = await supabase
      .from('fichajes')
      .select('tipo, hora_registro, sucursales(nombre)')
      .eq('empleado_id', empleadoId)
      .gte('hora_registro', inicioDiaIso)
      .order('hora_registro', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ultimo) {
      return { sugerencia: 'entrada', ultimaMarca: null };
    }

    const esEntrada = String(ultimo.tipo).toLowerCase() === 'entrada';
    return {
      sugerencia: esEntrada ? 'salida' : 'entrada',
      ultimaMarca: {
        tipo: esEntrada ? 'Entrada' : 'Salida',
        hora: new Date(ultimo.hora_registro).toLocaleTimeString('es-AR', {
          timeZone: TZ_ARGENTINA,
          hour: '2-digit',
          minute: '2-digit',
        }),
        sucursal: (ultimo.sucursales as any)?.nombre || 'Sede',
      },
    };
  } catch {
    return { sugerencia: 'entrada', ultimaMarca: null };
  }
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
    if (msg.includes('EMAIL_DUPLICADO')) throw new Error('Correo duplicado. Contactá a administración.');
    throw new Error('No se pudo completar el alta.');
  }

  const empleado = Array.isArray(data) ? data[0] : data;
  if (!empleado?.id || !empleado?.nombre) throw new Error('Error al crear el registro.');

  const { data: existingCredentials } = await supabase
    .from('credenciales_biometricas')
    .select('credential_id')
    .eq('empleado_id', empleado.id);

  if (existingCredentials && existingCredentials.length > 0) {
    throw new Error('Este usuario ya tiene un celular vinculado. Si cambiaste de teléfono, pedí resetearlo en Administración.');
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
) {
  try {
    const empleado = await getEmpleadoByEmail(email);
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
      return { success: false as const, error: 'El sensor biométrico no pudo verificarse.' };
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

    if (insertError) return { success: false as const, error: 'No se pudo guardar la credencial biométrica.' };

    return {
      success: true as const,
      perfil: {
        empleadoId: empleado.id,
        nombre: empleado.nombre,
        email: empleado.email,
        sucursal: (empleado.sucursales as any)?.nombre || 'Sede asignada',
      },
    };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Error en registro biométrico.' };
  }
}

export async function iniciarFichajeConQR(empleadoId: string, qrRaw: string) {
  const raw = String(qrRaw ?? '').trim();
  if (!raw) throw new Error('Código QR vacío o ilegible.');

  let extractedToken = raw;
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const url = new URL(raw);
      extractedToken = url.searchParams.get('qr') || raw;
    }
  } catch {
    // mantener token original
  }

  if (!/^[a-f0-9]{48}$/i.test(extractedToken)) {
    throw new Error('Código QR inválido. Escaneá el código dinámico en la pantalla de la sucursal.');
  }

  const empleado = await getEmpleadoById(empleadoId);
  const supabase = getSupabaseAdmin();

  const { data: credentials, error: credError } = await supabase
    .from('credenciales_biometricas')
    .select('credential_id')
    .eq('empleado_id', empleado.id);

  if (credError || !credentials || credentials.length === 0) {
    throw new Error('Tu dispositivo ya no está vinculado. Realizá el alta nuevamente.');
  }

  const nowIso = new Date().toISOString();
  const { data: qrConsumido, error: qrError } = await supabase
    .from('qr_tokens_dinamicos')
    .update({
      consumed_at: nowIso,
      consumed_by: empleado.id,
    })
    .eq('token', extractedToken.toLowerCase())
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .select('id, sucursal_id, sucursales(id, nombre)')
    .maybeSingle();

  if (qrError || !qrConsumido) {
    throw new Error('Código QR vencido o ya utilizado. Escaneá el nuevo código en pantalla.');
  }

  const sucursalObj = qrConsumido.sucursales as any;
  const sucursalId = qrConsumido.sucursal_id;
  const sucursalNombre = sucursalObj?.nombre || 'Sucursal';

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

  return {
    options,
    challengeId,
    sucursalId,
    sucursalNombre,
    empleadoNombre: empleado.nombre,
  };
}

export async function confirmarFichajeConQR(
  empleadoId: string,
  sucursalId: number,
  response: unknown,
  challengeId: string,
  tipoFichaje: 'entrada' | 'salida',
): Promise<ActionResult> {
  try {
    const empleado = await getEmpleadoById(empleadoId);
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

    if (!credentialRow) throw new Error('La huella no coincide con el titular de este dispositivo.');

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

    if (!verification.verified) return { success: false, error: 'Verificación biométrica rechazada.' };

    await supabase
      .from('credenciales_biometricas')
      .update({ counter: verification.authenticationInfo.newCounter })
      .eq('credential_id', credentialRow.credential_id)
      .eq('empleado_id', empleado.id);

    const { data: suc } = await supabase
      .from('sucursales')
      .select('nombre')
      .eq('id', sucursalId)
      .maybeSingle();

    const tipoFinal = tipoFichaje === 'salida' ? 'salida' : 'entrada';
    const now = new Date();
    const { error: fichajeError } = await supabase.from('fichajes').insert({
      empleado_id: empleado.id,
      sucursal_id: sucursalId,
      tipo: tipoFinal,
      hora_registro: now.toISOString(),
    });

    if (fichajeError) throw new Error('Error guardando la marca en base de datos.');

    return {
      success: true,
      tipo: tipoFinal,
      sucursal: suc?.nombre || 'Sede registrada',
      hora: now.toLocaleTimeString('es-AR', {
        timeZone: TZ_ARGENTINA,
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'No se pudo registrar la asistencia.' };
  }
}
