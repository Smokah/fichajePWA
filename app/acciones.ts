"use server";

import { 
  generateRegistrationOptions, 
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from "@simplewebauthn/server";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const rpName = "Fichajes PWA";
const rpID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const origin = process.env.NEXT_PUBLIC_ORIGIN || `http://${rpID}:3000`;

// ==========================================
// 1. LÓGICA DE REGISTRO (Vincular celular)
// ==========================================

export async function generarOpcionesRegistro(empleadoId: string) {
  const userID = new TextEncoder().encode(empleadoId);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID,
    userName: `empleado_${empleadoId}`,
    attestationType: "none",
    authenticatorSelection: {
      userVerification: "required",
      residentKey: "required",
    },
  });

  return options;
}

export async function verificarRegistro(empleadoId: string, response: any, expectedChallenge: string) {
  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;

      const { error } = await supabase
        .from('credenciales_biometricas')
        .insert([{
          empleado_id: empleadoId,
          credential_id: credential.id,
          public_key: Buffer.from(credential.publicKey).toString('base64'),
          counter: credential.counter
        }]);

      if (error) return { success: false, error: error.message };
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
  
  return { success: false, error: "Verificación fallida" };
}

// ==========================================
// 2. LÓGICA DE FICHAJE (Entrada / Salida)
// ==========================================

export async function generarOpcionesAutenticacion(empleadoId: string) {
  // Buscamos las credenciales vinculadas a este empleado
  const { data: credenciales, error } = await supabase
    .from('credenciales_biometricas')
    .select('credential_id')
    .eq('empleado_id', empleadoId);

  if (error || !credenciales || credenciales.length === 0) {
    throw new Error('No tienes ningún celular vinculado. Debes registrarte primero.');
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: credenciales.map(cred => ({
      id: cred.credential_id,
      type: 'public-key' as const,
    })),
  });

  return options;
}

export async function verificarAutenticacion(
  empleadoId: string, 
  response: any, 
  expectedChallenge: string, 
  tipoFichaje: 'entrada' | 'salida'
) {
  try {
    // Traemos la credencial exacta que usó el celular desde Supabase
    const { data: credencial, error: credError } = await supabase
      .from('credenciales_biometricas')
      .select('*')
      .eq('credential_id', response.id)
      .single();

    if (credError || !credencial) {
      return { success: false, error: 'Credencial no reconocida.' };
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credencial.credential_id,
        publicKey: new Uint8Array(Buffer.from(credencial.public_key, 'base64')),
        counter: Number(credencial.counter),
        transports: [],
      },
    });

    if (verification.verified) {
      // 1. Actualizamos el contador de seguridad de WebAuthn
      await supabase
        .from('credenciales_biometricas')
        .update({ counter: verification.authenticationInfo.newCounter })
        .eq('credential_id', credencial.credential_id);

      // 2. IMPACTAMOS EL FICHAJE EN LA BASE DE DATOS
      const { error: fichajeError } = await supabase
        .from('fichajes')
        .insert([{
          empleado_id: empleadoId,
          tipo: tipoFichaje
          // hora_registro se asigna sola por el default now() de la BD
        }]);

      if (fichajeError) return { success: false, error: fichajeError.message };
      
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
  
  return { success: false, error: "Firma biométrica inválida" };
}
